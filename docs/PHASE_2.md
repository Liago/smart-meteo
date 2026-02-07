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

## Prerequisiti da Fase 1 (da completare)

Prima dell'integrazione completa, assicurarsi che:

1. **Supabase** sia configurato con le tabelle dello schema (`supabase_schema.sql`)
2. **Backend** sia deployato (Netlify Functions o server di staging)
3. **API Keys** siano configurate nelle environment variables

---

## Nuovi Endpoint Backend Necessari

La Fase 2 richiede l'aggiunta di alcuni endpoint al backend esistente:

| Endpoint | Metodo | Descrizione | Stato |
|----------|--------|-------------|-------|
| `/api/sources` | GET | Lista fonti meteo con stato e peso | **Implementato** |
| `/api/sources/:id` | PATCH | Aggiorna stato attivo/inattivo di una fonte | **Implementato** |
| `/api/forecast` | GET | *Esistente* - aggiunto supporto per caching headers | **Implementato** |

---

## Stack Tecnologico Fase 2

| Tecnologia | Ruolo | Versione |
|-----------|-------|---------|
| Next.js 16 | Framework React con App Router | 16.1.6 |
| TypeScript | Type safety | 5.x |
| TailwindCSS | Utility-first CSS | 4.x |
| Framer Motion | Animazioni fluide | 12.x |
| SWR | Data fetching & caching | 2.x |
| Jest + RTL | Unit testing | 30.x / 16.x |

---

## Criteri di Completamento Fase 2

La Fase 2 si considera completata quando:

- [x] L'utente puo cercare una localita e visualizzare le previsioni aggregate
- [x] L'interfaccia mostra sfondi dinamici in base alle condizioni meteo
- [x] Il design Glassmorphism e implementato e visivamente accattivante
- [x] La pagina e responsive e funziona su mobile, tablet e desktop
- [x] La pagina gestione fonti permette di vedere e toggleare le fonti
- [x] I test passano e la build non ha errori
- [ ] Le performance sono accettabili (Lighthouse score > 80) - *da verificare con deploy*

---

## Problemi Incontrati & Soluzioni

- **Problema**: Google Fonts (Inter) non scaricabile in ambiente di build (network restrizioni TLS)
  **Soluzione**: Utilizzato stack di font di sistema con Inter come preferenza CSS (caricato dal browser se disponibile)

- **Problema**: React 19 `useRef` richiede argomento iniziale obbligatorio
  **Soluzione**: Passato `null` come valore iniziale con tipo union `ReturnType<typeof setTimeout> | null`

- **Problema**: ESLint `react-hooks/purity` segnala `Math.random()` in componenti
  **Soluzione**: Utilizzata funzione deterministica `seedRandom()` per generare dati di animazione pre-calcolati a livello di modulo
