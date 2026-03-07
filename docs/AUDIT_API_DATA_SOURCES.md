# Audit Fonti Dati Meteo — Smart Meteo

> Data: 2026-03-07
> Scopo: Mappatura completa dei campi disponibili per ogni API e identificazione dei dati non sfruttati

---

## Legenda

| Simbolo | Significato |
|---------|-------------|
| ✅ | Campo estratto e usato nell'aggregazione |
| ⚠️ | Campo disponibile nell'API ma **non estratto** dal connettore |
| ❌ | Campo non disponibile in questa API |
| 🔶 | Campo estratto ma **non utilizzato** nell'aggregazione finale |

---

## Struttura Unificata Attuale (`UnifiedForecastData`)

Questa è la struttura target verso cui ogni connettore normalizza i dati:

```typescript
{
  temp              // °C — temperatura attuale
  feels_like        // °C — temperatura percepita
  humidity          // % — umidità relativa
  wind_speed        // m/s — velocità vento
  wind_direction    // ° — direzione vento
  wind_gust         // m/s — raffiche vento
  condition_text    // stringa — descrizione condizione
  condition_code    // 'clear'|'cloudy'|'rain'|'snow'|'storm'|'fog'|'unknown'
  precipitation_prob // % — probabilità precipitazioni
  precipitation_intensity // mm — intensità precipitazioni
  aqi               // indice qualità aria (EPA US)
  pressure          // hPa — pressione atmosferica
  daily[]           // previsioni giornaliere (7 giorni)
  hourly[]          // previsioni orarie
  astronomy         // alba, tramonto, fase lunare
}
```

---

## 1. Tomorrow.io

**Peso aggregazione:** 1.2 (massimo)
**Piano richiesto:** Free / Paid
**Documentazione:** https://docs.tomorrow.io

### Endpoint utilizzato
```
GET https://api.tomorrow.io/v4/weather/realtime
Params: location={lat},{lon}&apikey=KEY&units=metric
```

### Campi disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `data.values.temperature` | `temp` | ✅ |
| `data.values.temperatureApparent` | `feels_like` | ✅ |
| `data.values.humidity` | `humidity` | ✅ |
| `data.values.windSpeed` | `wind_speed` | ✅ |
| `data.values.windDirection` | `wind_direction` | ✅ |
| `data.values.windGust` | `wind_gust` | ✅ |
| `data.values.pressureSurfaceLevel` | `pressure` | ✅ |
| `data.values.weatherCode` | `condition_text` | ✅ (salvato come "Code: {code}", non tradotto) |
| `data.values.precipitationProbability` | `precipitation_prob` | ✅ |
| `data.values.precipitationIntensity` | — | ⚠️ **Non estratto** |
| `data.values.dewPoint` | — | ⚠️ **Non estratto** (calcolato manualmente in engine) |
| `data.values.uvIndex` | — | ⚠️ **Non estratto** |
| `data.values.visibility` | — | ⚠️ **Non estratto** |
| `data.values.cloudCover` | — | ⚠️ **Non estratto** |
| `data.values.snowAccumulation` | — | ⚠️ **Non estratto** |
| `data.values.iceAccumulation` | — | ⚠️ **Non estratto** |
| `data.location.lat/lon` | — | ⚠️ **Non estratto** |

### Endpoint aggiuntivi disponibili (non utilizzati)
- `GET /v4/weather/forecast` → **Previsioni orarie + giornaliere** fino a 5 giorni ⚠️
- `GET /v4/timelines` → Timeline personalizzabili con 100+ campi ⚠️
- `GET /v4/weather/history/recent` → Dati storici recenti ⚠️
- `GET /v4/locations/{locationId}/summary` → Riassunto giornaliero ⚠️

### Problemi rilevati
- Il `weatherCode` Tomorrow.io è un codice numerico proprietario (1000 = clear, 1001 = cloudy, ecc.) — viene salvato come stringa `"Code: 1001"` invece di essere tradotto nel `condition_code` normalizzato. **La normalizzazione è persa.**
- Nonostante abbia il peso più alto (1.2), fornisce solo dati attuali — nessun forecast giornaliero/orario.

