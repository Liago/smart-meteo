'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { SavedLocation } from '@/lib/useLocations';

interface SearchBarProps {
	onLocationSelect: (lat: number, lon: number, name: string) => void;
	isLoading?: boolean;
	savedLocations?: SavedLocation[];
	homeLocation?: SavedLocation | null;
	onRemoveHome?: () => void;
	onRemoveSaved?: (id: string) => void;
}

interface GeoResult {
	name: string;
	lat: number;
	lon: number;
	country: string;
	state?: string;
}

// Reverse geocoding to get a place name from coordinates
async function reverseGeocode(lat: number, lon: number): Promise<string> {
	try {
		const res = await fetch(
			`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
			{ headers: { 'Accept-Language': 'it' } }
		);
		if (!res.ok) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
		const data = await res.json();
		const addr = data.address;
		const city = addr?.city || addr?.town || addr?.village || addr?.municipality || '';
		const state = addr?.state || '';
		if (city && state) return `${city}, ${state}`;
		if (city) return city;
		const name = String(data.display_name || '').split(',')[0];
		return name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
	} catch {
		return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
	}
}

// Geocoding using OpenStreetMap Nominatim (free, no API key needed)
async function searchLocation(query: string): Promise<GeoResult[]> {
	if (!query || query.length < 2) return [];
	const res = await fetch(
		`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
		{ headers: { 'Accept-Language': 'it' } }
	);
	if (!res.ok) return [];
	const data = await res.json();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return data.map((item: Record<string, any>) => ({
		name: String(item.display_name).split(',')[0],
		lat: parseFloat(item.lat),
		lon: parseFloat(item.lon),
		country: item.address?.country || '',
		state: item.address?.state,
	}));
}

export default function SearchBar({ onLocationSelect, isLoading, savedLocations = [], homeLocation, onRemoveHome, onRemoveSaved }: SearchBarProps) {
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<GeoResult[]>([]);
	const [showResults, setShowResults] = useState(false);
	const [geoLoading, setGeoLoading] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const handleSearch = useCallback((value: string) => {
		setQuery(value);
		if (debounceRef.current) clearTimeout(debounceRef.current);

		if (value.length < 2) {
			setResults([]);
			// Keep showing results if we have saved locations and input is empty/short
			if (savedLocations.length > 0 || homeLocation) {
				setShowResults(true);
			} else {
				setShowResults(false);
			}
			return;
		}

		debounceRef.current = setTimeout(async () => {
			const res = await searchLocation(value);
			setResults(res);
			setShowResults(true); // Always show if we have search results
		}, 350);
	}, [savedLocations.length, homeLocation]);

	const handleSelect = (lat: number, lon: number, name: string) => {
		setQuery(name);
		setShowResults(false);
		onLocationSelect(lat, lon, name);
	};

	const handleGeolocate = () => {
		if (!navigator.geolocation) return;
		setGeoLoading(true);
		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				const { latitude, longitude } = pos.coords;
				// Resolve a real place name via reverse geocoding
				const name = await reverseGeocode(latitude, longitude);
				setGeoLoading(false);
				setQuery(name);
				onLocationSelect(latitude, longitude, name);
			},
			() => {
				setGeoLoading(false);
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	};

	// Close dropdown on outside click
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setShowResults(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, []);

	const showSavedMap = query.length < 2 && (savedLocations.length > 0 || homeLocation);

	return (
		<div ref={containerRef} className="relative w-full max-w-lg mx-auto">
			<div className="glass-strong flex items-center gap-2 px-4 py-3">
				<svg className="w-5 h-5 text-white/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>
				<input
					type="text"
					value={query}
					onChange={(e) => handleSearch(e.target.value)}
					onFocus={() => setShowResults(true)}
					placeholder="Cerca una localita..."
					className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-base"
				/>
				{query && (
					<button
						onClick={() => handleSearch('')}
						className="p-1 rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white"
						title="Cancella ricerca"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				)}
				<button
					onClick={handleGeolocate}
					disabled={geoLoading}
					className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white disabled:opacity-50"
					title="Usa la tua posizione"
				>
					{geoLoading ? (
						<svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
							<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
					) : (
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
					)}
				</button>
				{isLoading && (
					<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
				)}
			</div>

			<AnimatePresence>
				{showResults && (
					<motion.div
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.2 }}
						className="absolute top-full left-0 right-0 mt-2 glass-strong overflow-hidden z-50 rounded-xl"
					>
						{showSavedMap && (
							<div className="py-2">
								{homeLocation && (
									<div className="flex items-center hover:bg-white/10 transition-colors group">
										<button
											onClick={() => handleSelect(homeLocation.lat, homeLocation.lon, homeLocation.name)}
											className="flex-1 text-left px-4 py-2 text-white/90 flex items-center gap-2 min-w-0"
										>
											<svg className="w-4 h-4 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
												<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
											</svg>
											<span className="truncate">{homeLocation.name} (Home)</span>
										</button>
										{onRemoveHome && (
											<button
												onClick={(e) => { e.stopPropagation(); onRemoveHome(); }}
												className="p-1.5 mr-2 rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
												title="Rimuovi Home"
											>
												<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										)}
									</div>
								)}
								{savedLocations.map((loc) => (
									<div key={loc.id} className="flex items-center hover:bg-white/10 transition-colors group">
										<button
											onClick={() => handleSelect(loc.lat, loc.lon, loc.name)}
											className="flex-1 text-left px-4 py-2 text-white/90 flex items-center gap-2 min-w-0"
										>
											<svg className="w-4 h-4 text-white/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
											<span className="truncate">{loc.name}</span>
										</button>
										{onRemoveSaved && (
											<button
												onClick={(e) => { e.stopPropagation(); onRemoveSaved(loc.id); }}
												className="p-1.5 mr-2 rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
												title="Rimuovi dai preferiti"
											>
												<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										)}
									</div>
								))}
								<div className="border-t border-white/10 my-1 font-medium text-xs text-white/40 px-4 py-1 uppercase tracking-wider">
									Risultati Ricerca
								</div>
							</div>
						)}

						{results.map((result, i) => (
							<button
								key={`${result.lat}-${result.lon}-${i}`}
								onClick={() => handleSelect(result.lat, result.lon,
									result.state ? `${result.name}, ${result.state}` : `${result.name}, ${result.country}`
								)}
								className="w-full text-left px-4 py-3 text-white/90 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
							>
								<div className="font-medium">{result.name}</div>
								<div className="text-sm text-white/50">
									{result.state ? `${result.state}, ` : ''}{result.country}
								</div>
							</button>
						))}

						{results.length === 0 && !showSavedMap && (
							<div className="px-4 py-3 text-white/50 text-sm">
								Nessun risultato trovato
							</div>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
