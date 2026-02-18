'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ForecastCurrent } from '@/lib/types';
import { getConditionLabel } from '@/lib/weather-utils';
import WeatherIcon from './WeatherIcon';

import WeatherEffects from './WeatherEffects';

interface CurrentWeatherProps {
	data: ForecastCurrent;
	locationName: string;
	sourcesCount: number;
	isDay: boolean;
}

export default function CurrentWeather({ data, locationName, sourcesCount, isDay }: CurrentWeatherProps) {
	return (
		<motion.section
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6 }}
			className="glass-strong p-6 sm:p-8 text-white text-center relative overflow-hidden"
		>
			{/* Weather Effects Background */}
			<WeatherEffects condition={data.condition} isDay={isDay} />

			{/* Content Container - Ensure z-index is above effects */}
			<div className="relative z-10">
				{/* Location */}
				<p className="text-white/70 text-sm mb-1 tracking-wide uppercase">{locationName}</p>

				{/* Condition icon & text */}
				<div className="flex items-center justify-center gap-3 mb-2">
					<WeatherIcon condition={data.condition} className="w-12 h-12 text-white/90 drop-shadow-lg" />
					<span className="text-lg font-medium text-white/80">{getConditionLabel(data.condition)}</span>
				</div>

				{/* Main temperature - bolder */}
				<motion.div
					key={data.temperature}
					initial={{ scale: 0.8, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ duration: 0.4, type: 'spring' }}
					className="mb-1"
				>
					<span className="text-8xl sm:text-9xl font-bold tracking-tighter">
						{data.temperature !== null ? Math.round(data.temperature) : '--'}
					</span>
					<span className="text-3xl font-semibold align-top ml-1">°C</span>
				</motion.div>

				{/* Feels like */}
				<p className="text-white/60 text-sm mb-6">
					Percepita: {data.feels_like !== null ? `${Math.round(data.feels_like)}°C` : '--'}
				</p>

				{/* Elegant separator */}
				<div className="flex items-center gap-3 max-w-xs mx-auto mb-6">
					<div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
					<div className="w-1.5 h-1.5 rounded-full bg-white/20" />
					<div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
				</div>

				{/* Interactive stats row */}
				<div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
					<FlippableStat
						frontLabel="Umidita"
						frontValue={data.humidity !== null ? `${Math.round(data.humidity)}%` : '--'}
						backLabel="Punto di rugiada"
						backValue={data.dew_point !== null ? `${data.dew_point}°C` : '--'}
						icon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21c-4.97 0-9-3.582-9-8 0-4.418 9-13 9-13s9 8.582 9 13c0 4.418-4.03 8-9 8z" />
							</svg>
						}
						backIcon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21c-4.97 0-9-3.582-9-8 0-4.418 9-13 9-13s9 8.582 9 13c0 4.418-4.03 8-9 8z" />
								<circle cx="12" cy="15" r="2" strokeWidth={1.5} />
							</svg>
						}
					/>
					<FlippableStat
						frontLabel="Vento"
						frontValue={data.wind_speed !== null ? `${data.wind_speed.toFixed(1)} m/s` : '--'}
						backLabel={data.wind_direction_label ? `Raffica ${data.wind_direction_label}` : 'Raffica'}
						backValue={data.wind_gust !== null ? `${data.wind_gust.toFixed(1)} m/s` : '--'}
						icon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
							</svg>
						}
						backIcon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
							</svg>
						}
					/>
					<FlippableStat
						frontLabel="Precipitaz."
						frontValue={`${Math.round(data.precipitation_prob)}%`}
						backLabel="Qualita aria"
						backValue={data.aqi !== null ? `${Math.round(data.aqi)}` : '--'}
						backExtra={data.aqi !== null ? { text: getAqiLabel(data.aqi), className: getAqiColor(data.aqi) } : undefined}
						icon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
							</svg>
						}
						backIcon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						}
					/>
				</div>

				{/* Sources badge */}
				<div className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-xs text-white/60">
					<div className="w-2 h-2 rounded-full bg-green-400" />
					Aggregato da {sourcesCount} fonti
				</div>
			</div>
		</motion.section>
	);
}

interface FlippableStatProps {
	frontLabel: string;
	frontValue: string;
	backLabel: string;
	backValue: string;
	backExtra?: { text: string; className: string };
	icon: React.ReactNode;
	backIcon: React.ReactNode;
}

function FlippableStat({ frontLabel, frontValue, backLabel, backValue, backExtra, icon, backIcon }: FlippableStatProps) {
	const [flipped, setFlipped] = useState(false);

	return (
		<div
			className="relative cursor-pointer select-none"
			style={{ perspective: '600px' }}
			onClick={() => setFlipped(f => !f)}
		>
			<motion.div
				animate={{ rotateY: flipped ? 180 : 0 }}
				transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
				style={{ transformStyle: 'preserve-3d' }}
				className="relative"
			>
				{/* Front face */}
				<div
					className="flex flex-col items-center gap-1"
					style={{ backfaceVisibility: 'hidden' }}
				>
					<div className="text-white/40">{icon}</div>
					<span className="text-lg font-semibold">{frontValue}</span>
					<span className="text-xs text-white/50">{frontLabel}</span>
				</div>

				{/* Back face */}
				<AnimatePresence>
					{flipped && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2, delay: 0.15 }}
							className="absolute inset-0 flex flex-col items-center gap-1"
							style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
						>
							<div className="text-white/40">{backIcon}</div>
							<span className="text-lg font-semibold">{backValue}</span>
							{backExtra && (
								<span className={`text-[10px] font-medium ${backExtra.className}`}>{backExtra.text}</span>
							)}
							<span className="text-xs text-white/50">{backLabel}</span>
						</motion.div>
					)}
				</AnimatePresence>
			</motion.div>

			{/* Tap hint dot */}
			<div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-white/20" />
		</div>
	);
}
