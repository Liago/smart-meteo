/**
 * Aggregazione delle quantità di precipitazione (mm) tra più fonti meteo.
 *
 * Separata dallo Smart Engine perché è l'unica logica non ovvia della feature:
 * essendo una funzione pura è testabile senza rete né database.
 */

/** Sotto questa soglia un'ora è considerata asciutta (mm in 1h). */
export const WET_THRESHOLD_MM = 0.1;

/**
 * Frazione minima di peso "bagnato" perché la precipitazione sia considerata
 * reale e non un outlier di una singola fonte.
 */
export const WET_FRACTION_GATE = 1 / 3;

export interface WeightedValue {
	val: number;
	weight: number;
}

/**
 * Aggrega i mm previsti da più fonti per lo stesso slot temporale.
 *
 * Una media pesata pura è fuorviante: [0, 0, 4] darebbe 1.3 mm anche quando due
 * modelli su tre prevedono tempo asciutto. La mediana risolverebbe quel caso ma
 * azzererebbe i rovesci convettivi previsti da una minoranza di fonti, e
 * degenera con n=2. Si usa quindi una media pesata con gate sulla frazione
 * bagnata:
 *
 *   1. se il peso delle fonti che prevedono pioggia è sotto WET_FRACTION_GATE
 *      l'evento è trattato come outlier isolato e si restituisce 0 —
 *      l'incertezza è già comunicata all'utente da `precipitation_prob`;
 *   2. altrimenti si fa la media pesata su TUTTI i valori, zeri compresi
 *      (comportamento standard dell'ensemble QPF: gli zeri smorzano
 *      legittimamente la quantità attesa).
 *
 * @returns i mm aggregati arrotondati a un decimale, o null se non ci sono dati.
 */
export function aggregatePrecipitationMm(items: WeightedValue[]): number | null {
	if (!items || items.length === 0) return null;

	// Ignora pesi non positivi o non finiti: renderebbero la media insensata.
	const valid = items.filter(
		(i) => Number.isFinite(i.val) && Number.isFinite(i.weight) && i.weight > 0
	);
	if (valid.length === 0) return null;

	let totalWeight = 0;
	let wetWeight = 0;
	let weightedSum = 0;

	for (const { val, weight } of valid) {
		// Alcune fonti restituiscono valori negativi minimi per arrotondamento.
		const mm = Math.max(0, val);
		totalWeight += weight;
		weightedSum += mm * weight;
		if (mm >= WET_THRESHOLD_MM) wetWeight += weight;
	}

	if (totalWeight === 0) return null;
	if (wetWeight / totalWeight < WET_FRACTION_GATE) return 0;

	return Number((weightedSum / totalWeight).toFixed(1));
}
