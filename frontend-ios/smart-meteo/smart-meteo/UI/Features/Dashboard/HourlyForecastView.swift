import SwiftUI

struct HourlyForecastView: View {
    let hourly: [HourlyForecast]
    let astronomy: AstronomyData?
    
    // MARK: - Processed Data
    struct ChartData {
        let items: [TimelineItem]
        let minTemp: Double
        let maxTemp: Double
        let width: CGFloat
        let height: CGFloat
    }
    
    enum TimelineItemType {
        case weather(HourlyForecast)
        case sun(label: String, icon: String)
        
        var isSun: Bool {
            switch self {
            case .sun: return true
            case .weather: return false
            }
        }
    }
    
    struct TimelineItem: Identifiable {
        let id = UUID()
        let time: Date
        let type: TimelineItemType
        let temp: Double
    }
    
    @State private var chartData: ChartData?
    
    var body: some View {
        GlassContainer(cornerRadius: 16) {
            VStack(alignment: .leading, spacing: 15) {
                Text("PROSSIME 12 ORE")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.white.opacity(0.5))
                    .textCase(.uppercase)
                    .tracking(1)
                
                if let data = chartData {
                    ScrollView(.horizontal, showsIndicators: false) {
                        ZStack(alignment: .topLeading) {
                            // Chart Background (Line & Fill)
                            ChartPath(data: data)
                                .frame(width: data.width, height: data.height)
                            
                            // Points & Labels
                            ForEach(Array(data.items.enumerated()), id: \.element.id) { index, item in
                                ChartPointView(item: item, index: index, total: data.items.count, data: data)
                            }
                        }
                        .frame(width: data.width, height: data.height + 60) // Extra space for labels
                        .padding(.horizontal, 20)
                    }
                } else {
                    ProgressView()
                        .frame(height: 200)
                }
            }
            .padding(16)
        }
        .onAppear {
            processData()
        }
        .onChange(of: hourly.count) { _ in processData() }
    }
    
    private func processData() {
        guard !hourly.isEmpty else {
            // Handle empty data case if needed
            return
        }

        // 1. Robust Date Parsing
        // Try multiple standard ISO 8601 formats
        let formatters: [ISO8601DateFormatter] = [
            {
                let f = ISO8601DateFormatter()
                f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                return f
            }(),
            {
                let f = ISO8601DateFormatter()
                f.formatOptions = [.withInternetDateTime]
                return f
            }(),
             {
                let f = ISO8601DateFormatter()
                // Plain layout if needed or customized
                return f
            }()
        ]
        
        let simpleFormatter = DateFormatter()
        simpleFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm" // Fallback for simple T-separated
        
        func parseDate(_ str: String) -> Date? {
            for f in formatters {
                if let d = f.date(from: str) { return d }
            }
            return simpleFormatter.date(from: str)
        }
        
        let now = Date()
        // If the data is old (mock data) or from different timezone, we might filter everything out.
        // Let's be a bit more lenient or relative.
        // If all data is in the past, maybe show the last 12 hours?
        // Or just show whatever is in the array if it matches loosely.
        
        let end = now.addingTimeInterval(13 * 3600) // 12h + buffer
        let start = now.addingTimeInterval(-2 * 3600) // 2h ago buffer
        
        var items: [TimelineItem] = []
        
        // Weather Items
        let weatherItems = hourly.compactMap { h -> TimelineItem? in
            guard let date = parseDate(h.time) else { return nil }
            return TimelineItem(time: date, type: .weather(h), temp: h.temp)
        }
        
        // Filter: If we have valid weather items, try to show relevant ones.
        // If zero items pass the "now" filter, it might be because of timezone issues or stale data.
        // Let's filter but if empty, maybe show the first 12 items available?
        
        let filteredWeather = weatherItems.filter { $0.time >= start && $0.time <= end }
        
        // Fallback: if "now" logic returns empty but we have data, show the first 12 items
        let displayWeather = filteredWeather.isEmpty ? Array(weatherItems.prefix(12)) : filteredWeather
        items.append(contentsOf: displayWeather)
        
        // Sun Items
        if let astro = astronomy, !items.isEmpty {
            let timeFormatter = DateFormatter()
            timeFormatter.amSymbol = "AM"
            timeFormatter.pmSymbol = "PM"
            timeFormatter.dateFormat = "hh:mm a"
            timeFormatter.locale = Locale(identifier: "en_US_POSIX")
            
            // Also try 24h format just in case
            let timeFormatter24 = DateFormatter()
            timeFormatter24.dateFormat = "HH:mm"
            
            func addSunEvent(_ timeStr: String, label: String, icon: String) {
                var date: Date?
                
                // Try to parse time only and attach to the *relevant day*
                // We should look at the weather items dates to know which day we are displaying.
                // Usually the first item's day.
                let targetDay = items.first?.time ?? now
                
                if let t = timeFormatter.date(from: timeStr) ?? timeFormatter24.date(from: timeStr) {
                    let calendar = Calendar.current
                    let dayStart = calendar.startOfDay(for: targetDay)
                    let components = calendar.dateComponents([.hour, .minute], from: t)
                    if let d = calendar.date(byAdding: components, to: dayStart) {
                        date = d
                    }
                } else if let d = parseDate(timeStr) {
                    date = d
                }
                
                guard let eventDate = date else { return }
                
                // Only add if within range of our display items
                if let first = items.first?.time, let last = items.last?.time {
                     if eventDate >= first.addingTimeInterval(-3600) && eventDate <= last.addingTimeInterval(3600) {
                         // Interpolate Temp
                         let sortedWeather = displayWeather.sorted { $0.time < $1.time }
                         
                         var temp: Double = 0
                         if let before = sortedWeather.last(where: { $0.time <= eventDate }),
                            let after = sortedWeather.first(where: { $0.time > eventDate }) {
                             let ratio = eventDate.timeIntervalSince(before.time) / after.time.timeIntervalSince(before.time)
                             temp = before.temp + (after.temp - before.temp) * ratio
                         } else if let nearest = sortedWeather.min(by: { abs($0.time.timeIntervalSince(eventDate)) < abs($1.time.timeIntervalSince(eventDate)) }) {
                             temp = nearest.temp
                         }
                         
                         items.append(TimelineItem(time: eventDate, type: .sun(label: label, icon: icon), temp: temp))
                     }
                }
            }
            
            addSunEvent(astro.sunrise, label: "Alba", icon: "sunrise.fill")
            addSunEvent(astro.sunset, label: "Tramonto", icon: "sunset.fill")
        }
        
        // Final Sort
        items.sort { $0.time < $1.time }
        
        // If still empty, return (chartData remains nil -> spinner is technically correct but maybe we want valid empty state)
        guard !items.isEmpty else {
             // Force create data implies we failed to parse or no data.
             return
        }
        
        let temps = items.map { $0.temp }
        let minTemp = (temps.min() ?? 0) - 2
        let maxTemp = (temps.max() ?? 0) + 2
        
        let width = CGFloat(items.count * 80)
        let height: CGFloat = 250
        
        self.chartData = ChartData(items: items, minTemp: minTemp, maxTemp: maxTemp, width: width, height: height)
    }
}

    // MARK: - Subviews
    private struct Layout {
        static let topPadding: CGFloat = 60
        static let bottomPadding: CGFloat = 50
        static let totalPadding: CGFloat = topPadding + bottomPadding
    }

