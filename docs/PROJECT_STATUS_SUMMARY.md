# Riepilogo Stato Progetto — Smart Meteo

> **Data:** 2026-03-10
> **Ultimo aggiornamento:** 2026-09-12
> **Scopo:** Riepilogo dello stato di implementazione, gap identificati e migliorie future

---

## 1. Stato delle Fasi

| Fase | Descrizione | Completamento | Note |
|------|-------------|:------------:|------|
| **Fase 1** | Backend Core (connettori, Smart Engine, API, DB) | **100%** | 8 connettori attivi (Weatherstack disabilitato: HTTP non sicuro), engine con media pesata + voting |
| **Fase 2** | Frontend Web MVP (Next.js, Glassmorphism, SWR) | **~95%** | Mancano: test E2E Playwright, audit Lighthouse |
| **Fase 3** | iOS App (SwiftUI, MVVM, Supabase) | **100%** | Widget iOS implementati (WidgetKit) |
| **API Improvements** | Bug fix + espansione fonti + nuovi campi | **~98%** | Backend 100%, Web 100%, iOS ~95% |
| **Fase 5A** | Estrazione campi mancanti backend | **100%** | visibility, uvIndex, cloudCover, dewPoint, moonrise/moonset, hourly AccuWeather |
| **Fase 5B** | iOS: nuovi campi API + card UV/AQI | **100%** | Modello aggiornato, 6 card flippabili, dettaglio AQI |
| **Fase 5C** | Verifiche database | **100%** | Migration 013 + seed 8 fonti verificati (esecuzione DB da confermare) |
| **Fase 5D** | Funzionalità avanzate | **100%** | AI engine V2, Widget iOS, SpriteKit, WeatherKit (live), Haptic, Push — tutti implementati |

---

## 2. Cosa e stato fatto

### Fase 1 — Backend Core
- 9 connettori meteo: Tomorrow.io, Open-Meteo, OpenWeatherMap, AccuWeather, WeatherAPI, Weatherstack (disabilitato: HTTP), Meteostat, WWO, Apple WeatherKit
- Smart Engine V1 con aggregazione pesata (pesi da 0.8 a 1.2) — Weatherstack escluso (peso 0, HTTP non sicuro)
- Sistema allerte meteo completo: 4 fonti (WeatherKit, WeatherAPI, OWM, MeteoAlarm), push APNs, polling 15min, deduplicazione multi-source, cooldown 6h anti-spam
- Migrazioni DB fino a **021** (push notifications, alert enhancement, delivery log, localizzazione allerte, dedup per device) — prossimo numero libero: 022
- API Express: `/api/forecast`, `/api/sources`, `/api/health`, `/api/alerts/*`
- Database Supabase con **21 migration**, RLS, trigger, funzioni utility
- Deploy su Netlify Functions (serverless)

### Fase 2 — Frontend Web
- Next.js 16 + React 19 + Tailwind CSS v4
- Glassmorphism UI con sfondi dinamici animati (pioggia, neve, temporale, nebbia)
- Dashboard: temperatura, condizioni, vento, umidita, precipitazioni, AQI
- Hourly forecast (grafico 24h con eventi astronomici)
- Daily forecast (7 giorni con drill-down orario espandibile)
- SunWindCard (arco solare, turbine vento animate, pressione, fase lunare)
- Barra di ricerca con autocompletamento (Nominatim)
- Gestione localita preferite con sync Supabase
- Pagina gestione fonti (toggle on/off, pesi, stato salute)
- Autenticazione Supabase (login/logout, OAuth callback)
- SWR per caching client con refresh 5 minuti
- 23 test (Jest + React Testing Library)
- Deploy su Vercel

### Fase 3 — iOS App
- SwiftUI con architettura MVVM
- AppState singleton come state management centralizzato
- Design System (AppColors, GlassContainer, DynamicBackground)
- Dashboard completa: CurrentWeather, HourlyForecast (curve Bezier), DailyForecast (WMO icons)
- SunWindCard con arco solare animato, turbine, pressione, fase lunare
- Ricerca localita con MapKit MKLocalSearchCompleter
- Preferiti e home location con sync Supabase (LocationService + RPC)
- Autenticazione email/password con token refresh
- SplashView con animazione
- SidebarView per navigazione settings/fonti/preferiti

### API Improvements (4 sotto-fasi)

