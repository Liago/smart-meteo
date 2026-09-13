import crypto from 'crypto';
import { supabase } from './supabase';
import { sendPushNotification, PushResult } from './apns';
import { AlertRule, RuleForecast, RuleHit, evaluateRules } from '../utils/alertRules';

/**
 * Invio delle notifiche per le regole di soglia personali.
 *
 * Gemello di `alertProcessor.ts` per le allerte governative, e ne riusa la
 * parte non ovvia: la **prenotazione prima dell'invio**. Scrivere la riga di
 * deduplica dopo la push lascerebbe una finestra in cui due invocazioni
 * concorrenti del poller mandano entrambe la stessa notifica; un controllo in
 * lettura seguito da una scrittura la lascia ugualmente. L'indice unico su
 * (device, firma) è l'unica barriera che regge.
 */

/** Codice PostgreSQL per violazione di vincolo di unicità. */
const UNIQUE_VIOLATION = '23505';

/** Identifica un device senza conservarne il token in chiaro. */
function hashDeviceToken(deviceToken: string): string {
	return crypto.createHash('sha256').update(deviceToken).digest('hex').slice(0, 16);
}

export interface RuleProcessStats {
	devices: number;
	evaluated: number;
	hits: number;
	pushSent: number;
	pushFailed: number;
	skippedDuplicate: number;
	claimFailed: number;
	expiredTokens: number;
}

function emptyStats(): RuleProcessStats {
	return {
		devices: 0,
		evaluated: 0,
		hits: 0,
		pushSent: 0,
		pushFailed: 0,
		skippedDuplicate: 0,
		claimFailed: 0,
		expiredTokens: 0,
	};
}

/** Titolo della notifica: breve, perché il corpo porta già il numero. */
function ruleTitle(hit: RuleHit): string {
	return `⚠️ ${hit.metric.label}`;
}

/**
 * Valuta le regole dei device indicati e invia le notifiche per gli scatti.
 *
 * @param deviceTokens i device della zona, già filtrati dal chiamante
 * @param forecast la previsione **aggregata** della zona: è quella che l'utente
 *                 vede in app, e valutare altrove darebbe numeri diversi da
 *                 quelli sullo schermo
 * @param fromTime chiave del primo slot orario da considerare
 */
export async function processAlertRules(
	deviceTokens: string[],
	forecast: RuleForecast,
	fromTime?: string
): Promise<RuleProcessStats> {
	const logPrefix = '[AlertRules]';
	const stats = emptyStats();

	if (!deviceTokens || deviceTokens.length === 0) return stats;

	const { data: rules, error } = await supabase
		.from('alert_rules')
		.select('*')
		.in('device_token', deviceTokens)
		.eq('enabled', true);

	if (error) {
		console.error(`${logPrefix} Errore nel leggere le regole: ${error.message}`);
		return stats;
	}
	if (!rules || rules.length === 0) return stats;

	// Le regole si valutano per device: la previsione è la stessa per tutta la
	// zona, ma la deduplica è per telefono.
	const byDevice = new Map<string, AlertRule[]>();
	for (const rule of rules) {
		const list = byDevice.get(rule.device_token) ?? [];
		list.push(rule);
		byDevice.set(rule.device_token, list);
	}

	stats.devices = byDevice.size;
	stats.evaluated = rules.length;

	for (const [deviceToken, deviceRules] of byDevice) {
		const hits = evaluateRules(deviceRules, forecast, fromTime);
		stats.hits += hits.length;

		for (const hit of hits) {
			const tokenHash = hashDeviceToken(deviceToken);

			const { error: claimError } = await supabase.from('alert_rule_hits').insert({
				rule_id: hit.rule.id,
				device_token_hash: tokenHash,
				signature: hit.signature,
				metric: hit.rule.metric,
				value: hit.value,
				message: hit.message,
				delivery_status: 'pending',
			});

			if (claimError) {
				if (claimError.code === UNIQUE_VIOLATION) {
					stats.skippedDuplicate++;
				} else {
					// Fail-closed, come per le allerte governative: senza la riga
					// di deduplica la notifica ripartirebbe a ogni giro del
					// poller, cioè quattro volte l'ora.
					stats.claimFailed++;
					console.error(
						`${logPrefix} PRENOTAZIONE FALLITA per la regola ${hit.rule.id}: ${claimError.message} — push non inviata (migrazione 024 non applicata?)`
					);
				}
				continue;
			}

			const push: PushResult = await sendPushNotification(
				deviceToken,
				ruleTitle(hit),
				hit.message,
				{
					categoryId: 'WEATHER_RULE',
					customData: {
						type: 'alert_rule',
						ruleId: hit.rule.id,
						metric: hit.rule.metric,
						value: hit.value,
						at: hit.at,
					},
				}
			);

			const deliveryStatus = push.sent
				? 'sent'
				: push.isExpiredToken
					? 'expired_token'
					: 'failed';

			if (!push.sent && !push.isExpiredToken) {
				// Fallimento transitorio di APNs: si rilascia la prenotazione,
				// altrimenti lo scatto resterebbe marcato come preso in carico e
				// non verrebbe mai più tentato.
				await supabase
					.from('alert_rule_hits')
					.delete()
					.eq('device_token_hash', tokenHash)
					.eq('signature', hit.signature);
			} else {
				await supabase
					.from('alert_rule_hits')
					.update({ delivery_status: deliveryStatus })
					.eq('device_token_hash', tokenHash)
					.eq('signature', hit.signature);
			}

			if (push.sent) {
				stats.pushSent++;
				console.log(`${logPrefix} Push OK: ${hit.message} → device=${tokenHash}`);
			} else {
				stats.pushFailed++;
				console.warn(`${logPrefix} Push FALLITA: regola=${hit.rule.id} motivo=${push.reason}`);

				if (push.isExpiredToken) {
					// Il telefono non esiste più: si spengono le sue regole, non
					// si cancellano — se l'app viene reinstallata sullo stesso
					// device l'utente ritrova le sue soglie.
					await supabase
						.from('alert_rules')
						.update({ enabled: false })
						.eq('device_token', deviceToken);
					stats.expiredTokens++;
					console.log(`${logPrefix} Token scaduto: regole del device ${tokenHash} disabilitate`);
				}
			}
		}
	}

	if (stats.hits > 0 || stats.pushFailed > 0) {
		console.log(
			`${logPrefix} devices=${stats.devices} regole=${stats.evaluated} scatti=${stats.hits} inviate=${stats.pushSent} fallite=${stats.pushFailed} duplicate=${stats.skippedDuplicate} prenotazioniFallite=${stats.claimFailed}`
		);
	}

	return stats;
}
