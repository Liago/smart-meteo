import SwiftUI

/// Neve e gelate nelle prossime 24 ore, in parità logica con il componente web
/// `SnowPanel`.
///
/// "Zero termico a 1500 m" è un dato da bollettino: quello che serve sapere è se
/// a *casa propria* verrà giù neve o acqua. Il backend conosce la quota del
/// punto di griglia — la dichiara Open-Meteo insieme alla previsione — e la usa
/// per rispondere; qui si mostra il confronto, perché è la ragione per cui il
/// numero ha senso.
///
/// Il riquadro compare solo quando il backend manda il blocco, e il backend lo
/// manda solo quando c'è qualcosa da dire: senza questa regola resterebbe un
/// riquadro vuoto per otto mesi l'anno.
struct SnowPanelView: View {
    let snow: SnowOutlook

    private struct Row: Identifiable {
        var id: String { label }
        let label: String
        let value: String
        let hint: String?
    }

    // MARK: - Etichette

    static let phaseLabels = [
        "snow": "Neve",
        "sleet": "Neve mista a pioggia",
        "rain": "Pioggia",
    ]

    static let frostLabels = [
        "none": "Nessun rischio",
        "possible": "Brina possibile",
        "likely": "Gelata probabile",
        "severe": "Gelata forte",
    ]

    static let frostColors: [String: Color] = [
        "none": Color.gray.opacity(0.4),
        "possible": Color(red: 0.50, green: 0.77, blue: 0.91),
        "likely": Color(red: 0.24, green: 0.56, blue: 0.84),
        "severe": Color(red: 0.17, green: 0.31, blue: 0.66),
    ]

    // MARK: - Formattazione

    /// Metri, con il raggruppamento italiano.
    ///
    /// Scritto a mano invece che con un `NumberFormatter` localizzato perché la
    /// regola italiana non raggruppa i numeri a quattro cifre: "quota neve
    /// 1800 m" è la forma dei bollettini, il punto compare da cinque cifre in su.
    /// Un formatter di sistema la applica o no a seconda della versione di ICU,
    /// e il testo cambierebbe fra dispositivi.
    static func formatAltitude(_ meters: Double?) -> String {
        guard let meters else { return "—" }
        let rounded = Int(meters.rounded())
        let digits = String(abs(rounded))
        guard digits.count >= 5 else { return "\(rounded) m" }

        var grouped = ""
        for (index, character) in digits.enumerated() {
            if index > 0, (digits.count - index) % 3 == 0 { grouped.append(".") }
            grouped.append(character)
        }
        return "\(rounded < 0 ? "-" : "")\(grouped) m"
    }

    /// Centimetri: sotto i dieci conservano un decimale, con la virgola.
    static func formatCm(_ value: Double?) -> String {
        guard let value else { return "—" }
        if value >= 10 { return "\(Int(value.rounded())) cm" }
        return String(format: "%.1f cm", value).replacingOccurrences(of: ".", with: ",")
    }

