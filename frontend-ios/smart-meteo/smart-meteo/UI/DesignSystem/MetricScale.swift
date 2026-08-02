import SwiftUI

/// Registry delle metriche orarie mostrabili nel dettaglio.
///
/// Gemello di `lib/metrics.ts` sul web: `HourlyDetailView` è agnostica rispetto
/// alla metrica e legge da qui come estrarre il valore da un'ora, come colorarlo,
/// che dominio dare all'asse e cosa scrivere nell'intestazione. Aggiungere una
/// metrica significa aggiungere un caso, non toccare la view.
enum HourlyMetric: String, CaseIterable, Identifiable {
    case precipitation
    case wind
    case humidity
    case feelsLike
    case uv

    var id: String { rawValue }

    var label: String {
        switch self {
        case .precipitation: return "Precipitazioni"
        case .wind: return "Vento"
        case .humidity: return "Umidità"
        case .feelsLike: return "Percepita"
        case .uv: return "Indice UV"
        }
    }

    var systemImage: String {
        switch self {
        case .precipitation: return "drop.fill"
        case .wind: return "wind"
        case .humidity: return "humidity.fill"
        case .feelsLike: return "thermometer.medium"
        case .uv: return "sun.max.fill"
        }
    }

    var sections: [MetricSection] {
        switch self {
        case .precipitation: return [.precipitationMm, .precipitationProbability]
        case .wind: return [.wind]
        case .humidity: return [.humidity]
        case .feelsLike: return [.feelsLike]
        case .uv: return [.uv]
        }
    }
}

/// Descrizione di un singolo grafico all'interno di una metrica.
struct MetricSection: Identifiable {
    let id: String
    let height: CGFloat
    /// Valore della barra, già nell'unità di visualizzazione.
    let valueOf: (HourlyForecast) -> Double?
    /// Valore secondario (raffica), disegnato come tacca sopra la barra.
    let secondaryOf: ((HourlyForecast) -> Double?)?
    let colorOf: (Double) -> Color
    /// Dominio dell'asse Y, dai valori del giorno (principali e secondari insieme,
    /// così una raffica alta non finisce fuori dal grafico).
    let domain: ([Double]) -> ClosedRange<Double>
    /// Valori a cui disegnare una linea di riferimento.
    let gridValues: (ClosedRange<Double>) -> [Double]
    /// Etichetta della linea, `nil` per una linea muta.
    let gridLabel: (Double) -> String?
    /// Punti in cui scrivere l'etichetta di fascia (il centro della fascia stessa).
    let bandValues: (ClosedRange<Double>) -> [Double]
    let bandLabel: (Double) -> String
    /// Valore grande dell'intestazione. `nil` = ora non coperta da nessuna fonte.
    let headline: (HourlyForecast?) -> String
    let caption: (HourlyForecast?) -> String
    /// Mostrato al posto del grafico quando nessuna ora del giorno ha il dato.
    let emptyMessage: String
    /// Sovrapposto al grafico quando tutti i valori del giorno sono a zero.
    let flatMessage: String?
}

private let msToKmh: Double = 3.6

/// Dominio che parte da zero e lascia un margine sopra al valore massimo.
private func domainFromZero(_ floor: Double) -> ([Double]) -> ClosedRange<Double> {
    { values in 0...max(floor, (values.max() ?? 0) * 1.15) }
}

/// Multipli di `step` interni al dominio, per gli assi senza soglie naturali.
private func niceTicks(_ domain: ClosedRange<Double>, step: Double) -> [Double] {
    var out: [Double] = []
    var v = (domain.lowerBound / step).rounded(.up) * step
    while v <= domain.upperBound {
        out.append(v)
        v += step
    }
    return out
}

/// Etichetta leggibile della condizione di un'ora.
///
/// Riusa la tabella di `WeatherDescriptionEngine` con lo stesso fallback che usa
/// lei: le fonti non-WMO mandano stringhe normalizzate ("rain", "clear") invece
/// di un codice numerico.
private func conditionLabel(_ h: HourlyForecast) -> String {
    let code = Int(h.conditionCode) ?? WeatherDescriptionEngine.normalizedToWMO(h.conditionCode)
    let noun = WeatherDescriptionEngine.conditionLabel(for: code)
    return noun.prefix(1).uppercased() + noun.dropFirst()
}

extension MetricSection {

    // MARK: - Precipitazioni