**Fase 1 — Bug Fix Critici (tutti risolti):**
- Tomorrow.io: mappatura `weatherCode` → `condition_code` (30 codici)
- Weatherstack: conversione `wind_speed` km/h → m/s
- Meteostat: estrazione campo `pressure`
- formatter.ts: rispetto del `condition_code` esplicito dai connettori

**Fase 2 — Espansione Daily/Hourly (completata):**
- Tomorrow.io: aggiunto endpoint `/forecast` (daily 5gg + hourly 24h)
- OpenWeatherMap: aggiunto endpoint `/forecast` (daily da slot 3h + hourly)
- AccuWeather: aggiunto endpoint `/forecasts/v1/daily/5day` con cache TTL locationKey
- WeatherAPI: migrato da `current.json` a `forecast.json` (daily 7gg + hourly + astronomy)
- Fonti daily passate da **2 a 6**

**Fase 3 — Nuovi Campi Dati (completata):**
- UV Index: aggregato da Open-Meteo, WeatherAPI, AccuWeather
- Visibilita: aggregata da OWM, AccuWeather, WeatherAPI
- Cloud Cover: aggregato da Open-Meteo, WeatherAPI
- AQI Dettagliato: PM2.5, PM10, NO2, O3, CO, SO2 da WeatherAPI
- Fase lunare: preferenza dati API (WeatherAPI, WWO) con fallback calcolo locale

**Fase 4 — Frontend e Cache (completata lato web):**
- Migration 013: colonna `full_data JSONB` + indice GIN + colonne analytics
- Frontend web: seconda riga di card flippabili (UV Index, Pressione/Visibilita, Nuvole/PM2.5)
- Funzioni helper `getUvLabel()` e `getUvColor()` con scala italiana
- Cache engine: salva/restituisce `full_data` completo

### Fase 5 — Completamento e Miglioramenti (5A + 5B + 5C + 5D completate)

**Fase 5A — Estrazione Dati Mancanti Backend:**
- Open-Meteo: aggiunta `visibility` (m→km) e `dew_point_2m` ai params current/hourly
- Tomorrow.io: estratti `uvIndex`, `visibility`, `cloudCover`, `dewPoint` dal realtime + `uv_index_max` dal daily
- AccuWeather: aggiunto endpoint hourly 12h con mapping `HourlyForecast[]`
- Dew point diretto da 3 API (Open-Meteo, Tomorrow, WeatherAPI) con fallback Magnus nel Smart Engine
- WWO: estratti `moonrise`/`moonset` con conversione ISO + `moon_phase`

**Fase 5B — iOS: Nuovi Campi e Card:**
- `Forecast.swift`: aggiunti `uvIndex`, `visibility`, `cloudCover`, `airQuality` (ForecastCurrent), `uvIndexMax` (DailyForecast), `moonrise`/`moonset` (AstronomyData), nuova struct `AirQualityDetail`
- `CurrentWeatherView.swift`: seconda riga di 3 FlipWeatherDetail (UV/Livello UV con colore dinamico, Pressione/Visibilità, Nuvole/PM2.5)
- Sezione "QUALITÀ DELL'ARIA" con griglia 3x2 dettaglio inquinanti (PM2.5, PM10, NO₂, O₃, CO, SO₂)
- Helper `uvLabel(_:)` e `uvColor(_:)` con scala italiana
- `FlipWeatherDetail` esteso con `accentColor` opzionale

**Fase 5C — Database:**
- Migration 013 e seed sources (010+012) verificati nel file system — esecuzione su Supabase da confermare

**Fase 5D — Funzionalità Avanzate:**
- 5D.1: Algoritmo V2 AI-driven con pesi dinamici basati su accuratezza storica (MAE), tabella `source_accuracy`, penalità automatica
- 5D.2: Widget iOS (WidgetKit) con SmartMedeoWidgetExtension per Home Screen
- 5D.3: SpriteKit particle effects in DynamicBackground (pioggia, neve, temporale)
- 5D.4: Cloud cover per condition_code — `normalizeConditionWithCloudCover` nel Smart Engine
- 5D.5: Apple WeatherKit — 9ª fonte meteo, connettore JWT, peso 1.2, verificato LIVE su Netlify
- 5D.6: Haptic feedback iOS con HapticManager integrato nella UI
- 5D.7: Notifiche push per allerte meteo — backend APNs, migration DB, registrazione device token iOS

