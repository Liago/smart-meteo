# Gap Analysis e Proposte — Settembre 2026

> **Data:** 2026-09-12
> **Scopo:** (1) verificare nel codice se tutto quanto stabilito nei documenti progettuali è
> stato effettivamente implementato; (2) individuare nuove implementazioni interessanti sulla base
> dei dati che le API a contratto offrono e che oggi non sfruttiamo.
> **Metodo:** lettura di tutti i 18 documenti in `docs/` + `CLAUDE.md` / `AGENTS.md` / `README.md`,
> e verifica puntuale nel codice (backend, frontend-web, frontend-ios, migrazioni).
> Ogni riga di questo documento è verificata sul codice, non copiata dagli stati dichiarati.
>
> **Stato avanzamento roadmap:** Fase 6A ✅ e Fase 6B ✅ completate (2026-09-12) · 6C → 6E da fare.
> Il registro delle modifiche è in [§7](#7-registro-avanzamento).

---

## Indice

1. [Risposta sintetica](#1-risposta-sintetica)
2. [Parte A — Verifica documento per documento](#2-parte-a--verifica-documento-per-documento)
3. [Parte B — Gap aperti confermati](#3-parte-b--gap-aperti-confermati)
4. [Parte C — Disallineamenti della documentazione](#4-parte-c--disallineamenti-della-documentazione-doc-drift)
5. [Parte D — Nuove implementazioni proposte](#5-parte-d--nuove-implementazioni-proposte)
6. [Parte E — Roadmap proposta (Fase 6)](#6-parte-e--roadmap-proposta-fase-6)
7. [Registro avanzamento](#7-registro-avanzamento)

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

In più c'erano **due feature pagate e già in casa ma invisibili all'utente**:
`forecastNextHour` (nowcast minutale WeatherKit) e i dati lunari `moonrise`/`moonset`/
`moon_illumination` sul web — il backend li serviva, nessun client li leggeva.
**Entrambe risolte nella Fase 6A** (§7), insieme all'indice di consenso e ai mm/h correnti.

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
| `PHASE_1.md` | `[x] Implementare Connector: Meteomatics` | Connettore inesistente; al suo posto Open-Meteo (mai citato nella checklist) | ✅ corretto in 6A |
| `PHASE_2.md` | tutto `[x]` tranne E2E Playwright | Coerente; E2E ancora assente | 🟡 1 punto aperto |
| `PHASE_3.md` | Step 3.7 (Widget) `[ ]` | Widget **implementato** (`SmartMedeoWidget/`, 8 file) | ✅ corretto in 6A |
| `AUDIT_API_DATA_SOURCES.md` | racc. #1-#9 risolte, #10-#14 aperte | #10 (cloud cover) e #11-#12 risolte; #13 risolto per disabilitazione; **#14 aperto** | ✅ corretto in 6A |
| `IMPLEMENTATION_API_IMPROVEMENTS.md` / `CHANGELOG_API_IMPROVEMENTS.md` | 4 fasi complete | Coerente con il codice | ✅ |
| `IMPLEMENTATION_PLAN_PHASE_5.md` | 5A-5D complete | 5A ✅, 5B ✅, 5C ✅ (file presenti), 5D ✅ tranne l'endpoint `GET /api/accuracy` e il cron di ricalcolo previsti in 5D.1 | 🟡 2 sotto-punti non fatti |
| `WEATHERKIT_DATA_ANALYSIS.md` | punti 1-4 fatti, punto 5 (daily arricchiti) aperto | Il doc era obsoleto in due punti: `precipitationAmount` e `windDirection` risultavano non estratti ma sono in codice (`weatherkit.ts:196,210,307`). Restano `snowfallAmount`, `windSpeedMax`, `windGustSpeedMax` daily e `pressure`/`visibility`/`cloudCover`/`snowfallIntensity` hourly. `precipitation_intensity` corrente ora aggregato (6A) | ✅ corretto in 6A; 2 residui aperti |
| `WEATHER_ALERTS_ANALYSIS.md` | Fasi 1-5 complete | Coerente e anzi superato (filtro geografico `alertGeo.ts`, migrazioni 020-021, dedup per device). Nota: la push ora è **solo** del poller, lo smart engine restituisce le allerte senza notificarle (`smartEngine.ts:578-584`) — corretto, ma il doc descrive ancora il vecchio flusso | ✅ / doc da aggiornare |
| `EMAIL_NOTIFICATIONS_PLAN.md` | "Da implementare" | **0%**. Nessun `resend`, nessuna tabella `email_alert_subscriptions`, nessun endpoint `/api/alerts/email/*`. Inoltre il piano prevede la migrazione `020_email_alert_subscriptions.sql`, ma il numero 020 è già occupato da `020_weather_alerts_location.sql`: **primo numero libero = 022** | 🔴 intero piano aperto |
| `TODO_TESTING.md` | "Da implementare" | Backend: nessun Jest, solo script `ts-node` di verifica (`verifyAlertGeo`, `verifyAlertDedup`, `verifyPrecipitation`, `verifyWind`, + `verifyConsensus` dalla 6A) — utili ma non sostituiscono le 9 suite connettore + engine + formatter + moon + supertest. Web: 7 suite dopo la 6A, ma `HourlyForecast`, `ForecastDetails`, `SunWindCard`, `SearchBar`, `DynamicBackground`, i 3 hook e `useLocations` restano non testati. E2E: 0. iOS: 0. Lighthouse: 0 | 🔴 ~80% aperto → **Fase 6B** |
| `VALUTAZIONI_TECNICHE.md` | §1 risolto; §2-§4 aperti | §1 ✅ (Weatherstack peso 0, `smartEngine.ts:44`); §2 Lighthouse mai eseguito; §3 Meteostat **ancora nell'aggregazione** con peso 0.8 (`smartEngine.ts:45,57`), opzione B non implementata; §4 nessun test iOS | 🔴 3 su 4 aperti |
| `BACKEND_DB_INTEGRATION.md` | caching + audit + config da DB | Implementato, con in più lo `schema_version` per invalidare la cache. `confidence_score` era scritto sempre `null` | ✅ popolato in 6A |
| `IOS_SETUP_GUIDE.md` / `WEATHERKIT_SETUP_GUIDE.md` | guide operative | Coerenti | ✅ |
| `PROJECT_STATUS_SUMMARY.md` | riepilogo generale | Diverse cifre non più vere (vedi §4) | ✅ corretto in 6A |

---

## 3. Parte B — Gap aperti confermati

Ordinati per rapporto valore/costo, non per priorità dichiarata nei vecchi documenti.

### 3.1 `forecastNextHour` esposto dal backend e ignorato da tutti i client ✅ RISOLTO (6A)

`smartEngine.ts` propagava il nowcast minutale di WeatherKit nella risposta senza alcun
consumatore: né `frontend-web/lib/types.ts` né `Models/Forecast.swift` dichiaravano il campo.
Pagavamo il dataset Apple, lo parsavamo (`weatherkit.ts:parseForecastNextHour`) e lo
buttavamo.

**Risolto:** `frontend-web/components/NextHourPrecipitation.tsx` e
`UI/Features/Dashboard/NextHourPrecipitationView.swift`. Il titolo è dedotto dai minuti e non
dal campo `summary` di WeatherKit — i due possono discordare e i minuti sono ciò che
disegniamo — e una pausa deve durare almeno 3 minuti prima di annunciare che la pioggia è
finita, altrimenti un buco isolato nei dati diventa una schiarita inesistente. Quando l'ora è
asciutta il pannello si riduce a una riga: un istogramma di zeri occuperebbe spazio senza dire
nulla. 13 test in `__tests__/next-hour.test.tsx`.

### 3.2 Dati lunari assenti sul web ✅ RISOLTO (6A)

Il backend serviva `moonrise`, `moonset`, `moon_illumination` (aggregati in
`smartEngine.ts:472-492`) e solo iOS li mostrava (`CurrentWeatherView.swift:563`).

**Risolto:** campi aggiunti ad `AstronomyData` in `lib/types.ts` e terza riga in
`SunWindCard.tsx`. Gli orari passano da un parser con fallback, perché le fonti non
concordano sul formato (WWO manda ISO con offset, WeatherKit UTC con `Z`, WeatherAPI un
`"07:42 PM"` convertito a 24h): senza fallback il web avrebbe mostrato `Invalid Date`.

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

### 3.5 `confidence_score` mai calcolato ✅ RISOLTO (6A)

La colonna esisteva dalla migrazione 005 e il valore scritto era `null`: aggregavamo fino a 9
fonti senza mai dire **quanto sono d'accordo**, l'informazione più distintiva che possiede un
aggregatore.

**Risolto:** `backend/utils/consensus.ts` calcola la deviazione standard **pesata** (di
popolazione, non campionaria: le fonti attive *sono* l'insieme su cui misuriamo l'accordo) su
temperatura e probabilità di precipitazione, la converte in accordo 0-1 rispetto a soglie
esplicite (3 °C, 30 punti percentuali) e la **contrae verso 50 con `n/(n+2)`**: due fonti
concordi non danno la garanzia di nove, e con pochi campioni la dispersione osservata è essa
stessa poco affidabile. Esposto come `confidence` nella risposta e scritto in
`smart_forecasts.confidence_score`. Mostrato in `SourcesIndicator.tsx` con l'intervallo fra la
fonte più fredda e la più calda quando supera 1 °C. 13 verifiche in `verifyConsensus.ts`.

Restano fuori di proposito le condizioni categoriche: i `condition_code` non sono normalizzati
fra i provider (Open-Meteo passa il codice WMO numerico, gli altri una stringa già
normalizzata), quindi un voto sui codici grezzi conterebbe come disaccordo WMO 1 e WMO 2, che
descrivono lo stesso cielo. Includerle richiede prima una mappa WMO → famiglia lato backend.

**Asimmetria introdotta e dichiarata:** la confidenza è per ora **solo sul web**. iOS non
mostra nemmeno `sources_used` — non esiste un pannello fonti — e crearlo esce dal perimetro di
6A. Il modello Swift decodifica già `confidence`, quindi manca solo la vista: voce aperta in
§6.5.

### 3.6 AQI monofonte, senza previsione 🟠

`current.aqi` e `air_quality` vengono solo da WeatherAPI (`smartEngine.ts:495-496`,
`sourceWithAirQuality`): nessuna aggregazione, nessun fallback se WeatherAPI è giù, nessun
andamento orario o giornaliero. Tutto il bel pannello `AirQualityPanel.tsx` dipende da una singola
chiamata. Risolvibile gratis (§5.1).

### 3.7 Notifiche email: piano intero aperto 🔴

Vedi §2. Da valutare se resti in roadmap: il valore incrementale rispetto alle push è modesto per
utenti iOS, ma è **l'unico canale di allerta per gli utenti web**, che oggi non ricevono nulla.

### 3.8 Testing ✅ RISOLTO (6B), tranne iOS e Lighthouse

Il rischio era concreto: `smartEngine.ts` è 587 righe di logica numerica — media circolare del
vento, gate sulla frazione umida, bucketing orario con offset di fuso, invalidazione della cache
per versione di schema — senza alcun test di regressione, e i connettori non ne avevano nessuno.

**Risolto:** 229 test backend in 11 suite (utils, 9 connettori, engine, route con supertest),
137 test web in 7 suite, 25 scenari E2E Playwright su due viewport. I cinque script
`verify*.ts` sono stati portati nella suite Jest e la cartella `scripts/` rimossa: due sistemi
di test in parallelo erano un doppio posto da ricordare.

**Il ritorno immediato:** scrivere i test ha fatto emergere **tre bug di unità sul vento**
(§3.13) e **due comportamenti** che nessun documento descriveva (§3.11 e §3.12). Nessuno dei tre
bug era visibile leggendo il codice — su WeatherKit la lettura del sorgente portava alla
conclusione *sbagliata*, e solo l'esecuzione ha mostrato il comportamento reale.

**Resta aperto:** nessun test iOS (`VALUTAZIONI_TECNICHE` §4), nessun audit Lighthouse, gli
scenari E2E che richiedono una sessione Supabase reale (pagina fonti autenticata, login,
logout), e i tre hook web non coperti.

### 3.9 Radar / mappa assenti 🟡

`IMPLEMENTATION_PLAN.md` li prevede due volte (radar/satellite come ruolo di Meteomatics;
"Integrazione MapKit per radar" come feature chiave iOS). Non esiste nulla su nessuna piattaforma.

### 3.10 Residui di estrazione 🟢

- WeatherKit hourly: `pressure`, `visibility`, `cloudCover`, `windDirection`, `snowfallIntensity`.
- WeatherKit daily: `snowfallAmount`, `windSpeedMax`, `windGustSpeedMax`.
- ~~`precipitation_intensity` corrente: estratto da 5 connettori, mai aggregato né esposto.~~
  ✅ **Risolto (6A)**: aggregato con lo stesso gate sulla frazione bagnata dei mm previsti, così
  una fonte isolata non inventa pioggia in corso. Le due grandezze sono numericamente
  omogenee (mm/h di intensità e mm accumulati in un'ora), quindi le soglie NWS valgono per
  entrambe.
- Open-Meteo: `is_day`, `sunshine_duration`, `cloud_cover_low/mid/high` non richiesti.

### 3.11 Il daily e l'hourly ignorano i pesi delle fonti 🔴 NUOVO (trovato in 6B)

`aggregatedDaily` e `aggregatedHourly` usano `avgSimple`, una media **aritmetica**:
`SOURCE_WEIGHTS` non entra nel calcolo di `temp_max`, `temp_min`, `precipitation_prob`,
`humidity`, `wind_speed` e `uv_index`. I pesi vengono invece applicati, nello stesso oggetto, ai
millimetri (`aggregatePrecipitationMm` riceve `weightOf(f.source)`), alla direzione del vento e
alle raffiche.

Perché conta: i pesi sono il concetto centrale del progetto — vanno da 0.8 a 1.2, e sopra ci
sono una tabella `source_accuracy`, un calcolo di MAE e un meccanismo di pesi dinamici. Su
`current` funzionano. Sui **sette giorni e sulla curva oraria**, cioè su quasi tutto quello che
l'utente guarda, sono inerti: Meteostat (0.8, che fornisce osservazioni passate) pesa esattamente
come WeatherKit (1.2).

Non è documentato come una scelta da nessuna parte, e `IMPLEMENTATION_PLAN.md` dice l'opposto:
«Algoritmo V1 (Media Pesata): calcola la media pesata per valori numerici (Temp, Vento, Pioggia)».
Il fatto che i mm accanto siano pesati suggerisce una dimenticanza cresciuta man mano che si
aggiungevano campi.

Il comportamento attuale è fotografato in `__tests__/engine/smartEngine.test.ts` con un test che
dichiara di non approvarlo. Cambiare la matematica delle previsioni è lavoro della **Fase 6C**,
non di una fase di test.

### 3.12 `POST /api/alerts/poll` è aperto senza `CRON_SECRET` 🟠 NUOVO (trovato in 6B)

```ts
if (cronSecret && requestSecret !== cronSecret) {
    return res.status(403).json({ error: 'Unauthorized: invalid cron secret' });
}
```

Se `CRON_SECRET` non è configurato il controllo viene saltato del tutto e chiunque può innescare
il polling — quindi le chiamate ai provider e **l'invio delle push**. La logica corretta è
l'opposto: senza segreto configurato, rifiutare. Coperto da un test che documenta il
comportamento attuale.

### 3.13 Unità del vento incoerenti fra connettori ✅ RISOLTO (6B)

Tre connettori consegnavano `wind_speed` in km/h invece dei m/s dichiarati da
`UnifiedForecastData`, quindi 3 fonti su 8 attive entravano nella media pesata con valori **3.6
volte troppo alti**, e nello stesso connettore il dato orario contraddiceva quello corrente:

| Fonte | Campo | Problema |
|-------|-------|----------|
| Open-Meteo | `current.wind_speed_10m` | km/h di default (non passiamo `wind_speed_unit`), non convertito mentre l'hourly sì |
| World Weather Online | `windspeedKmph` | il nome dice l'unità, passato grezzo |
| Meteostat | `wspd`, `wpgt` | km/h per documentazione, passati grezzi |

Su **WeatherKit** avevo diagnosticato un quarto bug leggendo il sorgente (`current.windSpeed * 3.6`)
e mi sbagliavo: poche righe dopo un `forecastPayload.wind_speed = current.windSpeed / 3.6`
sovrascriveva il valore. Il comportamento era corretto e solo il test lo ha dimostrato. Il codice
morto e i quattro commenti in cui l'autore discuteva con se stesso l'unità sono stati rimossi.

`__tests__/connectors/windUnits.test.ts` verifica la convenzione su **tutti** i connettori
insieme, con 36 km/h = 10 m/s esatti: un test per singolo connettore non avrebbe fatto emergere
il problema, perché ciascuno era coerente con se stesso.

### 3.14 `SourcesIndicator` mostrava l'id grezzo di 4 fonti su 9 ✅ RISOLTO (6B)

La mappa dei nomi copriva cinque fonti: le altre comparivano come `apple_weatherkit`,
`worldweatheronline`, `weatherstack`, `meteostat` — fra cui due delle fonti che rispondono più
spesso. Trovato scrivendo lo scenario E2E che verificava la lista.

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

**✅ Completata il 2026-09-12** — dettaglio in §7.

| # | Intervento | Chiude | Stato |
|---|-----------|--------|:-----:|
| 1 | UI nowcast minutale su web e iOS | §3.1 | ✅ |
| 2 | Dati lunari sul web (tipi + `SunWindCard`) | §3.2 | ✅ |
| 3 | Indice di consenso fra le fonti + `confidence_score` popolato | §3.5, §5.3.1 | ✅ (web; iOS in §6.5) |
| 4 | `precipitation_intensity` aggregato in `current` (mm/h adesso) | §3.10 | ✅ |
| 5 | Allineamento di `CLAUDE.md`, `AGENTS.md`, `PROJECT_STATUS_SUMMARY.md`, `PHASE_3.md` | §4 | ✅ |

### 6.2 Fase 6B — Rete di sicurezza

**✅ Completata il 2026-09-12** — dettaglio in §7.

| # | Intervento | Chiude | Stato |
|---|-----------|--------|:-----:|
| 6 | Jest + ts-jest sul backend; fixture per i 9 connettori | `TODO_TESTING` §2.1-2.3 | ✅ |
| 7 | Test dell'aggregazione: media pesata, voting, daily/hourly, bucketing con offset, cache per versione | `TODO_TESTING` §2.4-2.5 | ✅ |
| 8 | `supertest` sulle route (`/forecast`, `/sources`, `/alerts/*`) | `TODO_TESTING` §2.6 | ✅ |
| 9 | Playwright: dashboard, ricerca, auth | `TODO_TESTING` §3 | ✅ (fonti autenticate fuori portata) |

### 6.3 Fase 6C — Qualità della previsione (**prossimo blocco**, il cuore del prodotto)

| # | Intervento | Chiude |
|---|-----------|--------|
| 10 | **Pesare il daily e l'hourly**: oggi `avgSimple` ignora `SOURCE_WEIGHTS` | §3.11 |
| 11 | Open-Meteo multi-modello (`&models=`) come fonti distinte | §5.13 |
| 12 | Meteostat / Open-Meteo Archive come ground truth, fuori dall'aggregazione | §3.3, §5.7 |
| 13 | MAE reale con finestra 30 giorni, `GET /api/accuracy`, cron di ricalcolo | §3.4, §5.14 |
| 14 | Ensemble Open-Meteo per i percentili 10/50/90 | §5.3.2 |
| 15 | `CRON_SECRET`: rifiutare quando manca invece di lasciar passare | §3.12 |

Il punto 10 va per primo: è una riga di codice, ma cambia i numeri mostrati e adesso c'è la
suite che ne misura l'effetto. Senza quello, i punti 12 e 13 affinerebbero pesi che poi non
vengono applicati.

### 6.4 Fase 6D — Nuove feature utente

| # | Intervento | Chiude |
|---|-----------|--------|
| 14 | Connettore Open-Meteo Air Quality: pollini + AQI previsionale multi-fonte | §3.6, §5.1 |
| 15 | Quota neve, neve al suolo, rischio gelate | §5.2 |
| 16 | Indice temporali (CAPE / lifted index) nel registry metriche | §5.8 |
| 17 | Radar/mappa (RainViewer o tile OWM) | §3.9, §5.5 |
| 18 | Allerte su soglie personali | §5.15 |

### 6.5 Fase 6E — Nicchie e rifiniture

- **Pannello fonti su iOS**, con l'indice di consenso e `sources_used` — che iOS non ha mai
  mostrato. Chiude l'asimmetria dichiarata in §3.5.
- Mare e maree (§5.11), fotovoltaico (§5.9), giardino (§5.10), indici lifestyle (§5.6, con
  cache per il limite AccuWeather), alba/tramonto e cielo notturno (§5.12).
- Residui WeatherKit (§3.10): la neve ha senso insieme alla quota neve di Open-Meteo (§5.2),
  non da sola.
- Test iOS e audit Lighthouse (`VALUTAZIONI_TECNICHE` §2 e §4).

### 6.6 Decisione richiesta: notifiche email

`EMAIL_NOTIFICATIONS_PLAN.md` è interamente aperto. Prima di investirci va deciso se serve:
per gli utenti iOS aggiunge poco alle push, ma è **l'unico canale di allerta per il web**, che
oggi non riceve nulla. Alternativa più economica: Web Push (VAPID) sul frontend, che riusa la
pipeline esistente invece di introdurre Resend, template HTML, rate limiting e disiscrizione GDPR.
Se si procede con l'email, ricordare che la migrazione va numerata **022**, non 020.

---

## 7. Registro avanzamento

### Fase 6A — completata il 2026-09-12

Commit `feat(6A): nowcast al minuto, indice di consenso, mm/h correnti e luna sul web`
e `docs(6A): allinea la documentazione al codice`.

**Nuovi file**

| File | Ruolo |
|------|-------|
| `backend/utils/consensus.ts` | Deviazione standard pesata fra le fonti → punteggio di confidenza |
| `backend/scripts/verifyConsensus.ts` | 13 verifiche, in `npm test` |
| `frontend-web/components/NextHourPrecipitation.tsx` | Nowcast al minuto (web) |
| `frontend-web/__tests__/next-hour.test.tsx` | 13 test sul titolo, sul gate asciutto e sui minuti passati |
| `.../UI/Features/Dashboard/NextHourPrecipitationView.swift` | Nowcast al minuto (iOS) |

**File modificati:** `smartEngine.ts` (consenso, `precipitation_intensity`, schema 4,
`confidence_score`), `backend/package.json`, `frontend-web/lib/types.ts`,
`SourcesIndicator.tsx`, `SunWindCard.tsx`, `app/page.tsx`, due fixture di test,
`Models/Forecast.swift`, `DashboardView.swift`, `CurrentWeatherView.swift` (preview),
più `CLAUDE.md`, `AGENTS.md`, `backend/.env.example`, `PHASE_1.md`, `PHASE_3.md`,
`AUDIT_API_DATA_SOURCES.md`, `PROJECT_STATUS_SUMMARY.md`, `WEATHERKIT_DATA_ANALYSIS.md`.

**Decisioni prese strada facendo**

1. **Il consenso esclude le condizioni categoriche.** I `condition_code` non sono
   normalizzati fra i provider: un voto sui codici grezzi conterebbe WMO 1 e WMO 2 come
   disaccordo pur descrivendo lo stesso cielo. Serve prima una mappa WMO → famiglia lato
   backend (§3.5).
2. **Contrazione verso 50 invece di un punteggio grezzo.** Senza shrinkage, una sola fonte
   avrebbe dato confidenza 100 per definizione — dispersione zero su un campione di uno.
   Con `n/(n+2)`: 1 fonte → 67, 9 fonti unanimi → 91.
3. **Il gate della pioggia riusato sui mm/h correnti.** `aggregatePrecipitationMm` era scritto
   per i mm previsti, ma intensità in mm/h e accumulo in un'ora sono numericamente omogenei,
   quindi le soglie NWS valgono per entrambi e la regola anti-outlier vale doppio sul dato
   "adesso".
4. **Titolo del nowcast dai minuti, non dal `summary` di WeatherKit.** I due campi possono
   discordare e i minuti sono ciò che il grafico disegna. In più una pausa va difesa per
   almeno 3 minuti: un buco isolato non è una schiarita.
5. **La confidenza resta solo sul web.** iOS non mostra nemmeno `sources_used`: costruire quel
   pannello è una superficie UI nuova, fuori dal perimetro di 6A. Registrata in §6.5 per non
   lasciare un'asimmetria silenziosa — esattamente il difetto che questo documento contesta
   altrove.

**Verifiche eseguite**

| Cosa | Risultato |
|------|-----------|
| `cd backend && npm run typecheck` | pulito |
| `cd backend && npm test` | 65 controlli, 5 script, tutti superati |
| `cd frontend-web && npx tsc --noEmit` | pulito |
| `cd frontend-web && npm run lint` | nessun nuovo problema (restano 5 error + 4 warning preesistenti in `jest.config.js`, `useLocations.ts`, `weather-utils.ts`, `WeatherEffects.tsx`, `WeatherIcon.tsx`) |
| `cd frontend-web && npm test` | 137 test, 7 suite, tutti superati |
| `npm run build` (web) | **non eseguibile in questo ambiente**: `next/font` non raggiunge Google Fonts. Da ripetere in CI |
| Compilazione iOS | **non verificata**: su Linux non esiste toolchain Swift. Il codice è stato controllato a mano (parentesi bilanciate, nessun carattere non ASCII fuori dalle stringhe) ma va compilato in Xcode |

**Nota sul progetto Xcode:** usa `fileSystemSynchronizedGroups`, quindi
`NextHourPrecipitationView.swift` viene raccolto automaticamente senza toccare il
`project.pbxproj`.

### Fase 6B — completata il 2026-09-12

Commit `test(6B): suite Jest sul backend e tre bug di unità del vento`,
`test(6B): aggregazione dell engine e contratto HTTP delle route`,
`test(6B): suite E2E Playwright con API intercettata`.

**Copertura prima e dopo**

| | Prima | Dopo |
|---|------:|-----:|
| Backend | 0 test Jest (5 script `assert`) | **229** test, 11 suite |
| Web unit | 137 test, 7 suite | 137 test, 7 suite |
| E2E | 0 | **25** scenari × 2 viewport |
| Lint web | 5 errori | 2 errori (preesistenti) |

**Nuovi file**

`backend/jest.config.js`, `backend/jest.setup.ts`,
`backend/__tests__/fixtures/providers.ts`, `__tests__/utils/` (7 suite),
`__tests__/connectors/{windUnits,mapping}.test.ts`,
`__tests__/engine/smartEngine.test.ts`, `__tests__/routes/api.test.ts`,
`frontend-web/playwright.config.ts`, `frontend-web/e2e/` (3 spec + fixture).

**Cosa ha prodotto, oltre alla copertura**

| Trovato | Tipo | Esito |
|---------|------|-------|
| Vento in km/h da Open-Meteo, WWO, Meteostat (§3.13) | bug | ✅ corretto |
| `SourcesIndicator` con l'id grezzo di 4 fonti (§3.14) | bug UI | ✅ corretto |
| Daily e hourly non pesati (§3.11) | scelta implicita, probabile dimenticanza | ⏳ 6C |
| `/api/alerts/poll` aperto senza segreto (§3.12) | sicurezza | ⏳ 6C |
| `middleware/auth.ts` che esplode all'import senza env | fragilità | ⏳ 6E |

**Decisioni prese strada facendo**

1. **Un solo sistema di test.** I cinque `verify*.ts` sono stati portati in Jest e la cartella
   `scripts/` rimossa, invece di mantenere due posti dove cercare i test.
2. **Fixture come costruttori, non file JSON.** Ogni test parte dalla forma completa della
   risposta e sovrascrive un campo: con file statici servirebbe un JSON per variante.
3. **Un test cross-connettore sulle unità.** Nove test isolati non avrebbero trovato il bug del
   vento, perché ogni connettore era coerente con se stesso: serviva un test che confrontasse la
   convenzione fra tutti.
4. **Località seminata in localStorage per gli E2E.** Senza, la dashboard mostra il benvenuto e
   non chiama l'API. La geolocalizzazione resta neutralizzata: se concessa, i test dipenderebbero
   dall'IP del runner.
5. **Comportamenti fotografati e non corretti.** §3.11 e §3.12 sono documentati da test che
   dichiarano di non approvarli. Cambiare la matematica delle previsioni o la sicurezza di un
   endpoint non è lavoro di una fase di test: è 6C, con l'utente informato.
6. **Progetto mobile su Pixel 7.** Il descrittore `iPhone 14` di Playwright implica WebKit, non
   installato in tutti gli ambienti; il viewport mobile con touch si ottiene comunque.

**Limiti dichiarati**

- Il contenuto autenticato di `/sources` non è raggiungibile dagli E2E: il middleware di Next
  verifica la sessione server-side e `page.route` non la intercetta. Serve un progetto Supabase
  di test.
- Lighthouse non è eseguibile in sandbox (`next build` si ferma su `next/font`): va in CI.
- Nessun test iOS: manca la toolchain Swift su Linux.

### Prossimo blocco

**Fase 6C — qualità della previsione** (§6.3), a partire dal punto 10: pesare il daily e
l'hourly. È una modifica minima ma cambia i numeri mostrati, e ora esiste la suite che ne misura
l'effetto — che era esattamente il motivo per cui la 6B veniva prima.

---

> **Documenti correlati:** `PROJECT_STATUS_SUMMARY.md` (stato dichiarato),
> `AUDIT_API_DATA_SOURCES.md` (audit campi per fonte), `TODO_TESTING.md` (roadmap test),
> `VALUTAZIONI_TECNICHE.md` (decisioni pendenti), `EMAIL_NOTIFICATIONS_PLAN.md` (piano email),
> `WEATHERKIT_DATA_ANALYSIS.md` (residui WeatherKit).
