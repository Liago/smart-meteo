import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

const OWM_API_URL = 'https://api.openweathermap.org/data/2.5/weather';

export async function fetchFromOpenWeather(lat: number, lon: number): Promise<UnifiedForecast | null> {
	const apiKey = process.env.OPENWEATHER_API_KEY;
	if (!apiKey) {
		console.error('Missing OPENWEATHER_API_KEY');
		return null;
	}

	try {
		const response = await axios.get(OWM_API_URL, {
			params: {
				lat: lat,
				lon: lon,
				appid: apiKey,
				units: 'metric'
			}
		});

		const data = response.data;

		return new UnifiedForecast({
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
			precipitation_prob: null
		});

	} catch (error: any) {
		console.error('Error fetching OpenWeatherMap:', error.message);
		return null;
	}
}
