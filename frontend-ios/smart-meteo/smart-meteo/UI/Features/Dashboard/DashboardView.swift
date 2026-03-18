import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    @State private var isSidebarPresented = false
    @State private var isSearchPresented = false
    @State private var isAlertsPresented = false
    
    // Computed helpers that delegate to appState
    private var isCurrentLocationHome: Bool {
        appState.homeLocation?.name == appState.currentLocationName
    }
    
    private var isCurrentLocationFavorite: Bool {
        appState.isFavorite(name: appState.currentLocationName)
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Light Background
                Color(red: 252/255, green: 249/255, blue: 246/255)
                    .ignoresSafeArea()
                
                // Content
                ScrollView {
                    VStack(spacing: 20) {
                        // Header
                        HStack {
                            // Search Trigger
                            Button(action: { isSearchPresented = true }) {
                                Image(systemName: "magnifyingglass")
                                    .font(.title2)
                                    .fontWeight(.medium)
                                    .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255))
                                    .padding(12)
                                    .background(Color.white)
                                    .clipShape(Circle())
                                    .shadow(color: .black.opacity(0.05), radius: 5, x: 0, y: 2)
                            }
                            
                            Spacer()
                            
                            HStack(spacing: 4) {
                                Image(systemName: isCurrentLocationHome ? "house.fill" : "location.fill")
                                    .font(.subheadline)
                                    .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255))
                                Text(appState.currentLocationName)
                                    .font(.headline)
                                    .fontWeight(.bold)
                                    .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255))
                            }
                            .contentShape(Rectangle())
                            .contextMenu {
                                // Toggle Favorite
                                Button {
                                    HapticManager.selection()
                                    appState.toggleFavorite()
                                } label: {
                                    Label(
                                        isCurrentLocationFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti",
                                        systemImage: isCurrentLocationFavorite ? "star.slash" : "star"
                                    )
                                }
                                
                                // Set as Home (only when it's already a favorite)
                                if isCurrentLocationFavorite {
                                    Button {
                                        HapticManager.selection()
                                        if let fav = appState.favoriteLocations.first(where: { $0.name == appState.currentLocationName }) {
                                            appState.setAsHome(location: fav)
                                        }
                                    } label: {
                                        Label(
                                            isCurrentLocationHome ? "Rimuovi come Casa" : "Imposta come Casa",
                                            systemImage: isCurrentLocationHome ? "house.slash" : "house"
                                        )
                                    }
                                }
                            }
                            
                            Spacer()
                            
                            // Alert Badge Button
                            if !appState.activeAlerts.isEmpty {
                                Button(action: { isAlertsPresented = true }) {
                                    ZStack(alignment: .topTrailing) {
                                        Image(systemName: "exclamationmark.triangle.fill")
                                            .font(.title2)
                                            .fontWeight(.medium)
                                            .foregroundColor(.orange)
                                            .padding(12)
                                            .background(Color.white)
                                            .clipShape(Circle())
                                            .shadow(color: .black.opacity(0.05), radius: 5, x: 0, y: 2)

                                        // Badge con numero allerte
                                        Text("\(appState.activeAlerts.count)")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundColor(.white)
                                            .frame(width: 20, height: 20)
                                            .background(Circle().fill(Color.red))
                                            .offset(x: 4, y: -4)
                                    }
                                }
                            }

                            // Settings / Sidebar Trigger
                            Button(action: {
                                withAnimation {
                                    isSidebarPresented = true
                                }
                            }) {
                                Image(systemName: "gearshape")
                                    .font(.title2)
                                    .fontWeight(.medium)
                                    .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255))
                                    .padding(12)
                                    .background(Color.white)
                                    .clipShape(Circle())
                                    .shadow(color: .black.opacity(0.05), radius: 5, x: 0, y: 2)
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 10)
                        
                        switch appState.weatherState {
                        case .idle:
                            VStack {
                                Text("Waiting for location...")
                                    .foregroundColor(.gray)
                                    .padding(.top, 50)
                                
                                Button("Use Default Location") {
                                    appState.requestLocation()
                                }
                                .buttonStyle(.bordered)
                                .padding(.top, 10)
                            }
                                
                        case .loading:
                            VStack(spacing: 20) {
                                ProgressView()
                                    .scaleEffect(1.3)
                                    .tint(Color(red: 236/255, green: 104/255, blue: 90/255))
                                
                                Text(appState.currentLocationName)
                                    .font(.system(size: 18, weight: .medium))
                                    .foregroundColor(.black)
                                
                                Text("Caricamento previsioni...")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 120)
                                
                        case .success(let forecast):
                            // Banner allerte prominente (sopra al meteo)
                            if !appState.activeAlerts.isEmpty {
                                AlertBannerView(
                                    alerts: appState.activeAlerts,
                                    onTap: { isAlertsPresented = true }
                                )
                                .padding(.horizontal)
                            }

                            // Current Weather
                            CurrentWeatherView(current: forecast.current, today: forecast.daily?.first, astronomy: forecast.astronomy)
                            
                            // Hourly Forecast
                            if let hourly = forecast.hourly {
                                HourlyForecastView(hourly: hourly, astronomy: forecast.astronomy, current: forecast.current)
                                    .padding(.horizontal)
                            }
                            
                            // Daily Forecast
                            if let daily = forecast.daily {
                                DailyForecastView(daily: daily, hourly: forecast.hourly)
                                    .padding(.horizontal)
                            }
                            
                        case .error(let error):
                            VStack(spacing: 10) {
                                Image(systemName: "exclamationmark.triangle")
                                    .font(.largeTitle)
                                    .foregroundColor(.yellow)
                                Text(error.localizedDescription)
                                    .multilineTextAlignment(.center)
                                    .foregroundColor(.black)
                                Button("Riprova") {
                                    if let location = appState.currentLocation {
                                        appState.fetchWeather(for: location)
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                            }
                            .padding()
                            .background(.ultraThinMaterial)
                            .cornerRadius(12)
                            .padding(.top, 50)
                        }
                    }
                    .padding(.bottom, 50)
                }
                .refreshable {
                    HapticManager.medium()
                    if let location = appState.currentLocation {
                        appState.fetchWeather(for: location)
                    }
                }
                
                // Sidebar Overlay
                if isSidebarPresented {
                    Color.black.opacity(0.5)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation {
                                isSidebarPresented = false
                            }
                        }
                    
                    HStack(spacing: 0) {
                        SidebarView(isPresented: $isSidebarPresented)
                            .frame(width: UIScreen.main.bounds.width * 0.85)
                            .transition(.move(edge: .leading))
                        
                        Spacer()
                    }
                    .ignoresSafeArea()
                    .zIndex(2)
                }
            }
        }
        .sheet(isPresented: $isSearchPresented) {
            SearchView()
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $isAlertsPresented) {
            WeatherAlertsView(alerts: appState.activeAlerts)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .onReceive(appState.$showAlertsModal) { show in
            if show {
                isAlertsPresented = true
                appState.showAlertsModal = false
            }
        }
    }
}

#Preview {
    DashboardView()
        .environmentObject(AppState.shared)
}
