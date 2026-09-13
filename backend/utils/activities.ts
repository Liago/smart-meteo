import { HourlyForecast } from '../types';

/**
 * «Oggi è una buona giornata per…»
 *
 * AccuWeather offre decine di indici già pronti, ma sul piano gratuito ogni
 * indice è **una chiamata a sé** (`/indices/v1/daily/1day/{key}/{indexId}`) e il
 * budget è di 50 chiamate al giorno, di cui ne consumiamo già 3 per ogni cache
 * miss del forecast: ~16 previsioni al giorno in tutto. Tre indici le
 * porterebbero a otto. Non è un limite aggirabile con la cache, è un budget che
 * non c'è.
 *
 * Questi indici si calcolano quindi **dai dati che aggreghiamo già**: costo zero,
 * nessuna dipendenza nuova, e — cosa che conta di più — si può dire all'utente
 * *perché* il punteggio è quello, cosa che un indice a scatola chiusa non
 * permette.
 *
 * Tutte funzioni pure, testabili senza rete né database.
 */

/** Ore locali considerate "di giorno". */
export const DAY_FROM_HOUR = 8;
export const DAY_TO_HOUR = 20;

/** Quante ore in avanti guardare per trovare la prossima finestra diurna. */
export const LOOKAHEAD_HOURS = 24;

/** Da m/s a km/h: le soglie del vento sono quelle che le persone usano. */
const MS_TO_KMH = 3.6;

export type ActivityId = 'running' | 'cycling' | 'laundry';

/** Un fattore che concorre al punteggio, con il suo nome leggibile. */
export interface ActivityFactor {
	/** Etichetta italiana del fattore, usata per dire cosa limita. */
	label: string;
	/** 0-100: più alto, più favorevole per questa attività. */
	score: number;
}

export interface ActivityScore {
	id: ActivityId;
	label: string;
	/** 0-100. */
	score: number;
	/**
	 * Il fattore che tiene basso il punteggio, quando ce n'è uno.
	 *
	 * È l'informazione che rende il numero utile: «65» non dice niente,
	 * «65, limita il vento» dice se rimandare o cambiare percorso.
	 */
	limiting: string | null;
}

export interface ActivitiesOutlook {
	/** Giorno locale della finestra valutata. */
	date: string;
	/** Prima e ultima ora considerate, per dichiarare l'orizzonte. */
	from: string;
	to: string;
	activities: ActivityScore[];
}

/**
 * Punteggio di comfort termico: 100 dentro la fascia ideale, in calo fuori.
 *
 * @param tolerance gradi oltre la fascia entro cui il punteggio arriva a zero
 */
export function comfortScore(
	temp: number | null,
	idealMin: number,
	idealMax: number,
	tolerance: number
): number | null {
	if (temp == null || !Number.isFinite(temp)) return null;
	if (temp >= idealMin && temp <= idealMax) return 100;

	const distance = temp < idealMin ? idealMin - temp : temp - idealMax;
	return Math.round(100 * Math.max(0, 1 - distance / tolerance));
}

/**
 * Quanto è asciutto: combina probabilità e quantità.
 *
 * Servono entrambe: il 90% di probabilità per 0.2 mm è una spruzzata che non
 * rovina niente, e 8 mm dati al 40% rovinano tutto se arrivano.
 */
export function drynessScore(prob: number | null, mm: number | null): number | null {
	if (prob == null && mm == null) return null;

	const fromProb = prob != null && Number.isFinite(prob) ? 100 - Math.min(100, Math.max(0, prob)) : 100;
	// Due millimetri in una finestra bastano a bagnare: sopra, si va a zero.
	const fromMm = mm != null && Number.isFinite(mm) ? 100 * Math.max(0, 1 - Math.max(0, mm) / 2) : 100;

	return Math.round(Math.min(fromProb, fromMm));
}

/** Vento: 100 sotto la soglia comoda, 0 sopra quella proibitiva. */
export function windScore(kmh: number | null, comfortable: number, hard: number): number | null {
	if (kmh == null || !Number.isFinite(kmh)) return null;
	if (kmh <= comfortable) return 100;
	if (kmh >= hard) return 0;
	return Math.round(100 * (1 - (kmh - comfortable) / (hard - comfortable)));
}

/** Indice UV: 100 finché è tollerabile, in calo fino all'estremo. */
export function uvScore(uv: number | null, comfortable: number): number | null {
	if (uv == null || !Number.isFinite(uv)) return null;
	if (uv <= comfortable) return 100;
	return Math.round(100 * Math.max(0, 1 - (uv - comfortable) / comfortable));
}

