import SwiftUI

/// Orto e giardino: devo innaffiare?
///
/// Gemello di `GardenPanel.tsx`. Open-Meteo espone gratuitamente umidità del
/// suolo, evapotraspirazione di riferimento FAO e temperatura dello strato
/// radicale, sullo stesso endpoint che interroghiamo già: rispondono a una
/// domanda che il meteo normale non copre — non «che tempo fa» ma «devo
/// prendere l'annaffiatoio stasera».
///
/// Il riquadro compare ovunque quei dati esistano, anche quando la risposta è
/// «non serve»: a differenza di quello sulla neve, qui il caso tranquillo **è**
/// la risposta che si cerca.
struct GardenPanelView: View {
    let garden: GardenOutlook

    private struct Row: Identifiable {
        var id: String { label }
        let label: String
        let value: String
        let hint: String?
        let color: Color?
    }

    // MARK: - Etichette

    private static let moistureLabels = [
        "very_dry": "Molto secco",
        "dry": "Asciutto",
        "adequate": "Umidità adeguata",
        "wet": "Molto umido",
    ]

    private static let moistureColors: [String: Color] = [
        "very_dry": Color(hex: "C2410C"),
        "dry": Color(hex: "F59E0B"),
        "adequate": Color(hex: "33B34D"),
        "wet": Color(hex: "0EA5E9"),
    ]

    private static let adviceHeadlines = [
        "rain_expected": "Non innaffiare: ci pensa la pioggia",
        "water_now": "Da innaffiare oggi",
        "water_soon": "Da innaffiare entro un giorno o due",
        "not_needed": "Non serve innaffiare",
    ]

    private static let adviceColors: [String: Color] = [
        "rain_expected": Color(hex: "0EA5E9"),
        "water_now": Color(hex: "C2410C"),
        "water_soon": Color(hex: "F59E0B"),
        "not_needed": Color(hex: "33B34D"),
    ]

    // MARK: - Formattazione

    /// Millimetri con un decimale, all'italiana.
    static func formatMm(_ value: Double?) -> String {
        guard let value else { return "—" }
        return String(format: "%.1f mm", value).replacingOccurrences(of: ".", with: ",")
    }

    /// Umidità volumetrica come percentuale di volume.
    ///
    /// 0.25 m³/m³ vuol dire che un quarto del volume del terreno è acqua:
    /// scritto «25%» lo capisce chiunque, scritto «0,25 m³/m³» quasi nessuno.
    static func formatMoisture(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int((value * 100).rounded()))% vol."
    }

    /// Gradi interi: il decimale su una media del suolo è precisione finta.
    static func formatSoilTemp(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int(value.rounded()))°"
    }

    /// La riga sotto al titolo: perché il consiglio è quello.
    ///
    /// Un consiglio che non mostra il proprio motivo è un oracolo, e nessuno si
    /// fida di un oracolo sull'orto.
    static func adviceReason(_ garden: GardenOutlook) -> String? {
        if garden.advice == "rain_expected", let rain = garden.rainMm {
            return "Attesi \(formatMm(rain)) nelle prossime 24 ore"
        }
        if let balance = garden.waterBalanceMm, balance > 0 {
            return "Il terreno perde \(formatMm(balance)) più di quanti ne riceve"
        }
        if garden.moistureLevel == "wet" {
            return "Il terreno è già saturo"
        }
        if let balance = garden.waterBalanceMm, balance <= 0,
           let rain = garden.rainMm, rain > 0 {
            return "La pioggia attesa copre l'evaporazione"
        }
        return nil
    }

    /// La frase sulla semina, o nil quando il dato manca.
    static func sowingSentence(_ garden: GardenOutlook) -> String? {
        guard let ok = garden.sowingOk, let temp = garden.soilTemperature else { return nil }
        return ok
            ? "Suolo a \(formatSoilTemp(temp)): si può seminare"
            : "Suolo a \(formatSoilTemp(temp)): ancora freddo per seminare"
    }

    // MARK: - Righe

    private var rows: [Row] {
        var rows: [Row] = []

        if let level = garden.moistureLevel {
            rows.append(Row(
                label: "Terreno",
                value: Self.moistureLabels[level] ?? level,
                // Il numero grezzo resta accanto al giudizio: la soglia di
                // «asciutto» dipende dal tipo di suolo, che l'API non dichiara,
                // e chi conosce il proprio terreno deve poterla correggere.
                hint: Self.formatMoisture(garden.soilMoisture),
                color: Self.moistureColors[level]
            ))
        }
        if let et0 = garden.evapotranspirationMm {
            rows.append(Row(label: "Evaporazione attesa", value: Self.formatMm(et0), hint: "in 24 ore", color: nil))
        }
        if let rain = garden.rainMm, rain > 0 {
            rows.append(Row(label: "Pioggia attesa", value: Self.formatMm(rain), hint: "in 24 ore", color: nil))
        }

        return rows
    }

    var body: some View {
        GlassContainer {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Image(systemName: "leaf.fill")
                        .font(.system(size: 13))
                        .foregroundColor(.gray)

                    Text("Orto e giardino")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.black)

                    Spacer(minLength: 0)

                    Circle()
                        .fill(Self.adviceColors[garden.advice] ?? Color.gray)
                        .frame(width: 8, height: 8)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(Self.adviceHeadlines[garden.advice] ?? garden.advice)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.black)

                    if let reason = Self.adviceReason(garden) {
                        Text(reason)
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    ForEach(rows) { row in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(row.label)
                                .font(.system(size: 12))
                                .foregroundColor(.gray)

                            Spacer(minLength: 0)

                            if let hint = row.hint {
                                Text(hint)
                                    .font(.system(size: 11))
                                    .foregroundColor(.gray.opacity(0.8))
                            }

                            Text(row.value)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(row.color ?? .black)
                                .monospacedDigit()
                        }
                    }
                }

                if let sowing = Self.sowingSentence(garden) {
                    Text(sowing)
                        .font(.system(size: 11))
                        .foregroundColor(.gray)
                }

                Text("L'umidità è in percentuale di volume: le soglie dipendono dal tipo di terreno.")
                    .font(.system(size: 10))
                    .foregroundColor(.gray.opacity(0.8))
            }
        }
    }
}
