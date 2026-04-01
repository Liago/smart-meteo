# Analisi Sistema Allerte Meteo — Smart Meteo

**Data:** 2026-03-17
**Ultimo aggiornamento:** 2026-04-01
**Problema originale:** Il 16 marzo 2026 era attiva un'allerta meteo per vento, ma l'app non ha segnalato nulla.
**Problema successivo (risolto 2026-04-01):** ID allerta non-deterministici (Date.now/Math.random) nei connettori WeatherKit, WeatherAPI e OWM causavano bypass della deduplicazione, generando 57 notifiche duplicate in un giorno. Fix: ID deterministici basati su area/severity/effectiveTime + cooldown 6h per subscription.

---

## 1. Stato Attuale dell'Implementazione

### Backend

| Componente | File | Stato |
|------------|------|-------|
| WeatherKit con allerte | `backend/connectors/weatherkit.ts` | ✅ Implementato |
| Alert Processor | `backend/services/alertProcessor.ts` | ✅ Implementato |
| APNs Push Notifications | `backend/services/apns.ts` | ✅ Implementato |
| Smart Engine (integrazione) | `backend/engine/smartEngine.ts` | ✅ Implementato |
| Route API allerte | `backend/routes/alerts.ts` | ✅ Implementato |
| Tipi WeatherAlert | `backend/types.ts` | ✅ Implementato |

**Endpoint disponibili:**
- `POST /api/alerts/subscribe` — Registra device per allerte con coordinate
- `POST /api/alerts/unsubscribe` — Rimuovi sottoscrizione
- `GET /api/alerts/active?lat=&lon=` — Allerte attive per area geografica
- `POST /api/alerts/test-push` — Test push notification manuale

### Database (Supabase)

| Tabella | Migrazione | Descrizione |
|---------|-----------|-------------|
| `alert_subscriptions` | 017 | Device token, coordinate, piattaforma, enabled |
| `weather_alerts` | 017 + 018 | Allerte con external_alert_id, area, severity, tempi |

**Indici:** `idx_weather_alerts_external_id`, `idx_weather_alerts_expire_time`, `idx_alert_subscriptions_location`

### iOS

| Componente | File | Stato |
|------------|------|-------|
| Push Notification Service | `Services/PushNotificationService.swift` | ✅ Implementato |
| Modello WeatherAlert | `Models/Forecast.swift` | ✅ Implementato |
| Vista allerte (modale) | `UI/Features/Dashboard/WeatherAlertsView.swift` | ✅ Implementato |
| Badge nella dashboard | `UI/Features/Dashboard/DashboardView.swift` | ✅ Implementato |
| Stato globale allerte | `Core/State/AppState.swift` | ✅ Implementato |
| API Service (fetch allerte) | `Core/Network/APIService.swift` | ✅ Implementato |

### Web Frontend

| Componente | Stato |
|------------|-------|
| Tipi WeatherAlert | ❌ Non implementato |
| Componenti allerta | ❌ Non implementato |
| Hook SWR per allerte | ❌ Non implementato |
| Display nella dashboard | ❌ Non implementato |

**Il frontend web non ha alcun supporto per le allerte meteo.**

---

## 2. Flusso Attuale delle Allerte

```
Richiesta forecast (GET /api/forecast)
    └── Smart Engine chiama fetchFromWeatherKitWithAlerts()
        └── Apple WeatherKit API → weatherAlerts dataset
            └── Allerte restituite nella risposta forecast
            └── processWeatherAlerts() lanciato ASYNC (fire-and-forget)
                └── Cerca subscriptions nel raggio di ~50km
                └── Invia push APNs ai dispositivi trovati
                └── Salva in DB per deduplicazione
```

**Punto critico:** le allerte vengono cercate SOLO quando qualcuno richiede un forecast. Non esiste alcun meccanismo di polling in background.

---

## 3. Diagnosi: Perché l'Allerta Vento Non È Arrivata

### Causa 1 (PROBABILE): WeatherKit non ha restituito l'allerta

