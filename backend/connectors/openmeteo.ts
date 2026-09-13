import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';
import { getMoonPhase } from '../utils/moon';

/**
 * Modelli meteorologici richiedibili a Open-Meteo come fonti indipendenti.
 *
 * Open-Meteo non è un provider con un proprio modello: è un frontend gratuito
 * sui modelli dei servizi meteorologici nazionali. L'endpoint di default
 * (`best_match`) ne restituisce una miscela scelta da loro, e finora lo
 * trattavamo come **una** fonte con peso 1.1.
 *
 * Chiedendo invece i modelli uno per uno si ottengono previsioni davvero
 * indipendenti — ECMWF, DWD, NOAA, Météo-France — cioè più diversità
 * statistica di quella che danno diversi provider commerciali, molti dei quali
 * sotto il marchio rielaborano gli stessi GFS ed ECMWF. A costo zero e senza
 * chiave API.
 *
 * I pesi riflettono la qualità attesa sull'Italia: ICON-D2 è il più fine
 * (2.2 km) ma copre solo 48 ore, GFS è il più grossolano sull'Europa.
 */
export interface OpenMeteoModel {
	/** Identificativo del modello nell'API Open-Meteo. */
	id: string;
	/** Id della fonte nello Smart Engine e nella tabella `sources`. */
	sourceId: string;
	name: string;
	description: string;
	weight: number;
}

export const OPENMETEO_MODELS: OpenMeteoModel[] = [
	{
		id: 'icon_d2',
		sourceId: 'open-meteo:icon_d2',
		name: 'ICON-D2 (DWD)',
		description: 'Modello DWD a 2.2 km sull\'Europa centrale, 48 ore',
		weight: 1.2,
	},
	{
		id: 'icon_eu',
		sourceId: 'open-meteo:icon_eu',
		name: 'ICON-EU (DWD)',
		description: 'Modello DWD a 7 km sull\'Europa',
		weight: 1.1,
	},
	{
		id: 'ecmwf_ifs025',
		sourceId: 'open-meteo:ecmwf',
		name: 'IFS (ECMWF)',
		description: 'Modello globale ECMWF a 25 km',
		weight: 1.1,
	},
	{
		id: 'meteofrance_seamless',
		sourceId: 'open-meteo:meteofrance',
		name: 'AROME/ARPEGE (Météo-France)',
		description: 'Modelli Météo-France, alta risoluzione sull\'Europa occidentale',
		weight: 1.0,
	},
	{
		id: 'gfs_seamless',
		sourceId: 'open-meteo:gfs',
		name: 'GFS (NOAA)',
		description: 'Modello globale NOAA, risoluzione più grossolana sull\'Europa',
		weight: 0.9,
	},
];

/**
 * Modelli attivi, configurabili con `OPENMETEO_MODELS` (lista di id separati da
 * virgola, oppure `off` per tornare al solo `best_match`).
 *
 * Ogni modello è una chiamata HTTP in più sul percorso di cache miss: il piano
 * gratuito di Open-Meteo consente 10.000 richieste al giorno, ma la lista va
 * poter essere ridotta senza un deploy.
 */
export function activeOpenMeteoModels(): OpenMeteoModel[] {
	const configured = process.env.OPENMETEO_MODELS?.trim();
	if (!configured) return OPENMETEO_MODELS;
	if (configured.toLowerCase() === 'off') return [];

	const wanted = configured.split(',').map((m) => m.trim()).filter(Boolean);
	return OPENMETEO_MODELS.filter((m) => wanted.includes(m.id) || wanted.includes(m.sourceId));
}

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const CURRENT_PARAMS =
	'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,cloud_cover,visibility,dew_point_2m';
