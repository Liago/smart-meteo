import {
	HORIZON_MAX_HOURS,
	RULE_METRICS,
	type AlertRule,
	evaluateRules,
	ruleMetric,
	validateRule,
} from '../../utils/alertRules';
import type { HourlyForecast } from '../../types';

/**
 * Regole di allerta personali.
 *
 * Le due cose che possono rovinare la feature non sono il confronto in sé:
 * sono la deduplica — un poller a 15 minuti manderebbe la stessa notifica
 * quattro volte l'ora — e le unità, perché la soglia la scrive una persona in
 * km/h mentre il contratto interno è in m/s.
 */

const START = '2026-03-20T18:00';

function ore(count: number, over: Partial<HourlyForecast> = {}, base = START): HourlyForecast[] {
	const start = new Date(`${base}:00Z`).getTime();
	return Array.from({ length: count }, (_, i) => ({
		time: new Date(start + i * 3600_000).toISOString().slice(0, 16),
		temp: 12,
		precipitation_prob: 10,
		condition_code: '1',
		condition_text: 'Sereno',
		...over,
	}));
}

function rule(over: Partial<AlertRule> = {}): AlertRule {
	return {
		id: 'r1',
		metric: 'temp_min',
		comparator: 'below',
		threshold: 0,
		horizon_hours: 24,
		...over,
	};
}

