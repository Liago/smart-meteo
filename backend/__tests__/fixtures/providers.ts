/**
 * Risposte di esempio dei nove provider.
 *
 * Sono costruttori e non file JSON statici: ogni test parte dalla forma
 * completa e sovrascrive il campo che gli interessa, così una fixture non va
 * duplicata per cambiare un valore.
 *
 * I valori sono nelle **unità native di ciascuna API** — è il punto del
 * mestiere: km/h per Open-Meteo, AccuWeather, WWO, WeatherKit e Meteostat,
 * m/s per Tomorrow.io e OpenWeatherMap con `units=metric`.
 */

/** 36 km/h = 10 m/s esatti: rende evidente ogni conversione mancata. */
export const WIND_KMH = 36;
export const WIND_MS = 10;

/** Raffica: 72 km/h = 20 m/s. */
export const GUST_KMH = 72;
export const GUST_MS = 20;

type Overrides = Record<string, any>;

const merge = (base: any, overrides?: Overrides) => ({ ...base, ...(overrides ?? {}) });

// ---------------------------------------------------------------- Open-Meteo

export function openMeteoResponse(overrides?: { current?: Overrides }) {
	return {
		utc_offset_seconds: 7200,
		current: merge(
			{
				time: '2026-09-12T14:00',
				temperature_2m: 24.3,
				relative_humidity_2m: 55,
				apparent_temperature: 25.1,
				precipitation: 0,
				weather_code: 3,
				wind_speed_10m: WIND_KMH, // km/h: unità di default dell'API
				wind_direction_10m: 180,
				wind_gusts_10m: GUST_KMH,
				pressure_msl: 1013,
				uv_index: 5.2,
				cloud_cover: 75,
				visibility: 24140, // metri
				dew_point_2m: 14.4,
			},
			overrides?.current
		),
		daily: {
			time: ['2026-09-12', '2026-09-13'],
			weather_code: [3, 61],
			temperature_2m_max: [28, 24],
			temperature_2m_min: [17, 15],
			precipitation_probability_max: [20, 80],
			precipitation_sum: [0, 12.4],
			sunrise: ['2026-09-12T06:52', '2026-09-13T06:53'],
			sunset: ['2026-09-12T19:44', '2026-09-13T19:42'],
			uv_index_max: [6, 4],
		},
		hourly: {
			time: ['2026-09-12T14:00', '2026-09-12T15:00'],
			temperature_2m: [24.3, 25],
			apparent_temperature: [25.1, 25.8],
			precipitation_probability: [10, 15],
			precipitation: [0, 0.2],
			weather_code: [3, 61],
			visibility: [24140, 20000],
			relative_humidity_2m: [55, 53],
			wind_speed_10m: [WIND_KMH, WIND_KMH],
			wind_direction_10m: [180, 190],
			wind_gusts_10m: [GUST_KMH, GUST_KMH],
			uv_index: [5.2, 4.8],
		},
	};
}

// --------------------------------------------------------------- Tomorrow.io

export function tomorrowRealtimeResponse(overrides?: Overrides) {
	return {
		data: {
			time: '2026-09-12T14:00:00Z',
			values: merge(
				{
					temperature: 24.1,
					temperatureApparent: 25,
					humidity: 56,
					windSpeed: WIND_MS, // m/s con units=metric
					windDirection: 175,
					windGust: GUST_MS,
					pressureSurfaceLevel: 1012,
					weatherCode: 1001, // Cloudy
					precipitationProbability: 15,
					uvIndex: 5,
					visibility: 24,
					cloudCover: 80,
					dewPoint: 14.2,
				},
				overrides
			),
		},
	};
}

export function tomorrowForecastResponse() {
	return {
		timelines: {
			daily: [
				{
					time: '2026-09-12T00:00:00Z',
					values: {
						temperatureMax: 28,
						temperatureMin: 17,
						precipitationProbabilityMax: 20,
						weatherCodeMax: 1001,
						uvIndexMax: 6,
						rainAccumulationSum: 0,
					},
				},
			],
			hourly: [
				{
					time: '2026-09-12T14:00:00Z',
					values: {
						temperature: 24.1,
						temperatureApparent: 25,
						precipitationProbability: 15,
						weatherCode: 1001,
						humidity: 56,
						windSpeed: WIND_MS,
						windDirection: 175,
						windGust: GUST_MS,
						uvIndex: 5,
						rainAccumulation: 0,
					},
				},
			],
		},
	};
}

// ------------------------------------------------------------ OpenWeatherMap

export function owmCurrentResponse(overrides?: Overrides) {
	return merge(
		{
			dt: 1789221600,
			main: { temp: 24, feels_like: 24.8, humidity: 57, pressure: 1013 },
			wind: { speed: WIND_MS, deg: 180, gust: GUST_MS }, // m/s con units=metric
			weather: [{ id: 803, main: 'Clouds', description: 'nubi sparse' }],
			clouds: { all: 75 },
			visibility: 10000,
			sys: { sunrise: 1789195920, sunset: 1789241040 },
		},
		overrides
	);
}