// NB: `precipitation` include già l'equivalente in acqua della neve, quindi
// `snowfall` non va sommato a quello: nel livello `current` l'intensità resta
// `precipitation` e basta, o si conterebbe due volte la stessa neve.
//
// Sull'orario `snowfall` e `snow_depth` servono invece a dire *che cosa* cade e
// quanto ce n'è già a terra — centimetri di neve, non equivalente in acqua — e
// `freezing_level_height` è la quota dello zero termico da cui si ricava la
// quota neve. Nessuno dei tre entra nel calcolo dei millimetri.
//
// `soil_temperature_0cm` è la temperatura della superficie: è lì che si forma
// la brina, non a due metri da terra, dove le stazioni misurano e dove nelle
// notti serene fa qualche grado in più.
const HOURLY_PARAMS =
	'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,visibility,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,snowfall,snow_depth,freezing_level_height,soil_temperature_0cm';
const DAILY_PARAMS =
	'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,snowfall_sum,sunrise,sunset,uv_index_max';

/**
 * Costruisce l'oggetto unificato da una risposta Open-Meteo.
 *
 * Condiviso fra la fonte `best_match` e i singoli modelli: cambia solo l'id
 * della fonte, la forma della risposta è identica.
 */
function buildForecast(data: any, lat: number, lon: number, sourceId: string): UnifiedForecast | null {
	const current = data.current;
	const daily = data.daily;
	const hourly = data.hourly;

	if (!current) return null;

	// Map daily data
	const dailyForecasts = daily.time.slice(0, 7).map((time: string, index: number) => ({
		date: time,
		temp_max: daily.temperature_2m_max[index],
		temp_min: daily.temperature_2m_min[index],
		precipitation_prob: daily.precipitation_probability_max[index],
		condition_code: String(daily.weather_code[index]),
		condition_text: `Code ${daily.weather_code[index]}`,
		uv_index_max: daily.uv_index_max?.[index] ?? null,
		precipitation_mm: daily.precipitation_sum?.[index] ?? null,
		snowfall_cm: daily.snowfall_sum?.[index] ?? null,
	}));

	// Map hourly data (from current time onwards)
	const now = new Date();
	const currentHourISO = now.toISOString().slice(0, 13) + ':00';

	let startIndex = hourly.time.findIndex((t: string) => t >= currentHourISO);
	if (startIndex === -1) startIndex = 0;

	// Map ALL remaining hourly data
	const hourlyForecasts = hourly.time.slice(startIndex).map((time: string, index: number) => {
		const realIndex = startIndex + index;
		return {
			time: time,
			temp: hourly.temperature_2m[realIndex],
			precipitation_prob: hourly.precipitation_probability[realIndex],
			condition_code: String(hourly.weather_code[realIndex]),
			condition_text: `Code ${hourly.weather_code[realIndex]}`,
			feels_like: hourly.apparent_temperature?.[realIndex] ?? null,
			humidity: hourly.relative_humidity_2m?.[realIndex] ?? null,
			wind_speed: hourly.wind_speed_10m?.[realIndex] != null ? Number((hourly.wind_speed_10m[realIndex] / 3.6).toFixed(2)) : null, // km/h → m/s
			wind_direction: hourly.wind_direction_10m?.[realIndex] ?? null,
			wind_gust: hourly.wind_gusts_10m?.[realIndex] != null ? Number((hourly.wind_gusts_10m[realIndex] / 3.6).toFixed(2)) : null, // km/h → m/s
			uv_index: hourly.uv_index?.[realIndex] ?? null,
			precipitation_mm: hourly.precipitation?.[realIndex] ?? null,
			snowfall_cm: hourly.snowfall?.[realIndex] ?? null,
			// Open-Meteo dà il manto in METRI, a differenza della neve fresca
			// che è già in centimetri: senza questa conversione 0.4 m di neve
			// diventerebbero "0.4 cm".
			snow_depth_cm:
				hourly.snow_depth?.[realIndex] != null
					? Number((hourly.snow_depth[realIndex] * 100).toFixed(1))
					: null,
			freezing_level: hourly.freezing_level_height?.[realIndex] ?? null,
			soil_temperature: hourly.soil_temperature_0cm?.[realIndex] ?? null,
		};
	});

	// Map Astronomy (Sunrise/Sunset for today)
	const astronomy = {
		sunrise: daily.sunrise[0],
		sunset: daily.sunset[0],
		moon_phase: getMoonPhase(new Date())
	};

	return new UnifiedForecast({
		source: sourceId,
		lat: lat,
		lon: lon,
		time: current.time,
		temp: current.temperature_2m,
		feels_like: current.apparent_temperature,
		humidity: current.relative_humidity_2m,
		// Open-Meteo risponde in km/h (unità di default, non passiamo
		// wind_speed_unit): il contratto di UnifiedForecastData è m/s, come
		// già fa la mappatura hourly qui sopra.
		wind_speed: current.wind_speed_10m != null ? Number((current.wind_speed_10m / 3.6).toFixed(2)) : null,
		wind_direction: current.wind_direction_10m,
		wind_gust: current.wind_gusts_10m != null ? current.wind_gusts_10m / 3.6 : null,
		condition_text: `Code ${current.weather_code}`,
		condition_code: String(current.weather_code),
		precipitation_prob: daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : null,
		precipitation_intensity: current.precipitation,
		pressure: current.pressure_msl,
		uv_index: current.uv_index ?? null,
		cloud_cover: current.cloud_cover ?? null,
		visibility: current.visibility != null ? current.visibility / 1000 : null, // Open-Meteo returns meters, convert to km
		dew_point: current.dew_point_2m ?? null,
		// Con timezone:'auto' Open-Meteo restituisce l'offset locale: lo Smart Engine
		// lo usa per allineare gli slot orari delle fonti che rispondono in UTC.
		utc_offset_seconds: data.utc_offset_seconds ?? null,
		// Quota del punto di griglia, in metri: è quella che rende leggibile la
		// quota neve ("nevica a casa tua" invece di "zero termico a 1500 m").
		elevation: data.elevation ?? null,
		daily: dailyForecasts,
		hourly: hourlyForecasts,
		astronomy: astronomy
	});
}

