import SwiftUI

// MARK: - Motore descrizioni meteo e qualità aria

struct WeatherDescriptionEngine {

    // MARK: - Date Parsing

    private static let formatters: [ISO8601DateFormatter] = [
        {
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return f
        }(),
        {
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withInternetDateTime]
            return f
        }()
    ]

    private static let simpleFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return f
    }()

    static func parseDate(_ str: String) -> Date? {
        for f in formatters {
            if let d = f.date(from: str) { return d }
        }
        return simpleFormatter.date(from: str)
    }

    // MARK: - WMO Code Mapping

    static func normalizedToWMO(_ code: String) -> Int {
        switch code.lowercased() {
        case "clear": return 0
        case "cloudy": return 3
        case "rain": return 61
        case "snow": return 71
        case "storm": return 95
        case "fog": return 45
        default: return 0
        }
    }

    static func conditionAdjectivePlural(for code: Int) -> String {
        switch code {
        case 0: return "sereni"
        case 1, 2: return "poco nuvolosi"
        case 3: return "coperti"
        case 45, 48: return "nebbiosi"
        case 51...57: return "con pioviggine"
        case 61...67, 80...81: return "con pioggia"
        case 71...77, 85...86: return "con neve"
        case 82, 95...99: return "temporaleschi"
        default: return "variabili"
        }
    }

    static func conditionAdjectiveSingular(for code: Int) -> String {
        switch code {
        case 0: return "sereno"
        case 1, 2: return "poco nuvoloso"
        case 3: return "coperto"
        case 45, 48: return "nebbioso"
        case 51...57: return "con pioviggine"
        case 61...67, 80...81: return "piovoso"
        case 71...77, 85...86: return "nevoso"
        case 82, 95...99: return "temporalesco"
        default: return "variabile"
        }
    }

    /// Etichetta condizione per frasi nominali (es. "pioggia probabile")
    static func conditionNoun(for code: Int) -> String {
        switch code {
        case 0: return "sereno"
        case 1, 2: return "poco nuvoloso"
        case 3: return "coperto"
        case 45, 48: return "nebbia"
        case 51...57: return "pioviggine"
        case 61...67, 80...81: return "pioggia"
        case 71...77, 85...86: return "neve"
        case 82, 95...99: return "temporali"
        default: return "variabile"
        }
    }

    /// Etichetta condizione per tendenza giorni successivi
    static func conditionLabel(for code: Int) -> String {
        switch code {
        case 0: return "sereno"
        case 1, 2: return "parzialmente nuvoloso"
        case 3: return "coperto"
        case 45, 48: return "nebbia"
        case 51...57: return "pioviggine"
        case 61...67, 80...81: return "pioggia"
        case 71...77, 85...86: return "neve"
        case 82, 95...99: return "temporali"
        default: return "variabile"
        }
    }

    // MARK: - Periodo giornaliero

    private enum TimePeriod: Int, CaseIterable {
        case notte = 0      // 00-06
        case mattina = 1    // 06-12
        case pomeriggio = 2 // 12-18
        case sera = 3       // 18-24

        var label: String {
            switch self {
            case .notte: return "notte"
            case .mattina: return "mattina"
            case .pomeriggio: return "pomeriggio"
            case .sera: return "sera"
            }
        }

        var preposition: String {
            switch self {
            case .notte: return "nella notte"
            case .mattina: return "in mattinata"
            case .pomeriggio: return "nel pomeriggio"
            case .sera: return "in serata"
            }
        }

        var thisPreposition: String {
            switch self {
            case .notte: return "stanotte"
            case .mattina: return "questa mattina"
            case .pomeriggio: return "questo pomeriggio"
            case .sera: return "questa sera"
            }
        }

        static func from(hour: Int) -> TimePeriod {
            switch hour {
            case 0..<6: return .notte
            case 6..<12: return .mattina
            case 12..<18: return .pomeriggio
            default: return .sera
            }
        }
    }

    private struct PeriodData {
        var codes: [Int: Int] = [:]
        var maxPrecipProb: Double = 0
        var temps: [Double] = []

        var dominantCode: Int? {
            codes.max(by: { $0.value < $1.value })?.key
        }

        var avgPrecipProb: Double {
            maxPrecipProb
        }
    }

    // MARK: - Algoritmo 1: Descrizione Meteo Avanzata

    static func generateEnhancedDescription(
        current: ForecastCurrent?,
        hourly: [HourlyForecast],
        daily: [DailyForecast]?,
        astronomy: AstronomyData?
    ) -> String {
        let calendar = Calendar.current
        let now = Date()
        let currentHour = calendar.component(.hour, from: now)
        let currentPeriod = TimePeriod.from(hour: currentHour)

        // Raggruppa dati orari di oggi per periodo
        var periods: [TimePeriod: PeriodData] = [:]
        var overallMinTemp: Double = 100
        var overallMaxTemp: Double = -100
        var hasTodayData = false

        for h in hourly {
            guard let date = parseDate(h.time), calendar.isDateInToday(date) else { continue }
            hasTodayData = true
            let hour = calendar.component(.hour, from: date)
            let period = TimePeriod.from(hour: hour)
            let code = Int(h.conditionCode) ?? normalizedToWMO(h.conditionCode)

            var data = periods[period] ?? PeriodData()
            data.codes[code, default: 0] += 1
            if let precip = h.precipitationProb {
                data.maxPrecipProb = max(data.maxPrecipProb, precip)
            }
            data.temps.append(h.temp)
            periods[period] = data

            if h.temp > overallMaxTemp { overallMaxTemp = h.temp }
            if h.temp < overallMinTemp { overallMinTemp = h.temp }
        }

        if !hasTodayData {
            return "Previsioni dettagliate per la giornata odierna in fase di aggiornamento."
        }

        var parts: [String] = []

        // --- CONDIZIONI CIELO CON EVOLUZIONE ---
        let remainingPeriods: [TimePeriod] = TimePeriod.allCases.filter { $0.rawValue >= currentPeriod.rawValue }
        let periodConditions: [(TimePeriod, Int)] = remainingPeriods.compactMap { period in
            guard let data = periods[period], let code = data.dominantCode else { return nil }
            return (period, code)
        }

        if !periodConditions.isEmpty {
            let skyDesc = buildSkyDescription(periodConditions: periodConditions, currentPeriod: currentPeriod)
            parts.append(skyDesc)
        }

        // --- TEMPERATURA E PERCEPITA ---
        if overallMaxTemp > -100 {
            var tempDesc = "Temperature tra \(Int(round(overallMinTemp)))° e \(Int(round(overallMaxTemp)))°"
            if let cur = current, let temp = cur.temperature, let feelsLike = cur.feelsLike {
                let diff = feelsLike - temp
                if diff <= -3 {
                    tempDesc += ", percepita più fredda per il vento"
                } else if diff >= 3 {
                    tempDesc += ", percepita più calda per l'umidità"
                }
            }
            tempDesc += "."
            parts.append(tempDesc)
        }

        // --- PRECIPITAZIONI ---
        let precipPeriods: [(TimePeriod, Double)] = remainingPeriods.compactMap { period in
            guard let data = periods[period], data.maxPrecipProb > 50 else { return nil }
            return (period, data.maxPrecipProb)
        }
        if let maxPrecip = precipPeriods.max(by: { $0.1 < $1.1 }) {
            let precipCode = periods[maxPrecip.0]?.dominantCode ?? 61
            let isSnow = (71...86).contains(precipCode)
            let precipType = isSnow ? "Neve probabile" : "Pioggia probabile"
            parts.append("\(precipType) (\(Int(maxPrecip.1))%) \(maxPrecip.0.preposition).")
        }

        // --- VENTO ---
        if let cur = current, let windSpeed = cur.windSpeed, windSpeed >= 12 {
            let windDesc = buildWindDescription(speed: windSpeed, gust: cur.windGust, direction: cur.windDirectionLabel)
            parts.append(windDesc)
        }

        // --- CONDIZIONI DEGNE DI NOTA ---
        if let cur = current {
            let notable = buildNotableConditions(current: cur)
            parts.append(contentsOf: notable)
        }

        // --- TRAMONTO ---
        let sunsetStr = astronomy?.sunset ?? ""
        if !sunsetStr.isEmpty {
            let sunsetTime = extractTime(from: sunsetStr)
            parts.append("Tramonto alle \(sunsetTime).")
        }

        // --- TENDENZA 2 GIORNI ---
        if let daily = daily, daily.count >= 2 {
            let trend = buildTrend(daily: daily)
            if !trend.isEmpty {
                parts.append(trend)
            }
        }

        return parts.joined(separator: " ")
    }

    // MARK: - Builder condizioni cielo

    private static func buildSkyDescription(periodConditions: [(TimePeriod, Int)], currentPeriod: TimePeriod) -> String {
        guard !periodConditions.isEmpty else { return "" }

        // Se c'è solo un periodo rimanente
        if periodConditions.count == 1 {
            let (period, code) = periodConditions[0]
            return "Cieli \(conditionAdjectivePlural(for: code)) \(period.thisPreposition)."
        }

        // Se tutti i periodi hanno la stessa condizione
        let allSameCondition = Set(periodConditions.map { conditionAdjectivePlural(for: $0.1) }).count == 1
        if allSameCondition {
            let adj = conditionAdjectivePlural(for: periodConditions[0].1)
            return "Cieli \(adj) per il resto della giornata."
        }

        // Condizioni che cambiano: descrivi primo e ultimo periodo diverso
        let first = periodConditions[0]
        // Trova il primo periodo con condizione diversa dal primo
        let different = periodConditions.first { conditionAdjectivePlural(for: $0.1) != conditionAdjectivePlural(for: first.1) }

        if let diff = different {
            return "Cieli \(conditionAdjectivePlural(for: first.1)) \(first.0.thisPreposition), \(conditionAdjectiveSingular(for: diff.1)) \(diff.0.preposition)."
        }

        return "Cieli \(conditionAdjectivePlural(for: first.1)) \(first.0.thisPreposition)."
    }

    // MARK: - Builder vento

    private static func buildWindDescription(speed: Double, gust: Double?, direction: String?) -> String {
        let dir = direction.map { " da \($0)" } ?? ""

        if speed >= 75 {
            return "Vento di tempesta\(dir)."
        } else if speed >= 50 {
            let gustStr = gust.map { ", raffiche fino a \(Int(round($0))) km/h" } ?? ""
            return "Vento molto forte\(dir)\(gustStr)."
        } else if speed >= 30 {
            let gustStr = gust.map { ", raffiche fino a \(Int(round($0))) km/h" } ?? ""
            return "Vento forte\(dir)\(gustStr)."
        } else {
            return "Vento moderato\(dir)."
        }
    }

    // MARK: - Builder condizioni degne di nota

    private static func buildNotableConditions(current: ForecastCurrent) -> [String] {
        var notes: [String] = []

        if let humidity = current.humidity, humidity > 85 {
            notes.append("Umidità elevata.")
        }

        if let visibility = current.visibility {
            if visibility < 0.5 {
                notes.append("Visibilità molto scarsa, possibile nebbia.")
            } else if visibility < 2 {
                notes.append("Visibilità ridotta.")
            }
        }

        if let uv = current.uvIndex {
            if uv >= 8 {
                notes.append("Indice UV molto alto.")
            } else if uv >= 6 {
                notes.append("Indice UV alto, protezione consigliata.")
            }
        }

        return notes
    }

    // MARK: - Builder tendenza 2 giorni

    private static func buildTrend(daily: [DailyForecast]) -> String {
        var parts: [String] = []

        // daily[0] = oggi, daily[1] = domani, daily[2] = dopodomani
        let todayMax = daily[0].tempMax

        // Domani
        if daily.count >= 2 {
            let tomorrow = daily[1]
            let code = Int(tomorrow.conditionCode) ?? normalizedToWMO(tomorrow.conditionCode)
            let condLabel = conditionLabel(for: code)

            var tomorrowDesc = "Domani \(condLabel)"

            if let todayM = todayMax, let tomorrowMax = tomorrow.tempMax {
                let diff = tomorrowMax - todayM
                if diff >= 3 {
                    tomorrowDesc += " con temperature in rialzo"
                } else if diff <= -3 {
                    tomorrowDesc += " con temperature in calo"
                } else {
                    tomorrowDesc += " con temperature stabili"
                }
                tomorrowDesc += ", massima \(Int(round(tomorrowMax)))°."
            } else {
                tomorrowDesc += "."
            }

            parts.append(tomorrowDesc)
        }

        // Dopodomani
        if daily.count >= 3 {
            let dayAfter = daily[2]
            let code = Int(dayAfter.conditionCode) ?? normalizedToWMO(dayAfter.conditionCode)
            let condLabel = conditionLabel(for: code)

            var dayAfterDesc = "Dopodomani \(condLabel)"

            if let maxT = dayAfter.tempMax, let minT = dayAfter.tempMin {
                dayAfterDesc += ", \(Int(round(minT)))°-\(Int(round(maxT)))°."
            } else if let maxT = dayAfter.tempMax {
                dayAfterDesc += ", massima \(Int(round(maxT)))°."
            } else {
                dayAfterDesc += "."
            }

            parts.append(dayAfterDesc)
        }

        return parts.joined(separator: " ")
    }

    // MARK: - Helper estrazione orario

    static func extractTime(from isoString: String) -> String {
        if let date = parseDate(isoString) {
            let fmt = DateFormatter()
            fmt.dateFormat = "HH:mm"
            return fmt.string(from: date)
        }
        // Fallback: prova a estrarre HH:mm dalla stringa
        if isoString.count >= 5, isoString.contains(":") {
            let parts = isoString.components(separatedBy: "T")
            if parts.count == 2 {
                let timePart = parts[1]
                return String(timePart.prefix(5))
            }
        }
        return isoString
    }

    // MARK: - Algoritmo 2: Descrizione Qualità Aria

    /// Categorie AQI EPA (indice 1-6 da WeatherAPI)
    static func aqiCategoryLabel(_ aqiIndex: Double?) -> String {
        guard let aqi = aqiIndex else { return "N/D" }
        let index = Int(aqi)
        switch index {
        case 1: return "Buona"
        case 2: return "Moderata"
        case 3: return "Malsana per sensibili"
        case 4: return "Malsana"
        case 5: return "Molto malsana"
        case 6: return "Pericolosa"
        default: return "N/D"
        }
    }

    static func aqiCategoryColor(_ aqiIndex: Double?) -> Color {
        guard let aqi = aqiIndex else { return .gray }
        let index = Int(aqi)
        switch index {
        case 1: return Color(red: 0.2, green: 0.7, blue: 0.3)       // Verde
        case 2: return Color(red: 0.9, green: 0.8, blue: 0.2)       // Giallo
        case 3: return Color(red: 0.95, green: 0.55, blue: 0.15)    // Arancione
        case 4: return Color(red: 0.9, green: 0.25, blue: 0.2)      // Rosso
        case 5: return Color(red: 0.55, green: 0.2, blue: 0.6)      // Viola
        case 6: return Color(red: 0.5, green: 0.15, blue: 0.15)     // Marrone
        default: return .gray
        }
    }

    static func generateAirQualityDescription(airQuality: AirQualityDetail) -> String {
        var parts: [String] = []

        // Classificazione complessiva
        let category = aqiCategoryLabel(airQuality.aqiUsEpa)
        if category != "N/D" {
            parts.append("Qualità \(category.lowercased()).")
        }

        // Analisi inquinanti individuali (soglie OMS 2021)
        struct PollutantCheck {
            let name: String
            let value: Double?
            let elevatedThreshold: Double
            let highThreshold: Double
            let hint: String?
        }

        let checks: [PollutantCheck] = [
            PollutantCheck(name: "PM2.5", value: airQuality.pm25, elevatedThreshold: 15, highThreshold: 35,
                          hint: "Particolato fine elevato, possibile causa traffico o riscaldamento."),
            PollutantCheck(name: "PM10", value: airQuality.pm10, elevatedThreshold: 45, highThreshold: 75,
                          hint: "Particolato grossolano elevato, possibile causa polveri o cantieri."),
            PollutantCheck(name: "NO₂", value: airQuality.no2, elevatedThreshold: 25, highThreshold: 50,
                          hint: "Biossido di azoto elevato, probabilmente da traffico urbano."),
            PollutantCheck(name: "O₃", value: airQuality.o3, elevatedThreshold: 100, highThreshold: 160,
                          hint: "Ozono elevato, tipico delle giornate calde e soleggiate."),
            PollutantCheck(name: "CO", value: airQuality.co, elevatedThreshold: 4000, highThreshold: 10000,
                          hint: nil),
            PollutantCheck(name: "SO₂", value: airQuality.so2, elevatedThreshold: 40, highThreshold: 125,
                          hint: nil),
        ]

        var elevated: [(String, Bool, String?)] = [] // (nome, isHigh, hint)

        for check in checks {
            guard let value = check.value else { continue }
            if value > check.highThreshold {
                elevated.append((check.name, true, check.hint))
            } else if value > check.elevatedThreshold {
                elevated.append((check.name, false, check.hint))
            }
        }

        if elevated.isEmpty {
            parts.append("Tutti i valori nella norma.")
        } else if elevated.count == 1 {
            let (name, isHigh, hint) = elevated[0]
            let level = isHigh ? "alto" : "leggermente elevato"
            parts.append("\(name) \(level).")
            // Aggiungi hint contestuale solo se AQI >= 2 (moderata o peggio)
            if let hint = hint, let aqiVal = airQuality.aqiUsEpa, aqiVal >= 2 {
                parts.append(hint)
            }
        } else {
            let names = elevated.map { $0.0 }
            let hasAnyHigh = elevated.contains { $0.1 }
            let level = hasAnyHigh ? "elevati" : "sopra la media"
            if names.count == 2 {
                parts.append("\(names[0]) e \(names[1]) \(level).")
            } else {
                let allButLast = names.dropLast().joined(separator: ", ")
                parts.append("\(allButLast) e \(names.last!) \(level).")
            }
            // Hint del primo inquinante con hint disponibile
            if let firstHint = elevated.first(where: { $0.2 != nil })?.2,
               let aqiVal = airQuality.aqiUsEpa, aqiVal >= 2 {
                parts.append(firstHint)
            }
        }

        return parts.joined(separator: " ")
    }
}
