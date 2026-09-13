import { render, screen, within } from '@testing-library/react';
import ActivitiesPanel from '@/components/ActivitiesPanel';
import type { ActivitiesOutlook } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Riquadro «buona giornata per…».
 *
 * Il punteggio da solo non serve a niente: quello che rende il pannello utile è
 * il fattore limitante accanto al numero, perché è su quello che si decide se
 * rimandare o cambiare percorso.
 */

function outlook(over: Partial<ActivitiesOutlook> = {}): ActivitiesOutlook {
	const oggi = new Date();
	const date = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`;
	return {
		date,
		from: `${date}T08:00`,
		to: `${date}T19:00`,
		activities: [
			{ id: 'running', label: 'Correre', score: 92, limiting: null },
			{ id: 'cycling', label: 'Andare in bici', score: 64, limiting: 'vento' },
			{ id: 'laundry', label: 'Stendere il bucato', score: 30, limiting: 'umidità' },
		],
		...over,
	};
}

describe('ActivitiesPanel', () => {
	it('non rende nulla senza il blocco', () => {
		const { container } = render(<ActivitiesPanel />);
		expect(container).toBeEmptyDOMElement();
	});

	it('non rende nulla con una lista vuota', () => {
		const { container } = render(<ActivitiesPanel activities={outlook({ activities: [] })} />);
		expect(container).toBeEmptyDOMElement();
	});

	it('elenca un attività per riga con punteggio e fattore limitante', () => {
		render(<ActivitiesPanel activities={outlook()} />);

		const righe = screen.getAllByRole('listitem');
		expect(righe).toHaveLength(3);

		const bici = screen.getByText('Andare in bici').closest('li')!;
		expect(within(bici).getByText('64')).toBeInTheDocument();
		expect(within(bici).getByText('limita vento')).toBeInTheDocument();
	});

	it('non dichiara un fattore limitante quando non ce n è', () => {
		render(<ActivitiesPanel activities={outlook()} />);

		const corsa = screen.getByText('Correre').closest('li')!;
		expect(within(corsa).queryByText(/limita/)).toBeNull();
	});

	it('mette in cima la migliore quando è davvero buona', () => {
		render(<ActivitiesPanel activities={outlook()} />);
		expect(screen.getByText('correre: condizioni ottime')).toBeInTheDocument();
	});

	it('quando niente è ideale lo dice, nominando il perché', () => {
		const mediocre = outlook({
			activities: [
				{ id: 'running', label: 'Correre', score: 45, limiting: 'pioggia' },
				{ id: 'cycling', label: 'Andare in bici', score: 30, limiting: 'pioggia' },
			],
		});

		render(<ActivitiesPanel activities={mediocre} />);
		expect(screen.getByText('Niente di ideale: limita pioggia')).toBeInTheDocument();
	});

	it('di sera dichiara che la finestra è di domani', () => {
		// «Buona giornata per correre» alle 23 significa domani, non fra un'ora.
		const domani = new Date();
		domani.setDate(domani.getDate() + 1);
		const date = `${domani.getFullYear()}-${String(domani.getMonth() + 1).padStart(2, '0')}-${String(domani.getDate()).padStart(2, '0')}`;

		render(<ActivitiesPanel activities={outlook({ date, from: `${date}T08:00`, to: `${date}T19:00` })} />);

		expect(screen.getByText('domani')).toBeInTheDocument();
	});

	it('per la finestra di oggi non aggiunge nessuna nota', () => {
		render(<ActivitiesPanel activities={outlook()} />);
		expect(screen.queryByText('domani')).toBeNull();
	});

	it('dichiara che il punteggio è il fattore peggiore, non la media', () => {
		render(<ActivitiesPanel activities={outlook()} />);
		expect(screen.getByText(/pari al fattore peggiore/)).toBeInTheDocument();
	});
});