describe('registro delle metriche', () => {
	it('ogni metrica sa da dove leggere il proprio valore', () => {
		for (const metric of RULE_METRICS) {
			expect(metric.label).toBeTruthy();
			expect(metric.comparators.length).toBeGreaterThan(0);
			if (metric.aggregation === 'current') {
				expect(metric.fromCurrent).toBeDefined();
			} else {
				expect(metric.fromHour).toBeDefined();
			}
		}
	});

	it('gli id sono unici', () => {
		const ids = RULE_METRICS.map((m) => m.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('sulle metriche a senso unico non si può chiedere il verso opposto', () => {
		// Nessuno vuole essere avvisato quando il vento cala o quando piove meno.
		expect(ruleMetric('wind_gust')!.comparators).toEqual(['above']);
		expect(ruleMetric('precipitation_mm')!.comparators).toEqual(['above']);
		// Sulle temperature entrambi i versi: gelate d'inverno, notti tropicali
		// d'estate.
		expect(ruleMetric('temp_min')!.comparators).toContain('below');
		expect(ruleMetric('temp_min')!.comparators).toContain('above');
	});
});

describe('validateRule', () => {
	it('accetta una regola sensata', () => {
		expect(validateRule('temp_min', 'below', 0, 24)).toBeNull();
	});

	it('rifiuta una metrica che non esiste', () => {
		expect(validateRule('umore', 'above', 3, 24)).toMatch(/sconosciuta/i);
	});

	it('rifiuta un confronto che non ha senso sulla metrica', () => {
		expect(validateRule('precipitation_mm', 'below', 2, 24)).toMatch(/non ha senso/i);
	});

	it('rifiuta una soglia non numerica', () => {
		expect(validateRule('temp_min', 'below', '0' as unknown, 24)).toMatch(/numero/i);
		expect(validateRule('temp_min', 'below', NaN, 24)).toMatch(/numero/i);
	});

	it('rifiuta un orizzonte fuori scala o non intero', () => {
		expect(validateRule('temp_min', 'below', 0, 0)).toMatch(/orizzonte/i);
		expect(validateRule('temp_min', 'below', 0, HORIZON_MAX_HOURS + 1)).toMatch(/orizzonte/i);
		expect(validateRule('temp_min', 'below', 0, 12.5)).toMatch(/orizzonte/i);
	});
});

describe('evaluateRules', () => {
	it('non scatta quando la soglia non è superata', () => {
		const hits = evaluateRules([rule()], { hourly: ore(24, { temp: 8 }) });
		expect(hits).toHaveLength(0);
	});

	it('scatta sulla minima e indica l ora responsabile', () => {
		const finestra = ore(24, { temp: 8 });
		finestra[12]!.temp = -2;

		const hits = evaluateRules([rule()], { hourly: finestra });

		expect(hits).toHaveLength(1);
		expect(hits[0]!.value).toBe(-2);
		expect(hits[0]!.at).toBe(finestra[12]!.time);
		expect(hits[0]!.message).toMatch(/Temperatura minima sotto 0°: previsti -2° alle \d{2}:\d{2}/);
	});

	it('converte le raffiche in km/h, che è l unità in cui l utente scrive la soglia', () => {
		// 15 m/s sono 54 km/h: con il confronto sui m/s grezzi una soglia di
		// 50 km/h non scatterebbe mai.
		const finestra = ore(12, { wind_gust: 15 });

		const hits = evaluateRules(
			[rule({ metric: 'wind_gust', comparator: 'above', threshold: 50 })],
			{ hourly: finestra }
		);

		expect(hits).toHaveLength(1);
		expect(hits[0]!.value).toBe(54);
		expect(hits[0]!.message).toContain('54 km/h');
	});

	it('sui millimetri somma invece di prendere il massimo', () => {
		// Dieci ore da 9 mm non superano nessun massimo, ma sono 90 mm.
		const finestra = ore(10, { precipitation_mm: 9 });

		const hits = evaluateRules(
			[rule({ metric: 'precipitation_mm', comparator: 'above', threshold: 10 })],
			{ hourly: finestra }
		);

		expect(hits).toHaveLength(1);
		expect(hits[0]!.value).toBe(90);
		expect(hits[0]!.message).toMatch(/previsti 90,0 mm nelle prossime 24 ore/);
	});

	it('per una somma non dichiara un ora responsabile', () => {
		const hits = evaluateRules(
			[rule({ metric: 'precipitation_mm', comparator: 'above', threshold: 1 })],
			{ hourly: ore(6, { precipitation_mm: 2 }) }
		);

		expect(hits[0]!.at).toBeNull();
	});

	it('rispetta l orizzonte invece di guardare tutta la serie', () => {
		// Una gelata fra due giorni non è quella di stanotte.
		const finestra = ore(48, { temp: 8 });
		finestra[40]!.temp = -5;

		expect(evaluateRules([rule({ horizon_hours: 12 })], { hourly: finestra })).toHaveLength(0);
		expect(evaluateRules([rule({ horizon_hours: 48 })], { hourly: finestra })).toHaveLength(1);
	});

	it('scarta gli slot precedenti all ora indicata', () => {
		// Una gelata già avvenuta non è una previsione.
		const finestra = ore(12, { temp: 8 });
		finestra[0]!.temp = -6;

		const hits = evaluateRules([rule()], { hourly: finestra }, finestra[1]!.time);
		expect(hits).toHaveLength(0);
	});

	it('legge l AQI dal blocco corrente, non dalla serie oraria', () => {
		const hits = evaluateRules(
			[rule({ metric: 'aqi', comparator: 'above', threshold: 100 })],
			{ hourly: ore(6), current: { air_quality: { european_aqi: 118 } } }
		);

		expect(hits).toHaveLength(1);
		expect(hits[0]!.value).toBe(118);
		expect(hits[0]!.at).toBeNull();
		expect(hits[0]!.message).toMatch(/adesso 118/);
	});

	it('un campo assente non vale come soglia non superata', () => {
		// «Non lo sappiamo» non è «va tutto bene», ma nemmeno un allarme.
		const senzaAqi = evaluateRules(
			[rule({ metric: 'aqi', comparator: 'above', threshold: 100 })],
			{ hourly: ore(6), current: {} }
		);
		const senzaNeve = evaluateRules(
			[rule({ metric: 'snowfall_cm', comparator: 'above', threshold: 1 })],
			{ hourly: ore(6) }
		);

		expect(senzaAqi).toHaveLength(0);
		expect(senzaNeve).toHaveLength(0);
	});

	it('ignora le regole disabilitate e quelle su metriche sconosciute', () => {
		const finestra = ore(12, { temp: -5 });

		const hits = evaluateRules(
			[
				rule({ id: 'spenta', enabled: false }),
				rule({ id: 'ignota', metric: 'umore' }),
				rule({ id: 'attiva' }),
			],
			{ hourly: finestra }
		);

		expect(hits.map((h) => h.rule.id)).toEqual(['attiva']);
	});

	it('valuta più regole indipendentemente', () => {
		const finestra = ore(12, { temp: -3, wind_gust: 20 });

		const hits = evaluateRules(
			[
				rule({ id: 'gelo' }),
				rule({ id: 'vento', metric: 'wind_gust', comparator: 'above', threshold: 50 }),
			],
			{ hourly: finestra }
		);

		expect(hits.map((h) => h.rule.id).sort()).toEqual(['gelo', 'vento']);
	});

	it('regge il verso opposto sulle temperature: la notte tropicale', () => {
		const hits = evaluateRules(
			[rule({ metric: 'temp_min', comparator: 'above', threshold: 25 })],
			{ hourly: ore(12, { temp: 27 }) }
		);

		expect(hits).toHaveLength(1);
		expect(hits[0]!.message).toMatch(/Temperatura minima oltre 25°/);
	});

	it('senza serie oraria e senza corrente non scatta niente', () => {
		expect(evaluateRules([rule()], {})).toHaveLength(0);
	});

	it('senza regole non fa lavoro inutile', () => {
		expect(evaluateRules([], { hourly: ore(24, { temp: -10 }) })).toHaveLength(0);
	});
});

describe('deduplica', () => {
	it('la firma lega la regola al giorno dello scatto', () => {
		const finestra = ore(24, { temp: 8 });
		finestra[12]!.temp = -2;

		const hits = evaluateRules([rule()], { hourly: finestra });

		expect(hits[0]!.signature).toBe(`rule:r1:${finestra[12]!.time.slice(0, 10)}`);
	});

	it('due giri del poller sulla stessa situazione producono la stessa firma', () => {
		// È questo a impedire quattro notifiche l'ora.
		const finestra = ore(24, { temp: 8 });
		finestra[12]!.temp = -2;

		const primo = evaluateRules([rule()], { hourly: finestra });
		const secondo = evaluateRules([rule()], { hourly: finestra }, finestra[1]!.time);

		expect(secondo[0]!.signature).toBe(primo[0]!.signature);
	});

	it('una gelata di domani ha una firma diversa da quella di stanotte', () => {
		const stanotte = ore(24, { temp: 8 });
		stanotte[8]!.temp = -2;
		const domani = ore(48, { temp: 8 });
		domani[32]!.temp = -2;

		const a = evaluateRules([rule()], { hourly: stanotte });
		const b = evaluateRules([rule({ horizon_hours: 48 })], { hourly: domani });

		expect(a[0]!.signature).not.toBe(b[0]!.signature);
	});

	it('regole diverse non si zittiscono a vicenda', () => {
		const finestra = ore(12, { temp: -3, wind_gust: 20 });

		const hits = evaluateRules(
			[
				rule({ id: 'gelo' }),
				rule({ id: 'vento', metric: 'wind_gust', comparator: 'above', threshold: 50 }),
			],
			{ hourly: finestra }
		);

		expect(hits[0]!.signature).not.toBe(hits[1]!.signature);
	});
});
