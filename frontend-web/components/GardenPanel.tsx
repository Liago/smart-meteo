'use client';

import { motion } from 'framer-motion';
import type { GardenOutlook } from '@/lib/types';
import {
	ADVICE_COLORS,
	ADVICE_HEADLINES,
	MOISTURE_COLORS,
	MOISTURE_LABELS,
	adviceReason,
	formatMm,
	formatMoisture,
	sowingSentence,
} from '@/lib/garden';

interface GardenPanelProps {
	garden?: GardenOutlook;
}

/**
 * Orto e giardino: devo innaffiare?
 *
 * Open-Meteo espone gratuitamente umidità del suolo, evapotraspirazione di
 * riferimento FAO e temperatura dello strato radicale, sullo stesso endpoint
 * che interroghiamo già. Rispondono a una domanda che il meteo normale non
 * copre: non «che tempo fa» ma «devo prendere l'annaffiatoio stasera».
 *
 * Il pannello compare ovunque quei dati esistano, anche quando la risposta è
 * «non serve»: a differenza del riquadro neve, il caso tranquillo qui **è** la
 * risposta che si cerca.
 */
export default function GardenPanel({ garden }: GardenPanelProps) {
	if (!garden) return null;

	const reason = adviceReason(garden);
	const sowing = sowingSentence(garden);

	const rows: { label: string; value: string; hint?: string }[] = [];

	if (garden.moisture_level) {
		rows.push({
			label: 'Terreno',
			value: MOISTURE_LABELS[garden.moisture_level],
			// Il numero grezzo resta accanto all'etichetta: la soglia di
			// «asciutto» dipende dal tipo di suolo, che l'API non dichiara, e
			// chi conosce il proprio terreno deve poter correggere il giudizio.
			hint: formatMoisture(garden.soil_moisture),
		});
	}
	if (garden.evapotranspiration_mm != null) {
		rows.push({
			label: 'Evaporazione attesa',
			value: formatMm(garden.evapotranspiration_mm),
			hint: 'in 24 ore',
		});
	}
	if (garden.rain_mm != null && garden.rain_mm > 0) {
		rows.push({ label: 'Pioggia attesa', value: formatMm(garden.rain_mm), hint: 'in 24 ore' });
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
				<h3 className="text-base font-bold">Orto e giardino</h3>
				<span
					className="h-2.5 w-2.5 shrink-0 rounded-full"
					style={{ background: ADVICE_COLORS[garden.advice] }}
					aria-hidden="true"
				/>
			</div>

			<p className="text-sm font-medium">{ADVICE_HEADLINES[garden.advice]}</p>
			{reason && (
				<p className="mt-1 text-xs" style={{ color: 'var(--color-duet-muted)' }}>
					{reason}
				</p>
			)}

			<ul className="mt-4 flex flex-col gap-2">
				{rows.map((row) => (
					<li key={row.label} className="flex items-baseline gap-3">
						<span
							className="min-w-0 flex-1 truncate text-sm"
							style={{ color: 'var(--color-duet-muted)' }}
						>
							{row.label}
						</span>
						{row.hint && (
							<span className="text-xs" style={{ color: 'var(--color-duet-faint)' }}>
								{row.hint}
							</span>
						)}
						<span
							className="text-sm font-semibold tabular-nums"
							style={
								row.label === 'Terreno' && garden.moisture_level
									? { color: MOISTURE_COLORS[garden.moisture_level] }
									: undefined
							}
						>
							{row.value}
						</span>
					</li>
				))}
			</ul>

			{sowing && (
				<p className="mt-3 text-xs" style={{ color: 'var(--color-duet-muted)' }}>
					{sowing}
				</p>
			)}

			<p className="mt-3 text-[11px]" style={{ color: 'var(--color-duet-faint)' }}>
				L&apos;umidità è in percentuale di volume: le soglie dipendono dal tipo di terreno.
			</p>
		</motion.div>
	);
}