---

## 2. Open-Meteo

**Peso aggregazione:** 1.1
**Piano richiesto:** Free (open source, no API key)
**Documentazione:** https://open-meteo.com/en/docs

### Endpoint utilizzato
```
GET https://api.open-meteo.com/v1/forecast
Params: latitude, longitude, current=[...], hourly=[...], daily=[...], timezone=auto
```

### Campi correnti disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `current.temperature_2m` | `temp` | ✅ |
| `current.apparent_temperature` | `feels_like` | ✅ |
| `current.relative_humidity_2m` | `humidity` | ✅ |
| `current.wind_speed_10m` | `wind_speed` | ✅ |
| `current.wind_direction_10m` | `wind_direction` | ✅ |
| `current.wind_gusts_10m` | `wind_gust` | ✅ |
| `current.pressure_msl` | `pressure` | ✅ |
| `current.weather_code` | `condition_code` | ✅ |
| `current.precipitation` | `precipitation_intensity` | ✅ |
| `current.rain` | — | ⚠️ Richiesto ma non estratto separatamente |
| `current.showers` | — | ⚠️ Richiesto ma non estratto separatamente |
| `current.snowfall` | — | ⚠️ Richiesto ma non estratto separatamente |
| `current.cloud_cover` | — | ⚠️ Non richiesto (disponibile) |
| `current.uv_index` | — | ⚠️ Non richiesto (disponibile) |
| `current.visibility` | — | ⚠️ Non richiesto (disponibile) |
| `current.dew_point_2m` | — | ⚠️ Non richiesto (disponibile) |
| `current.surface_pressure` | — | ⚠️ Non richiesto |
| `current.is_day` | — | ⚠️ Non richiesto |

### Campi giornalieri disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `daily.weather_code` | `condition_code` | ✅ |
| `daily.temperature_2m_max` | `temp_max` | ✅ |
| `daily.temperature_2m_min` | `temp_min` | ✅ |
| `daily.precipitation_probability_max` | `precipitation_prob` | ✅ |
| `daily.sunrise` | `astronomy.sunrise` | ✅ |
| `daily.sunset` | `astronomy.sunset` | ✅ |
| `daily.uv_index_max` | — | ⚠️ Non richiesto |
| `daily.wind_speed_10m_max` | — | ⚠️ Non richiesto |
| `daily.wind_gusts_10m_max` | — | ⚠️ Non richiesto |
| `daily.precipitation_sum` | — | ⚠️ Non richiesto |
| `daily.rain_sum` | — | ⚠️ Non richiesto |
| `daily.snowfall_sum` | — | ⚠️ Non richiesto |
| `daily.shortwave_radiation_sum` | — | ⚠️ Non richiesto |
| `daily.et0_fao_evapotranspiration` | — | ⚠️ Non richiesto |

### Campi orari disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `hourly.temperature_2m` | `temp` | ✅ |
| `hourly.precipitation_probability` | `precipitation_prob` | ✅ |
| `hourly.weather_code` | `condition_code` | ✅ |
| `hourly.relative_humidity_2m` | — | ⚠️ Non richiesto |
| `hourly.apparent_temperature` | — | ⚠️ Non richiesto |
| `hourly.wind_speed_10m` | — | ⚠️ Non richiesto |
| `hourly.wind_direction_10m` | — | ⚠️ Non richiesto |
| `hourly.uv_index` | — | ⚠️ Non richiesto |
| `hourly.visibility` | — | ⚠️ Non richiesto |
| `hourly.precipitation` | — | ⚠️ Non richiesto |
| `hourly.cloud_cover` | — | ⚠️ Non richiesto |

### Note
- **Fonte più completa**: unica a fornire daily + hourly + astronomy in modo completo e gratuito.
- La fase lunare viene calcolata localmente (`getMoonPhase`), non recuperata dall'API (non disponibile in Open-Meteo standard).

---

