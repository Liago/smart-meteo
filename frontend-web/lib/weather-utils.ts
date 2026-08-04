import type { WeatherCondition } from './types';

export const conditionLabels: Record<WeatherCondition, string> = {
	clear: 'Sereno',
	cloudy: 'Nuvoloso',
	rain: 'Pioggia',
	snow: 'Neve',
	storm: 'Temporale',
	fog: 'Nebbia',
	unknown: 'N/D',
};

export const conditionIcons: Record<WeatherCondition, string> = {
	clear: '\u2600\uFE0F',
	cloudy: '\u2601\uFE0F',
	rain: '\uD83C\uDF27\uFE0F',
	snow: '\u2744\uFE0F',
	storm: '\u26C8\uFE0F',
	fog: '\uD83C\uDF2B\uFE0F',
	unknown: '\uD83C\uDF21\uFE0F',
};

export function getConditionLabel(condition: string): string {
	return conditionLabels[condition as WeatherCondition] || conditionLabels.unknown;
}

export function getConditionIcon(condition: string): string {
	return conditionIcons[condition as WeatherCondition] || conditionIcons.unknown;
}

export function windDegreesToDirection(deg: number | null): string {
	if (deg === null) return 'N/D';
	const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
	const index = Math.round(deg / 45) % 8;
	return directions[index];
}

// Dynamic background gradients per condition
export const conditionGradients: Record<WeatherCondition, string> = {
	clear: 'from-orange-400 via-rose-500 to-indigo-600',       // Sunset: Rich Orange -> Deep Rose -> Indigo
	cloudy: 'from-indigo-400 via-slate-600 to-gray-700',      // Cloudy: Moody Indigo -> Dark Slate
	rain: 'from-teal-600 via-blue-700 to-slate-800',          // Rain: Deep Teal -> Dark Blue
	snow: 'from-blue-400 via-indigo-500 to-violet-600',       // Snow: Vibrant Blue -> Violet (Not too light)
	storm: 'from-slate-700 via-purple-900 to-black',          // Storm: Very Dark
	fog: 'from-slate-500 via-zinc-600 to-stone-700',          // Fog: Medium Dark Grey
	unknown: 'from-gray-600 via-gray-700 to-slate-800',
};

// WMO Weather Codes to text/icon mapping
// Source: https://open-meteo.com/en/docs
// Also handles normalized condition strings ('clear', 'cloudy', etc.)
// returned by non-WMO sources (Tomorrow.io, OWM, AccuWeather, WeatherAPI)
export function getWMOWeatherInfo(code: string | number): { label: string; icon: string } {
	// First, try normalized condition strings (from non-WMO sources)
	if (typeof code === 'string') {
		const norm = code.toLowerCase();
		switch (norm) {
			case 'clear': return { label: 'Sereno', icon: '☀️' };
			case 'cloudy': return { label: 'Nuvoloso', icon: '☁️' };
			case 'rain': return { label: 'Pioggia', icon: '🌧️' };
			case 'snow': return { label: 'Neve', icon: '🌨️' };
			case 'storm': return { label: 'Temporale', icon: '⛈️' };
			case 'fog': return { label: 'Nebbia', icon: '🌫️' };
			case 'unknown': return { label: 'N/D', icon: '❓' };
		}
	}

	const c = Number(code);
	if (isNaN(c)) return { label: 'N/D', icon: '❓' };

	switch (c) {
		case 0: return { label: 'Sereno', icon: '☀️' };
		case 1: return { label: 'Poco nuvoloso', icon: '🌤️' };
		case 2: return { label: 'Parz. nuvoloso', icon: '⛅' };
		case 3: return { label: 'Coperto', icon: '☁️' };

		case 45: return { label: 'Nebbia', icon: '🌫️' };
		case 48: return { label: 'Nebbia brinosa', icon: '🌫️' };

		case 51: return { label: 'Pioviggine leggera', icon: '🌧️' };
		case 53: return { label: 'Pioviggine', icon: '🌧️' };
		case 55: return { label: 'Pioviggine densa', icon: '🌧️' };

		case 56: return { label: 'Pioviggine gelata', icon: '❄️' };
		case 57: return { label: 'Pioviggine gelata forte', icon: '❄️' };

		case 61: return { label: 'Pioggia debole', icon: '🌧️' };
		case 63: return { label: 'Pioggia moderata', icon: '🌧️' };
		case 65: return { label: 'Pioggia forte', icon: '🌧️' };

		case 66: return { label: 'Pioggia gelata', icon: '❄️' };
		case 67: return { label: 'Pioggia gelata forte', icon: '❄️' };

		case 71: return { label: 'Neve debole', icon: '🌨️' };
		case 73: return { label: 'Neve moderata', icon: '🌨️' };
		case 75: return { label: 'Neve forte', icon: '🌨️' };
		case 77: return { label: 'Nevischio', icon: '🌨️' };

		case 80: return { label: 'Rovesci deboli', icon: '🌦️' };
		case 81: return { label: 'Rovesci moderati', icon: '🌦️' };
		case 82: return { label: 'Rovesci violenti', icon: '⛈️' };

		case 85: return { label: 'Rovesci di neve', icon: '🌨️' };
		case 86: return { label: 'Rovesci di neve forti', icon: '🌨️' };

		case 95: return { label: 'Temporale', icon: '⛈️' };
		case 96: return { label: 'Temporale con grandine', icon: '⛈️' };
		case 99: return { label: 'Temporale forte con grandine', icon: '⛈️' };

		default: return { label: 'N/D', icon: '❓' };
	}
}