    /// Gradi interi: mezzo grado di precisione su una minima è finta.
    static func formatTemp(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int(value.rounded()))°"
    }

    /// Ora dello slot, dalla chiave locale `YYYY-MM-DDTHH:00`.
    ///
    /// Non passa da `DateFormatter`: la chiave è già in ora locale della
    /// località, e reinterpretarla nel fuso del dispositivo sposterebbe
    /// l'orario di chi guarda da un'altra parte del mondo.
    static func formatHour(_ slot: String?) -> String? {
        guard let slot, let separator = slot.firstIndex(of: "T") else { return nil }
        let time = slot[slot.index(after: separator)...]
        return time.count >= 5 ? String(time.prefix(5)) : nil
    }

    /// La minima, scritta per intero.
    ///
    /// Dichiarare "al suolo" non è pedanteria: le due misure differiscono di
    /// tre o quattro gradi nelle notti serene, e il backend le giudica con
    /// soglie diverse. Senza la precisazione, "minima 1°" sembrerebbe un dato
    /// dell'aria che non allarma.
    static func frostMinimum(_ snow: SnowOutlook) -> String {
        let etichetta = snow.frost.source == "soil" ? "minima al suolo" : "minima"
        guard let minTemp = snow.frost.minTemp else { return "\(etichetta) sotto zero" }

        let quando = formatHour(snow.frost.at).map { " alle \($0)" } ?? ""
        return "\(etichetta) \(formatTemp(minTemp))\(quando)"
    }

    /// La frase sul rischio gelate, o nil quando non ce n'è uno.
    static func frostSentence(_ snow: SnowOutlook) -> String? {
        let level = snow.frost.level
        guard level != "none" else { return nil }

        let minima = frostMinimum(snow)

        switch level {
        case "severe": return "Gelata forte in arrivo, \(minima)"
        case "likely": return "Gelata probabile, \(minima)"
        default: return "Possibile brina, \(minima)"
        }
    }

    /// La riga in cima al riquadro.
    ///
    /// L'ordine di priorità è quello dell'impatto: prima cosa cade qui adesso,
    /// poi quanta neve è attesa, poi quella già a terra, e solo alla fine le
    /// gelate — che restano comunque l'unico motivo per cui il riquadro compare
    /// in pianura.
    static func headline(_ snow: SnowOutlook) -> String {
        let attesa = (snow.snowfallCm.map { $0 > 0 } ?? false) ? formatCm(snow.snowfallCm) : nil

        if snow.phase == "snow" {
            return attesa.map { "Neve prevista, circa \($0)" } ?? "Le precipitazioni cadono come neve"
        }
        if snow.phase == "sleet" {
            return "Sei al limite della quota neve: pioggia mista"
        }
        if let attesa {
            return "Neve prevista in quota, circa \(attesa)"
        }
        if let depth = snow.snowDepthCm, depth >= 1 {
            return "\(formatCm(depth)) di neve al suolo"
        }
        return frostSentence(snow) ?? "Nessuna segnalazione"
    }

    // MARK: - Righe

    private var rows: [Row] {
        var rows: [Row] = []

        if let line = snow.snowLine {
            rows.append(Row(
                label: "Quota neve",
                value: Self.formatAltitude(line),
                // Il confronto con l'altitudine è tutto il punto: senza, il
                // numero sopra resta un dato da bollettino.
                hint: snow.elevation.map { "sei a \(Self.formatAltitude($0))" }
            ))
        }
        if let phase = snow.phase, let label = Self.phaseLabels[phase] {
            rows.append(Row(label: "Alla tua quota", value: label, hint: nil))
        }
        if let fall = snow.snowfallCm, fall > 0 {
            rows.append(Row(label: "Neve prevista", value: Self.formatCm(fall), hint: "in 24 ore"))
        }
        if let depth = snow.snowDepthCm, depth >= 1 {
            rows.append(Row(label: "Neve al suolo", value: Self.formatCm(depth), hint: nil))
        }
        if snow.frost.level != "none" {
            rows.append(Row(
                label: "Gelate",
                value: Self.frostLabels[snow.frost.level] ?? snow.frost.level,
                hint: Self.frostMinimum(snow)
            ))
        }

        return rows
    }

    var body: some View {
        GlassContainer {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Image(systemName: "snowflake")
                        .font(.system(size: 13))
                        .foregroundColor(.gray)

                    Text("Neve e gelate")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.black)

                    Spacer(minLength: 0)

                    Circle()
                        .fill(Self.frostColors[snow.frost.level] ?? Color.gray.opacity(0.4))
                        .frame(width: 8, height: 8)
                }

                Text(Self.headline(snow))
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.black)

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
                                .foregroundColor(.black)
                                .monospacedDigit()
                        }
                    }
                }

                Text("Previsione sulle prossime 24 ore. La quota neve è stimata dallo zero termico dei modelli.")
                    .font(.system(size: 10))
                    .foregroundColor(.gray.opacity(0.8))
            }
        }
    }
}
