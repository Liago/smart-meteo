/**
 * Verifica della deduplicazione delle allerte (`utils/alertGeo`).
 *
 * Copre la regressione delle notifiche ripetute: la stessa allerta riemessa dal
 * feed con un id diverso, e le entry multiple che MeteoAlarm pubblica per la
 * stessa regione e lo stesso tipo di avviso.
 *
 * Non richiede chiavi API né rete.
 *
 *   cd backend && npm run test:dedup
 */

import assert from 'assert';
import { WeatherAlert } from '../types';
import { aggregateAlerts, alertSignature, collapseBySignature } from '../utils/alertGeo';

const BORMIO = { lat: 46.4679, lon: 10.3706 };

const OGGI = '2026-08-02';
const DOMANI = '2026-08-03';
const IN_UN_GIORNO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function alert(partial: Partial<WeatherAlert>): WeatherAlert {
	return {
		id: 'test',
		certainty: 'likely',
		description: 'Allerta meteo',
		effectiveTime: `${OGGI}T06:00:00Z`,
		expireTime: IN_UN_GIORNO,
		severity: 'moderate',
		...partial,
	};
}

/** Entry tipica del feed MeteoAlarm italiano */
function meteoalarm(partial: Partial<WeatherAlert>): WeatherAlert {
	return alert({
		areaId: 'IT003',
		areaName: 'Lombardia',
		countryCode: 'IT',
		eventSource: 'EUMETNET',
		providerSource: 'meteoalarm',
		...partial,
	});
}

let passed = 0;
function check(label: string, fn: () => void): void {
	try {
		fn();
		console.log(`  ok   ${label}`);
		passed++;
	} catch (err: any) {
		console.error(`  FAIL ${label}`);
		console.error(`       ${err.message}`);
		process.exitCode = 1;
	}
}

console.log('\nalertSignature — chiave stabile indipendente dal provider\n');

check('la stessa allerta riemessa con un id diverso ha la stessa firma', () => {
	// MeteoAlarm cambia l'<id> dell'entry a ogni aggiornamento del feed:
	// era la ragione per cui la deduplicazione per external_alert_id non teneva.
	const prima = meteoalarm({ id: 'meteoalarm:urn:oid:2.49.0.1.380.0.1', event: 'High-temperature', severity: 'extreme' });
	const dopo = meteoalarm({ id: 'meteoalarm:urn:oid:2.49.0.1.380.0.2', event: 'High-temperature', severity: 'extreme' });

	assert.strictEqual(alertSignature(prima), alertSignature(dopo));
});

check('eventi diversi hanno firme diverse', () => {
	const caldo = meteoalarm({ event: 'High-temperature', severity: 'extreme' });
	const temporale = meteoalarm({ event: 'Thunderstorm', severity: 'moderate' });

	assert.notStrictEqual(alertSignature(caldo), alertSignature(temporale));
});

check('la stessa allerta in regioni diverse ha firme diverse', () => {
	const lombardia = meteoalarm({ event: 'Thunderstorm' });
	const veneto = meteoalarm({ event: 'Thunderstorm', areaId: 'IT005', areaName: 'Veneto' });

	assert.notStrictEqual(alertSignature(lombardia), alertSignature(veneto));
});

check("un avviso rinnovato per il giorno dopo è un evento nuovo", () => {
	const oggi = meteoalarm({ event: 'Thunderstorm', effectiveTime: `${OGGI}T06:00:00Z` });
	const domani = meteoalarm({ event: 'Thunderstorm', effectiveTime: `${DOMANI}T06:00:00Z` });

	assert.notStrictEqual(alertSignature(oggi), alertSignature(domani));
});

check('la punteggiatura e le maiuscole non cambiano la firma', () => {
	const a = meteoalarm({ event: 'High-temperature Warning' });
	const b = meteoalarm({ event: 'high temperature warning' });

	assert.strictEqual(alertSignature(a), alertSignature(b));
});

check('senza event si usa headline, poi description', () => {
	const conHeadline = meteoalarm({ headline: 'Thunderstorm' });
	const conEvent = meteoalarm({ event: 'Thunderstorm' });

	assert.strictEqual(alertSignature(conHeadline), alertSignature(conEvent));
});

