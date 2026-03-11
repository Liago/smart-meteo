import { fetchFromTomorrow } from '../connectors/tomorrow';
import { fetchFromOpenMeteo } from '../connectors/openmeteo';
import { fetchFromOpenWeather } from '../connectors/openweathermap';
import { fetchFromWeatherAPI } from '../connectors/weatherapi';
import { fetchFromAccuWeather } from '../connectors/accuweather';
import { fetchFromWWO } from '../connectors/worldweatheronline';
import { fetchFromWeatherstack } from '../connectors/weatherstack';
import { fetchFromMeteostat } from '../connectors/meteostat';
import { fetchFromWeatherKit, fetchFromWeatherKitWithAlerts } from '../connectors/weatherkit';
import { UnifiedForecast, normalizeConditionWithCloudCover } from '../utils/formatter';
import { WeatherConditionWeights, AirQualityDetail, WeatherAlert } from '../types';
import { sources } from '../routes/sources';
import { supabase } from '../services/supabase';
import { getAccuracyMap, logAccuracyDeviations } from '../services/accuracy';
import { processWeatherAlerts } from '../services/alertProcessor';

const SOURCE_WEIGHTS: WeatherConditionWeights = {
	'tomorrow.io': 1.2,
	'open-meteo': 1.1,
	'openweathermap': 1.0,
	'weatherapi': 1.0,
	'accuweather': 1.1,
	'worldweatheronline': 1.0,
	'weatherstack': 0.9,
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
			if (cached.full_data) {
				console.log('Cache HIT: returning full smart forecast from DB');
				return cached.full_data;
			}
			// Legacy cache without full_data — skip and re-fetch
			console.log('Cache HIT but no full_data — re-fetching for complete response');
		}
	}

	// 3. Fetch from External & Load Accuracies
	const activeSources = sources.filter(s => s.active);
	const accuracyMapPromise = getAccuracyMap();

	// Raccoglie le allerte WeatherKit durante il fetch
	let weatherKitAlerts: WeatherAlert[] = [];

	const fetchPromises = activeSources.map(async s => {
		const start = Date.now();
		try {
			let result: UnifiedForecast | null = null;

			// Per WeatherKit, usa la variante con allerte
			if (s.id === 'apple_weatherkit') {
				const wkResult = await fetchFromWeatherKitWithAlerts(lat, lon);
				if (wkResult) {
					result = wkResult.forecast;
					weatherKitAlerts = wkResult.alerts;
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

	validForecasts.forEach(f => {
		const baseWeight = SOURCE_WEIGHTS[f.source] || 1.0;
		// Use dynamic weight if accuracy data is available for this source
		const sourceAccuracy = accuracyMap[f.source];
		const mae = sourceAccuracy ? (sourceAccuracy['temperature'] || 0) : 0;
		// Formula: base_weight * (1 / (1 + MAE))
		const weight = baseWeight * (1 / (1 + mae));

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

	let bestCondition = 'unknown';
	let maxScore = -1;
	Object.entries(aggregation.conditions).forEach(([code, score]) => {
		if (score > maxScore) {
			maxScore = score;
			bestCondition = code;
		}
	});

	const aggCloudCover = avg(aggregation.cloud_cover);
	const rawBestCondition = bestCondition; // Preserve WMO code before normalization
	bestCondition = normalizeConditionWithCloudCover(bestCondition, aggCloudCover);

	// 5. Daily & Hourly Aggregation
	const dailyMap = new Map<string, any>();
	validForecasts.forEach(f => {
		if (f.daily && Array.isArray(f.daily)) {
			f.daily.forEach(d => {
				if (!dailyMap.has(d.date)) {
					dailyMap.set(d.date, { temp_max: [], temp_min: [], precip_prob: [], codes: [] });
				}
				const entry = dailyMap.get(d.date)!;
				if (d.temp_max !== null) entry.temp_max.push(d.temp_max);
				if (d.temp_min !== null) entry.temp_min.push(d.temp_min);
				if (d.precipitation_prob !== null) entry.precip_prob.push(d.precipitation_prob);
				entry.codes.push(d.condition_code);
			});
		}
	});

	const aggregatedDaily = Array.from(dailyMap.keys()).sort().slice(0, 7).map(date => {
		const data = dailyMap.get(date)!;
		const avgSimple = (arr: number[]) => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
		const codeCounts: Record<string, number> = {};
		data.codes.forEach((c: string) => codeCounts[c] = (codeCounts[c] || 0) + 1);
		const bestCode = Object.entries(codeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

		return {
			date,
			temp_max: avgSimple(data.temp_max),
			temp_min: avgSimple(data.temp_min),
			precipitation_prob: avgSimple(data.precip_prob) || 0,
			condition_code: bestCode,
			condition_text: bestCode.toUpperCase()
		};
	});

	// 5b. Hourly Aggregation (merge from all sources by time slot)
	const hourlyMap = new Map<string, { temps: number[]; probs: number[]; codes: string[] }>();
	validForecasts.forEach(f => {
		if (f.hourly && Array.isArray(f.hourly)) {
			f.hourly.forEach(h => {
				// Normalize time key to YYYY-MM-DDTHH:00 for consistent grouping
				// Replace space with T (WeatherAPI uses "2026-03-10 14:00" format)
				const normalizedTime = h.time.replace(' ', 'T');
				const timeKey = normalizedTime.slice(0, 13) + ':00';
				if (!hourlyMap.has(timeKey)) {
					hourlyMap.set(timeKey, { temps: [], probs: [], codes: [] });
				}
				const entry = hourlyMap.get(timeKey)!;
				if (h.temp != null) entry.temps.push(h.temp);
				if (h.precipitation_prob != null) entry.probs.push(h.precipitation_prob);
				entry.codes.push(h.condition_code);
			});
		}
	});

	const aggregatedHourly = Array.from(hourlyMap.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([time, data]) => {
			const avgSimple = (arr: number[]) => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
			const codeCounts: Record<string, number> = {};
			data.codes.forEach(c => codeCounts[c] = (codeCounts[c] || 0) + 1);
			const bestCode = Object.entries(codeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
			return {
				time,
				temp: avgSimple(data.temps) ?? 0,
				precipitation_prob: avgSimple(data.probs) ?? 0,
				condition_code: bestCode,
				condition_text: bestCode.toUpperCase()
			};
		});

	// Prefer astronomy source with real moon_phase over calculated/unknown
	const sourceWithAstronomy =
		validForecasts.find(f => f.astronomy && f.astronomy.moon_phase !== 'unknown' && f.astronomy.moon_phase !== '') ??
		validForecasts.find(f => f.astronomy);

	// Find air_quality detail (only WeatherAPI provides this)
	const sourceWithAirQuality = validForecasts.find(f => f.air_quality);

	const aggTemp = avg(aggregation.temp);
	const aggHumidity = avg(aggregation.humidity);
	const aggWindDir = avg(aggregation.wind_direction);

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
		alerts: weatherKitAlerts.filter(a => !a.expireTime || new Date(a.expireTime) > new Date())
	};

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
			full_data: result // Store entire result for cache
		});
		if (smartError) console.error('Error saving smart forecast:', smartError);
	}

	// 7. Log Deviations for AI Accuracy
	logAccuracyDeviations(result, validForecasts);

	// 8. Process Weather Alerts (async, non-blocking)
	if (weatherKitAlerts.length > 0) {
		console.log(`Processing ${weatherKitAlerts.length} weather alert(s) from WeatherKit`);
		processWeatherAlerts(weatherKitAlerts, lat, lon).catch(err =>
			console.error('Error processing weather alerts:', err.message)
		);
	}

	return result;
}
