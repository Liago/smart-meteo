import {
	MIN_HOURS_PER_DAY,
	PERFORMANCE_RATIO,
	STC_IRRADIANCE_W,
	type SolarHour,
	buildSolarOutlook,
	specificYield,
} from '../../utils/solar';

/**
 * Resa fotovoltaica.
 *
 * Il conto è semplice — irraggiamento integrato diviso le condizioni standard,
 * per il rapporto di prestazione — ma è facile sbagliarlo per un fattore 1000
 * o per un giorno tagliato a metà, e in entrambi i casi il numero resta
 * plausibile a occhio. Sono i due casi che questi test difendono.
 */

function ore(count: number, over: Partial<SolarHour> = {}, base = '2026-06-15T00:00'): SolarHour[] {
	const start = new Date(`${base}:00Z`).getTime();
	return Array.from({ length: count }, (_, i) => ({
		time: new Date(start + i * 3600_000).toISOString().slice(0, 16),
		solar_irradiance: 0,
		sunshine_duration: 0,
		...over,
	}));
}

describe('specificYield', () => {
	it('mille W/m² per un ora sono un ora di sole equivalente', () => {
		// 1000 Wh/m² / 1000 W/m² = 1 h equivalente = 1 kWh/kWp prima delle
		// perdite; il rapporto di prestazione la riduce.
		expect(specificYield([STC_IRRADIANCE_W])).toBeCloseTo(PERFORMANCE_RATIO, 2);
	});

	it('somma le ore invece di mediarle', () => {
		// Mediando, dieci ore di sole pieno varrebbero quanto una: è l'errore
		// che rende la stima plausibile e sbagliata.
		expect(specificYield(Array(10).fill(STC_IRRADIANCE_W))).toBeCloseTo(10 * PERFORMANCE_RATIO, 2);
	});

	it('una giornata coperta produce poco ma non zero', () => {
		const resa = specificYield(Array(10).fill(120))!;
		expect(resa).toBeGreaterThan(0);
		expect(resa).toBeLessThan(1.5);
	});

	it('ignora i valori negativi da arrotondamento', () => {
		expect(specificYield([-5, STC_IRRADIANCE_W])).toBeCloseTo(PERFORMANCE_RATIO, 2);
	});

	it('senza dati non restituisce zero', () => {
		expect(specificYield([])).toBeNull();
		expect(specificYield([NaN])).toBeNull();
	});
});

describe('buildSolarOutlook', () => {
	/** Una giornata piena con una campana di irraggiamento plausibile. */
	function giornata(date: string, picco: number): SolarHour[] {
		return Array.from({ length: 24 }, (_, h) => {
			// Campana centrata a mezzogiorno, zero di notte.
			const fromNoon = Math.abs(h - 12);
			const value = fromNoon > 6 ? 0 : Math.round(picco * (1 - fromNoon / 6));
			return {
				time: `${date}T${String(h).padStart(2, '0')}:00`,
				solar_irradiance: value,
				sunshine_duration: value > 100 ? 3600 : 0,
			};
		});
	}

	it('riporta un giorno pieno con resa, picco e ore di sole', () => {
		const orto = buildSolarOutlook(giornata('2026-06-15', 900), 'tilted', 30, 0)!;

		expect(orto.days).toHaveLength(1);
		expect(orto.days[0]!.date).toBe('2026-06-15');
		expect(orto.days[0]!.peak_w).toBe(900);
		expect(orto.days[0]!.kwh_per_kwp).toBeGreaterThan(3);
		expect(orto.days[0]!.sunshine_hours).toBeGreaterThan(0);
	});

	it('scarta un giorno con copertura parziale', () => {
		// La giornata è già iniziata: riportarla intera sarebbe una sottostima
		// travestita da previsione.
		const parziale = giornata('2026-06-15', 900).slice(0, MIN_HOURS_PER_DAY - 1);

		expect(buildSolarOutlook(parziale, 'tilted', 30, 0)).toBeNull();
	});

	it('separa i giorni invece di sommarli', () => {
		const due = [...giornata('2026-06-15', 900), ...giornata('2026-06-16', 400)];

		const orto = buildSolarOutlook(due, 'tilted', 30, 0)!;

		expect(orto.days.map((d) => d.date)).toEqual(['2026-06-15', '2026-06-16']);
		expect(orto.days[0]!.kwh_per_kwp).toBeGreaterThan(orto.days[1]!.kwh_per_kwp);
	});

	it('dichiara il piano, l inclinazione e il rapporto di prestazione', () => {
		// Sono le assunzioni della stima: senza, il numero non è verificabile.
		const orto = buildSolarOutlook(giornata('2026-06-15', 900), 'horizontal', 30, 0)!;

		expect(orto.plane).toBe('horizontal');
		expect(orto.tilt_deg).toBe(30);
		expect(orto.azimuth_deg).toBe(0);
		expect(orto.performance_ratio).toBe(PERFORMANCE_RATIO);
	});

	it('scarta gli slot precedenti all ora indicata', () => {
		// Il sole di stamattina non è produzione futura: il giorno resta
		// incompleto e quindi non viene riportato.
		const giorno = giornata('2026-06-15', 900);

		expect(buildSolarOutlook(giorno, 'tilted', 30, 0, giorno[6]!.time)).toBeNull();
	});

	it('senza piano dichiarato non produce una stima', () => {
		// Non sapere su che piano è misurata la radiazione rende il numero
		// privo di significato.
		expect(buildSolarOutlook(giornata('2026-06-15', 900), null, 30, 0)).toBeNull();
	});

	it('senza irraggiamento non produce nulla', () => {
		expect(buildSolarOutlook(ore(24, { solar_irradiance: null }), 'tilted', 30, 0)).toBeNull();
	});

	it('senza ore di sole dichiarate riporta comunque la resa', () => {
		const senzaSole = giornata('2026-06-15', 900).map((h) => ({
			...h,
			sunshine_duration: null,
		}));

		const orto = buildSolarOutlook(senzaSole, 'tilted', 30, 0)!;

		expect(orto.days[0]!.sunshine_hours).toBeNull();
		expect(orto.days[0]!.kwh_per_kwp).toBeGreaterThan(0);
	});

	it('una notte polare non produce un giorno fantasma', () => {
		// Ventiquattro ore di buio: la copertura c'è, la resa è zero, e zero è
		// la risposta giusta — non l'assenza del giorno.
		const orto = buildSolarOutlook(ore(24, { solar_irradiance: 0 }), 'tilted', 30, 0)!;

		expect(orto.days).toHaveLength(1);
		expect(orto.days[0]!.kwh_per_kwp).toBe(0);
	});

	it('senza ore non produce nulla', () => {
		expect(buildSolarOutlook([], 'tilted', 30, 0)).toBeNull();
	});
});
