export interface ForecastCurrent {
	temperature: number | null;
	feels_like: number | null;
	humidity: number | null;
	wind_speed: number | null;
	wind_direction: number | null;
	wind_direction_label: string | null;
	wind_gust: number | null;
	precipitation_prob: number;
	dew_point: number | null;
	aqi: number | null;
	pressure: number | null;
	condition: string;
	condition_text: string;
	uv_index: number | null;
	visibility: number | null;
	cloud_cover: number | null;
	air_quality: AirQualityDetail | null;
}

export interface AirQualityDetail {
	aqi_us_epa: number | null;
	pm2_5: number | null;
	pm10: number | null;
	no2: number | null;
	o3: number | null;
	co: number | null;
	so2: number | null;
}

export interface DailyForecast {
	date: string;
	temp_max: number | null;
	temp_min: number | null;
	precipitation_prob: number | null;
	condition_code: string;
	condition_text: string | null;
	uv_index_max?: number | null;
}

export interface HourlyForecast {
	time: string;
	temp: number;
	precipitation_prob: number | null;
	condition_code: string;
	condition_text: string | null;
}

export interface AstronomyData {
	sunrise: string;
	sunset: string;
	moon_phase: string;
}

export interface ForecastResponse {
	location: {
		lat: number;
		lon: number;
	};
	generated_at: string;
	sources_used: string[];
	current: ForecastCurrent;
	daily?: DailyForecast[];
	hourly?: HourlyForecast[];
	astronomy?: AstronomyData;
}

export interface WeatherSource {
	id: string;
	name: string;
	weight: number;
	active: boolean;
	description: string;
	lastError: string | null;
	lastResponseMs: number | null;
}

export interface SourcesResponse {
	sources: WeatherSource[];
}

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog' | 'unknown';
