import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct WeeklyForecastEntry: TimelineEntry {
    let date: Date
    let locationName: String
    let currentTemp: Int?
    let conditionCode: String
    let days: [DayEntry]
    let globalMin: Double
    let globalMax: Double
    let isPlaceholder: Bool

    struct DayEntry: Identifiable {
        let id = UUID()
        let dayLabel: String   // "Oggi", "Lun", "Mar"...
        let conditionCode: String
        let tempMax: Int
        let tempMin: Int
        let precipProb: Int?
        let isToday: Bool
    }

    static var placeholder: WeeklyForecastEntry {
        let days = [
            ("Oggi", "0", 22, 14, nil, true),
            ("Lun", "2", 20, 13, 10, false),
            ("Mar", "61", 17, 11, 65, false),
            ("Mer", "3", 19, 12, 20, false),
            ("Gio", "0", 23, 14, nil, false),
            ("Ven", "1", 24, 15, nil, false),
            ("Sab", "2", 21, 13, 15, false),
        ].map { DayEntry(dayLabel: $0.0, conditionCode: $0.1, tempMax: $0.2, tempMin: $0.3, precipProb: $0.4, isToday: $0.5) }

        return WeeklyForecastEntry(
            date: Date(),
            locationName: "Roma",
            currentTemp: 18,
            conditionCode: "0",
            days: days,
            globalMin: 11,
            globalMax: 24,
            isPlaceholder: true
        )
    }
}

// MARK: - Timeline Provider

struct WeeklyForecastProvider: TimelineProvider {
    private let defaultLat = 41.9028
    private let defaultLon = 12.4964
    private let defaultName = "Roma"

    func placeholder(in context: Context) -> WeeklyForecastEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (WeeklyForecastEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }
        if let cached = WidgetWeatherService.loadCached(),
           Date().timeIntervalSince(cached.fetchedAt) < 3600 {
            completion(makeEntry(from: cached.forecast, locationName: cached.locationName))
            return
        }
        completion(.placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeeklyForecastEntry>) -> Void) {
        let location = WidgetWeatherService.loadLocation()
        let lat = location?.lat ?? defaultLat
        let lon = location?.lon ?? defaultLon
        let name = location?.name ?? defaultName

        Task {
            do {
                let forecast = try await WidgetWeatherService.fetchForecast(lat: lat, lon: lon)
                let weatherData = WidgetWeatherData(forecast: forecast, locationName: name, fetchedAt: Date())
                WidgetWeatherService.save(weatherData)

                let entry = makeEntry(from: forecast, locationName: name)
                let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
                completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
            } catch {
                if let cached = WidgetWeatherService.loadCached() {
                    let entry = makeEntry(from: cached.forecast, locationName: cached.locationName)
                    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
                    completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
                } else {
                    completion(Timeline(entries: [.placeholder], policy: .after(
                        Calendar.current.date(byAdding: .minute, value: 10, to: Date())!
                    )))
                }
            }
        }
    }

    private func makeEntry(from forecast: WidgetForecastResponse, locationName: String) -> WeeklyForecastEntry {
        let dailyData = forecast.daily ?? []

        // Calcola range globale per le barre temperatura
        let temps = dailyData.compactMap { [$0.tempMin, $0.tempMax] }.flatMap { $0 }.compactMap { $0 }
        let globalMin = temps.min() ?? 0
        let globalMax = temps.max() ?? 30

        let dayEntries: [WeeklyForecastEntry.DayEntry] = dailyData.prefix(7).map { daily in
            let dayLabel = WidgetDateFormatters.dayString(from: daily.date)
            let isToday = dayLabel == "Oggi"
            return WeeklyForecastEntry.DayEntry(
                dayLabel: dayLabel,
                conditionCode: daily.conditionCode,
                tempMax: daily.tempMax.map { Int(round($0)) } ?? 0,
                tempMin: daily.tempMin.map { Int(round($0)) } ?? 0,
                precipProb: daily.precipitationProb.map { Int($0) },
                isToday: isToday
            )
        }

        return WeeklyForecastEntry(
            date: Date(),
            locationName: locationName.isEmpty ? "Posizione" : locationName,
            currentTemp: forecast.current.temperature.map { Int(round($0)) },
            conditionCode: forecast.current.conditionCode ?? forecast.current.condition,
            days: dayEntries,
            globalMin: globalMin,
            globalMax: globalMax,
            isPlaceholder: false
        )
    }
}

