import type { AstronomyData, DailyForecast, ForecastCurrent, HourlyForecast } from './types';
import {
	MS_TO_KMH,
	PRECIP_THRESHOLDS,
	UV_THRESHOLDS,
	WIND_THRESHOLDS,
	formatPrecipMm,
	getPrecipIntensity,
	getUvScale,
	getWMOWeatherInfo,
	getWindScale,
} from './weather-utils';
import { getAqiScale } from './air-quality';

/**
 * Racconto discorsivo della giornata: fasce orarie, consigli e previsione di domani.
 *
 * È il porting di `Models/WeatherDescriptionEngine.swift` (sezione "Algoritmo 1"),
 * tenuto in un modulo a sé come già `air-quality.ts` (che ne porta l'"Algoritmo 2"):
 * le tabelle grammaticali e i generatori di frasi sono un blocco coeso, e il
 * componente che li mostra deve limitarsi a renderizzare.
 *
 * Rispetto a iOS il racconto è più ricco su due fronti: le fasce sono tutte e tre
 * (non solo quelle ancora da venire) e domani viene descritto anche a partire dalle
 * sue ore, non solo dal riepilogo giornaliero.
 */

// --- Fasce orarie ---

export type DayPartId = 'mattina' | 'pomeriggio' | 'sera';

interface DayPartSpec {
	id: DayPartId;
	label: string;
	/** Ora di inizio inclusa. */
	from: number;
	/** Ora di fine esclusa. */
	to: number;
	/** Preposizione per le frasi dei consigli, es. "nel pomeriggio". */
	preposition: string;
}

/**
 * Le ore 00-06 restano fuori di proposito: la notte è già trascorsa quando si
 * legge la previsione, e il racconto richiesto è mattina / pomeriggio / sera.
 */
export const DAY_PARTS: DayPartSpec[] = [
	{ id: 'mattina', label: 'Mattina', from: 6, to: 12, preposition: 'in mattinata' },
	{ id: 'pomeriggio', label: 'Pomeriggio', from: 12, to: 18, preposition: 'nel pomeriggio' },
	{ id: 'sera', label: 'Sera', from: 18, to: 24, preposition: 'in serata' },
];

// --- Lettura dei timestamp ---
//
// `hourly[].time` è "YYYY-MM-DDTHH:00" nell'ora locale della località e senza
// suffisso di fuso: va letto per caratteri, mai con `new Date()`, che lo
// sposterebbe nel fuso del browser. Stessa scelta di `formatHourRange`.

const dateOf = (time: string) => time.slice(0, 10);
const hourOf = (time: string) => Number(time.slice(11, 13));

/**
 * Orario "HH:mm" da un timestamp di astronomia. Il formato varia con la sorgente
 * (`astronomy` viene inoltrata verbatim dal backend), quindi si prova prima lo
 * slicing — corretto quando il timestamp è già ora locale della località — e solo
 * dopo si ricade su `Date`, che interpreta nel fuso del browser.
 */
export function extractTime(raw: string | undefined | null): string | null {
	if (!raw) return null;

	const iso = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(raw);
	const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw);
	if (iso && !hasZone) return iso[1];

	const parsed = new Date(raw);
	if (!isNaN(parsed.getTime())) {
		return parsed.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
	}

	// Formato "06:00 AM" / "18:30" di alcune sorgenti.
	const clock = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(raw.trim());
	if (!clock) return null;
	let hours = Number(clock[1]);
	const modifier = clock[3]?.toUpperCase();
	if (modifier === 'PM' && hours < 12) hours += 12;
	if (modifier === 'AM' && hours === 12) hours = 0;
	return `${String(hours).padStart(2, '0')}:${clock[2]}`;
}

// --- Condizioni meteo ---

type ConditionGroup =
	| 'clear'
	| 'partly'
	| 'overcast'
	| 'fog'
	| 'drizzle'
	| 'rain'
	| 'snow'
	| 'storm'
	| 'unknown';

/** Parole normalizzate del backend quando nessuna sorgente espone un codice WMO. */
const NORMALIZED_TO_WMO: Record<string, number> = {
	clear: 0,
	cloudy: 3,
	rain: 61,
	snow: 71,
	storm: 95,
	fog: 45,
};

/**
 * `condition_code` è una stringa che può essere un codice WMO numerico ("61")
 * oppure una parola normalizzata ("rain"): entrambe le forme arrivano davvero,
 * a seconda di quali sorgenti hanno risposto.
 */
