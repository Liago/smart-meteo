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
  clear: 'from-sky-400 via-blue-500 to-indigo-600',
  cloudy: 'from-slate-400 via-gray-500 to-slate-600',
  rain: 'from-slate-600 via-blue-700 to-gray-800',
  snow: 'from-blue-100 via-slate-200 to-blue-300',
  storm: 'from-gray-800 via-slate-900 to-black',
  fog: 'from-gray-300 via-slate-400 to-gray-500',
  unknown: 'from-slate-500 via-gray-600 to-slate-700',
};
