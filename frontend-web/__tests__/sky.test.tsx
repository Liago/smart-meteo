import { render, screen, within } from '@testing-library/react';
import SkyPanel from '@/components/SkyPanel';
import { nextSolarEvent, skyHeadline, stargazingReason } from '@/lib/sky';
import type { SkyOutlook } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Riquadro cielo.
 *
 * Il pannello ha una riga sola di titolo, e la regola che i test difendono è
 * quale dei due indici la occupa: con un titolo fisso sul tramonto, una notte
 * eccezionale sotto un tramonto ordinario resterebbe invisibile — ed è proprio
 * il caso che fa aprire il pannello.
 */

function sky(over: Partial<SkyOutlook> = {}): SkyOutlook {
	return {
		sunset: { at: '2026-06-15T20:00', score: 82, level: 'excellent' },
		sunrise: null,
		stargazing: { score: 40, level: 'fair', cloud_cover: 30, moon_illumination: 60 },
		...over,
	};
}

describe('nextSolarEvent', () => {
	it('con alba e tramonto sceglie il primo in ordine di tempo', () => {
		const entrambi = sky({
			sunset: { at: '2026-06-15T20:00', score: 50, level: 'good' },
			sunrise: { at: '2026-06-16T05:00', score: 90, level: 'excellent' },
		});

		expect(nextSolarEvent(entrambi)!.kind).toBe('sunset');
	});

	it('con la sola alba prende quella', () => {
		const soloAlba = sky({
			sunset: null,
			sunrise: { at: '2026-06-16T05:00', score: 90, level: 'excellent' },
		});

		expect(nextSolarEvent(soloAlba)!.kind).toBe('sunrise');
	});

	it('senza eventi solari non ne inventa uno', () => {
		expect(nextSolarEvent(sky({ sunset: null, sunrise: null }))).toBeNull();
	});
});

describe('skyHeadline', () => {
	it('mette in cima il tramonto quando è lui il notevole', () => {
		expect(skyHeadline(sky())).toBe('Tramonto spettacolare verso le 20:00');
	});

	it('cede il titolo alla notte quando è la notte a essere eccezionale', () => {
		// Senza questa regola, una notte ottima sotto un tramonto ordinario
		// resterebbe invisibile.
		const nottePiuBella = sky({
			sunset: { at: '2026-06-15T20:00', score: 10, level: 'plain' },
			stargazing: { score: 92, level: 'excellent', cloud_cover: 5, moon_illumination: 4 },
		});

		expect(skyHeadline(nottePiuBella)).toBe('Notte ottima per le stelle');
	});

	it('a parità di livello resta sul solare, che viene prima nel tempo', () => {
		const pari = sky({
			sunset: { at: '2026-06-15T20:00', score: 60, level: 'good' },
			stargazing: { score: 55, level: 'good', cloud_cover: 20, moon_illumination: 30 },
		});

		expect(skyHeadline(pari)).toMatch(/^Tramonto/);
	});

	it('senza niente da dire lo dichiara invece di tacere', () => {
		expect(skyHeadline(sky({ sunset: null, sunrise: null, stargazing: null }))).toBe(
			'Nessuna previsione sul cielo'
		);
	});
});

describe('stargazingReason', () => {
	it('nomina il cielo terso e la luna quasi nuova', () => {
		expect(
			stargazingReason({ score: 95, level: 'excellent', cloud_cover: 5, moon_illumination: 8 })
		).toBe('cielo terso, luna quasi nuova');
	});

	it('nomina il cielo coperto e la luna piena', () => {
		expect(
			stargazingReason({ score: 5, level: 'plain', cloud_cover: 90, moon_illumination: 98 })
		).toBe('cielo coperto, luna piena');
	});

	it('nei casi intermedi dà le percentuali', () => {
		expect(
			stargazingReason({ score: 40, level: 'fair', cloud_cover: 45, moon_illumination: 50 })
		).toBe('45% di nuvole, luna al 50%');
	});

	it('senza dato lunare parla solo di nuvole', () => {
		expect(
			stargazingReason({ score: 90, level: 'excellent', cloud_cover: 10, moon_illumination: null })
		).toBe('cielo terso');
	});
});

describe('SkyPanel', () => {
	it('non rende nulla senza il blocco', () => {
		const { container } = render(<SkyPanel />);
		expect(container).toBeEmptyDOMElement();
	});

	it('non rende nulla quando non c è né evento solare né notte', () => {
		const { container } = render(
			<SkyPanel sky={sky({ sunset: null, sunrise: null, stargazing: null })} />
		);
		expect(container).toBeEmptyDOMElement();
	});

	it('mostra il tramonto con orario e giudizio', () => {
		render(<SkyPanel sky={sky()} />);

		const riga = screen.getByText('Tramonto').closest('li')!;
		expect(within(riga).getByText('20:00')).toBeInTheDocument();
		expect(within(riga).getByText('Spettacolare')).toBeInTheDocument();
	});

	it('mostra i due ingredienti della notte, non solo il verdetto', () => {
		// Un giudizio senza il perché è un verdetto senza appello.
		render(<SkyPanel sky={sky()} />);

		const riga = screen.getByText('Stelle stanotte').closest('li')!;
		expect(within(riga).getByText('30% di nuvole, luna al 60%')).toBeInTheDocument();
		expect(within(riga).getByText('Discreta')).toBeInTheDocument();
	});

	it('con la sola notte disponibile mostra quella riga soltanto', () => {
		render(<SkyPanel sky={sky({ sunset: null, sunrise: null })} />);

		expect(screen.getAllByRole('listitem')).toHaveLength(1);
		expect(screen.getByText('Stelle stanotte')).toBeInTheDocument();
	});

	it('con il solo evento solare non inventa una riga sulle stelle', () => {
		render(<SkyPanel sky={sky({ stargazing: null })} />);

		expect(screen.getAllByRole('listitem')).toHaveLength(1);
		expect(screen.queryByText('Stelle stanotte')).toBeNull();
	});
});
