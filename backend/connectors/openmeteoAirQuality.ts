import axios from 'axios';

/**
 * Qualità dell'aria e pollini da Open-Meteo Air Quality.
 *
 * Due buchi che chiude insieme.
 *
 * **AQI monofonte.** Fino alla Fase 6D l'indice e gli inquinanti arrivavano
 * solo da WeatherAPI: nessuna aggregazione, nessun fallback se quella fonte
 * non risponde, e nessuna previsione — solo l'istante. Questa API è gratuita,
 * senza chiave, e porta l'**European AQI** accanto a quello statunitense EPA,
 * più le stesse specie di inquinanti.
 *
 * **Pollini.** Il modello CAMS europeo fornisce sei specie allergeniche con
 * quattro giorni di previsione. Per l'Italia è dato stagionale di valore alto —
 * olivo e graminacee in primavera, ambrosia a fine estate — e nessuna app
 * generalista lo fa bene in italiano.
 *
 * Copertura: i pollini sono modellati **solo in Europa**. Fuori i campi
 * tornano nulli, e il connettore restituisce la parte aria senza inventare la
 * parte polline.
 */

const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/** Specie polliniche del modello CAMS, con il nome del campo nell'API. */
export const POLLEN_SPECIES = [
	{ id: 'alder', field: 'alder_pollen', label: 'Ontano' },
	{ id: 'birch', field: 'birch_pollen', label: 'Betulla' },
	{ id: 'grass', field: 'grass_pollen', label: 'Graminacee' },
	{ id: 'mugwort', field: 'mugwort_pollen', label: 'Artemisia' },
	{ id: 'olive', field: 'olive_pollen', label: 'Olivo' },
	{ id: 'ragweed', field: 'ragweed_pollen', label: 'Ambrosia' },
] as const;

export type PollenSpeciesId = (typeof POLLEN_SPECIES)[number]['id'];

/**
 * Soglie di concentrazione in granuli/m³, **per specie**.
 *
 * Una soglia unica sarebbe fuorviante: 30 granuli/m³ di graminacee sono una
 * giornata pesante per chi è allergico, gli stessi 30 di olivo sono poca cosa.
 * I valori seguono le scale di riferimento europee usate nei bollettini
 * aerobiologici, dove ogni specie ha la propria banda.
 */
export const POLLEN_THRESHOLDS: Record<PollenSpeciesId, { moderate: number; high: number; veryHigh: number }> = {
	alder: { moderate: 11, high: 51, veryHigh: 101 },
	birch: { moderate: 11, high: 51, veryHigh: 101 },
	grass: { moderate: 6, high: 21, veryHigh: 51 },
	mugwort: { moderate: 6, high: 16, veryHigh: 51 },
	olive: { moderate: 16, high: 51, veryHigh: 201 },
	ragweed: { moderate: 6, high: 21, veryHigh: 51 },
};

export type PollenLevel = 'none' | 'low' | 'moderate' | 'high' | 'very_high';

/** Livello di una concentrazione, secondo la scala della sua specie. */
export function pollenLevel(species: PollenSpeciesId, value: number | null): PollenLevel {
	if (value == null || !Number.isFinite(value) || value < 1) return 'none';
	const t = POLLEN_THRESHOLDS[species];
	if (value >= t.veryHigh) return 'very_high';
	if (value >= t.high) return 'high';
	if (value >= t.moderate) return 'moderate';
	return 'low';
}

export interface PollenReading {
	species: PollenSpeciesId;
	label: string;
	/** Granuli/m³ nell'ora corrente. */
	value: number | null;
	/** Massimo previsto nella giornata. */
	daily_max: number | null;
	level: PollenLevel;
	/** Livello del massimo giornaliero: serve per il titolo del pannello. */
	daily_level: PollenLevel;
}

export interface AirQualityResult {
	/** Indice europeo 0-100+, scala diversa da quella EPA 1-6 di WeatherAPI. */
	european_aqi: number | null;
	pm2_5: number | null;
	pm10: number | null;
	no2: number | null;
	o3: number | null;
	so2: number | null;
	co: number | null;
	/** Presente solo dove il modello CAMS copre (Europa). */
	pollen: PollenReading[] | null;
}

/** Valore all'indice dato, se finito. */
function at(series: unknown, index: number): number | null {
	if (!Array.isArray(series)) return null;
	const value = series[index];
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Massimo finito di una serie, o null se non ce n'è nessuno. */
function maxOf(series: unknown, from: number, to: number): number | null {
	if (!Array.isArray(series)) return null;
	const values = series
		.slice(from, to)
		.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
	return values.length > 0 ? Math.max(...values) : null;
}

/**
 * Qualità dell'aria e pollini per una località.
 *
 * Restituisce null e non solleva: come l'ensemble è un arricchimento, e una
 * previsione deve poter uscire anche senza.
 */
export async function fetchAirQuality(lat: number, lon: number): Promise<AirQualityResult | null> {
	const pollenFields = POLLEN_SPECIES.map((s) => s.field).join(',');

	try {
		const response = await axios.get(AIR_QUALITY_URL, {
			params: {
				latitude: lat,
				longitude: lon,
				hourly: `pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi,${pollenFields}`,
				timezone: 'auto',
				forecast_days: 2,
			},
		});

		const hourly = response.data?.hourly;
		if (!hourly?.time || !Array.isArray(hourly.time)) return null;

		// L'indice dell'ora corrente nella serie locale restituita dall'API.
		const offsetSeconds = response.data?.utc_offset_seconds ?? 0;
		const localNow = new Date(Date.now() + offsetSeconds * 1000).toISOString().slice(0, 13);
		let index = hourly.time.findIndex((t: string) => t.slice(0, 13) >= localNow);
		if (index === -1) index = 0;

		// Fine della giornata corrente nella serie, per il massimo giornaliero.
		const today = hourly.time[index]?.slice(0, 10);
		let endOfDay = hourly.time.findIndex((t: string) => t.slice(0, 10) > today);
		if (endOfDay === -1) endOfDay = hourly.time.length;

		const pollen: PollenReading[] = [];
		for (const species of POLLEN_SPECIES) {
			const value = at(hourly[species.field], index);
			const dailyMax = maxOf(hourly[species.field], index, endOfDay);
			// Fuori dall'Europa il modello non produce nulla: niente valore né
			// massimo significa che la specie non è coperta, non che è a zero.
			if (value == null && dailyMax == null) continue;
			pollen.push({
				species: species.id,
				label: species.label,
				value,
				daily_max: dailyMax,
				level: pollenLevel(species.id, value),
				daily_level: pollenLevel(species.id, dailyMax),
			});
		}

		return {
			european_aqi: at(hourly.european_aqi, index),
			pm2_5: at(hourly.pm2_5, index),
			pm10: at(hourly.pm10, index),
			no2: at(hourly.nitrogen_dioxide, index),
			o3: at(hourly.ozone, index),
			so2: at(hourly.sulphur_dioxide, index),
			co: at(hourly.carbon_monoxide, index),
			pollen: pollen.length > 0 ? pollen : null,
		};
	} catch (error: any) {
		console.warn(`[AirQuality] Fetch fallito: ${error.message}`);
		return null;
	}
}