L'intero sistema dipende da **un'unica fonte: Apple WeatherKit**. Se WeatherKit non include l'allerta vento della Protezione Civile per la zona richiesta, il sistema non ha alcun modo di rilevarla.

La copertura di WeatherKit per le allerte in Italia non è garantita per tutti i tipi di evento e tutte le zone. Le allerte della Protezione Civile italiana potrebbero non essere integrate nel dataset `weatherAlerts` di Apple.

> **Riferimento:** `backend/connectors/weatherkit.ts:103-104` — `parseWeatherAlerts()` legge solo da `data?.weatherAlerts?.alerts`

### Causa 2 (PROBABILE): Nessuna richiesta forecast durante la finestra dell'allerta

Le allerte vengono scoperte solo dentro `getSmartForecast()` (`smartEngine.ts:133-138`). Se nessun utente ha aperto l'app e richiesto un forecast per quella zona durante il periodo dell'allerta, questa non viene mai trovata, processata, né inviata come push.

> **Riferimento:** `backend/engine/smartEngine.ts:127-176` — Fetch allerte solo durante la chiamata forecast

### Causa 3 (PROBABILE): Bug registrazione device token a coordinate (0, 0)

In `PushNotificationService.swift:47-48`, se il GPS non è ancora disponibile al momento della registrazione:

```swift
let lat = AppState.shared.currentLocation?.coordinate.latitude ?? 0.0
let lon = AppState.shared.currentLocation?.coordinate.longitude ?? 0.0
```

La subscription viene salvata con coordinate **(0.0, 0.0)** — nell'Oceano Atlantico. Il matching geografico in `alertProcessor.ts:86-89` (raggio ±0.5°) non troverà mai questa subscription per allerte in Italia.

> **Riferimento:** `frontend-ios/.../PushNotificationService.swift:47-48`

### Causa 4: Cache 30 minuti che sopprime allerte nuove

Se un forecast è in cache (`smartEngine.ts:100-117`), viene restituito direttamente senza contattare WeatherKit. Se l'allerta è stata emessa dopo la creazione della cache, per fino a 30 minuti nessuno la vedrà.

> **Riferimento:** `backend/engine/smartEngine.ts:109-113` — `return cached.full_data` senza check allerte

### Causa 5: Errori silenziosi (fire-and-forget)

Il processing delle allerte è asincrono e non bloccante:

```typescript
processWeatherAlerts(weatherKitAlerts, lat, lon).catch(err =>
    console.error('Error processing weather alerts:', err.message)
);
```

Se qualsiasi passaggio fallisce (query Supabase, invio APNs), il risultato è solo un `console.error` sui log di Netlify. Non c'è retry, dead-letter queue, né notifica di errore.

> **Riferimento:** `backend/engine/smartEngine.ts:442-444`

### Causa 6: Mismatch APNs sandbox/production

In `apns.ts:26`:

```typescript
production: process.env.NODE_ENV === 'production'
```

Se `NODE_ENV` non è esattamente `"production"` su Netlify, il provider APNs usa il gateway sandbox. I device token di produzione (TestFlight/App Store) **non funzionano** con il gateway sandbox — il push fallisce silenziosamente.

> **Riferimento:** `backend/services/apns.ts:26`

---

## 4. Criticità Architetturali

| Criticità | Gravità | Descrizione |
|-----------|---------|-------------|
| Fonte singola | 🔴 Alta | Solo WeatherKit fornisce allerte. Nessuna ridondanza |
| Nessun polling | 🔴 Alta | Le allerte si scoprono solo se qualcuno apre l'app |
| Bug coordinate (0,0) | 🔴 Alta | Registrazioni potenzialmente inutili |
| Fire-and-forget | 🟠 Media | Errori persi senza tracciabilità |
| Cache senza bypass | 🟠 Media | Allerte nuove sopresse dalla cache |
| Web senza allerte | 🟡 Bassa | Frontend web completamente privo di supporto allerte |
| Nessun monitoraggio | 🟠 Media | Impossibile diagnosticare problemi post-hoc |

