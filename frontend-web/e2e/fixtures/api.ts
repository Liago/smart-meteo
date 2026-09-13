import type { Page } from '@playwright/test';

/**
 * Intercettazione dell'API backend per gli scenari E2E.
 *
 * I test non devono dipendere dal meteo reale: una previsione di pioggia che
 * cambia farebbe fallire uno scenario senza che nulla si sia rotto nel codice.
 * Ogni scenario parte quindi da una risposta nota e la modifica per il caso che
 * vuole verificare.
 */

/** Oggi e domani in formato ISO, perché la dashboard filtra sulle date. */
function isoDate(offsetDays = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	return d.toISOString().slice(0, 10);
}

/** Le 24 ore del giorno indicato, in ora locale come le manda il backend. */
function buildHourly(date: string, over: Record<number, Record<string, unknown>> = {}) {
	return Array.from({ length: 24 }, (_, h) => ({
		time: `${date}T${String(h).padStart(2, '0')}:00`,
		temp: 20 + (h % 6),
		precipitation_prob: 10,
		condition_code: '1',
		condition_text: 'Prevalentemente sereno',
		feels_like: 21 + (h % 6),
		humidity: 55,
		wind_speed: 3.5,
		wind_direction: 180,
		wind_gust: 6,
		uv_index: h > 8 && h < 18 ? 5 : 0,
		precipitation_mm: 0,
		// Indici convettivi costanti su tutta la giornata, non con il picco
		// pomeridiano dei temporali veri: sul giorno corrente la vista apre
		// sull'ora in corso, e un profilo variabile legherebbe l'esito del test
		// all'ora in cui gira. Che l'ora attiva sia quella di picco è verificato
		// dai test Jest, dove il tempo è sotto controllo.
		cape: 1800,
		lifted_index: -4,
		storm_index: 63,
		thunder_prob: 55,
		// Banda di incertezza: si allarga con l'ora, come fa un ensemble reale
		// man mano che l'orizzonte si allontana.
		temp_p10: 20 + (h % 6) - 1 - h * 0.08,
		temp_p90: 20 + (h % 6) + 1 + h * 0.08,
		...over[h],
	}));
}

/** Minuti del nowcast, relativi all'istante della richiesta. */
function buildMinutes(rainFrom: number | null, rainTo = 60) {
	const now = Date.now();
	return Array.from({ length: 60 }, (_, i) => {
		const raining = rainFrom !== null && i >= rainFrom && i < rainTo;
		return {
			startTime: new Date(now + i * 60_000).toISOString(),
			precipitationChance: raining ? 85 : 0,
			precipitationIntensity: raining ? 2.4 : 0,
		};
	});
}

export interface ForecastOptions {
	/** Rimuove la banda di incertezza, come quando l'ensemble non risponde. */
	withoutBand?: boolean;
	/** Minuto da cui inizia a piovere nel nowcast; null = ora asciutta. */
	rainStartsInMinutes?: number | null;
	/** Omette del tutto il nowcast, come quando WeatherKit non risponde. */
	withoutNextHour?: boolean;
	/** Sovrascrive il blocco confidence. */
	confidence?: Record<string, unknown> | null;
	/** Sovrascrive campi di `current`. */
	current?: Record<string, unknown>;
	/** Allerte attive nella risposta forecast. */
	alerts?: unknown[];
	/** Rimuove i pollini, come fuori dalla copertura del modello CAMS. */
	withoutPollen?: boolean;
	/** Rimuove gli indici convettivi, come quando i modelli non li espongono. */
	withoutStorm?: boolean;
	/** Blocco orto. Presente per default: Open-Meteo dà i dati agronomici ovunque. */
	garden?: Record<string, unknown> | null;
	/** Blocco fotovoltaico. Presente per default. */
	solar?: Record<string, unknown> | null;
	/** Blocco cielo: tramonti e osservazione astronomica. */
	sky?: Record<string, unknown> | null;
	/**
	 * Indici lifestyle. Presenti per default: si calcolano dalle ore che il
	 * backend manda comunque, quindi ci sono ovunque ci sia una previsione.
	 */
	activities?: Record<string, unknown> | null;
	/**
	 * Blocco mare. **Assente per default**: la località di prova è Milano, e
	 * nell'entroterra il modello d'onda non copre.
	 */
	sea?: Record<string, unknown>;
	/**
	 * Blocco neve e gelate. Assente per default: il backend lo manda solo
	 * quando c'è qualcosa da dire, e la risposta di base è una giornata
	 * serena di settembre.
	 */
	snow?: Record<string, unknown>;
}

