'use client';

import { motion } from 'framer-motion';

interface SourcesIndicatorProps {
  sources: string[];
}

const sourceColors: Record<string, string> = {
  'tomorrow.io': 'bg-blue-500',
  'meteomatics': 'bg-purple-500',
  'openweathermap': 'bg-orange-500',
  'weatherapi': 'bg-green-500',
  'accuweather': 'bg-red-500',
};

const sourceNames: Record<string, string> = {
  'tomorrow.io': 'Tomorrow.io',
  'meteomatics': 'Meteomatics',
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
      className="glass p-4 sm:p-5 text-white"
    >
      <h3 className="text-sm font-medium text-white/60 mb-3">Fonti contribuenti</h3>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, i) => (
          <motion.span
            key={source}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.05 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-sm"
          >
            <span className={`w-2 h-2 rounded-full ${sourceColors[source] || 'bg-gray-400'}`} />
            {sourceNames[source] || source}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}
