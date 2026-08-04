import {
	ADVICE_RULES,
	aggregateDayParts,
	buildDayNarrative,
	buildTomorrow,
	extractTime,
	toWmoCode,
} from '@/lib/narrative';
import type { DailyForecast, ForecastCurrent, HourlyForecast } from '@/lib/types';

/**
 * Costruisce le 24 ore di un giorno. Come il backend, i campi opzionali sono
 * assenti per default (spread condizionale, non `null`) e vanno iniettati.
 */
function buildDay(
	date: string,
	overrides: Record<number, Partial<HourlyForecast>> = {},
	defaults: Partial<HourlyForecast> = {}
): HourlyForecast[] {
	return Array.from({ length: 24 }, (_, h) => ({
		time: `${date}T${String(h).padStart(2, '0')}:00`,
		temp: 20,
		precipitation_prob: 0,
		condition_code: '0',
		condition_text: 'CLEAR',
		...defaults,
		...overrides[h],
	}));
}

/** Applica un override a tutte le ore di una fascia. */
function overPart(from: number, to: number, patch: Partial<HourlyForecast>) {
	const out: Record<number, Partial<HourlyForecast>> = {};
	for (let h = from; h < to; h++) out[h] = patch;
	return out;
}

const current = (partial: Partial<ForecastCurrent> = {}): ForecastCurrent => ({
	temperature: 20,
	feels_like: null,
	humidity: null,
	wind_speed: null,
	wind_direction: null,
	wind_direction_label: null,
	wind_gust: null,
	precipitation_prob: 0,
	dew_point: null,
	aqi: null,
	pressure: null,
	condition: 'clear',
	condition_text: 'Sereno',
	uv_index: null,
	visibility: null,
	cloud_cover: null,
	air_quality: null,
	...partial,
});

const day = (date: string, partial: Partial<DailyForecast> = {}): DailyForecast => ({
	date,
	temp_max: 28,
	temp_min: 18,
	precipitation_prob: 20,
	condition_code: '0',
	condition_text: null,
	...partial,
});

const TODAY = '2026-08-04';
const TOMORROW = '2026-08-05';
const DAILY = [day(TODAY), day(TOMORROW)];

/** Le fasce passate sono solo estetica: di default nessuna lo è. */
const NOON = new Date(2026, 7, 4, 9, 0);

function narrate(input: {
	hourly?: HourlyForecast[];
	daily?: DailyForecast[];
	current?: ForecastCurrent;
	astronomy?: { sunrise: string; sunset: string; moon_phase: string };
	now?: Date;
}) {
	return buildDayNarrative({
		current: input.current ?? current(),
		hourly: input.hourly ?? buildDay(TODAY),
		daily: input.daily ?? DAILY,
		astronomy: input.astronomy,
		now: input.now ?? NOON,
	});
}

describe('toWmoCode', () => {
	it('should read numeric WMO codes sent as strings', () => {
		expect(toWmoCode('61')).toBe(61);
		expect(toWmoCode('0')).toBe(0);
	});

	it('should map the normalized words the backend falls back to', () => {
		expect(toWmoCode('rain')).toBe(61);
		expect(toWmoCode('storm')).toBe(95);
		expect(toWmoCode('CLEAR')).toBe(0);
	});

	it('should return null for missing or unrecognised codes', () => {
		expect(toWmoCode(undefined)).toBeNull();
		expect(toWmoCode('')).toBeNull();
		expect(toWmoCode('sunny-ish')).toBeNull();
	});
});

describe('extractTime', () => {
	it('should slice timestamps that carry no timezone', () => {
		// Sono già ora locale della località: convertirli li sposterebbe.
		expect(extractTime('2026-08-04T20:41:00')).toBe('20:41');
	});

	it('should accept the clock formats some sources return', () => {
		expect(extractTime('06:12 AM')).toBe('06:12');
		expect(extractTime('08:05 PM')).toBe('20:05');
		expect(extractTime('18:30')).toBe('18:30');
	});

	it('should return null when there is nothing to parse', () => {
		expect(extractTime(undefined)).toBeNull();
		expect(extractTime('')).toBeNull();
		expect(extractTime('boh')).toBeNull();
	});
});

