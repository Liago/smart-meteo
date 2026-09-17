import SwiftUI

/// Le schede della sezione «Per te».
///
/// È il cuore del ridisegno. Prima ognuno di questi blocchi era un pannello a
/// tutta larghezza nello scroll, con lo stesso peso visivo della previsione:
/// chi non ha un orto si è trovato il pannello orto ogni sera per sempre, e chi
/// non è sulla costa non ha mai visto quello del mare ma ha pagato lo spazio di
/// tutti gli altri.
///
/// Qui diventano **tessere che l'utente accende**. La regola resta doppia: una
/// scheda compare solo se l'utente la vuole *e* se il backend manda il blocco —
/// il mare continua a sparire nell'entroterra, la neve d'estate, i pollini
/// fuori dall'Europa, esattamente come prima.
///
/// Il testo non viene reinventato: headline, frasi e formattazioni sono le
/// stesse funzioni dei pannelli originali. Due schermate che descrivono lo
/// stesso dato con due parole diverse sono peggio di una schermata sola.

// MARK: - Chiavi

enum ForYouKey: String, CaseIterable, Identifiable, Codable {
    case snow
    case garden
    case solar
    case sky
    case moon
    case activities
    case pollen
    case sea

    var id: String { rawValue }

    /// L'etichetta in alto nella scheda, maiuscoletto.
    var tag: String {
        switch self {
        case .snow: return "Neve"
        case .garden: return "Orto"
        case .solar: return "Solare"
        case .sky: return "Cielo"
        case .moon: return "Luna"
        case .activities: return "Attività"
        case .pollen: return "Pollini"
        case .sea: return "Mare"
        }
    }

    /// A che domanda risponde: si legge nelle impostazioni, sotto il nome.
    var blurb: String {
        switch self {
        case .snow: return "Quota neve, manto e gelate"
        case .garden: return "Devo innaffiare? Posso seminare?"
        case .solar: return "Quanto produce l'impianto"
        case .sky: return "Tramonti e cielo notturno"
        case .moon: return "Fase, sorgere e tramonto"
        case .activities: return "Corsa, bici, bucato"
        case .pollen: return "Specie e picco giornaliero"
        case .sea: return "Acqua, onda e mare lungo"
        }
    }

    var fill: Color {
        switch self {
        case .snow: return Color(hex: "E3EDF7")
        case .garden: return Color(hex: "E4F0E3")
        case .solar: return Color(hex: "FBEED2")
        case .sky: return Color(hex: "E4E6F4")
        case .moon: return Color(hex: "ECEAF0")
        case .activities: return Color(hex: "DFEFEF")
        case .pollen: return Color(hex: "F6E3D6")
        case .sea: return Color(hex: "DCECF2")
        }
    }

    var tagColor: Color {
        switch self {
        case .snow: return Color(hex: "3D6FA8")
        case .garden: return Color(hex: "2F7D43")
        case .solar: return Color(hex: "9A6A1E")
        case .sky: return Color(hex: "4C5C93")
        case .moon: return Color(hex: "5B5670")
        case .activities: return Color(hex: "2F7D7D")
        case .pollen: return Color(hex: "A2603C")
        case .sea: return Color(hex: "2E6E8E")
        }
    }

    /// Accese di default. Mare e pollini no: il mare riguarda chi è in costa,
    /// i pollini chi è allergico — accenderli per tutti rimetterebbe in piedi
    /// il problema che questa sezione risolve.
    var onByDefault: Bool {
        switch self {
        case .pollen, .sea: return false
        default: return true
        }
    }
}

// MARK: - Contenuto

struct ForYouRow: Identifiable {
    var id: String { label }
    let label: String
    /// Il numero grezzo accanto al giudizio, quando il giudizio da solo
    /// nasconderebbe qualcosa (l'umidità del suolo, per dirne una).
    let hint: String?
    let value: String
}

struct ForYouCard: Identifiable {
    let key: ForYouKey
    var id: String { key.rawValue }
    /// La riga che si legge a scheda chiusa.
    let headline: String
    /// Il perché, subito sotto.
    let detail: String
    /// Le righe che compaiono al tap.
    let rows: [ForYouRow]
    /// La nota metodologica in fondo, quando c'è qualcosa da dichiarare.
    let note: String?
}

