/**
 * Contratto HTTP dell'API, esercitato attraverso l'app Express reale.
 *
 * Non verifica la meteorologia — quella è nei test dell'engine — ma le
 * risposte che i client vedono: codici di stato, forma del JSON, e i due
 * controlli di accesso (Bearer token sulle fonti, `X-Cron-Secret` sul poller).
 */

import request from 'supertest';

// -------------------------------------------------------------- mock setup

/** Sostituito test per test per pilotare l'esito dell'engine. */
let forecastImpl: (lat: number, lon: number) => Promise<any> = async (lat, lon) => ({
	location: { lat, lon },
	generated_at: '2026-09-12T14:00:00.000Z',
	sources_used: ['open-meteo'],
	current: { temperature: 24 },
	alerts: [],
});

jest.mock('../../engine/smartEngine', () => ({
	getSmartForecast: jest.fn((lat: number, lon: number) => forecastImpl(lat, lon)),
}));

/** Utente restituito da Supabase Auth: null = token non valido. */
let authUser: { id: string } | null = { id: 'user-1' };

jest.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		auth: {
			getUser: async () => ({
				data: { user: authUser },
				error: authUser ? null : { message: 'invalid token' },
			}),
		},
		from: () => {
			const chain: any = {
				select: () => chain,
				eq: () => chain,
				neq: () => chain,
				gt: () => chain,
				gte: () => chain,
				lt: () => chain,
				lte: () => chain,
				not: () => chain,
				in: () => chain,
				order: () => chain,
				limit: () => chain,
				single: async () => ({ data: null, error: null }),
				insert: async () => ({ error: null }),
				update: () => chain,
				delete: () => chain,
				then: (resolve: any) => resolve({ data: [], error: null, count: 0 }),
			};
			return chain;
		},
		rpc: async () => ({ data: null, error: null }),
	}),
}));

jest.mock('../../services/apns', () => ({
	initializeAPNs: jest.fn(),
	getAPNsHealthStatus: jest.fn(() => ({ configured: false, production: false })),
	sendPushNotification: jest.fn(async () => ({ sent: false, isExpiredToken: false })),
}));

jest.mock('../../services/alertPoller', () => ({
	pollAlerts: jest.fn(async () => ({ clusters: 2, alertsFound: 1, alertsProcessed: 1 })),
}));

jest.mock('../../services/accuracy', () => {
	const actual = jest.requireActual('../../services/accuracy');
	return {
		...actual,
		getAccuracyReport: jest.fn(async () => [
			{
				source_id: 'open-meteo:ecmwf',
				metric: 'temperature',
				mae: 0.9,
				sample_count: 120,
				window_days: 30,
				observation_source: 'archive',
				last_computed_at: '2026-09-12T04:10:00Z',
				weight_multiplier: 0.5263,
				affects_weight: true,
			},
			{
				source_id: 'accuweather',
				metric: 'temperature',
				mae: 3.4,
				sample_count: 4,
				window_days: 30,
				observation_source: 'archive',
				last_computed_at: null,
				weight_multiplier: 1,
				affects_weight: false,
			},
		]),
		recomputeAccuracy: jest.fn(async () => ({
			date: '2026-09-06',
			locations: 3,
			samples: 42,
			sourcesUpdated: 8,
			skipped: 1,
		})),
	};
});

import { app } from '../../app';
import { APP_BUILD, APP_VERSION } from '../../version';

beforeEach(() => {
	authUser = { id: 'user-1' };
	forecastImpl = async (lat, lon) => ({
		location: { lat, lon },
		generated_at: '2026-09-12T14:00:00.000Z',
		sources_used: ['open-meteo'],
		current: { temperature: 24 },
		alerts: [],
	});
});

// ------------------------------------------------------------------- tests

