import Foundation

// MARK: - API Response
struct ForecastResponse: Codable {
    let location: Coordinate
    let generatedAt: String
    let sourcesUsed: [String]
    let current: ForecastCurrent
    let daily: [DailyForecast]?
    let hourly: [HourlyForecast]?
    let astronomy: AstronomyData?
    
    enum CodingKeys: String, CodingKey {
        case location
        case generatedAt = "generated_at"
        case sourcesUsed = "sources_used"
        case current
        case daily
        case hourly
        case astronomy
    }
}

struct Coordinate: Codable {
    let lat: Double
    let lon: Double
}

// MARK: - Current Weather
struct ForecastCurrent: Codable {
    let temperature: Double?
    let feelsLike: Double?
    let humidity: Double?
    let windSpeed: Double?
    let precipitationProb: Double
    let condition: String
    let conditionText: String
    
    // New fields
    let dewPoint: Double?
    let windGust: Double?
    let windDirectionLabel: String?
    let aqi: Double?
    
    enum CodingKeys: String, CodingKey {
        case temperature
        case feelsLike = "feels_like"
        case humidity
        case windSpeed = "wind_speed"
        case precipitationProb = "precipitation_prob"
        case condition
        case conditionText = "condition_text"
        
        // New keys
        case dewPoint = "dew_point"
        case windGust = "wind_gust"
        case windDirectionLabel = "wind_direction_label"
        case aqi
    }
}

// MARK: - Daily Forecast
struct DailyForecast: Codable, Identifiable {
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

// MARK: - Hourly Forecast
struct HourlyForecast: Codable, Identifiable {
    var id: String { time } // Use time (ISO) as ID
    let time: String
    let temp: Double
    let precipitationProb: Double?
    let conditionCode: String
    let conditionText: String?
    
    enum CodingKeys: String, CodingKey {
        case time
        case temp
        case precipitationProb = "precipitation_prob"
        case conditionCode = "condition_code"
        case conditionText = "condition_text"
    }
}

// MARK: - Astronomy
struct AstronomyData: Codable {
    let sunrise: String
    let sunset: String
}
