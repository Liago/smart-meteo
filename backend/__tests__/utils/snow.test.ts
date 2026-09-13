import {
	MELT_MARGIN_M,
	PHASE_MARGIN_M,
	aggregateSnowfallCm,
	buildSnowOutlook,
	frostLevel,
	snowLineFrom,
	snowPhase,
	type SnowHour,
} from '../../utils/snow';

/**
 * Neve e gelate.
 *
 * Le funzioni sono pure, ma le regole che incarnano non sono ovvie: la quota
 * neve non coincide con lo zero termico, il manto non si somma e la fase non è
 * decidibile a ridosso della quota. Sono queste le cose che i test devono
 * difendere da una semplificazione futura.
 */

/** Costruisce una finestra oraria a partire dall'ora indicata. */
function hours(count: number, over: Partial<SnowHour> = {}, base = '2026-01-15T08:00'): SnowHour[] {
	const start = new Date(`${base}:00Z`).getTime();
	return Array.from({ length: count }, (_, i) => ({
		time: new Date(start + i * 3600_000).toISOString().slice(0, 16),
		temp: 5,
		...over,
	}));
}

describe('snowLineFrom', () => {
	it('sottrae il margine di fusione allo zero termico', () => {
		// Il fiocco continua a scendere raffreddando l'aria: non si ferma
		// all'isoterma di 0 °C.
		expect(snowLineFrom(1500)).toBe(1500 - MELT_MARGIN_M);
	});

	it('arrotonda al passo di 50 metri', () => {
		// 1327 - 300 = 1027 → 1050: i modelli non risolvono meglio di così.
		expect(snowLineFrom(1327)).toBe(1050);
		expect(snowLineFrom(1310)).toBe(1000);
	});

	it('non scende sotto lo zero', () => {
		// "Quota neve -120 m" è un modo goffo di dire che nevica ovunque.
		expect(snowLineFrom(180)).toBe(0);
		expect(snowLineFrom(0)).toBe(0);
	});

	it('senza zero termico non inventa una quota', () => {
		expect(snowLineFrom(null)).toBeNull();
		expect(snowLineFrom(undefined)).toBeNull();
		expect(snowLineFrom(NaN)).toBeNull();
	});
});

describe('snowPhase', () => {
	it('sopra la quota neve nevica', () => {
		expect(snowPhase(1000, 1000 + PHASE_MARGIN_M)).toBe('snow');
		expect(snowPhase(1000, 2000)).toBe('snow');
	});

	it('sotto la quota neve piove', () => {
		expect(snowPhase(1000, 1000 - PHASE_MARGIN_M)).toBe('rain');
		expect(snowPhase(1000, 120)).toBe('rain');
	});

	it('a ridosso della quota dichiara la mista invece di tirare a indovinare', () => {
		// 30 metri di differenza non li risolve nessun modello.
		expect(snowPhase(1000, 1030)).toBe('sleet');
		expect(snowPhase(1000, 970)).toBe('sleet');
		expect(snowPhase(1000, 1000)).toBe('sleet');
	});

	it('senza quota della località non si pronuncia', () => {
		expect(snowPhase(1000, null)).toBeNull();
		expect(snowPhase(null, 300)).toBeNull();
	});
});

describe('frostLevel', () => {
	it('classifica le minime dell aria secondo le soglie prudenti', () => {
		expect(frostLevel(8)).toBe('none');
		// Sopra lo zero a 2 m si gela lo stesso a livello dell'erba: nelle notti
		// serene la superficie irraggia e resta 3-4 gradi sotto l'aria.
		expect(frostLevel(3)).toBe('possible');
		expect(frostLevel(0.5)).toBe('possible');
		expect(frostLevel(0)).toBe('likely');
		expect(frostLevel(-2)).toBe('likely');
		expect(frostLevel(-3)).toBe('severe');
		expect(frostLevel(-11)).toBe('severe');
	});

	it('sul suolo usa la soglia fisica, non quella di compenso', () => {
		// A 2 metri +2 °C è già allarme brina; sulla superficie +2 °C no,
		// perché lì la misura è già quella che conta.
		expect(frostLevel(2, 'air')).toBe('possible');
		expect(frostLevel(2, 'soil')).toBe('none');
		expect(frostLevel(1, 'soil')).toBe('possible');
		expect(frostLevel(0, 'soil')).toBe('likely');
		expect(frostLevel(-4, 'soil')).toBe('severe');
	});

	it('senza temperatura non dichiara un rischio', () => {
		expect(frostLevel(null)).toBe('none');
		expect(frostLevel(undefined)).toBe('none');
	});
});