/**
 * Fonte `open-meteo`: la miscela `best_match` scelta da Open-Meteo.
 *
 * Resta in uso quando i modelli singoli sono disattivati: usarla *insieme* ai
 * modelli conterebbe due volte gli stessi dati, perché `best_match` è una loro
 * combinazione.
 */
export async function fetchFromOpenMeteo(lat: number, lon: number): Promise<UnifiedForecast | null> {
	try {
		const response = await axios.get(BASE_URL, {
			params: {
				latitude: lat,
				longitude: lon,
				current: CURRENT_PARAMS,
				hourly: HOURLY_PARAMS,
				daily: DAILY_PARAMS,
				timezone: 'auto',
			},
		});
		return buildForecast(response.data, lat, lon, 'open-meteo');
	} catch (error: any) {
		console.error('Error fetching Open-Meteo:', error.message);
		return null;
	}
}

/**
 * Fonte corrispondente a un singolo modello meteorologico.
 *
 * @param model uno degli elementi di `OPENMETEO_MODELS`
 */
export async function fetchFromOpenMeteoModel(
	lat: number,
	lon: number,
	model: OpenMeteoModel
): Promise<UnifiedForecast | null> {
	try {
		const response = await axios.get(BASE_URL, {
			params: {
				latitude: lat,
				longitude: lon,
				current: CURRENT_PARAMS,
				hourly: HOURLY_PARAMS,
				daily: DAILY_PARAMS,
				timezone: 'auto',
				models: model.id,
			},
		});
		return buildForecast(response.data, lat, lon, model.sourceId);
	} catch (error: any) {
		console.error(`Error fetching Open-Meteo model ${model.id}:`, error.message);
		return null;
	}
}
