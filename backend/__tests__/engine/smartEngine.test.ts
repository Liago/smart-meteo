/**
 * Aggregazione dello Smart Engine.
 *
 * È il cuore non testato del progetto: 587 righe che fondono fino a nove fonti
 * con regole diverse per grandezza (media pesata, voto sulle condizioni, media
 * circolare per la direzione del vento, gate sulla frazione bagnata per i mm) e
 * un bucketing orario che deve riconciliare fonti in UTC con fonti in ora
 * locale.
 *
 * Tutti i connettori e Supabase sono sostituiti: qui si verifica la matematica
 * del merge, non la rete.
 */

import { UnifiedForecast } from '../../utils/formatter';

// ---------------------------------------------------------------- mock setup

/** Righe restituite dalla query di cache; sovrascritto test per test. */
let cachedRow: any = null;
/** Insert osservate, per verificare cosa viene scritto in smart_forecasts. */
const insertedSmart: any[] = [];

jest.mock('../../services/supabase', () => {
	/**
	 * Supabase client ridotto alle tre forme usate dall'engine:
	 * `rpc`, una select a catena che termina in `.single()`, e `insert`.
	 */
	const chain = (table: string) => ({
		select: () => chain(table),
		eq: () => chain(table),
		gt: () => chain(table),
		order: () => chain(table),
		limit: () => chain(table),
		single: async () => ({ data: cachedRow, error: cachedRow ? null : { message: 'no rows' } }),
		insert: async (row: any) => {
			if (table === 'smart_forecasts') insertedSmart.push(row);
			return { error: null };
		},
	});

	return {
		supabase: {
			rpc: async () => ({ data: 'location-uuid', error: null }),
			from: (table: string) => chain(table),
		},
	};
});

jest.mock('../../services/accuracy', () => ({
	// Nessuna storia di accuratezza: i pesi restano quelli statici, così i
	// numeri attesi nei test sono calcolabili a mano.
	getAccuracyMap: jest.fn(async () => ({})),
}));

/** Risposte per fonte: la chiave è l'id in SOURCE_WEIGHTS. */
let sourceResponses: Record<string, UnifiedForecast | null> = {};

jest.mock('../../connectors/tomorrow', () => ({ fetchFromTomorrow: jest.fn(async () => sourceResponses['tomorrow.io'] ?? null) }));
/**
 * Modelli Open-Meteo attivi in questo test: vuoto per default, così gli
 * scenari sull'aggregazione continuano a usare la fonte `open-meteo`
 * (`best_match`). I test dedicati alla selezione dei modelli lo riempiono.
 */
let activeModels: { id: string; sourceId: string; name: string; description: string; weight: number }[] = [];

const MODELLI = [
	{ id: 'icon_d2', sourceId: 'open-meteo:icon_d2', name: 'ICON-D2', description: '', weight: 1.2 },
	{ id: 'icon_eu', sourceId: 'open-meteo:icon_eu', name: 'ICON-EU', description: '', weight: 1.1 },
	{ id: 'ecmwf_ifs025', sourceId: 'open-meteo:ecmwf', name: 'IFS', description: '', weight: 1.1 },
	{ id: 'meteofrance_seamless', sourceId: 'open-meteo:meteofrance', name: 'AROME', description: '', weight: 1.0 },
	{ id: 'gfs_seamless', sourceId: 'open-meteo:gfs', name: 'GFS', description: '', weight: 0.9 },
];

jest.mock('../../connectors/openmeteo', () => ({
	fetchFromOpenMeteo: jest.fn(async () => sourceResponses['open-meteo'] ?? null),
	fetchFromOpenMeteoModel: jest.fn(async (_lat: number, _lon: number, model: any) =>
		sourceResponses[model.sourceId] ?? null
	),
	activeOpenMeteoModels: jest.fn(() => activeModels),
	OPENMETEO_MODELS: MODELLI,
	// Il piano dei pannelli è una costante del connettore, non un dato: senza
	// riesportarla il blocco solar arriverebbe con tilt e azimut undefined.
	SOLAR_TILT_DEG: 30,
	SOLAR_AZIMUTH_DEG: 0,
}));
jest.mock('../../connectors/accuweather', () => ({ fetchFromAccuWeather: jest.fn(async () => sourceResponses['accuweather'] ?? null) }));
jest.mock('../../connectors/worldweatheronline', () => ({ fetchFromWWO: jest.fn(async () => sourceResponses['worldweatheronline'] ?? null) }));
jest.mock('../../connectors/weatherstack', () => ({ fetchFromWeatherstack: jest.fn(async () => sourceResponses['weatherstack'] ?? null) }));
jest.mock('../../connectors/meteostat', () => ({ fetchFromMeteostat: jest.fn(async () => sourceResponses['meteostat'] ?? null) }));

jest.mock('../../connectors/openweathermap', () => ({
	fetchFromOpenWeather: jest.fn(async () => sourceResponses['openweathermap'] ?? null),
	fetchOWMAlerts: jest.fn(async () => []),
}));

jest.mock('../../connectors/weatherapi', () => ({
	fetchFromWeatherAPI: jest.fn(async () => sourceResponses['weatherapi'] ?? null),
	fetchFromWeatherAPIWithAlerts: jest.fn(async () => {
		const forecast = sourceResponses['weatherapi'];
		return forecast ? { forecast, alerts: [] } : null;
	}),
}));

jest.mock('../../connectors/weatherkit', () => ({
	fetchFromWeatherKit: jest.fn(async () => sourceResponses['apple_weatherkit'] ?? null),
	fetchFromWeatherKitWithAlerts: jest.fn(async () => {
		const forecast = sourceResponses['apple_weatherkit'];
		return forecast ? { forecast, alerts: [] } : null;
	}),
}));

/** Banda restituita dall'ensemble: vuota per default. */
let ensembleBands: { time: string; p10: number; p50: number; p90: number; members: number }[] = [];

/** Risultato del connettore qualità dell'aria: assente per default. */
let airQualityResult: any = null;

jest.mock('../../connectors/openmeteoAirQuality', () => ({
	fetchAirQuality: jest.fn(async () => airQualityResult),
}));

/** Ore del modello d'onda: assenti per default, come nell'entroterra. */
let marineResult: any = null;

