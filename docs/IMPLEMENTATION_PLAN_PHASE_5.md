# Piano di Implementazione — Fase 5: Completamento e Miglioramenti

> **Data:** 2026-03-10
> **Ultimo aggiornamento:** 2026-03-10
> **Stato:** Fase 5A ✅ | Fase 5B ✅ | Fase 5C ✅ (da verificare esecuzione su Supabase) | Fase 5D: Da implementare
> **Scopo:** Colmare i gap identificati e implementare le migliorie prioritarie su backend, iOS e database

---

## Indice

1. [Panoramica e Priorità](#1-panoramica-e-priorità)
2. [Fase 5A — Estrazione Dati Mancanti Backend](#2-fase-5a--estrazione-dati-mancanti-backend)
3. [Fase 5B — iOS: Campi Mancanti e Nuove Card](#3-fase-5b--ios-campi-mancanti-e-nuove-card)
4. [Fase 5C — Database e Verifiche](#4-fase-5c--database-e-verifiche)
5. [Fase 5D — Funzionalità Avanzate](#5-fase-5d--funzionalità-avanzate)
6. [Riepilogo Fasi e Dipendenze](#6-riepilogo-fasi-e-dipendenze)
7. [Verifica e Testing](#7-verifica-e-testing)

---

## 1. Panoramica e Priorità

Questa fase copre i gap identificati nel `PROJECT_STATUS_SUMMARY.md` (escluso il testing, documentato in `TODO_TESTING.md`) e le migliorie future selezionate.

| Sotto-fase | Contenuto | Priorità | Dipendenze |
|------------|-----------|----------|------------|
| **5A** | Estrazione campi mancanti dai connector backend | Alta | Nessuna | ✅ Completata |
| **5B** | iOS: nuovi campi API + card UV/Visibilità/AQI | Alta | 5A (dati disponibili nell'API) | ✅ Completata |
| **5C** | Verifiche database (migration 013, seed sources) | Alta | Nessuna (parallelizzabile con 5A) | ✅ Verificata (esecuzione DB da confermare) |
| **5D** | Funzionalità avanzate (Widget, AI, SpriteKit, ecc.) | Media/Bassa | 5A, 5B, 5C completate | ⏳ Da implementare |

### Punti coperti

| Punto | Descrizione | Sotto-fase |
|-------|-------------|------------|
| Gap 3.1 | iOS — Campi API mancanti | 5B |
| Gap 3.2 | Backend — Estrazione campi incompleta | 5A |
| Gap 3.4 | Database — Migration e seed | 5C |
| P.1 | iOS: uv_index, visibility, cloud_cover, air_quality | 5B |
| P.2 | Open-Meteo: estrarre visibility | 5A |
| P.3 | Tomorrow.io: estrarre uv_index | 5A |
| P.4 | Eseguire migration 013 | 5C |
| P.5 | Verificare seed sources | 5C |
| P.6 | Algoritmo V2 AI-driven | 5D |
| P.7 | Widget iOS | 5D |
| P.8 | AccuWeather: hourly forecast | 5A |
| P.9 | Dew point diretto da API | 5A |
| P.10 | Dettaglio inquinanti AQI iOS | 5B |
| P.12 | Dettaglio inquinanti AQI iOS (UI) | 5B |
| P.14 | SpriteKit particle effects iOS | 5D |
| P.15 | Cloud cover per condition_code | 5D |
| P.16 | Moonrise/moonset da WWO | 5A |
| P.17 | Apple WeatherKit integration | 5D |
| P.21 | Haptic feedback iOS | 5D |
| P.22 | Notifiche push allerte meteo | 5D |

---

## 2. Fase 5A — Estrazione Dati Mancanti Backend ✅

### 5A.1 — Open-Meteo: Estrazione Visibility ✅

**File:** `backend/connectors/openmeteo.ts`
**Stato:** ✅ Implementato — aggiunto `visibility` e `dew_point_2m` ai params current e hourly, conversione m→km
**Soluzione:**

1. Aggiungere `visibility` alla stringa dei parametri `current`:
```typescript
// Prima (riga ~11)
const currentParams = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,cloud_cover';

// Dopo
const currentParams = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,cloud_cover,visibility';
```

2. Aggiornare il campo nel return:
```typescript
// Prima
visibility: null,

// Dopo (Open-Meteo restituisce in metri, convertire in km)
visibility: current.visibility != null ? current.visibility / 1000 : null,
```

**Nota:** Aggiungere anche `visibility` ai parametri hourly se disponibile, per arricchire i dati orari.

---

### 5A.2 — Tomorrow.io: Estrazione UV Index, Visibility, Cloud Cover ✅

**File:** `backend/connectors/tomorrow.ts`
**Stato:** ✅ Implementato — aggiunto `uvIndex`, `visibility`, `cloudCover`, `dewPoint` a `TomorrowValues` e al return. Aggiunto `uv_index_max` al daily mapping.
**Soluzione:**

1. Estendere l'interfaccia `TomorrowValues`:
```typescript
interface TomorrowValues {
  // ... campi esistenti ...
  uvIndex?: number;
  visibility?: number;    // in km
  cloudCover?: number;    // percentuale 0-100
}
```

2. Aggiornare il return del `UnifiedForecast`:
```typescript
// Aggiungere ai campi correnti
uv_index: values.uvIndex ?? null,
visibility: values.visibility ?? null,
cloud_cover: values.cloudCover ?? null,
```

**Nota:** Verificare anche l'endpoint forecast per `uvIndex` nei dati daily/hourly e mapparlo su `uv_index_max` per daily.

---

### 5A.3 — AccuWeather: Aggiunta Hourly Forecast ✅

**File:** `backend/connectors/accuweather.ts`
**Stato:** ✅ Implementato — aggiunto endpoint `12hour` in `Promise.allSettled`, mapping in `HourlyForecast[]`, `normalizeCondition` per `IconPhrase`.
**Soluzione:**

1. Aggiungere chiamata parallela all'endpoint hourly:
```typescript
const hourlyUrl = `${BASE_URL}/forecasts/v1/hourly/12hour/${locationKey}`;
const hourlyParams = { apikey: API_KEY, metric: true, details: true };
```

2. Mappare la risposta in `HourlyForecast[]`:
```typescript
hourly: hourlyData.map((h: any) => ({
  time: h.DateTime,
  temp: h.Temperature.Value,
  precipitation_prob: h.PrecipitationProbability ?? 0,
  condition_code: mapAccuWeatherIcon(h.WeatherIcon),
  condition_text: h.IconPhrase,
})),
```

3. Includere nel `Promise.all` insieme a current e daily.

**Nota:** L'endpoint 12h è incluso nel piano free di AccuWeather (50 calls/day). Monitorare il consumo API.

---

### 5A.4 — Dew Point Diretto da API ✅

**File principali:** `backend/types.ts`, `backend/utils/formatter.ts`, `backend/engine/smartEngine.ts`, connector `openmeteo.ts`, `tomorrow.ts`, `weatherapi.ts`
**Stato:** ✅ Implementato — `dew_point` aggiunto a `UnifiedForecastData`, `UnifiedForecast`, e 3 connector (Open-Meteo: `dew_point_2m`, Tomorrow: `dewPoint`, WeatherAPI: `dewpoint_c`). Smart Engine aggrega con media pesata e fallback Magnus.
**Soluzione:**

1. Aggiungere `dew_point` a `UnifiedForecastData` in `types.ts`:
```typescript
dew_point?: number | null;
```

2. Estrarre dai connector:
   - **Open-Meteo:** aggiungere `dew_point_2m` ai params current → `dew_point: current.dew_point_2m ?? null`
   - **Tomorrow.io:** campo `dewPoint` nel realtime → `dew_point: values.dewPoint ?? null`
   - **WeatherAPI:** campo `current.dewpoint_c` → `dew_point: current.dewpoint_c ?? null`

3. Modificare `smartEngine.ts`: aggregare `dew_point` come campo numerico pesato. Se il valore aggregato è disponibile da fonti dirette, usarlo; altrimenti fallback sulla formula di Magnus attuale.

---

### 5A.5 — Moonrise/Moonset da WWO ✅

**File:** `backend/connectors/worldweatheronline.ts`, `backend/types.ts`
**Stato:** ✅ Implementato — `moonrise` e `moonset` aggiunti a `AstronomyData` in `types.ts` e estratti dal connector WWO con conversione formato ISO.
**Soluzione:**

1. Aggiungere a `AstronomyData` in `types.ts`:
```typescript
moonrise?: string;
moonset?: string;
```

2. Estrarre nel connector WWO:
```typescript
astronomy: {
  sunrise: astro.sunrise,
  sunset: astro.sunset,
  moon_phase: astro.moon_phase,
  moonrise: astro.moonrise || null,
  moonset: astro.moonset || null,
}
```

3. Propagare al frontend web (SunWindCard) e iOS (SunWindCard) per la visualizzazione.

---

## 3. Fase 5B — iOS: Campi Mancanti e Nuove Card ✅

### 5B.1 — Aggiornamento Modello Forecast.swift ✅

**File:** `frontend-ios/smart-meteo/smart-meteo/Models/Forecast.swift`
**Stato:** ✅ Implementato — Aggiunti `uvIndex`, `visibility`, `cloudCover`, `airQuality` a `ForecastCurrent`; `uvIndexMax` a `DailyForecast`; `moonrise`/`moonset` a `AstronomyData`; nuova struct `AirQualityDetail`.
**Soluzione:**

1. Creare struct `AirQualityDetail`:
```swift
struct AirQualityDetail: Codable {
    let aqiUsEpa: Double?
    let pm25: Double?
    let pm10: Double?
    let no2: Double?
    let o3: Double?
    let co: Double?
    let so2: Double?

    enum CodingKeys: String, CodingKey {
        case aqiUsEpa = "aqi_us_epa"
        case pm25 = "pm2_5"
        case pm10, no2, o3, co, so2
    }
}
```

2. Aggiungere a `ForecastCurrent`:
```swift
let uvIndex: Double?       // CodingKey: "uv_index"
let visibility: Double?    // CodingKey: "visibility" (in km)
let cloudCover: Double?    // CodingKey: "cloud_cover" (percentuale)
let airQuality: AirQualityDetail?  // CodingKey: "air_quality"
```

3. Aggiungere a `DailyForecast`:
```swift
let uvIndexMax: Double?    // CodingKey: "uv_index_max"
```

---

### 5B.2 — Helper UV Index in Swift ✅

**File:** `frontend-ios/smart-meteo/smart-meteo/UI/Features/Dashboard/CurrentWeatherView.swift`
**Stato:** ✅ Implementato — Funzioni `uvLabel(_:)` e `uvColor(_:)` con scala italiana (Basso/Moderato/Alto/Molto Alto/Estremo) e colori corrispondenti.
**Soluzione:**

```swift
import SwiftUI

func uvLabel(_ uv: Double) -> String {
    switch uv {
    case ...2: return "Basso"
    case ...5: return "Moderato"
    case ...7: return "Alto"
    case ...10: return "Molto Alto"
    default: return "Estremo"
    }
}

func uvColor(_ uv: Double) -> Color {
    switch uv {
    case ...2: return .green
    case ...5: return .yellow
    case ...7: return .orange
    case ...10: return .red
    default: return .purple
    }
}

func aqiLabel(_ aqi: Double) -> String {
    switch aqi {
    case ...50: return "Buono"
    case ...100: return "Moderato"
    case ...150: return "Discreto"
    case ...200: return "Scarso"
    case ...300: return "Molto Scarso"
    default: return "Pericoloso"
    }
}
```

---

### 5B.3 — Nuove Card in CurrentWeatherView ✅

**File:** `frontend-ios/smart-meteo/smart-meteo/UI/Features/Dashboard/CurrentWeatherView.swift`
**Stato:** ✅ Implementato — Seconda riga di 3 `FlipWeatherDetail`: UV Index/Livello UV (con colore dinamico), Pressione/Visibilità, Nuvole/PM2.5. `FlipWeatherDetail` esteso con `accentColor` opzionale.
**Soluzione:**

Aggiungere una seconda riga di 3 `FlipWeatherDetail` nella sezione `showMore`:

| Card | Fronte | Retro | Icona Fronte | Icona Retro |
|------|--------|-------|--------------|-------------|
| 1 | UV Index (valore numerico) | Etichetta UV (colorata) | `sun.max.fill` | `sun.max.trianglebadge.exclamationmark` |
| 2 | Pressione (mBar) | Visibilità (km) | `gauge.medium` | `eye.fill` |
| 3 | Nuvole (%) | PM2.5 (µg/m³) | `cloud.fill` | `aqi.medium` |

Pattern da seguire: identico alle 3 card esistenti (`FlipWeatherDetail` con animazione spring 3D flip).

**Implementazione:**
```swift
// Seconda riga di dettagli (dopo le 3 card esistenti)
HStack(spacing: 12) {
    FlipWeatherDetail(
        frontIcon: "sun.max.fill",
        frontValue: current.uvIndex != nil ? String(format: "%.0f", current.uvIndex!) : "--",
        frontLabel: "UV Index",
        backIcon: "sun.max.trianglebadge.exclamationmark",
        backValue: current.uvIndex != nil ? uvLabel(current.uvIndex!) : "--",
        backLabel: "Livello UV",
        isFlipped: $isFlippedUV,
        accentColor: current.uvIndex != nil ? uvColor(current.uvIndex!) : .gray
    )

    FlipWeatherDetail(
        frontIcon: "gauge.medium",
        frontValue: current.pressure != nil ? "\(Int(current.pressure!))" : "--",
        frontLabel: "Pressione",
        backIcon: "eye.fill",
        backValue: current.visibility != nil ? String(format: "%.1f km", current.visibility!) : "--",
        backLabel: "Visibilità",
        isFlipped: $isFlippedPressure
    )

    FlipWeatherDetail(
        frontIcon: "cloud.fill",
        frontValue: current.cloudCover != nil ? "\(Int(current.cloudCover!))%" : "--",
        frontLabel: "Nuvole",
        backIcon: "aqi.medium",
        backValue: current.airQuality?.pm25 != nil ? String(format: "%.1f", current.airQuality!.pm25!) : "--",
        backLabel: "PM2.5",
        isFlipped: $isFlippedClouds
    )
}
```

**Nota:** Aggiungere gli `@State` per `isFlippedUV`, `isFlippedPressure`, `isFlippedClouds`.

---

### 5B.4 — Dettaglio Inquinanti AQI (Punto 10 + 12) ✅

**File:** `frontend-ios/smart-meteo/smart-meteo/UI/Features/Dashboard/CurrentWeatherView.swift`
**Stato:** ✅ Implementato — Nuova sezione "QUALITÀ DELL'ARIA" con `LazyVGrid` 3 colonne mostrante PM2.5, PM10, NO₂, O₃, CO, SO₂. Visibile solo quando `airQuality != nil`. Nuovo componente `AQIDetailItem`.
**Soluzione:**

Aggiungere una sezione espandibile sotto le card, visibile solo quando `airQuality != nil`:

```swift
if let aq = current.airQuality {
    GlassContainer {
        VStack(spacing: 8) {
            Text("Qualità dell'Aria")
                .font(.caption)
                .foregroundColor(.white.opacity(0.7))

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                AQIDetailItem(label: "PM2.5", value: aq.pm25, unit: "µg/m³")
                AQIDetailItem(label: "PM10", value: aq.pm10, unit: "µg/m³")
                AQIDetailItem(label: "NO₂", value: aq.no2, unit: "µg/m³")
                AQIDetailItem(label: "O₃", value: aq.o3, unit: "µg/m³")
                AQIDetailItem(label: "CO", value: aq.co, unit: "µg/m³")
                AQIDetailItem(label: "SO₂", value: aq.so2, unit: "µg/m³")
            }
        }
    }
}
```

---

## 4. Fase 5C — Database e Verifiche ✅

### 5C.1 — Eseguire Migration 013 ✅ (file presente, da verificare esecuzione su Supabase Dashboard)

**File:** `supabase/migrations/013_smart_forecast_full_data.sql`
**Contenuto migration:**
```sql
ALTER TABLE smart_forecasts ADD COLUMN IF NOT EXISTS full_data JSONB;
ALTER TABLE smart_forecasts ADD COLUMN IF NOT EXISTS uv_index REAL;
ALTER TABLE smart_forecasts ADD COLUMN IF NOT EXISTS visibility REAL;
ALTER TABLE smart_forecasts ADD COLUMN IF NOT EXISTS cloud_cover REAL;
CREATE INDEX idx_smart_forecasts_full_data ON smart_forecasts USING gin (full_data);
```

**Azioni:**
1. Verificare se già eseguita:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'smart_forecasts' AND column_name = 'full_data';
```
2. Se non presente, eseguire tramite Supabase Dashboard (SQL Editor) o CLI:
```bash
supabase db push
```
3. Verificare indice GIN creato:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'smart_forecasts';
```

---

### 5C.2 — Verificare Seed Sources ✅

**File:** `supabase/migrations/010_seed_sources.sql`, `supabase/migrations/012_seed_sources_update.sql`
**Stato:** ✅ Verificato — Migration 010 (5 fonti) + 012 (3 fonti aggiuntive con `ON CONFLICT`) coprono tutte 8 le fonti del backend. Da confermare esecuzione su Supabase.

**Azioni:**
1. Query di verifica:
```sql
SELECT id, name, weight, active FROM sources ORDER BY weight DESC;
```
2. Fonti attese (8 totali):

| Nome | Peso | Attivo |
|------|------|--------|
| tomorrow.io | 1.2 | true |
| open-meteo | 1.1 | true |
| accuweather | 1.1 | true |
| openweathermap | 1.0 | true |
| weatherapi | 1.0 | true |
| worldweatheronline | 1.0 | true |
| weatherstack | 0.9 | true |
| meteostat | 0.8 | true |

3. Se mancano fonti, inserire manualmente o ri-eseguire migration 012.

---

## 5. Fase 5D — Funzionalità Avanzate

### 5D.1 — Algoritmo V2 AI-driven (Punto 6)

**Impatto:** Previsioni più precise grazie a pesi dinamici basati sull'accuratezza storica
**Effort:** Alto
**File:** `backend/engine/smartEngine.ts`, nuova migration, nuovo endpoint

**Piano:**
1. **Migration 014** — Creare tabella `source_accuracy`:
```sql
CREATE TABLE source_accuracy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES sources(id),
  metric TEXT NOT NULL,          -- 'temperature', 'precipitation', 'wind_speed'
  mae REAL NOT NULL,             -- Mean Absolute Error
  sample_count INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, metric)
);
```

2. **Calcolo accuratezza** — Nuovo servizio `backend/services/accuracy.ts`:
   - Confronta `raw_forecasts` (previsione) con dati osservati successivi (Meteostat come ground truth)
   - Calcola MAE per source su finestra di 7-30 giorni
   - Endpoint: `GET /api/accuracy` per consultare i punteggi

3. **Pesi dinamici** — Modifica `smartEngine.ts`:
```typescript
// Formula: dynamic_weight = base_weight * (1 / (1 + mae))
const dynamicWeight = baseWeight * (1 / (1 + sourceMAE));
```
   - Fallback su `SOURCE_WEIGHTS` statico se dati insufficienti

4. **Cron/scheduler** — Ricalcolo periodico (giornaliero) tramite Netlify scheduled function o endpoint dedicato

---

### 5D.2 — Widget iOS (Punto 7)

**Impatto:** UX mobile migliorata con accesso rapido dalla Home Screen
**Effort:** Medio
**File:** Nuovo target Xcode `SmartMeteoWidget`

**Piano:**
1. Creare nuovo target WidgetKit nel progetto Xcode
2. Struttura file:
   - `SmartMeteoWidget/SmartMeteoWidget.swift` — Entry point widget
   - `SmartMeteoWidget/Provider.swift` — `TimelineProvider` per aggiornamenti
   - `SmartMeteoWidget/WidgetEntryView.swift` — UI del widget
3. **App Groups** per condividere dati tra app e widget (`group.com.smartmeteo.shared`)
4. Supportare formati `.systemSmall` e `.systemMedium`
5. Contenuto widget:
   - **Small:** Icona condizione + temperatura + nome località
   - **Medium:** + min/max giorno + precipitazioni + prossime 3 ore

---

### 5D.3 — SpriteKit Particle Effects iOS (Punto 14)

**Impatto:** UI più immersiva con animazioni meteo
**Effort:** Medio
**File:** `frontend-ios/smart-meteo/smart-meteo/UI/Common/DynamicBackground.swift`

**Stato attuale:** Placeholder commentato alle righe 15-16. `shouldShowParticles()` definita ma non utilizzata.

**Piano:**
1. Creare `WeatherParticleScene: SKScene`:
```swift
class WeatherParticleScene: SKScene {
    func setupRain() {
        // SKEmitterNode: particelle blu che cadono dall'alto
        // rate: 200/sec, lifetime: 2s, velocità: 400-600
    }

    func setupSnow() {
        // SKEmitterNode: particelle bianche con drift laterale
        // rate: 80/sec, lifetime: 5s, velocità: 50-150
    }

    func setupStorm() {
        // Rain + flash overlay periodico (SKAction.sequence)
    }
}
```
2. Integrare con `SpriteView` nel `DynamicBackground`:
```swift
if shouldShowParticles() {
    SpriteView(scene: weatherScene(for: condition), options: [.allowsTransparency])
        .ignoresSafeArea()
}
```
3. Ottimizzare performance: limitare particelle su dispositivi più vecchi

---

### 5D.4 — Cloud Cover per Condition Code (Punto 15)

**Stato:** ✅ Implementato — aggiunto `normalizeConditionWithCloudCover` e aggregato in `smartEngine`
**Impatto:** Condizioni meteo più accurate basate sulla copertura nuvolosa
**Effort:** Basso
**File:** `backend/utils/formatter.ts`, `backend/engine/smartEngine.ts`

**Piano:**
1. Implementare `normalizeConditionWithCloudCover` in `formatter.ts`:
```typescript
function normalizeConditionWithCloudCover(
  condition: string,
  cloudCover: number | null
): string {
  if (cloudCover === null) return condition;

  // Se condizione generica e copertura bassa → clear
  if ((condition === 'unknown' || condition === 'cloudy') && cloudCover < 25) {
    return 'clear';
  }
  // Se condizione clear ma copertura alta → cloudy
  if (condition === 'clear' && cloudCover > 75) {
    return 'cloudy';
  }
  // Se condizione clear e copertura media → partly cloudy
  if (condition === 'clear' && cloudCover > 30) {
    return 'cloudy'; // o 'partly_cloudy' se supportato
  }
  return condition;
}
```
2. Applicare in `smartEngine.ts` dopo l'aggregazione del condition_code, usando il `cloud_cover` aggregato.

---

### 5D.5 — Apple WeatherKit Integration (Punto 17)

**Impatto:** +1 fonte forecast di alta qualità (dati Apple/TWC)
**Effort:** Alto
**File:** Nuovo `backend/connectors/weatherkit.ts`

**Prerequisiti:**
- Apple Developer Account attivo
- WeatherKit API abilitato in App Store Connect
- Service Key (JWT) per autenticazione REST

**Piano:**
1. Creare `backend/connectors/weatherkit.ts`:
   - REST API: `https://weatherkit.apple.com/api/v1/weather/{lang}/{lat}/{lon}`
   - Autenticazione JWT con chiave di servizio Apple
   - Header: `Authorization: Bearer <jwt_token>`
2. Mappare la risposta in `UnifiedForecast`:
   - `currentWeather` → campi current
   - `forecastDaily.days[]` → daily forecast
   - `forecastHourly.hours[]` → hourly forecast
3. Aggiungere a `SOURCE_FETCHERS` e `SOURCE_WEIGHTS` (peso suggerito: 1.2)
4. Aggiungere alla migration seed sources
5. Variabili ambiente: `APPLE_TEAM_ID`, `APPLE_SERVICE_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`

---

### 5D.6 — Haptic Feedback iOS (Punto 21)

**Stato:** ✅ Implementato — creato HapticManager e integrato nella UI
**Impatto:** UX tattile migliorata
**Effort:** Basso
**File:** Nuovo `frontend-ios/smart-meteo/smart-meteo/UI/Common/HapticManager.swift`, vari file UI

**Stato attuale:** In `SettingsView.swift` il toggle haptic è `.constant(true)` (non funzionante). In `GeneralSettingsView.swift` non è collegato allo stato.

**Piano:**
1. Creare utility `HapticManager`:
```swift
import UIKit

enum HapticManager {
    static func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    static func medium() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
}
```

2. Integrare nei punti di interazione:
   - `CurrentWeatherView`: tap su FlipWeatherDetail → `HapticManager.light()`
   - `DashboardView`: pull-to-refresh → `HapticManager.medium()`
   - `SearchView`: selezione località → `HapticManager.selection()`
   - `SourcesView`: toggle source → `HapticManager.light()`

3. Collegare il toggle in `SettingsView` a `AppState` per abilitare/disabilitare gli haptic globalmente.

---

### 5D.7 — Notifiche Push per Allerte Meteo (Punto 22)

**Impatto:** Utenti avvisati di cambiamenti meteo significativi
**Effort:** Alto
**File:** Nuovo endpoint backend, nuova tabella DB, integrazione APNs iOS

**Piano:**

1. **Database** — Migration 015:
```sql
CREATE TABLE alert_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  device_token TEXT NOT NULL,
  platform TEXT DEFAULT 'ios',    -- 'ios' | 'web'
  location_lat REAL NOT NULL,
  location_lon REAL NOT NULL,
  location_name TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE weather_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_lat REAL NOT NULL,
  location_lon REAL NOT NULL,
  alert_type TEXT NOT NULL,       -- 'rain', 'storm', 'temp_drop', 'snow'
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info',   -- 'info', 'warning', 'critical'
  sent_at TIMESTAMPTZ DEFAULT now()
);
```

2. **Backend** — Nuovi endpoint:
   - `POST /api/alerts/subscribe` — Registra device token
   - `DELETE /api/alerts/unsubscribe` — Rimuovi sottoscrizione
   - `GET /api/alerts/history` — Storico allerte per location

3. **Logica allerte** — Servizio `backend/services/alerts.ts`:
   - Cron che confronta previsioni correnti con precedenti
   - Trigger allerta se: precipitazione >70%, temperatura scende >10°C, condizione passa a storm/snow
   - Invio push via APNs (libreria `@parse/node-apn` o HTTP/2 diretto)

4. **iOS** — Integrazione:
   - Richiedere permessi `UNUserNotificationCenter`
   - Registrare device token APNs
   - Inviare token al backend via `POST /api/alerts/subscribe`
   - Gestire notifiche in foreground/background

---

## 6. Riepilogo Fasi e Dipendenze

```
Fase 5A (Backend) ──────────────┐
                                 ├──→ Fase 5D (Avanzate)
Fase 5B (iOS) ──────────────────┤
  └── dipende da 5A             │
                                 │
Fase 5C (Database) ─────────────┘
  └── parallelizzabile con 5A/5B
```

| Sotto-fase | Stima Effort | Prerequisiti |
|------------|-------------|--------------|
| 5A | Basso-Medio | Nessuno |
| 5B | Medio | 5A completata |
| 5C | Basso | Nessuno |
| 5D.1 (Algoritmo V2) | Alto | 5A, 5C |
| 5D.2 (Widget iOS) | Medio | 5B |
| 5D.3 (SpriteKit) | Medio | Nessuno |
| 5D.4 (Cloud cover) | Basso | 5A |
| 5D.5 (WeatherKit) | Alto | Account Apple Developer |
| 5D.6 (Haptic) | Basso | Nessuno |
| 5D.7 (Push) | Alto | 5C, Account APNs |

---

## 7. Verifica e Testing

### Verifica Fase 5A
- Chiamare `GET /api/forecast?lat=45.4&lon=9.2` e verificare che `uv_index`, `visibility`, `cloud_cover` siano popolati
- Verificare `sources_used` contenga i connector aggiornati
- Controllare che `dew_point` nel response sia diverso dal valore calcolato con Magnus (indica uso diretto)

### Verifica Fase 5B
- Aprire app iOS → Dashboard → espandere "More"
- Verificare seconda riga di card: UV, Pressione/Visibilità, Nuvole/PM2.5
- Verificare che tap sulle card faccia il flip con animazione
- Verificare colore UV coerente con valore

### Verifica Fase 5C
- Query Supabase: `SELECT column_name FROM information_schema.columns WHERE table_name = 'smart_forecasts'`
- Verificare presenza colonne: `full_data`, `uv_index`, `visibility`, `cloud_cover`
- Query: `SELECT COUNT(*) FROM sources` → deve essere 8

### Verifica Fase 5D
- Ogni sotto-fase ha criteri di verifica specifici documentati nel dettaglio sopra

---

> **Documenti correlati:**
> - `TODO_TESTING.md` — Roadmap testing (Gap 3.3 + Punto 11)
> - `VALUTAZIONI_TECNICHE.md` — Decisioni pendenti (Punti 13, 18, 19, 20)
> - `PROJECT_STATUS_SUMMARY.md` — Stato complessivo del progetto
