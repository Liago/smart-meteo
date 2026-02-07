'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { WeatherCondition } from '@/lib/types';
import { conditionGradients } from '@/lib/weather-utils';

interface DynamicBackgroundProps {
  condition: string;
}

interface RainDrop {
  id: number;
  left: string;
  delay: number;
  duration: number;
  opacity: number;
}

interface SnowFlake {
  id: number;
  left: string;
  delay: number;
  duration: number;
  size: number;
}

function seedRandom(seed: number) {
  // Simple deterministic pseudo-random from a seed
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

function generateDrops(): RainDrop[] {
  return Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: `${seedRandom(i * 7 + 1) * 100}%`,
    delay: seedRandom(i * 13 + 2) * 2,
    duration: 0.8 + seedRandom(i * 17 + 3) * 0.5,
    opacity: 0.2 + seedRandom(i * 23 + 4) * 0.4,
  }));
}

function generateFlakes(): SnowFlake[] {
  return Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${seedRandom(i * 11 + 5) * 100}%`,
    delay: seedRandom(i * 19 + 6) * 5,
    duration: 4 + seedRandom(i * 29 + 7) * 4,
    size: 3 + seedRandom(i * 31 + 8) * 5,
  }));
}

const RAIN_DROPS = generateDrops();
const SNOW_FLAKES = generateFlakes();

function RainEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {RAIN_DROPS.map(drop => (
        <div
          key={drop.id}
          className="absolute w-px bg-blue-200"
          style={{
            left: drop.left,
            height: '20px',
            opacity: drop.opacity,
            animation: `rain-drop ${drop.duration}s linear ${drop.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function SnowEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {SNOW_FLAKES.map(flake => (
        <div
          key={flake.id}
          className="absolute rounded-full bg-white"
          style={{
            left: flake.left,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: 0.7,
            animation: `snow-fall ${flake.duration}s linear ${flake.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function StormEffect() {
  return (
    <>
      <RainEffect />
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute inset-0 bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 0.15, 0, 0, 0, 0.1, 0, 0, 0, 0, 0] }}
          transition={{ duration: 8, repeat: Infinity, repeatDelay: 2 }}
        />
      </div>
    </>
  );
}

export default function DynamicBackground({ condition }: DynamicBackgroundProps) {
  const weatherCondition = (condition || 'unknown') as WeatherCondition;
  const gradient = conditionGradients[weatherCondition] || conditionGradients.unknown;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={weatherCondition}
        className={`weather-bg bg-gradient-to-br ${gradient}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2 }}
      >
        {weatherCondition === 'rain' && <RainEffect />}
        {weatherCondition === 'snow' && <SnowEffect />}
        {weatherCondition === 'storm' && <StormEffect />}

        {/* Subtle overlay for better text readability */}
        <div className="absolute inset-0 bg-black/10" />
      </motion.div>
    </AnimatePresence>
  );
}
