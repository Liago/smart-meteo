import { HourlyForecast } from '../types';

/**
 * Tramonti spettacolari e cielo notturno.
 *
 * Due indici che nascono dalla stessa intuizione: la copertura nuvolosa totale
 * non basta a dire com'è il cielo, perché **conta la quota**. Un tramonto
 * memorabile vuole nuvole alte — cirri, che prendono la luce da sotto quando il
 * sole è già sceso — e l'orizzonte libero perché quella luce ci arrivi. Un cielo
 * coperto e un cielo terso danno entrambi un tramonto ordinario, per ragioni
 * opposte, e un unico numero di copertura li confonde.
 *
 * Tutte funzioni pure, testabili senza rete né database.
 */

/** Copertura di nuvole alte che dà il tramonto migliore, %. */
export const IDEAL_HIGH_CLOUD = 50;

/**
 * Peso delle nuvole basse rispetto a quelle medie nel bloccare la luce.
 *
 * Le basse stanno fra il sole e l'osservatore all'orizzonte e spengono la scena
 * quasi del tutto; le medie la attenuano soltanto.
 */
export const LOW_CLOUD_BLOCKING = 0.7;
export const MID_CLOUD_BLOCKING = 0.3;

/**
 * Quanto la luna piena penalizza l'osservazione astronomica.
 *
 * Non azzera: con la luna piena si vedono benissimo pianeti, luna stessa e
 * stelle luminose — sono gli oggetti deboli a sparire. 0.6 lascia un cielo
 * terso con luna piena intorno al 40, cioè «discreto», che è la verità.
 */
export const MOON_PENALTY = 0.6;

/** Ore locali che compongono la notte, per la media della copertura. */
export const NIGHT_FROM_HOUR = 22;
export const NIGHT_TO_HOUR = 3;

export type SkyLevel = 'plain' | 'fair' | 'good' | 'excellent';

/** Soglie dei quattro livelli, sull'indice 0-100. */
export const SKY_THRESHOLDS = {
	fair: 25,
	good: 50,
	excellent: 75,
} as const;

export interface SkyEvent {
	/** Slot orario valutato, nella chiave locale degli hourly. */
	at: string;
	score: number;
	level: SkyLevel;
}

export interface StargazingOutlook {
	score: number;
	level: SkyLevel;
	/** Copertura media della notte, %. */
	cloud_cover: number;
	/** Percentuale di disco lunare illuminato, quando la conosciamo. */
	moon_illumination: number | null;
}

export interface SkyOutlook {
	sunset: SkyEvent | null;
	sunrise: SkyEvent | null;
	stargazing: StargazingOutlook | null;
}

/** Uno slot orario già aggregato, per quel che serve qui. */
export interface SkyHour {
	time: string;
	cloud_cover?: number | null | undefined;
	cloud_cover_low?: number | null | undefined;
	cloud_cover_mid?: number | null | undefined;
	cloud_cover_high?: number | null | undefined;
}

/** Classifica un indice 0-100 secondo `SKY_THRESHOLDS`. */
export function skyLevel(score: number): SkyLevel {
	if (score >= SKY_THRESHOLDS.excellent) return 'excellent';
	if (score >= SKY_THRESHOLDS.good) return 'good';
	if (score >= SKY_THRESHOLDS.fair) return 'fair';
	return 'plain';
}

/**
 * Quanto sarà spettacolare il tramonto (o l'alba) in quell'ora.
 *
 * Due fattori moltiplicati:
 *
 *   - **la tela**: le nuvole alte che possono accendersi. Massimo a metà
 *     copertura, zero sia con cielo terso — non c'è niente da illuminare — sia
 *     con la volta chiusa;
 *   - **la luce**: quanto l'orizzonte è libero. Le nuvole basse e medie stanno
 *     fra il sole e chi guarda, e senza quella luce la tela resta grigia.
 *
 * È un prodotto e non una somma di proposito: se manca uno dei due il tramonto
 * è ordinario, e una somma darebbe comunque metà punteggio.
 *
 * @returns 0-100, o null senza i dati di copertura per quota.
 */
export function sunsetScore(hour: SkyHour): number | null {
	const { cloud_cover_high: high, cloud_cover_low: low, cloud_cover_mid: mid } = hour;
	if (high == null || !Number.isFinite(high)) return null;

	const canvas = Math.max(0, 1 - Math.abs(high - IDEAL_HIGH_CLOUD) / IDEAL_HIGH_CLOUD);

	const lowPart = low != null && Number.isFinite(low) ? low : 0;
	const midPart = mid != null && Number.isFinite(mid) ? mid : 0;
	const blocking = Math.min(
		1,
		(lowPart * LOW_CLOUD_BLOCKING + midPart * MID_CLOUD_BLOCKING) / 100
	);

	return Math.round(100 * canvas * (1 - blocking));
}

