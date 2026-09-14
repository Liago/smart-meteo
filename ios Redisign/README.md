# Handoff: ridisegno iOS di Smart Meteo

## Overview

Ridisegno della dashboard iOS di `Liago/smart-meteo` (branch `main`, sorgenti in `frontend-ios/smart-meteo/smart-meteo/UI/`).

Il problema di partenza: `DashboardView.swift` impila tredici pannelli nello stesso ordine fisso — allerte, nowcast, neve, meteo corrente, orario, orto, fotovoltaico, cielo, mare, attività, pollini, giorni, fonti — tutti con lo stesso peso visivo. Non c'è gerarchia, i pannelli contestuali sono sepolti a metà dello scroll e non si capisce a colpo d'occhio che tempo fa.

La proposta riorganizza la stessa informazione in: **hero della condizione** (colore pastello derivato dal meteo) + **quattro sezioni collassabili** — Ora per ora, Prossimi giorni, Per te, Fonti dati. Tutti i pannelli contestuali (neve, orto, fotovoltaico, cielo, attività, pollini, mare) diventano schede dentro «Per te», accese e spente dall'utente nelle impostazioni, e si espandono al tap mostrando le righe di dettaglio del pannello originale.

Due direzioni visive, stessa struttura:
- **1a «Foglio»** — hero grande a tinta piena, temperatura in serif, il resto in un unico foglio bianco.
- **1b «Bento»** — hero compatta più tessere pastello (prossima ora, vento, UV, alba/tramonto), poi le stesse sezioni.

## About the Design Files

I file in questo bundle sono **riferimenti di design realizzati in HTML**: prototipi che mostrano aspetto e comportamento voluti, non codice da portare in produzione. Il lavoro è **ricreare questi design nell'app iOS esistente in SwiftUI**, usando i pattern già presenti nel repo (`GlassContainer`, `WeatherIcon`, `AppColors`, `MetricScale`, `HapticManager`, i modelli in `Models/Forecast.swift` e lo stato in `Core/State/AppState.swift`). Nessun asset HTML/CSS va trasferito.

I prototipi girano in un runtime React/HTML: apri `Smart Meteo — Ridisegno iOS.dc.html` in un browser per vedere le tre opzioni affiancate.

## Fidelity

**High-fidelity.** Colori, tipografia, spaziature, raggi, ombre e testi sono definitivi e vanno riprodotti fedelmente, adattando la tipografia al sistema (vedi «Design Tokens»). Le interazioni (espansione sezioni, scrubbing, apertura schede) sono implementate nei prototipi e vanno replicate con animazioni SwiftUI equivalenti.

Il terzo telefono (`Smart Meteo Attuale.dc.html`) è la **ricostruzione dello stato attuale**, inclusa come riferimento di confronto: non va implementata.

## Screens / Views

Tutte le schermate sono progettate su un viewport iPhone di **402×874 pt** (iPhone 16/16 Pro), contenuto sotto la safe area (54 pt di padding top nei prototipi).

### 1. Dashboard (home)

**Purpose** — rispondere in un colpo d'occhio a «che tempo fa adesso», poi dare accesso progressivo a orario, giorni, schede contestuali e metadati sulle fonti.

**Layout** — `ScrollView` verticale, `VStack` con spacing 14 pt, padding bottom 40 pt. Sfondo pieno = colore `page` del tema condizione.

1. **Header** — `HStack` spacing 10, padding orizzontale 20.
   - Bottone ricerca: 40×40, corner radius 14, fill `rgba(255,255,255,0.75)`, lente 17 pt, ombra `0 1 2 rgba(0,0,0,0.05)`. Apre la schermata Località.
   - Centro (flessibile): riga con glifo casa 11 pt + nome località, Manrope ExtraBold 15 pt / tracking −0.01em, colore `heroInk`; sotto, sottotitolo 11 pt medium a opacità 0.5: «aggiornato 2 min fa · 5 fonti».
   - Bottone impostazioni: identico al primo, glifo ingranaggio.
