'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ForecastCurrent } from '@/lib/types';
import { getConditionLabel, getUvLabel, getUvColor } from '@/lib/weather-utils';
import { getAqiScale } from '@/lib/air-quality';
import WeatherIcon from './WeatherIcon';
import WeatherIllustration from './WeatherIllustration';
import AirQualityPanel from './AirQualityPanel';
import Modal from './ui/Modal';

interface CurrentWeatherProps {
	data: ForecastCurrent;
	locationName: string;
	sourcesCount: number;
	/**
	 * Giorno o notte, per l'illustrazione (sole o luna). Se manca si ricava
	 * dall'ora locale del browser: un'approssimazione, ma migliore di un sole
	 * disegnato alle undici di sera.
	 */
	isDay?: boolean;
}

/* --- Icone delle tessere ------------------------------------------------- */

const ICON = 'w-[18px] h-[18px]';
const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const icons = {
	drop: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<path d="M12 21c-3.87 0-7-2.94-7-6.6C5 10.5 12 3 12 3s7 7.5 7 11.4c0 3.66-3.13 6.6-7 6.6z" />
		</svg>
	),
	dewPoint: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<path d="M12 21c-3.87 0-7-2.94-7-6.6C5 10.5 12 3 12 3s7 7.5 7 11.4c0 3.66-3.13 6.6-7 6.6z" />
			<circle cx="12" cy="15" r="2" />
		</svg>
	),
	wind: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12h15.5a2.5 2.5 0 1 1-2.5 2.5M3 16h8a2.5 2.5 0 1 1-2.5 2.5" />
		</svg>
	),
	gust: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<path d="M13 7l5 5-5 5M18 12H6" />
		</svg>
	),
	rainCloud: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<path d="M7 15a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 17.3 8 3.5 3.5 0 0 1 17 15H7z" />
			<path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" />
		</svg>
	),
	air: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<circle cx="12" cy="12" r="9" />
			<path d="M3.6 9h4.9a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2 2 2 0 0 1 2 2v4.7M14.5 3.4V6a2 2 0 0 0 2 2h4" />
		</svg>
	),
	sun: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
		</svg>
	),
	bars: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<rect x="4" y="12" width="4" height="8" rx="1" />
			<rect x="10" y="8" width="4" height="12" rx="1" />
			<rect x="16" y="4" width="4" height="16" rx="1" />
		</svg>
	),
	eye: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<path d="M2.5 12C4 7.9 7.7 5 12 5s8 2.9 9.5 7c-1.5 4.1-5.2 7-9.5 7s-8-2.9-9.5-7z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	),
	cloud: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<path d="M7 18a4.5 4.5 0 0 1-.5-8.98A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5H7z" />
		</svg>
	),
	flask: (
		<svg className={ICON} viewBox="0 0 24 24" {...STROKE}>
			<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
		</svg>
	),
};

/**
 * Colore di ogni tessera: tinta del quadratino colorato e del suo fondo.
 * Una tinta per grandezza, la stessa ovunque compaia nella pagina.
 */
const TINTS = {
	humidity: { ink: '#60a5fa', bg: 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(59,130,246,0.12))' },
	wind: { ink: '#7dd3fc', bg: 'linear-gradient(135deg, rgba(14,165,233,0.32), rgba(14,165,233,0.1))' },
	precip: { ink: '#93c5fd', bg: 'linear-gradient(135deg, rgba(37,99,235,0.38), rgba(37,99,235,0.12))' },
	uv: { ink: '#fbbf24', bg: 'linear-gradient(135deg, rgba(245,158,11,0.35), rgba(245,158,11,0.1))' },
	pressure: { ink: '#a5b4fc', bg: 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(99,102,241,0.1))' },
	clouds: { ink: '#e2e8f0', bg: 'linear-gradient(135deg, rgba(148,163,184,0.4), rgba(148,163,184,0.12))' },
} as const;