jest.mock('../../connectors/openmeteoMarine', () => ({
	fetchMarine: jest.fn(async () => marineResult),
}));

jest.mock('../../connectors/openmeteoEnsemble', () => ({
	fetchTemperatureBand: jest.fn(async () =>
		ensembleBands.length > 0
			? { model: 'icon_eu', bands: ensembleBands, utcOffsetSeconds: 7200 }
			: null
	),
}));

import { FORECAST_SCHEMA_VERSION, getSmartForecast } from '../../engine/smartEngine';

// ------------------------------------------------------------------- helpers

const LAT = 45.46;
const LON = 9.19;

function forecast(source: string, data: Partial<Record<string, any>> = {}): UnifiedForecast {
	return new UnifiedForecast({
		source,
		lat: LAT,
		lon: LON,
		time: '2026-09-12T14:00:00Z',
		...data,
	});
}

beforeEach(() => {
	cachedRow = null;
	insertedSmart.length = 0;
	sourceResponses = {};
	activeModels = [];
	ensembleBands = [];
	airQualityResult = null;
	marineResult = null;
});

// --------------------------------------------------------------------- tests

describe('media pesata dei valori correnti', () => {
	it('pesa la temperatura secondo SOURCE_WEIGHTS', async () => {
		sourceResponses['tomorrow.io'] = forecast('tomorrow.io', { temp: 30 });
		sourceResponses['openweathermap'] = forecast('openweathermap', { temp: 20 });

		const r = await getSmartForecast(LAT, LON);

		// (30*1.2 + 20*1.0) / 2.2 = 25.45
		expect(r.current.temperature).toBeCloseTo(25.5, 1);
	});

	it('una fonte che tace non abbassa la media', async () => {
		sourceResponses['tomorrow.io'] = forecast('tomorrow.io', { temp: 25, humidity: null });
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 25, humidity: 60 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.temperature).toBeCloseTo(25, 1);
		// L'unica fonte con umidità la determina da sola.
		expect(r.current.humidity).toBeCloseTo(60, 1);
	});

	it('se tutte le fonti falliscono solleva un errore invece di restituire zeri', async () => {
		await expect(getSmartForecast(LAT, LON)).rejects.toThrow(/All weather sources failed/);
	});

	it('sources_used elenca solo le fonti che hanno risposto', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20 });
		sourceResponses['weatherapi'] = forecast('weatherapi', { temp: 21 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.sources_used.sort()).toEqual(['open-meteo', 'weatherapi']);
	});

	it('weatherstack è escluso dal fetch perché ha peso 0', async () => {
		sourceResponses['weatherstack'] = forecast('weatherstack', { temp: 99 });
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.sources_used).not.toContain('weatherstack');
		expect(r.current.temperature).toBeCloseTo(20, 1);
	});

	it('meteostat è escluso: fornisce osservazioni, non previsioni', async () => {
		// Le sue rilevazioni possono avere ore di ritardo e finivano nella media
		// della temperatura *attuale*. Dalla Fase 6C serve come verità osservata
		// per la verifica dell'accuratezza, non come fonte previsionale.
		sourceResponses['meteostat'] = forecast('meteostat', { temp: 99 });
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.sources_used).not.toContain('meteostat');
		expect(r.current.temperature).toBeCloseTo(20, 1);
	});
});

describe('voto sulle condizioni', () => {
	it('vince la condizione con più peso, non con più fonti', async () => {
		// Due fonti leggere contro una pesante: 1.2 > 1.0, ma qui le leggere
		// sommano 2.0 e devono vincere.
		sourceResponses['tomorrow.io'] = forecast('tomorrow.io', { condition_code: 'clear' });
		sourceResponses['openweathermap'] = forecast('openweathermap', { condition_code: 'rain' });
		sourceResponses['weatherapi'] = forecast('weatherapi', { condition_code: 'rain' });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.condition).toBe('rain');
	});

	it('i codici WMO numerici hanno la precedenza sulle etichette testuali', async () => {
		// Open-Meteo passa il codice numerico, che è più informativo: l'engine lo
		// preferisce per non perdere il dettaglio nella normalizzazione.
		sourceResponses['open-meteo'] = forecast('open-meteo', { condition_code: '61' });
		sourceResponses['weatherapi'] = forecast('weatherapi', { condition_code: 'rain' });
		sourceResponses['openweathermap'] = forecast('openweathermap', { condition_code: 'rain' });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.condition_code).toBe('61');
	});

	it('la copertura nuvolosa bassa promuove una condizione generica a clear', async () => {
		sourceResponses['weatherapi'] = forecast('weatherapi', { condition_code: 'cloudy', cloud_cover: 5 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.condition).toBe('clear');
		// Il codice grezzo resta quello votato: la correzione vive su `condition`.
		expect(r.current.condition_code).toBe('cloudy');
	});
});

describe('direzione del vento', () => {
	it('usa la media circolare: 350° e 10° danno nord, non sud', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { wind_direction: 350 });
		sourceResponses['weatherapi'] = forecast('weatherapi', { wind_direction: 10 });

		const r = await getSmartForecast(LAT, LON);

		const dir = r.current.wind_direction;
		expect(dir === 0 || dir === 360 || dir > 355 || dir < 5).toBe(true);
		expect(r.current.wind_direction_label).toBe('N');
	});

	it('traduce i gradi in punto cardinale', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { wind_direction: 90 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.wind_direction_label).toBe('E');
	});
});

describe('dew point', () => {
	it('preferisce i valori forniti dalle API al calcolo di Magnus', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20, humidity: 50, dew_point: 3 });

		const r = await getSmartForecast(LAT, LON);

		// Magnus su 20 °C e 50% darebbe ~9.3: il valore diretto vince.
		expect(r.current.dew_point).toBeCloseTo(3, 1);
	});

	it('ricade su Magnus quando nessuna fonte lo fornisce', async () => {
		sourceResponses['openweathermap'] = forecast('openweathermap', { temp: 20, humidity: 50 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.dew_point).toBeCloseTo(9.3, 1);
	});
});

