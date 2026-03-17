# Piano di Implementazione — Notifiche Email per Allerte Meteo

**Data:** 2026-03-17
**Stato:** Da implementare
**Prerequisito:** Fase 1-5 del sistema allerte completate (push notifications, multi-source, polling, frontend web, monitoraggio)

---

## 1. Stato Attuale

### Cosa esiste già

| Componente | File | Stato |
|------------|------|-------|
| Toggle "Email Alerts" (iOS) | `GeneralSettingsView.swift:98-105` | ❌ Stub — `.constant(false)` |
| Campo `email` in profilo utente | `supabase/migrations/006_profiles.sql` | ✅ Presente |
| Campo `preferences` (JSONB) in profilo | `supabase/migrations/006_profiles.sql` | ✅ Presente (usabile per flag email) |
| Email disponibile da auth | `AuthService.swift`, `SupabaseClient.swift` | ✅ Email in `UserProfile.email` |
| Pipeline invio allerte | `backend/services/alertProcessor.ts` | ✅ Solo push APNs |
| Tabella `alert_subscriptions` | `supabase/migrations/017_push_notifications.sql` | ✅ Solo push (device_token, platform) |
| Tabella `alert_delivery_log` | `supabase/migrations/019_alert_delivery_log.sql` | ✅ Solo push delivery |
| Frontend web notifiche email | — | ❌ Non implementato |

### Flusso attuale (solo push)

```
Allerta rilevata → alertProcessor.ts
    → Cerca subscriptions (device_token) nel raggio ~50km
    → Invia push APNs per ogni subscription
    → Log in alert_delivery_log
```

### Flusso target (push + email)

```
Allerta rilevata → alertProcessor.ts
    → Cerca subscriptions push (device_token) nel raggio ~50km
    → Invia push APNs per ogni subscription
    → Cerca email subscriptions per utenti nell'area
    → Invia email per ogni subscription email
    → Log in alert_delivery_log (tipo: 'push' o 'email')
```

---

## 2. Architettura Proposta

### Provider Email: Resend

**Perché Resend:**
- API semplice e moderna (1 chiamata REST)
- Free tier: 3.000 email/mese (sufficiente per allerte)
- Supporto React Email per template HTML
- Nessuna configurazione SMTP complessa
- SDK TypeScript nativo

**Alternativa:** SendGrid (free tier 100 email/giorno) — più consolidato ma API più verbosa.

### Schema dei Dati

```
profiles (esistente)
├── email (TEXT) ← già presente
└── preferences (JSONB) ← aggiungere:
    └── email_alerts_enabled: boolean
    └── email_alert_severity_min: 'minor' | 'moderate' | 'severe' | 'extreme'

email_alert_subscriptions (nuova tabella)
├── id (UUID)
├── user_id (UUID → auth.users)
├── email (TEXT)
├── location_lat (REAL)
├── location_lon (REAL)
├── location_name (TEXT)
├── min_severity ('minor' | 'moderate' | 'severe' | 'extreme')
├── enabled (BOOLEAN)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

---

## 3. Piano di Implementazione per Fasi

### Fase 1 — Database e Backend Core

#### 1.1 Migrazione database

**Nuovo file:** `supabase/migrations/020_email_alert_subscriptions.sql`

```sql
-- Tabella sottoscrizioni email per allerte meteo
CREATE TABLE IF NOT EXISTS email_alert_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    location_lat REAL NOT NULL,
    location_lon REAL NOT NULL,
    location_name TEXT,
    min_severity TEXT DEFAULT 'moderate'
        CHECK (min_severity IN ('minor', 'moderate', 'severe', 'extreme')),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indici
CREATE INDEX idx_email_subs_user ON email_alert_subscriptions(user_id);
CREATE INDEX idx_email_subs_location ON email_alert_subscriptions(location_lat, location_lon);
CREATE INDEX idx_email_subs_enabled ON email_alert_subscriptions(enabled);