export function toWmoCode(code: string | null | undefined): number | null {
	if (!code) return null;
	const numeric = Number(code);
	if (Number.isFinite(numeric) && code.trim() !== '') return numeric;
	return NORMALIZED_TO_WMO[code.toLowerCase()] ?? null;
}

function conditionGroup(code: number | null): ConditionGroup {
	if (code == null) return 'unknown';
	if (code === 0) return 'clear';
	if (code === 1 || code === 2) return 'partly';
	if (code === 3) return 'overcast';
	if (code === 45 || code === 48) return 'fog';
	if (code >= 51 && code <= 57) return 'drizzle';
	if ((code >= 61 && code <= 67) || code === 80 || code === 81) return 'rain';
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
	if (code === 82 || (code >= 95 && code <= 99)) return 'storm';
	return 'unknown';
}

/**
 * Le due varianti grammaticali che servono: l'aggettivo plurale segue "Cieli"
 * nelle righe delle fasce, l'etichetta nominale apre la frase su domani.
 */
const CONDITION_WORDS: Record<ConditionGroup, { adjective: string; label: string }> = {
	clear: { adjective: 'sereni', label: 'sereno' },
	partly: { adjective: 'poco nuvolosi', label: 'parzialmente nuvoloso' },
	overcast: { adjective: 'coperti', label: 'coperto' },
	fog: { adjective: 'nebbiosi', label: 'nebbia' },
	drizzle: { adjective: 'con pioviggine', label: 'pioviggine' },
	rain: { adjective: 'con pioggia', label: 'pioggia' },
	snow: { adjective: 'con neve', label: 'neve' },
	storm: { adjective: 'temporaleschi', label: 'temporali' },
	unknown: { adjective: 'variabili', label: 'variabile' },
};

const PRECIP_GROUPS: ConditionGroup[] = ['drizzle', 'rain', 'snow', 'storm'];

// --- Aggregati per fascia ---

export interface DayPartAggregate {
	id: DayPartId;
	label: string;
	preposition: string;
	from: number;
	to: number;
	hours: HourlyForecast[];
	group: ConditionGroup;
	code: number | null;
	tempMin: number;
	tempMax: number;
	feelsMax: number | null;
	precipProbMax: number;
	precipMm: number;
	windMaxKmh: number | null;
	gustMaxKmh: number | null;
	uvMax: number | null;
	hasStorm: boolean;
}

const maxOf = (values: number[]) => (values.length > 0 ? Math.max(...values) : null);

/** Codice condizione dominante della fascia, per frequenza fra le ore. */
function dominantCode(hours: HourlyForecast[]): number | null {
	const histogram = new Map<number, number>();
	for (const h of hours) {
		const code = toWmoCode(h.condition_code);
		if (code == null) continue;
		histogram.set(code, (histogram.get(code) ?? 0) + 1);
	}
	let best: number | null = null;
	let bestCount = 0;
	for (const [code, count] of histogram) {
		if (count > bestCount) {
			best = code;
			bestCount = count;
		}
	}
	return best;
}

/**
 * Raggruppa le ore di una data nelle tre fasce. Le fasce senza nessuna ora
 * vengono omesse: succede sul giorno corrente, dove le ore già passate possono
 * mancare del tutto.
 */
export function aggregateDayParts(hourly: HourlyForecast[], date: string): DayPartAggregate[] {
	const ofDay = hourly.filter((h) => dateOf(h.time) === date);

	return DAY_PARTS.flatMap((spec) => {
		const hours = ofDay.filter((h) => {
			const hour = hourOf(h.time);
			return hour >= spec.from && hour < spec.to;
		});
		if (hours.length === 0) return [];

		const temps = hours.map((h) => h.temp);
		const code = dominantCode(hours);

		return [
			{
				id: spec.id,
				label: spec.label,
				preposition: spec.preposition,
				from: spec.from,
				to: spec.to,
				hours,
				group: conditionGroup(code),
				code,
				tempMin: Math.min(...temps),
				tempMax: Math.max(...temps),
				feelsMax: maxOf(hours.flatMap((h) => (h.feels_like != null ? [h.feels_like] : []))),
				precipProbMax: Math.max(0, ...hours.map((h) => h.precipitation_prob ?? 0)),
				precipMm: hours.reduce((sum, h) => sum + (h.precipitation_mm ?? 0), 0),
				windMaxKmh: maxOf(
					hours.flatMap((h) => (h.wind_speed != null ? [h.wind_speed * MS_TO_KMH] : []))
				),
				gustMaxKmh: maxOf(
					hours.flatMap((h) => (h.wind_gust != null ? [h.wind_gust * MS_TO_KMH] : []))
				),
				uvMax: maxOf(hours.flatMap((h) => (h.uv_index != null ? [h.uv_index] : []))),
				hasStorm: hours.some((h) => conditionGroup(toWmoCode(h.condition_code)) === 'storm'),
			},
		];
	});
}

