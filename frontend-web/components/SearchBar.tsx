'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  onLocationSelect: (lat: number, lon: number, name: string) => void;
  isLoading?: boolean;
}

interface GeoResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
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

export default function SearchBar({ onLocationSelect, isLoading }: SearchBarProps) {
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
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const res = await searchLocation(value);
      setResults(res);
      setShowResults(res.length > 0);
    }, 350);
  }, []);

  const handleSelect = (result: GeoResult) => {
    const displayName = result.state
      ? `${result.name}, ${result.state}`
      : `${result.name}, ${result.country}`;
    setQuery(displayName);
    setShowResults(false);
    onLocationSelect(result.lat, result.lon, displayName);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        setQuery('La tua posizione');
        onLocationSelect(pos.coords.latitude, pos.coords.longitude, 'La tua posizione');
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
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Cerca una localita..."
          className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-base"
        />
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
            className="absolute top-full left-0 right-0 mt-2 glass-strong overflow-hidden z-50"
          >
            {results.map((result, i) => (
              <button
                key={`${result.lat}-${result.lon}-${i}`}
                onClick={() => handleSelect(result)}
                className="w-full text-left px-4 py-3 text-white/90 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
              >
                <div className="font-medium">{result.name}</div>
                <div className="text-sm text-white/50">
                  {result.state ? `${result.state}, ` : ''}{result.country}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
