import { HourlyForecast } from '../types';

/**
 * Regole di allerta personali: soglie scelte dall'utente.
 *
 * Il sistema di allerte in produzione notifica solo quelle **governative**, che
 * scattano su criteri di protezione civile: utili, ma non rispondono a «avvisami
 * se stanotte gela», che è la domanda di chi ha un orto, una moto o un volo in
 * mongolfiera. Queste regole riusano per intero la pipeline esistente —
 * `alert_subscriptions`, APNs, poller a 15 minuti — e aggiungono solo il
 * confronto con una soglia.
 *
 * La valutazione è una funzione pura: prende la previsione già aggregata e le
 * regole, restituisce gli scatti. Nessuna rete, nessun database.
 */

/** Verso del confronto. */
export type RuleComparator = 'above' | 'below';

/**
 * Come si ricava il valore da confrontare.
 *
 * `sum` esiste perché «se domani piove più di 10 mm» è un totale, non un
 * massimo orario: con il massimo, dieci ore da 9 mm non farebbero scattare
 * niente.
 */
export type RuleAggregation = 'min' | 'max' | 'sum' | 'current';

export interface RuleMetric {
	id: string;
	/** Etichetta italiana, usata nel messaggio della notifica. */
	label: string;
	/** Unità mostrata all'utente: la soglia è memorizzata in questa unità. */
	unit: string;
	aggregation: RuleAggregation;
	/** Decimali del valore nel messaggio. */
	decimals: number;
	/** Confronti che hanno senso su questa metrica. */
	comparators: RuleComparator[];
	/**
	 * Valore dell'ora, già convertito nell'unità dell'utente. La soglia la
	 * scrive una persona, non un modello: se pensa in km/h è in km/h che va
	 * confrontata, non nei m/s del contratto interno.
	 */
	fromHour?: (h: HourlyForecast) => number | null | undefined;
	/** Valore istantaneo, per le metriche che non hanno una serie oraria. */
	fromCurrent?: (current: RuleCurrent) => number | null | undefined;
}

/** Quel che serve del blocco `current` della risposta. */
export interface RuleCurrent {
	air_quality?: { european_aqi?: number | null } | null;
	[key: string]: unknown;
}

export interface RuleForecast {
	hourly?: HourlyForecast[];
	current?: RuleCurrent;
}

/** Da m/s a km/h: il contratto interno è in m/s, le persone pensano in km/h. */
const MS_TO_KMH = 3.6;

export const RULE_METRICS: RuleMetric[] = [
	{
		id: 'temp_min',
		label: 'Temperatura minima',
		unit: '°',
		aggregation: 'min',
		decimals: 0,
		// Entrambi i versi: «se scende sotto zero» per le gelate, «se non scende
		// sotto 25» per le notti tropicali, che è la stessa domanda d'estate.
		comparators: ['below', 'above'],
		fromHour: (h) => h.temp,
	},
	{
		id: 'temp_max',
		label: 'Temperatura massima',
		unit: '°',
		aggregation: 'max',
		decimals: 0,
		comparators: ['above', 'below'],
		fromHour: (h) => h.temp,
	},
	{
		id: 'wind_gust',
		label: 'Raffiche di vento',
		unit: ' km/h',
		aggregation: 'max',
		decimals: 0,
		// Solo `above`: nessuno chiede di essere avvisato quando il vento cala.
		comparators: ['above'],
		fromHour: (h) => (h.wind_gust != null ? h.wind_gust * MS_TO_KMH : null),
	},
	{
		id: 'precipitation_mm',
		label: 'Pioggia',
		unit: ' mm',
		aggregation: 'sum',
		decimals: 1,
		comparators: ['above'],
		fromHour: (h) => h.precipitation_mm,
	},
	{
		id: 'snowfall_cm',
		label: 'Neve',
		unit: ' cm',
		aggregation: 'sum',
		decimals: 1,
		comparators: ['above'],
		fromHour: (h) => h.snowfall_cm,
	},
	{
		id: 'storm_index',
		label: 'Rischio temporali',
		unit: '/100',
		aggregation: 'max',
		decimals: 0,
		comparators: ['above'],
		fromHour: (h) => h.storm_index,
	},
	{
		id: 'aqi',
		label: 'Qualità dell\'aria',
		// L'indice europeo, non l'EPA 1-6: «se l'AQI supera 100» ha senso solo
		// sulla scala 0-100+, dove 100 è la soglia di «scarsa».
		unit: '',
		aggregation: 'current',
		decimals: 0,
		comparators: ['above'],
		fromCurrent: (c) => c.air_quality?.european_aqi,
	},
];

