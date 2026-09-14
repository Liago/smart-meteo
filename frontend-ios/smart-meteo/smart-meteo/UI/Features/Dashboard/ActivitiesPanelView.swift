import SwiftUI

/// «Oggi è una buona giornata per…»
///
/// Gemello di `ActivitiesPanel.tsx`. Gli indici non vengono comprati da un'API
/// a consumo ma calcolati dai dati che già aggreghiamo: costo zero, e
/// soprattutto si può dire **perché** il punteggio è quello. Un indice a scatola
/// chiusa dà un numero e basta; qui accanto al numero c'è il fattore che lo
/// tiene basso, che è l'informazione su cui si decide se rimandare o cambiare
/// percorso.
struct ActivitiesPanelView: View {
    let activities: ActivitiesOutlook

    /// Icone SF per le tre attività del registro backend.
    static let icons = [
        "running": "figure.run",
        "cycling": "bicycle",
        "laundry": "tshirt.fill",
    ]

    /// Verdi, gialli e rossi sulle stesse fasce delle altre scale del progetto.
    static func color(for score: Double) -> Color {
        if score >= 75 { return Color(hex: "33B34D") }
        if score >= 50 { return Color(hex: "EAB308") }
        if score >= 25 { return Color(hex: "F97316") }
        return Color(hex: "E64033")
    }

    /// Il giorno valutato, quando non è oggi: di sera la finestra è di domani.
    static func dayNote(_ date: String, now: Date = Date()) -> String? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return date == formatter.string(from: now) ? nil : "domani"
    }

    /// La frase in cima, costruita sulla migliore delle tre.
    static func headline(_ best: ActivityScore) -> String {
        if best.score >= 75 {
            return "\(best.label.lowercased()): condizioni ottime"
        }
        if let limiting = best.limiting {
            return "Niente di ideale: limita \(limiting)"
        }
        return "Condizioni nella media"
    }

    var body: some View {
        if let best = activities.activities.first {
            GlassContainer {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Image(systemName: "figure.walk")
                            .font(.system(size: 13))
                            .foregroundColor(.gray)

                        Text("Buona giornata per…")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.black)

                        Spacer(minLength: 0)

                        if let note = Self.dayNote(activities.date) {
                            Text(note)
                                .font(.system(size: 11))
                                .foregroundColor(.gray)
                        }
                    }

                    Text(Self.headline(best))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.black)

                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(activities.activities) { activity in
                            row(activity)
                        }
                    }

                    Text("Punteggio sulle ore diurne, pari al fattore peggiore: una giornata perfetta sotto la pioggia non è mezza buona.")
                        .font(.system(size: 10))
                        .foregroundColor(.gray.opacity(0.8))
                }
            }
        }
    }

    @ViewBuilder
    private func row(_ activity: ActivityScore) -> some View {
        let tint = Self.color(for: activity.score)

        HStack(alignment: .center, spacing: 8) {
            Image(systemName: Self.icons[activity.id] ?? "figure.walk")
                .font(.system(size: 12))
                .foregroundColor(tint)
                .frame(width: 16)

            Text(activity.label)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.black)
                .lineLimit(1)

            Spacer(minLength: 0)

            if let limiting = activity.limiting {
                Text("limita \(limiting)")
                    .font(.system(size: 11))
                    .foregroundColor(.gray.opacity(0.8))
                    .lineLimit(1)
            }

            // La barra rende i tre confrontabili a colpo d'occhio, cosa che una
            // colonna di numeri non fa.
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.gray.opacity(0.15))
                    Capsule()
                        .fill(tint)
                        .frame(width: geo.size.width * min(1, max(0, activity.score / 100)))
                }
            }
            .frame(width: 56, height: 5)

            Text("\(Int(activity.score.rounded()))")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.black)
                .monospacedDigit()
                .frame(width: 24, alignment: .trailing)
        }
    }
}
