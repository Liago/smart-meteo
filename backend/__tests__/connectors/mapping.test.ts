/**
 * Mappatura dei campi e percorsi di errore dei nove connettori.
 *
 * Due comportamenti contano più degli altri:
 *  - un connettore che fallisce deve restituire `null`, non lanciare: lo Smart
 *    Engine usa `Promise.allSettled`, ma un errore sincrono in fase di lettura
 *    dei parametri sfuggirebbe comunque;
 *  - le conversioni di unità devono essere quelle dichiarate in
 *    `UnifiedForecastData`, perché l'aggregazione somma numeri di fonti diverse
 *    senza sapere da dove vengono.
 */

import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

import { fetchFromOpenMeteo } from '../../connectors/openmeteo';
import { fetchFromTomorrow } from '../../connectors/tomorrow';
import { fetchFromOpenWeather } from '../../connectors/openweathermap';
import { fetchFromWeatherAPI } from '../../connectors/weatherapi';
import { fetchFromAccuWeather } from '../../connectors/accuweather';
import { fetchFromWWO } from '../../connectors/worldweatheronline';
import { fetchFromWeatherKit } from '../../connectors/weatherkit';
import { fetchFromMeteostat } from '../../connectors/meteostat';
import { fetchFromWeatherstack } from '../../connectors/weatherstack';

import {
	ACCU_LOCATION_KEY,
	accuCurrentResponse,
	accuDailyResponse,
	accuHourlyResponse,
	accuLocationResponse,
	meteostatResponse,
	openMeteoResponse,
	owmCurrentResponse,
	owmForecastResponse,
	tomorrowForecastResponse,
	tomorrowRealtimeResponse,
	weatherApiResponse,
	weatherKitResponse,
	weatherstackResponse,
	wwoResponse,
} from '../fixtures/providers';

jest.mock('jsonwebtoken', () => ({ sign: jest.fn(() => 'fake.jwt.token') }));

const LAT = 45.46;
const LON = 9.19;

const ALL_KEYS = [
	'TOMORROW_API_KEY',
	'OPENWEATHER_API_KEY',
	'WEATHERAPI_KEY',
	'ACCUWEATHER_API_KEY',
	'WORLDWEATHER_KEY',
	'METEOSTAT_KEY',
	'WEATHERSTACK_KEY',
	'APPLE_TEAM_ID',
	'APPLE_SERVICE_ID',
	'APPLE_KEY_ID',
	'APPLE_PRIVATE_KEY',
];

let mock: MockAdapter;

beforeEach(() => {
	mock = new MockAdapter(axios);
	for (const key of ALL_KEYS) process.env[key] = 'test';
});

afterEach(() => {
	mock.restore();
});

function mockWeatherKitFetch(body: unknown, ok = true) {
	global.fetch = jest.fn(async () => ({
		ok,
		status: ok ? 200 : 500,
		statusText: ok ? 'OK' : 'Server Error',
		json: async () => body,
	})) as unknown as typeof fetch;
}

function mockAccuWeather() {
	mock.onGet(/geoposition/).reply(200, accuLocationResponse());
	mock.onGet(new RegExp(`currentconditions/v1/${ACCU_LOCATION_KEY}`)).reply(200, accuCurrentResponse());
	mock.onGet(/daily\/5day/).reply(200, accuDailyResponse());
	mock.onGet(/hourly\/12hour/).reply(200, accuHourlyResponse());
}

