import SwiftUI
import Foundation
import Combine
import CoreLocation

// Centralized App State
@MainActor
class AppState: ObservableObject {
    static let shared = AppState()
    
    // Auth State
    @Published var currentUser: UserProfile?
    @Published var isAuthenticated: Bool = false
    
    // Weather Data State
    @Published var selectedTab: Int = 0
    @Published var weatherSources: [WeatherSource] = WeatherSource.defaults
    @Published var favoriteLocations: [SavedLocation] = []
    @Published var homeLocation: SavedLocation?
    @Published var currentLocationName: String = "Locating..."
    @Published var weatherState: ViewState<ForecastResponse> = .idle
    @Published var currentLocation: CLLocation?
    
    // Services
    private let weatherService: WeatherServiceProtocol
    private let locationManager: LocationManager
    private let authService: AuthService
    
    private var cancellables = Set<AnyCancellable>()
    
    init(
        weatherService: WeatherServiceProtocol = WeatherService.shared,
        locationManager: LocationManager = LocationManager(),
        authService: AuthService = AuthService.shared
    ) {
        self.weatherService = weatherService
        self.locationManager = locationManager
        self.authService = authService
        
        
        setupLocation()
        setupAuth()
        fetchSources()
    }
    
    // MARK: - Setup
    
    private func setupLocation() {
        locationManager.$location
            .compactMap { $0 }
            .first() // Auto-fetch on first location update
            .sink { [weak self] location in
                self?.fetchWeather(for: location)
            }
            .store(in: &cancellables)
    }
    
    private func setupAuth() {
        authService.$isAuthenticated
            .assign(to: &$isAuthenticated)
            
        // improved flow: when auth changes to true, fetch favorites
        authService.$isAuthenticated
            .combineLatest(authService.$userId, authService.$accessToken)
            .sink { [weak self] (isAuth, userId, token) in
                if isAuth, let uid = userId, let tok = token {
                    self?.fetchFavorites(userId: uid, token: tok)
                } else if !isAuth {
                    self?.favoriteLocations = [] // Clear on logout
                }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Actions
    
    func requestLocation() {
        locationManager.requestPermission()
        
        // Timeout / Fallback for Simulator
        #if targetEnvironment(simulator)
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            if self?.currentLocation == nil {
                print("Simulator detected: Using fallback location (Rome)")
                let rome = CLLocation(latitude: 41.9028, longitude: 12.4964)
                self?.fetchWeather(for: rome)
            }
        }
        #endif
    }
    
    func fetchWeather(for location: CLLocation) {
        self.currentLocation = location
        self.weatherState = .loading
        reverseGeocode(location: location)
        
        Task {
            do {
                let forecast = try await weatherService.getForecast(
                    latitude: location.coordinate.latitude,
                    longitude: location.coordinate.longitude
                )
                self.weatherState = .success(forecast)
            } catch {
                self.weatherState = .error(error)
            }
        }
    }
    
    func selectLocation(coordinate: Coordinate, name: String) {
        self.currentLocationName = name
        let location = CLLocation(latitude: coordinate.lat, longitude: coordinate.lon)
        fetchWeather(for: location)
    }
    
    // MARK: - Helpers
    private func reverseGeocode(location: CLLocation) {
        let geocoder = CLGeocoder()
        geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, error in
            DispatchQueue.main.async {
                if let place = placemarks?.first {
                    self?.currentLocationName = place.locality ?? place.name ?? "Unknown Location"
                }
            }
        }
    }
}

// User Profile Stub
struct UserProfile: Codable {
    let id: String
    let email: String
    let name: String?
}

// Models
// WeatherSource is defined in Models/WeatherSource.swift

struct SavedLocation: Identifiable, Codable, Equatable {
    var id = UUID()
    let name: String
    let coordinate: Coordinate
    
    static func == (lhs: SavedLocation, rhs: SavedLocation) -> Bool {
        return lhs.name == rhs.name && lhs.coordinate.lat == rhs.coordinate.lat && lhs.coordinate.lon == rhs.coordinate.lon
    }
}

    func fetchFavorites(userId: String, token: String) {
        Task {
            do {
                let favorites = try await LocationService.shared.getFavorites(userId: userId, token: token)
                await MainActor.run {
                    self.favoriteLocations = favorites
                }
            } catch {
                print("Error loading favorites: \(error)")
            }
        }
    }

    func toggleSource(_ sourceId: String) {
        if let index = weatherSources.firstIndex(where: { $0.id == sourceId }) {
            weatherSources[index].active.toggle()
        }
    }
    
    // Internal optimistic update
    private func addLocalFavorite(location: SavedLocation) {
        if !favoriteLocations.contains(where: { $0.name == location.name }) {
            favoriteLocations.append(location)
        }
    }
    
    // Internal optimistic update
    func removeFavorite(at offsets: IndexSet) {
        // Find items to remove to call backend
        let itemsToDelete = offsets.map { favoriteLocations[$0] }
        favoriteLocations.remove(atOffsets: offsets)
        
        // Sync with backend
        guard let userId = authService.userId, let token = authService.accessToken else { return }
        
        Task {
            for item in itemsToDelete {
                try? await LocationService.shared.removeFavorite(userId: userId, token: token, locationId: item.id)
            }
        }
    }
    
    func isFavorite(name: String) -> Bool {
        favoriteLocations.contains { $0.name == name }
    }
    
    func toggleFavorite() {
        guard let location = currentLocation else { return }
        let currentName = currentLocationName
        
        if let existing = favoriteLocations.first(where: { $0.name == currentName }) {
            // Remove
            if let index = favoriteLocations.firstIndex(of: existing) {
                favoriteLocations.remove(at: index)
                
                guard let userId = authService.userId, let token = authService.accessToken else { return }
                Task {
                    try? await LocationService.shared.removeFavorite(userId: userId, token: token, locationId: existing.id)
                }
            }
        } else {
            // Add
            let saved = SavedLocation(
                name: currentName,
                coordinate: Coordinate(lat: location.coordinate.latitude, lon: location.coordinate.longitude)
            )
            addLocalFavorite(location: saved)
            
            guard let userId = authService.userId, let token = authService.accessToken else { return }
            Task {
                try? await LocationService.shared.addFavorite(userId: userId, token: token, location: saved)
                // Optionally re-fetch to get real UUID from DB
                self.fetchFavorites(userId: userId, token: token)
            }
        }
    }    func fetchSources() {
        Task {
            do {
                let sources = try await weatherService.getSources()
                // Update on main thread since weatherSources is @Published
                await MainActor.run {
                    self.weatherSources = sources
                }
            } catch {
                print("Failed to fetch sources: \(error)")
            }
        }
    }
    
    func setAsHome(location: SavedLocation) {
        homeLocation = location
        //Ideally persist this preference
    }
    
    func isHome(location: SavedLocation) -> Bool {
        return homeLocation?.id == location.id
    }
}