/** Qualità dell'aria sull'indice europeo: 100 sotto 20, 0 oltre 100. */
export function airScore(europeanAqi: number | null | undefined): number | null {
	if (europeanAqi == null || !Number.isFinite(europeanAqi)) return null;
	if (europeanAqi <= 20) return 100;
	if (europeanAqi >= 100) return 0;
	return Math.round(100 * (1 - (europeanAqi - 20) / 80));
}

/**
 * Il vento che **aiuta**: asciuga il bucato.
 *
 * È l'unico fattore invertito del registro, e per questo vive in una funzione
 * a sé invece che in un parametro di `windScore`: un segno di meno nascosto
 * dentro una soglia sarebbe il genere di cosa che si legge male a distanza di
 * mesi.
 *
 * Il minimo è alto di proposito: il vento è un **bonus**, non un requisito, e
 * in una giornata asciutta e tiepida il bucato asciuga anche con l'aria ferma.
 * Con un minimo basso, «vento» sarebbe risultato il fattore limitante di
 * qualunque giornata serena e calma — cioè un avviso su un problema che non
 * c'è.
 */
export const DRYING_WIND_FLOOR = 80;
export const DRYING_WIND_FULL_KMH = 15;

export function dryingWindScore(kmh: number | null): number | null {
	if (kmh == null || !Number.isFinite(kmh)) return null;
	const bonus = (100 - DRYING_WIND_FLOOR) * Math.min(1, Math.max(0, kmh) / DRYING_WIND_FULL_KMH);
	return Math.round(DRYING_WIND_FLOOR + bonus);
}

/**
 * Temperatura per l'asciugatura.
 *
 * Senza, il registro direbbe «stendi pure» a 3 °C con aria ferma e asciutta:
 * niente pioggia, umidità bassa, e nessun fattore a segnalare che il bucato
 * resterà lì fino a domani.
 */
export const DRYING_TEMP_GOOD_C = 15;
export const DRYING_TEMP_HARD_C = 3;

export function dryingTempScore(temp: number | null): number | null {
	if (temp == null || !Number.isFinite(temp)) return null;
	if (temp >= DRYING_TEMP_GOOD_C) return 100;
	if (temp <= DRYING_TEMP_HARD_C) return 0;
	return Math.round(
		100 * ((temp - DRYING_TEMP_HARD_C) / (DRYING_TEMP_GOOD_C - DRYING_TEMP_HARD_C))
	);
}

/**
 * Umidità per l'asciugatura: piena fino alla soglia, poi in calo.
 *
 * Non è `100 - umidità`: con quella formula una giornata al 50% — che è aria
 * perfettamente normale, in cui il bucato asciuga benissimo — prenderebbe 50
 * punti su 100, e qualunque giornata ordinaria sembrerebbe mediocre. Il bucato
 * asciuga bene fino a circa il 65%, rallenta sopra, e oltre il 95% non asciuga
 * più.
 */
export const DRYING_HUMIDITY_COMFORT = 65;
export const DRYING_HUMIDITY_HARD = 95;

export function dryAirScore(humidity: number | null): number | null {
	if (humidity == null || !Number.isFinite(humidity)) return null;
	const rh = Math.min(100, Math.max(0, humidity));
	if (rh <= DRYING_HUMIDITY_COMFORT) return 100;
	if (rh >= DRYING_HUMIDITY_HARD) return 0;
	return Math.round(
		100 * (1 - (rh - DRYING_HUMIDITY_COMFORT) / (DRYING_HUMIDITY_HARD - DRYING_HUMIDITY_COMFORT))
	);
}

/** Valori medi della finestra, per i fattori che non hanno un estremo. */
interface WindowStats {
	feelsLike: number | null;
	precipProb: number | null;
	precipMm: number | null;
	windKmh: number | null;
	uvMax: number | null;
	humidity: number | null;
}

