/**
 * Contratto HTTP delle regole di soglia personali.
 *
 * Quel che conta qui non è il CRUD in sé ma due cose: la validazione, che è
 * l'unica barriera fra un client distratto e una regola che non scatterà mai,
 * e il `deviceToken` come lasciapassare — senza, chiunque conoscesse un id
 * potrebbe leggere o spegnere le allerte di un altro.
 */

import request from 'supertest';

// -------------------------------------------------------------- mock setup

/** Esito delle operazioni su `alert_rules`, pilotato test per test. */
let ruleTableResult: { data: any; error: any } = { data: [], error: null };
/** Esito della lettura di `alert_subscriptions` (device iscritto o no). */
let subscriptionRows: any[] = [{ id: 'sub-1' }];
/** Filtri osservati sull'ultima query, per verificare il vincolo sul device. */
let lastFilters: Record<string, any> = {};

jest.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		auth: {
			getUser: async () => ({ data: { user: null }, error: { message: 'no token' } }),
		},
		from: (table: string) => {
			const chain: any = {
				select: () => chain,
				eq: (col: string, val: any) => {
					lastFilters[col] = val;
					return chain;
				},
				match: (filters: Record<string, any>) => {
					Object.assign(lastFilters, filters);
					return chain;
				},
				in: () => chain,
				order: () => chain,
				limit: () => chain,
				insert: () => chain,
				update: () => chain,
				delete: () => chain,
				single: async () =>
					table === 'alert_subscriptions'
						? { data: subscriptionRows[0] ?? null, error: null }
						: ruleTableResult,
				maybeSingle: async () =>
					table === 'alert_subscriptions'
						? { data: subscriptionRows[0] ?? null, error: null }
						: ruleTableResult,
				then: (resolve: any) =>
					resolve(
						table === 'alert_subscriptions'
							? { data: subscriptionRows, error: null }
							: ruleTableResult
					),
			};
			return chain;
		},
		rpc: async () => ({ data: null, error: null }),
	}),
}));

jest.mock('../../engine/smartEngine', () => ({
	getSmartForecast: jest.fn(async () => ({ current: {}, alerts: [] })),
	FORECAST_SCHEMA_VERSION: 11,
}));

jest.mock('../../services/apns', () => ({
	initializeAPNs: jest.fn(),
	getAPNsHealthStatus: jest.fn(() => ({ initialized: false, production: false })),
	sendPushNotification: jest.fn(async () => ({ sent: false, isExpiredToken: false })),
}));

jest.mock('../../services/alertPoller', () => ({
	pollAlerts: jest.fn(async () => ({
		clusters: 0,
		alertsFound: 0,
		alertsProcessed: 0,
		rulesTriggered: 0,
		rulesPushed: 0,
	})),
}));

import { app } from '../../app';

const TOKEN = 'device-token-abc';

beforeEach(() => {
	ruleTableResult = { data: [], error: null };
	subscriptionRows = [{ id: 'sub-1' }];
	lastFilters = {};
});

// --------------------------------------------------------------------- test

describe('GET /api/alerts/rules/metrics', () => {
	it('espone il registro delle metriche con unità e confronti ammessi', async () => {
		// I client costruiscono il form da qui invece di ricopiare il registro.
		const r = await request(app).get('/api/alerts/rules/metrics');

		expect(r.status).toBe(200);
		expect(Array.isArray(r.body.metrics)).toBe(true);
		const gelo = r.body.metrics.find((m: any) => m.id === 'temp_min');
		expect(gelo.label).toBe('Temperatura minima');
		expect(gelo.comparators).toContain('below');
		const vento = r.body.metrics.find((m: any) => m.id === 'wind_gust');
		expect(vento.unit).toBe(' km/h');
		expect(vento.comparators).toEqual(['above']);
		expect(r.body.horizon_default_hours).toBe(24);
	});
});

describe('POST /api/alerts/rules/list', () => {
	it('senza deviceToken risponde 400', async () => {
		const r = await request(app).post('/api/alerts/rules/list').send({});
		expect(r.status).toBe(400);
	});

	it('restituisce le regole del solo device che chiede', async () => {
		ruleTableResult = { data: [{ id: 'r1', metric: 'temp_min' }], error: null };

		const r = await request(app).post('/api/alerts/rules/list').send({ deviceToken: TOKEN });

		expect(r.status).toBe(200);
		expect(r.body.rules).toHaveLength(1);
		expect(lastFilters.device_token).toBe(TOKEN);
	});
});

