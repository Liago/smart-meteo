# Roadmap Testing — Smart Meteo

> **Data:** 2026-03-10
> **Stato:** Da implementare
> **Scopo:** Piano completo per la copertura test del progetto (backend, frontend web, E2E)

---

## Indice

1. [Stato Attuale](#1-stato-attuale)
2. [Test Backend — Unit e Integration](#2-test-backend--unit-e-integration)
3. [Test E2E — Playwright](#3-test-e2e--playwright)
4. [Test Frontend Web — Copertura Aggiuntiva](#4-test-frontend-web--copertura-aggiuntiva)
5. [Lighthouse Performance Audit](#5-lighthouse-performance-audit)
6. [Checklist Riepilogativa](#6-checklist-riepilogativa)

---

## 1. Stato Attuale

| Area | Stato | Dettaglio |
|------|-------|-----------|
| Frontend Web — Unit test | ✅ 23 test (3 suite) | `api.test.ts`, `components.test.tsx`, `weather-utils.test.ts` |
| Frontend Web — E2E | ❌ Non implementato | Playwright non configurato |
| Backend — Unit test | ❌ Non implementato | Nessun framework test configurato |
| Backend — Integration test | ❌ Non implementato | Nessun test sulle routes |
| iOS — Unit test | ❌ Non implementato | Vedi `VALUTAZIONI_TECNICHE.md` (Valutazione 4) |
| Lighthouse audit | ❌ Non eseguito | Da fare post-deploy |

**Framework attuale web:** Jest 30 + React Testing Library + ts-jest, ambiente jsdom

---

## 2. Test Backend — Unit e Integration

> Corrisponde al Punto 11 del PROJECT_STATUS_SUMMARY (Priorità Media)

### 2.1 — Setup Ambiente Test

- [ ] Aggiungere dipendenze a `backend/package.json`:
  ```json
  "devDependencies": {
    "jest": "^30.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "supertest": "^6.0.0",
    "@types/supertest": "^6.0.0"
  }
  ```
- [ ] Creare `backend/jest.config.ts`:
  ```typescript
  export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/__tests__'],
    testMatch: ['**/*.test.ts'],
    moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  };
  ```
- [ ] Aggiungere script in `package.json`: `"test": "jest"`, `"test:watch": "jest --watch"`
- [ ] Creare directory `backend/__tests__/` con sottocartelle: `connectors/`, `engine/`, `utils/`, `routes/`, `fixtures/`

### 2.2 — Fixture Dati

- [ ] Creare `backend/__tests__/fixtures/` con file JSON di risposte mock per ogni connector:
  - `tomorrow-response.json` — Risposta realtime + forecast
  - `openmeteo-response.json` — Risposta current + hourly + daily
  - `owm-response.json` — Risposta weather + forecast
  - `accuweather-response.json` — Risposta currentconditions + daily
  - `weatherapi-response.json` — Risposta forecast.json
  - `weatherstack-response.json` — Risposta current
  - `meteostat-response.json` — Risposta point/hourly
  - `wwo-response.json` — Risposta weather

### 2.3 — Unit Test Connector (8 suite)

Per ogni connector testare:
- [ ] **Risposta null con API key mancante** — Il connector deve ritornare `null` o un oggetto con dati vuoti
- [ ] **Mapping corretto dei campi** — Da risposta API mockata a `UnifiedForecast`
- [ ] **Gestione errori di rete** — Axios throws → graceful handling
- [ ] **Normalizzazione condition_code** — Codice API provider → stringa standard

**Priorità di implementazione:**

| # | Connector | File Test | Note |
|---|-----------|-----------|------|
| 1 | open-meteo | `connectors/openmeteo.test.ts` | Fonte principale, gratis, no API key |
| 2 | tomorrow.io | `connectors/tomorrow.test.ts` | Peso più alto (1.2), mapping weatherCode complesso |
| 3 | weatherapi | `connectors/weatherapi.test.ts` | Più completo (UV, AQI, visibility, cloud) |
| 4 | accuweather | `connectors/accuweather.test.ts` | Cache locationKey, mapping icon number |
| 5 | openweathermap | `connectors/owm.test.ts` | Forecast 3h-interval → daily aggregation |
| 6 | worldweatheronline | `connectors/wwo.test.ts` | Hourly da daily, astronomy |
| 7 | weatherstack | `connectors/weatherstack.test.ts` | Solo current, conversione km/h → m/s |
| 8 | meteostat | `connectors/meteostat.test.ts` | Dati storici, non forecast |

### 2.4 — Unit Test Smart Engine

- [ ] **File:** `backend/__tests__/engine/smartEngine.test.ts`
- [ ] **Media pesata corretta:** Con 2-3 forecast mock, verificare che il risultato aggregato sia la media pesata esatta
- [ ] **Condition voting:** Con 3 fonti (2× "rain", 1× "clear"), il risultato deve essere "rain"
- [ ] **Daily aggregation:** Forecast di più fonti con stessa data vengono mergiati correttamente
- [ ] **Hourly aggregation:** Time slot normalizzati e aggregati
- [ ] **Cache hit/miss:** Mock Supabase, verificare che cache valida ritorni risultato cached
- [ ] **Dew point Magnus:** Verificare calcolo con valori noti (es. temp=20, humidity=50 → dew_point ≈ 9.3)
- [ ] **degreesToCompass:** Verificare tutti i 16 quadranti (0°→N, 90°→E, 180°→S, 270°→W, ecc.)
- [ ] **Gestione fonti vuote:** Se tutti i connector falliscono, engine gestisce gracefully

### 2.5 — Unit Test Formatter

- [ ] **File:** `backend/__tests__/utils/formatter.test.ts`
- [ ] **normalizeCondition:** Testare tutti i pattern (rain, drizzle, thunder → "rain"; snow, sleet → "snow"; fog, mist → "fog"; clear, sunny → "clear"; cloud, overcast → "cloudy")
- [ ] **UnifiedForecast constructor:** Campi opzionali null, campi completi, campi parziali

### 2.6 — Integration Test Routes

- [ ] **File:** `backend/__tests__/routes/sources.test.ts`
- [ ] Usare `supertest` con l'app Express:
  ```typescript
  import request from 'supertest';
  import app from '../../app';

  describe('GET /api/sources', () => {
    it('ritorna lista completa delle fonti', async () => {
      const res = await request(app).get('/api/sources');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(8);
    });
  });
  ```
- [ ] `GET /api/sources` — Ritorna lista completa (8 fonti)
- [ ] `PATCH /api/sources/:id` — Toggle stato corretto (richiede auth mock)
- [ ] `PATCH /api/sources/invalid-id` — Ritorna 404
- [ ] `GET /api/health` — Ritorna status OK
- [ ] `GET /api/forecast` — Con coordinate valide, ritorna forecast (mock connector)
- [ ] `GET /api/forecast` — Senza coordinate, ritorna 400

### 2.7 — Unit Test Moon Phase

- [ ] **File:** `backend/__tests__/utils/moon.test.ts`
- [ ] Verificare calcolo fase lunare per date note (es. luna piena, luna nuova)
- [ ] Verificare label italiano corretto

---

## 3. Test E2E — Playwright

> Corrisponde al Gap 3.3 del PROJECT_STATUS_SUMMARY

### 3.1 — Setup Playwright

- [ ] Installare: `cd frontend-web && npm install -D @playwright/test`
- [ ] Installare browser: `npx playwright install`
- [ ] Creare `frontend-web/playwright.config.ts`:
  ```typescript
  import { defineConfig, devices } from '@playwright/test';

  export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    retries: 1,
    use: {
      baseURL: 'http://localhost:3001',
      trace: 'on-first-retry',
    },
    webServer: {
      command: 'npm run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'mobile', use: { ...devices['iPhone 14'] } },
    ],
  });
  ```
- [ ] Creare directory `frontend-web/e2e/`
- [ ] Aggiungere script: `"test:e2e": "playwright test"`, `"test:e2e:ui": "playwright test --ui"`

### 3.2 — Scenari Dashboard

- [ ] **File:** `frontend-web/e2e/dashboard.spec.ts`
- [ ] Pagina carica e mostra skeleton loader durante fetch
- [ ] Dopo fetch, mostra temperatura corrente con unità
- [ ] Mostra condizione meteo con icona
- [ ] FlippableStat card: click fa il flip e mostra dato retro
- [ ] Sezione previsioni giornaliere visibile (7 giorni)
- [ ] Espansione giorno mostra hourly drill-down
- [ ] Timeline oraria renderizzata con curve e icone
- [ ] SunWindCard mostra arco solare, vento, pressione

### 3.3 — Scenari Ricerca

- [ ] **File:** `frontend-web/e2e/search.spec.ts`
- [ ] Barra di ricerca accetta input testo
- [ ] Digitando una città, appaiono risultati autocompletamento
- [ ] Selezione risultato aggiorna dashboard con nuova località
- [ ] Pulsante salva preferiti funziona (richiede login)
- [ ] Pulsante "home" imposta località predefinita

### 3.4 — Scenari Sources

- [ ] **File:** `frontend-web/e2e/sources.spec.ts`
- [ ] Pagina `/sources` mostra tutte le 8 fonti meteo
- [ ] Ogni fonte mostra nome, peso, stato (attivo/disattivo)
- [ ] Toggle source cambia stato (richiede auth)
- [ ] Indicatore di salute (colore) corretto

### 3.5 — Scenari Auth

- [ ] **File:** `frontend-web/e2e/auth.spec.ts`
- [ ] Pagina login mostra form email/password
- [ ] Login con credenziali valide → redirect a dashboard
- [ ] Logout funziona e torna a stato guest
- [ ] Pagina sources richiede autenticazione

### 3.6 — CI/CD Integration

- [ ] Aggiungere step Playwright a GitHub Actions (se configurato)
- [ ] Configurare screenshot su fallimento per debug
- [ ] Configurare report HTML: `reporter: [['html', { open: 'never' }]]`

---

## 4. Test Frontend Web — Copertura Aggiuntiva

> Espansione dei 23 test esistenti in `frontend-web/__tests__/`

### 4.1 — Componenti Non Testati

| Componente | File Test | Casi da coprire |
|------------|-----------|-----------------|
| `HourlyForecast.tsx` | `hourly-forecast.test.tsx` | Rendering timeline, calcolo isDay, astronomy events, curva SVG |
| `ForecastDetails.tsx` | `forecast-details.test.tsx` | Espansione daily, drill-down hourly, rendering 7 giorni |
| `SunWindCard.tsx` | `sun-wind-card.test.tsx` | Arco solare, conversione gradi vento, posizione sole |
| `DynamicBackground.tsx` | `dynamic-background.test.tsx` | Selezione gradiente per condizione, particelle per rain/snow |
| `SearchBar.tsx` | `search-bar.test.tsx` | Input ricerca, risultati, selezione, preferiti |
| `WeatherIcon.tsx` | `weather-icon.test.tsx` | Mapping condizione → icona SVG |
| `SourcesIndicator.tsx` | `sources-indicator.test.tsx` | Conteggio fonti attive, tooltip |
| `ErrorFallback.tsx` | `error-fallback.test.tsx` | Rendering messaggio errore, retry button |

### 4.2 — Test Hook

| Hook | File Test | Casi da coprire |
|------|-----------|-----------------|
| `useForecast` | `hooks.test.ts` | SWR fetch con mock, loading state, error state, refresh |
| `useSources` | `hooks.test.ts` | Lista fonti, toggle source, reload |
| `useLocations` | `useLocations.test.ts` | localStorage read/write, Supabase sync, add/remove preferiti |

### 4.3 — Test Utility Aggiuntivi

- [ ] `getUvLabel()` — Tutti i range UV (0-2, 3-5, 6-7, 8-10, 11+)
- [ ] `getUvColor()` — Colori Tailwind corretti per range
- [ ] `getAqiLabel()` — Tutti i range AQI (0-50, 51-100, 101-150, 151-200, 201-300, 300+)
- [ ] `getAqiColor()` — Colori corretti
- [ ] `getWMOWeatherInfo()` — Mapping completo codici WMO → condizioni

---

## 5. Lighthouse Performance Audit

> Corrisponde al Gap 3.3 e parzialmente al Punto 18 (dettagli in `VALUTAZIONI_TECNICHE.md`)

### 5.1 — Metriche Target (Core Web Vitals)

| Metrica | Target | Descrizione |
|---------|--------|-------------|
| LCP | < 2.5s | Largest Contentful Paint |
| FID/INP | < 200ms | First Input Delay / Interaction to Next Paint |
| CLS | < 0.1 | Cumulative Layout Shift |
| FCP | < 1.8s | First Contentful Paint |
| TTI | < 3.5s | Time to Interactive |
| Speed Index | < 3.0s | Velocità percezione caricamento |

### 5.2 — Pagine da Auditare

- [ ] **Dashboard** (`/`) — Pagina principale, carico più pesante (animazioni, grafici, fetch API)
- [ ] **Sources** (`/sources`) — Lista fonti, meno pesante
- [ ] **Login** (`/login`) — Pagina statica, baseline performance

### 5.3 — Esecuzione

```bash
# Audit locale
npx lighthouse http://localhost:3001 --output=json --output=html --output-path=./lighthouse-report

# Audit produzione (post-deploy)
npx lighthouse https://smart-meteo.vercel.app --output=json --output=html --output-path=./lighthouse-report
```

### 5.4 — Aree di Ottimizzazione Potenziali

- [ ] **Bundle Framer Motion:** ~30-50KB gzipped. Valutare `motion/mini` o lazy import
- [ ] **Font preloading:** Verificare uso di `next/font` per font ottimizzati
- [ ] **Image optimization:** SVG inline vs lazy-loaded
- [ ] **Canvas/CSS animations:** Impatto FPS su mobile per WeatherEffects
- [ ] **Code splitting:** Verificare chunk size con `next/bundle-analyzer`

---

## 6. Checklist Riepilogativa

### Backend Test

- [ ] Setup Jest + ts-jest in `backend/`
- [ ] Fixture dati per 8 connector
- [ ] Unit test: 8 connector suite
- [ ] Unit test: smartEngine (8+ test case)
- [ ] Unit test: formatter (normalizeCondition)
- [ ] Unit test: moon phase
- [ ] Integration test: routes con supertest (6+ test case)
- [ ] Script npm test funzionante

### Frontend E2E

- [ ] Setup Playwright
- [ ] Scenari dashboard (8+ test)
- [ ] Scenari ricerca (5+ test)
- [ ] Scenari sources (4+ test)
- [ ] Scenari auth (4+ test)
- [ ] CI/CD integration

### Frontend Unit (espansione)

- [ ] Test 8 componenti non coperti
- [ ] Test 3 hook (useForecast, useSources, useLocations)
- [ ] Test utility aggiuntive (UV, AQI, WMO)

### Performance

- [ ] Lighthouse audit 3 pagine
- [ ] Documentare metriche baseline
- [ ] Fix per metriche sotto soglia

---

> **Documenti correlati:**
> - `IMPLEMENTATION_PLAN_PHASE_5.md` — Piano implementazione principale
> - `VALUTAZIONI_TECNICHE.md` — Valutazione strategia test iOS (Punto 20)
> - `PROJECT_STATUS_SUMMARY.md` — Stato complessivo del progetto
