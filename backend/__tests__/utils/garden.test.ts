import {
	DEFICIT_WARNING_MM,
	MOISTURE_THRESHOLDS,
	RAIN_COVERS_MM,
	SOWING_MIN_SOIL_C,
	type GardenHour,
	buildGardenOutlook,
	irrigationAdvice,
	moistureLevel,
} from '../../utils/garden';

/**
 * Orto e giardino.
 *
 * La regola che conta più di tutte è la precedenza della pioggia: è il caso in
 * cui un utente sbaglierebbe da solo, perché guarda il terreno secco e prende
 * l'annaffiatoio senza sapere che fra tre ore arriva un temporale.
 */

function ore(count: number, over: Partial<GardenHour> = {}, base = '2026-05-20T18:00'): GardenHour[] {
	const start = new Date(`${base}:00Z`).getTime();
	return Array.from({ length: count }, (_, i) => ({
		time: new Date(start + i * 3600_000).toISOString().slice(0, 16),
		soil_moisture: 0.25,
		soil_temperature_root: 16,
		evapotranspiration: 0.1,
		precipitation_mm: 0,
		...over,
	}));
}

describe('moistureLevel', () => {
	it('classifica l umidità volumetrica dello strato 0-7 cm', () => {
		expect(moistureLevel(0.05)).toBe('very_dry');
		expect(moistureLevel(MOISTURE_THRESHOLDS.veryDry)).toBe('dry');
		expect(moistureLevel(0.15)).toBe('dry');
		expect(moistureLevel(MOISTURE_THRESHOLDS.dry)).toBe('adequate');
		expect(moistureLevel(0.30)).toBe('adequate');
		expect(moistureLevel(MOISTURE_THRESHOLDS.wet)).toBe('wet');
		expect(moistureLevel(0.45)).toBe('wet');
	});

	it('senza dato non inventa un livello', () => {
		expect(moistureLevel(null)).toBeNull();
		expect(moistureLevel(undefined)).toBeNull();
		expect(moistureLevel(NaN)).toBeNull();
	});
});

describe('irrigationAdvice', () => {
	it('se piove abbastanza non si innaffia, nemmeno sul secco', () => {
		// È la regola che viene prima di tutte: sul terreno secco saresti
		// tentato, e l'acqua dell'annaffiatoio andrebbe sprecata.
		expect(irrigationAdvice('very_dry', 6, RAIN_COVERS_MM)).toBe('rain_expected');
		expect(irrigationAdvice('dry', 3, 12)).toBe('rain_expected');
	});

	it('una pioggia insufficiente non salva il terreno secco', () => {
		expect(irrigationAdvice('very_dry', 3, RAIN_COVERS_MM - 1)).toBe('water_now');
	});

	it('il terreno molto secco va innaffiato subito', () => {
		expect(irrigationAdvice('very_dry', 0, 0)).toBe('water_now');
	});

	it('il terreno secco diventa urgente solo se l aria continua a prosciugarlo', () => {
		expect(irrigationAdvice('dry', 0.5, 0)).toBe('water_soon');
		expect(irrigationAdvice('dry', 5, 0)).toBe('water_now');
	});

	it('un terreno adeguato avvisa solo con un deficit importante', () => {
		expect(irrigationAdvice('adequate', 1, 0)).toBe('not_needed');
		expect(irrigationAdvice('adequate', DEFICIT_WARNING_MM + 1, 0)).toBe('water_soon');
	});

	it('il terreno bagnato non chiede acqua', () => {
		expect(irrigationAdvice('wet', 8, 0)).toBe('not_needed');
	});

	it('senza umidità non dà un consiglio che non può sostenere', () => {
		expect(irrigationAdvice(null, 10, 0)).toBe('not_needed');
	});
});