// --- Frasi delle fasce ---

const round = (value: number) => Math.round(value);

function tempRange(part: DayPartAggregate): string {
	const min = round(part.tempMin);
	const max = round(part.tempMax);
	return min === max ? `${max}°` : `${min}-${max}°`;
}

/**
 * Frase di una fascia: condizione, temperature e solo le clausole che portano
 * davvero informazione (pioggia probabile, percepita scollata dalla reale,
 * vento forte). Le clausole assenti spariscono invece di diventare "n/d".
 */
function buildPartSentence(part: DayPartAggregate): string {
	const clauses: string[] = [`Cieli ${CONDITION_WORDS[part.group].adjective}`, tempRange(part)];

	if (part.precipProbMax >= 30) {
		const amount = part.precipMm >= PRECIP_THRESHOLDS.light ? ` (${formatPrecipMm(part.precipMm)})` : '';
		// Se la condizione già dice "con pioggia", ripeterlo suonerebbe ridondante.
		if (PRECIP_GROUPS.includes(part.group)) {
			clauses.push(`probabilità ${round(part.precipProbMax)}%${amount}`);
		} else {
			const kind = part.group === 'snow' ? 'neve' : 'pioggia';
			clauses.push(`${kind} al ${round(part.precipProbMax)}%${amount}`);
		}
	}

	if (part.feelsMax != null && part.feelsMax - part.tempMax >= 3) {
		clauses.push(`percepiti ${round(part.feelsMax)}°`);
	}

	const wind = Math.max(part.windMaxKmh ?? 0, part.gustMaxKmh ?? 0);
	if (wind >= WIND_THRESHOLDS.strong) {
		clauses.push(`vento ${getWindScale(wind).label.toLowerCase()} (${round(wind)} km/h)`);
	}

	return `${clauses.join(', ')}.`;
}

// --- Consigli ---

export interface NarrativeContext {
	current: ForecastCurrent;
	today: DailyForecast;
	parts: DayPartAggregate[];
}

export interface AdviceRule {
	id: string;
	icon: string;
	severity: 'warning' | 'info';
	/** Testo del consiglio, oppure `null` se la regola non scatta. */
	evaluate: (ctx: NarrativeContext) => string | null;
}

export interface NarrativeAdvice {
	id: string;
	icon: string;
	severity: 'warning' | 'info';
	text: string;
}

/** Fascia con il valore più alto per il criterio dato, ignorando le fasce senza dato. */
function peakPart(
	parts: DayPartAggregate[],
	valueOf: (p: DayPartAggregate) => number | null
): { part: DayPartAggregate; value: number } | null {
	let best: { part: DayPartAggregate; value: number } | null = null;
	for (const part of parts) {
		const value = valueOf(part);
		if (value == null) continue;
		if (!best || value > best.value) best = { part, value };
	}
	return best;
}

/** Ore della fascia entro 2° dal massimo: la finestra da evitare col caldo. */
function hottestWindow(part: DayPartAggregate): string {
	const hours = part.hours.filter((h) => h.temp >= part.tempMax - 2).map((h) => hourOf(h.time));
	if (hours.length === 0) return `tra le ${part.from} e le ${part.to}`;
	return `tra le ${Math.min(...hours)} e le ${Math.max(...hours) + 1}`;
}

/**
 * Regole dei consigli, valutate nell'ordine in cui compaiono. Aggiungerne uno
 * significa aggiungere una voce qui, come per `POLLUTANTS` in `air-quality.ts`.
 * Le soglie sono quelle già usate altrove nell'app, non nuove.
 */
