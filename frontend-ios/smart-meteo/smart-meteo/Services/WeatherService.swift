import Foundation
import CoreLocation

// Protocol for testing/mocking
protocol WeatherServiceProtocol {
    func getForecast(latitude: Double, longitude: Double) async throws -> ForecastResponse
    func getSources() async throws -> [WeatherSource]
}

class WeatherService: WeatherServiceProtocol {
    
    // Singleton for now, but could be injected via Init
    static let shared = WeatherService()
    private let apiService = APIService.shared
    
    private init() {}
    
    func getForecast(latitude: Double, longitude: Double) async throws -> ForecastResponse {
        let endpoint = "/api/forecast?lat=\(latitude)&lon=\(longitude)"
        return try await apiService.fetch(endpoint: endpoint)
    }
    
    func getSources() async throws -> [WeatherSource] {
        let response: SourcesResponse = try await apiService.fetch(endpoint: "/api/sources")
        return response.sources
    }
    
    // Future: Toggle source logic
}
