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
    let conditionCode: String?
    let conditionText: String
    
    // New fields
    let dewPoint: Double?
    let windGust: Double?
    let windDirectionLabel: String?
    let aqi: Double?
    let pressure: Double?
    let uvIndex: Double?
    let visibility: Double?       // km
    let cloudCover: Double?       // percentuale 0-100
    let airQuality: AirQualityDetail?

    enum CodingKeys: String, CodingKey {
        case temperature
        case feelsLike = "feels_like"
        case humidity
        case windSpeed = "wind_speed"
        case precipitationProb = "precipitation_prob"
        case condition
        case conditionCode = "condition_code"
        case conditionText = "condition_text"

        // New keys
        case dewPoint = "dew_point"
        case windGust = "wind_gust"
        case windDirectionLabel = "wind_direction_label"
        case aqi
        case pressure
        case uvIndex = "uv_index"
        case visibility
        case cloudCover = "cloud_cover"
        case airQuality = "air_quality"
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
    let uvIndexMax: Double?

    enum CodingKeys: String, CodingKey {
        case date
        case tempMax = "temp_max"
        case tempMin = "temp_min"
        case precipitationProb = "precipitation_prob"
        case conditionCode = "condition_code"
        case conditionText = "condition_text"
        case uvIndexMax = "uv_index_max"
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
    let moonPhase: String?
    let moonrise: String?
    let moonset: String?
    let moonIllumination: Int?

    enum CodingKeys: String, CodingKey {
        case sunrise
        case sunset
        case moonPhase = "moon_phase"
        case moonrise
        case moonset
        case moonIllumination = "moon_illumination"
    }
}

// MARK: - Air Quality Detail
struct AirQualityDetail: Codable {
    let aqiUsEpa: Double?
    let pm25: Double?
    let pm10: Double?
    let no2: Double?
    let o3: Double?
    let co: Double?
    let so2: Double?

    enum CodingKeys: String, CodingKey {
        case aqiUsEpa = "aqi_us_epa"
        case pm25 = "pm2_5"
        case pm10, no2, o3, co, so2
    }
}
