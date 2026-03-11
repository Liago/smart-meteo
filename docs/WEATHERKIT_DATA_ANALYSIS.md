# Analisi Dati WeatherKit — Gap e Miglioramenti Possibili

> **Data:** 2026-03-11
> **Scopo:** Analisi dei dati WeatherKit attualmente estratti vs disponibili, e opportunità di integrazione con il sistema push notifications

---

## 1. Stato Attuale del Connettore

**File:** `backend/connectors/weatherkit.ts`
**Dataset richiesti:** `currentWeather,forecastDaily,forecastHourly`
**Peso:** 1.2 (massimo, condiviso con Tomorrow.io)

### Campi Current Estratti e Aggregati nello Smart Engine ✅

| Campo | Estratto | Aggregato | Note |
|-------|:--------:|:---------:|------|
| `temperature` | ✅ | ✅ | |
| `temperatureApparent` → `feels_like` | ✅ | ✅ | |
| `humidity` | ✅ | ✅ | Convertito da 0-1 a 0-100 |
| `windSpeed` → `wind_speed` | ✅ | ✅ | Convertito da km/h a m/s |
| `windDirection` | ✅ | ✅ | |
| `windGust` | ✅ | ✅ | Convertito da km/h a m/s |
| `precipitationChance` → `precipitation_prob` | ✅ | ✅ | Convertito da 0-1 a 0-100 |
| `precipitationIntensity` | ✅ | ❌ | Estratto ma non aggregato (non presente in AggregationData) |
| `pressure` | ✅ | ✅ | |
| `temperatureDewPoint` → `dew_point` | ✅ | ✅ | |
| `uvIndex` → `uv_index` | ✅ | ✅ | |
| `visibility` | ✅ | ✅ | Convertito da m a km |
| `cloudCover` → `cloud_cover` | ✅ | ✅ | Convertito da 0-1 a 0-100 |
| `conditionCode` | ✅ | ✅ | Mappato via `mapConditionCode()` |

### Daily Estratti

| Campo | Estratto | Aggregato | Note |
|-------|:--------:|:---------:|------|
| `temperatureMax/Min` | ✅ | ✅ | |
| `precipitationChance` | ✅ | ✅ | |
| `conditionCode` | ✅ | ✅ | |
| `maxUvIndex` → `uv_index_max` | ✅ | ❌ | **Estratto ma NON incluso nell'output daily aggregato** |
| `sunrise` / `sunset` | ✅ | ✅ | Via astronomy |
| `moonPhase` | ✅ | ✅ | Via astronomy |
| `precipitationAmount` | ❌ | — | Non estratto |
| `snowfallAmount` | ❌ | — | Non estratto |
| `windSpeedMax` | ❌ | — | Non estratto |
| `windGustSpeedMax` | ❌ | — | Non estratto |

### Hourly Estratti

| Campo | Estratto | Aggregato | Note |
|-------|:--------:|:---------:|------|
| `temperature` | ✅ | ✅ | |
| `precipitationChance` | ✅ | ✅ | |
| `conditionCode` | ✅ | ✅ | |
| `humidity` | ❌ | — | Disponibile ma non estratto |
| `pressure` | ❌ | — | Disponibile ma non estratto |
| `visibility` | ❌ | — | Disponibile ma non estratto |
| `uvIndex` | ❌ | — | Disponibile ma non estratto |
| `windSpeed` | ❌ | — | Disponibile ma non estratto |
| `windDirection` | ❌ | — | Disponibile ma non estratto |
| `cloudCover` | ❌ | — | Disponibile ma non estratto |
| `snowfallIntensity` | ❌ | — | Disponibile ma non estratto |

---

## 2. Dataset WeatherKit NON Richiesti

### 2.1 — `weatherAlerts` ✅ IMPLEMENTATO

**Cosa fornisce:** Allerte meteo governative ufficiali emesse da enti come Protezione Civile, NOAA, Met Office, ecc.

**Struttura risposta:**
```json
{
  "weatherAlerts": {
    "alerts": [
      {
        "id": "...",
        "areaId": "...",
        "areaName": "Lombardia",
        "certainty": "likely",
        "countryCode": "IT",
        "description": "Allerta arancione per temporali forti...",
        "effectiveTime": "2026-03-11T12:00:00Z",
        "expireTime": "2026-03-12T06:00:00Z",
        "issuedTime": "2026-03-11T08:00:00Z",
        "eventSource": "Protezione Civile",
        "severity": "severe",
        "source": "Protezione Civile Italiana",
        "urgency": "expected"
      }
    ]
  }
}
```

**Campi chiave:**
- `severity`: `minor` | `moderate` | `severe` | `extreme`
- `certainty`: `observed` | `likely` | `possible` | `unlikely`
- `urgency`: `immediate` | `expected` | `future`
- `description`: testo completo dell'allerta
- `effectiveTime` / `expireTime`: finestra temporale dell'allerta
- `eventSource`: ente emittente

**Implementazione completata (2026-03-11):**