// MARK: - Widget View: Medium (compact 5-day)

struct WeeklyForecastMediumView: View {
    let entry: WeeklyForecastEntry

    private var condition: String {
        WeatherIconMapper.simpleCondition(for: entry.conditionCode)
    }

    var body: some View {
        ZStack {
            WidgetGradients.background(for: condition)

            VStack(alignment: .leading, spacing: 6) {
                // Header
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "location.fill")
                            .font(.system(size: 9, weight: .semibold))
                        Text(entry.locationName)
                            .font(.system(size: 11, weight: .semibold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(.white.opacity(0.85))

                    Spacer()

                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(.system(size: 9))
                        Text("Settimana")
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundStyle(.white.opacity(0.55))
                }

                Spacer(minLength: 2)

                // Giorni (max 5 nel medium)
                ForEach(Array(entry.days.prefix(5))) { day in
                    WeeklyDayRowCompact(
                        day: day,
                        globalMin: entry.globalMin,
                        globalMax: entry.globalMax
                    )
                }
            }
            .padding(14)
        }
    }
}

struct WeeklyDayRowCompact: View {
    let day: WeeklyForecastEntry.DayEntry
    let globalMin: Double
    let globalMax: Double

    var body: some View {
        HStack(spacing: 8) {
            // Giorno
            Text(day.dayLabel)
                .font(.system(size: 12, weight: day.isToday ? .bold : .medium))
                .foregroundStyle(.white.opacity(day.isToday ? 1.0 : 0.8))
                .frame(width: 36, alignment: .leading)

            // Icona
            Image(systemName: WeatherIconMapper.sfSymbol(for: day.conditionCode))
                .font(.system(size: 13))
                .foregroundStyle(WidgetGradients.iconColor(for: WeatherIconMapper.simpleCondition(for: day.conditionCode)))
                .symbolRenderingMode(.hierarchical)
                .frame(width: 18)

            // Pioggia
            if let precip = day.precipProb, precip > 0 {
                Text("\(precip)%")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(Color(hex: "74B9FF"))
                    .frame(width: 24, alignment: .trailing)
            } else {
                Spacer().frame(width: 24)
            }

            // Min
            Text("\(day.tempMin)°")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.white.opacity(0.55))
                .frame(width: 22, alignment: .trailing)

            // Barra temperatura
            WidgetTemperatureBar(
                min: Double(day.tempMin),
                max: Double(day.tempMax),
                rangeMin: globalMin,
                rangeMax: globalMax
            )
            .frame(height: 4)

            // Max
            Text("\(day.tempMax)°")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 22, alignment: .leading)
        }
    }
}

// MARK: - Widget View: Large (full 7-day)

struct WeeklyForecastLargeView: View {
    let entry: WeeklyForecastEntry

    private var condition: String {
        WeatherIconMapper.simpleCondition(for: entry.conditionCode)
    }

    var body: some View {
        ZStack {
            WidgetGradients.background(for: condition)

            VStack(alignment: .leading, spacing: 0) {
                // Header con temperatura attuale
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Image(systemName: "location.fill")
                                .font(.system(size: 10, weight: .semibold))
                            Text(entry.locationName)
                                .font(.system(size: 13, weight: .semibold))
                                .lineLimit(1)
                        }
                        .foregroundStyle(.white.opacity(0.85))

                        HStack(spacing: 6) {
                            if let temp = entry.currentTemp {
                                Text("\(temp)°")
                                    .font(.system(size: 28, weight: .light))
                                    .foregroundStyle(.white)
                            }
                            Image(systemName: WeatherIconMapper.sfSymbol(for: entry.conditionCode))
                                .font(.system(size: 20))
                                .foregroundStyle(WidgetGradients.iconColor(for: condition))
                                .symbolRenderingMode(.hierarchical)
                            Text(WeatherIconMapper.conditionLabel(for: entry.conditionCode))
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(.white.opacity(0.75))
                        }
                    }
                    Spacer()
                }
                .padding(.bottom, 12)

                // Divisore
                Rectangle()
                    .fill(.white.opacity(0.15))
                    .frame(height: 0.5)
                    .padding(.bottom, 10)

