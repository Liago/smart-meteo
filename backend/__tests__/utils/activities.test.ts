import {
	airScore,
	buildActivities,
	comfortScore,
	dryAirScore,
	drynessScore,
	dryingTempScore,
	dryingWindScore,
	uvScore,
	windScore,
} from '../../utils/activities';
import type { HourlyForecast } from '../../types';

/**
 * Indici «buona giornata per…».
 *
 * La decisione che i test difendono è che il punteggio sia il **minimo** dei
 * fattori e non la media: una giornata mite e ventilata sotto il diluvio non è
 * una mezza giornata buona, e una media nasconderebbe proprio il fattore che fa
 * rinunciare.
 */

function ore(count: number, over: Partial<HourlyForecast> = {}, date = '2026-05-20'): HourlyForecast[] {
	return Array.from({ length: count }, (_, i) => ({
		time: `${date}T${String(i).padStart(2, '0')}:00`,
		temp: 16,
		feels_like: 16,
		precipitation_prob: 5,
		precipitation_mm: 0,
		wind_speed: 2,
		humidity: 50,
		uv_index: 3,
		condition_code: '1',
		condition_text: 'Sereno',
		...over,
	}));
}

describe('fattori', () => {
	it('il comfort è pieno dentro la fascia e cala fuori', () => {
		expect(comfortScore(12, 8, 18, 12)).toBe(100);
		expect(comfortScore(8, 8, 18, 12)).toBe(100);
		expect(comfortScore(24, 8, 18, 12)).toBe(50);
		expect(comfortScore(30, 8, 18, 12)).toBe(0);
		expect(comfortScore(null, 8, 18, 12)).toBeNull();
	});

	it('l asciutto guarda probabilità e quantità insieme', () => {
		// 90% per 0.2 mm è una spruzzata; 8 mm al 40% rovinano tutto.
		expect(drynessScore(90, 0.2)).toBe(10);
		expect(drynessScore(40, 8)).toBe(0);
		expect(drynessScore(0, 0)).toBe(100);
		expect(drynessScore(null, null)).toBeNull();
	});

	it('il vento penalizza oltre la soglia comoda', () => {
		expect(windScore(10, 20, 45)).toBe(100);
		expect(windScore(45, 20, 45)).toBe(0);
		expect(windScore(null, 20, 45)).toBeNull();
	});

	it('gli UV e l aria hanno le loro scale', () => {
		expect(uvScore(4, 6)).toBe(100);
		expect(uvScore(12, 6)).toBe(0);
		expect(airScore(15)).toBe(100);
		expect(airScore(100)).toBe(0);
		expect(airScore(null)).toBeNull();
	});

	it('l umidità è piena fino alla soglia, non lineare', () => {
		// Con `100 - umidità`, il 50% — aria perfettamente normale in cui il
		// bucato asciuga benissimo — darebbe 50 su 100, e qualunque giornata
		// ordinaria sembrerebbe mediocre.
		expect(dryAirScore(50)).toBe(100);
		expect(dryAirScore(65)).toBe(100);
		expect(dryAirScore(80)).toBe(50);
		expect(dryAirScore(95)).toBe(0);
		expect(dryAirScore(null)).toBeNull();
	});

	it('per il bucato il vento è un fattore invertito: aiuta', () => {
		// È l'unico del registro, e per questo sta in una funzione a sé. Il
		// minimo è alto perché il vento è un bonus, non un requisito: con un
		// minimo basso «vento» limiterebbe qualunque giornata serena e calma.
		expect(dryingWindScore(0)).toBe(80);
		expect(dryingWindScore(15)).toBe(100);
		expect(dryingWindScore(40)).toBe(100);
	});

	it('il bucato tiene conto della temperatura', () => {
		// Senza, il registro direbbe «stendi pure» a 3 °C con aria asciutta.
		expect(dryingTempScore(18)).toBe(100);
		expect(dryingTempScore(9)).toBe(50);
		expect(dryingTempScore(3)).toBe(0);
		expect(dryingTempScore(null)).toBeNull();
	});
});

