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
        VStack(alignment: .leading, spacing: 16) {
            Text("Prossimi Giorni")
                .font(.system(size: 26, weight: .bold))
                .foregroundColor(.black)
                .padding(.bottom, 4)
            
            // Exclude today since it's already shown in the detail above
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
            if Calendar.current.isDateInToday(date) {
                return "Oggi"
            }
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "EEE"
            displayFormatter.locale = Locale(identifier: "it_IT")
            return displayFormatter.string(from: date).capitalized
        }
        return day.date
    }
    
    var body: some View {
        VStack(spacing: 0) {
            Button(action: onTap) {
                HStack(spacing: 12) {
                    // Date and Rain Probability
                    VStack(alignment: .center, spacing: 2) {
                        Text(displayDate)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.black)
                        
                        if let precip = day.precipitationProb, precip > 0 {
                            HStack(spacing: 2) {
                                Image(systemName: "drop.fill")
                                    .font(.system(size: 10))
                                Text("\(Int(precip))%")
                                    .font(.system(size: 12, weight: .medium))
                            }
                            .foregroundColor(.blue.opacity(0.8))
                        } else {
                            HStack(spacing: 2) {
                                Image(systemName: "drop.fill")
                                    .font(.system(size: 10))
                                Text("0%")
                                    .font(.system(size: 12, weight: .medium))
                            }
                            .foregroundColor(.clear)
                        }
                    }
                    .frame(width: 55, alignment: .center)
                    
                    // Icon
                    Image(systemName: iconName(for: day.conditionCode))
                        .renderingMode(.template)
                        .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2)) // Dark gray
                        .font(.title3)
                        .frame(width: 30)
                    
                    Spacer()
                    
                    // Temperature Bar
                    if let min = day.tempMin, let max = day.tempMax {
                        HStack(spacing: 8) {
                            Text("\(Int(min))°")
                                .font(.system(size: 14))
                                .foregroundColor(.gray)
                                .frame(width: 25, alignment: .trailing)
                            
                            TemperatureBar(min: min, max: max, rangeMin: -5, rangeMax: 40)
                                .frame(height: 6)
                                .frame(maxWidth: .infinity)
                            
                            Text("\(Int(max))°")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.black)
                                .frame(width: 25, alignment: .leading)
                        }
                    }
                    
                    // Chevron
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.gray.opacity(0.6))
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 12)
            }
            .buttonStyle(PlainButtonStyle())
            
            // Expanded Content
            if isExpanded {
                if !hourly.isEmpty {
                    WeatherChartView(hourly: hourly)
                        .frame(height: 180) // Constrain height for the scrollview inside
                        .padding(.horizontal, 4)
                        .padding(.bottom, 10)
                } else {
                    Text("Dati orari non disponibili")
                        .font(.caption)
                        .foregroundColor(.gray)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(8)
                }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(isExpanded ? Color.white : Color.clear)
                .shadow(color: Color.black.opacity(isExpanded ? 0.06 : 0), radius: 10, x: 0, y: 4)
        )
    }

    
    private func iconName(for code: String) -> String {
        // Try parsing as Int (WMO code)
        if let c = Int(code) {
            switch c {
            case 0: return "sun.max.fill"
            case 1, 2: return "cloud.sun.fill"
            case 3: return "cloud.fill"
            case 45, 48: return "cloud.fog.fill"
            case 51, 53, 55, 56, 57: return "cloud.drizzle.fill"
            case 61, 63, 65, 66, 67, 80, 81: return "cloud.rain.fill"
            case 71, 73, 75, 77, 85, 86: return "snowflake"
            case 82, 95, 96, 99: return "cloud.bolt.rain.fill"
            default: return "cloud.sun.fill" // Fallback
            }
        }
        
        // Fallback for string keys if legacy
        switch code.lowercased() {
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
                    .fill(Color.gray.opacity(0.2)) // Slightly darker gray for light mode contrast
                    .frame(height: 6)
                
                // Active range
                Capsule()
                    .fill(LinearGradient(
                        colors: [.cyan, .yellow, .orange],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: CGFloat.maximum(6, barWidth), height: 6)
                    .offset(x: barStart)
            }
        }
    }
}
