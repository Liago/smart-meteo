import { WeatherAlert } from '../types';
import { supabase } from './supabase';
import { sendPushNotification, PushResult } from './apns';
import { isAlertRelevantForPoint } from '../utils/alertGeo';
import crypto from 'crypto';

/**
 * Mappa la severity di WeatherKit a quella usata nella tabella weather_alerts
 */
function mapSeverityToDb(severity: string): string {
	switch (severity) {
		case 'extreme':
		case 'severe':
			return 'critical';
		case 'moderate':
			return 'warning';
		case 'minor':
		default:
			return 'info';
	}
}

/**
 * Genera il titolo della notifica push in base alla severity
 */
function alertTitle(severity: string): string {
	switch (severity) {
		case 'extreme':
			return '🔴 Allerta Meteo Estrema';
		case 'severe':
			return '🟠 Allerta Meteo Severa';
		case 'moderate':
			return '🟡 Allerta Meteo';
		case 'minor':
		default:
			return 'ℹ️ Avviso Meteo';
	}
}

/**
 * Raggio di ricerca in gradi (~50km) per trovare le sottoscrizioni vicine all'area dell'allerta
 */
const LOCATION_RADIUS_DEG = 0.5;

/**
 * Cooldown in ore: non inviare la stessa tipologia di allerta allo stesso dispositivo
 * entro questo intervallo, anche se l'external_alert_id cambia (protezione anti-spam).
 */
const COOLDOWN_HOURS = 6;

/**
 * Processa le allerte meteo ricevute da WeatherKit.
 * 1. Filtra allerte scadute o già inviate
 * 2. Trova sottoscrizioni nella zona interessata
 * 3. Invia push notification via APNs
 * 4. Salva nel DB per evitare duplicati
 */