export function buildForecast(options: ForecastOptions = {}) {
	const today = isoDate(0);

	const forecast: Record<string, unknown> = {
		location: { lat: 45.46, lon: 9.19 },
		generated_at: new Date().toISOString(),
		sources_used: ['apple_weatherkit', 'tomorrow.io', 'open-meteo', 'weatherapi', 'accuweather'],
		current: {
			temperature: 24.3,
			feels_like: 25.1,
			humidity: 55,
			wind_speed: 3.5,
			wind_direction: 180,
			wind_direction_label: 'S',
			wind_gust: 6.2,
			precipitation_prob: 10,
			precipitation_intensity: 0,
			dew_point: 14.4,
			aqi: 2,
			pressure: 1013,
			condition: 'clear',
			condition_code: '1',
			condition_text: 'CLEAR',
			uv_index: 5,
			visibility: 24.1,
			cloud_cover: 20,
			air_quality: {
				aqi_us_epa: 2,
				pm2_5: 12.3,
				pm10: 20.1,
				no2: 15,
				o3: 40,
				co: 200,
				so2: 5,
			},
			...options.current,
		},
		confidence:
			options.confidence === undefined
				? {
						score: 88,
						level: 'high',
						sources_count: 5,
						temperature: { spread: 0.4, min: 23.8, max: 24.9 },
						precipitation_prob: { spread: 2, min: 8, max: 12 },
					}
				: options.confidence,
		daily: [0, 1, 2, 3, 4, 5, 6].map((offset) => ({
			date: isoDate(offset),
			temp_max: 28 - offset,
			temp_min: 17 - offset,
			precipitation_prob: offset === 2 ? 80 : 10,
			condition_code: offset === 2 ? '61' : '1',
			condition_text: offset === 2 ? 'Pioggia debole' : 'Prevalentemente sereno',
			uv_index_max: 6,
			precipitation_mm: offset === 2 ? 8.4 : 0,
		})),
		hourly: [...buildHourly(today), ...buildHourly(isoDate(1))]
			.map((h) => (options.withoutBand ? { ...h, temp_p10: undefined, temp_p90: undefined } : h))
			.map((h) =>
				options.withoutStorm
					? { ...h, cape: undefined, lifted_index: undefined, storm_index: undefined, thunder_prob: undefined }
					: h
			),
		astronomy: {
			sunrise: `${today}T06:52:00`,
			sunset: `${today}T19:44:00`,
			moon_phase: 'Gibbosa Crescente',
			moonrise: `${today}T21:12:00`,
			moonset: `${isoDate(1)}T11:03:00`,
			moon_illumination: 72,
		},
		alerts: options.alerts ?? [],
	};

	if (!options.withoutPollen) {
		forecast.pollen = [
			{ species: 'grass', label: 'Graminacee', value: 8, daily_max: 62, level: 'moderate', daily_level: 'very_high' },
			{ species: 'olive', label: 'Olivo', value: 3, daily_max: 20, level: 'low', daily_level: 'moderate' },
			{ species: 'birch', label: 'Betulla', value: 0, daily_max: 0, level: 'none', daily_level: 'none' },
		];
	}

	if (options.snow) {
		forecast.snow = options.snow;
	}

	if (options.garden !== null) {
		forecast.garden = options.garden ?? {
			soil_moisture: 0.252,
			moisture_level: 'adequate',
			soil_temperature: 18,
			evapotranspiration_mm: 4.8,
			rain_mm: 0,
			water_balance_mm: 4.8,
			advice: 'water_soon',
			sowing_ok: true,
		};
	}

	if (options.solar !== null) {
		forecast.solar = options.solar ?? {
			plane: 'tilted',
			tilt_deg: 30,
			azimuth_deg: 0,
			performance_ratio: 0.75,
			days: [
				{ date: isoDate(1), kwh_per_kwp: 5.2, sunshine_hours: 11, peak_w: 890 },
				{ date: isoDate(2), kwh_per_kwp: 2.6, sunshine_hours: 4, peak_w: 430 },
			],
		};
	}

	if (options.sky !== null) {
		forecast.sky = options.sky ?? {
			sunset: { at: `${today}T20:00`, score: 82, level: 'excellent' },
			sunrise: null,
			stargazing: { score: 40, level: 'fair', cloud_cover: 30, moon_illumination: 60 },
		};
	}

	if (options.sea) {
		forecast.sea = options.sea;
	}

	if (options.activities !== null) {
		forecast.activities = options.activities ?? {
			date: today,
			from: `${today}T08:00`,
			to: `${today}T19:00`,
			// Già ordinati per punteggio decrescente, come li manda il backend.
			activities: [
				{ id: 'cycling', label: 'Andare in bici', score: 100, limiting: null },
				{ id: 'laundry', label: 'Stendere il bucato', score: 88, limiting: null },
				{ id: 'running', label: 'Correre', score: 62, limiting: 'temperatura' },
			],
		};
	}

	if (!options.withoutNextHour) {
		forecast.forecastNextHour = {
			summary: [],
			minutes: buildMinutes(options.rainStartsInMinutes ?? null),
		};
	}

	return forecast;
}

