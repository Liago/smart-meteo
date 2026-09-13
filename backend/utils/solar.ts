import { HourlyForecast } from '../types';

/**
 * Resa fotovoltaica dalla radiazione solare prevista.
 *
 * In Italia il fotovoltaico domestico è diffusissimo, e la domanda di chi ce
 * l'ha non è «c'è il sole» ma «quanto produco domani». Open-Meteo dà la
 * radiazione sul piano dei pannelli gratuitamente, sullo stesso endpoint che
 * interroghiamo già.
 *
 * Quel che si calcola qui è la **resa specifica**, in kWh per kWp installato:
 * è la grandezza fisica, indipendente dalla taglia dell'impianto. Moltiplicarla
 * per i kWp dell'utente è una moltiplicazione, e sta nel client — così il
 * backend resta senza stato e la stessa risposta in cache serve tutti quelli
 * sulla stessa località, che è il punto di avere una cache.
 *
 * Tutte funzioni pure, testabili senza rete né database.
 */

/**
 * Rapporto di prestazione (performance ratio) di un impianto domestico.
 *
 * Mette insieme tutto ciò che sta fra la radiazione che arriva sul vetro e
 * l'energia che esce dal contatore: rendimento dell'inverter, perdite nei cavi,
 * sporco sui pannelli e soprattutto il calo di efficienza delle celle quando si
 * scaldano. 0.75 è il valore comunemente usato per un impianto su tetto in buone
 * condizioni; un impianto vecchio o ombreggiato sta più in basso.
 *
 * Non dipende dalla previsione, quindi è una costante e non un dato: serve
 * dichiararla, non stimarla.
 */
export const PERFORMANCE_RATIO = 0.75;

/** Irraggiamento alle condizioni standard di prova, W/m². */
export const STC_IRRADIANCE_W = 1000;

/**
 * Ore di dati necessarie perché un giorno sia riportato.
 *
 * Un giorno coperto solo per tre ore darebbe un totale bassissimo che sembra
 * una previsione di nuvolo, mentre è solo una previsione monca. Ventidue ore
 * lasciano passare i buchi isolati senza far entrare i giorni tagliati.
 */
export const MIN_HOURS_PER_DAY = 22;

/** Su quale piano è misurata la radiazione ricevuta. */
export type SolarPlane = 'tilted' | 'horizontal';

export interface SolarDay {
	/** Data locale, YYYY-MM-DD. */
	date: string;
	/** Resa specifica del giorno, kWh per kWp installato. */
	kwh_per_kwp: number;
	/** Ore di sole pieno, quando la fonte le dichiara. */
	sunshine_hours: number | null;
	/** Picco di irraggiamento del giorno, W/m². */
	peak_w: number;
}

export interface SolarOutlook {
	/**
	 * Piano su cui è calcolata la stima. Con `horizontal` la produzione reale
	 * di un impianto inclinato è più alta d'inverno e simile d'estate: va
	 * detto, non nascosto.
	 */
	plane: SolarPlane;
	/** Inclinazione e orientamento assunti, gradi (azimut: 0 = sud). */
	tilt_deg: number;
	azimuth_deg: number;
	/** Rapporto di prestazione usato nella stima. */
	performance_ratio: number;
	/** Giorni con copertura sufficiente, in ordine cronologico. */
	days: SolarDay[];
}

/** Uno slot orario già aggregato, per quel che serve qui. */
export interface SolarHour {
	time: string;
	solar_irradiance?: number | null | undefined;
	sunshine_duration?: number | null | undefined;
}

/**
 * Resa specifica da una serie oraria di irraggiamento.
 *
 * Ogni ora contribuisce `W/m² × 1 h = Wh/m²`; la somma diviso 1000 W/m² dà le
 * **ore di sole equivalenti** alle condizioni standard, che numericamente sono
 * già i kWh per kWp prima delle perdite. Il rapporto di prestazione le riduce
 * all'energia che esce davvero.
 *
 * @returns kWh/kWp arrotondati a due decimali, o null senza dati.
 */
export function specificYield(irradianceW: number[]): number | null {
	const valid = irradianceW.filter((v) => Number.isFinite(v) && v >= 0);
	if (valid.length === 0) return null;

	const whPerM2 = valid.reduce((sum, w) => sum + w, 0);
	return Number(((whPerM2 / STC_IRRADIANCE_W) * PERFORMANCE_RATIO).toFixed(2));
}

/** Giorno locale dello slot, dalla chiave `YYYY-MM-DDTHH:00`. */
function dayOf(slot: string): string {
	return slot.slice(0, 10);
}

/**
 * Costruisce il riquadro fotovoltaico dalle ore già aggregate.
 *
 * @param plane piano su cui la fonte ha calcolato la radiazione
 * @param fromTime chiave del primo slot da considerare: il sole di stamattina
 *                 non è produzione futura
 */
export function buildSolarOutlook(
	hours: SolarHour[],
	plane: SolarPlane | null | undefined,
	tiltDeg: number,
	azimuthDeg: number,
	fromTime?: string
): SolarOutlook | null {
	if (!hours || hours.length === 0 || !plane) return null;

	const window = fromTime ? hours.filter((h) => h.time >= fromTime) : hours;

	const byDay = new Map<string, { irradiance: number[]; sunshine: number[] }>();
	for (const hour of window) {
		if (hour.solar_irradiance == null || !Number.isFinite(hour.solar_irradiance)) continue;
		const day = dayOf(hour.time);
		if (!byDay.has(day)) byDay.set(day, { irradiance: [], sunshine: [] });
		const entry = byDay.get(day)!;
		entry.irradiance.push(Math.max(0, hour.solar_irradiance));
		if (hour.sunshine_duration != null && Number.isFinite(hour.sunshine_duration)) {
			entry.sunshine.push(hour.sunshine_duration);
		}
	}

	const days: SolarDay[] = [];
	for (const [date, entry] of Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))) {
		// Il primo giorno è quasi sempre parziale — la giornata è già iniziata —
		// e riportarlo intero sarebbe una sottostima travestita da previsione.
		if (entry.irradiance.length < MIN_HOURS_PER_DAY) continue;

		const yieldKwh = specificYield(entry.irradiance);
		if (yieldKwh == null) continue;

		days.push({
			date,
			kwh_per_kwp: yieldKwh,
			sunshine_hours:
				entry.sunshine.length > 0
					? Number((entry.sunshine.reduce((sum, s) => sum + s, 0) / 3600).toFixed(1))
					: null,
			peak_w: Math.round(Math.max(...entry.irradiance)),
		});
	}

	if (days.length === 0) return null;

	return {
		plane,
		tilt_deg: tiltDeg,
		azimuth_deg: azimuthDeg,
		performance_ratio: PERFORMANCE_RATIO,
		days,
	};
}

/** Adatta gli slot orari aggregati alla forma che serve qui. */
export function solarHoursFrom(hourly: HourlyForecast[]): SolarHour[] {
	return hourly.map((h) => ({
		time: h.time,
		solar_irradiance: h.solar_irradiance,
		sunshine_duration: h.sunshine_duration,
	}));
}
