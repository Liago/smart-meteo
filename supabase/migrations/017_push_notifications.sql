-- Migration 017: Push Notifications Tables
-- Tabelle per memorizzare i token dei dispositivi per le allerte meteo e lo storico degli invii

CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Opzionale: lega il token all'utente loggato se presente
    device_token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'ios',
    location_lat REAL NOT NULL,
    location_lon REAL NOT NULL,
    location_name TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(device_token, location_lat, location_lon)
);

-- Trigger per auto-timestamp
CREATE TRIGGER handle_updated_at_alert_subscriptions 
    BEFORE UPDATE ON alert_subscriptions 
    FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

CREATE TABLE IF NOT EXISTS weather_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL, -- es. 'rain', 'storm', 'temp_drop'
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_alerts ENABLE ROW LEVEL SECURITY;

-- Gli utenti anonimi possono registrare il proprio device token 
-- Assumendo che il frontend chiami un endpoint backend service_role per l'inserimento
CREATE POLICY "Public can insert subscriptions via backend"
ON alert_subscriptions FOR INSERT 
TO public 
WITH CHECK (true);

-- Le letture e modifiche vere e proprie saranno gestite dal backend in service_role
CREATE POLICY "Service role manages everything alert_subscriptions"
ON alert_subscriptions FOR ALL 
TO service_role 
USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages everything weather_alerts"
ON weather_alerts FOR ALL 
TO service_role 
USING (true) WITH CHECK (true);
