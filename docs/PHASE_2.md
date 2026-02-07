# Fase 2: Frontend Web MVP - Piano Dettagliato

Questo documento dettaglia le attivita della Fase 2 del progetto Smart Meteo.
Riferimento: sezione "Fase 2: Frontend Web (MVP)" del `IMPLEMENTATION_PLAN.md`.

---

## Stato Fase 1 (Riepilogo)

La Fase 1 e **sostanzialmente completata** per quanto riguarda lo sviluppo del codice:

| Area | Stato | Note |
|------|-------|------|
| Repository Git & struttura cartelle | Completato | Monorepo con `/backend`, `/frontend-web`, `/frontend-ios` |
| 5 Connectors meteo | Completato | Tomorrow.io, Meteomatics, OpenWeatherMap, WeatherAPI, AccuWeather |
| Smart Engine V1 | Completato | Media pesata + voting per condizioni categoriche |
| Endpoint API (`GET /api/forecast`) | Completato | Express server con health check |
| Schema DB Supabase | Completato | `sources`, `locations`, `raw_forecasts`, `smart_forecasts`, `profiles` |
| Configurazione Supabase (progetto) | **Da completare** | Creazione progetto e deploy tabelle |
| Configurazione Netlify | **Da completare** | Link repo, environment variables, Functions |
| Popolamento API Keys | **Da completare** | Inserimento chiavi in env vars / DB |

> **Nota**: I 3 task infrastrutturali rimanenti (Supabase, Netlify, API Keys) sono prerequisiti
> operativi. Possono essere completati in parallelo con l'inizio della Fase 2, ma devono essere
> pronti prima dell'integrazione frontend-backend.

---

## Obiettivo Fase 2

Costruire il **Frontend Web MVP** con Next.js, realizzando un'interfaccia moderna con effetto
"Wow" (Glassmorphism, sfondi dinamici) che consumi l'API backend e mostri le previsioni
aggregate dello Smart Engine.

---

## Attivita Dettagliate

### 2.1 Setup Progetto Next.js

- [x] Inizializzare progetto Next.js nella cartella `/frontend-web`
- [x] Configurare TypeScript
- [x] Configurare TailwindCSS con design system personalizzato (colori, spacing, breakpoints)
- [x] Configurare ESLint e Prettier per code quality
- [x] Configurare variabili d'ambiente (`.env.local`) per URL backend API
- [x] Strutturare le cartelle del progetto:
  ```
  /frontend-web
    /app            # App Router (Next.js 16)
    /components     # Componenti riutilizzabili
    /lib            # Utilities, API client, hooks
    /public         # Assets statici (icone meteo, manifest PWA)
  ```

### 2.2 Design System & Tema

- [x] Definire palette colori (varianti chiaro/scuro, colori per condizioni meteo)
- [x] Configurare font: Inter (body) con system-ui fallback
- [x] Creare componenti UI base:
  - [x] Card con effetto Glassmorphism (sfondo semitrasparente + blur) - `.glass`, `.glass-strong`, `.glass-dark`
  - [x] Badge per condizioni meteo (SourcesIndicator con badge colorati)
  - [x] Skeleton loader per stati di caricamento (`SkeletonLoader.tsx`)
  - [x] Componente errore/fallback (`ErrorFallback.tsx`)

### 2.3 Sfondi Dinamici (Dynamic Backgrounds)

- [x] Creare animazioni per ogni condizione meteo:
  - `clear` - gradiente cielo sereno (sky-400 -> indigo-600)
  - `cloudy` - gradiente nuvoloso (slate-400 -> slate-600)
  - `rain` - gradiente pioggia + animazione gocce CSS
  - `snow` - gradiente neve + animazione fiocchi CSS
  - `storm` - gradiente temporale + gocce + flash di luce (Framer Motion)
  - `fog` - gradiente nebbia (gray-300 -> gray-500)
- [x] Implementare componente `DynamicBackground` che cambia in base alla condizione attuale
- [x] Ottimizzare performance (gradienti CSS + animazioni leggere, transizioni fluide con Framer Motion)