    static let precipitationMm = MetricSection(
        id: "mm",
        height: 160,
        valueOf: { $0.precipitationMm },
        secondaryOf: nil,
        colorOf: { PrecipIntensity.classify($0).color },
        domain: domainFromZero(PrecipIntensity.Threshold.heavy * 1.25),
        // Le linee marcano i confini fra le fasce…
        gridValues: { _ in [PrecipIntensity.Threshold.moderate, PrecipIntensity.Threshold.heavy] },
        gridLabel: { _ in nil },
        // …e le etichette stanno al centro della fascia che nominano. Una linea a
        // 0,1 mm sarebbe appiccicata alla base e illeggibile.
        bandValues: { domain in
            [
                (PrecipIntensity.Threshold.light + PrecipIntensity.Threshold.moderate) / 2,
                (PrecipIntensity.Threshold.moderate + PrecipIntensity.Threshold.heavy) / 2,
                (PrecipIntensity.Threshold.heavy + domain.upperBound) / 2
            ]
        },
        bandLabel: { PrecipIntensity.classify($0).label },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            let intensity = PrecipIntensity.classify(h.precipitationMm)
            return intensity == .none ? formatPrecipMm(h.precipitationMm) : intensity.label
        },
        caption: { h in
            guard let h else { return "" }
            let intensity = PrecipIntensity.classify(h.precipitationMm)
            let amount = intensity != .none && h.precipitationMm != nil
                ? " · \(formatPrecipMm(h.precipitationMm))"
                : ""
            return conditionLabel(h) + amount
        },
        emptyMessage: "Quantità in mm non disponibile per questa località",
        flatMessage: "Nessuna precipitazione prevista"
    )

    static let precipitationProbability = MetricSection(
        id: "prob",
        height: 110,
        valueOf: { $0.precipitationProb },
        secondaryOf: nil,
        colorOf: { _ in Color(hex: "60A5FA").opacity(0.85) },
        domain: { _ in 0...100 },
        gridValues: { _ in [80, 100] },
        gridLabel: { "\(Int($0))%" },
        bandValues: { _ in [] },
        bandLabel: { _ in "" },
        headline: { h in
            guard let prob = h?.precipitationProb else { return "—%" }
            return "\(Int(prob.rounded()))%"
        },
        caption: { _ in "Probabilità" },
        emptyMessage: "Probabilità non disponibile per questa località",
        flatMessage: nil
    )

    // MARK: - Vento

    static let wind = MetricSection(
        id: "wind",
        height: 160,
        valueOf: { $0.windSpeed.map { $0 * msToKmh } },
        secondaryOf: { $0.windGust.map { $0 * msToKmh } },
        colorOf: { WindScale.classify($0).color },
        domain: domainFromZero(WindScale.Threshold.strong * 1.25),
        gridValues: { _ in [WindScale.Threshold.moderate, WindScale.Threshold.strong] },
        gridLabel: { _ in nil },
        bandValues: { domain in
            [
                WindScale.Threshold.moderate / 2,
                (WindScale.Threshold.moderate + WindScale.Threshold.strong) / 2,
                (WindScale.Threshold.strong + domain.upperBound) / 2
            ]
        },
        bandLabel: { WindScale.classify($0).label },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            guard let speed = h.windSpeed else { return "—" }
            return "\(Int((speed * msToKmh).rounded())) km/h"
        },
        caption: { h in
            guard let h, let speed = h.windSpeed else { return "" }
            var parts: [String] = []
            if let deg = h.windDirection {
                parts.append("Da \(windDegreesToDirection(deg))")
            }
            parts.append(WindScale.classify(speed * msToKmh).label)
            if let gust = h.windGust {
                parts.append("raffiche \(Int((gust * msToKmh).rounded())) km/h")
            }
            return parts.joined(separator: " · ")
        },
        emptyMessage: "Dati del vento non disponibili per questa località",
        flatMessage: "Assenza di vento prevista"
    )

    // MARK: - Umidità

    static let humidity = MetricSection(
        id: "humidity",
        height: 160,
        valueOf: { $0.humidity },
        secondaryOf: nil,
        colorOf: humidityColor,
        domain: { _ in 0...100 },
        gridValues: { _ in [30, 60, 90] },
        gridLabel: { "\(Int($0))%" },
        bandValues: { _ in [] },
        bandLabel: { _ in "" },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            guard let value = h.humidity else { return "—" }
            return "\(Int(value.rounded()))%"
        },
        caption: { _ in "Umidità relativa" },
        emptyMessage: "Umidità non disponibile per questa località",
        flatMessage: nil
    )

    // MARK: - Temperatura percepita

    static let feelsLike = MetricSection(
        id: "feels_like",
        height: 160,
        valueOf: { $0.feelsLike },
        secondaryOf: nil,
        colorOf: tempColor,
        // A differenza delle altre metriche il fondo non è zero: barre che partono
        // da 0 °C su una giornata fra 18 e 24 °C non mostrerebbero alcuna
        // variazione, e con temperature sotto zero non avrebbero proprio senso.
        domain: { values in
            guard let min = values.min(), let max = values.max() else { return 0...1 }
            return (min.rounded(.down) - 2)...(max.rounded(.up) + 2)
        },
        gridValues: { niceTicks($0, step: 5) },
        gridLabel: { "\(Int($0))°" },
        bandValues: { _ in [] },
        bandLabel: { _ in "" },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            guard let value = h.feelsLike else { return "—" }
            return "\(Int(value.rounded()))°"
        },
        caption: { h in
            guard let h else { return "" }
            return "Reale \(Int(h.temp.rounded()))° · \(conditionLabel(h))"
        },
        emptyMessage: "Temperatura percepita non disponibile per questa località",
        flatMessage: nil
    )

    // MARK: - Indice UV

    static let uv = MetricSection(
        id: "uv",
        height: 160,
        valueOf: { $0.uvIndex },
        secondaryOf: nil,
        colorOf: { UVScale.classify($0).color },
        domain: domainFromZero(UVScale.Threshold.extreme),
        gridValues: { _ in [UVScale.Threshold.moderate, UVScale.Threshold.high, UVScale.Threshold.veryHigh] },
        gridLabel: { _ in nil },
        // Quattro fasce e non cinque: "Estremo" parte da 11 e la sua etichetta
        // finirebbe sovrapposta a quella sotto. Il livello resta comunque nel
        // colore della barra e nella didascalia.
        bandValues: { domain in
            [
                UVScale.Threshold.moderate / 2,
                (UVScale.Threshold.moderate + UVScale.Threshold.high) / 2,
                (UVScale.Threshold.high + UVScale.Threshold.veryHigh) / 2,
                (UVScale.Threshold.veryHigh + domain.upperBound) / 2
            ]
        },
        bandLabel: { UVScale.classify($0).label },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            guard let value = h.uvIndex else { return "—" }
            return "\(Int(value.rounded()))"
        },
        caption: { h in
            guard let uv = h?.uvIndex else { return "" }
            return "Indice UV · \(UVScale.classify(uv).label)"
        },
        emptyMessage: "Indice UV non disponibile per questa località",
        flatMessage: "Nessuna radiazione UV prevista"
    )
}