2. **Banner allerte** (solo se `activeAlerts` non vuoto) — padding 11×14, corner radius 16, fill `#F6D9CE`; quadratino 26×26 radius 9 fill `#C2543A` con «!» bianco ExtraBold 14; testo Bold 12.5/1.35 colore `#7A2E19`; chevron 7×12. Apre Allerte.
3. **Hero** — vedi sotto, diverso per variante.
4. **Pillole condizione** (solo prototipo, non spedire) — anteprima di come cambia la tinta: Sereno / Nuvoloso / Pioggia. In app la condizione arriva da `forecast.current`.
5. **Foglio sezioni** — `VStack` in un contenitore bianco: margin orizzontale 16, corner radius 28, fill `#FFFFFF`, ombra `0 2 14 rgba(40,28,20,0.06)`, `clipped()`. Quattro sezioni separate da divider 1 pt `rgba(42,38,34,0.07)` con inset 20.

**Hero — variante 1a «Foglio»**
- Margin orizzontale 16, corner radius 30, padding 22/22/18, fill `hero` del tema, `clipped()`.
- Glifo condizione decorativo 150 pt, ancorato top-trailing con offset (−18, −14), colore `#F0B47E` sul tema sereno (accento del tema sugli altri).
- Etichetta «ADESSO»: Manrope Medium 12, tracking 0.14em, uppercase, `heroInk` a opacità 0.65.
- Temperatura: **Instrument Serif Regular 92 pt**, line-height 0.9, tracking −0.03em, colore `heroInk` (il simbolo ° fa parte della stringa).
- Narrativa: Instrument Serif 21/1.25, max 250 pt di larghezza, es. «Sole pieno tutto il giorno, brezza da nord-ovest.»
- Tre metriche in `HStack` spacing 18: etichetta Medium 10.5 uppercase tracking 0.08em opacità 0.55 + valore Bold 15 — Percepita 26°, Max/Min 30°/8°, Pioggia 0%.

**Hero — variante 1b «Bento»**
- Griglia a 2 colonne, gap 10, margin orizzontale 16.
- Tessera hero su due colonne: corner radius 26, padding 18/20, fill `hero`; a sinistra «ADESSO» 11 uppercase + temperatura Instrument Serif 66/0.92 + riga Bold 12.5 «Percepita 26° · Max 30° Min 8°»; a destra glifo condizione 74 pt.
- Quattro tessere: corner radius 22, padding 14, min-height 96, gap 6 interno. Etichetta SemiBold 10.5 uppercase tracking 0.09em colore `rgba(30,30,40,0.5)`; valore Bold 24 tracking −0.02em colore `#26262E`; nota Medium 11.5 opacità 0.55.
  - Prossima ora — «Asciutto» / «Pioggia» · «nowcast al minuto» · fill `#E6EEF6`
  - Vento — «12 km/h» · «raffiche 20 · NW» · fill `#EAEEE6`
  - UV — «6» · «alto fino alle 15» · fill `#FBEED2`
  - Alba · tramonto — «18:10» · «alba 06:45» · fill `#F1E7F1`

**Sezione «Ora per ora»**
- Header: `HStack` padding 18/20, titolo Instrument Serif 22 colore `#2A2622`, riepilogo SemiBold 11.5 opacità 0.45 («max 28° · min 15°»), chevron 12×8 ruotato di 180° quando aperta.
- Corpo: valore selezionato — temperatura ExtraBold 30 tracking −0.03em, ora Bold 13 colore accento, dettaglio Medium 11.5 opacità 0.5 («pioggia 0% · vento 12 km/h»).
- Grafico 118 pt: curva quadratica morbida, stroke accento 2.5, riempimento a gradiente accento 0.22 → 0, linea guida tratteggiata (3 3) all'ora selezionata, pallino 6 pt bianco con bordo accento 3, etichette orarie ogni 3 ore SemiBold 10 opacità 0.45. **Trascinabile** (scrubbing).
- Bottone «Apri dettaglio orario»: padding 9/14, capsule, fill `#F6EFE8`, testo Bold 11.5 colore `#7A4B32`.

