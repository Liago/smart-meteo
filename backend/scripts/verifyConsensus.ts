/**
 * Verifica dell'indice di consenso fra le fonti (`utils/consensus`).
 *
 * Non richiede chiavi API né rete.
 *
 *   cd backend && npm run test:consensus
 */

import assert from 'assert';
import {
	computeConsensus,
	weightedSpread,
	PROB_SPREAD_MAX,
	SHRINKAGE_K,
	TEMP_SPREAD_MAX,
} from '../utils/consensus';

let passed = 0;
function check(label: string, fn: () => void): void {
	try {
		fn();
		passed++;
		console.log(`  ok   ${label}`);
	} catch (err: any) {
		console.error(`  FAIL ${label}\n       ${err.message}`);
		process.exitCode = 1;
	}
}

console.log('\nconsensus — accordo fra le fonti\n');

check('nessun dato → null (la chiave non va emessa)', () => {
	assert.strictEqual(weightedSpread([]), null);
	assert.strictEqual(computeConsensus([], [], 0), null);
});

check('dispersione nulla su valori identici', () => {
	const spread = weightedSpread([
		{ val: 20, weight: 1.2 },
		{ val: 20, weight: 0.8 },
	]);
	assert.strictEqual(spread!.spread, 0);
	assert.strictEqual(spread!.min, 20);
	assert.strictEqual(spread!.max, 20);
});

check('min e max sono gli estremi osservati, non la media', () => {
	const spread = weightedSpread([
		{ val: 18, weight: 1 },
		{ val: 21, weight: 1 },
		{ val: 24, weight: 1 },
	]);
	assert.strictEqual(spread!.min, 18);
	assert.strictEqual(spread!.max, 24);
	// Deviazione standard di popolazione di [18,21,24] = sqrt(6) ≈ 2.45
	assert.strictEqual(spread!.spread, 2.45);
});

check('il peso della fonte sposta la dispersione', () => {
	// La stessa coppia di valori pesa meno quando l'outlier ha peso basso.
	const outlierPesante = weightedSpread([
		{ val: 20, weight: 1 },
		{ val: 26, weight: 1 },
	])!.spread;
	const outlierLeggero = weightedSpread([
		{ val: 20, weight: 1 },
		{ val: 26, weight: 0.1 },
	])!.spread;
	assert.ok(
		outlierLeggero < outlierPesante,
		`atteso ${outlierLeggero} < ${outlierPesante}`
	);
});

check('pesi e valori non validi ignorati', () => {
	assert.strictEqual(weightedSpread([{ val: 20, weight: 0 }]), null);
	assert.strictEqual(weightedSpread([{ val: NaN, weight: 1 }]), null);
	const spread = weightedSpread([
		{ val: 20, weight: 0 },
		{ val: 22, weight: 1 },
	]);
	assert.strictEqual(spread!.spread, 0);
});

check('unanimità su molte fonti → punteggio alto', () => {
	const temps = Array.from({ length: 9 }, () => ({ val: 20, weight: 1 }));
	const probs = Array.from({ length: 9 }, () => ({ val: 10, weight: 1 }));
	const res = computeConsensus(temps, probs, 9)!;
	// accordo 1.0 contratto con 9/(9+2) = 0.818 → 0.909
	assert.strictEqual(res.score, 91);
	assert.strictEqual(res.level, 'high');
	assert.strictEqual(res.sources_count, 9);
});

check('disaccordo pieno su molte fonti → punteggio basso', () => {
	const temps = [
		{ val: 12, weight: 1 },
		{ val: 18, weight: 1 },
		{ val: 24, weight: 1 },
		{ val: 30, weight: 1 },
	];
	const probs = [
		{ val: 0, weight: 1 },
		{ val: 40, weight: 1 },
		{ val: 80, weight: 1 },
		{ val: 100, weight: 1 },
	];
	const res = computeConsensus(temps, probs, 4)!;
	assert.ok(res.score < 25, `atteso < 25, ottenuto ${res.score}`);
	assert.strictEqual(res.level, 'low');
});

