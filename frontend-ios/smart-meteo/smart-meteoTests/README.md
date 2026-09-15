# Test iOS

Prima suite automatica del progetto Swift. Chiude il punto 27 della
`docs/GAP_ANALYSIS_2026-09.md` per la parte che si può chiudere scrivendo codice.

## Serve un passaggio in Xcode, una volta sola

Questi file sono scritti ma **il progetto non ha ancora un target di test**, e
quel target non è stato aggiunto modificando `project.pbxproj` a mano di
proposito: significherebbe inventare UUID e coordinare otto sezioni di un plist
in un ambiente senza Xcode per verificarlo, e un errore rende il progetto non
apribile. In Xcode è invece un'operazione di trenta secondi che genera da sola
`TEST_HOST`, il bundle loader e lo schema.

1. **File › New › Target… › Unit Testing Bundle**
2. Nome: **`smart-meteoTests`** — deve coincidere con la cartella, così i file
   già scritti entrano nel target senza doverli aggiungere a uno a uno
   (il progetto usa i gruppi sincronizzati col file system)
3. *Target to be Tested*: **smart-meteo**
4. Se Xcode crea un file di esempio (`smart_meteoTests.swift` con un `@Test`
   di Swift Testing), **cancellalo**: qui si usa XCTest

Poi `⌘U`.

## Che cosa coprono

| File | Copre |
|------|-------|
| `ForecastDecodingTests` | Il contratto con il backend: tutte le chiavi snake_case |
| `HourlyWindowTests` | Su quale giorno si apre il dettaglio orario, e quali giorni entrano in «Prossimi giorni» |
| `SkyPanelViewTests` | Quale indice prende il titolo, gli ingredienti della notte |
| `SeaPanelViewTests` | Soglie dello stato del mare, avviso di peggioramento, rosa a 8 punti |
| `SolarPanelViewTests` | Potenza dell'impianto, resa specifica → kWh, assunzioni |
| `ActivitiesAndGardenTests` | Frasi degli indici lifestyle e motivo del consiglio sull'orto |
| `UnitsTests` | Conversioni °C/°F, km-h/m-s/mph/nodi, mm/pollici — e che **le soglie non seguano l'unità di lettura** |
| `TestSupport` | Decodifica da JSON e date relative a «oggi» |

## Due criteri, per chi aggiunge prove

**I modelli si costruiscono decodificando JSON**, non con l'inizializzatore di
membro, ogni volta che la prova riguarda il contratto col backend. È l'unico
modo di verificare le chiavi: una chiave snake_case sbagliata **compila
benissimo**, lascia il campo a nil e fa sparire un riquadro senza un errore.
È già successo — `solar`, `sky`, `sea` e `activities` arrivavano e venivano
buttati via.

**Le date si costruiscono da `dayKey(offsetDays:)`**, mai scritte a mano. Una
data fissa nel codice trasforma una prova in una bomba a tempo: la suite web
aveva esattamente questo problema e se n'è accorta quando è arrivata la data.

## Quello che questa suite *non* copre

Niente rendering: non ci sono snapshot test né UI test. Le prove sono sulle
funzioni pure — formattazione, soglie, scelta della frase — che è dove stanno le
decisioni. Una vista SwiftUI che non compila la trova il compilatore; una vista
che compila e mostra «40 cm» invece di «4 cm» la trova una prova come queste.
