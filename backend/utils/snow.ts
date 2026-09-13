import { WeightedValue, aggregateWithWetGate } from './precipitation';

/**
 * Neve e gelate: quota neve, manto al suolo, rischio brina.
 *
 * La quota dello zero termico da sola non dice niente all'utente. "Zero termico
 * a 1500 m" è un dato da bollettino: quello che serve sapere è se a *casa
 * propria* verrà giù neve o acqua. Open-Meteo restituisce, insieme alla
 * previsione, l'`elevation` del punto di griglia: è quella che trasforma un
 * numero astratto in una risposta.
 *
 * Tutte funzioni pure, testabili senza rete né database.
 */

/**
 * Scarto fra zero termico e quota neve, in metri.
 *
 * Il fiocco non si scioglie appena supera l'isoterma di 0 °C: continua a
 * scendere raffreddando l'aria attorno a sé (raffreddamento da fusione), e in
 * pratica arriva al suolo da 200 a 400 metri più in basso. 300 m è il valore
 * convenzionale per precipitazione moderata; con rovesci intensi la quota
 * scende ancora, ma stimare quel di più richiederebbe l'intensità verticale
 * che l'API non espone.
 */
export const MELT_MARGIN_M = 300;

/**
 * Fascia di incertezza attorno alla quota neve, in metri.
 *
 * Entro questa distanza dalla quota neve la fase non è decidibile: è la zona
 * della neve bagnata e della pioggia mista. Dichiararla è più onesto che
 * scegliere a caso fra pioggia e neve su una differenza di 30 metri, che nessun
 * modello risolve.
 */
export const PHASE_MARGIN_M = 150;

/** Passo di arrotondamento della quota neve, in metri. */
export const SNOW_LINE_STEP_M = 50;

/** Neve fresca (cm) sotto la quale una singola ora è considerata asciutta. */
export const SNOWFALL_THRESHOLD_CM = 0.2;

/** Manto al suolo (cm) sotto il quale non vale la pena parlarne. */
export const SNOW_DEPTH_RELEVANT_CM = 1;

/** Neve fresca prevista (cm) sopra la quale il pannello è rilevante. */
export const SNOWFALL_RELEVANT_CM = 0.5;

/** Fase della precipitazione alla quota della località. */
export type SnowPhase = 'snow' | 'sleet' | 'rain';

/** Rischio gelate nelle ore a venire. */
export type FrostLevel = 'none' | 'possible' | 'likely' | 'severe';

/**
 * Da dove viene la minima su cui si giudica il rischio gelate.
 *
 * Non è un dettaglio implementativo: le due misure vogliono soglie diverse, e
 * dirlo all'utente cambia il significato della frase ("minima 1°" e "minima al
 * suolo 1°" descrivono due notti diverse).
 */
export type FrostSource = 'soil' | 'air';

/**
 * Soglie del rischio gelate, in °C, per ciascuna misura.
 *
 * `soil` è la temperatura della superficie (`soil_temperature_0cm`): è lì che
 * si forma la brina, quindi la soglia è quella fisica, lo zero, con un grado di
 * margine per la notte che ci va vicino.
 *
 * `air` sono i canonici 2 metri, che è dove misurano le stazioni. Nelle notti
 * serene e senza vento la superficie irraggia e arriva a 3-4 gradi sotto
 * l'aria: per questo `possible` parte da +3 e non da 0. È la stima di ripiego,
 * usata quando i modelli Open-Meteo non sono attivi e nessuna fonte porta la
 * temperatura del suolo.
 *
 * Sotto la soglia `severe` la gelata non è più un fastidio ma un danno per le
 * colture, e merita una categoria a sé.
 */
export const FROST_THRESHOLDS: Record<FrostSource, { possible: number; likely: number; severe: number }> = {
	soil: { possible: 1, likely: 0, severe: -3 },
	air: { possible: 3, likely: 0, severe: -3 },
};

/** Ore in avanti considerate dal riquadro neve. */
export const OUTLOOK_HOURS = 24;

