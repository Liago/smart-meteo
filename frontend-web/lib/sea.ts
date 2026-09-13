import type { SeaOutlook, SeaState } from '@/lib/types';

/**
 * Etichette del riquadro mare.
 *
 * La traduzione che conta è quella dell'altezza d'onda in una parola: «1,3 m»
 * sembra poco scritto così, ed è il mare che rovescia un pedalò. Le parole sono
 * quelle dei bollettini italiani, che chi va al mare riconosce.
 */

/**
 * Soglie in metri, le stesse di `backend/utils/sea.ts`.
 *
 * Servono qui solo a dire se il picco atteso cambia fascia: il giudizio
 * sull'ora corrente lo calcola il backend, e ricalcolarlo lato client
 * significherebbe avere due verità sullo stesso numero.
 */
export const SEA_THRESHOLDS = {
	slight: 0.5,
	moderate: 1.25,
	rough: 2.5,
} as const;

export function seaStateOf(waveHeight: number | null): SeaState {
	if (waveHeight == null || isNaN(waveHeight)) return 'calm';
	if (waveHeight >= SEA_THRESHOLDS.rough) return 'rough';
	if (waveHeight >= SEA_THRESHOLDS.moderate) return 'moderate';
	if (waveHeight >= SEA_THRESHOLDS.slight) return 'slight';
	return 'calm';
}

export const SEA_LABELS: Record<SeaState, string> = {
	calm: 'Calmo',
	slight: 'Poco mosso',
	moderate: 'Mosso',
	rough: 'Molto mosso',
};

export const SEA_COLORS: Record<SeaState, string> = {
	calm: '#33B34D',
	slight: '#7FC4E8',
	moderate: '#F59E0B',
	rough: '#C2410C',
};

/** Metri con due decimali sotto il metro, uno sopra: sotto conta il centimetro. */
export function formatWave(value: number | null): string {
	if (value == null) return '—';
	const decimals = value < 1 ? 2 : 1;
	return `${value.toFixed(decimals).replace('.', ',')} m`;
}

/** Gradi interi: mezzo grado sull'acqua è precisione finta. */
export function formatSeaTemp(value: number | null): string {
	if (value == null) return '—';
	return `${Math.round(value)}°`;
}

/** Ora dello slot, dalla chiave locale `YYYY-MM-DDTHH:00`. */
export function formatHour(slot: string | null): string | null {
	if (!slot) return null;
	const match = /T(\d{2}):(\d{2})/.exec(slot);
	return match ? `${match[1]}:${match[2]}` : null;
}

/**
 * Rosa dei venti a 8 punti per la provenienza dell'onda.
 *
 * Otto e non sedici: sulla direzione dell'onda la differenza fra NNE e NE non
 * cambia nulla per chi sceglie una spiaggia, e allunga solo l'etichetta.
 */
export function waveDirectionLabel(degrees: number | null): string | null {
	if (degrees == null || !Number.isFinite(degrees)) return null;
	const points = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
	return points[Math.round(((degrees % 360) + 360) % 360 / 45) % 8]!;
}

/**
 * La riga in cima: l'acqua quando la conosciamo, altrimenti lo stato del mare.
 *
 * La temperatura viene prima perché è la prima domanda di chi va al mare —
 * «si fa il bagno?» — e lo stato serve subito dopo.
 */
export function seaHeadline(sea: SeaOutlook): string {
	const stato = SEA_LABELS[sea.state].toLowerCase();
	if (sea.sea_temperature != null) {
		return `Acqua a ${formatSeaTemp(sea.sea_temperature)}, mare ${stato}`;
	}
	return `Mare ${stato}`;
}

/**
 * L'avviso sul peggioramento, quando il massimo atteso cambia lo stato.
 *
 * Se il mare resta nella stessa fascia non c'è niente da dire: il numero è già
 * nella riga dell'onda, e ripeterlo come avviso sarebbe un falso allarme.
 */
export function worseningNote(sea: SeaOutlook): string | null {
	if (sea.max_wave_24h == null) return null;

	const later = seaStateOf(sea.max_wave_24h);
	if (later === sea.state) return null;

	const quando = formatHour(sea.max_wave_at);
	const stato = SEA_LABELS[later].toLowerCase();
	return quando
		? `Verso le ${quando} diventa ${stato} (${formatWave(sea.max_wave_24h)})`
		: `In giornata diventa ${stato} (${formatWave(sea.max_wave_24h)})`;
}
