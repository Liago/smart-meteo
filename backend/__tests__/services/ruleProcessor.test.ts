/**
 * Invio delle notifiche per le regole di soglia.
 *
 * La parte che vale la pena difendere non è il confronto — quello è testato in
 * `utils/alertRules` — ma la **prenotazione prima della push**: è l'unica cosa
 * che impedisce a due giri concorrenti del poller di mandare la stessa
 * notifica, e a un fallimento di APNs di far sparire lo scatto per sempre.
 */

import type { HourlyForecast } from '../../types';

/** Righe di `alert_rules` restituite dalla query. */
let rules: any[] = [];
/** Esito dell'insert in `alert_rule_hits`: `null` = prenotazione riuscita. */
let claimError: { code?: string; message: string } | null = null;
/** Operazioni osservate, per verificare rilasci e aggiornamenti. */
let operations: { table: string; op: string; payload?: any }[] = [];

jest.mock('../../services/supabase', () => {
	const chain = (table: string): any => {
		const self: any = {
			select: () => self,
			eq: () => self,
			in: () => self,
			match: () => self,
			insert: async (payload: any) => {
				operations.push({ table, op: 'insert', payload });
				return table === 'alert_rule_hits' ? { error: claimError } : { error: null };
			},
			update: (payload: any) => {
				operations.push({ table, op: 'update', payload });
				return self;
			},
			delete: () => {
				operations.push({ table, op: 'delete' });
				return self;
			},
			then: (resolve: any) =>
				resolve(table === 'alert_rules' ? { data: rules, error: null } : { data: [], error: null }),
		};
		return self;
	};

	return { supabase: { from: (table: string) => chain(table) } };
});

/** Esito della push, pilotato test per test. */
let pushResult = { sent: true, isExpiredToken: false, reason: undefined as string | undefined };
const sendPushNotification = jest.fn(async () => pushResult);

jest.mock('../../services/apns', () => ({
	sendPushNotification: (...args: any[]) => sendPushNotification(...(args as [])),
}));

import { processAlertRules } from '../../services/ruleProcessor';

// ------------------------------------------------------------------ helpers

const DEVICE = 'device-token-abc';

function ore(count: number, over: Partial<HourlyForecast> = {}): HourlyForecast[] {
	const start = new Date('2026-03-20T18:00:00Z').getTime();
	return Array.from({ length: count }, (_, i) => ({
		time: new Date(start + i * 3600_000).toISOString().slice(0, 16),
		temp: 12,
		precipitation_prob: 10,
		condition_code: '1',
		condition_text: 'Sereno',
		...over,
	}));
}

const REGOLA_GELO = {
	id: 'r1',
	device_token: DEVICE,
	metric: 'temp_min',
	comparator: 'below',
	threshold: 0,
	horizon_hours: 24,
	enabled: true,
};

beforeEach(() => {
	rules = [REGOLA_GELO];
	claimError = null;
	operations = [];
	pushResult = { sent: true, isExpiredToken: false, reason: undefined };
	sendPushNotification.mockClear();
});

// --------------------------------------------------------------------- test

