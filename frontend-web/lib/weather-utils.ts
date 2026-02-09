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
