import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct HourlyForecastEntry: TimelineEntry {
    let date: Date
    let locationName: String
    let currentTemp: Int?
    let conditionCode: String
    let hours: [HourEntry]
    let isPlaceholder: Bool

    struct HourEntry: Identifiable {
        let id = UUID()
        let hour: String      // "14", "15", etc.
        let temp: Int
        let conditionCode: String
        let precipProb: Int?
        let isNow: Bool
    }

    static var placeholder: HourlyForecastEntry {
        HourlyForecastEntry(
            date: Date(),
            locationName: "Roma",
            currentTemp: 18,
            conditionCode: "0",
            hours: (0..<6).map { i in
                HourEntry(hour: "\(14 + i)", temp: 18 + i, conditionCode: "0", precipProb: nil, isNow: i == 0)
            },
            isPlaceholder: true
        )
    }
}

// MARK: - Timeline Provider

struct HourlyForecastProvider: TimelineProvider {
    private let defaultLat = 41.9028
    private let defaultLon = 12.4964
    private let defaultName = "Roma"

    func placeholder(in context: Context) -> HourlyForecastEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (HourlyForecastEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }
        if let cached = WidgetWeatherService.loadCached(),
           Date().timeIntervalSince(cached.fetchedAt) < 1800 {
            completion(makeEntry(from: cached.forecast, locationName: cached.locationName))
            return
        }
        completion(.placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HourlyForecastEntry>) -> Void) {
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
                let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
                completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
            } catch {
                if let cached = WidgetWeatherService.loadCached() {
                    let entry = makeEntry(from: cached.forecast, locationName: cached.locationName)
                    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
                    completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
                } else {
                    completion(Timeline(entries: [.placeholder], policy: .after(
                        Calendar.current.date(byAdding: .minute, value: 10, to: Date())!
                    )))
                }
            }
        }
    }

    private func makeEntry(from forecast: WidgetForecastResponse, locationName: String) -> HourlyForecastEntry {
        let now = Date()
        let calendar = Calendar.current
        let currentHour = calendar.component(.hour, from: now)

        // Filtra le ore future (da adesso in poi)
        let futureHours: [WidgetHourlyForecast] = (forecast.hourly ?? []).filter { hourly in
            guard let date = WidgetDateFormatters.parseISO(hourly.time) else { return false }
            return date >= calendar.date(byAdding: .hour, value: -1, to: now)!
        }

        // Prendi le prossime 6 ore
        let selectedHours = Array(futureHours.prefix(6))

        let hourEntries = selectedHours.enumerated().map { (index, hourly) -> HourlyForecastEntry.HourEntry in
            let hourStr = WidgetDateFormatters.hourString(from: hourly.time)
            let parsedHour = Int(hourStr) ?? (currentHour + index)
            return HourlyForecastEntry.HourEntry(
                hour: index == 0 ? "Ora" : hourStr,
                temp: Int(round(hourly.temp)),
                conditionCode: hourly.conditionCode,
                precipProb: hourly.precipitationProb.map { Int($0) },
                isNow: index == 0
            )
        }

        return HourlyForecastEntry(
            date: now,
            locationName: locationName.isEmpty ? "Posizione" : locationName,
            currentTemp: forecast.current.temperature.map { Int(round($0)) },
            conditionCode: forecast.current.conditionCode ?? forecast.current.condition,
            hours: hourEntries,
            isPlaceholder: false
        )
    }
}

// MARK: - Widget View

struct HourlyForecastWidgetView: View {
    let entry: HourlyForecastEntry

    private var condition: String {
        WeatherIconMapper.simpleCondition(for: entry.conditionCode)
    }

    var body: some View {
        ZStack {
            WidgetGradients.background(for: condition)

            VStack(alignment: .leading, spacing: 8) {
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
                        Image(systemName: "clock")
                            .font(.system(size: 9))
                        Text("Prossime ore")
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundStyle(.white.opacity(0.55))
                }

                Spacer()

                // Ore
                HStack(spacing: 0) {
                    ForEach(entry.hours) { hour in
                        VStack(spacing: 4) {
                            // Ora
                            Text(hour.hour)
                                .font(.system(size: 11, weight: hour.isNow ? .bold : .medium))
                                .foregroundStyle(.white.opacity(hour.isNow ? 1 : 0.7))

                            // Icona meteo
                            Image(systemName: WeatherIconMapper.sfSymbol(for: hour.conditionCode))
                                .font(.system(size: 16))
                                .foregroundStyle(WidgetGradients.iconColor(for: WeatherIconMapper.simpleCondition(for: hour.conditionCode)))
                                .symbolRenderingMode(.hierarchical)
                                .frame(height: 20)

                            // Temperatura
                            Text("\(hour.temp)°")
                                .font(.system(size: 14, weight: hour.isNow ? .bold : .semibold))
                                .foregroundStyle(.white)

                            // Probabilità pioggia (solo se > 0)
                            if let precip = hour.precipProb, precip > 0 {
                                HStack(spacing: 1) {
                                    Image(systemName: "drop.fill")
                                        .font(.system(size: 7))
                                    Text("\(precip)%")
                                        .font(.system(size: 9, weight: .medium))
                                }
                                .foregroundStyle(Color(hex: "74B9FF"))
                            } else {
                                Text(" ")
                                    .font(.system(size: 9))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(hour.isNow ? .white.opacity(0.15) : .clear)
                        )
                    }
                }
            }
            .padding(14)
        }
    }
}

// MARK: - Widget Configuration

struct HourlyForecastWidget: Widget {
    let kind: String = "SmartMedeoHourlyForecast"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HourlyForecastProvider()) { entry in
            if #available(iOS 17.0, *) {
                HourlyForecastWidgetView(entry: entry)
                    .containerBackground(for: .widget) {
                        let condition = WeatherIconMapper.simpleCondition(for: entry.conditionCode)
                        WidgetGradients.background(for: condition)
                    }
            } else {
                HourlyForecastWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Previsioni Orarie")
        .description("Le prossime 6 ore con temperatura e condizioni meteo.")
        .supportedFamilies([.systemMedium])
    }
}

#Preview("Hourly Medium", as: .systemMedium) {
    HourlyForecastWidget()
} timeline: {
    HourlyForecastEntry.placeholder
}