describe('intensità di precipitazione corrente', () => {
	it('aggrega i mm/h delle fonti concordi', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { precipitation_intensity: 2 });
		sourceResponses['weatherapi'] = forecast('weatherapi', { precipitation_intensity: 2 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.precipitation_intensity).toBeCloseTo(2, 1);
	});

	it('sopprime la pioggia dichiarata da una sola fonte su quattro', async () => {
		// Gate sulla frazione bagnata: 1 peso su 4.3 è sotto 1/3.
		sourceResponses['open-meteo'] = forecast('open-meteo', { precipitation_intensity: 0 });
		sourceResponses['weatherapi'] = forecast('weatherapi', { precipitation_intensity: 0 });
		sourceResponses['accuweather'] = forecast('accuweather', { precipitation_intensity: 0 });
		sourceResponses['openweathermap'] = forecast('openweathermap', { precipitation_intensity: 5 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.precipitation_intensity).toBe(0);
	});
});

describe('indice di consenso', () => {
	it('fonti concordi e numerose danno confidenza alta', async () => {
		for (const id of ['tomorrow.io', 'open-meteo', 'accuweather', 'weatherapi', 'openweathermap']) {
			sourceResponses[id] = forecast(id, { temp: 20, precipitation_prob: 10 });
		}

		const r = await getSmartForecast(LAT, LON);

		expect(r.confidence.level).toBe('high');
		expect(r.confidence.sources_count).toBe(5);
		expect(r.confidence.temperature.spread).toBe(0);
	});

	it('fonti in disaccordo danno confidenza bassa e un intervallo visibile', async () => {
		sourceResponses['tomorrow.io'] = forecast('tomorrow.io', { temp: 14, precipitation_prob: 0 });
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20, precipitation_prob: 50 });
		sourceResponses['weatherapi'] = forecast('weatherapi', { temp: 26, precipitation_prob: 100 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.confidence.level).toBe('low');
		expect(r.confidence.temperature.min).toBe(14);
		expect(r.confidence.temperature.max).toBe(26);
	});

	it('il punteggio viene scritto in smart_forecasts.confidence_score', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20, precipitation_prob: 10 });

		const r = await getSmartForecast(LAT, LON);

		expect(insertedSmart).toHaveLength(1);
		expect(insertedSmart[0].confidence_score).toBe(r.confidence.score);
		expect(insertedSmart[0].confidence_score).not.toBeNull();
	});
});

describe('aggregazione giornaliera', () => {
	const day = (date: string, over: Record<string, any> = {}) => ({
		date,
		temp_max: 28,
		temp_min: 18,
		precipitation_prob: 20,
		condition_code: 'clear',
		condition_text: 'Sunny',
		...over,
	});

	it('unisce per data le previsioni di fonti diverse', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 20,
			daily: [day('2026-09-12', { temp_max: 30 }), day('2026-09-13')],
		});
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			daily: [day('2026-09-12', { temp_max: 26 })],
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.daily).toHaveLength(2);
		const oggi = r.daily.find((d: any) => d.date === '2026-09-12');
		// (30*1.1 + 26*1.0) / 2.1 = 28.09
		expect(oggi.temp_max).toBeCloseTo(28.1, 1);
	});

	it('le temperature giornaliere sono pesate come quelle correnti', async () => {
		// Fino alla Fase 6C il daily usava `avgSimple` e ignorava SOURCE_WEIGHTS:
		// Meteostat (0.8, osservazioni passate) pesava come Tomorrow.io (1.2)
		// proprio sui sette giorni, cioè su quasi tutto quello che l'utente
		// guarda. Ora la media è pesata come su `current`.
		sourceResponses['tomorrow.io'] = forecast('tomorrow.io', {
			temp: 20,
			daily: [day('2026-09-12', { temp_max: 30 })],
		});
		sourceResponses['openweathermap'] = forecast('openweathermap', {
			temp: 20,
			daily: [day('2026-09-12', { temp_max: 20 })],
		});

		const r = await getSmartForecast(LAT, LON);

		// Pesata: (30*1.2 + 20*1.0)/2.2 = 25.45. La media semplice darebbe 25.
		expect(r.daily[0].temp_max).toBeCloseTo(25.5, 1);
	});

	it('la condizione giornaliera è votata a peso, non a conteggio', async () => {
		// Due fonti leggere concordi (1.0 + 1.0) battono una pesante (1.2).
		sourceResponses['tomorrow.io'] = forecast('tomorrow.io', {
			temp: 20,
			daily: [day('2026-09-12', { condition_code: 'clear' })],
		});
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			daily: [day('2026-09-12', { condition_code: 'rain' })],
		});
		sourceResponses['openweathermap'] = forecast('openweathermap', {
			temp: 20,
			daily: [day('2026-09-12', { condition_code: 'rain' })],
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.daily[0].condition_code).toBe('rain');
	});

	it('prende il massimo dell UV giornaliero, non la media', async () => {
		// L'indice UV è un estremo: mediarlo fra fonti smorza il picco di cui
		// l'utente deve essere avvisato.
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 20,
			daily: [day('2026-09-12', { uv_index_max: 4 })],
		});
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			daily: [day('2026-09-12', { uv_index_max: 9 })],
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.daily[0].uv_index_max).toBe(9);
	});

	it('i giorni sono ordinati per data', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 20,
			daily: [day('2026-09-14'), day('2026-09-12'), day('2026-09-13')],
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.daily.map((d: any) => d.date)).toEqual(['2026-09-12', '2026-09-13', '2026-09-14']);
	});
});

