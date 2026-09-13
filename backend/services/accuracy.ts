import { supabase } from './supabase';
import {
	ARCHIVE_LAG_DAYS,
	fetchObservedTemperatures,
	hourKey,
	verificationDate,
} from './observations';

/**
 * Accuratezza delle fonti, misurata sull'osservato.
 *
 * Prima della Fase 6C questo modulo confrontava ogni fonte con la **media
 * delle altre** e chiamava il risultato accuratezza. Erano due errori in uno:
 * una fonte che aveva ragione mentre le altre sbagliavano veniva penalizzata,
 * e la media cumulativa senza finestra congelava i pesi dopo qualche migliaio
 * di campioni.
 *
 * Ora il confronto è con la temperatura realmente osservata (Open-Meteo
 * Archive/ERA5, o Meteostat dove disponibile), ogni confronto è un campione in
 * `accuracy_samples`, e il MAE viene **ricalcolato** sulla finestra scorrevole.
 *
 * ## Limite dichiarato
 *
 * `raw_forecasts` archivia i valori *correnti* di ogni fonte, non le sue
 * previsioni per le ore successive. Quello che si misura qui è quindi
 * l'accuratezza del **nowcast**: quanto la fonte azzecca la temperatura
 * dell'ora in cui l'abbiamo interrogata. È un segnale reale — ed è un
 * miglioramento netto rispetto alla deviazione dal consenso — ma non misura
 * l'orizzonte a +24h. Per quello servirebbe archiviare le previsioni per
 * orizzonte, cioè una modifica di schema: resta un passo successivo.
 */

/** Metriche verificate. Per ora solo la temperatura, l'unica che tutte le fonti riportano. */
export const VERIFIED_METRICS = ['temperature'] as const;

/** Ampiezza della finestra scorrevole su cui si calcola il MAE. */
export const ACCURACY_WINDOW_DAYS = 30;

/**
 * Campioni minimi perché il MAE di una fonte influenzi il suo peso.
 *
 * Con pochi confronti il numero è rumore: meglio il peso statico che un peso
 * corretto sulla base di tre osservazioni.
 */
export const MIN_SAMPLES_FOR_WEIGHT = 20;

export interface SourceMAE {
	source_id: string;
	metric: string;
	mae: number;
	sample_count: number;
}

/**
 * MAE correnti per fonte e metrica.
 *
 * Le righe con troppi pochi campioni vengono scartate qui: chi le legge
 * (lo Smart Engine) ricade così sul peso statico senza doverlo sapere.
 */
export async function getSourceAccuracies(): Promise<SourceMAE[]> {
	try {
		const { data, error } = await supabase
			.from('source_accuracy')
			.select('source_id, metric, mae, sample_count')
			.gte('sample_count', MIN_SAMPLES_FOR_WEIGHT);

		if (error) {
			console.error('Error fetching source accuracies:', error.message);
			return [];
		}
		return (data ?? []) as SourceMAE[];
	} catch (err: any) {
		console.error('Exception fetching source accuracies:', err.message);
		return [];
	}
}

/** Dizionario di lookup rapido: source_id → metrica → MAE. */
export async function getAccuracyMap(): Promise<Record<string, Record<string, number>>> {
	const list = await getSourceAccuracies();
	const map: Record<string, Record<string, number>> = {};

	for (const item of list) {
		if (!map[item.source_id]) map[item.source_id] = {};
		map[item.source_id]![item.metric] = Number(item.mae);
	}
	return map;
}

export interface AccuracyRun {
	/** Giorno verificato. */
	date: string;
	/** Località per cui si sono trovate osservazioni. */
	locations: number;
	/** Campioni inseriti. */
	samples: number;
	/** Fonti il cui MAE è stato ricalcolato. */
	sourcesUpdated: number;
	/** Località senza osservazioni disponibili. */
	skipped: number;
}

interface RawForecastRow {
	source_id: string;
	latitude: number;
	longitude: number;
	temp: number | null;
	fetched_at: string;
}

