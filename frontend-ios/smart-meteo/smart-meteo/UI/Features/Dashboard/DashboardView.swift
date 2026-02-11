import SwiftUI

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel(appState: AppState.shared)
    @State private var isSidebarPresented = false
    @State private var isSearchPresented = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Dynamic Background
                DynamicBackground(condition: viewModel.currentCondition)
                    .ignoresSafeArea()
                
                // Content
                ScrollView {
                    VStack(spacing: 20) {
                        // Header
                        HStack {
                            // Avatar / Sidebar Trigger
                            Button(action: {
                                withAnimation {
                                    isSidebarPresented = true
                                }
                            }) {
                                if viewModel.isAuthenticated {
                                    Image(systemName: "person.circle.fill")
                                        .resizable()
                                        .frame(width: 40, height: 40)
                                        .foregroundColor(.white)
                                } else {
                                    Image(systemName: "person.crop.circle")
                                        .resizable()
                                        .frame(width: 40, height: 40)
                                        .foregroundColor(.white.opacity(0.8))
                                }
                            }
                            
                            Spacer()
                            
                            VStack(alignment: .center) {
                                Text(viewModel.currentLocationName)
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundColor(.white)
                                Text(Date().formatted(date: .abbreviated, time: .omitted))
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.8))
                            }
                            
                            Spacer()
                            
                            // Search Trigger
                            Button(action: { isSearchPresented = true }) {
                                Image(systemName: "magnifyingglass")
                                    .font(.title2)
                                    .foregroundColor(.white)
                                    .padding(8)
                                    .background(Color.white.opacity(0.1))
                                    .clipShape(Circle())
                            }
                        }
                        .padding(.horizontal)
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
                            LoadingView()
                                .frame(height: 200)
                                
                        case .success(let forecast):
                            // Current Weather
                            CurrentWeatherView(current: forecast.current)
                            
                            // Hourly Forecast
                            if let hourly = forecast.hourly {
                                HourlyForecastView(hourly: hourly, astronomy: forecast.astronomy)
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
