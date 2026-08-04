'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { AstronomyData, DailyForecast, ForecastCurrent, HourlyForecast } from '@/lib/types';
import { buildDayNarrative } from '@/lib/narrative';

interface DayNarrativeProps {
	current: ForecastCurrent;
	hourly?: HourlyForecast[];
	daily?: DailyForecast[];
	astronomy?: AstronomyData;
}

const SECTION_HEADING = 'text-sm font-medium text-white/50 mb-3 uppercase tracking-wider';

/**
 * Racconto discorsivo della giornata. Tutta la logica sta in `lib/narrative.ts`:
 * qui si renderizza soltanto. Se i dati non bastano a raccontare nulla il
 * motore restituisce `null` e la card sparisce, senza placeholder.
 */
export default function DayNarrative({ current, hourly, daily, astronomy }: DayNarrativeProps) {
	const narrative = useMemo(
		() => buildDayNarrative({ current, hourly, daily, astronomy }),
		[current, hourly, daily, astronomy]
	);

	if (!narrative) return null;

	const { parts, advice, tomorrow } = narrative;

	return (
		<motion.section
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6, delay: 0.1 }}
			className="glass p-4 sm:p-6 text-white"
			aria-label="Racconto della giornata"
		>
			<h3 className={SECTION_HEADING}>La giornata</h3>

			<ul className="space-y-3">
				{parts.map((part) => (
					<li key={part.id} className={`flex gap-3 ${part.isPast ? 'opacity-50' : ''}`}>
						<span className="text-xl leading-6 shrink-0" aria-hidden="true">
							{part.icon}
						</span>
						<div className="min-w-0">
							<p className="text-xs text-white/50 uppercase tracking-wide">{part.label}</p>
							<p className="text-sm text-white/70 leading-relaxed">{part.sentence}</p>
						</div>
					</li>
				))}
			</ul>

			{advice.length > 0 && (
				<div className="mt-5 pt-4 border-t border-white/10">
					<h3 className={SECTION_HEADING}>Consigli</h3>
					<ul className="space-y-2">
						{advice.map((item) => (
							<li key={item.id} className="flex gap-3">
								<span className="text-base leading-6 shrink-0" aria-hidden="true">
									{item.icon}
								</span>
								<p
									className={`text-sm leading-relaxed ${
										item.severity === 'warning' ? 'text-white/80' : 'text-white/60'
									}`}
								>
									{item.text}
								</p>
							</li>
						))}
					</ul>
				</div>
			)}

			{tomorrow && (
				<div className="mt-5 pt-4 border-t border-white/10">
					<h3 className={SECTION_HEADING}>Domani</h3>
					<p className="text-sm text-white/70 leading-relaxed">{tomorrow}</p>
				</div>
			)}
		</motion.section>
	);
}