describe('processAlertRules', () => {
	it('senza device non fa alcuna query', async () => {
		const stats = await processAlertRules([], { hourly: ore(12, { temp: -5 }) });

		expect(stats.hits).toBe(0);
		expect(operations).toHaveLength(0);
	});

	it('non notifica quando la soglia non è superata', async () => {
		const stats = await processAlertRules([DEVICE], { hourly: ore(12, { temp: 8 }) });

		expect(stats.hits).toBe(0);
		expect(sendPushNotification).not.toHaveBeenCalled();
	});

	it('prenota lo scatto PRIMA di inviare la push', async () => {
		// L'ordine è la garanzia: invertirlo lascerebbe una finestra in cui due
		// invocazioni concorrenti mandano entrambe la notifica.
		await processAlertRules([DEVICE], { hourly: ore(12, { temp: -3 }) });

		const prenotazione = operations.findIndex(
			(o) => o.table === 'alert_rule_hits' && o.op === 'insert'
		);
		expect(prenotazione).toBeGreaterThanOrEqual(0);
		expect(sendPushNotification).toHaveBeenCalledTimes(1);
		expect(operations[prenotazione]!.payload.delivery_status).toBe('pending');
	});

	it('il messaggio della push contiene il valore, non solo la soglia', async () => {
		await processAlertRules([DEVICE], { hourly: ore(12, { temp: -3 }) });

		const [, titolo, corpo] = sendPushNotification.mock.calls[0] as unknown as string[];
		expect(titolo).toContain('Temperatura minima');
		expect(corpo).toMatch(/previsti -3°/);
	});

	it('marca l invio riuscito', async () => {
		const stats = await processAlertRules([DEVICE], { hourly: ore(12, { temp: -3 }) });

		expect(stats.pushSent).toBe(1);
		const update = operations.find((o) => o.table === 'alert_rule_hits' && o.op === 'update');
		expect(update!.payload.delivery_status).toBe('sent');
	});

	it('uno scatto già notificato non riparte', async () => {
		// Il poller gira ogni 15 minuti: senza questo, quattro notifiche l'ora.
		claimError = { code: '23505', message: 'duplicate key' };

		const stats = await processAlertRules([DEVICE], { hourly: ore(12, { temp: -3 }) });

		expect(stats.skippedDuplicate).toBe(1);
		expect(sendPushNotification).not.toHaveBeenCalled();
	});

	it('se la prenotazione fallisce per altri motivi non invia comunque', async () => {
		// Fail-closed: senza la riga di deduplica la notifica ripartirebbe a
		// ogni giro. Meglio una mancata che quattro l'ora.
		claimError = { code: '42P01', message: 'relation "alert_rule_hits" does not exist' };

		const stats = await processAlertRules([DEVICE], { hourly: ore(12, { temp: -3 }) });

		expect(stats.claimFailed).toBe(1);
		expect(sendPushNotification).not.toHaveBeenCalled();
	});

	it('un fallimento transitorio di APNs rilascia la prenotazione', async () => {
		// Altrimenti lo scatto resterebbe marcato come preso in carico e non
		// verrebbe mai più tentato.
		pushResult = { sent: false, isExpiredToken: false, reason: 'ServiceUnavailable' };

		const stats = await processAlertRules([DEVICE], { hourly: ore(12, { temp: -3 }) });

		expect(stats.pushFailed).toBe(1);
		expect(operations.some((o) => o.table === 'alert_rule_hits' && o.op === 'delete')).toBe(true);
	});

	it('un token scaduto disabilita le regole del device invece di cancellarle', async () => {
		// Se l'app viene reinstallata sullo stesso telefono, l'utente ritrova
		// le sue soglie.
		pushResult = { sent: false, isExpiredToken: true, reason: 'BadDeviceToken' };

		const stats = await processAlertRules([DEVICE], { hourly: ore(12, { temp: -3 }) });

		expect(stats.expiredTokens).toBe(1);
		const update = operations.find((o) => o.table === 'alert_rules' && o.op === 'update');
		expect(update!.payload).toEqual({ enabled: false });
		expect(operations.some((o) => o.table === 'alert_rules' && o.op === 'delete')).toBe(false);
	});

	it('con un token scaduto la prenotazione NON viene rilasciata', async () => {
		// Il telefono non esiste più: riprovare a ogni giro sarebbe solo lavoro
		// sprecato finché non si ri-registra.
		pushResult = { sent: false, isExpiredToken: true, reason: 'BadDeviceToken' };

		await processAlertRules([DEVICE], { hourly: ore(12, { temp: -3 }) });

		expect(operations.some((o) => o.table === 'alert_rule_hits' && o.op === 'delete')).toBe(false);
	});

	it('valuta le regole di più device sulla stessa previsione', async () => {
		const altro = 'device-token-xyz';
		rules = [REGOLA_GELO, { ...REGOLA_GELO, id: 'r2', device_token: altro }];

		const stats = await processAlertRules([DEVICE, altro], { hourly: ore(12, { temp: -3 }) });

		expect(stats.devices).toBe(2);
		expect(stats.hits).toBe(2);
		expect(sendPushNotification).toHaveBeenCalledTimes(2);
	});

	it('più regole dello stesso device scattano indipendentemente', async () => {
		rules = [
			REGOLA_GELO,
			{ ...REGOLA_GELO, id: 'r2', metric: 'wind_gust', comparator: 'above', threshold: 50 },
		];

		const stats = await processAlertRules([DEVICE], {
			hourly: ore(12, { temp: -3, wind_gust: 20 }),
		});

		expect(stats.hits).toBe(2);
		expect(sendPushNotification).toHaveBeenCalledTimes(2);
	});

	it('senza regole non tocca APNs', async () => {
		rules = [];

		const stats = await processAlertRules([DEVICE], { hourly: ore(12, { temp: -20 }) });

		expect(stats.evaluated).toBe(0);
		expect(sendPushNotification).not.toHaveBeenCalled();
	});
});