### Fase 6B — Rete di test (2026-09-12)
- **Backend da 0 a 229 test** in 11 suite: Jest + ts-jest, fixture dei nove provider come costruttori, axios-mock-adapter sui connettori, Supabase e connettori mockati sull'engine, supertest sulle route. I cinque script `verify*.ts` portati nella suite e `scripts/` rimossa
- **25 scenari E2E** Playwright su due viewport, con l'API backend sempre intercettata
- **Tre bug di unità sul vento corretti**: Open-Meteo, WWO e Meteostat consegnavano `wind_speed` in km/h invece di m/s, gonfiando di 3.6× il numero più in vista e contraddicendo il proprio dato orario. Trovati da un test cross-connettore, non leggendo il codice
- `SourcesIndicator` mostrava l'id grezzo di quattro fonti su nove: corretto
- Lint web da 5 errori a 2 (i rimasti sono `setState` in `useEffect`, preesistenti)

### Fase 6A — Dati già pagati, portati all'utente (2026-09-12)
- **Nowcast al minuto** (web + iOS): `forecastNextHour` era propagato dall'engine dalla Fase 5E e **nessun client lo leggeva**. Nuovi `NextHourPrecipitation.tsx` e `NextHourPrecipitationView.swift`, con titolo dedotto dai minuti e non dal `summary` di WeatherKit
- **Indice di consenso** (`backend/utils/consensus.ts`): deviazione standard pesata fra le fonti su temperatura e probabilità di pioggia, contratta verso 50 con `n/(n+2)`; esposta come `confidence` e scritta in `smart_forecasts.confidence_score`, che era `null` dalla migrazione 005. Mostrata in `SourcesIndicator` (solo web: iOS non ha un pannello fonti)
- **`precipitation_intensity`** aggregato ed esposto su `current`: i mm/h in corso erano estratti da cinque connettori e mai aggregati
- **Dati lunari sul web**: `moonrise`, `moonset`, `moon_illumination` erano sul filo e mostrati solo da iOS
- Schema di cache portato a 4; `npm test` del backend include `verifyConsensus` (13 verifiche); suite web a **137 test** in 7 suite
- Documentazione allineata al codice (`CLAUDE.md`, `AGENTS.md`, `.env.example`, `PHASE_1`, `PHASE_3`, `AUDIT`)

### Fase 5E — Hourly Arricchiti e ForecastNextHour
- `HourlyForecast` esteso con `humidity`, `wind_speed`, `uv_index` — estratti da 7 connettori e aggregati nello Smart Engine
- `ForecastNextHour` (previsione precipitazione minuto-per-minuto da WeatherKit) — nuovi tipi, parser, propagazione nel risultato finale

---

## 3. Gap Identificati

### 3.1 iOS — Campi API mancanti ✅ RISOLTO

| Campo | Backend | Web | iOS | Stato |
|-------|:-------:|:---:|:---:|:-----:|
| `uv_index` | ✅ | ✅ | ✅ | Fase 5B — completato |
| `visibility` | ✅ | ✅ | ✅ | Fase 5B — completato |
| `cloud_cover` | ✅ | ✅ | ✅ | Fase 5B — completato |
| `air_quality` (dettaglio) | ✅ | ✅ | ✅ | Fase 5B — completato |
| `uv_index_max` (daily) | ✅ | ✅ | ✅ | Fase 5B — completato |

### 3.2 Backend — Estrazione campi incompleta per connettore ✅ RISOLTO

| Campo | Tomorrow.io | Open-Meteo | OWM | AccuWeather | WeatherAPI | Weatherstack | Meteostat | WWO | Stato |
|-------|:-----------:|:----------:|:---:|:-----------:|:----------:|:------------:|:---------:|:---:|:-----:|
| uv_index | ✅ 5A.2 | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | 4 fonti |
| visibility | ✅ 5A.2 | ✅ 5A.1 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 5 fonti |
| cloud_cover | ✅ 5A.2 | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | 3 fonti |
| hourly forecast | ✅ | ✅ | ✅ | ✅ 5A.3 | ✅ | ❌ | ❌ | ✅ | 6 fonti |
| dew_point | ✅ 5A.4 | ✅ 5A.4 | ❌ | ❌ | ✅ 5A.4 | ❌ | ❌ | ❌ | 3 fonti + fallback Magnus |
| moonrise/moonset | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 5A.5 | 1 fonte |

### 3.3 Testing

