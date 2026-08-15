'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { HourlyForecast, DailyForecast } from '@/lib/types';
import { METRICS, MetricId, MetricSection } from '@/lib/metrics';
import { formatHourRange } from '@/lib/weather-utils';

interface HourlyDetailProps {
	hourly: HourlyForecast[];
	daily?: DailyForecast[];
	initialDate?: string;
	/** Metrica da visualizzare; la scelta vive nel chiamante insieme alla dropdown. */
	metric: MetricId;
}

const HOURS_IN_DAY = 24;

/** Slot orario del giorno selezionato. `h` assente = ora non coperta da nessuna fonte. */
interface HourSlot {
	hour: number;
	h?: HourlyForecast;
}

export default function HourlyDetail({ hourly, daily, initialDate, metric }: HourlyDetailProps) {
	const spec = METRICS[metric];

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
				base[hour] = { hour, h };
			});
		return base;
	}, [hourly, selectedDate]);

	const hasAnyHour = slots.some((s) => s.h !== undefined);

	// Ora attiva: quella corrente se il giorno è oggi, altrimenti quella col
	// valore massimo della metrica principale (l'ora più piovosa, la più ventosa…).
	const defaultIndex = useMemo(() => {
		const today = new Date();
		const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
		if (selectedDate === todayKey) return today.getHours();

		const primary = spec.sections[0];
		const values = slots.map((s) => (s.h ? primary.valueOf(s.h) : null));
		const present = values.filter((v): v is number => v != null);
		// Un giorno piatto (tutto asciutto, tutto uguale) non ha un'ora "notevole":
		// meglio la prima coperta che una scelta arbitraria fra valori identici.
		const isFlat = present.length === 0 || present.every((v) => v === present[0]);
		if (!isFlat) {
			let best = 0;
			let bestVal = -Infinity;
			values.forEach((v, i) => {
				if (v != null && v > bestVal) { bestVal = v; best = i; }
			});
			return best;
		}

		const firstCovered = slots.findIndex((s) => s.h !== undefined);
		return firstCovered === -1 ? 12 : firstCovered;
	}, [selectedDate, slots, spec]);

	// Cambiando giorno l'ora selezionata torna al default: è un aggiustamento di
	// stato in fase di render, non un effect (evita il render extra).
	const [activeIndex, setActiveIndex] = useState(defaultIndex);
	const [lastDefault, setLastDefault] = useState(defaultIndex);
	if (lastDefault !== defaultIndex) {
		setLastDefault(defaultIndex);
		setActiveIndex(defaultIndex);
	}

	const active = slots[activeIndex];

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
							className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors ${!enabled ? 'opacity-40 cursor-not-allowed' : ''}`}
							style={{
								background: isSelected ? 'var(--color-duet-accent-soft)' : enabled ? 'var(--color-duet-bg)' : undefined,
							}}
						>
							<span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-duet-faint)' }}>
								{dt.toLocaleDateString('it-IT', { weekday: 'narrow' })}
							</span>
							<span className={`text-sm ${isSelected ? 'font-bold' : ''}`} style={{ color: isSelected ? 'var(--color-duet-accent)' : 'var(--color-duet-ink)' }}>
								{dt.getDate()}
							</span>
						</button>
					);
				})}
			</div>

			<p className="text-center text-sm mb-4" style={{ color: 'var(--color-duet-muted)' }}>{dateLabel}</p>

			{!hasAnyHour ? (
				<p className="text-center text-sm py-8" style={{ color: 'var(--color-duet-muted)' }}>
					Dati orari non disponibili per questa data
				</p>
			) : (
				spec.sections.map((section, i) => (
					<Section
						key={section.id}
						section={section}
						slots={slots}
						active={active}
						activeIndex={activeIndex}
						onActiveIndexChange={setActiveIndex}
						isLast={i === spec.sections.length - 1}
					/>
				))
			)}
		</div>
	);
}

// --- Sezione: intestazione + grafico di una singola serie ---

interface SectionProps {
	section: MetricSection;
	slots: HourSlot[];
	active: HourSlot | undefined;
	activeIndex: number;
	onActiveIndexChange: (i: number) => void;
	isLast: boolean;
}

function Section({ section, slots, active, activeIndex, onActiveIndexChange, isLast }: SectionProps) {
	const values = slots
		.map((s) => (s.h ? section.valueOf(s.h) : null))
		.filter((v): v is number => v != null);
	const secondaries = section.secondaryOf
		? slots
			.map((s) => (s.h ? section.secondaryOf!(s.h) : null))
			.filter((v): v is number => v != null)
		: [];

	// Il backend omette la chiave quando nessuna fonte l'ha fornita (cache vecchia,
	// fonti senza il dato): in quel caso il grafico non va proprio disegnato.
	if (values.length === 0) {
		return <p className="text-center text-xs mb-4" style={{ color: 'var(--color-duet-faint)' }}>{section.emptyMessage}</p>;
	}

	const isFlatZero = values.every((v) => v === 0);
	const domain = section.domain([...values, ...secondaries]);

	return (
		<section className={`rounded-lg p-3 ${isLast ? '' : 'mb-4'}`} style={{ background: 'var(--color-duet-bg)', border: '1px solid var(--color-duet-border)' }}>
			<header className="text-center mb-1">
				<p className="text-xs" style={{ color: 'var(--color-duet-faint)' }}>{active?.h ? formatHourRange(active.h.time) : '—'}</p>
				<p className={`text-3xl font-light leading-tight ${section.headlineClassName}`}>
					{section.headline(active?.h)}
				</p>
				<p className={`text-xs ${section.captionClassName}`}>{section.caption(active?.h)}</p>
			</header>
			<div className="relative">
				<BarChart
					slots={slots}
					activeIndex={activeIndex}
					onActiveIndexChange={onActiveIndexChange}
					height={section.height}
					yMin={domain.min}
					yMax={domain.max}
					gridLines={section.gridLines(domain)}
					bands={section.bands(domain)}
					valueOf={(s) => (s.h ? section.valueOf(s.h) : null)}
					secondaryValueOf={
						section.secondaryOf ? (s) => (s.h ? section.secondaryOf!(s.h) : null) : undefined
					}
					colorOf={section.colorOf}
					ariaLabel={section.ariaLabel}
				/>
				{isFlatZero && section.flatMessage && (
					<p className="absolute inset-0 flex items-center justify-center text-sm pointer-events-none" style={{ color: 'var(--color-duet-faint)' }}>
						{section.flatMessage}
					</p>
				)}
			</div>
		</section>
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
	/** Base dell'asse Y. Diverso da 0 per le metriche senza uno zero significativo. */
	yMin: number;
	yMax: number;
	/** Linee orizzontali di riferimento; `label` opzionale, scritto sulla linea. */
	gridLines: { value: number; label?: string }[];
	/** Etichette di fascia, centrate verticalmente nella regione che nominano. */
	bands: { from: number; to: number; label: string }[];
	valueOf: (s: HourSlot) => number | null | undefined;
	/** Serie secondaria (raffiche): una tacca sopra la barra, non una seconda barra. */
	secondaryValueOf?: (s: HourSlot) => number | null | undefined;
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
	yMin,
	yMax,
	gridLines,
	bands,
	valueOf,
	secondaryValueOf,
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

	// Un dominio degenere (tutti i valori identici) azzererebbe lo span: si
	// forza un minimo perché le barre restino disegnabili.
	const span = Math.max(yMax - yMin, 1e-6);
	const y = (v: number) => PAD_T + plotH * (1 - (Math.min(Math.max(v, yMin), yMax) - yMin) / span);
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
			{gridLines
				.filter((g) => g.value > yMin && g.value <= yMax)
				.map((g) => (
					<g key={`grid-${g.value}`}>
						<line
							x1={PAD_L}
							x2={W - PAD_R}
							y1={y(g.value)}
							y2={y(g.value)}
							stroke="var(--color-duet-border)"
							strokeDasharray="2 3"
						/>
						{g.label && (
							<text x={4} y={y(g.value) + 3} fill="var(--color-duet-faint)" fontSize={9}>
								{g.label}
							</text>
						)}
					</g>
				))}

			{/* Etichette di fascia, centrate nella regione che nominano */}
			{bands
				.filter((b) => b.from < yMax && Math.min(b.to, yMax) > yMin)
				.map((b) => {
					const top = y(Math.min(b.to, yMax));
					const bottom = y(Math.max(b.from, yMin));
					return (
						<text
							key={b.label}
							x={4}
							y={(top + bottom) / 2 + 3}
							fill="var(--color-duet-faint)"
							fontSize={9}
						>
							{b.label}
						</text>
					);
				})}

			{/* Linea di base */}
			<line x1={PAD_L} x2={W - PAD_R} y1={baselineY} y2={baselineY} stroke="var(--color-duet-border-strong)" />

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
							stroke="var(--color-duet-border-strong)"
							strokeWidth={2}
							strokeDasharray="1 2"
						/>
					);
				}
				const barH = baselineY - y(v);
				// Valore al minimo dell'asse: tacca piena, visivamente distinta dal dato mancante.
				if (barH < 1) {
					return (
						<rect
							key={i}
							x={x(i)}
							y={baselineY - 2}
							width={barW}
							height={2}
							fill="var(--color-duet-border)"
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

			{/* Serie secondaria: tacca al livello della raffica, sopra la barra */}
			{secondaryValueOf &&
				slots.map((s, i) => {
					const sec = secondaryValueOf(s);
					const primary = valueOf(s);
					// Una raffica pari o inferiore al vento medio non aggiunge informazione
					// e disegnerebbe la tacca dentro la barra.
					if (sec == null || primary == null || sec <= primary) return null;
					return (
						<line
							key={`sec-${i}`}
							x1={x(i)}
							x2={x(i) + barW}
							y1={y(sec)}
							y2={y(sec)}
							stroke="var(--color-duet-ink-soft)"
							strokeWidth={1.5}
							strokeLinecap="round"
						/>
					);
				})}

			{/* Indicatore dell'ora selezionata */}
			<line
				x1={indicatorX}
				x2={indicatorX}
				y1={PAD_T}
				y2={baselineY}
				stroke="var(--color-duet-accent)"
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
					fill="var(--color-duet-faint)"
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
