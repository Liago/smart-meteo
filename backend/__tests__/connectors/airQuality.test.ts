/**
 * Qualità dell'aria e pollini da Open-Meteo.
 *
 * La parte delicata sono le soglie: sono **per specie**, perché 30 granuli/m³
 * di graminacee sono una giornata pesante per chi è allergico e gli stessi 30
 * di olivo sono poca cosa. Una soglia unica darebbe un livello sbagliato per
 * metà delle specie.
 */

import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

import {
	POLLEN_SPECIES,
	POLLEN_THRESHOLDS,
	fetchAirQuality,
	pollenLevel,
} from '../../connectors/openmeteoAirQuality';

const LAT = 45.46;
const LON = 9.19;

let mock: MockAdapter;

beforeEach(() => {
	mock = new MockAdapter(axios);
});

afterEach(() => {
	mock.restore();
});

/**
 * Risposta con `hours` ore a partire da adesso, in ora locale.
 * I valori sono costanti salvo override sulla prima ora.
 */
function airQualityResponse(over: Record<string, (number | null)[]> = {}, hours = 6) {
	const now = new Date();
	const time = Array.from({ length: hours }, (_, i) => {
		const d = new Date(now.getTime() + i * 3600_000);
		return `${d.toISOString().slice(0, 13)}:00`;
	});

	const series = (value: number | null) => Array(hours).fill(value);

	return {
		utc_offset_seconds: 0,
		hourly: {
			time,
			european_aqi: series(42),
			pm2_5: series(12.3),
			pm10: series(20.1),
			nitrogen_dioxide: series(15),
			ozone: series(60),
			sulphur_dioxide: series(3),
			carbon_monoxide: series(210),
			alder_pollen: series(0),
			birch_pollen: series(0),
			grass_pollen: series(0),
			mugwort_pollen: series(0),
			olive_pollen: series(0),
			ragweed_pollen: series(0),
			...over,
		},
	};
}

describe('pollenLevel', () => {
	it('sotto un granulo non c è polline, non un livello basso', () => {
		expect(pollenLevel('grass', 0)).toBe('none');
		expect(pollenLevel('grass', null)).toBe('none');
		expect(pollenLevel('grass', 0.4)).toBe('none');
	});

	it('le soglie sono diverse fra le specie', () => {
		// 30 granuli/m³: alto per le graminacee, moderato per l'olivo.
		expect(pollenLevel('grass', 30)).toBe('high');
		expect(pollenLevel('olive', 30)).toBe('moderate');
	});

	it.each([
		['grass', 3, 'low'],
		['grass', 10, 'moderate'],
		['grass', 30, 'high'],
		['grass', 80, 'very_high'],
		['birch', 5, 'low'],
		['birch', 20, 'moderate'],
		['birch', 70, 'high'],
		['birch', 150, 'very_high'],
		['olive', 5, 'low'],
		['olive', 250, 'very_high'],
		['ragweed', 25, 'high'],
	] as const)('%s a %i granuli/m³ → %s', (species, value, expected) => {
		expect(pollenLevel(species, value)).toBe(expected);
	});

	it('ogni specie ha soglie crescenti e coerenti', () => {
		for (const { id } of POLLEN_SPECIES) {
			const t = POLLEN_THRESHOLDS[id];
			expect(t.moderate).toBeLessThan(t.high);
			expect(t.high).toBeLessThan(t.veryHigh);
			expect(t.moderate).toBeGreaterThan(0);
		}
	});

	it('un valore non finito non diventa un livello', () => {
		// Né NaN né Infinity sono misure: trattarli come "molto alto" farebbe
		// scattare un avviso su un dato rotto.
		expect(pollenLevel('grass', NaN)).toBe('none');
		expect(pollenLevel('grass', Infinity)).toBe('none');
	});
});

