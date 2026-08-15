'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSources } from '@/lib/hooks';
import { toggleSource } from '@/lib/api';
import type { WeatherSource } from '@/lib/types';

const sourceColors: Record<string, string> = {
  'tomorrow.io': 'bg-blue-500',
  'open-meteo': 'bg-purple-500',
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
    <div className="min-h-screen" style={{ background: 'var(--color-duet-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="dt-icon-btn p-2 rounded-lg glass transition-colors"
            style={{ color: 'var(--color-duet-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-duet-ink)' }}>Gestione Fonti</h1>
            <p className="text-sm" style={{ color: 'var(--color-duet-muted)' }}>Abilita o disabilita le fonti meteo</p>
          </div>
        </div>

        {toggleError && (
          <div className="glass p-3 mb-4 text-sm" style={{ color: '#c62828', borderColor: '#f3b4b4' }}>
            {toggleError}
          </div>
        )}

        {error && (
          <div className="glass p-6 text-center" style={{ color: 'var(--color-duet-ink)' }}>
            <p className="mb-2" style={{ color: '#c62828' }}>Impossibile caricare le fonti</p>
            <p className="text-sm" style={{ color: 'var(--color-duet-muted)' }}>{error.message}</p>
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
                      <h3 className="font-semibold" style={{ color: 'var(--color-duet-ink)' }}>{source.name}</h3>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--color-duet-muted)' }}>{source.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--color-duet-faint)' }}>
                        <span>Peso: {source.weight}</span>
                        {source.lastResponseMs !== null && (
                          <span>Latenza: {source.lastResponseMs}ms</span>
                        )}
                        {source.lastError && (
                          <span style={{ color: '#c62828' }}>Errore: {source.lastError}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Toggle switch */}
                  <button
                    onClick={() => handleToggle(source)}
                    disabled={updating === source.id}
                    className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300"
                    style={{
                      background: source.active ? 'var(--color-duet-green)' : 'var(--color-duet-border)',
                      opacity: updating === source.id ? 0.5 : 1,
                    }}
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
        <div className="mt-6 glass p-4 text-xs" style={{ color: 'var(--color-duet-faint)' }}>
          <p>
            Disabilitare una fonte la esclude dal calcolo della previsione aggregata.
            Almeno una fonte deve rimanere attiva.
          </p>
        </div>
      </div>
    </div>
  );
}