---

## 5. Piano di Miglioramento

### Fase 1 — Fix Critici (priorità immediata)

#### 1.1 Fix bug registrazione device token a (0, 0) ✅ COMPLETATO

**File:** `frontend-ios/.../PushNotificationService.swift`, `frontend-ios/.../AppState.swift`

- ✅ Non registra il device token finché non è disponibile una posizione GPS valida
- ✅ Token salvato come `pendingDeviceToken` e registrato quando la posizione è confermata
- ✅ `AppState.fetchWeather()` chiama `registerPendingTokenIfNeeded()` dopo il fix GPS
- ✅ Guard aggiuntivo: `abs(lat) > 0.01 || abs(lon) > 0.01` contro coordinate (0,0)

#### 1.2 Cache bypass per allerte fresche ✅ COMPLETATO

**File:** `backend/engine/smartEngine.ts`

- ✅ Quando si restituisce un forecast dalla cache, esegue comunque una chiamata a WeatherKit per il dataset `weatherAlerts`
- ✅ Allerte fresche mergiate nella risposta cached
- ✅ Pipeline `processWeatherAlerts` lanciata anche su cache hit se ci sono allerte nuove

#### 1.3 Logging strutturato per la pipeline allerte ✅ COMPLETATO

**File:** `backend/services/alertProcessor.ts`, `apns.ts`, `smartEngine.ts`

- ✅ Log strutturati con prefisso `[AlertPipeline]`: alert ID, severity, area, coordinate, conteggio subscriptions, risultato push
- ✅ Log con prefisso `[APNs]`: status code, reason, topic per ogni invio push
- ✅ Log se WeatherKit ha restituito 0 allerte (vs. errore)
- ✅ Summary finale con statistiche: processed, pushSent, pushFailed, skipped*, noSubscribers

#### 1.4 Validazione configurazione APNs all'avvio ✅ COMPLETATO

**File:** `backend/services/apns.ts`

- ✅ Health check all'avvio che verifica la presenza di `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`
- ✅ Log chiaro se si usa gateway sandbox o production con tutti i parametri di configurazione
- ✅ Variabile esplicita `APNS_PRODUCTION=true` supportata con fallback a `NODE_ENV`
- ✅ Funzione `getAPNsHealthStatus()` esportata per health check endpoint

---

### Fase 2 — Allerte Multi-Source (ridondanza)

#### 2.1 Attivare allerte da WeatherAPI ✅ COMPLETATO

**File:** `backend/connectors/weatherapi.ts`

- ✅ Cambiato `alerts: 'no'` → `alerts: 'yes'`
- ✅ Funzione `parseWeatherAPIAlerts()` per parsing array `alerts` dalla risposta
- ✅ Funzione `fetchFromWeatherAPIWithAlerts()` che restituisce forecast + allerte
- ✅ Mapping severity e campi: headline, event, areas, effective, expires

#### 2.2 Aggiungere allerte da OpenWeatherMap ✅ COMPLETATO

**File:** `backend/connectors/openweathermap.ts`

- ✅ Funzione `fetchOWMAlerts()` che usa One Call API 3.0 (`/data/3.0/onecall`)
- ✅ Esclude dati non necessari (`exclude: minutely,hourly,daily,current`)
- ✅ Gestione graceful se API key non ha accesso a One Call (401/403)
- ✅ ID formato `owm:{event}_{timestamp}` per deduplicazione

#### 2.3 Aggregazione e deduplicazione multi-source ✅ COMPLETATO

**File:** `backend/engine/smartEngine.ts`

- ✅ Allerte raccolte da WeatherKit, WeatherAPI, OpenWeatherMap durante il fetch
- ✅ Funzione `deduplicateAlerts()` che deduplicazione per evento simile + finestra temporale ±2h
- ✅ Mantiene la versione con severity più alta in caso di duplicati
- ✅ ID formato `{source}:{original_id}` per distinguere la provenienza
- ✅ Cache bypass aggiornato per fetch multi-source parallelo