describe('bucketing orario e fusi', () => {
	const hour = (time: string, over: Record<string, any> = {}) => ({
		time,
		temp: 20,
		precipitation_prob: 10,
		condition_code: 'clear',
		condition_text: 'Sunny',
		...over,
	});

	it('allinea un timestamp UTC con uno già in ora locale', async () => {
		// Open-Meteo dichiara +2h e manda l'ora locale; WeatherKit manda UTC.
		// 14:00Z e 16:00 locali sono lo stesso istante: devono cadere nello
		// stesso slot, non in due fasce distanti due ore.
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 20,
			utc_offset_seconds: 7200,
			hourly: [hour('2026-09-12T16:00', { temp: 24 })],
		});
		sourceResponses['apple_weatherkit'] = forecast('apple_weatherkit', {
			temp: 20,
			hourly: [hour('2026-09-12T14:00:00Z', { temp: 26 })],
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.hourly).toHaveLength(1);
		expect(r.hourly[0].time).toBe('2026-09-12T16:00');
		expect(r.hourly[0].temp).toBeCloseTo(25, 1);
	});

	it('senza offset noto i timestamp locali restano dove sono', async () => {
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			hourly: [hour('2026-09-12 16:00', { temp: 24 })],
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.hourly[0].time).toBe('2026-09-12T16:00');
	});

	it('aggrega umidità, vento e UV orari quando ci sono', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 20,
			utc_offset_seconds: 0,
			hourly: [hour('2026-09-12T14:00', { humidity: 50, wind_speed: 4, uv_index: 6, wind_direction: 90, wind_gust: 8 })],
		});
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			hourly: [hour('2026-09-12T14:00', { humidity: 60, wind_speed: 6, uv_index: 4, wind_direction: 90, wind_gust: 12 })],
		});

		const r = await getSmartForecast(LAT, LON);

		const slot = r.hourly[0];
		// Anche l'hourly è pesato: open-meteo 1.1 contro weatherapi 1.0.
		// (50*1.1 + 60*1.0)/2.1 = 54.8
		expect(slot.humidity).toBeCloseTo(54.8, 1);
		// (4*1.1 + 6*1.0)/2.1 = 4.95
		expect(slot.wind_speed).toBeCloseTo(5, 1);
		// (6*1.1 + 4*1.0)/2.1 = 5.05
		expect(slot.uv_index).toBeCloseTo(5, 1);
		expect(slot.wind_direction).toBe(90);
		// La raffica è un estremo: si prende il massimo, non la media.
		expect(slot.wind_gust).toBeCloseTo(12, 1);
	});

	it('gli slot orari sono ordinati nel tempo', async () => {
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			hourly: [hour('2026-09-12T18:00'), hour('2026-09-12T14:00'), hour('2026-09-12T16:00')],
		});

		const r = await getSmartForecast(LAT, LON);

		const times = r.hourly.map((h: any) => h.time);
		expect(times).toEqual([...times].sort());
	});
});

describe('cache', () => {
	it('restituisce il full_data in cache quando lo schema coincide', async () => {
		cachedRow = {
			full_data: {
				schema_version: FORECAST_SCHEMA_VERSION,
				current: { temperature: 11.1 },
				sources_used: ['cached-source'],
				alerts: [],
			},
		};

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.temperature).toBe(11.1);
		expect(r.sources_used).toEqual(['cached-source']);
	});

	it('non fa uscire schema_version dall API', async () => {
		cachedRow = {
			full_data: { schema_version: FORECAST_SCHEMA_VERSION, current: { temperature: 11.1 }, sources_used: [], alerts: [] },
		};

		const r = await getSmartForecast(LAT, LON);

		expect(r).not.toHaveProperty('schema_version');
	});

	it('ignora una riga scritta con uno schema precedente e rigenera', async () => {
		cachedRow = {
			full_data: { schema_version: 4, current: { temperature: 11.1 }, sources_used: ['stale'], alerts: [] },
		};
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.temperature).toBeCloseTo(20, 1);
		expect(r.sources_used).toEqual(['open-meteo']);
	});

	it('ignora una riga senza full_data', async () => {
		cachedRow = { temperature: 11.1 };
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.temperature).toBeCloseTo(20, 1);
	});
});

describe('modelli Open-Meteo come fonti distinte', () => {
	it('quando sono attivi sostituiscono la fonte best_match', async () => {
		// `best_match` è una miscela degli stessi modelli: usarla insieme a loro
		// conterebbe due volte gli stessi dati.
		activeModels = MODELLI;
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 99 });
		sourceResponses['open-meteo:icon_d2'] = forecast('open-meteo:icon_d2', { temp: 20 });
		sourceResponses['open-meteo:ecmwf'] = forecast('open-meteo:ecmwf', { temp: 22 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.sources_used).not.toContain('open-meteo');
		expect(r.sources_used).toContain('open-meteo:icon_d2');
		expect(r.sources_used).toContain('open-meteo:ecmwf');
	});

	it('ogni modello pesa secondo il proprio id', async () => {
		activeModels = MODELLI;
		// ICON-D2 pesa 1.2, GFS 0.9: (30*1.2 + 20*0.9)/2.1 = 25.7
		sourceResponses['open-meteo:icon_d2'] = forecast('open-meteo:icon_d2', { temp: 30 });
		sourceResponses['open-meteo:gfs'] = forecast('open-meteo:gfs', { temp: 20 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.temperature).toBeCloseTo(25.7, 1);
	});

	it('con un sottoinsieme di modelli fetcha solo quelli', async () => {
		activeModels = [MODELLI[0]!, MODELLI[2]!];
		sourceResponses['open-meteo:icon_d2'] = forecast('open-meteo:icon_d2', { temp: 20 });
		sourceResponses['open-meteo:icon_eu'] = forecast('open-meteo:icon_eu', { temp: 40 });
		sourceResponses['open-meteo:ecmwf'] = forecast('open-meteo:ecmwf', { temp: 20 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.sources_used).toContain('open-meteo:icon_d2');
		expect(r.sources_used).toContain('open-meteo:ecmwf');
		expect(r.sources_used).not.toContain('open-meteo:icon_eu');
		expect(r.current.temperature).toBeCloseTo(20, 1);
	});

	it('senza modelli attivi torna a best_match', async () => {
		activeModels = [];
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 21 });
		sourceResponses['open-meteo:icon_d2'] = forecast('open-meteo:icon_d2', { temp: 99 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.sources_used).toEqual(['open-meteo']);
		expect(r.current.temperature).toBeCloseTo(21, 1);
	});

	it('più modelli indipendenti alzano il numero di fonti del consenso', async () => {
		activeModels = MODELLI;
		for (const m of MODELLI) {
			sourceResponses[m.sourceId] = forecast(m.sourceId, { temp: 20, precipitation_prob: 10 });
		}

		const r = await getSmartForecast(LAT, LON);

		expect(r.confidence.sources_count).toBe(5);
		expect(r.confidence.level).toBe('high');
	});
});