export function owmForecastResponse() {
	return {
		list: [
			{
				dt: 1789225200,
				dt_txt: '2026-09-12 15:00:00',
				main: { temp: 25, temp_max: 25, temp_min: 24, humidity: 53 },
				weather: [{ id: 803, main: 'Clouds', description: 'nubi sparse' }],
				wind: { speed: WIND_MS, deg: 185, gust: GUST_MS },
				pop: 0.2,
				rain: { '3h': 0.6 },
			},
			{
				dt: 1789236000,
				dt_txt: '2026-09-12 18:00:00',
				main: { temp: 22, temp_max: 23, temp_min: 21, humidity: 60 },
				weather: [{ id: 500, main: 'Rain', description: 'pioggia leggera' }],
				wind: { speed: WIND_MS, deg: 190, gust: GUST_MS },
				pop: 0.8,
				rain: { '3h': 3.2 },
			},
		],
		city: { sunrise: 1789195920, sunset: 1789241040 },
	};
}

// --------------------------------------------------------------- WeatherAPI

export function weatherApiResponse(overrides?: { current?: Overrides }) {
	return {
		location: { name: 'Milano', region: 'Lombardia', country: 'Italy', localtime: '2026-09-12 16:00' },
		current: merge(
			{
				temp_c: 24.2,
				feelslike_c: 25.1,
				humidity: 55,
				wind_kph: WIND_KMH,
				wind_degree: 180,
				gust_kph: GUST_KMH,
				pressure_mb: 1013,
				condition: { text: 'Partly cloudy', code: 1003 },
				precip_mm: 0,
				cloud: 75,
				dewpoint_c: 14.3,
				vis_km: 10,
				uv: 5,
				air_quality: {
					'us-epa-index': 2,
					pm2_5: 12.3,
					pm10: 20.1,
					no2: 15,
					o3: 40,
					co: 200,
					so2: 5,
				},
			},
			overrides?.current
		),
		forecast: {
			forecastday: [
				{
					date: '2026-09-12',
					day: {
						maxtemp_c: 28,
						mintemp_c: 17,
						daily_chance_of_rain: 20,
						condition: { text: 'Partly cloudy' },
						totalprecip_mm: 0,
						uv: 6,
					},
					astro: {
						sunrise: '06:52 AM',
						sunset: '07:44 PM',
						moonrise: '09:12 PM',
						moonset: '11:03 AM',
						moon_phase: 'Waxing Gibbous',
						moon_illumination: '72',
					},
					hour: [
						{
							time: '2026-09-12 14:00',
							temp_c: 24.2,
							feelslike_c: 25.1,
							chance_of_rain: 10,
							condition: { text: 'Partly cloudy' },
							humidity: 55,
							wind_kph: WIND_KMH,
							wind_degree: 180,
							gust_kph: GUST_KMH,
							uv: 5,
							precip_mm: 0,
						},
					],
				},
			],
		},
		alerts: { alert: [] },
	};
}

// --------------------------------------------------------------- AccuWeather

export const ACCU_LOCATION_KEY = '215786';

export function accuLocationResponse() {
	return { Key: ACCU_LOCATION_KEY, LocalizedName: 'Milano' };
}

export function accuCurrentResponse(overrides?: Overrides) {
	return [
		merge(
			{
				LocalObservationDateTime: '2026-09-12T16:00:00+02:00',
				WeatherText: 'Partly cloudy',
				WeatherIcon: 4,
				IsDayTime: true,
				Temperature: { Metric: { Value: 24.4 } },
				RealFeelTemperature: { Metric: { Value: 25.6 } },
				RelativeHumidity: 54,
				DewPoint: { Metric: { Value: 14.5 } },
				Wind: { Direction: { Degrees: 180 }, Speed: { Metric: { Value: WIND_KMH } } },
				WindGust: { Speed: { Metric: { Value: GUST_KMH } } },
				UVIndex: 5,
				Visibility: { Metric: { Value: 24.1 } },
				CloudCover: 75,
				Pressure: { Metric: { Value: 1013 } },
			},
			overrides
		),
	];
}

export function accuDailyResponse() {
	return {
		DailyForecasts: [
			{
				Date: '2026-09-12T07:00:00+02:00',
				Temperature: { Maximum: { Value: 28 }, Minimum: { Value: 17 } },
				Day: { IconPhrase: 'Partly sunny', PrecipitationProbability: 20 },
				Sun: { Rise: '2026-09-12T06:52:00+02:00', Set: '2026-09-12T19:44:00+02:00' },
				Moon: { Phase: 'WaxingGibbous', Rise: '2026-09-12T21:12:00+02:00', Set: '2026-09-13T11:03:00+02:00' },
				AirAndPollen: [{ Name: 'UVIndex', Value: 6 }],
			},
		],
	};
}

