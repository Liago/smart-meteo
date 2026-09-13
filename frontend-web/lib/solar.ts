import type { SolarDay, SolarOutlook } from '@/lib/types';

/**
 * Resa fotovoltaica: dalla resa specifica ai kWh dell'impianto.
 *
 * Il backend calcola kWh per kWp, che è la grandezza fisica. Qui si moltiplica
 * per la potenza dell'impianto, che è un dato dell'utente e non della
 * previsione: tenerlo fuori dal backend è ciò che permette a una sola risposta
 * in cache di servire tutti quelli sulla stessa località.
 */

/** Chiave di localStorage della potenza dell'impianto, in kWp. */
export const PLANT_KWP_KEY = 'smart-meteo-pv-kwp';

/** Taglia massima accettata: oltre non è più un impianto domestico. */
export const MAX_PLANT_KWP = 100;

/**
 * Legge la potenza salvata.
 *
 * Ogni accesso a `localStorage` è protetto: in navigazione privata o con i dati
 * del sito bloccati l'accesso solleva, e un'eccezione qui farebbe sparire tutta
 * la dashboard per una preferenza secondaria.
 */
export function readPlantKwp(): number | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(PLANT_KWP_KEY);
		if (!raw) return null;
		const value = Number(raw);
		return Number.isFinite(value) && value > 0 ? value : null;
	} catch {
		return null;
	}
}

/**
 * Iscritti al cambio di potenza.
 *
 * Servono a `useSyncExternalStore`: `localStorage` è uno store esterno al
 * React tree, e questo è il modo previsto per leggerlo senza disallineamenti in
 * idratazione e senza chiamare `setState` dentro un effetto.
 */
const listeners = new Set<() => void>();

export function subscribePlantKwp(onChange: () => void): () => void {
	listeners.add(onChange);
	return () => {
		listeners.delete(onChange);
	};
}

/** Valore sul server, dove `localStorage` non esiste. */
export function serverPlantKwp(): number | null {
	return null;
}

/** Salva la potenza, o la dimentica quando è nulla. */
export function writePlantKwp(kwp: number | null): void {
	if (typeof window !== 'undefined') {
		try {
			if (kwp == null) window.localStorage.removeItem(PLANT_KWP_KEY);
			else window.localStorage.setItem(PLANT_KWP_KEY, String(kwp));
		} catch {
			// Preferenza persa, dashboard intatta.
		}
	}
	for (const listener of listeners) listener();
}

/** Interpreta la potenza scritta dall'utente, accettando la virgola. */
export function parsePlantKwp(input: string): number | null {
	const value = Number(input.replace(',', '.'));
	if (!Number.isFinite(value) || value <= 0 || value > MAX_PLANT_KWP) return null;
	return value;
}

/** Energia attesa dall'impianto in un giorno, kWh. */
export function dayEnergyKwh(day: SolarDay, kwp: number | null): number | null {
	if (kwp == null) return null;
	return Number((day.kwh_per_kwp * kwp).toFixed(1));
}

/** kWh con un decimale, all'italiana. */
export function formatKwh(value: number | null): string {
	if (value == null) return '—';
	return `${value.toFixed(1).replace('.', ',')} kWh`;
}

/** Resa specifica, sempre con l'unità che la rende leggibile. */
export function formatSpecificYield(value: number): string {
	return `${value.toFixed(2).replace('.', ',')} kWh/kWp`;
}

/** Giorno della settimana abbreviato, o «Oggi»/«Domani». */
export function dayLabel(date: string, today = new Date()): string {
	const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	if (date === todayKey) return 'Oggi';

	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
	if (date === tomorrowKey) return 'Domani';

	// Il giorno si costruisce dai pezzi della stringa, non da `new Date(date)`:
	// quello interpreterebbe la data come UTC e in Italia mostrerebbe il giorno
	// prima per tutta la sera.
	const [year, month, day] = date.split('-').map(Number);
	if (!year || !month || !day) return date;
	return new Date(year, month - 1, day)
		.toLocaleDateString('it-IT', { weekday: 'short' })
		.replace('.', '');
}

/**
 * La frase che dichiara le assunzioni della stima.
 *
 * Senza, il numero non è verificabile: chi ha un impianto sa la propria
 * inclinazione, e ha diritto di sapere quale abbiamo supposto noi.
 */
export function assumptionsNote(solar: SolarOutlook): string {
	const piano =
		solar.plane === 'tilted'
			? `pannelli a ${solar.tilt_deg}° esposti a sud`
			: 'piano orizzontale';
	const perdite = Math.round((1 - solar.performance_ratio) * 100);
	return `Stima su ${piano}, con ${perdite}% di perdite di impianto.`;
}
