'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { AstronomyData, DailyForecast, ForecastCurrent, HourlyForecast } from '@/lib/types';
import { buildDayNarrative } from '@/lib/narrative';
import WeatherIcon from './WeatherIcon';

interface DayNarrativeProps {
	current: ForecastCurrent;
	hourly?: HourlyForecast[];
	daily?: DailyForecast[];
	astronomy?: AstronomyData;
}

/**
 * Racconto discorsivo della giornata, in due schede affiancate: «La giornata»
 * e «Domani». Tutta la logica sta in `lib/narrative.ts`: qui si renderizza
 * soltanto. Se i dati non bastano a raccontare nulla il motore restituisce
 * `null` e le schede spariscono, senza placeholder.
 *
 * Le fasce già trascorse non si mostrano: alle dieci di sera «Mattina:
 * sereno» è cronaca, non previsione, e la scheda deve rispondere a «cosa mi
 * aspetta». Se fossero tutte passate — succede solo a ridosso di mezzanotte —
 * resta l'ultima, perché una scheda vuota direbbe che non c'è nulla da sapere.
 */
export default function DayNarrative({ current, hourly, daily, astronomy }: DayNarrativeProps) {
	const narrative = useMemo(
		() => buildDayNarrative({ current, hourly, daily, astronomy }),
		[current, hourly, daily, astronomy]
	);

	if (!narrative) return null;

	const { parts, advice, tomorrow, tomorrowCode } = narrative;
	const upcoming = parts.filter((p) => !p.isPast);
	const visible = upcoming.length > 0 ? upcoming : parts.slice(-1);

	return (
		<div className={`grid grid-cols-1 gap-5 ${tomorrow ? 'md:grid-cols-2' : ''}`}>
			<motion.section
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.6, delay: 0.1 }}
				className="glass p-5"
				style={{ color: 'var(--color-duet-ink)' }}
				aria-label="Racconto della giornata"
			>
				<h3 className="card-label mb-3">La giornata</h3>

				<ul className="flex flex-col gap-3.5">
					{visible.map((part) => (
						<li key={part.id} className="flex items-start gap-3">
							<span className="icon-chip h-[38px] w-[38px] shrink-0 text-xl" aria-hidden="true">
								{part.icon}
							</span>
							<div className="min-w-0">
								<p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-duet-amber-ink)' }}>
									{part.label}
								</p>
								<p className="mt-0.5 text-sm leading-relaxed" style={{ color: 'var(--color-duet-ink-soft)' }}>
									{part.sentence}
								</p>
							</div>
						</li>
					))}
				</ul>

				{advice.length > 0 && (
					<div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-duet-border)' }}>
						<h3 className="card-label mb-2.5">Consigli</h3>
						<ul className="flex flex-col gap-2">
							{advice.map((item) => (
								<li key={item.id} className="flex items-start gap-3">
									<span className="shrink-0 text-base leading-6" aria-hidden="true">
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
			</motion.section>

			{tomorrow && (
				<motion.section
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.15 }}
					className="glass p-5"
					style={{ color: 'var(--color-duet-ink)' }}
					aria-label="Domani"
				>
					<h3 className="card-label mb-3">Domani</h3>
					<div className="flex items-center gap-3">
						<span className="icon-chip h-[38px] w-[38px] shrink-0" aria-hidden="true">
							<WeatherIcon
								code={tomorrowCode ?? undefined}
								className="h-5 w-5"
								style={{ color: 'var(--color-duet-ink-soft)' }}
							/>
						</span>
						<p className="text-sm leading-relaxed" style={{ color: 'var(--color-duet-ink-soft)' }}>{tomorrow}</p>
					</div>
				</motion.section>
			)}
		</div>
	);
}
