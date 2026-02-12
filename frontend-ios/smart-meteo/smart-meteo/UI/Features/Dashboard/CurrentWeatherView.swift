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
            
            // Fixed UNKNOWN label
            Text(conditionLabel(for: current))
                .font(.title3)
                .foregroundColor(.white.opacity(0.9))
            
            HStack(spacing: 20) {
                // Wind -> Gusts
                FlipWeatherDetail(
                    icon: "wind",
                    mainValue: "\(Int(current.windSpeed ?? 0)) km/h",
                    mainLabel: "Wind",
                    altValue: "\(Int(current.windGust ?? 0)) km/h",
                    altLabel: current.windDirectionLabel != nil ? "Gust \(current.windDirectionLabel!)" : "Gust",
                    altIcon: "wind"
                )
                
                // Humidity -> Dew Point
                FlipWeatherDetail(
                    icon: "humidity",
                    mainValue: "\(Int(current.humidity ?? 0))%",
                    mainLabel: "Humidity",
                    altValue: "\(Int(current.dewPoint ?? 0))°",
                    altLabel: "Dew Point",
                    altIcon: "drop.triangle" // or similar
                )
                
                // Rain -> AQI
                FlipWeatherDetail(
                    icon: "drop.fill",
                    mainValue: "\(Int(current.precipitationProb * 100))%",
                    mainLabel: "Rain",
                    altValue: aqiValue(current.aqi),
                    altLabel: "AQI",
                    altIcon: "aqi.medium" // iOS 17 symbol or generic
                )
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
    
    private func conditionLabel(for current: ForecastCurrent) -> String {
        let text = current.conditionText
        if text.uppercased() == "UNKNOWN" {
            return current.condition.capitalized
        }
        return text
    }
    
    private func aqiValue(_ aqi: Double?) -> String {
        guard let aqi = aqi else { return "--" }
        return "\(Int(aqi))"
    }
}

struct FlipWeatherDetail: View {
    let icon: String
    let mainValue: String
    let mainLabel: String
    
    let altValue: String
    let altLabel: String
    let altIcon: String
    
    @State private var isFlipped = false
    
    var body: some View {
        Button(action: {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                isFlipped.toggle()
            }
        }) {
            VStack(spacing: 4) {
                 if isFlipped {
                     Image(systemName: altIcon)
                         .font(.system(size: 20))
                         .foregroundColor(.white)
                         .transition(.scale.combined(with: .opacity))
                     Text(altValue)
                         .font(.system(size: 16, weight: .bold))
                         .foregroundColor(.white)
                         .transition(.scale.combined(with: .opacity))
                     Text(altLabel)
                         .font(.caption)
                         .foregroundColor(.white.opacity(0.7))
                         .transition(.scale.combined(with: .opacity))
                 } else {
                     Image(systemName: icon)
                         .font(.system(size: 20))
                         .foregroundColor(.white)
                         .transition(.scale.combined(with: .opacity))
                     Text(mainValue)
                         .font(.system(size: 16, weight: .bold))
                         .foregroundColor(.white)
                         .transition(.scale.combined(with: .opacity))
                     Text(mainLabel)
                         .font(.caption)
                         .foregroundColor(.white.opacity(0.7))
                         .transition(.scale.combined(with: .opacity))
                 }
            }
            .frame(minWidth: 80)
            .contentShape(Rectangle()) // Make tappable area consistent
        }
        .buttonStyle(PlainButtonStyle())
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
            conditionText: "Sunny",
            dewPoint: 18,
            windGust: 20,
            windDirectionLabel: "NW",
            aqi: 2
        ))
    }
}