/**
 * Quanto sarà buona la notte per guardare le stelle.
 *
 * La copertura pesa in pieno — sotto le nuvole non si vede niente — mentre la
 * luna penalizza in parte: spegne gli oggetti deboli, non i pianeti.
 *
 * @param moonIllumination percentuale di disco illuminato, 0-100
 */
export function stargazingScore(
	cloudCover: number,
	moonIllumination: number | null | undefined
): number {
	const clear = Math.max(0, 1 - Math.min(100, Math.max(0, cloudCover)) / 100);
	const moon =
		moonIllumination != null && Number.isFinite(moonIllumination)
			? Math.min(100, Math.max(0, moonIllumination))
			: 0;

	return Math.round(100 * clear * (1 - MOON_PENALTY * (moon / 100)));
}

/** Ora locale dello slot, o null se la chiave non è nella forma attesa. */
function hourOf(slot: string): number | null {
	const match = /T(\d{2}):/.exec(slot);
	return match ? Number(match[1]) : null;
}

/** Copertura totale dell'ora, ricavata dalle quote quando manca il totale. */
function totalCloud(hour: SkyHour): number | null {
	if (hour.cloud_cover != null && Number.isFinite(hour.cloud_cover)) return hour.cloud_cover;

	const layers = [hour.cloud_cover_low, hour.cloud_cover_mid, hour.cloud_cover_high].filter(
		(v): v is number => v != null && Number.isFinite(v)
	);
	// Il massimo fra le quote, non la somma: tre strati al 40% non fanno un
	// cielo coperto al 120%.
	return layers.length > 0 ? Math.max(...layers) : null;
}

/** Trova lo slot orario che contiene l'istante indicato. */
function slotAt(hours: SkyHour[], isoTime: string | undefined): SkyHour | null {
	if (!isoTime) return null;
	const key = isoTime.replace(' ', 'T').slice(0, 13);
	return hours.find((h) => h.time.slice(0, 13) === key) ?? null;
}

export interface SkyInput {
	hours: SkyHour[];
	/** Istanti di alba e tramonto, nella forma che manda l'aggregazione. */
	sunrise?: string | undefined;
	sunset?: string | undefined;
	moonIllumination?: number | null | undefined;
	/** Chiave del primo slot da considerare. */
	fromTime?: string | undefined;
}

/**
 * Costruisce il riquadro cielo.
 *
 * @returns null quando nessuno dei tre indici è calcolabile: senza copertura
 *          per quota non c'è niente da dire che il meteo normale non dica già.
 */
export function buildSkyOutlook(input: SkyInput): SkyOutlook | null {
	const { hours, sunrise, sunset, moonIllumination, fromTime } = input;
	if (!hours || hours.length === 0) return null;

	const window = fromTime ? hours.filter((h) => h.time >= fromTime) : hours;
	if (window.length === 0) return null;

	const eventAt = (isoTime: string | undefined): SkyEvent | null => {
		const slot = slotAt(window, isoTime);
		if (!slot) return null;
		const score = sunsetScore(slot);
		if (score == null) return null;
		return { at: slot.time, score, level: skyLevel(score) };
	};

	// La notte è a cavallo della mezzanotte: le ore vanno prese con un OR, non
	// con un intervallo, o non ne resterebbe nessuna.
	const nightHours = window.filter((h) => {
		const hour = hourOf(h.time);
		return hour != null && (hour >= NIGHT_FROM_HOUR || hour < NIGHT_TO_HOUR);
	});
	const nightClouds = nightHours
		.map(totalCloud)
		.filter((v): v is number => v != null);

	const stargazing: StargazingOutlook | null =
		nightClouds.length > 0
			? (() => {
					const cloud = Number(
						(nightClouds.reduce((sum, v) => sum + v, 0) / nightClouds.length).toFixed(0)
					);
					const score = stargazingScore(cloud, moonIllumination);
					return {
						score,
						level: skyLevel(score),
						cloud_cover: cloud,
						moon_illumination:
							moonIllumination != null && Number.isFinite(moonIllumination)
								? Math.round(moonIllumination)
								: null,
					};
				})()
			: null;

	const outlook: SkyOutlook = {
		sunset: eventAt(sunset),
		sunrise: eventAt(sunrise),
		stargazing,
	};

	if (!outlook.sunset && !outlook.sunrise && !outlook.stargazing) return null;
	return outlook;
}

/** Adatta gli slot orari aggregati alla forma che serve qui. */
export function skyHoursFrom(hourly: HourlyForecast[]): SkyHour[] {
	return hourly.map((h) => ({
		time: h.time,
		cloud_cover: h.cloud_cover,
		cloud_cover_low: h.cloud_cover_low,
		cloud_cover_mid: h.cloud_cover_mid,
		cloud_cover_high: h.cloud_cover_high,
	}));
}
