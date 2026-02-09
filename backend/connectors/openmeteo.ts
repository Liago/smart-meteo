import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

export async function fetchFromOpenMeteo(lat: number, lon: number): Promise<UnifiedForecast | null> {
	try {
		const url = 'https://api.open-meteo.com/v1/forecast';
		const params = {
			latitude: lat,
			longitude: lon,
			current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m',
			hourly: 'temperature_2m', // minimal hourly just to satisfy API structure if needed, or stick to current
			timezone: 'auto'
		};

		const response = await axios.get(url, { params });
		const data = response.data.current;

		if (!data) return null;

		// Map WMO weather codes to our condition codes implies some logic, 
		// but UnifiedForecast takes a string. We'll pass the code.
		// Open-Meteo WMO codes: https://open-meteo.com/en/docs
		// 0: Clear sky
		// 1, 2, 3: Mainly clear, partly cloudy, and overcast
		// 45, 48: Fog
		// 51-55: Drizzle
		// 61-65: Rain
		// 71-77: Snow
		// 80-82: Rain showers
		// 85-86: Snow showers
		// 95-99: Thunderstorm

		return new UnifiedForecast({
			source: 'open-meteo',
			lat: lat,
			lon: lon,
			time: data.time,
			temp: data.temperature_2m,
			feels_like: data.apparent_temperature,
			humidity: data.relative_humidity_2m,
			wind_speed: data.wind_speed_10m,
			wind_direction: data.wind_direction_10m,
			condition_text: `Code ${data.weather_code}`,
			condition_code: String(data.weather_code),
			precipitation_prob: null, // Open-Meteo current doesn't give prob, only actual precip. We can check hourly for prob if needed, but for MVP keeping it simple.
			precipitation_intensity: data.precipitation
		});

	} catch (error: any) {
		console.error('Error fetching Open-Meteo:', error.message);
		return null;
	}
}
