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
*   [ ] Inizializzare progetto Xcode (iOS App).
*   [ ] Configurare SPM e installare `supabase-swift`.
*   [ ] Creare `APIService`: classe generica per chiamate HTTP con gestione Token Auth.
*   [ ] Implementare `AuthService`: Login, SignUp, SignOut, Session management.
*   [ ] Implementare `LocationManager`: Wrapper su CoreLocation per chiedere permessi e ottenere GPS.

### Step 3.2: Data Layer & Models
*   [ ] Definire `struct` Codable per tutte le risposte API (`Forecast`, `Source`, ecc.).
*   [ ] Creare `WeatherService`: fetch `/api/forecast` con parametri lat/lon.
*   [ ] Creare `SourcesService`: fetch e gestione toggle fonti.

### Step 3.3: UI Skeleton & Design System
*   [ ] Definire palette colori e typography nel Design System.
*   [ ] Creare componenti base: `GlassContainer`, `LoadingView`, `ErrorView`.
*   [ ] Impostare navigazione principale (TabView o NavigationStack).

### Step 3.4: Dashboard Meteo (Main Feature)
*   [ ] Implementare Header (Città, Data).
*   [ ] **Current Weather Card**: Temp attuale, icona, condizioni.
*   [ ] **Hourly View**: Scroll orizzontale con grafico Swift Charts.
*   [ ] **Daily View**: Lista verticale per i prossimi giorni.
*   [ ] Integrare logica di refresh (pull-to-refresh).

### Step 3.5: Search & Location Management
*   [ ] Implementare barra di ricerca (autocompletamento tramite API o Apple Geocoder).
*   [ ] Gestione lista preferiti (CRUD su Supabase `profiles` table).
*   [ ] Sincronizzazione preferiti tra Web e iOS.

### Step 3.6: Dynamic Backgrounds & Polish
*   [ ] Creare logica di switch background in base a `condition_code`.
*   [ ] Implementare animazioni transizione.
*   [ ] Aggiungere Haptics e rifiniture UI.

### Step 3.7: Widget & Extensions (Bonus/Fase 4)
*   [ ] Creare target WidgetExtension.
*   [ ] Widget "Current Weather" (Small & Medium).
*   [ ] TimelineProvider per aggiornamento dati in background.

## 6. Integrazione Backend
L'app comunicherà con lo stesso backend Next.js (o serverless function) utilizzato dal web:
*   **Base URL**: `https://[project].netlify.app` (o localhost in dev).
*   **Auth**: Header `Authorization: Bearer <token>` (Token JWT di Supabase).

## 7. Note per lo Sviluppatore
*   Mantenere la logica di business disaccoppiata dalla view (ViewModel puri).
*   Testare sempre su device fisico per performance (specialmente sfocature e animazioni).
*   Gestire accuratamente gli stati di errore (offline, timeout API).
