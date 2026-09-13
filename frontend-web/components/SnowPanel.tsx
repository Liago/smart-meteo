'use client';

import { motion } from 'framer-motion';
import type { SnowOutlook } from '@/lib/types';
import {
	FROST_COLORS,
	FROST_LABELS,
	PHASE_LABELS,
	formatAltitude,
	formatCm,
	frostMinimum,
	snowHeadline,
} from '@/lib/snow';

interface SnowPanelProps {
	snow?: SnowOutlook;
}

/**
 * Neve e gelate nelle prossime 24 ore.
 *
 * "Zero termico a 1500 m" è un dato da bollettino: quello che serve sapere è se
 * a *casa propria* verrà giù neve o acqua. Il backend conosce la quota del
 * punto di griglia — la dichiara Open-Meteo insieme alla previsione — e la usa
 * per rispondere a quella domanda; qui si mostra il confronto, perché è la
 * ragione per cui il numero ha senso.
 *
 * Il pannello compare solo quando il backend manda il blocco, e il backend lo
 * manda solo quando c'è qualcosa da dire: senza questa regola resterebbe un
 * riquadro vuoto per otto mesi l'anno.
 */
export default function SnowPanel({ snow }: SnowPanelProps) {
	if (!snow) return null;

	const rows: { label: string; value: string; hint?: string }[] = [];

	if (snow.snow_line != null) {
		rows.push({
			label: 'Quota neve',
			value: formatAltitude(snow.snow_line),
			// Il confronto con l'altitudine è tutto il punto: senza, il numero
			// sopra resta un dato da bollettino.
			hint: snow.elevation != null ? `sei a ${formatAltitude(snow.elevation)}` : undefined,
		});
	}
	if (snow.phase) {
		rows.push({ label: 'Alla tua quota', value: PHASE_LABELS[snow.phase] });
	}
	if (snow.snowfall_cm != null && snow.snowfall_cm > 0) {
		rows.push({ label: 'Neve prevista', value: formatCm(snow.snowfall_cm), hint: 'in 24 ore' });
	}
	if (snow.snow_depth_cm != null && snow.snow_depth_cm >= 1) {
		rows.push({ label: 'Neve al suolo', value: formatCm(snow.snow_depth_cm) });
	}
	if (snow.frost.level !== 'none') {
		rows.push({
			label: 'Gelate',
			value: FROST_LABELS[snow.frost.level],
			hint: frostMinimum(snow),
		});
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
				<h3 className="text-base font-bold">Neve e gelate</h3>
				<span
					className="h-2.5 w-2.5 shrink-0 rounded-full"
					style={{ background: FROST_COLORS[snow.frost.level] }}
					aria-hidden="true"
				/>
			</div>

			<p className="mb-4 text-sm font-medium">{snowHeadline(snow)}</p>

			<ul className="flex flex-col gap-2">
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
						<span className="text-sm font-semibold tabular-nums">{row.value}</span>
					</li>
				))}
			</ul>

			<p className="mt-3 text-[11px]" style={{ color: 'var(--color-duet-faint)' }}>
				Previsione sulle prossime 24 ore. La quota neve è stimata dallo zero termico dei modelli.
			</p>
		</motion.div>
	);
}
