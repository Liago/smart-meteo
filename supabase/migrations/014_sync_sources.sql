-- Migration 014: Sync Sources
-- Ensures the DB exactly matches the in-memory backend sources.
-- Removes deprecated sources like meteomatics.

DELETE FROM sources WHERE id = 'meteomatics';

INSERT INTO sources (id, name, description, weight, active) VALUES
  (
    'tomorrow.io',
    'Tomorrow.io',
    'Hyper-local nowcasting with minute-by-minute precision',
    1.2,
    true
  ),
  (
    'open-meteo',
    'Open-Meteo',
    'High-resolution scientific data from national weather services',
    1.1,
    true
  ),
  (
    'openweathermap',
    'OpenWeatherMap',
    'Global coverage baseline and fast fallback',
    1.0,
    true
  ),
  (
    'weatherapi',
    'WeatherAPI',
    'Cross-validation for temperature and conditions',
    1.0,
    true
  ),
  (
    'accuweather',
    'AccuWeather',
    'Quality-focused with RealFeel temperature',
    1.1,
    true
  ),
  (
    'worldweatheronline',
    'WorldWeatherOnline',
    'Premium global weather data',
    1.0,
    true
  ),
  (
    'weatherstack',
    'Weatherstack',
    'Real-time weather data (Standard/Free tier)',
    0.9,
    true
  ),
  (
    'meteostat',
    'Meteostat',
    'Historical and statistical weather data',
    0.8,
    true
  )
ON CONFLICT (id) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  weight = EXCLUDED.weight,
  active = EXCLUDED.active;
