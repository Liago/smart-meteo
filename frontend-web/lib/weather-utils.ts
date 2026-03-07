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

