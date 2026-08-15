'use client';

import { motion } from 'framer-motion';

interface SourcesIndicatorProps {
  sources: string[];
}

const sourceColors: Record<string, string> = {
  'tomorrow.io': 'bg-blue-500',
  'open-meteo': 'bg-purple-500',
  'openweathermap': 'bg-orange-500',
  'weatherapi': 'bg-green-500',
  'accuweather': 'bg-red-500',
};

const sourceNames: Record<string, string> = {
  'tomorrow.io': 'Tomorrow.io',
  'open-meteo': 'Open-Meteo',
  'openweathermap': 'OpenWeather',
  'weatherapi': 'WeatherAPI',
  'accuweather': 'AccuWeather',
};

export default function SourcesIndicator({ sources }: SourcesIndicatorProps) {
  if (sources.length === 0) return null;

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
