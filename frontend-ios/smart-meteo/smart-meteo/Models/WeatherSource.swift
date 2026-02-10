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

struct SourcesResponse: Codable {
    let sources: [WeatherSource]
}