console.log('\ncollapseBySignature — una sola notifica per evento\n');

check('le entry ripetute dello stesso avviso diventano una sola allerta', () => {
	// Il caso dello screenshot: 4 notifiche identiche "Red High-temperature Warning".
	const entries = [0, 1, 2, 3].map(i => meteoalarm({
		id: `meteoalarm:entry-${i}`,
		event: 'High-temperature',
		severity: 'extreme',
		effectiveTime: `${OGGI}T0${6 + i}:00:00Z`,
	}));

	const collassate = collapseBySignature(entries);
	assert.strictEqual(collassate.length, 1, `attese 1 allerta, ottenute ${collassate.length}`);
});

check('avvisi distinti restano distinti', () => {
	const caldo = meteoalarm({ id: 'a', event: 'High-temperature', severity: 'extreme' });
	const temporale = meteoalarm({ id: 'b', event: 'Thunderstorm', severity: 'moderate' });

	assert.strictEqual(collapseBySignature([caldo, temporale]).length, 2);
});

check("un aggravamento dello stesso avviso resta una notifica a sé", () => {
	// Giallo → rosso sullo stesso evento è una notizia nuova: la severity fa
	// parte della firma proprio per non silenziarlo.
	const gialla = meteoalarm({ id: 'a', event: 'Thunderstorm', severity: 'moderate' });
	const rossa = meteoalarm({ id: 'b', event: 'Thunderstorm', severity: 'extreme' });

	assert.strictEqual(collapseBySignature([gialla, rossa]).length, 2);
});

check('la finestra risultante copre tutte le entry collassate', () => {
	const mattina = meteoalarm({
		id: 'a',
		event: 'Thunderstorm',
		effectiveTime: `${OGGI}T06:00:00Z`,
		expireTime: `${OGGI}T12:00:00Z`,
	});
	const pomeriggio = meteoalarm({
		id: 'b',
		event: 'Thunderstorm',
		effectiveTime: `${OGGI}T12:00:00Z`,
		expireTime: `${OGGI}T20:00:00Z`,
	});

	const [collassata] = collapseBySignature([mattina, pomeriggio]);
	assert.strictEqual(collassata!.effectiveTime, `${OGGI}T06:00:00Z`);
	assert.strictEqual(collassata!.expireTime, `${OGGI}T20:00:00Z`);
});

check('una lista vuota o singola passa invariata', () => {
	assert.deepStrictEqual(collapseBySignature([]), []);
	const singola = [meteoalarm({ id: 'solo' })];
	assert.deepStrictEqual(collapseBySignature(singola), singola);
});

console.log('\naggregateAlerts — il collasso è attivo nella pipeline\n');

check('le entry duplicate non arrivano al processore delle notifiche', () => {
	const entries = [0, 1, 2, 3].map(i => meteoalarm({
		id: `meteoalarm:entry-${i}`,
		event: 'High-temperature',
		severity: 'extreme',
		effectiveTime: `${OGGI}T0${6 + i}:00:00Z`,
	}));

	const risultato = aggregateAlerts(entries, BORMIO.lat, BORMIO.lon);
	assert.strictEqual(risultato.length, 1, `attesa 1 allerta, ottenute ${risultato.length}`);
});

check('il filtro geografico resta attivo dopo il collasso', () => {
	const locale = meteoalarm({ id: 'a', event: 'Thunderstorm' });
	const siciliana = meteoalarm({ id: 'b', event: 'Thunderstorm', areaId: 'IT020', areaName: 'Sicilia' });

	const risultato = aggregateAlerts([locale, siciliana], BORMIO.lat, BORMIO.lon);
	assert.strictEqual(risultato.length, 1);
	assert.strictEqual(risultato[0]!.areaId, 'IT003');
});

check('le allerte scadute non sopravvivono al collasso', () => {
	const scaduta = meteoalarm({
		id: 'a',
		event: 'Thunderstorm',
		expireTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
	});

	assert.strictEqual(aggregateAlerts([scaduta], BORMIO.lat, BORMIO.lon).length, 0);
});

console.log(`\n${passed} verifiche superate\n`);
