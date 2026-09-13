import type { GardenOutlook, IrrigationAdvice, SoilMoistureLevel } from '@/lib/types';

/**
 * Etichette e frasi del riquadro orto.
 *
 * Separate dal componente perché la parte non ovvia non è il layout ma la
 * traduzione di due numeri agronomici — umidità volumetrica in m³/m³ ed
 * evapotraspirazione in mm — in una frase che dice se prendere o no
 * l'annaffiatoio.
 */

export const MOISTURE_LABELS: Record<SoilMoistureLevel, string> = {
	very_dry: 'Molto secco',
	dry: 'Asciutto',
	adequate: 'Umidità adeguata',
	wet: 'Molto umido',
};

export const MOISTURE_COLORS: Record<SoilMoistureLevel, string> = {
	very_dry: '#C2410C',
	dry: '#F59E0B',
	adequate: '#33B34D',
	wet: '#0EA5E9',
};

/** La riga in cima al pannello: la risposta, non i dati. */
export const ADVICE_HEADLINES: Record<IrrigationAdvice, string> = {
	rain_expected: 'Non innaffiare: ci pensa la pioggia',
	water_now: 'Da innaffiare oggi',
	water_soon: 'Da innaffiare entro un giorno o due',
	not_needed: 'Non serve innaffiare',
};

export const ADVICE_COLORS: Record<IrrigationAdvice, string> = {
	rain_expected: '#0EA5E9',
	water_now: '#C2410C',
	water_soon: '#F59E0B',
	not_needed: '#33B34D',
};

/** Millimetri con un decimale, all'italiana. */
export function formatMm(value: number | null): string {
	if (value == null) return '—';
	return `${value.toFixed(1).replace('.', ',')} mm`;
}

/**
 * Umidità volumetrica come percentuale di volume.
 *
 * 0.25 m³/m³ significa che un quarto del volume del terreno è acqua: scritto
 * «25%» lo capisce chiunque, scritto «0,25 m³/m³» quasi nessuno. Il pannello
 * mostra comunque anche l'unità di origine, perché la soglia di «asciutto»
 * dipende dal tipo di suolo e chi conosce il proprio terreno deve poter
 * correggere il giudizio.
 */
export function formatMoisture(value: number | null): string {
	if (value == null) return '—';
	return `${Math.round(value * 100)}% vol.`;
}

/** Gradi interi: il decimale su una media del suolo è precisione finta. */
export function formatSoilTemp(value: number | null): string {
	if (value == null) return '—';
	return `${Math.round(value)}°`;
}

/**
 * La riga sotto al titolo: perché il consiglio è quello.
 *
 * Il bilancio idrico da solo è un numero; accanto al motivo diventa una
 * spiegazione che l'utente può contestare, ed è quello che rende un consiglio
 * affidabile invece che oracolare.
 */
export function adviceReason(garden: GardenOutlook): string | null {
	const { advice, rain_mm, water_balance_mm, moisture_level } = garden;

	if (advice === 'rain_expected' && rain_mm != null) {
		return `Attesi ${formatMm(rain_mm)} nelle prossime 24 ore`;
	}
	if (water_balance_mm != null && water_balance_mm > 0) {
		return `Il terreno perde ${formatMm(water_balance_mm)} più di quanti ne riceve`;
	}
	if (moisture_level === 'wet') {
		return 'Il terreno è già saturo';
	}
	if (water_balance_mm != null && water_balance_mm <= 0 && rain_mm != null && rain_mm > 0) {
		return `La pioggia attesa copre l'evaporazione`;
	}
	return null;
}

/** La frase sulla semina, o null quando il dato manca. */
export function sowingSentence(garden: GardenOutlook): string | null {
	if (garden.sowing_ok == null || garden.soil_temperature == null) return null;
	return garden.sowing_ok
		? `Suolo a ${formatSoilTemp(garden.soil_temperature)}: si può seminare`
		: `Suolo a ${formatSoilTemp(garden.soil_temperature)}: ancora freddo per seminare`;
}
