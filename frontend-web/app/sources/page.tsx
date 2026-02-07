'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSources } from '@/lib/hooks';
import { toggleSource } from '@/lib/api';
import type { WeatherSource } from '@/lib/types';

const sourceColors: Record<string, string> = {
  'tomorrow.io': 'bg-blue-500',
  'meteomatics': 'bg-purple-500',
  'openweathermap': 'bg-orange-500',
  'weatherapi': 'bg-green-500',
  'accuweather': 'bg-red-500',
};

export default function SourcesPage() {
  const { data, error, mutate } = useSources();
  const [updating, setUpdating] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const handleToggle = async (source: WeatherSource) => {
    setUpdating(source.id);
    setToggleError(null);
    try {
      await toggleSource(source.id, !source.active);
      await mutate();
    } catch (err: unknown) {
      setToggleError(err instanceof Error ? err.message : 'Errore durante aggiornamento');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="p-2 rounded-lg glass hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Gestione Fonti</h1>
            <p className="text-white/50 text-sm">Abilita o disabilita le fonti meteo</p>
          </div>
        </div>

        {toggleError && (
          <div className="glass p-3 mb-4 text-red-300 text-sm border border-red-500/30">
            {toggleError}
          </div>
        )}

        {error && (
          <div className="glass p-6 text-center text-white">
            <p className="text-red-300 mb-2">Impossibile caricare le fonti</p>
            <p className="text-white/50 text-sm">{error.message}</p>
          </div>
        )}

        {!data && !error && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass p-5">
                <div className="skeleton h-5 w-32 mb-2" />
                <div className="skeleton h-3 w-48" />
              </div>
            ))}
          </div>
        )}

        {data && (
          <div className="space-y-3">
            {data.sources.map((source, i) => (
              <motion.div
                key={source.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className={`mt-1 w-3 h-3 rounded-full shrink-0 ${sourceColors[source.id] || 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold">{source.name}</h3>
                      <p className="text-white/50 text-sm mt-0.5">{source.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                        <span>Peso: {source.weight}</span>
                        {source.lastResponseMs !== null && (
                          <span>Latenza: {source.lastResponseMs}ms</span>
                        )}
                        {source.lastError && (
                          <span className="text-red-400">Errore: {source.lastError}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Toggle switch */}
                  <button
                    onClick={() => handleToggle(source)}
                    disabled={updating === source.id}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 ${
                      source.active ? 'bg-green-500' : 'bg-white/20'
                    } ${updating === source.id ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                        source.active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 glass p-4 text-xs text-white/40">
          <p>
            Disabilitare una fonte la esclude dal calcolo della previsione aggregata.
            Almeno una fonte deve rimanere attiva.
          </p>
        </div>
      </div>
    </div>
  );
}
