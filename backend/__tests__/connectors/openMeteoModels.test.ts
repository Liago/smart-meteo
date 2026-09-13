/**
 * Open-Meteo interrogato modello per modello.
 *
 * La selezione dei modelli è configurabile con la variabile
 * `OPENMETEO_MODELS`: va verificata, perché è la manopola con cui si riduce il
 * numero di chiamate senza un deploy.
 */

import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

import {
	OPENMETEO_MODELS,
	activeOpenMeteoModels,
	fetchFromOpenMeteo,
	fetchFromOpenMeteoModel,
} from '../../connectors/openmeteo';
import { WIND_MS, openMeteoResponse } from '../fixtures/providers';

const LAT = 45.46;
const LON = 9.19;

let mock: MockAdapter;
const CONFIG_ORIGINALE = process.env.OPENMETEO_MODELS;

beforeEach(() => {
	mock = new MockAdapter(axios);
	delete process.env.OPENMETEO_MODELS;
});

afterEach(() => {
	mock.restore();
	if (CONFIG_ORIGINALE === undefined) delete process.env.OPENMETEO_MODELS;
	else process.env.OPENMETEO_MODELS = CONFIG_ORIGINALE;
});

describe('registro dei modelli', () => {
	it('ogni modello ha un id API e un id fonte distinti e non vuoti', () => {
		const apiIds = new Set<string>();
		const sourceIds = new Set<string>();

		for (const model of OPENMETEO_MODELS) {
			expect(model.id).toBeTruthy();
			expect(model.sourceId).toMatch(/^open-meteo:/);
			expect(model.weight).toBeGreaterThan(0);
			apiIds.add(model.id);
			sourceIds.add(model.sourceId);
		}

		expect(apiIds.size).toBe(OPENMETEO_MODELS.length);
		expect(sourceIds.size).toBe(OPENMETEO_MODELS.length);
	});

	it('nessun id fonte collide con la fonte best_match', () => {
		expect(OPENMETEO_MODELS.map((m) => m.sourceId)).not.toContain('open-meteo');
	});
});

describe('activeOpenMeteoModels', () => {
	it('senza configurazione restituisce tutti i modelli', () => {
		expect(activeOpenMeteoModels()).toHaveLength(OPENMETEO_MODELS.length);
	});

	it('con "off" torna al solo best_match', () => {
		process.env.OPENMETEO_MODELS = 'off';
		expect(activeOpenMeteoModels()).toEqual([]);
	});

	it('accetta "OFF" a prescindere dal maiuscolo', () => {
		process.env.OPENMETEO_MODELS = 'OFF';
		expect(activeOpenMeteoModels()).toEqual([]);
	});

	it('filtra per id API', () => {
		process.env.OPENMETEO_MODELS = 'icon_d2,gfs_seamless';
		const attivi = activeOpenMeteoModels();
		expect(attivi.map((m) => m.id).sort()).toEqual(['gfs_seamless', 'icon_d2']);
	});

	it('accetta anche gli id fonte, non solo quelli API', () => {
		process.env.OPENMETEO_MODELS = 'open-meteo:ecmwf';
		expect(activeOpenMeteoModels().map((m) => m.id)).toEqual(['ecmwf_ifs025']);
	});

	it('tollera spazi e voci vuote', () => {
		process.env.OPENMETEO_MODELS = ' icon_d2 , , icon_eu ';
		expect(activeOpenMeteoModels()).toHaveLength(2);
	});

	it('un id sconosciuto viene ignorato senza far cadere gli altri', () => {
		process.env.OPENMETEO_MODELS = 'icon_d2,modello_inesistente';
		expect(activeOpenMeteoModels().map((m) => m.id)).toEqual(['icon_d2']);
	});

	it('una lista di soli id sconosciuti non attiva nulla', () => {
		// Meglio nessun modello che modelli arbitrari: l'engine ricade su
		// best_match e la previsione resta servibile.
		process.env.OPENMETEO_MODELS = 'qualcosa,altro';
		expect(activeOpenMeteoModels()).toEqual([]);
	});
});

describe('fetchFromOpenMeteoModel', () => {
	const modello = OPENMETEO_MODELS[0]!;

	it('passa il parametro models alla richiesta', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());

		await fetchFromOpenMeteoModel(LAT, LON, modello);

		expect(mock.history.get[0]!.params.models).toBe(modello.id);
	});

	it('la fonte porta l id del modello, non "open-meteo"', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());

		const f = (await fetchFromOpenMeteoModel(LAT, LON, modello))!;

		expect(f.source).toBe(modello.sourceId);
	});

	it('mappa i campi come la fonte best_match, conversioni comprese', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());

		const f = (await fetchFromOpenMeteoModel(LAT, LON, modello))!;

		expect(f.temp).toBe(24.3);
		expect(f.wind_speed).toBeCloseTo(WIND_MS, 1);
		expect(f.visibility).toBeCloseTo(24.14, 2);
		expect(f.utc_offset_seconds).toBe(7200);
		expect(f.daily!.length).toBeGreaterThan(0);
		expect(f.hourly!.length).toBeGreaterThan(0);
	});

	it('un modello che non copre la località restituisce null senza lanciare', async () => {
		// Succede con ICON-D2 fuori dall'Europa centrale: Open-Meteo risponde 400.
		mock.onGet(/open-meteo/).reply(400, { reason: 'No data available for this location' });

		await expect(fetchFromOpenMeteoModel(LAT, LON, modello)).resolves.toBeNull();
	});

	it('su errore di rete restituisce null', async () => {
		mock.onGet(/open-meteo/).networkError();
		await expect(fetchFromOpenMeteoModel(LAT, LON, modello)).resolves.toBeNull();
	});
});

