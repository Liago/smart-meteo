'use client';

import type { AirQualityDetail } from '@/lib/types';
import { POLLUTANTS, generateAirQualityDescription } from '@/lib/air-quality';

interface AirQualityPanelProps {
	data: AirQualityDetail;
}

/**
 * Contenuto della modale "Qualità dell'aria": la frase di sintesi e la griglia
 * degli inquinanti. Il badge di categoria sta nel titolo della modale, che è
 * dove `Modal` accetta nodi arbitrari.
 */
export default function AirQualityPanel({ data }: AirQualityPanelProps) {
	return (
		<div>
			<p className="text-sm text-white/70 mb-4">{generateAirQualityDescription(data)}</p>

			<div className="grid grid-cols-3 gap-3">
				{POLLUTANTS.map((p) => {
					const value = data[p.key];
					return (
						<div key={p.key} className="rounded-lg bg-white/5 p-3 text-center">
							<div className="text-xs text-white/50">{p.label}</div>
							<div className="text-lg font-semibold text-white">
								{value != null ? value.toFixed(1) : '--'}
							</div>
							<div className="text-[10px] text-white/40">µg/m³</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
