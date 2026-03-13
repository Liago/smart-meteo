import axios from 'axios';
import { UnifiedForecast, normalizeCondition } from '../utils/formatter';
import { DailyForecast, HourlyForecast, AstronomyData } from '../types';

const WEATHERAPI_URL = 'http://api.weatherapi.com/v1/forecast.json';

/**
 * Convert WeatherAPI time format "06:30 AM" to ISO-ish "HH:MM"
 */
function convertTo24h(timeStr: string): string {
	if (!timeStr) return '';
	const parts = timeStr.trim().split(' ');
	if (parts.length < 2) return timeStr;

	const [time, period] = parts;
	if (!time) return timeStr;
	const timeParts = time.split(':');

	let h = Number(timeParts[0]);
	const m = timeParts[1];

	if (period === 'PM' && h !== 12) h += 12;
	if (period === 'AM' && h === 12) h = 0;

	return `${String(h).padStart(2, '0')}:${m}`;
}

export async function fetchFromWeatherAPI(lat: number, lon: number): Promise<UnifiedForecast | null> {
	const apiKey = process.env.WEATHERAPI_KEY;
	if (!apiKey) {
		console.error('Missing WEATHERAPI_KEY');
		return null;
	}

	try {
		// Use forecast.json instead of current.json — includes current + forecast + astronomy
		const response = await axios.get(WEATHERAPI_URL, {
			params: {
				key: apiKey,
				q: `${lat},${lon}`,
				days: 7,
				aqi: 'yes',
				alerts: 'no'
			}
		});

		const data = response.data;
		const current = data.current;

		const aqiData = current.air_quality;
		const aqiIndex = aqiData ? (aqiData['us-epa-index'] ?? null) : null;

		// Map daily forecasts
		const daily: DailyForecast[] = data.forecast?.forecastday?.map((day: any) => ({
			date: day.date,
			temp_max: day.day.maxtemp_c,
			temp_min: day.day.mintemp_c,
			precipitation_prob: day.day.daily_chance_of_rain,
			condition_code: normalizeCondition(day.day.condition.text),
			condition_text: day.day.condition.text,
		})) ?? [];

		// Map hourly forecasts from ALL forecast days
		let hourly: HourlyForecast[] = [];
		if (data.forecast?.forecastday) {
			data.forecast.forecastday.forEach((day: any) => {
				if (day.hour) {
					const dayHourly = day.hour.map((h: any) => ({
						time: h.time,
						temp: h.temp_c,
						precipitation_prob: h.chance_of_rain,
						condition_code: normalizeCondition(h.condition.text),
						condition_text: h.condition.text,
					}));
					hourly.push(...dayHourly);
				}
			});
		}

		// Map astronomy
		let astronomy: AstronomyData | undefined;
		const astro = data.forecast?.forecastday?.[0]?.astro;
		if (astro) {
			const dateStr = data.forecast.forecastday[0].date;
			const moonriseTime = astro.moonrise ? convertTo24h(astro.moonrise) : null;
			const moonsetTime = astro.moonset ? convertTo24h(astro.moonset) : null;
			astronomy = {
				sunrise: `${dateStr}T${convertTo24h(astro.sunrise)}:00`,
				sunset: `${dateStr}T${convertTo24h(astro.sunset)}:00`,
				moon_phase: astro.moon_phase ?? 'unknown',
				...(moonriseTime ? { moonrise: `${dateStr}T${moonriseTime}:00` } : {}),
				...(moonsetTime ? { moonset: `${dateStr}T${moonsetTime}:00` } : {}),
				...(astro.moon_illumination != null ? { moon_illumination: Number(astro.moon_illumination) } : {}),
			};
		}

		// Extract detailed AQI
		const airQuality = aqiData ? {
			aqi_us_epa: aqiData['us-epa-index'] ?? null,
			pm2_5: aqiData.pm2_5 ?? null,
			pm10: aqiData.pm10 ?? null,
			no2: aqiData.no2 ?? null,
			o3: aqiData.o3 ?? null,
			co: aqiData.co ?? null,
			so2: aqiData.so2 ?? null,
		} : undefined;

		const forecastPayload: any = {
			source: 'weatherapi',
			lat: lat,
			lon: lon,
			time: data.location.localtime,
			temp: current.temp_c,
			feels_like: current.feelslike_c,
			humidity: current.humidity,
			wind_speed: current.wind_kph / 3.6,
			wind_direction: current.wind_degree,
			wind_gust: current.gust_kph ? current.gust_kph / 3.6 : null,
			condition_text: current.condition.text,
			precipitation_prob: null,
			pressure: current.pressure_mb ?? null,
			aqi: aqiIndex,
			uv_index: current.uv ?? null,
			visibility: current.vis_km ?? null,
			cloud_cover: current.cloud ?? null,
			dew_point: current.dewpoint_c ?? null,
			air_quality: airQuality,
			daily: daily,
			hourly: hourly,
		};

		if (astronomy) {
			forecastPayload.astronomy = astronomy;
		}

		return new UnifiedForecast(forecastPayload);

	} catch (error: any) {
		console.error('Error fetching WeatherAPI:', error.message);
		return null;
	}
}