describe('aggregateDayParts', () => {
	it('should split a day into morning, afternoon and evening', () => {
		const parts = aggregateDayParts(buildDay(TODAY), TODAY);
		expect(parts.map((p) => p.label)).toEqual(['Mattina', 'Pomeriggio', 'Sera']);
		expect(parts.map((p) => p.hours.length)).toEqual([6, 6, 6]);
	});

	it('should ignore hours belonging to other days', () => {
		const parts = aggregateDayParts([...buildDay(TODAY), ...buildDay(TOMORROW)], TODAY);
		expect(parts.every((p) => p.hours.every((h) => h.time.startsWith(TODAY)))).toBe(true);
	});

	it('should drop parts with no hours instead of inventing them', () => {
		const afternoonOnly = buildDay(TODAY).filter((h) => Number(h.time.slice(11, 13)) >= 12);
		const parts = aggregateDayParts(afternoonOnly, TODAY);
		expect(parts.map((p) => p.id)).toEqual(['pomeriggio', 'sera']);
	});

	it('should bucket by the string hour, not by the browser timezone', () => {
		// La regressione che conta: i timestamp non hanno suffisso di fuso, quindi
		// passarli da `Date` sposterebbe le fasce per chi guarda da un altro fuso.
		const hourly = buildDay(TODAY, overPart(6, 12, { temp: 30 }));
		const parts = aggregateDayParts(hourly, TODAY);
		expect(parts[0].tempMax).toBe(30);
		expect(parts[1].tempMax).toBe(20);
	});
});

describe('buildDayNarrative - frasi delle fasce', () => {
	it('should describe a plain clear day', () => {
		const n = narrate({});
		expect(n!.parts.map((p) => p.sentence)).toEqual([
			'Cieli sereni, 20°.',
			'Cieli sereni, 20°.',
			'Cieli sereni, 20°.',
		]);
		expect(n!.parts[0].icon).toBe('☀️');
	});

	it('should show a temperature range when the hours differ', () => {
		const hourly = buildDay(TODAY, { 6: { temp: 18 }, 11: { temp: 26 } });
		expect(narrate({ hourly })!.parts[0].sentence).toBe('Cieli sereni, 18-26°.');
	});

	it('should not repeat the word rain when the sky already says it', () => {
		const hourly = buildDay(
			TODAY,
			overPart(12, 18, { condition_code: '61', precipitation_prob: 70 })
		);
		expect(narrate({ hourly })!.parts[1].sentence).toBe('Cieli con pioggia, 20°, probabilità 70%.');
	});

	it('should name the precipitation when the dominant sky is dry', () => {
		const hourly = buildDay(TODAY, overPart(12, 18, { precipitation_prob: 40 }));
		expect(narrate({ hourly })!.parts[1].sentence).toBe('Cieli sereni, 20°, pioggia al 40%.');
	});

	it('should add the accumulation when there is a measurable amount', () => {
		const hourly = buildDay(
			TODAY,
			overPart(12, 18, { condition_code: '61', precipitation_prob: 70, precipitation_mm: 1 })
		);
		expect(narrate({ hourly })!.parts[1].sentence).toBe(
			'Cieli con pioggia, 20°, probabilità 70% (6,0 mm).'
		);
	});

	it('should mention the apparent temperature only when it detaches from the real one', () => {
		const hot = buildDay(TODAY, overPart(12, 18, { temp: 30, feels_like: 35 }));
		expect(narrate({ hourly: hot })!.parts[1].sentence).toBe('Cieli sereni, 30°, percepiti 35°.');

		const close = buildDay(TODAY, overPart(12, 18, { temp: 30, feels_like: 32 }));
		expect(narrate({ hourly: close })!.parts[1].sentence).toBe('Cieli sereni, 30°.');
	});

	it('should convert wind from m/s before comparing it to the km/h thresholds', () => {
		// 12 m/s = 43.2 km/h, sopra la soglia "forte" di 40.
		const windy = buildDay(TODAY, overPart(12, 18, { wind_speed: 12 }));
		expect(narrate({ hourly: windy })!.parts[1].sentence).toBe(
			'Cieli sereni, 20°, vento forte (43 km/h).'
		);

		// 8 m/s = 28.8 km/h: niente clausola, altrimenti sarebbe il bug di iOS.
		const breezy = buildDay(TODAY, overPart(12, 18, { wind_speed: 8 }));
		expect(narrate({ hourly: breezy })!.parts[1].sentence).toBe('Cieli sereni, 20°.');
	});

	it('should attach the sunset to the part that contains it', () => {
		const astronomy = { sunrise: '2026-08-04T06:12:00', sunset: '2026-08-04T20:41:00', moon_phase: 'Full' };
		const n = narrate({ astronomy });
		expect(n!.parts[2].sentence).toBe('Cieli sereni, 20°. Tramonto alle 20:41.');
		expect(n!.parts[0].sentence).toBe('Cieli sereni, 20°.');
	});

	it('should omit the sunset clause when astronomy is missing', () => {
		expect(narrate({})!.parts[2].sentence).toBe('Cieli sereni, 20°.');
	});
});

