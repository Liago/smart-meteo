'use client';

import { useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import type { SolarOutlook } from '@/lib/types';
import {
	assumptionsNote,
	dayEnergyKwh,
	dayLabel,
	formatKwh,
	formatSpecificYield,
	parsePlantKwp,
	readPlantKwp,
	serverPlantKwp,
	subscribePlantKwp,
	writePlantKwp,
} from '@/lib/solar';

interface SolarPanelProps {
	solar?: SolarOutlook;
}

/**
 * Resa fotovoltaica prevista.
 *
 * In Italia il fotovoltaico domestico è diffusissimo, e chi ce l'ha non chiede
 * «c'è il sole» ma «quanto produco domani». Open-Meteo dà la radiazione sul
 * piano dei pannelli gratuitamente, sullo stesso endpoint che interroghiamo già.
 *
 * La potenza dell'impianto è un dato dell'utente, non della previsione: vive in
 * `localStorage` e non tocca il backend, così la stessa risposta in cache serve
 * tutti quelli sulla stessa località. Senza, il pannello mostra la resa
 * specifica in kWh/kWp — che è comunque il numero fisicamente corretto.
 */
export default function SolarPanel({ solar }: SolarPanelProps) {
	// `localStorage` è uno store esterno al React tree: `useSyncExternalStore`
	// lo legge senza disallineare l'idratazione (sul server risponde null) e
	// senza chiamare `setState` dentro un effetto, che è il pattern che React
	// sconsiglia perché innesca render a cascata.
	const kwp = useSyncExternalStore(subscribePlantKwp, readPlantKwp, serverPlantKwp);

	const [draft, setDraft] = useState('');
	const [isEditing, setIsEditing] = useState(false);

	if (!solar || solar.days.length === 0) return null;

	const save = () => {
		writePlantKwp(parsePlantKwp(draft));
		setIsEditing(false);
	};

	/** Apre il campo partendo dal valore salvato, invece che vuoto. */
	const toggleEditing = () => {
		setIsEditing((editing) => {
			if (!editing) setDraft(kwp != null ? String(kwp) : '');
			return !editing;
		});
	};

	const best = solar.days.reduce((a, b) => (b.kwh_per_kwp > a.kwh_per_kwp ? b : a));
	const bestEnergy = dayEnergyKwh(best, kwp);

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6, delay: 0.2 }}
			className="glass p-6"
			style={{ color: 'var(--color-duet-ink)' }}
		>
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h3 className="text-base font-bold">Fotovoltaico</h3>
				<button
					type="button"
					onClick={toggleEditing}
					className="text-xs underline underline-offset-2"
					style={{ color: 'var(--color-duet-accent)' }}
				>
					{kwp != null ? `${String(kwp).replace('.', ',')} kWp` : 'Imposta impianto'}
				</button>
			</div>

			{isEditing && (
				<div className="mb-3 flex items-center gap-2">
					<label htmlFor="pv-kwp" className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>
						Potenza impianto
					</label>
					<input
						id="pv-kwp"
						type="text"
						inputMode="decimal"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && save()}
						placeholder="3,0"
						className="w-20 rounded-md px-2 py-1 text-sm tabular-nums"
						style={{
							background: 'var(--color-duet-bg)',
							border: '1px solid var(--color-duet-border)',
							color: 'var(--color-duet-ink)',
						}}
					/>
					<span className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>
						kWp
					</span>
					<button
						type="button"
						onClick={save}
						className="rounded-md px-2 py-1 text-xs font-semibold"
						style={{ background: 'var(--color-duet-accent-soft)', color: 'var(--color-duet-accent)' }}
					>
						Salva
					</button>
				</div>
			)}

			<p className="text-sm font-medium">
				{bestEnergy != null
					? `Giornata migliore: ${formatKwh(bestEnergy)} ${dayLabel(best.date).toLowerCase()}`
					: `Giornata migliore: ${formatSpecificYield(best.kwh_per_kwp)}`}
			</p>

			<ul className="mt-4 flex flex-col gap-2">
				{solar.days.map((day) => {
					const energy = dayEnergyKwh(day, kwp);
					return (
						<li key={day.date} className="flex items-baseline gap-3">
							<span
								className="w-16 shrink-0 text-sm capitalize"
								style={{ color: 'var(--color-duet-muted)' }}
							>
								{dayLabel(day.date)}
							</span>

							{/* La barra rende confrontabili i giorni a colpo d'occhio,
							    cosa che una colonna di numeri non fa. */}
							<span
								className="h-1.5 flex-1 overflow-hidden rounded-full"
								style={{ background: 'var(--color-duet-accent-soft)' }}
								aria-hidden="true"
							>
								<span
									className="block h-full rounded-full"
									style={{
										width: `${Math.round((day.kwh_per_kwp / best.kwh_per_kwp) * 100)}%`,
										background: '#F5A623',
									}}
								/>
							</span>

							{day.sunshine_hours != null && (
								<span className="text-xs" style={{ color: 'var(--color-duet-faint)' }}>
									{Math.round(day.sunshine_hours)} h sole
								</span>
							)}

							<span className="w-24 text-right text-sm font-semibold tabular-nums">
								{energy != null ? formatKwh(energy) : formatSpecificYield(day.kwh_per_kwp)}
							</span>
						</li>
					);
				})}
			</ul>

			<p className="mt-3 text-[11px]" style={{ color: 'var(--color-duet-faint)' }}>
				{assumptionsNote(solar)}
				{kwp == null && ' Imposta la potenza per vedere i kWh.'}
			</p>
		</motion.div>
	);
}