describe('open-meteo', () => {
	it('mappa current, daily, hourly e astronomy', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());
		const f = (await fetchFromOpenMeteo(LAT, LON))!;

		expect(f.source).toBe('open-meteo');
		expect(f.temp).toBe(24.3);
		expect(f.feels_like).toBe(25.1);
		expect(f.humidity).toBe(55);
		expect(f.pressure).toBe(1013);
		expect(f.uv_index).toBe(5.2);
		expect(f.cloud_cover).toBe(75);
		expect(f.dew_point).toBe(14.4);
		expect(f.daily).toHaveLength(2);
		expect(f.hourly!.length).toBeGreaterThan(0);
		expect(f.astronomy!.sunrise).toBe('2026-09-12T06:52');
	});

	it('converte la visibilità da metri a km', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());
		const f = (await fetchFromOpenMeteo(LAT, LON))!;
		expect(f.visibility).toBeCloseTo(24.14, 2);
	});

	it('conserva utc_offset_seconds: serve al bucketing orario dell engine', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());
		const f = (await fetchFromOpenMeteo(LAT, LON))!;
		expect(f.utc_offset_seconds).toBe(7200);
	});

	it('passa il codice WMO numerico come condition_code', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse({ current: { weather_code: 61 } }));
		const f = (await fetchFromOpenMeteo(LAT, LON))!;
		expect(f.condition_code).toBe('61');
	});

	it('porta i mm giornalieri da precipitation_sum', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());
		const f = (await fetchFromOpenMeteo(LAT, LON))!;
		expect(f.daily![1]!.precipitation_mm).toBe(12.4);
	});

	it('su errore di rete restituisce null senza lanciare', async () => {
		mock.onGet(/open-meteo/).networkError();
		await expect(fetchFromOpenMeteo(LAT, LON)).resolves.toBeNull();
	});

	it('su 500 restituisce null', async () => {
		mock.onGet(/open-meteo/).reply(500);
		await expect(fetchFromOpenMeteo(LAT, LON)).resolves.toBeNull();
	});
});

describe('tomorrow.io', () => {
	it('traduce il weatherCode proprietario in una condizione normalizzata', async () => {
		// Era il bug 1.1 del changelog: il codice finiva in `condition_text` come
		// "Code: 1001" e `normalizeCondition` non lo riconosceva.
		mock.onGet(/realtime/).reply(200, tomorrowRealtimeResponse({ weatherCode: 1001 }));
		mock.onGet(/forecast/).reply(200, tomorrowForecastResponse());
		const f = (await fetchFromTomorrow(LAT, LON))!;
		expect(f.condition_code).toBe('cloudy');
		expect(f.condition_text).not.toMatch(/Code/);
	});

	it.each([
		[1000, 'clear'],
		[1001, 'cloudy'],
		[4001, 'rain'],
		[5000, 'snow'],
		[8000, 'storm'],
		[2000, 'fog'],
	])('codice %i → %s', async (code, expected) => {
		mock.onGet(/realtime/).reply(200, tomorrowRealtimeResponse({ weatherCode: code }));
		mock.onGet(/forecast/).reply(200, tomorrowForecastResponse());
		const f = (await fetchFromTomorrow(LAT, LON))!;
		expect(f.condition_code).toBe(expected);
	});

	it('estrae uv, visibilità, nuvole e dew point dal realtime', async () => {
		mock.onGet(/realtime/).reply(200, tomorrowRealtimeResponse());
		mock.onGet(/forecast/).reply(200, tomorrowForecastResponse());
		const f = (await fetchFromTomorrow(LAT, LON))!;
		expect(f.uv_index).toBe(5);
		expect(f.visibility).toBe(24);
		expect(f.cloud_cover).toBe(80);
		expect(f.dew_point).toBe(14.2);
	});

	it('senza chiave API restituisce null prima di chiamare la rete', async () => {
		delete process.env.TOMORROW_API_KEY;
		await expect(fetchFromTomorrow(LAT, LON)).resolves.toBeNull();
		expect(mock.history.get).toHaveLength(0);
	});

	it('se il forecast fallisce degrada al solo realtime invece di perdere tutto', async () => {
		mock.onGet(/realtime/).reply(200, tomorrowRealtimeResponse());
		mock.onGet(/forecast/).reply(500);
		const f = (await fetchFromTomorrow(LAT, LON))!;
		expect(f.temp).toBe(24.1);
		expect(f.daily).toEqual([]);
		expect(f.hourly).toEqual([]);
	});

	it('se il realtime fallisce restituisce null: il current è obbligatorio', async () => {
		mock.onGet(/realtime/).reply(500);
		mock.onGet(/forecast/).reply(200, tomorrowForecastResponse());
		await expect(fetchFromTomorrow(LAT, LON)).resolves.toBeNull();
	});
});

