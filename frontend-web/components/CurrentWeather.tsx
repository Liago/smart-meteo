'use client';

import { motion } from 'framer-motion';
import type { ForecastCurrent } from '@/lib/types';
import { getConditionLabel, getConditionIcon } from '@/lib/weather-utils';

interface CurrentWeatherProps {
  data: ForecastCurrent;
  locationName: string;
  sourcesCount: number;
}

export default function CurrentWeather({ data, locationName, sourcesCount }: CurrentWeatherProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="glass-strong p-6 sm:p-8 text-white text-center"
    >
      {/* Location */}
      <p className="text-white/70 text-sm mb-1 tracking-wide uppercase">{locationName}</p>

      {/* Condition icon & text */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-4xl">{getConditionIcon(data.condition)}</span>
        <span className="text-lg font-medium text-white/80">{getConditionLabel(data.condition)}</span>
      </div>

      {/* Main temperature */}
      <motion.div
        key={data.temperature}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, type: 'spring' }}
        className="mb-1"
      >
        <span className="text-8xl sm:text-9xl font-extralight tracking-tighter">
          {data.temperature !== null ? Math.round(data.temperature) : '--'}
        </span>
        <span className="text-3xl font-light align-top ml-1">°C</span>
      </motion.div>

      {/* Feels like */}
      <p className="text-white/60 text-sm mb-6">
        Percepita: {data.feels_like !== null ? `${Math.round(data.feels_like)}°C` : '--'}
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
        <StatItem
          label="Umidita"
          value={data.humidity !== null ? `${Math.round(data.humidity)}%` : '--'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21c-4.97 0-9-3.582-9-8 0-4.418 9-13 9-13s9 8.582 9 13c0 4.418-4.03 8-9 8z" />
            </svg>
          }
        />
        <StatItem
          label="Vento"
          value={data.wind_speed !== null ? `${data.wind_speed.toFixed(1)} m/s` : '--'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
            </svg>
          }
        />
        <StatItem
          label="Precipitaz."
          value={`${Math.round(data.precipitation_prob)}%`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          }
        />
      </div>

      {/* Sources badge */}
      <div className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-xs text-white/60">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        Aggregato da {sourcesCount} fonti
      </div>
    </motion.section>
  );
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-white/40">{icon}</div>
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-xs text-white/50">{label}</span>
    </div>
  );
}
