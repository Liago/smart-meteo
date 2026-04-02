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
| `humidity` | ✅ | ✅ | Convertito da 0-1 a 0-100, aggregato hourly |
| `pressure` | ❌ | — | Disponibile ma non estratto |
| `visibility` | ❌ | — | Disponibile ma non estratto |
| `uvIndex` | ✅ | ✅ | Aggregato hourly |
| `windSpeed` | ✅ | ✅ | Convertito da km/h a m/s, aggregato hourly |
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

### 2.2 — `forecastNextHour` ✅ IMPLEMENTATO

**Cosa fornisce:** Previsione precipitazioni minuto-per-minuto per la prossima ora (disponibile solo in alcuni paesi, inclusa l'Italia).

**Caso d'uso:** Notifiche tipo "Pioggia prevista tra 15 minuti nella tua zona".

**Implementazione completata (2026-04-02):**

1. ✅ **Tipi** aggiunti in `backend/types.ts`: `MinutelyPrecipitation` e `ForecastNextHour`
2. ✅ **Dataset** `forecastNextHour` aggiunto alla richiesta WeatherKit (entrambe le funzioni: `fetchFromWeatherKit` e `fetchFromWeatherKitWithAlerts`)
3. ✅ **Parser** `parseForecastNextHour()` in `backend/connectors/weatherkit.ts` — estrae summary + minutes, normalizza precipitationChance da 0-1 a 0-100
4. ✅ **`UnifiedForecast`** esteso con campo `forecastNextHour` in `backend/utils/formatter.ts`
5. ✅ **Smart Engine** propaga `forecastNextHour` dalla fonte WeatherKit al risultato finale (non aggregabile, singola fonte)

---

## 3. Gap nell'Aggregazione Smart Engine

### 3.1 — `uv_index_max` nel Daily ✅ COMPLETATO

**Stato:** ✅ Implementato nel commit `1e84908` — `uv_index_max` aggiunto all'aggregazione daily nello Smart Engine.

### 3.2 — Hourly Data Arricchiti ✅ COMPLETATO

**Stato:** ✅ Implementato — `humidity`, `wind_speed`, `uv_index` aggiunti a `HourlyForecast` in `types.ts`, estratti da tutti e 7 i connettori attivi (Open-Meteo, Tomorrow.io, OWM, AccuWeather, WeatherAPI, WeatherKit, WWO) e aggregati con media semplice nello Smart Engine.

**Connettori aggiornati:**
- Open-Meteo: `relative_humidity_2m`, `wind_speed_10m`, `uv_index` aggiunti ai params hourly
- Tomorrow.io: `humidity`, `windSpeed`, `uvIndex` estratti dal forecast hourly
- OpenWeatherMap: `humidity`, `wind.speed` estratti dai slot 3h
- AccuWeather: `RelativeHumidity`, `Wind.Speed.Value` (km/h→m/s), `UVIndex` dal 12h hourly
- WeatherAPI: `humidity`, `wind_kph` (km/h→m/s), `uv` dall'hourly
- WeatherKit: `humidity` (0-1→%), `windSpeed` (km/h→m/s), `uvIndex` dall'hourly
- WWO: `humidity`, `windspeedKmph` (km/h→m/s), `uvIndex` dall'hourly

---

## 4. Riepilogo Priorità

| # | Miglioramento | Impatto | Effort | Stato |
|---|---------------|---------|--------|-------|
| 1 | **`weatherAlerts`** → Push notifications automatiche | Alto | Medio | ✅ Completato |
| 2 | **`uv_index_max`** nell'aggregazione daily | Basso | Basso | ✅ Completato (commit `1e84908`) |
| 3 | **`forecastNextHour`** → Previsione precipitazione minuto-per-minuto | Medio | Medio | ✅ Completato |
| 4 | **Hourly arricchiti** (humidity, wind, UV per ora) | Medio | Medio | ✅ Completato |
| 5 | **Daily arricchiti** (precipitationAmount, snowfall, windMax) | Basso | Basso | Da fare |

---

> **Prossimo passo:** Punto 5 (daily arricchiti) rimane l'unico gap aperto — bassa priorità.
