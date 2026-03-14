import SwiftUI
import WidgetKit

// MARK: - Gradienti per condizioni meteo

enum WidgetGradients {
    static func background(for condition: String) -> LinearGradient {
        switch condition {
        case "clear":
            return LinearGradient(
                colors: [Color(hex: "4A90D9"), Color(hex: "74B9FF")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "cloudy":
            return LinearGradient(
                colors: [Color(hex: "636E72"), Color(hex: "B2BEC3")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "rain":
            return LinearGradient(
                colors: [Color(hex: "2D3436"), Color(hex: "636E72")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "snow":
            return LinearGradient(
                colors: [Color(hex: "A8C8E8"), Color(hex: "DFE6E9")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "storm":
            return LinearGradient(
                colors: [Color(hex: "1E272E"), Color(hex: "485460")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "fog":
            return LinearGradient(
                colors: [Color(hex: "9B9B9B"), Color(hex: "C4C4C4")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        default:
            return LinearGradient(
                colors: [Color(hex: "4A90D9"), Color(hex: "74B9FF")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    /// Gradiente notturno (usato quando è dopo il tramonto)
    static func nightBackground(for condition: String) -> LinearGradient {
        switch condition {
        case "clear":
            return LinearGradient(
                colors: [Color(hex: "0C1445"), Color(hex: "1A237E")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "rain", "storm":
            return LinearGradient(
                colors: [Color(hex: "0D1117"), Color(hex: "1E272E")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        default:
            return LinearGradient(
                colors: [Color(hex: "1A1A2E"), Color(hex: "16213E")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    /// Colore per l'icona meteo
    static func iconColor(for condition: String) -> Color {
        switch condition {
        case "clear": return Color(hex: "FFD93D")
        case "snow": return Color(hex: "74B9FF")
        case "storm": return Color(hex: "FFD93D")
        default: return .white
        }
    }
}

// MARK: - Color hex extension (duplicata per il widget target)

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 128, 128, 128)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Formatter per orari

enum WidgetDateFormatters {
    static let hourFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH"
        f.locale = Locale(identifier: "it_IT")
        return f
    }()

    static let hourMinuteFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        f.locale = Locale(identifier: "it_IT")
        return f
    }()

    static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEE"
        f.locale = Locale(identifier: "it_IT")
        return f
    }()

    static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static let isoBasicFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static let dateOnlyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// Prova a parsare una stringa ISO in Date
    static func parseISO(_ string: String) -> Date? {
        isoFormatter.date(from: string) ?? isoBasicFormatter.date(from: string)
    }

    /// Formatta l'orario come "14" (solo ora)
    static func hourString(from isoString: String) -> String {
        guard let date = parseISO(isoString) else {
            // Fallback: prova a estrarre l'ora dalla stringa
            let components = isoString.split(separator: "T")
            if components.count > 1 {
                return String(components[1].prefix(2))
            }
            return "--"
        }
        return hourFormatter.string(from: date)
    }

    /// Formatta il giorno come "Lun", "Mar", etc.
    static func dayString(from dateString: String) -> String {
        guard let date = dateOnlyFormatter.date(from: String(dateString.prefix(10))) else {
            return "--"
        }
        if Calendar.current.isDateInToday(date) {
            return "Oggi"
        }
        return dayFormatter.string(from: date).capitalized
    }
}
