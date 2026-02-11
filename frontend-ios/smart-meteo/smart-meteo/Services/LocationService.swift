import Foundation
import Combine

struct Profile: Codable {
    let id: String
    let favorite_locations: [String]?
}

struct LocationDB: Codable {
    let id: String
    let name: String
    let latitude: Double
    let longitude: Double
}

class LocationService {
    static let shared = LocationService()
    private let client = SupabaseClient.shared
    
    private init() {}
    
    func getFavorites(userId: String, token: String) async throws -> [SavedLocation] {
        // 1. Get profile favorites
        let url = SupabaseConfig.url.appendingPathComponent("/rest/v1/profiles")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,favorite_locations"),
            URLQueryItem(name: "id", value: "eq.\(userId)")
        ]
        
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        request.allHTTPHeaderFields = client.authHeaders(token: token)
        
        let profileData = try await client.execute(request: request)
        let profiles = try JSONDecoder().decode([Profile].self, from: profileData)
        
        guard let profile = profiles.first, let favIds = profile.favorite_locations, !favIds.isEmpty else {
            return []
        }
        
        // 2. Get locations details
        let locUrl = SupabaseConfig.url.appendingPathComponent("/rest/v1/locations")
        var locComponents = URLComponents(url: locUrl, resolvingAgainstBaseURL: false)!
        let idsString = favIds.joined(separator: ",")
        locComponents.queryItems = [
            URLQueryItem(name: "select", value: "id,name,latitude,longitude"),
            URLQueryItem(name: "id", value: "in.(\(idsString))")
        ]
        
        var locRequest = URLRequest(url: locComponents.url!)
        locRequest.httpMethod = "GET"
        locRequest.allHTTPHeaderFields = client.authHeaders(token: token)
        
        let locData = try await client.execute(request: locRequest)
        let locationsDB = try JSONDecoder().decode([LocationDB].self, from: locData)
        
        return locationsDB.map { loc in
            SavedLocation(
                id: UUID(uuidString: loc.id) ?? UUID(),
                name: loc.name,
                coordinate: Coordinate(lat: loc.latitude, lon: loc.longitude)
            )
        }
    }
    
    func addFavorite(userId: String, token: String, location: SavedLocation) async throws {
        // 1. Upsert Location via RPC
        let params: [String: Any] = [
            "p_name": location.name,
            "p_latitude": location.coordinate.lat,
            "p_longitude": location.coordinate.lon,
            "p_country": NSNull(),
            "p_timezone": NSNull()
        ]
        
        // This RPC returns the UUID string
        let uuidData = try await client.rpc("upsert_location", params: params, token: token)
        let uuidString = String(data: uuidData, encoding: .utf8)?.replacingOccurrences(of: "\"", with: "") ?? ""
        
        guard !uuidString.isEmpty else { throw SupabaseError.serverError(500, "Failed to upsert location") }
        
        // 2. Fetch current favorites
        let currentFavs = try await getCurrentFavoritesIDs(userId: userId, token: token)
        
        if currentFavs.contains(uuidString) { return }
        
        // 3. Update profile
        var newFavs = currentFavs
        newFavs.append(uuidString)
        
        try await updateProfileFavorites(userId: userId, token: token, favorites: newFavs)
    }
    
    func removeFavorite(userId: String, token: String, locationId: UUID) async throws {
        // Note: locationId passed here is likely generated locally if from API response it matches DB UUID
        let uuidString = locationId.uuidString.lowercased()
         
        // 1. Fetch current favorites
        let currentFavs = try await getCurrentFavoritesIDs(userId: userId, token: token)
        
        // 2. Filter
        let newFavs = currentFavs.filter { $0.lowercased() != uuidString }
        
        if newFavs.count == currentFavs.count { return }
        
        // 3. Update
        try await updateProfileFavorites(userId: userId, token: token, favorites: newFavs)
    }
    
    // Helpers
    private func getCurrentFavoritesIDs(userId: String, token: String) async throws -> [String] {
        let url = SupabaseConfig.url.appendingPathComponent("/rest/v1/profiles")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,favorite_locations"),
            URLQueryItem(name: "id", value: "eq.\(userId)")
        ]
        
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        request.allHTTPHeaderFields = client.authHeaders(token: token)
        
        let profileData = try await client.execute(request: request)
        let profiles = try JSONDecoder().decode([Profile].self, from: profileData)
        return profiles.first?.favorite_locations ?? []
    }
    
    private func updateProfileFavorites(userId: String, token: String, favorites: [String]) async throws {
        let url = SupabaseConfig.url.appendingPathComponent("/rest/v1/profiles")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "id", value: "eq.\(userId)")]
        
        var request = URLRequest(url: components.url!)
        request.httpMethod = "PATCH"
        request.allHTTPHeaderFields = client.authHeaders(token: token)
        request.allHTTPHeaderFields?["Prefer"] = "return=representation"
        
        let body = ["favorite_locations": favorites]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        _ = try await client.execute(request: request)
    }
}
