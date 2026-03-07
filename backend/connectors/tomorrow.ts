import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

const TOMORROW_API_URL = 'https://api.tomorrow.io/v4/weather/realtime';

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
			wind_gust: values.windGust ?? null,
			condition_text: tomorrowCodeToText(values.weatherCode),
			condition_code: tomorrowCodeToText(values.weatherCode),
			precipitation_prob: values.precipitationProbability,
			pressure: values.pressureSurfaceLevel ?? null
		});

	} catch (error: any) {
		console.error('Error fetching Tomorrow.io:', error.message);
		return null;
	}
}
