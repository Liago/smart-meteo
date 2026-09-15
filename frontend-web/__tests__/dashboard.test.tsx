import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import InsightsGrid from '@/components/dashboard/InsightsGrid';
import { availableTabs, rankInsights, resolveTab, upcomingDays } from '@/lib/dashboard';
import { useDashboardTab } from '@/lib/useDashboardTab';
import type { ForecastResponse } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Architettura dell'informazione della dashboard.
 *
 * Quello che questi test difendono non è un layout ma due decisioni:
 *
 * 1. **L'ordine delle schede di «Per te» dipende dalla giornata.** Un ordine
 *    fisso è sbagliato per costruzione — a gennaio mette il mare sopra la
 *    gelata, a luglio i pollini sotto il fotovoltaico — e il difetto non si
 *    vede guardando lo schermo, perché una scheda plausibile resta plausibile
 *    anche al posto sbagliato.
 * 2. **Una linguetta non apre mai il vuoto.** Le sezioni disponibili si
 *    calcolano dalla risposta, con le stesse condizioni di visibilità che i
 *    pannelli applicano da soli: se le due definizioni divergono, il badge
 *    conta cinque schede e la griglia ne mostra quattro.
 */

const TODAY = new Date().toLocaleDateString('sv-SE');

function tomorrow(offset = 1): string {
	const d = new Date();
	d.setDate(d.getDate() + offset);
	return d.toLocaleDateString('sv-SE');
}

/** Risposta minima: nessun blocco opzionale, così ogni test aggiunge il suo. */
function response(over: Partial<ForecastResponse> = {}): ForecastResponse {
	return {
		location: { lat: 45.4, lon: 9.2 },
		generated_at: '2026-09-15T10:00:00Z',
		sources_used: ['apple_weatherkit', 'tomorrow.io', 'open-meteo:ecmwf'],
		current: {
			temperature: 24,
			feels_like: 25,
			humidity: 60,
			wind_speed: 3,
			wind_direction: 180,
			wind_direction_label: 'S',
			wind_gust: 6,
			precipitation_prob: 10,
			precipitation_intensity: null,
			dew_point: 15,
			aqi: null,
			pressure: 1015,
			condition: 'clear',
			condition_text: 'Sereno',
			uv_index: 5,
			visibility: 10,
			cloud_cover: 20,
			air_quality: null,
		},
		...over,
	};
}

