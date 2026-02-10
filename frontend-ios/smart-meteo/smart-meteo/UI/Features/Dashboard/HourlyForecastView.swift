import SwiftUI
import Charts

struct HourlyForecastView: View {
    let hourly: [HourlyForecast]
    
    var body: some View {
        GlassContainer(cornerRadius: 16) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Hourly Forecast")
                    .font(.caption)
                    .textCase(.uppercase)
                    .foregroundColor(.white.opacity(0.6))
                    .padding(.bottom, 5)
                
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 20) {
                        ForEach(hourly) { hour in
                            VStack(spacing: 8) {
                                Text(formatTime(hour.time))
                                    .font(.caption)
                                    .foregroundColor(.white)
                                
                                Image(systemName: iconName(for: hour.conditionCode))
                                    .symbolRenderingMode(.multicolor)
                                    .font(.title3)
                                
                                Text("\(Int(hour.temp))°")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                
                                if let prob = hour.precipitationProb, prob > 0 {
                                    Text("\(Int(prob * 100))%")
                                        .font(.caption2)
                                        .foregroundColor(.cyan)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 5)
                }
                
                // Optional: Chart below the scroll view could be redundant if we just show the numbers,
                // But let's add a simple chart for visual appeal if desired.
                // For now, let's stick to the horizontal scroll list as it's cleaner for small screens, 
                // or use a Chart if we want a line graph. Use list for MVP to match common apps.
            }
        }
    }
    
    private func formatTime(_ isoTime: String) -> String {
        // Simple formatter, in real app use DateFormatter with cache or new FormatStyle
        // Assuming ISO string, we might need a parser in the model or here.
        // For now, return substring or mock.
        // Ideally use: Date(timeIntervalSince1970: ...).formatted(date: .omitted, time: .shortened)
        return isoTime.suffix(8).prefix(5).description // Hacky, assume HH:mm within the string for now
    }
    
    private func iconName(for condition: String) -> String {
        // Reuse logic or centralized helper
        switch condition.lowercased() {
        case "clear": return "sun.max.fill"
        case "rain": return "cloud.rain.fill"
        default: return "cloud.sun.fill"
        }
    }
}
