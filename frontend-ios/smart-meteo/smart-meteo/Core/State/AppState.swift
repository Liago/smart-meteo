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
            if let place = placemarks?.first {
                self?.currentLocationName = place.locality ?? place.name ?? "Unknown Location"
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
struct WeatherSource: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let description: String
    let weight: Double
    var isEnabled: Bool
    
    static var defaults: [WeatherSource] {
        [
            WeatherSource(id: "tomorrow", name: "Tomorrow.io", description: "Hyper-local nowcasting with minute-by-minute precision", weight: 1.2, isEnabled: true),
            WeatherSource(id: "openmeteo", name: "Open-Meteo", description: "High-resolution scientific data from national weather services", weight: 1.1, isEnabled: true),
            WeatherSource(id: "openweathermap", name: "OpenWeatherMap", description: "Global coverage baseline and fast fallback", weight: 1.0, isEnabled: true),
            WeatherSource(id: "weatherapi", name: "WeatherAPI", description: "Cross-validation for temperature and conditions", weight: 1.0, isEnabled: true),
            WeatherSource(id: "accuweather", name: "AccuWeather", description: "Quality-focused with RealFeel temperature", weight: 1.1, isEnabled: false)
        ]
    }
}

struct SavedLocation: Identifiable, Codable, Equatable {
    let id = UUID()
    let name: String
    let coordinate: Coordinate
}

extension AppState {
    func toggleSource(_ sourceId: String) {
        if let index = weatherSources.firstIndex(where: { $0.id == sourceId }) {
            weatherSources[index].isEnabled.toggle()
        }
    }
    
    func addFavorite(location: SavedLocation) {
        if !favoriteLocations.contains(where: { $0.name == location.name }) {
            favoriteLocations.append(location)
        }
    }
    
    func removeFavorite(at offsets: IndexSet) {
        favoriteLocations.remove(atOffsets: offsets)
    }
    
    func isFavorite(name: String) -> Bool {
        favoriteLocations.contains { $0.name == name }
    }
    
    func toggleFavorite() {
        guard let location = currentLocation else { return }
        let currentName = currentLocationName
        
        if isFavorite(name: currentName) {
            favoriteLocations.removeAll { $0.name == currentName }
        } else {
            let saved = SavedLocation(
                name: currentName,
                coordinate: Coordinate(lat: location.coordinate.latitude, lon: location.coordinate.longitude)
            )
            addFavorite(location: saved)
        }
    }
}
