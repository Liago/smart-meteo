import { render, screen, within } from '@testing-library/react';
import PollenPanel from '@/components/PollenPanel';
import type { PollenLevel, PollenReading } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Pannello pollini.
 *
 * L'ordinamento conta più dell'aspetto: chi è allergico apre l'app per sapere
 * *quale* specie pesa oggi, e la risposta deve stare in cima senza doverla
 * cercare fra sei righe.
 */

function reading(
	species: string,
	label: string,
	daily_level: PollenLevel,
	daily_max: number | null = 10
): PollenReading {
	return { species, label, value: 1, daily_max, level: 'low', daily_level };
}

describe('PollenPanel', () => {
	it('non rende nulla fuori dalla copertura del modello', () => {
		const { container } = render(<PollenPanel />);
		expect(container).toBeEmptyDOMElement();
	});

	it('non rende nulla con una lista vuota', () => {
		const { container } = render(<PollenPanel pollen={[]} />);
		expect(container).toBeEmptyDOMElement();
	});

	it('mostra una riga per specie', () => {
		render(
			<PollenPanel
				pollen={[
					reading('grass', 'Graminacee', 'high'),
					reading('olive', 'Olivo', 'low'),
					reading('birch', 'Betulla', 'none'),
				]}
			/>
		);

		expect(screen.getByText('Graminacee')).toBeInTheDocument();
		expect(screen.getByText('Olivo')).toBeInTheDocument();
		expect(screen.getByText('Betulla')).toBeInTheDocument();
	});

	it('porta in cima la specie che pesa di più oggi', () => {
		render(
			<PollenPanel
				pollen={[
					reading('birch', 'Betulla', 'none'),
					reading('olive', 'Olivo', 'moderate'),
					reading('grass', 'Graminacee', 'very_high'),
				]}
			/>
		);

		const righe = screen.getAllByRole('listitem');
		expect(within(righe[0]!).getByText('Graminacee')).toBeInTheDocument();
		expect(within(righe[2]!).getByText('Betulla')).toBeInTheDocument();
	});

	it('dichiara nel titolo quale specie domina', () => {
		render(
			<PollenPanel
				pollen={[reading('grass', 'Graminacee', 'high'), reading('olive', 'Olivo', 'low')]}
			/>
		);

		expect(screen.getByText(/Oggi soprattutto graminacee/i)).toBeInTheDocument();
	});

	it('con tutte le specie a zero lo dice invece di fingere un picco', () => {
		render(
			<PollenPanel
				pollen={[reading('grass', 'Graminacee', 'none', 0), reading('olive', 'Olivo', 'none', 0)]}
			/>
		);

		expect(screen.getByText('Nessuna specie rilevante oggi')).toBeInTheDocument();
		expect(screen.queryByText(/Oggi soprattutto/i)).toBeNull();
	});

	it('le specie a zero restano in lista: l assenza è un informazione', () => {
		render(
			<PollenPanel
				pollen={[reading('grass', 'Graminacee', 'very_high'), reading('ragweed', 'Ambrosia', 'none', 0)]}
			/>
		);

		expect(screen.getAllByRole('listitem')).toHaveLength(2);
		expect(screen.getByText('Ambrosia')).toBeInTheDocument();
	});

	it('mostra il massimo previsto del giorno, non il valore dell ora', () => {
		render(<PollenPanel pollen={[reading('grass', 'Graminacee', 'high', 42)]} />);

		expect(screen.getByText(/max 42/)).toBeInTheDocument();
	});

	it('i valori sotto dieci granuli conservano un decimale, in italiano', () => {
		render(<PollenPanel pollen={[reading('grass', 'Graminacee', 'low', 3.4)]} />);

		expect(screen.getByText(/max 3,4/)).toBeInTheDocument();
	});

	it('un massimo assente non diventa zero', () => {
		render(<PollenPanel pollen={[reading('grass', 'Graminacee', 'none', null)]} />);

		expect(screen.getByText(/max —/)).toBeInTheDocument();
	});

	it('traduce i livelli in italiano', () => {
		render(
			<PollenPanel
				pollen={[
					reading('grass', 'Graminacee', 'very_high'),
					reading('olive', 'Olivo', 'moderate'),
					reading('birch', 'Betulla', 'none'),
				]}
			/>
		);

		expect(screen.getByText('Molto alto')).toBeInTheDocument();
		expect(screen.getByText('Moderato')).toBeInTheDocument();
		expect(screen.getByText('Assente')).toBeInTheDocument();
	});
});
