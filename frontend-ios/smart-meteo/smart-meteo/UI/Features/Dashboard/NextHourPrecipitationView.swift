import SwiftUI

/// Nowcast al minuto per la prossima ora (dataset `forecastNextHour` di Apple
/// WeatherKit), in parità logica con il componente web `NextHourPrecipitation`.
///
/// La vista ragiona in minuti da adesso e non in orari assoluti: i timestamp di
/// WeatherKit sono istanti UTC, quindi l'offset da `Date()` è corretto a
/// prescindere dal fuso della località, mentre l'ora di orologio mostrata
/// accanto al titolo usa il fuso del dispositivo.
struct NextHourPrecipitationView: View {
    let data: ForecastNextHour

    /// Quanti minuti mostrare al massimo: WeatherKit ne manda 60-75.
    private static let windowMinutes = 60

    /// Riferimento minimo della scala verticale, in mm/h.
    ///
    /// Senza un minimo, una pioviggine da 0.2 mm/h riempirebbe tutto il grafico
    /// e sembrerebbe un nubifragio; con un minimo troppo alto sarebbe
    /// invisibile. 1 mm/h è il compromesso, e il picco reale è comunque scritto
    /// sotto al titolo.
    private static let scaleFloorMmH: Double = 1

    /// Minuti asciutti consecutivi necessari per dichiarare finita la pioggia:
    /// con una soglia di un solo minuto, un buco isolato nei dati annuncerebbe
    /// "smette fra 3 minuti" in mezzo a un rovescio.
    private static let dryRunMinutes = 3

    private struct Slot: Identifiable {
        var id: String { startTime }
        let startTime: String
        let offset: Int
        let intensity: Double
        let chance: Double
        let wet: Bool
    }

    private var slots: [Slot] {
        let now = Date()
        return data.minutes.compactMap { minute -> Slot? in
            guard let time = Self.parseInstant(minute.startTime) else { return nil }
            let offset = Int((time.timeIntervalSince(now) / 60).rounded())
            // WeatherKit include qualche minuto già passato: si scarta.
            guard offset >= 0, offset < Self.windowMinutes else { return nil }
            return Slot(
                startTime: minute.startTime,
                offset: offset,
                intensity: minute.precipitationIntensity,
                chance: minute.precipitationChance,
                wet: minute.precipitationIntensity >= PrecipIntensity.Threshold.light
            )
        }
        .sorted { $0.offset < $1.offset }
    }

