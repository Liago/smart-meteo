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
	/** Se passata, la cella pioggia di ogni giorno apre il dettaglio precipitazioni. */
	onPrecipitationClick?: (date: string) => void;
}

export default function ForecastDetails({ daily, hourly, onPrecipitationClick }: ForecastDetailsProps) {
	const [expandedDate, setExpandedDate] = useState<string | null>(null);

	const toggleDay = (date: string) => {
		setExpandedDate(prev => (prev === date ? null : date));
	};

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
	};

	if (!daily || daily.length === 0) return null;

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6, delay: 0.2 }}
			className="glass p-6"
			style={{ color: 'var(--color-duet-ink)' }}
		>
			<h3 className="text-[13px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-duet-muted)' }}>
				Prossimi 6 giorni
			</h3>

			<div className="flex flex-col">
				{/*
				  Skippa oggi (già dettagliato in CurrentWeather): partendo da domani su
				  7 giorni totali dal backend restano esattamente i 6 del titolo.
				*/}
				{daily.slice(1).map((day) => (
					<div key={day.date} style={{ borderTop: '1px solid #eef2f6' }}>
						<div className="w-full flex items-center justify-between gap-2">
							<button
								onClick={() => toggleDay(day.date)}
								className="dt-row flex-1 flex items-center gap-4 py-3.5 px-2.5 rounded-lg text-left min-w-0"
								aria-expanded={expandedDate === day.date}
							>
								<span className="w-16 font-semibold text-sm shrink-0">{formatDate(day.date)}</span>
								{(() => {
									const info = getWMOWeatherInfo(day.condition_code);
									return (
										<span className="w-6 flex justify-center shrink-0">
											<WeatherIcon code={day.condition_code} className="w-[19px] h-[19px]" style={{ color: 'var(--color-duet-accent)' }} />
											<span className="sr-only">{info.label}</span>
										</span>
									);
								})()}
								<span className="flex-1 text-[13px] truncate hidden sm:inline" style={{ color: 'var(--color-duet-muted)' }}>
									{getWMOWeatherInfo(day.condition_code).label}
								</span>
							</button>

							{(() => {
								const cell =
									day.precipitation_prob !== null && day.precipitation_prob > 0 ? (
										<div className="flex flex-col items-center">
											<span className="text-[13px] font-medium" style={{ color: 'var(--color-duet-accent)' }}>
												{Math.round(day.precipitation_prob)}%
											</span>
											{day.precipitation_mm != null && day.precipitation_mm > 0 && (
												<span className="text-[10px]" style={{ color: 'var(--color-duet-muted)' }}>
													{day.precipitation_mm.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mm
												</span>
											)}
										</div>
									) : (
										<span className="text-sm" style={{ color: 'var(--color-duet-faint)' }}>—</span>
									);

								if (!onPrecipitationClick) {
									return <div className="w-16 flex justify-center shrink-0">{cell}</div>;
								}
								return (
									<button
										type="button"
										onClick={() => onPrecipitationClick(day.date.slice(0, 10))}
										aria-label={`Dettaglio precipitazioni di ${formatDate(day.date)}`}
										className="dt-row w-16 flex justify-center py-1.5 shrink-0 rounded-lg transition-colors"
									>
										{cell}
									</button>
								);
							})()}

							<button
								onClick={() => toggleDay(day.date)}
								className="dt-row w-24 sm:w-28 text-right flex items-center justify-end gap-2 py-3.5 pr-2 shrink-0 rounded-lg"
								aria-expanded={expandedDate === day.date}
								aria-label={`Mostra dettaglio orario di ${formatDate(day.date)}`}
							>
								<span className="font-bold text-[15px]">{Math.round(day.temp_max ?? 0)}°</span>
								<span className="text-sm" style={{ color: 'var(--color-duet-border-strong)' }}>{Math.round(day.temp_min ?? 0)}°</span>
								<motion.svg
									animate={{ rotate: expandedDate === day.date ? 180 : 0 }}
									transition={{ duration: 0.3 }}
									className="w-4 h-4 ml-1"
									fill="none"
									stroke="var(--color-duet-border-strong)"
									viewBox="0 0 24 24"
								>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
								</motion.svg>
							</button>
						</div>

						<AnimatePresence>
							{expandedDate === day.date && (
								<motion.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: 'auto', opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{ duration: 0.3 }}
									style={{ overflow: 'hidden' }}
								>
									<div className="pb-4">
										{(() => {
											if (!hourly) return <div className="text-center py-4 text-sm" style={{ color: 'var(--color-duet-muted)' }}>Dati orari non disponibili</div>;

											const datePrefix = day.date.slice(0, 10);
											const dayHourly = hourly.filter(h => h.time.startsWith(datePrefix));

											if (dayHourly.length === 0) {
												return <div className="text-center py-4 text-sm" style={{ color: 'var(--color-duet-muted)' }}>Dati orari non disponibili per questa data</div>;
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
		</motion.div>
	);
}
