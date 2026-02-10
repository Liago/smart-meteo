import SwiftUI

struct DailyForecastView: View {
    let daily: [DailyForecast]
    
    var body: some View {
        GlassContainer(cornerRadius: 16) {
            VStack(alignment: .leading, spacing: 15) {
                Text("Next 7 Days")
                    .font(.caption)
                    .textCase(.uppercase)
                    .foregroundColor(.white.opacity(0.6))
                
                ForEach(daily) { day in
                    HStack {
                        Text(formatDay(day.date))
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(width: 50, alignment: .leading)
                        
                        Image(systemName: iconName(for: day.conditionCode))
                            .symbolRenderingMode(.multicolor)
                            .font(.title3)
                            .frame(width: 30)
                        
                        Spacer()
                        
                        if let min = day.tempMin, let max = day.tempMax {
                            HStack(spacing: 8) {
                                Text("\(Int(min))°")
                                    .foregroundColor(.white.opacity(0.6))
                                TemperatureBar(min: min, max: max, rangeMin: -10, rangeMax: 40)
                                    .frame(width: 100, height: 4)
                                Text("\(Int(max))°")
                                    .foregroundColor(.white)
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Formatting date string YYYY-MM-DD to Day Name (Mon, Tue)
    // Placeholder logic for now
    private func formatDay(_ dateString: String) -> String {
        return "Mon" // Need proper Date parsing
    }
    
    private func iconName(for condition: String) -> String {
        // Shared logic ideally
        switch condition.lowercased() {
        case "clear": return "sun.max.fill"
        default: return "cloud.sun.fill"
        }
    }
}

struct TemperatureBar: View {
    let min: Double
    let max: Double
    let rangeMin: Double
    let rangeMax: Double
    
    var body: some View {
        GeometryReader { geometry in
                let range = rangeMax - rangeMin
                let safeRange = range == 0 ? 1 : range
                let totalWidth = geometry.size.width
                // Explicitly use self.max and self.min to avoid confusion with Swift.max/min
                let currentMax = self.max
                let currentMin = self.min
                
                let width = totalWidth * CGFloat((currentMax - currentMin) / safeRange)
                let offset = totalWidth * CGFloat((currentMin - rangeMin) / safeRange)
                
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.2))
                    
                    Capsule()
                        .fill(LinearGradient(colors: [.blue, .orange], startPoint: .leading, endPoint: .trailing))
                        .frame(width: CGFloat.maximum(0, width))
                        .offset(x: offset)
                }
        }
    }
}