describe('banda di incertezza dall ensemble', () => {
	const hour = (time: string) => ({
		time,
		temp: 20,
		precipitation_prob: 10,
		condition_code: 'clear',
		condition_text: 'Sunny',
	});

	it('applica i percentili agli slot orari corrispondenti', async () => {
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			hourly: [hour('2026-09-12T14:00'), hour('2026-09-12T15:00')],
		});
		ensembleBands = [
			{ time: '2026-09-12T14:00', p10: 18, p50: 20, p90: 22, members: 40 },
			{ time: '2026-09-12T15:00', p10: 17, p50: 21, p90: 25, members: 40 },
		];

		const r = await getSmartForecast(LAT, LON);

		expect(r.hourly[0].temp_p10).toBe(18);
		expect(r.hourly[0].temp_p90).toBe(22);
		expect(r.hourly[1].temp_p90).toBe(25);
	});

	it('gli slot senza banda restano senza le chiavi, non a zero', async () => {
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			hourly: [hour('2026-09-12T14:00'), hour('2026-09-12T15:00')],
		});
		// L'ensemble copre solo la prima ora: l'orizzonte è più corto.
		ensembleBands = [{ time: '2026-09-12T14:00', p10: 18, p50: 20, p90: 22, members: 40 }];

		const r = await getSmartForecast(LAT, LON);

		expect(r.hourly[0].temp_p10).toBe(18);
		expect(r.hourly[1]).not.toHaveProperty('temp_p10');
	});

	it('senza ensemble la risposta resta identica', async () => {
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			hourly: [hour('2026-09-12T14:00')],
		});
		ensembleBands = [];

		const r = await getSmartForecast(LAT, LON);

		expect(r.hourly[0]).not.toHaveProperty('temp_p10');
		expect(r.hourly[0].temp).toBeCloseTo(20, 1);
	});

	it('la banda passa dallo stesso bucketing orario delle fonti', async () => {
		// L'ensemble risponde in ora locale, WeatherKit in UTC: senza passare
		// dalla stessa chiave finirebbero in fasce diverse.
		sourceResponses['apple_weatherkit'] = forecast('apple_weatherkit', {
			temp: 20,
			hourly: [hour('2026-09-12T14:00:00Z')],
		});
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 20,
			utc_offset_seconds: 7200,
			hourly: [hour('2026-09-12T16:00')],
		});
		ensembleBands = [{ time: '2026-09-12T16:00', p10: 18, p50: 20, p90: 22, members: 40 }];

		const r = await getSmartForecast(LAT, LON);

		expect(r.hourly).toHaveLength(1);
		expect(r.hourly[0].temp_p10).toBe(18);
	});
});

describe('forma della risposta', () => {
	it('espone forecastNextHour solo quando una fonte lo fornisce', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20 });

		const senza = await getSmartForecast(LAT, LON);
		expect(senza).not.toHaveProperty('forecastNextHour');

		sourceResponses['apple_weatherkit'] = forecast('apple_weatherkit', {
			temp: 20,
			forecastNextHour: { summary: [], minutes: [{ startTime: '2026-09-12T14:00:00Z', precipitationChance: 80, precipitationIntensity: 2 }] },
		});

		const con = await getSmartForecast(LAT, LON);
		expect(con.forecastNextHour.minutes).toHaveLength(1);
	});

	it('prende air_quality dalla sola fonte che lo fornisce', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20 });
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			air_quality: { aqi_us_epa: 2, pm2_5: 12, pm10: 20, no2: 15, o3: 40, co: 200, so2: 5 },
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.air_quality.pm2_5).toBe(12);
	});

	it('air_quality è null quando non risponde nessuna delle due fonti', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20 });

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.air_quality).toBeNull();
	});

	it('Open-Meteo copre l AQI quando WeatherAPI non risponde', async () => {
		// Finché WeatherAPI era l'unica fonte, un suo errore lasciava la
		// dashboard senza qualità dell'aria.
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20 });
		airQualityResult = {
			european_aqi: 42,
			pm2_5: 11,
			pm10: 19,
			no2: 14,
			o3: 58,
			so2: 3,
			co: 205,
			pollen: null,
		};

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.air_quality.pm2_5).toBe(11);
		expect(r.current.air_quality.european_aqi).toBe(42);
		expect(r.current.air_quality.aqi_us_epa).toBeNull();
	});

	it('WeatherAPI ha la precedenza sugli inquinanti, Open-Meteo aggiunge l indice europeo', async () => {
		// Le due fonti non usano la stessa unità per il monossido di carbonio:
		// mescolarle darebbe numeri incoerenti con quelli mostrati da mesi.
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			air_quality: { aqi_us_epa: 2, pm2_5: 12, pm10: 20, no2: 15, o3: 40, co: 200, so2: 5 },
		});
		airQualityResult = {
			european_aqi: 42,
			pm2_5: 99,
			pm10: 99,
			no2: 99,
			o3: 99,
			so2: 99,
			co: 99,
			pollen: null,
		};

		const r = await getSmartForecast(LAT, LON);

		expect(r.current.air_quality.pm2_5).toBe(12);
		expect(r.current.air_quality.co).toBe(200);
		expect(r.current.air_quality.aqi_us_epa).toBe(2);
		expect(r.current.air_quality.european_aqi).toBe(42);
	});

	it('i pollini compaiono solo dove il modello li copre', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 20 });

		const senza = await getSmartForecast(LAT, LON);
		expect(senza).not.toHaveProperty('pollen');

		airQualityResult = {
			european_aqi: 42,
			pm2_5: 11, pm10: 19, no2: 14, o3: 58, so2: 3, co: 205,
			pollen: [
				{ species: 'grass', label: 'Graminacee', value: 8, daily_max: 60, level: 'moderate', daily_level: 'very_high' },
			],
		};

		const con = await getSmartForecast(LAT, LON);
		expect(con.pollen).toHaveLength(1);
		expect(con.pollen[0].label).toBe('Graminacee');
	});

	it('preferisce la fonte astronomica che porta anche i dati lunari', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 20,
			astronomy: { sunrise: '06:00', sunset: '20:00', moon_phase: 'Luna Nuova' },
		});
		sourceResponses['worldweatheronline'] = forecast('worldweatheronline', {
			temp: 20,
			astronomy: {
				sunrise: '06:05',
				sunset: '20:05',
				moon_phase: 'Waxing Gibbous',
				moonrise: '2026-09-12T21:12:00',
				moonset: '2026-09-13T11:03:00',
			},
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.astronomy.moonrise).toBe('2026-09-12T21:12:00');
		expect(r.astronomy.moonset).toBe('2026-09-13T11:03:00');
	});

	it('completa i dati lunari mancanti pescandoli da un altra fonte', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 20,
			astronomy: { sunrise: '06:00', sunset: '20:00', moon_phase: 'Luna Nuova', moonrise: '21:00' },
		});
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			astronomy: { sunrise: '06:05', sunset: '20:05', moon_phase: 'Waxing Gibbous', moon_illumination: 72 },
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.astronomy.moon_illumination).toBe(72);
	});
});

