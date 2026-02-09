import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

const METEOMATICS_URL = 'https://api.meteomatics.com';

interface MeteomaticsResponse {
	status: string;
	data: {
		parameter: string;
		coordinates: {
			dates: {
				date: string;
				value: number;
			}[];
		}[];
	}[];
}

export async function fetchFromMeteomatics(lat: number, lon: number): Promise<UnifiedForecast | null> {
	const user = process.env.METEOMATICS_USER;
	const password = process.env.METEOMATICS_PASSWORD;

	if (!user || !password) {
		console.error('Missing METEOMATICS_USER or METEOMATICS_PASSWORD');
		return null;
	}

	try {
		const time = new Date().toISOString();
		const parameters = 't_2m:C,prob_precip_1h:p,wind_speed_10m:ms,wind_dir_10m:d,weather_symbol_1h:idx,relative_humidity_2m:p';
		const url = `${METEOMATICS_URL}/${time}/${parameters}/${lat},${lon}/json`;

		const response = await axios.get<MeteomaticsResponse>(url, {
			auth: {
				username: user,
				password: password
			}
		});

		const data = response.data;
		if (data.status !== 'OK') return null;

		const getValue = (paramName: string): number | null => {
			const param = data.data.find(p => p.parameter === paramName);
			return param?.coordinates?.[0]?.dates?.[0]?.value ?? null;
		};

		const temp = getValue('t_2m:C');
		const humidity = getValue('relative_humidity_2m:p');
		const windSpeed = getValue('wind_speed_10m:ms');
		const windDir = getValue('wind_dir_10m:d');
		const precipProb = getValue('prob_precip_1h:p');
		const weatherSymbol = getValue('weather_symbol_1h:idx');

		return new UnifiedForecast({
			source: 'meteomatics',
			lat: lat,
			lon: lon,
			time: time,
			temp: temp,
			feels_like: temp,
			humidity: humidity,
			wind_speed: windSpeed,
			wind_direction: windDir,
			condition_text: `Symbol_${weatherSymbol}`,
			precipitation_prob: precipProb
		});

	} catch (error: any) {
		console.error('Error fetching Meteomatics:', error.message);
		return null;
	}
}