/**
 * Confronta le previsioni archiviate di un giorno con le osservazioni e
 * ricalcola il MAE sulla finestra scorrevole.
 *
 * Il giorno verificato è ~6 giorni indietro, non ieri: l'archivio ERA5 ha quel
 * ritardo di produzione. È un anello di retroazione lento, ma misura l'errore
 * vero invece di una somiglianza fra previsioni.
 *
 * @param now istante di riferimento, iniettabile nei test
 */
export async function recomputeAccuracy(now: Date = new Date()): Promise<AccuracyRun> {
	const date = verificationDate(now);
	const run: AccuracyRun = { date, locations: 0, samples: 0, sourcesUpdated: 0, skipped: 0 };

	console.log(`[Accuracy] Verifica del ${date} (ritardo archivio: ${ARCHIVE_LAG_DAYS} giorni)`);

	// 1. Previsioni archiviate di quel giorno, per località.
	const { data: rows, error } = await supabase
		.from('raw_forecasts')
		.select('source_id, latitude, longitude, temp, fetched_at')
		.gte('fetched_at', `${date}T00:00:00Z`)
		.lt('fetched_at', `${date}T23:59:59Z`)
		.not('temp', 'is', null);

	if (error) {
		console.error(`[Accuracy] Lettura di raw_forecasts fallita: ${error.message}`);
		return run;
	}
	if (!rows || rows.length === 0) {
		console.log('[Accuracy] Nessuna previsione archiviata per quel giorno');
		return run;
	}

	// 2. Raggruppa per località: una chiamata di osservazioni per punto, non per riga.
	const byLocation = new Map<string, RawForecastRow[]>();
	for (const row of rows as RawForecastRow[]) {
		// Arrotondamento a due decimali (~1 km): le richieste per coordinate
		// quasi identiche condividono le stesse osservazioni.
		const key = `${Number(row.latitude).toFixed(2)},${Number(row.longitude).toFixed(2)}`;
		if (!byLocation.has(key)) byLocation.set(key, []);
		byLocation.get(key)!.push(row);
	}

	console.log(`[Accuracy] ${rows.length} previsioni su ${byLocation.size} località`);

	// 3. Per ogni località: osservazioni, confronto, campioni.
	const samples: Record<string, any>[] = [];

	for (const [key, locationRows] of byLocation) {
		const [latStr, lonStr] = key.split(',');
		const lat = Number(latStr);
		const lon = Number(lonStr);

		const { temperatures, provider } = await fetchObservedTemperatures({ lat, lon, date });
		if (temperatures.size === 0) {
			run.skipped++;
			continue;
		}
		run.locations++;

		for (const row of locationRows) {
			if (row.temp == null) continue;
			const observed = temperatures.get(hourKey(row.fetched_at));
			if (observed == null) continue;

			samples.push({
				source_id: row.source_id,
				metric: 'temperature',
				abs_error: Number(Math.abs(row.temp - observed).toFixed(4)),
				forecast_value: row.temp,
				observed_value: observed,
				// L'ora del confronto, troncata: è anche la chiave di unicità che
				// rende il job rieseguibile senza contare due volte.
				observed_at: `${hourKey(row.fetched_at)}:00:00Z`,
				latitude: lat,
				longitude: lon,
				observation_source: provider,
			});
		}
	}

	// 4. Inserimento idempotente: una rilanciata sullo stesso giorno non
	//    raddoppia i campioni, grazie all'indice unico della migrazione 023.
	if (samples.length > 0) {
		const { error: insertError } = await supabase
			.from('accuracy_samples')
			.upsert(samples, { onConflict: 'source_id,metric,observed_at,latitude,longitude' });

		if (insertError) {
			console.error(`[Accuracy] Inserimento campioni fallito: ${insertError.message}`);
		} else {
			run.samples = samples.length;
		}
	}

	// 5. Ricalcolo del MAE sulla finestra.
	run.sourcesUpdated = await recomputeMaeFromSamples();

	console.log(
		`[Accuracy] Fatto: ${run.samples} campioni, ${run.locations} località verificate, ` +
			`${run.skipped} senza osservazioni, ${run.sourcesUpdated} fonti aggiornate`
	);
	return run;
}