**Sezione «Prossimi giorni»** — righe da 7 pt di padding verticale: nome giorno Bold 13 (34 pt), glifo 20 pt (22 pt), probabilità pioggia SemiBold 11 colore `#4A7FB5` (34 pt), min Medium 12.5 opacità 0.45 (24 pt allineata a destra), barra escursione termica altezza 7 radius 4 su traccia `rgba(42,38,34,0.08)` con gradiente `#A9CBE8 → #F2D9A4 → #E8A183` posizionata sulla scala −5…40 °C, max Bold 12.5 (26 pt).

**Sezione «Per te»** — griglia 2 colonne gap 10 di schede contestuali attive; riepilogo nell'header = «N schede». In fondo, bottone tratteggiato «Personalizza sezioni» (border dashed 1 pt `rgba(42,38,34,0.25)`, testo Bold 11.5 opacità 0.6) che apre le Impostazioni.

Scheda chiusa: corner radius 20, padding 13, fill proprio, tag SemiBold 10 uppercase tracking 0.1em nel colore del tag, chevron a destra, headline Bold 13.5/1.3 colore `#2A2622`, dettaglio Medium 11/1.35 opacità 0.58.

Scheda aperta (al tap): occupa **due colonne**, ombra `0 8 22 rgba(40,28,20,0.13)`, chevron ruotato 180°, e sotto un divider 1 pt `rgba(42,38,34,0.1)` compaiono le righe di dettaglio (label Medium 11.5 opacità 0.55 · hint Medium 10.5 opacità 0.4 · valore Bold 11.5 tabular) più la nota metodologica Medium 10/1.4 opacità 0.42.

Schede e contenuti (tutti presi dai pannelli SwiftUI esistenti):

| key | Tag | fill | colore tag | Headline | Righe |
| --- | --- | --- | --- | --- | --- |
| neve | Neve | `#E3EDF7` | `#3D6FA8` | Neve in quota, circa 6 cm | Quota neve 1800 m (sei a 122 m) · Alla tua quota Pioggia · Neve prevista 6 cm (24 h) · Gelate Brina possibile (min. al suolo 2°) |
| orto | Orto | `#E4F0E3` | `#2F7D43` | Non serve innaffiare | Terreno Umidità adeguata (28% vol.) · Evaporazione 3,4 mm · Pioggia attesa 4,2 mm · Semina Suolo a 14° |
| solare | Solare | `#FBEED2` | `#9A6A1E` | 5,8 kWh stimati oggi | Oggi 5,42 kWh/kWp (9 h sole) · Domani 4,55 · Venerdì 2,49 |
| cielo | Cielo | `#E4E6F4` | `#4C5C93` | Tramonto spettacolare | Tramonto Spettacolare (18:10) · Stelle stanotte Buona (cielo terso) · Luna 35% calante |
| attivita | Attività | `#DFEFEF` | `#2F7D7D` | Corsa ideale 18–20 | Corsa 82 · Bici 64 (limita vento) · Bucato 38 (limita umidità) |
| pollini | Pollini | `#F6E3D6` | `#A2603C` | Graminacee moderate | Graminacee Moderato (max 38) · Olivo Basso (max 6,4) · Ambrosia Assente |
| mare | Mare | `#DCECF2` | `#2E6E8E` | Mare poco mosso | Acqua 24° · Onda 0,62 m (da SO) · Mare lungo 0,40 m |

Default attive: neve, orto, solare, cielo, attività. Spente: pollini, mare. Le schede vanno mostrate solo quando il backend manda il blocco corrispondente, come oggi.

