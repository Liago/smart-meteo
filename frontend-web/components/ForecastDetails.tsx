'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ForecastCurrent } from '@/lib/types';

interface ForecastDetailsProps {
  data: ForecastCurrent;
}

export default function ForecastDetails({ data }: ForecastDetailsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="glass p-4 sm:p-6 text-white"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between"
      >
        <span className="font-medium text-base">Dettagli previsione</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="w-5 h-5 text-white/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-4">
              {/* Precipitation bar */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white/60">Probabilita precipitazione</span>
                  <span className="font-medium">{Math.round(data.precipitation_prob)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${data.precipitation_prob}%` }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
                  />
                </div>
              </div>

              {/* Humidity bar */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white/60">Umidita</span>
                  <span className="font-medium">{data.humidity !== null ? `${Math.round(data.humidity)}%` : '--'}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${data.humidity ?? 0}%` }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500"
                  />
                </div>
              </div>

              {/* Wind detail */}
              <div className="flex items-center justify-between py-2 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Vento</div>
                    <div className="text-xs text-white/50">Velocita e direzione</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {data.wind_speed !== null ? `${data.wind_speed.toFixed(1)} m/s` : '--'}
                  </div>
                </div>
              </div>

              {/* Temperature detail */}
              <div className="flex items-center justify-between py-2 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Temperatura</div>
                    <div className="text-xs text-white/50">Effettiva vs percepita</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {data.temperature !== null ? `${data.temperature}°C` : '--'}
                  </div>
                  <div className="text-xs text-white/50">
                    Percepita {data.feels_like !== null ? `${data.feels_like}°C` : '--'}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