// MARK: - Scale

/// Intensità del vento in km/h, semplificazione della scala Beaufort: fino a
/// 20 km/h è brezza (Beaufort ≤ 3), fino a 40 km/h vento teso (4-5), oltre è
/// vento forte (6+).
enum WindScale {
    case light
    case moderate
    case strong

    enum Threshold {
        static let moderate: Double = 20
        static let strong: Double = 40
    }

    static func classify(_ kmh: Double?) -> WindScale {
        guard let kmh, kmh.isFinite else { return .light }
        if kmh >= Threshold.strong { return .strong }
        if kmh >= Threshold.moderate { return .moderate }
        return .light
    }

    var label: String {
        switch self {
        case .light: return "Debole"
        case .moderate: return "Teso"
        case .strong: return "Forte"
        }
    }

    var color: Color {
        switch self {
        case .light: return Color(hex: "7FB3E8")
        case .moderate: return Color(hex: "3B82F6")
        case .strong: return Color(hex: "EC685A")
        }
    }
}

/// Fasce dell'indice UV secondo l'OMS.
enum UVScale {
    case low
    case moderate
    case high
    case veryHigh
    case extreme

    enum Threshold {
        static let moderate: Double = 3
        static let high: Double = 6
        static let veryHigh: Double = 8
        static let extreme: Double = 11
    }

    static func classify(_ uv: Double?) -> UVScale {
        guard let uv, uv.isFinite else { return .low }
        if uv >= Threshold.extreme { return .extreme }
        if uv >= Threshold.veryHigh { return .veryHigh }
        if uv >= Threshold.high { return .high }
        if uv >= Threshold.moderate { return .moderate }
        return .low
    }

    var label: String {
        switch self {
        case .low: return "Basso"
        case .moderate: return "Moderato"
        case .high: return "Alto"
        case .veryHigh: return "Molto alto"
        case .extreme: return "Estremo"
        }
    }

    var color: Color {
        switch self {
        case .low: return Color(hex: "22C55E")
        // Tonalità più profonde delle equivalenti web: qui lo sfondo è crema e
        // un giallo chiaro non si staccherebbe.
        case .moderate: return Color(hex: "CA8A04")
        case .high: return Color(hex: "F97316")
        case .veryHigh: return Color(hex: "EF4444")
        case .extreme: return Color(hex: "A855F7")
        }
    }
}

/// Colore per l'umidità relativa: dal secco ambrato all'afoso blu pieno.
func humidityColor(_ pct: Double) -> Color {
    guard pct.isFinite else { return Color.black.opacity(0.15) }
    if pct >= 80 { return Color(hex: "3B82F6") }
    if pct >= 60 { return Color(hex: "60A5FA") }
    if pct >= 30 { return Color(hex: "7FB3E8") }
    return Color(hex: "D97706")
}

/// Colore per una temperatura in °C, dal freddo viola al caldo rosso.
func tempColor(_ celsius: Double) -> Color {
    guard celsius.isFinite else { return Color.black.opacity(0.15) }
    if celsius >= 35 { return Color(hex: "DC2626") }
    if celsius >= 28 { return Color(hex: "F97316") }
    if celsius >= 20 { return Color(hex: "CA8A04") }
    if celsius >= 10 { return Color(hex: "22C55E") }
    if celsius >= 0 { return Color(hex: "60A5FA") }
    return Color(hex: "A78BFA")
}

/// Sigla della direzione da cui soffia il vento, es. 315° → "NO".
func windDegreesToDirection(_ deg: Double) -> String {
    let directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]
    let index = Int((deg / 45).rounded()) % 8
    return directions[(index + 8) % 8]
}