1. ✅ **Tipo `WeatherAlert`** aggiunto in `backend/types.ts`
2. ✅ **Connettore WeatherKit** aggiornato — `weatherAlerts` aggiunto ai dataSets, nuova funzione `fetchFromWeatherKitWithAlerts()` in `backend/connectors/weatherkit.ts`
3. ✅ **Servizio `alertProcessor`** creato in `backend/services/alertProcessor.ts` — confronta allerte con sottoscrizioni per area geografica (~50km), invia push APNs, deduplicazione tramite `external_alert_id`
4. ✅ **Smart Engine** integrato — chiama `fetchFromWeatherKitWithAlerts()` per WeatherKit, processa allerte in modo asincrono (non blocca la risposta forecast), include allerte attive nella risposta API
5. ✅ **Migrazione DB** `018_weather_alerts_enhancement.sql` — aggiunge `external_alert_id`, `area_name`, `event_source`, `effective_time`, `expire_time` alla tabella `weather_alerts`, con indici per deduplicazione e query geografiche
6. ✅ **Endpoint `GET /api/alerts/active?lat=&lon=`** — restituisce allerte attive (non scadute) deduplicate per area
7. ✅ **CORS** aggiornato con metodo POST per gli endpoint alerts

**Flusso automatico:**
```
Forecast request → Smart Engine → WeatherKit API (con weatherAlerts)
                                      ↓
                              Allerte ricevute?
                                      ↓ sì
                          alertProcessor (async)
                              ↓              ↓
                    Trova sottoscrizioni   Deduplicazione
                    nella zona (~50km)    via external_alert_id
                              ↓
                    Invia push APNs
                              ↓
                    Salva in weather_alerts
```

---

### 2.2 — `forecastNextHour`

**Cosa fornisce:** Previsione precipitazioni minuto-per-minuto per la prossima ora (disponibile solo in alcuni paesi, inclusa l'Italia).

**Caso d'uso:** Notifiche tipo "Pioggia prevista tra 15 minuti nella tua zona".

**Struttura:**
```json
{
  "forecastNextHour": {
    "summary": [
      {
        "condition": "rain",
        "startTime": "2026-03-11T14:15:00Z",
        "endTime": "2026-03-11T14:45:00Z",
        "precipitationChance": 0.85,
        "precipitationIntensity": 2.3
      }
    ],
    "minutes": [
      { "startTime": "...", "precipitationChance": 0.0, "precipitationIntensity": 0.0 },
      ...
    ]
  }
}
```

**Priorità:** Media — utile per UX avanzata ma richiede un sistema di polling/cron per essere efficace nelle notifiche.

---

## 3. Gap nell'Aggregazione Smart Engine

### 3.1 — `uv_index_max` nel Daily

Il campo `uv_index_max` viene estratto dal connettore WeatherKit (e anche da Tomorrow.io) nel daily forecast, ma **l'aggregazione daily nello Smart Engine non lo include nell'output**.

**File:** `backend/engine/smartEngine.ts` righe 246-277
**Problema:** Il `dailyMap` aggrega solo `temp_max`, `temp_min`, `precip_prob` e `codes`. Non raccoglie `uv_index_max`.

**Fix suggerito:** Aggiungere `uv_index_max` alla daily aggregation:
```typescript
// Nel dailyMap
dailyMap.set(d.date, { temp_max: [], temp_min: [], precip_prob: [], codes: [], uv_index_max: [] });

// Nell'iterazione
if (d.uv_index_max != null) entry.uv_index_max.push(d.uv_index_max);

// Nell'output
uv_index_max: avgSimple(data.uv_index_max)
```

### 3.2 — Hourly Data Arricchiti

Attualmente l'aggregazione hourly usa solo `temp`, `precipitation_prob` e `condition_code`. Aggiungere `humidity`, `windSpeed`, `uvIndex` per ora renderebbe il drill-down orario più informativo nel frontend.

**Effort:** Medio — richiede estendere `HourlyForecast` in `types.ts`, aggiornare i connettori che forniscono dati hourly arricchiti (WeatherKit, Open-Meteo, WeatherAPI), e modificare l'aggregazione hourly nel Smart Engine.

---

## 4. Riepilogo Priorità

| # | Miglioramento | Impatto | Effort | Stato |
|---|---------------|---------|--------|-------|
| 1 | **`weatherAlerts`** → Push notifications automatiche | Alto | Medio | ✅ Completato |
| 2 | **`uv_index_max`** nell'aggregazione daily | Basso | Basso | Da fare |
| 3 | **`forecastNextHour`** → Notifiche precipitazioni imminenti | Medio | Medio | Da fare |
| 4 | **Hourly arricchiti** (humidity, wind, UV per ora) | Medio | Medio | Da fare |
| 5 | **Daily arricchiti** (precipitationAmount, snowfall, windMax) | Basso | Basso | Da fare |

---

> **Prossimo passo:** Implementare il punto 2 (`uv_index_max`) — effort basso, richiede solo modifiche all'aggregazione daily nello Smart Engine.
