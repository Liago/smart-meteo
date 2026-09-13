import { fireEvent, render, screen, within } from '@testing-library/react';
import SolarPanel from '@/components/SolarPanel';
import {
	PLANT_KWP_KEY,
	assumptionsNote,
	dayEnergyKwh,
	dayLabel,
	parsePlantKwp,
	readPlantKwp,
} from '@/lib/solar';
import type { SolarOutlook } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Riquadro fotovoltaico.
 *
 * Due cose contano più dell'aspetto: che la potenza dell'impianto resti un dato
 * dell'utente — salvata in locale, mai inviata al backend, altrimenti la cache
 * della previsione si frammenterebbe per utente — e che le assunzioni della
 * stima siano sempre scritte, perché un numero di kWh senza inclinazione e
 * perdite non è verificabile da nessuno.
 */

function solar(over: Partial<SolarOutlook> = {}): SolarOutlook {
	return {
		plane: 'tilted',
		tilt_deg: 30,
		azimuth_deg: 0,
		performance_ratio: 0.75,
		days: [
			{ date: '2026-06-15', kwh_per_kwp: 5.2, sunshine_hours: 11, peak_w: 890 },
			{ date: '2026-06-16', kwh_per_kwp: 2.6, sunshine_hours: 4, peak_w: 430 },
		],
		...over,
	};
}

beforeEach(() => {
	window.localStorage.clear();
});

describe('parsePlantKwp', () => {
	it('accetta la virgola decimale, come la scrive un italiano', () => {
		expect(parsePlantKwp('4,5')).toBe(4.5);
		expect(parsePlantKwp('4.5')).toBe(4.5);
	});

	it('rifiuta valori impossibili invece di salvarli', () => {
		expect(parsePlantKwp('0')).toBeNull();
		expect(parsePlantKwp('-3')).toBeNull();
		expect(parsePlantKwp('abc')).toBeNull();
		// Oltre i 100 kWp non è più un impianto domestico: è più probabile un
		// refuso che un utente con una centrale.
		expect(parsePlantKwp('5000')).toBeNull();
	});
});

describe('dayEnergyKwh', () => {
	it('moltiplica la resa specifica per la taglia dell impianto', () => {
		const day = { date: '2026-06-15', kwh_per_kwp: 5.2, sunshine_hours: 11, peak_w: 890 };
		expect(dayEnergyKwh(day, 3)).toBeCloseTo(15.6, 1);
	});

	it('senza potenza non inventa un totale', () => {
		const day = { date: '2026-06-15', kwh_per_kwp: 5.2, sunshine_hours: 11, peak_w: 890 };
		expect(dayEnergyKwh(day, null)).toBeNull();
	});
});

describe('dayLabel', () => {
	const oggi = new Date(2026, 5, 15); // 15 giugno 2026, ora locale

	it('nomina oggi e domani invece della data', () => {
		expect(dayLabel('2026-06-15', oggi)).toBe('Oggi');
		expect(dayLabel('2026-06-16', oggi)).toBe('Domani');
	});

	it('costruisce il giorno in ora locale, non UTC', () => {
		// `new Date('2026-06-18')` sarebbe mezzanotte UTC: in Italia mostrerebbe
		// il giorno prima per tutta la sera.
		expect(dayLabel('2026-06-18', oggi).toLowerCase()).toContain('gio');
	});
});

describe('assumptionsNote', () => {
	it('dichiara inclinazione e perdite', () => {
		expect(assumptionsNote(solar())).toBe(
			'Stima su pannelli a 30° esposti a sud, con 25% di perdite di impianto.'
		);
	});

	it('dichiara il ripiego sul piano orizzontale', () => {
		// Su piano orizzontale un impianto inclinato produce di più d'inverno:
		// tacerlo renderebbe la stima ingannevole invece che solo approssimata.
		expect(assumptionsNote(solar({ plane: 'horizontal' }))).toContain('piano orizzontale');
	});
});

describe('SolarPanel', () => {
	it('non rende nulla senza il blocco', () => {
		const { container } = render(<SolarPanel />);
		expect(container).toBeEmptyDOMElement();
	});

	it('non rende nulla con zero giorni utilizzabili', () => {
		const { container } = render(<SolarPanel solar={solar({ days: [] })} />);
		expect(container).toBeEmptyDOMElement();
	});

	it('senza potenza impostata mostra la resa specifica, che è comunque corretta', () => {
		render(<SolarPanel solar={solar()} />);

		// Compare due volte: nel titolo della giornata migliore e nella sua riga.
		const riga = screen.getAllByRole('listitem')[0]!;
		expect(within(riga).getByText('5,20 kWh/kWp')).toBeInTheDocument();
		expect(screen.getByText('Imposta impianto')).toBeInTheDocument();
	});

	it('con la potenza salvata mostra i kWh dell impianto', () => {
		window.localStorage.setItem(PLANT_KWP_KEY, '3');

		render(<SolarPanel solar={solar()} />);

		// 5.2 kWh/kWp × 3 kWp = 15.6 kWh
		expect(screen.getByText('15,6 kWh')).toBeInTheDocument();
		expect(screen.getByText('7,8 kWh')).toBeInTheDocument();
	});

	it('salva la potenza in locale e aggiorna subito i totali', () => {
		render(<SolarPanel solar={solar()} />);

		fireEvent.click(screen.getByText('Imposta impianto'));
		fireEvent.change(screen.getByLabelText('Potenza impianto'), { target: { value: '4,5' } });
		fireEvent.click(screen.getByText('Salva'));

		expect(readPlantKwp()).toBe(4.5);
		// 5.2 × 4.5 = 23.4
		expect(screen.getByText('23,4 kWh')).toBeInTheDocument();
	});

	it('una potenza non valida non viene salvata', () => {
		window.localStorage.setItem(PLANT_KWP_KEY, '3');

		render(<SolarPanel solar={solar()} />);
		fireEvent.click(screen.getByText(/3 kWp/));
		fireEvent.change(screen.getByLabelText('Potenza impianto'), { target: { value: '-2' } });
		fireEvent.click(screen.getByText('Salva'));

		expect(readPlantKwp()).toBeNull();
	});

	it('mette in cima la giornata migliore', () => {
		render(<SolarPanel solar={solar()} />);
		expect(screen.getByText(/Giornata migliore/)).toBeInTheDocument();
	});

	it('elenca un giorno per riga con le ore di sole', () => {
		render(<SolarPanel solar={solar()} />);

		const righe = screen.getAllByRole('listitem');
		expect(righe).toHaveLength(2);
		expect(within(righe[0]!).getByText('11 h sole')).toBeInTheDocument();
	});

	it('senza ore di sole dichiarate la riga resta, senza quel dato', () => {
		const senzaSole = solar({
			days: [{ date: '2026-06-15', kwh_per_kwp: 5.2, sunshine_hours: null, peak_w: 890 }],
		});

		render(<SolarPanel solar={senzaSole} />);

		expect(screen.queryByText(/h sole/)).toBeNull();
		const riga = screen.getAllByRole('listitem')[0]!;
		expect(within(riga).getByText('5,20 kWh/kWp')).toBeInTheDocument();
	});

	it('scrive sempre le assunzioni della stima', () => {
		// Senza inclinazione e perdite, un numero di kWh non è verificabile.
		render(<SolarPanel solar={solar()} />);
		expect(screen.getByText(/30° esposti a sud/)).toBeInTheDocument();
		expect(screen.getByText(/25% di perdite/)).toBeInTheDocument();
	});
});
