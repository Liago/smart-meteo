'use client';

import { motion } from 'framer-motion';
import type { HourlyForecast, AstronomyData } from '@/lib/types';
import { useMemo } from 'react';
import WeatherIcon from './WeatherIcon';

interface HourlyForecastProps {
	hourly: HourlyForecast[];
	astronomy?: AstronomyData;
	mode?: 'next-12' | 'exact';
	title?: string;
	/** Se passata, ogni ora diventa cliccabile e apre il dettaglio precipitazioni. */
	onPrecipitationClick?: (isoTime: string) => void;
}

// Discriminator type for the items in our timeline
type TimelineItem =
	| { type: 'weather'; time: number; data: HourlyForecast }
	| { type: 'sun'; time: number; data: { label: string; icon: string } };

export default function HourlyForecast({ hourly, astronomy, mode = 'next-12', title = 'Andamento orario', onPrecipitationClick }: HourlyForecastProps) {
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

		// Get min/max temps for scaling Y-axis. Interpolate temp for 'sun' events
		// based on neighbors for a smoother curve interacting with sun markers.
		const weatherItems = filtered.filter(e => e.type === 'weather') as Array<{ type: 'weather', time: number, data: HourlyForecast }>;

		const getTempAtTime = (t: number) => {
			const before = weatherItems.filter(w => w.time <= t).pop();
			const after = weatherItems.find(w => w.time > t);
			if (!before && !after) return 0;
			if (!before) return after!.data.temp;
			if (!after) return before.data.temp;

			const ratio = (t - before.time) / (after.time - before.time);
			return before.data.temp + (after.data.temp - before.data.temp) * ratio;
		};

		const itemsWithTemp = filtered.map(item => {
			const temp = item.type === 'weather' ? item.data.temp : getTempAtTime(item.time);
			return { ...item, temp };
		});

		const temps = itemsWithTemp.map(i => i.temp);
		const minTemp = Math.min(...temps) - 2;
		const maxTemp = Math.max(...temps) + 2;
		const tempRange = maxTemp - minTemp || 1;

		const minSpacing = 76;
		const width = Math.max(filtered.length * minSpacing, 300);
		const height = 150;
		const paddingX = 24;
		const paddingTop = 24;
		const paddingBottom = 20;

		const points = itemsWithTemp.map((item, index) => {
			const x = paddingX + (index / Math.max(itemsWithTemp.length - 1, 1)) * (width - 2 * paddingX);
			const usableHeight = height - paddingTop - paddingBottom;
			const y = height - paddingBottom - ((item.temp - minTemp) / tempRange) * usableHeight;
			return { x, y, ...item };
		});

		// Smoothed path (simple midpoint cubic bezier)
		let pathD = `M ${points[0].x} ${points[0].y}`;
		for (let i = 0; i < points.length - 1; i++) {
			const curr = points[i];
			const next = points[i + 1];
			const midX = (curr.x + next.x) / 2;
			pathD += ` C ${midX} ${curr.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
		}
		const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

		return { width, height, points, pathD, areaD, gridY1: Math.round(height * 0.32), gridY2: Math.round(height * 0.68) };
	}, [hourly, astronomy, mode]);

	if (!chartData) return null;

	const formatHour = (iso: number) => {
		const d = new Date(iso);
		return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
	};

	return (
		<div className="glass p-6" style={{ color: 'var(--color-duet-ink)' }}>
			{title && (
				<h3 className="text-[13px] font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--color-duet-muted)' }}>{title}</h3>
			)}

			<div className="overflow-x-auto pb-1">
				<svg
					width={chartData.width}
					height={chartData.height}
					viewBox={`0 0 ${chartData.width} ${chartData.height}`}
					preserveAspectRatio="none"
					style={{ display: 'block', minWidth: '100%' }}
				>
					<line x1="0" y1={chartData.gridY1} x2={chartData.width} y2={chartData.gridY1} stroke="#eef2f6" strokeWidth="1" />
					<line x1="0" y1={chartData.gridY2} x2={chartData.width} y2={chartData.gridY2} stroke="#eef2f6" strokeWidth="1" />
					<path d={chartData.areaD} fill="var(--color-duet-accent-soft)" />
					<motion.path
						d={chartData.pathD}
						fill="none"
						stroke="var(--color-duet-accent)"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						initial={{ pathLength: 0, opacity: 0 }}
						animate={{ pathLength: 1, opacity: 1 }}
						transition={{ duration: 1.2, ease: 'easeInOut' }}
					/>
					{chartData.points.map((p, i) => (
						<circle
							key={i}
							cx={p.x}
							cy={p.y}
							r={p.type === 'sun' ? 4 : 3.5}
							fill={p.type === 'sun' ? '#f7b228' : '#fff'}
							stroke="var(--color-duet-accent)"
							strokeWidth="2"
						/>
					))}
				</svg>

				<div className="flex gap-0 pt-3.5 mt-1" style={{ borderTop: '1px solid var(--color-duet-border)', width: chartData.width }}>
					{chartData.points.map((p, i) => {
						const label = (
							<>
								{p.type === 'weather' ? (
									<WeatherIcon code={p.data.condition_code} className="w-5 h-5 mx-auto" />
								) : (
									<span className="text-[18px] leading-none">{p.data.label === 'Alba' ? '🌅' : '🌇'}</span>
								)}
								<span className="font-bold text-sm mt-1 block" style={{ color: 'var(--color-duet-ink)' }}>
									{p.type === 'weather' ? `${Math.round(p.temp)}°` : p.data.label}
								</span>
								<span className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>{formatHour(p.time)}</span>
								{p.type === 'weather' && p.data.precipitation_prob !== null && p.data.precipitation_prob > 0 && (
									<span className="inline-flex items-center gap-0.5 text-[11px] font-semibold mt-0.5" style={{ color: 'var(--color-duet-accent)' }}>
										{Math.round(p.data.precipitation_prob)}%
									</span>
								)}
							</>
						);

						if (!onPrecipitationClick || p.type !== 'weather') {
							return (
								<div key={i} className="flex-none flex flex-col items-center gap-0.5 text-center" style={{ width: 76 }}>
									{label}
								</div>
							);
						}

						return (
							<button
								key={i}
								type="button"
								onClick={() => onPrecipitationClick(p.data.time)}
								aria-label={`Dettaglio precipitazioni delle ${formatHour(p.time)}`}
								className="dt-row flex-none flex flex-col items-center gap-0.5 text-center rounded-lg py-1 transition-colors cursor-pointer"
								style={{ width: 76 }}
							>
								{label}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
