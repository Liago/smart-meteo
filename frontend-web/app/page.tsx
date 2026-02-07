'use client';

import { useState } from 'react';
import Link from 'next/link';
import DynamicBackground from '@/components/DynamicBackground';
import SearchBar from '@/components/SearchBar';
import CurrentWeather from '@/components/CurrentWeather';
import ForecastDetails from '@/components/ForecastDetails';
import SourcesIndicator from '@/components/SourcesIndicator';
import SkeletonLoader from '@/components/SkeletonLoader';
import ErrorFallback from '@/components/ErrorFallback';
import { useForecast } from '@/lib/hooks';

export default function Home() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const { data, error, isLoading, mutate } = useForecast(
    coords?.lat ?? null,
    coords?.lon ?? null
  );

  const handleLocationSelect = (lat: number, lon: number, name: string) => {
    setCoords({ lat, lon });
    setLocationName(name);
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
          <Link
            href="/sources"
            className="p-2 rounded-lg glass hover:bg-white/20 transition-colors text-white/60 hover:text-white"
            title="Gestione fonti"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </header>

        {/* Search */}
        <SearchBar onLocationSelect={handleLocationSelect} isLoading={isLoading} />

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
            <ForecastDetails data={data.current} />
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