/**
 * Ricalcola il MAE di ogni fonte sui campioni della finestra.
 *
 * La media viene rifatta da zero, non aggiornata: è la differenza fra un peso
 * che segue l'andamento recente di una fonte e uno che si cristallizza.
 */
export async function recomputeMaeFromSamples(
	windowDays = ACCURACY_WINDOW_DAYS
): Promise<number> {
	const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

	const { data, error } = await supabase
		.from('accuracy_samples')
		.select('source_id, metric, abs_error, observation_source')
		.gte('observed_at', since);

	if (error) {
		console.error(`[Accuracy] Lettura dei campioni fallita: ${error.message}`);
		return 0;
	}
	if (!data || data.length === 0) return 0;

	interface Bucket {
		sum: number;
		count: number;
		providers: Record<string, number>;
	}
	const buckets = new Map<string, Bucket>();

	for (const sample of data as any[]) {
		const key = `${sample.source_id}|${sample.metric}`;
		if (!buckets.has(key)) buckets.set(key, { sum: 0, count: 0, providers: {} });
		const bucket = buckets.get(key)!;
		bucket.sum += Number(sample.abs_error);
		bucket.count++;
		const provider = sample.observation_source ?? 'archive';
		bucket.providers[provider] = (bucket.providers[provider] ?? 0) + 1;
	}

	const updates = Array.from(buckets.entries()).map(([key, bucket]) => {
		const [source_id, metric] = key.split('|');
		const prevalent =
			Object.entries(bucket.providers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'archive';
		return {
			source_id,
			metric,
			mae: Number((bucket.sum / bucket.count).toFixed(4)),
			sample_count: bucket.count,
			window_days: windowDays,
			observation_source: prevalent,
			last_computed_at: new Date().toISOString(),
		};
	});

	const { error: upsertError } = await supabase
		.from('source_accuracy')
		.upsert(updates, { onConflict: 'source_id,metric' });

	if (upsertError) {
		console.error(`[Accuracy] Aggiornamento di source_accuracy fallito: ${upsertError.message}`);
		return 0;
	}
	return updates.length;
}

export interface SourceAccuracyReport {
	source_id: string;
	metric: string;
	/** MAE in °C rispetto all'osservato. */
	mae: number;
	sample_count: number;
	window_days: number;
	observation_source: string | null;
	last_computed_at: string | null;
	/**
	 * Moltiplicatore applicato al peso statico: 1 / (1 + MAE).
	 * Vale 1 finché i campioni non bastano, cioè finché il peso resta statico.
	 */
	weight_multiplier: number;
	/** Se false, il MAE è mostrato ma non influenza ancora l'aggregazione. */
	affects_weight: boolean;
}

/** Stato dell'accuratezza, per l'endpoint `GET /api/accuracy`. */
export async function getAccuracyReport(): Promise<SourceAccuracyReport[]> {
	const { data, error } = await supabase
		.from('source_accuracy')
		.select('source_id, metric, mae, sample_count, window_days, observation_source, last_computed_at')
		.order('mae', { ascending: true });

	if (error) {
		console.error(`[Accuracy] Lettura del report fallita: ${error.message}`);
		return [];
	}

	return (data ?? []).map((row: any) => {
		const affects = Number(row.sample_count) >= MIN_SAMPLES_FOR_WEIGHT;
		return {
			source_id: row.source_id,
			metric: row.metric,
			mae: Number(row.mae),
			sample_count: Number(row.sample_count),
			window_days: Number(row.window_days ?? ACCURACY_WINDOW_DAYS),
			observation_source: row.observation_source ?? null,
			last_computed_at: row.last_computed_at ?? null,
			weight_multiplier: affects ? Number((1 / (1 + Number(row.mae))).toFixed(4)) : 1,
			affects_weight: affects,
		};
	});
}