describe('openweathermap', () => {
	it('aggrega gli slot da 3 ore in previsioni giornaliere', async () => {
		mock.onGet(/2\.5\/weather/).reply(200, owmCurrentResponse());
		mock.onGet(/2\.5\/forecast/).reply(200, owmForecastResponse());
		const f = (await fetchFromOpenWeather(LAT, LON))!;

		expect(f.daily).toHaveLength(1);
		const day = f.daily![0]!;
		// Slot a 25 °C e 22 °C nello stesso giorno.
		expect(day.temp_max).toBe(25);
		expect(day.temp_min).toBe(22);
		// pop 0.2 e 0.8 → media 50%
		expect(day.precipitation_prob).toBe(50);
		// 0.6 + 3.2 mm nelle due finestre da 3 ore
		expect(day.precipitation_mm).toBe(3.8);
	});

	it('non popola i mm orari: gli slot OWM sono totali su 3 ore', async () => {
		mock.onGet(/2\.5\/weather/).reply(200, owmCurrentResponse());
		mock.onGet(/2\.5\/forecast/).reply(200, owmForecastResponse());
		const f = (await fetchFromOpenWeather(LAT, LON))!;
		for (const hour of f.hourly!) {
			expect(hour.precipitation_mm).toBeUndefined();
		}
	});

	it('estrae alba e tramonto dalla risposta current', async () => {
		mock.onGet(/2\.5\/weather/).reply(200, owmCurrentResponse());
		mock.onGet(/2\.5\/forecast/).reply(200, owmForecastResponse());
		const f = (await fetchFromOpenWeather(LAT, LON))!;
		expect(f.astronomy!.sunrise).toMatch(/^2026-09-/);
		expect(f.astronomy!.moon_phase).toBe('unknown');
	});

	it('converte la visibilità da metri a km', async () => {
		mock.onGet(/2\.5\/weather/).reply(200, owmCurrentResponse());
		mock.onGet(/2\.5\/forecast/).reply(200, owmForecastResponse());
		const f = (await fetchFromOpenWeather(LAT, LON))!;
		expect(f.visibility).toBe(10);
	});

	it('senza chiave API restituisce null', async () => {
		delete process.env.OPENWEATHER_API_KEY;
		await expect(fetchFromOpenWeather(LAT, LON)).resolves.toBeNull();
	});
});

describe('weatherapi', () => {
	it('è l unica fonte di AQI dettagliato e lo mappa tutto', async () => {
		mock.onGet(/weatherapi/).reply(200, weatherApiResponse());
		const f = (await fetchFromWeatherAPI(LAT, LON))!;
		expect(f.aqi).toBe(2);
		expect(f.air_quality).toEqual({
			aqi_us_epa: 2,
			pm2_5: 12.3,
			pm10: 20.1,
			no2: 15,
			o3: 40,
			co: 200,
			so2: 5,
		});
	});

	it('converte alba e tramonto da 12h a 24h e li datalizza in ISO', async () => {
		// L'API manda "06:52 AM": il connettore normalizza a 24h e ci attacca la
		// data del giorno, perché i client costruiscono un Date dall'intero campo.
		mock.onGet(/weatherapi/).reply(200, weatherApiResponse());
		const f = (await fetchFromWeatherAPI(LAT, LON))!;
		expect(f.astronomy!.sunrise).toBe('2026-09-12T06:52:00');
		expect(f.astronomy!.sunset).toBe('2026-09-12T19:44:00');
	});

	it('preferisce la fase lunare dell API al calcolo locale', async () => {
		mock.onGet(/weatherapi/).reply(200, weatherApiResponse());
		const f = (await fetchFromWeatherAPI(LAT, LON))!;
		expect(f.astronomy!.moon_phase).toBe('Waxing Gibbous');
	});

	it('normalizza la condizione testuale', async () => {
		mock.onGet(/weatherapi/).reply(200, weatherApiResponse({ current: { condition: { text: 'Heavy rain' } } }));
		const f = (await fetchFromWeatherAPI(LAT, LON))!;
		expect(f.condition_code).toBe('rain');
	});

	it('senza blocco air_quality non inventa un AQI', async () => {
		mock.onGet(/weatherapi/).reply(200, weatherApiResponse({ current: { air_quality: undefined } }));
		const f = (await fetchFromWeatherAPI(LAT, LON))!;
		expect(f.aqi).toBeNull();
	});

	it('senza chiave API restituisce null', async () => {
		delete process.env.WEATHERAPI_KEY;
		await expect(fetchFromWeatherAPI(LAT, LON)).resolves.toBeNull();
	});
});