describe('GET /', () => {
	it('pubblica l elenco degli endpoint', async () => {
		const res = await request(app).get('/');
		expect(res.status).toBe(200);
		expect(res.body.service).toBe('Smart Meteo API');
		expect(res.body.endpoints).toContain('GET /api/forecast?lat=&lon=');
		expect(res.body.endpoints).toContain('GET /api/accuracy');
	});

	it('distingue la versione dell API da quella del software', async () => {
		const res = await request(app).get('/');
		// `api` è il contratto (v1, stabile fra i rilasci), `version` la build
		// che sta rispondendo: erano lo stesso campo, e una risposta sbagliata
		// non era attribuibile a un rilascio.
		expect(res.body.api).toBe('v1');
		expect(res.body.version).toBe(APP_VERSION);
	});
});

describe('GET /api/health', () => {
	it('risponde ok con un timestamp', async () => {
		const res = await request(app).get('/api/health');
		expect(res.status).toBe(200);
		expect(res.body.status).toBe('ok');
		expect(res.body.timestamp).toBeTruthy();
	});

	it('dichiara versione e build della funzione in esecuzione', async () => {
		const res = await request(app).get('/api/health');
		expect(res.body.version).toBe(APP_VERSION);
		expect(res.body.build).toBe(APP_BUILD);
	});
});

describe('GET /api/version', () => {
	/**
	 * Il caso che questo endpoint esiste per servire: dopo un rilascio,
	 * distinguere «il deploy è andato» da «Netlify sta ancora servendo la
	 * funzione precedente». Senza, la differenza non è osservabile.
	 */
	it('espone versione, build e forma completa', async () => {
		const res = await request(app).get('/api/version');

		expect(res.status).toBe(200);
		expect(res.body.service).toBe('smart-meteo-backend');
		expect(res.body.version).toBe(APP_VERSION);
		expect(res.body.build).toBe(APP_BUILD);
		expect(res.body.full).toBe(`${APP_VERSION}+${APP_BUILD}`);
	});

	it('è pubblico: nessun token richiesto', async () => {
		authUser = null;
		const res = await request(app).get('/api/version');
		expect(res.status).toBe(200);
	});
});

describe('GET /api/sources', () => {
	it('elenca i nove provider più i modelli Open-Meteo, con peso e stato', async () => {
		const res = await request(app).get('/api/sources');

		expect(res.status).toBe(200);
		// 9 provider storici + 5 modelli Open-Meteo registrati come fonti a sé.
		expect(res.body.sources.length).toBeGreaterThanOrEqual(9);
		expect(res.body.sources.map((s: any) => s.id)).toContain('open-meteo:icon_d2');
		for (const source of res.body.sources) {
			expect(source).toHaveProperty('id');
			expect(source).toHaveProperty('name');
			expect(typeof source.weight).toBe('number');
			expect(typeof source.active).toBe('boolean');
		}
	});

	it('non richiede autenticazione: è una lettura pubblica', async () => {
		const res = await request(app).get('/api/sources');
		expect(res.status).toBe(200);
	});
});

describe('PATCH /api/sources/:id', () => {
	it('senza header Authorization risponde 401', async () => {
		const res = await request(app).patch('/api/sources/open-meteo').send({ active: false });
		expect(res.status).toBe(401);
		expect(res.body.error).toMatch(/authorization/i);
	});

	it('con token non valido risponde 401', async () => {
		authUser = null;
		const res = await request(app)
			.patch('/api/sources/open-meteo')
			.set('Authorization', 'Bearer scaduto')
			.send({ active: false });
		expect(res.status).toBe(401);
	});

	it('con token valido cambia lo stato della fonte', async () => {
		const res = await request(app)
			.patch('/api/sources/open-meteo')
			.set('Authorization', 'Bearer valido')
			.send({ active: false });

		expect(res.status).toBe(200);

		const lista = await request(app).get('/api/sources');
		const fonte = lista.body.sources.find((s: any) => s.id === 'open-meteo');
		expect(fonte.active).toBe(false);

		// Ripristino: il registro delle fonti è in memoria e condiviso fra i test.
		await request(app)
			.patch('/api/sources/open-meteo')
			.set('Authorization', 'Bearer valido')
			.send({ active: true });
	});

	it('su una fonte inesistente risponde 404', async () => {
		const res = await request(app)
			.patch('/api/sources/non-esiste')
			.set('Authorization', 'Bearer valido')
			.send({ active: false });

		expect(res.status).toBe(404);
		expect(res.body.error).toMatch(/not found/i);
	});

	it('senza il campo active risponde 400', async () => {
		const res = await request(app)
			.patch('/api/sources/meteostat')
			.set('Authorization', 'Bearer valido')
			.send({});

		expect(res.status).toBe(400);
		expect(res.body.error).toMatch(/boolean/i);
	});

	it('con un body non JSON risponde 400 invece di crollare', async () => {
		// Il route ha un fallback per il body non parsato di Netlify Functions
		// (`typeof body === 'string'`), percorso che supertest non riproduce:
		// qui si verifica almeno che un body inatteso dia un 400 pulito.
		const res = await request(app)
			.patch('/api/sources/meteostat')
			.set('Authorization', 'Bearer valido')
			.set('Content-Type', 'text/plain')
			.send('non-json');

		expect(res.status).toBe(400);
	});
});