**Sezione «Fonti dati»** (chiusa per default) — riepilogo header «6 attive · 88/100» SemiBold 11.5 colore `#2F7D43`. Corpo: badge consenso (corner radius 16, fill `#EDF4EE`, padding 12/14) con pallino 8 pt `#22C55E`, «Fonti concordi» Bold 13, punteggio Medium 12.5 opacità 0.5, e sotto «Temperatura prevista fra 23° e 26°» Medium 11/1.4 opacità 0.55. Poi chip a capo automatico: padding 6/11, capsule, fill `#F5F1EC`, pallino 7 pt col colore fonte di `SourceStyle`, nome SemiBold 11.5 opacità 0.78. Chiude la nota «Il punteggio misura quanto le fonti sono d'accordo sulla stessa previsione.»

### 2. Dettaglio orario

Header con back (38×38, radius 13, fill `rgba(255,255,255,0.8)`) + titolo Instrument Serif 26. Strip giorni scorrevole: pill padding 8/13 radius 14, Bold 12; selezionata fill `hero` del tema e testo `heroInk`, le altre fill bianco e testo opacità 0.5. Card bianca (margin 16, radius 26, padding 20, ombra `0 2 14 rgba(40,28,20,0.06)`): temperatura ExtraBold 40, ora Bold 13 accento + dettaglio Medium 11 opacità 0.5; grafico 170 pt **con banda di incertezza ensemble** (fill accento a opacità 0.1) e scrubbing; griglia 2×2 di metriche (radius 16, fill `#FAF7F3`, padding 12; label SemiBold 10 uppercase tracking 0.1em opacità 0.45, valore Bold 17): Temperatura, Probabilità pioggia, Vento, Umidità. Nota di chiusura Medium 11 opacità 0.45.

### 3. Località (ricerca)

Header back + «Località». Campo: margin 16, padding 13/16, radius 18, fill bianco, ombra `0 2 10 rgba(40,28,20,0.05)`, lente 16 pt opacità 0.4, placeholder SemiBold 14 opacità 0.35 «Cerca città o CAP», caret 2×18 colore accento. Etichetta «PREFERITI» SemiBold 10.5 uppercase tracking 0.12em opacità 0.45. Righe preferiti: padding 14/16, radius 20, fill bianco; glifo condizione 22 pt, nome Bold 14 + badge «CASA» Bold 9 uppercase colore accento, nota Medium 11.5 opacità 0.5, temperatura ExtraBold 20. Elenco: Milano (Casa, 24°), Bergamo (21°), Genova (19°), Bormio (6°).

### 4. Impostazioni

Header back + «Impostazioni». Card «SEZIONE "PER TE"» (radius 24, fill bianco, padding 18): una riga per scheda con nome Bold 13.5, nota Medium 11 opacità 0.5, affordance «TRASCINA» Medium 10 opacità 0.3 (riordino) e toggle 42×26 (traccia accento quando on, `rgba(42,38,34,0.15)` quando off; pomello 20 pt bianco, ombra `0 1 3 rgba(0,0,0,0.2)`, animazione 0.18 s). Separatore 1 pt `rgba(42,38,34,0.06)`.

Card «GENERALI»: Unità con segmented °C/°F (contenitore radius 11 fill `#F3EEE8`, pill attiva bianca radius 9), Notifiche allerte (toggle on), Regole personali → «3 attive» con chevron.

### 5. Allerte

Header back + «Allerte». Card per allerta: radius 22, fill bianco, ombra `0 2 12 rgba(40,28,20,0.05)`, barra superiore 5 pt nel colore severità; dentro padding 16: badge severità (padding 4/9, radius 8, fill tint, testo ExtraBold 9.5 uppercase tracking 0.1em nel colore severità), titolo Bold 14/1.25, corpo Medium 12/1.45 opacità 0.6, finestra temporale SemiBold 10.5 uppercase tracking 0.06em opacità 0.38.

Severità: Gialla `#C98A15` su tint `#FBEED2`; Arancione `#C2543A` su tint `#F6D9CE`; regola personale `#2F7D7D` su tint `#DFEFEF`.

## Interactions & Behavior

