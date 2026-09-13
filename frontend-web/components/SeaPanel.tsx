'use client';

import { motion } from 'framer-motion';
import type { SeaOutlook } from '@/lib/types';
import {
	SEA_COLORS,
	SEA_LABELS,
	formatSeaTemp,
	formatWave,
	seaHeadline,
	waveDirectionLabel,
	worseningNote,
} from '@/lib/sea';

interface SeaPanelProps {
	sea?: SeaOutlook;
}

/**
 * Onde e temperatura dell'acqua.
 *
 * Compare **solo sulle località costiere**, e il test di costa non è nostro: il
 * modello d'onda di Open-Meteo copre soltanto i punti di griglia sul mare, e
 * nell'entroterra il backend non manda affatto il blocco. È più accurato di
 * qualunque soglia sulla distanza dal mare che avremmo potuto scegliere.
 */
export default function SeaPanel({ sea }: SeaPanelProps) {
	if (!sea) return null;

	const worsening = worseningNote(sea);
	const direction = waveDirectionLabel(sea.wave_direction);

	const rows: { label: string; value: string; hint?: string; color?: string }[] = [];

	if (sea.sea_temperature != null) {
		rows.push({ label: 'Acqua', value: formatSeaTemp(sea.sea_temperature) });
	}
	if (sea.wave_height != null) {
		rows.push({
			label: 'Onda',
			value: formatWave(sea.wave_height),
			// La provenienza conta per scegliere la spiaggia: una costa al
			// riparo dal vento dominante resta calma anche col mare mosso.
			hint: direction ? `da ${direction}` : undefined,
			color: SEA_COLORS[sea.state],
		});
	}
	if (sea.swell_height != null && sea.swell_height > 0) {
		rows.push({ label: 'Mare lungo', value: formatWave(sea.swell_height) });
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6, delay: 0.2 }}
			className="glass p-6"
			style={{ color: 'var(--color-duet-ink)' }}
		>
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h3 className="text-base font-bold">Mare</h3>
				<span
					className="h-2.5 w-2.5 shrink-0 rounded-full"
					style={{ background: SEA_COLORS[sea.state] }}
					aria-hidden="true"
				/>
			</div>

			<p className="text-sm font-medium">{seaHeadline(sea)}</p>
			{worsening && (
				<p className="mt-1 text-xs" style={{ color: 'var(--color-duet-muted)' }}>
					{worsening}
				</p>
			)}

			<ul className="mt-4 flex flex-col gap-2">
				{rows.map((row) => (
					<li key={row.label} className="flex items-baseline gap-3">
						<span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-duet-muted)' }}>
							{row.label}
						</span>
						{row.hint && (
							<span className="text-xs" style={{ color: 'var(--color-duet-faint)' }}>
								{row.hint}
							</span>
						)}
						<span
							className="text-sm font-semibold tabular-nums"
							style={row.color ? { color: row.color } : undefined}
						>
							{row.value}
						</span>
					</li>
				))}
			</ul>

			<p className="mt-3 text-[11px]" style={{ color: 'var(--color-duet-faint)' }}>
				Stato del mare: {SEA_LABELS[sea.state].toLowerCase()}. Le maree non sono disponibili sul
				piano gratuito delle nostre fonti.
			</p>
		</motion.div>
	);
}