// MARK: - Costruzione dalle risposte del backend

enum ForYouBuilder {

    /// Le schede da mostrare: accese dall'utente, nell'ordine scelto, e solo
    /// quelle per cui il backend ha davvero mandato il blocco.
    static func cards(
        forecast: ForecastResponse,
        order: [ForYouKey],
        enabled: Set<ForYouKey>,
        plantKwp: Double?
    ) -> [ForYouCard] {
        order.compactMap { key in
            guard enabled.contains(key) else { return nil }
            return card(key, forecast: forecast, plantKwp: plantKwp)
        }
    }

    static func card(_ key: ForYouKey, forecast: ForecastResponse, plantKwp: Double?) -> ForYouCard? {
        switch key {
        case .snow: return forecast.snow.map(snowCard)
        case .garden: return forecast.garden.map(gardenCard)
        case .solar: return forecast.solar.flatMap { solarCard($0, plantKwp: plantKwp) }
        case .sky: return forecast.sky.flatMap(skyCard)
        case .moon: return moonCard(forecast.astronomy)
        case .activities: return forecast.activities.flatMap(activitiesCard)
        case .pollen: return forecast.pollen.flatMap(pollenCard)
        case .sea: return forecast.sea.map(seaCard)
        }
    }

    // MARK: Neve

    private static func snowCard(_ snow: SnowOutlook) -> ForYouCard {
        var rows: [ForYouRow] = []

        if let line = snow.snowLine {
            rows.append(ForYouRow(
                label: "Quota neve",
                hint: snow.elevation.map { "sei a \(SnowPanelView.formatAltitude($0))" },
                value: SnowPanelView.formatAltitude(line)
            ))
        }
        if let phase = snow.phase {
            rows.append(ForYouRow(
                label: "Alla tua quota",
                hint: nil,
                value: SnowPanelView.phaseLabels[phase] ?? phase
            ))
        }
        if let fresh = snow.snowfallCm, fresh > 0 {
            rows.append(ForYouRow(label: "Neve prevista", hint: "24 ore", value: SnowPanelView.formatCm(fresh)))
        }
        if let depth = snow.snowDepthCm, depth >= 1 {
            rows.append(ForYouRow(label: "Manto al suolo", hint: nil, value: SnowPanelView.formatCm(depth)))
        }
        if snow.frost.level != "none" {
            rows.append(ForYouRow(
                label: "Gelate",
                hint: SnowPanelView.frostMinimum(snow),
                value: SnowPanelView.frostLabels[snow.frost.level] ?? snow.frost.level
            ))
        }

        return ForYouCard(
            key: .snow,
            headline: SnowPanelView.headline(snow),
            detail: SnowPanelView.frostSentence(snow) ?? "La quota neve si legge accanto alla tua",
            rows: rows,
            // La differenza fra i due numeri è il motivo per cui mostriamo il
            // primo e non il secondo.
            note: "La quota neve sta 300 m sotto lo zero termico: il fiocco continua a scendere mentre si scioglie."
        )
    }

    // MARK: Orto

    private static func gardenCard(_ garden: GardenOutlook) -> ForYouCard {
        var rows: [ForYouRow] = []

        if let level = garden.moistureLevel {
            rows.append(ForYouRow(
                label: "Terreno",
                hint: GardenPanelView.formatMoisture(garden.soilMoisture),
                value: GardenPanelView.moistureLabels[level] ?? level
            ))
        }
        if let et0 = garden.evapotranspirationMm {
            rows.append(ForYouRow(label: "Evaporazione", hint: "24 ore", value: GardenPanelView.formatMm(et0)))
        }
        if let rain = garden.rainMm, rain > 0 {
            rows.append(ForYouRow(label: "Pioggia attesa", hint: "24 ore", value: GardenPanelView.formatMm(rain)))
        }
        if let sowing = GardenPanelView.sowingSentence(garden) {
            rows.append(ForYouRow(label: "Semina", hint: nil, value: sowing))
        }

        return ForYouCard(
            key: .garden,
            headline: GardenPanelView.adviceHeadlines[garden.advice] ?? garden.advice,
            detail: GardenPanelView.adviceReason(garden) ?? "Il bilancio idrico è in pari",
            rows: rows,
            note: "L'umidità è in percentuale di volume: le soglie dipendono dal tipo di terreno."
        )
    }