const METRIC_BY_ID = new Map(RULE_METRICS.map((m) => [m.id, m]));

export function ruleMetric(id: string): RuleMetric | undefined {
	return METRIC_BY_ID.get(id);
}

/** Finestra di previsione minima e massima, in ore. */
export const HORIZON_MIN_HOURS = 1;
export const HORIZON_MAX_HOURS = 48;
export const HORIZON_DEFAULT_HOURS = 24;

export interface AlertRule {
	id: string;
	subscription_id?: string;
	metric: string;
	comparator: RuleComparator;
	threshold: number;
	horizon_hours: number;
	enabled?: boolean;
}

export interface RuleHit {
	rule: AlertRule;
	metric: RuleMetric;
	/** Valore che ha fatto scattare la regola, nell'unità dell'utente. */
	value: number;
	/** Slot orario responsabile; null per le metriche istantanee e per le somme. */
	at: string | null;
	message: string;
	/**
	 * Chiave di deduplica: cambia quando cambia il giorno a cui si riferisce lo
	 * scatto, non a ogni giro del poller. Senza, il poller a 15 minuti manderebbe
	 * la stessa notifica quattro volte l'ora; con una chiave legata al solo id
	 * della regola, una gelata di stanotte muterebbe quella di domani.
	 */
	signature: string;
}

/**
 * Valida i tre campi che il client può sbagliare.
 *
 * @returns null se la regola è valida, altrimenti il motivo in italiano.
 */
export function validateRule(
	metric: string,
	comparator: string,
	threshold: unknown,
	horizonHours: unknown = HORIZON_DEFAULT_HOURS
): string | null {
	const spec = ruleMetric(metric);
	if (!spec) return `Metrica sconosciuta: ${metric}`;

	if (!spec.comparators.includes(comparator as RuleComparator)) {
		return `Il confronto "${comparator}" non ha senso su ${spec.label.toLowerCase()}`;
	}
	if (typeof threshold !== 'number' || !Number.isFinite(threshold)) {
		return 'La soglia deve essere un numero';
	}
	if (
		typeof horizonHours !== 'number' ||
		!Number.isInteger(horizonHours) ||
		horizonHours < HORIZON_MIN_HOURS ||
		horizonHours > HORIZON_MAX_HOURS
	) {
		return `L'orizzonte deve essere un numero intero di ore fra ${HORIZON_MIN_HOURS} e ${HORIZON_MAX_HOURS}`;
	}
	return null;
}

/** Formatta un numero all'italiana, con i decimali della metrica. */
function formatValue(value: number, metric: RuleMetric): string {
	const rounded = value.toFixed(metric.decimals);
	return `${rounded.replace('.', ',')}${metric.unit}`;
}

/** Ora dello slot dalla chiave locale `YYYY-MM-DDTHH:00`. */
function hourOf(slot: string): string | null {
	const match = /T(\d{2}):(\d{2})/.exec(slot);
	return match ? `${match[1]}:${match[2]}` : null;
}

/** Giorno dello slot, usato come bucket di deduplica. */
function dayOf(slot: string): string {
	return slot.slice(0, 10);
}

