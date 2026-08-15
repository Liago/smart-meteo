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
			<p className="text-sm mb-5" style={{ color: 'var(--color-duet-ink-soft)' }}>{generateAirQualityDescription(data)}</p>

			<div className="grid grid-cols-3 gap-2.5">
				{POLLUTANTS.map((p) => {
					const value = data[p.key];
					return (
						<div key={p.key} className="rounded-lg p-3.5 text-center" style={{ background: 'var(--color-duet-bg)', border: '1px solid var(--color-duet-border)' }}>
							<div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-duet-muted)' }}>{p.label}</div>
							<div className="text-lg font-bold mt-0.5" style={{ color: 'var(--color-duet-ink)' }}>
								{value != null ? value.toFixed(1) : '--'}
							</div>
							<div className="text-[10px]" style={{ color: 'var(--color-duet-faint)' }}>µg/m³</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
