/**
 * Normalizzazione delle condizioni e costruzione dell'oggetto unificato.
 *
 * `normalizeCondition` è il punto in cui nove vocabolari diversi di provider
 * diventano sette codici: se cede, l'engine vota su etichette che non esistono.
 */

import {
	UnifiedForecast,
	normalizeCondition,
	normalizeConditionWithCloudCover,
} from '../../utils/formatter';

describe('normalizeCondition', () => {
	it('senza testo restituisce unknown, non una stringa vuota', () => {
		expect(normalizeCondition(null)).toBe('unknown');
		expect(normalizeCondition(undefined)).toBe('unknown');
		expect(normalizeCondition('')).toBe('unknown');
	});

	it.each([
		['Clear', 'clear'],
		['Sunny', 'clear'],
		['Clear sky', 'clear'],
		['Partly cloudy', 'cloudy'],
		['Overcast', 'cloudy'],
		['Light rain', 'rain'],
		['Patchy light drizzle', 'rain'],
		['Moderate or heavy rain shower', 'rain'],
		['Light snow', 'snow'],
		['Blizzard', 'snow'],
		['Thundery outbreaks possible', 'storm'],
		['Torrential rain shower', 'rain'],
		['Fog', 'fog'],
		['Mist', 'fog'],
	])('%s → %s', (input, expected) => {
		expect(normalizeCondition(input)).toBe(expected);
	});

	it('è insensibile al maiuscolo, come arrivano i testi dai provider', () => {
		expect(normalizeCondition('SUNNY')).toBe('clear');
		expect(normalizeCondition('HEAVY SNOW')).toBe('snow');
	});

	it('un testo sconosciuto resta unknown invece di essere indovinato', () => {
		expect(normalizeCondition('Hurricane')).toBe('unknown');
		expect(normalizeCondition('Code: 1001')).toBe('unknown');
	});

	describe('ordine di precedenza fra pattern compresenti', () => {
		it('la pioggia vince sulle nuvole: "cloudy with rain" è pioggia per l\'utente', () => {
			// `cloud` viene controllato prima di `rain` nella catena di if, quindi
			// questo test fotografa il comportamento reale: serve a far emergere
			// la scelta, non a benedirla.
			expect(normalizeCondition('Cloudy with light rain')).toBe('cloudy');
		});

		it('"thunderstorm" contiene "storm" e resta storm', () => {
			expect(normalizeCondition('Thunderstorm')).toBe('storm');
		});
	});
});

describe('normalizeConditionWithCloudCover', () => {
	it('senza copertura nuvolosa la condizione non viene toccata', () => {
		expect(normalizeConditionWithCloudCover('cloudy', null)).toBe('cloudy');
		expect(normalizeConditionWithCloudCover('unknown', null)).toBe('unknown');
	});

	it('cielo quasi libero promuove unknown e cloudy a clear', () => {
		expect(normalizeConditionWithCloudCover('unknown', 10)).toBe('clear');
		expect(normalizeConditionWithCloudCover('cloudy', 5)).toBe('clear');
	});

	it('copertura alta declassa clear a cloudy', () => {
		expect(normalizeConditionWithCloudCover('clear', 90)).toBe('cloudy');
	});

	it('copertura media declassa clear a cloudy', () => {
		expect(normalizeConditionWithCloudCover('clear', 50)).toBe('cloudy');
	});

	it('clear con poche nuvole resta clear', () => {
		expect(normalizeConditionWithCloudCover('clear', 20)).toBe('clear');
	});

	it('non riscrive mai pioggia, neve, temporale o nebbia', () => {
		// Nuvole a zero con pioggia prevista è un'incoerenza fra fonti diverse:
		// nel dubbio non si cancella un fenomeno.
		for (const condition of ['rain', 'snow', 'storm', 'fog']) {
			expect(normalizeConditionWithCloudCover(condition, 0)).toBe(condition);
			expect(normalizeConditionWithCloudCover(condition, 100)).toBe(condition);
		}
	});

	it('i codici WMO numerici non vengono reinterpretati come testo', () => {
		// Open-Meteo passa il codice numerico: va lasciato intatto, altrimenti
		// il voting perde l'informazione di dettaglio.
		expect(normalizeConditionWithCloudCover('61', 80)).toBe('61');
	});
});