describe('neve e gelate', () => {
	/**
	 * Ore a partire da adesso, in UTC.
	 *
	 * L'engine scarta gli slot precedenti all'ora corrente locale: una finestra
	 * costruita su una data fissa verrebbe buttata via tutta, e il test
	 * passerebbe o fallirebbe a seconda del giorno in cui gira.
	 */
	const oreDaAdesso = (count: number, over: Record<string, any> = {}) => {
		const base = new Date();
		base.setUTCMinutes(0, 0, 0);
		return Array.from({ length: count }, (_, i) => ({
			time: new Date(base.getTime() + i * 3600_000).toISOString().slice(0, 16),
			temp: 5,
			precipitation_prob: 10,
			condition_code: '71',
			condition_text: 'Snow',
			...over,
		}));
	};

	it('espone il riquadro neve quando c è qualcosa da dire', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: -1,
			elevation: 1800,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(12, {
				temp: -3,
				freezing_level: 1200,
				snowfall_cm: 1.5,
				snow_depth_cm: 40,
				precipitation_mm: 1.2,
			}),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.snow).toBeDefined();
		expect(r.snow.elevation).toBe(1800);
		expect(r.snow.snow_line).toBe(900);
		expect(r.snow.phase).toBe('snow');
		expect(r.snow.snow_depth_cm).toBe(40);
		expect(r.snow.snowfall_cm).toBeCloseTo(18, 1);
		expect(r.snow.frost.level).toBe('severe');
		// Nessun modello ha portato la temperatura del suolo: si ripiega sui
		// due metri, e il blocco lo dichiara invece di lasciarlo intendere.
		expect(r.snow.frost.source).toBe('air');
	});

	it('usa la temperatura del suolo per le gelate quando c è', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 3,
			elevation: 122,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(12, { temp: 2, soil_temperature: -2, freezing_level: 2400 }),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.snow.frost.source).toBe('soil');
		expect(r.snow.frost.min_temp).toBe(-2);
		expect(r.snow.frost.level).toBe('likely');
	});

	it('a luglio in pianura il riquadro non compare affatto', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 31,
			elevation: 122,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(12, { temp: 29, freezing_level: 4300, snowfall_cm: 0, snow_depth_cm: 0 }),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r).not.toHaveProperty('snow');
	});

	it('media la quota fra i modelli, che non concordano sull orografia', async () => {
		// Celle di griglia diverse danno altitudini diverse per lo stesso punto.
		activeModels = [MODELLI[0]!, MODELLI[4]!];
		sourceResponses['open-meteo:icon_d2'] = forecast('open-meteo:icon_d2', {
			temp: 0,
			elevation: 1000,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(6, { temp: 0, freezing_level: 1500 }),
		});
		sourceResponses['open-meteo:gfs'] = forecast('open-meteo:gfs', {
			temp: 0,
			elevation: 1400,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(6, { temp: 0, freezing_level: 1500 }),
		});

		const r = await getSmartForecast(LAT, LON);

		// (1000*1.2 + 1400*0.9) / 2.1 = 1171.4 → arrotondata al metro.
		expect(r.snow.elevation).toBe(1171);
	});

	it('una sola fonte che prevede neve non fa comparire una nevicata', async () => {
		// Stesso gate dei millimetri: tre modelli su quattro dicono asciutto.
		activeModels = MODELLI.slice(0, 4);
		const asciutto = { temp: -2, freezing_level: 1200, snowfall_cm: 0, precipitation_mm: 0 };
		for (const m of MODELLI.slice(0, 3)) {
			sourceResponses[m.sourceId] = forecast(m.sourceId, {
				temp: -2,
				elevation: 1800,
				utc_offset_seconds: 0,
				hourly: oreDaAdesso(6, asciutto),
			});
		}
		sourceResponses['open-meteo:meteofrance'] = forecast('open-meteo:meteofrance', {
			temp: -2,
			elevation: 1800,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(6, { ...asciutto, snowfall_cm: 4 }),
		});

		const r = await getSmartForecast(LAT, LON);

		// Il riquadro resta, per le gelate; la nevicata no.
		expect(r.snow.snowfall_cm).toBe(0);
		expect(r.snow.frost.level).toBe('likely');
	});

	it('porta i centimetri di neve anche sul giornaliero', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: -1,
			daily: [
				{
					date: '2026-01-15',
					temp_max: 0,
					temp_min: -5,
					precipitation_prob: 90,
					condition_code: '71',
					condition_text: 'Snow',
					precipitation_mm: 9,
					snowfall_cm: 12,
				},
			],
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.daily[0].snowfall_cm).toBe(12);
	});

	it('le fonti senza dati di neve non impediscono il calcolo', async () => {
		// Solo Open-Meteo espone zero termico e manto: le altre contribuiscono
		// alla temperatura e basta.
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: -1,
			elevation: 1800,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(6, { temp: -2, freezing_level: 1200, precipitation_mm: 1 }),
		});
		sourceResponses['apple_weatherkit'] = forecast('apple_weatherkit', {
			temp: -1,
			hourly: oreDaAdesso(6, { temp: -2 }),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.snow.phase).toBe('snow');
		expect(r.snow.snow_line).toBe(900);
	});
});

