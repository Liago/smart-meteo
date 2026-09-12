/**
 * Verifica dell'accuratezza sull'osservato.
 *
 * Il modulo sotto test è quello che decide i pesi dinamici delle fonti: fino
 * alla Fase 6C misurava la deviazione dal *consenso*, quindi premiava la
 * conformità al gruppo. I test fissano la nuova semantica — errore rispetto
 * alle temperature realmente osservate — e le due protezioni che la rendono
 * usabile: la finestra scorrevole e la soglia minima di campioni.
 */

// -------------------------------------------------------------- mock setup

/** Righe restituite da raw_forecasts. */
let rawForecastRows: any[] = [];
/** Campioni restituiti da accuracy_samples. */
let sampleRows: any[] = [];
/** Righe restituite da source_accuracy. */
let accuracyRows: any[] = [];

/** Scritture osservate, per verificare cosa finisce sul database. */
const upserts: { table: string; rows: any[]; options?: any }[] = [];
/** Filtro `gte` applicato all'ultima query: serve a verificare la finestra. */
const lastGte: Record<string, string> = {};

jest.mock('../../services/supabase', () => {
	const rowsFor = (table: string) => {
		if (table === 'raw_forecasts') return rawForecastRows;
		if (table === 'accuracy_samples') return sampleRows;
		if (table === 'source_accuracy') return accuracyRows;
		return [];
	};

	const chain = (table: string): any => {
		const self: any = {
			select: () => self,
			eq: () => self,
			gt: () => self,
			gte: (column: string, value: string) => {
				lastGte[table] = `${column}:${value}`;
				return self;
			},
			lt: () => self,
			lte: () => self,
			not: () => self,
			order: () => self,
			limit: () => self,
			upsert: async (rows: any[], options?: any) => {
				upserts.push({ table, rows, options });
				return { error: null };
			},
			// Il query builder di Supabase è un thenable: `await query` esegue.
			then: (resolve: any) => resolve({ data: rowsFor(table), error: null }),
		};
		return self;
	};

	return { supabase: { from: (table: string) => chain(table) } };
});

/** Osservazioni restituite dal servizio: chiave "YYYY-MM-DDTHH" → °C. */
let observed = new Map<string, number>();
let observedProvider: 'archive' | 'meteostat' | 'none' = 'archive';

jest.mock('../../services/observations', () => {
	const actual = jest.requireActual('../../services/observations');
	return {
		...actual,
		fetchObservedTemperatures: jest.fn(async () => ({
			temperatures: observed,
			provider: observed.size > 0 ? observedProvider : 'none',
		})),
	};
});

import {
	ACCURACY_WINDOW_DAYS,
	MIN_SAMPLES_FOR_WEIGHT,
	getAccuracyMap,
	getAccuracyReport,
	recomputeAccuracy,
	recomputeMaeFromSamples,
} from '../../services/accuracy';
import { hourKey, verificationDate } from '../../services/observations';

const NOW = new Date('2026-09-12T08:00:00Z');
/** Con ARCHIVE_LAG_DAYS = 6, il giorno verificato è il 6 settembre. */
const GIORNO = verificationDate(NOW);

beforeEach(() => {
	rawForecastRows = [];
	sampleRows = [];
	accuracyRows = [];
	upserts.length = 0;
	observed = new Map();
	observedProvider = 'archive';
});

// ------------------------------------------------------------------- tests

describe('verificationDate', () => {
	it('guarda indietro oltre il ritardo dell archivio, non a ieri', () => {
		// ERA5 pubblica con circa cinque giorni di ritardo: verificare ieri
		// tornerebbe sempre a mani vuote.
		expect(GIORNO).toBe('2026-09-06');
	});
});