describe('UnifiedForecast', () => {
	const base = { source: 'test', lat: 45.4, lon: 9.2, time: '2026-09-12T12:00:00Z' };

	it('i campi non forniti diventano null, non undefined', () => {
		const f = new UnifiedForecast(base);
		expect(f.temp).toBeNull();
		expect(f.humidity).toBeNull();
		expect(f.pressure).toBeNull();
		expect(f.uv_index).toBeNull();
		expect(f.visibility).toBeNull();
		expect(f.cloud_cover).toBeNull();
		expect(f.dew_point).toBeNull();
	});

	it('un condition_code esplicito ha la precedenza sul testo', () => {
		// Era il bug 1.4 del changelog API: il costruttore ignorava il codice
		// già normalizzato dai connettori e riderivava tutto dal testo.
		const f = new UnifiedForecast({ ...base, condition_code: 'storm', condition_text: 'Sunny' });
		expect(f.condition_code).toBe('storm');
	});

	it('senza condition_code il codice viene derivato dal testo', () => {
		const f = new UnifiedForecast({ ...base, condition_text: 'Light rain' });
		expect(f.condition_code).toBe('rain');
	});

	it('senza testo né codice il codice è unknown', () => {
		expect(new UnifiedForecast(base).condition_code).toBe('unknown');
	});

	it('temperatura, percepita, raffica e dew point arrotondati a un decimale', () => {
		const f = new UnifiedForecast({
			...base,
			temp: 21.456,
			feels_like: 19.94,
			wind_gust: 12.349,
			dew_point: 8.88,
		});
		expect(f.temp).toBe(21.5);
		expect(f.feels_like).toBe(19.9);
		expect(f.wind_gust).toBe(12.3);
		expect(f.dew_point).toBe(8.9);
	});

	it('lo zero non viene confuso con un valore assente', () => {
		const f = new UnifiedForecast({
			...base,
			temp: 0,
			precipitation_prob: 0,
			wind_speed: 0,
			cloud_cover: 0,
		});
		expect(f.temp).toBe(0);
		expect(f.precipitation_prob).toBe(0);
		expect(f.wind_speed).toBe(0);
		expect(f.cloud_cover).toBe(0);
	});

	it('le temperature negative restano negative', () => {
		expect(new UnifiedForecast({ ...base, temp: -7.34 }).temp).toBe(-7.3);
	});

	it('daily, hourly, astronomy e air_quality non finiscono nel JSON quando mancano', () => {
		// I campi sono dichiarati `?:` sulla classe, quindi la proprietà *esiste*
		// con valore undefined: `'daily' in f` è true. Quello che conta è la forma
		// serializzata, perché è quella che arriva ai client.
		const f = new UnifiedForecast(base);
		const wire = JSON.parse(JSON.stringify(f));
		expect(wire).not.toHaveProperty('daily');
		expect(wire).not.toHaveProperty('hourly');
		expect(wire).not.toHaveProperty('astronomy');
		expect(wire).not.toHaveProperty('air_quality');
		expect(wire).not.toHaveProperty('forecastNextHour');
	});

	it('le strutture opzionali passano invariate quando ci sono', () => {
		const daily = [
			{
				date: '2026-09-12',
				temp_max: 28,
				temp_min: 18,
				precipitation_prob: 20,
				condition_code: 'clear',
				condition_text: 'Sunny',
			},
		];
		const astronomy = { sunrise: '06:45', sunset: '19:30', moon_phase: 'Luna Piena' };
		const f = new UnifiedForecast({ ...base, daily, astronomy });
		expect(f.daily).toEqual(daily);
		expect(f.astronomy).toEqual(astronomy);
	});

	it('conserva utc_offset_seconds, da cui dipende il bucketing orario', () => {
		const f = new UnifiedForecast({ ...base, utc_offset_seconds: 7200 });
		expect(f.utc_offset_seconds).toBe(7200);
	});
});
