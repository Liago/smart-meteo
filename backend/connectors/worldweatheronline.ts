import axios from 'axios';
import { UnifiedForecast } from '../utils/formatter';

export async function fetchFromWWO(lat: number, lon: number): Promise<UnifiedForecast | null> {
	try {
		const apiKey = process.env.WORLDWEATHER_KEY;
		if (!apiKey) throw new Error('WORLDWEATHER_KEY not found');

		const url = `http://api.worldweatheronline.com/premium/v1/weather.ashx`;
		const params = {
			key: apiKey,
			q: `${lat},${lon}`,
			format: 'json',
			num_of_days: 7,
			fx: 'yes',
			cc: 'yes',
			mca: 'no',
			tp: 1
		};

		const response = await axios.get(url, { params });
		const data = response.data.data;

		if (!data || !data.current_condition || data.current_condition.length === 0) return null;

		const current = data.current_condition[0];
		const weatherDesc = current.weatherDesc && current.weatherDesc[0] ? current.weatherDesc[0].value : 'Unknown';

		// Map Daily
		const daily = data.weather ? data.weather.map((d: any) => ({
			date: d.date,
			temp_max: Number(d.maxtempC),
			temp_min: Number(d.mintempC),
			precipitation_prob: null, // WWO doesn't give simple probability in this endpoint easily without logic
			condition_code: 'unknown', // WWO uses proprietary codes, mapping is complex. We stick to text.
			condition_text: d.hourly && d.hourly[0] && d.hourly[0].weatherDesc ? d.hourly[0].weatherDesc[0].value : ''
		})) : [];

		// Map Hourly (from the first day, if available)
		let hourly = [];
		if (data.weather && data.weather[0] && data.weather[0].hourly) {
			// WWO hourly is in 'time' string '0', '100', '200' etc.
			// We need to construct full ISO string.
			const dateStr = data.weather[0].date; // YYYY-MM-DD
			hourly = data.weather[0].hourly.map((h: any) => {
				const timeStr = (h.time || '0').padStart(4, '0'); // '200' -> '0200'
				const hours = timeStr.slice(0, 2);
				const minutes = timeStr.slice(2);
				const isoTime = `${dateStr}T${hours}:${minutes}:00`;

				return {
					time: isoTime,
					temp: Number(h.tempC),
					precipitation_prob: Number(h.chanceofrain),
					condition_code: h.weatherCode,
					condition_text: h.weatherDesc && h.weatherDesc[0] ? h.weatherDesc[0].value : ''
				};
			});
		}

		// Map Astronomy
		let astronomy: { sunrise: string; sunset: string } | undefined = undefined;
		const astro = data.weather[0].astronomy[0];
		const toISO = (timeStr: string) => {
			if (!timeStr) return '';
			const parts = timeStr.split(' ');
			if (parts.length < 2) return ''; // Unexpected format

			const time = parts[0];
			const period = parts[1];
			const timeParts = time.split(':');
			if (timeParts.length < 2) return '';

			let h = Number(timeParts[0]);
			const m = Number(timeParts[1]);

			if (period === 'PM' && h !== 12) h += 12;
			if (period === 'AM' && h === 12) h = 0;
			return `${data.weather[0].date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
		};

		const sunrise = toISO(astro.sunrise);
		const sunset = toISO(astro.sunset);

		if (sunrise && sunset) {
			astronomy = { sunrise, sunset };
		}

		// Prepare data object to avoid undefined issue with exactOptionalPropertyTypes
		const forecastData: any = {
			source: 'worldweatheronline',
			lat: lat,
			lon: lon,
			time: new Date().toISOString(),
			temp: Number(current.temp_C),
			feels_like: Number(current.FeelsLikeC),
			humidity: Number(current.humidity),
			wind_speed: Number(current.windspeedKmph),
			wind_direction: Number(current.winddirDegree),
			condition_text: weatherDesc,
			condition_code: String(current.weatherCode),
			precipitation_prob: null,
			precipitation_intensity: Number(current.precipMM),
			daily: daily,
			hourly: hourly
		};

		if (astronomy) {
			forecastData.astronomy = astronomy;
		}

		return new UnifiedForecast(forecastData);

	} catch (error: any) {
		console.error('Error fetching WorldWeatherOnline:', error.message);
		return null;
	}
}
