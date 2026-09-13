import { render, screen, within } from '@testing-library/react';
import SeaPanel from '@/components/SeaPanel';
import { formatWave, seaHeadline, seaStateOf, waveDirectionLabel, worseningNote } from '@/lib/sea';
import type { SeaOutlook } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Riquadro mare.
 *
 * La traduzione che conta è l'altezza d'onda in una parola: «1,3 m» sembra poco
 * scritto così, ed è il mare che rovescia un pedalò. L'altra regola difesa qui
 * è che l'avviso di peggioramento compaia solo quando cambia davvero la fascia,
 * altrimenti sarebbe un falso allarme sul numero già scritto sopra.
 */

function sea(over: Partial<SeaOutlook> = {}): SeaOutlook {
	return {
		sea_temperature: 24.6,
		wave_height: 0.32,
		wave_direction: 110,
		wave_period: 4.2,
		swell_height: 0.2,
		state: 'calm',
		max_wave_24h: 0.41,
		max_wave_at: '2026-07-20T18:00',
		...over,
	};
}

describe('seaStateOf', () => {
	it('traduce i metri nella scala dei bollettini', () => {
		expect(seaStateOf(0.2)).toBe('calm');
		expect(seaStateOf(0.8)).toBe('slight');
		expect(seaStateOf(1.8)).toBe('moderate');
		expect(seaStateOf(3)).toBe('rough');
		expect(seaStateOf(null)).toBe('calm');
	});
});

describe('formatWave', () => {
	it('sotto il metro conta il centimetro, sopra basta il decimetro', () => {
		expect(formatWave(0.32)).toBe('0,32 m');
		expect(formatWave(1.8)).toBe('1,8 m');
		expect(formatWave(null)).toBe('—');
	});
});

describe('waveDirectionLabel', () => {
	it('usa otto punti, non sedici', () => {
		// Fra NNE e NE non cambia niente per chi sceglie una spiaggia.
		expect(waveDirectionLabel(0)).toBe('N');
		expect(waveDirectionLabel(90)).toBe('E');
		expect(waveDirectionLabel(225)).toBe('SO');
		expect(waveDirectionLabel(359)).toBe('N');
	});

	it('senza direzione non inventa un punto cardinale', () => {
		expect(waveDirectionLabel(null)).toBeNull();
	});
});

describe('seaHeadline', () => {
	it('mette l acqua per prima: è la prima domanda di chi va al mare', () => {
		expect(seaHeadline(sea())).toBe('Acqua a 25°, mare calmo');
	});

	it('senza temperatura resta lo stato del mare', () => {
		expect(seaHeadline(sea({ sea_temperature: null }))).toBe('Mare calmo');
	});
});

describe('worseningNote', () => {
	it('avvisa quando il picco atteso cambia fascia', () => {
		const nota = worseningNote(sea({ max_wave_24h: 1.6, max_wave_at: '2026-07-20T16:00' }));
		expect(nota).toBe('Verso le 16:00 diventa mosso (1,6 m)');
	});

	it('tace quando il mare resta nella stessa fascia', () => {
		// Il numero è già nella riga dell'onda: ripeterlo come avviso sarebbe
		// un falso allarme.
		expect(worseningNote(sea({ max_wave_24h: 0.41 }))).toBeNull();
	});

	it('senza il massimo non produce un avviso', () => {
		expect(worseningNote(sea({ max_wave_24h: null }))).toBeNull();
	});
});

describe('SeaPanel', () => {
	it('non rende nulla nell entroterra, dove il backend non manda il blocco', () => {
		const { container } = render(<SeaPanel />);
		expect(container).toBeEmptyDOMElement();
	});

	it('mostra acqua, onda e provenienza', () => {
		render(<SeaPanel sea={sea()} />);

		expect(screen.getByText('Acqua a 25°, mare calmo')).toBeInTheDocument();
		const onda = screen.getByText('Onda').closest('li')!;
		expect(within(onda).getByText('0,32 m')).toBeInTheDocument();
		expect(within(onda).getByText('da E')).toBeInTheDocument();
	});

	it('con la sola temperatura resta utile', () => {
		render(<SeaPanel sea={sea({ wave_height: null, swell_height: null, max_wave_24h: null })} />);

		expect(screen.getAllByRole('listitem')).toHaveLength(1);
		expect(screen.getByText('Acqua')).toBeInTheDocument();
	});

	it('il mare lungo a zero non diventa una riga', () => {
		render(<SeaPanel sea={sea({ swell_height: 0 })} />);
		expect(screen.queryByText('Mare lungo')).toBeNull();
	});

	it('mostra l avviso di peggioramento quando cambia fascia', () => {
		render(<SeaPanel sea={sea({ max_wave_24h: 2.8, max_wave_at: '2026-07-20T17:00' })} />);
		expect(screen.getByText(/diventa molto mosso/)).toBeInTheDocument();
	});

	it('dichiara che le maree non ci sono, invece di lasciarle intendere', () => {
		render(<SeaPanel sea={sea()} />);
		expect(screen.getByText(/maree non sono disponibili/)).toBeInTheDocument();
	});
});
