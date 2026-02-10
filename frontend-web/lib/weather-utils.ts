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
	clear: 'from-blue-400 via-indigo-500 to-purple-600',       // More vibrant, less generic blue
	cloudy: 'from-blue-gray-400 via-slate-500 to-gray-600',    // Deeper contrast
	rain: 'from-slate-700 via-blue-900 to-slate-900',          // Moody and dark
	snow: 'from-sky-100 via-blue-200 to-indigo-200',           // Crisp and cold
	storm: 'from-gray-900 via-purple-950 to-black',            // Dramatic
	fog: 'from-zinc-300 via-slate-400 to-zinc-500',            // Authentic fog color
	unknown: 'from-zinc-600 via-stone-700 to-neutral-800',
};

// WMO Weather Codes to text/icon mapping
// Source: https://open-meteo.com/en/docs
export function getWMOWeatherInfo(code: string | number): { label: string; icon: string } {
	const c = Number(code);

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
