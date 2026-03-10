# Fase 3: Sviluppo App iOS (Native)

Questo documento dettaglia il piano di implementazione per la versione iOS nativa di **Smart Meteo**, come definito nella roadmap generale. L'obiettivo è portare l'esperienza "premium" e l'aggregazione intelligente dei dati su iPhone, sfruttando le capacità native del dispositivo.

## 1. Stack Tecnologico

*   **Linguaggio**: Swift 5.10+
*   **Framework UI**: SwiftUI (iOS 17+ target per sfruttare le ultime API come `MapKit` rinnovato e `Charts`).
*   **Architettura**: MVVM (Model-View-ViewModel) + Coordinator pattern (per la navigazione, se complessa) o NavigationStack standard.
*   **Gestione Dipendenze**: Swift Package Manager (SPM).
*   **Librerie Chiave**:
    *   `supabase-swift`: Per autenticazione e sincronizzazione preferiti.
    *   `Lottie`: Per animazioni meteo complesse (opzionale, se non bastano gli asset nativi/video).
    *   `Kingfisher` (opzionale): Per caching avanzato immagini radar/sfondi (o uso di `AsyncImage`).
*   **Concorrenza**: Swift Concurrency (`async/await`).

## 2. Architettura del Progetto

La struttura delle cartelle seguirà una logica feature-based o layer-based pulita:

```text
SmartMeteoIOS/
├── App/
│   ├── SmartMeteoApp.swift      # Entry point
│   └── ContentView.swift        # Root view
├── Core/
│   ├── DI/                      # Dependency Injection Container
│   ├── Network/                 # API Client (wrapper URLSession)
│   ├── Location/                # LocationManager (CoreLocation)
│   └── Extensions/              # Estensioni utili (Color, View, etc.)
├── Models/                      # Strutture dati (Decodable)
│   ├── Forecast.swift           # Mirror di types.ts (Current, Daily, Hourly)
│   └── UserProfile.swift
├── Services/
│   ├── WeatherService.swift     # Logica di business per il fetch meteo
│   ├── AuthService.swift        # Wrapper per Supabase Auth
│   └── StorageService.swift     # Gestione preferiti (Supabase + UserDefaults)
├── UI/
│   ├── Common/                  # Componenti riusabili (GlassCard, CustomButton)
│   ├── Features/
│   │   ├── Dashboard/           # Schermata principale meteo
│   │   ├── Search/              # Ricerca località
│   │   ├── Settings/            # Gestione fonti e preferenze
│   │   └── Login/               # Schermate Auth
│   └── DesignSystem/            # Colori, Font, Modificatori Glassmorphic
└── Resources/
    ├── Assets.xcassets          # Icone, Immagini
    └── Localizable.strings      # Traduzioni
```

## 3. Data Models (Mirroring Backend)

I modelli Swift dovranno riflettere le interfacce TypeScript definite nel backend/frontend web:

*   **`ForecastResponse`**: Root object.
*   **`CurrentWeather`**: Dati attuali.
*   **`HourlyForecast`**: Previsioni orarie.
*   **`DailyForecast`**: Previsioni giornaliere.
*   **`WeatherSource`**: Info sulle fonti utilizzate (Tomorrow.io, Meteomatics, etc.).

## 4. UI/UX & "Wow Factor"

Replicare e migliorare l'esperienza web su mobile:

1.  **Glassmorphism Nativo**: Utilizzare `Material` (ultraThinMaterial, etc.) di SwiftUI per sfondi sfocati performanti e nativi.
2.  **Dynamic Backgrounds**:
    *   Utilizzare `ZStack` con layer di sfondo animati.
    *   Implementare effetti particellari (pioggia, neve) usando `SpriteKit` integrato in SwiftUI o loop video ottimizzati.
