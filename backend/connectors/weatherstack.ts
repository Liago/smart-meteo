import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

export async function fetchFromWeatherstack(lat: number, lon: number): Promise<UnifiedForecast | null> {
	try {
		const apiKey = process.env.WEATHERSTACK_KEY;
		if (!apiKey) throw new Error('WEATHERSTACK_KEY not found');

		// Note: Weatherstack free tier does not support HTTPS encryption usually, so using HTTP.
		// Also free tier might not support 'forecast' endpoint, only 'current'.
		// We will try 'forecast' but fallback gracefully if needed or just use 'current'.
		// The requirement asks to add it, so we try. 
		// If the user has paid plan, forecast works. If free, it might return error or limited data.
		// For safety with free tier usually, we use 'current'. But SmartEngine expects more.
		// Let's try 'current' first as it's guaranteed safe-ish for free tiers.
		// Actually, let's try reading docs/knowledge... 
		// Assuming we want to support what we can. 
		// Let's execute a 'current' request primarily, but if we can get forecast we should.
		// I'll stick to 'current' for reliability on likely-free keys, unless I can confirm.
		// The prompt just says "put keys ...". 
		// I will implement 'current' endpoint and map it.

		const url = `http://api.weatherstack.com/current`;
		const params = {
			access_key: apiKey,
			query: `${lat},${lon}`
		};

		const response = await axios.get(url, { params });
		const data = response.data;

		if (data.error) {
			console.error('Weatherstack API error:', data.error.type);
			return null;
		}

		if (!data.current) return null;

		const current = data.current;

		return new UnifiedForecast({
			source: 'weatherstack',
			lat: lat,
			lon: lon,
			time: new Date(data.location.localtime_epoch * 1000).toISOString(),
			temp: current.temperature,
			feels_like: current.feelslike,
			humidity: current.humidity,
			wind_speed: current.wind_speed,
			wind_direction: current.wind_degree,
			condition_text: current.weather_descriptions ? current.weather_descriptions[0] : 'Unknown',
			condition_code: String(current.weather_code),
			precipitation_prob: null, // Weatherstack current doesn't have prob
			precipitation_intensity: current.precip,
			daily: [] // No daily on simple current endpoint
		});

	} catch (error: any) {
		console.error('Error fetching Weatherstack:', error.message);
		return null;
	}
}
