import SwiftUI

struct DailyForecastView: View {
    let daily: [DailyForecast]
    let hourly: [HourlyForecast]?
    
    @State private var expandedDate: String?
    
    // Date formatter for display (e.g., "Mon 12")
    private let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE d"
        formatter.locale = Locale(identifier: "it_IT") // Localized as requested implicitly by user language
        return formatter
    }()
    
    // Date formatter for parsing API date string (YYYY-MM-DD)
    private let apiDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
    
    // Date formatter for ISO time string
    private let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    
    var body: some View {
        GlassContainer(cornerRadius: 16) {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Image(systemName: "calendar")
                        .foregroundColor(.white.opacity(0.7))
                    Text("PROSSIMI GIORNI")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.white.opacity(0.7))
                        .textCase(.uppercase)
                }
                .padding(.bottom, 4)
                
                // Filter out the first day (Today) to match "Next 7 Days" logic
                let nextDays = daily.dropFirst()
                
                VStack(spacing: 12) {
                    ForEach(Array(nextDays), id: \.date) { day in
                        DailyRow(
                            day: day,
                            isExpanded: expandedDate == day.date,
                            hourly: hourlyForDay(day.date),
                            onTap: {
                                withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                                    if expandedDate == day.date {
                                        expandedDate = nil
                                    } else {
                                        expandedDate = day.date
                                    }
                                }
                            }
                        )
                    }
                }
            }
            .padding(4)
        }
    }
    
    private func hourlyForDay(_ dateString: String) -> [HourlyForecast] {
        guard let hourly = hourly else { return [] }
        // Simple string matching for YYYY-MM-DD as hourly time usually starts with date
        return hourly.filter { $0.time.hasPrefix(dateString) }
    }
}

struct DailyRow: View {
    let day: DailyForecast
    let isExpanded: Bool
    let hourly: [HourlyForecast]
    let onTap: () -> Void
    
    private var displayDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: day.date) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "EEE d"
            displayFormatter.locale = Locale(identifier: "it_IT")
            return displayFormatter.string(from: date).capitalized
        }
        return day.date
    }
    
    var body: some View {
        VStack(spacing: 0) {
            Button(action: onTap) {
                HStack(spacing: 12) {
                    // Date
                    Text(displayDate)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 60, alignment: .leading)
                    
                    // Icon
                    Image(systemName: iconName(for: day.conditionCode))
                        .symbolRenderingMode(.multicolor)
                        .font(.title3)
                        .frame(width: 30)
                    
                    // Rain probability
                    if let precip = day.precipitationProb, precip > 0 {
                        HStack(spacing: 2) {
                            Image(systemName: "drop.fill")
                                .font(.caption2)
                            Text("\(Int(precip))%")
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(.blue.opacity(0.8))
                        .frame(width: 50)
                    } else {
                        Spacer().frame(width: 50)
                    }
                    
                    Spacer()
                    
                    // Temperature Bar
                    if let min = day.tempMin, let max = day.tempMax {
                        HStack(spacing: 8) {
                            Text("\(Int(min))°")
                                .font(.system(size: 14))
                                .foregroundColor(.white.opacity(0.6))
                                .frame(width: 25, alignment: .trailing)
                            
                            TemperatureBar(min: min, max: max, rangeMin: -5, rangeMax: 40)
                                .frame(height: 4)
                                .frame(maxWidth: 80)
                            
                            Text("\(Int(max))°")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 25, alignment: .leading)
                        }
                    }
                    
                    // Chevron
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.4))
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 12)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.white.opacity(isExpanded ? 0.15 : 0.05))
                )
            }
            .buttonStyle(PlainButtonStyle())
            
            // Expanded Content
            if isExpanded {
                VStack(alignment: .leading, spacing: 10) {
                    Divider().background(Color.white.opacity(0.1))
                    
                    if !hourly.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 16) {
                                ForEach(hourly) { hour in
                                    HourlyItemView(hour: hour)
                                }
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                        }
                    } else {
                        Text("Dati orari non disponibili")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(8)
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.white.opacity(0.1))
                        .padding(.top, -10) // Overlap slightly to look connected
                )
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }
    
    private func iconName(for condition: String) -> String {
        switch condition.lowercased() {
        case "clear": return "sun.max.fill"
        case "cloudy": return "cloud.fill"
        case "rain": return "cloud.rain.fill"
        case "snow": return "cloud.snow.fill"
        case "storm": return "cloud.bolt.rain.fill"
        case "fog": return "cloud.fog.fill"
        case "partly-cloudy", "partly cloudy": return "cloud.sun.fill"
        default: return "cloud.sun.fill"
        }
    }
}

struct HourlyItemView: View {
    let hour: HourlyForecast
    
    private var timeString: String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: hour.time) {
            let formatter = DateFormatter()
            formatter.dateFormat = "HH:mm"
            return formatter.string(from: date)
        }
        return "--:--"
    }
    
    var body: some View {
        VStack(spacing: 6) {
            Text(timeString)
                .font(.caption2)
                .foregroundColor(.white.opacity(0.7))
            
            Image(systemName: iconName(for: hour.conditionCode))
                .renderingMode(.original)
                .font(.body)
            
            Text("\(Int(hour.temp))°")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.white)
        }
    }
    
    private func iconName(for condition: String) -> String {
        switch condition.lowercased() {
        case "clear": return "sun.max.fill"
        case "cloudy": return "cloud.fill"
        case "rain": return "cloud.rain.fill"
        case "snow": return "cloud.snow.fill"
        case "storm": return "cloud.bolt.rain.fill"
        case "fog": return "cloud.fog.fill"
        case "partly-cloudy", "partly cloudy": return "cloud.sun.fill"
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
            
            // Calculate positions
            let minPos = CGFloat((min - rangeMin) / safeRange)
            let maxPos = CGFloat((max - rangeMin) / safeRange)
            
            let barStart = totalWidth * minPos
            let barWidth = totalWidth * (maxPos - minPos)
            
            ZStack(alignment: .leading) {
                // Background track
                Capsule()
                    .fill(Color.white.opacity(0.1))
                    .frame(height: 4)
                
                // Active range
                Capsule()
                    .fill(LinearGradient(
                        colors: [.cyan, .yellow, .orange],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: CGFloat.maximum(4, barWidth), height: 4)
                    .offset(x: barStart)
            }
        }
    }
}
