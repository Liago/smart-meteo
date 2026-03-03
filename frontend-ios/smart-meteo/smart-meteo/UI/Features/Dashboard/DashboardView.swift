import SwiftUI

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel(appState: AppState.shared)
    @State private var isSidebarPresented = false
    @State private var isSearchPresented = false
    
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
                                Image(systemName: "location.fill")
                                    .font(.subheadline)
                                    .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255))
                                Text(viewModel.currentLocationName)
                                    .font(.headline)
                                    .fontWeight(.bold)
                                    .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255))
                            }
                            
                            Spacer()
                            
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
                        
                        switch viewModel.state {
                        case .idle:
                            VStack {
                                Text("Waiting for location...")
                                    .foregroundColor(.white)
                                    .padding(.top, 50)
                                
                                Button("Use Default Location") {
                                    AppState.shared.requestLocation()
                                }
                                .buttonStyle(.bordered)
                                .tint(.white)
                                .padding(.top, 10)
                            }
                                
                        case .loading:
                            VStack(spacing: 20) {
                                ProgressView()
                                    .scaleEffect(1.3)
                                    .tint(Color(red: 236/255, green: 104/255, blue: 90/255))
                                
                                Text(viewModel.currentLocationName)
                                    .font(.system(size: 18, weight: .medium))
                                    .foregroundColor(.black)
                                
                                Text("Caricamento previsioni...")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 120)
                                
                        case .success(let forecast):
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
                                    .foregroundColor(.white)
                                Button("Retry") {
                                    viewModel.refresh()
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
                    viewModel.refresh()
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
    }
}

#Preview {
    DashboardView()
}
