'use client';

import { motion } from 'framer-motion';
import type { SkyOutlook } from '@/lib/types';
import {
	SKY_COLORS,
	SKY_LABELS,
	STARGAZING_LABELS,
	formatHour,
	nextSolarEvent,
	skyHeadline,
	stargazingReason,
} from '@/lib/sky';

interface SkyPanelProps {
	sky?: SkyOutlook;
}

/**
 * Tramonti e cielo notturno.
 *
 * Nasce da un'osservazione che la copertura nuvolosa totale non riesce a
 * esprimere: un tramonto memorabile vuole nuvole **alte** — cirri, che prendono
 * la luce da sotto quando il sole è già sceso — e l'orizzonte libero perché
 * quella luce ci arrivi. Un cielo terso e uno coperto danno entrambi un tramonto
 * ordinario, per ragioni opposte.
 */
export default function SkyPanel({ sky }: SkyPanelProps) {
	if (!sky) return null;

	const solar = nextSolarEvent(sky);
	const night = sky.stargazing;
	if (!solar && !night) return null;

	const headlineLevel = solar ? solar.event.level : night!.level;

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6, delay: 0.2 }}
			className="glass p-6"
			style={{ color: 'var(--color-duet-ink)' }}
		>
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h3 className="text-base font-bold">Cielo</h3>
				<span
					className="h-2.5 w-2.5 shrink-0 rounded-full"
					style={{ background: SKY_COLORS[headlineLevel] }}
					aria-hidden="true"
				/>
			</div>

			<p className="text-sm font-medium">{skyHeadline(sky)}</p>

			<ul className="mt-4 flex flex-col gap-2">
				{solar && (
					<li className="flex items-baseline gap-3">
						<span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-duet-muted)' }}>
							{solar.kind === 'sunset' ? 'Tramonto' : 'Alba'}
						</span>
						{formatHour(solar.event.at) && (
							<span className="text-xs" style={{ color: 'var(--color-duet-faint)' }}>
								{formatHour(solar.event.at)}
							</span>
						)}
						<span
							className="text-sm font-semibold"
							style={{ color: SKY_COLORS[solar.event.level] }}
						>
							{SKY_LABELS[solar.event.level]}
						</span>
					</li>
				)}

				{night && (
					<li className="flex items-baseline gap-3">
						<span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-duet-muted)' }}>
							Stelle stanotte
						</span>
						{/* I due ingredienti in chiaro: nuvole e luna. Senza, il
						    giudizio sarebbe un verdetto senza appello. */}
						<span className="text-xs" style={{ color: 'var(--color-duet-faint)' }}>
							{stargazingReason(night)}
						</span>
						<span className="text-sm font-semibold" style={{ color: SKY_COLORS[night.level] }}>
							{STARGAZING_LABELS[night.level]}
						</span>
					</li>
				)}
			</ul>

			<p className="mt-3 text-[11px]" style={{ color: 'var(--color-duet-faint)' }}>
				I tramonti migliori nascono da nuvole alte con l&apos;orizzonte libero.
			</p>
		</motion.div>
	);
}
