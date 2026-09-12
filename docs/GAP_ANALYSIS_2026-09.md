# Gap Analysis e Proposte — Settembre 2026

> **Data:** 2026-09-12
> **Scopo:** (1) verificare nel codice se tutto quanto stabilito nei documenti progettuali è
> stato effettivamente implementato; (2) individuare nuove implementazioni interessanti sulla base
> dei dati che le API a contratto offrono e che oggi non sfruttiamo.
> **Metodo:** lettura di tutti i 18 documenti in `docs/` + `CLAUDE.md` / `AGENTS.md` / `README.md`,
> e verifica puntuale nel codice (backend, frontend-web, frontend-ios, migrazioni).
> Ogni riga di questo documento è verificata sul codice, non copiata dagli stati dichiarati.

---

## Indice

1. [Risposta sintetica](#1-risposta-sintetica)
2. [Parte A — Verifica documento per documento](#2-parte-a--verifica-documento-per-documento)
3. [Parte B — Gap aperti confermati](#3-parte-b--gap-aperti-confermati)
4. [Parte C — Disallineamenti della documentazione](#4-parte-c--disallineamenti-della-documentazione-doc-drift)
5. [Parte D — Nuove implementazioni proposte](#5-parte-d--nuove-implementazioni-proposte)
6. [Parte E — Roadmap proposta (Fase 6)](#6-parte-e--roadmap-proposta-fase-6)

---

## 1. Risposta sintetica

**Abbiamo implementato tutto quanto stabilito in analisi?** No, ma i buchi non sono dove la
documentazione li colloca.

Le feature *di prodotto* delle Fasi 1-5 sono effettivamente in codice (9 connettori, engine con
pesi, allerte multi-fonte con poller e filtro geografico, precipitazioni in mm, dettaglio orario
multi-metrica, pannello qualità dell'aria, widget iOS, SpriteKit, haptic, push APNs). Restano
aperti **quattro blocchi sostanziali**:

| Blocco | Stato reale |
|--------|-------------|
| **Testing** (`TODO_TESTING.md`, ~60 checkbox) | Quasi tutto aperto: nessun Jest sul backend, nessun E2E, nessun test iOS, nessun audit Lighthouse |
| **Notifiche email** (`EMAIL_NOTIFICATIONS_PLAN.md`, 13 punti) | 0% — nessuna traccia in codice, toggle iOS ancora `.constant(false)` |
| **Meteostat come ground truth** (`VALUTAZIONI_TECNICHE.md` §3, opzione B raccomandata) | Non fatto: le osservazioni passate continuano a entrare nelle previsioni future |
| **Confidence score / accuratezza reale** (`IMPLEMENTATION_PLAN.md` Fase 4, `5D.1`) | Parziale e concettualmente diverso da quanto pianificato (vedi §3.4) |

In più ci sono **due feature pagate e già in casa ma invisibili all'utente**:
`forecastNextHour` (nowcast minutale WeatherKit) e i dati lunari `moonrise`/`moonset`/
`moon_illumination` sul web — il backend li serve, nessun client li legge.

**Ci sono ulteriori implementazioni interessanti?** Sì, e diverse a costo marginale zero: le API
già a contratto espongono pollini, quota neve, radiazione solare, indici temporaleschi, onde,
suolo, indici lifestyle, normali climatiche, radar e — la più sottovalutata — **modelli multipli
gratuiti su Open-Meteo**, che trasformano una singola fonte in cinque fonti indipendenti.
Dettaglio in §5.

---

## 2. Parte A — Verifica documento per documento

| Documento | Dichiarato | Verificato in codice | Delta |
|-----------|-----------|----------------------|-------|
| `IMPLEMENTATION_PLAN.md` | 5 fonti fra cui **Meteomatics**; radar/satellite; MapKit radar su iOS; Fase 4 = accuratezza storica e tuning pesi | Meteomatics **non esiste** (`backend/connectors/` non ha il file); nessun radar/mappa su nessuna piattaforma; Fase 4 solo parziale | 🔴 3 punti del piano originale mai realizzati |
| `PHASE_1.md` | `[x] Implementare Connector: Meteomatics` | Connettore inesistente; al suo posto Open-Meteo (mai citato nella checklist) | 🔴 checkbox errata |
| `PHASE_2.md` | tutto `[x]` tranne E2E Playwright | Coerente; E2E ancora assente | 🟡 1 punto aperto |
| `PHASE_3.md` | Step 3.7 (Widget) `[ ]` | Widget **implementato** (`SmartMedeoWidget/`, 8 file) | 🟡 doc non aggiornato |
| `AUDIT_API_DATA_SOURCES.md` | racc. #1-#9 risolte, #10-#14 aperte | #10 (cloud cover) e #11-#12 risolte; #13 risolto per disabilitazione; **#14 aperto** | 🟡 doc non aggiornato |
| `IMPLEMENTATION_API_IMPROVEMENTS.md` / `CHANGELOG_API_IMPROVEMENTS.md` | 4 fasi complete | Coerente con il codice | ✅ |
| `IMPLEMENTATION_PLAN_PHASE_5.md` | 5A-5D complete | 5A ✅, 5B ✅, 5C ✅ (file presenti), 5D ✅ tranne l'endpoint `GET /api/accuracy` e il cron di ricalcolo previsti in 5D.1 | 🟡 2 sotto-punti non fatti |
| `WEATHERKIT_DATA_ANALYSIS.md` | punti 1-4 fatti, punto 5 (daily arricchiti) aperto | `precipitationAmount` **ora estratto** (`weatherkit.ts:196,307`); restano `snowfallAmount`, `windSpeedMax`, `windGustSpeedMax` daily e `pressure`/`visibility`/`cloudCover`/`snowfallIntensity` hourly. `precipitation_intensity` corrente estratto ma **mai aggregato** (`AggregationData` non lo contiene) | 🟡 parziale |
| `WEATHER_ALERTS_ANALYSIS.md` | Fasi 1-5 complete | Coerente e anzi superato (filtro geografico `alertGeo.ts`, migrazioni 020-021, dedup per device). Nota: la push ora è **solo** del poller, lo smart engine restituisce le allerte senza notificarle (`smartEngine.ts:578-584`) — corretto, ma il doc descrive ancora il vecchio flusso | ✅ / doc da aggiornare |
| `EMAIL_NOTIFICATIONS_PLAN.md` | "Da implementare" | **0%**. Nessun `resend`, nessuna tabella `email_alert_subscriptions`, nessun endpoint `/api/alerts/email/*`. Inoltre il piano prevede la migrazione `020_email_alert_subscriptions.sql`, ma il numero 020 è già occupato da `020_weather_alerts_location.sql`: **primo numero libero = 022** | 🔴 intero piano aperto |
| `TODO_TESTING.md` | "Da implementare" | Backend: nessun Jest, solo 4 script `ts-node` di verifica (`verifyAlertGeo`, `verifyAlertDedup`, `verifyPrecipitation`, `verifyWind`) — utili ma non sostituiscono le 8 suite connettore + engine + formatter + moon + supertest. Web: 6 suite (erano 3), ma `HourlyForecast`, `ForecastDetails`, `SunWindCard`, `SearchBar`, `DynamicBackground`, i 3 hook e `useLocations` restano non testati. E2E: 0. iOS: 0. Lighthouse: 0 | 🔴 ~80% aperto |
| `VALUTAZIONI_TECNICHE.md` | §1 risolto; §2-§4 aperti | §1 ✅ (Weatherstack peso 0, `smartEngine.ts:44`); §2 Lighthouse mai eseguito; §3 Meteostat **ancora nell'aggregazione** con peso 0.8 (`smartEngine.ts:45,57`), opzione B non implementata; §4 nessun test iOS | 🔴 3 su 4 aperti |
| `BACKEND_DB_INTEGRATION.md` | caching + audit + config da DB | Implementato, con in più lo `schema_version` per invalidare la cache. `confidence_score` scritto sempre `null` (`smartEngine.ts:568`) | 🟡 1 campo mai calcolato |
| `IOS_SETUP_GUIDE.md` / `WEATHERKIT_SETUP_GUIDE.md` | guide operative | Coerenti | ✅ |
| `PROJECT_STATUS_SUMMARY.md` | riepilogo generale | Vedi §4: diverse cifre non più vere | 🟡 |

---

## 3. Parte B — Gap aperti confermati

Ordinati per rapporto valore/costo, non per priorità dichiarata nei vecchi documenti.

### 3.1 `forecastNextHour` esposto dal backend e ignorato da tutti i client 🔴

`smartEngine.ts:530-533` propaga il nowcast minutale di WeatherKit nella risposta. Nessun
consumatore: `frontend-web/lib/types.ts` non dichiara il campo in `ForecastResponse`, e
`Models/Forecast.swift` nemmeno. Stiamo pagando il dataset Apple, lo parsiamo
(`weatherkit.ts:parseForecastNextHour`) e lo buttiamo.

È il gap col miglior rapporto valore/costo del progetto: la feature "pioggia fra 12 minuti" è
**solo UI**, zero lavoro backend.

### 3.2 Dati lunari assenti sul web 🟡

Il backend serve `moonrise`, `moonset`, `moon_illumination` (`types.ts:AstronomyData`, aggregati in
`smartEngine.ts:472-492`). iOS li mostra (`CurrentWeatherView.swift:563`). Il web dichiara solo
`sunrise/sunset/moon_phase` (`frontend-web/lib/types.ts:57-61`) e non li mostra: asimmetria
web/iOS su dati già sul filo.

### 3.3 Meteostat: osservazioni passate mescolate a previsioni future 🔴

`VALUTAZIONI_TECNICHE.md` §3 raccomandava l'**opzione B** (spostare Meteostat a ruolo di
validazione). Non fatto: peso 0.8 e fetcher attivo. Il connettore restituisce l'ultima rilevazione
oraria disponibile, che può avere ore di ritardo, e quel valore entra nella media pesata della
temperatura *attuale*. Con `hourly: []` e `daily: []` sempre vuoti, il contributo è solo sul
`current` — dove fa più danno.

### 3.4 `source_accuracy` misura la conformità, non l'accuratezza 🔴

`accuracy.ts:logAccuracyDeviations` calcola `|temp_fonte − temp_consenso|`: è la deviazione dalla
**media**, non l'errore rispetto all'**osservato**. Conseguenze:

- Una fonte che ha ragione mentre le altre sbagliano viene **penalizzata**.
- Il peso dinamico premia la conformità al gruppo → l'aggregato converge verso il consenso e
  perde le previsioni divergenti corrette. È l'opposto dell'obiettivo di `IMPLEMENTATION_PLAN.md`
  Fase 4 ("confronteremo le previsioni con i dati reali storici").
- La media è cumulativa senza finestra (`update_source_accuracy`, migrazione 015): `sample_count`
  cresce all'infinito, quindi dopo qualche migliaio di campioni il MAE è di fatto congelato e i
  pesi non si muovono più. Nessun decadimento temporale, nessun ricalcolo periodico.
- Mancano l'endpoint `GET /api/accuracy` e il cron di ricalcolo previsti in `5D.1`.

Il fix corretto è il confronto forecast T+24h vs osservato, e Meteostat / Open-Meteo Archive sono
esattamente la fonte di verità che serve — lo stesso lavoro che risolve §3.3.

### 3.5 `confidence_score` mai calcolato 🟠

La colonna esiste dalla migrazione 005, il piano la prevede, il valore scritto è `null`
(`smartEngine.ts:568`). Aggreghiamo fino a 9 fonti e non diciamo mai **quanto sono d'accordo**:
è l'informazione più distintiva che possiede un aggregatore, e non la mostriamo.

### 3.6 AQI monofonte, senza previsione 🟠

`current.aqi` e `air_quality` vengono solo da WeatherAPI (`smartEngine.ts:495-496`,
`sourceWithAirQuality`): nessuna aggregazione, nessun fallback se WeatherAPI è giù, nessun
andamento orario o giornaliero. Tutto il bel pannello `AirQualityPanel.tsx` dipende da una singola
chiamata. Risolvibile gratis (§5.1).

### 3.7 Notifiche email: piano intero aperto 🔴

Vedi §2. Da valutare se resti in roadmap: il valore incrementale rispetto alle push è modesto per
utenti iOS, ma è **l'unico canale di allerta per gli utenti web**, che oggi non ricevono nulla.

### 3.8 Testing 🔴

Il rischio concreto: `smartEngine.ts` è 587 righe di aggregazione con media circolare del vento,
gating della frazione umida delle precipitazioni, bucketing orario con offset di fuso e
invalidazione della cache per versione di schema — tutta logica numerica, tutta senza test di
regressione. I 4 script `verify*.ts` coprono geo-allerte, dedup, precipitazioni e vento: sono il
20% giusto. Manca il resto, in particolare i connettori (8 suite con fixture) e l'aggregazione
daily/hourly.

### 3.9 Radar / mappa assenti 🟡

`IMPLEMENTATION_PLAN.md` li prevede due volte (radar/satellite come ruolo di Meteomatics;
"Integrazione MapKit per radar" come feature chiave iOS). Non esiste nulla su nessuna piattaforma.

### 3.10 Residui di estrazione 🟢

- WeatherKit hourly: `pressure`, `visibility`, `cloudCover`, `windDirection`, `snowfallIntensity`.
- WeatherKit daily: `snowfallAmount`, `windSpeedMax`, `windGustSpeedMax`.
- `precipitation_intensity` corrente: estratto da 5 connettori, mai aggregato né esposto (i mm/h
  *adesso* mancano, mentre abbiamo i mm previsti per ora e per giorno).
- Open-Meteo: `is_day`, `sunshine_duration`, `cloud_cover_low/mid/high` non richiesti.

---

## 4. Parte C — Disallineamenti della documentazione (doc drift)

Da correggere perché inducono in errore chi riprende il progetto:

| Dove | Dice | In realtà |
|------|------|-----------|
| `CLAUDE.md` / `AGENTS.md` | "8 connettori", elenco senza WeatherKit | 9 connettori previsionali + `meteoalarm.ts` per le allerte |
| `CLAUDE.md` env vars | `METEOMATICS_USER`, `METEOMATICS_PASSWORD` | Nessun connettore Meteomatics esiste; mancano invece `APPLE_*`/`APNS_*`, `CRON_SECRET` |
| `CLAUDE.md` / `AGENTS.md` struttura | `routes/sources.ts` unica route; `utils/` con 2 file | Esistono `routes/alerts.ts`, `services/{apns,alertProcessor,alertPoller,accuracy}.ts`, `utils/{alertGeo,precipitation,wind}.ts`, `scripts/` |
| `CLAUDE.md` componenti web | 12 componenti | 17 + `components/ui/` (mancano `WeatherAlerts`, `DayNarrative`, `AirQualitySummary`, `AirQualityPanel`, `HourlyDetail`, `WeatherEffects`) |
| `CLAUDE.md` / `PROJECT_STATUS_SUMMARY.md` | "12 migration" / "fino a 019" | **21** migrazioni (001-021) |
| `CLAUDE.md` testing | "3 suite" | 6 suite web; il backend ha 4 script di verifica via `npm test` |
| `AUDIT_API_DATA_SOURCES.md` | Weatherstack peso 0.9 | Peso 0, disabilitato |
| `PROJECT_STATUS_SUMMARY.md` §1 | Fase 3 iOS 100%, API Improvements ~98% | Vero, ma la tabella non riporta i gap §3.1-§3.8 di questo documento |
| `PHASE_3.md` §3.7 | Widget `[ ]` | Implementato |
| `WEATHER_ALERTS_ANALYSIS.md` §2 | flusso con push dallo smart engine | La push è ora solo del poller schedulato |

---

## 5. Parte D — Nuove implementazioni proposte

Solo cose ottenibili dalle **API già a contratto** (o gratuite senza chiave), ordinate per
rapporto valore/costo. Nessuna richiede un nuovo abbonamento salvo dove indicato.

### Tier 1 — alto valore, costo basso

#### 5.1 Pollini e qualità dell'aria previsionale (Open-Meteo Air Quality API) ⭐

`https://air-quality-api.open-meteo.com/v1/air-quality` — gratuita, senza chiave, stessa
infrastruttura del connettore che già usiamo.

Offre: `alder_pollen`, `birch_pollen`, `grass_pollen`, `mugwort_pollen`, `olive_pollen`,
`ragweed_pollen` (previsione a 4 giorni), `european_aqi` + sotto-indici per inquinante,
`pm10`, `pm2_5`, `no2`, `o3`, `so2`, `co`, `dust`, `uv_index_clear_sky`, `ammonia`.

Tre risultati in un colpo:
1. **Sezione "Allergie"** — pollini per specie con soglie, di forte valore stagionale in Italia
   (olivo e graminacee in primavera, ambrosia a fine estate). Nessun concorrente generalista lo fa
   bene in italiano.
2. **AQI aggregato e previsionale** — risolve il gap §3.6: seconda fonte per gli inquinanti,
   European AQI accanto a quello EPA, e andamento orario/giornaliero invece del solo istante.
3. Tomorrow.io espone anche `pollenTreeIndex` / `pollenGrassIndex` / `pollenWeedIndex` nel
   `/v4/timelines`: terza fonte per il voting, a costo zero di abbonamento.

**Effort:** medio (nuovo connettore + tipi + pannello web/iOS). **Impatto:** alto.

#### 5.2 Quota neve, neve al suolo, gelate (Open-Meteo) ⭐

Parametri da aggiungere alla chiamata che **già facciamo**: `freezing_level_height`,
`snow_depth`, `snowfall` (hourly), `snowfall_sum` (daily), `soil_temperature_0cm`.

Per un'app usata su località alpine (i documenti stessi citano Bormio) la quota neve è
l'informazione più richiesta dell'inverno, e il rischio gelata notturna quella più richiesta a
marzo-aprile. Con `snow_depth` si mostra anche il manto attuale. WeatherKit ci darebbe in più
`snowfallAmount` daily e `snowfallIntensity` hourly (§3.10), rendendo il dato multi-fonte.

**Effort:** basso lato backend (stringa di parametri + campi), medio lato UI.
**Impatto:** alto in stagione.

#### 5.3 Indice di consenso e banda di incertezza ⭐

Due livelli, il primo a costo praticamente nullo:

1. **Consenso interno** — la dispersione fra le 9 fonti che già interroghiamo è un dato che
   possediamo e scartiamo. Deviazione standard pesata su temperatura e probabilità di
   precipitazione → popola finalmente `confidence_score` (§3.5) e permette una UI del tipo
   "9 fonti su 9 concordi" vs "fonti in disaccordo: 18-24 °C", più una banda d'ombra sul grafico
   orario. È il differenziatore naturale di un aggregatore e nessuna app mainstream lo mostra.
2. **Ensemble reale** — `https://ensemble-api.open-meteo.com/v1/ensemble` (gratuita) restituisce
   i singoli membri di GFS/ICON/IFS: percentili 10/50/90 veri invece di una stima da 9 modelli
   deterministici correlati.

**Effort:** basso (1), medio (2). **Impatto:** alto, e chiude un punto del piano originale.

#### 5.4 Nowcast minutale in UI (dato già in casa)

Vedi §3.1: `forecastNextHour` è già nella risposta. Serve solo la UI — grafico a barre dei minuti
con "Inizia a piovere alle 14:32", e una push a soglia ("pioggia fra 15 minuti") che riusa
l'infrastruttura APNs esistente.

**Effort:** basso. **Impatto:** alto (è la feature percepita come "magica").

#### 5.5 Radar e mappa

Due strade, entrambe senza nuovi costi:
- **OpenWeatherMap Weather Maps 1.0** — abbiamo già la chiave: tile `precipitation_new`,
  `clouds_new`, `wind_new`, `temp_new`, `pressure_new` sovrapponibili a una mappa.
- **RainViewer API** — gratuita, radar reale con 2 ore di storico e 30 minuti di nowcast,
  qualitativamente migliore per la pioggia.

Web con MapLibre/Leaflet, iOS con `MapKit` + overlay: colma §3.9 e un punto del piano originale.

**Effort:** medio-alto. **Impatto:** alto (è la feature più attesa in un'app meteo che non ce l'ha).

### Tier 2 — differenzianti, effort contenuto

#### 5.6 Indici "lifestyle" (AccuWeather + Tomorrow.io)

`GET /indices/v1/daily/1day/{locationKey}/{indexId}` — già nel piano free che usiamo. Decine di
indici: corsa, escursionismo, ciclismo, zanzare, artrite, ritardi aerei, lavaggio auto, asma,
raffreddore. Tomorrow.io aggiunge `fireIndex`, `roadRisk`, `grassGrowthPotential`.
Prodotto: "Oggi è una buona giornata per…" — molto condivisibile, poco costoso.

⚠️ Vincolo: AccuWeather free è 50 chiamate/giorno e ne consumiamo già 3 per forecast. Da valutare
solo con cache giornaliera aggressiva.

#### 5.7 Confronto con le normali climatiche (Meteostat + Open-Meteo Archive)

`GET /point/climate` (Meteostat, medie trentennali) e
`https://archive-api.open-meteo.com/v1/archive` (gratuito). Abilita frasi ad alto valore:
"3,2 °C sopra la media di settembre", "il settembre più piovoso degli ultimi 10 anni",
"ultima volta sotto zero: 12 marzo".

Sinergia importante: è **lo stesso dato osservato** che serve per §3.3 e §3.4. Un solo intervento
risolve il ruolo di Meteostat, dà accuratezza reale alle fonti e produce una feature visibile.

#### 5.8 Temporali: indici convettivi (Open-Meteo)

`cape`, `lifted_index`, `convective_inhibition`, più `chanceofthunder` (WWO). Oggi il rischio
temporale si deduce solo dal `condition_code`: un indice orario 0-100 è molto più informativo, e
in Italia d'estate è la domanda del giorno.

**Effort:** basso (parametri + scala, riusa il registry metriche già esistente in
`lib/metrics.ts` / `MetricScale.swift`). **Impatto:** medio-alto.

#### 5.9 Radiazione solare e resa fotovoltaica (Open-Meteo)

`shortwave_radiation`, `direct_normal_irradiance`, `diffuse_radiation`,
`global_tilted_irradiance` (con `tilt` e `azimuth`!), `sunshine_duration`. Con la potenza
dell'impianto inserita dall'utente si stima la produzione giornaliera in kWh: pubblico piccolo ma
molto fedele, e in Italia il fotovoltaico domestico è diffusissimo.

#### 5.10 Giardino e agricoltura (Open-Meteo)

`soil_temperature_0_to_7cm`, `soil_moisture_0_to_7cm`, `et0_fao_evapotranspiration`,
`vapour_pressure_deficit`. Prodotto: "devo innaffiare?", rischio gelata tardiva (abbiamo già dew
point), finestra di semina.

#### 5.11 Mare (Open-Meteo Marine + WeatherAPI)

`https://marine-api.open-meteo.com/v1/marine`: `wave_height`, `wave_direction`, `wave_period`,
`swell_wave_height`, `sea_surface_temperature`. WeatherAPI `marine.json` aggiunge le **maree**.
Da attivare solo per località costiere (test sulla distanza dal mare): temperatura dell'acqua e
onde sono la prima domanda di chi va al mare.

#### 5.12 Alba/tramonto "spettacolari" e cielo notturno

`cloud_cover_low/mid/high` separati (Open-Meteo) + visibilità: nuvole alte con cielo basso libero
danno i tramonti migliori. Con `moon_illumination`, `moonrise`/`moonset` (già in casa, §3.2) e la
copertura nuvolosa si costruisce un indice per l'osservazione astronomica. Feature "carina",
effort molto basso, ottima per la condivisione.

### Tier 3 — ingegneria dei dati (invisibile, alto impatto sulla qualità)

#### 5.13 Modelli multipli su Open-Meteo ⭐⭐

Il punto più sottovalutato dell'intero progetto. Open-Meteo accetta `&models=`:
`icon_eu`, `icon_d2` (2 km sulle Alpi!), `gfs_seamless`, `ifs04`, `meteofrance_seamless`,
`arpae_cosmo_5m` (italiano), `ukmo_seamless`.

Oggi trattiamo Open-Meteo come **una** fonte con peso 1.1. Con una sola chiamata in più
otteniamo 5-7 modelli **davvero indipendenti** (ECMWF, DWD, NOAA, Météo-France), cioè più
diversità statistica di quella che i provider commerciali ci danno oggi — molti dei quali, sotto
il marchio, rielaborano gli stessi GFS/ECMWF. Gratuito, senza chiave, e migliora l'aggregazione
più di qualunque abbonamento. È anche il modo naturale di alimentare §5.3 (ensemble).

#### 5.14 Verifica di accuratezza reale + pagina "affidabilità fonti"

Il fix di §3.4: salvare i forecast T+24h (già in `raw_forecasts`), confrontarli con l'osservato
(Meteostat / Open-Meteo Archive), calcolare il MAE vero per fonte, metrica e area geografica, con
finestra scorrevole a 30 giorni. Esporre `GET /api/accuracy` e una pagina pubblica "quanto ci
azzeccano le fonti a casa tua": è la promessa originale del progetto e nessun concorrente la
mantiene.

#### 5.15 Allerte su soglie personali

Il sistema attuale notifica solo le allerte **governative**. Molto richiesto: soglie dell'utente
("avvisami se scende sotto 0 °C", "se il vento supera 50 km/h", "se domani piove più di 10 mm",
"se l'AQI supera 100"). Riusa integralmente `alert_subscriptions` + APNs + poller a 15 minuti già
in produzione: è quasi solo configurazione e una tabella di regole.

---

## 6. Parte E — Roadmap proposta (Fase 6)

Sequenza pensata per massimizzare il valore percepito per unità di lavoro, chiudendo insieme
gap documentati e feature nuove quando ricadono sullo stesso codice.

### 6.1 Fase 6A — "Raccogliere ciò che è già pagato" (effort basso, impatto immediato)

| # | Intervento | Chiude |
|---|-----------|--------|
| 1 | UI nowcast minutale su web e iOS | §3.1 |
| 2 | Dati lunari sul web (tipi + `SunWindCard`) | §3.2 |
| 3 | Indice di consenso fra le fonti + `confidence_score` popolato | §3.5, §5.3.1 |
| 4 | `precipitation_intensity` aggregato in `current` (mm/h adesso) | §3.10 |
| 5 | Allineamento di `CLAUDE.md`, `AGENTS.md`, `PROJECT_STATUS_SUMMARY.md`, `PHASE_3.md` | §4 |

### 6.2 Fase 6B — Rete di sicurezza (da fare prima di toccare l'engine)

| # | Intervento | Chiude |
|---|-----------|--------|
| 6 | Jest + ts-jest sul backend; fixture per i 9 connettori | `TODO_TESTING` §2.1-2.3 |
| 7 | Test dell'aggregazione: media pesata, voting, daily/hourly, bucketing con offset, cache per versione | `TODO_TESTING` §2.4-2.5 |
| 8 | `supertest` sulle route (`/forecast`, `/sources`, `/alerts/*`) | `TODO_TESTING` §2.6 |
| 9 | Playwright: dashboard, ricerca, fonti, auth | `TODO_TESTING` §3 |

### 6.3 Fase 6C — Qualità della previsione (il cuore del prodotto)

| # | Intervento | Chiude |
|---|-----------|--------|
| 10 | Open-Meteo multi-modello (`&models=`) come fonti distinte | §5.13 |
| 11 | Meteostat / Open-Meteo Archive come ground truth, fuori dall'aggregazione | §3.3, §5.7 |
| 12 | MAE reale con finestra 30 giorni, `GET /api/accuracy`, cron di ricalcolo | §3.4, §5.14 |
| 13 | Ensemble Open-Meteo per i percentili 10/50/90 | §5.3.2 |

### 6.4 Fase 6D — Nuove feature utente

| # | Intervento | Chiude |
|---|-----------|--------|
| 14 | Connettore Open-Meteo Air Quality: pollini + AQI previsionale multi-fonte | §3.6, §5.1 |
| 15 | Quota neve, neve al suolo, rischio gelate | §5.2 |
| 16 | Indice temporali (CAPE / lifted index) nel registry metriche | §5.8 |
| 17 | Radar/mappa (RainViewer o tile OWM) | §3.9, §5.5 |
| 18 | Allerte su soglie personali | §5.15 |

### 6.5 Fase 6E — Nicchie e rifiniture

Mare e maree (§5.11), fotovoltaico (§5.9), giardino (§5.10), indici lifestyle (§5.6, con cache
per il limite AccuWeather), alba/tramonto e cielo notturno (§5.12), residui WeatherKit (§3.10),
test iOS e audit Lighthouse (`VALUTAZIONI_TECNICHE` §2 e §4).

### 6.6 Decisione richiesta: notifiche email

`EMAIL_NOTIFICATIONS_PLAN.md` è interamente aperto. Prima di investirci va deciso se serve:
per gli utenti iOS aggiunge poco alle push, ma è **l'unico canale di allerta per il web**, che
oggi non riceve nulla. Alternativa più economica: Web Push (VAPID) sul frontend, che riusa la
pipeline esistente invece di introdurre Resend, template HTML, rate limiting e disiscrizione GDPR.
Se si procede con l'email, ricordare che la migrazione va numerata **022**, non 020.

---

> **Documenti correlati:** `PROJECT_STATUS_SUMMARY.md` (stato dichiarato),
> `AUDIT_API_DATA_SOURCES.md` (audit campi per fonte), `TODO_TESTING.md` (roadmap test),
> `VALUTAZIONI_TECNICHE.md` (decisioni pendenti), `EMAIL_NOTIFICATIONS_PLAN.md` (piano email),
> `WEATHERKIT_DATA_ANALYSIS.md` (residui WeatherKit).
