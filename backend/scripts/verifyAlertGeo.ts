/**
 * Verifica del filtro geografico delle allerte (`utils/alertGeo`).
 *
 * Non richiede chiavi API né rete: usa allerte di esempio ricalcate su quelle
 * realmente ricevute a Bormio (Sicilia, Emilia e Romagna, Molise, Umbria).
 *
 *   cd backend && npm run test:alerts
 */

import assert from 'assert';
import { WeatherAlert } from '../types';
import {
	aggregateAlerts,
	getRegionsForPoint,
	isAlertRelevantForPoint,
} from '../utils/alertGeo';

const BORMIO = { lat: 46.4679, lon: 10.3706 };
const PALERMO = { lat: 38.1157, lon: 13.3615 };
const ZURIGO = { lat: 47.3769, lon: 8.5417 };

const IN_UN_ORA = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const UN_ORA_FA = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function alert(partial: Partial<WeatherAlert>): WeatherAlert {
	return {
		id: 'test',
		certainty: 'likely',
		description: 'Allerta meteo',
		effectiveTime: new Date().toISOString(),
		expireTime: IN_UN_ORA,
		severity: 'moderate',
		...partial,
	};
}

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

console.log('\nalertGeo — filtro geografico allerte\n');

check('Bormio ricade solo in Lombardia', () => {
	const regions = getRegionsForPoint(BORMIO.lat, BORMIO.lon).map(r => r.name);
	assert.deepStrictEqual(regions, ['Lombardia']);
});

check('allerta WeatherAPI per la Sicilia scartata a Bormio', () => {
	const a = alert({
		id: 'weatherapi:heat_sicilia',
		areaName: 'Sicilia',
		headline: 'Rosso Onda Di Calore Allerta',
		description: "Allerta Onda Di Calore Rosso per l'Italia - Sicilia",
		severity: 'extreme',
	});
	assert.strictEqual(isAlertRelevantForPoint(a, BORMIO.lat, BORMIO.lon), false);
	assert.strictEqual(isAlertRelevantForPoint(a, PALERMO.lat, PALERMO.lon), true);
});

check('allerte di Emilia e Romagna, Molise e Umbria scartate a Bormio', () => {
	for (const area of ['Emilia e Romagna', 'Molise', 'Umbria']) {
		const a = alert({ areaName: area, eventSource: 'EUMETNET' });
		assert.strictEqual(
			isAlertRelevantForPoint(a, BORMIO.lat, BORMIO.lon),
			false,
			`${area} non doveva passare`
		);
	}
});

check('allerte della Lombardia mantenute a Bormio', () => {
	const a = alert({
		areaName: 'Lombardia',
		event: 'Red High-temperature Warning',
		eventSource: 'MeteoAlarm',
		severity: 'extreme',
	});
	assert.strictEqual(isAlertRelevantForPoint(a, BORMIO.lat, BORMIO.lon), true);
});

check('EMMA_ID ha la precedenza sul testo libero', () => {
	// areaId siciliano, descrizione che nomina la Lombardia: vince l'areaId
	const a = alert({ areaId: 'IT020', description: 'Allerta valida anche in Lombardia' });
	assert.strictEqual(isAlertRelevantForPoint(a, BORMIO.lat, BORMIO.lon), false);
	assert.strictEqual(isAlertRelevantForPoint(a, PALERMO.lat, PALERMO.lon), true);
});

check('il nome regione va riconosciuto anche con trattino o in inglese', () => {
	const emilia = alert({ areaName: 'Emilia-Romagna' });
	assert.strictEqual(isAlertRelevantForPoint(emilia, BORMIO.lat, BORMIO.lon), false);

	const sicily = alert({ areaName: 'Sicily' });
	assert.strictEqual(isAlertRelevantForPoint(sicily, PALERMO.lat, PALERMO.lon), true);
	assert.strictEqual(isAlertRelevantForPoint(sicily, BORMIO.lat, BORMIO.lon), false);
});

check('allerta senza informazioni di area (OpenWeatherMap) mantenuta', () => {
	const a = alert({
		id: 'owm:Thunderstorm_123',
		description: 'Sono previsti temporali di forte intensità',
		source: 'Protezione Civile',
	});
	assert.strictEqual(isAlertRelevantForPoint(a, BORMIO.lat, BORMIO.lon), true);
});

check('allerta di un altro paese scartata', () => {
	const a = alert({ countryCode: 'FR', areaName: 'Savoie' });
	assert.strictEqual(isAlertRelevantForPoint(a, BORMIO.lat, BORMIO.lon), false);
});

check('fuori dalle regioni mappate non si filtra nulla', () => {
	const a = alert({ areaName: 'Sicilia' });
	assert.strictEqual(isAlertRelevantForPoint(a, ZURIGO.lat, ZURIGO.lon), true);
});

console.log('\naggregateAlerts — pipeline completa\n');

check('scarta scadute e non pertinenti, tiene le locali', () => {
	const alerts: WeatherAlert[] = [
		alert({ id: 'a1', areaName: 'Sicilia', event: 'Heat' }),
		alert({ id: 'a2', areaName: 'Molise', event: 'Rain' }),
		alert({ id: 'a3', areaName: 'Umbria', event: 'Wind' }),
		alert({ id: 'a4', areaName: 'Emilia e Romagna', event: 'Heat' }),
		alert({ id: 'a5', areaName: 'Lombardia', event: 'Thunderstorm' }),
		alert({ id: 'a6', areaName: 'Lombardia', event: 'Snow', expireTime: UN_ORA_FA }),
	];

	const result = aggregateAlerts(alerts, BORMIO.lat, BORMIO.lon);
	assert.deepStrictEqual(result.map(a => a.id), ['a5']);
});

check('la deduplicazione multi-source resta attiva e tiene la severity più alta', () => {
	const now = new Date().toISOString();
	const alerts: WeatherAlert[] = [
		alert({ id: 'wk', areaName: 'Lombardia', event: 'Thunderstorm Warning', effectiveTime: now, severity: 'moderate', providerSource: 'weatherkit' }),
		alert({ id: 'ma', areaName: 'Lombardia', event: 'Thunderstorm Warning', effectiveTime: now, severity: 'severe', providerSource: 'meteoalarm' }),
	];

	const result = aggregateAlerts(alerts, BORMIO.lat, BORMIO.lon);
	assert.strictEqual(result.length, 1);
	assert.strictEqual(result[0]!.severity, 'severe');
});

console.log(`\n${passed} verifiche superate${process.exitCode ? ' — CON ERRORI' : ''}\n`);
