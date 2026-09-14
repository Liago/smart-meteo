# Roadmap Testing — Smart Meteo

> **Data:** 2026-03-10
> **Ultimo aggiornamento:** 2026-09-12
> **Stato:** §2 e §3 completate (Fase 6B). Restano aperte §4 (copertura web
> aggiuntiva, in parte assorbita dagli E2E) e §5 (Lighthouse).
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

### Stato al 2026-09-12 (dopo la Fase 6B)

| Area | Stato | Dettaglio |
|------|-------|-----------|
| Frontend Web — Unit test | ✅ 137 test (7 suite) | api, components, weather-utils, air-quality, narrative, hourly-detail, next-hour |
| Frontend Web — E2E | ✅ 25 scenari × 2 viewport | `e2e/` con Playwright, API intercettata |
| Backend — Unit test | ✅ 171 test | utils (7 suite) + connettori (2 suite) |
| Backend — Integration test | ✅ 58 test | engine (34) e route con supertest (24) |
| iOS — Unit test | ◑ 6 file scritti, manca il target | `frontend-ios/smart-meteo/smart-meteoTests/README.md` — il target va creato una volta in Xcode |
| Lighthouse audit | ❌ Non eseguito | Da fare post-deploy, in CI |

**Totale: 229 test backend + 137 web + 25 E2E.**

**Framework:** Jest 30 + ts-jest su entrambi i lati (jsdom sul web, node sul
backend), React Testing Library, supertest per le route, axios-mock-adapter per
i connettori, Playwright per gli E2E.

### Stato originale (2026-03-10, per confronto)

Il backend non aveva alcun framework di test, il web aveva 23 test in 3 suite,
E2E e Lighthouse erano a zero.

---

## 2. Test Backend — Unit e Integration

> Corrisponde al Punto 11 del PROJECT_STATUS_SUMMARY (Priorità Media)

### 2.1 — Setup Ambiente Test ✅

- [x] Aggiungere dipendenze a `backend/package.json`:
  ```json
  "devDependencies": {
    "jest": "^30.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "supertest": "^6.0.0",
    "@types/supertest": "^6.0.0"
  }
  ```
- [x] Creato `backend/jest.config.js` (CommonJS, con `module: commonjs` nel transform perché il codice compila `nodenext`):
  ```typescript
  export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/__tests__'],
    testMatch: ['**/*.test.ts'],
    moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  };
  ```
- [x] Script in `package.json`: `"test": "jest"`, `"test:watch": "jest --watch"`
- [x] `jest.setup.ts` con variabili Supabase fittizie: `middleware/auth.ts` costruisce il client a livello di modulo e senza env la suite non partiva
- [x] `"jest"` aggiunto ai `types` del tsconfig, così `npm run typecheck` copre anche i test
- [x] Directory `backend/__tests__/` con `connectors/`, `engine/`, `utils/`, `routes/`, `fixtures/`
- [x] I cinque script `scripts/verify*.ts` portati nella suite e la cartella rimossa: due sistemi di test in parallelo erano un doppio posto da ricordare

### 2.2 — Fixture Dati ✅

- [x] `backend/__tests__/fixtures/providers.ts`: **costruttori** e non file JSON statici, così un test parte dalla forma completa e sovrascrive il solo campo che gli interessa. I valori sono nelle unità native di ciascuna API. Provider coperti:
  - `tomorrow-response.json` — Risposta realtime + forecast
  - `openmeteo-response.json` — Risposta current + hourly + daily
  - `owm-response.json` — Risposta weather + forecast
  - `accuweather-response.json` — Risposta currentconditions + daily
  - `weatherapi-response.json` — Risposta forecast.json
  - `weatherstack-response.json` — Risposta current
  - `meteostat-response.json` — Risposta point/hourly
  - `wwo-response.json` — Risposta weather

### 2.3 — Unit Test Connector ✅ (64 test in 2 suite)

