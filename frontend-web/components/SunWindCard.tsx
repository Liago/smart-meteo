'use client';

import { motion } from 'framer-motion';
import type { AstronomyData, ForecastCurrent } from '@/lib/types';
import { useEffect, useState } from 'react';

interface SunWindCardProps {
	astronomy?: AstronomyData;
	current?: ForecastCurrent;
}

export default function SunWindCard({ astronomy, current }: SunWindCardProps) {
	const [sunPosition, setSunPosition] = useState(0); // 0 to 100 on the arc
	const [isDay, setIsDay] = useState(true);

	useEffect(() => {
		if (astronomy) {
			const now = new Date();
			const sunrise = new Date(astronomy.sunrise);
			const sunset = new Date(astronomy.sunset);

			// Check if it's day or night
			if (now >= sunrise && now <= sunset) {
				setIsDay(true);
				const totalDay = sunset.getTime() - sunrise.getTime();
				const elapsed = now.getTime() - sunrise.getTime();
				const pct = (elapsed / totalDay) * 100;
				setSunPosition(Math.max(0, Math.min(100, pct)));
			} else {
				setIsDay(false);
				setSunPosition(0); // Or handle night arc? Design shows day arc.
			}
		}
	}, [astronomy]);

	// Calculate sun coordinates on the arc
	// Arc is a semi-circle (top half)
	// r = radius
	// angle goes from 180 (left) to 0 (right) or similar for SVG
	// SVG coord system: 0,0 top left.
	// Let's define an arc from left (x=20, y=100) to right (x=220, y=100), center (120, 100)
	// Radius = 100
	const radius = 90;
	const centerX = 120;
	const centerY = 110;

	// Position 0 = Sunrise (Left) -> Angle 180 deg (PI radians)
	// Position 100 = Sunset (Right) -> Angle 0 deg (0 radians)
	// Current Angle
	const angleDeg = 180 - (sunPosition / 100) * 180;
	const angleRad = (angleDeg * Math.PI) / 180;

	const sunX = centerX + radius * Math.cos(angleRad);
	const sunY = centerY - radius * Math.sin(angleRad); // Minus because SVG Y is down

	return (
		<div className="glass p-4 rounded-xl relative overflow-hidden">
			<div className="flex justify-between items-start mb-4 relative z-10">
				<h3 className="text-white font-semibold text-lg">Sole & Vento</h3>
				{astronomy?.moon_phase && (
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 rounded-full border border-white/40 bg-white/10"></div>
						<span className="text-white/80 text-sm font-medium">{astronomy.moon_phase}</span>
					</div>
				)}
			</div>

			<div className="relative h-40 w-full flex justify-center items-end mb-2">
				{/* Background Mountains (Decorative) */}
				<div
					className="absolute bottom-0 left-0 right-0 h-16 opacity-30 pointer-events-none"
					style={{
						background: 'radial-gradient(circle at 50% 100%, #555 0%, transparent 70%)',
						borderRadius: '50% 50% 0 0'
					}}
				></div>

				{/* SVG Canvas */}
				<svg width="240" height="120" viewBox="0 0 240 120" className="overflow-visible z-0">
					{/* Dashed Arc */}
					<path
						d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
						fill="none"
						stroke="rgba(255,255,255,0.3)"
						strokeWidth="2"
						strokeDasharray="6 4"
					/>

					{/* Sun Icon */}
					<motion.g
						initial={{ x: centerX - radius, y: centerY }}
						animate={{ x: sunX, y: sunY }}
						transition={{ duration: 1.5, type: 'spring' }}
					>
						<circle r="8" fill="#FDB813" filter="drop-shadow(0 0 4px rgba(253, 184, 19, 0.6))" />
						<line x1="0" y1="-12" x2="0" y2="-8" stroke="#FDB813" strokeWidth="2" />
						<line x1="0" y1="12" x2="0" y2="8" stroke="#FDB813" strokeWidth="2" />
						<line x1="-12" y1="0" x2="-8" y2="0" stroke="#FDB813" strokeWidth="2" />
						<line x1="12" y1="0" x2="8" y2="0" stroke="#FDB813" strokeWidth="2" />
						{/* Diagonals */}
						<line x1="-8.5" y1="-8.5" x2="-5.5" y2="-5.5" stroke="#FDB813" strokeWidth="2" />
						<line x1="8.5" y1="-8.5" x2="5.5" y2="-5.5" stroke="#FDB813" strokeWidth="2" />
						<line x1="-8.5" y1="8.5" x2="-5.5" y2="5.5" stroke="#FDB813" strokeWidth="2" />
						<line x1="8.5" y1="8.5" x2="5.5" y2="5.5" stroke="#FDB813" strokeWidth="2" />
					</motion.g>

					{/* Wind Turbines (Decorative) */}
					<g transform="translate(100, 110)">
						{/* Pole */}
						<line x1="0" y1="0" x2="0" y2="-50" stroke="white" strokeWidth="2" />
						{/* Blades animation */}
						<motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }} style={{ originX: "0px", originY: "-50px" }}>
							<path d="M0 -50 L-10 -75 L0 -72 Z" fill="white" />
							<path d="M0 -50 L10 -75 L2 -72 Z" fill="white" transform="rotate(120, 0, -50)" />
							<path d="M0 -50 L0 -80 L-2 -75 Z" fill="white" transform="rotate(240, 0, -50)" />
						</motion.g>
					</g>
					<g transform="translate(140, 110) scale(0.7)">
						<line x1="0" y1="0" x2="0" y2="-50" stroke="white" strokeWidth="2" />
						<motion.g animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} style={{ originX: "0px", originY: "-50px" }}>
							<path d="M0 -50 L-10 -75 L0 -72 Z" fill="white" />
							<path d="M0 -50 L10 -75 L2 -72 Z" fill="white" transform="rotate(120, 0, -50)" />
							<path d="M0 -50 L0 -80 L-2 -75 Z" fill="white" transform="rotate(240, 0, -50)" />
						</motion.g>
					</g>
				</svg>

				{/* Wind Info Overlay */}
				<div className="absolute right-4 top-1/2 -translate-y-1/2 text-right">
					<div className="mb-4">
						<div className="text-white/60 text-xs uppercase tracking-wider mb-1">Vento</div>
						<div className="text-white font-bold text-lg leading-none">
							{current?.wind_speed ? Math.round(current.wind_speed * 3.6) : '--'} <span className="text-sm font-normal">km/h</span>
						</div>
						<div className="text-white/50 text-xs">
							{/* We assume backend gives us something or calculate direction string */}
							{/* Just showing generic direction if not available in format */}
							Dir: {current?.wind_direction || '--'}°
						</div>
					</div>

					<div>
						<div className="text-white/60 text-xs uppercase tracking-wider mb-1">Barometro</div>
						<div className="text-white font-bold text-lg leading-none">
							{current?.pressure ? Math.round(current.pressure) : '--'}
						</div>
						<div className="text-white/50 text-xs">mBar</div>
					</div>
				</div>
			</div>

			<div className="flex justify-between px-2 text-xs font-medium text-white/50">
				<div>
					<div>{astronomy?.sunrise ? new Date(astronomy.sunrise).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
				</div>
				<div>
					<div>{astronomy?.sunset ? new Date(astronomy.sunset).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
				</div>
			</div>
		</div>
	);
}