- **Sezioni collassabili** — tap sull'header apre/chiude; chevron ruota di 180°. In SwiftUI: `withAnimation(.spring(response: 0.35, dampingFraction: 0.85))`.
- **Schede «Per te»** — tap: la scheda passa a due colonne, guadagna ombra e rivela il dettaglio. Nel prototipo: `max-height 0 → 280px` in 0.38 s `cubic-bezier(0.2,0.8,0.2,1)` e opacità 0 → 1 in 0.28 s. In SwiftUI equivale a `.spring(response: 0.38, dampingFraction: 0.82)` su un `VStack` condizionale + `matchedGeometryEffect` per il passaggio a due colonne. Una scheda aperta per volta.
- **Scrubbing orario** — drag orizzontale su grafico e sparkline: l'indice si aggancia all'ora più vicina (`DragGesture` + `HapticManager.selection()` al cambio di ora). L'hit area copre tutta l'altezza del grafico.
- **Pull to refresh** — `.refreshable` come oggi, con `HapticManager.medium()`.
- **Navigazione** — lente → Località; ingranaggio → Impostazioni; banner → Allerte; «Apri dettaglio orario» → Dettaglio orario; back in alto a sinistra su ogni schermata secondaria.
- **Toggle schede** — cambio immediato; il riepilogo «N schede» si aggiorna e la scheda appare/scompare dalla griglia.
- **Colore per condizione** — cambiando condizione cambiano sfondo pagina, hero, inchiostro, accento e glifo: transizione consigliata 0.4 s ease-in-out sui colori.

## State Management

Stato locale della dashboard (il resto resta in `AppState`):

- `condition: WeatherCondition` — derivata da `forecast.current`, seleziona il tema.
- `openSections: Set<Section>` — default `[.hourly, .daily, .forYou]`; `.sources` chiusa.
- `openCard: CardKey?` — una scheda aperta per volta, `nil` = tutte chiuse.
- `enabledCards: [CardKey: Bool]` — persistita (`@AppStorage`, come già fa `SolarPanelView` con `smart-meteo-pv-kwp`); default neve/orto/solare/cielo/attività on, pollini/mare off.
- `cardOrder: [CardKey]` — ordine personalizzabile dall'utente (riordino nelle impostazioni).
- `scrubIndex: Int` — ora selezionata, condivisa fra sparkline home e dettaglio orario.
- `selectedDay: Int` — giorno attivo nel dettaglio orario.
- `screen` — gestito con `NavigationStack` e `.sheet` come oggi.

Dati: nessun nuovo endpoint. Tutte le schede leggono i blocchi già presenti in `ForecastResponse` (`snow`, `garden`, `solar`, `sky`, `sea`, `activities`, `pollen`, `forecastNextHour`, `sourcesUsed`, `confidence`).

## Design Tokens

**Temi per condizione** (page / hero / ink / accent)

| Condizione | page | hero | ink | accent |
| --- | --- | --- | --- | --- |
| Sereno | `#FDF7F0` | `#FBDFBE` | `#4A2D1C` | `#E2704F` |
| Nuvoloso | `#F5F5F8` | `#DFE3EC` | `#2E3440` | `#5E7191` |
| Pioggia | `#F1F5FA` | `#D5E4F3` | `#1F3040` | `#4A7FB5` |

Evoluzione della palette attuale: il corallo `rgb(236,104,90)` → `#E2704F`, il crema `rgb(252,249,246)` → `#FDF7F0`. Da estendere con Neve (`#EFF4F8` / `#E2EDF4`) e Temporale (`#F4F2F8` / `#E2DCEF`) mantenendo la stessa logica.

**Neutri** — inchiostro `#2A2622`; testo secondario `rgba(42,38,34,0.55)`; terziario `rgba(42,38,34,0.42)`; hairline `rgba(42,38,34,0.07)`; superficie `#FFFFFF`; superficie interna `#FAF7F3`; chip `#F5F1EC`.

**Semantici** — verde `#22C55E` / `#2F7D43`; giallo `#C98A15`; arancio-rosso `#C2543A`; blu dato `#4A7FB5`. Colori delle fonti: riusare `SourceStyle.colors` esistente.