describe('aggregateSnowfallCm', () => {
	it('azzera la nevicata prevista da una sola fonte su quattro', () => {
		// Stessa regola dei millimetri: sotto la frazione bagnata minima
		// l'incertezza la comunica la probabilità, non una media che inventa un
		// centimetro e mezzo di neve.
		expect(
			aggregateSnowfallCm([
				{ val: 0, weight: 1 },
				{ val: 0, weight: 1 },
				{ val: 0, weight: 1 },
				{ val: 6, weight: 1 },
			])
		).toBe(0);
	});

	it('media quando la maggioranza del peso prevede neve', () => {
		expect(
			aggregateSnowfallCm([
				{ val: 4, weight: 1 },
				{ val: 6, weight: 1 },
				{ val: 0, weight: 1 },
			])
		).toBeCloseTo(3.3, 1);
	});

	it('usa la soglia in centimetri, non quella dei millimetri', () => {
		// 0.15 cm sta sopra la soglia della pioggia (0.1) ma sotto quella della
		// neve (0.2): è un valore che il modello ha di fatto arrotondato a zero.
		expect(
			aggregateSnowfallCm([
				{ val: 0.15, weight: 1 },
				{ val: 0.15, weight: 1 },
				{ val: 0.15, weight: 1 },
			])
		).toBe(0);
	});

	it('senza dati non restituisce zero', () => {
		expect(aggregateSnowfallCm([])).toBeNull();
	});
});

