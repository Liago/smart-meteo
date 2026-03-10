import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';
import { normalizeCondition } from '../utils/formatter';
import { DailyForecast, HourlyForecast, AstronomyData } from '../types';

const BASE_URL = 'http://dataservice.accuweather.com';

// Cache locationKey with TTL (1 hour) to reduce API calls
const locationCache = new Map<string, { key: string; expiresAt: number }>();

async function getLocationKey(lat: number, lon: number, apiKey: string): Promise<string | null> {
	const cacheKey = `${lat},${lon}`;
	const cached = locationCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) return cached.key;

	try {
		const response = await axios.get(`${BASE_URL}/locations/v1/cities/geoposition/search`, {
			params: {
				apikey: apiKey,
				q: `${lat},${lon}`
			}
		});
		if (response.data && response.data.Key) {
			locationCache.set(cacheKey, {
				key: response.data.Key,
				expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour TTL
			});
			return response.data.Key;
		}
	} catch (error: any) {
		console.error('Error fetching AccuWeather LocationKey:', error.message);
	}
	return null;
}

export async function fetchFromAccuWeather(lat: number, lon: number): Promise<UnifiedForecast | null> {
	const apiKey = process.env.ACCUWEATHER_API_KEY;
	if (!apiKey) {
		console.error('Missing ACCUWEATHER_API_KEY');
		return null;
	}

	try {
		const locationKey = await getLocationKey(lat, lon, apiKey);
		if (!locationKey) return null;

		// Fetch current conditions + 5-day forecast + 12h hourly in parallel
		const [currentRes, forecastRes, hourlyRes] = await Promise.allSettled([
			axios.get(`${BASE_URL}/currentconditions/v1/${locationKey}`, {
				params: { apikey: apiKey, details: 'true' }
			}),
			axios.get(`${BASE_URL}/forecasts/v1/daily/5day/${locationKey}`, {
				params: { apikey: apiKey, metric: true, details: true }
			}),
			axios.get(`${BASE_URL}/forecasts/v1/hourly/12hour/${locationKey}`, {
				params: { apikey: apiKey, metric: true, details: true }
			})
		]);

		// Current is required
		if (currentRes.status !== 'fulfilled') {
			console.error('AccuWeather current failed:', (currentRes as PromiseRejectedResult).reason?.message);
			return null;
		}

		const data = currentRes.value.data[0];
		if (!data) return null;

		// Parse 5-day forecast and 12h hourly if available
		let daily: DailyForecast[] = [];
		let hourly: HourlyForecast[] = [];
		let astronomy: AstronomyData | undefined;

		if (forecastRes.status === 'fulfilled') {
			const forecastData = forecastRes.value.data;

			if (forecastData.DailyForecasts) {
				daily = forecastData.DailyForecasts.map((day: any) => ({
					date: day.Date.slice(0, 10),
					temp_max: day.Temperature.Maximum.Value,
					temp_min: day.Temperature.Minimum.Value,
					precipitation_prob: day.Day?.PrecipitationProbability ?? null,
					condition_code: normalizeCondition(day.Day?.IconPhrase),
					condition_text: day.Day?.IconPhrase ?? null,
				}));

				// Extract astronomy from first day
				const firstDay = forecastData.DailyForecasts[0];
				if (firstDay?.Sun?.Rise && firstDay?.Sun?.Set) {
					astronomy = {
						sunrise: firstDay.Sun.Rise,
						sunset: firstDay.Sun.Set,
						moon_phase: firstDay.Moon?.Phase ?? 'unknown',
					};
				}
			}
		} else {
			console.warn('AccuWeather forecast failed, using current only:', (forecastRes as PromiseRejectedResult).reason?.message);
		}

		// Parse 12h hourly forecast
		if (hourlyRes.status === 'fulfilled') {
			const hourlyData = hourlyRes.value.data;
			if (Array.isArray(hourlyData)) {
				hourly = hourlyData.map((h: any) => ({
					time: h.DateTime,
					temp: h.Temperature?.Value ?? 0,
					precipitation_prob: h.PrecipitationProbability ?? 0,
					condition_code: normalizeCondition(h.IconPhrase),
					condition_text: h.IconPhrase ?? null,
				}));
			}
		} else {
			console.warn('AccuWeather hourly failed:', (hourlyRes as PromiseRejectedResult).reason?.message);
		}

		const forecastPayload: any = {
			source: 'accuweather',
			lat: lat,
			lon: lon,
			time: data.LocalObservationDateTime,
			temp: data.Temperature.Metric.Value,
			feels_like: data.RealFeelTemperature ? data.RealFeelTemperature.Metric.Value : null,
			humidity: data.RelativeHumidity,
			wind_speed: data.Wind.Speed.Metric.Value / 3.6,
			wind_direction: data.Wind.Direction.Degrees,
			wind_gust: data.WindGust?.Speed?.Metric?.Value ? data.WindGust.Speed.Metric.Value / 3.6 : null,
			condition_text: data.WeatherText,
			precipitation_prob: null,
			pressure: data.Pressure?.Metric?.Value ?? null,
			visibility: data.Visibility?.Metric?.Value ?? null, // already in km
			uv_index: data.UVIndex ?? null,
			daily: daily,
			hourly: hourly,
		};

		if (astronomy) {
			forecastPayload.astronomy = astronomy;
		}

		return new UnifiedForecast(forecastPayload);

	} catch (error: any) {
		console.error('Error fetching AccuWeather:', error.message);
		return null;
	}
}
