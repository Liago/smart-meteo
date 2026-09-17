# Changelog

Tutte le modifiche rilevanti di Smart Meteo, nel formato di
[Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

Il progetto segue il [versionamento semantico](https://semver.org/lang/it/):
`MAJOR.MINOR.PATCH`, con un numero di build monotono accanto — App Store
Connect rifiuta un archivio con una build già caricata, quindi la build non si
azzera mai, nemmeno quando cambia la versione.

La versione vive in `version.json` in radice ed è **una sola** per le tre
piattaforme: backend, web e iOS. Come si cambia: `docs/VERSIONING.md`.

## [Non rilasciato]

## [1.1.0] — 2026-09-17 (build 2)

Primo rilascio con un meccanismo di versioning: la versione dichiarata era
ferma a `1.0 (1)` da centoquattordici commit, cioè dall'inizio del progetto, e
copriva tutto quello che è elencato qui sotto.

### Aggiunto

- **Versioning unificato**: `version.json` in radice come sorgente di verità,
  `scripts/version.mjs` che la riversa su tre `package.json`, sul progetto
  Xcode e su due moduli TypeScript generati, e `npm run version:check` a
  guardia del disallineamento (gira nelle suite di backend e web).
- `GET /api/version` e i campi `version` / `build` su `GET /api/health`: dopo
  un rilascio si può distinguere il deploy andato a buon fine dalla funzione
  precedente ancora in caldo.
- La versione dell'app in fondo alla dashboard web.
- `AppInfo` su iOS (`Core/Config/AppInfo.swift`): versione e build lette dal
  bundle, da un punto solo invece che da due proprietà statiche di una
  schermata di impostazioni.

### Modificato

- La risposta di `GET /` distingue `api` (il contratto degli endpoint, `v1`)
  da `version` (la build che sta rispondendo): erano lo stesso campo.

### Contenuto del rilascio

Il lavoro accumulato sotto `1.0 (1)`, in ordine cronologico inverso:

- Dashboard web riorganizzata in un blocco a colpo d'occhio più quattro
  sezioni (Oggi, Settimana, Per te, Fonti), con la sezione aperta nell'hash
  dell'URL e le schede «Per te» ordinate per rilevanza invece che per ordine
  nel JSX.
- «Ieri» tolto dalla settimana su iOS, web e widget: quattro consumatori di
  `daily` sbagliavano in quattro modi diversi, compreso l'hero della dashboard
  che mostrava i valori del giorno prima nei numeri più grandi dello schermo.
- Unità di misura funzionanti su iOS (°C/°F, km/h · m/s · mph · nodi, mm/in),
  con le soglie di classificazione lasciate nelle unità canoniche.
- Ridisegno iOS: dashboard, schermate secondarie, accesso e impostazioni su un
  unico linguaggio, con le sette schede contestuali attivabili in «Per te».
- Parità iOS sulle funzioni prima solo web: fonti e indice di consenso,
  pollini, banda d'incertezza dell'ensemble, fotovoltaico, cielo, mare e
  indici per le attività.
- Allerte personali a soglia (backend + iOS), sette metriche con orizzonte
  scelto dall'utente.
- Nuovi blocchi della previsione: rischio temporali, quota neve e gelate,
  giardino e suolo, resa fotovoltaica, qualità del tramonto e osservazione
  del cielo, stato del mare, indici per le attività, nowcast minuto per minuto.
- Accuratezza delle fonti misurata sulle **osservazioni** invece che sul
  consenso, con MAE su finestra mobile di 30 giorni.
- Open-Meteo interrogato un modello alla volta: ICON-D2, ICON-EU, ECMWF IFS,
  Météo-France e GFS entrano nell'aggregazione come fonti indipendenti.

## [1.0.0] — build 1

Versione iniziale, mai incrementata: previsione aggregata da nove fonti,
dashboard web, app iOS nativa e allerte meteo.

[Non rilasciato]: https://github.com/Liago/smart-meteo/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Liago/smart-meteo/releases/tag/v1.1.0
