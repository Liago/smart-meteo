/**
 * Il contratto sulle unità del vento, verificato su tutti i connettori insieme.
 *
 * `UnifiedForecastData.wind_speed` è documentato in m/s e lo Smart Engine ne fa
 * una media pesata: se un solo connettore consegna km/h, il valore aggregato è
 * sbagliato per tutti, e nessun test sul singolo connettore lo farebbe emergere.
 *
 * Ogni fixture usa 36 km/h = 10 m/s esatti, così una conversione mancata si
 * legge a occhio nel messaggio di errore.
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
	GUST_MS,
	WIND_MS,
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

const LAT = 45.46;
const LON = 9.19;

let mock: MockAdapter;

beforeEach(() => {
	mock = new MockAdapter(axios);
	process.env.TOMORROW_API_KEY = 'test';
	process.env.OPENWEATHER_API_KEY = 'test';
	process.env.WEATHERAPI_KEY = 'test';
	process.env.ACCUWEATHER_API_KEY = 'test';
	process.env.WORLDWEATHER_KEY = 'test';
	process.env.METEOSTAT_KEY = 'test';
	process.env.WEATHERSTACK_KEY = 'test';
});

afterEach(() => {
	mock.restore();
});

/**
 * WeatherKit richiede una chiave privata EC per firmare il JWT: qui non serve
 * verificare la firma, serve solo che il connettore arrivi alla chiamata HTTP.
 * Il modulo `jsonwebtoken` viene quindi sostituito.
 */
jest.mock('jsonwebtoken', () => ({
	sign: jest.fn(() => 'fake.jwt.token'),
}));

/**
 * WeatherKit è l'unico connettore che usa `fetch` globale invece di axios,
 * quindi axios-mock-adapter non lo intercetta.
 */
function mockWeatherKit(body: unknown) {
	process.env.APPLE_TEAM_ID = 'TEAM';
	process.env.APPLE_SERVICE_ID = 'com.test.app';
	process.env.APPLE_KEY_ID = 'KEY';
	process.env.APPLE_PRIVATE_KEY = 'fake-key';

	global.fetch = jest.fn(async () => ({
		ok: true,
		status: 200,
		statusText: 'OK',
		json: async () => body,
	})) as unknown as typeof fetch;
}

