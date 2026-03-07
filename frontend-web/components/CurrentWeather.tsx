'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ForecastCurrent } from '@/lib/types';
import { getConditionLabel, getUvLabel, getUvColor } from '@/lib/weather-utils';
import WeatherIcon from './WeatherIcon';

import WeatherEffects from './WeatherEffects';

interface CurrentWeatherProps {
	data: ForecastCurrent;
	locationName: string;
	sourcesCount: number;
	isDay: boolean;
}

function getAqiLabel(aqi: number): string {
	if (aqi <= 1) return 'Buono';
	if (aqi <= 2) return 'Moderato';
	if (aqi <= 3) return 'Discreto';
	if (aqi <= 4) return 'Scarso';
	if (aqi <= 5) return 'Molto scarso';
	return 'Pericoloso';
}

function getAqiColor(aqi: number): string {
	if (aqi <= 1) return 'text-green-300';
	if (aqi <= 2) return 'text-yellow-300';
	if (aqi <= 3) return 'text-orange-300';
	if (aqi <= 4) return 'text-red-300';
	if (aqi <= 5) return 'text-purple-300';
	return 'text-rose-300';
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

				{/* Second stats row — UV Index, Pressure/Visibility, Cloud Cover */}
				<div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mt-4">
					<FlippableStat
						frontLabel="UV Index"
						frontValue={data.uv_index !== null ? `${Math.round(data.uv_index)}` : '--'}
						frontExtra={data.uv_index !== null ? { text: getUvLabel(data.uv_index), className: getUvColor(data.uv_index) } : undefined}
						backLabel="UV Index"
						backValue={data.uv_index !== null ? getUvLabel(data.uv_index) : '--'}
						icon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
							</svg>
						}
						backIcon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
							</svg>
						}
					/>
					<FlippableStat
						frontLabel="Pressione"
						frontValue={data.pressure !== null ? `${Math.round(data.pressure)}` : '--'}
						backLabel="Visibilita"
						backValue={data.visibility !== null ? `${data.visibility.toFixed(1)} km` : '--'}
						icon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
							</svg>
						}
						backIcon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
							</svg>
						}
					/>
					<FlippableStat
						frontLabel="Nuvole"
						frontValue={data.cloud_cover !== null ? `${Math.round(data.cloud_cover)}%` : '--'}
						backLabel={data.air_quality ? 'PM2.5' : 'Nuvole'}
						backValue={data.air_quality?.pm2_5 != null ? `${data.air_quality.pm2_5.toFixed(1)}` : '--'}
						icon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
							</svg>
						}
						backIcon={
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
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
	frontExtra?: { text: string; className: string };
	backLabel: string;
	backValue: string;
	backExtra?: { text: string; className: string };
	icon: React.ReactNode;
	backIcon: React.ReactNode;
}

function FlippableStat({ frontLabel, frontValue, frontExtra, backLabel, backValue, backExtra, icon, backIcon }: FlippableStatProps) {
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
					{frontExtra && (
						<span className={`text-[10px] font-medium ${frontExtra.className}`}>{frontExtra.text}</span>
					)}
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