export const SOURCES = {
	sources: [
		{ id: 'apple_weatherkit', name: 'Apple WeatherKit', weight: 1.2, active: true, description: 'Dati ufficiali forniti da Apple', lastError: null, lastResponseMs: 180 },
		{ id: 'tomorrow.io', name: 'Tomorrow.io', weight: 1.2, active: true, description: 'Nowcasting iper-locale', lastError: null, lastResponseMs: 220 },
		{ id: 'open-meteo', name: 'Open-Meteo', weight: 1.1, active: true, description: 'Dati scientifici ad alta risoluzione', lastError: null, lastResponseMs: 90 },
		{ id: 'accuweather', name: 'AccuWeather', weight: 1.1, active: true, description: 'RealFeel', lastError: null, lastResponseMs: 340 },
		{ id: 'weatherapi', name: 'WeatherAPI', weight: 1.0, active: true, description: 'Unica fonte di AQI', lastError: null, lastResponseMs: 150 },
		{ id: 'openweathermap', name: 'OpenWeather', weight: 1.0, active: true, description: 'Copertura globale', lastError: null, lastResponseMs: 120 },
		{ id: 'worldweatheronline', name: 'World Weather Online', weight: 1.0, active: true, description: 'Dati astronomici', lastError: null, lastResponseMs: 400 },
		{ id: 'weatherstack', name: 'WeatherStack', weight: 0, active: true, description: 'Disabilitato: il piano free non offre HTTPS', lastError: null, lastResponseMs: null },
		{ id: 'meteostat', name: 'Meteostat', weight: 0.8, active: true, description: 'Osservazioni storiche', lastError: 'Rate limit', lastResponseMs: 900 },
	],
};

/**
 * Registra le intercettazioni sull'API backend e sul geocoding Nominatim.
 * Va chiamata prima di `page.goto`.
 */
export async function mockApi(page: Page, options: ForecastOptions = {}) {
	await page.route('**/api/forecast*', (route) =>
		route.fulfill({ json: buildForecast(options) })
	);

	await page.route('**/api/sources', (route) => route.fulfill({ json: SOURCES }));

	await page.route('**/api/alerts/active*', (route) => route.fulfill({ json: { alerts: [] } }));

	await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));

	// La ricerca località passa da Nominatim: va intercettata o i test
	// dipenderebbero da un servizio esterno. Serve una RegExp: il glob
	// `**nominatim**` non aggancia un host, solo un percorso.
	await page.route(/nominatim\.openstreetmap\.org/, (route) =>
		route.fulfill({
			json: [
				{ display_name: 'Milano, Lombardia, Italia', lat: '45.4642', lon: '9.1900' },
				{ display_name: 'Milano Marittima, Emilia-Romagna, Italia', lat: '44.2761', lon: '12.3517' },
			],
		})
	);
}

/**
 * Chiave di localStorage della località di casa, come in `lib/useLocations.ts`.
 */
const HOME_KEY = 'smart-meteo-home';

/**
 * Prepara il browser come quello di un utente che torna sull'app.
 *
 * Senza una località salvata la dashboard mostra la schermata di benvenuto e
 * non chiama l'API: la geolocalizzazione richiede un permesso che in un test
 * headless è più fragile da pilotare del localStorage, ed è comunque il
 * percorso meno frequente rispetto al ritorno su una località conosciuta.
 */
export async function seedHomeLocation(
	page: Page,
	location = { name: 'Milano', lat: 45.4642, lon: 9.19 }
) {
	await page.addInitScript(
		([key, value]) => window.localStorage.setItem(key, value),
		[HOME_KEY, JSON.stringify(location)] as const
	);

	// La geolocalizzazione del browser resta neutralizzata: se venisse concessa
	// sovrascriverebbe la località salvata e i test dipenderebbero dall'IP del
	// runner.
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'geolocation', {
			value: {
				getCurrentPosition: (_ok: unknown, err?: (e: unknown) => void) =>
					err?.({ code: 1, message: 'denied' }),
				watchPosition: () => 0,
				clearWatch: () => undefined,
			},
		});
	});
}

/** Nessuna località salvata: la dashboard deve mostrare il benvenuto. */
export async function startAsNewVisitor(page: Page) {
	await page.addInitScript(() => {
		window.localStorage.clear();
		Object.defineProperty(navigator, 'geolocation', {
			value: {
				getCurrentPosition: (_ok: unknown, err?: (e: unknown) => void) =>
					err?.({ code: 1, message: 'denied' }),
				watchPosition: () => 0,
				clearWatch: () => undefined,
			},
		});
	});
}
