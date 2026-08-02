import SwiftUI

/// Classificazione dell'intensità di precipitazione a partire dai millimetri
/// accumulati in un'ora.
///
/// Soglie secondo lo standard NWS/AMS (debole ≤ 0.10 in/h, moderata 0.11–0.30
/// in/h, forte > 0.30 in/h). Preferite a quelle WMO (2.5 / 10 / 50) perché la
/// spaziatura WMO spingerebbe la banda "Forte" fuori dal grafico per la
/// climatologia italiana.
enum PrecipIntensity {
    case none
    case light
    case moderate
    case heavy

    /// Soglie in mm accumulati in un'ora.
    enum Threshold {
        static let light: Double = 0.1
        static let moderate: Double = 2.5
        static let heavy: Double = 7.6
    }

    static func classify(_ mm: Double?) -> PrecipIntensity {
        guard let mm, mm.isFinite else { return .none }
        if mm >= Threshold.heavy { return .heavy }
        if mm >= Threshold.moderate { return .moderate }
        if mm >= Threshold.light { return .light }
        return .none
    }

    var label: String {
        switch self {
        case .none: return "—"
        case .light: return "Debole"
        case .moderate: return "Moderata"
        case .heavy: return "Forte"
        }
    }

    var color: Color {
        switch self {
        case .none: return Color.black.opacity(0.15)
        case .light: return Color(hex: "7FB3E8")
        case .moderate: return Color(hex: "3B82F6")
        // Il corallo è già l'accento della dashboard.
        case .heavy: return Color(hex: "EC685A")
        }
    }
}

/// Formatta i millimetri in italiano con un decimale, es. "0,5 mm".
func formatPrecipMm(_ mm: Double?) -> String {
    guard let mm, mm.isFinite else { return "—" }
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "it_IT")
    formatter.minimumFractionDigits = 1
    formatter.maximumFractionDigits = 1
    let value = formatter.string(from: NSNumber(value: mm)) ?? String(format: "%.1f", mm)
    return "\(value) mm"
}
