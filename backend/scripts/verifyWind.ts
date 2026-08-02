/**
 * Verifica dell'aggregazione dei dati di vento (`utils/wind`).
 *
 * Non richiede chiavi API né rete.
 *
 *   cd backend && npm run test:wind
 */

import assert from 'assert';
import { aggregateWindDirection, aggregateWindGust } from '../utils/wind';

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

console.log('\nwind — direzione (media circolare) e raffiche (massimo)\n');

// --- Direzione ---

check('nessun dato → null (la chiave non va emessa)', () => {
	assert.strictEqual(aggregateWindDirection([]), null);
});

check('il wrap-around di nord non produce sud', () => {
	// Il caso che la media aritmetica sbaglia: (350 + 10) / 2 = 180.
	const result = aggregateWindDirection([
		{ val: 350, weight: 1 },
		{ val: 10, weight: 1 },
	]);
	assert.strictEqual(result, 0);
});

check('accordo unanime → la media coincide col valore', () => {
	assert.strictEqual(
		aggregateWindDirection([{ val: 225, weight: 1.2 }, { val: 225, weight: 0.8 }]),
		225
	);
});

check('media semplice quando non c\'è wrap-around', () => {
	assert.strictEqual(
		aggregateWindDirection([{ val: 80, weight: 1 }, { val: 100, weight: 1 }]),
		90
	);
});

check('le fonti a peso maggiore tirano la direzione verso di sé', () => {
	const result = aggregateWindDirection([
		{ val: 0, weight: 1.2 },
		{ val: 90, weight: 0.8 },
	])!;
	// Compreso fra i due valori ma più vicino a 0 che a 90.
	assert.ok(result > 0 && result < 45, `atteso 0 < ${result} < 45`);
});

check('direzioni opposte → null invece di un angolo inventato', () => {
	// I versori si annullano: qualunque angolo sarebbe arbitrario.
	assert.strictEqual(
		aggregateWindDirection([{ val: 0, weight: 1 }, { val: 180, weight: 1 }]),
		null
	);
});

check('una sola fonte passa così com\'è', () => {
	assert.strictEqual(aggregateWindDirection([{ val: 137, weight: 1.1 }]), 137);
});

check('il risultato resta nell\'intervallo [0, 360)', () => {
	const result = aggregateWindDirection([
		{ val: 359, weight: 1 },
		{ val: 358, weight: 1 },
	])!;
	assert.ok(result >= 0 && result < 360, `fuori intervallo: ${result}`);
	assert.strictEqual(result, 359); // 358.5 arrotondato
});

check('pesi non validi ignorati; se restano solo quelli → null', () => {
	assert.strictEqual(aggregateWindDirection([{ val: 90, weight: 0 }]), null);
	assert.strictEqual(aggregateWindDirection([{ val: NaN, weight: 1 }]), null);
	// Il valore con peso valido sopravvive da solo.
	assert.strictEqual(
		aggregateWindDirection([{ val: 90, weight: 0 }, { val: 270, weight: 1 }]),
		270
	);
});

// --- Raffiche ---

check('raffiche: nessun dato → null', () => {
	assert.strictEqual(aggregateWindGust([]), null);
});

check('raffiche: massimo, non media', () => {
	// La media darebbe 8.3: attenuerebbe proprio il picco da segnalare.
	const result = aggregateWindGust([
		{ val: 5, weight: 1 },
		{ val: 6, weight: 1.2 },
		{ val: 14, weight: 0.8 },
	]);
	assert.strictEqual(result, 14);
});

check('raffiche: il peso non abbassa il massimo', () => {
	// Anche se la fonte col picco pesa poco, il picco resta.
	assert.strictEqual(
		aggregateWindGust([{ val: 20, weight: 0.8 }, { val: 4, weight: 1.2 }]),
		20
	);
});

check('raffiche: valori negativi da arrotondamento trattati come 0', () => {
	assert.strictEqual(aggregateWindGust([{ val: -0.2, weight: 1 }]), 0);
});

check('raffiche: risultato arrotondato a un decimale', () => {
	assert.strictEqual(aggregateWindGust([{ val: 12.349, weight: 1 }]), 12.3);
});

check('raffiche: pesi non validi ignorati', () => {
	assert.strictEqual(aggregateWindGust([{ val: 30, weight: 0 }]), null);
	// La fonte scartata non deve imporre il suo massimo.
	assert.strictEqual(
		aggregateWindGust([{ val: 30, weight: 0 }, { val: 7, weight: 1 }]),
		7
	);
});

console.log(`\n${passed} verifiche superate${process.exitCode ? ' — CON ERRORI' : ''}\n`);
