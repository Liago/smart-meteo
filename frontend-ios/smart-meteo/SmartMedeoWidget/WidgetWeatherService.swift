import Foundation
import WidgetKit

// MARK: - Modelli condivisi per il widget

struct WidgetForecastResponse: Codable {
    let location: WidgetCoordinate
    let generatedAt: String
    let sourcesUsed: [String]
    let current: WidgetCurrentWeather
    let daily: [WidgetDailyForecast]?
    let hourly: [WidgetHourlyForecast]?
    let astronomy: WidgetAstronomyData?

    enum CodingKeys: String, CodingKey {
        case location
        case generatedAt = "generated_at"
        case sourcesUsed = "sources_used"
        case current, daily, hourly, astronomy
    }
}

struct WidgetCoordinate: Codable {
    let lat: Double
    let lon: Double
}

struct WidgetCurrentWeather: Codable {
    let temperature: Double?
    let feelsLike: Double?
    let humidity: Double?
    let windSpeed: Double?
    let precipitationProb: Double
    let condition: String
    let conditionCode: String?
    let conditionText: String
    let pressure: Double?
    let uvIndex: Double?

    enum CodingKeys: String, CodingKey {
        case temperature
        case feelsLike = "feels_like"
        case humidity
        case windSpeed = "wind_speed"
        case precipitationProb = "precipitation_prob"
        case condition
        case conditionCode = "condition_code"
        case conditionText = "condition_text"
        case pressure
        case uvIndex = "uv_index"
    }
}

struct WidgetDailyForecast: Codable, Identifiable {
    var id: String { date }
    let date: String
    let tempMax: Double?
    let tempMin: Double?
    let precipitationProb: Double?
    let conditionCode: String
    let conditionText: String?

    enum CodingKeys: String, CodingKey {
        case date
        case tempMax = "temp_max"
        case tempMin = "temp_min"
        case precipitationProb = "precipitation_prob"
        case conditionCode = "condition_code"
        case conditionText = "condition_text"
    }
}

struct WidgetHourlyForecast: Codable, Identifiable {
    var id: String { time }
    let time: String
    let temp: Double
    let precipitationProb: Double?
    let conditionCode: String
    let conditionText: String?

    enum CodingKeys: String, CodingKey {
        case time, temp
        case precipitationProb = "precipitation_prob"
        case conditionCode = "condition_code"
        case conditionText = "condition_text"
    }
}

struct WidgetAstronomyData: Codable {
    let sunrise: String
    let sunset: String
    let moonPhase: String?

    enum CodingKeys: String, CodingKey {
        case sunrise, sunset
        case moonPhase = "moon_phase"
    }
}

// MARK: - Dati salvati via App Group

struct WidgetWeatherData: Codable {
    let forecast: WidgetForecastResponse
    let locationName: String
    let fetchedAt: Date
}

// MARK: - Servizio di rete per il widget

enum WidgetWeatherService {
    private static let apiBaseURL = "https://smart-meteo.netlify.app"
    private static let appGroupID = "group.com.liago.smartmeteo.shared"

    static func fetchForecast(lat: Double, lon: Double) async throws -> WidgetForecastResponse {
        guard let url = URL(string: "\(apiBaseURL)/api/forecast?lat=\(lat)&lon=\(lon)") else {
            throw URLError(.badURL)
        }

        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(WidgetForecastResponse.self, from: data)
    }

    // Salva i dati nel container condiviso App Group
    static func save(_ data: WidgetWeatherData) {
        guard let defaults = UserDefaults(suiteName: appGroupID) else { return }
        if let encoded = try? JSONEncoder().encode(data) {
            defaults.set(encoded, forKey: "widgetWeatherData")
        }
    }

    // Leggi i dati dal container condiviso
    static func loadCached() -> WidgetWeatherData? {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let data = defaults.data(forKey: "widgetWeatherData"),
              let decoded = try? JSONDecoder().decode(WidgetWeatherData.self, from: data) else {
            return nil
        }
        return decoded
    }

    // Salva le coordinate dell'ultima posizione nota
    static func saveLocation(lat: Double, lon: Double, name: String) {
        guard let defaults = UserDefaults(suiteName: appGroupID) else { return }
        defaults.set(lat, forKey: "widgetLat")
        defaults.set(lon, forKey: "widgetLon")
        defaults.set(name, forKey: "widgetLocationName")
    }

    static func loadLocation() -> (lat: Double, lon: Double, name: String)? {
        guard let defaults = UserDefaults(suiteName: appGroupID) else { return nil }
        let lat = defaults.double(forKey: "widgetLat")
        let lon = defaults.double(forKey: "widgetLon")
        let name = defaults.string(forKey: "widgetLocationName") ?? ""
        if lat == 0 && lon == 0 { return nil }
        return (lat, lon, name)
    }
}

// MARK: - Utility per icone e colori meteo

enum WeatherIconMapper {
    static func sfSymbol(for code: String) -> String {
        if let c = Int(code) {
            switch c {
            case 0: return "sun.max.fill"
            case 1, 2: return "cloud.sun.fill"
            case 3: return "cloud.fill"
            case 45, 48: return "cloud.fog.fill"
            case 51, 53, 55, 56, 57: return "cloud.drizzle.fill"
            case 61, 63, 65, 66, 67, 80, 81: return "cloud.rain.fill"
            case 71, 73, 75, 77, 85, 86: return "snowflake"
            case 82, 95, 96, 99: return "cloud.bolt.rain.fill"
            default: return "cloud.sun.fill"
            }
        }
        switch code.lowercased() {
        case "clear": return "sun.max.fill"
        case "cloudy": return "cloud.fill"
        case "rain": return "cloud.rain.fill"
        case "snow": return "cloud.snow.fill"
        case "storm": return "cloud.bolt.rain.fill"
        case "fog": return "cloud.fog.fill"
        case "partly-cloudy", "partly cloudy": return "cloud.sun.fill"
        default: return "cloud.sun.fill"
        }
    }

    static func conditionLabel(for code: String) -> String {
        if let c = Int(code) {
            switch c {
            case 0: return "Sereno"
            case 1: return "Prevalentemente sereno"
            case 2: return "Parzialmente nuvoloso"
            case 3: return "Coperto"
            case 45, 48: return "Nebbia"
            case 51, 53, 55: return "Pioggerella"
            case 56, 57: return "Pioggia gelata"
            case 61, 63: return "Pioggia"
            case 65: return "Pioggia intensa"
            case 66, 67: return "Pioggia gelata"
            case 71, 73: return "Neve"
            case 75, 77: return "Neve intensa"
            case 80, 81: return "Rovesci"
            case 82: return "Acquazzoni"
            case 85, 86: return "Neve a tratti"
            case 95: return "Temporale"
            case 96, 99: return "Temporale con grandine"
            default: return "Variabile"
            }
        }
        switch code.lowercased() {
        case "clear": return "Sereno"
        case "cloudy": return "Nuvoloso"
        case "rain": return "Pioggia"
        case "snow": return "Neve"
        case "storm": return "Temporale"
        case "fog": return "Nebbia"
        default: return "Variabile"
        }
    }

    /// Condizione meteo semplificata per i gradienti
    static func simpleCondition(for code: String) -> String {
        if let c = Int(code) {
            switch c {
            case 0, 1: return "clear"
            case 2, 3: return "cloudy"
            case 45, 48: return "fog"
            case 51...67, 80, 81, 82: return "rain"
            case 71...77, 85, 86: return "snow"
            case 95, 96, 99: return "storm"
            default: return "cloudy"
            }
        }
        return code.lowercased()
    }
}