describe('buildActivities', () => {
	it('una giornata mite e asciutta è buona per tutto', () => {
		const out = buildActivities(ore(24, { feels_like: 16, uv_index: 3 }), 20)!;

		expect(out.activities).toHaveLength(3);
		for (const a of out.activities) {
			expect(a.score).toBeGreaterThan(80);
			expect(a.limiting).toBeNull();
		}
	});

	it('il punteggio è il minimo dei fattori, non la media', () => {
		// Mite, ventilata il giusto, aria pulita — ma piove forte. Con una
		// media resterebbe una mezza giornata buona.
		const out = buildActivities(
			ore(24, { feels_like: 15, precipitation_prob: 95, precipitation_mm: 4 }),
			20
		)!;

		const corsa = out.activities.find((a) => a.id === 'running')!;
		expect(corsa.score).toBe(0);
		expect(corsa.limiting).toBe('pioggia');
	});

	it('nomina il fattore che limita, non solo il numero', () => {
		// «65» non dice niente, «65, limita il vento» dice se cambiare percorso.
		const out = buildActivities(ore(24, { feels_like: 15, wind_speed: 6 }), 20)!;

		const bici = out.activities.find((a) => a.id === 'cycling')!;
		expect(bici.limiting).toBe('vento');
		expect(bici.score).toBeLessThan(80);
	});

	it('in bici il vento pesa più che a piedi', () => {
		const out = buildActivities(ore(24, { feels_like: 15, wind_speed: 5 }), 20)!;

		const corsa = out.activities.find((a) => a.id === 'running')!;
		const bici = out.activities.find((a) => a.id === 'cycling')!;
		expect(bici.score).toBeLessThan(corsa.score);
	});

	it('sopra la soglia non dichiara un fattore limitante che non c è', () => {
		const out = buildActivities(ore(24, { feels_like: 16 }), 10)!;
		expect(out.activities.every((a) => a.limiting === null)).toBe(true);
	});

	it('al freddo il bucato lo dice, invece di mandarti a stendere', () => {
		const out = buildActivities(ore(24, { feels_like: 4, humidity: 50 }), 10)!;

		const bucato = out.activities.find((a) => a.id === 'laundry')!;
		expect(bucato.limiting).toBe('temperatura');
		expect(bucato.score).toBeLessThan(30);
	});

	it('la probabilità di pioggia è un massimo, non una media', () => {
		// Un'ora al 95% in mezzo a undici serene è comunque da rimandare.
		const finestra = ore(24, { feels_like: 15 });
		finestra[14]!.precipitation_prob = 95;

		const out = buildActivities(finestra, 20)!;
		const corsa = out.activities.find((a) => a.id === 'running')!;

		expect(corsa.limiting).toBe('pioggia');
	});

	it('ordina dalla migliore alla peggiore', () => {
		const out = buildActivities(ore(24, { feels_like: 15, wind_speed: 6 }), 20)!;
		const punteggi = out.activities.map((a) => a.score);
		expect(punteggi).toEqual([...punteggi].sort((a, b) => b - a));
	});

	it('valuta solo le ore diurne', () => {
		// Una notte gelida non rende la giornata cattiva per correre.
		const finestra = ore(24, { feels_like: 15 });
		for (const h of finestra.slice(0, 6)) h.feels_like = -15;

		const out = buildActivities(finestra, 20)!;

		expect(out.from).toMatch(/T08:00$/);
		expect(out.activities.find((a) => a.id === 'running')!.score).toBeGreaterThan(80);
	});

	it('di sera la finestra scivola a domani', () => {
		// «Buona giornata per correre» alle 23 significa domani.
		const oggi = ore(24, { feels_like: 15 }, '2026-05-20');
		const domani = ore(24, { feels_like: 15 }, '2026-05-21');

		const out = buildActivities([...oggi, ...domani], 20, '2026-05-20T21:00')!;

		expect(out.date).toBe('2026-05-21');
	});

	it('non mescola il pomeriggio di oggi con la mattina di domani', () => {
		// Un punteggio a cavallo di due giorni non varrebbe per nessuno dei due.
		const oggi = ore(24, { feels_like: 15 }, '2026-05-20');
		const domani = ore(24, { feels_like: 15 }, '2026-05-21');

		const out = buildActivities([...oggi, ...domani], 20, '2026-05-20T16:00')!;

		expect(out.date).toBe('2026-05-20');
		expect(out.to).toMatch(/^2026-05-20/);
	});

	it('senza qualità dell aria gli indici restano calcolabili', () => {
		const out = buildActivities(ore(24, { feels_like: 15 }), null)!;
		expect(out.activities).toHaveLength(3);
	});

	it('senza ore diurne non produce nulla', () => {
		const notte = ore(6, { feels_like: 15 }, '2026-05-20');
		expect(buildActivities(notte, 20)).toBeNull();
	});

	it('senza ore non produce nulla', () => {
		expect(buildActivities([], 20)).toBeNull();
	});
});
