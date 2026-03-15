import Foundation

enum APIError: Error {
    case invalidURL
    case requestFailed
    case decodingError
    case unauthorized
    case unknown
}

class APIService {
    static let shared = APIService()
    
    private init() {}
    
    func fetch<T: Decodable>(endpoint: String, method: String = "GET", headers: [String: String]? = nil) async throws -> T {
        guard let url = URL(string: "\(AppConfig.apiBaseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.allHTTPHeaderFields = headers
        
        // Add auth token if available (implementation pending AuthService)
        // if let token = AuthService.shared.accessToken {
        //     request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        // }
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.requestFailed
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                if httpResponse.statusCode == 401 { throw APIError.unauthorized }
                throw APIError.requestFailed
            }
            
            let decoder = JSONDecoder()
            // Assume ISO8601 dates or custom date strategy if needed
            // decoder.dateDecodingStrategy = .iso8601 
            
            return try decoder.decode(T.self, from: data)
        } catch {
            print("API Error: \(error)")
            throw error
        }
    }
    
    struct EmptyResponse: Decodable {}
    
    // Recupera le allerte attive per una posizione
    func fetchActiveAlerts(lat: Double, lon: Double) async throws -> [WeatherAlert] {
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/api/alerts/active?lat=\(lat)&lon=\(lon)") else {
            throw APIError.invalidURL
        }

        let (data, response) = try await URLSession.shared.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed
        }

        struct AlertsResponse: Decodable {
            let alerts: [WeatherAlert]
        }

        let decoded = try JSONDecoder().decode(AlertsResponse.self, from: data)
        return decoded.alerts
    }

    func subscribeToAlerts(deviceToken: String, lat: Double, lon: Double, locationName: String?) async throws {
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/api/alerts/subscribe") else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "deviceToken": deviceToken,
            "lat": lat,
            "lon": lon,
            "locationName": locationName ?? "",
            "platform": "ios"
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed
        }
    }
}
