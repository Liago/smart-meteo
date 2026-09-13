import { MarineHour } from '../connectors/openmeteoMarine';

/**
 * Stato del mare per chi ci va.
 *
 * La domanda di chi va al mare è doppia e concreta: **quanto è fredda l'acqua**
 * e **quanto è mosso**. L'altezza d'onda in metri risponde alla seconda solo per
 * chi sa leggerla: 1,3 m sembra poco scritto così, ed è il mare che rovescia un
 * pedalò.
 *
 * Tutte funzioni pure, testabili senza rete né database.
 */

/**
 * Stato del mare secondo la scala in uso nei bollettini italiani.
 *
 * Corrisponde ai gradi della scala Douglas, raggruppati: sopra il «molto mosso»
 * le distinzioni (agitato, molto agitato, grosso) riguardano la navigazione e
 * non chi sceglie se fare il bagno.
 */
export const SEA_THRESHOLDS = {
	slight: 0.5,
	moderate: 1.25,
	rough: 2.5,
} as const;

export type SeaState = 'calm' | 'slight' | 'moderate' | 'rough';

export interface SeaOutlook {
	/** Temperatura dell'acqua adesso, °C. */
	sea_temperature: number | null;
	/** Altezza d'onda significativa adesso, metri. */
	wave_height: number | null;
	/** Direzione di provenienza dell'onda, gradi. */
	wave_direction: number | null;
	/** Periodo dell'onda, secondi. */
	wave_period: number | null;
	/** Mare lungo adesso, metri. */
	swell_height: number | null;
	state: SeaState;
	/** Onda massima attesa nelle prossime 24 ore, metri. */
	max_wave_24h: number | null;
	/** Slot orario del massimo. */
	max_wave_at: string | null;
}

/** Ore in avanti considerate per il massimo. */
export const SEA_WINDOW_HOURS = 24;

/** Classifica l'altezza d'onda secondo `SEA_THRESHOLDS`. */
export function seaState(waveHeight: number | null | undefined): SeaState {
	if (waveHeight == null || !Number.isFinite(waveHeight)) return 'calm';
	if (waveHeight >= SEA_THRESHOLDS.rough) return 'rough';
	if (waveHeight >= SEA_THRESHOLDS.moderate) return 'moderate';
	if (waveHeight >= SEA_THRESHOLDS.slight) return 'slight';
	return 'calm';
}

/**
 * Costruisce il riquadro mare dalle ore del modello d'onda.
 *
 * @param fromTime chiave del primo slot da considerare: il mare di stamattina
 *                 non è quello di adesso.
 */
export function buildSeaOutlook(hours: MarineHour[], fromTime?: string): SeaOutlook | null {
	if (!hours || hours.length === 0) return null;

	const window = (fromTime ? hours.filter((h) => h.time >= fromTime) : hours).slice(
		0,
		SEA_WINDOW_HOURS
	);
	if (window.length === 0) return null;

	// Onda e temperatura sono stati: si leggono adesso, non si mediano sulla
	// giornata. La prima ora utile è quella corrente.
	const now = window.find((h) => h.wave_height != null) ?? window[0]!;

	const withWaves = window.filter((h) => h.wave_height != null);
	const peak =
		withWaves.length > 0
			? withWaves.reduce((best, h) => (h.wave_height! > best.wave_height! ? h : best))
			: null;

	// Senza né onda né temperatura non c'è un riquadro: sono le due domande a
	// cui questo blocco esiste per rispondere.
	if (now.wave_height == null && now.sea_temperature == null) return null;

	return {
		sea_temperature: now.sea_temperature != null ? Number(now.sea_temperature.toFixed(1)) : null,
		wave_height: now.wave_height != null ? Number(now.wave_height.toFixed(2)) : null,
		wave_direction: now.wave_direction,
		wave_period: now.wave_period != null ? Number(now.wave_period.toFixed(1)) : null,
		swell_height: now.swell_height != null ? Number(now.swell_height.toFixed(2)) : null,
		state: seaState(now.wave_height),
		max_wave_24h: peak?.wave_height != null ? Number(peak.wave_height.toFixed(2)) : null,
		max_wave_at: peak?.time ?? null,
	};
}
