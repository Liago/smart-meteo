'use client';

import { motion } from 'framer-motion';
import type { PollenLevel, PollenReading } from '@/lib/types';

interface PollenPanelProps {
	pollen?: PollenReading[];
}

/**
 * Pollini per specie.
 *
 * Il dato è modellato dal CAMS europeo e arriva gratuitamente da Open-Meteo.
 * In Italia è stagionale e molto concreto: olivo e graminacee in primavera,
 * ambrosia a fine estate.
 *
 * Il pannello mostra il **massimo previsto in giornata**, non solo il valore
 * dell'ora: chi è allergico decide la mattina se uscire, e sapere che il picco
 * arriva a mezzogiorno è l'informazione utile.
 */

const LEVEL_LABELS: Record<PollenLevel, string> = {
	none: 'Assente',
	low: 'Basso',
	moderate: 'Moderato',
	high: 'Alto',
	very_high: 'Molto alto',
};

const LEVEL_COLORS: Record<PollenLevel, string> = {
	none: 'rgba(8,42,77,0.18)',
	low: '#33B34D',
	moderate: '#E6CC33',
	high: '#F28C26',
	very_high: '#E64033',
};

/** Ordine di gravità, per portare in cima le specie che pesano oggi. */
const LEVEL_RANK: Record<PollenLevel, number> = {
	very_high: 4,
	high: 3,
	moderate: 2,
	low: 1,
	none: 0,
};

function formatGrains(value: number | null): string {
	if (value == null) return '—';
	return value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace('.', ',');
}

export default function PollenPanel({ pollen }: PollenPanelProps) {
	if (!pollen || pollen.length === 0) return null;

	// Le specie ferme a zero non spariscono — l'assenza è un'informazione —
	// ma finiscono in fondo.
	const ordered = [...pollen].sort(
		(a, b) => LEVEL_RANK[b.daily_level] - LEVEL_RANK[a.daily_level]
	);
	const peak = ordered[0]!;
	const quiet = peak.daily_level === 'none';

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6, delay: 0.2 }}
			className="glass p-6"
			style={{ color: 'var(--color-duet-ink)' }}
		>
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h3 className="text-base font-bold">Pollini</h3>
				<span className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>
					{quiet ? 'Nessuna specie rilevante oggi' : `Oggi soprattutto ${peak.label.toLowerCase()}`}
				</span>
			</div>

			<ul className="flex flex-col gap-2">
				{ordered.map((reading) => (
					<li key={reading.species} className="flex items-center gap-3">
						<span
							className="h-2.5 w-2.5 shrink-0 rounded-full"
							style={{ background: LEVEL_COLORS[reading.daily_level] }}
							aria-hidden="true"
						/>
						<span className="min-w-0 flex-1 truncate text-sm font-medium">{reading.label}</span>
						<span className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>
							{LEVEL_LABELS[reading.daily_level]}
						</span>
						<span
							className="w-20 text-right text-xs tabular-nums"
							style={{ color: 'var(--color-duet-faint)' }}
						>
							max {formatGrains(reading.daily_max)}
						</span>
					</li>
				))}
			</ul>

			<p className="mt-3 text-[11px]" style={{ color: 'var(--color-duet-faint)' }}>
				Massimo previsto oggi in granuli/m³. Le soglie sono diverse per ogni specie.
			</p>
		</motion.div>
	);
}