Per ogni connector verificato:
- [x] **Risposta null con API key mancante**, senza nemmeno toccare la rete
- [x] **Mapping corretto dei campi** da risposta mockata a `UnifiedForecast`
- [x] **Gestione errori di rete** (`networkError`, 500, errore applicativo in un 200)
- [x] **Normalizzazione condition_code** (inclusi i 30 codici Tomorrow.io)
- [x] **Unità di misura**, con un test cross-connettore dedicato: `windUnits.test.ts`

> **Tre bug trovati qui**, non leggendo il codice: Open-Meteo, WWO e Meteostat
> consegnavano il vento corrente in km/h invece che in m/s, gonfiando di 3.6×
> il numero più in vista dell'app e contraddicendo il proprio dato orario.
> Corretti. Un test per connettore non li avrebbe fatti emergere: serviva
> verificare la convenzione su tutte le fonti insieme.

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

### 2.4 — Unit Test Smart Engine ✅ (34 test)

- [x] **File:** `backend/__tests__/engine/smartEngine.test.ts` — Supabase e i nove connettori sostituiti da mock
- [x] **Media pesata corretta:** Con 2-3 forecast mock, verificare che il risultato aggregato sia la media pesata esatta
- [x] **Condition voting:** Con 3 fonti (2× "rain", 1× "clear"), il risultato deve essere "rain"
- [x] **Daily aggregation:** Forecast di più fonti con stessa data vengono mergiati correttamente
- [x] **Hourly aggregation:** Time slot normalizzati e aggregati
- [x] **Cache hit/miss:** Mock Supabase, verificare che cache valida ritorni risultato cached
- [x] **Dew point Magnus:** Verificare calcolo con valori noti (es. temp=20, humidity=50 → dew_point ≈ 9.3)
- [x] **degreesToCompass:** Verificare tutti i 16 quadranti (0°→N, 90°→E, 180°→S, 270°→W, ecc.)
- [x] **Gestione fonti vuote:** Se tutti i connector falliscono, engine gestisce gracefully

### 2.5 — Unit Test Formatter ✅

- [x] **File:** `backend/__tests__/utils/formatter.test.ts`
- [x] **normalizeCondition:** Testare tutti i pattern (rain, drizzle, thunder → "rain"; snow, sleet → "snow"; fog, mist → "fog"; clear, sunny → "clear"; cloud, overcast → "cloudy")
- [x] **UnifiedForecast constructor:** campi opzionali, arrotondamenti, precedenza del `condition_code` esplicito, distinzione fra zero e assente

### 2.6 — Integration Test Routes ✅ (24 test)

- [x] **File:** `backend/__tests__/routes/api.test.ts` (unico file: copre fonti, forecast, allerte e CORS)
- [x] `supertest` sull'app Express reale:
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
- [x] `GET /api/sources` — Ritorna lista completa (9 fonti)
- [x] `PATCH /api/sources/:id` — Toggle stato corretto (richiede auth mock)
- [x] `PATCH /api/sources/invalid-id` — Ritorna 404
- [x] `GET /api/health` — Ritorna status OK
- [x] `GET /api/forecast` — Con coordinate valide, ritorna forecast (mock connector)
- [x] `GET /api/forecast` — Senza coordinate, ritorna 400
- [x] `GET /api/forecast` — Errore dell'engine → 500 **in JSON**, non una pagina HTML
- [x] `POST /api/alerts/poll` — 200 col segreto giusto, 403 con quello sbagliato o assente
- [x] `GET /api/alerts/active` — 400 senza coordinate
- [x] CORS riflette l'origine e ammette PATCH e POST

### 2.7 — Unit Test Moon Phase ✅

- [x] **File:** `backend/__tests__/utils/moon.test.ts`
- [x] Tutte e otto le fasi coperte in un anno, nessun salto fra giorni consecutivi, ciclo sinodico che torna al punto di partenza, gennaio e febbraio (il mese spostato indietro di un anno) che non rompono il calcolo
- [x] Label italiano sempre dentro il vocabolario delle otto fasi

