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
	feels_like?: number | null;      // °C percepiti
	humidity?: number | null;
	wind_speed?: number | null;      // m/s
	wind_direction?: number | null;  // gradi, 0 = da nord
	wind_gust?: number | null;       // m/s
	uv_index?: number | null;
	precipitation_mm?: number | null; // mm accumulati nell'ora
	/**
	 * Banda di incertezza della temperatura dai membri dell'ensemble
	 * (percentili 10 e 90). Presente solo dove il modello di ensemble copre
	 * l'orizzonte: si assottiglia verso le ore vicine e si allarga in avanti.
	 */
	temp_p10?: number | null;
	temp_p90?: number | null;
	/** Neve fresca dell'ora, in cm (non equivalente in acqua). */
	snowfall_cm?: number | null;
	/** Manto nevoso al suolo, in cm. */
	snow_depth_cm?: number | null;
	/** Quota dello zero termico, in metri. */
	freezing_level?: number | null;
	/** Temperatura della superficie del suolo, °C: è lì che si forma la brina. */
	soil_temperature?: number | null;
	/** Temperatura dello strato 0-7 cm, °C: è lì che germinano i semi. */
	soil_temperature_root?: number | null;
	/** Contenuto d'acqua volumetrico dello strato 0-7 cm, m³/m³. */
	soil_moisture?: number | null;
	/** Evapotraspirazione di riferimento FAO dell'ora, mm. */
	evapotranspiration?: number | null;
	/** Deficit di pressione di vapore, kPa: quanta "sete" ha l'aria. */
	vapour_pressure_deficit?: number | null;
	/** Energia potenziale convettiva disponibile, J/kg. */
	cape?: number | null;
	/** Lifted index, °C: negativo = instabile. */
	lifted_index?: number | null;
	/** Inibizione convettiva, J/kg: il coperchio sull'energia disponibile. */
	convective_inhibition?: number | null;
	/** Indice 0-100 di rischio temporali, derivato dai tre qui sopra. */
	storm_index?: number | null;
	/** Probabilità di tuono in %, da WorldWeatherOnline. */
	thunder_prob?: number | null;
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
	/**
	 * Indice europeo (0-100+), da Open-Meteo Air Quality. Scala diversa da
	 * quella EPA 1-6: le due convivono perché dicono cose diverse e i lettori
	 * italiani riconoscono la seconda.
	 */
	european_aqi?: number | null;
}

/** Livello pollinico, secondo le soglie della specie. */
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
	/**
	 * Offset del fuso orario locale rispetto a UTC, in secondi.
	 * Serve allo Smart Engine per allineare gli slot orari delle fonti che
	 * restituiscono timestamp UTC (tomorrow.io, weatherkit) con quelle che
	 * restituiscono l'ora locale (open-meteo, weatherapi, wwo).
	 */
	utc_offset_seconds?: number | null;
	/**
	 * Quota del punto di griglia in metri, quando la fonte la dichiara
	 * (Open-Meteo). Serve a confrontare la quota neve con quella della località.
	 */
	elevation?: number | null;
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