## 3. OpenWeatherMap

**Peso aggregazione:** 1.0
**Piano richiesto:** Free (chiamate limitate) / Paid
**Documentazione:** https://openweathermap.org/api

### Endpoint utilizzato
```
GET https://api.openweathermap.org/data/2.5/weather
Params: lat, lon, appid=KEY, units=metric
```

### Campi disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `main.temp` | `temp` | ✅ |
| `main.feels_like` | `feels_like` | ✅ |
| `main.humidity` | `humidity` | ✅ |
| `wind.speed` | `wind_speed` | ✅ |
| `wind.deg` | `wind_direction` | ✅ |
| `wind.gust` | `wind_gust` | ✅ |
| `main.pressure` | `pressure` | ✅ |
| `weather[0].main` | `condition_text` | ✅ |
| `weather[0].id` | — | ⚠️ Codice condizione OWM non estratto |
| `weather[0].description` | — | ⚠️ Descrizione dettagliata non estratta |
| `weather[0].icon` | — | ⚠️ Icona non estratta |
| `main.temp_min` / `main.temp_max` | — | ⚠️ Non estratti |
| `main.sea_level` | — | ⚠️ Pressione livello mare non estratta |
| `main.grnd_level` | — | ⚠️ Pressione livello suolo non estratta |
| `visibility` | — | ⚠️ Non estratta |
| `clouds.all` | — | ⚠️ Copertura nuvolosa % non estratta |
| `rain.1h` / `rain.3h` | — | ⚠️ Pioggia non estratta |
| `snow.1h` / `snow.3h` | — | ⚠️ Neve non estratta |
| `sys.sunrise` / `sys.sunset` | — | ⚠️ Alba/tramonto disponibili ma non estratti |
| `dt` | — | ⚠️ Timestamp Unix non usato |
| `coord.lat` / `coord.lon` | — | ⚠️ Coordinate non verificate |

### Endpoint aggiuntivi disponibili (non utilizzati)
- `GET /data/2.5/forecast` → **Previsioni 5 giorni / 3 ore** ⚠️
- `GET /data/3.0/onecall` → OneCall API: current + minutely + hourly + daily + alerts ⚠️ (richiede piano Paid)
- `GET /data/2.5/air_pollution` → **AQI e inquinanti** (CO, NO2, O3, PM2.5, PM10) ⚠️
- `GET /geo/1.0/reverse` → Geocoding inverso ⚠️

### Problemi rilevati
- Usa l'endpoint `data/2.5/weather` (base) invece di `data/2.5/forecast` — **nessun dato daily/hourly**.
- Il campo `sys.sunrise` / `sys.sunset` è disponibile ma ignorato — potrebbe arricchire i dati astronomy.
- `weather[0].id` (codice numerico OWM) non viene usato per determinare `condition_code` — si usa solo il testo.

---

## 4. AccuWeather

**Peso aggregazione:** 1.1
**Piano richiesto:** Free (50 chiamate/giorno) / Paid
**Documentazione:** https://developer.accuweather.com/apis

### Endpoint utilizzati
```
GET http://dataservice.accuweather.com/locations/v1/cities/geoposition/search
Params: apikey=KEY, q={lat},{lon}
→ Restituisce locationKey

GET http://dataservice.accuweather.com/currentconditions/v1/{locationKey}
Params: apikey=KEY, details=true
```

