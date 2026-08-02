import { WeatherAlert } from '../types';
import { supabase } from './supabase';
import { sendPushNotification, PushResult } from './apns';
import { alertSignature, isAlertRelevantForPoint } from '../utils/alertGeo';
import crypto from 'crypto';

/** Codice PostgreSQL per violazione di vincolo di unicità */
const UNIQUE_VIOLATION = '23505';

/**
 * Identifica un device senza conservarne il token in chiaro.
 * Stesso schema usato in `alert_delivery_log`.
 */
function hashDeviceToken(deviceToken: string): string {
	return crypto.createHash('sha256').update(deviceToken).digest('hex').slice(0, 16);
}

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
 * Un device può avere più righe in `alert_subscriptions` (registrazioni residue,
 * `/subscribe` che non è riuscito a ripulire le precedenti). Dedup e cooldown
 * sono per `subscription_id`, quindi righe multiple significano notifiche
 * multiple sullo stesso telefono: si tiene solo la più recente per device.
 */
function oneSubscriptionPerDevice(subscriptions: any[]): any[] {
	const byToken = new Map<string, any>();

	for (const sub of subscriptions) {
		const existing = byToken.get(sub.device_token);
		if (!existing) {
			byToken.set(sub.device_token, sub);
			continue;
		}
		const existingTime = existing.updated_at || existing.created_at || '';
		const candidateTime = sub.updated_at || sub.created_at || '';
		if (candidateTime > existingTime) byToken.set(sub.device_token, sub);
	}

	return Array.from(byToken.values());
}

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

	const stats = { processed: 0, skippedExpired: 0, skippedUnlikely: 0, skippedDuplicate: 0, skippedCooldown: 0, skippedOutOfArea: 0, skippedSameDevice: 0, pushSent: 0, pushFailed: 0, noSubscribers: 0, dedupWriteFailed: 0, expiredTokens: 0 };

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
			const inArea = (subscriptions || []).filter(sub => {
				if (isAlertRelevantForPoint(alert, sub.location_lat, sub.location_lon)) return true;
				console.log(`${logPrefix} Alert ${alert.id} area=${alert.areaName || alert.areaId || 'unknown'} non pertinente per sub=${sub.id} (${sub.location_lat},${sub.location_lon}), skipping`);
				stats.skippedOutOfArea++;
				return false;
			});

			const recipients = oneSubscriptionPerDevice(inArea);
			if (recipients.length < inArea.length) {
				stats.skippedSameDevice += inArea.length - recipients.length;
				console.warn(`${logPrefix} Alert ${alert.id}: ${inArea.length - recipients.length} subscription duplicate per device ignorate`);
			}

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
					const { error: historyError } = await supabase.from('weather_alerts').insert({
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

					if (historyError) {
						stats.dedupWriteFailed++;
						console.error(`${logPrefix} DEDUP WRITE FAILED (storico) per alert ${alert.id}: ${historyError.message}`);
					}
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

			const signature = alertSignature(alert);

			for (const sub of recipients) {
				const tokenHash = hashDeviceToken(sub.device_token);

				// Cooldown: questo device ha già ricevuto un'allerta di pari gravità
				// di recente? Legato al device e non alla subscription, che viene
				// ricreata a ogni spostamento del telefono.
				const cooldownSince = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
				const { data: recentAlerts } = await supabase
					.from('weather_alerts')
					.select('id')
					.eq('device_token_hash', tokenHash)
					.eq('alert_type', alert.severity)
					.gte('sent_at', cooldownSince)
					.limit(1);

				if (recentAlerts && recentAlerts.length > 0) {
					console.log(`${logPrefix} Cooldown active: device=${tokenHash} ha già ricevuto un'allerta ${alert.severity} nelle ultime ${COOLDOWN_HOURS}h, skipping`);
					stats.skippedCooldown++;
					continue;
				}

				// Prenotazione dell'invio PRIMA della push: l'indice unico
				// (device_token_hash, alert_signature) è ciò che rende atomica la
				// deduplicazione. Un controllo in lettura seguito da una scrittura
				// non basta, perché più invocazioni concorrenti lo superano tutte.
				const { error: claimError } = await supabase.from('weather_alerts').insert({
					subscription_id: sub.id,
					device_token_hash: tokenHash,
					alert_signature: signature,
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
					expire_time: alert.expireTime,
					delivery_status: 'pending'
				});

				if (claimError) {
					if (claimError.code === UNIQUE_VIOLATION) {
						console.log(`${logPrefix} Alert ${alert.id} (${signature}) già inviata a device=${tokenHash} (dedup), skipping`);
						stats.skippedDuplicate++;
					} else {
						// Fail-closed: senza la riga di dedup la notifica ripartirebbe
						// a ogni giro, quindi si rinuncia all'invio.
						stats.dedupWriteFailed++;
						console.error(`${logPrefix} DEDUP WRITE FAILED per alert ${alert.id} device=${tokenHash}: ${claimError.message} — push non inviata (migration non applicata?)`);
					}
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

				const deliveryStatus = pushResult.sent ? 'sent' : (pushResult.isExpiredToken ? 'expired_token' : 'failed');

				if (!pushResult.sent && !pushResult.isExpiredToken) {
					// Fallimento transitorio di APNs: la prenotazione viene rilasciata,
					// altrimenti l'allerta resterebbe marcata come presa in carico e non
					// verrebbe mai più tentata. Il prossimo giro del poller riprova.
					await supabase
						.from('weather_alerts')
						.delete()
						.eq('device_token_hash', tokenHash)
						.eq('alert_signature', signature);
				} else {
					await supabase
						.from('weather_alerts')
						.update({ delivery_status: deliveryStatus })
						.eq('device_token_hash', tokenHash)
						.eq('alert_signature', signature);
				}

				// Log delivery nella tabella di audit
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

	console.log(`${logPrefix} Summary for ${lat},${lon}: total=${alerts.length} processed=${stats.processed} pushSent=${stats.pushSent} pushFailed=${stats.pushFailed} expiredTokens=${stats.expiredTokens} noSubscribers=${stats.noSubscribers} skippedExpired=${stats.skippedExpired} skippedUnlikely=${stats.skippedUnlikely} skippedOutOfArea=${stats.skippedOutOfArea} skippedSameDevice=${stats.skippedSameDevice} skippedDuplicate=${stats.skippedDuplicate} skippedCooldown=${stats.skippedCooldown} dedupWriteFailed=${stats.dedupWriteFailed}`);
}
