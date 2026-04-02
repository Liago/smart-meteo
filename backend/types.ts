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
	humidity?: number | null;
	wind_speed?: number | null;      // m/s
	uv_index?: number | null;
}

/**
 * Previsione precipitazione minuto per minuto (prossima ora).
 * Fonte: Apple WeatherKit forecastNextHour dataset.
 */
export interface MinutelyPrecipitation {
	startTime: string;              // ISO8601
	precipitationChance: number;    // 0-100
	precipitationIntensity: number; // mm/h
}

export interface ForecastNextHour {
	summary: { condition: string; startTime: string; endTime: string }[];
	minutes: MinutelyPrecipitation[];
}

export interface AstronomyData {
	sunrise: string;
	sunset: string;
	moon_phase: string;
	moonrise?: string;
	moonset?: string;
	moon_illumination?: number;
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
	wind_gust: number | null;
	condition_text: string | null;
	condition_code: string;
	precipitation_prob: number | null;
	precipitation_intensity?: number | null;
	aqi: number | null;
	pressure: number | null;
	dew_point?: number | null;
	uv_index?: number | null;
	visibility?: number | null;        // km
	cloud_cover?: number | null;       // %
	air_quality?: AirQualityDetail;
	raw_data?: any;
	daily?: DailyForecast[];
	hourly?: HourlyForecast[];
	astronomy?: AstronomyData;
	forecastNextHour?: ForecastNextHour;
}

export interface WeatherAlert {
	id: string;
	areaId?: string;
	areaName?: string;
	certainty: 'observed' | 'likely' | 'possible' | 'unlikely' | string;
	countryCode?: string;
	description: string;
	effectiveTime: string;
	expireTime: string;
	issuedTime?: string;
	eventSource?: string;
	severity: 'minor' | 'moderate' | 'severe' | 'extreme' | string;
	source?: string;
	urgency?: 'immediate' | 'expected' | 'future' | string;
	detailsUrl?: string;
	/** Fonte provider dell'allerta (es. 'weatherkit', 'weatherapi', 'openweathermap') */
	providerSource?: string;
	/** Tipo di evento meteorologico (es. "Wind", "Thunderstorm", "Flood") */
	event?: string;
	/** Titolo breve dell'allerta */
	headline?: string;
}

export interface WeatherConditionWeights {
	[key: string]: number;
}
