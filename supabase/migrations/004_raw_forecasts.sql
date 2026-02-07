-- Migration 004: Tabella raw_forecasts
-- Salva i dati grezzi ricevuti da ogni singola fonte meteo.
-- Serve per: debug, auditing, training AI (Fase 4), analisi accuratezza.

create table raw_forecasts (
  id uuid primary key default uuid_generate_v4(),
  source_id text not null references sources(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  fetched_at timestamptz not null default now(),

  -- Dati normalizzati (dal UnifiedForecast del backend)
  temp numeric,
  feels_like numeric,
  humidity numeric,
  wind_speed numeric,
  wind_direction numeric,
  condition_text text,
  condition_code text,                          -- 'clear','cloudy','rain','snow','storm','fog','unknown'
  precipitation_prob numeric,

  -- Dati grezzi originali
  raw_data jsonb,                               -- risposta JSON completa del provider

  -- Metadati
  response_ms integer,                          -- tempo di risposta del provider (ms)
  error text                                    -- eventuale errore durante il fetch
);

comment on table raw_forecasts is 'Dati grezzi da ogni singola fonte, usati per audit e training AI';
comment on column raw_forecasts.condition_code is 'Codice normalizzato: clear, cloudy, rain, snow, storm, fog, unknown';
