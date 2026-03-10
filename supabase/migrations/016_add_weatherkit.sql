-- Migration 016: Add Apple WeatherKit Source
-- Aggiunge Apple WeatherKit come nuova fonte meteo.

insert into sources (id, name, weight, active, description)
values (
  'apple_weatherkit',
  'Apple WeatherKit',
  1.2,
  true,
  'Dati ufficiali forniti da Apple (Richiede chiave P8)'
) on conflict (id) do update set 
  weight = excluded.weight,
  active = excluded.active;
