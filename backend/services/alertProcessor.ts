import { WeatherAlert } from '../types';
import { supabase } from './supabase';
import { sendPushNotification } from './apns';

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

	let stats = { processed: 0, skippedExpired: 0, skippedUnlikely: 0, skippedDuplicate: 0, pushSent: 0, pushFailed: 0, noSubscribers: 0 };

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
			// Controlla se questa allerta è già stata processata (deduplicazione per external_alert_id)
			const { data: existing } = await supabase
				.from('weather_alerts')
				.select('id')
				.eq('external_alert_id', alert.id)
				.limit(1);

			if (existing && existing.length > 0) {
				console.log(`${logPrefix} Alert ${alert.id} already processed (dedup), skipping`);
				stats.skippedDuplicate++;
				continue;
			}

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

			if (!subscriptions || subscriptions.length === 0) {
				console.log(`${logPrefix} Alert ${alert.id} severity=${alert.severity} area=${alert.areaName || 'unknown'} — 0 subscriptions in radius ±${LOCATION_RADIUS_DEG}° of ${lat},${lon}`);
				stats.noSubscribers++;
				// Salva comunque l'allerta per deduplicazione (senza subscription_id)
				await supabase.from('weather_alerts').insert({
					external_alert_id: alert.id,
					alert_type: alert.severity,
					message: alert.description,
					severity: mapSeverityToDb(alert.severity),
					area_name: alert.areaName,
					event_source: alert.eventSource || alert.source,
					effective_time: alert.effectiveTime,
					expire_time: alert.expireTime
				});
				continue;
			}

			console.log(`${logPrefix} Alert ${alert.id} severity=${alert.severity} area=${alert.areaName || 'unknown'} — ${subscriptions.length} subscriber(s) found`);
			stats.processed++;

			const title = alertTitle(alert.severity);
			// Tronca la descrizione per la push notification
			const body = alert.description.length > 200
				? alert.description.substring(0, 197) + '...'
				: alert.description;

			for (const sub of subscriptions) {
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

				const sent = await sendPushNotification(sub.device_token, title, body, payload);

				// Salva il record dell'allerta inviata
				await supabase.from('weather_alerts').insert({
					subscription_id: sub.id,
					external_alert_id: alert.id,
					alert_type: alert.severity,
					message: alert.description,
					severity: mapSeverityToDb(alert.severity),
					area_name: alert.areaName,
					event_source: alert.eventSource || alert.source,
					effective_time: alert.effectiveTime,
					expire_time: alert.expireTime
				});

				if (sent) {
					stats.pushSent++;
					console.log(`${logPrefix} Push OK: alert=${alert.id} device=${sub.device_token.slice(0, 8)}... sub_lat=${sub.location_lat} sub_lon=${sub.location_lon}`);
				} else {
					stats.pushFailed++;
					console.warn(`${logPrefix} Push FAILED: alert=${alert.id} device=${sub.device_token.slice(0, 8)}... sub_lat=${sub.location_lat} sub_lon=${sub.location_lon}`);
				}
			}
		} catch (err: any) {
			console.error(`${logPrefix} Exception processing alert ${alert.id} severity=${alert.severity}: ${err.message}`);
		}
	}

	console.log(`${logPrefix} Summary for ${lat},${lon}: total=${alerts.length} processed=${stats.processed} pushSent=${stats.pushSent} pushFailed=${stats.pushFailed} noSubscribers=${stats.noSubscribers} skippedExpired=${stats.skippedExpired} skippedUnlikely=${stats.skippedUnlikely} skippedDuplicate=${stats.skippedDuplicate}`);
}
