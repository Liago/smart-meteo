import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

export async function fetchFromOpenMeteo(lat: number, lon: number): Promise<UnifiedForecast | null> {
	try {
		const url = 'https://api.open-meteo.com/v1/forecast';
		const params = {
			latitude: lat,
			longitude: lon,
			current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m',
			hourly: 'temperature_2m',
			daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
			timezone: 'auto'
		};

		const response = await axios.get(url, { params });
		const current = response.data.current;
		const daily = response.data.daily;

		if (!current) return null;

		// Map daily data
		const dailyForecasts = daily.time.slice(0, 3).map((time: string, index: number) => ({
			date: time,
			temp_max: daily.temperature_2m_max[index],
			temp_min: daily.temperature_2m_min[index],
			precipitation_prob: daily.precipitation_probability_max[index],
			condition_code: String(daily.weather_code[index]),
			condition_text: `Code ${daily.weather_code[index]}`
		}));

		return new UnifiedForecast({
			source: 'open-meteo',
			lat: lat,
			lon: lon,
			time: current.time,
			temp: current.temperature_2m,
			feels_like: current.apparent_temperature,
			humidity: current.relative_humidity_2m,
			wind_speed: current.wind_speed_10m,
			wind_direction: current.wind_direction_10m,
			condition_text: `Code ${current.weather_code}`,
			condition_code: String(current.weather_code),
			precipitation_prob: null,
			precipitation_intensity: current.precipitation,
			daily: dailyForecasts
		});

	} catch (error: any) {
		console.error('Error fetching Open-Meteo:', error.message);
		return null;
	}
}
