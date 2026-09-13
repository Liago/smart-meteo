import { HourlyForecast } from '../types';

/**
 * Orto e giardino: devo innaffiare, posso seminare.
 *
 * Open-Meteo espone gratuitamente umidità del suolo, evapotraspirazione di
 * riferimento FAO e temperatura dello strato radicale — dati agronomici veri,
 * sullo stesso endpoint che interroghiamo già. La domanda che rispondono non è
 * «che tempo fa» ma «devo prendere l'annaffiatoio stasera», che per chi ha un
 * orto è la ragione per cui apre un'app meteo.
 *
 * Tutte funzioni pure, testabili senza rete né database.
 */

/** Quanto è umido lo strato 0-7 cm. */
export type SoilMoistureLevel = 'very_dry' | 'dry' | 'adequate' | 'wet';

/** Che cosa fare dell'annaffiatoio. */
export type IrrigationAdvice = 'rain_expected' | 'water_now' | 'water_soon' | 'not_needed';

/**
 * Soglie di umidità volumetrica dello strato 0-7 cm, in m³/m³.
 *
 * **Dipendono dal tipo di suolo** e Open-Meteo non lo dichiara: la capacità di
 * campo di una sabbia sta intorno a 0.15, quella di un'argilla arriva a 0.40.
 * Questi valori sono quelli di un terreno franco, il più diffuso negli orti, e
 * per questo il pannello mostra sempre anche il numero grezzo: chi conosce il
 * proprio terreno può correggere il giudizio, chi non lo conosce ha comunque
 * un'indicazione ragionevole.
 */
export const MOISTURE_THRESHOLDS = {
	veryDry: 0.10,
	dry: 0.20,
	wet: 0.35,
} as const;

/**
 * Pioggia (mm) nella finestra oltre la quale non ha senso innaffiare.
 *
 * Innaffiare poche ore prima di un temporale è acqua buttata, e su un orto
 * appena irrigato una pioggia forte dilava anche il concime.
 */
export const RAIN_COVERS_MM = 5;

/**
 * Deficit idrico (mm) oltre il quale un terreno "adeguato" merita comunque un
 * avviso: l'evapotraspirazione lo sta consumando più in fretta di quanto la
 * pioggia lo ricarichi.
 */
export const DEFICIT_WARNING_MM = 4;

/** Deficit (mm) che rende urgente l'irrigazione su un terreno già asciutto. */
export const DEFICIT_URGENT_MM = 2;

/**
 * Temperatura dello strato radicale (°C) sotto la quale la maggior parte degli
 * ortaggi da clima temperato non germina.
 *
 * È una soglia di massima: la lattuga parte a 7 °C, il pomodoro vuole 15 °C.
 * 12 °C è il valore comunemente indicato come «si può cominciare».
 */
export const SOWING_MIN_SOIL_C = 12;

/** Ore in avanti considerate dal riquadro. */
export const GARDEN_WINDOW_HOURS = 24;

export interface GardenOutlook {
	/** Umidità volumetrica attuale dello strato 0-7 cm, m³/m³. */
	soil_moisture: number | null;
	moisture_level: SoilMoistureLevel | null;
	/** Temperatura media dello strato radicale nella finestra, °C. */
	soil_temperature: number | null;
	/** Evapotraspirazione attesa nella finestra, mm. */
	evapotranspiration_mm: number | null;
	/** Pioggia attesa nella finestra, mm. */
	rain_mm: number | null;
	/** Bilancio idrico: evapotraspirazione meno pioggia. Positivo = il terreno perde acqua. */
	water_balance_mm: number | null;
	advice: IrrigationAdvice;
	/** Se lo strato radicale è abbastanza caldo per seminare; null senza dato. */
	sowing_ok: boolean | null;
}

/**
 * Uno slot orario già aggregato, per quel che serve qui.
 *
 * I campi sono dichiarati anche `undefined` e non solo opzionali: con
 * `exactOptionalPropertyTypes` le due cose non coincidono, e chi costruisce
 * questi slot parte dagli slot dell'aggregazione, dove un campo assente arriva
 * come `undefined`.
 */
export interface GardenHour {
	time: string;
	soil_moisture?: number | null | undefined;
	soil_temperature_root?: number | null | undefined;
	evapotranspiration?: number | null | undefined;
	precipitation_mm?: number | null | undefined;
}

/** Classifica l'umidità del suolo secondo `MOISTURE_THRESHOLDS`. */
export function moistureLevel(value: number | null | undefined): SoilMoistureLevel | null {
	if (value == null || !Number.isFinite(value)) return null;
	if (value < MOISTURE_THRESHOLDS.veryDry) return 'very_dry';
	if (value < MOISTURE_THRESHOLDS.dry) return 'dry';
	if (value >= MOISTURE_THRESHOLDS.wet) return 'wet';
	return 'adequate';
}

