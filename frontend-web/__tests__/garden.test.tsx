import { render, screen, within } from '@testing-library/react';
import GardenPanel from '@/components/GardenPanel';
import { adviceReason, formatMoisture, sowingSentence } from '@/lib/garden';
import type { GardenOutlook } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Riquadro orto.
 *
 * Il valore sta nella prima riga: «da innaffiare oggi» oppure «ci pensa la
 * pioggia». I numeri sotto servono a poterla contestare — un consiglio che non
 * mostra il perché è un oracolo, e nessuno si fida di un oracolo sull'orto.
 */

function garden(over: Partial<GardenOutlook> = {}): GardenOutlook {
	return {
		soil_moisture: 0.252,
		moisture_level: 'adequate',
		soil_temperature: 18,
		evapotranspiration_mm: 4.8,
		rain_mm: 0,
		water_balance_mm: 4.8,
		advice: 'water_soon',
		sowing_ok: true,
		...over,
	};
}

describe('formatMoisture', () => {
	it('traduce i m³/m³ in percentuale di volume', () => {
		// «0,25 m³/m³» lo capiscono gli agronomi, «25% vol.» chiunque.
		expect(formatMoisture(0.252)).toBe('25% vol.');
		expect(formatMoisture(0.08)).toBe('8% vol.');
		expect(formatMoisture(null)).toBe('—');
	});
});

describe('adviceReason', () => {
	it('quando piove cita i millimetri attesi', () => {
		const frase = adviceReason(garden({ advice: 'rain_expected', rain_mm: 12.4 }));
		expect(frase).toBe('Attesi 12,4 mm nelle prossime 24 ore');
	});

	it('con un bilancio in perdita spiega quanto il terreno si sta asciugando', () => {
		expect(adviceReason(garden({ water_balance_mm: 4.8 }))).toBe(
			'Il terreno perde 4,8 mm più di quanti ne riceve'
		);
	});

	it('su terreno saturo lo dice invece di parlare di bilancio', () => {
		const frase = adviceReason(
			garden({ moisture_level: 'wet', advice: 'not_needed', water_balance_mm: -2, rain_mm: 0 })
		);
		expect(frase).toBe('Il terreno è già saturo');
	});

	it('senza un motivo utile non inventa una frase', () => {
		const frase = adviceReason(
			garden({ advice: 'not_needed', water_balance_mm: null, rain_mm: null, moisture_level: 'adequate' })
		);
		expect(frase).toBeNull();
	});
});

describe('sowingSentence', () => {
	it('dichiara la finestra di semina con la temperatura del suolo', () => {
		expect(sowingSentence(garden({ sowing_ok: true, soil_temperature: 16 }))).toBe(
			'Suolo a 16°: si può seminare'
		);
		expect(sowingSentence(garden({ sowing_ok: false, soil_temperature: 8 }))).toBe(
			'Suolo a 8°: ancora freddo per seminare'
		);
	});

	it('senza temperatura del suolo non si pronuncia', () => {
		expect(sowingSentence(garden({ sowing_ok: null, soil_temperature: null }))).toBeNull();
	});
});

describe('GardenPanel', () => {
	it('non rende nulla quando il backend non manda il blocco', () => {
		const { container } = render(<GardenPanel />);
		expect(container).toBeEmptyDOMElement();
	});

	it('mette la risposta in cima e il motivo sotto', () => {
		render(<GardenPanel garden={garden({ advice: 'water_now', water_balance_mm: 6.2 })} />);

		expect(screen.getByText('Da innaffiare oggi')).toBeInTheDocument();
		expect(screen.getByText(/perde 6,2 mm/)).toBeInTheDocument();
	});

	it('mostra il numero grezzo accanto al giudizio sul terreno', () => {
		// Le soglie dipendono dal tipo di suolo, che l'API non dichiara: chi
		// conosce il proprio terreno deve poter correggere il giudizio.
		render(<GardenPanel garden={garden()} />);

		const riga = screen.getByText('Terreno').closest('li')!;
		expect(within(riga).getByText('Umidità adeguata')).toBeInTheDocument();
		expect(within(riga).getByText('25% vol.')).toBeInTheDocument();
	});

	it('rende il caso tranquillo, che è la risposta cercata', () => {
		render(<GardenPanel garden={garden({ advice: 'not_needed' })} />);
		expect(screen.getByText('Non serve innaffiare')).toBeInTheDocument();
	});

	it('quando arriva la pioggia dice di non innaffiare', () => {
		render(
			<GardenPanel garden={garden({ advice: 'rain_expected', rain_mm: 14, water_balance_mm: -9 })} />
		);

		expect(screen.getByText('Non innaffiare: ci pensa la pioggia')).toBeInTheDocument();
		expect(screen.getByText('Pioggia attesa')).toBeInTheDocument();
	});

	it('senza pioggia attesa non mostra una riga a zero', () => {
		render(<GardenPanel garden={garden({ rain_mm: 0 })} />);
		expect(screen.queryByText('Pioggia attesa')).toBeNull();
	});

	it('omette le righe senza dato invece di mostrare trattini', () => {
		render(
			<GardenPanel
				garden={garden({
					moisture_level: null,
					soil_moisture: null,
					evapotranspiration_mm: null,
					rain_mm: null,
				})}
			/>
		);

		expect(screen.queryAllByRole('listitem')).toHaveLength(0);
		expect(screen.getByText('Da innaffiare entro un giorno o due')).toBeInTheDocument();
	});

	it('mostra la frase sulla semina quando il suolo è misurato', () => {
		render(<GardenPanel garden={garden({ sowing_ok: false, soil_temperature: 9 })} />);
		expect(screen.getByText(/ancora freddo per seminare/)).toBeInTheDocument();
	});
});
