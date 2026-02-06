import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

const WEATHERAPI_URL = 'http://api.weatherapi.com/v1/current.json';

export async function fetchFromWeatherAPI(lat: number, lon: number): Promise<UnifiedForecast | null> {
	const apiKey = process.env.WEATHERAPI_KEY;
	if (!apiKey) {
		console.error('Missing WEATHERAPI_KEY');
		return null;
	}

	try {
		const response = await axios.get(WEATHERAPI_URL, {
			params: {
				key: apiKey,
				q: `${lat},${lon}`,
				aqi: 'no'
			}
		});

		const data = response.data;
		const current = data.current;

		return new UnifiedForecast({
			source: 'weatherapi',
			lat: lat,
			lon: lon,
			time: data.location.localtime,
			temp: current.temp_c,
			feels_like: current.feelslike_c,
			humidity: current.humidity,
			wind_speed: current.wind_kph / 3.6,
			wind_direction: current.wind_degree,
			condition_text: current.condition.text,
			precipitation_prob: null
		});

	} catch (error: any) {
		console.error('Error fetching WeatherAPI:', error.message);
		return null;
	}
}
