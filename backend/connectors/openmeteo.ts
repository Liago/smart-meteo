import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

export async function fetchFromOpenMeteo(lat: number, lon: number): Promise<UnifiedForecast | null> {
	try {
		const url = 'https://api.open-meteo.com/v1/forecast';
		const params = {
			latitude: lat,
			longitude: lon,
			current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl', // Added pressure_msl
			hourly: 'temperature_2m,precipitation_probability,weather_code',
			daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,moon_phase', // Added moon_phase
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
			condition_text: `Code ${daily.weather_code[index]}`
		}));

		// Map hourly data (from current time onwards)
		// OpenMeteo hourly returns all 24h for 7 days typically.
		// We map from the current hour to the end of the available data.
		const now = new Date();
		const currentHourISO = now.toISOString().slice(0, 13) + ':00'; // Match approx format YYYY-MM-DDTHH:00

		// Find start index. hourly.time array is sorted.
		let startIndex = hourly.time.findIndex((t: string) => t >= currentHourISO);
		if (startIndex === -1) startIndex = 0; // Fallback

		// Map ALL remaining hourly data
		const hourlyForecasts = hourly.time.slice(startIndex).map((time: string, index: number) => {
			const realIndex = startIndex + index;
			return {
				time: time,
				temp: hourly.temperature_2m[realIndex],
				precipitation_prob: hourly.precipitation_probability[realIndex],
				condition_code: String(hourly.weather_code[realIndex]),
				condition_text: `Code ${hourly.weather_code[realIndex]}`
			};
		});

		// Helper to map moon phase (0-1) to string
		const getMoonPhaseLabel = (phase: number): string => {
			if (phase === 0 || phase === 1) return 'Luna Nuova';
			if (phase < 0.25) return 'Luna Crescente';
			if (phase === 0.25) return 'Primo Quarto';
			if (phase < 0.5) return 'Gibbosa Crescente';
			if (phase === 0.5) return 'Luna Piena';
			if (phase < 0.75) return 'Gibbosa Calante';
			if (phase === 0.75) return 'Ultimo Quarto';
			return 'Luna Calante';
		};

		// Map Astronomy (Sunrise/Sunset for today)
		// daily.sunrise is ISO string array
		const moonPhaseValue = daily.moon_phase ? daily.moon_phase[0] : 0;
		const astronomy = {
			sunrise: daily.sunrise[0], // Today's sunrise
			sunset: daily.sunset[0],    // Today's sunset
			moon_phase: getMoonPhaseLabel(moonPhaseValue)
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
			precipitation_prob: null,
			precipitation_intensity: current.precipitation,
			pressure: current.pressure_msl, // Added pressure mapping
			daily: dailyForecasts,
			hourly: hourlyForecasts,
			astronomy: astronomy
		});

	} catch (error: any) {
		console.error('Error fetching Open-Meteo:', error.message);
		return null;
	}
}
