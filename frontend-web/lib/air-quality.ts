import type { AirQualityDetail } from './types';

/**
 * Qualità dell'aria: categorie, soglie per inquinante e generazione della
 * descrizione testuale.
 *
 * È il porting di `Models/WeatherDescriptionEngine.swift` (sezione "Algoritmo 2"),
 * tenuto in un modulo a sé come su iOS invece che dentro `weather-utils.ts`:
 * la tabella delle soglie e il generatore di frasi sono un blocco coeso, e
 * `POLLUTANTS` serve sia la descrizione sia la griglia del pannello.
 *
 * Il dato arriva da WeatherAPI (unica sorgente che lo espone) come indice
 * EPA 1-6, non come AQI 0-500.
 */

interface AqiScale {
	label: string;
	/** Colore pieno, per lo sfondo della capsula del badge. */
	color: string;
	/** Classe Tailwind, per il testo piccolo nella flip-card. */
	className: string;
}

const AQI_CATEGORIES: Record<number, AqiScale> = {
	1: { label: 'Buona', color: '#33B34D', className: 'text-green-300' },
	2: { label: 'Moderata', color: '#E6CC33', className: 'text-yellow-300' },
	3: { label: 'Malsana per sensibili', color: '#F28C26', className: 'text-orange-300' },
	4: { label: 'Malsana', color: '#E64033', className: 'text-red-300' },
	5: { label: 'Molto malsana', color: '#8C3399', className: 'text-purple-300' },
	6: { label: 'Pericolosa', color: '#802626', className: 'text-rose-300' },
};

const AQI_UNKNOWN: AqiScale = {
	label: 'N/D',
	color: 'rgba(255,255,255,0.25)',
	className: 'text-white/50',
};

/**
 * Categoria per un indice EPA 1-6. L'indice viene arrotondato perché
 * `current.aqi` è una media pesata fra le sorgenti con un decimale, e la
 * card lo mostra a sua volta arrotondato: label e numero devono concordare.
 * Su `air_quality.aqi_us_epa`, che è già intero, l'arrotondamento è un no-op.
 */
export function getAqiScale(index: number | null | undefined): AqiScale {
	if (index == null || isNaN(index)) return AQI_UNKNOWN;
	return AQI_CATEGORIES[Math.round(index)] ?? AQI_UNKNOWN;
}

export interface Pollutant {
	key: Exclude<keyof AirQualityDetail, 'aqi_us_epa'>;
	label: string;
	/** Oltre questa soglia il valore è "leggermente elevato". */
	elevated: number;
	/** Oltre questa soglia il valore è "alto". */
	high: number;
	/** Spiegazione contestuale, mostrata solo da qualità moderata in giù. */
	hint?: string;
}

/**
 * Soglie OMS 2021, in µg/m³. L'ordine è anche quello di lettura della griglia
 * del pannello (PM2.5, PM10, NO₂ / O₃, CO, SO₂).
 */
export const POLLUTANTS: Pollutant[] = [
	{
		key: 'pm2_5',
		label: 'PM2.5',
		elevated: 15,
		high: 35,
		hint: 'Particolato fine elevato, possibile causa traffico o riscaldamento.',
	},
	{
		key: 'pm10',
		label: 'PM10',
		elevated: 45,
		high: 75,
		hint: 'Particolato grossolano elevato, possibile causa polveri o cantieri.',
	},
	{
		key: 'no2',
		label: 'NO₂',
		elevated: 25,
		high: 50,
		hint: 'Biossido di azoto elevato, probabilmente da traffico urbano.',
	},
	{
		key: 'o3',
		label: 'O₃',
		elevated: 100,
		high: 160,
		hint: 'Ozono elevato, tipico delle giornate calde e soleggiate.',
	},
	{ key: 'co', label: 'CO', elevated: 4000, high: 10000 },
	{ key: 'so2', label: 'SO₂', elevated: 40, high: 125 },
];

/**
 * Frase che riassume la qualità dell'aria: categoria complessiva, elenco degli
 * inquinanti fuori soglia e, se la qualità non è "Buona", la spiegazione
 * contestuale del primo di essi.
 */
export function generateAirQualityDescription(airQuality: AirQualityDetail): string {
	const parts: string[] = [];

	const category = getAqiScale(airQuality.aqi_us_epa).label;
	if (category !== AQI_UNKNOWN.label) {
		parts.push(`Qualità ${category.toLowerCase()}.`);
	}

	const elevated = POLLUTANTS.flatMap((p) => {
		const value = airQuality[p.key];
		if (value == null) return [];
		if (value > p.high) return [{ ...p, isHigh: true }];
		if (value > p.elevated) return [{ ...p, isHigh: false }];
		return [];
	});

	// L'hint si aggiunge solo da AQI 2 (moderata) in giù: con qualità buona
	// sarebbe un allarme fuori luogo su un valore appena sopra la soglia.
	const hintAllowed = airQuality.aqi_us_epa != null && airQuality.aqi_us_epa >= 2;
	const firstHint = elevated.find((p) => p.hint)?.hint;

	if (elevated.length === 0) {
		parts.push('Tutti i valori nella norma.');
	} else if (elevated.length === 1) {
		parts.push(`${elevated[0].label} ${elevated[0].isHigh ? 'alto' : 'leggermente elevato'}.`);
	} else {
		const names = elevated.map((p) => p.label);
		const level = elevated.some((p) => p.isHigh) ? 'elevati' : 'sopra la media';
		parts.push(`${names.slice(0, -1).join(', ')} e ${names[names.length - 1]} ${level}.`);
	}

	if (elevated.length > 0 && firstHint && hintAllowed) {
		parts.push(firstHint);
	}

	return parts.join(' ');
}
