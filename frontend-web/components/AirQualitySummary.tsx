'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ForecastCurrent } from '@/lib/types';
import { getAqiScale } from '@/lib/air-quality';
import AirQualityPanel from './AirQualityPanel';
import Modal from './ui/Modal';

interface AirQualitySummaryProps {
	data: ForecastCurrent;
	sourcesCount: number;
}

/**
 * Card riassuntiva "Qualità aria" nella colonna destra del cruscotto: replica
 * l'entry point che nel design Duet sta accanto alle fonti. Apre un proprio
 * `AirQualityPanel` indipendente da quello imbarcato nella tile di
 * `CurrentWeather`, così i due punti di accesso restano ciascuno autonomo.
 */
export default function AirQualitySummary({ data, sourcesCount }: AirQualitySummaryProps) {
	const [open, setOpen] = useState(false);

	if (data.aqi == null) return null;

	const scale = getAqiScale(data.aqi);
	const detailScale = getAqiScale(data.air_quality?.aqi_us_epa ?? data.aqi);
	// L'indice è su scala EPA 1-6: la barra è proporzionata a quella, non a 0-100.
	const barWidth = `${Math.min(100, Math.max(4, Math.round((data.aqi / 6) * 100)))}%`;

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6, delay: 0.15 }}
			className="glass p-6"
		>
			<div className="flex justify-between items-center mb-3">
				<h3 className="text-base font-bold" style={{ color: 'var(--color-duet-ink)' }}>Qualita aria</h3>
				<span
					className="h-6 px-2.5 inline-flex items-center rounded-full text-xs font-semibold"
					style={{ background: 'var(--color-duet-green-bg)', color: 'var(--color-duet-green-ink)' }}
				>
					{scale.label}
				</span>
			</div>
			<div className="flex items-baseline gap-2 mb-1.5">
				<span className="text-[34px] font-bold leading-none" style={{ color: 'var(--color-duet-ink)' }}>
					{Math.round(data.aqi)}
				</span>
				<span className="text-[13px]" style={{ color: 'var(--color-duet-muted)' }}>AQI · scala EPA</span>
			</div>
			<div className="h-1.5 rounded-full overflow-hidden my-2.5 mb-4" style={{ background: 'var(--color-duet-border)' }}>
				<div className="h-full rounded-full" style={{ width: barWidth, background: scale.color }} />
			</div>
			<button
				type="button"
				onClick={() => setOpen(true)}
				disabled={!data.air_quality}
				className="dt-secondary w-full h-[42px] rounded-md text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
				style={{ background: 'var(--color-duet-surface)', border: '1px solid var(--color-duet-border-strong)', color: 'var(--color-duet-accent)' }}
			>
				Vedi dettaglio
			</button>

			<Modal
				isOpen={open}
				onClose={() => setOpen(false)}
				title={
					<>
						<span>Qualità dell&apos;aria</span>
						<span
							className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
							style={{ backgroundColor: detailScale.color }}
						>
							{detailScale.label}
						</span>
					</>
				}
			>
				{data.air_quality && <AirQualityPanel data={data.air_quality} />}
			</Modal>

			<p className="mt-3 text-[11px]" style={{ color: 'var(--color-duet-faint)' }}>Media pesata da {sourcesCount} fonti</p>
		</motion.div>
	);
}
