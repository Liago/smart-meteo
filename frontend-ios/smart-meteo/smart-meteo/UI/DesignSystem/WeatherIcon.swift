import SwiftUI

/// Icona meteo con colori palette personalizzati per ogni condizione.
/// Usa `.symbolRenderingMode(.palette)` con colori specifici:
/// - Sole: arancione
/// - Nuvole: grigio scuro
/// - Pioggia/gocce: blu
/// - Neve: azzurro
/// - Fulmine: giallo
/// - Nebbia: grigio medio
struct WeatherIcon: View {
    let systemName: String
    var font: Font = .title2

    var body: some View {
        Image(systemName: systemName)
            .symbolRenderingMode(.palette)
            .foregroundStyle(primaryColor, secondaryColor, tertiaryColor)
            .font(font)
    }

    // MARK: - Colori per layer SF Symbol (primary, secondary, tertiary)

    // SF Symbols weather icons use up to 3 layers:
    // Layer 1 (primary): main shape (cloud, sun body)
    // Layer 2 (secondary): secondary shape (sun rays, rain drops, bolt)
    // Layer 3 (tertiary): additional detail

    var primaryColor: Color {
        switch systemName {
        case "sun.max.fill":
            return .orange
        case "cloud.sun.fill":
            return Color(white: 0.45) // nuvola grigia
        case "cloud.fill":
            return Color(white: 0.45)
        case "cloud.fog.fill":
            return Color(white: 0.5)
        case "cloud.drizzle.fill":
            return Color(white: 0.45)
        case "cloud.rain.fill":
            return Color(white: 0.45)
        case "cloud.bolt.rain.fill":
            return Color(white: 0.4)
        case "cloud.snow.fill", "snowflake":
            return Color(red: 0.4, green: 0.65, blue: 0.85)
        case "cloud.bolt.fill":
            return Color(white: 0.4)
        default:
            return Color(white: 0.45)
        }
    }

    var secondaryColor: Color {
        switch systemName {
        case "sun.max.fill":
            return .orange
        case "cloud.sun.fill":
            return .orange // sole dietro la nuvola
        case "cloud.fog.fill":
            return Color(white: 0.6)
        case "cloud.drizzle.fill", "cloud.rain.fill":
            return Color(red: 0.3, green: 0.55, blue: 0.85) // gocce blu
        case "cloud.bolt.rain.fill":
            return .yellow // fulmine
        case "cloud.snow.fill", "snowflake":
            return Color(red: 0.5, green: 0.75, blue: 0.95)
        case "cloud.bolt.fill":
            return .yellow
        default:
            return Color(white: 0.5)
        }
    }

    var tertiaryColor: Color {
        switch systemName {
        case "cloud.bolt.rain.fill":
            return Color(red: 0.3, green: 0.55, blue: 0.85) // gocce blu (terzo layer)
        case "cloud.fog.fill":
            return Color(white: 0.65)
        default:
            return secondaryColor
        }
    }
}

// MARK: - Resizable variant

struct ResizableWeatherIcon: View {
    let systemName: String
    var size: CGFloat = 100

    private var colors: WeatherIcon { WeatherIcon(systemName: systemName) }

    var body: some View {
        Image(systemName: systemName)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .symbolRenderingMode(.palette)
            .foregroundStyle(colors.primaryColor, colors.secondaryColor, colors.tertiaryColor)
            .frame(width: size, height: size)
    }
}
