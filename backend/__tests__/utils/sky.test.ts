import {
	IDEAL_HIGH_CLOUD,
	type SkyHour,
	buildSkyOutlook,
	skyLevel,
	stargazingScore,
	sunsetScore,
} from '../../utils/sky';

/**
 * Tramonti e cielo notturno.
 *
 * L'intuizione che i test difendono è una sola: la copertura totale non basta,
 * conta la quota. Un cielo terso e uno coperto danno entrambi un tramonto
 * ordinario per ragioni opposte, e un solo numero di nuvolosità li confonde.
 */

function ora(time: string, over: Partial<SkyHour> = {}): SkyHour {
	return {
		time,
		cloud_cover: 20,
		cloud_cover_low: 10,
		cloud_cover_mid: 10,
		cloud_cover_high: 20,
		...over,
	};
}

describe('sunsetScore', () => {
	it('il cielo terso dà un tramonto ordinario: non c è niente da illuminare', () => {
		const score = sunsetScore(ora('2026-06-15T20:00', {
			cloud_cover_high: 0,
			cloud_cover_mid: 0,
			cloud_cover_low: 0,
		}))!;
		expect(score).toBe(0);
	});

	it('il cielo chiuso dà un tramonto ordinario per la ragione opposta', () => {
		const score = sunsetScore(ora('2026-06-15T20:00', {
			cloud_cover_high: 100,
			cloud_cover_mid: 100,
			cloud_cover_low: 100,
		}))!;
		expect(score).toBe(0);
	});

	it('nuvole alte a metà con orizzonte libero danno il massimo', () => {
		const score = sunsetScore(ora('2026-06-15T20:00', {
			cloud_cover_high: IDEAL_HIGH_CLOUD,
			cloud_cover_mid: 0,
			cloud_cover_low: 0,
		}))!;
		expect(score).toBe(100);
	});

	it('le nuvole basse spengono la scena più di quelle medie', () => {
		const basse = sunsetScore(ora('2026-06-15T20:00', {
			cloud_cover_high: 50,
			cloud_cover_mid: 0,
			cloud_cover_low: 60,
		}))!;
		const medie = sunsetScore(ora('2026-06-15T20:00', {
			cloud_cover_high: 50,
			cloud_cover_mid: 60,
			cloud_cover_low: 0,
		}))!;

		expect(basse).toBeLessThan(medie);
	});

	it('è un prodotto, non una somma: senza tela il punteggio è zero anche con orizzonte libero', () => {
		// Con una somma, il cielo terso prenderebbe comunque metà punteggio per
		// il solo fatto di non avere nuvole basse.
		expect(sunsetScore(ora('2026-06-15T20:00', {
			cloud_cover_high: 0,
			cloud_cover_mid: 0,
			cloud_cover_low: 0,
		}))).toBe(0);
	});

	it('senza le nuvole alte non si pronuncia', () => {
		expect(sunsetScore(ora('2026-06-15T20:00', { cloud_cover_high: null }))).toBeNull();
	});

	it('regge l assenza delle quote basse trattandole come libere', () => {
		const score = sunsetScore({
			time: '2026-06-15T20:00',
			cloud_cover_high: 50,
		})!;
		expect(score).toBe(100);
	});
});

describe('stargazingScore', () => {
	it('il cielo coperto azzera l osservazione', () => {
		expect(stargazingScore(100, 0)).toBe(0);
	});

	it('cielo terso e luna nuova danno il massimo', () => {
		expect(stargazingScore(0, 0)).toBe(100);
	});

	it('la luna piena penalizza ma non azzera: i pianeti si vedono comunque', () => {
		const pieno = stargazingScore(0, 100);
		expect(pieno).toBeGreaterThan(30);
		expect(pieno).toBeLessThan(50);
	});

	it('senza il dato lunare non inventa una penalità', () => {
		expect(stargazingScore(0, null)).toBe(100);
	});

	it('regge valori fuori scala invece di produrre punteggi assurdi', () => {
		expect(stargazingScore(150, 0)).toBe(0);
		expect(stargazingScore(-10, 0)).toBe(100);
	});
});

