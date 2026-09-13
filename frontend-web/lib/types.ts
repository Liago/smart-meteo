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
	/**
	 * Indice europeo (0-100+), da Open-Meteo. Scala diversa da quella EPA 1-6:
	 * convivono perché dicono cose diverse.
	 */
	european_aqi?: number | null;
}

/** Livello pollinico, secondo le soglie della singola specie. */
export type PollenLevel = 'none' | 'low' | 'moderate' | 'high' | 'very_high';

export interface PollenReading {
	species: string;
	label: string;
	/** Granuli/m³ nell'ora corrente. */
	value: number | null;
	/** Massimo previsto in giornata. */
	daily_max: number | null;
	level: PollenLevel;
	daily_level: PollenLevel;
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
	snowfall_cm?: number | null;      // cm di neve fresca del giorno
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
	/** Neve fresca dell'ora, in cm (non equivalente in acqua). */
	snowfall_cm?: number | null;
	/** Manto nevoso al suolo, in cm. */
	snow_depth_cm?: number | null;
	/** Quota dello zero termico, in metri. */
	freezing_level?: number | null;
	/** Temperatura della superficie del suolo, °C. */
	soil_temperature?: number | null;
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

/** Fase della precipitazione alla quota della località. */
export type SnowPhase = 'snow' | 'sleet' | 'rain';

/** Rischio gelate nelle prossime 24 ore. */
export type FrostLevel = 'none' | 'possible' | 'likely' | 'severe';

/**
 * Da dove viene la minima su cui è giudicato il rischio.
 *
 * Cambia il significato della frase: "minima 1°" e "minima al suolo 1°"
 * descrivono due notti diverse, e il backend usa soglie diverse per le due.
 */
export type FrostSource = 'soil' | 'air';

export interface FrostOutlook {
	level: FrostLevel;
	/** Temperatura minima prevista nella finestra, °C. */
	min_temp: number | null;
	/** Slot orario del minimo, nella stessa chiave locale degli hourly. */
	at: string | null;
	source: FrostSource;
}

/**
 * Neve e gelate nelle prossime 24 ore.
 *
 * Il backend lo omette quando non c'è niente da dire — niente manto, niente
 * neve prevista, nessun rischio di gelata e pioggia normale — quindi la sua
 * sola presenza è già il segnale che il pannello va mostrato.
 */
export interface SnowOutlook {
	/** Quota della località secondo i modelli, in metri. */
	elevation: number | null;
	/** Quota neve più bassa prevista nella finestra, in metri. */
	snow_line: number | null;
	/** Fase attesa alla quota della località; null se non è prevista precipitazione. */
	phase: SnowPhase | null;
	/** Manto nevoso presente adesso, in cm. */
	snow_depth_cm: number | null;
	/** Neve fresca attesa nella finestra, in cm. */
	snowfall_cm: number | null;
	frost: FrostOutlook;
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
	/** Pollini: presenti solo dove il modello CAMS copre, cioè in Europa. */
	pollen?: PollenReading[];
	/** Neve e gelate: presente solo quando c'è qualcosa da segnalare. */
	snow?: SnowOutlook;
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
