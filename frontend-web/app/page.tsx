'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DynamicBackground from '@/components/DynamicBackground';
import SearchBar from '@/components/SearchBar';
import CurrentWeather from '@/components/CurrentWeather';
import ForecastDetails from '@/components/ForecastDetails';
import HourlyForecast from '@/components/HourlyForecast';
import SourcesIndicator from '@/components/SourcesIndicator';
import SkeletonLoader from '@/components/SkeletonLoader';
import ErrorFallback from '@/components/ErrorFallback';
import AuthButton from '@/components/AuthButton';
import { useForecast } from '@/lib/hooks';
import { useLocations } from '@/lib/useLocations';

export default function Home() {
	const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
	const [locationName, setLocationName] = useState('');
	const { data, error, isLoading, mutate } = useForecast(
		coords?.lat ?? null,
		coords?.lon ?? null
	);

	const {
		homeLocation,
		savedLocations,
		saveHomeLocation,
		removeHomeLocation,
		addSavedLocation,
		removeSavedLocation,
		isSaved,
		isHome,
		isLoaded
	} = useLocations();

	// Auto-load home location on startup
	useEffect(() => {
		if (isLoaded && !coords && homeLocation) {
			setCoords({ lat: homeLocation.lat, lon: homeLocation.lon });
			setLocationName(homeLocation.name);
		}
	}, [isLoaded, homeLocation, coords]);

	const handleLocationSelect = (lat: number, lon: number, name: string) => {
		setCoords({ lat, lon });
		setLocationName(name);
	};

	const handleToggleHome = () => {
		if (!coords) return;
		if (isHome(coords.lat, coords.lon)) {
			removeHomeLocation();
		} else {
			saveHomeLocation({ id: `${coords.lat}-${coords.lon}`, name: locationName, lat: coords.lat, lon: coords.lon });
		}
	};

	const handleToggleSave = () => {
		if (!coords) return;
		if (isSaved(coords.lat, coords.lon)) {
			// Find id to remove
			const loc = savedLocations.find(l => l.lat === coords.lat && l.lon === coords.lon);
			if (loc) removeSavedLocation(loc.id);
		} else {
			addSavedLocation({ id: `${coords.lat}-${coords.lon}`, name: locationName, lat: coords.lat, lon: coords.lon });
		}
	};

	const condition = data?.current?.condition || 'unknown';

	return (
		<div className="relative min-h-screen">
			<DynamicBackground condition={condition} />

			<main className="relative z-10 max-w-lg mx-auto px-4 py-6 sm:py-10 space-y-4">
				{/* Header */}
				<header className="flex items-center justify-between mb-2">
					<div>
						<h1 className="text-2xl font-bold text-white tracking-tight">Smart Meteo</h1>
						<p className="text-white/50 text-xs">Previsioni aggregate intelligenti</p>
					</div>
					<div className="flex items-center gap-2">
						<Link
							href="/sources"
							className="p-2 rounded-lg glass hover:bg-white/20 transition-colors text-white/60 hover:text-white"
							title="Gestione fonti"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573-1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
						</Link>
						<AuthButton />
					</div>
				</header>

				{/* Search */}
				<SearchBar
					onLocationSelect={handleLocationSelect}
					isLoading={isLoading}
					savedLocations={savedLocations}
					homeLocation={homeLocation}
					onRemoveHome={removeHomeLocation}
					onRemoveSaved={removeSavedLocation}
				/>

				{/* Location Actions Toolbar */}
				{coords && (
					<div className="flex justify-end gap-2 px-1">
						<button
							onClick={handleToggleHome}
							className={`p-2 rounded-full transition-colors ${isHome(coords.lat, coords.lon)
								? 'bg-white text-yellow-500 shadow-md'
								: 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
								}`}
							title={isHome(coords.lat, coords.lon) ? "Rimuovi da Home" : "Imposta come Home"}
						>
							<svg className="w-5 h-5" fill={isHome(coords.lat, coords.lon) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
							</svg>
						</button>
						<button
							onClick={handleToggleSave}
							className={`p-2 rounded-full transition-colors ${isSaved(coords.lat, coords.lon)
								? 'bg-white text-blue-500 shadow-md'
								: 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
								}`}
							title={isSaved(coords.lat, coords.lon) ? "Rimuovi dai preferiti" : "Salva nei preferiti"}
						>
							<svg className="w-5 h-5" fill={isSaved(coords.lat, coords.lon) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
							</svg>
						</button>
					</div>
				)}

				{/* Content */}
				{!coords && !data && (
					<div className="glass p-8 text-center text-white">
						<div className="text-5xl mb-4">{'\uD83C\uDF24\uFE0F'}</div>
						<h2 className="text-xl font-semibold mb-2">Benvenuto su Smart Meteo</h2>
						<p className="text-white/60 text-sm">
							Cerca una localita o usa la geolocalizzazione per vedere le previsioni aggregate da 5 fonti meteo professionali.
						</p>
					</div>
				)}

				{isLoading && <SkeletonLoader />}

				{error && (
					<ErrorFallback
						message={error.message || 'Impossibile caricare le previsioni'}
						onRetry={() => mutate()}
					/>
				)}

				{data && !isLoading && (
					<>
						<CurrentWeather
							data={data.current}
							locationName={locationName}
							sourcesCount={data.sources_used.length}
						/>
						{data.hourly && (
							<HourlyForecast hourly={data.hourly} astronomy={data.astronomy} current={data.current} />
						)}
						<ForecastDetails data={data.current} daily={data.daily} hourly={data.hourly} astronomy={data.astronomy} />
						<SourcesIndicator sources={data.sources_used} />

						{/* Timestamp */}
						<p className="text-center text-white/30 text-xs">
							Aggiornato: {new Date(data.generated_at).toLocaleString('it-IT')}
						</p>
					</>
				)}
			</main>
		</div>
	);
}