describe('unità del vento: ogni connettore consegna m/s', () => {
	it('open-meteo converte i km/h nativi (default dell API) in m/s', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());
		const f = await fetchFromOpenMeteo(LAT, LON);
		expect(f!.wind_speed).toBeCloseTo(WIND_MS, 1);
		expect(f!.wind_gust).toBeCloseTo(GUST_MS, 1);
	});

	it('tomorrow.io con units=metric è già in m/s e non va convertito', async () => {
		mock.onGet(/realtime/).reply(200, tomorrowRealtimeResponse());
		mock.onGet(/forecast/).reply(200, tomorrowForecastResponse());
		const f = await fetchFromTomorrow(LAT, LON);
		expect(f!.wind_speed).toBeCloseTo(WIND_MS, 1);
		expect(f!.wind_gust).toBeCloseTo(GUST_MS, 1);
	});

	it('openweathermap con units=metric è già in m/s', async () => {
		mock.onGet(/2\.5\/weather/).reply(200, owmCurrentResponse());
		mock.onGet(/2\.5\/forecast/).reply(200, owmForecastResponse());
		const f = await fetchFromOpenWeather(LAT, LON);
		expect(f!.wind_speed).toBeCloseTo(WIND_MS, 1);
		expect(f!.wind_gust).toBeCloseTo(GUST_MS, 1);
	});

	it('weatherapi converte wind_kph in m/s', async () => {
		mock.onGet(/weatherapi/).reply(200, weatherApiResponse());
		const f = await fetchFromWeatherAPI(LAT, LON);
		expect(f!.wind_speed).toBeCloseTo(WIND_MS, 1);
		expect(f!.wind_gust).toBeCloseTo(GUST_MS, 1);
	});

	it('accuweather converte i km/h metrici in m/s', async () => {
		mock.onGet(/geoposition/).reply(200, accuLocationResponse());
		mock.onGet(new RegExp(`currentconditions/v1/${ACCU_LOCATION_KEY}`)).reply(200, accuCurrentResponse());
		mock.onGet(/daily\/5day/).reply(200, accuDailyResponse());
		mock.onGet(/hourly\/12hour/).reply(200, accuHourlyResponse());
		const f = await fetchFromAccuWeather(LAT, LON);
		expect(f!.wind_speed).toBeCloseTo(WIND_MS, 1);
		expect(f!.wind_gust).toBeCloseTo(GUST_MS, 1);
	});

	it('world weather online converte windspeedKmph in m/s', async () => {
		mock.onGet(/worldweatheronline/).reply(200, wwoResponse());
		const f = await fetchFromWWO(LAT, LON);
		expect(f!.wind_speed).toBeCloseTo(WIND_MS, 1);
		expect(f!.wind_gust).toBeCloseTo(GUST_MS, 1);
	});

	it('weatherkit converte i km/h di Apple in m/s', async () => {
		mockWeatherKit(weatherKitResponse());
		const f = await fetchFromWeatherKit(LAT, LON);
		expect(f!.wind_speed).toBeCloseTo(WIND_MS, 1);
		expect(f!.wind_gust).toBeCloseTo(GUST_MS, 1);
	});

	it('meteostat converte wspd (km/h) in m/s', async () => {
		mock.onGet(/meteostat/).reply(200, meteostatResponse());
		const f = await fetchFromMeteostat(LAT, LON);
		expect(f!.wind_speed).toBeCloseTo(WIND_MS, 1);
		expect(f!.wind_gust).toBeCloseTo(GUST_MS, 1);
	});

	it('weatherstack converte i km/h in m/s', async () => {
		mock.onGet(/weatherstack/).reply(200, weatherstackResponse());
		const f = await fetchFromWeatherstack(LAT, LON);
		expect(f!.wind_speed).toBeCloseTo(WIND_MS, 1);
	});
});

describe('coerenza fra current e hourly nello stesso connettore', () => {
	// Un connettore che converte l'orario ma non il corrente (o viceversa)
	// produce due numeri che differiscono di 3.6x per lo stesso istante: il
	// grafico e il dato in evidenza si contraddicono.

	it('open-meteo: prima ora e current concordano', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());
		const f = await fetchFromOpenMeteo(LAT, LON);
		expect(f!.hourly![0]!.wind_speed).toBeCloseTo(f!.wind_speed!, 1);
	});

	it('weatherkit: prima ora e current concordano', async () => {
		mockWeatherKit(weatherKitResponse());
		const f = await fetchFromWeatherKit(LAT, LON);
		expect(f!.hourly![0]!.wind_speed).toBeCloseTo(f!.wind_speed!, 1);
	});

	it('world weather online: prima ora e current concordano', async () => {
		mock.onGet(/worldweatheronline/).reply(200, wwoResponse());
		const f = await fetchFromWWO(LAT, LON);
		expect(f!.hourly![0]!.wind_speed).toBeCloseTo(f!.wind_speed!, 1);
	});

	it('weatherapi: prima ora e current concordano', async () => {
		mock.onGet(/weatherapi/).reply(200, weatherApiResponse());
		const f = await fetchFromWeatherAPI(LAT, LON);
		expect(f!.hourly![0]!.wind_speed).toBeCloseTo(f!.wind_speed!, 1);
	});

	it('accuweather: prima ora e current concordano', async () => {
		mock.onGet(/geoposition/).reply(200, accuLocationResponse());
		mock.onGet(new RegExp(`currentconditions/v1/${ACCU_LOCATION_KEY}`)).reply(200, accuCurrentResponse());
		mock.onGet(/daily\/5day/).reply(200, accuDailyResponse());
		mock.onGet(/hourly\/12hour/).reply(200, accuHourlyResponse());
		const f = await fetchFromAccuWeather(LAT, LON);
		expect(f!.hourly![0]!.wind_speed).toBeCloseTo(f!.wind_speed!, 1);
	});
});
