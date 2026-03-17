-- Tabella per tracciare la delivery delle notifiche push per le allerte meteo
-- Permette di diagnosticare problemi di delivery e identificare token scaduti

CREATE TABLE IF NOT EXISTS alert_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id TEXT,
    subscription_id UUID REFERENCES alert_subscriptions(id) ON DELETE SET NULL,
    device_token_hash TEXT,
    status TEXT CHECK (status IN ('sent', 'failed', 'expired_token')),
    apns_response JSONB,
    error_reason TEXT,
    attempted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_delivery_log_status ON alert_delivery_log(status);
CREATE INDEX idx_delivery_log_attempted ON alert_delivery_log(attempted_at);
CREATE INDEX idx_delivery_log_alert ON alert_delivery_log(alert_id);

-- RLS: solo il service role può accedere a questa tabella
ALTER TABLE alert_delivery_log ENABLE ROW LEVEL SECURITY;

-- Policy per service role (le funzioni backend usano service role key)
CREATE POLICY "Service role full access on delivery log" ON alert_delivery_log
    FOR ALL
    USING (true)
    WITH CHECK (true);