describe('GET /api/forecast', () => {
	it('senza coordinate risponde 400', async () => {
		const res = await request(app).get('/api/forecast');
		expect(res.status).toBe(400);
		expect(res.body.error).toMatch(/lat/i);
	});

	it('con una sola coordinata risponde 400', async () => {
		const res = await request(app).get('/api/forecast?lat=45.4');
		expect(res.status).toBe(400);
	});

	it('con coordinate valide restituisce la previsione', async () => {
		const res = await request(app).get('/api/forecast?lat=45.46&lon=9.19');

		expect(res.status).toBe(200);
		expect(res.body.location).toEqual({ lat: 45.46, lon: 9.19 });
		expect(res.body.current.temperature).toBe(24);
	});

	it('passa le coordinate all engine come numeri', async () => {
		let ricevute: [number, number] | null = null;
		forecastImpl = async (lat, lon) => {
			ricevute = [lat, lon];
			return { location: { lat, lon }, current: {}, sources_used: [] };
		};

		await request(app).get('/api/forecast?lat=45.46&lon=9.19');

		expect(ricevute).toEqual([45.46, 9.19]);
	});

	it('imposta Cache-Control per la CDN', async () => {
		const res = await request(app).get('/api/forecast?lat=45.46&lon=9.19');
		expect(res.headers['cache-control']).toContain('max-age=300');
		expect(res.headers['cache-control']).toContain('s-maxage=600');
	});

	it('se l engine solleva un errore risponde 500 in JSON, non in HTML', async () => {
		// Il client mostra `error` all utente: una pagina HTML di Express lo
		// romperebbe.
		forecastImpl = async () => {
			throw new Error('All weather sources failed to return data.');
		};

		const res = await request(app).get('/api/forecast?lat=45.46&lon=9.19');

		expect(res.status).toBe(500);
		expect(res.headers['content-type']).toMatch(/json/);
		expect(res.body.error).toMatch(/All weather sources failed/);
	});
});

describe('POST /api/alerts/poll', () => {
	const CRON_SECRET_ORIGINALE = process.env.CRON_SECRET;

	afterEach(() => {
		if (CRON_SECRET_ORIGINALE === undefined) delete process.env.CRON_SECRET;
		else process.env.CRON_SECRET = CRON_SECRET_ORIGINALE;
	});

	it('con il segreto corretto esegue il polling', async () => {
		process.env.CRON_SECRET = 'segreto';

		const res = await request(app)
			.post('/api/alerts/poll')
			.set('X-Cron-Secret', 'segreto');

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.clusters).toBe(2);
	});

	it('con il segreto sbagliato risponde 403', async () => {
		process.env.CRON_SECRET = 'segreto';

		const res = await request(app)
			.post('/api/alerts/poll')
			.set('X-Cron-Secret', 'sbagliato');

		expect(res.status).toBe(403);
	});

	it('senza header risponde 403 quando il segreto è configurato', async () => {
		process.env.CRON_SECRET = 'segreto';

		const res = await request(app).post('/api/alerts/poll');

		expect(res.status).toBe(403);
	});

	it('senza CRON_SECRET configurato l endpoint rifiuta, non resta aperto', async () => {
		// Fino alla Fase 6C, in assenza della variabile il controllo veniva
		// saltato: un deploy con la variabile dimenticata lasciava a chiunque la
		// possibilità di innescare polling e push.
		delete process.env.CRON_SECRET;

		const res = await request(app).post('/api/alerts/poll');

		expect(res.status).toBe(503);
		expect(res.body.error).toMatch(/CRON_SECRET/);
	});
});