| Area | Stato | Piano |
|------|-------|:-----:|
| Frontend web unit test | ✅ 137 test (7 suite) | Restano i 3 hook → TODO_TESTING §4 |
| Frontend web E2E (Playwright) | ✅ 25 scenari × 2 viewport | Fonti autenticate fuori portata → TODO_TESTING §3.4 |
| Backend unit/integration test | ✅ **229 test in 11 suite** (utils, 9 connettori, engine, route con supertest) | Fase 6B |
| iOS unit test | ❌ Non implementato | → VALUTAZIONI_TECNICHE §4 |
| Lighthouse performance audit | ❌ Non eseguito | → TODO_TESTING §5, da fare in CI |

> **La Fase 6B ha prodotto anche cinque ritrovamenti**: tre bug di unità sul vento
> (corretti), i nomi di quattro fonti mancanti nella UI (corretto), il daily e l'hourly
> che ignorano i pesi delle fonti e `/api/alerts/poll` aperto senza `CRON_SECRET`
> (entrambi documentati da test, in carico alla 6C).
> **Prossimo blocco: Fase 6C** della `GAP_ANALYSIS_2026-09.md`.

### 3.4 Database ✅ VERIFICATO

- Migrazioni 001-019 presenti nel file system (incluse 017-019 per push notifications e allerte)
- Migration 013 (`full_data JSONB`), 014-016 (sync sources, accuracy, WeatherKit), 017-019 (alert system) tutte applicate
- Migration 010 (5 fonti) + 012 (3 fonti aggiuntive con `ON CONFLICT`) coprono tutte 8 fonti del backend

### 3.5 Sistema Allerte Meteo ✅ COMPLETATO

- 4 fonti allerte: WeatherKit, WeatherAPI, OpenWeatherMap, MeteoAlarm (EUMETNET)
- Push notification via APNs con deduplicazione multi-source
- Polling automatico ogni 15 minuti (Netlify Scheduled Function)
- Cooldown 6h per subscription per prevenire spam notifiche
- ID allerta deterministici per deduplicazione stabile nel DB
- Delivery log per audit e monitoraggio
- Fix critico (2026-04-01): risolto bug ID non-deterministici che causavano decine di notifiche duplicate

---

### 3.6 Gap verificati sul codice il 2026-09-12

Rilevati confrontando tutti i documenti con il codice (`GAP_ANALYSIS_2026-09.md`):

| # | Gap | Gravità | Stato |
|---|-----|:-------:|-------|
| 1 | `forecastNextHour` servito dal backend e ignorato dai client | 🔴 | ✅ Risolto in Fase 6A |
| 2 | Dati lunari assenti sul web | 🟡 | ✅ Risolto in Fase 6A |
| 3 | `confidence_score` mai calcolato dalla migrazione 005 | 🟠 | ✅ Risolto in Fase 6A |
| 4 | `precipitation_intensity` estratto e mai aggregato | 🟢 | ✅ Risolto in Fase 6A |
| 5 | Meteostat nell'aggregazione: osservazioni passate mescolate a previsioni | 🔴 | ⏳ Fase 6C |
| 6 | `source_accuracy` misura la conformità al consenso, non l'errore vs osservato | 🔴 | ⏳ Fase 6C |
| 7 | AQI da una sola fonte, senza previsione né fallback | 🟠 | ⏳ Fase 6D |
| 8 | `EMAIL_NOTIFICATIONS_PLAN.md` interamente non implementato | 🔴 | ⏳ Decisione pendente (Web Push come alternativa) |
| 9 | Nessun Jest sul backend, nessun E2E, nessun test iOS, nessun Lighthouse | 🔴 | ✅ 6B (restano iOS e Lighthouse) |
| 13 | Vento in km/h da tre connettori su otto | 🔴 | ✅ Risolto in 6B |
| 14 | Daily e hourly ignorano `SOURCE_WEIGHTS` | 🔴 | ⏳ Fase 6C |
| 15 | `/api/alerts/poll` aperto senza `CRON_SECRET` | 🟠 | ⏳ Fase 6C |
| 10 | Radar/mappa previsti dal piano iniziale, mai realizzati | 🟡 | ⏳ Fase 6D |
| 11 | Residui WeatherKit (hourly pressure/visibility/cloudCover, daily snowfall/windMax) | 🟢 | ⏳ Fase 6E |
| 12 | Meteomatics spuntata in `PHASE_1` ma inesistente | 🟡 | ✅ Documentazione corretta |

## 4. Migliorie Future

### Alta Priorita — ✅ TUTTI COMPLETATI

