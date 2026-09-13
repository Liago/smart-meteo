/**
 * Verità osservata: Open-Meteo Archive con Meteostat come fonte alternativa.
 *
 * L'ordine dei due provider e il comportamento a mani vuote contano: se questo
 * modulo restituisse dati sbagliati o inventati, i pesi dinamici delle fonti
 * verrebbero corretti sulla base di un'osservazione falsa — peggio che non
 * correggerli affatto.
 */

import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

import {
	ARCHIVE_LAG_DAYS,
	fetchObservedTemperatures,
	hourKey,
	verificationDate,
} from '../../services/observations';

const WINDOW = { lat: 45.46, lon: 9.19, date: '2026-09-06' };

let mock: MockAdapter;
const METEOSTAT_ORIGINALE = process.env.METEOSTAT_KEY;

beforeEach(() => {
	mock = new MockAdapter(axios);
	process.env.METEOSTAT_KEY = 'test';
});

afterEach(() => {
	mock.restore();
	if (METEOSTAT_ORIGINALE === undefined) delete process.env.METEOSTAT_KEY;
	else process.env.METEOSTAT_KEY = METEOSTAT_ORIGINALE;
});

const archiveResponse = (temps: (number | null)[] = [18, 20, 22]) => ({
	hourly: {
		time: ['2026-09-06T12:00', '2026-09-06T13:00', '2026-09-06T14:00'],
		temperature_2m: temps,
	},
});

const meteostatResponse = () => ({
	data: [
		{ time: '2026-09-06 12:00:00', temp: 17.5 },
		{ time: '2026-09-06 13:00:00', temp: 19.5 },
	],
});

describe('verificationDate', () => {
	it('sta oltre il ritardo di pubblicazione dell archivio', () => {
		const now = new Date('2026-09-12T08:00:00Z');
		const date = verificationDate(now);

		const giorniIndietro = (now.getTime() - new Date(`${date}T08:00:00Z`).getTime()) / 86_400_000;
		expect(giorniIndietro).toBeCloseTo(ARCHIVE_LAG_DAYS, 0);
	});

	it('restituisce solo la data, senza ora', () => {
		expect(verificationDate(new Date('2026-09-12T23:30:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('hourKey', () => {
	it('normalizza i formati che i due provider usano', () => {
		// L'archivio manda "2026-09-06T14:00", Meteostat "2026-09-06 14:00:00".
		expect(hourKey('2026-09-06T14:00')).toBe('2026-09-06T14');
		expect(hourKey('2026-09-06 14:00:00')).toBe('2026-09-06T14');
	});
});

describe('fetchObservedTemperatures', () => {
	it('usa l archivio quando risponde, indicizzando per ora', async () => {
		mock.onGet(/archive-api/).reply(200, archiveResponse());

		const { temperatures, provider } = await fetchObservedTemperatures(WINDOW);

		expect(provider).toBe('archive');
		expect(temperatures.get('2026-09-06T13')).toBe(20);
		expect(temperatures.size).toBe(3);
	});

	it('non interroga Meteostat se l archivio ha i dati', async () => {
		mock.onGet(/archive-api/).reply(200, archiveResponse());
		mock.onGet(/meteostat/).reply(200, meteostatResponse());

		await fetchObservedTemperatures(WINDOW);

		expect(mock.history.get.filter((r) => /meteostat/.test(r.url ?? ''))).toHaveLength(0);
	});

	it('ricade su Meteostat quando l archivio non ha dati per quel punto', async () => {
		mock.onGet(/archive-api/).reply(200, { hourly: { time: [], temperature_2m: [] } });
		mock.onGet(/meteostat/).reply(200, meteostatResponse());

		const { temperatures, provider } = await fetchObservedTemperatures(WINDOW);

		expect(provider).toBe('meteostat');
		expect(temperatures.get('2026-09-06T12')).toBe(17.5);
	});

	it('ricade su Meteostat anche se l archivio va in errore', async () => {
		mock.onGet(/archive-api/).networkError();
		mock.onGet(/meteostat/).reply(200, meteostatResponse());

		const { provider } = await fetchObservedTemperatures(WINDOW);

		expect(provider).toBe('meteostat');
	});

	it('senza chiave Meteostat non tenta la chiamata', async () => {
		delete process.env.METEOSTAT_KEY;
		mock.onGet(/archive-api/).reply(200, { hourly: { time: [], temperature_2m: [] } });

		const { provider } = await fetchObservedTemperatures(WINDOW);

		expect(provider).toBe('none');
		expect(mock.history.get.filter((r) => /meteostat/.test(r.url ?? ''))).toHaveLength(0);
	});

	it('se nessuno risponde restituisce vuoto invece di lanciare', async () => {
		// La verifica dell'accuratezza è un lavoro di sfondo: un provider giù
		// non deve far cadere il job.
		mock.onGet(/archive-api/).networkError();
		mock.onGet(/meteostat/).reply(500);

		const { temperatures, provider } = await fetchObservedTemperatures(WINDOW);

		expect(provider).toBe('none');
		expect(temperatures.size).toBe(0);
	});

	it('scarta i buchi nella serie invece di trattarli come zeri', async () => {
		// L'archivio restituisce null sulle ore mancanti: contarle come 0 °C
		// falserebbe l'errore di tutte le fonti in quell'ora.
		mock.onGet(/archive-api/).reply(200, archiveResponse([18, null, 22]));

		const { temperatures } = await fetchObservedTemperatures(WINDOW);

		expect(temperatures.size).toBe(2);
		expect(temperatures.has('2026-09-06T13')).toBe(false);
	});

	it('chiede all archivio un solo giorno e la temperatura oraria', async () => {
		mock.onGet(/archive-api/).reply(200, archiveResponse());

		await fetchObservedTemperatures(WINDOW);

		const params = mock.history.get[0]!.params;
		expect(params.start_date).toBe(WINDOW.date);
		expect(params.end_date).toBe(WINDOW.date);
		expect(params.hourly).toBe('temperature_2m');
		// timezone:auto, così le chiavi orarie sono in ora locale come i
		// timestamp che l'engine archivia.
		expect(params.timezone).toBe('auto');
	});
});
