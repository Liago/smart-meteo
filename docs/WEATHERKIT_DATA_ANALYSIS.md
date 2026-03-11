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

### 2.1 — `weatherAlerts` ⭐ ALTA PRIORITÀ

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

**Perché è importante:**
Il sistema push notifications (`backend/routes/alerts.ts` + `backend/services/apns.ts`) è già implementato con subscribe/unsubscribe e invio APNs, ma **manca la logica automatica di trigger**. Attualmente ha solo un endpoint di test manuale (`/alerts/test-push`). Le `weatherAlerts` di Apple fornirebbero allerte ufficiali già pronte, eliminando la necessità di creare una logica euristica personalizzata per decidere quando inviare notifiche.

**Implementazione suggerita:**
1. Aggiungere `weatherAlerts` ai dataSets nella URL del connettore
2. Creare un nuovo campo `alerts` nel return del connettore
3. Nello Smart Engine o in un servizio dedicato, confrontare le allerte con le sottoscrizioni in `alert_subscriptions`
4. Inviare push notification automatiche agli utenti iscritti nella zona dell'allerta
5. Salvare le allerte inviate nella tabella `weather_alerts` per evitare duplicati

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

| # | Miglioramento | Impatto | Effort | Priorità |
|---|---------------|---------|--------|----------|
| 1 | **`weatherAlerts`** → Push notifications automatiche | Alto | Medio | ⭐ Alta |
| 2 | **`uv_index_max`** nell'aggregazione daily | Basso | Basso | Media |
| 3 | **`forecastNextHour`** → Notifiche precipitazioni imminenti | Medio | Medio | Media |
| 4 | **Hourly arricchiti** (humidity, wind, UV per ora) | Medio | Medio | Bassa |
| 5 | **Daily arricchiti** (precipitationAmount, snowfall, windMax) | Basso | Basso | Bassa |

---

> **Raccomandazione:** Implementare il punto 1 (`weatherAlerts`) come priorità — completa il cerchio tra WeatherKit e il sistema push già implementato, trasformando le notifiche da manuali ad automatiche con dati ufficiali.
