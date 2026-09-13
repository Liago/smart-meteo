/**
 * Banda di incertezza dai membri dell'ensemble.
 *
 * Due cose vanno protette: il calcolo dei percentili, perché è il numero che
 * finisce sotto gli occhi dell'utente come «fra 18 e 24 °C», e il fatto che
 * un ensemble mancante non possa far cadere una previsione — è un
 * arricchimento, non un requisito.
 */

import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

import {
	ensembleModel,
	fetchTemperatureBand,
	percentile,
} from '../../connectors/openmeteoEnsemble';

const LAT = 45.46;
const LON = 9.19;

let mock: MockAdapter;
const CONFIG_ORIGINALE = process.env.OPENMETEO_ENSEMBLE;

beforeEach(() => {
	mock = new MockAdapter(axios);
	delete process.env.OPENMETEO_ENSEMBLE;
});

afterEach(() => {
	mock.restore();
	if (CONFIG_ORIGINALE === undefined) delete process.env.OPENMETEO_ENSEMBLE;
	else process.env.OPENMETEO_ENSEMBLE = CONFIG_ORIGINALE;
});

/** Risposta con `members` membri, ciascuno costante su tutte le ore. */
function ensembleResponse(membersValues: number[][], times = ['2026-09-12T14:00', '2026-09-12T15:00']) {
	const hourly: Record<string, unknown> = { time: times };
	membersValues.forEach((series, index) => {
		hourly[`temperature_2m_member${String(index + 1).padStart(2, '0')}`] = series;
	});
	return { utc_offset_seconds: 7200, hourly };
}

describe('percentile', () => {
	it('su un solo valore restituisce quel valore', () => {
		expect(percentile([20], 0.1)).toBe(20);
	});

	it('la mediana di una serie dispari è il valore centrale', () => {
		expect(percentile([10, 20, 30], 0.5)).toBe(20);
	});

	it('la mediana di una serie pari è la media dei due centrali', () => {
		expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
	});

	it('interpola fra i due valori adiacenti invece di arrotondare l indice', () => {
		// Su 11 valori il 10° percentile cade esattamente sul secondo.
		const serie = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		expect(percentile(serie, 0.1)).toBe(1);
		// Su 6 valori cade fra il primo e il secondo: 0 + 0.5*(1-0) = 0.5
		expect(percentile([0, 1, 2, 3, 4, 5], 0.1)).toBeCloseTo(0.5, 2);
	});

	it('gli estremi sono il minimo e il massimo', () => {
		const serie = [5, 10, 15, 20];
		expect(percentile(serie, 0)).toBe(5);
		expect(percentile(serie, 1)).toBe(20);
	});

	it('su serie vuota restituisce NaN, non zero', () => {
		// Uno zero verrebbe disegnato come 0 °C: meglio un valore che il
		// chiamante deve scartare esplicitamente.
		expect(Number.isNaN(percentile([], 0.5))).toBe(true);
	});
});

describe('ensembleModel', () => {
	it('senza configurazione usa ICON-EU', () => {
		expect(ensembleModel()).toBe('icon_eu');
	});

	it('"off" disattiva la banda', () => {
		process.env.OPENMETEO_ENSEMBLE = 'off';
		expect(ensembleModel()).toBeNull();
	});

	it('accetta un modello diverso', () => {
		process.env.OPENMETEO_ENSEMBLE = 'gfs_seamless';
		expect(ensembleModel()).toBe('gfs_seamless');
	});
});

describe('fetchTemperatureBand', () => {
	it('calcola i percentili orari dai membri', async () => {
		// Cinque membri: 18, 19, 20, 21, 22 sulla prima ora.
		mock.onGet(/ensemble-api/).reply(
			200,
			ensembleResponse([
				[18, 19],
				[19, 20],
				[20, 21],
				[21, 22],
				[22, 23],
			])
		);

		const result = (await fetchTemperatureBand(LAT, LON))!;

		expect(result.bands).toHaveLength(2);
		const prima = result.bands[0]!;
		expect(prima.p50).toBe(20);
		expect(prima.p10).toBeCloseTo(18.4, 1);
		expect(prima.p90).toBeCloseTo(21.6, 1);
		expect(prima.members).toBe(5);
	});

	it('la banda si allarga dove i membri divergono', async () => {
		mock.onGet(/ensemble-api/).reply(
			200,
			ensembleResponse([
				[20, 10],
				[20, 20],
				[20, 30],
				[20, 40],
			])
		);

		const result = (await fetchTemperatureBand(LAT, LON))!;
		const concordi = result.bands[0]!;
		const divergenti = result.bands[1]!;

		expect(concordi.p90 - concordi.p10).toBe(0);
		expect(divergenti.p90 - divergenti.p10).toBeGreaterThan(15);
	});

	it('riconosce i membri per pattern, non per conteggio atteso', async () => {
		// Alcuni modelli suffissano anche il nome del modello nella chiave.
		mock.onGet(/ensemble-api/).reply(200, {
			utc_offset_seconds: 7200,
			hourly: {
				time: ['2026-09-12T14:00'],
				temperature_2m_icon_eu_member01: [18],
				temperature_2m_icon_eu_member02: [20],
				temperature_2m_icon_eu_member03: [22],
			},
		});

		const result = (await fetchTemperatureBand(LAT, LON))!;

		expect(result.bands[0]!.members).toBe(3);
		expect(result.bands[0]!.p50).toBe(20);
	});

	it('ignora i buchi di un singolo membro senza scartare l ora', async () => {
		mock.onGet(/ensemble-api/).reply(
			200,
			ensembleResponse([
				[18, 19],
				[null as any, 20],
				[20, 21],
				[22, 22],
			])
		);

		const result = (await fetchTemperatureBand(LAT, LON))!;

		expect(result.bands[0]!.members).toBe(3);
	});

	it('con meno di tre membri non inventa una banda', async () => {
		mock.onGet(/ensemble-api/).reply(200, ensembleResponse([[18, 19], [22, 23]]));

		await expect(fetchTemperatureBand(LAT, LON)).resolves.toBeNull();
	});

	it('con il modello disattivato non chiama nemmeno l API', async () => {
		process.env.OPENMETEO_ENSEMBLE = 'off';
		mock.onGet(/ensemble-api/).reply(200, ensembleResponse([[18], [20], [22]]));

		await expect(fetchTemperatureBand(LAT, LON)).resolves.toBeNull();
		expect(mock.history.get).toHaveLength(0);
	});

	it('su errore di rete restituisce null: è un arricchimento, non un requisito', async () => {
		mock.onGet(/ensemble-api/).networkError();
		await expect(fetchTemperatureBand(LAT, LON)).resolves.toBeNull();
	});

	it('su risposta senza serie oraria restituisce null', async () => {
		mock.onGet(/ensemble-api/).reply(200, { hourly: {} });
		await expect(fetchTemperatureBand(LAT, LON)).resolves.toBeNull();
	});

	it('chiede la temperatura oraria in ora locale', async () => {
		mock.onGet(/ensemble-api/).reply(200, ensembleResponse([[18], [20], [22]], ['2026-09-12T14:00']));

		await fetchTemperatureBand(LAT, LON);

		const params = mock.history.get[0]!.params;
		expect(params.hourly).toBe('temperature_2m');
		expect(params.models).toBe('icon_eu');
		expect(params.timezone).toBe('auto');
	});
});
