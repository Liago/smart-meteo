import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

export async function fetchFromOpenMeteo(lat: number, lon: number): Promise<UnifiedForecast | null> {
	try {
		const url = 'https://api.open-meteo.com/v1/forecast';
		const params = {
			latitude: lat,
			longitude: lon,
			current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m',
			hourly: 'temperature_2m,precipitation_probability,weather_code',
			daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
			timezone: 'auto'
		};

		const response = await axios.get(url, { params });
		const current = response.data.current;
		const daily = response.data.daily;
		const hourly = response.data.hourly;

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

		// Map hourly data (next 12 hours from current time)
		// OpenMeteo hourly returns all 24h for 7 days typically, need to find current hour index
		// But simpler: just map the first 24 and let frontend filter or filter here
		// Let's filter here for efficiency. We need to find the index corresponding to "now"
		// The API takes "current_weather=true" so it knows "now". 
		// Actually best to compare timestamps. OpenMeteo hourly.time is ISO string.
		const now = new Date();
		const currentHourISO = now.toISOString().slice(0, 13) + ':00'; // Match approx format YYYY-MM-DDTHH:00

		// Find start index. hourly.time array is sorted.
		let startIndex = hourly.time.findIndex((t: string) => t >= currentHourISO);
		if (startIndex === -1) startIndex = 0; // Fallback

		const hourlyForecasts = hourly.time.slice(startIndex, startIndex + 12).map((time: string, index: number) => {
			const realIndex = startIndex + index;
			return {
				time: time,
				temp: hourly.temperature_2m[realIndex],
				precipitation_prob: hourly.precipitation_probability[realIndex],
				condition_code: String(hourly.weather_code[realIndex]),
				condition_text: `Code ${hourly.weather_code[realIndex]}`
			};
		});

		// Map Astronomy (Sunrise/Sunset for today)
		// daily.sunrise is ISO string array
		const astronomy = {
			sunrise: daily.sunrise[0], // Today's sunrise
			sunset: daily.sunset[0]    // Today's sunset
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
			condition_text: `Code ${current.weather_code}`,
			condition_code: String(current.weather_code),
			precipitation_prob: null,
			precipitation_intensity: current.precipitation,
			daily: dailyForecasts,
			hourly: hourlyForecasts,
			astronomy: astronomy
		});

	} catch (error: any) {
		console.error('Error fetching Open-Meteo:', error.message);
		return null;
	}
}
