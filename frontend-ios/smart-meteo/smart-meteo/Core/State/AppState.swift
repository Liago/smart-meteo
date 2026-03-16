import SwiftUI
import Foundation
import Combine
import CoreLocation
import WidgetKit

// Centralized App State
@MainActor
class AppState: ObservableObject {
    static let shared = AppState()
    
    // Auth State
    @Published var currentUser: UserProfile?
    @Published var isAuthenticated: Bool = false
    
    // Preferences State
    @Published var isHapticEnabled: Bool = UserDefaults.standard.object(forKey: "isHapticEnabled") as? Bool ?? true {
        didSet {
            UserDefaults.standard.set(isHapticEnabled, forKey: "isHapticEnabled")
        }
    }
    
    // Weather Data State
    @Published var selectedTab: Int = 0
    @Published var weatherSources: [WeatherSource] = WeatherSource.defaults
    @Published var favoriteLocations: [SavedLocation] = []
    @Published var homeLocation: SavedLocation?
    @Published var currentLocationName: String = "Locating..."
    @Published var weatherState: ViewState<ForecastResponse> = .idle
    @Published var currentLocation: CLLocation?

    // Weather Alerts State
    @Published var activeAlerts: [WeatherAlert] = []
    @Published var showAlertsModal: Bool = false
    @Published var selectedAlertFromPush: WeatherAlert?
    
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
        loadHomeLocation()
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
        