export const ADVICE_RULES: AdviceRule[] = [
	{
		id: 'storm',
		icon: '⛈️',
		severity: 'warning',
		evaluate: ({ parts }) => {
			const part = parts.find((p) => p.hasStorm);
			if (!part) return null;
			return `Temporali ${part.preposition}: evita gli spazi aperti e metti al riparo gli oggetti mobili.`;
		},
	},
	{
		id: 'heat',
		icon: '🌡️',
		severity: 'warning',
		evaluate: ({ parts }) => {
			const peak = peakPart(parts, (p) => Math.max(p.tempMax, p.feelsMax ?? -Infinity));
			if (!peak || (peak.part.tempMax < 32 && (peak.part.feelsMax ?? 0) < 35)) return null;
			return `Caldo intenso ${peak.part.preposition}: bevi spesso ed evita l'attività fisica ${hottestWindow(peak.part)}.`;
		},
	},
	{
		id: 'frost',
		icon: '❄️',
		severity: 'warning',
		evaluate: ({ parts }) => {
			const coldest = parts.reduce<DayPartAggregate | null>(
				(min, p) => (!min || p.tempMin < min.tempMin ? p : min),
				null
			);
			if (!coldest || coldest.tempMin > 0) return null;
			return `Gelo ${coldest.preposition}: attenzione a strade ghiacciate e piante sensibili.`;
		},
	},
	{
		id: 'rain',
		icon: '☔',
		severity: 'warning',
		evaluate: ({ parts }) => {
			const peak = peakPart(parts, (p) => p.precipMm);
			if (!peak || peak.value < PRECIP_THRESHOLDS.moderate) return null;
			const intensity = getPrecipIntensity(peak.value).label.toLowerCase();
			return `Pioggia ${intensity} ${peak.part.preposition}: ${formatPrecipMm(peak.value)} previsti, esci con l'ombrello.`;
		},
	},
	{
		id: 'wind',
		icon: '💨',
		severity: 'warning',
		evaluate: ({ parts }) => {
			const peak = peakPart(parts, (p) => Math.max(p.windMaxKmh ?? 0, p.gustMaxKmh ?? 0));
			if (!peak || peak.value < WIND_THRESHOLDS.strong) return null;
			return `Vento forte ${peak.part.preposition}, fino a ${round(peak.value)} km/h: fissa gli oggetti esposti.`;
		},
	},
	{
		id: 'uv',
		icon: '🧴',
		severity: 'warning',
		evaluate: ({ parts }) => {
			const peak = peakPart(parts, (p) => p.uvMax);
			if (!peak || peak.value < UV_THRESHOLDS.high) return null;
			const label = getUvScale(peak.value).label.toLowerCase();
			return `Indice UV ${label} ${peak.part.preposition}: usa protezione solare e cerca l'ombra.`;
		},
	},
	{
		id: 'visibility',
		icon: '🌫️',
		severity: 'warning',
		evaluate: ({ current }) => {
			if (current.visibility == null || current.visibility >= 2) return null;
			return current.visibility < 0.5
				? 'Visibilità molto scarsa, possibile nebbia: rimanda gli spostamenti se puoi.'
				: 'Visibilità ridotta: tieni le luci accese e aumenta la distanza di sicurezza.';
		},
	},
	{
		id: 'air',
		icon: '😷',
		severity: 'warning',
		evaluate: ({ current }) => {
			if (current.aqi == null || Math.round(current.aqi) < 3) return null;
			const label = getAqiScale(current.aqi).label.toLowerCase();
			return `Qualità dell'aria ${label}: limita l'attività all'aperto se sei un soggetto sensibile.`;
		},
	},
	{
		id: 'mugginess',
		icon: '💧',
		severity: 'info',
		evaluate: ({ current }) => {
			const { feels_like: feels, temperature: temp, humidity } = current;
			if (feels == null || temp == null || humidity == null) return null;
			const diff = feels - temp;
			if (diff < 3 || humidity < 60) return null;
			return `Umidità al ${round(humidity)}%: la percepita supera la reale di ${round(diff)}°.`;
		},
	},
];

/** Oltre tre il blocco smette di segnalare l'eccezione e diventa rumore. */
const MAX_ADVICE = 3;

export function buildAdvice(ctx: NarrativeContext): NarrativeAdvice[] {
	const matched = ADVICE_RULES.flatMap((rule) => {
		const text = rule.evaluate(ctx);
		return text ? [{ id: rule.id, icon: rule.icon, severity: rule.severity, text }] : [];
	});

	const warnings = matched.filter((a) => a.severity === 'warning');
	const infos = matched.filter((a) => a.severity === 'info');
	return [...warnings, ...infos].slice(0, MAX_ADVICE);
}

