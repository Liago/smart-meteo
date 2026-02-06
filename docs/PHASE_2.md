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

- [ ] Inizializzare progetto Next.js nella cartella `/frontend-web`
- [ ] Configurare TypeScript
- [ ] Configurare TailwindCSS con design system personalizzato (colori, spacing, breakpoints)
- [ ] Configurare ESLint e Prettier per code quality
- [ ] Configurare variabili d'ambiente (`.env.local`) per URL backend API
- [ ] Strutturare le cartelle del progetto:
  ```
  /frontend-web
    /app            # App Router (Next.js 14+)
    /components     # Componenti riutilizzabili
    /lib            # Utilities, API client, hooks
    /styles         # Stili globali, tema
    /public         # Assets statici (icone meteo, video bg)
  ```

### 2.2 Design System & Tema

- [ ] Definire palette colori (varianti chiaro/scuro, colori per condizioni meteo)
- [ ] Configurare font: Inter (body) e SF Pro Display o alternativa web (headings)
- [ ] Creare componenti UI base:
  - [ ] Card con effetto Glassmorphism (sfondo semitrasparente + blur)
  - [ ] Badge per condizioni meteo
  - [ ] Skeleton loader per stati di caricamento
  - [ ] Componente errore/fallback

### 2.3 Sfondi Dinamici (Dynamic Backgrounds)

- [ ] Creare/selezionare video o animazioni canvas per ogni condizione meteo:
  - `clear` - cielo sereno
  - `cloudy` - nuvoloso
  - `rain` - pioggia
  - `snow` - neve
  - `storm` - temporale
  - `fog` - nebbia
- [ ] Implementare componente `DynamicBackground` che cambia in base alla condizione attuale
- [ ] Ottimizzare performance (lazy loading video, fallback a gradienti CSS su mobile/connessioni lente)

### 2.4 Componenti Principali

- [ ] **SearchBar / LocationPicker**
  - Input per ricerca citta/localita
  - Geolocalizzazione automatica (browser Geolocation API)
  - Suggerimenti con autocompletamento

- [ ] **CurrentWeather (Hero Section)**
  - Temperatura principale (grande, prominente)
  - Temperatura percepita (feels_like)
  - Condizione meteo con icona
  - Umidita, velocita vento, probabilita precipitazione
  - Indicatore delle fonti utilizzate (es. "Aggregato da 5 fonti")

- [ ] **ForecastDetails**
  - Pannello espandibile con dettagli aggiuntivi
  - Grafico/barra per probabilita precipitazioni
  - Direzione e velocita vento con indicatore visivo

- [ ] **SourcesIndicator**
  - Mostra quali fonti hanno contribuito alla previsione corrente
  - Badge colorati per ogni fonte con stato (attiva/errore)

### 2.5 Integrazione API Backend

- [ ] Creare modulo API client (`/lib/api.ts`) per comunicare con il backend
  - `getForecast(lat, lon)` - chiamata a `GET /api/forecast`
  - `getHealth()` - chiamata a `GET /api/health`
- [ ] Implementare gestione errori e stati di caricamento
- [ ] Implementare caching lato client (SWR o React Query) per ridurre chiamate
- [ ] Gestire timeout e retry con feedback utente
- [ ] Tipizzare le risposte API con TypeScript (condividere types con backend se possibile)

### 2.6 Pagina Gestione Fonti (Admin/Pro)

- [ ] Creare pagina `/sources` per visualizzare le fonti meteo disponibili
- [ ] Implementare toggle ON/OFF per abilitare/disabilitare singole fonti
- [ ] Mostrare peso attuale di ogni fonte
- [ ] Mostrare stato di salute di ogni fonte (ultimo errore, latenza media)
- [ ] **Nota**: Richiede endpoint backend aggiuntivo per gestione fonti
  - `GET /api/sources` - lista fonti con stato
  - `PATCH /api/sources/:id` - aggiorna stato attivo/inattivo

### 2.7 Responsive Design & Mobile

- [ ] Layout responsive (mobile-first approach)
- [ ] Breakpoints: mobile (< 640px), tablet (640-1024px), desktop (> 1024px)
- [ ] Ottimizzare sfondi dinamici per mobile (gradienti al posto di video)
- [ ] Touch-friendly: aree di tap adeguate, swipe gestures dove utile

### 2.8 Performance & SEO

- [ ] Configurare SSR/ISR per pagina principale (SEO-friendly)
- [ ] Ottimizzare Core Web Vitals (LCP, FID, CLS)
- [ ] Implementare meta tags dinamici (Open Graph, Twitter Card)
- [ ] Aggiungere manifest PWA per installabilita
- [ ] Configurare `next/image` per ottimizzazione immagini

### 2.9 Testing & Quality

- [ ] Configurare framework di test (Jest + React Testing Library)
- [ ] Scrivere test per API client
- [ ] Scrivere test per componenti principali (CurrentWeather, SearchBar)
- [ ] Test E2E base con Playwright o Cypress (flusso ricerca -> visualizzazione)

---

## Prerequisiti da Fase 1 (da completare)

Prima dell'integrazione completa, assicurarsi che:

1. **Supabase** sia configurato con le tabelle dello schema (`supabase_schema.sql`)
2. **Backend** sia deployato (Netlify Functions o server di staging)
3. **API Keys** siano configurate nelle environment variables

---

## Nuovi Endpoint Backend Necessari

La Fase 2 richiede l'aggiunta di alcuni endpoint al backend esistente:

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/sources` | GET | Lista fonti meteo con stato e peso |
| `/api/sources/:id` | PATCH | Aggiorna stato attivo/inattivo di una fonte |
| `/api/forecast` | GET | *Esistente* - aggiungere supporto per caching headers |

---

## Stack Tecnologico Fase 2

| Tecnologia | Ruolo |
|-----------|-------|
| Next.js 14+ | Framework React con App Router |
| TypeScript | Type safety |
| TailwindCSS | Utility-first CSS |
| Framer Motion | Animazioni fluide |
| SWR / React Query | Data fetching & caching |
| Jest + RTL | Unit testing |
| Playwright | E2E testing |

---

## Criteri di Completamento Fase 2

La Fase 2 si considera completata quando:

- [ ] L'utente puo cercare una localita e visualizzare le previsioni aggregate
- [ ] L'interfaccia mostra sfondi dinamici in base alle condizioni meteo
- [ ] Il design Glassmorphism e implementato e visivamente accattivante
- [ ] La pagina e responsive e funziona su mobile, tablet e desktop
- [ ] La pagina gestione fonti permette di vedere e toggleare le fonti
- [ ] I test passano e la build non ha errori
- [ ] Le performance sono accettabili (Lighthouse score > 80)

---

## Problemi Incontrati & Soluzioni

*(Aggiungi qui eventuali blocchi o bug risolti durante lo sviluppo)*

- **Problema**: [Descrizione del problema]
  **Soluzione**: [Come e stato risolto]
