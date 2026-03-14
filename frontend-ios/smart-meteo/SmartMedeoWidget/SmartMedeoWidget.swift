import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct WeatherEntry: TimelineEntry {
    let date: Date
    let locationName: String
    let temperature: Int?
    let feelsLike: Int?
    let conditionCode: String
    let conditionText: String
    let humidity: Int?
    let windSpeed: Double?
    let precipitationProb: Int
    let tempMax: Int?
    let tempMin: Int?
    let sunrise: String?
    let sunset: String?
    let isPlaceholder: Bool

    static var placeholder: WeatherEntry {
        WeatherEntry(
            date: Date(),
            locationName: "Roma",
            temperature: 18,
            feelsLike: 16,
            conditionCode: "0",
            conditionText: "Sereno",
            humidity: 65,
            windSpeed: 12,
            precipitationProb: 10,
            tempMax: 22,
            tempMin: 14,
            sunrise: "06:45",
            sunset: "18:30",
            isPlaceholder: true
        )
    }
}

// MARK: - Timeline Provider

struct CurrentWeatherProvider: TimelineProvider {
    // Coordinate predefinite (Roma) come fallback
    private let defaultLat = 41.9028
    private let defaultLon = 12.4964
    private let defaultName = "Roma"

    func placeholder(in context: Context) -> WeatherEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }

        // Prova a caricare dati dalla cache
        if let cached = WidgetWeatherService.loadCached(),
           Date().timeIntervalSince(cached.fetchedAt) < 1800 {
            completion(makeEntry(from: cached.forecast, locationName: cached.locationName))
            return
        }
        completion(.placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        let location = WidgetWeatherService.loadLocation()
        let lat = location?.lat ?? defaultLat
        let lon = location?.lon ?? defaultLon
        let name = location?.name ?? defaultName

        Task {
            do {
                let forecast = try await WidgetWeatherService.fetchForecast(lat: lat, lon: lon)

                // Salva nella cache condivisa
                let weatherData = WidgetWeatherData(
                    forecast: forecast,
                    locationName: name,
                    fetchedAt: Date()
                )
                WidgetWeatherService.save(weatherData)

                let entry = makeEntry(from: forecast, locationName: name)

                // Aggiorna ogni 30 minuti
                let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
                let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
                completion(timeline)
            } catch {
                // Fallback alla cache
                if let cached = WidgetWeatherService.loadCached() {
                    let entry = makeEntry(from: cached.forecast, locationName: cached.locationName)
                    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
                    let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
                    completion(timeline)
                } else {
                    let timeline = Timeline(entries: [WeatherEntry.placeholder], policy: .after(
                        Calendar.current.date(byAdding: .minute, value: 10, to: Date())!
                    ))
                    completion(timeline)
                }
            }
        }
    }

    private func makeEntry(from forecast: WidgetForecastResponse, locationName: String) -> WeatherEntry {
        let current = forecast.current
        let todayDaily = forecast.daily?.first

        // Formatta sunrise/sunset
        var sunriseStr: String?
        var sunsetStr: String?
        if let astro = forecast.astronomy {
            sunriseStr = formatTime(astro.sunrise)
            sunsetStr = formatTime(astro.sunset)
        }

        return WeatherEntry(
            date: Date(),
            locationName: locationName.isEmpty ? "Posizione" : locationName,
            temperature: current.temperature.map { Int(round($0)) },
            feelsLike: current.feelsLike.map { Int(round($0)) },
            conditionCode: current.conditionCode ?? current.condition,
            conditionText: current.conditionText,
            humidity: current.humidity.map { Int($0) },
            windSpeed: current.windSpeed,
            precipitationProb: Int(current.precipitationProb),
            tempMax: todayDaily?.tempMax.map { Int(round($0)) } ?? nil,
            tempMin: todayDaily?.tempMin.map { Int(round($0)) } ?? nil,
            sunrise: sunriseStr,
            sunset: sunsetStr,
            isPlaceholder: false
        )
    }

    private func formatTime(_ isoString: String) -> String {
        if let date = WidgetDateFormatters.parseISO(isoString) {
            return WidgetDateFormatters.hourMinuteFormatter.string(from: date)
        }
        // Potrebbe essere già in formato HH:mm
        if isoString.count <= 5 { return isoString }
        // Prova a estrarre HH:mm
        let components = isoString.split(separator: "T")
        if components.count > 1 {
            return String(components[1].prefix(5))
        }
        return isoString
    }
}

// MARK: - Widget View: Small

struct CurrentWeatherSmallView: View {
    let entry: WeatherEntry
    @Environment(\.widgetFamily) var family

    private var condition: String {
        WeatherIconMapper.simpleCondition(for: entry.conditionCode)
    }

