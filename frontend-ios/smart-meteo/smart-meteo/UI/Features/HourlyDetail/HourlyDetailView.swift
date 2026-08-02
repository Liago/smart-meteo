import SwiftUI
import Charts

/// Dettaglio orario di una metrica: strip dei giorni, grafico a barre con le
/// bande di intensità ed eventuale grafico secondario.
///
/// La metrica si sceglie da un menu nell'intestazione; cosa disegnare per
/// ciascuna è descritto in `MetricScale.swift`, così la view resta agnostica.
///
/// È l'unica schermata dell'app che usa Swift Charts. Gli altri grafici sono
/// `Canvas` scritti a mano e restano tali: qui serve la selezione per tap e
/// trascinamento, che `.chartXSelection` risolve con un hit-testing corretto,
/// mentre a mano andrebbe costruita dentro una ScrollView orizzontale.
struct HourlyDetailView: View {
    let hourly: [HourlyForecast]
    let daily: [DailyForecast]?

    @Environment(\.dismiss) private var dismiss
    @State private var selectedDate: String
    @State private var selectedHour: Int?
    @State private var metric: HourlyMetric = .precipitation

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

    /// Slot orario del giorno selezionato. Ora non coperta = `forecast` nil.
    private struct HourPoint: Identifiable {
        let hour: Int
        var forecast: HourlyForecast? = nil
        var id: Int { hour }
        var isCovered: Bool { forecast != nil }
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
    private var points: [HourPoint] {
        var slots = (0..<24).map { HourPoint(hour: $0) }
        for h in hourly where h.time.hasPrefix(selectedDate) {
            guard let hour = Int(h.time.dropFirst(11).prefix(2)), (0..<24).contains(hour) else { continue }
            slots[hour] = HourPoint(hour: hour, forecast: h)
        }
        return slots
    }

    private var hasAnyHour: Bool { points.contains(where: \.isCovered) }

    private var activePoint: HourPoint? {
        guard let hour = selectedHour else { return defaultPoint }
        return points.first { $0.hour == hour }
    }

    /// Ora corrente se il giorno è oggi, altrimenti quella col valore massimo
    /// della metrica principale (la più piovosa, la più ventosa…).
    private var defaultPoint: HourPoint? {
        if selectedDate == Self.todayKey {
            let hour = Calendar.current.component(.hour, from: Date())
            return points.first { $0.hour == hour }
        }

        guard let primary = metric.sections.first else { return points.first(where: \.isCovered) }
        let values = points.compactMap { $0.forecast.flatMap(primary.valueOf) }
        // Un giorno piatto (tutto asciutto, tutto uguale) non ha un'ora
        // "notevole": meglio la prima coperta che una scelta arbitraria.
        let isFlat = values.isEmpty || values.allSatisfy { $0 == values[0] }
        if !isFlat {
            return points.max {
                ($0.forecast.flatMap(primary.valueOf) ?? -.infinity)
                    < ($1.forecast.flatMap(primary.valueOf) ?? -.infinity)
            }
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
                        ForEach(metric.sections) { section in
                            chartSection(section)
                        }
                    }
                }
                .padding(20)
            }
        }
        .onChange(of: selectedDate) { _, _ in selectedHour = nil }
        // Cambiando metrica l'ora torna al default della nuova serie: l'ora più
        // piovosa non è quella più ventosa.
        .onChange(of: metric) { _, _ in selectedHour = nil }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 8) {
            Menu {
                Picker("Metrica", selection: $metric) {
                    ForEach(HourlyMetric.allCases) { option in
                        Label(option.label, systemImage: option.systemImage).tag(option)
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: metric.systemImage)
                        .font(.system(size: 20))
                        .foregroundColor(coral)
                    Text(metric.label)
                        .font(.system(size: 26, weight: .bold))
                        .foregroundColor(.black)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.gray)
                }
            }
            .accessibilityLabel("Metrica: \(metric.label)")
            .accessibilityHint("Tocca per cambiare il dato visualizzato")

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

    // MARK: - Sezione di grafico

    @ViewBuilder
    private func chartSection(_ section: MetricSection) -> some View {
        let values = points.compactMap { $0.forecast.flatMap(section.valueOf) }
        let secondaries = section.secondaryOf.map { extract in
            points.compactMap { $0.forecast.flatMap(extract) }
        } ?? []

        if values.isEmpty {
            // Cache scritta prima dell'introduzione del campo, o nessuna fonte
            // con questo dato per la località.
            Text(section.emptyMessage)
                .font(.system(size: 12))
                .foregroundColor(.gray)
                .frame(maxWidth: .infinity)
        } else {
            let domain = section.domain(values + secondaries)
            let point = activePoint

            VStack(spacing: 4) {
                Text(point.map { Self.hourRange($0.hour) } ?? "—")
                    .font(.system(size: 13))
                    .foregroundColor(.gray)
                Text(section.headline(point?.forecast))
                    .font(.system(size: 34, weight: .light))
                    .foregroundColor(.black)
                Text(section.caption(point?.forecast))
                    .font(.system(size: 12))
                    .foregroundColor(.gray)

                ZStack {
                    Chart {
                        ForEach(points) { p in
                            if let value = p.forecast.flatMap(section.valueOf) {
                                BarMark(
                                    x: .value("Ora", p.hour),
                                    y: .value(section.id, value),
                                    width: .fixed(9)
                                )
                                .foregroundStyle(section.colorOf(value))
                                .cornerRadius(3)
                            }
                            // Serie secondaria (raffica): una tacca sopra la barra,
                            // non una seconda barra. Pari o sotto al valore
                            // principale non aggiungerebbe informazione.
                            if let extract = section.secondaryOf,
                               let secondary = p.forecast.flatMap(extract),
                               let primary = p.forecast.flatMap(section.valueOf),
                               secondary > primary {
                                RectangleMark(
                                    x: .value("Ora", p.hour),
                                    y: .value(section.id, secondary),
                                    width: .fixed(9),
                                    height: .fixed(2)
                                )
                                .foregroundStyle(.black.opacity(0.35))
                            }
                        }
                        if let hour = point?.hour {
                            RuleMark(x: .value("Ora", hour))
                                .foregroundStyle(.black.opacity(0.35))
                                .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        }
                    }
                    .chartXScale(domain: 0...23)
                    .chartYScale(domain: domain)
                    .chartYAxis {
                        AxisMarks(values: section.gridValues(domain)) { value in
                            AxisGridLine()
                            if let raw = value.as(Double.self), let label = section.gridLabel(raw) {
                                AxisValueLabel {
                                    Text(label)
                                        .font(.system(size: 9))
                                        .foregroundColor(.gray)
                                }
                            }
                        }
                        AxisMarks(values: section.bandValues(domain)) { value in
                            AxisValueLabel {
                                Text(section.bandLabel(value.as(Double.self) ?? 0))
                                    .font(.system(size: 9))
                                    .foregroundColor(.gray)
                            }
                        }
                    }
                    .chartXAxis { hourAxis }
                    .chartXSelection(value: $selectedHour)
                    .frame(height: section.height)

                    if let flatMessage = section.flatMessage, values.allSatisfy({ $0 == 0 }) {
                        Text(flatMessage)
                            .font(.system(size: 13))
                            .foregroundColor(.gray.opacity(0.7))
                            .allowsHitTesting(false)
                    }
                }
            }
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
