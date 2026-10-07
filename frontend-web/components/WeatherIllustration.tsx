'use client';

import { useId } from 'react';
import type { WeatherCondition } from '@/lib/types';

interface WeatherIllustrationProps {
	condition: WeatherCondition | string;
	isDay: boolean;
	className?: string;
}

/**
 * Illustrazione a colori della condizione attuale, accanto alla temperatura.
 *
 * Non sostituisce `WeatherIcon`, che resta l'icona a tratto usata nelle liste:
 * qui serve un segno che si legga da lontano, e nel blu notte del fondo un
 * tratto monocromo sparirebbe. Sole e luna dipendono da `isDay`; la nuvola
 * cambia tono con la condizione (bianca, grigia, scura per il temporale).
 *
 * Gli id dei gradienti passano da `useId`: due illustrazioni sulla stessa
 * pagina con gli stessi id si ruberebbero i colori a vicenda.
 */
export default function WeatherIllustration({ condition, isDay, className = 'w-20 h-20' }: WeatherIllustrationProps) {
	const uid = useId().replace(/:/g, '');
	const ids = {
		sun: `sun-${uid}`,
		moon: `moon-${uid}`,
		cloud: `cloud-${uid}`,
		dark: `dark-${uid}`,
		mask: `mask-${uid}`,
	};

	const c = String(condition).toLowerCase();
	const hasCloud = c !== 'clear';
	const stormy = c === 'storm';
	const showsSky = c === 'clear' || c === 'cloudy' || c === 'unknown' || c === 'fog';

	const CLOUD = 'M16 50 H46 A10 10 0 0 0 46 30 A12 12 0 0 0 22 30 A10.5 10.5 0 0 0 16 50 Z';

	// Luna: al centro col sereno, dietro la nuvola altrimenti. La falce si
	// ottiene togliendo un disco spostato in alto a destra; le coordinate sono
	// calcolate qui e non con un `transform`, che sposterebbe anche la maschera.
	const moon = c === 'clear' ? { x: 30, y: 33, r: 17 } : { x: 40, y: 20, r: 13 };
	const bite = { x: moon.x + moon.r * 0.55, y: moon.y - moon.r * 0.4, r: moon.r * 0.85 };

	return (
		<svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true">
			<defs>
				<radialGradient id={ids.sun} cx="40%" cy="40%" r="65%">
					<stop offset="0%" stopColor="#fde68a" />
					<stop offset="55%" stopColor="#fbbf24" />
					<stop offset="100%" stopColor="#f59e0b" />
				</radialGradient>
				<linearGradient id={ids.moon} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stopColor="#fef3c7" />
					<stop offset="100%" stopColor="#fbbf24" />
				</linearGradient>
				<linearGradient id={ids.cloud} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="#f8fafc" />
					<stop offset="100%" stopColor="#94a3b8" />
				</linearGradient>
				<linearGradient id={ids.dark} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="#94a3b8" />
					<stop offset="100%" stopColor="#334155" />
				</linearGradient>
				<mask id={ids.mask}>
					<rect width="64" height="64" fill="white" />
					<circle cx={bite.x} cy={bite.y} r={bite.r} fill="black" />
				</mask>
			</defs>

			{/* Astro: pieno col sereno, dietro la nuvola col coperto */}
			{showsSky &&
				(isDay ? (
					<g>
						{c === 'clear' && (
							<g stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
								{Array.from({ length: 8 }, (_, i) => {
									const a = (i * Math.PI) / 4;
									const cx = 32;
									const cy = 32;
									return (
										<line
											key={i}
											x1={cx + Math.cos(a) * 20}
											y1={cy + Math.sin(a) * 20}
											x2={cx + Math.cos(a) * 26}
											y2={cy + Math.sin(a) * 26}
										/>
									);
								})}
							</g>
						)}
						<circle
							cx={c === 'clear' ? 32 : 40}
							cy={c === 'clear' ? 32 : 22}
							r={c === 'clear' ? 15 : 12}
							fill={`url(#${ids.sun})`}
						/>
					</g>
				) : (
					<circle cx={moon.x} cy={moon.y} r={moon.r} fill={`url(#${ids.moon})`} mask={`url(#${ids.mask})`} />
				))}

			{hasCloud && (
				<path
					d={CLOUD}
					fill={`url(#${stormy ? ids.dark : ids.cloud})`}
					transform="translate(-4 -2)"
				/>
			)}

			{(c === 'rain' || stormy) && (
				<g stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round">
					<line x1="20" y1="53" x2="17" y2="60" />
					<line x1="30" y1="53" x2="27" y2="60" />
					{!stormy && <line x1="40" y1="53" x2="37" y2="60" />}
				</g>
			)}

			{stormy && <path d="M38 44 L32 54 H37 L33 63 L44 50 H39 L42 44 Z" fill="#facc15" />}

			{c === 'snow' && (
				<g fill="#e0f2fe">
					<circle cx="20" cy="56" r="2.2" />
					<circle cx="30" cy="59" r="2.2" />
					<circle cx="40" cy="56" r="2.2" />
				</g>
			)}

			{c === 'fog' && (
				<g stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
					<line x1="12" y1="54" x2="44" y2="54" />
					<line x1="18" y1="60" x2="50" y2="60" />
				</g>
			)}
		</svg>
	);
}
