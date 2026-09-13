import { SEA_THRESHOLDS, buildSeaOutlook, seaState } from '../../utils/sea';
import type { MarineHour } from '../../connectors/openmeteoMarine';

/**
 * Stato del mare.
 *
 * Il valore del blocco sta nel tradurre l'altezza d'onda in una parola: 1,3 m
 * scritto così sembra poco, ed è il mare che rovescia un pedalò. I test fissano
 * quella traduzione e il fatto che onda e temperatura siano stati istantanei,
 * non medie della giornata.
 */

function ore(count: number, over: Partial<MarineHour> = {}, base = '2026-07-20T10:00'): MarineHour[] {
	const start = new Date(`${base}:00Z`).getTime();
	return Array.from({ length: count }, (_, i) => ({
		time: new Date(start + i * 3600_000).toISOString().slice(0, 16),
		wave_height: 0.3,
		wave_direction: 180,
		wave_period: 5,
		swell_height: 0.2,
		sea_temperature: 24.3,
		...over,
	}));
}

describe('seaState', () => {
	it('traduce i metri nella scala dei bollettini italiani', () => {
		expect(seaState(0.2)).toBe('calm');
		expect(seaState(SEA_THRESHOLDS.slight)).toBe('slight');
		expect(seaState(1.0)).toBe('slight');
		expect(seaState(SEA_THRESHOLDS.moderate)).toBe('moderate');
		expect(seaState(2.0)).toBe('moderate');
		expect(seaState(SEA_THRESHOLDS.rough)).toBe('rough');
		expect(seaState(5)).toBe('rough');
	});

	it('senza onda non dichiara un mare agitato', () => {
		expect(seaState(null)).toBe('calm');
		expect(seaState(undefined)).toBe('calm');
	});
});

describe('buildSeaOutlook', () => {
	it('riporta onda e temperatura dell ora corrente, non la media', () => {
		const finestra = ore(24, { wave_height: 0.4, sea_temperature: 24.3 });
		finestra[12]!.wave_height = 3;

		const mare = buildSeaOutlook(finestra)!;

		expect(mare.wave_height).toBeCloseTo(0.4, 2);
		expect(mare.sea_temperature).toBeCloseTo(24.3, 1);
		expect(mare.state).toBe('calm');
	});

	it('riporta a parte il massimo atteso e quando arriva', () => {
		// È l'informazione che fa cambiare programma: il mare adesso è calmo,
		// nel pomeriggio no.
		const finestra = ore(24, { wave_height: 0.4 });
		finestra[8]!.wave_height = 1.8;

		const mare = buildSeaOutlook(finestra)!;

		expect(mare.max_wave_24h).toBeCloseTo(1.8, 2);
		expect(mare.max_wave_at).toBe(finestra[8]!.time);
	});

	it('si ferma a ventiquattro ore', () => {
		const finestra = ore(48, { wave_height: 0.3 });
		finestra[40]!.wave_height = 4;

		const mare = buildSeaOutlook(finestra)!;

		expect(mare.max_wave_24h).toBeCloseTo(0.3, 2);
	});

	it('scarta gli slot precedenti all ora indicata', () => {
		const finestra = ore(12, { wave_height: 0.3 });
		finestra[0]!.wave_height = 3;

		const mare = buildSeaOutlook(finestra, finestra[1]!.time)!;

		expect(mare.state).toBe('calm');
		expect(mare.max_wave_24h).toBeCloseTo(0.3, 2);
	});

	it('con la sola temperatura resta utile: è metà della domanda', () => {
		const mare = buildSeaOutlook(ore(12, { wave_height: null, swell_height: null }))!;

		expect(mare.sea_temperature).toBeCloseTo(24.3, 1);
		expect(mare.wave_height).toBeNull();
		expect(mare.max_wave_24h).toBeNull();
	});

	it('senza onda né temperatura non produce un riquadro', () => {
		// Sono le due domande a cui il blocco esiste per rispondere.
		const vuoto = ore(12, { wave_height: null, sea_temperature: null });

		expect(buildSeaOutlook(vuoto)).toBeNull();
	});

	it('senza ore non produce nulla', () => {
		expect(buildSeaOutlook([])).toBeNull();
	});
});
