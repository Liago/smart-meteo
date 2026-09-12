'use client';

import { motion } from 'framer-motion';
import type { ForecastNextHour, MinutelyPrecipitation } from '@/lib/types';
import { getPrecipIntensity, PRECIP_THRESHOLDS } from '@/lib/weather-utils';

interface NextHourPrecipitationProps {
	data?: ForecastNextHour;
}

/** Quanti minuti mostrare al massimo: WeatherKit ne manda 60-75. */
const WINDOW_MINUTES = 60;

/**
 * Riferimento minimo della scala verticale, in mm/h.
 *
 * Senza un minimo, una pioviggine da 0.2 mm/h riempirebbe tutto il grafico e
 * sembrerebbe un nubifragio; con un minimo troppo alto sarebbe invisibile.
 * 1 mm/h è il compromesso: la pioggia debole occupa una frazione leggibile
 * dell'altezza e il picco in mm/h è comunque scritto accanto al titolo.
 */
const SCALE_FLOOR_MM_H = 1;

interface Slot extends MinutelyPrecipitation {
	/** Minuti da adesso, 0 = il minuto in corso. */
	offset: number;
	wet: boolean;
}

/**
 * Normalizza i minuti di WeatherKit in slot relativi ad adesso.
 *
 * I timestamp sono istanti UTC, quindi il confronto con `Date.now()` è corretto
 * a prescindere dal fuso della località: l'offset in minuti è l'unica
 * informazione temporale di cui il nowcast ha davvero bisogno.
 */
function buildSlots(minutes: MinutelyPrecipitation[]): Slot[] {
	const now = Date.now();

	return minutes
		.map((m) => {
			const t = new Date(m.startTime).getTime();
			return {
				...m,
				offset: Math.round((t - now) / 60000),
				wet: m.precipitationIntensity >= PRECIP_THRESHOLDS.light,
			};
		})
		// WeatherKit include qualche minuto già passato: si scarta.
		.filter((s) => Number.isFinite(s.offset) && s.offset >= 0 && s.offset < WINDOW_MINUTES)
		.sort((a, b) => a.offset - b.offset);
}

/**
 * Minuti asciutti consecutivi necessari per dichiarare finita la pioggia.
 *
 * Con una soglia di un solo minuto, un buco isolato nei dati WeatherKit
 * annuncerebbe "smette fra 3 minuti" in mezzo a un rovescio.
 */
const DRY_RUN_MINUTES = 3;

/**
 * Primo minuto da cui inizia una sequenza di almeno `run` minuti asciutti.
 * Restituisce undefined se la pioggia non si interrompe mai abbastanza a lungo.
 */
function firstDryRun(slots: Slot[], run: number): Slot | undefined {
	for (let i = 0; i < slots.length; i++) {
		if (slots[i]!.wet) continue;
		// Vicino al bordo della finestra i minuti mancanti non contano come
		// pioggia: una pausa che arriva a fine finestra è comunque una pausa.
		const window = slots.slice(i, i + run);
		if (window.every((s) => !s.wet)) return slots[i];
	}
	return undefined;
}

/** "fra 12 minuti", "fra un minuto", "adesso". */
function relative(offset: number): string {
	if (offset <= 0) return 'adesso';
	if (offset === 1) return 'fra un minuto';
	return `fra ${offset} minuti`;
}

/** Ora di orologio dell'istante, nel fuso del browser. */
function clock(iso: string): string {
	return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

interface Headline {
	title: string;
	detail: string | null;
}

/**
 * Il titolo del pannello, dedotto dai minuti e non dal campo `summary` di
 * WeatherKit: i due possono discordare, e i minuti sono ciò che disegniamo.
 */
function buildHeadline(slots: Slot[]): Headline {
	const firstWet = slots.find((s) => s.wet);

	if (!firstWet) {
		return { title: 'Nessuna precipitazione nella prossima ora', detail: null };
	}

	if (slots[0]!.wet) {
		const stop = firstDryRun(slots, DRY_RUN_MINUTES);
		if (!stop) {
			return { title: 'Precipitazioni per tutta la prossima ora', detail: null };
		}
		return {
			title: `Smette ${relative(stop.offset)}`,
			detail: `verso le ${clock(stop.startTime)}`,
		};
	}

	return {
		title: `Inizia ${relative(firstWet.offset)}`,
		detail: `alle ${clock(firstWet.startTime)}`,
	};
}

export default function NextHourPrecipitation({ data }: NextHourPrecipitationProps) {
	if (!data?.minutes?.length) return null;

	const slots = buildSlots(data.minutes);
	if (slots.length === 0) return null;

	const headline = buildHeadline(slots);
	const peak = Math.max(...slots.map((s) => s.precipitationIntensity));
	const maxChance = Math.max(...slots.map((s) => s.precipitationChance));
	const hasRain = slots.some((s) => s.wet);

	// Asciutto: una riga sola, senza grafico. Un istogramma di zeri occuperebbe
	// spazio sulla dashboard senza dire nulla in più del titolo.
	if (!hasRain) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="glass flex flex-wrap items-center justify-between gap-2 px-6 py-4"
				style={{ color: 'var(--color-duet-ink)' }}
			>
				<span className="text-sm font-semibold">{headline.title}</span>
				<span className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>
					Nowcast al minuto · probabilità max {Math.round(maxChance)}%
				</span>
			</motion.div>
		);
	}

	const scaleMax = Math.max(peak, SCALE_FLOOR_MM_H);

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="glass p-6"
			style={{ color: 'var(--color-duet-ink)' }}
		>
			<div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h3 className="text-base font-bold">
					{headline.title}
					{headline.detail && (
						<span className="ml-1.5 text-[13px] font-medium" style={{ color: 'var(--color-duet-muted)' }}>
							{headline.detail}
						</span>
					)}
				</h3>
				<span className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>
					Picco {peak.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mm/h · probabilità max{' '}
					{Math.round(maxChance)}%
				</span>
			</div>

			<div className="mt-3 flex h-20 items-end gap-px" aria-hidden="true">
				{slots.map((slot) => {
					const { color } = getPrecipIntensity(slot.precipitationIntensity);
					// Minimo 2% perché la barra di un minuto asciutto resti una
					// traccia visibile della linea di base.
					const height = slot.wet
						? Math.max(6, (slot.precipitationIntensity / scaleMax) * 100)
						: 2;
					return (
						<motion.div
							key={slot.startTime}
							initial={{ height: 0 }}
							animate={{ height: `${height}%` }}
							transition={{ duration: 0.4, delay: Math.min(slot.offset, 30) * 0.006 }}
							className="flex-1 rounded-t-sm"
							style={{ background: color, minHeight: 2 }}
						/>
					);
				})}
			</div>

			{/* Il grafico è decorativo: la stessa informazione è nel testo sopra. */}
			<div
				className="mt-2 flex justify-between text-[11px]"
				style={{ color: 'var(--color-duet-faint)' }}
			>
				<span>Adesso</span>
				<span>+15 min</span>
				<span>+30 min</span>
				<span>+45 min</span>
				<span>+1 h</span>
			</div>
		</motion.div>
	);
}
