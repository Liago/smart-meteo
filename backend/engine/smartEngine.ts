import { fetchFromTomorrow } from '../connectors/tomorrow';
import { fetchFromOpenMeteo } from '../connectors/openmeteo';
import { fetchFromOpenWeather } from '../connectors/openweathermap';
import { fetchFromWeatherAPI } from '../connectors/weatherapi';
import { fetchFromAccuWeather } from '../connectors/accuweather';
import { fetchFromWWO } from '../connectors/worldweatheronline';
import { fetchFromWeatherstack } from '../connectors/weatherstack';
import { fetchFromMeteostat } from '../connectors/meteostat';
import { fetchFromWeatherKit, fetchFromWeatherKitWithAlerts } from '../connectors/weatherkit';
import { fetchFromWeatherAPIWithAlerts } from '../connectors/weatherapi';
import { fetchOWMAlerts } from '../connectors/openweathermap';
import { UnifiedForecast, normalizeConditionWithCloudCover } from '../utils/formatter';
import { aggregatePrecipitationMm } from '../utils/precipitation';
import { aggregateWindDirection, aggregateWindGust } from '../utils/wind';
import { WeatherConditionWeights, AirQualityDetail, WeatherAlert } from '../types';
import { sources } from '../routes/sources';
import { supabase } from '../services/supabase';
import { getAccuracyMap, logAccuracyDeviations } from '../services/accuracy';
import { processWeatherAlerts } from '../services/alertProcessor';
import { aggregateAlerts } from '../utils/alertGeo';

/**
 * Versione della forma della risposta salvata in `smart_forecasts.full_data`.
 *
 * Una riga di cache con una versione diversa viene ignorata e rigenerata:
 * senza questo, dopo un deploy che aggiunge campi i client continuerebbero a
 * ricevere la forma vecchia per tutta la durata della cache, a meno di
 * svuotare la tabella a mano.
 *
 * Va incrementata ogni volta che si aggiungono o rinominano campi della
 * risposta.
 *   1 → forma originale
 *   2 → aggiunge precipitation_mm su hourly e daily
 *   3 → aggiunge feels_like, wind_direction e wind_gust su hourly
 */
const FORECAST_SCHEMA_VERSION = 3;

const SOURCE_WEIGHTS: WeatherConditionWeights = {
	'tomorrow.io': 1.2,
	'open-meteo': 1.1,
	'openweathermap': 1.0,
	'weatherapi': 1.0,
	'accuweather': 1.1,
	'worldweatheronline': 1.0,
	'weatherstack': 0, // Disabilitato: il piano free usa HTTP non cifrato (no HTTPS)
	'meteostat': 0.8,
	'apple_weatherkit': 1.2
};

const SOURCE_FETCHERS: Record<string, (lat: number, lon: number) => Promise<UnifiedForecast | null>> = {
	'tomorrow.io': fetchFromTomorrow,
	'open-meteo': fetchFromOpenMeteo,
	'openweathermap': fetchFromOpenWeather,
	'weatherapi': fetchFromWeatherAPI,
	'accuweather': fetchFromAccuWeather,
	'worldweatheronline': fetchFromWWO,
	'weatherstack': fetchFromWeatherstack,
	'meteostat': fetchFromMeteostat,
	'apple_weatherkit': fetchFromWeatherKit
};

interface AggregationData {
	temp: { val: number; weight: number }[];
	feels_like: { val: number; weight: number }[];
	humidity: { val: number; weight: number }[];
	wind_speed: { val: number; weight: number }[];
	wind_direction: { val: number; weight: number }[];
	wind_gust: { val: number; weight: number }[];
	precipitation_prob: { val: number; weight: number }[];
	aqi: { val: number; weight: number }[];
	pressure: { val: number; weight: number }[];
	uv_index: { val: number; weight: number }[];
	visibility: { val: number; weight: number }[];
	cloud_cover: { val: number; weight: number }[];
	dew_point: { val: number; weight: number }[];
	conditions: { [key: string]: number };
}

