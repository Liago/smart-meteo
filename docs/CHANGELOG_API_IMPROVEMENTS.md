# Changelog Implementazione — Miglioramenti Fonti Dati API

> **Data implementazione:** 2026-03-07  
> **Basato su:** `docs/IMPLEMENTATION_API_IMPROVEMENTS.md`  
> **Audit originale:** `docs/AUDIT_API_DATA_SOURCES.md`

---

## Panoramica

Implementazione completa delle 4 fasi di miglioramento delle fonti dati API dello Smart Engine. Le modifiche risolvono bug critici di aggregazione, espandono le fonti forecast da 2 a 6, aggiungono nuovi campi dati (UV, visibilità, AQI dettagliato, cloud cover) e aggiornano frontend e cache.

---

## FASE 1 — Bug Fix Critici

### 1.1 Tomorrow.io: mappatura `weatherCode` → `condition_code`

**File:** `backend/connectors/tomorrow.ts`

- Aggiunta mappa `TOMORROW_CODE_TO_CONDITION` con 30 codici ufficiali Tomorrow.io
- Funzione helper `tomorrowCodeToText()` per conversione
- **Prima:** `condition_text: 'Code: 1001'` → `normalizeCondition()` non riconosceva → sempre `unknown`
- **Dopo:** `condition_text: 'cloudy'`, `condition_code: 'cloudy'` → aggregazione corretta

### 1.2 Weatherstack: conversione `wind_speed` km/h → m/s

**File:** `backend/connectors/weatherstack.ts`

- **Prima:** `wind_speed: current.wind_speed` (km/h non convertito, errore ~3.6x)
- **Dopo:** `wind_speed: current.wind_speed / 3.6` con `toFixed(2)`
- Allineato al comportamento di AccuWeather e WWO che già convertivano

### 1.3 Meteostat: estrazione campo `pressure`

**File:** `backend/connectors/meteostat.ts`

- **Prima:** campo `pres` disponibile nell'API ma non estratto (documentato nel commento ma mai mappato)
- **Dopo:** `pressure: latest.pres ?? null`

### 1.4 `condition_code` override nel costruttore `UnifiedForecast`

**File:** `backend/utils/formatter.ts`

- **Prima:** `this.condition_code = normalizeCondition(data.condition_text)` — ignorava qualsiasi `condition_code` esplicito
- **Dopo:** usa `data.condition_code` se fornito, altrimenti `normalizeCondition(data.condition_text)`
- Necessario per tutti i connettori che passano codici già normalizzati (Tomorrow.io, Weatherstack, Meteostat)

---

## FASE 2 — Espansione Daily/Hourly Forecast

### 2.1 Tomorrow.io: endpoint `/forecast`

**File:** `backend/connectors/tomorrow.ts`

- Fetch parallelo: `realtime` + `forecast` con `Promise.allSettled()`
- Daily (5 giorni): `temperatureMax`, `temperatureMin`, `precipitationProbabilityMax`, `weatherCodeMax`
- Hourly (24 ore): `temperature`, `precipitationProbability`, `weatherCode`
- Degradazione graziosa: se il forecast fallisce, ritorna solo realtime

### 2.2 OpenWeatherMap: endpoint `/forecast`

**File:** `backend/connectors/openweathermap.ts`

- Fetch parallelo: `current` + `forecast` (40 slot da 3h = 5 giorni)
- Aggregazione slot 3h in daily: max/min temp, media probabilità precipitazione
- Hourly dai primi 24 slot
- Estrazione `sunrise`/`sunset` dalla risposta current
- Estrazione `visibility` (convertita da metri a km)

### 2.3 AccuWeather: endpoint `/forecasts/v1/daily/5day`

**File:** `backend/connectors/accuweather.ts`

- Fetch parallelo: `current` + `5day` con `Promise.allSettled()`
- Cache `locationKey` con **TTL 1 ora** (prima era permanente senza scadenza) → riduce chiamate API
- Daily con `PrecipitationProbability`, `IconPhrase` → `normalizeCondition()`
- Astronomy: `sunrise`, `sunset`, `moon_phase` dal primo giorno
- Estrazione `visibility` e `uv_index` dalla risposta current

### 2.4 WeatherAPI: migrazione a `forecast.json`

**File:** `backend/connectors/weatherapi.ts`

- **Prima:** `current.json` (solo current)
- **Dopo:** `forecast.json` con `days=7, aqi=yes` (current + 7 giorni daily + hourly + astronomy)
- Nessun costo aggiuntivo di rate (stessa chiamata include tutto)
- Helper `convertTo24h()` per formato sunrise/sunset (`"06:30 AM"` → `"06:30"`)
- Estrazione completa: daily, hourly, astronomy (con `moon_phase` reale), AQI dettagliato, UV index, visibilità, cloud cover

---

## FASE 3 — Nuovi Campi Dati

### Tipi aggiornati

**File:** `backend/types.ts`

```typescript
// Nuova interfaccia
interface AirQualityDetail {
  aqi_us_epa: number | null;
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  co: number | null;
  so2: number | null;
}

// Nuovi campi in UnifiedForecastData
uv_index?: number | null;
visibility?: number | null;        // km
cloud_cover?: number | null;       // %
air_quality?: AirQualityDetail;

// Nuovo campo in DailyForecast
uv_index_max?: number | null;
```