        // Trigger location request on startup
        requestLocation()
    }
    
    private func setupAuth() {
        authService.$isAuthenticated
            .assign(to: &$isAuthenticated)
            
        // When auth changes to true, fetch favorites with a fresh token
        authService.$isAuthenticated
            .removeDuplicates()
            .sink { [weak self] isAuth in
                if isAuth {
                    self?.fetchFavorites()
                } else {
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
    
    func fetchWeather(for location: CLLocation, name: String? = nil) {
        self.currentLocation = location
        self.weatherState = .loading
        
        if let name = name {
            self.currentLocationName = name
        } else {
            reverseGeocode(location: location)
        }
        
        Task {
            do {
                let forecast = try await weatherService.getForecast(
                    latitude: location.coordinate.latitude,
                    longitude: location.coordinate.longitude
                )

                await MainActor.run {
                    self.weatherState = .success(forecast)

                    // Estrai le allerte dalla risposta forecast
                    if let alerts = forecast.alerts, !alerts.isEmpty {
                        self.activeAlerts = alerts.filter { $0.isActive }
                    }
                    // Condividi dati con il widget via App Group
                    self.updateWidgetData(forecast: forecast, location: location)
                }

                // Fetch anche le allerte dal database (potrebbe averne di più)
                await fetchAlerts(lat: location.coordinate.latitude, lon: location.coordinate.longitude)
            } catch {
                await MainActor.run {
                    self.weatherState = .error(error)
                }
            }
        }
    }
    
    func selectLocation(coordinate: Coordinate, name: String) {
        let location = CLLocation(latitude: coordinate.lat, longitude: coordinate.lon)
        fetchWeather(for: location, name: name)
    }
    
    /// Names that indicate reverse geocoding hasn't resolved yet (or failed).
    /// These should never be persisted as a location name.
    static let invalidLocationNames: Set<String> = ["Locating...", "Unknown Location", ""]

    // MARK: - Widget Data Sharing

    private static let widgetAppGroupID = "group.com.liago.smartmeteo.shared"

    private func updateWidgetData(forecast: ForecastResponse, location: CLLocation) {
        guard let defaults = UserDefaults(suiteName: Self.widgetAppGroupID) else { return }

        // Salva coordinate e nome della posizione
        defaults.set(location.coordinate.latitude, forKey: "widgetLat")
        defaults.set(location.coordinate.longitude, forKey: "widgetLon")
        defaults.set(currentLocationName, forKey: "widgetLocationName")

        // Salva il forecast serializzato per il widget
        if let encoded = try? JSONEncoder().encode(forecast) {
            let wrapper: [String: Any] = [
                "forecast": encoded,
                "locationName": currentLocationName,
                "fetchedAt": Date().timeIntervalSince1970
            ]
            defaults.set(encoded, forKey: "widgetForecastData")
            defaults.set(currentLocationName, forKey: "widgetLocationName")
            defaults.set(Date().timeIntervalSince1970, forKey: "widgetFetchedAt")
        }

        // Aggiorna i widget
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: - Helpers
    private func reverseGeocode(location: CLLocation) {
        let geocoder = CLGeocoder()
        geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, error in
            DispatchQueue.main.async {
                if let place = placemarks?.first {
                    self?.currentLocationName = place.locality ?? place.name ?? "Unknown Location"
                } else {
                    // Fallback to coordinates when reverse geocoding fails
                    let lat = String(format: "%.4f", location.coordinate.latitude)
                    let lon = String(format: "%.4f", location.coordinate.longitude)
                    self?.currentLocationName = "\(lat), \(lon)"
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

extension AppState {
    func fetchFavorites() {
        Task {
            do {
                guard let token = try await authService.getValidToken(),
                      let userId = authService.userId else {
                    print("No valid token or userId for fetching favorites")
                    return
                }
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
        Task {
            guard let token = try? await authService.getValidToken(),
                  let userId = authService.userId else { return }
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

        // Don't save if the name hasn't been resolved yet
        guard !AppState.invalidLocationNames.contains(currentName) else { return }

        if let existing = favoriteLocations.first(where: { $0.name == currentName }) {
            // Remove
            if let index = favoriteLocations.firstIndex(of: existing) {
                favoriteLocations.remove(at: index)
                
                Task {
                    guard let token = try? await authService.getValidToken(),
                          let userId = authService.userId else { return }
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
            
            Task {
                guard let token = try? await authService.getValidToken(),
                      let userId = authService.userId else { return }
                try? await LocationService.shared.addFavorite(userId: userId, token: token, location: saved)
                // Re-fetch to get real UUID from DB
                self.fetchFavorites()
            }
        }
    }
    
    func fetchSources() {
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
        if homeLocation?.id == location.id {
            // Toggle off
            homeLocation = nil
            UserDefaults.standard.removeObject(forKey: "homeLocation")
        } else {
            homeLocation = location
            if let encoded = try? JSONEncoder().encode(location) {
                UserDefaults.standard.set(encoded, forKey: "homeLocation")
            }
        }
    }
    
    private func loadHomeLocation() {
        if let savedLoc = UserDefaults.standard.data(forKey: "homeLocation"),
           let decoded = try? JSONDecoder().decode(SavedLocation.self, from: savedLoc) {
            self.homeLocation = decoded
        }
    }
    
    func isHome(location: SavedLocation) -> Bool {
        return homeLocation?.id == location.id
    }

    // MARK: - Weather Alerts

    func fetchAlerts(lat: Double, lon: Double) async {
        do {
            let alerts = try await APIService.shared.fetchActiveAlerts(lat: lat, lon: lon)
            await MainActor.run {
                // Unisci le allerte dal forecast e dal DB, deduplicando per id
                var merged: [String: WeatherAlert] = [:]
                for a in self.activeAlerts { merged[a.id] = a }
                for a in alerts {
                    // Il DB usa external_alert_id come campo, mappiamo
                    merged[a.id] = a
                }
                self.activeAlerts = Array(merged.values).filter { $0.isActive }
            }
        } catch {
            print("Failed to fetch active alerts: \(error)")
        }
    }

    func handlePushAlert(alertId: String) {
        // Cerca l'allerta tra quelle attive
        if let alert = activeAlerts.first(where: { $0.id == alertId }) {
            selectedAlertFromPush = alert
            showAlertsModal = true
        } else {
            // Se non è tra quelle locali, apri comunque la modale
            showAlertsModal = true
        }
    }
}
