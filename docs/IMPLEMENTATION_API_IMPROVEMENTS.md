# Piano di Implementazione — Miglioramenti Fonti Dati API

> Basato su: `docs/AUDIT_API_DATA_SOURCES.md`
> Data: 2026-03-07
> Stato: Bozza

---

## Indice

1. [Panoramica e Priorità](#panoramica-e-priorità)
2. [FASE 1 — Bug Fix Critici](#fase-1--bug-fix-critici)
3. [FASE 2 — Espansione Daily/Hourly Forecast](#fase-2--espansione-dailyhourly-forecast)
4. [FASE 3 — Nuovi Campi Dati](#fase-3--nuovi-campi-dati)
5. [FASE 4 — Frontend e Cache](#fase-4--frontend-e-cache)
6. [Schema TypeScript Aggiornato](#schema-typescript-aggiornato)
7. [Impatto sul Database](#impatto-sul-database)
8. [Testing](#testing)

---

## Panoramica e Priorità

```
FASE 1 (Bug Fix)         → Impatto immediato sulla qualità dei dati aggregati
FASE 2 (Forecast)        → Da 2 a 6 fonti per daily/hourly → qualità forecast molto migliorata
FASE 3 (Nuovi Campi)     → UV Index, visibilità, AQI dettagliato, cloud cover
FASE 4 (Frontend/Cache)  → Visualizzazione nuovi dati + caching schema fix
```

**Stima impatto aggregazione attuale:**
- Tomorrow.io (peso 1.2): condition sempre `unknown` → **0% utilità condizione**
- Weatherstack (peso 0.9): wind_speed errato di ~3.6x → **inquina l'aggregazione**
- Meteostat (peso 0.8): pressione persa → **dato non contributivo**
- Daily forecast: solo 2/8 fonti → **aggregazione poco robusta**

---

## FASE 1 — Bug Fix Critici

### 1.1 — Tomorrow.io: mappatura `weatherCode` → `condition_code`

**File:** `backend/connectors/tomorrow.ts`

**Problema:** `condition_text: 'Code: ' + values.weatherCode` produce una stringa come `"Code: 1001"`. Il `normalizeCondition()` in `formatter.ts` non riconosce questo pattern → `condition_code` sempre `unknown`.

**Soluzione:** Aggiungere una funzione di mapping dei codici Tomorrow.io (documentazione ufficiale) verso le condizioni normalizzate.

**Codici Tomorrow.io rilevanti:**
```
1000 → clear
1001 → cloudy
1002 → mostly_clear → clear
1003 → partly_cloudy → cloudy
1004 → mostly_cloudy → cloudy
1100–1103 → clear/cloudy variants
2000–2100 → fog
4000–4201 → rain/drizzle
5000–5101 → snow
6000–6201 → freezing rain → snow
7000–7102 → ice pellets → snow
8000 → thunderstorm → storm
```

**Implementazione:**

```typescript
// backend/connectors/tomorrow.ts

// Aggiungere mappa codici PRIMA della funzione fetchFromTomorrow
const TOMORROW_CODE_TO_CONDITION: Record<number, string> = {
  1000: 'clear',
  1001: 'cloudy',
  1002: 'clear',
  1003: 'cloudy',
  1004: 'cloudy',
  1100: 'clear',
  1101: 'clear',
  1102: 'cloudy',
  1103: 'cloudy',
  2000: 'fog',
  2100: 'fog',
  4000: 'rain',
  4001: 'rain',
  4200: 'rain',
  4201: 'rain',
  5000: 'snow',
  5001: 'snow',
  5100: 'snow',
  5101: 'snow',
  6000: 'snow',
  6001: 'snow',
  6200: 'snow',
  6201: 'snow',
  7000: 'snow',
  7101: 'snow',
  7102: 'snow',
  8000: 'storm',
};

function tomorrowCodeToText(code: number): string {
  return TOMORROW_CODE_TO_CONDITION[code] ?? 'unknown';
}
```

**Modifica nel costruttore `UnifiedForecast`:**
```typescript
// PRIMA (errato):
condition_text: 'Code: ' + values.weatherCode,

// DOPO (corretto):
condition_text: tomorrowCodeToText(values.weatherCode),
condition_code: tomorrowCodeToText(values.weatherCode),  // bypass normalizeCondition
```

**Nota:** Passare direttamente `condition_code` sovrascrive il risultato di `normalizeCondition()` nel costruttore `UnifiedForecast` — verificare che il costruttore accetti `condition_code` esplicito. Attualmente il costruttore calcola `condition_code = normalizeCondition(condition_text)` — se passiamo un condition_text già normalizzato funziona ugualmente.

**Alternativa più sicura:** Aggiungere campo `precipitationIntensity` già disponibile nell'endpoint realtime:
```typescript
// Aggiungere all'interfaccia TomorrowValues:
precipitationIntensity: number;

// E al costruttore:
precipitation_intensity: values.precipitationIntensity ?? null,
```

---

### 1.2 — Weatherstack: conversione `wind_speed` da km/h a m/s

**File:** `backend/connectors/weatherstack.ts`

**Problema:** Il campo `current.wind_speed` in Weatherstack è in **km/h** (come da documentazione), ma viene passato direttamente senza conversione. Tutte le altre fonti usano m/s nell'aggregazione. Errore ≈ 3.6x.

**Soluzione:**
```typescript
// PRIMA (errato):
wind_speed: current.wind_speed,

// DOPO (corretto):
wind_speed: current.wind_speed != null ? Number((current.wind_speed / 3.6).toFixed(2)) : null,
```

**Verifica:** Confrontare con connettori AccuWeather e WWO che fanno già `/ 3.6` correttamente.

---

### 1.3 — Meteostat: estrazione campo `pressure`

**File:** `backend/connectors/meteostat.ts`

**Problema:** Il commento nel codice elenca `pres` tra i campi disponibili (`// temp, dwpt, rhum, prcp, snow, wdir, wspd, wpgt, pres, tsun, coco`) ma non viene estratto nel costruttore `UnifiedForecast`.

**Soluzione:**
```typescript
// PRIMA (mancante):
// pressure non presente

// DOPO (corretto):
pressure: latest.pres ?? null,
```

**Bonus — Aggiungere anche `dew_point` già disponibile:**
```typescript
// Meteostat fornisce dwpt (dew point) direttamente
// Da aggiungere all'interfaccia UnifiedForecastData se si vuole propagarlo
// Per ora annotare come raw_data
```

---

### 1.4 — `condition_code` nel costruttore `UnifiedForecast`

**File:** `backend/utils/formatter.ts`

**Problema attuale:** Il costruttore ignora un eventuale `condition_code` passato esplicitamente — calcola sempre `normalizeCondition(condition_text)`:
```typescript
this.condition_code = normalizeCondition(data.condition_text);
```

**Problema:** Weatherstack passa `condition_code: String(current.weather_code)` (es. `"353"`) ma viene sovrascritto dalla normalizzazione del testo. Meteostat passa `condition_code: String(latest.coco)` (es. `"4"`) — stesso problema.

**Soluzione:** Usare `condition_code` esplicito se fornito, altrimenti derivarlo dal testo:
```typescript
// DOPO:
this.condition_code = data.condition_code
  ? data.condition_code  // usa il codice esplicito se fornito
  : normalizeCondition(data.condition_text);  // altrimenti normalizza dal testo
```

**Attenzione:** Assicurarsi che i connettori che passano `condition_code` lo facciano con valori del dominio normalizzato (`'clear'|'cloudy'|'rain'|'snow'|'storm'|'fog'|'unknown'`), non codici proprietari numerici. Per Tomorrow.io usare il mapping della sezione 1.1.

---

## FASE 2 — Espansione Daily/Hourly Forecast

**Obiettivo:** Portare da 2 a 6 fonti che contribuiscono al daily/hourly forecast.

### 2.1 — Tomorrow.io: aggiungere endpoint `/forecast`

**File:** `backend/connectors/tomorrow.ts`

**Endpoint da aggiungere:**
```
GET https://api.tomorrow.io/v4/weather/forecast
Params: location={lat},{lon}&apikey=KEY&units=metric&timesteps=1d,1h
```

**Dati disponibili:**
- Daily (fino a 5 giorni): `temperatureMax`, `temperatureMin`, `precipitationProbabilityMax`, `weatherCodeMax`
- Hourly (fino a 120 ore): `temperature`, `precipitationProbability`, `weatherCode`

**Implementazione:**

```typescript
// Aggiungere dopo il fetch realtime (o come chiamata parallela):
const TOMORROW_FORECAST_URL = 'https://api.tomorrow.io/v4/weather/forecast';

// Fetch forecast (daily + hourly) in parallelo con realtime:
const [realtimeRes, forecastRes] = await Promise.allSettled([
  axios.get<TomorrowResponse>(TOMORROW_API_URL, { params: realtimeParams }),
  axios.get(TOMORROW_FORECAST_URL, { params: { ...realtimeParams, timesteps: '1d,1h' } })
]);
```

**Mapping Daily:**
```typescript
const dailyForecasts: DailyForecast[] = forecastData.timelines.daily.map(day => ({
  date: day.time.slice(0, 10),
  temp_max: day.values.temperatureMax,
  temp_min: day.values.temperatureMin,
  precipitation_prob: day.values.precipitationProbabilityMax,
  condition_code: tomorrowCodeToText(day.values.weatherCodeMax),
  condition_text: tomorrowCodeToText(day.values.weatherCodeMax),
}));
```

**Nota API:** Con piano free, la forecast API potrebbe avere limitazioni di rate (25 req/giorno). Valutare se usarla solo per daily (1 chiamata) e non per hourly per risparmiare quota.

---

### 2.2 — OpenWeatherMap: aggiungere endpoint `/forecast` (5 giorni / 3 ore)

**File:** `backend/connectors/openweathermap.ts`

**Endpoint da aggiungere:**
```
GET https://api.openweathermap.org/data/2.5/forecast
Params: lat, lon, appid=KEY, units=metric, cnt=40  (40 slot da 3h = 5 giorni)
```

**Dati disponibili:** Lista di oggetti ogni 3 ore con `main.temp`, `weather[0].main`, `pop` (probability of precipitation), `rain.3h`, ecc.

**Implementazione:**

```typescript
// Chiamata parallela con current:
const [currentRes, forecastRes] = await Promise.allSettled([
  axios.get(OWM_CURRENT_URL, { params }),
  axios.get('https://api.openweathermap.org/data/2.5/forecast', { params: { ...params, cnt: 40 } })
]);

// Aggregazione daily dai slot 3h:
const dailyMap = new Map<string, { temps: number[]; probs: number[]; codes: string[] }>();
forecastData.list.forEach(slot => {
  const date = slot.dt_txt.slice(0, 10);
  if (!dailyMap.has(date)) dailyMap.set(date, { temps: [], probs: [], codes: [] });
  const entry = dailyMap.get(date)!;
  entry.temps.push(slot.main.temp);
  entry.probs.push((slot.pop ?? 0) * 100);  // pop è 0-1
  entry.codes.push(slot.weather[0].main);
});

const daily: DailyForecast[] = Array.from(dailyMap.entries()).map(([date, data]) => ({
  date,
  temp_max: Math.max(...data.temps),
  temp_min: Math.min(...data.temps),
  precipitation_prob: data.probs.reduce((a, b) => a + b, 0) / data.probs.length,
  condition_code: normalizeCondition(data.codes[Math.floor(data.codes.length / 2)]),
  condition_text: data.codes[Math.floor(data.codes.length / 2)],
}));

// Hourly dai primi 24 slot (72 ore = primi 24 slot da 3h):
const hourly: HourlyForecast[] = forecastData.list.slice(0, 24).map(slot => ({
  time: new Date(slot.dt * 1000).toISOString(),
  temp: slot.main.temp,
  precipitation_prob: (slot.pop ?? 0) * 100,
  condition_code: normalizeCondition(slot.weather[0].main),
  condition_text: slot.weather[0].description,
}));
```

**Bonus:** Aggiungere anche i campi `sys.sunrise`/`sys.sunset` dall'endpoint current:
```typescript
// Già disponibili nella risposta current, aggiungere a astronomy:
astronomy: {
  sunrise: new Date(currentData.sys.sunrise * 1000).toISOString(),
  sunset: new Date(currentData.sys.sunset * 1000).toISOString(),
  moon_phase: 'unknown',  // OWM non fornisce fase lunare
}
```

---

### 2.3 — AccuWeather: aggiungere endpoint `/forecasts/v1/daily/5day`

**File:** `backend/connectors/accuweather.ts`

**Endpoint da aggiungere:**
```
GET http://dataservice.accuweather.com/forecasts/v1/daily/5day/{locationKey}
Params: apikey=KEY, metric=true, details=true
```

**Dati disponibili:**
- `DailyForecasts[i].Temperature.Maximum.Value` / `Minimum.Value`
- `DailyForecasts[i].Day.Icon` (numero icona AccuWeather)
- `DailyForecasts[i].Day.IconPhrase` (testo condizione)
- `DailyForecasts[i].Day.PrecipitationProbability`
- `DailyForecasts[i].Sun.Rise` / `Sun.Set` (ISO strings)
- `DailyForecasts[i].Moon.Phase` (stringa: "Full", "New", "Half", ecc.)

**Attenzione rate limit:** AccuWeather free = 50 chiamate/giorno totali. Ogni forecast richiede già 2 chiamate (geoposition + current). Aggiungere la 5-day porta a **3 chiamate per richiesta** → rischio di esaurire il limite con ~16 richieste/giorno.

**Soluzione:** Fare geoposition + current + 5day in parallelo (non sequenziale):
```typescript
// locationKey già cachato in memoria → solo 2 chiamate invece di 3
// Aggiungere cache in-memory per locationKey con TTL 1 ora
const locationKeyCache = new Map<string, { key: string; expiresAt: number }>();
```

**Mapping Daily:**
```typescript
const daily: DailyForecast[] = forecastData.DailyForecasts.map(day => ({
  date: day.Date.slice(0, 10),
  temp_max: day.Temperature.Maximum.Value,
  temp_min: day.Temperature.Minimum.Value,
  precipitation_prob: day.Day.PrecipitationProbability ?? null,
  condition_code: normalizeCondition(day.Day.IconPhrase),
  condition_text: day.Day.IconPhrase,
}));

// Aggiungere astronomy dal primo giorno:
astronomy: {
  sunrise: forecastData.DailyForecasts[0].Sun.Rise,
  sunset: forecastData.DailyForecasts[0].Sun.Set,
  moon_phase: forecastData.DailyForecasts[0].Moon.Phase ?? 'unknown',
}
```

---

### 2.4 — WeatherAPI: aggiungere endpoint `/forecast.json`

**File:** `backend/connectors/weatherapi.ts`

**Cambiamento:** Sostituire `current.json` con `forecast.json` (include tutto: current + forecast + astronomy).

```
GET http://api.weatherapi.com/v1/forecast.json
Params: key=KEY, q={lat},{lon}, days=7, aqi=yes, alerts=no
```

**Vantaggio:** Una sola chiamata invece di current + forecast separati. Nessun costo aggiuntivo di rate.

**Dati aggiuntivi disponibili:**
- `forecast.forecastday[i].day.maxtemp_c` / `mintemp_c`
- `forecast.forecastday[i].day.daily_chance_of_rain`
- `forecast.forecastday[i].day.condition`
- `forecast.forecastday[i].hour[]` → hourly completo per 7 giorni
- `forecast.forecastday[i].astro.sunrise/sunset/moonrise/moonset/moon_phase/moon_illumination`

**Mapping:**
```typescript
const daily: DailyForecast[] = forecastData.forecast.forecastday.map(day => ({
  date: day.date,
  temp_max: day.day.maxtemp_c,
  temp_min: day.day.mintemp_c,
  precipitation_prob: day.day.daily_chance_of_rain,
  condition_code: normalizeCondition(day.day.condition.text),
  condition_text: day.day.condition.text,
}));

// Hourly del giorno corrente:
const hourly: HourlyForecast[] = forecastData.forecast.forecastday[0].hour.map(h => ({
  time: new Date(h.time_epoch * 1000).toISOString(),
  temp: h.temp_c,
  precipitation_prob: h.chance_of_rain,
  condition_code: normalizeCondition(h.condition.text),
  condition_text: h.condition.text,
}));

// Astronomy con fase lunare vera:
astronomy: {
  sunrise: convertTo24h(forecastData.forecast.forecastday[0].astro.sunrise),
  sunset: convertTo24h(forecastData.forecast.forecastday[0].astro.sunset),
  moon_phase: forecastData.forecast.forecastday[0].astro.moon_phase,
}
```

**Nota:** Le ore `sunrise`/`sunset` da WeatherAPI sono in formato `"06:30 AM"` — serve una funzione di conversione a ISO o HH:MM.

---

## FASE 3 — Nuovi Campi Dati

### 3.1 — UV Index

**Disponibile in:** Open-Meteo (daily + hourly), WeatherAPI (current + daily), AccuWeather, Tomorrow.io

**Modifica `types.ts` (backend):**
```typescript
export interface UnifiedForecastData {
  // ... campi esistenti ...
  uv_index?: number | null;          // NUOVO
}

export interface DailyForecast {
  // ... campi esistenti ...
  uv_index_max?: number | null;      // NUOVO
}
```

**Modifica `types.ts` (frontend-web):**
```typescript
export interface ForecastCurrent {
  // ... campi esistenti ...
  uv_index: number | null;           // NUOVO
}

export interface DailyForecast {
  // ... campi esistenti ...
  uv_index_max?: number | null;      // NUOVO
}
```

**Estrazione Open-Meteo** (già richiesto nell'endpoint, basta estrarlo):
```typescript
// In openmeteo.ts, aggiungere ai params hourly:
hourly: '....,uv_index'

// E aggiungere a daily params:
daily: '...,uv_index_max'

// Nel mapping:
uv_index: current.uv_index ?? null,
```

**Aggregazione in `smartEngine.ts`:**
```typescript
// Aggiungere a AggregationData:
uv_index: { val: number; weight: number }[];

// Aggiungere al risultato current:
uv_index: avg(aggregation.uv_index),
```

---

### 3.2 — Visibilità

**Disponibile in:** Open-Meteo, OWM, AccuWeather, WeatherAPI, Weatherstack, Tomorrow.io, WWO

**Modifica `types.ts`:**
```typescript
export interface UnifiedForecastData {
  visibility?: number | null;  // km — NUOVO
}
```

**Estrazione Open-Meteo:**
```typescript
// Aggiungere a current params: 'visibility'
// Nota: in Open-Meteo visibility è in metri → dividere per 1000 per km
visibility: current.visibility != null ? current.visibility / 1000 : null,
```

**Estrazione OWM:**
```typescript
// già nella risposta current come `visibility` (in metri)
visibility: data.visibility != null ? data.visibility / 1000 : null,
```

---

### 3.3 — AQI Dettagliato (inquinanti)

**Disponibile in:** WeatherAPI (con `aqi=yes`)

**Modifica `types.ts`:**
```typescript
export interface AirQualityData {
  aqi_us_epa: number | null;       // indice aggregato (già presente come `aqi`)
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  co: number | null;
  so2: number | null;
}

export interface UnifiedForecastData {
  // aqi rimane per compatibilità (US EPA index)
  aqi: number | null;
  air_quality?: AirQualityData;    // NUOVO — dettaglio inquinanti
}
```

**Estrazione WeatherAPI:**
```typescript
const aq = current.air_quality;
air_quality: aq ? {
  aqi_us_epa: aq['us-epa-index'] ?? null,
  pm2_5: aq.pm2_5 ?? null,
  pm10: aq.pm10 ?? null,
  no2: aq.no2 ?? null,
  o3: aq.o3 ?? null,
  co: aq.co ?? null,
  so2: aq.so2 ?? null,
} : undefined,
```

**Aggregazione:** Solo WeatherAPI fornisce questo dato → non serve aggregazione ponderata, si passa direttamente al risultato finale se la fonte è attiva.

---

### 3.4 — Cloud Cover (Copertura Nuvolosa %)

**Disponibile in:** Open-Meteo, OWM, AccuWeather, WeatherAPI, Weatherstack, Tomorrow.io, WWO

**Motivazione:** Migliora la qualità del `condition_code` — es. cloudcover 80% + nessuna pioggia = "cloudy", non "unknown".

**Modifica `types.ts`:**
```typescript
export interface UnifiedForecastData {
  cloud_cover?: number | null;   // % — NUOVO
}
```

**Estrazione Open-Meteo:**
```typescript
// Aggiungere ai current params: 'cloud_cover'
cloud_cover: current.cloud_cover ?? null,
```

**Uso in `normalizeCondition`** (`formatter.ts`):
```typescript
// Opzionalmente migliorare normalizeCondition per usare cloud_cover
// quando condition_text è ambiguo
export function normalizeConditionWithCloudCover(
  text: string | null | undefined,
  cloudCover?: number | null
): string {
  const base = normalizeCondition(text);
  if (base !== 'unknown') return base;
  if (cloudCover != null) {
    if (cloudCover >= 80) return 'cloudy';
    if (cloudCover <= 20) return 'clear';
    return 'cloudy';
  }
  return 'unknown';
}
```

---

### 3.5 — Fase Lunare da API

**Disponibile in:** WWO (`astronomy[0].moon_phase`), WeatherAPI (`astro.moon_phase`)

**Problema attuale:** La fase lunare viene calcolata con `getMoonPhase()` in `openmeteo.ts` — l'algoritmo è approssimato.

**Soluzione:** Usare il valore da WWO o WeatherAPI se disponibile, con fallback al calcolo locale.

**In `smartEngine.ts`:**
```typescript
// Sostituire la logica:
// PRIMA:
const sourceWithAstronomy = validForecasts.find(f => f.astronomy);

// DOPO (preferire fonti con moon_phase vera):
const sourceWithAstronomy =
  validForecasts.find(f => f.astronomy && f.astronomy.moon_phase !== 'unknown' && f.astronomy.moon_phase !== '') ??
  validForecasts.find(f => f.astronomy);
```

---

## FASE 4 — Frontend e Cache

### 4.1 — Cache Schema Fix

**File:** `backend/engine/smartEngine.ts`

**Problema:** Il codice contiene un lungo commento (righe 105-152) che documenta l'impossibilità di cachare daily/hourly nella tabella `smart_forecasts` — e poi non usa la cache. La cache è inutile allo stato attuale.

**Soluzione — Aggiungere colonna `full_data JSONB` alla tabella:**

```sql
-- Nuova migration: supabase/migrations/013_smart_forecast_full_data.sql
ALTER TABLE smart_forecasts
  ADD COLUMN IF NOT EXISTS full_data JSONB;
```

**In `smartEngine.ts`:**
```typescript
// Nel WRITE:
await supabase.from('smart_forecasts').insert({
  // ... campi esistenti ...
  full_data: result,  // NUOVO: serializza tutto il risultato
});

// Nel READ (cache HIT):
if (cached && cached.full_data) {
  console.log('Cache HIT: returning full smart forecast from DB');
  return cached.full_data;  // NUOVO: ritorna il JSON completo
}
```

---

### 4.2 — Aggiornamento Frontend: UV Index

**File:** `frontend-web/components/CurrentWeather.tsx`

**Aggiunta sezione UV Index** con scala visuale:
```typescript
// Scale UV: 0-2 Basso, 3-5 Moderato, 6-7 Alto, 8-10 Molto Alto, 11+ Estremo
function uvLabel(uv: number): string {
  if (uv <= 2) return 'Basso';
  if (uv <= 5) return 'Moderato';
  if (uv <= 7) return 'Alto';
  if (uv <= 10) return 'Molto Alto';
  return 'Estremo';
}
```

---

### 4.3 — Aggiornamento Frontend: AQI Dettagliato

**File:** `frontend-web/components/CurrentWeather.tsx`

**Espansione del pannello AQI** per mostrare PM2.5, PM10, NO2 in tooltip/modal.

---

### 4.4 — Aggiornamento iOS: UV Index e Visibilità

**File:** `frontend-ios/smart-meteo/smart-meteo/UI/Features/Dashboard/CurrentWeatherView.swift`

**Aggiungere** alle detail card esistenti (temperatura percepita, umidità, ecc.):
```swift
// UV Index card
WeatherDetailCard(
    icon: "sun.max.fill",
    label: "UV Index",
    value: uvLabel(forecast.current.uv_index)
)

// Visibilità card
WeatherDetailCard(
    icon: "eye.fill",
    label: "Visibilità",
    value: "\(forecast.current.visibility ?? 0) km"
)
```

**Aggiornare `Forecast.swift`** per decodificare i nuovi campi:
```swift
struct ForecastCurrent: Decodable {
    // ... campi esistenti ...
    let uv_index: Double?        // NUOVO
    let visibility: Double?      // NUOVO
    let air_quality: AirQuality? // NUOVO
}

struct AirQuality: Decodable {
    let aqi_us_epa: Int?
    let pm2_5: Double?
    let pm10: Double?
    let no2: Double?
    let o3: Double?
}
```

---

## Schema TypeScript Aggiornato

### `backend/types.ts` — Diff

```typescript
export interface UnifiedForecastData {
  source: string;
  lat: number;
  lon: number;
  time: string;
  temp: number | null;
  feels_like: number | null;
  humidity: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  wind_gust: number | null;
  condition_text: string | null;
  condition_code: string;
  precipitation_prob: number | null;
  precipitation_intensity?: number | null;
  aqi: number | null;
  pressure: number | null;
  // NUOVI:
  uv_index?: number | null;
  visibility?: number | null;        // km
  cloud_cover?: number | null;       // %
  air_quality?: AirQualityDetail;
  raw_data?: any;
  daily?: DailyForecast[];
  hourly?: HourlyForecast[];
  astronomy?: AstronomyData;
}

// NUOVO:
export interface AirQualityDetail {
  aqi_us_epa: number | null;
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  co: number | null;
  so2: number | null;
}
```

### `frontend-web/lib/types.ts` — Diff

```typescript
export interface ForecastCurrent {
  temperature: number | null;
  feels_like: number | null;
  humidity: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  wind_direction_label: string | null;
  wind_gust: number | null;
  precipitation_prob: number;
  dew_point: number | null;
  aqi: number | null;
  pressure: number | null;
  condition: string;
  condition_text: string;
  // NUOVI:
  uv_index: number | null;
  visibility: number | null;
  cloud_cover: number | null;
  air_quality: AirQualityDetail | null;
}

// NUOVO:
export interface AirQualityDetail {
  aqi_us_epa: number | null;
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  co: number | null;
  so2: number | null;
}
```

---

## Impatto sul Database

### Migration 013 — `full_data` su `smart_forecasts`

```sql
-- supabase/migrations/013_smart_forecast_full_data.sql
ALTER TABLE smart_forecasts
  ADD COLUMN IF NOT EXISTS full_data JSONB;

-- Indice per eventuali query JSON future
CREATE INDEX IF NOT EXISTS idx_smart_forecasts_full_data
  ON smart_forecasts USING gin (full_data);
```

### Migration 014 — nuovi campi su `smart_forecasts` (opzionale per analytics)

```sql
-- supabase/migrations/014_smart_forecast_new_fields.sql
ALTER TABLE smart_forecasts
  ADD COLUMN IF NOT EXISTS uv_index REAL,
  ADD COLUMN IF NOT EXISTS visibility REAL,
  ADD COLUMN IF NOT EXISTS cloud_cover REAL;
```

### Impatto su `raw_forecasts`

Nessuna modifica necessaria — il campo `raw_data JSONB` esistente può contenere i nuovi campi senza schema changes.

---

## Testing

### Unit Test da aggiungere (`frontend-web/__tests__/`)

```typescript
// weather-utils.test.ts — aggiungere:
describe('uvLabel', () => {
  it('returns Basso for UV 0-2', () => expect(uvLabel(1)).toBe('Basso'));
  it('returns Estremo for UV 11+', () => expect(uvLabel(12)).toBe('Estremo'));
});
```

### Test di integrazione manuali

Per ogni fase, verificare:

| Test | Atteso |
|------|--------|
| Tomorrow.io weatherCode=1000 | `condition_code = 'clear'` |
| Tomorrow.io weatherCode=8000 | `condition_code = 'storm'` |
| Weatherstack wind_speed=36 km/h | Aggregato con ~10 m/s |
| Meteostat risposta con `pres=1013` | `pressure = 1013` nel risultato |
| WeatherAPI `/forecast.json` | `daily` con 7 giorni, `hourly` con 24h |
| Smart Engine daily | Almeno 4 fonti contribuiscono ai daily |
| Cache HIT | Ritorna `full_data` inclusi daily/hourly |

---

## Riepilogo Fasi e Dipendenze

```
FASE 1 (prerequisito per tutto)
├── 1.1 Tomorrow.io weatherCode mapping
├── 1.2 Weatherstack wind_speed conversione
├── 1.3 Meteostat pressure fix
└── 1.4 UnifiedForecast condition_code override

FASE 2 (richiede FASE 1)
├── 2.1 Tomorrow.io forecast endpoint
├── 2.2 OpenWeatherMap forecast endpoint
├── 2.3 AccuWeather 5-day forecast
└── 2.4 WeatherAPI → forecast.json

FASE 3 (indipendente, può procedere in parallelo con FASE 2)
├── 3.1 UV Index (Open-Meteo + WeatherAPI)
├── 3.2 Visibilità (Open-Meteo + OWM)
├── 3.3 AQI dettagliato (WeatherAPI)
├── 3.4 Cloud Cover (Open-Meteo)
└── 3.5 Moon Phase da API (WWO + WeatherAPI)

FASE 4 (richiede FASE 2 + FASE 3)
├── 4.1 Cache fix (migration 013)
├── 4.2 Frontend UV Index
├── 4.3 Frontend AQI dettagliato
└── 4.4 iOS nuovi campi
```
