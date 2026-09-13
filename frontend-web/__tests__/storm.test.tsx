import { render, screen, within } from '@testing-library/react';
import HourlyDetail from '@/components/HourlyDetail';
import { METRICS } from '@/lib/metrics';
import { getStormScale } from '@/lib/weather-utils';
import type { DailyForecast, HourlyForecast } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Metrica "Temporali" nel registry orario.
 *
 * L'indice lo calcola il backend (`backend/utils/storm.ts`): qui si verifica
 * che venga mostrato senza essere ricalcolato, e che un'ora senza indici
 * convettivi lo dica invece di disegnare barre a zero — che vorrebbe dire
 * «nessun temporale» quando la verità è «non lo sappiamo».
 */

const DATE = '2026-07-14';

const DAILY: DailyForecast[] = [
	{
		date: DATE,
		temp_max: 33,
		temp_min: 22,
		precipitation_prob: 60,
		condition_code: '95',
		condition_text: 'Temporale',
	},
];

function hour(h: number, over: Partial<HourlyForecast> = {}): HourlyForecast {
	return {
		time: `${DATE}T${String(h).padStart(2, '0')}:00`,
		temp: 30,
		precipitation_prob: 40,
		condition_code: '95',
		condition_text: 'Temporale',
		...over,
	};
}

/** 24 ore con lo stesso contenuto, per isolare quello che il test guarda. */
function giornata(over: Partial<HourlyForecast> = {}): HourlyForecast[] {
	return Array.from({ length: 24 }, (_, h) => hour(h, over));
}

describe('getStormScale', () => {
	it('classifica l indice nelle stesse fasce del backend', () => {
		expect(getStormScale(0).label).toBe('Assente');
		expect(getStormScale(24).label).toBe('Assente');
		expect(getStormScale(25).label).toBe('Debole');
		expect(getStormScale(50).label).toBe('Moderato');
		expect(getStormScale(75).label).toBe('Forte');
		expect(getStormScale(100).label).toBe('Forte');
	});

	it('senza indice non colora né nomina un livello', () => {
		expect(getStormScale(null).label).toBe('—');
		expect(getStormScale(undefined).label).toBe('—');
		expect(getStormScale(NaN).label).toBe('—');
	});

	it('i livelli hanno colori distinti', () => {
		const colori = [0, 30, 60, 90].map((v) => getStormScale(v).color);
		expect(new Set(colori).size).toBe(4);
	});
});

describe('registry della metrica temporali', () => {
	const spec = METRICS.storm;

	it('ha due sezioni: l energia e la probabilità che si scarichi', () => {
		// Sono due domande diverse e vengono da fonti diverse — gli indici
		// convettivi da Open-Meteo, la probabilità di tuono da WWO.
		expect(spec.sections).toHaveLength(2);
		expect(spec.sections.map((s) => s.id)).toEqual(['storm', 'thunder_prob']);
	});

	it('legge l indice dal backend invece di ricalcolarlo', () => {
		const sezione = spec.sections[0]!;
		expect(sezione.valueOf(hour(15, { storm_index: 63, cape: 1800 }))).toBe(63);
	});

	it('l asse resta 0-100 anche con un solo valore basso', () => {
		// Un indice è una percentuale, non una quantità: un dominio che si
		// adatta al massimo del giorno farebbe sembrare grave un 12.
		const sezione = spec.sections[0]!;
		expect(sezione.domain([12])).toEqual({ min: 0, max: 100 });
	});
});

describe('HourlyDetail con la metrica temporali', () => {
	it('mostra il livello e l indice in chiaro con il CAPE', () => {
		render(
			<HourlyDetail
				hourly={giornata({ storm_index: 63, cape: 1800, thunder_prob: 55 })}
				daily={DAILY}
				initialDate={DATE}
				metric="storm"
			/>
		);

		// Il livello va cercato nell'intestazione: le stesse parole compaiono
		// anche come etichette delle fasce sul grafico.
		const intestazione = screen.getByText(/Indice 63\/100/).closest('header')!;
		expect(within(intestazione).getByText('Moderato')).toBeInTheDocument();
		// Il numero accanto all'etichetta: chi sa leggere il CAPE ha il dato,
		// chi non lo sa ha la parola, e nessuno si fida di un punteggio nudo.
		expect(within(intestazione).getByText(/CAPE 1800 J\/kg/)).toBeInTheDocument();
	});

	it('mostra la probabilità di tuono nella seconda sezione', () => {
		render(
			<HourlyDetail
				hourly={giornata({ storm_index: 63, thunder_prob: 55 })}
				daily={DAILY}
				initialDate={DATE}
				metric="storm"
			/>
		);

		expect(screen.getByText('55%')).toBeInTheDocument();
		expect(screen.getByText('Probabilità di tuono')).toBeInTheDocument();
	});

	it('senza indici convettivi lo dichiara, invece di disegnare zero', () => {
		// Uno zero direbbe «nessun temporale», la verità è «non lo sappiamo».
		render(
			<HourlyDetail hourly={giornata()} daily={DAILY} initialDate={DATE} metric="storm" />
		);

		expect(
			screen.getByText(/Indici convettivi non disponibili/)
		).toBeInTheDocument();
	});

	it('una giornata stabile lo dice invece di lasciare il grafico vuoto', () => {
		render(
			<HourlyDetail
				hourly={giornata({ storm_index: 0, condition_code: '0' })}
				daily={DAILY}
				initialDate={DATE}
				metric="storm"
			/>
		);

		expect(screen.getByText('Nessuna instabilità prevista')).toBeInTheDocument();
	});

	it('il CAPE sparisce dalla didascalia quando la fonte non lo dà', () => {
		// Il lifted index da solo basta a produrre l'indice: la didascalia non
		// deve mostrare "CAPE NaN J/kg".
		render(
			<HourlyDetail
				hourly={giornata({ storm_index: 50 })}
				daily={DAILY}
				initialDate={DATE}
				metric="storm"
			/>
		);

		expect(screen.getByText(/Indice 50\/100/)).toBeInTheDocument();
		expect(screen.queryByText(/CAPE/)).toBeNull();
	});

	it('l ora attiva è quella di picco, non la prima del giorno', () => {
		// Chi apre il pannello vuole sapere quando arriva il temporale.
		const ore = giornata({ storm_index: 10 });
		ore[17] = hour(17, { storm_index: 88, cape: 3200 });

		render(
			<HourlyDetail hourly={ore} daily={DAILY} initialDate={DATE} metric="storm" />
		);

		const intestazione = screen.getByText(/Indice 88\/100/).closest('header')!;
		expect(within(intestazione).getByText('Forte')).toBeInTheDocument();
	});
});
