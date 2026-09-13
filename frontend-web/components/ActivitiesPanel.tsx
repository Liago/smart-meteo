'use client';

import { motion } from 'framer-motion';
import { Bike, Footprints, Shirt } from 'lucide-react';
import type { ActivitiesOutlook, ActivityId, ActivityScore } from '@/lib/types';

interface ActivitiesPanelProps {
	activities?: ActivitiesOutlook;
}

/**
 * «Oggi è una buona giornata per…»
 *
 * Gli indici non vengono comprati da un'API a consumo ma calcolati dai dati che
 * già aggreghiamo: costo zero, e soprattutto si può dire **perché** il
 * punteggio è quello. Un indice a scatola chiusa dà un numero e basta; qui
 * accanto al numero c'è il fattore che lo tiene basso, che è l'informazione su
 * cui si decide se rimandare o cambiare percorso.
 */

const ICONS: Record<ActivityId, typeof Bike> = {
	running: Footprints,
	cycling: Bike,
	laundry: Shirt,
};

/** Verdi, gialli e rossi sulle stesse fasce delle altre scale del progetto. */
function colorOf(score: number): string {
	if (score >= 75) return '#33B34D';
	if (score >= 50) return '#EAB308';
	if (score >= 25) return '#F97316';
	return '#E64033';
}

/** Il giorno valutato, quando non è oggi: di sera la finestra è di domani. */
function dayNote(date: string, today = new Date()): string | null {
	const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	return date === key ? null : 'domani';
}

function ActivityRow({ activity }: { activity: ActivityScore }) {
	const Icon = ICONS[activity.id];
	const color = colorOf(activity.score);

	return (
		<li className="flex items-center gap-3">
			<Icon className="h-4 w-4 shrink-0" style={{ color }} aria-hidden />

			<span className="min-w-0 flex-1 truncate text-sm font-medium">{activity.label}</span>

			{activity.limiting && (
				<span className="text-xs" style={{ color: 'var(--color-duet-faint)' }}>
					limita {activity.limiting}
				</span>
			)}

			{/* La barra rende i tre confrontabili a colpo d'occhio. */}
			<span
				className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full"
				style={{ background: 'var(--color-duet-accent-soft)' }}
				aria-hidden="true"
			>
				<span
					className="block h-full rounded-full"
					style={{ width: `${activity.score}%`, background: color }}
				/>
			</span>

			<span className="w-8 text-right text-sm font-semibold tabular-nums">{activity.score}</span>
		</li>
	);
}

export default function ActivitiesPanel({ activities }: ActivitiesPanelProps) {
	if (!activities || activities.activities.length === 0) return null;

	const note = dayNote(activities.date);
	const best = activities.activities[0]!;

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6, delay: 0.2 }}
			className="glass p-6"
			style={{ color: 'var(--color-duet-ink)' }}
		>
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h3 className="text-base font-bold">Buona giornata per…</h3>
				{note && (
					<span className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>
						{note}
					</span>
				)}
			</div>

			<p className="text-sm font-medium">
				{best.score >= 75
					? `${best.label.toLowerCase()}: condizioni ottime`
					: best.limiting
						? `Niente di ideale: limita ${best.limiting}`
						: 'Condizioni nella media'}
			</p>

			<ul className="mt-4 flex flex-col gap-2">
				{activities.activities.map((activity) => (
					<ActivityRow key={activity.id} activity={activity} />
				))}
			</ul>

			<p className="mt-3 text-[11px]" style={{ color: 'var(--color-duet-faint)' }}>
				Punteggio sulle ore diurne, pari al fattore peggiore: una giornata perfetta sotto la
				pioggia non è mezza buona.
			</p>
		</motion.div>
	);
}