    // MARK: Fotovoltaico

    private static func solarCard(_ solar: SolarOutlook, plantKwp: Double?) -> ForYouCard? {
        guard let today = solar.days.first else { return nil }

        let rows = solar.days.prefix(3).map { day -> ForYouRow in
            let energia = SolarPanelView.dayEnergyKwh(day, kwp: plantKwp)
            return ForYouRow(
                label: SolarPanelView.dayLabel(day.date),
                hint: day.sunshineHours.map { "\(Int($0.rounded())) h sole" },
                value: energia != nil
                    ? SolarPanelView.formatKwh(energia)
                    : SolarPanelView.formatSpecificYield(day.kwhPerKwp)
            )
        }

        let energiaOggi = SolarPanelView.dayEnergyKwh(today, kwp: plantKwp)
        let headline = energiaOggi != nil
            ? "\(SolarPanelView.formatKwh(energiaOggi)) stimati oggi"
            : "\(SolarPanelView.formatSpecificYield(today.kwhPerKwp)) oggi"

        let detail = plantKwp == nil
            ? "Imposta la potenza dell'impianto per vedere i kWh"
            : (today.sunshineHours.map { "\(Int($0.rounded())) ore di sole previste" } ?? "Resa stimata sulla giornata")

        return ForYouCard(
            key: .solar,
            headline: headline,
            detail: detail,
            rows: Array(rows),
            note: SolarPanelView.assumptionsNote(solar)
        )
    }

    // MARK: Cielo

    private static func skyCard(_ sky: SkyOutlook) -> ForYouCard? {
        let solar = SkyPanelView.nextSolarEvent(sky)
        let night = sky.stargazing
        guard solar != nil || night != nil else { return nil }

        var rows: [ForYouRow] = []
        if let solar {
            rows.append(ForYouRow(
                label: solar.isSunset ? "Tramonto" : "Alba",
                hint: SkyPanelView.formatHour(solar.event.at),
                value: SkyPanelView.levelLabels[solar.event.level] ?? solar.event.level
            ))
        }
        if let night {
            rows.append(ForYouRow(
                label: "Stelle stanotte",
                hint: SkyPanelView.stargazingReason(night),
                value: SkyPanelView.nightLabels[night.level] ?? night.level
            ))
        }

        let detail = night.map(SkyPanelView.stargazingReason)
            ?? "Le nuvole alte fanno il tramonto, quelle basse lo spengono"

        return ForYouCard(
            key: .sky,
            headline: SkyPanelView.headline(sky),
            detail: detail,
            rows: rows,
            note: "I tramonti migliori nascono da nuvole alte con l'orizzonte libero."
        )
    }

    // MARK: Luna

    /// La scheda che il ridisegno aveva perso: il vecchio pannello del meteo
    /// corrente mostrava fase, illuminazione, sorgere, tramonto e distanza
    /// dalla luna piena, e nessuna delle quattro sezioni nuove li aveva
    /// raccolti. Non dipende da un blocco opzionale del backend — la fase si
    /// calcola anche senza `astronomy` — quindi, a differenza del mare o della
    /// neve, la scheda c'è ogni notte: la luna non è mai «niente da dire».
    static func moonCard(_ astronomy: AstronomyData?, now: Date = Date()) -> ForYouCard {
        let age = MoonPhase.age(on: now)
        let phase = MoonPhase.resolve(astronomy?.moonPhase, on: now)
        let illumination = astronomy?.moonIllumination ?? MoonPhase.illumination(age: age)
        let daysToFull = MoonPhase.daysToFull(age: age)

        var rows: [ForYouRow] = [
            ForYouRow(label: "Illuminazione", hint: nil, value: "\(illumination)%"),
        ]
        if let sorge = HeroText.hour(astronomy?.moonrise) {
            rows.append(ForYouRow(label: "Sorge", hint: nil, value: sorge))
        }
        if let tramonta = HeroText.hour(astronomy?.moonset) {
            rows.append(ForYouRow(label: "Tramonta", hint: nil, value: tramonta))
        }
        rows.append(ForYouRow(
            label: "Luna piena",
            hint: nil,
            value: fullMoonDistance(daysToFull)
        ))

        return ForYouCard(
            key: .moon,
            headline: phase.label,
            detail: moonDetail(illumination: illumination, daysToFull: daysToFull),
            rows: rows,
            note: "Sotto il 30% di luna le stelle deboli si vedono; sopra l'80% restano pianeti e stelle luminose."
        )
    }

