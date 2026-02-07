-- Migration 008: Indici per performance
-- Ottimizza le query piu frequenti.

-- raw_forecasts: query per localita + fonte + tempo
create index idx_raw_forecasts_source_location
  on raw_forecasts (source_id, location_id, fetched_at desc);

create index idx_raw_forecasts_fetched_at
  on raw_forecasts (fetched_at desc);

-- smart_forecasts: query per localita + tempo (la piu frequente dal frontend)
create index idx_smart_forecasts_location_time
  on smart_forecasts (location_id, generated_at desc);

create index idx_smart_forecasts_coords
  on smart_forecasts (latitude, longitude, generated_at desc);

-- locations: ricerca per coordinate (usata da forecast)
create index idx_locations_coords
  on locations (latitude, longitude);

-- locations: ricerca testuale per nome (con trigram per fuzzy search)
create index idx_locations_name_trgm
  on locations using gin (name gin_trgm_ops);

-- sources: filtro per stato attivo
create index idx_sources_active
  on sources (active) where active = true;

-- profiles: lookup per email
create index idx_profiles_email
  on profiles (email);