function buildMessage(
	metric: RuleMetric,
	rule: AlertRule,
	value: number,
	at: string | null
): string {
	const verso = rule.comparator === 'above' ? 'oltre' : 'sotto';
	const soglia = formatValue(rule.threshold, metric);
	const trovato = formatValue(value, metric);
	const testa = `${metric.label} ${verso} ${soglia}`;

	if (metric.aggregation === 'current') return `${testa}: adesso ${trovato}`;
	if (metric.aggregation === 'sum') {
		return `${testa}: previsti ${trovato} nelle prossime ${rule.horizon_hours} ore`;
	}

	const ora = at ? hourOf(at) : null;
	return ora ? `${testa}: previsti ${trovato} alle ${ora}` : `${testa}: previsti ${trovato}`;
}

function breaches(value: number, rule: AlertRule): boolean {
	return rule.comparator === 'above' ? value > rule.threshold : value < rule.threshold;
}

/**
 * Valuta le regole sulla previsione **aggregata**, non su una singola fonte.
 *
 * È la stessa risposta che l'utente vede in app: valutare altrove produrrebbe
 * notifiche che dicono 12 mm mentre lo schermo ne mostra 3, e nessuna delle due
 * sarebbe sbagliata — sarebbero solo due fonti diverse, il che è peggio.
 *
 * @param fromTime chiave del primo slot da considerare (di solito l'ora corrente
 *                 locale): gli slot precedenti vengono scartati, perché una
 *                 gelata già avvenuta non è una previsione.
 */
export function evaluateRules(
	rules: AlertRule[],
	forecast: RuleForecast,
	fromTime?: string
): RuleHit[] {
	if (!rules || rules.length === 0) return [];

	const ordered = [...(forecast.hourly ?? [])]
		.filter((h) => !fromTime || h.time >= fromTime)
		.sort((a, b) => a.time.localeCompare(b.time));

	const hits: RuleHit[] = [];

	for (const rule of rules) {
		if (rule.enabled === false) continue;

		const metric = ruleMetric(rule.metric);
		if (!metric) continue;

		let value: number | null = null;
		let at: string | null = null;

		if (metric.aggregation === 'current') {
			const raw = forecast.current ? metric.fromCurrent?.(forecast.current) : null;
			if (raw != null && Number.isFinite(raw)) value = raw;
		} else {
			const window = ordered.slice(0, rule.horizon_hours);
			const samples: { val: number; time: string }[] = [];
			for (const h of window) {
				const raw = metric.fromHour?.(h);
				if (raw != null && Number.isFinite(raw)) samples.push({ val: raw, time: h.time });
			}
			if (samples.length > 0) {
				if (metric.aggregation === 'sum') {
					value = samples.reduce((sum, s) => sum + s.val, 0);
					// La somma non ha un'ora responsabile: il bucket di deduplica
					// è il giorno del primo slot della finestra.
					at = samples[0]!.time;
				} else {
					const pick = metric.aggregation === 'min'
						? samples.reduce((best, s) => (s.val < best.val ? s : best))
						: samples.reduce((best, s) => (s.val > best.val ? s : best));
					value = pick.val;
					at = pick.time;
				}
			}
		}

		// Nessun dato non è «soglia non superata»: è «non lo sappiamo», e una
		// regola che scatta su un campo assente sarebbe rumore puro.
		if (value == null) continue;
		if (!breaches(value, rule)) continue;

		const bucket = at ? dayOf(at) : new Date().toISOString().slice(0, 10);

		hits.push({
			rule,
			metric,
			value: Number(value.toFixed(metric.decimals)),
			// Per una somma l'ora non è responsabile di niente: dirla sarebbe
			// una precisione inventata.
			at: metric.aggregation === 'sum' ? null : at,
			message: buildMessage(metric, rule, value, at),
			signature: `rule:${rule.id}:${bucket}`,
		});
	}

	return hits;
}