**Tipografia** — display Instrument Serif Regular (92 / 66 / 26 / 22 / 21); UI Manrope 400–800 (30 · 24 · 17 · 15 · 14 · 13.5 · 12.5 · 11.5 · 11 · 10.5 · 10). In app: sostituire con la coppia disponibile — New York (`.serif`) per il display e SF Pro per la UI — mantenendo pesi, dimensioni e tracking; oppure imbarcare i due font. I numeri usano cifre tabellari.

**Spaziature** — 4 · 6 · 7 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 40. Margine di pagina 16–20.

**Raggi** — 8 · 9 · 11 · 13 · 14 · 16 · 18 · 20 · 22 · 26 · 28 · 30 · capsule.

**Ombre** — controlli `0 1 2 rgba(0,0,0,0.05)`; card `0 2 12–14 rgba(40,28,20,0.05–0.06)`; scheda aperta `0 8 22 rgba(40,28,20,0.13)`.

**Animazioni** — 0.18 s toggle · 0.28 s opacità · 0.3 s chevron/scala · 0.38 s espansione con `cubic-bezier(0.2,0.8,0.2,1)` · 0.4 s cambio colori.

## Assets

Nessun asset binario nuovo. Nei prototipi le icone meteo sono **segnaposto geometrici** (cerchi e rettangoli) disegnati in SVG: in app vanno usati gli SF Symbols con i colori palette già definiti in `UI/DesignSystem/WeatherIcon.swift` (sole arancione, nuvola grigio 0.45, gocce blu, neve azzurro, fulmine giallo). Stessa cosa per lente, ingranaggio, casa, chevron, allerta, foglia, luna, onde, corsa: SF Symbols, non ridisegnare.

Il bezel iPhone dei prototipi (`ios-frame.jsx`) è solo scaffolding di presentazione.

## Screenshots

In `screenshots/` (2x, 804×1748 salvo dove indicato):

| File | Cosa mostra |
| --- | --- |
| `01-dashboard-foglio.png` | Dashboard, variante 1a «Foglio» |
| `02-per-te-scheda-aperta.png` | Griglia «Per te» con la scheda Orto espansa su due colonne (660×838) |
| `03-dettaglio-orario.png` | Dettaglio orario con banda di incertezza e metriche |
| `04-localita.png` | Ricerca località e preferiti |
| `05-impostazioni.png` | Impostazioni: toggle e riordino delle schede «Per te» |
| `06-allerte.png` | Allerte, tre livelli di severità |
| `07-dashboard-bento.png` | Dashboard, variante 1b «Bento» |
| `08-stato-attuale.png` | Ricostruzione dello stato attuale (riferimento, non da implementare) |

## Files

- `Smart Meteo — Ridisegno iOS.dc.html` — pagina di confronto con le tre opzioni (1a, 1b, 1c) e le note di direzione. **Apri questo per primo.**
- `Meteo Phone.dc.html` — il prototipo navigabile completo (tutte e cinque le schermate); prop `variant` = `sheet` (1a) o `grid` (1b).
- `Smart Meteo Attuale.dc.html` — ricostruzione fedele della dashboard odierna, solo come riferimento.
- `ios-frame.jsx`, `support.js` — scaffolding del prototipo (cornice dispositivo e runtime).

Sorgenti da cui è stato ricostruito lo stato attuale, utili come punto di partenza per l'implementazione: `UI/Features/Dashboard/DashboardView.swift`, `CurrentWeatherView.swift`, `HourlyForecastView.swift`, `DailyForecastView.swift`, `AlertBannerView.swift`, `NextHourPrecipitationView.swift`, `SnowPanelView.swift`, `GardenPanelView.swift`, `SolarPanelView.swift`, `SkyPanelView.swift`, `SeaPanelView.swift`, `ActivitiesPanelView.swift`, `PollenPanelView.swift`, `SourcesIndicatorView.swift`, `UI/DesignSystem/{AppColors,WeatherIcon,PrecipitationScale,MetricScale}.swift`, `UI/Common/GlassContainer.swift`.