export function accuHourlyResponse() {
	return [
		{
			DateTime: '2026-09-12T16:00:00+02:00',
			Temperature: { Value: 24.4 },
			RealFeelTemperature: { Value: 25.6 },
			PrecipitationProbability: 10,
			WeatherIcon: 4,
			IconPhrase: 'Partly sunny',
			RelativeHumidity: 54,
			Wind: { Speed: { Value: WIND_KMH }, Direction: { Degrees: 180 } },
			WindGust: { Speed: { Value: GUST_KMH } },
			UVIndex: 5,
		},
	];
}

// ---------------------------------------------------------------- WeatherKit

export function weatherKitResponse(overrides?: { currentWeather?: Overrides }) {
	return {
		currentWeather: merge(
			{
				asOf: '2026-09-12T14:00:00Z',
				temperature: 24.2,
				temperatureApparent: 25,
				humidity: 0.55, // frazione 0-1
				windSpeed: WIND_KMH, // km/h
				windDirection: 180,
				windGust: GUST_KMH,
				pressure: 1013,
				temperatureDewPoint: 14.3,
				uvIndex: 5,
				visibility: 24140, // metri
				cloudCover: 0.75, // frazione 0-1
				conditionCode: 'PartlyCloudy',
				precipitationChance: 0.15, // frazione 0-1
				precipitationIntensity: 0,
			},
			overrides?.currentWeather
		),
		forecastDaily: {
			days: [
				{
					forecastStart: '2026-09-12T00:00:00Z',
					temperatureMax: 28,
					temperatureMin: 17,
					precipitationChance: 0.2,
					conditionCode: 'PartlyCloudy',
					maxUvIndex: 6,
					precipitationAmount: 0,
					sunrise: '2026-09-12T04:52:00Z',
					sunset: '2026-09-12T17:44:00Z',
					moonPhase: 'waxingGibbous',
				},
			],
		},
		forecastHourly: {
			hours: [
				{
					forecastStart: '2026-09-12T14:00:00Z',
					temperature: 24.2,
					temperatureApparent: 25,
					precipitationChance: 0.1,
					conditionCode: 'PartlyCloudy',
					humidity: 0.55,
					windSpeed: WIND_KMH,
					windDirection: 180,
					windGust: GUST_KMH,
					uvIndex: 5,
					precipitationAmount: 0,
				},
			],
		},
	};
}

// ------------------------------------------------------- World Weather Online

export function wwoResponse(overrides?: Overrides) {
	return {
		data: {
			current_condition: [
				merge(
					{
						observation_time: '02:00 PM',
						temp_C: '24',
						FeelsLikeC: '25',
						humidity: '55',
						windspeedKmph: String(WIND_KMH),
						winddirDegree: '180',
						WindGustKmph: String(GUST_KMH),
						pressure: '1013',
						weatherCode: '116',
						weatherDesc: [{ value: 'Partly cloudy' }],
						precipMM: '0.0',
						visibility: '10',
						cloudcover: '75',
						uvIndex: '5',
					},
					overrides
				),
			],
			weather: [
				{
					date: '2026-09-12',
					maxtempC: '28',
					mintempC: '17',
					uvIndex: '6',
					astronomy: [
						{
							sunrise: '06:52 AM',
							sunset: '07:44 PM',
							moonrise: '09:12 PM',
							moonset: '11:03 AM',
							moon_phase: 'Waxing Gibbous',
							moon_illumination: '72',
						},
					],
					hourly: [
						{
							time: '1400',
							tempC: '24',
							FeelsLikeC: '25',
							chanceofrain: '10',
							weatherCode: '116',
							weatherDesc: [{ value: 'Partly cloudy' }],
							humidity: '55',
							windspeedKmph: String(WIND_KMH),
							winddirDegree: '180',
							WindGustKmph: String(GUST_KMH),
							uvIndex: '5',
							precipMM: '0.0',
						},
					],
				},
			],
		},
	};
}

// ----------------------------------------------------------------- Meteostat

export function meteostatResponse(overrides?: Overrides) {
	return {
		data: [
			{
				time: '2026-09-12 13:00:00',
				temp: 23.8,
				dwpt: 14.1,
				rhum: 56,
				prcp: 0,
				wdir: 180,
				wspd: WIND_KMH, // km/h secondo la documentazione Meteostat
				wpgt: GUST_KMH,
				pres: 1013,
				coco: 3,
			},
			merge(
				{
					time: '2026-09-12 14:00:00',
					temp: 24.2,
					dwpt: 14.3,
					rhum: 55,
					prcp: 0,
					wdir: 185,
					wspd: WIND_KMH,
					wpgt: GUST_KMH,
					pres: 1012,
					coco: 3,
				},
				overrides
			),
		],
	};
}

// --------------------------------------------------------------- Weatherstack

export function weatherstackResponse(overrides?: Overrides) {
	return {
		location: { name: 'Milano', localtime_epoch: 1789221600 },
		current: merge(
			{
				temperature: 24,
				feelslike: 25,
				humidity: 55,
				wind_speed: WIND_KMH, // km/h
				wind_degree: 180,
				weather_descriptions: ['Partly cloudy'],
				weather_code: 116,
				precip: 0,
				pressure: 1013,
			},
			overrides
		),
	};
}
