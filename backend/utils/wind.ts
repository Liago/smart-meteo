/**
 * Aggregazione dei dati di vento tra più fonti meteo.
 *
 * Separata dallo Smart Engine per lo stesso motivo di `precipitation.ts`: sono le
 * due regole di merge che non possono essere una media aritmetica, ed essendo
 * funzioni pure sono testabili senza rete né database.
 */

import { WeightedValue } from './precipitation';

export type { WeightedValue };

/** Scarta pesi e valori non finiti o non positivi: renderebbero la media insensata. */
function usable(items: WeightedValue[] | undefined): WeightedValue[] {
	if (!items || items.length === 0) return [];
	return items.filter(
		(i) => Number.isFinite(i.val) && Number.isFinite(i.weight) && i.weight > 0
	);
}

/**
 * Aggrega la direzione del vento (gradi) da più fonti con una media circolare.
 *
 * La media aritmetica è sbagliata su una grandezza angolare: 350° e 10°
 * descrivono entrambi vento da nord, ma la loro media è 180°, cioè l'esatto
 * contrario. Si mediano quindi i versori — somma pesata di seni e coseni — e si
 * riporta l'angolo con `atan2`.
 *
 * Quando le fonti sono in disaccordo totale (es. 0° e 180°) la risultante è
 * prossima a zero e l'angolo diventa arbitrario: in quel caso si restituisce
 * null invece di un valore inventato.
 *
 * @returns i gradi aggregati nell'intervallo [0, 360), arrotondati, o null.
 */
export function aggregateWindDirection(items: WeightedValue[]): number | null {
	const valid = usable(items);
	if (valid.length === 0) return null;

	let sumSin = 0;
	let sumCos = 0;
	let totalWeight = 0;

	for (const { val, weight } of valid) {
		const rad = (val * Math.PI) / 180;
		sumSin += Math.sin(rad) * weight;
		sumCos += Math.cos(rad) * weight;
		totalWeight += weight;
	}

	if (totalWeight === 0) return null;

	// Lunghezza del vettore risultante normalizzata: 1 = accordo perfetto,
	// 0 = direzioni opposte che si annullano.
	const resultantLength = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / totalWeight;
	if (resultantLength < 0.05) return null;

	const deg = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
	return Math.round((deg + 360) % 360);
}

/**
 * Aggrega le raffiche (m/s) da più fonti prendendo il massimo, non la media.
 *
 * Una raffica è già di per sé un estremo: mediarla tra i modelli smorza proprio
 * il picco di cui l'utente deve essere avvisato. Si preferisce quindi la
 * previsione più cautelativa tra le fonti attive.
 *
 * @returns il massimo arrotondato a un decimale, o null se non ci sono dati.
 */
export function aggregateWindGust(items: WeightedValue[]): number | null {
	const valid = usable(items);
	if (valid.length === 0) return null;

	const max = Math.max(...valid.map((i) => Math.max(0, i.val)));
	return Number(max.toFixed(1));
}