### 3.1 UV Index

**Fonti:** Open-Meteo (current + daily), WeatherAPI (current), AccuWeather (current)

- `backend/connectors/openmeteo.ts`: aggiunto `uv_index` ai current params e `uv_index_max` ai daily params
- Aggregazione pesata in `smartEngine.ts`

### 3.2 Visibilità

**Fonti:** OpenWeatherMap (current, convertita m→km), AccuWeather (current, già in km), WeatherAPI (current)

- Aggregazione pesata in `smartEngine.ts`

### 3.3 AQI Dettagliato

**Fonte:** WeatherAPI (unica fonte con breakdown inquinanti)

- Estratto oggetto `air_quality` con PM2.5, PM10, NO₂, O₃, CO, SO₂
- Passato direttamente al risultato (non aggregato, singola fonte)

### 3.4 Cloud Cover

**Fonti:** Open-Meteo (current), WeatherAPI (current)

- `backend/connectors/openmeteo.ts`: aggiunto `cloud_cover` ai current params
- Aggregazione pesata in `smartEngine.ts`

### 3.5 Fase Lunare da API

**Fonti reali:** WeatherAPI (`astro.moon_phase`), WWO (`astronomy[0].moon_phase`)

- `smartEngine.ts`: ora preferisce fonti con `moon_phase` reale (≠ `'unknown'` e ≠ `''`)
- Fallback al calcolo locale (`getMoonPhase()`) solo se nessuna fonte API fornisce il dato

### Smart Engine: aggregazione nuovi campi

**File:** `backend/engine/smartEngine.ts`

- `AggregationData` esteso con `uv_index`, `visibility`, `cloud_cover`
- Aggregazione pesata per tutti i nuovi campi numerici
- `air_quality` passato direttamente dalla prima fonte disponibile (WeatherAPI)
- Cache: salva `full_data: result` come JSONB, ritorna `cached.full_data` su cache HIT

---

## FASE 4 — Frontend e Cache

### 4.1 Migration 013 — Cache Schema Fix

**File:** `supabase/migrations/013_smart_forecast_full_data.sql`

```sql
ALTER TABLE smart_forecasts
  ADD COLUMN IF NOT EXISTS full_data JSONB;

CREATE INDEX IF NOT EXISTS idx_smart_forecasts_full_data
  ON smart_forecasts USING gin (full_data);

ALTER TABLE smart_forecasts
  ADD COLUMN IF NOT EXISTS uv_index REAL,
  ADD COLUMN IF NOT EXISTS visibility REAL,
  ADD COLUMN IF NOT EXISTS cloud_cover REAL;
```

> ⚠️ **Azione richiesta:** eseguire la migration su Supabase.

### 4.2 Frontend Types

**File:** `frontend-web/lib/types.ts`

- `ForecastCurrent`: aggiunti `uv_index`, `visibility`, `cloud_cover`, `air_quality`
- Nuova interfaccia `AirQualityDetail`
- `DailyForecast`: aggiunto `uv_index_max`

### 4.3 Frontend UI — Nuova riga stats

**File:** `frontend-web/components/CurrentWeather.tsx`

Aggiunta seconda riga di 3 card flippabili sotto la riga esistente:

| Card | Fronte | Retro |
|------|--------|-------|
| ☀️ UV Index | Indice UV (con label colorata: Basso/Moderato/Alto/Molto Alto/Estremo) | Label testuale UV |
| 📊 Pressione | Pressione in hPa | Visibilità in km |
| ☁️ Nuvole | Copertura nuvolosa % | PM2.5 (se disponibile da AQI detail) |

**File:** `frontend-web/lib/weather-utils.ts`

- Aggiunte funzioni `getUvLabel(uv)` e `getUvColor(uv)` con scala italiana

### 4.4 iOS

Le modifiche Swift (tipi + UI) sono documentate nel piano originale ma **non incluse** in questa implementazione — da gestire separatamente in Xcode.

---

## Riepilogo Commit

| Commit | Fase | Descrizione |
|--------|------|-------------|
| `d47e9c3` | FASE 1 | Bug fix critici (4 fix) |
| `a902222` | FASE 2 | Espansione forecast (4 connettori) |
| `d9261c9` | FASE 3 | Nuovi campi dati + aggregazione |
| `1dff3b1` | FASE 4 | Frontend + Cache |

---

## File Modificati

```
backend/connectors/tomorrow.ts        — weatherCode mapping + forecast endpoint
backend/connectors/weatherstack.ts    — wind_speed conversione
backend/connectors/meteostat.ts       — pressure estrazione
backend/connectors/openweathermap.ts  — forecast endpoint + visibility
backend/connectors/accuweather.ts     — 5day forecast + TTL cache
backend/connectors/weatherapi.ts      — forecast.json + AQI + astronomy
backend/connectors/openmeteo.ts       — uv_index + cloud_cover
backend/types.ts                      — nuovi tipi
backend/utils/formatter.ts            — condition_code override + nuovi campi
backend/engine/smartEngine.ts         — aggregazione nuovi campi + full_data cache
supabase/migrations/013_...sql        — full_data JSONB + nuove colonne
frontend-web/lib/types.ts             — nuovi tipi FE
frontend-web/lib/weather-utils.ts     — UV helpers
frontend-web/components/CurrentWeather.tsx — seconda riga stats
```
