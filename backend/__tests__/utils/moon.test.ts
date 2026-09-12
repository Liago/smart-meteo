/**
 * Fase lunare calcolata localmente.
 *
 * Serve solo come fallback: quando una fonte fornisce `moon_phase` lo Smart
 * Engine preferisce quella. Il calcolo resta però l'unica risposta possibile
 * quando nessuna fonte astronomica risponde, quindi va tenuto sotto controllo.
 */

import { getMoonPhase } from '../../utils/moon';

const FASI = [
	'Luna Nuova',
	'Luna Crescente',
	'Primo Quarto',
	'Gibbosa Crescente',
	'Luna Piena',
	'Gibbosa Calante',
	'Ultimo Quarto',
	'Luna Calante',
];

describe('getMoonPhase', () => {
	it('restituisce sempre una delle otto fasi in italiano', () => {
		// Un anno intero di date: nessuna deve cadere fuori dal vocabolario.
		for (let giorno = 0; giorno < 365; giorno++) {
			const data = new Date(2026, 0, 1 + giorno);
			expect(FASI).toContain(getMoonPhase(data));
		}
	});

	it('copre tutte e otto le fasi nel corso di un anno', () => {
		const viste = new Set<string>();
		for (let giorno = 0; giorno < 365; giorno++) {
			viste.add(getMoonPhase(new Date(2026, 0, 1 + giorno)));
		}
		expect(viste.size).toBe(8);
	});

	it('dopo un ciclo sinodico la fase torna al punto di partenza, a meno di un passo', () => {
		// Il mese sinodico è 29.53 giorni e le fasi sono otto bucket da 3.69
		// giorni: avanzando di 30 giorni interi il residuo è mezzo giorno, che
		// può cadere oltre il confine del bucket. Lo scarto ammesso è quindi uno,
		// non zero — pretendere l'uguaglianza esatta sarebbe un test fragile.
		const partenza = FASI.indexOf(getMoonPhase(new Date(2026, 5, 1)));
		const dopo = FASI.indexOf(getMoonPhase(new Date(2026, 5, 1 + 30)));
		const scarto = Math.min((dopo - partenza + 8) % 8, (partenza - dopo + 8) % 8);
		expect(scarto).toBeLessThanOrEqual(1);
	});

	it('non salta fasi da un giorno al successivo', () => {
		// Ogni fase dura circa 3.7 giorni: fra due giorni consecutivi l'indice
		// può restare fermo o avanzare di uno, mai di più.
		let precedente = FASI.indexOf(getMoonPhase(new Date(2026, 0, 1)));
		for (let giorno = 1; giorno < 120; giorno++) {
			const corrente = FASI.indexOf(getMoonPhase(new Date(2026, 0, 1 + giorno)));
			const salto = (corrente - precedente + 8) % 8;
			expect(salto).toBeLessThanOrEqual(1);
			precedente = corrente;
		}
	});

	it('gennaio e febbraio non rompono il calcolo (mese spostato indietro di un anno)', () => {
		// L'algoritmo tratta i mesi < 3 come parte dell'anno precedente: è il
		// punto in cui un errore di segno passerebbe inosservato.
		for (const data of [new Date(2026, 0, 15), new Date(2026, 1, 28), new Date(2027, 0, 1)]) {
			expect(FASI).toContain(getMoonPhase(data));
		}
	});

	it('è deterministico: la stessa data dà sempre la stessa fase', () => {
		const data = new Date(2026, 8, 12);
		expect(getMoonPhase(data)).toBe(getMoonPhase(new Date(2026, 8, 12)));
	});
});
