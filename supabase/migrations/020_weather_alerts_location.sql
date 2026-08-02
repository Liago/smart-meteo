-- Migration 020: Coordinate e area delle allerte meteo
--
-- Senza queste colonne `GET /api/alerts/active` non può filtrare le allerte salvate:
-- restituiva l'intera tabella a qualsiasi coordinata, mostrando ad esempio allerte
-- della Sicilia a un utente in Lombardia.

-- Coordinate per cui l'allerta è stata raccolta / a cui è stata notificata
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS location_lat REAL;
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS location_lon REAL;

-- Identificativo area del provider (EMMA_ID MeteoAlarm/EUMETNET, es. "IT003")
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS area_id TEXT;

-- Codice paese ISO Alpha-2 dell'allerta
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS country_code TEXT;

-- Indice per la ricerca geografica delle allerte attive
CREATE INDEX IF NOT EXISTS idx_weather_alerts_location
ON weather_alerts(location_lat, location_lon);
