'use client';

import { motion } from 'framer-motion';
import type { HourlyForecast, AstronomyData, ForecastCurrent } from '@/lib/types';
import { useMemo } from 'react';
import WeatherIcon from './WeatherIcon';
import SunWindCard from './SunWindCard';

interface HourlyForecastProps {
	hourly: HourlyForecast[];
	astronomy?: AstronomyData;
	mode?: 'next-12' | 'exact';
	title?: string;
	current?: ForecastCurrent;
}

// Discriminator type for the items in our timeline
type TimelineItem =
	| { type: 'weather'; time: number; data: HourlyForecast }
	| { type: 'sun'; time: number; data: { label: string; icon: string } };

export default function HourlyForecast({ hourly, astronomy, mode = 'next-12', title = 'Prossime 12 Ore', current }: HourlyForecastProps) {
	const chartData = useMemo(() => {
		// 1. Merge and sort events
		const events: TimelineItem[] = hourly.map(h => ({
			type: 'weather',
			time: new Date(h.time).getTime(),
			data: h
		}));

		if (astronomy) {
			const addAstroEvent = (timeStr: string | undefined, label: string, icon: string) => {
				if (!timeStr) return;
				const time = new Date(timeStr).getTime();
				// Only add if it's within the range of our hourly data (with some buffer)
				if (hourly.length > 0) {
					const first = new Date(hourly[0].time).getTime();
					const last = new Date(hourly[hourly.length - 1].time).getTime();
					if (time >= first - 3600000 && time <= last + 3600000) {
						events.push({
							type: 'sun',
							time,
							data: { label, icon }
						});
					}
				}
			};

			addAstroEvent(astronomy.sunrise, 'Alba', 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z');
			addAstroEvent(astronomy.sunset, 'Tramonto', 'M17.293 13.293A8 8 0 016.707 2.707 8.001 8.001 0 1010 18h.005c.022 0 .045-.002.067-.006a8 8 0 007.221-4.701z');
		}

		events.sort((a, b) => a.time - b.time);

		// 2. Prepare data for the chart
		let filtered = events;

		if (mode === 'next-12') {
			// Filter for next 12 hours approx
			const now = new Date();
			now.setMinutes(0, 0, 0);
			const start = now.getTime();
			const end = start + 12 * 3600 * 1000; // 12 hours
			filtered = events.filter(e => e.time >= start && e.time <= end);
		} else {
			// Exact mode: show all provided data within the start/end of the hourly array
			// ensuring we respect the provided hourly range
			if (hourly.length > 0) {
				const start = new Date(hourly[0].time).getTime();
				const end = new Date(hourly[hourly.length - 1].time).getTime();
				filtered = events.filter(e => e.time >= start && e.time <= end);
			}
		}

		// 3. Calculate Geometry
		if (filtered.length < 2) return null;

		const minTime = filtered[0].time;
		const maxTime = filtered[filtered.length - 1].time;
		const duration = maxTime - minTime;

		// Get min/max temps for scaling Y-axis
		// Interpolate temp for 'sun' events based on neighbors? 
		// For simplicity, we can ignore 'sun' events for the curve geometry (or interpolate).
		// Let's interpolate for smoother curve interacting with sun markers.
		const weatherItems = filtered.filter(e => e.type === 'weather') as Array<{ type: 'weather', time: number, data: HourlyForecast }>;

		const getTempAtTime = (t: number) => {
			// Find closest before and after
			const before = weatherItems.filter(w => w.time <= t).pop();
			const after = weatherItems.find(w => w.time > t);
			if (!before && !after) return 0;
			if (!before) return after!.data.temp;
			if (!after) return before.data.temp;

			// Linear interpolation
			const ratio = (t - before.time) / (after.time - before.time);
			return before.data.temp + (after.data.temp - before.data.temp) * ratio;
		};

		const itemsWithTemp = filtered.map(item => {
			const temp = item.type === 'weather' ? item.data.temp : getTempAtTime(item.time);
			return { ...item, temp };
		});

		const temps = itemsWithTemp.map(i => i.temp);
		const minTemp = Math.min(...temps) - 2; // Buffer
		const maxTemp = Math.max(...temps) + 2;
		const tempRange = maxTemp - minTemp || 1;

		const width = filtered.length * 80; // Estimated width
		const height = 200; // Increased to fit icons
		const paddingX = 40;
		const paddingTop = 80;  // Space for icons
		const paddingBottom = 40; // Space for labels

		const points = itemsWithTemp.map((item, index) => {
			// X coordinate based on time linear placement, but let's just do equidistant steps if it's hourly?
			// Actually mix of hourly and specific sun times requires time-based mapping.
			const x = paddingX + ((item.time - minTime) / duration) * (width - 2 * paddingX);
			// Y coordinate: higher temp -> lower Y value (SVG coords)
			// const y = height - paddingY - ((item.temp - minTemp) / tempRange) * (height - 2 * paddingY);
			const usableHeight = height - paddingTop - paddingBottom;
			const y = height - paddingBottom - ((item.temp - minTemp) / tempRange) * usableHeight;

			return { x, y, ...item };
		});

		// Create smooth path (Cubic Bezier)
		// Simple smoothing: control points based on neighbors
		let pathD = `M ${points[0].x} ${points[0].y}`;
		for (let i = 0; i < points.length - 1; i++) {
			const curr = points[i];
			const next = points[i + 1];

			// Control points
			// Simple fallback: straight lines for now to ensure correctness, can enhance to curves.
			// Let's try simple catmull-rom to cubic bezier conversion or just simple mid-points.
			// Standard smoothing:
			// const cp1x = curr.x + (next.x - curr.x) / 3;
			// const cp1y = curr.y; // horizontal tension? No, temp varies.

			// Let's use simple Q (Quadratic) or C (Cubic) with tension.
			// For simplicity and "sinusoidal" look, accurate catmull-rom is best, but here's a simple approx:
			const midX = (curr.x + next.x) / 2;
			pathD += ` C ${midX} ${curr.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
		}

		return { width, height, points, pathD };
	}, [hourly, astronomy]);

	if (!chartData) return null;

	const formatHour = (iso: number) => {
		const d = new Date(iso);
		return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
	};



	return (
		<div className="glass p-4 sm:p-6 mb-4 overflow-hidden">
			{title && <h3 className="text-sm font-medium text-white/50 mb-2 uppercase tracking-wider">{title}</h3>}

			<div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
				<div style={{ width: chartData.width, height: chartData.height + 20, position: 'relative' }}>
					<svg width={chartData.width} height={chartData.height} className="overflow-visible">
						{/* Defs for gradients */}
						<defs>
							<linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="rgba(255, 255, 255, 0.5)" />
								<stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
							</linearGradient>
						</defs>

						{/* The curve path */}
						<motion.path
							d={chartData.pathD}
							fill="none"
							stroke="rgba(255, 255, 255, 0.4)"
							strokeWidth="3"
							initial={{ pathLength: 0, opacity: 0 }}
							animate={{ pathLength: 1, opacity: 1 }}
							transition={{ duration: 1.5, ease: "easeInOut" }}
						/>

						{/* Area under curve (optional, tricky with bezier, skip for cleaner look) */}

						{/* Points and Info */}
						{chartData.points.map((p, i) => (
							<g key={i}>
								{/* Dot on line */}
								<motion.circle
									cx={p.x}
									cy={p.y}
									r={4}
									fill={p.type === 'sun' ? '#FCD34D' : 'white'}
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									transition={{ delay: 0.5 + i * 0.05 }}
								/>

								{/* Info Group */}
								<foreignObject x={p.x - 30} y={p.y - 80} width={60} height={70}>
									<div className="flex flex-col items-center justify-end h-full">
										{p.type === 'weather' ? (
											<>
												<div className="mb-1 drop-shadow-md">
													<WeatherIcon code={p.data.condition_code} className="w-8 h-8 text-white" />
												</div>
												<span className="text-sm font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
													{Math.round(p.temp)}°
												</span>
											</>
										) : (
											<div className="flex flex-col items-center gap-1">
												<span className="text-yellow-400 font-bold text-xs uppercase tracking-tighter shadow-black drop-shadow-sm">
													{p.data.label}
												</span>
												<svg className="w-5 h-5 text-yellow-400 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={p.data.icon} />
												</svg>
											</div>
										)}
									</div>
								</foreignObject>

								{/* Time and Precip below line */}
								<foreignObject x={p.x - 25} y={p.y + 15} width={50} height={60}>
									<div className="flex flex-col items-center justify-start h-full pt-1">
										<span className={`text-xs ${p.type === 'sun' ? 'text-yellow-200' : 'text-white/50'}`}>
											{formatHour(p.time)}
										</span>
										{p.type === 'weather' && p.data.precipitation_prob !== null && p.data.precipitation_prob > 0 && (
											<span className="text-[10px] text-blue-300 font-medium mt-1">
												{Math.round(p.data.precipitation_prob)}%
											</span>
										)}
									</div>
								</foreignObject>
							</g>
						))}
					</svg>
				</div>
			</div>

			{/* Weather Details Section */}
			{current && (
				<div className="mt-6 space-y-4 pt-4 border-t border-white/10">
					{/* Precipitation bar */}
					<div>
						<div className="flex justify-between text-sm mb-1.5">
							<span className="text-white/60">Probabilita precipitazione (Oggi)</span>
							<span className="font-medium text-white">{Math.round(current.precipitation_prob)}%</span>
						</div>
						<div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
							<motion.div
								initial={{ width: 0 }}
								animate={{ width: `${current.precipitation_prob}%` }}
								transition={{ duration: 0.6, delay: 0.1 }}
								className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
							/>
						</div>
					</div>

					{/* Humidity bar */}
					<div>
						<div className="flex justify-between text-sm mb-1.5">
							<span className="text-white/60">Umidita</span>
							<span className="font-medium text-white">{current.humidity !== null ? `${Math.round(current.humidity)}%` : '--'}</span>
						</div>
						<div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
							<motion.div
								initial={{ width: 0 }}
								animate={{ width: `${current.humidity ?? 0}%` }}
								transition={{ duration: 0.6, delay: 0.2 }}
								className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500"
							/>
						</div>
					</div>

					{/* Sun & Wind Card */}
					<div className="py-2">
						<SunWindCard astronomy={astronomy} current={current} />
					</div>

					{/* Temperature detail */}
					<div className="flex items-center justify-between py-2 border-t border-white/10">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
								<svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<div>
								<div className="text-sm font-medium text-white">Temperatura (Oggi)</div>
								<div className="text-xs text-white/50">Effettiva vs percepita</div>
							</div>
						</div>
						<div className="text-right">
							<div className="font-semibold text-white">
								{current.temperature !== null ? `${current.temperature}°C` : '--'}
							</div>
							<div className="text-xs text-white/50">
								Percepita {current.feels_like !== null ? `${current.feels_like}°C` : '--'}
							</div>
						</div>
					</div>
				</div>
			)}

		</div>
	);
}
