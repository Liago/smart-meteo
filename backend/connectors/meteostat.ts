import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

export async function fetchFromMeteostat(lat: number, lon: number): Promise<UnifiedForecast | null> {
	try {
		const apiKey = process.env.METEOSTAT_KEY;
		if (!apiKey) throw new Error('METEOSTAT_KEY not found');

		// Meteostat via RapidAPI
		// We use 'point/hourly' to get the latest data for today.
		// Start date: today, End date: today
		const now = new Date();
		const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

		const url = `https://meteostat.p.rapidapi.com/point/hourly`;
		const params = {
			lat: lat,
			lon: lon,
			start: dateStr,
			end: dateStr,
			tz: 'UTC'
		};

		const headers = {
			'x-rapidapi-host': 'meteostat.p.rapidapi.com',
			'x-rapidapi-key': apiKey
		};

		const response = await axios.get(url, { params, headers });
		const data = response.data.data; // Array of hourly objects

		if (!data || data.length === 0) {
			// If no data for today (yet), maybe try yesterday? 
			// Meteostat is historical, data might be delayed.
			// For now, return null if no data found.
			return null;
		}

		// Get the last available record (most recent)
		const latest = data[data.length - 1];

		// Meteostat response keys: time, temp, dwpt, rhum, prcp, snow, wdir, wspd, wpgt, pres, tsun, coco
		// coco is condition code

		return new UnifiedForecast({
			source: 'meteostat',
			lat: lat,
			lon: lon,
			time: latest.time, // "2023-10-27 10:00:00"
			temp: latest.temp,
			feels_like: null, // Not provided
			humidity: latest.rhum,
			wind_speed: latest.wspd,
			wind_direction: latest.wdir,
			wind_gust: latest.wpgt ?? null,
			condition_text: `Code ${latest.coco}`, // Meteostat condition codes
			condition_code: String(latest.coco),
			precipitation_prob: null,
			precipitation_intensity: latest.prcp,
			daily: [],
			hourly: [] // Could map this, but it's historical "forecast" so maybe confusing? Let's leave empty for now.
		});

	} catch (error: any) {
		console.error('Error fetching Meteostat:', error.message);
		return null;
	}
}