                // 7 giorni
                VStack(spacing: 10) {
                    ForEach(entry.days) { day in
                        WeeklyDayRowFull(
                            day: day,
                            globalMin: entry.globalMin,
                            globalMax: entry.globalMax
                        )
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(16)
        }
    }
}

struct WeeklyDayRowFull: View {
    let day: WeeklyForecastEntry.DayEntry
    let globalMin: Double
    let globalMax: Double

    var body: some View {
        HStack(spacing: 10) {
            // Giorno
            Text(day.dayLabel)
                .font(.system(size: 14, weight: day.isToday ? .bold : .medium))
                .foregroundStyle(.white.opacity(day.isToday ? 1.0 : 0.8))
                .frame(width: 42, alignment: .leading)

            // Icona
            Image(systemName: WeatherIconMapper.sfSymbol(for: day.conditionCode))
                .font(.system(size: 16))
                .foregroundStyle(WidgetGradients.iconColor(for: WeatherIconMapper.simpleCondition(for: day.conditionCode)))
                .symbolRenderingMode(.hierarchical)
                .frame(width: 22)

            // Pioggia
            if let precip = day.precipProb, precip > 0 {
                HStack(spacing: 1) {
                    Image(systemName: "drop.fill")
                        .font(.system(size: 8))
                    Text("\(precip)%")
                        .font(.system(size: 10, weight: .medium))
                }
                .foregroundStyle(Color(hex: "74B9FF"))
                .frame(width: 32, alignment: .trailing)
            } else {
                Spacer().frame(width: 32)
            }

            // Min
            Text("\(day.tempMin)°")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white.opacity(0.55))
                .frame(width: 26, alignment: .trailing)

            // Barra temperatura
            WidgetTemperatureBar(
                min: Double(day.tempMin),
                max: Double(day.tempMax),
                rangeMin: globalMin,
                rangeMax: globalMax
            )
            .frame(height: 5)

            // Max
            Text("\(day.tempMax)°")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 26, alignment: .leading)
        }
    }
}

// MARK: - Barra temperatura per widget

struct WidgetTemperatureBar: View {
    let min: Double
    let max: Double
    let rangeMin: Double
    let rangeMax: Double

    var body: some View {
        GeometryReader { geometry in
            let range = rangeMax - rangeMin
            let safeRange = range == 0 ? 1 : range
            let totalWidth = geometry.size.width

            let minPos = CGFloat((min - rangeMin) / safeRange)
            let maxPos = CGFloat((max - rangeMin) / safeRange)

            let barStart = totalWidth * minPos
            let barWidth = totalWidth * (maxPos - minPos)

            ZStack(alignment: .leading) {
                // Track di sfondo
                Capsule()
                    .fill(.white.opacity(0.15))

                // Range attivo con gradiente
                Capsule()
                    .fill(LinearGradient(
                        colors: [Color(hex: "74B9FF"), Color(hex: "FFD93D"), Color(hex: "FF7675")],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: Swift.max(4, barWidth))
                    .offset(x: barStart)
            }
        }
    }
}

// MARK: - Widget Configuration

struct WeeklyForecastWidget: Widget {
    let kind: String = "SmartMedeoWeeklyForecast"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeeklyForecastProvider()) { entry in
            if #available(iOS 17.0, *) {
                WeeklyForecastEntryView(entry: entry)
                    .containerBackground(for: .widget) {
                        let condition = WeatherIconMapper.simpleCondition(for: entry.conditionCode)
                        WidgetGradients.background(for: condition)
                    }
            } else {
                WeeklyForecastEntryView(entry: entry)
            }
        }
        .configurationDisplayName("Previsioni Settimanali")
        .description("Le previsioni per i prossimi 7 giorni con temperature e condizioni.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct WeeklyForecastEntryView: View {
    let entry: WeeklyForecastEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemMedium:
            WeeklyForecastMediumView(entry: entry)
        case .systemLarge:
            WeeklyForecastLargeView(entry: entry)
        default:
            WeeklyForecastMediumView(entry: entry)
        }
    }
}

// MARK: - Previews

#Preview("Weekly Medium", as: .systemMedium) {
    WeeklyForecastWidget()
} timeline: {
    WeeklyForecastEntry.placeholder
}

#Preview("Weekly Large", as: .systemLarge) {
    WeeklyForecastWidget()
} timeline: {
    WeeklyForecastEntry.placeholder
}