describe('buildDayNarrative - fasce trascorse', () => {
	it('should dim the parts already gone when the browser day matches', () => {
		const n = narrate({ now: new Date(2026, 7, 4, 20, 0) });
		expect(n!.parts.map((p) => p.isPast)).toEqual([true, true, false]);
	});

	it('should dim nothing when the browser is on another day', () => {
		// Senza offset del fuso nella risposta, l'ora del browser non è affidabile:
		// meglio non attenuare niente che attenuare la fascia sbagliata.
		const n = narrate({ now: new Date(2026, 7, 5, 20, 0) });
		expect(n!.parts.map((p) => p.isPast)).toEqual([false, false, false]);
	});
});

describe('buildDayNarrative - consigli', () => {
	const adviceOf = (n: ReturnType<typeof narrate>) => n!.advice;

	it('should stay silent on an unremarkable day', () => {
		expect(adviceOf(narrate({}))).toEqual([]);
	});

	it('should warn about heat at the threshold and name the hottest window', () => {
		const hourly = buildDay(TODAY, overPart(14, 17, { temp: 32 }));
		expect(adviceOf(narrate({ hourly }))).toEqual([
			{
				id: 'heat',
				icon: '🌡️',
				severity: 'warning',
				text: "Caldo intenso nel pomeriggio: bevi spesso ed evita l'attività fisica tra le 14 e le 17.",
			},
		]);
	});

	it('should not warn about heat just below the threshold', () => {
		const hourly = buildDay(TODAY, overPart(14, 17, { temp: 31.9 }));
		expect(adviceOf(narrate({ hourly }))).toEqual([]);
	});

	it('should warn about frost when the minimum reaches zero', () => {
		const hourly = buildDay(TODAY, overPart(6, 12, { temp: 0 }));
		expect(adviceOf(narrate({ hourly }))[0].text).toBe(
			'Gelo in mattinata: attenzione a strade ghiacciate e piante sensibili.'
		);
	});

	it('should warn about storms from a single stormy hour', () => {
		const hourly = buildDay(TODAY, { 15: { condition_code: '95' } });
		expect(adviceOf(narrate({ hourly }))[0]).toMatchObject({
			id: 'storm',
			text: 'Temporali nel pomeriggio: evita gli spazi aperti e metti al riparo gli oggetti mobili.',
		});
	});

	it('should warn about rain from the accumulated millimetres', () => {
		const hourly = buildDay(TODAY, overPart(6, 12, { precipitation_mm: 1 }));
		expect(adviceOf(narrate({ hourly }))[0].text).toBe(
			"Pioggia moderata in mattinata: 6,0 mm previsti, esci con l'ombrello."
		);
	});

	it('should warn about wind at the km/h threshold, gusts included', () => {
		// 11.2 m/s = 40.32 km/h di raffica, appena sopra la soglia.
		const hourly = buildDay(TODAY, overPart(18, 24, { wind_gust: 11.2 }));
		expect(adviceOf(narrate({ hourly }))[0].text).toBe(
			'Vento forte in serata, fino a 40 km/h: fissa gli oggetti esposti.'
		);
	});

	it('should warn about UV from the high threshold up', () => {
		const high = buildDay(TODAY, overPart(12, 18, { uv_index: 6 }));
		expect(adviceOf(narrate({ hourly: high }))[0].text).toBe(
			"Indice UV alto nel pomeriggio: usa protezione solare e cerca l'ombra."
		);

		const below = buildDay(TODAY, overPart(12, 18, { uv_index: 5.9 }));
		expect(adviceOf(narrate({ hourly: below }))).toEqual([]);
	});

	it('should scale the visibility advice with how bad it is', () => {
		expect(adviceOf(narrate({ current: current({ visibility: 1 }) }))[0].text).toBe(
			'Visibilità ridotta: tieni le luci accese e aumenta la distanza di sicurezza.'
		);
		expect(adviceOf(narrate({ current: current({ visibility: 0.4 }) }))[0].text).toBe(
			'Visibilità molto scarsa, possibile nebbia: rimanda gli spostamenti se puoi.'
		);
		expect(adviceOf(narrate({ current: current({ visibility: 2 }) }))).toEqual([]);
	});

	it('should relay poor air quality from category 3 up', () => {
		expect(adviceOf(narrate({ current: current({ aqi: 3 }) }))[0].text).toBe(
			"Qualità dell'aria malsana per sensibili: limita l'attività all'aperto se sei un soggetto sensibile."
		);
		expect(adviceOf(narrate({ current: current({ aqi: 2 }) }))).toEqual([]);
	});

	it('should explain mugginess from the current readings', () => {
		// I valori dello screenshot che ha motivato la feature.
		const muggy = current({ temperature: 31, feels_like: 35, humidity: 62 });
		expect(adviceOf(narrate({ current: muggy }))[0]).toEqual({
			id: 'mugginess',
			icon: '💧',
			severity: 'info',
			text: 'Umidità al 62%: la percepita supera la reale di 4°.',
		});
	});

	it('should not call it mugginess when the air is dry', () => {
		const dry = current({ temperature: 31, feels_like: 35, humidity: 40 });
		expect(adviceOf(narrate({ current: dry })).some((a) => a.id === 'mugginess')).toBe(false);
	});

	it('should cap the list at three and put warnings first', () => {
		const hourly = buildDay(TODAY, {
			...overPart(12, 18, { temp: 33, uv_index: 9, wind_speed: 14, precipitation_mm: 2 }),
			15: { temp: 33, condition_code: '95', uv_index: 9, wind_speed: 14, precipitation_mm: 2 },
		});
		const advice = adviceOf(
			narrate({ hourly, current: current({ temperature: 31, feels_like: 35, humidity: 70 }) })
		);
		expect(advice).toHaveLength(3);
		expect(advice.every((a) => a.severity === 'warning')).toBe(true);
		expect(advice.map((a) => a.id)).toEqual(['storm', 'heat', 'rain']);
	});
});

