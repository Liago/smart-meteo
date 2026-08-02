'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { HourlyForecast, DailyForecast } from '@/lib/types';
import {
	getPrecipIntensity,
	formatPrecipMm,
	formatHourRange,
	getWMOWeatherInfo,
	PRECIP_THRESHOLDS,
} from '@/lib/weather-utils';

interface PrecipitationDetailProps {
	hourly: HourlyForecast[];
	daily?: DailyForecast[];
	initialDate?: string;
}

const HOURS_IN_DAY = 24;

/** Slot orario del giorno selezionato. `undefined` = ora non coperta da nessuna fonte. */
interface HourSlot {
	hour: number;
	mm?: number | null;
	prob?: number | null;
	condition_code?: string;
	time?: string;
}

export default function PrecipitationDetail({ hourly, daily, initialDate }: PrecipitationDetailProps) {
	// Giorni disponibili: dal daily se c'è, altrimenti dedotti dagli orari.
	const days = useMemo(() => {
		const fromDaily = daily?.map((d) => d.date.slice(0, 10)) ?? [];
		const fromHourly = hourly.map((h) => h.time.slice(0, 10));
		const unique = Array.from(new Set([...fromDaily, ...fromHourly])).sort();
		return unique.slice(0, 7);
	}, [daily, hourly]);

	// Un giorno senza righe orarie non è selezionabile: non avrebbe nulla da mostrare.
	const daysWithHours = useMemo(() => {
		const set = new Set(hourly.map((h) => h.time.slice(0, 10)));
		return set;
	}, [hourly]);

	const [selectedDate, setSelectedDate] = useState(() => {
		if (initialDate && daysWithHours.has(initialDate)) return initialDate;
		return days.find((d) => daysWithHours.has(d)) ?? days[0] ?? '';
	});

	// Griglia fissa di 24 slot: l'asse resta completo anche con copertura parziale.
	const slots = useMemo<HourSlot[]>(() => {
		const base: HourSlot[] = Array.from({ length: HOURS_IN_DAY }, (_, hour) => ({ hour }));
		hourly
			.filter((h) => h.time.startsWith(selectedDate))
			.forEach((h) => {
				const hour = Number(h.time.slice(11, 13));
				if (isNaN(hour) || hour < 0 || hour >= HOURS_IN_DAY) return;
				base[hour] = {
					hour,
					mm: h.precipitation_mm,
					prob: h.precipitation_prob,
					condition_code: h.condition_code,
					time: h.time,
				};
			});
		return base;
	}, [hourly, selectedDate]);

	const hasAnyHour = slots.some((s) => s.time !== undefined);
	const mmValues = slots.map((s) => s.mm).filter((v): v is number => v != null);
	// Il backend omette la chiave quando nessuna fonte l'ha fornita (cache vecchia,
	// fonti senza mm): in quel caso il grafico dei mm non va proprio disegnato.
	const hasMmData = mmValues.length > 0;
	const isAllDry = hasMmData && mmValues.every((v) => v === 0);

	// Ora attiva: quella corrente se il giorno è oggi, altrimenti la più piovosa.
	const defaultIndex = useMemo(() => {
		const today = new Date();
		const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
		if (selectedDate === todayKey) return today.getHours();
		if (hasMmData && !isAllDry) {
			let best = 0;
			let bestVal = -1;
			slots.forEach((s, i) => {
				if ((s.mm ?? -1) > bestVal) { bestVal = s.mm ?? -1; best = i; }
			});
			return best;
		}
		const firstCovered = slots.findIndex((s) => s.time !== undefined);
		return firstCovered === -1 ? 12 : firstCovered;
	}, [selectedDate, slots, hasMmData, isAllDry]);

	// Cambiando giorno l'ora selezionata torna al default: è un aggiustamento di
	// stato in fase di render, non un effect (evita il render extra).
	const [activeIndex, setActiveIndex] = useState(defaultIndex);
	const [lastDefault, setLastDefault] = useState(defaultIndex);
	if (lastDefault !== defaultIndex) {
		setLastDefault(defaultIndex);
		setActiveIndex(defaultIndex);
	}

	const active = slots[activeIndex];
	const activeIntensity = getPrecipIntensity(active?.mm);

	const dateLabel = useMemo(() => {
		if (!selectedDate) return '';
		const [y, m, d] = selectedDate.split('-').map(Number);
		const label = new Date(y, (m ?? 1) - 1, d).toLocaleDateString('it-IT', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		});
		return label.charAt(0).toUpperCase() + label.slice(1);
	}, [selectedDate]);

	return (
		<div>
			{/* Strip giorni */}
			<div className="flex justify-between gap-1 mb-3">
				{days.map((date) => {
					const [y, m, d] = date.split('-').map(Number);
					const dt = new Date(y, (m ?? 1) - 1, d);
					const isSelected = date === selectedDate;
					const enabled = daysWithHours.has(date);
					return (
						<button
							key={date}
							type="button"
							disabled={!enabled}
							aria-pressed={isSelected}
							onClick={() => setSelectedDate(date)}
							className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-full transition-colors ${
								isSelected ? 'bg-white/20' : enabled ? 'hover:bg-white/10' : 'opacity-40 cursor-not-allowed'
							}`}
						>
							<span className="text-[10px] uppercase text-white/60">
								{dt.toLocaleDateString('it-IT', { weekday: 'narrow' })}
							</span>
							<span className={`text-sm ${isSelected ? 'text-white font-semibold' : 'text-white/80'}`}>
								{dt.getDate()}
							</span>
						</button>
					);
				})}
			</div>

			<p className="text-center text-sm text-white/70 mb-4">{dateLabel}</p>

			{!hasAnyHour ? (
				<p className="text-center text-sm text-white/50 py-8">
					Dati orari non disponibili per questa data
				</p>
			) : (
				<>
					{/* Grafico quantità in mm */}
					{hasMmData ? (
						<section className="mb-6">
							<header className="text-center mb-1">
								<p className="text-xs text-white/60">{active?.time ? formatHourRange(active.time) : '—'}</p>
								<p className="text-3xl font-light text-white leading-tight">
									{active?.time === undefined
										? 'Dato non disponibile'
										: activeIntensity.level === 'none'
											? formatPrecipMm(active?.mm)
											: activeIntensity.label}
								</p>
								<p className="text-xs text-white/50">
									{active?.condition_code
										? getWMOWeatherInfo(active.condition_code).label
										: ''}
									{activeIntensity.level !== 'none' && active?.mm != null
										? ` · ${formatPrecipMm(active.mm)}`
										: ''}
								</p>
							</header>
							<div className="relative">
								<BarChart
									slots={slots}
									activeIndex={activeIndex}
									onActiveIndexChange={setActiveIndex}
									height={150}
									yMax={Math.max(PRECIP_THRESHOLDS.heavy * 1.25, ...mmValues.map((v) => v * 1.15))}
									// Le linee marcano i confini fra le fasce; le etichette
									// stanno dentro alla fascia che nominano, come nel
									// riferimento. Una linea a 0,1 mm sarebbe appiccicata
									// alla base e illeggibile.
									gridLines={[
										{ value: PRECIP_THRESHOLDS.moderate },
										{ value: PRECIP_THRESHOLDS.heavy },
									]}
									bands={[
										{ from: 0, to: PRECIP_THRESHOLDS.moderate, label: 'Debole' },
										{ from: PRECIP_THRESHOLDS.moderate, to: PRECIP_THRESHOLDS.heavy, label: 'Moderata' },
										{ from: PRECIP_THRESHOLDS.heavy, to: Infinity, label: 'Forte' },
									]}
									valueOf={(s) => s.mm}
									colorOf={(v) => getPrecipIntensity(v).color}
									ariaLabel="Precipitazione oraria prevista in millimetri"
								/>
								{isAllDry && (
									<p className="absolute inset-0 flex items-center justify-center text-sm text-white/40 pointer-events-none">
										Nessuna precipitazione prevista
									</p>
								)}
							</div>
						</section>
					) : (
						<p className="text-center text-xs text-white/50 mb-6">
							Quantità in mm non disponibile per questa località
						</p>
					)}

					{/* Grafico probabilità */}
					<section>
						<header className="text-center mb-1">
							<p className="text-xs text-white/60">{active?.time ? formatHourRange(active.time) : '—'}</p>
							<p className="text-3xl font-light text-white leading-tight">
								{active?.prob != null ? `${Math.round(active.prob)}%` : '—%'}
							</p>
							<p className="text-xs text-white/50">Probabilità</p>
						</header>
						<BarChart
							slots={slots}
							activeIndex={activeIndex}
							onActiveIndexChange={setActiveIndex}
							height={100}
							yMax={100}
							gridLines={[
								{ value: 80, label: '80%' },
								{ value: 100, label: '100%' },
							]}
							bands={[]}
							valueOf={(s) => s.prob}
							colorOf={() => 'rgba(96,165,250,0.85)'}
							ariaLabel="Probabilità oraria di precipitazione"
						/>
					</section>
				</>
			)}
		</div>
	);
}

// --- Grafico a barre ---

const W = 340;
const PAD_L = 46;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 22;

interface BarChartProps {
	slots: HourSlot[];
	activeIndex: number;
	onActiveIndexChange: (i: number) => void;
	height: number;
	yMax: number;
	/** Linee orizzontali di riferimento; `label` opzionale, scritto sulla linea. */
	gridLines: { value: number; label?: string }[];
	/** Etichette di fascia, centrate verticalmente nella regione che nominano. */
	bands: { from: number; to: number; label: string }[];
	valueOf: (s: HourSlot) => number | null | undefined;
	colorOf: (v: number) => string;
	ariaLabel: string;
}

/**
 * Grafico a barre a dominio fisso (24 ore) in SVG.
 *
 * A differenza di HourlyForecast.tsx, che usa larghezze in px e scroll
 * orizzontale, qui si usa un viewBox scalabile: con 24 slot fissi la
 * responsività è gratuita e si evita di annidare uno scroll orizzontale
 * dentro allo sheet, che è già scrollabile in verticale.
 */
function BarChart({
	slots,
	activeIndex,
	onActiveIndexChange,
	height,
	yMax,
	gridLines,
	bands,
	valueOf,
	colorOf,
	ariaLabel,
}: BarChartProps) {
	const overlayRef = useRef<SVGRectElement>(null);

	const n = slots.length;
	const plotW = W - PAD_L - PAD_R;
	const plotH = height - PAD_T - PAD_B;
	const slotW = plotW / n;
	const barW = Math.max(2, slotW * 0.62);
	const baselineY = PAD_T + plotH;

	const y = (v: number) => PAD_T + plotH * (1 - Math.min(v, yMax) / yMax);
	const x = (i: number) => PAD_L + i * slotW + (slotW - barW) / 2;

	const indexFromClientX = (clientX: number) => {
		const rect = overlayRef.current?.getBoundingClientRect();
		if (!rect || rect.width === 0) return null;
		const ratio = (clientX - rect.left) / rect.width;
		return Math.min(n - 1, Math.max(0, Math.floor(ratio * n)));
	};

	const handlePointer = (clientX: number) => {
		const i = indexFromClientX(clientX);
		if (i !== null) onActiveIndexChange(i);
	};

	const indicatorX = PAD_L + (activeIndex + 0.5) * slotW;

	return (
		<svg
			viewBox={`0 0 ${W} ${height}`}
			className="w-full h-auto select-none"
			role="img"
			aria-label={ariaLabel}
		>
			{/* Linee di riferimento */}
			{gridLines.map((g) => (
				<g key={`grid-${g.value}`}>
					<line
						x1={PAD_L}
						x2={W - PAD_R}
						y1={y(g.value)}
						y2={y(g.value)}
						stroke="rgba(255,255,255,0.12)"
						strokeDasharray="2 3"
					/>
					{g.label && (
						<text x={4} y={y(g.value) + 3} className="fill-white/40" fontSize={9}>
							{g.label}
						</text>
					)}
				</g>
			))}

			{/* Etichette di fascia, centrate nella regione che nominano */}
			{bands.map((b) => {
				const top = y(Math.min(b.to, yMax));
				const bottom = y(b.from);
				return (
					<text
						key={b.label}
						x={4}
						y={(top + bottom) / 2 + 3}
						className="fill-white/40"
						fontSize={9}
					>
						{b.label}
					</text>
				);
			})}

			{/* Linea di base */}
			<line x1={PAD_L} x2={W - PAD_R} y1={baselineY} y2={baselineY} stroke="rgba(255,255,255,0.2)" />

			{/* Barre */}
			{slots.map((s, i) => {
				const v = valueOf(s);
				// Ora non coperta da nessuna fonte: tacca tratteggiata, mai interpolata.
				if (v == null) {
					return (
						<line
							key={i}
							x1={x(i)}
							x2={x(i) + barW}
							y1={baselineY}
							y2={baselineY}
							stroke="rgba(255,255,255,0.2)"
							strokeWidth={2}
							strokeDasharray="1 2"
						/>
					);
				}
				const barH = baselineY - y(v);
				// Valore nullo: tacca piena, visivamente distinta dal dato mancante.
				if (barH < 1) {
					return (
						<rect
							key={i}
							x={x(i)}
							y={baselineY - 2}
							width={barW}
							height={2}
							fill="rgba(255,255,255,0.08)"
						/>
					);
				}
				return (
					<motion.rect
						key={i}
						x={x(i)}
						width={barW}
						rx={Math.min(barW / 2, 3)}
						fill={colorOf(v)}
						initial={{ y: baselineY, height: 0 }}
						animate={{ y: y(v), height: barH }}
						transition={{ duration: 0.4, delay: i * 0.008, ease: 'easeOut' }}
					/>
				);
			})}

			{/* Indicatore dell'ora selezionata */}
			<line
				x1={indicatorX}
				x2={indicatorX}
				y1={PAD_T}
				y2={baselineY}
				stroke="rgba(255,255,255,0.85)"
				strokeWidth={1}
				strokeDasharray="3 3"
			/>

			{/* Etichette asse X */}
			{[0, 6, 12, 18].map((h) => (
				<text
					key={h}
					x={PAD_L + (h + 0.5) * slotW}
					y={height - 6}
					textAnchor="middle"
					className="fill-white/40"
					fontSize={9}
				>
					{String(h).padStart(2, '0')}
				</text>
			))}

			{/*
			  Un solo hit target sull'area di plot: la scala del viewBox si annulla
			  perché il rect coincide con l'area stessa, quindi getBoundingClientRect
			  basta a mappare la X del puntatore sull'indice.
			*/}
			<rect
				ref={overlayRef}
				x={PAD_L}
				y={PAD_T}
				width={plotW}
				height={plotH}
				fill="transparent"
				style={{ touchAction: 'pan-y', cursor: 'col-resize' }}
				role="slider"
				tabIndex={0}
				aria-label={ariaLabel}
				aria-valuemin={0}
				aria-valuemax={n - 1}
				aria-valuenow={activeIndex}
				aria-valuetext={`Ore ${String(activeIndex).padStart(2, '0')}:00`}
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId);
					handlePointer(e.clientX);
				}}
				onPointerMove={(e) => {
					if (e.buttons > 0) handlePointer(e.clientX);
				}}
				onKeyDown={(e) => {
					if (e.key === 'ArrowLeft') {
						e.preventDefault();
						onActiveIndexChange(Math.max(0, activeIndex - 1));
					} else if (e.key === 'ArrowRight') {
						e.preventDefault();
						onActiveIndexChange(Math.min(n - 1, activeIndex + 1));
					}
				}}
			/>
		</svg>
	);
}
