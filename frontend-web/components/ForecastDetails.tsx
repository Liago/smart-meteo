'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ForecastCurrent, DailyForecast, HourlyForecast as HourlyForecastType, AstronomyData } from '@/lib/types';
import { getWMOWeatherInfo } from '@/lib/weather-utils';
import HourlyForecast from './HourlyForecast';
import WeatherIcon from './WeatherIcon';

interface ForecastDetailsProps {
	data: ForecastCurrent;
	daily?: DailyForecast[];
	hourly?: HourlyForecastType[];
	astronomy?: AstronomyData;
}

export default function ForecastDetails({ data, daily, hourly, astronomy }: ForecastDetailsProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [expandedDate, setExpandedDate] = useState<string | null>(null);

	const toggleDay = (date: string) => {
		if (expandedDate === date) {
			setExpandedDate(null);
		} else {
			setExpandedDate(date);
		}
	};

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
						<div className="pt-4 space-y-6">
							{/* Astronomy Section */}
							{astronomy && (
								<div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-white/5">
									<div className="flex flex-col items-center text-center">
										<div className="text-white/40 text-xs mb-1 uppercase tracking-wider">Alba</div>
										<div className="text-2xl mb-1">🌅</div>
										<div className="font-medium text-lg">{astronomy.sunrise ? new Date(astronomy.sunrise).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
									</div>
									<div className="flex flex-col items-center text-center">
										<div className="text-white/40 text-xs mb-1 uppercase tracking-wider">Tramonto</div>
										<div className="text-2xl mb-1">🌇</div>
										<div className="font-medium text-lg">{astronomy.sunset ? new Date(astronomy.sunset).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
									</div>
									<div className="flex flex-col items-center text-center">
										<div className="text-white/40 text-xs mb-1 uppercase tracking-wider">Luna</div>
										<div className="text-2xl mb-1">🌑</div>
										<div className="font-medium text-sm leading-tight">{astronomy.moon_phase || 'N/D'}</div>
									</div>
								</div>
							)}

							{/* Daily Forecast */}
							{daily && daily.length > 0 && (
								<div>
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
											<div key={day.date} className="rounded-lg bg-white/5 overflow-hidden transition-colors hover:bg-white/10">
												<button
													onClick={() => toggleDay(day.date)}
													className="w-full flex items-center justify-between p-3"
												>
													<div className="w-16 font-medium text-white/90 text-left">{formatDate(day.date)}</div>

													<div className="flex-1 flex flex-col items-center">
														{(() => {
															const info = getWMOWeatherInfo(day.condition_code);
															return (
																<div className="flex items-center gap-2">
																	<WeatherIcon code={day.condition_code} className="w-6 h-6 text-white/90" />
																	<span className="text-sm text-white/90 hidden sm:inline">{info.label}</span>
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
														<motion.svg
															animate={{ rotate: expandedDate === day.date ? 180 : 0 }}
															transition={{ duration: 0.3 }}
															className="w-4 h-4 text-white/40 ml-1"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
														</motion.svg>
													</div>
												</button>

												<AnimatePresence>
													{expandedDate === day.date && (
														<motion.div
															initial={{ height: 0, opacity: 0 }}
															animate={{ height: 'auto', opacity: 1 }}
															exit={{ height: 0, opacity: 0 }}
															transition={{ duration: 0.3 }}
														>
															<div className="p-2 border-t border-white/10">
																{(() => {
																	if (!hourly) return <div className="text-center text-white/40 py-4">Dati orari non disponibili</div>;

																	const dayStart = new Date(day.date).setHours(0, 0, 0, 0);
																	const dayEnd = new Date(day.date).setHours(23, 59, 59, 999);

																	const dayHourly = hourly.filter(h => {
																		const t = new Date(h.time).getTime();
																		return t >= dayStart && t <= dayEnd;
																	});

																	if (dayHourly.length === 0) {
																		return <div className="text-center text-white/40 py-4">Dati orari non disponibili per questa data</div>;
																	}

																	return (
																		<HourlyForecast
																			hourly={dayHourly}
																			mode="exact"
																			title=""
																		/>
																	);
																})()}
															</div>
														</motion.div>
													)}
												</AnimatePresence>
											</div>
										))}
									</div>
								</div>
							)}

						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}