#### 2.4 Aggiornare interfaccia WeatherAlert ✅ COMPLETATO

**File:** `backend/types.ts`

- ✅ Aggiunto campo `providerSource` per distinguere la fonte dell'allerta
- ✅ Aggiunto campo `event` (tipo evento: "Wind", "Thunderstorm")
- ✅ Aggiunto campo `headline` (titolo breve dell'allerta)

---

### Fase 3 — Background Polling (colmare la lacuna critica)

#### 3.1 Job periodico per controllo allerte ✅ COMPLETATO

**File:** `backend/services/alertPoller.ts`

- ✅ Funzione `getSubscriptionClusters()` che raggruppa le subscription per griglia ~0.5°
- ✅ Funzione `pollAlerts()` che per ogni cluster fetcha allerte da WeatherKit + WeatherAPI + OWM in parallelo
- ✅ Deduplicazione multi-source integrata
- ✅ Processa le allerte tramite la pipeline `processWeatherAlerts` esistente

#### 3.2 Endpoint `/api/alerts/poll` ✅ COMPLETATO

**File:** `backend/routes/alerts.ts`

- ✅ `POST /api/alerts/poll` protetto da header `X-Cron-Secret`
- ✅ Restituisce riepilogo: clusters, alertsFound, alertsProcessed
- ✅ `GET /api/alerts/health` — health check con stato APNs, conteggio sottoscrizioni, statistiche 24h

#### 3.3 Netlify Scheduled Function ✅ COMPLETATO

**File:** `netlify/functions/alert-poll.ts`

- ✅ Funzione schedulata ogni 15 minuti (`*/15 * * * *`)
- ✅ Inizializza APNs e chiama `pollAlerts()` direttamente
- ✅ Logging strutturato con timestamp

---

### Fase 4 — Frontend Web (completare la lacuna)

#### 4.1 Tipi e API client ✅ COMPLETATO

**File:** `frontend-web/lib/types.ts`, `frontend-web/lib/api.ts`

- ✅ Interfaccia `WeatherAlert` aggiunta con tutti i campi (inclusi providerSource, event, headline)
- ✅ Campo `alerts` aggiunto a `ForecastResponse`
- ✅ Funzione `getActiveAlerts(lat, lon)` nell'API client

#### 4.2 Componenti ✅ COMPLETATO

**File:** `frontend-web/components/WeatherAlerts.tsx`

- ✅ Componente `WeatherAlerts` — Banner/card con severità colorata, espandibile, dismissibile
- ✅ Componente `AlertBadge` — Badge compatto per l'header con conteggio
- ✅ Stile glassmorphism coerente (backdrop-blur, bordi colorati per severity)
- ✅ Animazioni Framer Motion per ingresso/uscita

#### 4.3 Hook SWR ✅ COMPLETATO

**File:** `frontend-web/lib/hooks.ts`

- ✅ Hook `useAlerts` con refresh ogni 3 minuti (indipendente dal forecast a 5 min)
- ✅ Deduplicazione SWR a 60 secondi

#### 4.4 Integrazione Dashboard ✅ COMPLETATO

**File:** `frontend-web/app/page.tsx`

- ✅ Allerte mostrate sopra `CurrentWeather`
- ✅ Merge allerte dal forecast + dal database con deduplicazione per id
- ✅ `AlertBadge` con conteggio nell'header
- ✅ Mappatura campi DB → interfaccia frontend (snake_case → camelCase)

---

### Fase 5 — Monitoraggio e Osservabilità

#### 5.1 Tabella log delivery ✅ COMPLETATO

**File:** `supabase/migrations/019_alert_delivery_log.sql`

- ✅ Tabella `alert_delivery_log` con status (sent/failed/expired_token), hash token, risposta APNs
- ✅ Indici su status, attempted_at, alert_id
- ✅ RLS abilitato con policy per service role
- ✅ `alertProcessor.ts` logga ogni delivery nella tabella

#### 5.2 Endpoint health check allerte ✅ COMPLETATO (in Fase 3)

**File:** `backend/routes/alerts.ts`

- ✅ `GET /api/alerts/health` con stato APNs, conteggio sottoscrizioni, statistiche 24h

#### 5.3 Pulizia token scaduti ✅ COMPLETATO

**File:** `backend/services/alertProcessor.ts`, `backend/services/apns.ts`

- ✅ `sendPushNotification` restituisce `PushResult` con `isExpiredToken` flag
- ✅ Quando APNs risponde `BadDeviceToken`, `Unregistered` o `ExpiredProviderToken`, la subscription viene disabilitata (`enabled = false`)
- ✅ Token invalidi loggati come `expired_token` nella delivery log table

---

## 6. Tabella Riepilogativa Priorità

| ID | Fase | Effort | Impatto | Descrizione |
|----|------|--------|---------|-------------|
| 1.1 | Fix Critici | Basso | 🔴 Alto | ✅ Fix bug registrazione coordinate (0,0) |
| 1.2 | Fix Critici | Medio | 🔴 Alto | ✅ Cache bypass per allerte fresche |
| 1.3 | Fix Critici | Basso | 🔴 Alto | ✅ Logging strutturato pipeline allerte |
| 1.4 | Fix Critici | Basso | 🟠 Medio | ✅ Validazione configurazione APNs |
| 2.1 | Multi-Source | Basso | 🔴 Alto | ✅ Attivare allerte WeatherAPI (flip flag) |
| 2.2 | Multi-Source | Medio | 🟠 Medio | ✅ Aggiungere allerte OpenWeatherMap |
| 2.3 | Multi-Source | Medio | 🔴 Alto | ✅ Deduplicazione multi-source |
| 2.4 | Multi-Source | Basso | 🟡 Basso | ✅ Aggiornare interfaccia WeatherAlert |
| 3.1 | Polling | Alto | 🔴 Critico | ✅ Job periodico controllo allerte |
| 3.2 | Polling | Medio | 🔴 Critico | ✅ Endpoint /api/alerts/poll + health |
| 3.3 | Polling | Medio | 🔴 Critico | ✅ Netlify Scheduled Function (15min) |
| 4.1 | Web Frontend | Basso | 🟠 Medio | ✅ Tipi e API client |
| 4.2 | Web Frontend | Medio | 🟠 Medio | ✅ Componenti allerta |
| 4.3 | Web Frontend | Basso | 🟠 Medio | ✅ Hook SWR useAlerts |
| 4.4 | Web Frontend | Medio | 🟠 Medio | ✅ Integrazione dashboard |
| 5.1 | Monitoraggio | Medio | 🔴 Alto | ✅ Tabella log delivery |
| 5.2 | Monitoraggio | Basso | 🟠 Medio | ✅ Health check endpoint |
| 5.3 | Monitoraggio | Basso | 🟠 Medio | ✅ Pulizia token scaduti |

---

## 7. File Critici di Riferimento

| File | Ruolo | Azione |
|------|-------|--------|
| `backend/connectors/weatherkit.ts` | Unica fonte allerte | Fase 2: aggiungere fonti |
| `backend/connectors/weatherapi.ts:43` | `alerts: 'no'` → `'yes'` | Fase 2.1: flip flag |
| `backend/engine/smartEngine.ts:109-113` | Cache senza bypass allerte | Fase 1.2: bypass |
| `backend/engine/smartEngine.ts:442-444` | Fire-and-forget allerte | Fase 1.3: logging |
| `backend/services/alertProcessor.ts` | Pipeline processing | Fase 1.3 + 5.3 |
| `backend/services/apns.ts:26` | Sandbox vs production | Fase 1.4 |
| `frontend-ios/.../PushNotificationService.swift:47-48` | Bug (0,0) | Fase 1.1 |
| `frontend-web/lib/types.ts` | Manca WeatherAlert | Fase 4.1 |
| `frontend-web/app/page.tsx` | Nessun display allerte | Fase 4.4 |