export interface FrostOutlook {
	level: FrostLevel;
	/** Temperatura minima prevista nella finestra, °C. */
	min_temp: number | null;
	/** Slot orario del minimo, nella stessa chiave locale degli hourly. */
	at: string | null;
	/** Se la minima è quella del suolo o quella dell'aria a 2 metri. */
	source: FrostSource;
}

export interface SnowOutlook {
	/** Quota della località secondo il modello, in metri. */
	elevation: number | null;
	/** Quota neve più bassa prevista nella finestra, in metri. */
	snow_line: number | null;
	/** Fase attesa alla quota della località; null se non è prevista precipitazione. */
	phase: SnowPhase | null;
	/** Manto nevoso presente adesso, in cm. */
	snow_depth_cm: number | null;
	/** Neve fresca attesa nella finestra, in cm. */
	snowfall_cm: number | null;
	frost: FrostOutlook;
}

/** Uno slot orario già aggregato, per quel che serve qui. */
export interface SnowHour {
	time: string;
	temp?: number | null;
	/** Quota dello zero termico, in metri. */
	freezing_level?: number | null;
	/** Neve fresca dell'ora, in cm. */
	snowfall_cm?: number | null;
	/** Manto al suolo, in cm. */
	snow_depth_cm?: number | null;
	/** Temperatura della superficie del suolo, °C. */
	soil_temperature?: number | null;
	precipitation_mm?: number | null;
}

/**
 * Quota neve a partire dallo zero termico, arrotondata al passo del modello.
 *
 * Non scende sotto lo zero: "quota neve −120 m" è un modo goffo di dire che
 * nevica ovunque, e a livello del mare la quota è 0.
 */
export function snowLineFrom(freezingLevel: number | null | undefined): number | null {
	if (freezingLevel == null || !Number.isFinite(freezingLevel)) return null;
	const line = Math.max(0, freezingLevel - MELT_MARGIN_M);
	return Math.round(line / SNOW_LINE_STEP_M) * SNOW_LINE_STEP_M;
}

/**
 * Che cosa cade alla quota `elevation`, data la quota neve.
 *
 * Sopra la quota neve nevica, sotto piove, e in mezzo — entro `PHASE_MARGIN_M`
 * — si dichiara la mista invece di fingere una certezza che il modello non ha.
 */
export function snowPhase(
	snowLine: number | null,
	elevation: number | null
): SnowPhase | null {
	if (snowLine == null || elevation == null) return null;
	if (elevation >= snowLine + PHASE_MARGIN_M) return 'snow';
	if (elevation <= snowLine - PHASE_MARGIN_M) return 'rain';
	return 'sleet';
}

/**
 * Classifica la minima prevista secondo le soglie della misura da cui viene.
 *
 * @param source `'soil'` per la superficie, `'air'` per i 2 metri
 */
export function frostLevel(
	minTemp: number | null | undefined,
	source: FrostSource = 'air'
): FrostLevel {
	if (minTemp == null || !Number.isFinite(minTemp)) return 'none';
	const thresholds = FROST_THRESHOLDS[source];
	if (minTemp <= thresholds.severe) return 'severe';
	if (minTemp <= thresholds.likely) return 'likely';
	if (minTemp <= thresholds.possible) return 'possible';
	return 'none';
}

/**
 * Aggrega i centimetri di neve previsti da più modelli per lo stesso slot.
 *
 * Stessa regola dei millimetri di pioggia — se il peso dei modelli che
 * prevedono neve è minoritario si restituisce 0 invece di una media che
 * inventerebbe una nevicata — ma con la soglia di "bagnato" espressa in cm.
 */
export function aggregateSnowfallCm(items: WeightedValue[]): number | null {
	return aggregateWithWetGate(items, SNOWFALL_THRESHOLD_CM);
}