describe('rankInsights', () => {
	it('senza blocchi opzionali non propone nessuna scheda', () => {
		expect(rankInsights(response())).toEqual([]);
	});

	it('mette la gelata forte davanti a tutto il resto', () => {
		// È il caso per cui questa classifica esiste: la sera in cui si esce a
		// coprire le piante, la scheda neve non può stare sotto il fotovoltaico.
		const data = response({
			snow: {
				elevation: 300,
				snow_line: 1200,
				phase: 'rain',
				snow_depth_cm: null,
				snowfall_cm: null,
				frost: { level: 'severe', min_temp: -6, at: `${TODAY}T06:00`, source: 'air' },
			},
			solar: {
				plane: 'tilted',
				tilt_deg: 30,
				azimuth_deg: 0,
				performance_ratio: 0.8,
				days: [{ date: TODAY, kwh_per_kwp: 5.2, sunshine_hours: 9, peak_w: 800 }],
			},
			sky: {
				sunset: { at: `${TODAY}T20:00`, score: 90, level: 'excellent' },
				sunrise: null,
				stargazing: null,
			},
		});

		expect(rankInsights(data).map((c) => c.id)).toEqual(['snow', 'sky', 'solar']);
	});

	it('un aria irrespirabile batte un tramonto spettacolare', () => {
		const data = response({
			current: { ...response().current, aqi: 5 },
			sky: {
				sunset: { at: `${TODAY}T20:00`, score: 90, level: 'excellent' },
				sunrise: null,
				stargazing: null,
			},
		});

		expect(rankInsights(data).map((c) => c.id)).toEqual(['air', 'sky']);
	});

	it('un aria buona scende sotto i pollini alti', () => {
		// La scala EPA parte da 1: senza far dipendere la rilevanza dal valore,
		// la qualità dell'aria resterebbe in cima anche nelle giornate limpide.
		const data = response({
			current: { ...response().current, aqi: 1 },
			pollen: [
				{ species: 'grass', label: 'Graminacee', value: 40, daily_max: 62, level: 'high', daily_level: 'very_high' },
			],
		});

		expect(rankInsights(data).map((c) => c.id)).toEqual(['pollen', 'air']);
	});

	it('il mare che peggiora conta più del mare che resta calmo', () => {
		const calm = response({
			sea: {
				sea_temperature: 24, wave_height: 0.3, wave_direction: 200, wave_period: 5,
				swell_height: 0.2, state: 'calm', max_wave_24h: 0.35, max_wave_at: `${TODAY}T17:00`,
			},
		});
		const worsening = response({
			sea: {
				sea_temperature: 24, wave_height: 0.3, wave_direction: 200, wave_period: 5,
				swell_height: 0.2, state: 'calm', max_wave_24h: 1.8, max_wave_at: `${TODAY}T17:00`,
			},
		});

		expect(rankInsights(worsening)[0]!.relevance).toBeGreaterThan(rankInsights(calm)[0]!.relevance);
	});

	it('gli indici lifestyle contano ai due estremi, non nel mezzo', () => {
		// Una giornata ottima è una notizia, e lo è anche una in cui niente
		// funziona: è quella mediocre a poter stare più in basso.
		const score = (best: number) =>
			rankInsights(
				response({
					activities: {
						date: TODAY, from: `${TODAY}T08:00`, to: `${TODAY}T19:00`,
						activities: [{ id: 'running', label: 'Correre', score: best, limiting: null }],
					},
				})
			)[0]!.relevance;

		expect(score(90)).toBeGreaterThan(score(60));
		expect(score(20)).toBeGreaterThan(score(60));
	});

	it('anche un orto tranquillo resta sopra al fotovoltaico', () => {
		// «Non serve innaffiare» è la risposta che chi ha un orto viene a
		// cercare la sera, e riguarda più persone della resa dell impianto:
		// l ordine deve reggere anche nel caso in cui non succede niente.
		// L asserzione è ripetuta di proposito: a parità di peso decide lo
		// spareggio, non l implementazione di sort, e l ordine non può
		// cambiare fra un render e l altro.
		const data = response({
			garden: {
				soil_moisture: 0.3, moisture_level: 'adequate', soil_temperature: 18,
				evapotranspiration_mm: 2, rain_mm: 0, water_balance_mm: -2,
				advice: 'not_needed', sowing_ok: true,
			},
			solar: {
				plane: 'tilted', tilt_deg: 30, azimuth_deg: 0, performance_ratio: 0.8,
				days: [{ date: TODAY, kwh_per_kwp: 5.2, sunshine_hours: 9, peak_w: 800 }],
			},
		});

		const first = rankInsights(data).map((c) => c.id);
		expect(first).toEqual(rankInsights(data).map((c) => c.id));
		expect(first).toEqual(['garden', 'solar']);
	});

	it('un cielo senza eventi né notte non entra in classifica', () => {
		// Stessa condizione con cui SkyPanel si toglie di mezzo: se divergesse,
		// il badge conterebbe una scheda che la griglia non mostra.
		const data = response({ sky: { sunset: null, sunrise: null, stargazing: null } });
		expect(rankInsights(data)).toEqual([]);
	});
});

describe('upcomingDays', () => {
	it('conta da domani in avanti, scegliendo per data e non per posizione', () => {
		// `daily` può aprirsi con IERI: le fonti ragionano in UTC e il primo
		// cassetto del giorno locale cade il giorno prima.
		const day = (date: string) => ({
			date, temp_max: 25, temp_min: 15, precipitation_prob: 10,
			condition_code: '0', condition_text: 'Sereno',
		});
		const data = response({ daily: [day(tomorrow(-1)), day(TODAY), day(tomorrow()), day(tomorrow(2))] });

		expect(upcomingDays(data)).toBe(2);
	});

	it('senza daily non conta niente', () => {
		expect(upcomingDays(response())).toBe(0);
	});
});

describe('availableTabs', () => {
	it('con la sola risposta minima restano Oggi e Fonti', () => {
		// Una linguetta che apre una sezione vuota è peggio di una linguetta
		// assente: la prima si scopre solo cliccandola.
		expect(availableTabs(response()).map((t) => t.id)).toEqual(['oggi', 'fonti']);
	});

	it('conta le schede di Per te e le fonti nel badge', () => {
		const data = response({
			current: { ...response().current, aqi: 3 },
			garden: {
				soil_moisture: 0.1, moisture_level: 'dry', soil_temperature: 18,
				evapotranspiration_mm: 4.8, rain_mm: 0, water_balance_mm: -4.8,
				advice: 'water_soon', sowing_ok: true,
			},
		});
		const tabs = availableTabs(data);

		expect(tabs.find((t) => t.id === 'perte')?.count).toBe(2);
		expect(tabs.find((t) => t.id === 'fonti')?.count).toBe(3);
	});
});

describe('resolveTab', () => {
	const tabs = availableTabs(response());

	it('l ancora dell URL vince, così una sezione è condivisibile', () => {
		expect(resolveTab('#fonti', tabs)).toBe('fonti');
		expect(resolveTab('fonti', tabs)).toBe('fonti');
	});

	it('un ancora verso una sezione che questa località non ha ricade sulla prima', () => {
		// Il mare a Milano: il link resta valido, la pagina non resta vuota.
		expect(resolveTab('#perte', tabs)).toBe('oggi');
		expect(resolveTab('', tabs)).toBe('oggi');
	});
});

