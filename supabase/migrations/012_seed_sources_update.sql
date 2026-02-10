-- Migration 012: Seed data - Update sources
-- Adds missing weather sources: worldweatheronline, weatherstack, and meteostat
-- Ensures all backend sources are in the database.

insert into sources (id, name, description, weight, active) values
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
on conflict (id) do update 
set 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  weight = EXCLUDED.weight,
  active = EXCLUDED.active;