export async function processWeatherAlerts(alerts: WeatherAlert[], lat: number, lon: number): Promise<void> {
	const logPrefix = '[AlertPipeline]';

	if (!alerts || alerts.length === 0) {
		console.log(`${logPrefix} Called with 0 alerts for ${lat},${lon} — nothing to process`);
		return;
	}

	console.log(`${logPrefix} Processing ${alerts.length} alert(s) for area ${lat},${lon}`);

	const stats = { processed: 0, skippedExpired: 0, skippedUnlikely: 0, skippedDuplicate: 0, skippedCooldown: 0, skippedOutOfArea: 0, pushSent: 0, pushFailed: 0, noSubscribers: 0, expiredTokens: 0 };

	for (const alert of alerts) {
		// Salta allerte scadute
		if (alert.expireTime && new Date(alert.expireTime) < new Date()) {
			console.log(`${logPrefix} Alert ${alert.id} severity=${alert.severity} expired at ${alert.expireTime}, skipping`);
			stats.skippedExpired++;
			continue;
		}

		// Salta allerte con certainty troppo bassa
		if (alert.certainty === 'unlikely') {
			console.log(`${logPrefix} Alert ${alert.id} severity=${alert.severity} certainty=unlikely, skipping`);
			stats.skippedUnlikely++;
			continue;
		}

		try {
			// Trova tutte le sottoscrizioni nella zona dell'allerta
			const { data: subscriptions, error: subError } = await supabase
				.from('alert_subscriptions')
				.select('*')
				.eq('enabled', true)
				.gte('location_lat', lat - LOCATION_RADIUS_DEG)
				.lte('location_lat', lat + LOCATION_RADIUS_DEG)
				.gte('location_lon', lon - LOCATION_RADIUS_DEG)
				.lte('location_lon', lon + LOCATION_RADIUS_DEG);

			if (subError) {
				console.error(`${logPrefix} DB error fetching subscriptions for alert ${alert.id}: ${subError.message}`);
				continue;
			}

			// Il raggio di ricerca (±0.5°) è più ampio dell'area dell'allerta:
			// verifica ogni dispositivo sulle SUE coordinate prima di notificarlo.
			const recipients = (subscriptions || []).filter(sub => {
				if (isAlertRelevantForPoint(alert, sub.location_lat, sub.location_lon)) return true;
				console.log(`${logPrefix} Alert ${alert.id} area=${alert.areaName || alert.areaId || 'unknown'} non pertinente per sub=${sub.id} (${sub.location_lat},${sub.location_lon}), skipping`);
				stats.skippedOutOfArea++;
				return false;
			});

			if (recipients.length === 0) {
				console.log(`${logPrefix} Alert ${alert.id} severity=${alert.severity} area=${alert.areaName || 'unknown'} — 0 destinatari nel raggio ±${LOCATION_RADIUS_DEG}° di ${lat},${lon}`);
				stats.noSubscribers++;
				// Salva comunque l'allerta come storico (senza subscription_id), una volta sola
				const { data: alreadyLogged } = await supabase
					.from('weather_alerts')
					.select('id')
					.eq('external_alert_id', alert.id)
					.is('subscription_id', null)
					.limit(1);

				if (!alreadyLogged || alreadyLogged.length === 0) {
					await supabase.from('weather_alerts').insert({
						external_alert_id: alert.id,
						alert_type: alert.severity,
						message: alert.description,
						severity: mapSeverityToDb(alert.severity),
						area_id: alert.areaId,
						area_name: alert.areaName,
						country_code: alert.countryCode,
						location_lat: lat,
						location_lon: lon,
						event_source: alert.eventSource || alert.source,
						effective_time: alert.effectiveTime,
						expire_time: alert.expireTime
					});
				}
				continue;
			}

			console.log(`${logPrefix} Alert ${alert.id} severity=${alert.severity} area=${alert.areaName || 'unknown'} — ${recipients.length} subscriber(s) found`);
			stats.processed++;

			const title = alertTitle(alert.severity);
			// Tronca la descrizione per la push notification
			const body = alert.description.length > 200
				? alert.description.substring(0, 197) + '...'
				: alert.description;

			for (const sub of recipients) {
				// Deduplicazione per destinatario: la stessa allerta non viene inviata
				// due volte allo stesso device, ma resta disponibile per gli altri.
				const { data: alreadySent } = await supabase
					.from('weather_alerts')
					.select('id')
					.eq('external_alert_id', alert.id)
					.eq('subscription_id', sub.id)
					.limit(1);

				if (alreadySent && alreadySent.length > 0) {
					console.log(`${logPrefix} Alert ${alert.id} già inviata a sub=${sub.id} (dedup), skipping`);
					stats.skippedDuplicate++;
					continue;
				}

				// Cooldown: controlla se questa subscription ha già ricevuto un'allerta simile di recente
				const cooldownSince = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
				const { data: recentAlerts } = await supabase
					.from('weather_alerts')
					.select('id')
					.eq('subscription_id', sub.id)
					.eq('alert_type', alert.severity)
					.gte('sent_at', cooldownSince)
					.limit(1);

				if (recentAlerts && recentAlerts.length > 0) {
					console.log(`${logPrefix} Cooldown active: sub=${sub.id} already received ${alert.severity} alert in last ${COOLDOWN_HOURS}h, skipping`);
					stats.skippedCooldown++;
					continue;
				}

				const payload = {
					categoryId: 'WEATHER_ALERT',
					customData: {
						type: 'weather_alert',
						alertId: alert.id,
						severity: alert.severity,
						lat: sub.location_lat,
						lon: sub.location_lon,
						effectiveTime: alert.effectiveTime,
						expireTime: alert.expireTime
					}
				};

				const pushResult: PushResult = await sendPushNotification(sub.device_token, title, body, payload);

				// Salva il record dell'allerta inviata
				await supabase.from('weather_alerts').insert({
					subscription_id: sub.id,
					external_alert_id: alert.id,
					alert_type: alert.severity,
					message: alert.description,
					severity: mapSeverityToDb(alert.severity),
					area_id: alert.areaId,
					area_name: alert.areaName,
					country_code: alert.countryCode,
					location_lat: sub.location_lat,
					location_lon: sub.location_lon,
					event_source: alert.eventSource || alert.source,
					effective_time: alert.effectiveTime,
					expire_time: alert.expireTime
				});

				// Log delivery nella tabella di audit
				const tokenHash = crypto.createHash('sha256').update(sub.device_token).digest('hex').slice(0, 16);
				const deliveryStatus = pushResult.sent ? 'sent' : (pushResult.isExpiredToken ? 'expired_token' : 'failed');
				await supabase.from('alert_delivery_log').insert({
					alert_id: alert.id,
					subscription_id: sub.id,
					device_token_hash: tokenHash,
					status: deliveryStatus,
					apns_response: pushResult.reason ? { reason: pushResult.reason } : null,
					error_reason: pushResult.reason || null,
				}).then(({ error }) => {
					if (error) console.warn(`${logPrefix} Failed to log delivery: ${error.message}`);
				});

				if (pushResult.sent) {
					stats.pushSent++;
					console.log(`${logPrefix} Push OK: alert=${alert.id} device=${sub.device_token.slice(0, 8)}... sub_lat=${sub.location_lat} sub_lon=${sub.location_lon}`);
				} else {
					stats.pushFailed++;
					console.warn(`${logPrefix} Push FAILED: alert=${alert.id} device=${sub.device_token.slice(0, 8)}... reason=${pushResult.reason}`);

					// Se il token è scaduto/invalido, disabilita la subscription
					if (pushResult.isExpiredToken) {
						console.log(`${logPrefix} Disabling subscription ${sub.id} due to expired/invalid device token`);
						await supabase
							.from('alert_subscriptions')
							.update({ enabled: false })
							.eq('id', sub.id);
						stats.expiredTokens++;
					}
				}
			}
		} catch (err: any) {
			console.error(`${logPrefix} Exception processing alert ${alert.id} severity=${alert.severity}: ${err.message}`);
		}
	}

	console.log(`${logPrefix} Summary for ${lat},${lon}: total=${alerts.length} processed=${stats.processed} pushSent=${stats.pushSent} pushFailed=${stats.pushFailed} expiredTokens=${stats.expiredTokens} noSubscribers=${stats.noSubscribers} skippedExpired=${stats.skippedExpired} skippedUnlikely=${stats.skippedUnlikely} skippedOutOfArea=${stats.skippedOutOfArea} skippedDuplicate=${stats.skippedDuplicate} skippedCooldown=${stats.skippedCooldown}`);
}