describe('buildTomorrow', () => {
	const hourly = [...buildDay(TODAY), ...buildDay(TOMORROW)];

	it('should report the trend when tomorrow is warmer', () => {
		expect(buildTomorrow(day(TODAY), day(TOMORROW, { temp_max: 32 }), hourly)).toBe(
			'Sereno, 18-32°, massime in rialzo.'
		);
	});

	it('should report the trend when tomorrow is colder', () => {
		expect(buildTomorrow(day(TODAY), day(TOMORROW, { temp_max: 24 }), hourly)).toBe(
			'Sereno, 18-24°, massime in calo.'
		);
	});

	it('should call a two-degree move stable', () => {
		expect(buildTomorrow(day(TODAY), day(TOMORROW, { temp_max: 30 }), hourly)).toBe(
			'Sereno, 18-30°, temperature stabili.'
		);
	});

	it('should name the rainiest part using tomorrow own hours', () => {
		// Il vantaggio sull'iOS, che guarda solo il riepilogo giornaliero.
		const withRain = [
			...buildDay(TODAY),
			...buildDay(TOMORROW, overPart(6, 12, { precipitation_prob: 70, condition_code: '61' })),
		];
		expect(buildTomorrow(day(TODAY), day(TOMORROW, { condition_code: '61' }), withRain)).toBe(
			'Pioggia, 18-28°, temperature stabili. Pioggia probabile (70%) in mattinata.'
		);
	});

	it('should fall back to the daily probability with no hours for tomorrow', () => {
		expect(
			buildTomorrow(day(TODAY), day(TOMORROW, { precipitation_prob: 80 }), buildDay(TODAY))
		).toBe('Sereno, 18-28°, temperature stabili. Pioggia probabile (80%).');
	});

	it('should return null when there is no tomorrow', () => {
		expect(buildTomorrow(day(TODAY), undefined, hourly)).toBeNull();
	});
});

describe('buildDayNarrative - dati insufficienti', () => {
	it('should return null without hourly data', () => {
		expect(buildDayNarrative({ current: current(), daily: DAILY })).toBeNull();
		expect(buildDayNarrative({ current: current(), hourly: [], daily: DAILY })).toBeNull();
	});

	it('should return null without daily data', () => {
		expect(buildDayNarrative({ current: current(), hourly: buildDay(TODAY) })).toBeNull();
	});

	it('should return null when no hour belongs to today', () => {
		expect(narrate({ hourly: buildDay('2026-08-01') })).toBeNull();
	});

	it('should survive hours that carry none of the optional fields', () => {
		const n = narrate({ hourly: buildDay(TODAY) });
		expect(n!.parts).toHaveLength(3);
		expect(n!.advice).toEqual([]);
	});
});

describe('ADVICE_RULES', () => {
	it('should have unique ids', () => {
		const ids = ADVICE_RULES.map((r) => r.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('should give every rule an icon and a severity', () => {
		for (const rule of ADVICE_RULES) {
			expect(rule.icon).toBeTruthy();
			expect(['warning', 'info']).toContain(rule.severity);
		}
	});
});
