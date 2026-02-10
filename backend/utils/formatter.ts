import { UnifiedForecastData, DailyForecast, HourlyForecast, AstronomyData } from '../types';

/**
 * Standardizes the weather condition codes across different providers.
 * Returns one of: 'clear', 'cloudy', 'rain', 'snow', 'storm', 'fog', 'unknown'
 */
export function normalizeCondition(text: string | null | undefined): string {
	if (!text) return 'unknown';
	const t = text.toLowerCase();
	if (t.includes('clear') || t.includes('sunny')) return 'clear';
	if (t.includes('cloud') || t.includes('overcast')) return 'cloudy';
	if (t.includes('rain') || t.includes('drizzle') || t.includes('shower')) return 'rain';
	if (t.includes('snow') || t.includes('blizzard')) return 'snow';
	if (t.includes('thunder') || t.includes('storm')) return 'storm';
	if (t.includes('fog') || t.includes('mist')) return 'fog';
	return 'unknown';
}

/**
 * Standard Unified Forecast Object
 */
export class UnifiedForecast implements UnifiedForecastData {
	source: string;
	lat: number;
	lon: number;
	time: string;
	temp: number | null;
	feels_like: number | null;
	humidity: number | null;
	wind_speed: number | null;
	wind_direction: number | null;
	condition_text: string | null;
	condition_code: string;
	precipitation_prob: number | null;
	precipitation_intensity: number | null;
	raw_data?: any;
	daily?: DailyForecast[];
	hourly?: HourlyForecast[];
	astronomy?: AstronomyData;

	constructor(data: Partial<UnifiedForecastData> & { source: string; lat: number; lon: number; time: string }) {
		this.source = data.source;
		this.lat = data.lat;
		this.lon = data.lon;
		this.time = data.time;
		this.temp = typeof data.temp === 'number' ? Number(data.temp.toFixed(1)) : null;
		this.feels_like = typeof data.feels_like === 'number' ? Number(data.feels_like.toFixed(1)) : null;
		this.humidity = data.humidity ?? null;
		this.wind_speed = data.wind_speed ?? null;
		this.wind_direction = data.wind_direction ?? null;
		this.condition_text = data.condition_text ?? null;
		this.condition_code = normalizeCondition(data.condition_text);
		this.precipitation_prob = data.precipitation_prob ?? null;
		this.precipitation_intensity = data.precipitation_intensity ?? null;
		this.raw_data = data.raw_data;
		if (data.daily) {
			this.daily = data.daily;
		}
		if (data.hourly) {
			this.hourly = data.hourly;
		}
		if (data.astronomy) {
			this.astronomy = data.astronomy;
		}
	}
}
