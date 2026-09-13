import axios from 'axios';

/**
 * Onde e temperatura dell'acqua, da Open-Meteo Marine.
 *
 * Endpoint separato da quello delle previsioni e gratuito come il resto della
 * famiglia. Non è una fonte dell'aggregazione — non dà condizioni correnti né
 * astronomia — e viaggia a parte, come l'ensemble e la qualità dell'aria.
 *
 * **Si auto-esclude nell'entroterra.** Il modello d'onda copre solo i punti di
 * griglia sul mare: su una località interna la chiamata fallisce o torna tutta
 * nulla, e in entrambi i casi qui si restituisce `null`. Non serve quindi un
 * dataset di coste né un test sulla distanza dal mare: la fonte stessa è il
 * criterio, ed è più accurata di qualunque soglia avremmo scelto noi.
 */

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

const HOURLY_PARAMS =
	'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period,sea_surface_temperature';

/** Una singola ora di dati marini. */
export interface MarineHour {
	/** Ora locale, nella stessa forma degli slot orari di Open-Meteo. */
	time: string;
	/** Altezza d'onda significativa, metri. */
	wave_height: number | null;
	/** Direzione di provenienza dell'onda, gradi. */
	wave_direction: number | null;
	/** Periodo dell'onda, secondi. */
	wave_period: number | null;
	/** Altezza del mare lungo (swell), metri. */
	swell_height: number | null;
	/** Temperatura della superficie del mare, °C. */
	sea_temperature: number | null;
}

export interface MarineResult {
	hours: MarineHour[];
	utcOffsetSeconds: number | null;
}

/** Estrae un valore numerico da una serie, tollerando la serie assente. */
function at(series: unknown, index: number): number | null {
	if (!Array.isArray(series)) return null;
	const value = series[index];
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Interroga il modello d'onda per una località.
 *
 * @returns `null` nell'entroterra, su errore di rete, o quando la risposta non
 *          contiene nemmeno un'ora con un'altezza d'onda: meglio nessun
 *          riquadro che un mare inventato a 0 metri in mezzo alla pianura.
 */
export async function fetchMarine(lat: number, lon: number): Promise<MarineResult | null> {
	try {
		const response = await axios.get(MARINE_URL, {
			params: {
				latitude: lat,
				longitude: lon,
				hourly: HOURLY_PARAMS,
				timezone: 'auto',
			},
		});

		const data = response.data;
		const times = data?.hourly?.time;
		if (!Array.isArray(times) || times.length === 0) return null;

		const hours: MarineHour[] = times.map((time: string, i: number) => ({
			time,
			wave_height: at(data.hourly.wave_height, i),
			wave_direction: at(data.hourly.wave_direction, i),
			wave_period: at(data.hourly.wave_period, i),
			swell_height: at(data.hourly.swell_wave_height, i),
			sea_temperature: at(data.hourly.sea_surface_temperature, i),
		}));

		// Il criterio di costa: senza nemmeno un'altezza d'onda il punto non è
		// coperto dal modello, qualunque cosa abbia risposto l'endpoint.
		if (!hours.some((h) => h.wave_height != null)) return null;

		return { hours, utcOffsetSeconds: data.utc_offset_seconds ?? null };
	} catch (error: any) {
		// Nell'entroterra l'API risponde con un errore: è un caso atteso, non
		// un guasto, quindi non si logga come tale.
		console.log(`[Marine] nessun dato d'onda per ${lat},${lon}: ${error.message}`);
		return null;
	}
}
