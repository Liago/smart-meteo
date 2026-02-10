import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

const BASE_URL = 'http://dataservice.accuweather.com';
const locationCache = new Map<string, string>();

async function getLocationKey(lat: number, lon: number, apiKey: string): Promise<string | null> {
	const key = `${lat},${lon}`;
	if (locationCache.has(key)) return locationCache.get(key) || null;

	try {
		const response = await axios.get(`${BASE_URL}/locations/v1/cities/geoposition/search`, {
			params: {
				apikey: apiKey,
				q: `${lat},${lon}`
			}
		});
		if (response.data && response.data.Key) {
			locationCache.set(key, response.data.Key);
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

		const response = await axios.get(`${BASE_URL}/currentconditions/v1/${locationKey}`, {
			params: {
				apikey: apiKey,
				details: 'true'
			}
		});

		const data = response.data[0];
		if (!data) return null;

		return new UnifiedForecast({
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
			precipitation_prob: null
		});

	} catch (error: any) {
		console.error('Error fetching AccuWeather:', error.message);
		return null;
	}
}
