import { fetchFromTomorrow } from '../connectors/tomorrow';
import { fetchFromMeteomatics } from '../connectors/meteomatics';
import { fetchFromOpenWeather } from '../connectors/openweathermap';
import { fetchFromWeatherAPI } from '../connectors/weatherapi';
import { fetchFromAccuWeather } from '../connectors/accuweather';
import { UnifiedForecast } from '../utils/formatter';
import { WeatherConditionWeights } from '../types';
import { sources } from '../routes/sources';

const SOURCE_WEIGHTS: WeatherConditionWeights = {
	'tomorrow.io': 1.2,
	'meteomatics': 1.2,
	'openweathermap': 1.0,
	'weatherapi': 1.0,
	'accuweather': 1.1
};

const SOURCE_FETCHERS: Record<string, (lat: number, lon: number) => Promise<UnifiedForecast | null>> = {
	'tomorrow.io': fetchFromTomorrow,
	'meteomatics': fetchFromMeteomatics,
	'openweathermap': fetchFromOpenWeather,
	'weatherapi': fetchFromWeatherAPI,
	'accuweather': fetchFromAccuWeather
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
		}
	};
}
