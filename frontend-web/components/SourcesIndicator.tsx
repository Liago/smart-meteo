'use client';

import { motion } from 'framer-motion';
import type { ConfidenceIndex } from '@/lib/types';

interface SourcesIndicatorProps {
  sources: string[];
  confidence?: ConfidenceIndex | null;
}

const confidenceLabels: Record<ConfidenceIndex['level'], string> = {
  high: 'Fonti concordi',
  medium: 'Accordo parziale',
  low: 'Fonti in disaccordo',
};

const confidenceColors: Record<ConfidenceIndex['level'], string> = {
  high: 'var(--color-duet-green)',
  medium: 'var(--color-duet-amber-badge)',
  low: 'var(--color-duet-red)',
};

const sourceColors: Record<string, string> = {
  'apple_weatherkit': 'bg-slate-700',
  // I modelli Open-Meteo condividono il viola della fonte da cui arrivano.
  'open-meteo:icon_d2': 'bg-purple-700',
  'open-meteo:icon_eu': 'bg-purple-600',
  'open-meteo:ecmwf': 'bg-violet-500',
  'open-meteo:meteofrance': 'bg-indigo-500',
  'open-meteo:gfs': 'bg-fuchsia-500',
  'tomorrow.io': 'bg-blue-500',
  'open-meteo': 'bg-purple-500',
  'openweathermap': 'bg-orange-500',
  'weatherapi': 'bg-green-500',
  'accuweather': 'bg-red-500',
  'worldweatheronline': 'bg-teal-500',
  'weatherstack': 'bg-amber-500',
  'meteostat': 'bg-stone-500',
};

// Le nove fonti del backend. Senza una voce qui il badge mostrava l'id grezzo
// (`apple_weatherkit`), e mancavano proprio WeatherKit e WWO, cioè due delle
// fonti che rispondono più spesso.
const sourceNames: Record<string, string> = {
  'apple_weatherkit': 'Apple WeatherKit',
  // Modelli meteorologici richiesti a Open-Meteo uno per uno: sono fonti
  // indipendenti, non una sola. Le etichette restano corte perché in dashboard
  // ce ne possono essere cinque accanto agli altri provider.
  'open-meteo:icon_d2': 'ICON-D2',
  'open-meteo:icon_eu': 'ICON-EU',
  'open-meteo:ecmwf': 'ECMWF',
  'open-meteo:meteofrance': 'Météo-France',
  'open-meteo:gfs': 'GFS',
  'tomorrow.io': 'Tomorrow.io',
  'open-meteo': 'Open-Meteo',
  'openweathermap': 'OpenWeather',
  'weatherapi': 'WeatherAPI',
  'accuweather': 'AccuWeather',
  'worldweatheronline': 'World Weather Online',
  'weatherstack': 'WeatherStack',
  'meteostat': 'Meteostat',
};

export default function SourcesIndicator({ sources, confidence }: SourcesIndicatorProps) {
  if (sources.length === 0) return null;

  // Intervallo fra la fonte più fredda e la più calda: è il modo più concreto
  // di mostrare il disaccordo, più del punteggio da solo.
  const tempRange = confidence?.temperature;
  const showRange = tempRange != null && tempRange.max - tempRange.min >= 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="glass p-6"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-duet-muted)' }}>Fonti contribuenti</h3>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-duet-green-ink)' }}>
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--color-duet-green)' }} />
          {sources.length} attive
        </span>
      </div>
      {confidence && (
        <div
          className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl px-3 py-2"
          style={{ background: 'var(--color-duet-accent-soft)' }}
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: confidenceColors[confidence.level] }}
            />
            {confidenceLabels[confidence.level]}
            <span style={{ color: 'var(--color-duet-muted)' }}>{confidence.score}/100</span>
          </span>
          {showRange && (
            <span className="text-xs" style={{ color: 'var(--color-duet-muted)' }}>
              Temperatura prevista fra {Math.round(tempRange.min)}° e {Math.round(tempRange.max)}°
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {sources.map((source, i) => (
          <motion.span
            key={source}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.05 }}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[13px] font-medium"
            style={{ background: 'var(--color-duet-accent-soft)', color: 'var(--color-duet-accent)', border: '1px solid var(--color-duet-accent-border)' }}
          >
            <span className={`w-2 h-2 rounded-full ${sourceColors[source] || 'bg-gray-400'}`} />
            {sourceNames[source] || source}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}