describe('skyLevel', () => {
	it('classifica l indice in quattro fasce', () => {
		expect(skyLevel(0)).toBe('plain');
		expect(skyLevel(24)).toBe('plain');
		expect(skyLevel(25)).toBe('fair');
		expect(skyLevel(50)).toBe('good');
		expect(skyLevel(75)).toBe('excellent');
		expect(skyLevel(100)).toBe('excellent');
	});
});

describe('buildSkyOutlook', () => {
	/** Una giornata con la copertura indicata a tutte le ore. */
	function giornata(date: string, over: Partial<SkyHour> = {}): SkyHour[] {
		return Array.from({ length: 24 }, (_, h) =>
			ora(`${date}T${String(h).padStart(2, '0')}:00`, over)
		);
	}

	it('valuta il tramonto nell ora in cui cade', () => {
		const hours = giornata('2026-06-15');
		const tramonto = hours.find((h) => h.time.endsWith('T20:00'))!;
		tramonto.cloud_cover_high = 50;
		tramonto.cloud_cover_mid = 0;
		tramonto.cloud_cover_low = 0;

		const sky = buildSkyOutlook({
			hours,
			sunset: '2026-06-15T20:44:00',
			moonIllumination: 10,
		})!;

		expect(sky.sunset!.at).toBe('2026-06-15T20:00');
		expect(sky.sunset!.score).toBe(100);
		expect(sky.sunset!.level).toBe('excellent');
	});

	it('prende le ore notturne a cavallo della mezzanotte', () => {
		// Con un intervallo «fra le 22 e le 3» non resterebbe nessuna ora.
		const hours = [...giornata('2026-06-15', { cloud_cover: 10 })];

		const sky = buildSkyOutlook({ hours, moonIllumination: 0 })!;

		expect(sky.stargazing).not.toBeNull();
		expect(sky.stargazing!.cloud_cover).toBe(10);
		expect(sky.stargazing!.score).toBe(90);
	});

	it('ricava la copertura totale dal massimo delle quote quando manca', () => {
		// Tre strati al 40% non fanno un cielo coperto al 120%.
		const hours = giornata('2026-06-15', {
			cloud_cover: null,
			cloud_cover_low: 40,
			cloud_cover_mid: 40,
			cloud_cover_high: 40,
		});

		const sky = buildSkyOutlook({ hours, moonIllumination: 0 })!;

		expect(sky.stargazing!.cloud_cover).toBe(40);
	});

	it('riporta l illuminazione lunare quando la conosciamo', () => {
		const sky = buildSkyOutlook({
			hours: giornata('2026-06-15'),
			moonIllumination: 72.4,
		})!;

		expect(sky.stargazing!.moon_illumination).toBe(72);
	});

	it('senza dato lunare lo dichiara invece di fingere luna nuova', () => {
		const sky = buildSkyOutlook({ hours: giornata('2026-06-15') })!;
		expect(sky.stargazing!.moon_illumination).toBeNull();
	});

	it('senza un tramonto nella finestra non lo inventa', () => {
		const sky = buildSkyOutlook({
			hours: giornata('2026-06-15'),
			sunset: '2026-06-20T20:44:00',
		})!;

		expect(sky.sunset).toBeNull();
		expect(sky.stargazing).not.toBeNull();
	});

	it('scarta gli slot precedenti all ora indicata', () => {
		const hours = giornata('2026-06-15');

		const sky = buildSkyOutlook({
			hours,
			sunset: '2026-06-15T20:44:00',
			fromTime: '2026-06-15T21:00',
		})!;

		// Il tramonto è già passato: non si riporta.
		expect(sky.sunset).toBeNull();
	});

	it('senza copertura per quota né totale non produce nulla', () => {
		const hours = giornata('2026-06-15', {
			cloud_cover: null,
			cloud_cover_low: null,
			cloud_cover_mid: null,
			cloud_cover_high: null,
		});

		expect(buildSkyOutlook({ hours })).toBeNull();
	});

	it('senza ore non produce nulla', () => {
		expect(buildSkyOutlook({ hours: [] })).toBeNull();
	});
});
