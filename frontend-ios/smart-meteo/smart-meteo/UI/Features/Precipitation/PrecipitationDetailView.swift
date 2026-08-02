import SwiftUI
import Charts

/// Dettaglio delle precipitazioni previste: strip dei giorni, grafico a barre
/// dei millimetri con le bande di intensità e grafico della probabilità.
///
/// È l'unica schermata dell'app che usa Swift Charts. Gli altri grafici sono
/// `Canvas` scritti a mano e restano tali: qui serve la selezione per tap e
/// trascinamento, che `.chartXSelection` risolve con un hit-testing corretto,
/// mentre a mano andrebbe costruita dentro una ScrollView orizzontale.
struct PrecipitationDetailView: View {
    let hourly: [HourlyForecast]
    let daily: [DailyForecast]?

    @Environment(\.dismiss) private var dismiss
    @State private var selectedDate: String
    @State private var selectedHour: Int?

    private let cream = Color(red: 252 / 255, green: 249 / 255, blue: 246 / 255)
    private let coral = Color(red: 236 / 255, green: 104 / 255, blue: 90 / 255)

    init(hourly: [HourlyForecast], daily: [DailyForecast]?, initialDate: String) {
        self.hourly = hourly
        self.daily = daily

        let covered = Set(hourly.map { String($0.time.prefix(10)) })
        let fallback = covered.sorted().first ?? initialDate
        _selectedDate = State(initialValue: covered.contains(initialDate) ? initialDate : fallback)
    }

    // MARK: - Dati

    /// Slot orario del giorno selezionato. `mm`/`prob` nil = ora non coperta.
    private struct PrecipPoint: Identifiable {
        let hour: Int
        var mm: Double? = nil
        var prob: Double? = nil
        var conditionCode: String? = nil
        var isCovered: Bool = false
        var id: Int { hour }
    }

    private var days: [String] {
        let fromDaily = daily?.map { String($0.date.prefix(10)) } ?? []
        let fromHourly = hourly.map { String($0.time.prefix(10)) }
        return Array(Set(fromDaily + fromHourly)).sorted().prefix(7).map { $0 }
    }

    private var daysWithHours: Set<String> {
        Set(hourly.map { String($0.time.prefix(10)) })
    }

    /// Griglia fissa di 24 slot: l'asse resta completo anche con copertura parziale.
    ///
    /// L'ora si legge dai caratteri della stringa invece che con
    /// `ISO8601DateFormatter`: il backend garantisce il formato
    /// `YYYY-MM-DDTHH:00` già in ora locale della località, e parsarlo come data
    /// lo sposterebbe nel fuso del dispositivo.
    private var points: [PrecipPoint] {
        var slots = (0..<24).map { PrecipPoint(hour: $0) }
        for h in hourly where h.time.hasPrefix(selectedDate) {
            guard let hour = Int(h.time.dropFirst(11).prefix(2)), (0..<24).contains(hour) else { continue }
            slots[hour] = PrecipPoint(
                hour: hour,
                mm: h.precipitationMm,
                prob: h.precipitationProb,
                conditionCode: h.conditionCode,
                isCovered: true
            )
        }
        return slots
    }

    private var mmValues: [Double] { points.compactMap(\.mm) }
    /// Il backend omette la chiave quando nessuna fonte l'ha fornita.
    private var hasMmData: Bool { !mmValues.isEmpty }
    private var isAllDry: Bool { hasMmData && mmValues.allSatisfy { $0 == 0 } }
    private var hasAnyHour: Bool { points.contains(where: \.isCovered) }

    private var mmAxisMax: Double {
        max(PrecipIntensity.Threshold.heavy * 1.25, (mmValues.max() ?? 0) * 1.15)
    }

    /// Punto medio di ciascuna fascia, dove va scritta la sua etichetta.
    private var bandLabelPositions: [Double] {
        let light = PrecipIntensity.Threshold.light
        let moderate = PrecipIntensity.Threshold.moderate
        let heavy = PrecipIntensity.Threshold.heavy
        return [
            (light + moderate) / 2,
            (moderate + heavy) / 2,
            (heavy + mmAxisMax) / 2
        ]
    }

    private var activePoint: PrecipPoint? {
        guard let hour = selectedHour else { return defaultPoint }
        return points.first { $0.hour == hour }
    }

