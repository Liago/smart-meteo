import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

const TOMORROW_API_URL = 'https://api.tomorrow.io/v4/weather/realtime';

interface TomorrowValues {
	temperature: number;
	temperatureApparent: number;
	humidity: number;
	windSpeed: number;
	windDirection: number;
	weatherCode: number;
	precipitationProbability: number;
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

	try {
		const response = await axios.get<TomorrowResponse>(TOMORROW_API_URL, {
			params: {
				location: `${lat},${lon}`,
				apikey: apiKey,
				units: 'metric'
			}
		});

		const data = response.data.data;
		const values = data.values;

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
			condition_text: 'Code: ' + values.weatherCode,
			precipitation_prob: values.precipitationProbability
		});

	} catch (error: any) {
		console.error('Error fetching Tomorrow.io:', error.message);
		return null;
	}
}