describe('buildGardenOutlook', () => {
	it('somma evapotraspirazione e pioggia sulla finestra', () => {
		const finestra = ore(24, { evapotranspiration: 0.2, precipitation_mm: 0.1 });

		const orto = buildGardenOutlook(finestra)!;

		expect(orto.evapotranspiration_mm).toBeCloseTo(4.8, 1);
		expect(orto.rain_mm).toBeCloseTo(2.4, 1);
		expect(orto.water_balance_mm).toBeCloseTo(2.4, 1);
	});

	it('l umidità è uno stato: si legge adesso, non si somma', () => {
		// Sommando 24 ore di 0.25 m³/m³ si otterrebbe 6, che non è un'umidità.
		const orto = buildGardenOutlook(ore(24, { soil_moisture: 0.25 }))!;

		expect(orto.soil_moisture).toBeCloseTo(0.25, 3);
		expect(orto.moisture_level).toBe('adequate');
	});

	it('la temperatura di semina è una media, non il picco del pomeriggio', () => {
		const finestra = ore(4, { soil_temperature_root: 10 });
		finestra[0]!.soil_temperature_root = 18;

		const orto = buildGardenOutlook(finestra)!;

		// (18 + 10 + 10 + 10) / 4 = 12
		expect(orto.soil_temperature).toBeCloseTo(12, 1);
	});

	it('dichiara la finestra di semina sulla soglia dello strato radicale', () => {
		const caldo = buildGardenOutlook(ore(6, { soil_temperature_root: SOWING_MIN_SOIL_C }))!;
		const freddo = buildGardenOutlook(ore(6, { soil_temperature_root: 8 }))!;

		expect(caldo.sowing_ok).toBe(true);
		expect(freddo.sowing_ok).toBe(false);
	});

	it('senza temperatura del suolo non si pronuncia sulla semina', () => {
		const orto = buildGardenOutlook(ore(6, { soil_temperature_root: null }))!;
		expect(orto.sowing_ok).toBeNull();
		expect(orto.soil_temperature).toBeNull();
	});

	it('senza evapotraspirazione non calcola un bilancio', () => {
		// Sarebbe la pioggia col segno meno, che non dice niente sul consumo.
		const orto = buildGardenOutlook(ore(6, { evapotranspiration: null, precipitation_mm: 2 }))!;

		expect(orto.water_balance_mm).toBeNull();
		expect(orto.rain_mm).toBeCloseTo(12, 1);
	});

	it('consiglia di aspettare la pioggia invece di innaffiare', () => {
		const orto = buildGardenOutlook(
			ore(24, { soil_moisture: 0.08, precipitation_mm: 0.5, evapotranspiration: 0.1 })
		)!;

		expect(orto.rain_mm).toBeCloseTo(12, 1);
		expect(orto.advice).toBe('rain_expected');
	});

	it('su terreno molto secco e senza pioggia dice di innaffiare subito', () => {
		const orto = buildGardenOutlook(
			ore(24, { soil_moisture: 0.06, precipitation_mm: 0, evapotranspiration: 0.2 })
		)!;

		expect(orto.moisture_level).toBe('very_dry');
		expect(orto.advice).toBe('water_now');
	});

	it('scarta gli slot precedenti all ora indicata', () => {
		// L'umidità di stamattina non è quella di adesso.
		const finestra = ore(6, { soil_moisture: 0.30 });
		finestra[0]!.soil_moisture = 0.05;

		const orto = buildGardenOutlook(finestra, finestra[1]!.time)!;

		expect(orto.moisture_level).toBe('adequate');
	});

	it('si ferma a ventiquattro ore', () => {
		const finestra = ore(48, { evapotranspiration: 0.1 });

		const orto = buildGardenOutlook(finestra)!;

		expect(orto.evapotranspiration_mm).toBeCloseTo(2.4, 1);
	});

	it('senza nessun dato agronomico non produce un riquadro', () => {
		// La sola pioggia la dicono già gli altri pannelli.
		const finestra = ore(12, {
			soil_moisture: null,
			soil_temperature_root: null,
			evapotranspiration: null,
			precipitation_mm: 3,
		});

		expect(buildGardenOutlook(finestra)).toBeNull();
	});

	it('senza ore non produce nulla', () => {
		expect(buildGardenOutlook([])).toBeNull();
	});

	it('«non serve innaffiare» resta una risposta, non un riquadro assente', () => {
		// A differenza del riquadro neve, qui il caso tranquillo è proprio
		// quello che chi ha un orto va a cercare la sera.
		const orto = buildGardenOutlook(ore(24, { soil_moisture: 0.28 }))!;

		expect(orto).not.toBeNull();
		expect(orto.advice).toBe('not_needed');
	});
});