describe('SegmentedTabs', () => {
	const items = [
		{ id: 'oggi', label: 'Oggi' },
		{ id: 'settimana', label: 'Settimana', count: 6 },
		{ id: 'fonti', label: 'Fonti', count: 3 },
	];

	function setup(value = 'oggi') {
		const onChange = jest.fn();
		render(
			<SegmentedTabs
				items={items}
				value={value}
				onChange={onChange}
				idPrefix="test"
				aria-label="Sezioni"
			/>
		);
		return onChange;
	}

	it('si annuncia come tablist e lega ogni linguetta al suo pannello', () => {
		setup();
		expect(screen.getByRole('tablist', { name: 'Sezioni' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: /Oggi/ })).toHaveAttribute('aria-controls', 'test-panel-oggi');
		expect(screen.getByRole('tab', { name: /Oggi/ })).toHaveAttribute('aria-selected', 'true');
	});

	it('solo la linguetta attiva è raggiungibile col Tab', () => {
		// Nel pattern tablist ci si sposta con le frecce: se tutte fossero
		// raggiungibili, arrivare al contenuto da tastiera costerebbe tre Tab.
		setup();
		expect(screen.getByRole('tab', { name: /Oggi/ })).toHaveAttribute('tabindex', '0');
		expect(screen.getByRole('tab', { name: /Settimana/ })).toHaveAttribute('tabindex', '-1');
	});

	it('le frecce scorrono le sezioni e girano in tondo', () => {
		const onChange = setup();
		const list = screen.getByRole('tablist');

		fireEvent.keyDown(list, { key: 'ArrowRight' });
		expect(onChange).toHaveBeenLastCalledWith('settimana');

		fireEvent.keyDown(list, { key: 'ArrowLeft' });
		expect(onChange).toHaveBeenLastCalledWith('fonti');

		fireEvent.keyDown(list, { key: 'End' });
		expect(onChange).toHaveBeenLastCalledWith('fonti');
	});

	it('il badge accompagna l etichetta senza sostituirla', () => {
		setup();
		const settimana = screen.getByRole('tab', { name: /Settimana/ });
		expect(within(settimana).getByText('6')).toBeInTheDocument();
	});
});

describe('InsightsGrid', () => {
	it('monta i pannelli nell ordine della classifica', () => {
		const data = response({
			current: { ...response().current, aqi: 1 },
			pollen: [
				{ species: 'grass', label: 'Graminacee', value: 40, daily_max: 62, level: 'high', daily_level: 'very_high' },
			],
		});
		render(<InsightsGrid data={data} />);

		const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
		expect(titles).toEqual(['Pollini', 'Qualita aria']);
	});

	it('non lascia un buco per le schede che il backend non ha mandato', () => {
		render(<InsightsGrid data={response()} />);
		expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
	});
});

describe('useDashboardTab', () => {
	const tabs = [
		{ id: 'oggi' as const, label: 'Oggi' },
		{ id: 'fonti' as const, label: 'Fonti' },
	];

	beforeEach(() => {
		window.history.replaceState(null, '', window.location.pathname);
	});

	it('senza ancora apre la prima sezione', () => {
		const { result } = renderHook(() => useDashboardTab(tabs));
		expect(result.current[0]).toBe('oggi');
	});

	it('l ancora già nell URL decide la sezione al primo render', () => {
		// Senza, una sezione condivisa per link si aprirebbe su «Oggi» e
		// salterebbe alla sezione giusta solo dopo l idratazione.
		window.history.replaceState(null, '', '#fonti');
		const { result } = renderHook(() => useDashboardTab(tabs));
		expect(result.current[0]).toBe('fonti');
	});

	it('scegliere una sezione la scrive nell URL senza impilare cronologia', () => {
		const before = window.history.length;
		const { result } = renderHook(() => useDashboardTab(tabs));

		act(() => result.current[1]('fonti'));

		expect(result.current[0]).toBe('fonti');
		expect(window.location.hash).toBe('#fonti');
		// `replaceState`, non `pushState`: quattro clic sulle linguette non
		// devono rendere inutile il tasto «indietro».
		expect(window.history.length).toBe(before);
	});

	it('indietro e avanti del browser tornano alla sezione precedente', () => {
		window.history.replaceState(null, '', '#fonti');
		const { result } = renderHook(() => useDashboardTab(tabs));

		act(() => {
			window.history.replaceState(null, '', '#oggi');
			window.dispatchEvent(new HashChangeEvent('hashchange'));
		});

		expect(result.current[0]).toBe('oggi');
	});

	it('una sezione che questa località non ha ricade sulla prima', () => {
		// Cambiando località il mare sparisce, e con lui la sezione «Per te»
		// che conteneva solo quella scheda.
		window.history.replaceState(null, '', '#perte');
		const { result } = renderHook(() => useDashboardTab(tabs));
		expect(result.current[0]).toBe('oggi');
	});
});
