export interface ForecastCurrent {
	temperature: number | null;
	feels_like: number | null;
	humidity: number | null;
	wind_speed: number | null;
	wind_direction: number | null;
	wind_direction_label: string | null;
	wind_gust: number | null;
	precipitation_prob: number;
	precipitation_intensity: number | null; // mm/h che stanno cadendo adesso
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
	precipitation_mm?: number | null; // mm totali del giorno
}

export interface HourlyForecast {
	time: string;
	temp: number;
	precipitation_prob: number | null;
	condition_code: string;
	condition_text: string | null;
	feels_like?: number | null;       // °C percepiti
	humidity?: number | null;
	wind_speed?: number | null;       // m/s
	wind_direction?: number | null;   // gradi, 0 = da nord
	wind_gust?: number | null;        // m/s
	uv_index?: number | null;
	precipitation_mm?: number | null; // mm accumulati nell'ora
	/**
	 * Banda di incertezza della temperatura: percentili 10 e 90 fra i membri
	 * dell'ensemble. Presenti solo dove il modello copre l'orizzonte, quindi
	 * vanno sempre trattati come opzionali.
	 */
	temp_p10?: number | null;
	temp_p90?: number | null;
}

export interface AstronomyData {
	sunrise: string;
	sunset: string;
	moon_phase: string;
	moonrise?: string;
	moonset?: string;
	moon_illumination?: number; // percentuale di disco illuminato
}

/**
 * Previsione precipitazione minuto per minuto per la prossima ora.
 * Fonte: Apple WeatherKit (`forecastNextHour`), quindi presente solo dove Apple
 * copre il nowcast — Italia inclusa. I timestamp sono istanti UTC.
 */
export interface MinutelyPrecipitation {
	startTime: string;
	precipitationChance: number;    // 0-100
	precipitationIntensity: number; // mm/h
}

export interface ForecastNextHour {
	summary: { condition: string; startTime: string; endTime: string }[];
	minutes: MinutelyPrecipitation[];
}

/** Dispersione di una grandezza fra le fonti che hanno risposto. */
export interface ConsensusSpread {
	spread: number; // deviazione standard pesata
	min: number;
	max: number;
}

/**
 * Quanto le fonti sono d'accordo: 100 = unanimi e numerose, 50 = nessuna
 * informazione utile (poche fonti o dispersione massima).
 */
export interface ConfidenceIndex {
	score: number;
	level: 'high' | 'medium' | 'low';
	sources_count: number;
	temperature: ConsensusSpread | null;
	precipitation_prob: ConsensusSpread | null;
}

export interface WeatherAlert {
	id: string;
	areaId?: string;
	areaName?: string;
	certainty: string;
	countryCode?: string;
	description: string;
	effectiveTime: string;
	expireTime: string;
	issuedTime?: string;
	eventSource?: string;
	severity: 'minor' | 'moderate' | 'severe' | 'extreme' | string;
	source?: string;
	urgency?: string;
	detailsUrl?: string;
	providerSource?: string;
	event?: string;
	headline?: string;
}

export interface ForecastResponse {
	location: {
		lat: number;
		lon: number;
	};
	generated_at: string;
	sources_used: string[];
	current: ForecastCurrent;
	confidence?: ConfidenceIndex | null;
	daily?: DailyForecast[];
	hourly?: HourlyForecast[];
	astronomy?: AstronomyData;
	forecastNextHour?: ForecastNextHour;
	alerts?: WeatherAlert[];
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
