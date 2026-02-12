import Foundation

struct SupabaseConfig {
    static let url = URL(string: "https://cpozifhaudnynkjsltuh.supabase.co")!
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwb3ppZmhhdWRueW5ranNsdHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDIyNzQsImV4cCI6MjA4NjIxODI3NH0.RMYGEDshvTIA55XjrgcEKgqUbihgaE1b7-KhvL7DTj8"
}

enum SupabaseError: Error {
    case invalidURL
    case networkError(Error)
    case decodingError(Error)
    case serverError(Int, String)
    case unauthorized
}

class SupabaseClient {
    static let shared = SupabaseClient()
    
    private init() {}
    
    func authHeaders(token: String?) -> [String: String] {
        var headers = [
            "apikey": SupabaseConfig.anonKey,
            "Content-Type": "application/json"
        ]
        if let token = token {
            headers["Authorization"] = "Bearer \(token)"
        } else {
            headers["Authorization"] = "Bearer \(SupabaseConfig.anonKey)"
        }
        return headers
    }
    
    // MARK: - Auth
    
    func signIn(email: String, password: String) async throws -> AuthResponse {
        let url = SupabaseConfig.url.appendingPathComponent("/auth/v1/token")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        var urlComponents = URLComponents(url: url, resolvingAgainstBaseURL: false)
        urlComponents?.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        request.url = urlComponents?.url
        
        request.allHTTPHeaderFields = authHeaders(token: nil)
        
        let body = ["email": email, "password": password]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown server error"
            throw SupabaseError.serverError(httpResponse.statusCode, errorMsg)
        }
        
        return try JSONDecoder().decode(AuthResponse.self, from: data)
    }
        
    func refreshToken(refreshToken: String) async throws -> AuthResponse {
        let url = SupabaseConfig.url.appendingPathComponent("/auth/v1/token")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        var urlComponents = URLComponents(url: url, resolvingAgainstBaseURL: false)
        urlComponents?.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        request.url = urlComponents?.url
        
        request.allHTTPHeaderFields = authHeaders(token: nil)
        
        let body = ["refresh_token": refreshToken]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
             let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown server error"
            throw SupabaseError.serverError(httpResponse.statusCode, errorMsg)
        }
        
        return try JSONDecoder().decode(AuthResponse.self, from: data)
    }
    
    // MARK: - Database
    
    func from(_ table: String) -> QueryBuilder {
        return QueryBuilder(table: table, client: self)
    }
    
    func rpc(_ function: String, params: [String: Any], token: String?) async throws -> Data {
        let url = SupabaseConfig.url.appendingPathComponent("/rest/v1/rpc/\(function)")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.allHTTPHeaderFields = authHeaders(token: token)
        
        request.httpBody = try JSONSerialization.data(withJSONObject: params)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
             let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown server error"
            throw SupabaseError.serverError(httpResponse.statusCode, errorMsg)
        }
        return data
    }
    
    // Low level fetch
    func execute(request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            if httpResponse.statusCode == 401 { throw SupabaseError.unauthorized }
            if !(200...299).contains(httpResponse.statusCode) {
                 let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown server error"
                throw SupabaseError.serverError(httpResponse.statusCode, errorMsg)
            }
        }
        return data
    }
}

class QueryBuilder {
    let table: String
    let client: SupabaseClient
    var queryItems: [URLQueryItem] = []
    
    init(table: String, client: SupabaseClient) {
        self.table = table
        self.client = client
    }
    
    func select(_ columns: String) -> QueryBuilder {
        queryItems.append(URLQueryItem(name: "select", value: columns))
        return self
    }
    
    func eq(_ column: String, _ value: String) -> QueryBuilder {
        queryItems.append(URLQueryItem(name: column, value: "eq.\(value)"))
        return self
    }
    
     func `in`(_ column: String, _ values: [String]) -> QueryBuilder {
         // Format: in.(val1,val2)
         let joined = values.joined(separator: ",")
         queryItems.append(URLQueryItem(name: column, value: "in.(\(joined))"))
         return self
    }
    
    // Execute GET
    func get(token: String?) async throws -> Data {
        var url = SupabaseConfig.url.appendingPathComponent("/rest/v1/\(table)")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems
        url = components.url!
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.allHTTPHeaderFields = client.authHeaders(token: token)
        
        return try await client.execute(request: request)
    }
    
    // Execute UPDATE (PATCH)
    func update(_ fields: [String: Any], token: String?) async throws -> Data {
        var url = SupabaseConfig.url.appendingPathComponent("/rest/v1/\(table)")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems // logic for WHERE clause
        url = components.url!
        
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.allHTTPHeaderFields = client.authHeaders(token: token)
        request.allHTTPHeaderFields?["Prefer"] = "return=representation" // Get updated row back
        request.httpBody = try JSONSerialization.data(withJSONObject: fields)
        
        return try await client.execute(request: request)
    }
}

// REST Response Models
struct AuthResponse: Codable {
    let access_token: String
    let token_type: String
    let expires_in: Int
    let refresh_token: String
    let user: User
}

struct User: Codable {
    let id: String
    let email: String?
    let role: String?
}
