import SwiftUI

/// La sezione «Fonti dati», chiusa di default.
///
/// È metadato sulla previsione, non previsione: chi apre l'app vuole sapere che
/// tempo fa, quante fonti concordano lo va a cercare dopo. Ma **va tenuta**, e
/// in chiaro: l'indice di consenso è l'unica informazione che solo un
/// aggregatore possiede, e nasconderla del tutto butterebbe via la ragione per
/// cui questa app esiste invece di aprire quella del meteo di sistema.
struct SourcesSectionView: View {
    let sources: [String]
    let confidence: ConfidenceIndex?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let confidence {
                consensusBadge(confidence)
            }

            FlowLayout(spacing: 6) {
                ForEach(sources, id: \.self) { source in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(SourceStyle.color(for: source))
                            .frame(width: 7, height: 7)

                        Text(SourceStyle.name(for: source))
                            .font(.duetUI(11.5, .semibold))
                            .foregroundColor(Duet.ink.opacity(0.78))
                    }
                    .padding(.vertical, 6)
                    .padding(.horizontal, 11)
                    .background(Capsule().fill(Duet.chip))
                }
            }

            Text("Il punteggio misura quanto le fonti sono d'accordo sulla stessa previsione.")
                .font(.duetUI(10))
                .foregroundColor(Duet.ink.opacity(0.42))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func consensusBadge(_ confidence: ConfidenceIndex) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 8) {
                Circle()
                    .fill(Self.levelColor(confidence.level))
                    .frame(width: 8, height: 8)

                Text(Self.levelHeadline(confidence.level))
                    .font(.duetUI(13, .bold))
                    .foregroundColor(Duet.ink)

                Text("\(confidence.score)/100")
                    .font(.duetUI(12.5))
                    .foregroundColor(Duet.ink.opacity(0.5))
                    .monospacedDigit()
            }

            // L'intervallo in chiaro: un punteggio senza il suo intervallo è un
            // voto, non una misura.
            if let range = Self.temperatureRange(confidence) {
                Text(range)
                    .font(.duetUI(11))
                    .foregroundColor(Duet.ink.opacity(0.55))
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Self.levelTint(confidence.level))
        )
    }

    // MARK: - Etichette

    static func levelHeadline(_ level: String) -> String {
        switch level {
        case "high": return "Fonti concordi"
        case "medium": return "Fonti abbastanza d'accordo"
        default: return "Fonti in disaccordo"
        }
    }

    static func levelColor(_ level: String) -> Color {
        switch level {
        case "high": return Duet.green
        case "medium": return Duet.yellow
        default: return Duet.orangeRed
        }
    }

    static func levelTint(_ level: String) -> Color {
        switch level {
        case "high": return Color(hex: "EDF4EE")
        case "medium": return Duet.tintYellow
        default: return Duet.tintOrange
        }
    }

    /// «Temperatura prevista fra 23° e 26°», quando le fonti divergono
    /// abbastanza da rendere l'intervallo un'informazione.
    static func temperatureRange(_ confidence: ConfidenceIndex) -> String? {
        guard let spread = confidence.temperature else { return nil }
        let lo = Int(spread.min.rounded())
        let hi = Int(spread.max.rounded())
        guard hi > lo else { return "Tutte le fonti danno \(lo)°" }
        return "Temperatura prevista fra \(lo)° e \(hi)°"
    }

    /// Il riepilogo nell'intestazione della sezione.
    static func summary(sources: [String], confidence: ConfidenceIndex?) -> String {
        let fonti = "\(sources.count) attive"
        guard let confidence else { return fonti }
        return "\(fonti) · \(confidence.score)/100"
    }
}
