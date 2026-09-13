import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { fetchMarine } from '../../connectors/openmeteoMarine';

/**
 * Connettore Open-Meteo Marine.
 *
 * La cosa che conta qui è l'auto-esclusione nell'entroterra: il modello d'onda
 * copre solo i punti di griglia sul mare, e un riquadro «mare calmo, 0 m» in
 * mezzo alla pianura sarebbe peggio di nessun riquadro.
 */

const LAT = 44.03;
const LON = 12.57;

let mock: MockAdapter;

beforeEach(() => {
	mock = new MockAdapter(axios);
});

afterEach(() => {
	mock.restore();
});

function marineResponse() {
	return {
		utc_offset_seconds: 7200,
		hourly: {
			time: ['2026-07-20T10:00', '2026-07-20T11:00'],
			wave_height: [0.32, 0.41],
			wave_direction: [110, 115],
			wave_period: [4.2, 4.5],
			swell_wave_height: [0.2, 0.25],
			sea_surface_temperature: [24.6, 24.8],
		},
	};
}

describe('fetchMarine', () => {
	it('mappa le ore del modello d onda', async () => {
		mock.onGet(/marine-api\.open-meteo\.com/).reply(200, marineResponse());

		const r = (await fetchMarine(LAT, LON))!;

		expect(r.hours).toHaveLength(2);
		expect(r.hours[0]!.wave_height).toBe(0.32);
		expect(r.hours[0]!.sea_temperature).toBe(24.6);
		expect(r.hours[1]!.swell_height).toBe(0.25);
		expect(r.utcOffsetSeconds).toBe(7200);
	});

	it('nell entroterra restituisce null invece di un mare a zero metri', async () => {
		// L'API risponde con un errore sui punti non coperti dal modello: è un
		// caso atteso, non un guasto.
		mock.onGet(/marine-api\.open-meteo\.com/).reply(400, { error: true, reason: 'out of bounds' });

		expect(await fetchMarine(45.46, 9.19)).toBeNull();
	});

	it('una risposta senza altezze d onda vale come entroterra', async () => {
		// Alcuni punti interni rispondono 200 con serie tutte nulle: il criterio
		// di costa è il dato, non il codice HTTP.
		const senzaOnde: any = marineResponse();
		senzaOnde.hourly.wave_height = [null, null];
		mock.onGet(/marine-api\.open-meteo\.com/).reply(200, senzaOnde);

		expect(await fetchMarine(45.46, 9.19)).toBeNull();
	});

	it('una serie assente non manda in errore il connettore', async () => {
		const senzaSwell: any = marineResponse();
		delete senzaSwell.hourly.swell_wave_height;
		mock.onGet(/marine-api\.open-meteo\.com/).reply(200, senzaSwell);

		const r = (await fetchMarine(LAT, LON))!;

		expect(r.hours[0]!.swell_height).toBeNull();
		expect(r.hours[0]!.wave_height).toBe(0.32);
	});

	it('una risposta senza blocco hourly restituisce null', async () => {
		mock.onGet(/marine-api\.open-meteo\.com/).reply(200, { utc_offset_seconds: 0 });

		expect(await fetchMarine(LAT, LON)).toBeNull();
	});

	it('un errore di rete non propaga l eccezione', async () => {
		mock.onGet(/marine-api\.open-meteo\.com/).networkError();

		expect(await fetchMarine(LAT, LON)).toBeNull();
	});
});
