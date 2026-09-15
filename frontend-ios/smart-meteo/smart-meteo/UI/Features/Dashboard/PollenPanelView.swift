import SwiftUI

/// Pollini per specie.
///
/// Gemello di `PollenPanel.tsx`. Il dato è modellato dal CAMS europeo: in Italia
/// è stagionale e molto concreto — olivo e graminacee in primavera, ambrosia a
/// fine estate.
///
/// Si mostra il **massimo previsto in giornata**, non il valore dell'ora: chi è
/// allergico decide la mattina se uscire, e sapere che il picco arriva a
/// mezzogiorno è l'informazione utile.
struct PollenPanelView: View {
    let pollen: [PollenReading]

    /// Ordine di gravità, per portare in cima la specie che pesa oggi.
    static let rank: [String: Int] = [
        "very_high": 4,
        "high": 3,
        "moderate": 2,
        "low": 1,
        "none": 0,
    ]

    static let labels: [String: String] = [
        "none": "Assente",
        "low": "Basso",
        "moderate": "Moderato",
        "high": "Alto",
        "very_high": "Molto alto",
    ]

    static let colors: [String: Color] = [
        "none": Color.gray.opacity(0.35),
        "low": Color(hex: "33B34D"),
        "moderate": Color(hex: "CA8A04"),
        "high": Color(hex: "F28C26"),
        "very_high": Color(hex: "E64033"),
    ]

    /// Le specie a zero non spariscono — l'assenza è un'informazione — ma
    /// finiscono in fondo.
    private var ordered: [PollenReading] {
        pollen.sorted { (Self.rank[$0.dailyLevel] ?? 0) > (Self.rank[$1.dailyLevel] ?? 0) }
    }

    /// Granuli/m³: sotto i dieci conservano un decimale, con la virgola.
    private func formatGrains(_ value: Double?) -> String {
        guard let value else { return "—" }
        if value >= 10 { return "\(Int(value.rounded()))" }
        return String(format: "%.1f", value).replacingOccurrences(of: ".", with: ",")
    }

    var body: some View {
        if pollen.isEmpty {
            // Fuori dalla copertura del modello il backend omette il blocco:
            // uno zero direbbe «nessun polline» invece di «non lo sappiamo».
            EmptyView()
        } else {
            let ordered = self.ordered
            let peak = ordered.first
            let quiet = peak.map { $0.dailyLevel == "none" } ?? true

            GlassContainer {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Pollini")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.black)

                        Spacer(minLength: 8)

                        Text(quiet
                             ? "Nessuna specie rilevante oggi"
                             : "Oggi soprattutto \(peak?.label.lowercased() ?? "")")
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.trailing)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(ordered) { reading in
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(Self.colors[reading.dailyLevel] ?? Color.gray.opacity(0.35))
                                    .frame(width: 8, height: 8)

                                Text(reading.label)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(.black)

                                Spacer(minLength: 0)

                                Text(Self.labels[reading.dailyLevel] ?? reading.dailyLevel)
                                    .font(.system(size: 11))
                                    .foregroundColor(.gray)

                                Text("max \(formatGrains(reading.dailyMax))")
                                    .font(.system(size: 11))
                                    .foregroundColor(.gray.opacity(0.8))
                                    .monospacedDigit()
                                    .frame(width: 64, alignment: .trailing)
                            }
                        }
                    }

                    Text("Massimo previsto oggi in granuli/m³. Le soglie sono diverse per ogni specie.")
                        .font(.system(size: 10))
                        .foregroundColor(.gray.opacity(0.8))
                }
            }
        }
    }
}
