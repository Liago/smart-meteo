/**
 * Indice di rischio temporali dagli indici convettivi.
 *
 * Oggi il temporale si deduce solo dal `condition_code`, che è una fotografia
 * («rovescio temporalesco») e non una misura: non distingue il tuono isolato di
 * fine pomeriggio dalla supercella, e sotto la stessa etichetta mette ore molto
 * diverse. In Italia d'estate è la domanda del giorno.
 *
 * CAPE e lifted index misurano la stessa cosa — quanta energia ha a
 * disposizione una particella d'aria che sale — da due direzioni diverse:
 * il primo è un'energia integrata su tutta la colonna (J/kg), il secondo la
 * differenza di temperatura a 500 hPa fra la particella sollevata e l'ambiente
 * (°C, negativo = instabile). La CIN è il coperchio: l'energia può esserci e
 * restare inutilizzata.
 *
 * Tutte funzioni pure, testabili senza rete né database.
 */

/**
 * Soglie CAPE in J/kg, convenzione operativa dei servizi meteorologici.
 *
 * Sotto i 300 J/kg i temporali sono di fatto esclusi; oltre i 2500 si entra nel
 * territorio dei temporali organizzati, e oltre i 4000 in quello degli eventi
 * severi. Le soglie sono i punti di una spezzata, non dei gradini: fra l'una e
 * l'altra il valore è interpolato, perché 990 e 1010 J/kg non sono due mondi.
 */
export const CAPE_POINTS: [cape: number, score: number][] = [
	[0, 0],
	[300, 25],
	[1000, 50],
	[2500, 75],
	[4000, 100],
];

/**
 * Soglie del lifted index in °C, dallo stabile all'estremamente instabile.
 *
 * Il segno è invertito rispetto all'intuizione: **più negativo = più
 * instabile**. +2 e oltre è aria stabile, sotto −6 la colonna è
 * marcatamente instabile.
 */
export const LIFTED_INDEX_POINTS: [lifted: number, score: number][] = [
	[2, 0],
	[0, 25],
	[-3, 50],
	[-6, 75],
	[-9, 100],
];

/**
 * Fasce dell'indice risultante, 0-100.
 *
 * Quattro e non cinque, come per l'indice UV: in un grafico alto 150 px una
 * quinta etichetta finirebbe sovrapposta alla precedente. Il livello resta
 * comunque nel colore della barra e nella didascalia.
 */
export const STORM_THRESHOLDS = {
	weak: 25,
	moderate: 50,
	strong: 75,
} as const;

export type StormLevel = 'none' | 'weak' | 'moderate' | 'strong';

/** CIN (valore assoluto, J/kg) sotto la quale il coperchio non conta. */
export const CIN_FREE_JKG = 25;

/** CIN oltre la quale lo smorzamento è al massimo. */
export const CIN_CAPPED_JKG = 200;

/**
 * Fattore minimo dello smorzamento da CIN.
 *
 * Non si scende a zero di proposito: il coperchio si rompe — riscaldamento
 * pomeridiano, sollevamento orografico, un fronte che passa — e dichiarare
 * «nessun rischio» su una giornata con 3000 J/kg di CAPE inibita sarebbe il
 * tipo di previsione che fa male a chi ci va in montagna.
 */
export const CIN_MIN_FACTOR = 0.3;

/** Interpola un valore su una spezzata di punti, estremi inclusi. */
function interpolate(points: [number, number][], value: number): number {
	const ascending = points[0]![0] < points[points.length - 1]![0];
	const ordered = ascending ? points : [...points].reverse();

	const first = ordered[0]!;
	const last = ordered[ordered.length - 1]!;
	if (value <= first[0]) return first[1];
	if (value >= last[0]) return last[1];

	for (let i = 0; i < ordered.length - 1; i++) {
		const [x0, y0] = ordered[i]!;
		const [x1, y1] = ordered[i + 1]!;
		if (value >= x0 && value <= x1) {
			const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
			return y0 + t * (y1 - y0);
		}
	}
	return last[1];
}

/**
 * Smorzamento dovuto all'inibizione convettiva.
 *
 * I modelli non concordano sul segno della CIN: alcuni la danno negativa
 * (è un'energia che manca), altri come modulo. Si usa il valore assoluto,
 * altrimenti metà delle fonti non verrebbe smorzata affatto.
 */
export function cinFactor(cin: number | null | undefined): number {
	if (cin == null || !Number.isFinite(cin)) return 1;
	const magnitude = Math.abs(cin);
	if (magnitude <= CIN_FREE_JKG) return 1;
	if (magnitude >= CIN_CAPPED_JKG) return CIN_MIN_FACTOR;

	const t = (magnitude - CIN_FREE_JKG) / (CIN_CAPPED_JKG - CIN_FREE_JKG);
	return 1 - t * (1 - CIN_MIN_FACTOR);
}

/**
 * I tre campi sono dichiarati anche `undefined` e non solo opzionali: con
 * `exactOptionalPropertyTypes` le due cose non coincidono, e il chiamante
 * naturale è uno slot orario dove un campo assente arriva come `undefined`.
 */
export interface ConvectiveInputs {
	/** Energia potenziale convettiva disponibile, J/kg. */
	cape?: number | null | undefined;
	/** Lifted index, °C: negativo = instabile. */
	lifted_index?: number | null | undefined;
	/** Inibizione convettiva, J/kg. */
	convective_inhibition?: number | null | undefined;
}

/**
 * Indice 0-100 di rischio temporali.
 *
 * CAPE e lifted index vengono mediati quando ci sono entrambi: misurano la
 * stessa instabilità con metodi diversi, e la media smorza lo scarto di un
 * singolo campo del modello senza appiattire il segnale. Con uno solo dei due
 * si usa quello, perché non tutti i modelli espongono entrambi.
 *
 * @returns l'indice arrotondato all'intero, o null se nessun indice è presente.
 */
export function stormIndex(inputs: ConvectiveInputs): number | null {
	const scores: number[] = [];

	if (inputs.cape != null && Number.isFinite(inputs.cape)) {
		scores.push(interpolate(CAPE_POINTS, Math.max(0, inputs.cape)));
	}
	if (inputs.lifted_index != null && Number.isFinite(inputs.lifted_index)) {
		scores.push(interpolate(LIFTED_INDEX_POINTS, inputs.lifted_index));
	}
	if (scores.length === 0) return null;

	const instability = scores.reduce((sum, s) => sum + s, 0) / scores.length;
	const damped = instability * cinFactor(inputs.convective_inhibition);

	return Math.round(Math.min(100, Math.max(0, damped)));
}

/** Classifica l'indice secondo `STORM_THRESHOLDS`. */
export function stormLevel(index: number | null | undefined): StormLevel {
	if (index == null || !Number.isFinite(index)) return 'none';
	if (index >= STORM_THRESHOLDS.strong) return 'strong';
	if (index >= STORM_THRESHOLDS.moderate) return 'moderate';
	if (index >= STORM_THRESHOLDS.weak) return 'weak';
	return 'none';
}