struct ChartPath: View {
    let data: HourlyForecastView.ChartData
    
    var body: some View {
        Canvas { context, size in
            let points = data.items.enumerated().map { index, item -> CGPoint in
                let x = CGFloat(index) * 80 + 40 // Center in 80px slot
                
                let yRange = data.maxTemp - data.minTemp
                let range = yRange == 0 ? 1 : yRange
                
                let availableHeight = size.height - Layout.totalPadding
                let yStep = availableHeight / range
                
                let y = size.height - Layout.bottomPadding - ((item.temp - data.minTemp) * yStep)
                return CGPoint(x: x, y: y)
            }
            
            guard points.count > 1 else { return }
            
            var path = Path()
            path.move(to: points[0])
            
            // Cubic Bezier Smoothing
            for i in 0..<points.count-1 {
                let p1 = points[i]
                let p2 = points[i+1]
                let mid = CGPoint(x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2)
                let cp1 = CGPoint(x: (p1.x + mid.x)/2, y: p1.y)
                let cp2 = CGPoint(x: (mid.x + p2.x)/2, y: p2.y)
                
                path.addQuadCurve(to: mid, control: cp1)
                path.addQuadCurve(to: p2, control: cp2)
            }
            
            context.stroke(path, with: .color(.white.opacity(0.4)), lineWidth: 3)
        }
    }
}