describe('accuweather', () => {
	it('risolve il locationKey e poi mappa current, daily e hourly', async () => {
		mockAccuWeather();
		const f = (await fetchFromAccuWeather(LAT, LON))!;
		expect(f.temp).toBe(24.4);
		expect(f.feels_like).toBe(25.6);
		expect(f.uv_index).toBe(5);
		expect(f.visibility).toBe(24.1);
		expect(f.daily).toHaveLength(1);
		expect(f.hourly).toHaveLength(1);
	});

	it('riusa il locationKey dalla cache invece di richiederlo a ogni chiamata', async () => {
		// Il piano free è 50 chiamate al giorno: ogni geoposition risparmiata conta.
		// La cache è a livello di modulo e sopravvive fra i test, quindi servono
		// coordinate mai usate altrove, altrimenti il primo conteggio è già 0.
		mockAccuWeather();
		const lat = 41.9;
		const lon = 12.5;
		await fetchFromAccuWeather(lat, lon);
		const primaTornata = mock.history.get.filter((r) => /geoposition/.test(r.url ?? '')).length;
		await fetchFromAccuWeather(lat, lon);
		const secondaTornata = mock.history.get.filter((r) => /geoposition/.test(r.url ?? '')).length;
		expect(primaTornata).toBe(1);
		expect(secondaTornata).toBe(1);
	});

	it('se il locationKey non arriva restituisce null senza chiamare gli altri endpoint', async () => {
		// Coordinate diverse dal test precedente, per non pescare dalla cache.
		mock.onGet(/geoposition/).reply(500);
		await expect(fetchFromAccuWeather(10.1, 20.2)).resolves.toBeNull();
		expect(mock.history.get.filter((r) => /currentconditions/.test(r.url ?? ''))).toHaveLength(0);
	});

	it('senza chiave API restituisce null', async () => {
		delete process.env.ACCUWEATHER_API_KEY;
		await expect(fetchFromAccuWeather(LAT, LON)).resolves.toBeNull();
	});
});

describe('world weather online', () => {
	it('mappa current, daily e hourly con i campi numerici convertiti da stringa', async () => {
		mock.onGet(/worldweatheronline/).reply(200, wwoResponse());
		const f = (await fetchFromWWO(LAT, LON))!;
		expect(f.temp).toBe(24);
		expect(f.humidity).toBe(55);
		expect(f.pressure).toBe(1013);
		expect(typeof f.temp).toBe('number');
		expect(f.daily!.length).toBeGreaterThan(0);
		expect(f.hourly!.length).toBeGreaterThan(0);
	});

	it('è la fonte di moonrise e moonset, convertiti in ISO', async () => {
		mock.onGet(/worldweatheronline/).reply(200, wwoResponse());
		const f = (await fetchFromWWO(LAT, LON))!;
		expect(f.astronomy!.moonrise).toBeTruthy();
		expect(f.astronomy!.moonset).toBeTruthy();
		expect(f.astronomy!.moon_phase).toBe('Waxing Gibbous');
	});

	it('è l unica fonte della probabilità di tuono', async () => {
		// Gli indici convettivi di Open-Meteo dicono quanta energia c'è, questa
		// quanto è probabile che si scarichi: sono due cose diverse.
		mock.onGet(/worldweatheronline/).reply(200, wwoResponse());
		const f = (await fetchFromWWO(LAT, LON))!;
		expect(f.hourly![0]!.thunder_prob).toBe(35);
	});

	it('una risposta senza chanceofthunder non manda in errore il connettore', async () => {
		const senzaTuono: any = wwoResponse();
		delete senzaTuono.data.weather[0].hourly[0].chanceofthunder;
		mock.onGet(/worldweatheronline/).reply(200, senzaTuono);

		const f = (await fetchFromWWO(LAT, LON))!;
		expect(f.hourly![0]!.thunder_prob).toBeNull();
	});

	it('senza chiave API restituisce null', async () => {
		delete process.env.WORLDWEATHER_KEY;
		await expect(fetchFromWWO(LAT, LON)).resolves.toBeNull();
	});
});

