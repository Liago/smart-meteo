import { render, screen, within } from '@testing-library/react';
import SnowPanel from '@/components/SnowPanel';
import { formatAltitude, formatCm, frostMinimum, frostSentence, snowHeadline } from '@/lib/snow';
import type { SnowOutlook } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Riquadro neve e gelate.
 *
 * Il valore del pannello sta nella prima riga: cinque numeri messi in fila non
 * dicono niente, "nevica alla tua quota" sì. I test difendono l'ordine di
 * priorità di quella frase, che è l'unica regola davvero discutibile del
 * componente.
 */

function outlook(over: Partial<SnowOutlook> = {}): SnowOutlook {
	return {
		elevation: 1800,
		snow_line: 900,
		phase: 'snow',
		snow_depth_cm: 40,
		snowfall_cm: 12,
		frost: { level: 'severe', min_temp: -6.2, at: '2026-01-15T06:00', source: 'air' },
		...over,
	};
}

describe('snowHeadline', () => {
	it('quando nevica alla tua quota lo dice per primo, con i centimetri', () => {
		expect(snowHeadline(outlook())).toBe('Neve prevista, circa 12 cm');
	});

	it('neve senza accumulo previsto resta una frase sulla fase', () => {
		expect(snowHeadline(outlook({ snowfall_cm: 0 }))).toBe('Le precipitazioni cadono come neve');
	});

	it('al limite della quota dichiara la mista invece di scegliere', () => {
		expect(snowHeadline(outlook({ phase: 'sleet' }))).toMatch(/limite della quota/i);
	});

	it('con la pioggia in basso segnala la neve che resta in quota', () => {
		expect(snowHeadline(outlook({ phase: 'rain', elevation: 120 }))).toBe(
			'Neve prevista in quota, circa 12 cm'
		);
	});

	it('senza neve prevista parla del manto al suolo', () => {
		expect(
			snowHeadline(outlook({ phase: null, snowfall_cm: 0, snow_depth_cm: 35 }))
		).toBe('35 cm di neve al suolo');
	});

	it('in pianura senza neve resta la gelata, che è il motivo per cui compare', () => {
		const solo_gelo = outlook({
			elevation: 120,
			phase: null,
			snowfall_cm: null,
			snow_depth_cm: null,
			snow_line: 1200,
			frost: { level: 'likely', min_temp: -1.4, at: '2026-01-15T06:00', source: 'air' },
		});

		expect(snowHeadline(solo_gelo)).toBe('Gelata probabile, minima -1° alle 06:00');
	});
});

describe('frostSentence', () => {
	it('non produce una frase quando non c è rischio', () => {
		expect(frostSentence(outlook({ frost: { level: 'none', min_temp: 9, at: null, source: 'air' } }))).toBeNull();
	});

	it('regge una minima senza orario', () => {
		const frase = frostSentence(outlook({ frost: { level: 'possible', min_temp: 2, at: null, source: 'air' } }));
		expect(frase).toBe('Possibile brina, minima 2°');
	});

	it('non inventa una minima quando manca', () => {
		const frase = frostSentence(outlook({ frost: { level: 'severe', min_temp: null, at: null, source: 'air' } }));
		expect(frase).toBe('Gelata forte in arrivo, minima sotto zero');
	});
});

describe('frostMinimum', () => {
	it('dichiara quando la minima è quella del suolo', () => {
		// Fra "minima 1°" e "minima al suolo 1°" ci sono tre o quattro gradi di
		// differenza e due notti diverse: tacerlo renderebbe innocuo un dato
		// che non lo è.
		const suolo = outlook({
			frost: { level: 'likely', min_temp: -1.4, at: '2026-03-20T05:00', source: 'soil' },
		});

		expect(frostMinimum(suolo)).toBe('minima al suolo -1° alle 05:00');
		expect(frostSentence(suolo)).toBe('Gelata probabile, minima al suolo -1° alle 05:00');
	});

	it('una minima appena sotto zero non diventa "-0°"', () => {
		// Math.round(-0.4) restituisce -0 in JavaScript: senza attenzione
		// finirebbe a schermo come "-0°". Il livello resta quello che avvisa.
		const rasoterra = outlook({
			frost: { level: 'likely', min_temp: -0.4, at: null, source: 'soil' },
		});

		expect(frostMinimum(rasoterra)).toBe('minima al suolo 0°');
	});

	it('sull aria resta la formula breve', () => {
		expect(frostMinimum(outlook())).toBe('minima -6° alle 06:00');
	});
});

describe('formattazione', () => {
	it('i centimetri sotto dieci conservano un decimale, in italiano', () => {
		expect(formatCm(3.4)).toBe('3,4 cm');
		expect(formatCm(12.6)).toBe('13 cm');
		expect(formatCm(null)).toBe('—');
	});

	it('le quote seguono il raggruppamento italiano', () => {
		// In italiano le migliaia si separano solo da cinque cifre in su
		// (minimumGroupingDigits: 2 nel CLDR): "quota neve 1800 m" è la forma
		// che si legge sui bollettini, "1.800" no.
		expect(formatAltitude(1800)).toBe('1800 m');
		expect(formatAltitude(12400)).toBe('12.400 m');
		expect(formatAltitude(null)).toBe('—');
	});
});

describe('SnowPanel', () => {
	it('non rende nulla quando il backend non manda il blocco', () => {
		const { container } = render(<SnowPanel />);
		expect(container).toBeEmptyDOMElement();
	});

	it('mette la quota neve accanto a quella della località', () => {
		// È il confronto che rende leggibile il numero: da solo sarebbe un dato
		// da bollettino.
		render(<SnowPanel snow={outlook()} />);

		const riga = screen.getByText('Quota neve').closest('li')!;
		expect(within(riga).getByText('900 m')).toBeInTheDocument();
		expect(within(riga).getByText('sei a 1800 m')).toBeInTheDocument();
	});

	it('mostra fase, accumulo, manto e gelate', () => {
		render(<SnowPanel snow={outlook()} />);

		expect(screen.getByText('Neve')).toBeInTheDocument();
		expect(screen.getByText('12 cm')).toBeInTheDocument();
		expect(screen.getByText('40 cm')).toBeInTheDocument();
		expect(screen.getByText('Gelata forte')).toBeInTheDocument();
		expect(screen.getByText('minima -6° alle 06:00')).toBeInTheDocument();
	});

	it('omette le righe senza dato invece di mostrare trattini', () => {
		render(
			<SnowPanel
				snow={outlook({
					phase: null,
					snow_line: null,
					snowfall_cm: null,
					snow_depth_cm: null,
					frost: { level: 'likely', min_temp: -1, at: null, source: 'air' },
				})}
			/>
		);

		expect(screen.getAllByRole('listitem')).toHaveLength(1);
		expect(screen.getByText('Gelate')).toBeInTheDocument();
		expect(screen.queryByText('Quota neve')).toBeNull();
	});

	it('un velo di neve sotto il centimetro non diventa una riga', () => {
		render(<SnowPanel snow={outlook({ snow_depth_cm: 0.4 })} />);
		expect(screen.queryByText('Neve al suolo')).toBeNull();
	});

	it('senza la quota della località la riga resta, senza il confronto', () => {
		// Succede con i modelli Open-Meteo disattivati: l altitudine la dichiara
		// solo lui.
		render(<SnowPanel snow={outlook({ elevation: null })} />);

		const riga = screen.getByText('Quota neve').closest('li')!;
		expect(within(riga).getByText('900 m')).toBeInTheDocument();
		expect(within(riga).queryByText(/sei a/)).toBeNull();
	});
});