### Campi disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `Temperature.Metric.Value` | `temp` | ✅ |
| `RealFeelTemperature.Metric.Value` | `feels_like` | ✅ |
| `RelativeHumidity` | `humidity` | ✅ |
| `Wind.Speed.Metric.Value` | `wind_speed` | ✅ |
| `Wind.Direction.Degrees` | `wind_direction` | ✅ |
| `WindGust.Speed.Metric.Value` | `wind_gust` | ✅ |
| `Pressure.Metric.Value` | `pressure` | ✅ |
| `WeatherText` | `condition_text` | ✅ |
| `WeatherIcon` | — | ⚠️ Icona numerica AccuWeather non estratta |
| `IsDayTime` | — | ⚠️ Non estratto |
| `DewPoint.Metric.Value` | — | ⚠️ Dew Point disponibile ma non estratto |
| `Visibility.Metric.Value` | — | ⚠️ Visibilità non estratta |
| `CloudCover` | — | ⚠️ Copertura nuvolosa non estratta |
| `Ceiling.Metric.Value` | — | ⚠️ Non estratto |
| `IndoorRelativeHumidity` | — | ⚠️ Non estratto |
| `UVIndex` / `UVIndexText` | — | ⚠️ Non estratti |
| `PrecipitationSummary.Precipitation.Metric.Value` | — | ⚠️ Non estratto |
| `TemperatureSummary.Past6HourRange` | — | ⚠️ Non estratto |
| `ApparentTemperature.Metric.Value` | — | ⚠️ Non estratto |

### Endpoint aggiuntivi disponibili (non utilizzati)
- `GET /forecasts/v1/daily/5day/{locationKey}` → **Previsioni 5 giorni** ⚠️
- `GET /forecasts/v1/hourly/12hour/{locationKey}` → **Previsioni orarie 12h** ⚠️
- `GET /indices/v1/daily/1day/{locationKey}/21` → **Indice qualità aria** ⚠️

### Problemi rilevati
- `details=true` richiede campi extra (UV, dew point, visibilità, ecc.) ma quasi nessuno viene estratto.
- Nessun dato forecast giornaliero/orario nonostante API disponibili.
- 2 chiamate HTTP per ogni richiesta (geoposition + conditions) — rischio rate limit su piano free (50/giorno).

---

## 5. WeatherAPI

**Peso aggregazione:** 1.0
**Piano richiesto:** Free / Paid
**Documentazione:** https://www.weatherapi.com/docs

### Endpoint utilizzato
```
GET http://api.weatherapi.com/v1/current.json
Params: key=KEY, q={lat},{lon}, aqi=yes
```

### Campi disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `current.temp_c` | `temp` | ✅ |
| `current.feelslike_c` | `feels_like` | ✅ |
| `current.humidity` | `humidity` | ✅ |
| `current.wind_kph` | `wind_speed` | ✅ |
| `current.wind_degree` | `wind_direction` | ✅ |
| `current.gust_kph` | `wind_gust` | ✅ |
| `current.pressure_mb` | `pressure` | ✅ |
| `current.condition.text` | `condition_text` | ✅ |
| `current.air_quality['us-epa-index']` | `aqi` | ✅ |
| `current.condition.code` | — | ⚠️ Codice condizione non estratto |
| `current.condition.icon` | — | ⚠️ URL icona non estratto |
| `current.wind_dir` | — | ⚠️ Direzione testuale (N, NE, ecc.) non estratta |
| `current.precip_mm` | — | ⚠️ Precipitazione mm non estratta |
| `current.cloud` | — | ⚠️ Copertura nuvolosa % non estratta |
| `current.dewpoint_c` | — | ⚠️ Dew Point non estratto |
| `current.vis_km` | — | ⚠️ Visibilità non estratta |
| `current.uv` | — | ⚠️ UV Index non estratto |
| `current.air_quality.co` | — | ⚠️ Monossido di carbonio non estratto |
| `current.air_quality.no2` | — | ⚠️ Biossido di azoto non estratto |
| `current.air_quality.o3` | — | ⚠️ Ozono non estratto |
| `current.air_quality.so2` | — | ⚠️ Biossido di zolfo non estratto |
| `current.air_quality.pm2_5` | — | ⚠️ PM2.5 non estratto |
| `current.air_quality.pm10` | — | ⚠️ PM10 non estratto |
| `current.air_quality['gb-defra-index']` | — | ⚠️ Indice DEFRA UK non estratto |
| `location.name` / `region` / `country` | — | ⚠️ Info località non estratte |
| `location.localtime` | `time` | 🔶 Estratto ma non usato nell'aggregazione |

