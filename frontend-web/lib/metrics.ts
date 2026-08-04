import type { ComponentType } from 'react';
import { CloudRain, Droplets, Sun, Thermometer, Wind } from 'lucide-react';
import type { HourlyForecast } from './types';
import {
	MS_TO_KMH,
	PRECIP_THRESHOLDS,
	UV_THRESHOLDS,
	WIND_THRESHOLDS,
	formatPrecipMm,
	getHumidityColor,
	getPrecipIntensity,
	getTempColor,
	getUvScale,
	getWMOWeatherInfo,
	getWindScale,
	windDegreesToDirection,
} from './weather-utils';

/**
 * Registry delle metriche orarie mostrabili nel modale di dettaglio.
 *
 * Il componente `HourlyDetail` è del tutto agnostico rispetto alla metrica: legge
 * da qui come estrarre il valore da un'ora, come colorarlo, che dominio dare
 * all'asse e cosa scrivere nell'intestazione. Aggiungere una metrica significa
 * aggiungere una voce a `METRICS`, non toccare il componente.
 */

export type MetricId = 'precipitation' | 'wind' | 'humidity' | 'feels_like' | 'uv';

/** Ordine di comparsa nella dropdown. */
export const METRIC_ORDER: MetricId[] = ['precipitation', 'wind', 'humidity', 'feels_like', 'uv'];

export interface MetricDomain {
	min: number;
	max: number;
}

export interface MetricSection {
	/** Chiave di React, unica dentro la metrica. */
	id: string;
	height: number;
	/** Valore della barra, già nell'unità di visualizzazione. */
	valueOf: (h: HourlyForecast) => number | null | undefined;
	/** Valore secondario (raffica), disegnato come tacca sopra la barra. */
	secondaryOf?: (h: HourlyForecast) => number | null | undefined;
	colorOf: (v: number) => string;
	/**
	 * Dominio dell'asse Y. Riceve tutti i valori del giorno, principali e
	 * secondari insieme, così una raffica alta non finisce fuori dal grafico.
	 */
	domain: (values: number[]) => MetricDomain;
	gridLines: (d: MetricDomain) => { value: number; label?: string }[];
	bands: (d: MetricDomain) => { from: number; to: number; label: string }[];
	/** Valore grande dell'intestazione. `undefined` = ora non coperta da nessuna fonte. */
	headline: (h: HourlyForecast | undefined) => string;
	/** Riga di dettaglio sotto il valore grande. */
	caption: (h: HourlyForecast | undefined) => string;
	headlineClassName: string;
	captionClassName: string;
	ariaLabel: string;
	/** Mostrato al posto del grafico quando nessuna ora del giorno ha il dato. */
	emptyMessage: string;
	/** Sovrapposto al grafico quando tutti i valori del giorno sono a zero. */
	flatMessage?: string;
}

export interface MetricSpec {
	id: MetricId;
	label: string;
	icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
	sections: MetricSection[];
}

/** Multipli di `step` interni al dominio, per gli assi senza soglie naturali. */
function niceTicks(d: MetricDomain, step: number): number[] {
	const out: number[] = [];
	for (let v = Math.ceil(d.min / step) * step; v <= d.max; v += step) out.push(v);
	return out;
}

/** Dominio che parte da zero e lascia un margine sopra al valore massimo. */
function domainFromZero(floor: number) {
	return (values: number[]): MetricDomain => ({
		min: 0,
		max: Math.max(floor, ...values.map((v) => v * 1.15)),
	});
}

const conditionLabelOf = (h: HourlyForecast) =>
	h.condition_code ? getWMOWeatherInfo(h.condition_code).label : '';

// --- Precipitazioni ---

