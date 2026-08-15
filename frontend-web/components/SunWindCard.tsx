'use client';

import type { AstronomyData, ForecastCurrent } from '@/lib/types';
import { useEffect, useState } from 'react';

interface SunWindCardProps {
	astronomy?: AstronomyData;
	current?: ForecastCurrent;
}

export default function SunWindCard({ astronomy, current }: SunWindCardProps) {
	const [sunPosition, setSunPosition] = useState(0); // 0 to 100 on the arc

	useEffect(() => {
		if (astronomy) {
			const now = new Date();
			const sunrise = new Date(astronomy.sunrise);
			const sunset = new Date(astronomy.sunset);

			if (now >= sunrise && now <= sunset) {
				const totalDay = sunset.getTime() - sunrise.getTime();
				const elapsed = now.getTime() - sunrise.getTime();
				const pct = (elapsed / totalDay) * 100;
				setSunPosition(Math.max(0, Math.min(100, pct)));
			} else {
				setSunPosition(0);
			}
		}
	}, [astronomy]);

	// Arco a semicerchio: da sunrise (sinistra, 180°) a sunset (destra, 0°).
	const radius = 90;
	const centerX = 120;
	const centerY = 110;
	const angleDeg = 180 - (sunPosition / 100) * 180;
	const angleRad = (angleDeg * Math.PI) / 180;
	const sunX = Math.round(centerX + radius * Math.cos(angleRad));
	const sunY = Math.round(centerY - radius * Math.sin(angleRad));

	return (
		<div className="glass p-6" style={{ color: 'var(--color-duet-ink)' }}>
			<div className="flex justify-between items-baseline mb-3">
				<h3 className="font-bold text-base">Sole &amp; Vento</h3>
				{astronomy?.moon_phase && (
					<span className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>{astronomy.moon_phase}</span>
				)}
			</div>

			<svg width="100%" height="132" viewBox="0 0 240 122" style={{ overflow: 'visible', display: 'block' }}>
				<path
					d={`M 30 110 A 90 90 0 0 1 210 110`}
					fill="none"
					stroke="var(--color-duet-border)"
					strokeWidth="2"
					strokeLinecap="round"
				/>
				<path
					d={`M 30 110 A 90 90 0 0 1 ${sunX} ${sunY}`}
					fill="none"
					stroke="var(--color-duet-accent)"
					strokeWidth="2"
					strokeLinecap="round"
				/>
				<circle cx={sunX} cy={sunY} r="8" fill="#f7b228" stroke="#fff" strokeWidth="2" />
				<circle cx="30" cy="110" r="3" fill="var(--color-duet-border-strong)" />
				<circle cx="210" cy="110" r="3" fill="var(--color-duet-border-strong)" />
			</svg>

			<div className="flex justify-between text-xs mb-4" style={{ color: 'var(--color-duet-muted)' }}>
				<span>Alba {astronomy?.sunrise ? new Date(astronomy.sunrise).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
				<span>Tramonto {astronomy?.sunset ? new Date(astronomy.sunset).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
			</div>

			<div className="grid grid-cols-2 gap-3 pt-4" style={{ borderTop: '1px solid var(--color-duet-border)' }}>
				<div>
					<div className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-duet-muted)' }}>Vento</div>
					<div className="font-bold text-xl">
						{current?.wind_speed != null ? current.wind_speed.toFixed(1) : '--'}{' '}
						<span className="text-[13px] font-medium" style={{ color: 'var(--color-duet-muted)' }}>m/s</span>
					</div>
					<div className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>Direzione {current?.wind_direction_label || '--'}</div>
				</div>
				<div>
					<div className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-duet-muted)' }}>Barometro</div>
					<div className="font-bold text-xl">
						{current?.pressure != null ? Math.round(current.pressure) : '--'}{' '}
						<span className="text-[13px] font-medium" style={{ color: 'var(--color-duet-muted)' }}>mBar</span>
					</div>
					<div className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>Stabile</div>
				</div>
			</div>
		</div>
	);
}
