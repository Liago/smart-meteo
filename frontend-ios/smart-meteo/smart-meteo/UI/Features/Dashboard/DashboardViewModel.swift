import Foundation
import Combine
import SwiftUI

@MainActor
class DashboardViewModel: ObservableObject {
    @Published var state: ViewState<ForecastResponse> = .idle
    @Published var currentLocationName: String = "Locating..."
    @Published var currentCondition: String = "clear"
    
    @Published var isAuthenticated: Bool = false
    
    private var appState: AppState
    private var cancellables = Set<AnyCancellable>()
    
    init(appState: AppState) {
        self.appState = appState
        setupBindings()
    }
    
    private func setupBindings() {
        // Sync Auth State
        appState.$isAuthenticated
            .receive(on: RunLoop.main)
            .sink { [weak self] auth in
                self?.isAuthenticated = auth
            }
            .store(in: &cancellables)

        // Sync API State
        appState.$weatherState
            .receive(on: RunLoop.main)
            .sink { [weak self] newState in
                self?.state = newState
            }
            .store(in: &cancellables)
        
        // Sync Location Name
        appState.$currentLocationName
            .receive(on: RunLoop.main)
            .sink { [weak self] newName in
                self?.currentLocationName = newName
            }
            .store(in: &cancellables)
            
        // Sync Condition for Background
        appState.$weatherState
            .compactMap { state -> String? in
                if case .success(let forecast) = state {
                    return forecast.current.condition
                }
                return nil
            }
            .receive(on: RunLoop.main)
            .sink { [weak self] condition in
                self?.currentCondition = condition ?? "clear"
            }
            .store(in: &cancellables)
    }
    
    func refresh() {
        if let location = appState.currentLocation {
            appState.fetchWeather(for: location)
        } else {
            appState.requestLocation()
        }
    }
    
    // MARK: - Favorites / Home
    
    var isCurrentLocationFavorite: Bool {
        appState.isFavorite(name: currentLocationName)
    }
    
    var isCurrentLocationHome: Bool {
        appState.homeLocation?.name == currentLocationName
    }
    
    func toggleFavorite() {
        appState.toggleFavorite()
    }
    
    func setCurrentAsHome() {
        // Find the favorite matching the current location name
        if let fav = appState.favoriteLocations.first(where: { $0.name == currentLocationName }) {
            appState.setAsHome(location: fav)
        }
    }
}
