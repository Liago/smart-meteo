import { render, screen } from '@testing-library/react';
import NextHourPrecipitation from '@/components/NextHourPrecipitation';
import type { ForecastNextHour, MinutelyPrecipitation } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Il componente ragiona in minuti da adesso, quindi le fixture vanno costruite
 * rispetto all'orologio del test: si fissa `Date.now()` a un istante noto.
 */
const NOW = new Date('2026-09-12T14:20:00Z');

beforeAll(() => {
	jest.useFakeTimers({ now: NOW });
});

afterAll(() => {
	jest.useRealTimers();
});

/**
 * Costruisce la finestra di 60 minuti a partire da adesso.
 *
 * @param intensities mm/h per minuto, indicizzati sull'offset da adesso
 * @param startOffset offset del primo minuto (negativo = minuti già passati,
 *                    come li manda WeatherKit)
 */
function nextHour(
	intensities: Record<number, number>,
	{ length = 60, startOffset = 0, chance = 80 }: { length?: number; startOffset?: number; chance?: number } = {}
): ForecastNextHour {
	const minutes: MinutelyPrecipitation[] = Array.from({ length }, (_, i) => {
		const offset = startOffset + i;
		const intensity = intensities[offset] ?? 0;
		return {
			startTime: new Date(NOW.getTime() + offset * 60000).toISOString(),
			precipitationChance: intensity > 0 ? chance : 0,
			precipitationIntensity: intensity,
		};
	});
	return { summary: [], minutes };
}

/** Tutti i minuti da `from` a `to` (esclusi) alla stessa intensità. */
function wet(from: number, to: number, mmH: number): Record<number, number> {
	const out: Record<number, number> = {};
	for (let i = from; i < to; i++) out[i] = mmH;
	return out;
}

describe('NextHourPrecipitation', () => {
	it('non rende nulla senza il dataset (fonte diversa da WeatherKit)', () => {
		const { container } = render(<NextHourPrecipitation />);
		expect(container).toBeEmptyDOMElement();
	});

	it('non rende nulla con un array di minuti vuoto', () => {
		const { container } = render(<NextHourPrecipitation data={{ summary: [], minutes: [] }} />);
		expect(container).toBeEmptyDOMElement();
	});

	it('ora asciutta: riga singola, senza istogramma di zeri', () => {
		const { container } = render(<NextHourPrecipitation data={nextHour({})} />);
		expect(screen.getByText('Nessuna precipitazione nella prossima ora')).toBeInTheDocument();
		// Nessuna barra: il grafico è l'unico elemento con aria-hidden.
		expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
	});

	it('pioggia in arrivo: annuncia fra quanti minuti inizia', () => {
		render(<NextHourPrecipitation data={nextHour(wet(12, 40, 1.5))} />);
		expect(screen.getByText('Inizia fra 12 minuti')).toBeInTheDocument();
	});

	it('il singolare è corretto a un minuto', () => {
		render(<NextHourPrecipitation data={nextHour(wet(1, 30, 1.5))} />);
		expect(screen.getByText('Inizia fra un minuto')).toBeInTheDocument();
	});

	it('pioggia in corso che finisce: annuncia quando smette', () => {
		render(<NextHourPrecipitation data={nextHour(wet(0, 20, 2))} />);
		expect(screen.getByText('Smette fra 20 minuti')).toBeInTheDocument();
	});

	it('pioggia per tutta la finestra: nessuna promessa di schiarita', () => {
		render(<NextHourPrecipitation data={nextHour(wet(0, 60, 3))} />);
		expect(screen.getByText('Precipitazioni per tutta la prossima ora')).toBeInTheDocument();
	});

	it('una pausa di un minuto non viene spacciata per fine della pioggia', () => {
		// Rovescio continuo con un solo minuto a zero al decimo minuto.
		const intensities = { ...wet(0, 60, 4) };
		intensities[10] = 0;
		render(<NextHourPrecipitation data={nextHour(intensities)} />);
		expect(screen.getByText('Precipitazioni per tutta la prossima ora')).toBeInTheDocument();
		expect(screen.queryByText(/Smette/)).toBeNull();
	});

	it('una pausa prolungata sì', () => {
		const intensities = { ...wet(0, 10, 4), ...wet(20, 60, 4) };
		render(<NextHourPrecipitation data={nextHour(intensities)} />);
		expect(screen.getByText('Smette fra 10 minuti')).toBeInTheDocument();
	});

	it('i minuti già passati non spostano il conteggio', () => {
		// WeatherKit manda anche i 5 minuti precedenti: la pioggia all'offset
		// assoluto 15 resta "fra 15 minuti", non "fra 20".
		render(<NextHourPrecipitation data={nextHour(wet(15, 45, 2), { startOffset: -5, length: 65 })} />);
		expect(screen.getByText('Inizia fra 15 minuti')).toBeInTheDocument();
	});

	it('le tracce sotto la soglia di pioggia non contano come precipitazione', () => {
		// 0.05 mm/h è sotto PRECIP_THRESHOLDS.light (0.1).
		render(<NextHourPrecipitation data={nextHour(wet(0, 60, 0.05))} />);
		expect(screen.getByText('Nessuna precipitazione nella prossima ora')).toBeInTheDocument();
	});

	it('mostra picco e probabilità massima quando piove', () => {
		const intensities = { ...wet(5, 30, 1.2), 12: 6.4 };
		render(<NextHourPrecipitation data={nextHour(intensities, { chance: 70 })} />);
		expect(screen.getByText(/Picco 6,4 mm\/h/)).toBeInTheDocument();
		expect(screen.getByText(/probabilità max 70%/)).toBeInTheDocument();
	});

	it('disegna una barra per minuto della finestra', () => {
		const { container } = render(<NextHourPrecipitation data={nextHour(wet(0, 30, 2))} />);
		const chart = container.querySelector('[aria-hidden="true"]');
		expect(chart).not.toBeNull();
		expect(chart!.children).toHaveLength(60);
	});
});