---

## 3. Test E2E — Playwright

> Corrisponde al Gap 3.3 del PROJECT_STATUS_SUMMARY

### 3.1 — Setup Playwright ✅

- [x] Installato `@playwright/test` in `frontend-web`
- [x] `frontend-web/playwright.config.ts` creato. Differenze rispetto alla bozza sotto: porta **3100**, progetto mobile su **Pixel 7** (il descrittore `iPhone 14` implica WebKit, non installato in tutti gli ambienti), variabili Supabase fittizie nel `webServer` (senza, il middleware di Next risponde 500 prima della pagina) e `CHROMIUM_PATH` opzionale per puntare a un Chromium di sistema:
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
- [x] Directory `frontend-web/e2e/` con `fixtures/api.ts` per l'intercettazione
- [x] Script `"test:e2e"` e `"test:e2e:ui"`
- [x] `e2e/` escluso da Jest, che altrimenti tentava di eseguire gli spec Playwright

### 3.2 — Scenari Dashboard ✅ (16 scenari)

- [x] **File:** `frontend-web/e2e/dashboard.spec.ts`
- [x] Pagina carica e mostra skeleton loader durante fetch
- [x] Dopo fetch, mostra temperatura corrente con unità
- [x] Mostra condizione meteo con icona
- [x] FlippableStat card: click fa il flip e mostra dato retro
- [x] Sezione previsioni giornaliere visibile (7 giorni)
- [x] Espansione giorno mostra hourly drill-down
- [x] Timeline oraria renderizzata con curve e icone
- [x] SunWindCard mostra arco solare, vento, pressione **e i dati lunari** (Fase 6A)
- [x] Indice di consenso: concordi, in disaccordo con intervallo, assente
- [x] Nowcast al minuto: pioggia in arrivo, ora asciutta, dataset assente
- [x] Allerte: banner presente e assente
- [x] Fallback su errore API invece di pagina bianca
- [x] Senza località salvata: schermata di benvenuto e **nessuna chiamata all'API**

### 3.3 — Scenari Ricerca ✅ (5 scenari)

- [x] **File:** `frontend-web/e2e/search.spec.ts` — Nominatim intercettato con una **RegExp**: il glob `**nominatim**` non aggancia un host
- [x] Barra di ricerca accetta input testo
- [x] Digitando una città, appaiono risultati autocompletamento
- [x] Selezione risultato aggiorna dashboard con nuova località
- [x] Pulsante salva preferiti funziona (richiede login)
- [ ] Pulsante "home" imposta località predefinita — richiede una sessione autenticata

### 3.4 — Scenari Sources ⚠️ fuori portata per ora

La pagina `/sources` è protetta dal middleware di Next, che verifica la sessione
Supabase **server-side**: `page.route` intercetta solo le richieste del browser,
quindi la sessione non è falsificabile dagli E2E. Con le variabili Supabase
fittizie dell'ambiente di test la visita da ospite finisce sempre sul login.

- [x] `/sources` reindirizza al login senza autenticazione (in `auth.spec.ts`)
- [ ] Contenuto autenticato (nove fonti, pesi, toggle, stato di salute) —
      richiede un progetto Supabase di test con un utente dedicato

### 3.5 — Scenari Auth ✅ (4 scenari)

- [x] **File:** `frontend-web/e2e/auth.spec.ts`
- [x] Pagina login mostra form email/password
- [ ] Login con credenziali valide → redirect a dashboard — richiede un progetto Supabase di test
- [ ] Logout funziona e torna a stato guest — come sopra
- [x] Pagina sources richiede autenticazione
- [x] La dashboard resta accessibile da ospite

### 3.6 — CI/CD Integration

