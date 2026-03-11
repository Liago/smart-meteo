-- Migration 018: Enhance weather_alerts table for WeatherKit integration
-- Aggiunge campi per deduplicazione allerte esterne e metadati aggiuntivi

-- ID esterno dell'allerta (da WeatherKit) per evitare invii duplicati
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS external_alert_id TEXT;

-- Rendi subscription_id opzionale (allerte senza iscritti vanno comunque registrate)
ALTER TABLE weather_alerts ALTER COLUMN subscription_id DROP NOT NULL;

-- Metadati aggiuntivi dell'allerta
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS area_name TEXT;
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS event_source TEXT;
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS effective_time TIMESTAMPTZ;
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS expire_time TIMESTAMPTZ;

-- Indice per deduplicazione rapida per external_alert_id
CREATE INDEX IF NOT EXISTS idx_weather_alerts_external_id ON weather_alerts(external_alert_id);

-- Indice per cercare allerte attive (non scadute)
CREATE INDEX IF NOT EXISTS idx_weather_alerts_expire_time ON weather_alerts(expire_time);

-- Indice per ricerca sottoscrizioni per area geografica
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_location
ON alert_subscriptions(location_lat, location_lon)
WHERE enabled = true;