-- Unique: un utente non può avere due sottoscrizioni email per la stessa posizione
CREATE UNIQUE INDEX idx_email_subs_unique ON email_alert_subscriptions(user_id, location_lat, location_lon);

-- RLS
ALTER TABLE email_alert_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email subscriptions"
    ON email_alert_subscriptions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on email subscriptions"
    ON email_alert_subscriptions FOR ALL
    USING (true)
    WITH CHECK (true);

-- Trigger auto-update updated_at
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON email_alert_subscriptions
    FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

-- Aggiorna alert_delivery_log per supportare tipo email
ALTER TABLE alert_delivery_log
    ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'push'
        CHECK (channel IN ('push', 'email'));
```

**Effort:** Basso | **Impatto:** 🔴 Alto (fondamentale per tutto il resto)

#### 1.2 Servizio email (Resend)

**Nuovo file:** `backend/services/emailService.ts`

Responsabilità:
- Inizializzazione client Resend con API key
- Funzione `sendAlertEmail(to, alert, locationName)` che invia l'email
- Template HTML inline per l'allerta (severity colorata, dettagli, link "Apri nell'app")
- Health check `getEmailServiceStatus()`

**Variabili d'ambiente richieste:**
- `RESEND_API_KEY` — API key di Resend
- `EMAIL_FROM` — Mittente (es. `alerts@smartmeteo.app` o `Smart Meteo <noreply@resend.dev>`)

**Template email (contenuto):**
- Header con logo/nome "Smart Meteo"
- Badge severity colorato (rosso/arancione/giallo/blu)
- Titolo allerta (event + headline)
- Descrizione completa
- Area geografica e finestra temporale
- Pulsante "Apri nell'app" (deep link)
- Footer con link di disiscrizione

**Effort:** Medio | **Impatto:** 🔴 Alto

#### 1.3 Integrazione in alertProcessor.ts

**File:** `backend/services/alertProcessor.ts`

Modifiche:
- Dopo l'invio push, cercare `email_alert_subscriptions` nel raggio dell'allerta
- Filtrare per `min_severity` (invia solo se severity allerta ≥ min_severity dell'utente)
- Chiamare `sendAlertEmail()` per ogni subscription email
- Loggare in `alert_delivery_log` con `channel = 'email'`
- Rispettare deduplicazione: non inviare la stessa allerta due volte allo stesso email

**Ordine di severity per confronto:**
```
minor: 1, moderate: 2, severe: 3, extreme: 4
```

**Effort:** Medio | **Impatto:** 🔴 Alto

#### 1.4 API endpoints per email subscriptions

**File:** `backend/routes/alerts.ts`

Nuovi endpoint:

| Metodo | Route | Descrizione |
|--------|-------|-------------|
| POST | `/api/alerts/email/subscribe` | Registra email per allerte a una posizione |
| POST | `/api/alerts/email/unsubscribe` | Rimuovi sottoscrizione email |
| GET | `/api/alerts/email/status` | Stato sottoscrizione email per utente corrente |
| PATCH | `/api/alerts/email/preferences` | Aggiorna min_severity |

**Autenticazione:** Tutti gli endpoint richiedono Bearer token (utente autenticato). L'email viene letta dal profilo utente, non passata dal client.

**Effort:** Basso | **Impatto:** 🟠 Medio

---

### Fase 2 — iOS (attivare il toggle)

#### 2.1 Servizio email notifications (iOS)

**Nuovo file:** `frontend-ios/.../Services/EmailNotificationService.swift`

Responsabilità:
- `subscribeEmail(lat, lon, locationName)` → chiama `POST /api/alerts/email/subscribe`
- `unsubscribeEmail(lat, lon)` → chiama `POST /api/alerts/email/unsubscribe`
- `getEmailStatus()` → chiama `GET /api/alerts/email/status`
- `updatePreferences(minSeverity)` → chiama `PATCH /api/alerts/email/preferences`

**Effort:** Basso | **Impatto:** 🟠 Medio

#### 2.2 Stato email in AppState

**File:** `frontend-ios/.../Core/State/AppState.swift`

Aggiungere:
- `@Published var isEmailAlertsEnabled: Bool = false`
- `@Published var emailAlertMinSeverity: String = "moderate"`
- Metodo `toggleEmailAlerts()` che chiama il servizio
- Fetch stato email on login (`setupAuth()`)
- Re-subscribe quando l'utente cambia posizione

**Effort:** Basso | **Impatto:** 🟠 Medio

#### 2.3 Attivare il toggle in GeneralSettingsView

**File:** `frontend-ios/.../UI/Features/Settings/GeneralSettingsView.swift`

Modifiche:
- Sostituire `.constant(false)` con binding a `appState.isEmailAlertsEnabled`
- Aggiungere azione toggle che chiama `appState.toggleEmailAlerts()`
- Mostrare solo se utente è autenticato (serve email)
- Se non autenticato, mostrare "Accedi per attivare" con link al login
- Aggiungere picker per severity minima sotto il toggle (quando abilitato)

**Effort:** Basso | **Impatto:** 🟠 Medio

#### 2.4 Aggiungere endpoint in APIService

**File:** `frontend-ios/.../Core/Network/APIService.swift`

Aggiungere:
- `subscribeToEmailAlerts(lat, lon, locationName)` → POST con auth header
- `unsubscribeFromEmailAlerts(lat, lon)` → POST con auth header
- `getEmailAlertStatus()` → GET con auth header
- `updateEmailAlertPreferences(minSeverity)` → PATCH con auth header

**Effort:** Basso | **Impatto:** 🟠 Medio

---

### Fase 3 — Frontend Web

#### 3.1 Settings per email notifications

**Nuovo file:** `frontend-web/components/EmailAlertSettings.tsx`

- Toggle on/off per email alerts
- Dropdown severity minima
- Mostrare solo se utente autenticato
- Stile glassmorphism coerente

**File:** `frontend-web/app/page.tsx` o nuova pagina settings

- Integrare il componente nelle impostazioni o nella dashboard

**Effort:** Medio | **Impatto:** 🟡 Basso

#### 3.2 API client e hooks

**File:** `frontend-web/lib/api.ts`, `frontend-web/lib/hooks.ts`

- `subscribeEmailAlerts(lat, lon)`, `unsubscribeEmailAlerts()`, `getEmailAlertStatus()`
- Hook `useEmailAlertStatus()`

**Effort:** Basso | **Impatto:** 🟡 Basso

---

### Fase 4 — Monitoraggio e Qualità

#### 4.1 Rate limiting email

**File:** `backend/services/emailService.ts`

- Max 5 email per utente per giorno (prevenire spam in caso di allerte frequenti)
- Cooldown di 1 ora tra email per la stessa allerta allo stesso utente
- Controllare rate limit prima di inviare

**Effort:** Basso | **Impatto:** 🟠 Medio

#### 4.2 Link di disiscrizione

**File:** `backend/routes/alerts.ts`

- `GET /api/alerts/email/unsubscribe?token=<jwt>` — link one-click nell'email
- Il token JWT contiene user_id e subscription_id
- Non richiede login (UX fluida)

**Effort:** Basso | **Impatto:** 🟠 Medio (requisito legale GDPR/CAN-SPAM)

#### 4.3 Health check aggiornato

**File:** `backend/routes/alerts.ts`

- Aggiungere al `/api/alerts/health`: conteggio sottoscrizioni email, stato servizio Resend, statistiche delivery email 24h

**Effort:** Basso | **Impatto:** 🟡 Basso

---

## 4. Tabella Riepilogativa Priorità

| ID | Fase | Effort | Impatto | Descrizione |
|----|------|--------|---------|-------------|
| 1.1 | DB + Backend | Basso | 🔴 Alto | Migrazione email_alert_subscriptions |
| 1.2 | DB + Backend | Medio | 🔴 Alto | Servizio email (Resend) |
| 1.3 | DB + Backend | Medio | 🔴 Alto | Integrazione in alertProcessor |
| 1.4 | DB + Backend | Basso | 🟠 Medio | API endpoints email subscribe/unsubscribe |
| 2.1 | iOS | Basso | 🟠 Medio | EmailNotificationService.swift |
| 2.2 | iOS | Basso | 🟠 Medio | Stato email in AppState |
| 2.3 | iOS | Basso | 🟠 Medio | Attivare toggle in GeneralSettingsView |
| 2.4 | iOS | Basso | 🟠 Medio | Endpoint in APIService |
| 3.1 | Web | Medio | 🟡 Basso | Componente EmailAlertSettings |
| 3.2 | Web | Basso | 🟡 Basso | API client e hooks |
| 4.1 | Monitoraggio | Basso | 🟠 Medio | Rate limiting email |
| 4.2 | Monitoraggio | Basso | 🟠 Medio | Link disiscrizione one-click |
| 4.3 | Monitoraggio | Basso | 🟡 Basso | Health check aggiornato |

---

## 5. Variabili d'Ambiente Necessarie

| Variabile | Dove | Descrizione |
|-----------|------|-------------|
| `RESEND_API_KEY` | Backend (.env) + Netlify | API key di Resend |
| `EMAIL_FROM` | Backend (.env) + Netlify | Mittente email (es. `Smart Meteo <alerts@smartmeteo.app>`) |
| `EMAIL_UNSUBSCRIBE_SECRET` | Backend (.env) + Netlify | Secret per firmare i token JWT di disiscrizione |

---

## 6. Dipendenze da Installare

| Pacchetto | Versione | Scopo |
|-----------|----------|-------|
| `resend` | ^4.x | SDK Resend per invio email |
| `jsonwebtoken` | ^9.x | Generazione/verifica token disiscrizione |

---

## 7. File Critici di Riferimento

| File | Ruolo | Azione |
|------|-------|--------|
| `supabase/migrations/006_profiles.sql` | Tabella profiles con email e preferences | Fase 1.1: riferimento schema |
| `supabase/migrations/017_push_notifications.sql` | Schema alert_subscriptions | Fase 1.1: modello da seguire |
| `supabase/migrations/019_alert_delivery_log.sql` | Log delivery | Fase 1.1: aggiungere colonna channel |
| `backend/services/alertProcessor.ts` | Pipeline invio allerte | Fase 1.3: aggiungere invio email |
| `backend/services/apns.ts` | Servizio push | Fase 1.2: modello per emailService |
| `backend/routes/alerts.ts` | API allerte | Fase 1.4: aggiungere endpoint email |
| `frontend-ios/.../GeneralSettingsView.swift:98-105` | Toggle email stub | Fase 2.3: attivare |
| `frontend-ios/.../Core/State/AppState.swift` | Stato globale | Fase 2.2: aggiungere stato email |
| `frontend-ios/.../Core/Network/APIService.swift` | Client API | Fase 2.4: aggiungere chiamate |
| `frontend-ios/.../Services/AuthService.swift` | Autenticazione | Riferimento per token Bearer |

---

## 8. Considerazioni di Sicurezza

- **Email non dal client:** L'endpoint `/email/subscribe` legge l'email dal profilo utente autenticato, non accetta email dal body della richiesta. Previene invio a email arbitrarie.
- **Rate limiting:** Max 5 email/utente/giorno per prevenire abuse.
- **Disiscrizione:** Link one-click con token JWT firmato (non richiede login).
- **GDPR:** L'utente attiva esplicitamente le email (opt-in). Disiscrizione sempre disponibile.
- **Logging:** Token email hashato nei log, mai in chiaro.

---

## 9. Stima Effort Complessivo

| Fase | Descrizione | Effort stimato |
|------|-------------|----------------|
| Fase 1 | Database + Backend | Medio |
| Fase 2 | iOS | Basso |
| Fase 3 | Frontend Web | Basso-Medio |
| Fase 4 | Monitoraggio | Basso |
| **Totale** | | **Medio** |

La Fase 1 è il blocco fondamentale. Le Fasi 2-4 possono essere implementate in parallelo una volta che il backend è pronto.