function mean(values: number[]): number | null {
	if (values.length === 0) return null;
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function statsOf(hours: HourlyForecast[]): WindowStats {
	const pick = (get: (h: HourlyForecast) => number | null | undefined) =>
		hours.map(get).filter((v): v is number => v != null && Number.isFinite(v));

	const uv = pick((h) => h.uv_index);
	const mm = pick((h) => h.precipitation_mm);

	return {
		feelsLike: mean(pick((h) => h.feels_like ?? h.temp)),
		// La probabilità è un massimo, non una media: un'ora al 90% in mezzo a
		// undici serene è comunque un'uscita da rimandare.
		precipProb: pick((h) => h.precipitation_prob).length > 0
			? Math.max(...pick((h) => h.precipitation_prob))
			: null,
		// I millimetri invece si sommano: è la quantità totale a bagnare.
		precipMm: mm.length > 0 ? mm.reduce((sum, v) => sum + v, 0) : null,
		// Anche il vento è un massimo: conta la raffica della finestra.
		windKmh: pick((h) => h.wind_speed).length > 0
			? Math.max(...pick((h) => h.wind_speed)) * MS_TO_KMH
			: null,
		uvMax: uv.length > 0 ? Math.max(...uv) : null,
		humidity: mean(pick((h) => h.humidity)),
	};
}

/** Il registro: che cosa rende buona una giornata per ciascuna attività. */
const ACTIVITIES: {
	id: ActivityId;
	label: string;
	factors: (s: WindowStats, aqi: number | null | undefined) => ActivityFactor[];
}[] = [
	{
		id: 'running',
		label: 'Correre',
		factors: (s, aqi) => [
			{ label: 'temperatura', score: comfortScore(s.feelsLike, 8, 18, 12) },
			{ label: 'pioggia', score: drynessScore(s.precipProb, s.precipMm) },
			{ label: 'vento', score: windScore(s.windKmh, 20, 45) },
			{ label: 'raggi UV', score: uvScore(s.uvMax, 6) },
			{ label: "qualità dell'aria", score: airScore(aqi) },
		].filter((f): f is ActivityFactor => f.score != null),
	},
	{
		id: 'cycling',
		label: 'Andare in bici',
		factors: (s, aqi) => [
			{ label: 'temperatura', score: comfortScore(s.feelsLike, 12, 24, 12) },
			{ label: 'pioggia', score: drynessScore(s.precipProb, s.precipMm) },
			// In bici il vento pesa molto più che a piedi: le soglie sono metà.
			{ label: 'vento', score: windScore(s.windKmh, 12, 30) },
			{ label: "qualità dell'aria", score: airScore(aqi) },
		].filter((f): f is ActivityFactor => f.score != null),
	},
	{
		id: 'laundry',
		label: 'Stendere il bucato',
		factors: (s) => [
			{ label: 'pioggia', score: drynessScore(s.precipProb, s.precipMm) },
			{ label: 'umidità', score: dryAirScore(s.humidity) },
			{ label: 'temperatura', score: dryingTempScore(s.feelsLike) },
			{ label: 'vento', score: dryingWindScore(s.windKmh) },
		].filter((f): f is ActivityFactor => f.score != null),
	},
];

/** Ora locale dello slot, o null se la chiave non è nella forma attesa. */
function hourOf(slot: string): number | null {
	const match = /T(\d{2}):/.exec(slot);
	return match ? Number(match[1]) : null;
}

/**
 * Costruisce gli indici sulla prossima finestra diurna.
 *
 * Di sera la finestra scivola naturalmente a domani: «buona giornata per
 * correre» alle 23 significa domani, non fra un'ora.
 *
 * @param aqi indice europeo di qualità dell'aria, dal blocco corrente
 */
export function buildActivities(
	hourly: HourlyForecast[],
	aqi: number | null | undefined,
	fromTime?: string
): ActivitiesOutlook | null {
	if (!hourly || hourly.length === 0) return null;

	const ahead = (fromTime ? hourly.filter((h) => h.time >= fromTime) : hourly).slice(
		0,
		LOOKAHEAD_HOURS
	);

	const daylight = ahead.filter((h) => {
		const hour = hourOf(h.time);
		return hour != null && hour >= DAY_FROM_HOUR && hour < DAY_TO_HOUR;
	});
	if (daylight.length === 0) return null;

	// La finestra è quella del PRIMO giorno diurno trovato: mescolare oggi
	// pomeriggio con domani mattina darebbe un punteggio che non vale per
	// nessuno dei due.
	const day = daylight[0]!.time.slice(0, 10);
	const window = daylight.filter((h) => h.time.startsWith(day));

	const stats = statsOf(window);

	const activities: ActivityScore[] = [];
	for (const activity of ACTIVITIES) {
		const factors = activity.factors(stats, aqi);
		if (factors.length === 0) continue;

		// Il punteggio è il MINIMO dei fattori, non la media: una giornata
		// perfetta sotto il diluvio non è una mezza giornata buona. La media
		// nasconderebbe proprio il fattore che fa rinunciare.
		const worst = factors.reduce((min, f) => (f.score < min.score ? f : min));

		activities.push({
			id: activity.id,
			label: activity.label,
			score: worst.score,
			// Sopra una certa soglia niente «limita» davvero, e nominarlo
			// suggerirebbe un problema che non c'è.
			limiting: worst.score < 80 ? worst.label : null,
		});
	}

	if (activities.length === 0) return null;

	return {
		date: day,
		from: window[0]!.time,
		to: window[window.length - 1]!.time,
		activities: activities.sort((a, b) => b.score - a.score),
	};
}