export function isDaytime(sunrise: string, sunset: string): boolean {
	if (!sunrise || !sunset) return true; // Default to day if unknown

	try {
		// Formats expected: "06:00 AM", "06:00", "6:00 AM"
		const parseTime = (timeStr: string) => {
			const [time, modifier] = timeStr.split(' ');
			let [hours, minutes] = time.split(':').map(Number);

			if (modifier === 'PM' && hours < 12) hours += 12;
			if (modifier === 'AM' && hours === 12) hours = 0;

			const date = new Date();
			date.setHours(hours, minutes, 0, 0);
			return date;
		};

		const now = new Date();
		const sunriseDate = parseTime(sunrise);
		const sunsetDate = parseTime(sunset);

		return now >= sunriseDate && now < sunsetDate;
	} catch (e) {
		console.error('Error parsing astronomy time:', e);
		return true;
	}
}

// UV Index labels and colors
export function getUvLabel(uv: number): string {
	if (uv <= 2) return 'Basso';
	if (uv <= 5) return 'Moderato';
	if (uv <= 7) return 'Alto';
	if (uv <= 10) return 'Molto Alto';
	return 'Estremo';
}

export function getUvColor(uv: number): string {
	if (uv <= 2) return 'text-green-300';
	if (uv <= 5) return 'text-yellow-300';
	if (uv <= 7) return 'text-orange-300';
	if (uv <= 10) return 'text-red-300';
	return 'text-purple-300';
}

// --- Precipitazioni (quantità in mm) ---

export type PrecipLevel = 'none' | 'light' | 'moderate' | 'heavy';

/**
 * Soglie di intensità in mm accumulati in un'ora, secondo lo standard NWS/AMS
 * (debole ≤ 0.10 in/h, moderata 0.11–0.30 in/h, forte > 0.30 in/h).
 *
 * Preferite alle soglie WMO (2.5 / 10 / 50) perché la spaziatura WMO spingerebbe
 * la banda "Forte" fuori dal grafico per la climatologia italiana.
 */
export const PRECIP_THRESHOLDS = {
	light: 0.1,
	moderate: 2.5,
	heavy: 7.6,
} as const;

const precipLevels: Record<PrecipLevel, { label: string; color: string }> = {
	none: { label: '—', color: 'rgba(255,255,255,0.25)' },
	light: { label: 'Debole', color: '#7FB3E8' },
	moderate: { label: 'Moderata', color: '#3B82F6' },
	heavy: { label: 'Forte', color: '#EC685A' },
};

export function getPrecipIntensity(mm: number | null | undefined): {
	level: PrecipLevel;
	label: string;
	color: string;
} {
	let level: PrecipLevel = 'none';
	if (mm != null && !isNaN(mm)) {
		if (mm >= PRECIP_THRESHOLDS.heavy) level = 'heavy';
		else if (mm >= PRECIP_THRESHOLDS.moderate) level = 'moderate';
		else if (mm >= PRECIP_THRESHOLDS.light) level = 'light';
	}
	return { level, ...precipLevels[level] };
}

