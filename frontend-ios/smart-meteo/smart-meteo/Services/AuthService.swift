import Foundation
import Combine

class AuthService: ObservableObject {
    static let shared = AuthService()
    
    @Published var isAuthenticated: Bool = false
    @Published var accessToken: String?
    @Published var userId: String?
    
    private init() {
        // Here we would initialize Supabase Auth
        // For now, load from Keychain or check session
    }
    
    func signIn(email: String, password: String) async throws {
        // Implementation with Supabase SDK via REST
        let response = try await SupabaseClient.shared.signIn(email: email, password: password)
        
        await MainActor.run {
            self.accessToken = response.access_token
            self.userId = response.user.id
            self.isAuthenticated = true
        }
    }
    
    func signOut() async throws {
        // try await Supabase.auth.signOut()
        await MainActor.run {
            isAuthenticated = false
            accessToken = nil
            userId = nil
        }
    }
    
    // Helper to get token for API requests
    func getValidToken() async throws -> String? {
        // Check expiration and refresh if needed
        return accessToken
    }
}