describe('buildSnowOutlook', () => {
	it('in una giornata mite di pianura non produce nulla', () => {
		// Il riquadro deve sparire a luglio, non restare vuoto.
		const outlook = buildSnowOutlook(120, hours(24, { temp: 26, freezing_level: 4200 }));
		expect(outlook).toBeNull();
	});

	it('dichiara neve quando la località sta sopra la quota', () => {
		const outlook = buildSnowOutlook(
			1600,
			hours(24, { temp: -2, freezing_level: 1200, precipitation_mm: 1.4, snowfall_cm: 1.2 })
		);

		expect(outlook).not.toBeNull();
		expect(outlook!.snow_line).toBe(900);
		expect(outlook!.phase).toBe('snow');
		expect(outlook!.elevation).toBe(1600);
	});

	it('dichiara pioggia in pianura anche se in quota nevica', () => {
		const outlook = buildSnowOutlook(
			120,
			hours(24, { temp: 1, freezing_level: 1200, precipitation_mm: 2 })
		);

		// Rilevante per le gelate, non per la neve.
		expect(outlook).not.toBeNull();
		expect(outlook!.phase).toBe('rain');
		expect(outlook!.frost.level).toBe('possible');
	});

	it('senza precipitazioni non attribuisce una fase alla quota neve', () => {
		// Con cielo sereno la quota neve è un numero senza conseguenze.
		const outlook = buildSnowOutlook(
			1600,
			hours(24, { temp: -6, freezing_level: 1000, precipitation_mm: 0 })
		);

		expect(outlook!.phase).toBeNull();
		expect(outlook!.snow_line).toBe(700);
		expect(outlook!.frost.level).toBe('severe');
	});

	it('prende la quota neve più bassa della finestra, non la media', () => {
		// È quella che decide se mettere le catene.
		const finestra = hours(6, { temp: 0, precipitation_mm: 1 });
		finestra[0]!.freezing_level = 2000;
		finestra[1]!.freezing_level = 1800;
		finestra[2]!.freezing_level = 800;
		finestra[3]!.freezing_level = 1900;
		finestra[4]!.freezing_level = 2100;
		finestra[5]!.freezing_level = 2200;

		const outlook = buildSnowOutlook(700, finestra);
		expect(outlook!.snow_line).toBe(500);
	});

	it('somma la neve fresca e non somma il manto', () => {
		// L'accumulo si somma, lo stato del suolo no: sommare 20 cm di manto per
		// 24 ore darebbe 480 cm di neve a Milano.
		const finestra = hours(4, { temp: -1, snow_depth_cm: 20, snowfall_cm: 2 });

		const outlook = buildSnowOutlook(1500, finestra);
		expect(outlook!.snowfall_cm).toBe(8);
		expect(outlook!.snow_depth_cm).toBe(20);
	});

	it('il manto da solo rende rilevante il riquadro', () => {
		const outlook = buildSnowOutlook(1500, hours(24, { temp: 9, snow_depth_cm: 35 }));

		expect(outlook).not.toBeNull();
		expect(outlook!.snow_depth_cm).toBe(35);
		expect(outlook!.frost.level).toBe('none');
		expect(outlook!.snowfall_cm).toBeNull();
	});

	it('un velo di neve residuo non basta a far comparire il riquadro', () => {
		const outlook = buildSnowOutlook(1500, hours(24, { temp: 12, snow_depth_cm: 0.3 }));
		expect(outlook).toBeNull();
	});

	it('riporta l ora della minima, non solo il valore', () => {
		const finestra = hours(5, { temp: 4 });
		finestra[3]!.temp = -4;

		const outlook = buildSnowOutlook(200, finestra);
		expect(outlook!.frost.level).toBe('severe');
		expect(outlook!.frost.min_temp).toBe(-4);
		expect(outlook!.frost.at).toBe(finestra[3]!.time);
	});

	it('scarta gli slot precedenti all ora indicata', () => {
		// Le fonti portano anche ore passate: un manto di ieri non è quello di
		// adesso, e una gelata già avvenuta non è una previsione.
		const finestra = hours(6, { temp: 10 });
		finestra[0]!.temp = -8;

		const outlook = buildSnowOutlook(200, finestra, finestra[1]!.time);
		expect(outlook).toBeNull();
	});

	it('si ferma a ventiquattro ore', () => {
		// Una gelata fra tre giorni non è quello che si guarda stamattina.
		const finestra = hours(48, { temp: 14 });
		finestra[40]!.temp = -5;

		expect(buildSnowOutlook(200, finestra)).toBeNull();
	});

	it('giudica le gelate sul suolo quando i modelli lo portano', () => {
		// La brina si forma sulla superficie: se il dato c'è, usare i 2 metri
		// sarebbe buttare via la misura migliore.
		const finestra = hours(6, { temp: 4 });
		finestra[2]!.soil_temperature = -1;
		for (const ora of finestra) ora.soil_temperature ??= 3;

		const outlook = buildSnowOutlook(200, finestra);

		expect(outlook!.frost.source).toBe('soil');
		expect(outlook!.frost.min_temp).toBe(-1);
		expect(outlook!.frost.at).toBe(finestra[2]!.time);
		expect(outlook!.frost.level).toBe('likely');
	});

	it('senza temperatura del suolo ripiega sui due metri, dichiarandolo', () => {
		const outlook = buildSnowOutlook(200, hours(6, { temp: 2 }));

		expect(outlook!.frost.source).toBe('air');
		expect(outlook!.frost.level).toBe('possible');
	});

	it('con il suolo mite non inventa una gelata dai due metri', () => {
		// +2 °C a due metri farebbe scattare `possible`; il suolo a +6 dice che
		// quella notte non gela, ed è la misura che decide.
		const finestra = hours(6, { temp: 2, soil_temperature: 6 });

		expect(buildSnowOutlook(200, finestra)).toBeNull();
	});

	it('senza ore non produce nulla', () => {
		expect(buildSnowOutlook(1500, [])).toBeNull();
	});

	it('senza la quota della località resta utile per le gelate', () => {
		// L'altitudine la dichiara solo Open-Meteo: se i suoi modelli sono
		// spenti restano comunque le temperature delle altre fonti.
		const outlook = buildSnowOutlook(null, hours(24, { temp: -1, precipitation_mm: 1 }));

		expect(outlook).not.toBeNull();
		expect(outlook!.elevation).toBeNull();
		expect(outlook!.phase).toBeNull();
		expect(outlook!.frost.level).toBe('likely');
	});
});