3.  **Haptic Feedback**: Feedback tattile al cambio di tab, ricarica dati o selezione opzioni.
4.  **Charts**: Utilizzare **Swift Charts** per i grafici di temperatura e precipitazioni (più performante e nativo rispetto a librerie terze).

## 5. Roadmap di Implementazione Dettagliata

### Step 3.1: Project Setup & Core Services
*   [x] Inizializzare progetto Xcode (iOS App).
*   [x] Configurare SPM e installare `supabase-swift` (implementazione custom `SupabaseClient.swift`).
*   [x] Creare `APIService`: classe generica per chiamate HTTP con gestione Token Auth.
*   [x] Implementare `AuthService`: Login, SignUp, SignOut, Session management (con token refresh).
*   [x] Implementare `LocationManager`: Wrapper su CoreLocation per chiedere permessi e ottenere GPS.

### Step 3.2: Data Layer & Models
*   [x] Definire `struct` Codable per tutte le risposte API (`Forecast`, `Source`, ecc.).
*   [x] Creare `WeatherService`: fetch `/api/forecast` con parametri lat/lon.
*   [x] Creare `SourcesService`: fetch e gestione toggle fonti (integrato in `AppState`).

### Step 3.3: UI Skeleton & Design System
*   [x] Definire palette colori e typography nel Design System (`AppColors.swift`).
*   [x] Creare componenti base: `GlassContainer`, `LoadingView`, `ViewState`.
*   [x] Impostare navigazione principale (NavigationStack + SidebarView).

### Step 3.4: Dashboard Meteo (Main Feature)
*   [x] Implementare Header (Citta, Data) con context menu per preferiti/home.
*   [x] **Current Weather Card**: Temp attuale, icona, condizioni + flip cards dettaglio.
*   [x] **Hourly View**: Grafico temperature con curve Bezier, sezioni giornaliere, sunrise/sunset.
*   [x] **Daily View**: Lista verticale 7 giorni con WMO icons e drill-down orario.
*   [x] Integrare logica di refresh (pull-to-refresh tramite AppState).

### Step 3.5: Search & Location Management
*   [x] Implementare barra di ricerca (autocompletamento tramite Apple MapKit `MKLocalSearchCompleter`).
*   [x] Gestione lista preferiti (CRUD su Supabase via `LocationService` + RPC `upsert_location`).
*   [x] Sincronizzazione preferiti tra Web e iOS (Supabase `profiles.favorite_locations`).

### Step 3.6: Dynamic Backgrounds & Polish
*   [x] Creare logica di switch background in base a `condition_code` (`DynamicBackground.swift` + `AppColors.gradient`).
*   [x] Implementare animazioni transizione (Spring effects, symbol bounce, turbine rotation).
*   [x] Aggiungere rifiniture UI (SplashView, Glassmorphism, SunWindCard con arco solare).

### Step 3.7: Widget & Extensions (Bonus/Fase 4)
*   [ ] Creare target WidgetExtension.
*   [ ] Widget "Current Weather" (Small & Medium).
*   [ ] TimelineProvider per aggiornamento dati in background.

> **Nota (2026-03-10):** Gli Step 3.1-3.6 sono stati completati. Rimangono aperti: Step 3.7 (Widget iOS), l'aggiunta dei nuovi campi API (uv_index, visibility, cloud_cover, air_quality) ai modelli Swift e alla UI, e l'attivazione degli effetti particellari SpriteKit nel DynamicBackground.

## 6. Integrazione Backend
L'app comunicherà con lo stesso backend Next.js (o serverless function) utilizzato dal web:
*   **Base URL**: `https://[project].netlify.app` (o localhost in dev).
*   **Auth**: Header `Authorization: Bearer <token>` (Token JWT di Supabase).

## 7. Note per lo Sviluppatore
*   Mantenere la logica di business disaccoppiata dalla view (ViewModel puri).
*   Testare sempre su device fisico per performance (specialmente sfocature e animazioni).
*   Gestire accuratamente gli stati di errore (offline, timeout API).
