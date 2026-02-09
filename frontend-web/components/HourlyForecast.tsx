'use client';

import { motion } from 'framer-motion';
import type { HourlyForecast, AstronomyData } from '@/lib/types';
import { useMemo } from 'react';

interface HourlyForecastProps {
	hourly: HourlyForecast[];
	astronomy?: AstronomyData;
}

// Discriminator type for the items in our timeline
type TimelineItem =
	| { type: 'weather'; time: number; data: HourlyForecast }
	| { type: 'sun'; time: number; data: { label: string; icon: string } };

export default function HourlyForecast({ hourly, astronomy }: HourlyForecastProps) {
	const mergedTimeline = useMemo(() => {
		// Create a merged list of events (hourly + astronomy)
		const events: TimelineItem[] = hourly.map(h => ({
			type: 'weather',
			time: new Date(h.time).getTime(),
			data: h
		}));

		if (astronomy) {
			if (astronomy.sunrise) {
				const sunriseTime = new Date(astronomy.sunrise).getTime();
				events.push({
					type: 'sun',
					time: sunriseTime,
					data: { label: 'Alba', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' }
				});
			}
			if (astronomy.sunset) {
				const sunsetTime = new Date(astronomy.sunset).getTime();
				events.push({
					type: 'sun',
					time: sunsetTime,
					data: { label: 'Tramonto', icon: 'M17.293 13.293A8 8 0 016.707 2.707 8.001 8.001 0 1010 18h.005c.022 0 .045-.002.067-.006a8 8 0 007.221-4.701z' }
				});
			}
		}

		// Sort by time
		const sorted = events.sort((a, b) => a.time - b.time);

		// Filter to only show relevant range (e.g., from first hourly to last hourly + buffer)
		if (hourly.length > 0) {
			const start = new Date(hourly[0].time).getTime();
			const end = new Date(hourly[hourly.length - 1].time).getTime();
			return sorted.filter(e => e.time >= start - 3600000 && e.time <= end + 3600000);
		}
		return sorted;
	}, [hourly, astronomy]);

	const formatHour = (iso: string | number) => {
		const d = new Date(iso);
		return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
	};

	const getWeatherIcon = (code: string) => {
		const c = parseInt(code);
		if (c === 0) return '☀️';
		if (c >= 1 && c <= 3) return '⛅';
		if (c >= 45 && c <= 48) return '🌫️';
		if (c >= 51 && c <= 67) return '🌧️';
		if (c >= 71 && c <= 77) return '❄️';
		if (c >= 95) return '⛈️';
		return '❓';
	};

	return (
		<div className="glass p-4 sm:p-6 mb-4">
			<h3 className="text-sm font-medium text-white/50 mb-4 uppercase tracking-wider">Prossime 12 Ore</h3>

			<div className="flex overflow-x-auto pb-4 gap-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
				{mergedTimeline.map((item, i) => (
					<motion.div
						key={`${item.type}-${item.time}-${i}`}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.3, delay: i * 0.05 }}
						className={`flex flex-col items-center min-w-[70px] ${item.type === 'sun' ? 'justify-end pb-1' : ''}`}
					>
						<span className="text-xs text-white/50 mb-2">{formatHour(item.time)}</span>

						{item.type === 'weather' ? (
							<div className="flex flex-col items-center gap-1">
								<span className="text-2xl" role="img" aria-label="weather">
									{getWeatherIcon(item.data.condition_code)}
								</span>
								<span className="font-bold text-lg mt-1">{Math.round(item.data.temp)}°</span>
								{item.data.precipitation_prob !== null && item.data.precipitation_prob > 0 && (
									<span className="text-xs text-blue-300">
										{Math.round(item.data.precipitation_prob)}%
									</span>
								)}
							</div>
						) : (
							<div className="flex flex-col items-center gap-1 text-yellow-400">
								<span className="text-xs font-medium whitespace-nowrap mb-1">{item.data.label}</span>
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.data.icon} />
								</svg>
								{item.data.label === 'Tramonto' && (
									<div className="absolute opacity-0">Targetting Sunset</div>
								)}
							</div>
						)}
					</motion.div>
				))}
			</div>
		</div>
	);
}