    /// «Illuminata al 35% · piena fra 6 giorni».
    static func moonDetail(illumination: Int, daysToFull: Int) -> String {
        let luce = "Illuminata al \(illumination)%"
        switch daysToFull {
        case 0: return "\(luce) · piena stanotte"
        case 1: return "\(luce) · piena domani"
        default: return "\(luce) · piena fra \(daysToFull) giorni"
        }
    }

    static func fullMoonDistance(_ days: Int) -> String {
        switch days {
        case 0: return "Stanotte"
        case 1: return "Domani"
        default: return "Fra \(days) giorni"
        }
    }

    // MARK: Attività

    private static func activitiesCard(_ activities: ActivitiesOutlook) -> ForYouCard? {
        guard let best = activities.activities.first else { return nil }

        let rows = activities.activities.map { activity in
            ForYouRow(
                label: activity.label,
                hint: activity.limiting.map { "limita \($0)" },
                value: "\(Int(activity.score.rounded()))"
            )
        }

        let quando = ActivitiesPanelView.dayNote(activities.date).map { " (\($0))" } ?? ""

        return ForYouCard(
            key: .activities,
            headline: ActivitiesPanelView.headline(best),
            detail: "Indice \(Int(best.score.rounded()))/100\(quando)",
            rows: rows,
            note: "Punteggio pari al fattore peggiore: una giornata perfetta sotto la pioggia non è mezza buona."
        )
    }

    // MARK: Pollini

    private static func pollenCard(_ pollen: [PollenReading]) -> ForYouCard? {
        let ordinati = pollen.sorted {
            (PollenPanelView.rank[$0.dailyLevel] ?? 0) > (PollenPanelView.rank[$1.dailyLevel] ?? 0)
        }
        guard let peggiore = ordinati.first else { return nil }

        let rows = ordinati.map { specie in
            ForYouRow(
                label: specie.label,
                hint: specie.dailyMax.map { "max \(formatGrains($0))" },
                value: PollenPanelView.labels[specie.dailyLevel] ?? specie.dailyLevel
            )
        }

        let livello = (PollenPanelView.labels[peggiore.dailyLevel] ?? peggiore.dailyLevel).lowercased()
        let headline = peggiore.dailyLevel == "none"
            ? "Nessun polline rilevante oggi"
            : "\(peggiore.label): \(livello)"

        return ForYouCard(
            key: .pollen,
            headline: headline,
            detail: "Valore massimo previsto in giornata, non dell'ora corrente",
            rows: rows,
            note: "Le soglie sono per specie: 30 granuli di graminacee pesano, gli stessi 30 di olivo no."
        )
    }

    /// Granuli/m³ con un decimale solo quando serve.
    private static func formatGrains(_ value: Double) -> String {
        value >= 10
            ? "\(Int(value.rounded()))"
            : String(format: "%.1f", value).replacingOccurrences(of: ".", with: ",")
    }

    // MARK: Mare

    private static func seaCard(_ sea: SeaOutlook) -> ForYouCard {
        var rows: [ForYouRow] = []

        if sea.seaTemperature != nil {
            rows.append(ForYouRow(label: "Acqua", hint: nil, value: SeaPanelView.formatSeaTemp(sea.seaTemperature)))
        }
        if sea.waveHeight != nil {
            rows.append(ForYouRow(
                label: "Onda",
                hint: SeaPanelView.waveDirectionLabel(sea.waveDirection).map { "da \($0)" },
                value: SeaPanelView.formatWave(sea.waveHeight)
            ))
        }
        if let swell = sea.swellHeight, swell > 0 {
            rows.append(ForYouRow(label: "Mare lungo", hint: nil, value: SeaPanelView.formatWave(swell)))
        }

        return ForYouCard(
            key: .sea,
            headline: SeaPanelView.headline(sea),
            detail: SeaPanelView.worseningNote(sea) ?? "Stato del mare nell'ora corrente",
            rows: rows,
            note: "Le maree non sono disponibili sul piano gratuito delle nostre fonti."
        )
    }
}
