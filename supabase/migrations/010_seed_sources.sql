-- Migration 010: Seed data - Fonti meteo
-- Inserisce le 5 fonti meteo configurate nel backend (routes/sources.ts).
-- I valori devono corrispondere a quelli in-memory del backend.

insert into sources (id, name, description, weight, active) values
  (
    'tomorrow.io',
    'Tomorrow.io',
    'Hyper-local nowcasting with minute-by-minute precision',
    1.2,
    true
  ),
  (
    'meteomatics',
    'Meteomatics',
    'Professional scientific data with high-resolution models',
    1.2,
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
  );
