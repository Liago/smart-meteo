import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';
import { normalizeCondition } from '../utils/formatter';
import { DailyForecast, HourlyForecast, AstronomyData, WeatherAlert } from '../types';

const OWM_CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather';
const OWM_FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const OWM_ONECALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';

export async function fetchFromOpenWeather(lat: number, lon: number): Promise<UnifiedForecast | null> {
	const apiKey = process.env.OPENWEATHER_API_KEY;
	if (!apiKey) {
		console.error('Missing OPENWEATHER_API_KEY');
		return null;
	}

	const params = {
		lat: lat,
		lon: lon,
		appid: apiKey,
		units: 'metric'
	};

	try {
		// Fetch current + forecast in parallel
		const [currentRes, forecastRes] = await Promise.allSettled([
			axios.get(OWM_CURRENT_URL, { params }),
			axios.get(OWM_FORECAST_URL, { params: { ...params, cnt: 40 } })
		]);

		// Current is required
		if (currentRes.status !== 'fulfilled') {
			console.error('OWM current failed:', (currentRes as PromiseRejectedResult).reason?.message);
			return null;
		}

		const data = currentRes.value.data;

		// Parse forecast data if available
		let daily: DailyForecast[] = [];
		let hourly: HourlyForecast[] = [];

		if (forecastRes.status === 'fulfilled') {
			const forecastData = forecastRes.value.data;

			// Aggregate 3h slots into daily forecasts
			const dailyMap = new Map<string, { temps: number[]; probs: number[]; codes: string[] }>();
			forecastData.list.forEach((slot: any) => {
				const date = slot.dt_txt.slice(0, 10);
				if (!dailyMap.has(date)) dailyMap.set(date, { temps: [], probs: [], codes: [] });
				const entry = dailyMap.get(date)!;
				entry.temps.push(slot.main.temp);
				entry.probs.push((slot.pop ?? 0) * 100); // pop is 0-1
				entry.codes.push(slot.weather[0].main);
			});

			daily = Array.from(dailyMap.entries()).map(([date, d]) => ({
				date,
				temp_max: Math.max(...d.temps),
				temp_min: Math.min(...d.temps),
				precipitation_prob: Number((d.probs.reduce((a, b) => a + b, 0) / d.probs.length).toFixed(1)),
				condition_code: normalizeCondition(d.codes[Math.floor(d.codes.length / 2)]),
				condition_text: d.codes[Math.floor(d.codes.length / 2)] ?? null,
			}));

			// Hourly from all available slots (~5 days at 3h intervals)
			hourly = forecastData.list.map((slot: any) => ({
				time: new Date(slot.dt * 1000).toISOString(),
				temp: slot.main.temp,
				precipitation_prob: (slot.pop ?? 0) * 100,
				condition_code: normalizeCondition(slot.weather[0].main),
				condition_text: slot.weather[0].description,
			}));
		} else {
			console.warn('OWM forecast failed, using current only:', (forecastRes as PromiseRejectedResult).reason?.message);
		}

		// Extract astronomy from current response
		let astronomy: AstronomyData | undefined;
		if (data.sys?.sunrise && data.sys?.sunset) {
			astronomy = {
				sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
				sunset: new Date(data.sys.sunset * 1000).toISOString(),
				moon_phase: 'unknown', // OWM doesn't provide moon phase
			};
		}

		const forecastData: any = {
			source: 'openweathermap',
			lat: lat,
			lon: lon,
			time: new Date().toISOString(),
			temp: data.main.temp,
			feels_like: data.main.feels_like,
			humidity: data.main.humidity,
			wind_speed: data.wind.speed,
			wind_direction: data.wind.deg,
			wind_gust: data.wind.gust ?? null,
			condition_text: data.weather[0] ? data.weather[0].main : 'Unknown',
			precipitation_prob: null,
			pressure: data.main.pressure ?? null,
			visibility: data.visibility != null ? data.visibility / 1000 : null,
			daily: daily,
			hourly: hourly,
		};

		if (astronomy) {
			forecastData.astronomy = astronomy;
		}

		return new UnifiedForecast(forecastData);

	} catch (error: any) {
		console.error('Error fetching OpenWeatherMap:', error.message);
		return null;
	}
}

/**
 * Fetch allerte meteo da OpenWeatherMap One Call API 3.0.
 * Richiede che l'API key abbia accesso a One Call API.
 * Restituisce un array vuoto se l'endpoint non è disponibile.
 */
export async function fetchOWMAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
	const apiKey = process.env.OPENWEATHER_API_KEY;
	if (!apiKey) return [];

	try {
		const response = await axios.get(OWM_ONECALL_URL, {
			params: {
				lat,
				lon,
				appid: apiKey,
				exclude: 'minutely,hourly,daily,current',
			},
			timeout: 5000,
		});

		const alertsData = response.data?.alerts;
		if (!alertsData || !Array.isArray(alertsData) || alertsData.length === 0) {
			return [];
		}

		console.log(`[OWM] Found ${alertsData.length} alert(s) for ${lat},${lon}`);

		return alertsData.map((a: any) => ({
			id: `owm:${a.event || 'unknown'}_${a.start || 'notime'}`,
			description: a.description || a.event || 'Weather alert',
			headline: a.event || undefined,
			event: a.event || undefined,
			severity: mapOWMSeverityFromTags(a.tags),
			certainty: 'possible',
			effectiveTime: a.start ? new Date(a.start * 1000).toISOString() : new Date().toISOString(),
			expireTime: a.end ? new Date(a.end * 1000).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			source: a.sender_name || 'OpenWeatherMap',
			providerSource: 'openweathermap',
		}));
	} catch (error: any) {
		// One Call API potrebbe non essere disponibile per tutte le API key
		if (error.response?.status === 401 || error.response?.status === 403) {
			console.log('[OWM] One Call API not available for this API key, skipping alerts');
		} else {
			console.warn(`[OWM] Error fetching alerts: ${error.message}`);
		}
		return [];
	}
}

function mapOWMSeverityFromTags(tags: string[] | undefined): string {
	if (!tags || !Array.isArray(tags)) return 'moderate';
	const tagStr = tags.join(' ').toLowerCase();
	if (tagStr.includes('extreme')) return 'extreme';
	if (tagStr.includes('severe') || tagStr.includes('warning')) return 'severe';
	if (tagStr.includes('watch') || tagStr.includes('moderate')) return 'moderate';
	return 'minor';
}