describe('recomputeAccuracy', () => {
	it('senza previsioni archiviate non scrive nulla', async () => {
		const run = await recomputeAccuracy(NOW);

		expect(run.samples).toBe(0);
		expect(upserts).toHaveLength(0);
	});

	it('misura l errore rispetto all osservato, non rispetto alle altre fonti', async () => {
		// Due fonti: una azzecca, l'altra sbaglia di 5 °C. Con la vecchia
		// logica (deviazione dal consenso) avrebbero avuto lo stesso errore,
		// 2.5 °C ciascuna, perché il consenso stava nel mezzo.
		rawForecastRows = [
			{ source_id: 'open-meteo', latitude: 45.46, longitude: 9.19, temp: 20, fetched_at: `${GIORNO}T14:00:00Z` },
			{ source_id: 'meteostat', latitude: 45.46, longitude: 9.19, temp: 25, fetched_at: `${GIORNO}T14:00:00Z` },
		];
		observed.set(`${GIORNO}T14`, 20);

		await recomputeAccuracy(NOW);

		const campioni = upserts.find((u) => u.table === 'accuracy_samples')!.rows;
		const precisa = campioni.find((c: any) => c.source_id === 'open-meteo');
		const imprecisa = campioni.find((c: any) => c.source_id === 'meteostat');

		expect(precisa.abs_error).toBe(0);
		expect(imprecisa.abs_error).toBe(5);
	});

	it('registra valore previsto, osservato e provider di ogni campione', async () => {
		rawForecastRows = [
			{ source_id: 'open-meteo', latitude: 45.46, longitude: 9.19, temp: 21.5, fetched_at: `${GIORNO}T09:00:00Z` },
		];
		observed.set(`${GIORNO}T09`, 19.5);
		observedProvider = 'meteostat';

		await recomputeAccuracy(NOW);

		const campione = upserts.find((u) => u.table === 'accuracy_samples')!.rows[0];
		expect(campione.forecast_value).toBe(21.5);
		expect(campione.observed_value).toBe(19.5);
		expect(campione.abs_error).toBe(2);
		expect(campione.observation_source).toBe('meteostat');
		expect(campione.metric).toBe('temperature');
	});

	it('salta le ore per cui non esiste un osservato', async () => {
		rawForecastRows = [
			{ source_id: 'open-meteo', latitude: 45.46, longitude: 9.19, temp: 20, fetched_at: `${GIORNO}T14:00:00Z` },
			{ source_id: 'open-meteo', latitude: 45.46, longitude: 9.19, temp: 22, fetched_at: `${GIORNO}T15:00:00Z` },
		];
		// Solo le 14 hanno un'osservazione.
		observed.set(`${GIORNO}T14`, 20);

		const run = await recomputeAccuracy(NOW);

		expect(run.samples).toBe(1);
	});

	it('conta le località senza osservazioni invece di inventarne i dati', async () => {
		rawForecastRows = [
			{ source_id: 'open-meteo', latitude: 12.34, longitude: 56.78, temp: 20, fetched_at: `${GIORNO}T14:00:00Z` },
		];
		// observed resta vuota → provider 'none'

		const run = await recomputeAccuracy(NOW);

		expect(run.skipped).toBe(1);
		expect(run.locations).toBe(0);
		expect(run.samples).toBe(0);
	});

	it('raggruppa le coordinate quasi identiche in una sola richiesta di osservazioni', async () => {
		const { fetchObservedTemperatures } = jest.requireMock('../../services/observations');
		rawForecastRows = [
			{ source_id: 'open-meteo', latitude: 45.4642, longitude: 9.1900, temp: 20, fetched_at: `${GIORNO}T14:00:00Z` },
			{ source_id: 'weatherapi', latitude: 45.4643, longitude: 9.1901, temp: 21, fetched_at: `${GIORNO}T14:00:00Z` },
		];
		observed.set(`${GIORNO}T14`, 20);

		await recomputeAccuracy(NOW);

		// Due decimali ≈ 1 km: un solo punto, una sola chiamata.
		expect(fetchObservedTemperatures).toHaveBeenCalledTimes(1);
	});

	it('l inserimento è idempotente sulla chiave del confronto', async () => {
		rawForecastRows = [
			{ source_id: 'open-meteo', latitude: 45.46, longitude: 9.19, temp: 20, fetched_at: `${GIORNO}T14:00:00Z` },
		];
		observed.set(`${GIORNO}T14`, 18);

		await recomputeAccuracy(NOW);

		const scrittura = upserts.find((u) => u.table === 'accuracy_samples')!;
		expect(scrittura.options.onConflict).toBe('source_id,metric,observed_at,latitude,longitude');
	});
});

