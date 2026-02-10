import SwiftUI

struct CurrentWeatherView: View {
    let current: ForecastCurrent
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: iconName(for: current.condition))
                .renderingMode(.original)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 80, height: 80)
                .symbolEffect(.bounce, value: current.condition) // iOS 17 animation
            
            Text("\(Int(current.temperature ?? 0))°")
                .font(.system(size: 80, weight: .thin))
                .foregroundColor(.white)
            
            Text(current.conditionText)
                .font(.title3)
                .foregroundColor(.white.opacity(0.9))
            
            HStack(spacing: 20) {
                WeatherDetailItem(icon: "wind", value: "\(Int(current.windSpeed ?? 0)) km/h", label: "Wind")
                WeatherDetailItem(icon: "humidity", value: "\(Int(current.humidity ?? 0))%", label: "Humidity")
                WeatherDetailItem(icon: "drop.fill", value: "\(Int(current.precipitationProb * 100))%", label: "Rain")
            }
            .padding(.top, 10)
        }
        .padding()
        // No glass container here, usually this is on top of the background directly
    }
    
    private func iconName(for condition: String) -> String {
        switch condition.lowercased() {
        case "clear": return "sun.max.fill"
        case "cloudy": return "cloud.fill"
        case "rain": return "cloud.rain.fill"
        case "snow": return "cloud.snow.fill"
        case "storm": return "cloud.bolt.rain.fill"
        case "fog": return "cloud.fog.fill"
        default: return "cloud.sun.fill"
        }
    }
}

struct WeatherDetailItem: View {
    let icon: String
    let value: String
    let label: String
    
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(.white)
            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.white)
            Text(label)
                .font(.caption)
                .foregroundColor(.white.opacity(0.7))
        }
    }
}

#Preview {
    ZStack {
        Color.blue
        CurrentWeatherView(current: ForecastCurrent(
            temperature: 24.5,
            feelsLike: 26,
            humidity: 60,
            windSpeed: 12,
            precipitationProb: 0.1,
            condition: "clear",
            conditionText: "Sunny"
        ))
    }
}