describe('fetchAirQuality', () => {
	it('legge indice europeo e inquinanti dell ora corrente', async () => {
		mock.onGet(/air-quality/).reply(200, airQualityResponse());

		const result = (await fetchAirQuality(LAT, LON))!;

		expect(result.european_aqi).toBe(42);
		expect(result.pm2_5).toBe(12.3);
		expect(result.pm10).toBe(20.1);
		expect(result.no2).toBe(15);
		expect(result.o3).toBe(60);
		expect(result.so2).toBe(3);
		expect(result.co).toBe(210);
	});

	it('riporta il massimo giornaliero accanto al valore corrente', async () => {
		// Il picco pollinico è a metà giornata: chi è allergico deve saperlo
		// prima di uscire, non solo quando è già in corso.
		mock.onGet(/air-quality/).reply(
			200,
			airQualityResponse({ grass_pollen: [8, 25, 60, 40, 12, 5] })
		);

		const result = (await fetchAirQuality(LAT, LON))!;
		const graminacee = result.pollen!.find((p) => p.species === 'grass')!;

		expect(graminacee.value).toBe(8);
		expect(graminacee.daily_max).toBe(60);
		expect(graminacee.level).toBe('moderate');
		expect(graminacee.daily_level).toBe('very_high');
	});

	it('traduce le specie in italiano', async () => {
		mock.onGet(/air-quality/).reply(200, airQualityResponse({ olive_pollen: [30, 30, 30, 30, 30, 30] }));

		const result = (await fetchAirQuality(LAT, LON))!;

		expect(result.pollen!.map((p) => p.label)).toContain('Olivo');
		expect(result.pollen!.map((p) => p.label)).toContain('Graminacee');
		expect(result.pollen!.map((p) => p.label)).toContain('Ambrosia');
	});

	it('fuori dall Europa i pollini non ci sono e non vengono inventati a zero', async () => {
		// Il modello CAMS copre solo l'Europa: i campi tornano nulli, e uno zero
		// direbbe "nessun polline" invece di "non lo sappiamo".
		const senzaPollini = airQualityResponse();
		for (const { field } of POLLEN_SPECIES) {
			(senzaPollini.hourly as any)[field] = Array(6).fill(null);
		}
		mock.onGet(/air-quality/).reply(200, senzaPollini);

		const result = (await fetchAirQuality(LAT, LON))!;

		expect(result.pollen).toBeNull();
		// La parte aria resta disponibile.
		expect(result.european_aqi).toBe(42);
	});

	it('il massimo giornaliero si ferma a fine giornata, non prosegue nel giorno dopo', async () => {
		// Serie che attraversa la mezzanotte con un picco il giorno successivo:
		// mostrarlo come massimo di oggi sarebbe un allarme sbagliato.
		const now = new Date();
		const startOfToday = new Date(now);
		startOfToday.setHours(22, 0, 0, 0);

		const time = Array.from({ length: 5 }, (_, i) => {
			const d = new Date(startOfToday.getTime() + i * 3600_000);
			return `${d.toISOString().slice(0, 13)}:00`;
		});

		mock.onGet(/air-quality/).reply(200, {
			utc_offset_seconds: 0,
			hourly: {
				time,
				european_aqi: [40, 40, 40, 40, 40],
				pm2_5: [10, 10, 10, 10, 10],
				pm10: [20, 20, 20, 20, 20],
				nitrogen_dioxide: [15, 15, 15, 15, 15],
				ozone: [60, 60, 60, 60, 60],
				sulphur_dioxide: [3, 3, 3, 3, 3],
				carbon_monoxide: [210, 210, 210, 210, 210],
				// 22:00 e 23:00 oggi, poi 00:00-02:00 di domani con il picco.
				grass_pollen: [5, 6, 90, 95, 100],
				alder_pollen: [0, 0, 0, 0, 0],
				birch_pollen: [0, 0, 0, 0, 0],
				mugwort_pollen: [0, 0, 0, 0, 0],
				olive_pollen: [0, 0, 0, 0, 0],
				ragweed_pollen: [0, 0, 0, 0, 0],
			},
		});

		const result = (await fetchAirQuality(LAT, LON))!;
		const graminacee = result.pollen!.find((p) => p.species === 'grass')!;

		expect(graminacee.daily_max).toBe(6);
	});

	it('su errore di rete restituisce null: è un arricchimento', async () => {
		mock.onGet(/air-quality/).networkError();
		await expect(fetchAirQuality(LAT, LON)).resolves.toBeNull();
	});

	it('su risposta senza serie oraria restituisce null', async () => {
		mock.onGet(/air-quality/).reply(200, { hourly: {} });
		await expect(fetchAirQuality(LAT, LON)).resolves.toBeNull();
	});

	it('chiede tutte le specie e gli inquinanti in ora locale', async () => {
		mock.onGet(/air-quality/).reply(200, airQualityResponse());

		await fetchAirQuality(LAT, LON);

		const params = mock.history.get[0]!.params;
		expect(params.timezone).toBe('auto');
		for (const { field } of POLLEN_SPECIES) {
			expect(params.hourly).toContain(field);
		}
		expect(params.hourly).toContain('european_aqi');
	});
});
