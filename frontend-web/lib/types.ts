export interface ForecastCurrent {
	temperature: number | null;
	feels_like: number | null;
	humidity: number | null;
	wind_speed: number | null;
	precipitation_prob: number;
	condition: string;
	condition_text: string;
}

export interface DailyForecast {
	date: string;
	temp_max: number | null;
	temp_min: number | null;
	precipitation_prob: number | null;
	condition_code: string;
	condition_text: string | null;
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
