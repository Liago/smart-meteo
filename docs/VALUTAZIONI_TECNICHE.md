# Valutazioni Tecniche — Decisioni Pendenti

> **Data:** 2026-03-10
> **Stato:** In valutazione
> **Scopo:** Analisi e raccomandazioni per decisioni che richiedono valutazione prima dell'implementazione

---

## Indice

1. [Weatherstack — Migrazione HTTPS](#1-weatherstack--migrazione-https)
2. [Lighthouse Performance Audit](#2-lighthouse-performance-audit)
3. [Meteostat — Sostituzione o Declassamento](#3-meteostat--sostituzione-o-declassamento)
4. [Strategia Test iOS](#4-strategia-test-ios)

---

## 1. Weatherstack — Migrazione HTTPS

> Punto 13 del PROJECT_STATUS_SUMMARY (Bassa Priorità)

### Contesto

- **File:** `backend/connectors/weatherstack.ts`
- **Endpoint attuale:** `http://api.weatherstack.com/current` (HTTP non sicuro)
- Il commento nel codice (righe 9-10) spiega: il piano free non supporta HTTPS
- Il piano free fornisce solo l'endpoint `current` — nessun forecast, historical, o bulk

### Limitazioni Piano Free

| Funzionalità | Free | Standard ($9.99/mese) | Professional ($49.99/mese) |
|-------------|------|----------------------|---------------------------|
| HTTPS | ❌ | ✅ | ✅ |
| Forecast | ❌ | ✅ (7 giorni) | ✅ (14 giorni) |
| Historical | ❌ | ✅ | ✅ |
| Hourly | ❌ | ❌ | ✅ |
| Richieste/mese | 100 | 50.000 | 300.000 |

### Contributo Attuale all'Aggregazione

- **Peso:** 0.9 (il più basso tra i connector attivi, escluso Meteostat 0.8)
- **Dati forniti:** Solo current (temp, feels_like, humidity, wind_speed, wind_direction, condition)
- **Dati mancanti:** precipitation_prob, daily forecast, hourly forecast, uv_index, visibility, cloud_cover, AQI
- **Impatto sull'aggregazione:** Contribuisce solo ai campi current. Nessun contributo a daily/hourly.

### Opzioni

| # | Opzione | Pro | Contro |
|---|---------|-----|--------|
| A | **Upgrade a Standard** ($9.99/mese) | HTTPS + forecast 7gg | Costo mensile ricorrente |
| B | **Upgrade a Professional** ($49.99/mese) | + hourly, bulk | Costo elevato per dati ridondanti |
| C | **Mantenere piano free** | Zero costi | HTTP non sicuro, contributo minimo |
| D | **Disabilitare connector** | Zero costi, meno complessità | -1 fonte aggregazione |

### Raccomandazione

**Opzione D — Disabilitare il connector** (o declassare a peso 0.0)

Motivazione:
- Il contributo senza daily/hourly/precipitation è marginale per l'aggregazione smart
- HTTP non sicuro è un rischio di sicurezza (dati in chiaro, potenziale MITM)
- Il peso 0.9 è già il più basso tra i provider con forecast
- Rimuoverlo dall'aggregazione attiva non degrada la qualità complessiva
- Mantenere il codice nel repository per eventuale riattivazione con piano paid

**Azione suggerita:**
1. Impostare `active: false` nel DB per la source weatherstack
2. Oppure ridurre peso a 0.0 in `SOURCE_WEIGHTS`
3. Mantenere il file `weatherstack.ts` nel codebase per uso futuro

---

## 2. Lighthouse Performance Audit

> Punto 18 del PROJECT_STATUS_SUMMARY (Bassa Priorità)

### Contesto

- Frontend Next.js 16 deployato su Vercel
- Utilizza Framer Motion per animazioni (contributo bundle ~30-50KB gzipped)
- DynamicBackground con effetti particellari CSS (pioggia, neve, temporale)
- SVG inline nei componenti WeatherIcon
- SWR per data fetching con skeleton loader

### Aree da Valutare Post-Deploy

#### 2.1 — Bundle Size

| Libreria | Peso Stimato (gzipped) | Alternativa |
|----------|----------------------|-------------|
| framer-motion | ~35KB | `motion/mini` (~5KB) per animazioni base |
| swr | ~4KB | Nessuna (già leggero) |
| lucide-react | ~2KB (tree-shakeable) | Nessuna |

**Azione:** Eseguire `npx @next/bundle-analyzer` per analisi dettagliata. Valutare se `motion/mini` copre i casi d'uso (flip card, opacity, scale). Le animazioni 3D flip richiedono `framer-motion` completo.

#### 2.2 — Largest Contentful Paint (LCP)

- Il LCP è probabilmente il blocco `CurrentWeather` con temperatura e icona
- `SkeletonLoader` appare durante il fetch → il vero LCP è post-API response
- **Rischio:** Se l'API è lenta (>2s), LCP supera la soglia

**Azione:** Implementare ISR (Incremental Static Regeneration) o cache server-side per la prima visualizzazione. Valutare `stale-while-revalidate` a livello di CDN Vercel.

#### 2.3 — Cumulative Layout Shift (CLS)

- Le card `FlippableStat` cambiano contenuto al flip ma mantengono dimensioni fisse → CLS basso
- Lo `SkeletonLoader` deve avere le stesse dimensioni dei componenti finali
- **Rischio:** L'apparizione dei dati meteo dopo il fetch potrebbe causare shift se lo skeleton non è dimensionato correttamente

**Azione:** Verificare che SkeletonLoader abbia altezze min fisse per ogni sezione.

#### 2.4 — Effetti Particellari

- `WeatherEffects` in `DynamicBackground.tsx` usa CSS animations per pioggia/neve
- Su mobile possibile degradazione FPS
- **Rischio:** Jank durante scroll su dispositivi low-end

**Azione:** Implementare `prefers-reduced-motion` per disabilitare particelle. Aggiungere fallback statico per mobile.

#### 2.5 — Font Optimization

- Verificare uso di `next/font` per Google Fonts o font custom
- Font non precaricati causano FOUT (Flash of Unstyled Text)

**Azione:** Se non presente, aggiungere `next/font/google` in `layout.tsx`.

### Piano Post-Audit

1. Eseguire Lighthouse su 3 pagine (Dashboard, Sources, Login)
2. Documentare metriche baseline in tabella
3. Identificare metriche sotto soglia Core Web Vitals
4. Prioritizzare fix: LCP > CLS > FID/INP > Performance Score
5. Re-eseguire audit dopo fix per verificare miglioramenti

---

## 3. Meteostat — Sostituzione o Declassamento

> Punto 19 del PROJECT_STATUS_SUMMARY (Bassa Priorità)

### Contesto

- **File:** `backend/connectors/meteostat.ts`
- **Tipo dati:** Dati **storici/osservati**, non previsioni
- **API:** RapidAPI (`meteostat.p.rapidapi.com`), endpoint `point/hourly`
- **Peso attuale:** 0.8 (il più basso)

### Dati Forniti vs Non Forniti

| Campo | Disponibilità | Note |
|-------|:------------:|------|
| temperature | ✅ | Dato osservato (non previsione) |
| humidity | ✅ | Dato osservato |
| wind_speed | ✅ | Dato osservato |
| wind_direction | ✅ | Dato osservato |
| wind_gust | ✅ | Se disponibile |
| pressure | ✅ | Dato osservato |
| precipitation | ✅ | Intensità (non probabilità) |
| condition | ✅ | Da codice WMO |
| feels_like | ❌ | Non fornito |
| daily forecast | ❌ | Non disponibile |
| hourly forecast | ❌ | Non disponibile (solo storico) |
| uv_index | ❌ | Non disponibile |
| visibility | ❌ | Non disponibile |
| cloud_cover | ❌ | Non disponibile |

### Problemi Identificati

1. **Confusione concettuale:** I dati osservati storici vengono mescolati con previsioni future nell'aggregazione. Questo è concettualmente errato — un'osservazione passata non è una previsione.
2. **Ritardo dati:** I dati Meteostat possono avere ore o giorni di ritardo rispetto al tempo reale.
3. **Nessun contributo a daily/hourly:** `hourly: []` e `daily: []` sono sempre vuoti. Contribuisce solo ai campi current.
4. **Peso minimo:** Con peso 0.8 il contributo all'aggregazione è già limitato.

### Opzioni

| # | Opzione | Pro | Contro |
|---|---------|-----|--------|
| A | **Mantenere con peso ridotto** (0.5) | Ancora contributo current | Problema concettuale persiste |
| B | **Spostare a ruolo di validazione** | Dati osservati utili per accuracy scoring | Richiede refactoring engine |
| C | **Sostituire con WeatherKit** (Punto 17) | Fonte previsioni completa | Costo Apple Developer, effort alto |
| D | **Disabilitare** | Semplicità | -1 fonte, perdiamo ground truth |

### Raccomandazione

**Opzione B — Spostare a ruolo di validazione**

Motivazione:
- I dati osservati di Meteostat sono preziosi come "ground truth" per calcolare l'accuratezza degli altri provider
- Questo è esattamente il caso d'uso ideale per il **Punto 6 (Algoritmo V2 AI-driven)** della Fase 5D
- Rimuovere Meteostat dall'aggregazione previsioni ma usarlo come benchmark di accuratezza

**Implementazione suggerita:**
1. Escludere Meteostat dall'aggregazione in `smartEngine.ts` (filtro per tipo "historical")
2. Continuare a salvare dati Meteostat in `raw_forecasts` con flag `type: 'observation'`
3. Usare i dati osservati nel servizio `accuracy.ts` (Punto 6) per calcolare MAE dei forecast
4. Aggiungere campo `source_type` a tabella `sources`: `'forecast' | 'observation'`

**Tempistica:** Implementare insieme all'Algoritmo V2 (Fase 5D.1)

---

## 4. Strategia Test iOS

> Punto 20 del PROJECT_STATUS_SUMMARY (Bassa Priorità)

### Contesto

- **Architettura:** MVVM con `DashboardViewModel` e `AppState` singleton
- **Dependency injection:** `WeatherServiceProtocol` definito in `Services/WeatherService.swift` (righe 5-8) → facilita il mocking
- **AppState:** Accetta dependency injection nel costruttore (righe 31-34)
- **Framework disponibile:** XCTest built-in in Xcode
- **Test attuali:** Nessuno

### Aree Testabili (per priorità)

| # | Area | Rischio | Valore Test | Effort |
|---|------|---------|-------------|--------|
| 1 | **Model decoding** (Forecast.swift) | Basso | Alto | Basso |
| 2 | **Helper functions** (UV label/color, formatTime) | Basso | Medio | Basso |
| 3 | **DashboardViewModel** | Medio | Alto | Medio |
| 4 | **WeatherService** | Basso | Basso | Medio |
| 5 | **LocationService** | Medio | Medio | Alto |

### Opzioni Framework

| Framework | Pro | Contro |
|-----------|-----|--------|
| **XCTest** (built-in) | Zero dipendenze, integrato Xcode | Syntax verbosa |
| **Quick/Nimble** | BDD syntax leggibile | Dipendenza esterna, overhead |
| **Swift Testing** (Swift 5.9+) | Moderno, macro-based, integrato | Richiede Xcode 15+ |

### Raccomandazione

**XCTest puro** per iniziare — zero overhead, nessuna dipendenza, sufficiente per unit test.

### Struttura Proposta

```
frontend-ios/smart-meteo/smart-meteoTests/
├── Models/
│   └── ForecastDecodingTests.swift    — Decodifica JSON → struct Swift
├── ViewModels/
│   └── DashboardViewModelTests.swift  — Bindings, state changes
├── Helpers/
│   └── UVHelperTests.swift            — uvLabel, uvColor, aqiLabel
└── Mocks/
    └── MockWeatherService.swift       — Implementa WeatherServiceProtocol
```

### Casi di Test Prioritari

**ForecastDecodingTests.swift:**
- [ ] Decodifica `ForecastResponse` completa da JSON fixture
- [ ] Decodifica con campi opzionali null (`uv_index: null`, `air_quality: null`)
- [ ] Decodifica `AirQualityDetail` con campi parziali
- [ ] Decodifica `DailyForecast` con `uv_index_max`
- [ ] Fallback su valori default per campi mancanti

**DashboardViewModelTests.swift:**
- [ ] Stato iniziale è `.idle`
- [ ] Dopo `fetchWeather()` con mock → stato `.success`
- [ ] Con mock errore → stato `.error`
- [ ] `toggleFavorite()` aggiunge/rimuove correttamente

**UVHelperTests.swift:**
- [ ] `uvLabel(0)` → "Basso", `uvLabel(3)` → "Moderato", `uvLabel(11)` → "Estremo"
- [ ] `uvColor(0)` → .green, `uvColor(8)` → .red
- [ ] `aqiLabel(25)` → "Buono", `aqiLabel(175)` → "Scarso"

### Mock Service

```swift
class MockWeatherService: WeatherServiceProtocol {
    var mockForecast: ForecastResponse?
    var mockError: Error?

    func fetchForecast(lat: Double, lon: Double) async throws -> ForecastResponse {
        if let error = mockError { throw error }
        guard let forecast = mockForecast else {
            throw URLError(.badServerResponse)
        }
        return forecast
    }
}
```

### Tempistica

Implementare i test iOS **dopo** la Fase 5B (aggiunta campi mancanti), così da testare i nuovi campi sin dall'inizio. La struttura di mock si basa sul `WeatherServiceProtocol` già esistente.

---

> **Documenti correlati:**
> - `IMPLEMENTATION_PLAN_PHASE_5.md` — Piano implementazione (riferimenti a Punti 6, 17)
> - `TODO_TESTING.md` — Roadmap testing completa
> - `PROJECT_STATUS_SUMMARY.md` — Stato complessivo del progetto