    /// Ora corrente se il giorno è oggi, altrimenti la più piovosa.
    private var defaultPoint: PrecipPoint? {
        if selectedDate == Self.todayKey {
            let hour = Calendar.current.component(.hour, from: Date())
            return points.first { $0.hour == hour }
        }
        if hasMmData && !isAllDry {
            return points.max { ($0.mm ?? -1) < ($1.mm ?? -1) }
        }
        return points.first(where: \.isCovered)
    }

    private static var todayKey: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            cream.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    dayStrip
                    Text(longDateLabel)
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                        .frame(maxWidth: .infinity, alignment: .center)

                    if !hasAnyHour {
                        Text("Dati orari non disponibili per questa data")
                            .font(.system(size: 14))
                            .foregroundColor(.gray)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 40)
                    } else {
                        mmSection
                        probabilitySection
                    }
                }
                .padding(20)
            }
        }
        .onChange(of: selectedDate) { _, _ in selectedHour = nil }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 8) {
            Image(systemName: "drop.fill")
                .font(.system(size: 20))
                .foregroundColor(coral)
            Text("Precipitazioni")
                .font(.system(size: 26, weight: .bold))
                .foregroundColor(.black)
            Spacer()
            Button(action: { dismiss() }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundColor(.gray.opacity(0.5))
            }
            .accessibilityLabel("Chiudi")
        }
    }

    private var dayStrip: some View {
        HStack(spacing: 6) {
            ForEach(days, id: \.self) { date in
                let isSelected = date == selectedDate
                let enabled = daysWithHours.contains(date)
                Button {
                    HapticManager.selection()
                    withAnimation(.easeInOut(duration: 0.2)) { selectedDate = date }
                } label: {
                    VStack(spacing: 2) {
                        Text(Self.weekdayNarrow(date))
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(isSelected ? .white.opacity(0.9) : .gray)
                        Text(Self.dayNumber(date))
                            .font(.system(size: 15, weight: isSelected ? .semibold : .regular))
                            .foregroundColor(isSelected ? .white : .black)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(
                        Capsule().fill(isSelected ? coral : Color.clear)
                    )
                }
                .buttonStyle(.plain)
                .disabled(!enabled)
                .opacity(enabled ? 1 : 0.4)
            }
        }
    }

    // MARK: - Sezione millimetri

    @ViewBuilder
    private var mmSection: some View {
        if hasMmData {
            VStack(spacing: 4) {
                let point = activePoint
                let intensity = PrecipIntensity.classify(point?.mm)

                Text(point.map { Self.hourRange($0.hour) } ?? "—")
                    .font(.system(size: 13))
                    .foregroundColor(.gray)
                Text(headlineText(for: point, intensity: intensity))
                    .font(.system(size: 34, weight: .light))
                    .foregroundColor(.black)
                Text(subtitleText(for: point, intensity: intensity))
                    .font(.system(size: 12))
                    .foregroundColor(.gray)

                ZStack {
                    Chart {
                        ForEach(points) { p in
                            if let mm = p.mm {
                                BarMark(
                                    x: .value("Ora", p.hour),
                                    y: .value("mm", mm),
                                    width: .fixed(9)
                                )
                                .foregroundStyle(PrecipIntensity.classify(mm).color)
                                .cornerRadius(3)
                            }
                        }
                        if let hour = activePoint?.hour {
                            RuleMark(x: .value("Ora", hour))
                                .foregroundStyle(.black.opacity(0.35))
                                .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        }
                    }
                    .chartXScale(domain: 0...23)
                    .chartYScale(domain: 0.0...mmAxisMax)
                    .chartYAxis {
                        // Le linee marcano i confini fra le fasce…
                        AxisMarks(values: [
                            PrecipIntensity.Threshold.moderate,
                            PrecipIntensity.Threshold.heavy
                        ]) { _ in
                            AxisGridLine()
                        }
                        // …e le etichette stanno al centro della fascia che
                        // nominano. Una linea a 0,1 mm sarebbe appiccicata alla
                        // base e illeggibile.
                        AxisMarks(values: bandLabelPositions) { value in
                            AxisValueLabel {
                                Text(PrecipIntensity.classify(value.as(Double.self)).label)
                                    .font(.system(size: 9))
                                    .foregroundColor(.gray)
                            }
                        }
                    }
                    .chartXAxis { hourAxis }
                    .chartXSelection(value: $selectedHour)
                    .frame(height: 160)

                    if isAllDry {
                        Text("Nessuna precipitazione prevista")
                            .font(.system(size: 13))
                            .foregroundColor(.gray.opacity(0.7))
                            .allowsHitTesting(false)
                    }
                }
            }
        } else {
            // Cache scritta prima dell'introduzione del campo, o nessuna fonte
            // con i millimetri per questa località: resta la probabilità.
            Text("Quantità in mm non disponibile per questa località")
                .font(.system(size: 12))
                .foregroundColor(.gray)
                .frame(maxWidth: .infinity)
        }
    }

    private func headlineText(for point: PrecipPoint?, intensity: PrecipIntensity) -> String {
        guard let point, point.isCovered else { return "Dato non disponibile" }
        return intensity == .none ? formatPrecipMm(point.mm) : intensity.label
    }

    private func subtitleText(for point: PrecipPoint?, intensity: PrecipIntensity) -> String {
        guard let point, point.isCovered else { return "" }
        if intensity != .none, let mm = point.mm {
            return formatPrecipMm(mm)
        }
        return ""
    }

    // MARK: - Sezione probabilità

    private var probabilitySection: some View {
        VStack(spacing: 4) {
            let point = activePoint

            Text(point.map { Self.hourRange($0.hour) } ?? "—")
                .font(.system(size: 13))
                .foregroundColor(.gray)
            Text(point?.prob.map { "\(Int($0.rounded()))%" } ?? "—%")
                .font(.system(size: 34, weight: .light))
                .foregroundColor(.black)
            Text("Probabilità")
                .font(.system(size: 12))
                .foregroundColor(.gray)

            Chart {
                ForEach(points) { p in
                    if let prob = p.prob {
                        BarMark(
                            x: .value("Ora", p.hour),
                            y: .value("Probabilità", prob),
                            width: .fixed(9)
                        )
                        .foregroundStyle(Color(hex: "60A5FA").opacity(0.85))
                        .cornerRadius(3)
                    }
                }
                if let hour = activePoint?.hour {
                    RuleMark(x: .value("Ora", hour))
                        .foregroundStyle(.black.opacity(0.35))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                }
            }
            .chartXScale(domain: 0...23)
            .chartYScale(domain: 0.0...100.0)
            .chartYAxis {
                // Double, non Int: la scala Y è quella dei valori di probabilità.
                AxisMarks(values: [80.0, 100.0]) { value in
                    AxisGridLine()
                    AxisValueLabel {
                        Text("\(Int(value.as(Double.self) ?? 0))%")
                            .font(.system(size: 9))
                            .foregroundColor(.gray)
                    }
                }
            }
            .chartXAxis { hourAxis }
            .chartXSelection(value: $selectedHour)
            .frame(height: 110)
        }
    }

    private var hourAxis: some AxisContent {
        AxisMarks(values: [0, 6, 12, 18]) { value in
            AxisValueLabel {
                Text(String(format: "%02d", value.as(Int.self) ?? 0))
                    .font(.system(size: 9))
                    .foregroundColor(.gray)
            }
        }
    }

    // MARK: - Formattazione

    private var longDateLabel: String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: selectedDate) else { return selectedDate }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "it_IT")
        formatter.dateFormat = "EEEE d MMMM yyyy"
        return formatter.string(from: date).capitalizedFirst
    }

    private static func weekdayNarrow(_ date: String) -> String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        guard let d = parser.date(from: date) else { return "" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "it_IT")
        f.dateFormat = "EEEEE"
        return f.string(from: d).uppercased()
    }

    private static func dayNumber(_ date: String) -> String {
        String(date.suffix(2)).hasPrefix("0")
            ? String(date.suffix(1))
            : String(date.suffix(2))
    }

    private static func hourRange(_ hour: Int) -> String {
        String(format: "%02d:00 - %02d:00", hour, (hour + 1) % 24)
    }
}

private extension String {
    var capitalizedFirst: String {
        guard let firstCharacter = self.first else { return self }
        return firstCharacter.uppercased() + self.dropFirst()
    }
}
