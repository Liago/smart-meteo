import SwiftUI

/// Fonti che hanno contribuito alla previsione, con l'indice di consenso.
///
/// Gemello di `SourcesIndicator.tsx` sul web, e chiude un'asimmetria dichiarata
/// dalla Fase 6A: iOS non mostrava nemmeno `sources_used`, e l'indice di
/// consenso — l'informazione più distintiva che possiede un aggregatore, cioè
/// **quanto le fonti sono d'accordo** — arrivava già nel modello Swift senza
/// che nessuna vista lo leggesse.
struct SourcesIndicatorView: View {
    /// Ridisegna quando cambiano le unità: le funzioni di formattazione
    /// leggono `UnitPrefs.shared` ma non possono osservarlo.
    @ObservedObject private var units = UnitPrefs.shared
    let sources: [String]
    let confidence: ConfidenceIndex?

    /// Sotto questo scarto fra la fonte più fredda e la più calda l'intervallo
    /// non si mostra: mezzo grado di differenza non è un disaccordo, è
    /// arrotondamento, e scriverlo suggerirebbe un'incertezza che non c'è.
    private static let minRangeToShow: Double = 1

    var body: some View {
        GlassContainer {
            VStack(alignment: .leading, spacing: 12) {
                header

                if let confidence {
                    consensusBadge(confidence)
                }

                sourceChips
            }
        }
    }

    // MARK: - Sezioni

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("FONTI CONTRIBUENTI")
                .font(.system(size: 11, weight: .semibold))
                .kerning(0.6)
                .foregroundColor(.gray)

            Spacer(minLength: 0)

            HStack(spacing: 5) {
                Circle()
                    .fill(SourceStyle.activeGreen)
                    .frame(width: 6, height: 6)
                Text("\(sources.count) attive")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(SourceStyle.activeGreen)
            }
        }
    }

    @ViewBuilder
    private func consensusBadge(_ confidence: ConfidenceIndex) -> some View {
        let level = ConsensusLevel(rawValue: confidence.level) ?? .medium

        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Circle()
                    .fill(level.color)
                    .frame(width: 8, height: 8)

                Text(level.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.black)

                Text("\(confidence.score)/100")
                    .font(.system(size: 13))
                    .foregroundColor(.gray)

                Spacer(minLength: 0)
            }

            // L'intervallo fra la fonte più fredda e la più calda è il modo più
            // concreto di mostrare il disaccordo: più del punteggio da solo.
            if let range = confidence.temperature, range.max - range.min >= Self.minRangeToShow {
                Text("Temperatura prevista fra \(Units.temp(range.min)) e \(Units.temp(range.max))")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.blue.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var sourceChips: some View {
        // `FlowLayout` manda a capo: con i cinque modelli Open-Meteo accanto
        // agli altri provider le etichette non stanno su una riga sola.
        FlowLayout(spacing: 6) {
            ForEach(sources, id: \.self) { source in
                HStack(spacing: 5) {
                    Circle()
                        .fill(SourceStyle.color(for: source))
                        .frame(width: 7, height: 7)
                    Text(SourceStyle.name(for: source))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.black.opacity(0.75))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.blue.opacity(0.06))
                .clipShape(Capsule())
            }
        }
    }
}

/// Livello di accordo fra le fonti.
private enum ConsensusLevel: String {
    case high
    case medium
    case low

    var label: String {
        switch self {
        case .high: return "Fonti concordi"
        case .medium: return "Accordo parziale"
        case .low: return "Fonti in disaccordo"
        }
    }

    var color: Color {
        switch self {
        case .high: return Color(hex: "22C55E")
        case .medium: return Color(hex: "F7B228")
        case .low: return Color(hex: "EC685A")
        }
    }
}

/// Nomi e colori delle fonti.
///
/// Le stesse etichette del web: senza una voce qui comparirebbe l'id grezzo
/// (`apple_weatherkit`). I cinque modelli Open-Meteo condividono la famiglia
/// dei viola, perché sono fonti indipendenti ma della stessa provenienza.
enum SourceStyle {
    static let activeGreen = Color(hex: "22C55E")

    private static let names: [String: String] = [
        "apple_weatherkit": "Apple WeatherKit",
        "open-meteo:icon_d2": "ICON-D2",
        "open-meteo:icon_eu": "ICON-EU",
        "open-meteo:ecmwf": "ECMWF",
        "open-meteo:meteofrance": "Météo-France",
        "open-meteo:gfs": "GFS",
        "tomorrow.io": "Tomorrow.io",
        "open-meteo": "Open-Meteo",
        "openweathermap": "OpenWeather",
        "weatherapi": "WeatherAPI",
        "accuweather": "AccuWeather",
        "worldweatheronline": "World Weather Online",
        "weatherstack": "WeatherStack",
        "meteostat": "Meteostat",
    ]

    private static let colors: [String: Color] = [
        "apple_weatherkit": Color(hex: "334155"),
        "open-meteo:icon_d2": Color(hex: "7E22CE"),
        "open-meteo:icon_eu": Color(hex: "9333EA"),
        "open-meteo:ecmwf": Color(hex: "8B5CF6"),
        "open-meteo:meteofrance": Color(hex: "6366F1"),
        "open-meteo:gfs": Color(hex: "D946EF"),
        "tomorrow.io": Color(hex: "3B82F6"),
        "open-meteo": Color(hex: "A855F7"),
        "openweathermap": Color(hex: "F97316"),
        "weatherapi": Color(hex: "22C55E"),
        "accuweather": Color(hex: "EF4444"),
        "worldweatheronline": Color(hex: "14B8A6"),
        "weatherstack": Color(hex: "F59E0B"),
        "meteostat": Color(hex: "78716C"),
    ]

    static func name(for source: String) -> String {
        names[source] ?? source
    }

    static func color(for source: String) -> Color {
        colors[source] ?? Color.gray
    }
}

/// Disposizione a capo automatico per le etichette delle fonti.
///
/// SwiftUI non ha un flow layout nativo: un `HStack` con nove fonti le
/// comprimerebbe fino a renderle illeggibili, e una `LazyVGrid` a colonne fisse
/// sprecherebbe spazio perché i nomi hanno lunghezze molto diverse
/// ("GFS" contro "World Weather Online").
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let rows = arrange(subviews: subviews, in: width)
        let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = arrange(subviews: subviews, in: bounds.width)
        var y = bounds.minY

        for row in rows {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(
                    at: CGPoint(x: x, y: y),
                    proposal: ProposedViewSize(size)
                )
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(subviews: Subviews, in width: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row()

        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = current.indices.isEmpty ? size.width : current.width + spacing + size.width

            if needed > width, !current.indices.isEmpty {
                rows.append(current)
                current = Row()
            }

            current.width = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            current.height = max(current.height, size.height)
            current.indices.append(index)
        }

        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}