/**
 * Costruisce il riquadro neve dalle ore già aggregate.
 *
 * Restituisce `null` quando non c'è niente da dire: niente manto, niente neve
 * prevista, nessun rischio di gelata e pioggia normale. È la differenza fra un
 * pannello utile a gennaio e un riquadro vuoto che occupa spazio a luglio.
 *
 * @param elevation quota della località in metri (da Open-Meteo)
 * @param hours slot orari aggregati, in ordine cronologico
 * @param fromTime chiave del primo slot da considerare; gli slot precedenti
 *                 vengono scartati (le fonti ne portano anche di passati)
 */
export function buildSnowOutlook(
	elevation: number | null,
	hours: SnowHour[],
	fromTime?: string
): SnowOutlook | null {
	if (!hours || hours.length === 0) return null;

	const window = (fromTime ? hours.filter((h) => h.time >= fromTime) : hours).slice(
		0,
		OUTLOOK_HOURS
	);
	if (window.length === 0) return null;

	// Quota neve: si prende la più bassa della finestra. È quella che decide se
	// uscire con le catene, e una media la annacquerebbe con le ore miti.
	const freezingLevels = window
		.map((h) => h.freezing_level)
		.filter((v): v is number => v != null && Number.isFinite(v));
	const snowLine = freezingLevels.length > 0 ? snowLineFrom(Math.min(...freezingLevels)) : null;

	// Manto al suolo: è uno stato, non un accumulo, quindi si legge l'ora
	// corrente e non si somma.
	const firstDepth = window.find((h) => h.snow_depth_cm != null && Number.isFinite(h.snow_depth_cm));
	const snowDepth = firstDepth?.snow_depth_cm != null ? Number(firstDepth.snow_depth_cm.toFixed(1)) : null;

	// Neve fresca: questa invece si somma, perché sono accumuli orari.
	const snowfallHours = window.filter((h) => h.snowfall_cm != null && Number.isFinite(h.snowfall_cm));
	const snowfall =
		snowfallHours.length > 0
			? Number(snowfallHours.reduce((sum, h) => sum + Math.max(0, h.snowfall_cm!), 0).toFixed(1))
			: null;

	// La fase ha senso solo se qualcosa deve cadere: con cielo sereno la quota
	// neve è un numero senza conseguenze.
	const precipitationExpected = window.some(
		(h) =>
			(h.precipitation_mm != null && h.precipitation_mm > 0) ||
			(h.snowfall_cm != null && h.snowfall_cm > 0)
	);
	const phase = precipitationExpected ? snowPhase(snowLine, elevation) : null;

	// La brina si forma sulla superficie, non a due metri da terra: quando i
	// modelli portano la temperatura del suolo si giudica su quella, e i 2 metri
	// restano il ripiego con soglie più prudenti.
	const usable = (pick: (h: SnowHour) => number | null | undefined) =>
		window
			.map(pick)
			.filter((v): v is number => v != null && Number.isFinite(v));

	const soilTemps = usable((h) => h.soil_temperature);
	const frostSource: FrostSource = soilTemps.length > 0 ? 'soil' : 'air';
	const temps = frostSource === 'soil' ? soilTemps : usable((h) => h.temp);

	const minTemp = temps.length > 0 ? Math.min(...temps) : null;
	const coldest =
		minTemp != null
			? window.find((h) =>
					(frostSource === 'soil' ? h.soil_temperature : h.temp) === minTemp
				)?.time ?? null
			: null;

	const frost: FrostOutlook = {
		level: frostLevel(minTemp, frostSource),
		min_temp: minTemp != null ? Number(minTemp.toFixed(1)) : null,
		at: coldest,
		source: frostSource,
	};

	const relevant =
		(snowDepth != null && snowDepth >= SNOW_DEPTH_RELEVANT_CM) ||
		(snowfall != null && snowfall >= SNOWFALL_RELEVANT_CM) ||
		frost.level !== 'none' ||
		phase === 'snow' ||
		phase === 'sleet';

	if (!relevant) return null;

	return {
		elevation: elevation != null ? Math.round(elevation) : null,
		snow_line: snowLine,
		phase,
		snow_depth_cm: snowDepth,
		snowfall_cm: snowfall,
		frost,
	};
}