describe('POST /api/alerts/rules', () => {
	const valida = { deviceToken: TOKEN, metric: 'temp_min', comparator: 'below', threshold: 0 };

	it('crea la regola e la restituisce', async () => {
		ruleTableResult = { data: { id: 'r1', ...valida, horizon_hours: 24 }, error: null };

		const r = await request(app).post('/api/alerts/rules').send(valida);

		expect(r.status).toBe(201);
		expect(r.body.rule.id).toBe('r1');
	});

	it('senza deviceToken risponde 400', async () => {
		const r = await request(app).post('/api/alerts/rules').send({ ...valida, deviceToken: undefined });
		expect(r.status).toBe(400);
	});

	it('rifiuta una metrica inesistente', async () => {
		const r = await request(app).post('/api/alerts/rules').send({ ...valida, metric: 'umore' });
		expect(r.status).toBe(400);
		expect(r.body.error).toMatch(/sconosciuta/i);
	});

	it('rifiuta un confronto che non ha senso sulla metrica', async () => {
		// «Avvisami se piove meno di 2 mm» non è una richiesta di nessuno.
		const r = await request(app)
			.post('/api/alerts/rules')
			.send({ ...valida, metric: 'precipitation_mm', comparator: 'below', threshold: 2 });

		expect(r.status).toBe(400);
		expect(r.body.error).toMatch(/non ha senso/i);
	});

	it('rifiuta una soglia non numerica e un orizzonte fuori scala', async () => {
		const soglia = await request(app).post('/api/alerts/rules').send({ ...valida, threshold: 'zero' });
		const orizzonte = await request(app).post('/api/alerts/rules').send({ ...valida, horizonHours: 200 });

		expect(soglia.status).toBe(400);
		expect(orizzonte.status).toBe(400);
	});

	it('rifiuta la regola di un device non iscritto', async () => {
		// Senza subscription non c'è una località su cui valutarla: la regola
		// esisterebbe senza poter scattare mai.
		subscriptionRows = [];

		const r = await request(app).post('/api/alerts/rules').send(valida);

		expect(r.status).toBe(409);
		expect(r.body.error).toMatch(/subscribe/i);
	});

	it('una regola identica non è un errore: restituisce quella esistente', async () => {
		ruleTableResult = { data: null, error: { code: '23505', message: 'duplicate key' } };

		const r = await request(app).post('/api/alerts/rules').send(valida);

		expect(r.status).toBe(200);
		expect(r.body.duplicate).toBe(true);
	});
});

describe('PATCH /api/alerts/rules/:id', () => {
	it('abilita o disabilita la regola', async () => {
		ruleTableResult = { data: { id: 'r1', enabled: false }, error: null };

		const r = await request(app)
			.patch('/api/alerts/rules/r1')
			.send({ deviceToken: TOKEN, enabled: false });

		expect(r.status).toBe(200);
		expect(r.body.rule.enabled).toBe(false);
	});

	it('vincola l aggiornamento al device che possiede la regola', async () => {
		// Senza questo, chi conoscesse un id potrebbe spegnere le allerte altrui.
		ruleTableResult = { data: { id: 'r1', enabled: true }, error: null };

		await request(app).patch('/api/alerts/rules/r1').send({ deviceToken: TOKEN, enabled: true });

		expect(lastFilters.device_token).toBe(TOKEN);
		expect(lastFilters.id).toBe('r1');
	});

	it('senza enabled booleano risponde 400', async () => {
		const r = await request(app).patch('/api/alerts/rules/r1').send({ deviceToken: TOKEN });
		expect(r.status).toBe(400);
	});

	it('una regola di un altro device è 404, non 200', async () => {
		ruleTableResult = { data: null, error: null };

		const r = await request(app)
			.patch('/api/alerts/rules/r1')
			.send({ deviceToken: 'altro-device', enabled: false });

		expect(r.status).toBe(404);
	});
});

describe('DELETE /api/alerts/rules/:id', () => {
	it('elimina la regola del proprio device', async () => {
		ruleTableResult = { data: { id: 'r1' }, error: null };

		const r = await request(app).delete('/api/alerts/rules/r1').send({ deviceToken: TOKEN });

		expect(r.status).toBe(200);
		expect(lastFilters.device_token).toBe(TOKEN);
	});

	it('senza deviceToken risponde 400', async () => {
		const r = await request(app).delete('/api/alerts/rules/r1').send({});
		expect(r.status).toBe(400);
	});

	it('una regola inesistente è 404', async () => {
		ruleTableResult = { data: null, error: null };

		const r = await request(app).delete('/api/alerts/rules/r1').send({ deviceToken: TOKEN });

		expect(r.status).toBe(404);
	});
});
