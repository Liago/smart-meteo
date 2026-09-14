import SwiftUI

/// Onde e temperatura dell'acqua.
///
/// Gemello di `SeaPanel.tsx`. Compare **solo sulle località costiere**, e il
/// test di costa non è nostro: il modello d'onda di Open-Meteo copre soltanto i
/// punti di griglia sul mare, e nell'entroterra il backend non manda affatto il
/// blocco. È più accurato di qualunque soglia sulla distanza dal mare che
/// avremmo potuto scegliere.
struct SeaPanelView: View {
    let sea: SeaOutlook

    private struct Row: Identifiable {
        var id: String { label }
        let label: String
        let value: String
        let hint: String?
        let color: Color?
    }

    // MARK: - Scala

    /// Soglie in metri, le stesse di `backend/utils/sea.ts`.
    ///
    /// Servono qui solo a dire se il picco atteso cambia fascia: il giudizio
    /// sull'ora corrente lo calcola il backend, e ricalcolarlo sul client
    /// significherebbe avere due verità sullo stesso numero.
    static let slightThreshold = 0.5
    static let moderateThreshold = 1.25
    static let roughThreshold = 2.5

    static func seaState(_ waveHeight: Double?) -> String {
        guard let waveHeight, waveHeight.isFinite else { return "calm" }
        if waveHeight >= roughThreshold { return "rough" }
        if waveHeight >= moderateThreshold { return "moderate" }
        if waveHeight >= slightThreshold { return "slight" }
        return "calm"
    }

    /// Le parole dei bollettini italiani, che chi va al mare riconosce.
    static let stateLabels = [
        "calm": "Calmo",
        "slight": "Poco mosso",
        "moderate": "Mosso",
        "rough": "Molto mosso",
    ]

    static let stateColors: [String: Color] = [
        "calm": Color(hex: "33B34D"),
        "slight": Color(hex: "7FC4E8"),
        "moderate": Color(hex: "F59E0B"),
        "rough": Color(hex: "C2410C"),
    ]

    // MARK: - Formattazione

    /// Metri con due decimali sotto il metro, uno sopra: sotto conta il centimetro.
    static func formatWave(_ value: Double?) -> String {
        guard let value else { return "—" }
        let decimals = value < 1 ? 2 : 1
        return String(format: "%.\(decimals)f m", value).replacingOccurrences(of: ".", with: ",")
    }

    /// Gradi interi: mezzo grado sull'acqua è precisione finta.
    static func formatSeaTemp(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int(value.rounded()))°"
    }

    static func formatHour(_ slot: String?) -> String? {
        guard let slot, slot.count >= 16 else { return nil }
        let start = slot.index(slot.startIndex, offsetBy: 11)
        let end = slot.index(slot.startIndex, offsetBy: 16)
        let hour = String(slot[start..<end])
        return hour.contains(":") ? hour : nil
    }

    /// Rosa dei venti a 8 punti per la provenienza dell'onda.
    ///
    /// Otto e non sedici: fra NNE e NE non cambia nulla per chi sceglie una
    /// spiaggia, e allunga solo l'etichetta.
    static func waveDirectionLabel(_ degrees: Double?) -> String? {
        guard let degrees, degrees.isFinite else { return nil }
        let points = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]
        let normalized = (degrees.truncatingRemainder(dividingBy: 360) + 360)
            .truncatingRemainder(dividingBy: 360)
        return points[Int((normalized / 45).rounded()) % 8]
    }

    /// La riga in cima: l'acqua quando la conosciamo, altrimenti lo stato.
    ///
    /// La temperatura viene prima perché è la prima domanda di chi va al mare —
    /// «si fa il bagno?» — e lo stato serve subito dopo.
    static func headline(_ sea: SeaOutlook) -> String {
        let stato = (stateLabels[sea.state] ?? sea.state).lowercased()
        if sea.seaTemperature != nil {
            return "Acqua a \(formatSeaTemp(sea.seaTemperature)), mare \(stato)"
        }
        return "Mare \(stato)"
    }

    /// L'avviso sul peggioramento, solo quando il massimo cambia fascia.
    ///
    /// Se il mare resta nella stessa fascia non c'è niente da dire: il numero è
    /// già nella riga dell'onda, e ripeterlo come avviso sarebbe un falso
    /// allarme.
    static func worseningNote(_ sea: SeaOutlook) -> String? {
        guard let maxWave = sea.maxWave24h else { return nil }

        let later = seaState(maxWave)
        if later == sea.state { return nil }

        let stato = (stateLabels[later] ?? later).lowercased()
        if let quando = formatHour(sea.maxWaveAt) {
            return "Verso le \(quando) diventa \(stato) (\(formatWave(maxWave)))"
        }
        return "In giornata diventa \(stato) (\(formatWave(maxWave)))"
    }

    // MARK: - Righe

    private var rows: [Row] {
        var rows: [Row] = []

        if sea.seaTemperature != nil {
            rows.append(Row(
                label: "Acqua",
                value: Self.formatSeaTemp(sea.seaTemperature),
                hint: nil,
                color: nil
            ))
        }
        if sea.waveHeight != nil {
            rows.append(Row(
                label: "Onda",
                value: Self.formatWave(sea.waveHeight),
                // La provenienza conta per scegliere la spiaggia: una costa al
                // riparo dal vento dominante resta calma anche col mare mosso.
                hint: Self.waveDirectionLabel(sea.waveDirection).map { "da \($0)" },
                color: Self.stateColors[sea.state]
            ))
        }
        if let swell = sea.swellHeight, swell > 0 {
            rows.append(Row(label: "Mare lungo", value: Self.formatWave(swell), hint: nil, color: nil))
        }

        return rows
    }

    var body: some View {
        GlassContainer {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Image(systemName: "water.waves")
                        .font(.system(size: 13))
                        .foregroundColor(.gray)

                    Text("Mare")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.black)

                    Spacer(minLength: 0)

                    Circle()
                        .fill(Self.stateColors[sea.state] ?? Color.gray)
                        .frame(width: 8, height: 8)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(Self.headline(sea))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.black)

                    if let worsening = Self.worseningNote(sea) {
                        Text(worsening)
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

                Text("Le maree non sono disponibili sul piano gratuito delle nostre fonti.")
                    .font(.system(size: 10))
                    .foregroundColor(.gray.opacity(0.8))
            }
        }
    }
}