export default function CurrentWeather({ data, locationName, sourcesCount, isDay }: CurrentWeatherProps) {
	const [showAirQuality, setShowAirQuality] = useState(false);

	// La tile mostra `aqi` (media pesata fra le sorgenti), il badge della modale
	// l'indice EPA verbatim di WeatherAPI: sono due campi distinti e possono
	// differire di poco. Stessa scelta dell'app iOS.
	const tileAqi = getAqiScale(data.aqi);
	const detailAqi = getAqiScale(data.air_quality?.aqi_us_epa);

	const hour = new Date().getHours();
	const day = isDay ?? (hour >= 7 && hour < 19);

	return (
		<motion.section
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6 }}
			/*
			  `isolate`: senza un contesto di impilamento proprio, i livelli
			  interni finirebbero nella radice della pagina, allo stesso livello
			  dell'intestazione appiccicata — e a parità di z-index vince chi
			  viene dopo nel DOM. Il risultato era il nome della località
			  disegnato *sopra* ai suggerimenti della ricerca.
			*/
			className="glass relative isolate grid grid-cols-1 gap-3 p-3 sm:p-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
			style={{ color: 'var(--color-duet-ink)' }}
			aria-label="Condizioni attuali"
		>
			{/* Posizione, condizione e temperatura */}
			<div className="tile flex flex-col items-center justify-center px-4 py-6 text-center">
				<p className="card-label">{locationName}</p>

				<div className="mt-2 flex items-center justify-center gap-2">
					<WeatherIcon
						condition={data.condition}
						isNight={!day}
						className="h-5 w-5"
						style={{ color: 'var(--color-duet-accent-ink)' }}
					/>
					<span className="text-lg font-medium" style={{ color: 'var(--color-duet-ink-soft)' }}>
						{getConditionLabel(data.condition)}
					</span>
				</div>

				<motion.div
					key={data.temperature}
					initial={{ scale: 0.9, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ duration: 0.4, type: 'spring' }}
					className="mt-1 flex items-center justify-center gap-2"
				>
					<WeatherIllustration condition={data.condition} isDay={day} className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
					<span className="flex items-start">
						<span className="text-7xl font-bold leading-none tracking-tighter sm:text-8xl">
							{data.temperature !== null ? Math.round(data.temperature) : '--'}
						</span>
						<span className="ml-1 mt-1 text-2xl font-semibold">°C</span>
					</span>
				</motion.div>

				<p className="mt-3 text-sm" style={{ color: 'var(--color-duet-muted)' }}>
					Percepita: {data.feels_like !== null ? `${Math.round(data.feels_like)}°C` : '--'}
				</p>
			</div>

			{/* Le sei tessere, e sotto la provenienza */}
			<div className="flex flex-col gap-3">
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
					<FlippableStat
						tint={TINTS.humidity}
						frontLabel="Umidità"
						frontValue={data.humidity !== null ? `${Math.round(data.humidity)}%` : '--'}
						backLabel="Punto di rugiada"
						backValue={data.dew_point !== null ? `${data.dew_point}°C` : '--'}
						icon={icons.drop}
						backIcon={icons.dewPoint}
					/>
					<FlippableStat
						tint={TINTS.wind}
						frontLabel="Vento"
						frontValue={data.wind_speed !== null ? `${data.wind_speed.toFixed(1)} m/s` : '--'}
						backLabel={data.wind_direction_label ? `Raffica ${data.wind_direction_label}` : 'Raffica'}
						backValue={data.wind_gust !== null ? `${data.wind_gust.toFixed(1)} m/s` : '--'}
						icon={icons.wind}
						backIcon={icons.gust}
					/>
					<FlippableStat
						tint={TINTS.precip}
						frontLabel="Precipitaz."
						frontValue={`${Math.round(data.precipitation_prob)}%`}
						backLabel="Qualita aria"
						backValue={data.aqi !== null ? `${Math.round(data.aqi)}` : '--'}
						backExtra={data.aqi !== null ? { text: tileAqi.label, className: tileAqi.className } : undefined}
						backAction={
							data.air_quality ? (
								<button
									type="button"
									onClick={(e) => {
										// Il contenitore della tile gira la card al click:
										// senza questo il dettaglio si aprirebbe e la card
										// tornerebbe sulla faccia "Precipitaz.".
										e.stopPropagation();
										setShowAirQuality(true);
									}}
									aria-label="Dettaglio qualità dell'aria"
									className="dt-icon-btn flex h-6 w-6 items-center justify-center rounded-full"
									style={{ color: 'var(--color-duet-muted)' }}
								>
									<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<circle cx="12" cy="12" r="9" strokeWidth={1.5} />
										<path strokeLinecap="round" strokeWidth={1.5} d="M12 11v5M12 8h.01" />
									</svg>
								</button>
							) : undefined
						}
						icon={icons.rainCloud}
						backIcon={icons.air}
					/>
					<FlippableStat
						tint={TINTS.uv}
						frontLabel="UV Index"
						frontValue={data.uv_index !== null ? `${Math.round(data.uv_index)}` : '--'}
						frontExtra={data.uv_index !== null ? { text: getUvLabel(data.uv_index), className: getUvColor(data.uv_index) } : undefined}
						backLabel="UV Index"
						backValue={data.uv_index !== null ? getUvLabel(data.uv_index) : '--'}
						icon={icons.sun}
						backIcon={icons.sun}
					/>
					<FlippableStat
						tint={TINTS.pressure}
						frontLabel="Pressione"
						frontValue={data.pressure !== null ? `${Math.round(data.pressure)} mbar` : '--'}
						backLabel="Visibilita"
						backValue={data.visibility !== null ? `${data.visibility.toFixed(1)} km` : '--'}
						icon={icons.bars}
						backIcon={icons.eye}
					/>
					<FlippableStat
						tint={TINTS.clouds}
						frontLabel="Nuvole"
						frontValue={data.cloud_cover !== null ? `${Math.round(data.cloud_cover)}%` : '--'}
						backLabel={data.air_quality ? 'PM2.5' : 'Nuvole'}
						backValue={data.air_quality?.pm2_5 != null ? `${data.air_quality.pm2_5.toFixed(1)}` : '--'}
						icon={icons.cloud}
						backIcon={icons.flask}
					/>
				</div>

				<div className="flex justify-center">
					<span
						className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
						style={{
							background: 'var(--color-duet-accent-soft)',
							color: 'var(--color-duet-accent-ink)',
							border: '1px solid var(--color-duet-accent-border)',
						}}
					>
						<span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-duet-green)' }} aria-hidden="true" />
						Aggregato da {sourcesCount} fonti
					</span>
				</div>
			</div>

			<Modal
				isOpen={showAirQuality}
				onClose={() => setShowAirQuality(false)}
				title={
					<>
						<span>Qualità dell&apos;aria</span>
						<span
							className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
							style={{ backgroundColor: detailAqi.color }}
						>
							{detailAqi.label}
						</span>
					</>
				}
			>
				{data.air_quality && <AirQualityPanel data={data.air_quality} />}
			</Modal>
		</motion.section>
	);
}