| # | Miglioramento | Stato | Documento |
|---|---------------|:-----:|-----------|
| 1 | **iOS: aggiungere uv_index, visibility, cloud_cover, air_quality** | ✅ | Fase 5B |
| 2 | **Open-Meteo: estrarre visibility** | ✅ | Fase 5A.1 |
| 3 | **Tomorrow.io: estrarre uv_index, visibility, cloud_cover** | ✅ | Fase 5A.2 |
| 4 | **Eseguire migration 013** (file verificato, esecuzione DB da confermare) | ✅ | Fase 5C.1 |
| 5 | **Verificare seed sources** (8 fonti coperte da migration 010+012) | ✅ | Fase 5C.2 |

### Media Priorita

| # | Miglioramento | Stato | Effort | Documento |
|---|---------------|:-----:|--------|-----------|
| 6 | **Test E2E con Playwright** per frontend web | ⏳ | Medio | `TODO_TESTING.md` §3 |
| 7 | **Algoritmo V2 AI-driven** per pesi dinamici | ✅ | Alto | Fase 5D.1 |
| 8 | **Widget iOS** per Home Screen | ✅ | Medio | Fase 5D.2 |
| 9 | **AccuWeather: hourly forecast** (12h) | ✅ | Basso | Fase 5A.3 |
| 10 | **Dew point diretto da API** (3 fonti + fallback Magnus) | ✅ | Basso | Fase 5A.4 |
| 11 | **Backend test suite** | ⏳ | Medio | `TODO_TESTING.md` §2 |
| 12 | **Dettaglio inquinanti AQI** nell'UI iOS | ✅ | Basso | Fase 5B.4 |

### Bassa Priorita

| # | Miglioramento | Stato | Documento |
|---|---------------|:-----:|-----------|
| 13 | Weatherstack: migrazione a HTTPS | ✅ | Disabilitato (peso 0) — `VALUTAZIONI_TECNICHE.md` §1 |
| 14 | SpriteKit particle effects iOS | ✅ | Fase 5D.3 |
| 15 | Cloud cover per accuratezza `condition_code` | ✅ | Fase 5D.4 |
| 16 | Moonrise/moonset da WWO | ✅ | Fase 5A.5 |
| 17 | Apple WeatherKit integration | ✅ | Fase 5D.5 — live con peso 1.2 |
| 18 | Lighthouse performance audit | ⏳ | `VALUTAZIONI_TECNICHE.md` §2 |
| 19 | Valutare sostituzione/declassamento Meteostat | ⏳ | `VALUTAZIONI_TECNICHE.md` §3 |
| 20 | iOS: test unitari per ViewModel e Service | ⏳ | `VALUTAZIONI_TECNICHE.md` §4 |
| 21 | Haptic feedback iOS | ✅ | Fase 5D.6 |
| 22 | Notifiche push per allerte meteo | ✅ | Fase 5D.7 |

---

## 5. Riferimenti Documentazione

| Documento | Contenuto |
|-----------|-----------|
| **`GAP_ANALYSIS_2026-09.md`** | **Verifica di completezza sul codice, gap aperti, doc drift e roadmap Fase 6** |
| `IMPLEMENTATION_PLAN.md` | Piano architetturale generale e roadmap |
| `PHASE_1.md` | Checklist Fase 1 (Backend Core) — completata |
| `PHASE_2.md` | Checklist Fase 2 (Frontend Web) — ~95% |
| `PHASE_3.md` | Checklist Fase 3 (iOS App) — ~95% |
| `AUDIT_API_DATA_SOURCES.md` | Audit completo delle fonti dati API con gap analysis |
| `IMPLEMENTATION_API_IMPROVEMENTS.md` | Piano tecnico dettagliato delle migliorie API |
| `CHANGELOG_API_IMPROVEMENTS.md` | Log delle modifiche implementate per le 4 fasi API |
| `BACKEND_DB_INTEGRATION.md` | Documentazione integrazione Supabase |
| **`IMPLEMENTATION_PLAN_PHASE_5.md`** | **Piano Fase 5: completamento gap (5A-5C) + funzionalita avanzate (5D)** |
| **`TODO_TESTING.md`** | **Roadmap testing: backend unit/integration, E2E Playwright, copertura web, Lighthouse** |
| **`VALUTAZIONI_TECNICHE.md`** | **Valutazioni pendenti: Weatherstack HTTPS, Lighthouse, Meteostat, strategia test iOS** |
