-- Migration 024: Allerte su soglie personali
--
-- Il sistema di allerte notifica solo quelle governative, che scattano su
-- criteri di protezione civile. Queste regole aggiungono le soglie dell'utente
-- («avvisami se stanotte gela», «se le raffiche superano 50 km/h», «se domani
-- piove più di 10 mm») riusando per intero la pipeline esistente: stesse
-- subscription, stesso APNs, stesso poller a 15 minuti.

-- La regola è legata al DEVICE, non alla subscription.
--
-- `/alerts/subscribe` riscrive la riga di subscription a ogni ri-registrazione
-- dell'app — che avviene a ogni spostamento significativo del telefono — e
-- cancella le registrazioni residue dello stesso device. Con una FK CASCADE
-- verso `alert_subscriptions`, le regole sparirebbero insieme a quelle righe:
-- è lo stesso incidente che la migrazione 021 ha risolto per la deduplica.
-- La località su cui valutare la regola resta quella della subscription attiva
-- del device.
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_token TEXT NOT NULL,
    -- Id di `RULE_METRICS` in backend/utils/alertRules.ts: temp_min, temp_max,
    -- wind_gust, precipitation_mm, snowfall_cm, storm_index, aqi.
    metric TEXT NOT NULL,
    comparator TEXT NOT NULL CHECK (comparator IN ('above', 'below')),
    -- Nell'unità che l'utente vede (km/h per il vento, non m/s): la soglia la
    -- scrive una persona, ed è in quella unità che va confrontata.
    threshold REAL NOT NULL,
    -- Quante ore in avanti guardare. Il limite di 48 è quello della finestra
    -- oraria che l'aggregazione produce.
    horizon_hours INTEGER NOT NULL DEFAULT 24 CHECK (horizon_hours BETWEEN 1 AND 48),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Una regola identica due volte manderebbe due notifiche identiche.
    UNIQUE(device_token, metric, comparator, threshold, horizon_hours)
);

CREATE TRIGGER handle_updated_at_alert_rules
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);

CREATE INDEX IF NOT EXISTS idx_alert_rules_device
ON alert_rules(device_token) WHERE enabled;

-- Storico degli scatti, con la stessa barriera atomica di `weather_alerts`:
-- la riga viene scritta PRIMA della push per prenotare l'invio, perché un
-- controllo in lettura seguito da una scrittura non regge due invocazioni
-- concorrenti del poller.
--
-- Tabella separata da `weather_alerts` di proposito: là il cooldown è per
-- severity, e mettendoci anche queste una regola sull'AQI zittirebbe per sei
-- ore quella sulle gelate. Qui la deduplica è per regola e per giorno.
CREATE TABLE IF NOT EXISTS alert_rule_hits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
    -- SHA-256 troncato, come in `weather_alerts` e `alert_delivery_log`:
    -- identifica il telefono senza conservarne il token in chiaro.
    device_token_hash TEXT NOT NULL,
    -- `rule:<id>:<giorno dello scatto>`: cambia col giorno a cui si riferisce
    -- la previsione, non a ogni giro del poller.
    signature TEXT NOT NULL,
    metric TEXT NOT NULL,
    value REAL,
    message TEXT NOT NULL,
    delivery_status TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(device_token_hash, signature)
);

CREATE INDEX IF NOT EXISTS idx_alert_rule_hits_rule
ON alert_rule_hits(rule_id, sent_at DESC);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rule_hits ENABLE ROW LEVEL SECURITY;

-- Nessuna policy pubblica: a differenza di `alert_subscriptions`, queste
-- tabelle si toccano solo attraverso il backend in service_role. Una policy
-- pubblica di lettura esporrebbe i device token.
CREATE POLICY "Service role manages everything alert_rules"
ON alert_rules FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages everything alert_rule_hits"
ON alert_rule_hits FOR ALL
TO service_role
USING (true) WITH CHECK (true);
