import SwiftUI

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel(appState: AppState.shared)
    
    var body: some View {
        ZStack {
            // Dynamic Background
            DynamicBackground(condition: viewModel.currentCondition)
                .ignoresSafeArea()
            
            // Content
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    HStack {
                        VStack(alignment: .leading) {
                            Text(viewModel.currentLocationName)
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            Text(Date().formatted(date: .abbreviated, time: .omitted))
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.8))
                        }
                        Spacer()
                        Button(action: viewModel.refresh) {
                            Image(systemName: "arrow.clockwise")
                                .foregroundColor(.white)
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
                            
                            // Fallback for Simulator/Perms issue
                            Button("Use Default Location") {
                                AppState.shared.requestLocation() // Trigger fallback logic
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
        }
    }
}

#Preview {
    DashboardView()
}