### Endpoint aggiuntivi disponibili (non utilizzati)
- `GET /v1/forecast.json` → **Previsioni 3 giorni + orarie** (con astronomy inclusa) ⚠️
- `GET /v1/future.json` → Previsioni fino a 300 giorni ⚠️ (Paid)
- `GET /v1/history.json` → Dati storici ⚠️
- `GET /v1/astronomy.json` → **Dati astronomici (sunrise, sunset, moonrise, moonset, moon phase, moon illumination)** ⚠️

### Note
- **Unica fonte a fornire AQI** — ma i singoli inquinanti (PM2.5, NO2, O3, ecc.) sono disponibili e non estratti.
- Richiede solo 1 chiamata per ottenere dati attuali completi (incluso AQI).

---

## 6. Weatherstack

**Peso aggregazione:** 0.9
**Piano richiesto:** Free (1000 req/mese, solo HTTPS su piani Paid)
**Documentazione:** https://weatherstack.com/documentation

### Endpoint utilizzato
```
GET http://api.weatherstack.com/current
Params: access_key=KEY, query={lat},{lon}
```

### Campi disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `current.temperature` | `temp` | ✅ |
| `current.feelslike` | `feels_like` | ✅ |
| `current.humidity` | `humidity` | ✅ |
| `current.wind_speed` | `wind_speed` | ✅ |
| `current.wind_degree` | `wind_direction` | ✅ |
| `current.weather_descriptions[0]` | `condition_text` | ✅ |
| `current.weather_code` | `condition_code` | ✅ |
| `current.precip` | `precipitation_intensity` | ✅ |
| `current.pressure` | `pressure` | ✅ |
| `current.wind_dir` | — | ⚠️ Direzione testuale non estratta |
| `current.cloudcover` | — | ⚠️ Copertura nuvolosa non estratta |
| `current.uv_index` | — | ⚠️ UV Index non estratto |
| `current.visibility` | — | ⚠️ Visibilità non estratta |
| `current.is_day` | — | ⚠️ Non estratto |
| `current.weather_icons[0]` | — | ⚠️ URL icona non estratto |
| `location.name` / `country` / `timezone_id` | — | ⚠️ Non estratti |
| `location.utc_offset` | — | ⚠️ Non estratto |

### Endpoint aggiuntivi disponibili (non utilizzati)
- `GET /forecast` → Previsioni giornaliere ⚠️ (richiede piano Paid)
- `GET /historical` → Dati storici ⚠️ (richiede piano Paid)
- `GET /autocomplete` → Autocompletamento luoghi ⚠️

### Problemi rilevati
- **Usa HTTP** (non HTTPS) perché il piano free non supporta HTTPS — rischio sicurezza per la chiave API.
- `wind_speed` è in km/h ma **non viene convertito in m/s** nel connettore — incoerenza con le altre fonti.
- Il forecast è disponibile solo su piani a pagamento.

---

## 7. Meteostat

**Peso aggregazione:** 0.8 (minimo)
**Piano richiesto:** Free via RapidAPI (500 req/mese) / Paid
**Documentazione:** https://dev.meteostat.net

### Endpoint utilizzato
```
GET https://meteostat.p.rapidapi.com/point/hourly
Headers: x-rapidapi-host, x-rapidapi-key
Params: lat, lon, start=oggi, end=oggi, tz=UTC
```

### Campi disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `data[last].temp` | `temp` | ✅ |
| `data[last].rhum` | `humidity` | ✅ |
| `data[last].wspd` | `wind_speed` | ✅ |
| `data[last].wdir` | `wind_direction` | ✅ |
| `data[last].wpgt` | `wind_gust` | ✅ |
| `data[last].coco` | `condition_code` + `condition_text` | ✅ |
| `data[last].prcp` | `precipitation_intensity` | ✅ |
| `data[last].dwpt` | — | ⚠️ Dew Point disponibile ma non estratto |
| `data[last].pres` | — | ⚠️ **Pressione disponibile ma non estratta** |
| `data[last].tsun` | — | ⚠️ Ore di sole non estratte |
| `data[last].snow` | — | ⚠️ Neve al suolo non estratta |
| `data[last].wpgt` | `wind_gust` | ✅ |
| `feels_like` | — | ❌ Non disponibile in Meteostat |

