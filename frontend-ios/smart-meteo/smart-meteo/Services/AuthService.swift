import Foundation
import Combine

class AuthService: ObservableObject {
    static let shared = AuthService()
    
    @Published var isAuthenticated: Bool = false
    @Published var accessToken: String?
    @Published var refreshToken: String?
    @Published var userId: String?
    @Published var tokenExpiry: Date?
    
    private let defaults = UserDefaults.standard
    private let tokenKey = "supabase_access_token"
    private let refreshKey = "supabase_refresh_token"
    private let userKey = "supabase_user_id"
    private let expiryKey = "supabase_token_expiry"
    
    private init() {
        // Restore session
        if let token = defaults.string(forKey: tokenKey),
           let refresh = defaults.string(forKey: refreshKey),
           let uid = defaults.string(forKey: userKey) {
            
            self.accessToken = token
            self.refreshToken = refresh
            self.userId = uid
            self.tokenExpiry = defaults.object(forKey: expiryKey) as? Date
            self.isAuthenticated = true
        }
    }
    
    func signIn(email: String, password: String) async throws {
        // Implementation with Custom Supabase SDK
        let response = try await SupabaseClient.shared.signIn(email: email, password: password)
        
        await MainActor.run {
            self.saveSession(response: response)
        }
    }
    
    func signOut() async throws {
        await MainActor.run {
            self.clearSession()
        }
    }
    
    // Helper to get token for API requests
    func getValidToken() async throws -> String? {
        if let expiry = tokenExpiry, expiry > Date().addingTimeInterval(60) { // Buffer 60s
            return accessToken
        }
        
        // Refresh needed
        guard let currentRefresh = refreshToken else {
            await MainActor.run {
                self.clearSession()
            }
            return nil
        }
        
        do {
            let response = try await SupabaseClient.shared.refreshToken(refreshToken: currentRefresh)
            await MainActor.run {
                self.saveSession(response: response)
            }
            return response.access_token
        } catch {
            print("Token refresh failed: \(error)")
            await MainActor.run {
                self.clearSession()
            }
            return nil
        }
    }
    
    private func saveSession(response: AuthResponse) {
        self.accessToken = response.access_token
        self.refreshToken = response.refresh_token
        self.userId = response.user.id
        self.tokenExpiry = Date().addingTimeInterval(TimeInterval(response.expires_in))
        self.isAuthenticated = true
        
        defaults.set(response.access_token, forKey: tokenKey)
        defaults.set(response.refresh_token, forKey: refreshKey)
        defaults.set(response.user.id, forKey: userKey)
        defaults.set(self.tokenExpiry, forKey: expiryKey)
    }
    
    private func clearSession() {
        self.accessToken = nil
        self.refreshToken = nil
        self.userId = nil
        self.tokenExpiry = nil
        self.isAuthenticated = false
        
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: refreshKey)
        defaults.removeObject(forKey: userKey)
        defaults.removeObject(forKey: expiryKey)
    }
}
