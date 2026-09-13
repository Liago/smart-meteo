import type { FrostLevel, SnowOutlook, SnowPhase } from '@/lib/types';

/**
 * Etichette e frasi del riquadro neve.
 *
 * Separate dal componente perché la parte non ovvia non è il layout ma la
 * scelta di *cosa dire per primo*: il backend manda cinque numeri, e in cima
 * deve finire quello che cambia la giornata di chi legge — nevica adesso a casa
 * mia, oppure stanotte gela, oppure c'è mezzo metro di neve da spalare.
 */

export const PHASE_LABELS: Record<SnowPhase, string> = {
	snow: 'Neve',
	sleet: 'Neve mista a pioggia',
	rain: 'Pioggia',
};

export const FROST_LABELS: Record<FrostLevel, string> = {
	none: 'Nessun rischio',
	possible: 'Brina possibile',
	likely: 'Gelata probabile',
	severe: 'Gelata forte',
};

export const FROST_COLORS: Record<FrostLevel, string> = {
	none: 'rgba(8,42,77,0.18)',
	possible: '#7FC4E8',
	likely: '#3E8FD6',
	severe: '#2B4FA8',
};

/**
 * Metri, con il raggruppamento italiano.
 *
 * Scritto a mano invece che con `toLocaleString('it-IT')` perché quello non dà
 * lo stesso risultato ovunque: la regola CLDR italiana non raggruppa i numeri a
 * quattro cifre (`minimumGroupingDigits: 2`), Node la rispetta e Chromium no,
 * così la stessa quota diventava "1800 m" sul server e "1.800 m" nel browser —
 * due test in disaccordo e, peggio, un rischio di disallineamento in idratazione.
 *
 * La regola resta quella italiana, che è anche quella dei bollettini: "quota
 * neve 1800 m", il punto compare da cinque cifre in su.
 */
export function formatAltitude(meters: number | null): string {
	if (meters == null) return '—';
	const rounded = Math.round(meters);
	const digits = String(Math.abs(rounded));
	const grouped =
		digits.length >= 5 ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : digits;
	return `${rounded < 0 ? '-' : ''}${grouped} m`;
}

/** Centimetri: sotto i dieci conservano un decimale, con la virgola. */
export function formatCm(value: number | null): string {
	if (value == null) return '—';
	const rounded = value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace('.', ',');
	return `${rounded} cm`;
}

/** Gradi interi: mezzo grado di precisione su una minima è finta. */
export function formatTemp(value: number | null): string {
	if (value == null) return '—';
	return `${Math.round(value)}°`;
}

/**
 * Ora dello slot, dalla chiave locale `YYYY-MM-DDTHH:00`.
 *
 * Non passa da `new Date`: la chiave è già in ora locale della località, e
 * interpretarla nel fuso del browser sposterebbe l'orario di chi guarda da
 * un'altra parte del mondo.
 */
export function formatHour(slot: string | null): string | null {
	if (!slot) return null;
	const match = /T(\d{2}):(\d{2})/.exec(slot);
	return match ? `${match[1]}:${match[2]}` : null;
}

/**
 * La minima, scritta per intero.
 *
 * Dichiarare "al suolo" non è pedanteria: le due misure differiscono di 3-4
 * gradi nelle notti serene, e il backend le giudica con soglie diverse. Senza
 * la precisazione, "minima 1°" sembrerebbe un dato dell'aria che non allarma.
 */
export function frostMinimum(snow: SnowOutlook): string {
	const { min_temp, at, source } = snow.frost;
	const etichetta = source === 'soil' ? 'minima al suolo' : 'minima';
	if (min_temp == null) return `${etichetta} sotto zero`;

	const ora = formatHour(at);
	return `${etichetta} ${formatTemp(min_temp)}${ora ? ` alle ${ora}` : ''}`;
}

/** La frase sul rischio gelate, o null quando non ce n'è uno. */
export function frostSentence(snow: SnowOutlook): string | null {
	const { level } = snow.frost;
	if (level === 'none') return null;

	const minima = frostMinimum(snow);
	if (level === 'severe') return `Gelata forte in arrivo, ${minima}`;
	if (level === 'likely') return `Gelata probabile, ${minima}`;
	return `Possibile brina, ${minima}`;
}

/**
 * La riga in cima al pannello.
 *
 * L'ordine di priorità è quello dell'impatto: prima cosa cade qui adesso, poi
 * quanta neve è attesa, poi quella già a terra, e solo alla fine le gelate —
 * che restano comunque l'unico motivo per cui il pannello compare in pianura.
 */
export function snowHeadline(snow: SnowOutlook): string {
	const { phase, snowfall_cm, snow_depth_cm } = snow;
	const attesa = snowfall_cm != null && snowfall_cm > 0 ? formatCm(snowfall_cm) : null;

	if (phase === 'snow') {
		return attesa ? `Neve prevista, circa ${attesa}` : 'Le precipitazioni cadono come neve';
	}
	if (phase === 'sleet') {
		return 'Sei al limite della quota neve: pioggia mista';
	}
	if (attesa) {
		return `Neve prevista in quota, circa ${attesa}`;
	}
	if (snow_depth_cm != null && snow_depth_cm >= 1) {
		return `${formatCm(snow_depth_cm)} di neve al suolo`;
	}
	return frostSentence(snow) ?? 'Nessuna segnalazione';
}