// --- Domani ---

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Paragrafo su domani. A differenza di iOS usa anche le ore di domani, che il
 * backend restituisce (l'orario copre più giorni), così si può dire in quale
 * fascia è attesa la pioggia e non solo che è attesa.
 */
export function buildTomorrow(
	today: DailyForecast,
	tomorrow: DailyForecast | undefined,
	hourly: HourlyForecast[]
): string | null {
	if (!tomorrow) return null;

	const parts = aggregateDayParts(hourly, tomorrow.date);
	const group = conditionGroup(toWmoCode(tomorrow.condition_code));
	const clauses: string[] = [capitalize(CONDITION_WORDS[group].label)];

	const min = tomorrow.temp_min;
	const max = tomorrow.temp_max;
	if (min != null && max != null) clauses.push(`${round(min)}-${round(max)}°`);
	else if (max != null) clauses.push(`massima ${round(max)}°`);

	if (max != null && today.temp_max != null) {
		const diff = max - today.temp_max;
		if (diff >= 3) clauses.push('massime in rialzo');
		else if (diff <= -3) clauses.push('massime in calo');
		else clauses.push('temperature stabili');
	}

	const sentences = [`${clauses.join(', ')}.`];

	// La fascia più piovosa se l'orario di domani è disponibile, altrimenti il
	// solo dato giornaliero.
	const peak = peakPart(parts, (p) => p.precipProbMax);
	const kind = group === 'snow' ? 'Neve' : 'Pioggia';
	if (peak && peak.value >= 50) {
		sentences.push(`${kind} probabile (${round(peak.value)}%) ${peak.part.preposition}.`);
	} else if (!peak && tomorrow.precipitation_prob != null && tomorrow.precipitation_prob >= 50) {
		sentences.push(`${kind} probabile (${round(tomorrow.precipitation_prob)}%).`);
	}

	return sentences.join(' ');
}

// --- Racconto completo ---

export interface NarrativePart {
	id: DayPartId;
	label: string;
	icon: string;
	sentence: string;
	/** Fascia già trascorsa: il componente la mostra attenuata. */
	isPast: boolean;
}

export interface DayNarrative {
	parts: NarrativePart[];
	advice: NarrativeAdvice[];
	tomorrow: string | null;
}

/**
 * Ora corrente nella località, se deducibile. La risposta non espone l'offset
 * del fuso, quindi l'ora del browser vale solo quando la sua data coincide con
 * quella che il backend considera "oggi". Serve unicamente ad attenuare le fasce
 * passate, quindi non saperla è un difetto puramente estetico.
 */
function localHour(now: Date, todayDate: string): number | null {
	const browserDate = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, '0'),
		String(now.getDate()).padStart(2, '0'),
	].join('-');
	return browserDate === todayDate ? now.getHours() : null;
}

export function buildDayNarrative(input: {
	current: ForecastCurrent;
	hourly?: HourlyForecast[];
	daily?: DailyForecast[];
	astronomy?: AstronomyData;
	now?: Date;
}): DayNarrative | null {
	const { current, hourly, daily, astronomy } = input;
	if (!hourly || hourly.length === 0 || !daily || daily.length === 0) return null;

	const today = daily[0];
	const parts = aggregateDayParts(hourly, today.date);
	if (parts.length === 0) return null;

	const sunset = extractTime(astronomy?.sunset);
	const sunsetHour = sunset ? Number(sunset.slice(0, 2)) : null;
	const currentHour = localHour(input.now ?? new Date(), today.date);

	const narrativeParts: NarrativePart[] = parts.map((part) => {
		const showsSunset =
			sunset != null && sunsetHour != null && sunsetHour >= part.from && sunsetHour < part.to;
		return {
			id: part.id,
			label: part.label,
			icon: getWMOWeatherInfo(part.code ?? 'unknown').icon,
			sentence: showsSunset
				? `${buildPartSentence(part)} Tramonto alle ${sunset}.`
				: buildPartSentence(part),
			isPast: currentHour != null && currentHour >= part.to,
		};
	});

	return {
		parts: narrativeParts,
		advice: buildAdvice({ current, today, parts }),
		tomorrow: buildTomorrow(today, daily[1], hourly),
	};
}
