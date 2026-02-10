'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ForecastCurrent, DailyForecast } from '@/lib/types';
import { getWMOWeatherInfo } from '@/lib/weather-utils';

interface ForecastDetailsProps {
	data: ForecastCurrent;
	daily?: DailyForecast[];
}

export default function ForecastDetails({ data, daily }: ForecastDetailsProps) {
	const [isOpen, setIsOpen] = useState(false);

	// Helper to format date
	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6, delay: 0.2 }}
			className="glass p-4 sm:p-6 text-white"
		>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between"
			>
				<span className="font-medium text-base">Dettagli previsione</span>
				<motion.svg
					animate={{ rotate: isOpen ? 180 : 0 }}
					transition={{ duration: 0.3 }}
					className="w-5 h-5 text-white/60"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</motion.svg>
			</button>

			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.3 }}
						className="overflow-hidden"
					>
						<div className="pt-4 space-y-4">
							{/* Daily Forecast */}
							{daily && daily.length > 0 && (
								<div className="mb-6">
									<h3 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">Prossimi 6 Giorni</h3>
									<div className="space-y-2">
										{/* Headers */}
										<div className="flex items-center text-xs text-white/40 px-2 pb-1">
											<div className="w-16">Giorno</div>
											<div className="flex-1 text-center">Condizione</div>
											<div className="w-16 text-center">Pioggia</div>
											<div className="w-20 text-right">Temp</div>
										</div>
										{/* Filter out today if present (it's already detailed above), but user might want to see trend. 
										    Usually "Next days" implies starting from tomorrow. 
										    We'll skip index 0 if it is today, or just show all. 
										    SmartEngine returns today as well usually. 
										    Let's show starting from index 1 (Tomorrow).
										    If we have 7 days total, skipping 1 leaves 6 days. Perfect.
										*/}
										{daily.slice(1).map((day) => (
											<div key={day.date} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
												<div className="w-16 font-medium text-white/90">{formatDate(day.date)}</div>



												<div className="flex-1 flex flex-col items-center">
													{(() => {
														const info = getWMOWeatherInfo(day.condition_code);
														return (
															<div className="flex items-center gap-2">
																<span className="text-xl" role="img" aria-label={info.label}>{info.icon}</span>
																<span className="text-sm text-white/90">{info.label}</span>
															</div>
														);
													})()}
												</div>

												<div className="w-16 flex justify-center">
													{day.precipitation_prob !== null && day.precipitation_prob > 0 ? (
														<div className="flex items-center text-sm text-blue-300 font-medium">
															<svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
															</svg>
															{Math.round(day.precipitation_prob)}%
														</div>
													) : (
														<span className="text-white/20 text-sm">-</span>
													)}
												</div>

												<div className="w-20 text-right flex items-center justify-end gap-2">
													<span className="font-bold text-lg">{Math.round(day.temp_max ?? 0)}°</span>
													<span className="text-white/40 text-sm">{Math.round(day.temp_min ?? 0)}°</span>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Precipitation bar */}
							<div>
								<div className="flex justify-between text-sm mb-1.5">
									<span className="text-white/60">Probabilita precipitazione (Oggi)</span>
									<span className="font-medium">{Math.round(data.precipitation_prob)}%</span>
								</div>
								<div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
									<motion.div
										initial={{ width: 0 }}
										animate={{ width: `${data.precipitation_prob}%` }}
										transition={{ duration: 0.6, delay: 0.1 }}
										className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
									/>
								</div>
							</div>

							{/* Humidity bar */}
							<div>
								<div className="flex justify-between text-sm mb-1.5">
									<span className="text-white/60">Umidita</span>
									<span className="font-medium">{data.humidity !== null ? `${Math.round(data.humidity)}%` : '--'}</span>
								</div>
								<div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
									<motion.div
										initial={{ width: 0 }}
										animate={{ width: `${data.humidity ?? 0}%` }}
										transition={{ duration: 0.6, delay: 0.2 }}
										className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500"
									/>
								</div>
							</div>

							{/* Wind detail */}
							<div className="flex items-center justify-between py-2 border-t border-white/10">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
										<svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
										</svg>
									</div>
									<div>
										<div className="text-sm font-medium">Vento</div>
										<div className="text-xs text-white/50">Velocita e direzione</div>
									</div>
								</div>
								<div className="text-right">
									<div className="font-semibold">
										{data.wind_speed !== null ? `${data.wind_speed.toFixed(1)} m/s` : '--'}
									</div>
								</div>
							</div>

							{/* Temperature detail */}
							<div className="flex items-center justify-between py-2 border-t border-white/10">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
										<svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
									</div>
									<div>
										<div className="text-sm font-medium">Temperatura (Oggi)</div>
										<div className="text-xs text-white/50">Effettiva vs percepita</div>
									</div>
								</div>
								<div className="text-right">
									<div className="font-semibold">
										{data.temperature !== null ? `${data.temperature}°C` : '--'}
									</div>
									<div className="text-xs text-white/50">
										Percepita {data.feels_like !== null ? `${data.feels_like}°C` : '--'}
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}