describe('fetchFromOpenMeteo (best_match)', () => {
	it('non passa il parametro models', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());

		await fetchFromOpenMeteo(LAT, LON);

		expect(mock.history.get[0]!.params.models).toBeUndefined();
	});

	it('la fonte resta "open-meteo"', async () => {
		mock.onGet(/open-meteo/).reply(200, openMeteoResponse());
		const f = (await fetchFromOpenMeteo(LAT, LON))!;
		expect(f.source).toBe('open-meteo');
	});
});

describe('campi neve e quota', () => {
	it('chiede zero termico, neve fresca e manto all API', async () => {
		// Sono i tre parametri da cui dipende tutto il riquadro neve: se un
		// refactoring li togliesse dalla query, il riquadro sparirebbe in
		// silenzio senza che nessun altro test se ne accorga.
		mock.onGet(/open-meteo\.com/).reply((config) => {
			const hourly = String(config.params.hourly);
			expect(hourly).toContain('freezing_level_height');
			expect(hourly).toContain('snowfall');
			expect(hourly).toContain('snow_depth');
			// La brina si forma sulla superficie, non a due metri da terra.
			expect(hourly).toContain('soil_temperature_0cm');
			// Il rischio temporali si deduceva dal solo weather_code.
			expect(hourly).toContain('cape');
			expect(hourly).toContain('lifted_index');
			expect(hourly).toContain('convective_inhibition');
			// Dati agronomici: senza, il riquadro orto sparisce in silenzio.
			expect(hourly).toContain('soil_moisture_0_to_7cm');
			expect(hourly).toContain('et0_fao_evapotranspiration');
			expect(hourly).toContain('soil_temperature_0_to_7cm');
			expect(String(config.params.daily)).toContain('snowfall_sum');
			return [200, openMeteoResponse()];
		});

		expect(await fetchFromOpenMeteo(LAT, LON)).not.toBeNull();
	});

	it('converte il manto da metri a centimetri', async () => {
		// L'API dà la neve fresca in cm e il manto in METRI: senza conversione
		// 0.12 m diventerebbero "0.12 cm", cioè un millimetro di neve.
		mock.onGet(/open-meteo\.com/).reply(200, openMeteoResponse());

		const r = await fetchFromOpenMeteo(LAT, LON);

		expect(r!.hourly![0]!.snow_depth_cm).toBe(12);
		expect(r!.hourly![1]!.snow_depth_cm).toBe(14);
	});

	it('lascia la neve fresca e lo zero termico nelle unità dell API', async () => {
		mock.onGet(/open-meteo\.com/).reply(200, openMeteoResponse());

		const r = await fetchFromOpenMeteo(LAT, LON);

		expect(r!.hourly![1]!.snowfall_cm).toBe(0.8);
		expect(r!.hourly![0]!.freezing_level).toBe(1500);
		expect(r!.hourly![0]!.soil_temperature).toBe(21.4);
		expect(r!.hourly![0]!.cape).toBe(1000);
		expect(r!.hourly![0]!.lifted_index).toBe(-3);
		// Due suoli diversi: la superficie decide la brina, lo strato 0-7 cm
		// decide se un seme germina.
		expect(r!.hourly![0]!.soil_temperature).toBe(21.4);
		expect(r!.hourly![0]!.soil_temperature_root).toBe(19.8);
		expect(r!.hourly![0]!.soil_moisture).toBe(0.252);
		expect(r!.hourly![0]!.evapotranspiration).toBe(0.18);
		expect(r!.daily![1]!.snowfall_cm).toBe(1.5);
	});

	it('espone la quota del punto di griglia', async () => {
		mock.onGet(/open-meteo\.com/).reply(200, openMeteoResponse());

		const r = await fetchFromOpenMeteo(LAT, LON);

		expect(r!.elevation).toBe(122);
	});

	it('una risposta senza i campi neve non manda in errore il connettore', async () => {
		// I modelli non coprono tutti le stesse variabili, e Open-Meteo omette
		// la chiave invece di riempirla di null.
		const senzaNeve: any = openMeteoResponse();
		delete senzaNeve.hourly.snowfall;
		delete senzaNeve.hourly.snow_depth;
		delete senzaNeve.hourly.freezing_level_height;
		delete senzaNeve.hourly.soil_temperature_0cm;
		delete senzaNeve.hourly.cape;
		delete senzaNeve.hourly.lifted_index;
		delete senzaNeve.hourly.convective_inhibition;
		delete senzaNeve.hourly.soil_moisture_0_to_7cm;
		delete senzaNeve.hourly.et0_fao_evapotranspiration;
		delete senzaNeve.hourly.soil_temperature_0_to_7cm;
		delete senzaNeve.daily.snowfall_sum;
		delete senzaNeve.elevation;
		mock.onGet(/open-meteo\.com/).reply(200, senzaNeve);

		const r = await fetchFromOpenMeteo(LAT, LON);

		expect(r).not.toBeNull();
		expect(r!.elevation).toBeNull();
		expect(r!.hourly![0]!.snowfall_cm).toBeNull();
		expect(r!.hourly![0]!.snow_depth_cm).toBeNull();
		expect(r!.hourly![0]!.freezing_level).toBeNull();
		expect(r!.hourly![0]!.soil_temperature).toBeNull();
		expect(r!.hourly![0]!.cape).toBeNull();
		expect(r!.hourly![0]!.lifted_index).toBeNull();
		expect(r!.hourly![0]!.soil_moisture).toBeNull();
		expect(r!.hourly![0]!.evapotranspiration).toBeNull();
		expect(r!.daily![0]!.snowfall_cm).toBeNull();
	});
});