describe('GET /api/accuracy', () => {
	it('è una lettura pubblica: rende verificabile il perché dei pesi', async () => {
		const res = await request(app).get('/api/accuracy');

		expect(res.status).toBe(200);
		expect(res.body.window_days).toBe(30);
		expect(res.body.sources).toHaveLength(2);
	});

	it('dichiara cosa misura, per non far passare il MAE per un altro numero', async () => {
		const res = await request(app).get('/api/accuracy');

		expect(res.body.metric_note).toMatch(/osservata/i);
		expect(res.body.observation_lag_days).toBeGreaterThan(0);
		expect(res.body.min_samples_for_weight).toBeGreaterThan(0);
	});

	it('distingue le fonti che pesano da quelle con troppi pochi campioni', async () => {
		const res = await request(app).get('/api/accuracy');

		const misurata = res.body.sources.find((s: any) => s.source_id === 'open-meteo:ecmwf');
		const provvisoria = res.body.sources.find((s: any) => s.source_id === 'accuweather');

		expect(misurata.affects_weight).toBe(true);
		expect(provvisoria.affects_weight).toBe(false);
		expect(provvisoria.weight_multiplier).toBe(1);
	});
});

describe('POST /api/accuracy/recompute', () => {
	const CRON_ORIGINALE = process.env.CRON_SECRET;

	afterEach(() => {
		if (CRON_ORIGINALE === undefined) delete process.env.CRON_SECRET;
		else process.env.CRON_SECRET = CRON_ORIGINALE;
	});

	it('con il segreto corretto esegue la verifica', async () => {
		process.env.CRON_SECRET = 'segreto';

		const res = await request(app)
			.post('/api/accuracy/recompute')
			.set('X-Cron-Secret', 'segreto');

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.samples).toBe(42);
	});

	it('con il segreto sbagliato risponde 403', async () => {
		process.env.CRON_SECRET = 'segreto';

		const res = await request(app)
			.post('/api/accuracy/recompute')
			.set('X-Cron-Secret', 'sbagliato');

		expect(res.status).toBe(403);
	});

	it('senza CRON_SECRET configurato rifiuta, come il poller allerte', async () => {
		delete process.env.CRON_SECRET;

		const res = await request(app).post('/api/accuracy/recompute');

		expect(res.status).toBe(503);
	});
});

describe('GET /api/alerts/active', () => {
	it('senza coordinate risponde 400', async () => {
		const res = await request(app).get('/api/alerts/active');
		expect(res.status).toBe(400);
	});

	it('con coordinate valide restituisce una lista', async () => {
		const res = await request(app).get('/api/alerts/active?lat=45.46&lon=9.19');
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body.alerts)).toBe(true);
	});
});

describe('GET /api/alerts/health', () => {
	it('riporta lo stato di APNs', async () => {
		const res = await request(app).get('/api/alerts/health');
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('apns');
	});
});

describe('CORS', () => {
	it('riflette l origine della richiesta e ammette i metodi usati dai client', async () => {
		const res = await request(app)
			.options('/api/forecast')
			.set('Origin', 'https://smart-meteo.vercel.app')
			.set('Access-Control-Request-Method', 'PATCH');

		expect(res.headers['access-control-allow-origin']).toBe('https://smart-meteo.vercel.app');
		expect(res.headers['access-control-allow-methods']).toContain('PATCH');
		expect(res.headers['access-control-allow-methods']).toContain('POST');
	});
});
