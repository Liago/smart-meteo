import { UnifiedForecastData, DailyForecast, HourlyForecast, AstronomyData, AirQualityDetail } from '../types';

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
	wind_gust: number | null;
	condition_text: string | null;
	condition_code: string;
	precipitation_prob: number | null;
	precipitation_intensity: number | null;
	aqi: number | null;
	pressure: number | null;
	dew_point: number | null;
	uv_index: number | null;
	visibility: number | null;
	cloud_cover: number | null;
	air_quality?: AirQualityDetail;
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
		this.wind_gust = typeof data.wind_gust === 'number' ? Number(data.wind_gust.toFixed(1)) : null;
		this.condition_text = data.condition_text ?? null;
		this.condition_code = data.condition_code
			? data.condition_code
			: normalizeCondition(data.condition_text);
		this.precipitation_prob = data.precipitation_prob ?? null;
		this.precipitation_intensity = data.precipitation_intensity ?? null;
		this.aqi = data.aqi ?? null;
		this.pressure = data.pressure ?? null;
		this.dew_point = typeof data.dew_point === 'number' ? Number(data.dew_point.toFixed(1)) : null;
		this.uv_index = data.uv_index ?? null;
		this.visibility = data.visibility ?? null;
		this.cloud_cover = data.cloud_cover ?? null;
		this.raw_data = data.raw_data;
		if (data.air_quality) {
			this.air_quality = data.air_quality;
		}
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
