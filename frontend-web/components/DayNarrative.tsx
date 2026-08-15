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

const SECTION_HEADING = 'text-[13px] font-semibold mb-3 uppercase tracking-wide';
const SECTION_HEADING_STYLE = { color: 'var(--color-duet-muted)' };

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
			className="glass p-6"
			style={{ color: 'var(--color-duet-ink)' }}
			aria-label="Racconto della giornata"
		>
			<h3 className={SECTION_HEADING} style={SECTION_HEADING_STYLE}>La giornata</h3>

			<ul className="flex flex-col gap-4">
				{parts.map((part) => (
					<li key={part.id} className={`flex gap-3.5 items-start ${part.isPast ? 'opacity-50' : ''}`}>
						<span
							className="flex items-center justify-center w-[38px] h-[38px] shrink-0 rounded-lg text-xl"
							style={{ background: 'var(--color-duet-accent-soft)' }}
							aria-hidden="true"
						>
							{part.icon}
						</span>
						<div className="min-w-0 pt-0.5">
							<p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--color-duet-muted)' }}>{part.label}</p>
							<p className="text-sm leading-relaxed mt-0.5" style={{ color: 'var(--color-duet-ink-soft)' }}>{part.sentence}</p>
						</div>
					</li>
				))}
			</ul>

			{advice.length > 0 && (
				<div className="mt-5 pt-4.5" style={{ borderTop: '1px solid var(--color-duet-border)' }}>
					<h3 className={SECTION_HEADING} style={SECTION_HEADING_STYLE}>Consigli</h3>
					<ul className="flex flex-col gap-2">
						{advice.map((item) => (
							<li key={item.id} className="flex gap-3 items-start">
								<span className="text-base leading-6 shrink-0" aria-hidden="true">
									{item.icon}
								</span>
								<p
									className="text-sm leading-relaxed"
									style={{ color: item.severity === 'warning' ? 'var(--color-duet-ink-soft)' : 'var(--color-duet-muted)' }}
								>
									{item.text}
								</p>
							</li>
						))}
					</ul>
				</div>
			)}

			{tomorrow && (
				<div className="mt-5 pt-4.5" style={{ borderTop: '1px solid var(--color-duet-border)' }}>
					<h3 className={SECTION_HEADING} style={SECTION_HEADING_STYLE}>Domani</h3>
					<p className="text-sm leading-relaxed" style={{ color: 'var(--color-duet-ink-soft)' }}>{tomorrow}</p>
				</div>
			)}
		</motion.section>
	);
}
