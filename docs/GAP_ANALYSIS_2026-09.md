# Gap Analysis e Proposte — Settembre 2026

> **Data:** 2026-09-12
> **Scopo:** (1) verificare nel codice se tutto quanto stabilito nei documenti progettuali è
> stato effettivamente implementato; (2) individuare nuove implementazioni interessanti sulla base
> dei dati che le API a contratto offrono e che oggi non sfruttiamo.
> **Metodo:** lettura di tutti i 18 documenti in `docs/` + `CLAUDE.md` / `AGENTS.md` / `README.md`,
> e verifica puntuale nel codice (backend, frontend-web, frontend-ios, migrazioni).
> Ogni riga di questo documento è verificata sul codice, non copiata dagli stati dichiarati.
>
> **Stato avanzamento roadmap:** Fasi 6A ✅, 6B ✅, 6C ✅ completate · 6D 4 punti su 5 (il radar resta bloccato) · 6E 8 punti su 9 (resta solo l'audit, bloccato dall'ambiente).
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

### 3.3 Meteostat: osservazioni passate mescolate a previsioni future ✅ RISOLTO (6C)

`VALUTAZIONI_TECNICHE.md` §3 raccomandava l'**opzione B** (spostare Meteostat a ruolo di
validazione) da marzo. Il connettore restituisce l'ultima rilevazione oraria disponibile, che può
avere ore di ritardo, e quel valore entrava nella media pesata della temperatura *attuale*. Con
`hourly: []` e `daily: []` sempre vuoti, il contributo era solo sul `current` — dove fa più danno.

**Risolto:** peso 0, come Weatherstack, quindi lo stesso filtro già esistente la esclude senza
introdurre un secondo meccanismo. Meteostat è ora la verità osservata alternativa in
`services/observations.ts`, dove l'archivio ERA5 non ha dati.

### 3.4 `source_accuracy` misura la conformità, non l'accuratezza ✅ RISOLTO (6C)

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