### Endpoint aggiuntivi disponibili (non utilizzati)
- `GET /point/daily` → **Dati storici giornalieri** ⚠️
- `GET /point/monthly` → Dati mensili ⚠️
- `GET /point/climate` → Normali climatiche (medie 30 anni) ⚠️
- `GET /stations/nearby` → Stazioni meteo vicine ⚠️
- `GET /stations/meta` → Metadati stazioni ⚠️

### Problemi rilevati
- **Meteostat fornisce dati storici/osservati, non previsioni** — ha senso per la validazione incrociata ma non per il forecast.
- **La pressione (`pres`) è disponibile ma non estratta** — bug nel connettore.
- `feels_like` viene impostato a `null` (non disponibile nell'API).
- Restituisce solo l'ultima rilevazione oraria disponibile (che può essere in ritardo di ore).
- Il codice condizione `coco` usa una scala 1-27 propria di Meteostat, non standard WMO.

---

## 8. World Weather Online (WWO)

**Peso aggregazione:** 1.0
**Piano richiesto:** Paid (trial 60 giorni)
**Documentazione:** https://www.worldweatheronline.com/developer/api/docs

### Endpoint utilizzato
```
GET http://api.worldweatheronline.com/premium/v1/weather.ashx
Params: key=KEY, q={lat},{lon}, format=json, num_of_days=7, fx=yes, cc=yes, mca=no, tp=1
```

### Campi attuali disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `current_condition[0].temp_C` | `temp` | ✅ |
| `current_condition[0].FeelsLikeC` | `feels_like` | ✅ |
| `current_condition[0].humidity` | `humidity` | ✅ |
| `current_condition[0].windspeedKmph` | `wind_speed` | ✅ |
| `current_condition[0].winddirDegree` | `wind_direction` | ✅ |
| `current_condition[0].WindGustKmph` | `wind_gust` | ✅ |
| `current_condition[0].pressure` | `pressure` | ✅ |
| `current_condition[0].weatherDesc[0].value` | `condition_text` | ✅ |
| `current_condition[0].weatherCode` | `condition_code` | ✅ |
| `current_condition[0].precipMM` | `precipitation_intensity` | ✅ |
| `current_condition[0].visibility` | — | ⚠️ Non estratta |
| `current_condition[0].cloudcover` | — | ⚠️ Non estratta |
| `current_condition[0].uvIndex` | — | ⚠️ Non estratto |
| `current_condition[0].winddir16Point` | — | ⚠️ Direzione testuale non estratta |
| `current_condition[0].observation_time` | — | ⚠️ Usa `new Date()` invece del tempo API |

### Campi giornalieri disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `weather[i].date` | `date` | ✅ |
| `weather[i].maxtempC` | `temp_max` | ✅ |
| `weather[i].mintempC` | `temp_min` | ✅ |
| `weather[i].hourly[0].weatherDesc[0].value` | `condition_text` | ✅ (solo prima ora) |
| `weather[i].hourly[0].weatherCode` | — | ⚠️ `condition_code` giornaliero non estratto |
| `weather[i].hourly[i].chanceofrain` | `precipitation_prob` | ⚠️ Aggregato solo per forecast giornaliero come media delle ore |
| `weather[i].uvIndex` | — | ⚠️ UV Index giornaliero non estratto |
| `weather[i].astronomy[0].sunrise` | `astronomy.sunrise` | ✅ |
| `weather[i].astronomy[0].sunset` | `astronomy.sunset` | ✅ |
| `weather[i].astronomy[0].moonrise` | — | ⚠️ Non estratto |
| `weather[i].astronomy[0].moonset` | — | ⚠️ Non estratto |
| `weather[i].astronomy[0].moon_phase` | — | ⚠️ **Non estratto** (la fase lunare viene calcolata localmente!) |
| `weather[i].astronomy[0].moon_illumination` | — | ⚠️ Non estratto |
| `weather[i].hourly[i].windspeedKmph` | — | ⚠️ Vento orario non estratto |
| `weather[i].hourly[i].humidity` | — | ⚠️ Umidità oraria non estratta |

### Campi orari disponibili vs utilizzati

| Campo API | Campo UnifiedForecast | Stato |
|-----------|----------------------|-------|
| `weather[0].hourly[i].tempC` | `temp` | ✅ |
| `weather[0].hourly[i].chanceofrain` | `precipitation_prob` | ✅ |
| `weather[0].hourly[i].weatherCode` | `condition_code` | ✅ |
| `weather[0].hourly[i].weatherDesc[0].value` | `condition_text` | ✅ |
| `weather[0].hourly[i].FeelsLikeC` | — | ⚠️ Non estratto |
| `weather[0].hourly[i].humidity` | — | ⚠️ Non estratto |
| `weather[0].hourly[i].windspeedKmph` | — | ⚠️ Non estratto |
| `weather[0].hourly[i].WindGustKmph` | — | ⚠️ Non estratto |
| `weather[0].hourly[i].precipMM` | — | ⚠️ Non estratto |
| `weather[0].hourly[i].uvIndex` | — | ⚠️ Non estratto |
| `weather[0].hourly[i].chanceofsunshine` | — | ⚠️ Non estratto |
| `weather[0].hourly[i].chanceofsnow` | — | ⚠️ Non estratto |
| `weather[0].hourly[i].chanceofthunder` | — | ⚠️ Non estratto |

---

## Riepilogo Generale

### Disponibilità per tipo di dato

| Dato | Tomorrow | Open-Meteo | OWM | AccuWeather | WeatherAPI | Weatherstack | Meteostat | WWO |
|------|----------|------------|-----|-------------|------------|-------------|-----------|-----|
| Temperatura attuale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Temperatura percepita | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Umidità | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vento (velocità) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vento (direzione) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Raffiche | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Pressione | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ bug | ✅ |
| Precipitazioni % | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Precipitazioni mm | ⚠️ | ✅ | ✅ | ❌ | ⚠️ | ✅ | ✅ | ✅ |
| AQI | ❌ | ❌ | ⚠️ | ❌ | ✅ | ❌ | ❌ | ❌ |
| UV Index | ⚠️ | ⚠️ | ❌ | ⚠️ | ⚠️ | ⚠️ | ❌ | ⚠️ |
| Visibilità | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ❌ | ⚠️ |
| Dew Point | ⚠️ | ⚠️ | ❌ | ⚠️ | ⚠️ | ❌ | ⚠️ | ❌ |
| Cloud Cover | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ❌ | ⚠️ |
| **Forecast giornaliero** | ⚠️ | ✅ | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ✅ |
| **Forecast orario** | ⚠️ | ✅ | ❌ | ⚠️ | ⚠️ | ❌ | ❌ | ✅ |
| Astronomia (alba/tramonto) | ❌ | ✅ | ⚠️ | ❌ | ⚠️ | ❌ | ❌ | ✅ |
| Fase lunare | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ✅ |

> Legenda: ✅ = estratto e usato, ⚠️ = disponibile ma non estratto/usato, ❌ = non disponibile

---

## Principali Dati Non Sfruttati

### 1. UV Index
**Disponibile in:** Tomorrow.io, Open-Meteo, AccuWeather, WeatherAPI, Weatherstack, WWO
**Impatto:** Dato utile per la salute utente — nessuna implementazione frontend.

### 2. Visibilità
**Disponibile in:** Tomorrow.io, Open-Meteo, OWM, AccuWeather, WeatherAPI, Weatherstack, WWO
**Impatto:** Utile per condizioni di nebbia/foschia — non estratto da nessuna fonte.

### 3. Qualità dell'Aria (dettaglio inquinanti)
**Disponibile in:** WeatherAPI (CO, NO2, O3, SO2, PM2.5, PM10, DEFRA index)
**Impatto:** Solo l'indice EPA aggregato viene estratto — tutti gli inquinanti specifici sono ignorati.

### 4. Dew Point
**Disponibile in:** Tomorrow.io, Open-Meteo (come variabile oraria), AccuWeather, WeatherAPI, Meteostat
**Impatto:** Il dew point viene **calcolato manualmente** nell'engine con la formula Magnus invece di essere recuperato dalle API che lo forniscono direttamente.

### 5. Copertura Nuvolosa (Cloud Cover)
**Disponibile in:** Tomorrow.io, Open-Meteo, OWM, AccuWeather, WeatherAPI, Weatherstack, WWO
**Impatto:** Nessuna fonte lo estrae — potrebbe migliorare la qualità del `condition_code`.

### 6. Forecast Giornaliero da fonti aggiuntive
**Disponibile in:** Tomorrow.io (`/v4/weather/forecast`), OWM (`/2.5/forecast`), AccuWeather (`/forecasts/v1/daily/5day`), WeatherAPI (`/v1/forecast.json`)
**Impatto:** Solo Open-Meteo e WWO forniscono daily forecast — le altre 4 fonti con peso alto non contribuiscono al forecast giornaliero.

### 7. Fase Lunare da API
**Disponibile in:** WWO (`astronomy[0].moon_phase`), WeatherAPI (`/astronomy.json`)
**Impatto:** Viene calcolata localmente con algoritmo proprio invece di usare dati API affidabili.

### 8. Pressione in Meteostat
**Bug confermato:** Il campo `pres` è disponibile nella risposta Meteostat ma non viene estratto nel connettore.

### 9. Conversione Wind Speed in Weatherstack
**Bug confermato:** `wind_speed` da Weatherstack è in km/h ma non viene convertito in m/s come le altre fonti — crea incoerenza nell'aggregazione ponderata.

### 10. Traduzione WeatherCode Tomorrow.io
**Bug confermato:** Il `weatherCode` Tomorrow.io viene salvato come stringa `"Code: {number}"` invece di essere mappato ai valori WMO o ai codici normalizzati — la condizione non viene riconosciuta correttamente dal normalizzatore.

---

## Raccomandazioni Prioritarie

### Alta Priorità (Bug / Incoerenze)

| # | Problema | File | Impatto |
|---|----------|------|---------|
| 1 | `wind_speed` Weatherstack non convertito da km/h a m/s | `connectors/weatherstack.ts` | Errore nei valori aggregati |
| 2 | `weatherCode` Tomorrow.io non tradotto | `connectors/tomorrow.ts` | Condizione sempre `unknown` |
| 3 | `pressure` Meteostat non estratto | `connectors/meteostat.ts` | Dato perso |
| 4 | Solo 2 fonti contribuiscono al daily forecast (da 8 disponibili) | `engine/smartEngine.ts` | Qualità previsioni ridotta |

### Media Priorità (Funzionalità mancanti)

| # | Miglioramento | Beneficio |
|---|---------------|-----------|
| 5 | Aggiungere UV Index da Open-Meteo (già richiesto, non estratto) | Dato salute |
| 6 | Usare `moon_phase` da WWO invece del calcolo locale | Accuratezza |
| 7 | Estrarre inquinanti AQI dettagliati da WeatherAPI | Dashboard qualità aria |
| 8 | Aggiungere visibilità da Open-Meteo e WeatherAPI | Condizioni nebbia |
| 9 | Usare endpoint `/forecast` di OWM, WeatherAPI, AccuWeather | Daily/hourly da più fonti |

### Bassa Priorità (Nice-to-have)

| # | Miglioramento |
|---|---------------|
| 10 | Cloud cover da più fonti per condition_code più accurato |
| 11 | Moonrise/moonset da WWO |
| 12 | Dew point diretto da API invece di calcolo Magnus |
| 13 | Migrazione Weatherstack a HTTPS (richiede piano Paid) |
| 14 | Considerare sostituzione Meteostat (dati storici, non previsioni, peso già 0.8) |
