import { fetchFromTomorrow } from '../connectors/tomorrow';
import { fetchFromOpenMeteo } from '../connectors/openmeteo';
import { fetchFromOpenWeather } from '../connectors/openweathermap';
import { fetchFromWeatherAPI } from '../connectors/weatherapi';
import { fetchFromAccuWeather } from '../connectors/accuweather';
import { fetchFromWWO } from '../connectors/worldweatheronline';
import { fetchFromWeatherstack } from '../connectors/weatherstack';
import { fetchFromMeteostat } from '../connectors/meteostat';
import { UnifiedForecast } from '../utils/formatter';
import { WeatherConditionWeights } from '../types';
import { sources } from '../routes/sources';

const SOURCE_WEIGHTS: WeatherConditionWeights = {
	'tomorrow.io': 1.2,
	'open-meteo': 1.1, // High weight for scientific data
	'openweathermap': 1.0,
	'weatherapi': 1.0,
	'accuweather': 1.1,
	'worldweatheronline': 1.0,
	'weatherstack': 0.9,
	'meteostat': 0.8 // Lower weight as it might be older data
};

const SOURCE_FETCHERS: Record<string, (lat: number, lon: number) => Promise<UnifiedForecast | null>> = {
	'tomorrow.io': fetchFromTomorrow,
	'open-meteo': fetchFromOpenMeteo,
	'openweathermap': fetchFromOpenWeather,
	'weatherapi': fetchFromWeatherAPI,
	'accuweather': fetchFromAccuWeather,
	'worldweatheronline': fetchFromWWO,
	'weatherstack': fetchFromWeatherstack,
	'meteostat': fetchFromMeteostat
};

interface AggregationData {
	temp: { val: number; weight: number }[];
	feels_like: { val: number; weight: number }[];
	humidity: { val: number; weight: number }[];
	wind_speed: { val: number; weight: number }[];
	precipitation_prob: { val: number; weight: number }[];
	conditions: { [key: string]: number };
}

export async function getSmartForecast(lat: number, lon: number): Promise<any> {
	console.log(`Starting Smart Engine for ${lat}, ${lon}...`);

	const activeSources = sources.filter(s => s.active);
	const fetchPromises = activeSources.map(s => {
		const fetcher = SOURCE_FETCHERS[s.id];
		if (!fetcher) return Promise.resolve(null);
		const start = Date.now();
		return fetcher(lat, lon).then(result => {
			s.lastResponseMs = Date.now() - start;
			s.lastError = null;
			return result;
		}).catch(err => {
			s.lastResponseMs = Date.now() - start;
			s.lastError = err.message || 'Unknown error';
			return null;
		});
	});

	const results = await Promise.allSettled(fetchPromises);

	const validForecasts = results
		.filter((r): r is PromiseFulfilledResult<UnifiedForecast> => r.status === 'fulfilled' && r.value !== null)
		.map(r => r.value);

	if (validForecasts.length === 0) {
		throw new Error('All weather sources failed to return data.');
	}

	console.log(`Received ${validForecasts.length} valid forecasts from: ${validForecasts.map(f => f.source).join(', ')}`);

	const aggregation: AggregationData = {
		temp: [],
		feels_like: [],
		humidity: [],
		wind_speed: [],
		precipitation_prob: [],
		conditions: {}
	};

	validForecasts.forEach(f => {
		const weight = SOURCE_WEIGHTS[f.source] || 1.0;

		const pushValue = (key: keyof Omit<AggregationData, 'conditions'>, val: number | null) => {
			if (val !== null && val !== undefined) {
				aggregation[key].push({ val, weight });
			}
		};

		pushValue('temp', f.temp);
		pushValue('feels_like', f.feels_like);
		pushValue('humidity', f.humidity);
		pushValue('wind_speed', f.wind_speed);
		pushValue('precipitation_prob', f.precipitation_prob);

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

	// Aggregate Daily Forecasts
	// We'll take the first 3 days (Today, Tomorrow, Day After)
	const dailyMap = new Map<string, {
		temp_max: number[];
		temp_min: number[];
		precip_prob: number[];
		codes: string[];
	}>();

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

		// Simple average
		const avg = (arr: number[]) => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

		// Mode for condition code
		const codeCounts: Record<string, number> = {};
		data.codes.forEach(c => codeCounts[c] = (codeCounts[c] || 0) + 1);
		const bestCode = Object.entries(codeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

		return {
			date,
			temp_max: avg(data.temp_max),
			temp_min: avg(data.temp_min),
			precipitation_prob: avg(data.precip_prob) || 0,
			condition_code: bestCode,
			condition_text: bestCode.toUpperCase()
		};
	});

	// Extract Hourly and Astronomy data from the best available source (e.g., OpenMeteo)
	// Priority: check if any source has hourly data
	const sourceWithHourly = validForecasts.find(f => f.hourly && f.hourly.length > 0);
	const sourceWithAstronomy = validForecasts.find(f => f.astronomy);

	return {
		location: { lat, lon },
		generated_at: new Date().toISOString(),
		sources_used: validForecasts.map(f => f.source),
		current: {
			temperature: avg(aggregation.temp),
			feels_like: avg(aggregation.feels_like),
			humidity: avg(aggregation.humidity),
			wind_speed: avg(aggregation.wind_speed),
			precipitation_prob: avg(aggregation.precipitation_prob) || 0,
			condition: bestCondition,
			condition_text: bestCondition.toUpperCase()
		},
		daily: aggregatedDaily,
		hourly: sourceWithHourly?.hourly || [],
		astronomy: sourceWithAstronomy?.astronomy
	};
}
