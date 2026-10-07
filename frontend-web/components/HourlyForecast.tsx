'use client';

import { motion } from 'framer-motion';
import type { HourlyForecast, AstronomyData } from '@/lib/types';
import { useEffect, useId, useMemo, useState } from 'react';
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
	| { type: 'sun'; time: number; data: { label: string } };

/** Larghezza minima di una colonna: sotto, orario e percentuale si toccano. */
const MIN_COLUMN = 64;
/** Altezza della fascia del grafico, fra la riga delle icone e quella degli orari. */
const CHART_HEIGHT = 96;
const PAD_TOP = 10;
const PAD_BOTTOM = 8;

/**
 * Larghezza disponibile del contenitore.
 *
 * Le colonne si allargano fino a riempirlo invece di restare a larghezza fissa
 * con un vuoto a destra: con dodici ore su uno schermo largo il grafico deve
 * occupare la scheda, e scorrere solo quando davvero non ci sta.
 */
function useContainerWidth(el: HTMLElement | null): number {
	const [width, setWidth] = useState(0);
	useEffect(() => {
		if (!el) return;
		const measure = () => setWidth(el.clientWidth);
		measure();
		// jsdom non implementa ResizeObserver: la misura iniziale basta.
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [el]);
	return width;
}

/** Minuti dalla mezzanotte di un istante, nell'ora del browser. */
const minutesOfDay = (t: number) => {
	const d = new Date(t);
	return d.getHours() * 60 + d.getMinutes();
};

export default function HourlyForecast({ hourly, astronomy, mode = 'next-12', title = 'Andamento orario', onPrecipitationClick }: HourlyForecastProps) {
	// Ref a callback: il contenitore compare solo quando c'è un grafico da
	// disegnare, e un ref a oggetto non farebbe ripartire la misura.
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const containerWidth = useContainerWidth(container);
	const uid = useId().replace(/:/g, '');

	const items = useMemo(() => {
		const events: TimelineItem[] = hourly.map(h => ({
			type: 'weather',
			time: new Date(h.time).getTime(),
			data: h
		}));

		if (astronomy && hourly.length > 0) {
			const first = new Date(hourly[0].time).getTime();
			const last = new Date(hourly[hourly.length - 1].time).getTime();
			const addAstroEvent = (timeStr: string | undefined, label: string) => {
				if (!timeStr) return;
				const time = new Date(timeStr).getTime();
				if (time >= first - 3600000 && time <= last + 3600000) {
					events.push({ type: 'sun', time, data: { label } });
				}
			};
			addAstroEvent(astronomy.sunrise, 'Alba');
			addAstroEvent(astronomy.sunset, 'Tramonto');
		}

		events.sort((a, b) => a.time - b.time);

		if (mode === 'next-12') {
			const now = new Date();
			now.setMinutes(0, 0, 0);
			const start = now.getTime();
			const end = start + 12 * 3600 * 1000;
			return events.filter(e => e.time >= start && e.time <= end);
		}
		if (hourly.length > 0) {
			const start = new Date(hourly[0].time).getTime();
			const end = new Date(hourly[hourly.length - 1].time).getTime();
			return events.filter(e => e.time >= start && e.time <= end);
		}
		return events;
	}, [hourly, astronomy, mode]);

	const chart = useMemo(() => {
		if (items.length < 2) return null;

		const weatherItems = items.filter((e): e is Extract<TimelineItem, { type: 'weather' }> => e.type === 'weather');

		// Temperatura sui marcatori di alba e tramonto: interpolata dai vicini,
		// così la curva passa dal marcatore invece di fare un gradino.
		const interpolate = (t: number, pick: (h: HourlyForecast) => number | null | undefined): number | null => {
			const before = weatherItems.filter(w => w.time <= t && pick(w.data) != null).pop();
			const after = weatherItems.find(w => w.time > t && pick(w.data) != null);
			if (!before && !after) return null;
			if (!before) return pick(after!.data)!;
			if (!after) return pick(before.data)!;
			const ratio = (t - before.time) / (after.time - before.time);
			return pick(before.data)! + (pick(after.data)! - pick(before.data)!) * ratio;
		};

		const withTemp = items.map(item => ({
			...item,
			temp: item.type === 'weather' ? item.data.temp : interpolate(item.time, h => h.temp) ?? 0,
		}));

		// La scala verticale deve contenere anche la banda, altrimenti il 90°
		// percentile finirebbe fuori dal riquadro nelle ore più incerte.
		const temps = withTemp.map(i => i.temp);
		const bandValues = weatherItems.flatMap(w =>
			[w.data.temp_p10, w.data.temp_p90].filter((v): v is number => v != null)
		);
		const minTemp = Math.min(...temps, ...bandValues) - 1;
		const maxTemp = Math.max(...temps, ...bandValues) + 1;
		const range = maxTemp - minTemp || 1;

		const column = Math.max(MIN_COLUMN, containerWidth > 0 ? containerWidth / withTemp.length : MIN_COLUMN);
		const width = column * withTemp.length;
		const usable = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
		const yFor = (temp: number) => CHART_HEIGHT - PAD_BOTTOM - ((temp - minTemp) / range) * usable;

		const points = withTemp.map((item, index) => ({
			...item,
			x: column * index + column / 2,
			y: yFor(item.temp),
		}));

		const trace = (pts: { x: number; y: number }[], start: boolean) => {
			let d = start ? `M ${pts[0].x} ${pts[0].y}` : ` L ${pts[0].x} ${pts[0].y}`;
			for (let i = 0; i < pts.length - 1; i++) {
				const midX = (pts[i].x + pts[i + 1].x) / 2;
				d += ` C ${midX} ${pts[i].y}, ${midX} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
			}
			return d;
		};

		const pathD = trace(points, true);
		const areaD = `${pathD} L ${points[points.length - 1].x} ${CHART_HEIGHT} L ${points[0].x} ${CHART_HEIGHT} Z`;

		// Banda di incertezza: percorso chiuso che segue il 90° percentile
		// all'andata e il 10° al ritorno. Si disegna solo se TUTTI i punti hanno
		// la banda — un tratto interrotto suggerirebbe una certezza che non c'è
		// nelle ore scoperte dall'ensemble.
		const bandPoints = points.map((p) => {
			const low = p.type === 'weather' ? p.data.temp_p10 ?? null : interpolate(p.time, h => h.temp_p10);
			const high = p.type === 'weather' ? p.data.temp_p90 ?? null : interpolate(p.time, h => h.temp_p90);
			return low != null && high != null ? { x: p.x, low, high } : null;
		});
		let bandD: string | null = null;
		const covered = bandPoints.filter((b): b is { x: number; low: number; high: number } => b !== null);
		if (covered.length >= 2 && covered.length === bandPoints.length) {
			const upper = covered.map((b) => ({ x: b.x, y: yFor(b.high) }));
			const lower = [...covered].reverse().map((b) => ({ x: b.x, y: yFor(b.low) }));
			bandD = `${trace(upper, true)}${trace(lower, false)} Z`;
		}

		return { width, column, points, pathD, areaD, bandD };
	}, [items, containerWidth]);

	const formatHour = (t: number) =>
		new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

	/*
	  Notte: fra il tramonto e l'alba, confrontati sull'ora del giorno. Le
	  previsioni coprono al massimo mezza giornata in avanti, quindi gli orari
	  di oggi bastano anche per le ore di domattina.
	*/
	const sunrise = astronomy?.sunrise ? minutesOfDay(new Date(astronomy.sunrise).getTime()) : null;
	const sunset = astronomy?.sunset ? minutesOfDay(new Date(astronomy.sunset).getTime()) : null;
	const isNight = (t: number) => {
		if (sunrise == null || sunset == null) return false;
		const m = minutesOfDay(t);
		return m < sunrise || m >= sunset;
	};

	if (!chart) return null;

	return (
		<section className="glass p-5" style={{ color: 'var(--color-duet-ink)' }} aria-label={title || 'Andamento orario'}>
			{title && <h3 className="card-label mb-3">{title}</h3>}

			<div ref={setContainer} className="overflow-x-auto pb-1 [scrollbar-width:thin]">
				<div className="relative" style={{ width: chart.width }}>
					{/* Grafico dietro le colonne: le colonne restano cliccabili per intero */}
					<svg
						width={chart.width}
						height={CHART_HEIGHT}
						viewBox={`0 0 ${chart.width} ${CHART_HEIGHT}`}
						className="pointer-events-none absolute left-0"
						style={{ top: 38 }}
						aria-hidden="true"
					>
						<defs>
							<linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
								<stop offset="100%" stopColor="#3b82f6" stopOpacity="0.04" />
							</linearGradient>
							<filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
								<feGaussianBlur stdDeviation="2.5" result="blur" />
								<feMerge>
									<feMergeNode in="blur" />
									<feMergeNode in="SourceGraphic" />
								</feMerge>
							</filter>
						</defs>
						<path d={chart.areaD} fill={`url(#area-${uid})`} />
						{/* Banda 10°-90° percentile fra i membri dell'ensemble: quanto la
						    previsione è incerta, non solo quale valore è più probabile. */}
						{chart.bandD && (
							<path d={chart.bandD} fill="#93c5fd" opacity={0.18} aria-hidden="true" />
						)}
						<motion.path
							d={chart.pathD}
							fill="none"
							stroke="#60a5fa"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							initial={{ pathLength: 0, opacity: 0 }}
							animate={{ pathLength: 1, opacity: 1 }}
							transition={{ duration: 1.2, ease: 'easeInOut' }}
						/>
						{chart.points.map((p, i) => (
							<circle
								key={i}
								cx={p.x}
								cy={p.y}
								r={4}
								fill={p.type === 'sun' ? '#fbbf24' : '#dbeafe'}
								stroke={p.type === 'sun' ? '#fde68a' : '#60a5fa'}
								strokeWidth="1.5"
								filter={`url(#glow-${uid})`}
							>
								<title>{`${formatHour(p.time)} · ${Math.round(p.temp)}°`}</title>
							</circle>
						))}
					</svg>

					<div className="relative flex">
						{chart.points.map((p, i) => {
							const content = (
								<>
									<span className="flex h-7 items-center justify-center" style={{ color: 'var(--color-duet-ink-soft)' }}>
										{p.type === 'weather' ? (
											<WeatherIcon code={p.data.condition_code} isNight={isNight(p.time)} className="h-5 w-5" />
										) : (
											<span className="text-[18px] leading-none" aria-hidden="true">{p.data.label === 'Alba' ? '🌅' : '🌇'}</span>
										)}
									</span>
									<span style={{ height: CHART_HEIGHT + 8 }} aria-hidden="true" />
									<span className="w-full pt-2.5 text-sm font-semibold tabular-nums" style={{ borderTop: '1px solid var(--color-duet-border)', color: 'var(--color-duet-ink)' }}>
										{formatHour(p.time)}
									</span>
									{p.type === 'weather' ? (
										<span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--color-duet-accent-ink)' }}>
											{p.data.precipitation_prob != null ? `${Math.round(p.data.precipitation_prob)}%` : '–'}
										</span>
									) : (
										<span className="text-[13px] font-semibold" style={{ color: 'var(--color-duet-amber-ink)' }}>{p.data.label}</span>
									)}
								</>
							);

							const temp = `${Math.round(p.temp)}°`;

							if (!onPrecipitationClick || p.type !== 'weather') {
								return (
									<div
										key={i}
										className="flex flex-none flex-col items-center gap-0.5 py-1 text-center"
										style={{ width: chart.column }}
										title={p.type === 'weather' ? `${formatHour(p.time)} · ${temp}` : undefined}
									>
										{content}
									</div>
								);
							}

							return (
								<button
									key={i}
									type="button"
									onClick={() => onPrecipitationClick(p.data.time)}
									aria-label={`Dettaglio precipitazioni delle ${formatHour(p.time)}, ${temp}`}
									title={`${formatHour(p.time)} · ${temp}`}
									className="dt-row flex flex-none cursor-pointer flex-col items-center gap-0.5 py-1 text-center"
									style={{ width: chart.column }}
								>
									{content}
								</button>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}
