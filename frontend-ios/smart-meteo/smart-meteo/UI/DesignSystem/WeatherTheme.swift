import SwiftUI

/// Il tema visivo della dashboard, che **segue il meteo**.
///
/// È la decisione portante del ridisegno: lo sfondo, l'hero, l'inchiostro e
/// l'accento non sono costanti dell'app ma della *condizione in corso*. Una
/// giornata di pioggia non deve avere lo stesso crema di una giornata di sole,
/// perché il colore è la prima informazione che arriva — prima ancora del
/// numero.
///
/// I valori vengono dal documento di handoff (`ios Redisign/README.md`).
/// Sereno, nuvoloso e pioggia sono dichiarati lì; neve e temporale sono
/// l'estensione prevista dal documento stesso, costruita con la stessa logica:
/// `page` chiarissimo, `hero` una tinta piena ma tenue, `ink` scuro della
/// stessa famiglia, `accent` saturo.

// MARK: - Condizione

/// Le famiglie di condizione che cambiano il tema.
///
/// Sono cinque, non le sette di `WeatherCondition` del backend: nebbia e
/// nuvoloso condividono lo stesso tema perché nessuno dei due ha un colore
/// proprio, e distinguerli darebbe due grigi che nessuno saprebbe leggere.
enum SkyCondition: String, CaseIterable {
    case clear
    case cloudy
    case rain
    case snow
    case storm

    /// Ricava la condizione dal blocco `current` della risposta.
    ///
    /// Si legge prima `condition` (già normalizzata dal backend) e solo in
    /// mancanza di quella il codice WMO: il backend ha più fonti per decidere
    /// di quante ne abbia il client.
    static func from(_ current: ForecastCurrent?) -> SkyCondition {
        guard let current else { return .clear }

        switch current.condition.lowercased() {
        case "clear": return .clear
        case "cloudy", "fog": return .cloudy
        case "rain": return .rain
        case "snow": return .snow
        case "storm": return .storm
        default: break
        }

        return from(code: current.conditionCode)
    }

    /// Ripiego sul codice WMO, quando `condition` non dice niente di utile.
    static func from(code: String?) -> SkyCondition {
        guard let code, let wmo = Int(code) else { return .clear }
        switch wmo {
        case 0, 1: return .clear
        case 2, 3, 45, 48: return .cloudy
        case 71, 73, 75, 77, 85, 86: return .snow
        case 95, 96, 99: return .storm
        default: return .rain
        }
    }

    var label: String {
        switch self {
        case .clear: return "Sereno"
        case .cloudy: return "Nuvoloso"
        case .rain: return "Pioggia"
        case .snow: return "Neve"
        case .storm: return "Temporale"
        }
    }

    /// Il glifo grande e decorativo dell'hero.
    var heroSymbol: String {
        switch self {
        case .clear: return "sun.max.fill"
        case .cloudy: return "cloud.fill"
        case .rain: return "cloud.rain.fill"
        case .snow: return "snowflake"
        case .storm: return "cloud.bolt.rain.fill"
        }
    }
}

// MARK: - Tema

struct WeatherTheme {
    /// Sfondo pieno della pagina.
    let page: Color
    /// Tinta dell'hero e delle pillole selezionate.
    let hero: Color
    /// Inchiostro sull'hero: scuro della stessa famiglia, mai nero puro.
    let ink: Color
    /// Accento: grafico orario, ore selezionate, toggle.
    let accent: Color
    /// Colore del glifo decorativo dell'hero, più tenue dell'accento perché
    /// sta *dietro* al numero e non deve competerci.
    let glyph: Color

    static func of(_ condition: SkyCondition) -> WeatherTheme {
        switch condition {
        case .clear:
            return WeatherTheme(
                page: Color(hex: "FDF7F0"),
                hero: Color(hex: "FBDFBE"),
                ink: Color(hex: "4A2D1C"),
                accent: Color(hex: "E2704F"),
                glyph: Color(hex: "F0B47E")
            )
        case .cloudy:
            return WeatherTheme(
                page: Color(hex: "F5F5F8"),
                hero: Color(hex: "DFE3EC"),
                ink: Color(hex: "2E3440"),
                accent: Color(hex: "5E7191"),
                glyph: Color(hex: "5E7191").opacity(0.45)
            )
        case .rain:
            return WeatherTheme(
                page: Color(hex: "F1F5FA"),
                hero: Color(hex: "D5E4F3"),
                ink: Color(hex: "1F3040"),
                accent: Color(hex: "4A7FB5"),
                glyph: Color(hex: "4A7FB5").opacity(0.45)
            )
        case .snow:
            return WeatherTheme(
                page: Color(hex: "EFF4F8"),
                hero: Color(hex: "E2EDF4"),
                ink: Color(hex: "233846"),
                accent: Color(hex: "5A93B8"),
                glyph: Color(hex: "5A93B8").opacity(0.4)
            )
        case .storm:
            return WeatherTheme(
                page: Color(hex: "F4F2F8"),
                hero: Color(hex: "E2DCEF"),
                ink: Color(hex: "2B2440"),
                accent: Color(hex: "6D5BA6"),
                glyph: Color(hex: "6D5BA6").opacity(0.45)
            )
        }
    }
}

