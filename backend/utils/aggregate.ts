/**
 * Medie e voti pesati, condivisi fra il livello corrente, quello giornaliero e
 * quello orario dello Smart Engine.
 *
 * Esistevano tre implementazioni quasi identiche: una pesata per `current` e
 * due **non** pesate (`avgSimple`) per daily e hourly. Il risultato era che
 * `SOURCE_WEIGHTS` — il concetto centrale del progetto, con dietro la tabella
 * `source_accuracy` e i pesi dinamici — non entrava nel calcolo dei sette
 * giorni né della curva oraria, cioè di quasi tutto quello che l'utente guarda:
 * Meteostat (0.8, che fornisce osservazioni passate) pesava come WeatherKit
 * (1.2). I millimetri, nello stesso oggetto, erano invece già pesati.
 *
 * Un solo posto, quindi, e funzioni pure testabili senza rete né database.
 */

import { WeightedValue } from './precipitation';

export type { WeightedValue };

/** Scarta valori e pesi non finiti o non positivi: renderebbero la media insensata. */
function usable(items: WeightedValue[] | undefined): WeightedValue[] {
	if (!items || items.length === 0) return [];
	return items.filter(
		(i) => Number.isFinite(i.val) && Number.isFinite(i.weight) && i.weight > 0
	);
}

/**
 * Media pesata, arrotondata a un decimale.
 *
 * @returns null quando non c'è nessun valore utilizzabile, così il chiamante
 *          può omettere la chiave invece di emettere uno zero inventato.
 */
export function weightedMean(items: WeightedValue[]): number | null {
	const valid = usable(items);
	if (valid.length === 0) return null;

	let totalWeight = 0;
	let weightedSum = 0;
	for (const { val, weight } of valid) {
		totalWeight += weight;
		weightedSum += val * weight;
	}
	if (totalWeight === 0) return null;

	return Number((weightedSum / totalWeight).toFixed(1));
}

export interface WeightedCode {
	code: string;
	weight: number;
}

/**
 * Voto pesato sulle condizioni meteo.
 *
 * Vince il codice che somma più **peso**, non quello riportato da più fonti:
 * due provider deboli concordi possono superare uno forte, ma un provider
 * forte può superare un singolo debole.
 *
 * I codici WMO numerici hanno la precedenza su quelli testuali quando entrambi
 * sono presenti: Open-Meteo passa il numero, che porta più dettaglio di
 * un'etichetta già normalizzata a sette famiglie. Escluderli dal confronto
 * evita anche di sommare pesi fra vocabolari diversi, dove "61" e "rain"
 * descrivono la stessa cosa ma non si riconoscono fra loro.
 *
 * @returns il codice vincente, o 'unknown' se non c'è niente da votare.
 */
export function weightedVote(items: WeightedCode[]): string {
	const valid = (items ?? []).filter(
		(i) => i.code != null && i.code !== '' && Number.isFinite(i.weight) && i.weight > 0
	);
	if (valid.length === 0) return 'unknown';

	const isNumeric = (code: string) => !isNaN(Number(code)) && code.trim() !== '';
	const numeric = valid.filter((i) => isNumeric(i.code));
	const target = numeric.length > 0 ? numeric : valid;

	const scores = new Map<string, number>();
	for (const { code, weight } of target) {
		scores.set(code, (scores.get(code) ?? 0) + weight);
	}

	let best = 'unknown';
	let bestScore = -1;
	for (const [code, score] of scores) {
		if (score > bestScore) {
			bestScore = score;
			best = code;
		}
	}
	return best;
}