const precipitationMm: MetricSection = {
	id: 'mm',
	height: 150,
	valueOf: (h) => h.precipitation_mm,
	colorOf: (v) => getPrecipIntensity(v).color,
	domain: domainFromZero(PRECIP_THRESHOLDS.heavy * 1.25),
	// Le linee marcano i confini fra le fasce; le etichette stanno dentro alla
	// fascia che nominano. Una linea a 0,1 mm sarebbe appiccicata alla base e
	// illeggibile.
	gridLines: () => [{ value: PRECIP_THRESHOLDS.moderate }, { value: PRECIP_THRESHOLDS.heavy }],
	bands: () => [
		{ from: 0, to: PRECIP_THRESHOLDS.moderate, label: 'Debole' },
		{ from: PRECIP_THRESHOLDS.moderate, to: PRECIP_THRESHOLDS.heavy, label: 'Moderata' },
		{ from: PRECIP_THRESHOLDS.heavy, to: Infinity, label: 'Forte' },
	],
	headline: (h) => {
		if (!h) return 'Dato non disponibile';
		const intensity = getPrecipIntensity(h.precipitation_mm);
		return intensity.level === 'none' ? formatPrecipMm(h.precipitation_mm) : intensity.label;
	},
	caption: (h) => {
		if (!h) return '';
		const intensity = getPrecipIntensity(h.precipitation_mm);
		const amount =
			intensity.level !== 'none' && h.precipitation_mm != null
				? ` · ${formatPrecipMm(h.precipitation_mm)}`
				: '';
		return `${conditionLabelOf(h)}${amount}`;
	},
	headlineClassName: 'text-white/90',
	captionClassName: 'text-blue-200/80',
	ariaLabel: 'Precipitazione oraria prevista in millimetri',
	emptyMessage: 'Quantità in mm non disponibile per questa località',
	flatMessage: 'Nessuna precipitazione prevista',
};

const precipitationProb: MetricSection = {
	id: 'prob',
	height: 100,
	valueOf: (h) => h.precipitation_prob,
	colorOf: () => 'rgba(147,197,253,0.85)',
	domain: () => ({ min: 0, max: 100 }),
	gridLines: () => [
		{ value: 80, label: '80%' },
		{ value: 100, label: '100%' },
	],
	bands: () => [],
	headline: (h) => (h?.precipitation_prob != null ? `${Math.round(h.precipitation_prob)}%` : '—%'),
	caption: () => 'Probabilità',
	headlineClassName: 'text-blue-300',
	captionClassName: 'text-white/50',
	ariaLabel: 'Probabilità oraria di precipitazione',
	emptyMessage: 'Probabilità non disponibile per questa località',
};

// --- Vento ---

const windSection: MetricSection = {
	id: 'wind',
	height: 150,
	valueOf: (h) => (h.wind_speed != null ? h.wind_speed * MS_TO_KMH : null),
	secondaryOf: (h) => (h.wind_gust != null ? h.wind_gust * MS_TO_KMH : null),
	colorOf: (v) => getWindScale(v).color,
	domain: domainFromZero(WIND_THRESHOLDS.strong * 1.25),
	gridLines: () => [{ value: WIND_THRESHOLDS.moderate }, { value: WIND_THRESHOLDS.strong }],
	bands: () => [
		{ from: 0, to: WIND_THRESHOLDS.moderate, label: 'Debole' },
		{ from: WIND_THRESHOLDS.moderate, to: WIND_THRESHOLDS.strong, label: 'Teso' },
		{ from: WIND_THRESHOLDS.strong, to: Infinity, label: 'Forte' },
	],
	headline: (h) => {
		if (!h) return 'Dato non disponibile';
		if (h.wind_speed == null) return '—';
		return `${Math.round(h.wind_speed * MS_TO_KMH)} km/h`;
	},
	caption: (h) => {
		if (!h || h.wind_speed == null) return '';
		const parts: string[] = [];
		if (h.wind_direction != null) parts.push(`Da ${windDegreesToDirection(h.wind_direction)}`);
		parts.push(getWindScale(h.wind_speed * MS_TO_KMH).label);
		if (h.wind_gust != null) parts.push(`raffiche ${Math.round(h.wind_gust * MS_TO_KMH)} km/h`);
		return parts.join(' · ');
	},
	headlineClassName: 'text-white/90',
	captionClassName: 'text-blue-200/80',
	ariaLabel: 'Velocità oraria del vento in chilometri orari',
	emptyMessage: 'Dati del vento non disponibili per questa località',
	flatMessage: 'Assenza di vento prevista',
};

// --- Umidità ---

