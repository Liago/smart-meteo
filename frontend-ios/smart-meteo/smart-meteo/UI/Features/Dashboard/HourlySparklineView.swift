import SwiftUI

/// La sezione «Ora per ora» della dashboard.
///
/// Rispetto al grafico precedente cambia una cosa sola ma decisiva: si
/// **trascina**. Il numero grande in cima non è la temperatura di adesso, è la
/// temperatura dell'ora che il dito sta toccando, e cambia mentre scorre. Un
/// grafico che si può solo guardare costringe a stimare i valori dall'altezza
/// della curva, che è esattamente ciò che un grafico dovrebbe risparmiare.
struct HourlySparklineView: View {
    /// Ridisegna quando cambiano le unità: le funzioni di formattazione
    /// leggono `UnitPrefs.shared` ma non possono osservarlo.
    @ObservedObject private var units = UnitPrefs.shared
    let hours: [HourlyForecast]
    let theme: WeatherTheme
    @Binding var scrubIndex: Int
    let onOpenDetail: () -> Void

    /// Altezza del tracciato, dall'handoff.
    private let chartHeight: CGFloat = 118

    private var selected: HourlyForecast? {
        guard hours.indices.contains(scrubIndex) else { return hours.first }
        return hours[scrubIndex]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            readout
            chart
            openButton
        }
    }

    // MARK: - Lettura

    private var readout: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(Self.formatTemp(selected?.temp))
                .font(.duetUI(30, .heavy))
                .tracking(-0.9)
                .foregroundColor(Duet.ink)
                .monospacedDigit()

            Text(hourLabel(for: scrubIndex))
                .font(.duetUI(13, .bold))
                .foregroundColor(theme.accent)

            Spacer(minLength: 4)

            Text(detailLine)
                .font(.duetUI(11.5))
                .foregroundColor(Duet.ink.opacity(0.5))
                .lineLimit(1)
        }
    }

    private var detailLine: String {
        guard let selected else { return "" }
        var parti: [String] = []
        if let prob = selected.precipitationProb {
            parti.append("pioggia \(Int(prob.rounded()))%")
        }
        if let wind = selected.windSpeed {
            parti.append("vento \(Units.windSpeed(fromMs: wind))")
        }
        return parti.joined(separator: " · ")
    }

    // MARK: - Grafico

    private var chart: some View {
        GeometryReader { geo in
            let points = Self.points(for: hours, in: geo.size)

            ZStack(alignment: .topLeading) {
                if points.count > 1 {
                    // Riempimento sotto la curva: dà volume senza aggiungere
                    // un secondo colore.
                    Path { path in
                        path.move(to: CGPoint(x: points[0].x, y: geo.size.height))
                        path.addLine(to: points[0])
                        path.appendSmoothCurve(through: points)
                        path.addLine(to: CGPoint(x: points[points.count - 1].x, y: geo.size.height))
                        path.closeSubpath()
                    }
                    .fill(
                        LinearGradient(
                            colors: [theme.accent.opacity(0.22), theme.accent.opacity(0)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )

                    Path.smoothCurve(through: points)
                        .stroke(theme.accent, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))

                    if points.indices.contains(scrubIndex) {
                        let p = points[scrubIndex]

                        // Guida tratteggiata: lega il pallino all'etichetta
                        // oraria in basso, che altrimenti andrebbe cercata.
                        Path { path in
                            path.move(to: CGPoint(x: p.x, y: 0))
                            path.addLine(to: CGPoint(x: p.x, y: geo.size.height))
                        }
                        .stroke(
                            theme.accent.opacity(0.45),
                            style: StrokeStyle(lineWidth: 1, dash: [3, 3])
                        )

                        Circle()
                            .fill(Duet.surface)
                            .overlay(Circle().strokeBorder(theme.accent, lineWidth: 3))
                            .frame(width: 12, height: 12)
                            .position(p)
                    }
                }
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        scrub(to: value.location.x, width: geo.size.width)
                    }
            )
        }
        .frame(height: chartHeight)
        .overlay(alignment: .bottom) {
            hourAxis
                .offset(y: 18)
        }
        .padding(.bottom, 20)
    }

    /// Etichette ogni tre ore: una per ora sarebbe illeggibile a questa
    /// larghezza, e il pallino dice comunque dove siamo.
    private var hourAxis: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach(Array(hours.enumerated()), id: \.offset) { index, hour in
                    if index % 3 == 0 {
                        Text(index == 0 ? "Ora" : Self.hourText(hour.time))
                            .font(.duetUI(10, .semibold))
                            .foregroundColor(Duet.ink.opacity(0.45))
                            .position(
                                x: Self.x(for: index, count: hours.count, width: geo.size.width),
                                y: 6
                            )
                    }
                }
            }
        }
        .frame(height: 14)
    }

    private var openButton: some View {
        Button(action: onOpenDetail) {
            Text("Apri dettaglio orario")
                .font(.duetUI(11.5, .bold))
                .foregroundColor(Color(hex: "7A4B32"))
                .padding(.vertical, 9)
                .padding(.horizontal, 14)
                .background(Capsule().fill(Color(hex: "F6EFE8")))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Scrubbing

    private func scrub(to x: CGFloat, width: CGFloat) {
        guard hours.count > 1, width > 0 else { return }
        let ratio = min(max(x / width, 0), 1)
        let index = Int((ratio * CGFloat(hours.count - 1)).rounded())
        guard index != scrubIndex else { return }
        HapticManager.selection()
        scrubIndex = index
    }

    private func hourLabel(for index: Int) -> String {
        guard index != 0 else { return "adesso" }
        guard hours.indices.contains(index) else { return "" }
        return Self.hourText(hours[index].time)
    }

    // MARK: - Geometria

    /// `x` di un indice, con i punti distribuiti su tutta la larghezza.
    static func x(for index: Int, count: Int, width: CGFloat) -> CGFloat {
        guard count > 1 else { return width / 2 }
        return width * CGFloat(index) / CGFloat(count - 1)
    }

    static func points(for hours: [HourlyForecast], in size: CGSize) -> [CGPoint] {
        guard hours.count > 1 else { return [] }

        let temps = hours.map(\.temp)
        let lo = temps.min() ?? 0
        let hi = temps.max() ?? 1
        // Una giornata piatta non deve diventare una riga schiacciata contro il
        // bordo: con un intervallo nullo la curva si centra.
        let span = max(hi - lo, 1)
        let top: CGFloat = 10
        let usable = max(size.height - top - 10, 1)

        return hours.enumerated().map { index, hour in
            let ratio = (hour.temp - lo) / span
            return CGPoint(
                x: x(for: index, count: hours.count, width: size.width),
                y: top + usable * (1 - ratio)
            )
        }
    }

    // MARK: - Formattazione

    /// L'ora si legge dai caratteri della chiave locale, mai con un parser ISO:
    /// il backend manda già l'ora della località, e interpretarla come data la
    /// sposterebbe nel fuso del telefono.
    static func hourText(_ slot: String) -> String {
        guard slot.count >= 16 else { return slot }
        let start = slot.index(slot.startIndex, offsetBy: 11)
        let end = slot.index(slot.startIndex, offsetBy: 16)
        return String(slot[start..<end])
    }

    static func formatTemp(_ value: Double?) -> String {
        Units.temp(value)
    }
}