describe('indici convettivi', () => {
	const ora = (time: string, over: Record<string, any> = {}) => ({
		time,
		temp: 28,
		precipitation_prob: 40,
		condition_code: '95',
		condition_text: 'Thunderstorm',
		...over,
	});

	it('calcola l indice temporali dagli indici aggregati', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 28,
			hourly: [ora('2026-07-14T15:00', { cape: 1000, lifted_index: -6, convective_inhibition: -5 })],
		});

		const r = await getSmartForecast(LAT, LON);

		const slot = r.hourly[0];
		expect(slot.cape).toBe(1000);
		expect(slot.lifted_index).toBe(-6);
		// CAPE 1000 → 50, LI -6 → 75, media 62.5 → 63.
		expect(slot.storm_index).toBe(63);
	});

	it('media prima gli indici, poi calcola una volta sola', async () => {
		// La funzione non è lineare: mediare i due indici finali darebbe un
		// numero diverso. Si media come ogni altro campo, e si deriva dopo.
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 28,
			hourly: [ora('2026-07-14T15:00', { cape: 0 })],
		});
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 28,
			hourly: [ora('2026-07-14T15:00', { cape: 4000 })],
		});

		const r = await getSmartForecast(LAT, LON);

		// CAPE medio pesato (0*1.1 + 4000*1.0)/2.1 = 1904.8, che sulla spezzata
		// fra 1000 (50) e 2500 (75) dà 65. Mediando invece i due indici finali
		// (0 e 100, con gli stessi pesi) si otterrebbe 48: sono due numeri
		// diversi, ed è la ragione per cui l'ordine delle operazioni conta.
		expect(r.hourly[0].cape).toBeCloseTo(1904.8, 0);
		expect(r.hourly[0].storm_index).toBe(65);
	});

	it('porta la probabilità di tuono, che viene da una fonte sola', async () => {
		sourceResponses['worldweatheronline'] = forecast('worldweatheronline', {
			temp: 28,
			hourly: [ora('2026-07-14T15:00', { thunder_prob: 65 })],
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.hourly[0].thunder_prob).toBe(65);
		// Senza indici convettivi non si inventa un indice.
		expect(r.hourly[0]).not.toHaveProperty('storm_index');
	});

	it('una fonte senza indici convettivi non azzera quelli delle altre', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 28,
			hourly: [ora('2026-07-14T15:00', { cape: 2500 })],
		});
		sourceResponses['apple_weatherkit'] = forecast('apple_weatherkit', {
			temp: 28,
			hourly: [ora('2026-07-14T15:00')],
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.hourly[0].cape).toBe(2500);
		expect(r.hourly[0].storm_index).toBe(75);
	});

	it('un inverno senza indici lascia gli slot senza il campo', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 4,
			hourly: [ora('2026-01-14T15:00', { condition_code: '3' })],
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.hourly[0]).not.toHaveProperty('cape');
		expect(r.hourly[0]).not.toHaveProperty('storm_index');
	});
});

describe('orto e suolo', () => {
	const oraOrto = (time: string, over: Record<string, any> = {}) => ({
		time,
		temp: 22,
		precipitation_prob: 10,
		condition_code: '1',
		condition_text: 'Sereno',
		...over,
	});

	/** Ore a partire da adesso, come per la neve: l'engine scarta il passato. */
	const oreDaAdesso = (count: number, over: Record<string, any> = {}) => {
		const base = new Date();
		base.setUTCMinutes(0, 0, 0);
		return Array.from({ length: count }, (_, i) =>
			oraOrto(new Date(base.getTime() + i * 3600_000).toISOString().slice(0, 16), over)
		);
	};

	it('espone il riquadro orto con bilancio idrico e consiglio', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 22,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(24, {
				soil_moisture: 0.06,
				soil_temperature_root: 18,
				evapotranspiration: 0.2,
				precipitation_mm: 0,
			}),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.garden).toBeDefined();
		expect(r.garden.moisture_level).toBe('very_dry');
		expect(r.garden.evapotranspiration_mm).toBeCloseTo(4.8, 1);
		expect(r.garden.advice).toBe('water_now');
		expect(r.garden.sowing_ok).toBe(true);
	});

	it('non arrotonda l umidità del suolo a un decimale', async () => {
		// 0.252 m³/m³ diventerebbe 0.3, cioè da «adeguato» a un passo dal
		// «bagnato»: su una scala che vive fra 0 e 1 un decimale è troppo poco.
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 22,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(12, { soil_moisture: 0.252, evapotranspiration: 0.1 }),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.hourly[0].soil_moisture).toBeCloseTo(0.252, 3);
		expect(r.garden.soil_moisture).toBeCloseTo(0.252, 3);
	});

	it('«non serve innaffiare» resta un riquadro, non un blocco assente', async () => {
		// A differenza della neve, qui il caso tranquillo è la risposta cercata.
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 22,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(24, { soil_moisture: 0.28, evapotranspiration: 0.05 }),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.garden).toBeDefined();
		expect(r.garden.advice).toBe('not_needed');
	});

	it('senza dati agronomici il blocco non compare', async () => {
		sourceResponses['apple_weatherkit'] = forecast('apple_weatherkit', {
			temp: 22,
			utc_offset_seconds: 0,
			hourly: oreDaAdesso(12),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r).not.toHaveProperty('garden');
	});
});

