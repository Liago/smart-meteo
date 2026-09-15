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
    /// Ridisegna quando cambiano le unità: le funzioni di formattazione
    /// leggono `UnitPrefs.shared` ma non possono osservarlo.
    @ObservedObject private var units = UnitPrefs.shared
    let hourly: [HourlyForecast]
    let daily: [DailyForecast]?
    /// La tinta della condizione, passata dalla dashboard.
    ///
    /// Non ricalcolata qui: due schermate che deducono lo stesso tema per conto
    /// proprio finiscono prima o poi per dedurlo diverso.
    let theme: WeatherTheme

    @Environment(\.dismiss) private var dismiss
    @State private var selectedDate: String
    @State private var selectedHour: Int?
    @State private var metric: HourlyMetric

    private let cream = Color(red: 252 / 255, green: 249 / 255, blue: 246 / 255)
    private let coral = Color(red: 236 / 255, green: 104 / 255, blue: 90 / 255)

    init(
        hourly: [HourlyForecast],
        daily: [DailyForecast]?,
        theme: WeatherTheme = WeatherTheme.of(.clear),
        initialDate: String,
        // Chi arriva dalla curva oraria vuole la temperatura; chi tocca una
        // cella di pioggia nei sette giorni vuole i millimetri. Aprire sempre
        // sulla stessa metrica dava ragione a metà degli utenti.
        initialMetric: HourlyMetric = .precipitation
    ) {
        self.hourly = hourly
        self.daily = daily
        self.theme = theme
        _metric = State(initialValue: initialMetric)

        // Il ripiego parte da oggi, mai dal primo elemento dell'array: `hourly`
        // può cominciare da ieri sera, e aprire lì mostrerebbe una previsione
        // già passata.
        let covered = Set(hourly.map { String($0.time.prefix(10)) })
        let today = Self.todayKey
        let fallback = covered.filter { $0 >= today }.min() ?? today
        let wanted = initialDate >= today ? initialDate : fallback
        _selectedDate = State(initialValue: covered.contains(wanted) ? wanted : fallback)
    }

    // MARK: - Dati

    /// Slot orario del giorno selezionato. Ora non coperta = `forecast` nil.
    private struct HourPoint: Identifiable {
        let hour: Int
        var forecast: HourlyForecast? = nil
        var id: Int { hour }
        var isCovered: Bool { forecast != nil }
    }

    /// I sette giorni della strip, **da oggi in avanti**.
    ///
    /// Il filtro sul passato non è cosmetico: senza, il primo chip era ieri —
    /// una previsione già smentita dai fatti — e il `prefix(7)` mangiava in
    /// coda un giorno futuro per far posto a uno passato.
    private var days: [String] {
        let fromDaily = daily?.map { String($0.date.prefix(10)) } ?? []
        let fromHourly = hourly.map { String($0.time.prefix(10)) }
        let today = Self.todayKey
        return Array(Set(fromDaily + fromHourly))
            .filter { $0 >= today }
            .sorted()
            .prefix(7)
            .map { $0 }
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
            theme.page.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    dayStrip

                    VStack(alignment: .leading, spacing: 16) {
                        Text(longDateLabel)
                            .font(.duetUI(12, .medium))
                            .foregroundColor(Duet.ink.opacity(0.45))
                            .frame(maxWidth: .infinity, alignment: .center)

                        if !hasAnyHour {
                            Text("Dati orari non disponibili per questa data")
                                .font(.duetUI(13))
                                .foregroundColor(Duet.ink.opacity(0.5))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 40)
                        } else {
                            ForEach(metric.sections) { section in
                                chartSection(section)
                            }

                            metricsGrid
                            closingNote
                        }
                    }
                    .padding(20)
                    .background(
                        RoundedRectangle(cornerRadius: Duet.rPanel).fill(Duet.surface)
                    )
                    .shadow(color: Duet.shadowCard, radius: 14, x: 0, y: 2)
                    .padding(.horizontal, 16)
                }
                .padding(.vertical, 16)
            }
        }
        .onChange(of: selectedDate) { _, _ in selectedHour = nil }
        // Nessun reset al cambio metrica: se l'utente ha scelto un'ora la tiene,
        // così può confrontare metriche diverse sullo stesso istante. Se invece
        // non ha scelto nulla, `defaultPoint` segue già la nuova metrica.
    }

    /// Indietro a sinistra, titolo in serif.
    ///
    /// Il mockup mostra un titolo fisso «Dettaglio orario», ma qui il titolo è
    /// il **nome della metrica** ed è anche il selettore: il ridisegno non aveva
    /// considerato che questa schermata ne mostra sei (pioggia, temporali,
    /// vento, umidità, percepita, UV), con il proprio registro e i propri test.
    /// Toglierle per far posto a un titolo fisso sarebbe stato cancellare una
    /// funzione con la scusa dell'impaginazione. Il serif e la disposizione
    /// restano quelli del ridisegno.
    private var header: some View {
        HStack(alignment: .center, spacing: 10) {
            Button {
                HapticManager.light()
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.duetUI(16, .semibold))
                    .foregroundColor(theme.ink.opacity(0.8))
                    .frame(width: 38, height: 38)
                    .background(
                        RoundedRectangle(cornerRadius: 13)
                            .fill(Color.white.opacity(0.8))
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Chiudi")

            Menu {
                Picker("Metrica", selection: $metric) {
                    ForEach(HourlyMetric.allCases) { option in
                        Label(option.label, systemImage: option.systemImage).tag(option)
                    }
                }
            } label: {
                HStack(spacing: 7) {
                    Text(metric.label)
                        .font(.duetDisplay(26))
                        .foregroundColor(Duet.ink)
                    Image(systemName: "chevron.down")
                        .font(.duetUI(12, .semibold))
                        .foregroundColor(Duet.ink.opacity(0.4))
                }
            }
            .accessibilityLabel("Metrica: \(metric.label)")
            .accessibilityHint("Tocca per cambiare il dato visualizzato")

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
    }

    /// Pillole scorrevoli: sette giorni non stanno in larghezza senza
    /// comprimersi fino a diventare illeggibili.
    private var dayStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(days, id: \.self) { date in
                    let isSelected = date == selectedDate
                    let enabled = daysWithHours.contains(date)
                    Button {
                        HapticManager.selection()
                        withAnimation(.easeInOut(duration: 0.2)) { selectedDate = date }
                    } label: {
                        Text(Self.pillLabel(date))
                            .font(.duetUI(12, .bold))
                            .foregroundColor(isSelected ? theme.ink : Duet.ink.opacity(0.5))
                            .padding(.vertical, 8)
                            .padding(.horizontal, 13)
                            .background(
                                RoundedRectangle(cornerRadius: Duet.rSmall)
                                    .fill(isSelected ? theme.hero : Duet.surface)
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(!enabled)
                    .opacity(enabled ? 1 : 0.4)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    /// «Oggi» per il giorno corrente, altrimenti il giorno abbreviato.
    private static func pillLabel(_ date: String) -> String {
        date == todayKey ? "Oggi" : DailyRowsView.dayLabel(date)
    }

    // MARK: - Griglia delle metriche

    /// I quattro valori dell'ora selezionata, sempre gli stessi quattro.
    ///
    /// Sono un **riepilogo**, non il grafico: restano quelli qualunque metrica
    /// si stia guardando, così passare da «pioggia» a «vento» non fa perdere il
    /// contesto dell'ora su cui si è fermato il dito.
    private var metricsGrid: some View {
        let hour = activePoint?.forecast

        return LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
            spacing: 10
        ) {
            metricTile("Temperatura", HourlySparklineView.formatTemp(hour?.temp))
            metricTile("Probabilità pioggia", hour?.precipitationProb.map { "\(Int($0.rounded()))%" } ?? "—")
            metricTile("Vento", HeroText.wind(hour?.windSpeed))
            metricTile("Umidità", hour?.humidity.map { "\(Int($0.rounded()))%" } ?? "—")
        }
    }

    private func metricTile(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.duetUI(10, .semibold))
                .tracking(1.0)
                .foregroundColor(Duet.ink.opacity(0.45))
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Text(value)
                .font(.duetUI(17, .bold))
                .foregroundColor(Duet.ink)
                .monospacedDigit()
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Duet.surfaceInset))
    }

    private var closingNote: some View {
        Text("Tocca il grafico per scorrere le ore.")
            .font(.duetUI(11))
            .foregroundColor(Duet.ink.opacity(0.45))
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Sezione di grafico

    /// I valori che, oltre alla serie principale, devono stare dentro il
    /// dominio dell'asse Y: la serie secondaria (le raffiche) e i due
    /// percentili della banda d'incertezza.
    ///
    /// Sta qui e non dentro `chartSection` perché quello è un `@ViewBuilder`:
    /// un assegnamento vale `()`, e `()` non può conformarsi a `View`. La
    /// regola generale è che in un corpo `@ViewBuilder` stanno espressioni e
    /// dichiarazioni `let`, non istruzioni — ogni calcolo che ne ha bisogno
    /// diventa una funzione a parte.
    private func axisCompanions(_ section: MetricSection) -> [Double] {
        var extra = section.secondaryOf.map { extract in
            points.compactMap { $0.forecast.flatMap(extract) }
        } ?? []

        // I percentili entrano nel dominio come le raffiche: se restassero
        // fuori, la banda verrebbe tagliata dal bordo del grafico proprio dove
        // è più larga, cioè dove l'incertezza è maggiore.
        if let low = section.bandLowOf, let high = section.bandHighOf {
            extra += points.compactMap { $0.forecast.flatMap(low) }
            extra += points.compactMap { $0.forecast.flatMap(high) }
        }
        return extra
    }

    @ViewBuilder
    private func chartSection(_ section: MetricSection) -> some View {
        let values = points.compactMap { $0.forecast.flatMap(section.valueOf) }
        let secondaries = axisCompanions(section)

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
                            if section.kind == .lineWithBand {
                                // La banda per prima: sta dietro alla linea.
                                if let low = section.bandLowOf,
                                   let high = section.bandHighOf,
                                   let lo = p.forecast.flatMap(low),
                                   let hi = p.forecast.flatMap(high) {
                                    AreaMark(
                                        x: .value("Ora", p.hour),
                                        yStart: .value("p10", lo),
                                        yEnd: .value("p90", hi)
                                    )
                                    .foregroundStyle(theme.accent.opacity(0.14))
                                    .interpolationMethod(.catmullRom)
                                }

                                if let value = p.forecast.flatMap(section.valueOf) {
                                    LineMark(
                                        x: .value("Ora", p.hour),
                                        y: .value(section.id, value)
                                    )
                                    .foregroundStyle(theme.accent)
                                    .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                                    .interpolationMethod(.catmullRom)
                                }
                            } else if let value = p.forecast.flatMap(section.valueOf) {
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
