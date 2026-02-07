-- Migration 005: Tabella smart_forecasts
-- Risultato aggregato dello Smart Engine, servito al frontend.
-- Struttura allineata all'output di getSmartForecast() in engine/smartEngine.ts.

create table smart_forecasts (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid not null references locations(id) on delete cascade,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  generated_at timestamptz not null default now(),

  -- Metriche aggregate (output dello Smart Engine)
  temperature numeric,                          -- temperatura media pesata (°C)
  feels_like numeric,                           -- temperatura percepita media pesata (°C)
  humidity numeric,                             -- umidita media pesata (%)
  wind_speed numeric,                           -- velocita vento media pesata (m/s)
  precipitation_prob numeric not null default 0, -- probabilita precipitazione (%)
  condition text not null default 'unknown',    -- condizione vincente per voting pesato
  condition_text text,                          -- testo condizione (uppercase)

  -- Metadati aggregazione
  sources_used text[] not null default '{}',    -- array fonti contribuenti (es: {'tomorrow.io','openweathermap'})
  sources_count integer not null default 0,     -- numero fonti che hanno risposto
  confidence_score numeric                      -- score affidabilita calcolato (futuro Fase 4)
);

comment on table smart_forecasts is 'Previsioni aggregate dello Smart Engine, servite al frontend';
comment on column smart_forecasts.sources_used is 'Array delle fonti che hanno contribuito a questa previsione';
comment on column smart_forecasts.confidence_score is 'Score di affidabilita (Fase 4 - AI driven)';