### 2.4 Componenti Principali

- [x] **SearchBar / LocationPicker**
  - Input per ricerca citta/localita con autocompletamento (Nominatim API)
  - Geolocalizzazione automatica (browser Geolocation API)
  - Suggerimenti con dropdown animato (Framer Motion)

- [x] **CurrentWeather (Hero Section)**
  - Temperatura principale (grande, prominente, con animazione spring)
  - Temperatura percepita (feels_like)
  - Condizione meteo con icona emoji
  - Umidita, velocita vento, probabilita precipitazione (griglia 3 colonne)
  - Indicatore delle fonti utilizzate (es. "Aggregato da 5 fonti")

- [x] **ForecastDetails**
  - Pannello espandibile con dettagli aggiuntivi (animazione apertura/chiusura)
  - Barra animata per probabilita precipitazioni
  - Barra animata per umidita
  - Dettagli vento con velocita
  - Dettagli temperatura effettiva vs percepita

- [x] **SourcesIndicator**
  - Mostra quali fonti hanno contribuito alla previsione corrente
  - Badge colorati per ogni fonte con colore specifico per provider

### 2.5 Integrazione API Backend

- [x] Creare modulo API client (`/lib/api.ts`) per comunicare con il backend
  - `getForecast(lat, lon)` - chiamata a `GET /api/forecast`
  - `getHealth()` - chiamata a `GET /api/health`
  - `getSources()` - chiamata a `GET /api/sources`
  - `toggleSource(id, active)` - chiamata a `PATCH /api/sources/:id`
- [x] Implementare gestione errori e stati di caricamento
- [x] Implementare caching lato client (SWR) con refresh ogni 5 minuti
- [x] Gestire retry con feedback utente (ErrorFallback con pulsante Riprova)
- [x] Tipizzare le risposte API con TypeScript (`/lib/types.ts`)

### 2.6 Pagina Gestione Fonti (Admin/Pro)

- [x] Creare pagina `/sources` per visualizzare le fonti meteo disponibili
- [x] Implementare toggle ON/OFF per abilitare/disabilitare singole fonti
- [x] Mostrare peso attuale di ogni fonte
- [x] Mostrare stato di salute di ogni fonte (ultimo errore, latenza media)
- [x] Endpoint backend implementati:
  - `GET /api/sources` - lista fonti con stato
  - `PATCH /api/sources/:id` - aggiorna stato attivo/inattivo

### 2.7 Responsive Design & Mobile

- [x] Layout responsive (mobile-first approach, max-w-lg centrato)
- [x] Breakpoints: mobile (< 640px), tablet/desktop (>= 640px via `sm:`)
- [x] Sfondi dinamici ottimizzati (gradienti CSS leggeri)
- [x] Touch-friendly: pulsanti con aree di tap adeguate

### 2.8 Performance & SEO

- [x] Configurare SSR per pagina principale (Next.js App Router)
- [x] Implementare meta tags dinamici (Open Graph, Twitter Card)
- [x] Aggiungere manifest PWA per installabilita (`/public/manifest.json`)
- [x] Aggiunto Cache-Control headers sull'endpoint `/api/forecast`

### 2.9 Testing & Quality

- [x] Configurare framework di test (Jest + React Testing Library)
- [x] Scrivere test per API client (4 test: getForecast, getSources, toggleSource, getHealth)
- [x] Scrivere test per weather-utils (11 test: labels, icons, wind direction, gradients)
- [x] Scrivere test per componenti principali (8 test: CurrentWeather, SourcesIndicator, ErrorFallback, SkeletonLoader)
- [ ] Test E2E base con Playwright (da aggiungere in futuro)

---

## Architettura di Deploy

Il progetto e un monorepo con deploy separato per frontend e backend:

```
                    +--------------------------+
                    |       GitHub Repo        |
                    |     (branch: main)       |
                    +-----+----------+---------+
                          |          |
                   push   |          |  push
                          v          v
              +-----------+--+  +----+-----------+
              |   Vercel     |  |   Netlify      |
              |  (Frontend)  |  |  (Backend API) |
              +-----------+--+  +----+-----------+
              | Next.js 16   |  | Express ->     |
              | SSR nativo   |  | Netlify Func.  |
              | TailwindCSS  |  | serverless-http|
              +-----------+--+  +----+-----------+
                          |          |
                          |  HTTPS   |
                 browser  +--CORS--->+
                          |  fetch   |
                          +----------+
```

| Componente | Piattaforma | Directory repo | Config file |
|-----------|-------------|---------------|-------------|
| Frontend (Next.js) | **Vercel** | `/frontend-web` | `frontend-web/vercel.json` |
| Backend API (Express) | **Netlify** | root (`/backend` + `/netlify`) | `netlify.toml` |

---

## Guida Completa al Deploy

### Passo 1: Deploy Backend su Netlify

1. Accedere a [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Collegare il repository GitHub `Liago/smart-meteo`
3. Configurazione build (dovrebbe auto-rilevare da `netlify.toml`):
   - **Base directory**: *(lasciare vuoto = root)*
   - **Build command**: `cd backend && npm install`
   - **Publish directory**: `backend/public`
   - **Functions directory**: `netlify/functions`
4. **Deploy branch**: `main`

#### Variabili d'ambiente Netlify (Site settings → Environment variables)

| Variabile | Valore | Note |
|-----------|--------|------|
| `FRONTEND_URL` | `https://<nome-sito>.vercel.app` | **OBBLIGATORIO** - CORS, impostare dopo il deploy Vercel |
| `TOMORROW_API_KEY` | `<chiave>` | [tomorrow.io/weather-api](https://www.tomorrow.io/weather-api/) |
| `METEOMATICS_USER` | `<utente>` | [meteomatics.com](https://www.meteomatics.com/en/weather-api/) |
| `METEOMATICS_PASSWORD` | `<password>` | Stessa registrazione Meteomatics |
| `OPENWEATHER_API_KEY` | `<chiave>` | [openweathermap.org/api](https://openweathermap.org/api) |
| `WEATHERAPI_KEY` | `<chiave>` | [weatherapi.com](https://www.weatherapi.com/) |
| `ACCUWEATHER_API_KEY` | `<chiave>` | [developer.accuweather.com](https://developer.accuweather.com/) |
| `SUPABASE_URL` | `<url>` | *Futuro* - quando Supabase sara attivo |
| `SUPABASE_KEY` | `<chiave>` | *Futuro* - quando Supabase sara attivo |

#### Verifica backend

Dopo il deploy, visitare:
- `https://<nome-sito>.netlify.app/` → pagina info API
- `https://<nome-sito>.netlify.app/api/health` → `{"status":"ok","timestamp":"..."}`

---

### Passo 2: Deploy Frontend su Vercel

1. Accedere a [vercel.com](https://vercel.com) → **Add New Project** → Importare `Liago/smart-meteo`
2. Configurazione:
   - **Framework Preset**: Next.js (auto-rilevato)
   - **Root Directory**: `frontend-web` (cliccare **Edit** e selezionare)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

#### Variabili d'ambiente Vercel (Settings → Environment Variables)

| Variabile | Valore | Note |
|-----------|--------|------|
| `NEXT_PUBLIC_API_URL` | `https://<nome-sito>.netlify.app` | URL del backend Netlify (senza `/` finale) |

#### Verifica frontend

Dopo il deploy, visitare `https://<nome-sito>.vercel.app` → interfaccia Smart Meteo.

---

### Passo 3: Collegare CORS (post-deploy)

Dopo aver ottenuto l'URL Vercel definitivo:

1. Tornare su **Netlify** → Site settings → Environment variables
2. Aggiornare `FRONTEND_URL` con l'URL Vercel esatto (es. `https://smart-meteo.vercel.app`)
3. Fare un **re-deploy** su Netlify (Deploys → Trigger deploy → Deploy site)

> **Attenzione**: Senza `FRONTEND_URL` configurato correttamente, le chiamate API dal frontend
> verranno bloccate dal CORS. Il backend accetta solo origini esplicitamente autorizzate.

---

### Configurazione CORS (dettaglio tecnico)

Il file `backend/app.ts` gestisce il CORS con questa logica:

| Origin | Permesso | Contesto |
|--------|----------|----------|
| `http://localhost:3000` | Si | Sviluppo locale frontend |
| `http://localhost:3001` | Si | Sviluppo locale (porta alternativa) |
| Valore di `FRONTEND_URL` | Si | Produzione (dominio Vercel) |
| Nessun origin (curl, Postman) | Si | Debug e test API |
| Qualsiasi altro dominio | **No** | Bloccato |

Metodi permessi: `GET`, `PATCH`, `OPTIONS` (preflight)
Header permessi: `Content-Type`
Preflight cache: 24 ore (`maxAge: 86400`)

---

### Sviluppo Locale

Per lavorare in locale con entrambi i servizi:

```bash
# Terminale 1: Backend (porta 3000)
cd backend && npx ts-node server.ts

# Terminale 2: Frontend (porta 3001)
cd frontend-web && npm run dev
```

Il file `frontend-web/.env.local` punta gia a `http://localhost:3000`.
Il CORS del backend permette gia `localhost:3000` e `localhost:3001`.

---

## Nuovi Endpoint Backend

| Endpoint | Metodo | Descrizione | Stato |
|----------|--------|-------------|-------|
| `/api/sources` | GET | Lista fonti meteo con stato e peso | **Implementato** |
| `/api/sources/:id` | PATCH | Aggiorna stato attivo/inattivo di una fonte | **Implementato** |
| `/api/forecast` | GET | *Esistente* - aggiunto supporto per caching headers | **Implementato** |

---

## Stack Tecnologico Fase 2

| Tecnologia | Ruolo | Versione |
|-----------|-------|---------|
| Next.js 16 | Framework React con App Router (SSR su Vercel) | 16.1.6 |
| TypeScript | Type safety | 5.x |
| TailwindCSS | Utility-first CSS | 4.x |
| Framer Motion | Animazioni fluide | 12.x |
| SWR | Data fetching & caching | 2.x |
| Jest + RTL | Unit testing | 30.x / 16.x |
| serverless-http | Wrapper Express per Netlify Functions | 3.x |

---

## Criteri di Completamento Fase 2

La Fase 2 si considera completata quando:

- [x] L'utente puo cercare una localita e visualizzare le previsioni aggregate
- [x] L'interfaccia mostra sfondi dinamici in base alle condizioni meteo
- [x] Il design Glassmorphism e implementato e visivamente accattivante
- [x] La pagina e responsive e funziona su mobile, tablet e desktop
- [x] La pagina gestione fonti permette di vedere e toggleare le fonti
- [x] I test passano e la build non ha errori
- [x] Configurazione deploy Vercel + Netlify pronta
- [x] CORS configurato per comunicazione cross-origin sicura
- [ ] Le performance sono accettabili (Lighthouse score > 80) - *da verificare con deploy*

---

## Problemi Incontrati & Soluzioni

- **Problema**: Google Fonts (Inter) non scaricabile in ambiente di build (network restrizioni TLS)
  **Soluzione**: Utilizzato stack di font di sistema con Inter come preferenza CSS (caricato dal browser se disponibile)

- **Problema**: React 19 `useRef` richiede argomento iniziale obbligatorio
  **Soluzione**: Passato `null` come valore iniziale con tipo union `ReturnType<typeof setTimeout> | null`

- **Problema**: ESLint `react-hooks/purity` segnala `Math.random()` in componenti
  **Soluzione**: Utilizzata funzione deterministica `seedRandom()` per generare dati di animazione pre-calcolati a livello di modulo

- **Problema**: Frontend (Vercel) e Backend (Netlify) su domini diversi → CORS bloccante
  **Soluzione**: CORS restrittivo in `backend/app.ts` con whitelist origini. `FRONTEND_URL` env var su Netlify per autorizzare il dominio Vercel in produzione