check('una sola fonte non vale un consenso: contratto verso 50', () => {
	const res = computeConsensus([{ val: 20, weight: 1.2 }], [{ val: 10, weight: 1.2 }], 1)!;
	// accordo 1.0 ma peso campione 1/(1+2) = 0.333 → 0.667
	assert.strictEqual(res.score, 67);
	assert.strictEqual(res.level, 'medium');
	assert.strictEqual(SHRINKAGE_K, 2);
});

check('a pari accordo, più fonti → punteggio più alto', () => {
	const mk = (n: number) => {
		const temps = Array.from({ length: n }, () => ({ val: 20, weight: 1 }));
		const probs = Array.from({ length: n }, () => ({ val: 10, weight: 1 }));
		return computeConsensus(temps, probs, n)!.score;
	};
	assert.ok(mk(9) > mk(4), 'nove fonti devono battere quattro');
	assert.ok(mk(4) > mk(2), 'quattro fonti devono battere due');
});

check('dispersione oltre la soglia → contributo azzerato, non negativo', () => {
	// 10 °C di scarto è ben oltre TEMP_SPREAD_MAX: l'accordo sulla temperatura
	// vale 0, ma la pioggia unanime tiene su il punteggio.
	const temps = [
		{ val: 10, weight: 1 },
		{ val: 30, weight: 1 },
	];
	const probs = [
		{ val: 20, weight: 1 },
		{ val: 20, weight: 1 },
	];
	const res = computeConsensus(temps, probs, 2)!;
	assert.ok(res.temperature!.spread > TEMP_SPREAD_MAX);
	assert.ok(res.score > 0, 'il punteggio non può essere negativo');
	// solo la quota pioggia (0.4) sopravvive, contratta con 2/(2+2) = 0.5
	assert.strictEqual(res.score, 45);
});

check('se manca la pioggia, la temperatura si prende tutto il peso', () => {
	const temps = Array.from({ length: 4 }, () => ({ val: 20, weight: 1 }));
	const soloTemp = computeConsensus(temps, [], 4)!;
	const conEntrambe = computeConsensus(
		temps,
		Array.from({ length: 4 }, () => ({ val: 5, weight: 1 })),
		4
	)!;
	// Accordo perfetto in entrambi i casi: il punteggio non deve cambiare solo
	// perché una grandezza non è disponibile.
	assert.strictEqual(soloTemp.score, conEntrambe.score);
	assert.strictEqual(soloTemp.precipitation_prob, null);
});

check('la soglia pioggia è in punti percentuali, non in frazione', () => {
	assert.strictEqual(PROB_SPREAD_MAX, 30);
	// 30 punti di deviazione standard azzerano il contributo pioggia.
	const res = computeConsensus(
		[{ val: 20, weight: 1 }, { val: 20, weight: 1 }],
		[{ val: 0, weight: 1 }, { val: 60, weight: 1 }],
		2
	)!;
	assert.ok(res.precipitation_prob!.spread >= PROB_SPREAD_MAX);
	// solo la quota temperatura sopravvive: 0.6, contratto con 2/(2+2) = 0.5
	// → 0.6*0.5 + 0.5*0.5 = 0.55
	assert.strictEqual(res.score, 55);
});

check('punteggio sempre nell intervallo 0-100', () => {
	const casi = [
		computeConsensus([{ val: -40, weight: 1 }, { val: 50, weight: 1 }], [{ val: 0, weight: 1 }, { val: 100, weight: 1 }], 2),
		computeConsensus(Array.from({ length: 20 }, () => ({ val: 15, weight: 1 })), [], 20),
		computeConsensus([{ val: 0, weight: 0.0001 }], [], 1),
	];
	for (const res of casi) {
		assert.ok(res!.score >= 0 && res!.score <= 100, `fuori intervallo: ${res!.score}`);
	}
});

console.log(`\n${passed} verifiche superate${process.exitCode ? ' — CON ERRORI' : ''}\n`);
