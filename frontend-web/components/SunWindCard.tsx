'use client';

import type { AstronomyData, ForecastCurrent } from '@/lib/types';
import { useEffect, useId, useState } from 'react';

interface SunWindCardProps {
	astronomy?: AstronomyData;
	current?: ForecastCurrent;
}

const formatTime = (iso?: string) =>
	iso ? new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '--:--';

/**
 * Tacche accese del barometro, su dieci.
 *
 * La scala va da 980 a 1040 hPa: sotto i 980 è già una depressione profonda,
 * sopra i 1040 un anticiclone eccezionale, e allargarla appiattirebbe le
 * variazioni ordinarie — quelle fra 1005 e 1025 — in una o due tacche.
 */
export function pressureBars(pressure: number | null | undefined, total = 10): number {
	if (pressure == null) return 0;
	const ratio = (pressure - 980) / (1040 - 980);
	return Math.max(1, Math.min(total, Math.round(ratio * total)));
}

export default function SunWindCard({ astronomy, current }: SunWindCardProps) {
	const gradientId = `sunarc-${useId().replace(/:/g, '')}`;
	/*
	  L'ora corrente è stato, non un valore letto durante il render: aggiornata
	  ogni minuto, così il sole avanza sull'arco anche a pagina aperta, e la
	  posizione resta un dato derivato invece di uno stato da sincronizzare.
	*/
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(id);
	}, []);

	// 0..100 sull'arco. Prima dell'alba il sole aspetta all'inizio, dopo il
	// tramonto sta alla fine: a mezzanotte non è «all'alba».
	let sunPosition = 0;
	if (astronomy) {
		const sunrise = new Date(astronomy.sunrise).getTime();
		const sunset = new Date(astronomy.sunset).getTime();
		if (!isNaN(sunrise) && !isNaN(sunset) && sunset > sunrise) {
			if (now >= sunset) sunPosition = 100;
			else if (now > sunrise) sunPosition = ((now - sunrise) / (sunset - sunrise)) * 100;
		}
	}

	// Arco a semicerchio: da sunrise (sinistra, 180°) a sunset (destra, 0°).
	const radius = 92;
	const cx = 130;
	const cy = 112;
	const startX = cx - radius;
	const endX = cx + radius;
	const angle = Math.PI - (sunPosition / 100) * Math.PI;
	const sunX = cx + radius * Math.cos(angle);
	const sunY = cy - radius * Math.sin(angle);

	const bars = pressureBars(current?.pressure);

	return (
		<section className="glass p-5" style={{ color: 'var(--color-duet-ink)' }} aria-label="Sole e vento">
			<h3 className="text-base font-bold">Sole &amp; Vento</h3>

			<svg width="100%" height="140" viewBox="0 0 260 130" style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor="#7dd3fc" />
						<stop offset="55%" stopColor="#e0f2fe" />
						<stop offset="100%" stopColor="#fbbf24" />
					</linearGradient>
				</defs>

				{/* Arco intero, spento: la strada che il sole deve ancora fare */}
				<path
					d={`M ${startX} ${cy} A ${radius} ${radius} 0 0 1 ${endX} ${cy}`}
					fill="none"
					stroke="var(--color-duet-border-strong)"
					strokeWidth="2"
					strokeLinecap="round"
				/>
				{/* Freccia al tramonto */}
				<path
					d={`M ${endX - 5} ${cy - 7} L ${endX} ${cy} L ${endX + 5} ${cy - 7}`}
					fill="none"
					stroke="var(--color-duet-border-strong)"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>

				{/* Tratto percorso, sfumato dall'azzurro dell'alba all'oro */}
				{sunPosition > 0 && (
					<path
						d={`M ${startX} ${cy} A ${radius} ${radius} 0 0 1 ${sunX.toFixed(1)} ${sunY.toFixed(1)}`}
						fill="none"
						stroke={`url(#${gradientId})`}
						strokeWidth="3"
						strokeLinecap="round"
						style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.35))' }}
					/>
				)}

				{/* Sole all'alba */}
				<g transform={`translate(${startX} ${cy})`}>
					<g stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
						{Array.from({ length: 8 }, (_, i) => {
							const a = (i * Math.PI) / 4;
							return <line key={i} x1={Math.cos(a) * 10} y1={Math.sin(a) * 10} x2={Math.cos(a) * 14} y2={Math.sin(a) * 14} />;
						})}
					</g>
					<circle r="7.5" fill="#fbbf24" />
				</g>

				{/* Posizione attuale */}
				<circle cx={sunX} cy={sunY} r="6" fill="#fbbf24" stroke="#fde68a" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.7))' }} />
			</svg>

			<div className="mb-4 mt-1 flex justify-between text-[13px]" style={{ color: 'var(--color-duet-ink-soft)' }}>
				<span>Alba {formatTime(astronomy?.sunrise)}</span>
				<span>Tramonto {formatTime(astronomy?.sunset)}</span>
			</div>

			<div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: '1px solid var(--color-duet-border)' }}>
				<div>
					<div className="card-label mb-1 text-[12px]" style={{ color: 'var(--color-duet-muted)' }}>Vento</div>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<span className="whitespace-nowrap text-xl font-bold tabular-nums">
							{current?.wind_speed != null ? current.wind_speed.toFixed(1) : '--'} m/s
							{current?.wind_direction_label && <span className="ml-1.5">{current.wind_direction_label}</span>}
						</span>
						<svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="var(--color-duet-muted)" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
							<path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12h15.5a2.5 2.5 0 1 1-2.5 2.5M3 16h8a2.5 2.5 0 1 1-2.5 2.5" />
						</svg>
					</div>
				</div>
				<div>
					<div className="card-label mb-1 text-[12px]" style={{ color: 'var(--color-duet-muted)' }}>Barometro</div>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<span className="whitespace-nowrap text-xl font-bold tabular-nums">
							{current?.pressure != null ? Math.round(current.pressure) : '--'} mBar
						</span>
						{/* Barometro a tacche: quante sono accese dice dove sta la pressione nella scala */}
						<span
							className="flex h-5 items-end gap-[3px]"
							role="img"
							aria-label={`Pressione: ${bars} tacche su 10`}
						>
							{Array.from({ length: 10 }, (_, i) => (
								<span
									key={i}
									className="w-[3px] rounded-full"
									style={{
										height: `${40 + i * 6}%`,
										background: i < bars ? 'var(--color-duet-green)' : 'var(--color-duet-border-strong)',
									}}
								/>
							))}
						</span>
					</div>
				</div>
			</div>
		</section>
	);
}
