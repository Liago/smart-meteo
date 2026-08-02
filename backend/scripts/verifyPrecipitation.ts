/**
 * Verifica dell'aggregazione dei millimetri di precipitazione (`utils/precipitation`).
 *
 * Non richiede chiavi API né rete.
 *
 *   cd backend && npm run test:precipitation
 */

import assert from 'assert';
import {
	aggregatePrecipitationMm,
	WET_FRACTION_GATE,
	WET_THRESHOLD_MM,
} from '../utils/precipitation';

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

console.log('\nprecipitation — aggregazione mm multi-fonte\n');

check('nessun dato → null (la chiave non va emessa)', () => {
	assert.strictEqual(aggregatePrecipitationMm([]), null);
});

check('tutte le fonti asciutte → 0, non null', () => {
	assert.strictEqual(
		aggregatePrecipitationMm([{ val: 0, weight: 1.1 }, { val: 0, weight: 1.2 }]),
		0
	);
});

check('consenso bagnato → media pesata su tutti i valori, zeri inclusi', () => {
	// wet = 1.2 su 3.2 totale = 0.375 ≥ 1/3 → passa il gate.
	// media pesata = (0*1 + 0*1 + 4*1.2) / 3.2 = 1.5
	const result = aggregatePrecipitationMm([
		{ val: 0, weight: 1 },
		{ val: 0, weight: 1 },
		{ val: 4, weight: 1.2 },
	]);
	assert.strictEqual(result, 1.5);
});

check('outlier isolato sotto il gate → 0 (nessuna barra fantasma)', () => {
	// wet = 1 su 4.2 totale = 0.238 < 1/3 → soppresso.
	const result = aggregatePrecipitationMm([
		{ val: 0, weight: 1.1 },
		{ val: 0, weight: 1.1 },
		{ val: 0, weight: 1 },
		{ val: 4, weight: 1 },
	]);
	assert.strictEqual(result, 0);
});

check('una sola fonte, bagnata → passa il gate (frazione 1.0)', () => {
	assert.strictEqual(aggregatePrecipitationMm([{ val: 3.4, weight: 1.2 }]), 3.4);
});

check('accordo unanime → la media pesata coincide col valore', () => {
	const result = aggregatePrecipitationMm([
		{ val: 2, weight: 1.2 },
		{ val: 2, weight: 0.8 },
	]);
	assert.strictEqual(result, 2);
});

check('le fonti a peso maggiore spostano di più la media', () => {
	const pesaTomorrow = aggregatePrecipitationMm([
		{ val: 10, weight: 1.2 },
		{ val: 2, weight: 0.8 },
	]);
	const pesaOpenMeteo = aggregatePrecipitationMm([
		{ val: 10, weight: 0.8 },
		{ val: 2, weight: 1.2 },
	]);
	assert.ok(
		pesaTomorrow! > pesaOpenMeteo!,
		`atteso ${pesaTomorrow} > ${pesaOpenMeteo}`
	);
});

check('tracce sotto la soglia non contano come pioggia', () => {
	// 0.05 mm < WET_THRESHOLD_MM: frazione bagnata 0 → 0.
	assert.ok(0.05 < WET_THRESHOLD_MM);
	assert.strictEqual(
		aggregatePrecipitationMm([{ val: 0.05, weight: 1 }, { val: 0, weight: 1 }]),
		0
	);
});

check('risultato arrotondato a un decimale', () => {
	const result = aggregatePrecipitationMm([
		{ val: 1.11, weight: 1 },
		{ val: 2.22, weight: 1 },
		{ val: 3.33, weight: 1 },
	]);
	assert.strictEqual(result, 2.2);
});

check('valori negativi da arrotondamento trattati come 0', () => {
	assert.strictEqual(
		aggregatePrecipitationMm([{ val: -0.01, weight: 1 }, { val: 0, weight: 1 }]),
		0
	);
});

check('pesi non validi ignorati; se restano solo quelli → null', () => {
	assert.strictEqual(aggregatePrecipitationMm([{ val: 5, weight: 0 }]), null);
	assert.strictEqual(aggregatePrecipitationMm([{ val: NaN, weight: 1 }]), null);
	// Il valore con peso valido sopravvive da solo.
	assert.strictEqual(
		aggregatePrecipitationMm([{ val: 5, weight: 0 }, { val: 2, weight: 1 }]),
		2
	);
});

check('il gate è esattamente inclusivo a 1/3', () => {
	// wet = 1 su 3 = 1/3, non deve essere soppresso.
	const result = aggregatePrecipitationMm([
		{ val: 0, weight: 1 },
		{ val: 0, weight: 1 },
		{ val: 3, weight: 1 },
	]);
	assert.strictEqual(WET_FRACTION_GATE, 1 / 3);
	assert.strictEqual(result, 1);
});

console.log(`\n${passed} verifiche superate${process.exitCode ? ' — CON ERRORI' : ''}\n`);