describe('fotovoltaico', () => {
	/** Una giornata piena di irraggiamento, a partire da domani. */
	const giornataSolare = (picco: number) => {
		const domani = new Date();
		domani.setUTCDate(domani.getUTCDate() + 1);
		const date = domani.toISOString().slice(0, 10);
		return Array.from({ length: 24 }, (_, h) => {
			const fromNoon = Math.abs(h - 12);
			const value = fromNoon > 6 ? 0 : Math.round(picco * (1 - fromNoon / 6));
			return {
				time: `${date}T${String(h).padStart(2, '0')}:00`,
				temp: 24,
				precipitation_prob: 0,
				condition_code: '0',
				condition_text: 'Sereno',
				solar_irradiance: value,
				sunshine_duration: value > 100 ? 3600 : 0,
			};
		});
	};

	it('espone la resa specifica per giorno, non i watt grezzi', async () => {
		// kWh per kWp è la grandezza indipendente dalla taglia dell'impianto:
		// la moltiplicazione per i kWp dell'utente sta nel client, così la
		// risposta in cache resta la stessa per tutti.
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 24,
			utc_offset_seconds: 0,
			solar_plane: 'tilted',
			hourly: giornataSolare(900),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.solar).toBeDefined();
		expect(r.solar.days).toHaveLength(1);
		expect(r.solar.days[0].kwh_per_kwp).toBeGreaterThan(3);
		expect(r.solar.plane).toBe('tilted');
		expect(r.solar.tilt_deg).toBe(30);
	});

	it('senza il piano dichiarato non produce una stima', async () => {
		// Non sapere su che piano è misurata la radiazione rende il numero
		// privo di significato.
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 24,
			utc_offset_seconds: 0,
			hourly: giornataSolare(900),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r).not.toHaveProperty('solar');
	});

	it('una fonte senza radiazione non azzera quella delle altre', async () => {
		const senzaSole = giornataSolare(900).map((h) => ({
			...h,
			solar_irradiance: undefined,
			sunshine_duration: undefined,
		}));
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 24,
			utc_offset_seconds: 0,
			solar_plane: 'tilted',
			hourly: giornataSolare(900),
		});
		sourceResponses['apple_weatherkit'] = forecast('apple_weatherkit', {
			temp: 24,
			hourly: senzaSole,
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.solar.days[0].kwh_per_kwp).toBeGreaterThan(3);
	});
});


describe('cielo: tramonti e stelle', () => {
	/** Una giornata con la copertura indicata a tutte le ore, da domani. */
	const giornata = (over: Record<string, any>) => {
		const domani = new Date();
		domani.setUTCDate(domani.getUTCDate() + 1);
		const date = domani.toISOString().slice(0, 10);
		return Array.from({ length: 24 }, (_, h) => ({
			time: `${date}T${String(h).padStart(2, '0')}:00`,
			temp: 20,
			precipitation_prob: 0,
			condition_code: '1',
			condition_text: 'Sereno',
			...over,
		}));
	};

	const domaniAlle = (hour: string) => {
		const domani = new Date();
		domani.setUTCDate(domani.getUTCDate() + 1);
		return `${domani.toISOString().slice(0, 10)}T${hour}:00`;
	};

	it('valuta il tramonto sulle nuvole alte, non sulla copertura totale', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 20,
			utc_offset_seconds: 0,
			hourly: giornata({ cloud_cover: 55, cloud_cover_low: 0, cloud_cover_mid: 0, cloud_cover_high: 50 }),
			astronomy: {
				sunrise: domaniAlle('05:30'),
				sunset: domaniAlle('20:44'),
				moon_phase: 'Luna Nuova',
				moon_illumination: 5,
			},
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.sky).toBeDefined();
		// Copertura totale 55% ma tutta alta e orizzonte libero: spettacolare.
		expect(r.sky.sunset.score).toBe(100);
		expect(r.sky.sunset.level).toBe('excellent');
	});

	it('usa l illuminazione lunare riconciliata fra le fonti', async () => {
		// La luna arriva da una fonte diversa da quella astronomica principale:
		// il riquadro cielo si compone dopo quel merge, non prima.
		sourceResponses['open-meteo'] = forecast('open-meteo', {
			temp: 20,
			utc_offset_seconds: 0,
			hourly: giornata({ cloud_cover: 0 }),
			astronomy: { sunrise: domaniAlle('05:30'), sunset: domaniAlle('20:44'), moon_phase: 'Luna Piena' },
		});
		sourceResponses['weatherapi'] = forecast('weatherapi', {
			temp: 20,
			astronomy: {
				sunrise: domaniAlle('05:31'),
				sunset: domaniAlle('20:45'),
				moon_phase: 'Full Moon',
				moon_illumination: 100,
			},
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r.sky.stargazing.moon_illumination).toBe(100);
		// Cielo terso ma luna piena: buono per i pianeti, non per il profondo.
		expect(r.sky.stargazing.score).toBeLessThan(50);
	});

	it('senza nuvolosità per quota il blocco non compare', async () => {
		sourceResponses['apple_weatherkit'] = forecast('apple_weatherkit', {
			temp: 20,
			utc_offset_seconds: 0,
			hourly: giornata({}),
		});

		const r = await getSmartForecast(LAT, LON);

		expect(r).not.toHaveProperty('sky');
	});
});


describe('mare', () => {
	const oreMare = (count: number, over: Record<string, any> = {}) => {
		const base = new Date();
		base.setUTCMinutes(0, 0, 0);
		return Array.from({ length: count }, (_, i) => ({
			time: new Date(base.getTime() + i * 3600_000).toISOString().slice(0, 16),
			wave_height: 0.3,
			wave_direction: 110,
			wave_period: 4.2,
			swell_height: 0.2,
			sea_temperature: 24.6,
			...over,
		}));
	};

	it('espone il riquadro mare sulle località costiere', async () => {
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 28, utc_offset_seconds: 0 });
		marineResult = { hours: oreMare(24), utcOffsetSeconds: 0 };

		const r = await getSmartForecast(LAT, LON);

		expect(r.sea).toBeDefined();
		expect(r.sea.sea_temperature).toBeCloseTo(24.6, 1);
		expect(r.sea.state).toBe('calm');
	});

	it('nell entroterra il blocco non compare', async () => {
		// Il connettore si auto-esclude: non serve un test sulla distanza dalla
		// costa, la fonte stessa è il criterio.
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 28, utc_offset_seconds: 0 });
		marineResult = null;

		const r = await getSmartForecast(LAT, LON);

		expect(r).not.toHaveProperty('sea');
	});

	it('riporta il picco d onda atteso, non solo quello attuale', async () => {
		const ore = oreMare(24);
		ore[6]!.wave_height = 1.6;
		sourceResponses['open-meteo'] = forecast('open-meteo', { temp: 28, utc_offset_seconds: 0 });
		marineResult = { hours: ore, utcOffsetSeconds: 0 };

		const r = await getSmartForecast(LAT, LON);

		expect(r.sea.state).toBe('calm');
		expect(r.sea.max_wave_24h).toBeCloseTo(1.6, 2);
	});
});
