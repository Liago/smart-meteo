# Smart Meteo - Piano di Implementazione

Questo documento descrive l'architettura tecnica e il piano di sviluppo per "Smart Meteo", un'applicazione meteo rivoluzionaria che aggrega dati da molteplici fonti per fornire le previsioni più accurate possibili.

## Obiettivo del Progetto
Creare un'esperienza meteo premium e "rivoluzionaria" (iOS e Web) basata sulla **aggregazione intelligente** di dati da diverse fonti meteo ad alta attendibilità.

## Analisi delle Fonti Meteo (API)

Abbiamo selezionato le seguenti 5 fonti primarie basandoci su affidabilità, precisione e disponibilità di API moderne. L'architettura prevede la possibilità di aggiungere altre fonti manualmente.

1.  **Tomorrow.io (ex ClimaCell)**
    *   **Punti di forza**: Iper-locale, precisione minuto per minuto, focus su impatto meteo.
    *   **Ruolo**: Fonte primaria per "nowcasting" (prossime ore).

2.  **Meteomatics**
    *   **Punti di forza**: Dati professionali, alta risoluzione (modelli da 1km), dati radar e satellite eccellenti.
    *   **Ruolo**: Fonte per dati scientifici e modelli europei/US ad alta risoluzione.

3.  **OpenWeatherMap (OWM)**
    *   **Punti di forza**: Copertura globale massiccia, ottime API "One Call", molto rapida.
    *   **Ruolo**: Baseline per confronto e fallback veloce.

4.  **WeatherAPI.com**
    *   **Punti di forza**: Ottimo bilanciamento tra dati storici e previsioni, facile integrazione.
    *   **Ruolo**: Validazione incrociata dei dati di temperatura e condizioni.

5.  **AccuWeather API**
    *   **Punti di forza**: Brand riconosciuto, reputazione di alta affidabilità ("RealFeel").
    *   **Ruolo**: Verifica qualitativa delle condizioni percepite.

*(Opzionale/Futura)*: **Apple WeatherKit** (per integrazione nativa iOS).

## Architettura Tecnica

### 1. Backend & "Smart Engine"
Il cuore del sistema risiede nel backend, che non si limita a fare da proxy ma elabora i dati.

*   **Runtime**: Node.js
*   **Hosting**: Netlify Functions (Serverless) per scalabilità e gestione costi.
*   **Logica (The Engine)**:
    *   **Fetching**: Recupera dati paralleli dalle 5+ fonti per una coordinata (Lat/Lon).
    *   **Normalization**: Converte tutte le risposte in un formato JSON standardizzato (IS0 8601 per date, Metrico per unità).
    *   **Scoring & Aggregation**:
        *   Ogni fonte ha un "peso" iniziale (configurabile).
        *   **Algoritmo V1 (Media Pesata)**: Calcola la media pesata per valori numerici (Temp, Vento, Pioggia).
        *   **Algoritmo V1 (Voting)**: Per condizioni categoriche (es. "Nuvoloso" vs "Soleggiato"), vince la maggioranza ponderata.
        *   **Algoritmo V2 (AI-driven)**: In futuro, confronteremo le previsioni con i dati reali storici (salvati su DB) per aggiustare i pesi dinamicamente per ogni località (es. "Meteomatics è più precisa a Milano", "Tomorrow.io a New York").
    *   **Caching**: Redis o Caching interno di Netlify/Supabase per ridurre chiamate API e costi.

### 2. Database
*   **Provider**: Supabase (PostgreSQL).
*   **Schema Dati Previsto**:
    *   `sources`: Elenco API, chiavi (crittografate), peso base, stato attivo/inattivo.
    *   `locations`: Località salvate/richieste dagli utenti.
    *   `raw_forecasts`: Dati grezzi scaricati (per analisi storica e debug).
    *   `smart_forecasts`: Il risultato elaborato dell'Engine, servito al frontend.
    *   `users`: Profili utente (sincronizzati tra iOS e Web).

### 3. Frontend Web
*   **Framework**: Next.js (React). Scelto per SEO (Server Side Rendering) e performance.
*   **Styling**: TailwindCSS (configurato con design system personalizzato) o CSS Modules.
*   **UI/UX**:
    *   **Glassmorphism**: Pannelli semitrasparenti con blur.
    *   **Dynamic Backgrounds**: Sfondi animati (video/canvas) in base al meteo corrente.
    *   **Typography**: Font moderni e puliti (Inter, SF Pro Display).
    *   **Interazione**: Animazioni fluide (Framer Motion) al cambio di tab/meteo.

### 4. Frontend iOS
*   **Linguaggio**: Swift.
*   **Framework UI**: SwiftUI.
*   **Architettura**: MVVM.
*   **Feature chiave**: Widget per Home Screen, Integrazione MapKit per radar.

## Privacy & Sicurezza
*   Le API Key delle fonti meteo NON saranno mai esposte nei client frontend.
*   Tutta la logica di chiamata API avviene server-side (Netlify).

## Roadmap Preliminare

### Fase 1: Setup & Backend Core
1.  Setup progetto GitHub (Monorepo o Repo separati).
2.  Setup Supabase e Netlify.
3.  Implementazione connettori per le 5 API Meteo (Node.js).
4.  Creazione algoritmo base di aggregazione ("Smart Engine V1").

### Fase 2: Frontend Web (MVP)
1.  Setup Next.js.
2.  Sviluppo UI "Wow-effect" (Glassmorphism, Video Backgrounds).
3.  Integrazione API backend custom.
4.  Pagina gestione fonti (switch ON/OFF fonti, visibile agli admin/utenti pro).

### Fase 3: iOS App
1.  Setup progetto Xcode.
2.  Refactoring UI per mobile nativo.
3.  Integrazione endpoint backend.

### Fase 4: Optimization & AI
1.  Implementazione raccolta dati storici su Supabase.
2.  Analisi accuratezza e tuning dei pesi delle fonti.

## Prossimi Passi
1.  Confermare la selezione delle API (alcune richiedono piani a pagamento per feature avanzate).
2.  Impostare l'ambiente di sviluppo (Repo).
