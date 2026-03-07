-- Migration 013: Aggiunge colonna full_data JSONB a smart_forecasts
-- Permette di cachare l'intero risultato dello Smart Engine (inclusi daily/hourly)

ALTER TABLE smart_forecasts
  ADD COLUMN IF NOT EXISTS full_data JSONB;

-- Indice GIN per eventuali query JSON future
CREATE INDEX IF NOT EXISTS idx_smart_forecasts_full_data
  ON smart_forecasts USING gin (full_data);

-- Nuovi campi numerici per analytics
ALTER TABLE smart_forecasts
  ADD COLUMN IF NOT EXISTS uv_index REAL,
  ADD COLUMN IF NOT EXISTS visibility REAL,
  ADD COLUMN IF NOT EXISTS cloud_cover REAL;