**Risolto:** `services/observations.ts` porta la verità osservata (Open-Meteo Archive/ERA5,
gratuito e senza chiave, con Meteostat dove l'archivio non arriva); ogni confronto
previsione/osservato è una riga in `accuracy_samples`; il MAE viene **ricalcolato** sui soli
campioni degli ultimi 30 giorni invece di essere aggiornato in modo cumulativo; servono 20
campioni perché il MAE di una fonte muova il suo peso, e sotto quella soglia il peso resta
statico. La vecchia funzione incrementale è stata rimossa e i valori accumulati con la semantica
precedente azzerati: non sono confrontabili. `GET /api/accuracy` rende il tutto verificabile.

**Limite che resta, dichiarato:** `raw_forecasts` archivia i valori *correnti* di ogni fonte, non
le sue previsioni per orizzonte. Quello che si misura è quindi l'accuratezza del **nowcast** —
quanto la fonte azzecca la temperatura dell'ora in cui l'abbiamo interrogata. È un segnale reale
e un miglioramento netto sulla deviazione dal consenso, ma non copre il +24h: per quello serve
archiviare le previsioni per orizzonte, cioè una modifica di schema. Voce aperta in §6.5.

**Il ritardo dell'archivio** ERA5 (circa cinque giorni) fa sì che la verifica guardi a sei giorni
indietro e non a ieri: l'anello di retroazione è lento, ma misura l'errore vero invece di una
somiglianza fra previsioni.

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

**Asimmetria chiusa in 6E:** era **solo sul web** — iOS non mostrava nemmeno `sources_used`.
`SourcesIndicatorView.swift` porta ora su iOS le stesse etichette, l'indice di consenso e
l'intervallo fra la fonte più fredda e la più calda, con un `FlowLayout` perché SwiftUI non ne
ha uno nativo e nove fonti su una riga sola diventerebbero illeggibili.

### 3.6 AQI monofonte, senza previsione ✅ RISOLTO (6D)

`current.aqi` e `air_quality` venivano solo da WeatherAPI: nessuna aggregazione, nessun fallback
se quella fonte era giù, nessun andamento. Tutto il pannello `AirQualityPanel.tsx` dipendeva da
una singola chiamata.

**Risolto:** `connectors/openmeteoAirQuality.ts` aggiunge l'indice europeo e gli stessi
inquinanti da un'API gratuita e senza chiave. Le due fonti si fondono invece di escludersi, ma
WeatherAPI mantiene la precedenza su ogni inquinante — sono i valori mostrati da mesi, e le due
non usano la stessa unità per il monossido di carbonio. Con lo stesso connettore arrivano anche i
**pollini** (§5.1).

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

### 3.10 Residui di estrazione 🟢 PARZIALMENTE RISOLTO (6E)

- ✅ **WeatherKit `snowfallAmount` (daily) e `snowfallIntensity` (hourly)**: estratti in 6E, e
  con essi i centimetri di neve smettono di venire dai soli modelli Open-Meteo. Apple li dà in
  **millimetri di manto** — una lunghezza, non l'equivalente in acqua — quindi vanno divisi per
  dieci: senza, 40 mm sarebbero diventati «40 cm».
- ⏸️ **WeatherKit hourly `pressure`, `visibility`, `cloudCover`; daily `windSpeedMax`,
  `windGustSpeedMax`**: deliberatamente **non** estratti. Nessuna vista li consuma, e metterli
  sul filo ricreerebbe in un posto nuovo esattamente il problema che questa sezione denuncia —
  campi estratti e mai usati. Da fare insieme alla funzionalità che li richiede (una riga
  «giornata ventosa» nel 7 giorni, o pressione e visibilità nel registro metriche orarie).
- `windDirection` hourly era già estratto: la voce in questa lista era stale.
- ~~`precipitation_intensity` corrente: estratto da 5 connettori, mai aggregato né esposto.~~
  ✅ **Risolto (6A)**: aggregato con lo stesso gate sulla frazione bagnata dei mm previsti, così
  una fonte isolata non inventa pioggia in corso. Le due grandezze sono numericamente
  omogenee (mm/h di intensità e mm accumulati in un'ora), quindi le soglie NWS valgono per
  entrambe.
- Open-Meteo: `is_day`, `sunshine_duration`, `cloud_cover_low/mid/high` non richiesti.

### 3.11 Il daily e l'hourly ignorano i pesi delle fonti ✅ RISOLTO (6C)

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

**Risolto:** nuovo `backend/utils/aggregate.ts` con `weightedMean` e `weightedVote`, condivisi
dai tre livelli — sostituiscono tre implementazioni quasi identiche, una pesata e due no. Il
voto conserva la precedenza dei codici WMO numerici su quelli testuali: sommare pesi fra
vocabolari diversi non avrebbe senso, "61" e "rain" descrivono la stessa cosa ma non si
riconoscono fra loro. Schema di cache a 5, perché i valori cambiano. I tre test che
fotografavano il comportamento non pesato sono stati invertiti.

### 3.12 `POST /api/alerts/poll` è aperto senza `CRON_SECRET` ✅ RISOLTO (6C)

```ts
if (cronSecret && requestSecret !== cronSecret) {
    return res.status(403).json({ error: 'Unauthorized: invalid cron secret' });
}
```

Se `CRON_SECRET` non era configurato il controllo veniva saltato del tutto e chiunque poteva
innescare il polling — quindi le chiamate ai provider e **l'invio delle push**.

**Risolto:** l'endpoint risponde 503 quando la variabile manca. La scheduled function di Netlify
chiama `pollAlerts()` direttamente e non passa dall'endpoint HTTP, quindi il polling automatico
non è toccato.

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

#### 5.2 Quota neve, neve al suolo, gelate (Open-Meteo) ⭐ ✅ IMPLEMENTATA (6D)

Parametri aggiunti alla chiamata che **già facevamo**: `freezing_level_height`, `snow_depth`,
`snowfall` e `soil_temperature_0cm` (hourly), `snowfall_sum` (daily), più l'`elevation` del punto
di griglia — nessuna richiesta HTTP in più.

Per un'app usata su località alpine (i documenti stessi citano Bormio) la quota neve è
l'informazione più richiesta dell'inverno, e il rischio gelata notturna quella più richiesta a
marzo-aprile. Con `snow_depth` si mostra anche il manto attuale.

Implementata in `backend/utils/snow.ts` (blocco `snow` sulla risposta), `SnowPanel.tsx` e
`SnowPanelView.swift`. Le decisioni sono nel registro, §7 → Fase 6D punto 2.

**Resta aperto:** WeatherKit espone `snowfallAmount` daily e `snowfallIntensity` hourly (§3.10)
e renderebbe multi-fonte i centimetri di neve, oggi presi dai soli modelli Open-Meteo → 6E.

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

#### 5.6 Indici "lifestyle" ⭐ ✅ IMPLEMENTATA (6E) — **ma non come proposta qui**

La proposta era di comprarli: `GET /indices/v1/daily/1day/{locationKey}/{indexId}` di AccuWeather,
già nel piano free che usiamo, con decine di indici pronti (corsa, ciclismo, zanzare, lavaggio
auto, asma), più `fireIndex` e `roadRisk` di Tomorrow.io.

**Il conto non torna.** Su AccuWeather ogni indice è **una chiamata a sé**, il piano free dà 50
chiamate al giorno e `connectors/accuweather.ts` ne consuma già 3 per ogni cache miss (geoposition
+ current + daily + hourly, con la locationKey in cache un'ora): circa 16 previsioni servibili al
giorno. Tre indici le porterebbero a otto. Non è un limite che una cache più aggressiva aggira:
è un budget che non c'è.

Gli indici sono quindi **calcolati in casa**, da dati che aggreghiamo già — `backend/utils/activities.ts`,
`components/ActivitiesPanel.tsx`. Costo zero, nessuna dipendenza nuova, e in più si può dire
*perché* il punteggio è quello, cosa che un indice a scatola chiusa non permette. Le decisioni
sono nel registro, §7 → Fase 6E punto 8.

#### 5.7 Confronto con le normali climatiche (Meteostat + Open-Meteo Archive)

`GET /point/climate` (Meteostat, medie trentennali) e
`https://archive-api.open-meteo.com/v1/archive` (gratuito). Abilita frasi ad alto valore:
"3,2 °C sopra la media di settembre", "il settembre più piovoso degli ultimi 10 anni",
"ultima volta sotto zero: 12 marzo".

Sinergia importante: è **lo stesso dato osservato** che serve per §3.3 e §3.4. Un solo intervento
risolve il ruolo di Meteostat, dà accuratezza reale alle fonti e produce una feature visibile.

#### 5.8 Temporali: indici convettivi (Open-Meteo) ⭐ ✅ IMPLEMENTATA (6D)

`cape`, `lifted_index` e `convective_inhibition` da Open-Meteo, `chanceofthunder` da WWO — che
era già nella risposta e non veniva letto. Il rischio temporale si deduceva dal solo
`condition_code`, che è una fotografia («rovescio temporalesco») e non una misura: sotto la
stessa etichetta metteva il tuono isolato di fine pomeriggio e la supercella.

Implementata in `backend/utils/storm.ts` (indice 0-100) e come metrica «Temporali» del registry
orario, in `lib/metrics.ts` e `MetricScale.swift`. Le decisioni sono nel registro, §7 → Fase 6D
punto 3.

#### 5.9 Radiazione solare e resa fotovoltaica (Open-Meteo) ⭐ ✅ IMPLEMENTATA (6E)

`global_tilted_irradiance` (con `tilt` e `azimuth` come parametri **costanti** della query),
`shortwave_radiation` come ripiego e `sunshine_duration`, sullo stesso endpoint che già
interroghiamo. Il backend dà la resa **specifica** in kWh/kWp; la potenza dell'impianto la mette
l'utente nel client.

Implementata in `backend/utils/solar.ts` (blocco `solar`) e `SolarPanel.tsx`. Le decisioni sono
nel registro, §7 → Fase 6E punto 5. `direct_normal_irradiance` e `diffuse_radiation` non sono
stati richiesti: servirebbero solo per una trasposizione sul piano calcolata da noi, che è
esattamente ciò che Open-Meteo fa già con `global_tilted_irradiance`.

#### 5.10 Giardino e agricoltura (Open-Meteo) ⭐ ✅ IMPLEMENTATA (6E)

`soil_temperature_0_to_7cm`, `soil_moisture_0_to_7cm`, `et0_fao_evapotranspiration` e
`vapour_pressure_deficit`, sullo stesso endpoint che già interroghiamo. Prodotto: «devo
innaffiare?» e finestra di semina. Il rischio gelata tardiva era già coperto dal riquadro neve
(§5.2), che giudica sulla temperatura della superficie.

Implementata in `backend/utils/garden.ts` (blocco `garden`), `GardenPanel.tsx` e
`GardenPanelView.swift`. Le decisioni sono nel registro, §7 → Fase 6E punto 4.

#### 5.11 Mare (Open-Meteo Marine) ⭐ ✅ IMPLEMENTATA (6E)

`https://marine-api.open-meteo.com/v1/marine`: onde, mare lungo e temperatura dell'acqua.

**Il test sulla distanza dal mare non serve**: il modello d'onda copre solo i punti di griglia
sul mare, quindi nell'entroterra la chiamata fallisce o torna tutta nulla e il connettore
restituisce `null`. La fonte stessa è il criterio di costa, ed è più accurata di qualunque soglia
avremmo scelto noi.

**Le maree restano fuori**: WeatherAPI le espone su `marine.json`, che non è nel piano gratuito
che usiamo. Il pannello lo dichiara invece di lasciarlo intendere.

Implementata in `connectors/openmeteoMarine.ts`, `utils/sea.ts` (blocco `sea`) e `SeaPanel.tsx`.
Le decisioni sono nel registro, §7 → Fase 6E punto 7.

#### 5.12 Alba/tramonto "spettacolari" e cielo notturno ⭐ ✅ IMPLEMENTATA (6E)

`cloud_cover_low/mid/high` separati più la copertura totale oraria, dallo stesso endpoint
Open-Meteo, uniti all'illuminazione lunare che avevamo già in casa (§3.2).

Implementata in `backend/utils/sky.ts` (blocco `sky`) e `SkyPanel.tsx`. Le decisioni sono nel
registro, §7 → Fase 6E punto 6.

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

#### 5.15 Allerte su soglie personali ⭐ ✅ IMPLEMENTATA (6D)

Il sistema notificava solo le allerte **governative**, che scattano su criteri di protezione
civile: utili, ma non rispondono a «avvisami se stanotte gela», che è la domanda di chi ha un
orto o una moto.

Implementata in `backend/utils/alertRules.ts` (registro delle metriche + valutazione pura),
`backend/services/ruleProcessor.ts` (prenotazione e push), migrazione 024 e schermata
`AlertRulesView.swift`. Riusa per intero `alert_subscriptions`, APNs e il poller a 15 minuti.
Le decisioni sono nel registro, §7 → Fase 6D punto 4.

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

### 6.3 Fase 6C — Qualità della previsione ✅ **completata il 2026-09-12**

| # | Intervento | Chiude | Stato |
|---|-----------|--------|:-----:|
| 10 | **Pesare il daily e l'hourly**: `avgSimple` ignorava `SOURCE_WEIGHTS` | §3.11 | ✅ |
| 11 | Open-Meteo multi-modello (`&models=`) come fonti distinte | §5.13 | ✅ |
| 12 | `CRON_SECRET`: rifiutare quando manca invece di lasciar passare | §3.12 | ✅ |
| 13 | Meteostat / Open-Meteo Archive come ground truth, fuori dall'aggregazione | §3.3, §5.7 | ✅ |
| 14 | MAE reale con finestra 30 giorni, `GET /api/accuracy`, cron di ricalcolo | §3.4, §5.14 | ✅ |
| 15 | Ensemble Open-Meteo per i percentili 10/50/90 | §5.3.2 | ✅ |

Il punto 10 è andato per primo: una modifica minima, ma cambia i numeri mostrati, e senza di
essa i punti 13 e 14 affinerebbero pesi che poi non venivano applicati a daily e hourly.

I punti 13 e 14 vanno insieme: sono lo stesso intervento visto da due lati — togliere Meteostat
dalle previsioni e usarlo come verità osservata per misurare l'errore reale delle fonti.

### 6.4 Fase 6D — Nuove feature utente (**prossimo blocco**)

| # | Intervento | Chiude | Stato |
|---|-----------|--------|:-----:|
| 14 | Connettore Open-Meteo Air Quality: pollini + AQI multi-fonte | §3.6, §5.1 | ✅ |
| 15 | Quota neve, neve al suolo, rischio gelate | §5.2 | ✅ |
| 16 | Indice temporali (CAPE / lifted index) nel registry metriche | §5.8 | ✅ |
| 17 | Radar/mappa (RainViewer o tile OWM) | §3.9, §5.5 | ⏳ **bloccato in sviluppo** |
| 18 | Allerte su soglie personali | §5.15 | ✅ |

### 6.5 Fase 6E — Nicchie e rifiniture

| # | Intervento | Chiude | Stato |
|---|-----------|--------|:-----:|
| 19 | Residui WeatherKit sulla neve: `snowfallAmount`, `snowfallIntensity` | §3.10 | ✅ |
| 20 | Pannello fonti su iOS (consenso + pollini) | §3.5 | ✅ |
| 21 | Banda di incertezza sul grafico orario iOS | §5.3.2 | ✅ |
| 22 | Mare: onde e temperatura dell'acqua | §5.11 | ✅ |
| 23 | Radiazione solare e resa fotovoltaica | §5.9 | ✅ |
| 24 | Giardino e suolo: devo innaffiare? | §5.10 | ✅ |
| 25 | Indici lifestyle (calcolati in casa: il budget AccuWeather non regge) | §5.6 | ✅ |
| 26 | Alba/tramonto e cielo notturno | §5.12 | ✅ |
| 27 | Test iOS e audit Lighthouse | `VALUTAZIONI_TECNICHE` §2, §4 | ⏳ |

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

### Fase 6C — in corso (3 punti su 6 al 2026-09-12)

Commit `feat(6C): pesa daily e hourly, e chiude il polling senza segreto`,
`feat(6C): i modelli Open-Meteo entrano come fonti indipendenti`.

**Fatto**

1. **Daily e hourly pesati** (§3.11). `utils/aggregate.ts` con `weightedMean` e `weightedVote`
   sostituisce tre implementazioni quasi identiche. I pesi, e con essi il meccanismo di
   accuratezza dinamica, smettono di essere inerti su quasi tutto ciò che l'utente guarda.
2. **Modelli Open-Meteo come fonti indipendenti** (§5.13). Cinque modelli — ICON-D2, ICON-EU,
   ECMWF IFS, Météo-France, GFS — al posto della miscela `best_match`, che è una loro
   combinazione: affiancarli l'avrebbe contata due volte. Migrazione 022 per il vincolo di
   chiave esterna di `raw_forecasts`, registro dei modelli nel connettore da cui engine e route
   derivano pesi, fetcher e voci. `OPENMETEO_MODELS=off` torna al comportamento precedente.
3. **`/api/alerts/poll` chiuso** senza segreto configurato (§3.12): 503 invece di lasciar
   passare.

**Decisioni**

- **I modelli sostituiscono `best_match` invece di affiancarlo.** È la differenza fra aggiungere
  diversità statistica e contare due volte gli stessi dati.
- **Pesi dei modelli accanto ai modelli**, nel connettore, non in una seconda tabella
  nell'engine: `SOURCE_WEIGHTS`, `SOURCE_FETCHERS` e `/api/sources` li derivano da lì.
- **Modelli attivi per default**, reversibili con una variabile. Il costo è di cinque richieste
  HTTP in più per ogni cache miss su un piano da 10.000 al giorno; il beneficio è il punto §5.13
  di questa analisi.
- **Il daily e l'hourly sono stati pesati prima di toccare l'accuratezza**: misurare meglio i
  pesi non serve se poi i pesi non vengono applicati.

**Verifiche:** 267 test backend (13 suite), 137 web, 25 E2E × 2 viewport, typecheck pulito.

**Fatto anche** (2026-09-12, commit `feat(6C): accuratezza misurata sull'osservato, non sul
consenso`):

4. **Verità osservata e MAE reale** (§3.3, §3.4). Archivio ERA5 come fonte primaria, Meteostat
   dove non arriva; `accuracy_samples` con un campione per confronto; MAE ricalcolato sulla
   finestra di 30 giorni; soglia di 20 campioni prima che un MAE muova un peso;
   `GET /api/accuracy` pubblica e `POST /api/accuracy/recompute` protetta; scheduled function
   giornaliera alle 04:10 UTC.
5. **Meteostat a peso 0**, fuori dalle previsioni e dentro la verifica: chiude una voce aperta in
   `VALUTAZIONI_TECNICHE` §3 da marzo.

**Decisioni di questo secondo blocco**

- **ERA5 come verità primaria, non Meteostat**, al contrario di quanto ipotizzava il piano di
  marzo: è gratuito, senza chiave e copre ogni località, mentre Meteostat ha copertura
  disomogenea e una quota mensile. Meteostat resta come secondo tentativo.
- **Soglia di 20 campioni.** Un MAE calcolato su tre confronti è rumore: correggere un peso con
  quello è peggio che lasciarlo statico. L'endpoint distingue esplicitamente le fonti che pesano
  da quelle che stanno ancora accumulando.
- **Ricalcolo, non aggiornamento incrementale.** La vecchia media cumulativa non poteva
  dimenticare: rifare la media da zero sulla finestra è ciò che rende i pesi capaci di seguire
  una fonte che peggiora o migliora.
- **Peso 0 invece di una colonna `source_type`.** Il piano suggeriva di aggiungere un campo alla
  tabella `sources`; il peso a 0 ottiene lo stesso risultato con il filtro che già esisteva per
  Weatherstack, senza un secondo meccanismo da tenere allineato fra DB e registro in memoria.
- **I campioni vecchi sono stati azzerati** dalla migrazione: valori calcolati sulla conformità
  al consenso, se sopravvissuti, avrebbero continuato a spostare i pesi con la semantica
  sbagliata.

**Verifiche:** 304 test backend (15 suite), 137 web, 25 E2E × 2 viewport, typecheck pulito.

**Fatto infine** (commit `feat(6C): banda di incertezza dai membri dell'ensemble`):

6. **Banda di incertezza** (§5.3.2). ICON-EU-EPS, 40 membri, percentili 10/50/90 orari propagati
   sugli slot e disegnati sul grafico web. È la differenza fra dire «21 °C» e dire «fra 18 e
   24 °C, più probabilmente 21».

**Decisioni dell'ultimo blocco**

- **L'ensemble non è una fonte dell'aggregazione.** Non fornisce condizioni correnti né
  astronomia: viaggia a parte come `forecastNextHour`, e la sua assenza non cambia la previsione.
- **Percentili interpolati, non per indice arrotondato.** Su 40 membri il decimo percentile cade
  fra il quarto e il quinto valore.
- **Niente banda parziale.** O copre tutti i punti del grafico o non si disegna: un tratto
  interrotto suggerirebbe certezza nelle ore che l'ensemble non copre.
- **Membri riconosciuti per pattern**, non costruendo i nomi delle chiavi da un numero atteso:
  cambia da modello a modello.

### Riepilogo della Fase 6C

| Intervento | Effetto |
|-----------|---------|
| Daily e hourly pesati | I pesi smettono di essere inerti su quasi tutto ciò che l'utente guarda |
| 5 modelli Open-Meteo al posto di `best_match` | Da una fonte a cinque previsioni indipendenti, a costo zero |
| MAE sull'osservato con finestra di 30 giorni | I pesi dinamici misurano l'accuratezza, non la conformità al gruppo |
| Meteostat a verità osservata | Le osservazioni passate escono dalla media del presente |
| Banda di incertezza | L'incertezza diventa visibile invece che implicita |
| `/api/alerts/poll` e `/api/accuracy/recompute` chiusi | Nessun endpoint che innesca push o scritture resta aperto |

**Verifiche finali:** 326 test backend (16 suite), 137 web (7 suite), 27 scenari E2E × 2
viewport, typecheck pulito su entrambi i lati, lint web a 2 errori preesistenti.

### Fase 6D — in corso (4 punti su 5 al 2026-09-13)

#### 1. Qualità dell'aria a due fonti e pollini

Chiude §3.6 e §5.1. Commit `feat(6D): pollini e qualità dell'aria da Open-Meteo`.

Indice europeo e inquinanti da Open-Meteo accanto all'EPA di WeatherAPI, fusi invece che
alternativi; sei specie polliniche dal modello CAMS con etichette in italiano.

**Decisioni**

- **Soglie per specie, non una sola.** 30 granuli/m³ di graminacee sono una giornata pesante per
  chi è allergico, gli stessi 30 di olivo sono poca cosa: una soglia unica darebbe il livello
  sbagliato a metà delle specie.
- **Si mostra il massimo previsto in giornata**, non il valore dell'ora: chi è allergico decide
  la mattina se uscire, e il picco a mezzogiorno è l'informazione utile.
- **Fuori dall'Europa il blocco è omesso**, non mostrato a zero: uno zero direbbe «nessun
  polline» invece di «non lo sappiamo».
- **WeatherAPI mantiene la precedenza sugli inquinanti.** Sono i valori mostrati da mesi, e le
  due fonti non usano la stessa unità per il monossido di carbonio: mescolarle darebbe numeri
  incoerenti con lo storico.
- **Le specie a zero restano in lista.** L'assenza è un'informazione, e una lista che cambia
  lunghezza ogni giorno è più difficile da leggere.

**Verifiche:** 352 test backend (17 suite), 148 web (8 suite), 29 scenari E2E × 2 viewport.

#### 2. Quota neve, manto e rischio gelate

Chiude §5.2. Commit `feat(6D): quota neve, manto nevoso e rischio gelate`.

`freezing_level_height`, `snowfall`, `snow_depth` e `soil_temperature_0cm` sull'orario,
`snowfall_sum` sul giornaliero, più l'`elevation` del punto di griglia: tutti dalla chiamata
Open-Meteo che già facevamo, senza una richiesta HTTP in più. `backend/utils/snow.ts` ne ricava
un blocco `snow` sulla risposta; `SnowPanel.tsx` e `SnowPanelView.swift` lo mostrano su web e
iOS. Schema di cache alla versione 9.

**Decisioni**

- **La quota neve non è lo zero termico.** Il fiocco continua a scendere raffreddando l'aria
  attorno a sé e arriva 200-400 m più in basso dell'isoterma di 0 °C: si sottraggono 300 m,
  il valore convenzionale per precipitazione moderata.
- **Il numero da solo non serve: serve accanto alla quota della località.** «Zero termico a
  1500 m» è un dato da bollettino; «quota neve 900 m, sei a 1800 m» è una risposta. Open-Meteo
  dichiara l'`elevation` del punto di griglia insieme alla previsione, ed è quella che rende
  leggibile tutto il resto. I modelli non concordano sull'orografia della cella, quindi si media.
- **A ridosso della quota si dichiara la mista.** Entro 150 m dalla quota neve nessun modello
  risolve la differenza fra pioggia e neve: scegliere sarebbe fingere una certezza.
- **Senza precipitazioni la fase non viene calcolata.** Con cielo sereno la quota neve è un
  numero senza conseguenze.
- **Le gelate si giudicano sul suolo quando il dato c'è.** La brina si forma sulla superficie,
  non a due metri da terra, dove misurano le stazioni: `soil_temperature_0cm` ha le soglie
  fisiche (0 °C), i 2 metri quelle di compenso (+3 °C, perché nelle notti serene la superficie
  irraggia e resta 3-4 gradi sotto l'aria). Il blocco dichiara quale delle due ha usato, e i
  client lo scrivono: «minima al suolo -1°» e «minima -1°» descrivono due notti diverse.
- **Il manto non si somma, la neve fresca sì.** Il primo è uno stato del suolo, la seconda un
  accumulo orario: sommare 20 cm di manto per 24 ore darebbe 480 cm di neve a Milano.
- **Il riquadro compare solo quando c'è qualcosa da dire.** Niente manto, niente neve prevista,
  nessun rischio di gelata e pioggia normale → il backend omette il blocco. Senza questa regola
  sarebbe un riquadro vuoto per otto mesi l'anno.
- **La quota si formatta a mano, non con `toLocaleString('it-IT')`.** La regola italiana non
  raggruppa i numeri a quattro cifre (`minimumGroupingDigits: 2`): Node la rispetta, Chromium
  no, e la stessa quota diventava «1800 m» sul server e «1.800 m» nel browser — due test in
  disaccordo e un rischio di disallineamento in idratazione.

**Limite dichiarato:** i centimetri di neve vengono dai soli modelli Open-Meteo. WeatherKit
espone `snowfallAmount` e `snowfallIntensity` (§3.10) e li renderebbe multi-fonte come il resto:
resta in 6E.

**Verifiche:** 395 test backend (18 suite), 168 web (9 suite), 32 scenari E2E × 2 viewport,
typecheck pulito su backend e web, lint web ai soli 2 errori preesistenti.

#### 3. Indice temporali dagli indici convettivi

Chiude §5.8. Commit `feat(6D): indice temporali da CAPE e lifted index`.

`cape`, `lifted_index` e `convective_inhibition` sull'orario Open-Meteo, più `chanceofthunder`
da WorldWeatherOnline — che era già nella risposta e nessuno leggeva. `backend/utils/storm.ts`
ne ricava un indice 0-100, esposto come `storm_index` sugli slot orari; la nuova metrica
«Temporali» del registry lo mostra su web e iOS. Schema di cache alla versione 10.

**Decisioni**

- **Un indice, non il CAPE nudo.** «1800 J/kg» non dice niente a chi apre l'app: la scala 0-100
  con quattro fasce nominate sì. Il CAPE resta però scritto nella didascalia — chi sa leggerlo
  ha il numero, chi non lo sa ha la parola, e nessuno dei due deve fidarsi a scatola chiusa di
  un punteggio senza unità di misura.
- **CAPE e lifted index si mediano.** Misurano la stessa instabilità da due direzioni — energia
  integrata sulla colonna contro differenza di temperatura a 500 hPa — e la media smorza lo
  scarto di un singolo campo del modello senza appiattire il segnale. Con uno solo dei due si
  usa quello: non tutti i modelli espongono entrambi.
- **La CIN smorza ma non azzera.** L'inibizione convettiva è il coperchio: l'energia può esserci
  e restare inutilizzata. Ma il coperchio si rompe — riscaldamento pomeridiano, sollevamento
  orografico, un fronte che passa — e dichiarare «nessun rischio» su una giornata con 3000 J/kg
  inibiti sarebbe il tipo di previsione che fa male a chi va in montagna: lo smorzamento si
  ferma a 0.3.
- **Si usa il valore assoluto della CIN**: i modelli non concordano sul segno (per alcuni è
  un'energia che manca, quindi negativa), e senza il modulo metà delle fonti non verrebbe
  smorzata affatto.
- **L'indice si calcola una volta sola, sugli indici già mediati fra le fonti.** La funzione non
  è lineare, quindi mediare gli indici delle singole fonti darebbe un numero diverso: con CAPE 0
  e 4000 il primo ordine dà 65, il secondo 48. Mediare prima tiene il calcolo coerente con ogni
  altro campo aggregato, dove il consenso viene prima della derivazione.
- **La probabilità di tuono è una seconda sezione, non un ingrediente dell'indice.** Gli indici
  convettivi dicono quanta energia c'è, `chanceofthunder` quanto è probabile che si scarichi:
  sono due domande diverse, da fonti diverse, e mescolarle in un solo numero ne perderebbe una.
- **Senza indici la metrica lo dichiara** invece di disegnare barre a zero: uno zero direbbe
  «nessun temporale», la verità è «non lo sappiamo».

**Limite dichiarato:** il rischio è quello *termodinamico*. Manca la cinematica — wind shear,
storm relative helicity — che distingue il temporale isolato da quello organizzato. Open-Meteo
non espone quei campi sull'endpoint forecast, quindi non è un rinvio ma un limite del dato.

**Verifiche:** 419 test backend (19 suite), 181 web (10 suite), 34 scenari E2E × 2 viewport,
typecheck pulito su backend e web, lint web ai soli 2 errori preesistenti.

#### 4. Allerte su soglie personali

Chiude §5.15. Commit `feat(6D): allerte su soglie personali`.

Sette metriche — minima, massima, raffiche, pioggia, neve, rischio temporali, AQI europeo — su
cui l'utente pone una soglia e un orizzonte. Migrazione **024** (`alert_rules`,
`alert_rule_hits`), quattro endpoint sotto `/api/alerts/rules`, valutazione agganciata al poller
esistente, schermata «Avvisi personali» su iOS. Schema di cache alla versione 11.

**Decisioni**

- **Le soglie si valutano sulla previsione aggregata**, la stessa che l'app mostra. Valutarle su
  una fonte grezza produrrebbe notifiche che annunciano 12 mm mentre lo schermo ne mostra 3:
  nessuna delle due sarebbe sbagliata, sarebbero due fonti diverse — il che è peggio.
- **La soglia è nell'unità che l'utente scrive.** «50 km/h» si confronta in km/h, non nei m/s del
  contratto interno: il registro converte in lettura. Senza, una soglia di 50 km/h non sarebbe
  mai scattata.
- **I millimetri si sommano, non si massimizzano.** «Se domani piove più di 10 mm» è un totale:
  con il massimo orario, dieci ore da 9 mm non farebbero scattare niente. La somma non ha però
  un'ora responsabile, e il messaggio non ne inventa una.
- **La regola è legata al device, non alla subscription.** `/alerts/subscribe` riscrive la riga
  a ogni spostamento significativo del telefono e ripulisce le registrazioni residue: con una FK
  CASCADE le regole sparirebbero con esse. È lo stesso incidente che la migrazione 021 ha
  risolto per la deduplica.
- **La firma di deduplica è `regola + giorno dello scatto`.** Il poller gira ogni 15 minuti:
  senza, quattro notifiche l'ora; con una firma legata al solo id della regola, la gelata di
  stanotte zittirebbe quella di domani.
- **Tabella separata da `weather_alerts`.** Là il cooldown è per severity: mettendoci anche
  queste, una regola sull'AQI silenzierebbe per sei ore quella sulle gelate.
- **Prenotazione prima della push**, come per le allerte governative, e *fail-closed*: se la
  riga di deduplica non si scrive la notifica non parte. Una mancata è meglio di quattro l'ora.
- **Un campo assente non vale come soglia non superata.** «Non lo sappiamo» non è «va tutto
  bene», ma nemmeno un allarme: la regola semplicemente non scatta.
- **Un token scaduto disabilita le regole, non le cancella**: se l'app viene reinstallata sullo
  stesso telefono l'utente ritrova le sue soglie.
- **La risposta espone ora `utc_offset_seconds`.** Le chiavi di `hourly` sono in ora locale
  della località: il poller le confrontava con l'ora UTC e, a ovest di Greenwich, scartava ore
  future — alle 14 UTC in California sono le 6 del mattino, e la gelata delle 6 spariva.

**Limite dichiarato:** la feature è **solo iOS**. Le regole sono legate a un device token APNs,
e il web non ha notifiche push: darebbe una schermata che configura avvisi che non arriverebbero
mai. Portarla sul web richiede la decisione ancora aperta su Web Push (§6.6).

**Verifiche:** 475 test backend (22 suite), 181 web (10 suite), 34 scenari E2E × 2 viewport,
typecheck pulito su backend e web, lint web ai soli 2 errori preesistenti.

### Punto 17 — radar: bloccato, non rinviato

Il radar (§5.5) **non è stato implementato**, e la ragione è verificabile: la policy di rete
dell'ambiente di sviluppo nega l'accesso a `api.rainviewer.com`, `tilecache.rainviewer.com`,
`tile.openweathermap.org` e `tile.openstreetmap.org` — tutti e quattro rispondono con un
rifiuto del proxy. Non è quindi possibile né verificare il contratto dell'API RainViewer contro
cui si scriverebbe il connettore, né vedere se una tile arriva a schermo.

Scriverlo comunque significherebbe consegnare un connettore costruito su una forma di risposta
ricordata a memoria e «testato» solo contro fixture inventate: la parte non verificabile è
esattamente quella che decide se sullo schermo compare qualcosa. Il punto resta aperto con
questa motivazione, non silenziosamente saltato.

**Come sbloccarlo:** una sessione con quegli host raggiungibili, oppure il contratto reale di
`weather-maps.json` incollato a mano. Il resto del lavoro (matematica delle tile, animazione dei
frame, UI) è indipendente dalla rete e si può fare comunque, una volta fissato il contratto.

### Fase 6E — in corso (8 punti su 9 al 2026-09-13)

Commit `feat(6E): neve WeatherKit, pannello fonti e banda di incertezza su iOS`.

Il blocco chiude i **tre debiti dichiarati** nelle fasi precedenti, invece di aprire feature
nuove: due asimmetrie fra i client e un limite sui dati.

#### 19. Neve multi-fonte da WeatherKit

Chiude la parte sulla neve di §3.10, e con essa il limite dichiarato ieri al punto 15: i
centimetri venivano dai soli modelli Open-Meteo.

- **Apple dà la neve in millimetri di manto**, non in centimetri e non in equivalente in acqua:
  `snowfallAmount` e `snowfallIntensity` sono lunghezze. Senza la divisione per dieci, 40 mm
  sarebbero comparsi come «40 cm» — un ordine di grandezza su un numero che serve a decidere se
  mettere le catene. C'è un test che fissa proprio questa conversione.
- **Un campo assente resta `null`, non zero.** Uno zero direbbe «non nevica», e WeatherKit
  diluirebbe con il suo peso 1.2 la neve prevista dagli altri modelli.
- **Le due funzioni di fetch sono state unificate.** `fetchFromWeatherKit` e
  `fetchFromWeatherKitWithAlerts` contenevano due blocchi di estrazione copiati, già divergenti
  sull'arrotondamento della velocità del vento: un campo aggiunto a uno solo sarebbe comparso o
  sparito a seconda di quale l'engine avesse chiamato. Ora c'è `buildWeatherKitForecast`, e un
  test verifica che le due strade producano lo stesso forecast.

#### 20. Pannello fonti su iOS

Chiude §3.5, dichiarato aperto dalla Fase 6A. iOS non mostrava nemmeno `sources_used`, e
l'indice di consenso — l'informazione più distintiva che possiede un aggregatore — arrivava già
nel modello Swift senza che nessuna vista lo leggesse. Aggiunto anche il pannello pollini, che
era nella stessa condizione.

- **`FlowLayout` scritto a mano**: SwiftUI non ha un flow layout nativo, un `HStack` con nove
  fonti le comprimerebbe fino a renderle illeggibili e una `LazyVGrid` a colonne fisse
  sprecherebbe spazio, perché «GFS» e «World Weather Online» hanno lunghezze molto diverse.
- **L'intervallo di temperatura si mostra solo oltre 1 °C di scarto**: mezzo grado non è
  disaccordo, è arrotondamento, e scriverlo suggerirebbe un'incertezza che non c'è.

#### 21. Banda di incertezza su iOS

Chiude l'asimmetria dichiarata nella Fase 6C. Il modello Swift non aveva nemmeno i campi:
`temp_p10`/`temp_p90` sono stati aggiunti insieme alla resa.

- **I marker di alba e tramonto cadono fra due ore piene** e non hanno percentili propri: la
  banda si spezzerebbe proprio lì. Si interpolano, con la stessa logica che il grafico già usava
  per la temperatura di quei marker.
- **La scala verticale comprende i percentili.** È lo stesso errore che il web aveva fatto: senza,
  la banda esce dal grafico proprio nelle ore in cui è più larga, cioè quelle che giustificano
  il disegnarla.
- **La banda si ferma dove finisce il dato.** L'ensemble copre meno ore della previsione, e
  chiudere il poligono oltre il buco disegnerebbe una banda dove non c'è alcun dato.
- **Il bordo inferiore continua il poligono invece di aprirne uno nuovo.** `Path.addPath` porta
  con sé il proprio `move(to:)`: usandolo, il riempimento avrebbe reso due schegge aperte invece
  di una banda. Serve una funzione che aggiunga la curva al tracciato in corso.

**Limite dichiarato:** le tre voci iOS non sono compilate né testate — non esiste una toolchain
Swift in questo ambiente, e il progetto non ha ancora test iOS (punto 27). La verifica si è
fermata al controllo statico: nessun `switch` esaustivo rotto, nessun sito di costruzione
lasciato indietro, parentesi bilanciate, idiomi coerenti con il deployment target del progetto.

**Verifiche:** 478 test backend (22 suite), 181 web (10 suite), 34 scenari E2E × 2 viewport,
typecheck pulito su backend e web, lint web ai soli 2 errori preesistenti.

#### 4. Orto e giardino: devo innaffiare?

Chiude §5.10. Commit `feat(6E): orto e giardino, devo innaffiare?`.

Quattro campi agronomici dalla chiamata Open-Meteo che già facevamo. Il blocco `garden` risponde
a una domanda che il meteo normale non copre: non «che tempo fa» ma «devo prendere
l'annaffiatoio stasera». Schema di cache alla versione 12.

**Decisioni**

- **La pioggia ha la precedenza su tutto.** Se nelle 24 ore arrivano almeno 5 mm il consiglio è
  «non innaffiare», anche su terreno molto secco — ed è proprio il caso in cui un utente
  sbaglierebbe da solo, perché guarda la terra asciutta e prende l'annaffiatoio senza sapere che
  fra tre ore arriva un temporale.
- **Il consiglio mostra sempre il proprio motivo.** «Il terreno perde 4,8 mm più di quanti ne
  riceve» si può contestare; un consiglio nudo è un oracolo, e nessuno si fida di un oracolo
  sull'orto.
- **Le soglie di umidità dipendono dal tipo di suolo, e l'API non lo dichiara.** La capacità di
  campo di una sabbia sta intorno a 0.15 m³/m³, quella di un'argilla arriva a 0.40: le soglie
  usate sono quelle di un terreno franco, il più diffuso negli orti, e per questo accanto al
  giudizio compare **sempre il numero grezzo** — chi conosce il proprio terreno può correggere.
  Mostrato come percentuale di volume: «25% vol.» lo capisce chiunque, «0,25 m³/m³» quasi nessuno.
- **Due temperature del suolo, non una.** `soil_temperature_0cm` è la superficie, dove si forma
  la brina (§5.2); `soil_temperature_0_to_7cm` è lo strato delle radici, che decide se un seme
  germina. Due domande diverse e due campi diversi.
- **La temperatura di semina è una media sulla finestra**, non il minimo né il picco: un seme non
  reagisce all'ora più fredda della notte, ma nemmeno a quella più calda del pomeriggio.
- **L'umidità è uno stato, l'evapotraspirazione un accumulo.** La prima si legge adesso, la
  seconda si somma: sommando 24 ore di 0.25 m³/m³ si otterrebbe 6, che non è un'umidità.
- **Senza evapotraspirazione non si calcola il bilancio.** Sarebbe la pioggia col segno meno, che
  non dice niente sul consumo del terreno.
- **`weightedMean` ha guadagnato una precisione configurabile.** Arrotondava sempre a un
  decimale: sull'umidità volumetrica, che vive fra 0 e 1, 0.25 sarebbe diventato 0.3 e 0.06
  sarebbe diventato 0.1 — cioè da «molto secco» ad «asciutto».
- **Questo riquadro non si omette quando è tutto tranquillo**, a differenza di quello sulla neve.
  Non è un'incoerenza: il riquadro neve sarebbe stato *vuoto* — niente manto, niente nevicata,
  nessuna gelata — per otto mesi l'anno, mentre «non serve innaffiare» è una risposta piena, ed è
  quella che chi ha un orto va a cercare la sera.

**Verifiche:** 504 test backend (23 suite), 196 web (11 suite), 37 scenari E2E × 2 viewport,
typecheck pulito su backend e web, lint web ai soli 2 errori preesistenti. Un fallimento isolato
su `search.spec.ts` non si è ripresentato né in isolamento né alla riesecuzione completa: flake,
non regressione.

**Limite dichiarato:** come le tre voci precedenti, `GardenPanelView.swift` non è compilata né
testata — manca la toolchain Swift e mancano i test iOS (punto 27).

#### 5. Radiazione solare e resa fotovoltaica

Chiude §5.9. Commit `feat(6E): radiazione solare e resa fotovoltaica`.

In Italia il fotovoltaico domestico è diffusissimo, e chi ce l'ha non chiede «c'è il sole» ma
«quanto produco domani». Schema di cache alla versione 13.

**Decisioni**

- **Il backend calcola la resa specifica, non i kWh.** kWh per kWp è la grandezza fisica,
  indipendente dalla taglia dell'impianto; moltiplicarla per i kWp dell'utente è una
  moltiplicazione e sta nel client. Se la potenza entrasse nel backend, la risposta smetterebbe
  di essere la stessa per tutti quelli sulla stessa località e la cache a 30 minuti — condivisa —
  si frammenterebbe per utente. La potenza vive in `localStorage` e non tocca mai il server.
- **Inclinazione e orientamento sono costanti della query, non preferenze.** Per lo stesso motivo:
  con il tetto di ciascuno, la chiamata a Open-Meteo diventerebbe diversa per ogni utente. Trenta
  gradi esposti a sud sono l'impianto domestico tipico italiano, lo scarto su un tetto diverso è
  di pochi punti percentuali, e la cache condivisa vale di più.
- **La trasposizione sul piano la fa Open-Meteo, non noi.** `global_tilted_irradiance` è la
  radiazione sul piano dei pannelli già calcolata dalla fonte: ricavarla da DNI e DHI con un
  modello di trasposizione scritto qui sarebbe codice di astronomia che non possiamo validare
  contro dati reali, e un errore resterebbe silenzioso.
- **C'è un ripiego esplicito sul piano orizzontale.** Se Open-Meteo cambiasse il nome del campo o
  rifiutasse i parametri del piano, la stima degraderebbe invece di sparire — e il piano
  effettivamente ricevuto viaggia fino all'utente, perché su orizzontale un impianto inclinato
  produce di più d'inverno e tacerlo renderebbe la stima ingannevole invece che approssimata.
- **Le assunzioni sono sempre scritte a schermo**: inclinazione e perdite di impianto. Chi ha un
  impianto sa la propria inclinazione e ha diritto di sapere quale abbiamo supposto noi; un
  numero di kWh senza di esse non è verificabile da nessuno.
- **Un giorno con meno di 22 ore di dati non viene riportato.** La giornata in corso è già
  cominciata: darne il totale sarebbe una sottostima travestita da previsione.
- **`useSyncExternalStore` invece di `useEffect`.** `localStorage` è uno store esterno al React
  tree: leggerlo in un effetto e riversarlo in `setState` è il pattern che React sconsiglia (e
  che il lint del progetto segnala già in due punti); così non si disallinea nemmeno
  l'idratazione, perché sul server lo store risponde `null`.

**Ritrovamento:** il test che verifica i parametri della query ha scoperto che `tilt` e `azimuth`
non venivano inviati affatto — una sostituzione sul file non aveva agganciato per via
dell'indentazione. Senza quel test, `global_tilted_irradiance` sarebbe silenziosamente tornato
orizzontale, con una stima sbagliata di circa il 15% e nessun sintomo visibile.

**Chiuso su iOS il 2026-09-14** (`SolarPanelView.swift`, potenza in `@AppStorage`).
**Limite dichiarato all'epoca:** solo backend e web. La versione iOS richiede un campo per la potenza
dell'impianto nelle impostazioni, e aggiungere una quinta schermata Swift non verificata sopra le
quattro già scritte è la cosa che ho segnalato di non voler fare prima di un passaggio su
simulatore.

**Verifiche:** 524 test backend (24 suite), 214 web (12 suite), 40 scenari E2E × 2 viewport,
typecheck pulito su backend e web, lint web ai soli 2 errori preesistenti.

#### 6. Tramonti spettacolari e cielo notturno

Chiude §5.12. Commit `feat(6E): tramonti spettacolari e cielo notturno`.

Due indici che nascono dalla stessa intuizione: **la copertura nuvolosa totale non basta, conta
la quota**. Schema di cache alla versione 14.

**Decisioni**

- **Il tramonto è un prodotto di due fattori, non una somma.** La *tela* sono le nuvole alte che
  possono accendersi — massimo a metà copertura, zero sia col cielo terso (non c'è niente da
  illuminare) sia con la volta chiusa; la *luce* è quanto l'orizzonte è libero. Con una somma, un
  cielo perfettamente sereno prenderebbe comunque metà punteggio per il solo fatto di non avere
  nuvole basse, e verrebbe annunciato come mezzo spettacolo.
- **Le nuvole basse pesano più delle medie** nel bloccare la luce: stanno fra il sole e chi guarda
  all'orizzonte e spengono la scena, mentre le medie la attenuano soltanto.
- **La luna penalizza l'osservazione ma non l'azzera.** Con la luna piena si vedono benissimo
  pianeti, luna stessa e stelle luminose: sono gli oggetti deboli a sparire. Il fattore 0.6 lascia
  un cielo terso con luna piena intorno al 40, cioè «discreta», che è la verità.
- **La copertura totale, quando manca, si ricava dal massimo delle quote e non dalla somma**: tre
  strati al 40% non fanno un cielo coperto al 120%.
- **La notte si prende con un OR, non con un intervallo.** È a cavallo della mezzanotte: con un
  `22 <= ora <= 3` non resterebbe nessuna ora.
- **Il riquadro cielo si compone dopo la riconciliazione dei dati lunari fra le fonti**, non
  durante l'aggregazione oraria: l'illuminazione della luna è uno dei due ingredienti e spesso
  arriva da una fonte diversa da quella astronomica principale.
- **In cima va l'indice più alto fra il solare e la notte.** Il pannello ha una riga sola di
  titolo: con un titolo fisso sul tramonto, una notte eccezionale sotto un tramonto ordinario
  resterebbe invisibile — ed è proprio il caso che fa aprire il pannello.
- **Il giudizio sulla notte mostra i suoi due ingredienti** (nuvole e luna): un verdetto senza il
  perché è un verdetto senza appello.

**Ritrovamento, e non era un flake.** Il test E2E «da ospite il salvataggio nei preferiti è
disabilitato» era fallito due volte a intermittenza. Guardandolo: il pulsante è
`disabled={!coords}` — dipende dall'avere una località, **non dall'essere autenticati** — e gli
ospiti possono salvare nei preferiti per progetto dichiarato (localStorage, con sincronizzazione
su Supabase al login). Il test asseriva quindi un comportamento che il prodotto non ha mai avuto,
e passava solo vincendo la corsa con l'effetto che legge la località di casa da localStorage.
Sostituito con due test che verificano il comportamento reale: il pulsante è inerte senza
località, e un ospite salva regolarmente in locale. La suite completa gira ora verde due volte di
fila.

**Chiuso su iOS il 2026-09-14** (`SkyPanelView.swift`).
**Limite dichiarato all'epoca:** solo backend e web, come le due voci precedenti.

**Nota di prodotto:** la dashboard ha ora nove riquadri (allerte, nowcast, corrente, sole e vento,
narrativa, AQI, pollini, neve, orto, fotovoltaico, cielo, fonti). Sono tutti utili a qualcuno e
quasi nessuno a tutti: prima di aggiungerne altri conviene decidere come raggrupparli — sezioni
richiudibili, o una scelta di quali mostrare.

**Verifiche:** 549 test backend (25 suite), 231 web (13 suite), 44 scenari E2E × 2 viewport,
typecheck pulito su backend e web, lint web ai soli 2 errori preesistenti.

#### 7. Mare: onde e temperatura dell'acqua

Chiude §5.11. Commit `feat(6E): mare, onde e temperatura dell'acqua`.

La domanda di chi va al mare è doppia e concreta: quanto è fredda l'acqua e quanto è mosso.
Schema di cache alla versione 15.

**Decisioni**

- **Il criterio di costa è la fonte stessa.** Il modello d'onda copre solo i punti di griglia sul
  mare: nell'entroterra l'endpoint risponde con un errore, o con serie tutte nulle, e in entrambi
  i casi il connettore restituisce `null`. Niente dataset di coste, niente soglia sulla distanza
  dal mare — e il risultato è più accurato di qualunque soglia avremmo scelto.
- **Il criterio è il dato, non il codice HTTP.** Alcuni punti interni rispondono 200 con le serie
  a null: senza il controllo sull'altezza d'onda comparirebbe un riquadro «mare calmo, 0 m» in
  mezzo alla pianura, che è peggio di nessun riquadro.
- **L'altezza d'onda diventa una parola.** «1,3 m» sembra poco scritto così, ed è il mare che
  rovescia un pedalò: si usano i termini dei bollettini italiani (calmo, poco mosso, mosso, molto
  mosso), che chi va al mare riconosce. Sopra il «molto mosso» le distinzioni della scala Douglas
  riguardano la navigazione, non chi sceglie se fare il bagno.
- **Onda e temperatura sono stati, non medie**: si leggono adesso. Il massimo atteso viaggia a
  parte, perché è l'informazione che fa cambiare programma — il mare adesso è calmo, nel
  pomeriggio no.
- **L'avviso di peggioramento compare solo se cambia la fascia.** Se il picco resta nello stesso
  stato il numero è già nella riga dell'onda, e ripeterlo come avviso sarebbe un falso allarme.
- **La provenienza dell'onda usa otto punti, non sedici**: fra NNE e NE non cambia niente per chi
  sceglie una spiaggia, e allunga solo l'etichetta.
- **Le maree si dichiarano assenti.** Sono su `marine.json` di WeatherAPI, fuori dal piano
  gratuito: scriverlo nel pannello è meglio che lasciare all'utente il dubbio di non averle
  trovate.

**Verifiche:** 567 test backend (27 suite), 246 web (14 suite), 47 scenari E2E × 2 viewport,
typecheck pulito su backend e web, lint web ai soli 2 errori preesistenti.

**Chiuso su iOS il 2026-09-14** (`SeaPanelView.swift`).
**Limite dichiarato all'epoca:** solo backend e web, come le tre voci precedenti. E il connettore è scritto
contro una forma di risposta non verificabile da qui — `marine-api.open-meteo.com` è negato dalla
rete dell'ambiente, come tutti gli host Open-Meteo. A differenza del radar, però, il rischio è
contenuto: la famiglia di API Open-Meteo ha una forma uniforme (`hourly: { time: [], <param>: [] }`)
già dimostrata da tre connettori in questo repo, e ciò che si sta ricordando sono i **nomi dei
parametri**, non la struttura. Il connettore è scritto per degradare: qualunque serie assente
diventa `null` e il riquadro sparisce, invece di mostrare un mare inventato.

#### 8. Indici lifestyle: «buona giornata per…»

Chiude §5.6. Commit `feat(6E): indici lifestyle, buona giornata per…`.

Corsa, bici e bucato: un punteggio 0-100 sulla prossima finestra diurna, con il fattore che lo
tiene basso. Schema di cache alla versione 16.

**Decisioni**

- **Calcolati, non comprati.** È la decisione che riscrive la proposta §5.6, e nasce da
  un'aritmetica: AccuWeather free dà 50 chiamate al giorno, `connectors/accuweather.ts` ne spende
  già 3 per cache miss (~16 previsioni servibili al giorno) e ogni indice è una chiamata in più.
  Tre indici avrebbero dimezzato le previsioni servibili per aggiungere tre numeri. I dati che
  servono — temperatura percepita, pioggia, vento, UV, umidità, AQI europeo — li aggreghiamo già
  tutti.
- **Il punteggio è il MINIMO dei fattori, non la media.** Una giornata perfetta sotto il diluvio
  non è mezza buona: la media darebbe 60 e nasconderebbe proprio il fattore per cui si rinuncia.
- **Accanto al numero c'è il perché.** «65» non dice niente, «65, limita il vento» dice se
  rimandare o cambiare percorso. È l'unica cosa che un indice a scatola chiusa non può dare, ed è
  il motivo per cui calcolarli in casa non è solo un ripiego sul budget.
- **Il fattore limitante si nomina solo sotto 80.** Sopra, niente limita davvero, e scriverlo
  suggerirebbe un problema che non c'è.
- **Probabilità e vento si prendono al massimo, i millimetri si sommano.** Un'ora al 90% in mezzo
  a undici serene è comunque un'uscita da rimandare; i millimetri invece bagnano per quantità
  totale.
- **La finestra è quella di un solo giorno.** Di sera scivola a domani — «buona giornata per
  correre» alle 23 significa domani — ma non mescola mai oggi pomeriggio con domani mattina: un
  punteggio così non varrebbe per nessuno dei due. Il giorno valutato viaggia nella risposta e il
  pannello lo dichiara.
- **Le soglie del vento in bici sono metà di quelle a piedi** (12/30 km/h contro 20/45): a 25 km/h
  si corre, in bici si soffre.
- **Il vento del bucato è l'unico fattore invertito**, e vive in una funzione a sé invece che in un
  parametro di `windScore`: un segno meno nascosto dentro una soglia si legge male a mesi di
  distanza.

**Due errori miei, trovati dai miei stessi test**

- `dryAirScore` era `100 - umidità`: al 50% di umidità — aria perfettamente normale, in cui il
  bucato asciuga benissimo — dava 50, e qualunque giornata ordinaria sarebbe sembrata mediocre.
  Sostituita con una curva a soglie (piena fino al 65%, zero al 95%).
- Il pavimento di `dryingWindScore` era 40: con aria ferma il vento risultava **il fattore
  limitante** di una giornata di sole asciutta e tiepida, cioè un avviso su un problema che non
  c'è. Il vento è un bonus, non un requisito: pavimento alzato a 80, e aggiunta
  `dryingTempScore`, senza la quale il registro avrebbe detto «stendi pure» a 3 °C.

**Verifiche:** 588 test backend (28 suite), 255 web (15 suite), 50 scenari E2E × 2 viewport,
typecheck pulito su backend e web, lint web ai soli 2 errori preesistenti.

**Chiuso su iOS il 2026-09-14** (`ActivitiesPanelView.swift`).
**Limite dichiarato all'epoca:** solo backend e web, come le quattro voci precedenti. E i pesi delle soglie
sono scelte ragionevoli, non tarate su dati: nessuno ha misurato a che temperatura la gente
smette davvero di correre. Sono però tutte costanti esportate e testate, quindi tarabili quando
un dato ci sarà.

### Audit Lighthouse: ancora bloccato

Riverificato in questa sessione: `next build` fallisce perché `next/font` non riesce a scaricare
Figtree da `fonts.googleapis.com`, che la policy di rete dell'ambiente nega. Senza build di
produzione non c'è nulla su cui far girare Lighthouse. In sviluppo l'app funziona (Next ripiega
sul font di sistema), quindi gli E2E girano lo stesso: è solo la build a essere impedita.

### Prossimo blocco

**Le feature della 6E sono finite.** Restano due voci, e nessuna delle due è una feature:

**Fase 6E, punto 27 — test iOS e audit Lighthouse.** L'audit è impossibile da qui (vedi sopra),
non rinviato. I test iOS non esistono e non possono nascere in questo ambiente: non c'è toolchain
Swift.
**Fase 6D, punto 17 — radar**: bloccato, quando l'ambiente lo consente.

**Il debito iOS è chiuso** (2026-09-14). Due correzioni a quel conto, perché era sbagliato: le
feature indietro erano **quattro**, non cinque — l'orto era già su iOS, `GardenPanelView` era
scritta e cablata, e averla contata fra i debiti era un errore di questo documento. E le
schermate «mai compilate» ora lo sono: il primo giro su Xcode ha trovato quattro errori da due
chiavi `CodingKeys` orfane, corretti, e da lì il progetto compila.

Chiuse le quattro: `SolarPanelView`, `SkyPanelView`, `SeaPanelView`, `ActivitiesPanelView`, più i
modelli Swift che ora decodificano `solar`, `sky`, `sea` e `activities` — prima non li portavano
affatto. La potenza dell'impianto fotovoltaico vive in `@AppStorage`, l'equivalente del
`localStorage` del web: non tocca il backend, per la stessa ragione.

**Nota di prodotto:** la dashboard web è arrivata a una dozzina di riquadri. Prima di
aggiungerne altri serve un raggruppamento — oggi neve, orto, fotovoltaico, cielo, mare e indici
stanno tutti sullo stesso piano, e nessuno di essi interessa a tutti gli utenti tutti i giorni.

---

> **Documenti correlati:** `PROJECT_STATUS_SUMMARY.md` (stato dichiarato),
> `AUDIT_API_DATA_SOURCES.md` (audit campi per fonte), `TODO_TESTING.md` (roadmap test),
> `VALUTAZIONI_TECNICHE.md` (decisioni pendenti), `EMAIL_NOTIFICATIONS_PLAN.md` (piano email),
> `WEATHERKIT_DATA_ANALYSIS.md` (residui WeatherKit).
