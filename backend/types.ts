export interface UnifiedForecastData {
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
}

export interface WeatherConditionWeights {
	[key: string]: number;
}