/** Formatta i mm in italiano con un decimale, es. "0,5 mm". */
export function formatPrecipMm(mm: number | null | undefined): string {
	if (mm == null || isNaN(mm)) return '—';
	return `${mm.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm`;
}

/**
 * Intervallo orario leggibile a partire da un timestamp, es. "17:00 - 18:00".
 * Lavora sui caratteri della stringa ISO: i timestamp del backend sono già in
 * ora locale della località, quindi convertirli con `Date` li sposterebbe nel
 * fuso del browser.
 */
export function formatHourRange(iso: string): string {
	const hour = Number(iso.slice(11, 13));
	if (isNaN(hour)) return '—';
	const pad = (h: number) => String(h % 24).padStart(2, '0');
	return `${pad(hour)}:00 - ${pad(hour + 1)}:00`;
}

// --- Scale delle altre metriche orarie ---
//
// Tutte restituiscono colori hex/rgba, non classi Tailwind: servono come `fill`
// negli SVG dei grafici. `getUvColor` qui sopra resta com'è per i consumer che
// la usano come classe di testo.

/**
 * Il backend espone il vento in m/s (`wind_speed`, `wind_gust`), ma le soglie e
 * le etichette sono tarate in km/h: ogni consumer converte con questo fattore.
 */
export const MS_TO_KMH = 3.6;

/**
 * Soglie di intensità del vento in km/h, semplificazione della scala Beaufort:
 * fino a 20 km/h è brezza (Beaufort ≤ 3), fino a 40 km/h vento teso (4-5),
 * oltre è vento forte (6+, rami che si muovono, ombrelli inutilizzabili).
 */
export const WIND_THRESHOLDS = {
	moderate: 20,
	strong: 40,
} as const;

export function getWindScale(kmh: number | null | undefined): { label: string; color: string } {
	if (kmh == null || isNaN(kmh)) return { label: '—', color: 'rgba(255,255,255,0.25)' };
	if (kmh >= WIND_THRESHOLDS.strong) return { label: 'Forte', color: '#EC685A' };
	if (kmh >= WIND_THRESHOLDS.moderate) return { label: 'Teso', color: '#3B82F6' };
	return { label: 'Debole', color: '#7FB3E8' };
}

/** Soglie OMS dell'indice UV: le stesse su cui è tarata `getUvLabel`. */
export const UV_THRESHOLDS = {
	moderate: 3,
	high: 6,
	veryHigh: 8,
	extreme: 11,
} as const;

export function getUvScale(uv: number | null | undefined): { label: string; color: string } {
	if (uv == null || isNaN(uv)) return { label: '—', color: 'rgba(255,255,255,0.25)' };
	if (uv >= UV_THRESHOLDS.extreme) return { label: 'Estremo', color: '#A855F7' };
	if (uv >= UV_THRESHOLDS.veryHigh) return { label: 'Molto alto', color: '#EF4444' };
	if (uv >= UV_THRESHOLDS.high) return { label: 'Alto', color: '#F97316' };
	if (uv >= UV_THRESHOLDS.moderate) return { label: 'Moderato', color: '#EAB308' };
	return { label: 'Basso', color: '#4ADE80' };
}

/** Colore per l'umidità relativa: dal secco ambrato all'afoso blu pieno. */
export function getHumidityColor(pct: number | null | undefined): string {
	if (pct == null || isNaN(pct)) return 'rgba(255,255,255,0.25)';
	if (pct >= 80) return '#3B82F6';
	if (pct >= 60) return '#60A5FA';
	if (pct >= 30) return '#7FB3E8';
	return '#FBBF24';
}

/** Colore per una temperatura in °C, dal freddo viola al caldo rosso. */
export function getTempColor(celsius: number | null | undefined): string {
	if (celsius == null || isNaN(celsius)) return 'rgba(255,255,255,0.25)';
	if (celsius >= 35) return '#DC2626';
	if (celsius >= 28) return '#F97316';
	if (celsius >= 20) return '#FBBF24';
	if (celsius >= 10) return '#4ADE80';
	if (celsius >= 0) return '#60A5FA';
	return '#A78BFA';
}

