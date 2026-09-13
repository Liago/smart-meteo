import axios from 'axios';

/**
 * Banda di incertezza della temperatura, dai membri di un ensemble.
 *
 * L'indice di consenso della Fase 6A misura quanto le nostre fonti sono
 * d'accordo fra loro. È utile, ma è una stima indiretta: sono modelli
 * deterministici, ciascuno una singola realizzazione, e diversi provider
 * commerciali rielaborano gli stessi GFS ed ECMWF, quindi la loro concordanza
 * sovrastima la certezza.
 *
 * Un ensemble è un'altra cosa: lo stesso modello girato decine di volte
 * perturbando le condizioni iniziali. La dispersione fra i membri è la stima
 * dell'incertezza che i meteorologi usano davvero, e i percentili 10/50/90
 * dicono all'utente qualcosa che nessuna singola previsione può dire —
 * «fra 18 e 24 °C, più probabilmente 21».
 *
 * Non è una fonte dell'aggregazione: non fornisce condizioni correnti né
 * astronomia. Viaggia a parte, come `forecastNextHour`.
 */

/** Percentili della temperatura per una singola ora. */
export interface TemperatureBand {
	/** Ora locale, nella stessa forma degli slot orari di Open-Meteo. */
	time: string;
	p10: number;
	p50: number;
	p90: number;
	/** Membri effettivamente disponibili per quell'ora. */
	members: number;
}

export interface EnsembleResult {
	model: string;
	bands: TemperatureBand[];
	/** Offset locale, per allineare gli slot come fa lo Smart Engine. */
	utcOffsetSeconds: number | null;
}

const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';

/**
 * Modello di ensemble interrogato.
 *
 * ICON-EU-EPS del DWD è il compromesso per l'Italia: 40 membri, risoluzione
 * europea, orizzonte di cinque giorni. Configurabile perché la scelta dipende
 * dall'area — `off` disattiva del tutto la banda.
 */
export function ensembleModel(): string | null {
	const configured = process.env.OPENMETEO_ENSEMBLE?.trim();
	if (configured?.toLowerCase() === 'off') return null;
	return configured || 'icon_eu';
}

/**
 * Percentile con interpolazione lineare fra i due valori adiacenti.
 *
 * Su 40 membri il percentile 10 cade fra il quarto e il quinto: prendere
 * l'indice arrotondato scarterebbe informazione senza motivo.
 *
 * @param sorted valori già ordinati in modo crescente
 * @param p percentile in [0, 1]
 */
export function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return NaN;
	if (sorted.length === 1) return sorted[0]!;

	const position = (sorted.length - 1) * p;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	if (lower === upper) return sorted[lower]!;

	const weight = position - lower;
	return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

/**
 * Estrae le serie dei membri dalla risposta.
 *
 * Le chiavi hanno forma `temperature_2m_member01`, e con alcuni modelli anche
 * un suffisso del modello. Si riconoscono quindi per pattern invece di
 * costruirle a partire da un numero di membri atteso, che cambia da modello a
 * modello.
 */
function memberSeries(hourly: Record<string, unknown>): number[][] {
	return Object.keys(hourly)
		.filter((key) => /^temperature_2m(_.+)?_member\d+$/.test(key))
		.map((key) => hourly[key])
		.filter((series): series is number[] => Array.isArray(series));
}

/**
 * Banda di incertezza oraria della temperatura.
 *
 * Restituisce null — e non solleva — quando il modello è disattivato o l'API
 * non risponde: è un arricchimento, non deve poter far fallire una previsione.
 */
export async function fetchTemperatureBand(
	lat: number,
	lon: number
): Promise<EnsembleResult | null> {
	const model = ensembleModel();
	if (!model) return null;

	try {
		const response = await axios.get(ENSEMBLE_URL, {
			params: {
				latitude: lat,
				longitude: lon,
				hourly: 'temperature_2m',
				models: model,
				timezone: 'auto',
				forecast_days: 5,
			},
		});

		const hourly = response.data?.hourly;
		if (!hourly?.time || !Array.isArray(hourly.time)) return null;

		const series = memberSeries(hourly);
		if (series.length < 3) {
			// Con due membri i percentili non significano niente.
			console.warn(`[Ensemble] Solo ${series.length} membri da ${model}: banda non calcolabile`);
			return null;
		}

		const bands: TemperatureBand[] = [];
		hourly.time.forEach((time: string, index: number) => {
			const values = series
				.map((member) => member[index])
				.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
				.sort((a, b) => a - b);

			if (values.length < 3) return;

			bands.push({
				time,
				p10: Number(percentile(values, 0.1).toFixed(1)),
				p50: Number(percentile(values, 0.5).toFixed(1)),
				p90: Number(percentile(values, 0.9).toFixed(1)),
				members: values.length,
			});
		});

		if (bands.length === 0) return null;

		return {
			model,
			bands,
			utcOffsetSeconds: response.data?.utc_offset_seconds ?? null,
		};
	} catch (error: any) {
		console.warn(`[Ensemble] Fetch da ${model} fallito: ${error.message}`);
		return null;
	}
}