describe('weatherkit', () => {
	it('converte le frazioni 0-1 di Apple in percentuali', async () => {
		mockWeatherKitFetch(weatherKitResponse());
		const f = (await fetchFromWeatherKit(LAT, LON))!;
		expect(f.humidity).toBeCloseTo(55, 5);
		expect(f.cloud_cover).toBeCloseTo(75, 5);
		expect(f.precipitation_prob).toBeCloseTo(15, 5);
	});

	it('converte la visibilità da metri a km', async () => {
		mockWeatherKitFetch(weatherKitResponse());
		const f = (await fetchFromWeatherKit(LAT, LON))!;
		expect(f.visibility).toBeCloseTo(24.14, 2);
	});

	it('mappa il conditionCode di Apple sul vocabolario interno', async () => {
		mockWeatherKitFetch(weatherKitResponse({ currentWeather: { conditionCode: 'Rain' } }));
		const f = (await fetchFromWeatherKit(LAT, LON))!;
		expect(f.condition_code).toBe('rain');
	});

	it('senza le variabili Apple non tenta la chiamata', async () => {
		delete process.env.APPLE_PRIVATE_KEY;
		mockWeatherKitFetch(weatherKitResponse());
		await expect(fetchFromWeatherKit(LAT, LON)).resolves.toBeNull();
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('su risposta non ok restituisce null', async () => {
		mockWeatherKitFetch({}, false);
		await expect(fetchFromWeatherKit(LAT, LON)).resolves.toBeNull();
	});
});

describe('meteostat', () => {
	it('prende la rilevazione più recente, non la prima', async () => {
		// L'API restituisce la serie oraria del giorno: conta l'ultima ora piena.
		mock.onGet(/meteostat/).reply(200, meteostatResponse());
		const f = (await fetchFromMeteostat(LAT, LON))!;
		expect(f.temp).toBe(24.2);
		expect(f.pressure).toBe(1012);
		expect(f.wind_direction).toBe(185);
	});

	it('estrae la pressione: era il bug 1.3 del changelog API', async () => {
		mock.onGet(/meteostat/).reply(200, meteostatResponse());
		const f = (await fetchFromMeteostat(LAT, LON))!;
		expect(f.pressure).not.toBeNull();
	});

	it('non dichiara una percepita che l API non fornisce', async () => {
		mock.onGet(/meteostat/).reply(200, meteostatResponse());
		const f = (await fetchFromMeteostat(LAT, LON))!;
		expect(f.feels_like).toBeNull();
	});

	it('daily e hourly restano vuoti: è una fonte di osservazioni, non di previsioni', async () => {
		mock.onGet(/meteostat/).reply(200, meteostatResponse());
		const f = (await fetchFromMeteostat(LAT, LON))!;
		expect(f.daily).toEqual([]);
		expect(f.hourly).toEqual([]);
	});

	it('con serie vuota restituisce null invece di un oggetto senza dati', async () => {
		mock.onGet(/meteostat/).reply(200, { data: [] });
		await expect(fetchFromMeteostat(LAT, LON)).resolves.toBeNull();
	});

	it('senza chiave API restituisce null', async () => {
		delete process.env.METEOSTAT_KEY;
		await expect(fetchFromMeteostat(LAT, LON)).resolves.toBeNull();
	});
});

describe('weatherstack', () => {
	it('mappa il current e lascia daily vuoto', async () => {
		mock.onGet(/weatherstack/).reply(200, weatherstackResponse());
		const f = (await fetchFromWeatherstack(LAT, LON))!;
		expect(f.temp).toBe(24);
		expect(f.pressure).toBe(1013);
		expect(f.daily).toEqual([]);
	});

	it('un errore applicativo nel corpo 200 viene trattato come fallimento', async () => {
		// Weatherstack risponde 200 con `{ error: {...} }` su chiave non valida.
		mock.onGet(/weatherstack/).reply(200, { error: { type: 'invalid_access_key' } });
		await expect(fetchFromWeatherstack(LAT, LON)).resolves.toBeNull();
	});

	it('senza chiave API restituisce null', async () => {
		delete process.env.WEATHERSTACK_KEY;
		await expect(fetchFromWeatherstack(LAT, LON)).resolves.toBeNull();
	});
});