const humiditySection: MetricSection = {
	id: 'humidity',
	height: 150,
	valueOf: (h) => h.humidity,
	colorOf: (v) => getHumidityColor(v),
	domain: () => ({ min: 0, max: 100 }),
	gridLines: () => [
		{ value: 30, label: '30%' },
		{ value: 60, label: '60%' },
		{ value: 90, label: '90%' },
	],
	bands: () => [],
	headline: (h) => {
		if (!h) return 'Dato non disponibile';
		return h.humidity != null ? `${Math.round(h.humidity)}%` : '—';
	},
	caption: () => 'Umidità relativa',
	headlineClassName: 'text-white/90',
	captionClassName: 'text-white/50',
	ariaLabel: 'Umidità relativa oraria',
	emptyMessage: 'Umidità non disponibile per questa località',
};

// --- Temperatura percepita ---

const feelsLikeSection: MetricSection = {
	id: 'feels_like',
	height: 150,
	valueOf: (h) => h.feels_like,
	colorOf: (v) => getTempColor(v),
	// A differenza delle altre metriche il fondo non è zero: barre che partono da
	// 0 °C su una giornata fra 18 e 24 °C non mostrerebbero alcuna variazione, e
	// con temperature sotto zero non avrebbero proprio senso.
	domain: (values) => {
		if (values.length === 0) return { min: 0, max: 1 };
		return {
			min: Math.floor(Math.min(...values)) - 2,
			max: Math.ceil(Math.max(...values)) + 2,
		};
	},
	gridLines: (d) => niceTicks(d, 5).map((value) => ({ value, label: `${value}°` })),
	bands: () => [],
	headline: (h) => {
		if (!h) return 'Dato non disponibile';
		return h.feels_like != null ? `${Math.round(h.feels_like)}°` : '—';
	},
	caption: (h) => (h ? `Reale ${Math.round(h.temp)}° · ${conditionLabelOf(h)}` : ''),
	headlineClassName: 'text-white/90',
	captionClassName: 'text-blue-200/80',
	ariaLabel: 'Temperatura percepita oraria',
	emptyMessage: 'Temperatura percepita non disponibile per questa località',
};

// --- Indice UV ---

const uvSection: MetricSection = {
	id: 'uv',
	height: 150,
	valueOf: (h) => h.uv_index,
	colorOf: (v) => getUvScale(v).color,
	domain: domainFromZero(UV_THRESHOLDS.extreme),
	gridLines: () => [
		{ value: UV_THRESHOLDS.moderate },
		{ value: UV_THRESHOLDS.high },
		{ value: UV_THRESHOLDS.veryHigh },
	],
	// Quattro fasce e non cinque: "Estremo" parte da 11 e in un grafico alto 150
	// px la sua etichetta finirebbe sovrapposta a quella sotto. Il livello resta
	// comunque nel colore della barra e nella didascalia.
	bands: () => [
		{ from: 0, to: UV_THRESHOLDS.moderate, label: 'Basso' },
		{ from: UV_THRESHOLDS.moderate, to: UV_THRESHOLDS.high, label: 'Moderato' },
		{ from: UV_THRESHOLDS.high, to: UV_THRESHOLDS.veryHigh, label: 'Alto' },
		{ from: UV_THRESHOLDS.veryHigh, to: Infinity, label: 'Molto alto' },
	],
	headline: (h) => {
		if (!h) return 'Dato non disponibile';
		return h.uv_index != null ? `${Math.round(h.uv_index)}` : '—';
	},
	caption: (h) => (h?.uv_index != null ? `Indice UV · ${getUvScale(h.uv_index).label}` : ''),
	headlineClassName: 'text-white/90',
	captionClassName: 'text-blue-200/80',
	ariaLabel: 'Indice UV orario',
	emptyMessage: 'Indice UV non disponibile per questa località',
	flatMessage: 'Nessuna radiazione UV prevista',
};

export const METRICS: Record<MetricId, MetricSpec> = {
	precipitation: {
		id: 'precipitation',
		label: 'Precipitazioni',
		icon: CloudRain,
		sections: [precipitationMm, precipitationProb],
	},
	wind: {
		id: 'wind',
		label: 'Vento',
		icon: Wind,
		sections: [windSection],
	},
	humidity: {
		id: 'humidity',
		label: 'Umidità',
		icon: Droplets,
		sections: [humiditySection],
	},
	feels_like: {
		id: 'feels_like',
		label: 'Percepita',
		icon: Thermometer,
		sections: [feelsLikeSection],
	},
	uv: {
		id: 'uv',
		label: 'Indice UV',
		icon: Sun,
		sections: [uvSection],
	},
};