describe('recomputeMaeFromSamples', () => {
	it('ricalcola la media da zero sui campioni della finestra', async () => {
		sampleRows = [
			{ source_id: 'open-meteo', metric: 'temperature', abs_error: 1, observation_source: 'archive' },
			{ source_id: 'open-meteo', metric: 'temperature', abs_error: 3, observation_source: 'archive' },
			{ source_id: 'weatherapi', metric: 'temperature', abs_error: 2, observation_source: 'archive' },
		];

		const aggiornate = await recomputeMaeFromSamples();

		expect(aggiornate).toBe(2);
		const righe = upserts.find((u) => u.table === 'source_accuracy')!.rows;
		const openMeteo = righe.find((r: any) => r.source_id === 'open-meteo');
		expect(openMeteo.mae).toBe(2);
		expect(openMeteo.sample_count).toBe(2);
	});

	it('applica la finestra scorrevole: i campioni più vecchi non entrano', async () => {
		sampleRows = [{ source_id: 'open-meteo', metric: 'temperature', abs_error: 1, observation_source: 'archive' }];

		await recomputeMaeFromSamples(30);

		// La query filtra su observed_at: è la differenza fra un peso che segue
		// l'andamento recente e uno che si cristallizza.
		expect(lastGte['accuracy_samples']).toMatch(/^observed_at:/);
		const soglia = new Date(lastGte['accuracy_samples']!.split('observed_at:')[1]!);
		const giorniIndietro = (Date.now() - soglia.getTime()) / (24 * 60 * 60 * 1000);
		expect(giorniIndietro).toBeCloseTo(30, 0);
	});

	it('registra la finestra usata e il provider prevalente', async () => {
		sampleRows = [
			{ source_id: 'open-meteo', metric: 'temperature', abs_error: 1, observation_source: 'archive' },
			{ source_id: 'open-meteo', metric: 'temperature', abs_error: 1, observation_source: 'archive' },
			{ source_id: 'open-meteo', metric: 'temperature', abs_error: 1, observation_source: 'meteostat' },
		];

		await recomputeMaeFromSamples(14);

		const riga = upserts.find((u) => u.table === 'source_accuracy')!.rows[0];
		expect(riga.window_days).toBe(14);
		expect(riga.observation_source).toBe('archive');
	});

	it('senza campioni non scrive nulla', async () => {
		sampleRows = [];
		expect(await recomputeMaeFromSamples()).toBe(0);
		expect(upserts).toHaveLength(0);
	});
});

describe('getAccuracyMap', () => {
	it('espone solo le fonti con campioni sufficienti', async () => {
		// La query filtra già su sample_count: qui si verifica che la soglia
		// esista e sia quella dichiarata.
		accuracyRows = [{ source_id: 'open-meteo', metric: 'temperature', mae: 1.2, sample_count: 100 }];

		const map = await getAccuracyMap();

		expect(map['open-meteo']!['temperature']).toBe(1.2);
		expect(lastGte['source_accuracy']).toBe(`sample_count:${MIN_SAMPLES_FOR_WEIGHT}`);
	});

	it('senza dati restituisce una mappa vuota, non un errore', async () => {
		accuracyRows = [];
		expect(await getAccuracyMap()).toEqual({});
	});
});

describe('getAccuracyReport', () => {
	it('calcola il moltiplicatore di peso 1/(1+MAE)', async () => {
		accuracyRows = [
			{ source_id: 'open-meteo', metric: 'temperature', mae: 1, sample_count: 100, window_days: 30, observation_source: 'archive', last_computed_at: '2026-09-12T04:10:00Z' },
		];

		const [riga] = await getAccuracyReport();

		expect(riga!.weight_multiplier).toBe(0.5);
		expect(riga!.affects_weight).toBe(true);
		expect(riga!.window_days).toBe(30);
	});

	it('con pochi campioni mostra il MAE ma dichiara che non pesa ancora', async () => {
		// Con tre confronti il numero è rumore: meglio il peso statico che un
		// peso corretto su tre osservazioni.
		accuracyRows = [
			{ source_id: 'accuweather', metric: 'temperature', mae: 4.2, sample_count: 3, window_days: 30, observation_source: 'archive', last_computed_at: null },
		];

		const [riga] = await getAccuracyReport();

		expect(riga!.mae).toBe(4.2);
		expect(riga!.affects_weight).toBe(false);
		expect(riga!.weight_multiplier).toBe(1);
	});

	it('un MAE nullo non annulla il peso', async () => {
		accuracyRows = [
			{ source_id: 'open-meteo', metric: 'temperature', mae: 0, sample_count: 50, window_days: 30, observation_source: 'archive', last_computed_at: null },
		];

		const [riga] = await getAccuracyReport();

		expect(riga!.weight_multiplier).toBe(1);
	});

	it('la finestra di default è quella dichiarata dal modulo', () => {
		expect(ACCURACY_WINDOW_DAYS).toBe(30);
	});
});

describe('hourKey', () => {
	it('tronca all ora sia gli ISO con T che quelli con spazio', () => {
		expect(hourKey('2026-09-06T14:00:00Z')).toBe('2026-09-06T14');
		expect(hourKey('2026-09-06 14:00:00')).toBe('2026-09-06T14');
	});
});
