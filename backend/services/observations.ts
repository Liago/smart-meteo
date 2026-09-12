import axios from 'axios';

/**
 * Verità osservata: cos'è **realmente** accaduto in un'ora e in un punto.
 *
 * Serve a misurare l'errore delle fonti. Fino alla Fase 6C il progetto non
 * aveva nulla del genere: `source_accuracy` conteneva la deviazione di ogni
 * fonte dalla *media* delle altre, quindi premiava la conformità al gruppo e
 * penalizzava la fonte che aveva ragione da sola.
 *
 * Due provider, provati in quest'ordine:
 *
 *  1. **Open-Meteo Archive** (ERA5), gratuito e senza chiave, copertura
 *     globale. È una rianalisi, non una misura di stazione, ma è il riferimento
 *     standard per la verifica dei modelli. Ha un ritardo di circa cinque
 *     giorni: è il motivo per cui la verifica guarda indietro di una settimana
 *     e non di un giorno.
 *  2. **Meteostat**, osservazioni di stazione via RapidAPI. Più vicine alla
 *     misura reale dove esiste una stazione vicina, ma con copertura
 *     disomogenea e una chiave da consumare. Usato come fonte alternativa
 *     quando l'archivio non ha dati per quel punto.
 */

/** Temperature osservate, indicizzate per ora locale troncata ("2026-09-05T14"). */
export type ObservedTemperatures = Map<string, number>;

export interface ObservationWindow {
	lat: number;
	lon: number;
	/** Data del giorno da verificare, "YYYY-MM-DD". */
	date: string;
}

/**
 * Ritardo dell'archivio ERA5, in giorni.
 *
 * Sotto questa soglia la richiesta torna vuota: non è un errore, è il tempo
 * che serve al dato per essere prodotto.
 */
export const ARCHIVE_LAG_DAYS = 6;

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const METEOSTAT_URL = 'https://meteostat.p.rapidapi.com/point/hourly';

/** Chiave di uno slot osservato: ora locale troncata all'ora. */
export function hourKey(isoLocalTime: string): string {
	return isoLocalTime.replace(' ', 'T').slice(0, 13);
}

/**
 * Giorno da verificare: abbastanza indietro perché l'archivio abbia i dati.
 *
 * @param now istante di riferimento (iniettabile nei test)
 */
export function verificationDate(now: Date = new Date()): string {
	const target = new Date(now.getTime() - ARCHIVE_LAG_DAYS * 24 * 60 * 60 * 1000);
	return target.toISOString().slice(0, 10);
}

/** Temperature osservate da Open-Meteo Archive (ERA5). */
async function fromArchive(window: ObservationWindow): Promise<ObservedTemperatures> {
	const response = await axios.get(ARCHIVE_URL, {
		params: {
			latitude: window.lat,
			longitude: window.lon,
			start_date: window.date,
			end_date: window.date,
			hourly: 'temperature_2m',
			timezone: 'auto',
		},
	});

	const hourly = response.data?.hourly;
	const observed: ObservedTemperatures = new Map();
	if (!hourly?.time || !hourly?.temperature_2m) return observed;

	hourly.time.forEach((time: string, index: number) => {
		const temp = hourly.temperature_2m[index];
		if (typeof temp === 'number' && Number.isFinite(temp)) {
			observed.set(hourKey(time), temp);
		}
	});
	return observed;
}

/** Temperature osservate da Meteostat (stazioni). */
async function fromMeteostat(window: ObservationWindow): Promise<ObservedTemperatures> {
	const apiKey = process.env.METEOSTAT_KEY;
	const observed: ObservedTemperatures = new Map();
	if (!apiKey) return observed;

	const response = await axios.get(METEOSTAT_URL, {
		params: {
			lat: window.lat,
			lon: window.lon,
			start: window.date,
			end: window.date,
			tz: 'UTC',
		},
		headers: {
			'x-rapidapi-host': 'meteostat.p.rapidapi.com',
			'x-rapidapi-key': apiKey,
		},
	});

	const rows = response.data?.data;
	if (!Array.isArray(rows)) return observed;

	for (const row of rows) {
		if (typeof row?.temp === 'number' && Number.isFinite(row.temp) && row.time) {
			observed.set(hourKey(row.time), row.temp);
		}
	}
	return observed;
}

export interface ObservationResult {
	temperatures: ObservedTemperatures;
	/** Quale provider ha risposto: serve nei log per capire cosa sta misurando. */
	provider: 'archive' | 'meteostat' | 'none';
}

/**
 * Temperature osservate per un giorno e una località.
 *
 * L'archivio viene provato per primo — è gratuito e copre tutto — e Meteostat
 * subentra solo se torna a mani vuote. Un fallimento di rete non solleva: la
 * verifica dell'accuratezza è un lavoro di sfondo e non deve interrompere
 * niente.
 */
export async function fetchObservedTemperatures(
	window: ObservationWindow
): Promise<ObservationResult> {
	try {
		const fromEra5 = await fromArchive(window);
		if (fromEra5.size > 0) return { temperatures: fromEra5, provider: 'archive' };
		console.warn(
			`[Accuracy] Archivio senza dati per ${window.date} a ${window.lat},${window.lon} — provo Meteostat`
		);
	} catch (err: any) {
		console.warn(`[Accuracy] Archivio non raggiungibile: ${err.message} — provo Meteostat`);
	}

	try {
		const fromStations = await fromMeteostat(window);
		if (fromStations.size > 0) return { temperatures: fromStations, provider: 'meteostat' };
	} catch (err: any) {
		console.warn(`[Accuracy] Meteostat non raggiungibile: ${err.message}`);
	}

	return { temperatures: new Map(), provider: 'none' };
}
