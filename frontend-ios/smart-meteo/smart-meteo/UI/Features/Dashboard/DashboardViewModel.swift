import Foundation
import Combine
import SwiftUI

@MainActor
class DashboardViewModel: ObservableObject {
    @Published var state: ViewState<ForecastResponse> = .idle
    @Published var currentLocationName: String = "Locating..."
    @Published var currentCondition: String = "clear"
    
    private var appState: AppState
    private var cancellables = Set<AnyCancellable>()
    
    init(appState: AppState) {
        self.appState = appState
        setupBindings()
    }
    
    private func setupBindings() {
        // Sync API State
        appState.$weatherState
            .assign(to: &$state)
        
        // Sync Location Name
        appState.$currentLocationName
            .assign(to: &$currentLocationName)
            
        // Sync Condition for Background
        appState.$weatherState
            .compactMap { state -> String? in
                if case .success(let forecast) = state {
                    return forecast.current.condition
                }
                return nil
            }
            .assign(to: &$currentCondition)
    }
    
    func refresh() {
        if let location = appState.currentLocation {
            appState.fetchWeather(for: location)
        } else {
            appState.requestLocation()
        }
    }
}
