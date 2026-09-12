/**
 * Media e voto pesati, condivisi fra current, daily e hourly.
 *
 * Prima della Fase 6C esistevano tre implementazioni: una pesata e due no.
 * Questi test valgono quindi per tutti e tre i livelli insieme.
 */

import { weightedMean, weightedVote } from '../../utils/aggregate';

describe('weightedMean', () => {
	it('senza valori restituisce null, non zero', () => {
		expect(weightedMean([])).toBeNull();
	});

	it('con un solo valore restituisce quel valore', () => {
		expect(weightedMean([{ val: 21.4, weight: 1.2 }])).toBe(21.4);
	});

	it('pesa i valori: la fonte a peso maggiore sposta di più la media', () => {
		// (30*1.2 + 20*0.8) / 2 = 26, contro 25 della media semplice.
		expect(weightedMean([{ val: 30, weight: 1.2 }, { val: 20, weight: 0.8 }])).toBe(26);
	});

	it('con pesi uguali coincide con la media aritmetica', () => {
		expect(weightedMean([{ val: 10, weight: 1 }, { val: 20, weight: 1 }])).toBe(15);
	});

	it('arrotonda a un decimale', () => {
		expect(weightedMean([{ val: 1.11, weight: 1 }, { val: 2.22, weight: 1 }, { val: 3.33, weight: 1 }])).toBe(2.2);
	});

	it('gestisce i valori negativi', () => {
		expect(weightedMean([{ val: -5, weight: 1 }, { val: -15, weight: 1 }])).toBe(-10);
	});

	it('lo zero è un valore, non un dato assente', () => {
		expect(weightedMean([{ val: 0, weight: 1 }, { val: 10, weight: 1 }])).toBe(5);
	});

	it('scarta pesi e valori non validi; se restano solo quelli restituisce null', () => {
		expect(weightedMean([{ val: 20, weight: 0 }])).toBeNull();
		expect(weightedMean([{ val: NaN, weight: 1 }])).toBeNull();
		expect(weightedMean([{ val: 20, weight: -1 }])).toBeNull();
		expect(weightedMean([{ val: Infinity, weight: 1 }])).toBeNull();
		// Il valore con peso valido sopravvive da solo.
		expect(weightedMean([{ val: 20, weight: 0 }, { val: 12, weight: 1 }])).toBe(12);
	});
});

describe('weightedVote', () => {
	it('senza codici restituisce unknown', () => {
		expect(weightedVote([])).toBe('unknown');
	});

	it('vince il codice che somma più peso, non quello di più fonti', () => {
		// Due fonti da 1.0 concordi battono una da 1.2.
		expect(
			weightedVote([
				{ code: 'clear', weight: 1.2 },
				{ code: 'rain', weight: 1.0 },
				{ code: 'rain', weight: 1.0 },
			])
		).toBe('rain');
	});

	it('una fonte pesante batte una sola fonte leggera', () => {
		expect(
			weightedVote([
				{ code: 'clear', weight: 1.2 },
				{ code: 'rain', weight: 0.8 },
			])
		).toBe('clear');
	});

	it('i codici WMO numerici hanno la precedenza su quelli testuali', () => {
		// Il numero porta più dettaglio di un'etichetta normalizzata a sette
		// famiglie, e sommare pesi fra vocabolari diversi non avrebbe senso:
		// "61" e "rain" descrivono la stessa cosa ma non si riconoscono.
		expect(
			weightedVote([
				{ code: '61', weight: 1.1 },
				{ code: 'rain', weight: 1.0 },
				{ code: 'rain', weight: 1.0 },
			])
		).toBe('61');
	});

	it('fra codici numerici vince comunque il peso', () => {
		expect(
			weightedVote([
				{ code: '61', weight: 1.1 },
				{ code: '3', weight: 1.2 },
			])
		).toBe('3');
	});

	it('ignora codici vuoti e pesi non validi', () => {
		expect(
			weightedVote([
				{ code: '', weight: 5 },
				{ code: 'rain', weight: 0 },
				{ code: 'snow', weight: 1 },
			])
		).toBe('snow');
	});

	it('è deterministico a parità di peso', () => {
		// Con un pareggio vince il primo incontrato: non si estrae a sorte, così
		// due richieste identiche non danno condizioni diverse.
		const items = [
			{ code: 'clear', weight: 1 },
			{ code: 'rain', weight: 1 },
		];
		expect(weightedVote(items)).toBe(weightedVote(items));
		expect(weightedVote(items)).toBe('clear');
	});
});
