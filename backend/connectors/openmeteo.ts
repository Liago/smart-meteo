import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';
import { getMoonPhase } from '../utils/moon';

export async function fetchFromOpenMeteo(lat: number, lon: number): Promise<UnifiedForecast | null> {
	try {
		const url = 'https://api.open-meteo.com/v1/forecast';
		const params = {
			latitude: lat,
			longitude: lon,
			current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,cloud_cover,visibility,dew_point_2m',
			hourly: 'temperature_2m,precipitation_probability,weather_code,visibility,relative_humidity_2m,wind_speed_10m,uv_index',
			daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max',
			timezone: 'auto'
		};

		const response = await axios.get(url, { params });
		const current = response.data.current;
		const daily = response.data.daily;
		const hourly = response.data.hourly;

		if (!current) return null;

		// Map daily data
		const dailyForecasts = daily.time.slice(0, 7).map((time: string, index: number) => ({
			date: time,
			temp_max: daily.temperature_2m_max[index],
			temp_min: daily.temperature_2m_min[index],
			precipitation_prob: daily.precipitation_probability_max[index],
			condition_code: String(daily.weather_code[index]),
			condition_text: `Code ${daily.weather_code[index]}`,
			uv_index_max: daily.uv_index_max?.[index] ?? null,
		}));

		// Map hourly data (from current time onwards)
		const now = new Date();
		const currentHourISO = now.toISOString().slice(0, 13) + ':00';

		let startIndex = hourly.time.findIndex((t: string) => t >= currentHourISO);
		if (startIndex === -1) startIndex = 0;

		// Map ALL remaining hourly data
		const hourlyForecasts = hourly.time.slice(startIndex).map((time: string, index: number) => {
			const realIndex = startIndex + index;
			return {
				time: time,
				temp: hourly.temperature_2m[realIndex],
				precipitation_prob: hourly.precipitation_probability[realIndex],
				condition_code: String(hourly.weather_code[realIndex]),
				condition_text: `Code ${hourly.weather_code[realIndex]}`,
				humidity: hourly.relative_humidity_2m?.[realIndex] ?? null,
				wind_speed: hourly.wind_speed_10m?.[realIndex] != null ? Number((hourly.wind_speed_10m[realIndex] / 3.6).toFixed(2)) : null, // km/h → m/s
				uv_index: hourly.uv_index?.[realIndex] ?? null,
			};
		});

		// Map Astronomy (Sunrise/Sunset for today)
		const astronomy = {
			sunrise: daily.sunrise[0],
			sunset: daily.sunset[0],
			moon_phase: getMoonPhase(new Date())
		};

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
			wind_gust: current.wind_gusts_10m != null ? current.wind_gusts_10m / 3.6 : null,
			condition_text: `Code ${current.weather_code}`,
			condition_code: String(current.weather_code),
			precipitation_prob: daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : null,
			precipitation_intensity: current.precipitation,
			pressure: current.pressure_msl,
			uv_index: current.uv_index ?? null,
			cloud_cover: current.cloud_cover ?? null,
			visibility: current.visibility != null ? current.visibility / 1000 : null, // Open-Meteo returns meters, convert to km
			dew_point: current.dew_point_2m ?? null,
			daily: dailyForecasts,
			hourly: hourlyForecasts,
			astronomy: astronomy
		});

	} catch (error: any) {
		console.error('Error fetching Open-Meteo:', error.message);
		return null;
	}
}