- [ ] Aggiungere step Playwright a GitHub Actions
- [x] Screenshot su fallimento (`screenshot: 'only-on-failure'`) e trace al primo retry
- [x] Reporter HTML in CI, `list` in locale
- [x] `test-results/`, `playwright-report/` e le cache Playwright in `.gitignore`

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

### Backend Test ✅

- [x] Setup Jest + ts-jest in `backend/`
- [x] Fixture dati per i 9 connector (costruttori con override)
- [x] Unit test connector: 64 test, unità del vento verificate cross-connettore
- [x] Unit test smartEngine: 34 test
- [x] Unit test formatter: normalizeCondition, cloud cover, costruttore
- [x] Unit test moon phase
- [x] Integration test routes con supertest: 24 test
- [x] `npm test` funzionante (229 test) e `npm run typecheck` che copre i test

### Frontend E2E ✅ (tranne gli scenari che richiedono una sessione reale)

- [x] Setup Playwright con API intercettata
- [x] Scenari dashboard (16)
- [x] Scenari ricerca (5)
- [ ] Scenari sources — bloccati dalla sessione server-side (vedi §3.4)
- [x] Scenari auth (4, parte da ospite)
- [ ] CI/CD integration

### Frontend Unit (espansione)

- [x] Test utility aggiuntive: UV, AQI, WMO, precipitazioni, narrativa, qualità dell'aria (137 test in 7 suite)
- [~] Componenti: `HourlyForecast`, `ForecastDetails`, `SunWindCard`, `SearchBar` e `SourcesIndicator` sono ora esercitati dagli E2E attraverso la dashboard reale. Test unitari dedicati aggiungerebbero poco: la priorità si sposta sui **hook**
- [ ] Test 3 hook (useForecast, useSources, **useLocations** — quest'ultimo ha la logica vera: localStorage più sincronizzazione Supabase)

### Performance

- [ ] Lighthouse audit 3 pagine — da fare in CI o su produzione: in sandbox
      `next build` non completa perché `next/font` non raggiunge Google Fonts
- [ ] Documentare metriche baseline
- [ ] Fix per metriche sotto soglia

### Qualità del codice

- [x] Lint web da 5 errori a 2 (`prefer-const`, import non usati, `any`
      sull'utente, `require` in un file CommonJS)
- [ ] I 2 errori rimasti sono `setState` dentro `useEffect` in `app/page.tsx` e
      `SunWindCard.tsx`, entrambi preesistenti: richiedono un piccolo refactor
      dei componenti

---

---

## 7. Comportamenti fotografati dai test, non approvati

Due cose che la suite ora **documenta** senza correggerle, perché cambiarle non
è lavoro di una fase di test:

1. **Il daily e l'hourly usano la media semplice.** `avgSimple` ignora
   `SOURCE_WEIGHTS` proprio sui sette giorni e sulla curva oraria, mentre i mm
   dello stesso oggetto `daily` sono pesati. Contraddice il piano originale
   ("media pesata per valori numerici") e rende inerte, su quasi tutto ciò che
   l'utente guarda, l'intero meccanismo dei pesi dinamici.
   → `GAP_ANALYSIS_2026-09.md` §3.11, Fase 6C.
2. **`POST /api/alerts/poll` è aperto senza `CRON_SECRET`.** In assenza della
   variabile il controllo viene saltato: chiunque può innescare il polling e le
   push. In produzione la variabile va impostata; il codice dovrebbe rifiutare
   la richiesta quando manca, invece di lasciarla passare.
   → `GAP_ANALYSIS_2026-09.md` §3.12.

---

> **Documenti correlati:**
> - `IMPLEMENTATION_PLAN_PHASE_5.md` — Piano implementazione principale
> - `VALUTAZIONI_TECNICHE.md` — Valutazione strategia test iOS (Punto 20)
> - `PROJECT_STATUS_SUMMARY.md` — Stato complessivo del progetto
