/**
 * Indice di consenso fra le fonti meteo.
 *
 * Un aggregatore possiede un'informazione che una singola fonte non ha: *quanto
 * le fonti sono d'accordo*. Finora quel dato veniva calcolato implicitamente
 * (la media pesata) e buttato: `smart_forecasts.confidence_score` è rimasto
 * null dalla migrazione 005. Questo modulo lo ricostruisce.
 *
 * Separato dallo Smart Engine come `precipitation.ts` e `wind.ts`: è una
 * funzione pura, testabile senza rete né database (`npm run test:consensus`).
 */

import { WeightedValue } from './precipitation';

export type { WeightedValue };

/**
 * Dispersione della temperatura, in °C, oltre la quale l'accordo fra le fonti è
 * considerato nullo. 3 °C di deviazione standard sul dato *corrente* significa
 * che i modelli descrivono situazioni diverse, non la stessa con rumore.
 */
export const TEMP_SPREAD_MAX = 3;

/**
 * Dispersione della probabilità di precipitazione, in punti percentuali, oltre
 * la quale l'accordo è considerato nullo.
 */
export const PROB_SPREAD_MAX = 30;

/** Peso della temperatura nel punteggio complessivo (il resto va alla pioggia). */
export const TEMP_SHARE = 0.6;

/**
 * Costante di shrinkage sul numero di fonti.
 *
 * Due fonti che concordano non danno la stessa garanzia di nove: con pochi
 * campioni la dispersione osservata è essa stessa poco affidabile. Il punteggio
 * viene quindi contratto verso 50 (nessuna informazione) con peso
 * n / (n + SHRINKAGE_K): 1 fonte → 0.33, 3 → 0.6, 9 → 0.82.
 */
export const SHRINKAGE_K = 2;

export interface ConsensusSpread {
	/** Deviazione standard pesata. */
	spread: number;
	min: number;
	max: number;
}

export interface ConsensusResult {
	/** 0-100: 100 = fonti unanimi e numerose, 50 = nessuna informazione utile. */
	score: number;
	level: 'high' | 'medium' | 'low';
	/** Quante fonti hanno contribuito al calcolo. */
	sources_count: number;
	temperature: ConsensusSpread | null;
	precipitation_prob: ConsensusSpread | null;
}

/** Scarta valori e pesi non finiti o non positivi, come negli altri aggregatori. */
function usable(items: WeightedValue[] | undefined): WeightedValue[] {
	if (!items || items.length === 0) return [];
	return items.filter(
		(i) => Number.isFinite(i.val) && Number.isFinite(i.weight) && i.weight > 0
	);
}

/**
 * Deviazione standard pesata (popolazione) con minimo e massimo osservati.
 *
 * Si usa la formula di popolazione e non quella campionaria: le fonti attive
 * *sono* l'insieme completo su cui misuriamo l'accordo, non un campione estratto
 * da una popolazione più ampia. Con una sola fonte la dispersione è 0 per
 * definizione — è lo shrinkage, non la varianza, a dire che quel dato è fragile.
 */
export function weightedSpread(items: WeightedValue[]): ConsensusSpread | null {
	const valid = usable(items);
	if (valid.length === 0) return null;

	let totalWeight = 0;
	let weightedSum = 0;
	for (const { val, weight } of valid) {
		totalWeight += weight;
		weightedSum += val * weight;
	}
	if (totalWeight === 0) return null;

	const mean = weightedSum / totalWeight;
	let variance = 0;
	for (const { val, weight } of valid) {
		variance += weight * (val - mean) ** 2;
	}
	variance /= totalWeight;

	const values = valid.map((i) => i.val);
	return {
		spread: Number(Math.sqrt(variance).toFixed(2)),
		min: Number(Math.min(...values).toFixed(1)),
		max: Number(Math.max(...values).toFixed(1)),
	};
}

/** Porta una dispersione nell'intervallo [0, 1]: 0 dispersione → 1 accordo. */
function agreementFromSpread(spread: number, maxSpread: number): number {
	if (spread <= 0) return 1;
	if (spread >= maxSpread) return 0;
	return 1 - spread / maxSpread;
}

/**
 * Calcola l'indice di consenso su temperatura e probabilità di precipitazione.
 *
 * Restano fuori di proposito le condizioni categoriche: i `condition_code` non
 * sono normalizzati fra i provider (Open-Meteo passa il codice WMO numerico,
 * gli altri una stringa già normalizzata), quindi un voto sui codici grezzi
 * conterebbe come disaccordo WMO 1 e WMO 2, che descrivono lo stesso cielo.
 * Includerle richiede prima una mappa WMO → famiglia lato backend.
 *
 * @param temps valori di temperatura per fonte, con il peso della fonte
 * @param probs probabilità di precipitazione per fonte (0-100)
 * @param sourcesCount numero di fonti che hanno risposto
 */
export function computeConsensus(
	temps: WeightedValue[],
	probs: WeightedValue[],
	sourcesCount: number
): ConsensusResult | null {
	const temperature = weightedSpread(temps);
	const precipitation_prob = weightedSpread(probs);

	if (!temperature && !precipitation_prob) return null;

	const parts: { agreement: number; share: number }[] = [];
	if (temperature) {
		parts.push({
			agreement: agreementFromSpread(temperature.spread, TEMP_SPREAD_MAX),
			share: TEMP_SHARE,
		});
	}
	if (precipitation_prob) {
		parts.push({
			agreement: agreementFromSpread(precipitation_prob.spread, PROB_SPREAD_MAX),
			share: 1 - TEMP_SHARE,
		});
	}

	// Se una delle due grandezze manca, l'altra si prende tutto il peso.
	const totalShare = parts.reduce((sum, p) => sum + p.share, 0);
	const rawAgreement = parts.reduce((sum, p) => sum + p.agreement * p.share, 0) / totalShare;

	// Contrazione verso 0.5 in base al numero di fonti.
	const n = Math.max(0, sourcesCount);
	const confidenceInSample = n / (n + SHRINKAGE_K);
	const shrunk = rawAgreement * confidenceInSample + 0.5 * (1 - confidenceInSample);

	const score = Math.round(shrunk * 100);

	return {
		score,
		level: score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low',
		sources_count: n,
		temperature,
		precipitation_prob,
	};
}
