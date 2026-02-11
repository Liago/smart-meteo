import Foundation

struct WeatherSource: Codable, Identifiable {
    let id: String
    let name: String
    let weight: Double
    var active: Bool
    let description: String?
    let lastError: String?
    let lastResponseMs: Int?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case weight
        case active
        case description
        case lastError
        case lastResponseMs
    }
}

extension WeatherSource: Equatable {
    static func == (lhs: WeatherSource, rhs: WeatherSource) -> Bool {
        return lhs.id == rhs.id && lhs.active == rhs.active
    }
}

extension WeatherSource {
    static var defaults: [WeatherSource] {
        [
            WeatherSource(id: "tomorrow", name: "Tomorrow.io", weight: 1.2, active: true, description: "Hyper-local nowcasting with minute-by-minute precision", lastError: nil, lastResponseMs: nil),
            WeatherSource(id: "openmeteo", name: "Open-Meteo", weight: 1.1, active: true, description: "High-resolution scientific data from national weather services", lastError: nil, lastResponseMs: nil),
            WeatherSource(id: "openweathermap", name: "OpenWeatherMap", weight: 1.0, active: true, description: "Global coverage baseline and fast fallback", lastError: nil, lastResponseMs: nil),
            WeatherSource(id: "weatherapi", name: "WeatherAPI", weight: 1.0, active: true, description: "Cross-validation for temperature and conditions", lastError: nil, lastResponseMs: nil),
            WeatherSource(id: "accuweather", name: "AccuWeather", weight: 1.1, active: false, description: "Quality-focused with RealFeel temperature", lastError: nil, lastResponseMs: nil)
        ]
    }
}

struct SourcesResponse: Codable {
    let sources: [WeatherSource]
}