    var body: some View {
        ZStack {
            // Gradiente di sfondo
            WidgetGradients.background(for: condition)

            VStack(alignment: .leading, spacing: 0) {
                // Location
                HStack(spacing: 4) {
                    Image(systemName: "location.fill")
                        .font(.system(size: 9, weight: .semibold))
                    Text(entry.locationName)
                        .font(.system(size: 11, weight: .semibold))
                        .lineLimit(1)
                }
                .foregroundStyle(.white.opacity(0.85))

                Spacer()

                // Temperatura principale
                HStack(alignment: .top, spacing: 1) {
                    Text(entry.temperature.map { "\($0)" } ?? "--")
                        .font(.system(size: 48, weight: .thin))
                    Text("°")
                        .font(.system(size: 24, weight: .thin))
                        .offset(y: 4)
                }
                .foregroundStyle(.white)

                // Icona + Condizione
                HStack(spacing: 4) {
                    Image(systemName: WeatherIconMapper.sfSymbol(for: entry.conditionCode))
                        .font(.system(size: 13))
                        .foregroundStyle(WidgetGradients.iconColor(for: condition))
                        .symbolRenderingMode(.hierarchical)
                    Text(WeatherIconMapper.conditionLabel(for: entry.conditionCode))
                        .font(.system(size: 12, weight: .medium))
                        .lineLimit(1)
                        .foregroundStyle(.white.opacity(0.9))
                }

                Spacer().frame(height: 6)

                // Max / Min
                if let max = entry.tempMax, let min = entry.tempMin {
                    HStack(spacing: 6) {
                        Label("\(max)°", systemImage: "arrow.up")
                        Label("\(min)°", systemImage: "arrow.down")
                    }
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.75))
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Widget View: Medium

struct CurrentWeatherMediumView: View {
    let entry: WeatherEntry

    private var condition: String {
        WeatherIconMapper.simpleCondition(for: entry.conditionCode)
    }

    var body: some View {
        ZStack {
            WidgetGradients.background(for: condition)

            HStack(spacing: 0) {
                // Colonna sinistra: temperatura e condizione
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 4) {
                        Image(systemName: "location.fill")
                            .font(.system(size: 9, weight: .semibold))
                        Text(entry.locationName)
                            .font(.system(size: 12, weight: .semibold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(.white.opacity(0.85))

                    Spacer()

                    HStack(alignment: .top, spacing: 1) {
                        Text(entry.temperature.map { "\($0)" } ?? "--")
                            .font(.system(size: 52, weight: .thin))
                        Text("°")
                            .font(.system(size: 26, weight: .thin))
                            .offset(y: 4)
                    }
                    .foregroundStyle(.white)

                    HStack(spacing: 4) {
                        Image(systemName: WeatherIconMapper.sfSymbol(for: entry.conditionCode))
                            .font(.system(size: 14))
                            .foregroundStyle(WidgetGradients.iconColor(for: condition))
                            .symbolRenderingMode(.hierarchical)
                        Text(WeatherIconMapper.conditionLabel(for: entry.conditionCode))
                            .font(.system(size: 13, weight: .medium))
                            .lineLimit(1)
                    }
                    .foregroundStyle(.white.opacity(0.9))

                    Spacer().frame(height: 4)

                    if let max = entry.tempMax, let min = entry.tempMin {
                        HStack(spacing: 6) {
                            Label("\(max)°", systemImage: "arrow.up")
                            Label("\(min)°", systemImage: "arrow.down")
                        }
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.75))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Divisore sottile
                Rectangle()
                    .fill(.white.opacity(0.15))
                    .frame(width: 0.5)
                    .padding(.vertical, 8)

                // Colonna destra: dettagli
                VStack(alignment: .leading, spacing: 10) {
                    if let feelsLike = entry.feelsLike {
                        DetailRow(icon: "thermometer.medium", label: "Percepita", value: "\(feelsLike)°")
                    }
                    if let humidity = entry.humidity {
                        DetailRow(icon: "humidity.fill", label: "Umidità", value: "\(humidity)%")
                    }
                    if let wind = entry.windSpeed {
                        DetailRow(icon: "wind", label: "Vento", value: "\(Int(wind * 3.6)) km/h")
                    }
                    if entry.precipitationProb > 0 {
                        DetailRow(icon: "drop.fill", label: "Pioggia", value: "\(entry.precipitationProb)%")
                    } else if let sunrise = entry.sunrise {
                        DetailRow(icon: "sunrise.fill", label: "Alba", value: sunrise)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 12)
            }
            .padding(14)
        }
    }
}

struct DetailRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .frame(width: 16)
                .foregroundStyle(.white.opacity(0.65))
            VStack(alignment: .leading, spacing: 0) {
                Text(label)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.white.opacity(0.55))
                Text(value)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
    }
}

// MARK: - Widget Configuration

struct SmartMedeoWidget: Widget {
    let kind: String = "SmartMedeoCurrentWeather"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CurrentWeatherProvider()) { entry in
            if #available(iOS 17.0, *) {
                CurrentWeatherEntryView(entry: entry)
                    .containerBackground(for: .widget) {
                        let condition = WeatherIconMapper.simpleCondition(for: entry.conditionCode)
                        WidgetGradients.background(for: condition)
                    }
            } else {
                CurrentWeatherEntryView(entry: entry)
            }
        }
        .configurationDisplayName("Meteo Attuale")
        .description("Temperatura, condizioni e dettagli della tua posizione.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct CurrentWeatherEntryView: View {
    let entry: WeatherEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            CurrentWeatherSmallView(entry: entry)
        case .systemMedium:
            CurrentWeatherMediumView(entry: entry)
        default:
            CurrentWeatherSmallView(entry: entry)
        }
    }
}

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    SmartMedeoWidget()
} timeline: {
    WeatherEntry.placeholder
}

#Preview("Medium", as: .systemMedium) {
    SmartMedeoWidget()
} timeline: {
    WeatherEntry.placeholder
}