/**
 * Decide se innaffiare.
 *
 * L'ordine delle regole è l'ordine di importanza pratica:
 *
 *   1. **Se piove abbastanza, non si innaffia.** Vale anche su terreno secco:
 *      l'acqua arriva comunque, e quella dell'annaffiatoio andrebbe sprecata.
 *      Questa regola viene prima di tutte proprio perché il caso in cui
 *      sbaglieresti è quello in cui il terreno è secco e saresti tentato.
 *   2. Terreno molto secco, o secco con l'aria che continua a prosciugarlo →
 *      subito.
 *   3. Terreno secco senza deficit, o adeguato con un deficit importante →
 *      presto: c'è tempo, ma non va dimenticato.
 *   4. Altrimenti non serve.
 */
export function irrigationAdvice(
	level: SoilMoistureLevel | null,
	balanceMm: number | null,
	rainMm: number | null
): IrrigationAdvice {
	if (rainMm != null && rainMm >= RAIN_COVERS_MM) return 'rain_expected';
	if (level == null) return 'not_needed';

	const balance = balanceMm ?? 0;

	if (level === 'very_dry') return 'water_now';
	if (level === 'dry') return balance > DEFICIT_URGENT_MM ? 'water_now' : 'water_soon';
	if (level === 'adequate' && balance > DEFICIT_WARNING_MM) return 'water_soon';
	return 'not_needed';
}

/** Somma i valori presenti, o null se non ce n'è nessuno. */
function sumOf(hours: GardenHour[], pick: (h: GardenHour) => number | null | undefined): number | null {
	const values = hours
		.map(pick)
		.filter((v): v is number => v != null && Number.isFinite(v));
	if (values.length === 0) return null;
	return Number(values.reduce((sum, v) => sum + Math.max(0, v), 0).toFixed(1));
}

/**
 * Costruisce il riquadro orto dalle ore già aggregate.
 *
 * A differenza del riquadro neve questo non si omette quando «non c'è niente da
 * dire»: «non serve innaffiare» **è** una risposta, ed è quella che chi ha un
 * orto va a cercare la sera. Il riquadro neve invece sarebbe stato vuoto —
 * niente manto, niente nevicata, nessuna gelata — per otto mesi l'anno.
 *
 * @param fromTime chiave del primo slot da considerare: l'umidità di stamattina
 *                 non è quella di adesso.
 */
export function buildGardenOutlook(hours: GardenHour[], fromTime?: string): GardenOutlook | null {
	if (!hours || hours.length === 0) return null;

	const window = (fromTime ? hours.filter((h) => h.time >= fromTime) : hours).slice(
		0,
		GARDEN_WINDOW_HOURS
	);
	if (window.length === 0) return null;

	// L'umidità è uno stato, non un accumulo: si legge l'ora corrente.
	const current = window.find(
		(h) => h.soil_moisture != null && Number.isFinite(h.soil_moisture)
	);
	const moisture = current?.soil_moisture != null ? Number(current.soil_moisture.toFixed(3)) : null;

	// La temperatura di semina è una media sulla finestra: un seme non reagisce
	// al minimo di un'ora, ma nemmeno al picco del primo pomeriggio.
	const soilTemps = window
		.map((h) => h.soil_temperature_root)
		.filter((v): v is number => v != null && Number.isFinite(v));
	const soilTemp =
		soilTemps.length > 0
			? Number((soilTemps.reduce((sum, v) => sum + v, 0) / soilTemps.length).toFixed(1))
			: null;

	const et0 = sumOf(window, (h) => h.evapotranspiration);
	const rain = sumOf(window, (h) => h.precipitation_mm);

	// Il bilancio ha senso solo con l'evapotraspirazione: senza, sarebbe la
	// pioggia col segno meno, che non dice niente sul consumo del terreno.
	const balance = et0 != null ? Number((et0 - (rain ?? 0)).toFixed(1)) : null;

	const level = moistureLevel(moisture);

	// Senza nessuno dei dati agronomici non c'è un riquadro da mostrare: la sola
	// pioggia la dicono già gli altri pannelli.
	if (level == null && et0 == null && soilTemp == null) return null;

	return {
		soil_moisture: moisture,
		moisture_level: level,
		soil_temperature: soilTemp,
		evapotranspiration_mm: et0,
		rain_mm: rain,
		water_balance_mm: balance,
		advice: irrigationAdvice(level, balance, rain),
		sowing_ok: soilTemp != null ? soilTemp >= SOWING_MIN_SOIL_C : null,
	};
}

/** Adatta gli slot orari aggregati alla forma che serve qui. */
export function gardenHoursFrom(hourly: HourlyForecast[]): GardenHour[] {
	return hourly.map((h) => ({
		time: h.time,
		soil_moisture: h.soil_moisture,
		soil_temperature_root: h.soil_temperature_root,
		evapotranspiration: h.evapotranspiration,
		precipitation_mm: h.precipitation_mm,
	}));
}