interface FlippableStatProps {
	tint: { ink: string; bg: string };
	frontLabel: string;
	frontValue: string;
	frontExtra?: { text: string; className: string };
	backLabel: string;
	backValue: string;
	backExtra?: { text: string; className: string };
	icon: React.ReactNode;
	backIcon: React.ReactNode;
	/** Controllo mostrato in alto a destra quando la card è girata. */
	backAction?: React.ReactNode;
}

/**
 * Tessera girevole: un clic mostra il dato «gemello» sul retro (umidità →
 * punto di rugiada, precipitazioni → qualità dell'aria…).
 *
 * I due quadratini in alto sono il fronte (colorato) e il retro (a tratto):
 * dicono cosa c'è dietro prima di girarla, che è l'unico modo di rendere
 * scopribile un gesto che altrimenti nessuno prova.
 */
function FlippableStat({ tint, frontLabel, frontValue, frontExtra, backLabel, backValue, backExtra, icon, backIcon, backAction }: FlippableStatProps) {
	const [flipped, setFlipped] = useState(false);

	const face = (
		label: string,
		value: string,
		extra: FlippableStatProps['frontExtra'],
		primary: React.ReactNode,
		secondary: React.ReactNode
	) => (
		<div className="flex flex-col items-start gap-2 text-left">
			<div className="flex items-center gap-1.5" aria-hidden="true">
				<span className="icon-chip" style={{ background: tint.bg, color: tint.ink, borderColor: 'transparent' }}>
					{primary}
				</span>
				<span className="icon-chip" style={{ color: 'var(--color-duet-muted)' }}>
					{secondary}
				</span>
			</div>
			<div className="leading-tight">
				<span className="whitespace-nowrap text-lg font-bold tabular-nums lg:text-xl" style={{ color: 'var(--color-duet-ink)' }}>{value}</span>
				{extra && <span className={`ml-1.5 text-xs font-semibold ${extra.className}`}>{extra.text}</span>}
			</div>
			<span className="-mt-1.5 text-[13px]" style={{ color: 'var(--color-duet-muted)' }}>{label}</span>
		</div>
	);

	return (
		<div
			className="tile relative cursor-pointer select-none p-3 transition-colors hover:border-[var(--color-duet-border-strong)]"
			style={{ perspective: '600px' }}
			onClick={() => setFlipped(f => !f)}
		>
			<motion.div
				animate={{ rotateY: flipped ? 180 : 0 }}
				transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
				style={{ transformStyle: 'preserve-3d' }}
				className="relative"
			>
				<div style={{ backfaceVisibility: 'hidden' }}>
					{face(frontLabel, frontValue, frontExtra, icon, backIcon)}
				</div>

				<AnimatePresence>
					{flipped && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2, delay: 0.15 }}
							className="absolute inset-0"
							style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
						>
							{face(backLabel, backValue, backExtra, backIcon, icon)}
						</motion.div>
					)}
				</AnimatePresence>
			</motion.div>

			{/*
			  L'azione della faccia posteriore sta fuori dal sottoalbero con
			  `preserve-3d`, o il rotateY la specchierebbe.
			*/}
			{flipped && backAction && <div className="absolute right-2 top-2">{backAction}</div>}
		</div>
	);
}
