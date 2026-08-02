-- Migration 021: Deduplicazione allerte legata al device, non alla subscription
--
-- Dedup e cooldown si basavano su `subscription_id`, ma `/alerts/subscribe`
-- cancella e ricrea la riga a ogni ri-registrazione del device (che l'app fa a
-- ogni spostamento significativo): la FK ON DELETE CASCADE portava con sé anche
-- tutte le righe di `weather_alerts`, azzerando lo storico anti-spam e facendo
-- rispedire allerte già notificate.
--
-- La chiave diventa (device, firma dell'allerta), con un indice unico che rende
-- atomica la deduplicazione: due invocazioni concorrenti non possono più
-- inviare entrambe la stessa notifica.

-- Hash del device token (SHA-256 troncato): identifica il telefono senza
-- conservare il token in chiaro, coerente con `alert_delivery_log`.
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS device_token_hash TEXT;

-- Firma stabile dell'evento (severity|evento|area|giorno), indipendente dagli
-- id dei provider: MeteoAlarm riemette lo stesso avviso con id diversi.
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS alert_signature TEXT;

-- Esito dell'invio: la riga viene scritta PRIMA della push (per prenotare
-- l'invio) e aggiornata dopo la risposta di APNs.
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS delivery_status TEXT;

-- La storia anti-spam deve sopravvivere alla ricreazione della subscription
ALTER TABLE weather_alerts DROP CONSTRAINT IF EXISTS weather_alerts_subscription_id_fkey;
ALTER TABLE weather_alerts ADD CONSTRAINT weather_alerts_subscription_id_fkey
    FOREIGN KEY (subscription_id) REFERENCES alert_subscriptions(id) ON DELETE SET NULL;

-- Barriera atomica contro i duplicati. Parziale: le righe storiche (colonne
-- nuove a NULL) e quelle senza destinatario non generano conflitti.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_weather_alerts_device_signature
ON weather_alerts(device_token_hash, alert_signature)
WHERE device_token_hash IS NOT NULL AND alert_signature IS NOT NULL;

-- Supporta la query di cooldown (stesso device, stessa severity, ultime N ore)
CREATE INDEX IF NOT EXISTS idx_weather_alerts_device_cooldown
ON weather_alerts(device_token_hash, alert_type, sent_at)
WHERE device_token_hash IS NOT NULL;