// MARK: - Neutri, semantici, misure

/// I token che non dipendono dalla condizione.
enum Duet {

    // Neutri
    static let ink = Color(hex: "2A2622")
    static let inkSecondary = Color(hex: "2A2622").opacity(0.55)
    static let inkTertiary = Color(hex: "2A2622").opacity(0.42)
    static let hairline = Color(hex: "2A2622").opacity(0.07)
    static let surface = Color.white
    /// Superficie *dentro* una card bianca: le metriche del dettaglio orario.
    static let surfaceInset = Color(hex: "FAF7F3")
    static let chip = Color(hex: "F5F1EC")

    // Semantici
    static let green = Color(hex: "22C55E")
    static let greenInk = Color(hex: "2F7D43")
    static let yellow = Color(hex: "C98A15")
    static let orangeRed = Color(hex: "C2543A")
    /// Blu del dato: probabilità di pioggia nelle righe dei giorni.
    static let dataBlue = Color(hex: "4A7FB5")

    // Tinte delle allerte
    static let tintYellow = Color(hex: "FBEED2")
    static let tintOrange = Color(hex: "F6D9CE")
    static let tintTeal = Color(hex: "DFEFEF")

    // Raggi
    static let rSmall: CGFloat = 14
    static let rCard: CGFloat = 20
    static let rPanel: CGFloat = 26
    static let rSheet: CGFloat = 28
    static let rHero: CGFloat = 30

    // Ombre
    static let shadowControl = Color.black.opacity(0.05)
    static let shadowCard = Color(hex: "281C14").opacity(0.06)
    static let shadowOpenCard = Color(hex: "281C14").opacity(0.13)

    // Animazioni
    static let toggle = Animation.easeInOut(duration: 0.18)
    static let section = Animation.spring(response: 0.35, dampingFraction: 0.85)
    static let cardExpand = Animation.spring(response: 0.38, dampingFraction: 0.82)
    static let themeChange = Animation.easeInOut(duration: 0.4)
}

// MARK: - Tipografia

extension Font {
    /// Il display del ridisegno.
    ///
    /// L'handoff indica Instrument Serif; qui si usa **New York**, il serif di
    /// sistema, come il documento stesso autorizza. Imbarcare un font per
    /// quattro numeri costerebbe un download e un caso di fallback in più,
    /// e New York è disegnato per queste dimensioni.
    static func duetDisplay(_ size: CGFloat) -> Font {
        .system(size: size, weight: .regular, design: .serif)
    }

    /// La UI: SF Pro, con i pesi dell'handoff.
    static func duetUI(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
}

// MARK: - Simboli meteo

/// Da codice WMO (o condizione testuale) al nome SF Symbol.
///
/// Viveva identica in quattro viste — `CurrentWeatherView`,
/// `HourlyForecastView`, `DailyForecastView`, `WeatherChartView` — che è il
/// modo in cui due schermate cominciano a mostrare icone diverse per la stessa
/// ora. Il ridisegno le fa convergere qui.
enum WeatherSymbol {
    static func name(for code: String?) -> String {
        guard let code else { return "cloud.sun.fill" }

        if let wmo = Int(code) {
            switch wmo {
            case 0: return "sun.max.fill"
            case 1, 2: return "cloud.sun.fill"
            case 3: return "cloud.fill"
            case 45, 48: return "cloud.fog.fill"
            case 51, 53, 55, 56, 57: return "cloud.drizzle.fill"
            case 61, 63, 65, 66, 67, 80, 81: return "cloud.rain.fill"
            case 71, 73, 75, 77, 85, 86: return "snowflake"
            case 82, 95, 96, 99: return "cloud.bolt.rain.fill"
            default: return "cloud.sun.fill"
            }
        }

        switch code.lowercased() {
        case "clear", "sunny": return "sun.max.fill"
        case "cloudy": return "cloud.fill"
        case "rain": return "cloud.rain.fill"
        case "snow": return "cloud.snow.fill"
        case "storm": return "cloud.bolt.rain.fill"
        case "fog": return "cloud.fog.fill"
        case "partly-cloudy", "partly cloudy": return "cloud.sun.fill"
        default: return "cloud.sun.fill"
        }
    }
}