struct ChartPointView: View {
    let item: HourlyForecastView.TimelineItem
    let index: Int
    let total: Int
    let data: HourlyForecastView.ChartData
    
    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let x = CGFloat(index) * 80 + 40
            
            let yRange = data.maxTemp - data.minTemp
            let range = yRange == 0 ? 1 : yRange
            
            let availableHeight = data.height - Layout.totalPadding
            let yStep = availableHeight / range
            
            let y = data.height - Layout.bottomPadding - ((item.temp - data.minTemp) * yStep)

            ZStack {
                // Dot
                Circle()
                    .fill(item.type.isSun ? Color.yellow : Color.white)
                    .frame(width: 8, height: 8)
                    .position(x: x, y: y)
                
                // Info Group (Icon & Temp) - Above
                VStack(spacing: 4) {
                    switch item.type {
                    case .weather(let h):
                        Image(systemName: iconName(for: h.conditionCode))
                            .symbolRenderingMode(.multicolor)
                            .font(.title) // Increased from title2
                            .shadow(radius: 2)
                        Text("\(Int(round(item.temp)))°")
                            .font(.custom("Inter", size: 18)) // Increased from 16
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .shadow(color: .black.opacity(0.3), radius: 1, x: 0, y: 1)
                    case .sun(let label, let icon):
                        Text(label)
                            .font(.system(size: 10, weight: .bold))
                            .textCase(.uppercase)
                            .foregroundColor(.yellow)
                        Image(systemName: icon)
                            .foregroundColor(.yellow)
                    }
                }
                .frame(width: 80) // Constrain width to slot
                .position(x: x, y: y - 40) // Shift up from dot
                
                // Time & Precip - Below
                VStack(spacing: 2) {
                    Text(formatTime(item.time))
                        .font(.caption) // Increased from caption2
                        .foregroundColor(item.type.isSun ? .yellow.opacity(0.8) : .white.opacity(0.5))
                    
                    if case .weather(let h) = item.type, let prob = h.precipitationProb, prob > 0 {
                        Text("\(Int(prob))%") // Prob is 0-100 based on web 13 means 13%
                            .font(.system(size: 11, weight: .medium)) // Increased from 10
                            .foregroundColor(.cyan)
                    }
                }
                .frame(width: 80)
                .position(x: x, y: y + 30) // Shift down from dot
            }
        }
    }
    
    private func formatTime(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }
    
    private func iconName(for code: String) -> String {
        guard let c = Int(code) else { return "questionmark" }
        switch c {
        case 0: return "sun.max.fill"
        case 1, 2: return "cloud.sun.fill"
        case 3: return "cloud.fill"
        case 45, 48: return "cloud.fog.fill"
        case 51, 53, 55, 56, 57: return "cloud.drizzle.fill"
        case 61, 63, 65, 66, 67, 80, 81: return "cloud.rain.fill"
        case 71, 73, 75, 77, 85, 86: return "snowflake"
        case 82, 95, 96, 99: return "cloud.bolt.rain.fill"
        default: return "questionmark"
        }
    }
}