/**
 * Calculate dew point from temperature (°C) and relative humidity (%).
 * Uses the Magnus formula approximation.
 */
function calculateDewPoint(temp: number, humidity: number): number {
	const a = 17.625;
	const b = 243.04;
	const alpha = Math.log(humidity / 100) + (a * temp) / (b + temp);
	return Number((b * alpha / (a - alpha)).toFixed(1));
}

/**
 * Convert wind direction in degrees to a compass label (N, NE, E, etc.)
 */
function degreesToCompass(deg: number): string {
	const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
	const index = Math.round(deg / 22.5) % 16;
	return directions[index] ?? 'N';
}

async function upsertLocation(lat: number, lon: number): Promise<string | null> {
	const { data, error } = await supabase.rpc('upsert_location', {
		p_name: null,
		p_latitude: lat,
		p_longitude: lon
	});

	if (error) {
		console.error('Error upserting location:', error);
		return null;
	}
	return data as string;
}

export async function getSmartForecast(lat: number, lon: number): Promise<any> {
	console.log(`Starting Smart Engine for ${lat}, ${lon}...`);

	// 1. Resolve Location ID
	const locationId = await upsertLocation(lat, lon);

	// 2. Check Cache (Smart Forecasts)
	if (locationId) {
		const { data: cached, error } = await supabase
			.from('smart_forecasts')
			.select('*')
			.eq('location_id', locationId)
			.gt('generated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // 30 mins cache
			.order('generated_at', { ascending: false })
			.limit(1)
			.single();

		if (cached && !error) {
			// If full_data is available, return the complete cached result
			if (cached.full_data && cached.full_data.schema_version === FORECAST_SCHEMA_VERSION) {
				console.log('Cache HIT: returning full smart forecast from DB (with fresh alerts check)');

				// Bypass cache per allerte: fetch allerte fresche da tutte le fonti
				try {
					const freshAlertSources = await Promise.allSettled([
						fetchFromWeatherKitWithAlerts(lat, lon).then(r => r?.alerts.map(a => ({ ...a, providerSource: a.providerSource || 'weatherkit' })) || []),
						fetchFromWeatherAPIWithAlerts(lat, lon).then(r => r?.alerts || []),
						fetchOWMAlerts(lat, lon),
					]);

					const freshAlertsRaw: WeatherAlert[] = [];
					for (const result of freshAlertSources) {
						if (result.status === 'fulfilled') freshAlertsRaw.push(...result.value);
					}

					// Filtro geografico + deduplica: i provider restituiscono anche allerte
					// nazionali che non riguardano questa posizione.
					const freshAlerts = aggregateAlerts(freshAlertsRaw, lat, lon);
					console.log(`[AlertPipeline] Cache bypass alerts check: raw=${freshAlertsRaw.length} rilevanti=${freshAlerts.length} from ${[...new Set(freshAlertsRaw.map(a => a.providerSource))].join(',') || 'none'}`);

					cached.full_data.alerts = freshAlerts;

					if (freshAlerts.length > 0) {
						processWeatherAlerts(freshAlerts, lat, lon).catch(err =>
							console.error('[AlertPipeline] Error processing fresh alerts on cache hit:', err.message)
						);
					}
				} catch (alertErr: any) {
					console.warn('[AlertPipeline] Failed to fetch fresh alerts on cache hit:', alertErr.message);
				}

				delete cached.full_data.schema_version;
				return cached.full_data;
			}
			// Cache inutilizzabile: manca full_data, oppure è stata scritta con una
			// forma di risposta precedente (es. prima di precipitation_mm). In
			// entrambi i casi si rigenera, così un cambio di schema non richiede di
			// svuotare la tabella a mano dopo il deploy.
			console.log(
				cached.full_data
					? `Cache HIT but schema_version=${cached.full_data.schema_version ?? 'assente'} (atteso ${FORECAST_SCHEMA_VERSION}) — re-fetching`
					: 'Cache HIT but no full_data — re-fetching for complete response'
			);
		}
	}

	// 3. Fetch from External & Load Accuracies
	const activeSources = sources.filter(s => s.active && (SOURCE_WEIGHTS[s.id] ?? 1) > 0);
	const accuracyMapPromise = getAccuracyMap();

	// Raccoglie le allerte da tutte le fonti durante il fetch
	let allAlerts: WeatherAlert[] = [];

	const fetchPromises = activeSources.map(async s => {
		const start = Date.now();
		try {
			let result: UnifiedForecast | null = null;

			// Per WeatherKit, usa la variante con allerte
			if (s.id === 'apple_weatherkit') {
				const wkResult = await fetchFromWeatherKitWithAlerts(lat, lon);
				if (wkResult) {
					result = wkResult.forecast;
					if (wkResult.alerts.length > 0) {
						const tagged = wkResult.alerts.map(a => ({ ...a, providerSource: a.providerSource || 'weatherkit' }));
						allAlerts.push(...tagged);
					}
				}
			} else if (s.id === 'weatherapi') {
				// WeatherAPI: usa la variante con allerte
				const waResult = await fetchFromWeatherAPIWithAlerts(lat, lon);
				if (waResult) {
					result = waResult.forecast;
					if (waResult.alerts.length > 0) {
						allAlerts.push(...waResult.alerts);
					}
				}
			} else {
				const fetcher = SOURCE_FETCHERS[s.id];
				if (!fetcher) return null;
				result = await fetcher(lat, lon);
			}

			s.lastResponseMs = Date.now() - start;
			s.lastError = null;

			// AUDIT: Save to raw_forecasts
			if (result && locationId) {
				const { error: rawError } = await supabase.from('raw_forecasts').insert({
					source_id: s.id,
					location_id: locationId,
					latitude: lat,
					longitude: lon,
					fetched_at: new Date().toISOString(),
					temp: result.temp,
					feels_like: result.feels_like,
					humidity: result.humidity,
					wind_speed: result.wind_speed,
					wind_direction: result.wind_direction,
					condition_text: result.condition_text,
					condition_code: result.condition_code,
					precipitation_prob: result.precipitation_prob,
					raw_data: result.raw_data || {},
					response_ms: s.lastResponseMs
				});
				if (rawError) console.error('Error saving raw forecast:', rawError);
			}

			return result;
		} catch (err: any) {
			s.lastResponseMs = Date.now() - start;
			s.lastError = err.message || 'Unknown error';
			return null;
		}
	});

	const results = await Promise.allSettled(fetchPromises);

	const validForecasts = results
		.filter((r): r is PromiseFulfilledResult<UnifiedForecast> => r.status === 'fulfilled' && r.value !== null)
		.map(r => r.value);

	if (validForecasts.length === 0) {
		throw new Error('All weather sources failed to return data.');
	}

	console.log(`Received ${validForecasts.length} valid forecasts from: ${validForecasts.map(f => f.source).join(', ')}`);

	// 4. Aggregation Logic
	const aggregation: AggregationData = {
		temp: [],
		feels_like: [],
		humidity: [],
		wind_speed: [],
		wind_direction: [],
		wind_gust: [],
		precipitation_prob: [],
		aqi: [],
		pressure: [],
		uv_index: [],
		visibility: [],
		cloud_cover: [],
		dew_point: [],
		conditions: {}
	};

	const accuracyMap = await accuracyMapPromise;

	// Peso dinamico della fonte: base_weight * (1 / (1 + MAE)).
	// Estratto qui perché serve anche alle aggregazioni daily/hourly più sotto.
	const weightOf = (source: string) => {
		const baseWeight = SOURCE_WEIGHTS[source] || 1.0;
		const sourceAccuracy = accuracyMap[source];
		const mae = sourceAccuracy ? (sourceAccuracy['temperature'] || 0) : 0;
		return baseWeight * (1 / (1 + mae));
	};

	validForecasts.forEach(f => {
		const weight = weightOf(f.source);

		const pushValue = (key: keyof Omit<AggregationData, 'conditions'>, val: number | null | undefined) => {
			if (val !== null && val !== undefined) {
				aggregation[key].push({ val, weight });
			}
		};
		pushValue('temp', f.temp);
		pushValue('feels_like', f.feels_like);
		pushValue('humidity', f.humidity);
		pushValue('wind_speed', f.wind_speed);
		pushValue('wind_direction', f.wind_direction);
		pushValue('wind_gust', f.wind_gust);
		pushValue('precipitation_prob', f.precipitation_prob);
		pushValue('aqi', f.aqi);
		pushValue('pressure', f.pressure);
		pushValue('uv_index', f.uv_index);
		pushValue('visibility', f.visibility);
		pushValue('cloud_cover', f.cloud_cover);
		pushValue('dew_point', f.dew_point);

		const code = f.condition_code || 'unknown';
		if (!aggregation.conditions[code]) aggregation.conditions[code] = 0;
		aggregation.conditions[code] += weight;
	});

	const avg = (items: { val: number; weight: number }[]) => {
		if (items.length === 0) return null;
		const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
		const weightedSum = items.reduce((sum, item) => sum + (item.val * item.weight), 0);
		return Number((weightedSum / totalWeight).toFixed(1));
	};

	const isNumericCondition = (s: string) => !isNaN(Number(s)) && s.trim() !== '';

	let bestCondition = 'unknown';
	let maxScore = -1;
	
	const numericScores: Record<string, number> = {};
	const stringScores: Record<string, number> = {};

	Object.entries(aggregation.conditions).forEach(([code, score]) => {
		if (isNumericCondition(code)) numericScores[code] = score;
		else stringScores[code] = score;
	});

	if (Object.keys(numericScores).length > 0) {
		Object.entries(numericScores).forEach(([code, score]) => {
			if (score > maxScore) { maxScore = score; bestCondition = code; }
		});
	} else {
		Object.entries(stringScores).forEach(([code, score]) => {
			if (score > maxScore) { maxScore = score; bestCondition = code; }
		});
	}

	const aggCloudCover = avg(aggregation.cloud_cover);
	const rawBestCondition = bestCondition; // Preserve WMO code before normalization
	bestCondition = normalizeConditionWithCloudCover(bestCondition, aggCloudCover);

	// 5. Daily & Hourly Aggregation
	const dailyMap = new Map<string, any>();
	validForecasts.forEach(f => {
		if (f.daily && Array.isArray(f.daily)) {
			f.daily.forEach(d => {
				if (!dailyMap.has(d.date)) {
					dailyMap.set(d.date, { temp_max: [], temp_min: [], precip_prob: [], codes: [], uv_index_max: [], precip_mm: [] });
				}
				const entry = dailyMap.get(d.date)!;
				if (d.temp_max !== null) entry.temp_max.push(d.temp_max);
				if (d.temp_min !== null) entry.temp_min.push(d.temp_min);
				if (d.precipitation_prob !== null) entry.precip_prob.push(d.precipitation_prob);
				if (d.uv_index_max != null) entry.uv_index_max.push(d.uv_index_max);
				if (d.precipitation_mm != null) entry.precip_mm.push({ val: d.precipitation_mm, weight: weightOf(f.source) });
				entry.codes.push(d.condition_code);
			});
		}
	});

	const aggregatedDaily = Array.from(dailyMap.keys()).sort().slice(0, 7).map(date => {
		const data = dailyMap.get(date)!;
		const avgSimple = (arr: number[]) => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
		const isNumericCondition = (s: string) => !isNaN(Number(s)) && s.trim() !== '';
		const numericCodes = data.codes.filter(isNumericCondition);
		const targetCodes = numericCodes.length > 0 ? numericCodes : data.codes;

		const codeCounts: Record<string, number> = {};
		targetCodes.forEach((c: string) => codeCounts[c] = (codeCounts[c] || 0) + 1);
		const bestCode = Object.entries(codeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

		const uvMax = data.uv_index_max.length > 0 ? Math.max(...data.uv_index_max) : undefined;
		return {
			date,
			temp_max: avgSimple(data.temp_max),
			temp_min: avgSimple(data.temp_min),
			precipitation_prob: avgSimple(data.precip_prob) || 0,
			condition_code: bestCode,
			condition_text: bestCode.toUpperCase(),
			...(uvMax !== undefined && { uv_index_max: uvMax }),
			...(data.precip_mm.length > 0 && { precipitation_mm: aggregatePrecipitationMm(data.precip_mm) }),
		};
	});

	// 5b. Hourly Aggregation (merge from all sources by time slot)

	// Offset locale della località, preso dalla prima fonte che lo espone
	// (open-meteo lo restituisce con timezone:'auto').
	const tzOffsetMs = (validForecasts.find(f => f.utc_offset_seconds != null)?.utc_offset_seconds ?? 0) * 1000;

	/**
	 * Costruisce la chiave YYYY-MM-DDTHH:00 dello slot orario.
	 *
	 * Le fonti non sono omogenee: open-meteo, weatherapi e wwo restituiscono già
	 * l'ora locale, mentre tomorrow.io e weatherkit restituiscono UTC. Troncare
	 * la stringa a 13 caratteri, come si faceva prima, trattava un timestamp UTC
	 * come se fosse locale e spostava i loro dati di un'intera fascia oraria
	 * (−2h per l'Italia d'estate). Sulla temperatura la media lo assorbiva, sui
	 * millimetri produceva barre in ore sbagliate.
	 */
	const hourKeyOf = (rawTime: string): string => {
		const normalizedTime = rawTime.replace(' ', 'T');
		// Timestamp con fuso esplicito (…Z oppure …+02:00): va convertito in ora locale.
		if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalizedTime)) {
			const parsed = Date.parse(normalizedTime);
			if (!isNaN(parsed)) {
				return new Date(parsed + tzOffsetMs).toISOString().slice(0, 13) + ':00';
			}
		}
		// Timestamp già in ora locale (nessun fuso indicato): si usa così com'è.
		return normalizedTime.slice(0, 13) + ':00';
	};

	const hourlyMap = new Map<string, { temps: number[]; feels_like: number[]; probs: number[]; codes: string[]; humidities: number[]; wind_speeds: number[]; uv_indices: number[]; precip_mm: { val: number; weight: number }[]; wind_directions: { val: number; weight: number }[]; wind_gusts: { val: number; weight: number }[] }>();
	validForecasts.forEach(f => {
		if (f.hourly && Array.isArray(f.hourly)) {
			const sourceWeight = weightOf(f.source);
			f.hourly.forEach(h => {
				const timeKey = hourKeyOf(h.time);
				if (!hourlyMap.has(timeKey)) {
					hourlyMap.set(timeKey, { temps: [], feels_like: [], probs: [], codes: [], humidities: [], wind_speeds: [], uv_indices: [], precip_mm: [], wind_directions: [], wind_gusts: [] });
				}
				const entry = hourlyMap.get(timeKey)!;
				if (h.temp != null) entry.temps.push(h.temp);
				if (h.feels_like != null) entry.feels_like.push(h.feels_like);
				if (h.precipitation_prob != null) entry.probs.push(h.precipitation_prob);
				if (h.humidity != null) entry.humidities.push(h.humidity);
				if (h.wind_speed != null) entry.wind_speeds.push(h.wind_speed);
				if (h.uv_index != null) entry.uv_indices.push(h.uv_index);
				// Direzione e raffica non sono medie aritmetiche: la prima è circolare,
				// la seconda va presa al massimo. Entrambe portano quindi il peso della fonte.
				if (h.wind_direction != null) entry.wind_directions.push({ val: h.wind_direction, weight: sourceWeight });
				if (h.wind_gust != null) entry.wind_gusts.push({ val: h.wind_gust, weight: sourceWeight });
				// NB: openweathermap non popola precipitation_mm sull'hourly perché i suoi
				// slot sono totali su 3 ore e non sono confrontabili con gli accumuli orari
				// delle altre fonti. Contribuisce solo alla somma giornaliera.
				if (h.precipitation_mm != null) entry.precip_mm.push({ val: h.precipitation_mm, weight: sourceWeight });
				entry.codes.push(h.condition_code);
			});
		}
	});

	const aggregatedHourly = Array.from(hourlyMap.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([time, data]) => {
			const avgSimple = (arr: number[]) => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
			const isNumericCondition = (s: string) => !isNaN(Number(s)) && s.trim() !== '';
			const numericCodes = data.codes.filter(isNumericCondition);
			const targetCodes = numericCodes.length > 0 ? numericCodes : data.codes;

			const codeCounts: Record<string, number> = {};
			targetCodes.forEach((c: string) => codeCounts[c] = (codeCounts[c] || 0) + 1);
			const bestCode = Object.entries(codeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
			return {
				time,
				temp: avgSimple(data.temps) ?? 0,
				precipitation_prob: avgSimple(data.probs) ?? 0,
				condition_code: bestCode,
				condition_text: bestCode.toUpperCase(),
				...(data.feels_like.length > 0 && { feels_like: avgSimple(data.feels_like) }),
				...(data.humidities.length > 0 && { humidity: avgSimple(data.humidities) }),
				...(data.wind_speeds.length > 0 && { wind_speed: avgSimple(data.wind_speeds) }),
				...(data.wind_directions.length > 0 && { wind_direction: aggregateWindDirection(data.wind_directions) }),
				...(data.wind_gusts.length > 0 && { wind_gust: aggregateWindGust(data.wind_gusts) }),
				...(data.uv_indices.length > 0 && { uv_index: avgSimple(data.uv_indices) }),
				...(data.precip_mm.length > 0 && { precipitation_mm: aggregatePrecipitationMm(data.precip_mm) }),
			};
		});

	// Prefer astronomy source with moonrise/moonset, then real moon_phase, then any
	const sourceWithAstronomy =
		validForecasts.find(f => f.astronomy && (f.astronomy.moonrise || f.astronomy.moonset)) ??
		validForecasts.find(f => f.astronomy && f.astronomy.moon_phase !== 'unknown' && f.astronomy.moon_phase !== '') ??
		validForecasts.find(f => f.astronomy);

	// Merge moon data from other sources if the primary doesn't have them
	if (sourceWithAstronomy?.astronomy) {
		if (!sourceWithAstronomy.astronomy.moonrise) {
			const moonSource = validForecasts.find(f => f.astronomy?.moonrise || f.astronomy?.moonset);
			if (moonSource?.astronomy) {
				if (moonSource.astronomy.moonrise) sourceWithAstronomy.astronomy.moonrise = moonSource.astronomy.moonrise;
				if (moonSource.astronomy.moonset) sourceWithAstronomy.astronomy.moonset = moonSource.astronomy.moonset;
			}
		}
		if (sourceWithAstronomy.astronomy.moon_illumination == null) {
			const illumSource = validForecasts.find(f => f.astronomy?.moon_illumination != null);
			if (illumSource?.astronomy?.moon_illumination != null) {
				sourceWithAstronomy.astronomy.moon_illumination = illumSource.astronomy.moon_illumination;
			}
		}
	}

	// Find air_quality detail (only WeatherAPI provides this)
	const sourceWithAirQuality = validForecasts.find(f => f.air_quality);

	const aggTemp = avg(aggregation.temp);
	const aggHumidity = avg(aggregation.humidity);
	// Media circolare: la media aritmetica di 350° e 10° darebbe sud invece di nord.
	const aggWindDir = aggregateWindDirection(aggregation.wind_direction);

	const result = {
		location: { lat, lon },
		generated_at: new Date().toISOString(),
		sources_used: validForecasts.map(f => f.source),
		current: {
			temperature: aggTemp,
			feels_like: avg(aggregation.feels_like),
			humidity: aggHumidity,
			wind_speed: avg(aggregation.wind_speed),
			wind_direction: aggWindDir,
			wind_direction_label: aggWindDir !== null ? degreesToCompass(aggWindDir) : null,
			wind_gust: avg(aggregation.wind_gust),
			precipitation_prob: avg(aggregation.precipitation_prob) || 0,
			dew_point: avg(aggregation.dew_point) ?? ((aggTemp !== null && aggHumidity !== null) ? calculateDewPoint(aggTemp, aggHumidity) : null),
			aqi: avg(aggregation.aqi),
			pressure: avg(aggregation.pressure),
			condition: bestCondition,
			condition_code: rawBestCondition,
			condition_text: bestCondition.toUpperCase(),
			uv_index: avg(aggregation.uv_index),
			visibility: avg(aggregation.visibility),
			cloud_cover: aggCloudCover,
			air_quality: sourceWithAirQuality?.air_quality ?? null,
		},
		daily: aggregatedDaily,
		hourly: aggregatedHourly,
		astronomy: sourceWithAstronomy?.astronomy,
		// forecastNextHour: disponibile solo da WeatherKit (non aggregabile)
		...(validForecasts.find(f => f.forecastNextHour)?.forecastNextHour && {
			forecastNextHour: validForecasts.find(f => f.forecastNextHour)!.forecastNextHour,
		}),
		alerts: [] as WeatherAlert[], // verrà popolato dopo la deduplicazione
	};

	// 5c. Fetch allerte OWM in parallelo (non blocca il forecast)
	try {
		const owmAlerts = await fetchOWMAlerts(lat, lon);
		if (owmAlerts.length > 0) {
			allAlerts.push(...owmAlerts);
		}
	} catch (err: any) {
		console.warn(`[AlertPipeline] OWM alerts fetch failed: ${err.message}`);
	}

	// 5d. Filtro geografico + deduplicazione allerte multi-source
	result.alerts = aggregateAlerts(allAlerts, lat, lon);

	console.log(`[AlertPipeline] Multi-source alerts: total=${allAlerts.length} attive e rilevanti=${result.alerts.length} sources=${[...new Set(allAlerts.map(a => a.providerSource))].join(',')}`);

	// 6. Save Aggregated Result to DB
	if (locationId) {
		const { error: smartError } = await supabase.from('smart_forecasts').insert({
			location_id: locationId,
			latitude: lat,
			longitude: lon,
			generated_at: result.generated_at,
			temperature: result.current.temperature,
			feels_like: result.current.feels_like,
			humidity: result.current.humidity,
			wind_speed: result.current.wind_speed,
			precipitation_prob: result.current.precipitation_prob,
			condition: result.current.condition,
			condition_text: result.current.condition_text,
			sources_used: result.sources_used,
			sources_count: result.sources_used.length,
			confidence_score: null,
			// Lo schema_version viaggia solo nella cache: viene rimosso prima di
			// restituire la risposta, così l'API non cambia forma.
			full_data: { ...result, schema_version: FORECAST_SCHEMA_VERSION }
		});
		if (smartError) console.error('Error saving smart forecast:', smartError);
	}

	// 7. Log Deviations for AI Accuracy
	logAccuracyDeviations(result, validForecasts);

	// 8. Process Weather Alerts (async, non-blocking) — usa allerte deduplicate
	if (result.alerts.length > 0) {
		console.log(`[AlertPipeline] Dispatching ${result.alerts.length} deduplicated alert(s) for ${lat},${lon}: ${result.alerts.map((a: WeatherAlert) => `${a.id}(${a.severity})`).join(', ')}`);
		processWeatherAlerts(result.alerts, lat, lon).catch(err =>
			console.error(`[AlertPipeline] Unhandled error in processWeatherAlerts for ${lat},${lon}:`, err.message, err.stack)
		);
	} else {
		console.log(`[AlertPipeline] No active alerts from any source for ${lat},${lon}`);
	}

	return result;
}
