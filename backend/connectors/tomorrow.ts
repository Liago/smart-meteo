import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';
import { DailyForecast, HourlyForecast } from '../types';

const TOMORROW_API_URL = 'https://api.tomorrow.io/v4/weather/realtime';
const TOMORROW_FORECAST_URL = 'https://api.tomorrow.io/v4/weather/forecast';

// Tomorrow.io weatherCode → normalized condition string
const TOMORROW_CODE_TO_CONDITION: Record<number, string> = {
	1000: 'clear',
	1001: 'cloudy',
	1002: 'clear',       // mostly clear
	1003: 'cloudy',      // partly cloudy
	1004: 'cloudy',      // mostly cloudy
	1100: 'clear',
	1101: 'clear',
	1102: 'cloudy',
	1103: 'cloudy',
	2000: 'fog',
	2100: 'fog',
	4000: 'rain',        // drizzle
	4001: 'rain',
	4200: 'rain',        // light rain
	4201: 'rain',        // heavy rain
	5000: 'snow',
	5001: 'snow',        // flurries
	5100: 'snow',        // light snow
	5101: 'snow',        // heavy snow
	6000: 'snow',        // freezing drizzle
	6001: 'snow',        // freezing rain
	6200: 'snow',        // light freezing rain
	6201: 'snow',        // heavy freezing rain
	7000: 'snow',        // ice pellets
	7101: 'snow',        // heavy ice pellets
	7102: 'snow',        // light ice pellets
	8000: 'storm',       // thunderstorm
};

function tomorrowCodeToText(code: number): string {
	return TOMORROW_CODE_TO_CONDITION[code] ?? 'unknown';
}

interface TomorrowValues {
	temperature: number;
	temperatureApparent: number;
	humidity: number;
	windSpeed: number;
	windDirection: number;
	windGust: number;
	weatherCode: number;
	precipitationProbability: number;
	pressureSurfaceLevel: number;
	uvIndex?: number;
	visibility?: number;       // km
	cloudCover?: number;       // 0-100
	dewPoint?: number;
}

interface TomorrowResponse {
	data: {
		time: string;
		values: TomorrowValues;
	};
}

export async function fetchFromTomorrow(lat: number, lon: number): Promise<UnifiedForecast | null> {
	const apiKey = process.env.TOMORROW_API_KEY;
	if (!apiKey) {
		console.error('Missing TOMORROW_API_KEY');
		return null;
	}

	const baseParams = {
		location: `${lat},${lon}`,
		apikey: apiKey,
		units: 'metric'
	};

	try {
		// Fetch realtime + forecast in parallel
		const [realtimeRes, forecastRes] = await Promise.allSettled([
			axios.get<TomorrowResponse>(TOMORROW_API_URL, { params: baseParams }),
			axios.get(TOMORROW_FORECAST_URL, { params: { ...baseParams, timesteps: '1d,1h' } })
		]);

		// Realtime is required
		if (realtimeRes.status !== 'fulfilled') {
			console.error('Tomorrow.io realtime failed:', (realtimeRes as PromiseRejectedResult).reason?.message);
			return null;
		}

		const data = realtimeRes.value.data.data;
		const values = data.values;

		// Parse forecast data if available
		let daily: DailyForecast[] = [];
		let hourly: HourlyForecast[] = [];

		if (forecastRes.status === 'fulfilled') {
			const forecastData = forecastRes.value.data;

			// Map daily forecasts
			if (forecastData.timelines?.daily) {
				daily = forecastData.timelines.daily.map((day: any) => ({
					date: day.time.slice(0, 10),
					temp_max: day.values.temperatureMax ?? null,
					temp_min: day.values.temperatureMin ?? null,
					precipitation_prob: day.values.precipitationProbabilityMax ?? null,
					condition_code: tomorrowCodeToText(day.values.weatherCodeMax ?? day.values.weatherCode),
					condition_text: tomorrowCodeToText(day.values.weatherCodeMax ?? day.values.weatherCode),
					uv_index_max: day.values.uvIndexMax ?? day.values.uvIndex ?? null,
				}));
			}

			// Map hourly forecasts (all available hours)
			if (forecastData.timelines?.hourly) {
				hourly = forecastData.timelines.hourly.map((h: any) => ({
					time: h.time,
					temp: h.values.temperature,
					precipitation_prob: h.values.precipitationProbability ?? null,
					condition_code: tomorrowCodeToText(h.values.weatherCode),
					condition_text: tomorrowCodeToText(h.values.weatherCode),
				}));
			}
		} else {
			console.warn('Tomorrow.io forecast failed, using realtime only:', (forecastRes as PromiseRejectedResult).reason?.message);
		}

		return new UnifiedForecast({
			source: 'tomorrow.io',
			lat: lat,
			lon: lon,
			time: data.time,
			temp: values.temperature,
			feels_like: values.temperatureApparent,
			humidity: values.humidity,
			wind_speed: values.windSpeed,
			wind_direction: values.windDirection,
			wind_gust: values.windGust ?? null,
			condition_text: tomorrowCodeToText(values.weatherCode),
			condition_code: tomorrowCodeToText(values.weatherCode),
			precipitation_prob: values.precipitationProbability,
			pressure: values.pressureSurfaceLevel ?? null,
			uv_index: values.uvIndex ?? null,
			visibility: values.visibility ?? null,
			cloud_cover: values.cloudCover ?? null,
			dew_point: values.dewPoint ?? null,
			daily: daily,
			hourly: hourly
		});

	} catch (error: any) {
		console.error('Error fetching Tomorrow.io:', error.message);
		return null;
	}
}