    var body: some View {
        let slots = self.slots

        if slots.isEmpty {
            EmptyView()
        } else {
            let headline = Self.headline(for: slots)
            let hasRain = slots.contains(where: { $0.wet })

            GlassContainer {
                VStack(alignment: .leading, spacing: hasRain ? 10 : 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Image(systemName: hasRain ? "cloud.rain.fill" : "cloud.sun.fill")
                            .font(.system(size: 13))
                            .foregroundColor(.gray)

                        Text(headline.title)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.black)

                        if let detail = headline.detail {
                            Text(detail)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(.gray)
                        }

                        Spacer(minLength: 0)
                    }

                    if hasRain {
                        Text(Self.meta(for: slots))
                            .font(.system(size: 11))
                            .foregroundColor(.gray)

                        chart(slots)

                        HStack {
                            Text("Adesso")
                            Spacer()
                            Text("+30 min")
                            Spacer()
                            Text("+1 h")
                        }
                        .font(.system(size: 10))
                        .foregroundColor(.gray.opacity(0.8))
                    } else {
                        Text("Nowcast al minuto")
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                    }
                }
            }
        }
    }

    // MARK: - Grafico

    private func chart(_ slots: [Slot]) -> some View {
        let peak = slots.map(\.intensity).max() ?? 0
        let scaleMax = Swift.max(peak, Self.scaleFloorMmH)

        return GeometryReader { geo in
            HStack(alignment: .bottom, spacing: 1) {
                ForEach(slots) { slot in
                    RoundedRectangle(cornerRadius: 1)
                        .fill(PrecipIntensity.classify(slot.intensity).color)
                        .frame(
                            height: slot.wet
                                // Minimo 5 pt perché la pioggia debole resti visibile.
                                ? Swift.max(5, geo.size.height * slot.intensity / scaleMax)
                                // Traccia della linea di base sui minuti asciutti.
                                : 2
                        )
                }
            }
            .frame(height: geo.size.height, alignment: .bottom)
        }
        .frame(height: 64)
    }

    // MARK: - Testi

    private struct Headline {
        let title: String
        let detail: String?
    }

    /// Il titolo è dedotto dai minuti e non dal campo `summary` di WeatherKit:
    /// i due possono discordare, e i minuti sono ciò che disegniamo.
    private static func headline(for slots: [Slot]) -> Headline {
        guard let firstWet = slots.first(where: { $0.wet }) else {
            return Headline(title: "Nessuna precipitazione nella prossima ora", detail: nil)
        }

        if slots[0].wet {
            guard let stop = firstDryRun(slots, run: dryRunMinutes) else {
                return Headline(title: "Precipitazioni per tutta la prossima ora", detail: nil)
            }
            return Headline(
                title: "Smette \(relative(stop.offset))",
                detail: clock(stop.startTime).map { "verso le \($0)" }
            )
        }

        return Headline(
            title: "Inizia \(relative(firstWet.offset))",
            detail: clock(firstWet.startTime).map { "alle \($0)" }
        )
    }

    private static func meta(for slots: [Slot]) -> String {
        let peak = slots.map(\.intensity).max() ?? 0
        let chance = slots.map(\.chance).max() ?? 0
        return "Picco \(formatMmPerHour(peak)) · probabilità max \(Int(chance.rounded()))%"
    }

    /// Primo minuto da cui inizia una sequenza di almeno `run` minuti asciutti.
    /// Nil se la pioggia non si interrompe mai abbastanza a lungo.
    private static func firstDryRun(_ slots: [Slot], run: Int) -> Slot? {
        for (index, slot) in slots.enumerated() where !slot.wet {
            // Vicino al bordo della finestra i minuti mancanti non contano come
            // pioggia: una pausa che arriva a fine finestra è comunque una pausa.
            let window = slots[index..<Swift.min(index + run, slots.count)]
            if window.allSatisfy({ !$0.wet }) { return slot }
        }
        return nil
    }

    private static func relative(_ offset: Int) -> String {
        if offset <= 0 { return "adesso" }
        if offset == 1 { return "fra un minuto" }
        return "fra \(offset) minuti"
    }

    /// mm/h in italiano, con un decimale solo quando serve: "0,4" / "6" mm/h.
    private static func formatMmPerHour(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "it_IT")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 1
        let text = formatter.string(from: NSNumber(value: value)) ?? String(format: "%.1f", value)
        return "\(text) mm/h"
    }

    /// Istante ISO8601 di WeatherKit, con o senza frazioni di secondo.
    private static func parseInstant(_ iso: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: iso) { return date }
        return ISO8601DateFormatter().date(from: iso)
    }

    private static func clock(_ iso: String) -> String? {
        guard let date = parseInstant(iso) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "it_IT")
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

#Preview {
    ZStack {
        Color(red: 252/255, green: 249/255, blue: 246/255)
            .ignoresSafeArea()
        NextHourPrecipitationView(data: previewNextHour())
            .padding()
    }
}

/// Rovescio che inizia fra 12 minuti e dura mezz'ora.
private func previewNextHour() -> ForecastNextHour {
    let now = Date()
    let minutes = (0..<60).map { offset -> MinutelyPrecipitation in
        let raining = (12...40).contains(offset)
        return MinutelyPrecipitation(
            startTime: ISO8601DateFormatter().string(from: now.addingTimeInterval(Double(offset) * 60)),
            precipitationChance: raining ? 80 : 0,
            precipitationIntensity: raining ? 2.4 : 0
        )
    }
    return ForecastNextHour(summary: [], minutes: minutes)
}
