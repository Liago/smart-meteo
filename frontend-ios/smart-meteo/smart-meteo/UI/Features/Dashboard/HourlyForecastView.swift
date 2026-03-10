import SwiftUI

private func precipitationColor(for prob: Double) -> Color {
    if prob >= 60 {
        return Color(red: 236/255, green: 104/255, blue: 90/255)
    } else if prob >= 30 {
        return Color.blue
    } else {
        return Color.blue.opacity(0.7)
    }
}

struct HourlyForecastView: View {
    let hourly: [HourlyForecast]
    let astronomy: AstronomyData?
    let current: ForecastCurrent?
    
    // MARK: - Processed Data
    struct DayPeriod: Identifiable {
        let id = UUID()
        let label: String
        let xStart: CGFloat
        let xEnd: CGFloat
        let maxPrecipProb: Double
    }

    struct ChartData {
        let items: [TimelineItem]
        let minTemp: Double
        let maxTemp: Double
        let width: CGFloat
        let height: CGFloat
        let periods: [DayPeriod]
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
    @State private var expandedPeriod: String?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Prossime 24 Ore")
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundColor(.black)
                .padding(.horizontal, 8)
            
            // Generate dynamic description
            let dynamicDesc = generateDailyDescription()
            
            Text(dynamicDesc)
                .font(.subheadline)
                .foregroundColor(.gray)
                .lineSpacing(4)
                .padding(.horizontal, 8)
            
            if let data = chartData {
                ScrollView(.horizontal, showsIndicators: false) {
                    ZStack(alignment: .topLeading) {
                        // Vertical dividers (background)
                        ForEach(data.periods) { period in
                            Rectangle()
                                .fill(Color.black.opacity(0.08))
                                .frame(width: 1, height: data.height)
                                .position(x: period.xStart + 8, y: data.height / 2)
                        }
                        .allowsHitTesting(false)

                        // Chart Background (Line & Fill)
                        ChartPath(data: data)
                            .frame(width: data.width, height: data.height)
                            .allowsHitTesting(false)

                        // Points & Labels
                        ForEach(Array(data.items.enumerated()), id: \.element.id) { index, item in
                            let showPrecip = itemInExpandedPeriod(index: index, item: item, data: data)
                            ChartPointView(item: item, index: index, total: data.items.count, data: data, showHourlyPrecip: showPrecip)
                        }
                        .allowsHitTesting(false)

                        // Section Headers (on top for tap handling)
                        ForEach(data.periods) { period in
                            let isExpanded = expandedPeriod == period.label

                            VStack(spacing: 3) {
                                Text(period.label)
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(isExpanded ? Color.blue : .black)
                                if period.maxPrecipProb > 0 {
                                    HStack(spacing: 2) {
                                        Image(systemName: "drop.fill")
                                            .font(.system(size: 9, weight: .bold))
                                        Text("\(Int(period.maxPrecipProb))%")
                                            .font(.system(size: 11, weight: .bold))
                                    }
                                    .foregroundColor(precipitationColor(for: period.maxPrecipProb))
                                }
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    expandedPeriod = isExpanded ? nil : period.label
                                }
                            }
                            .position(
                                x: (period.xStart + period.xEnd) / 2 + 8,
                                y: Layout.sectionHeaderHeight / 2 + 4
                            )
                        }
                    }
                    .frame(width: data.width, height: data.height + 20)
                    .padding(.horizontal, 8)
                }
            } else {
                ProgressView()
                    .frame(height: 180)
            }
                
        }
        .padding(.vertical)
        .onAppear {
            processData()
        }
        .onChange(of: hourly.count) { _ in processData() }
    }
    
    private func itemInExpandedPeriod(index: Int, item: TimelineItem, data: ChartData) -> Bool {
        guard let expanded = expandedPeriod else { return false }
        guard let period = data.periods.first(where: { $0.label == expanded }) else { return false }
        let x = CGFloat(index) * 80 + 40
        return x >= period.xStart && x <= period.xEnd
    }

    private func extractTime(from isoDateStr: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var d = formatter.date(from: isoDateStr)
        if d == nil {
            formatter.formatOptions = [.withInternetDateTime]
            d = formatter.date(from: isoDateStr)
        }
        
        guard let date = d else {
            // Fallback: try to just extract HH:mm if it's already a time string or simple date
            if isoDateStr.contains("T") {
                let parts = isoDateStr.split(separator: "T")
                if parts.count > 1 {
                    let timeStr = String(parts[1])
                    return String(timeStr.prefix(5)) // take HH:mm
                }
            }
            return isoDateStr.count >= 5 ? String(isoDateStr.prefix(5)) : isoDateStr
        }
        
        let f = DateFormatter()
        f.dateFormat = "HH:mm" // 24h format
        return f.string(from: date)
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
        let cal = Calendar.current
        // Start from the beginning of the current hour (align with Web)
        // e.g. if now is 16:45, start at 16:00
        let currentHourStart = cal.dateInterval(of: .hour, for: now)?.start ?? now
        // Small buffer (10 mins) just in case, but effective start is current hour
        let start = currentHourStart.addingTimeInterval(-600) 
        let end = start.addingTimeInterval(13 * 3600) // 12h from start
        
        var items: [TimelineItem] = []
        
        // Weather Items
        let weatherItems = hourly.compactMap { h -> TimelineItem? in
            guard let date = parseDate(h.time) else { return nil }
            // Debug: log precipitazione per verificare dati dall'API
            if let prob = h.precipitationProb, prob > 0 {
                print("[HourlyForecast] \(h.time) — precipitationProb: \(prob)%")
            }
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
        let height: CGFloat = 280

        // Calcola le sezioni della giornata (Notte, Mattina, Pomeriggio, Sera)
        let cal2 = Calendar.current
        struct PeriodBucket {
            let label: String
            let hourRange: Range<Int>
            var indices: [Int] = []
            var maxPrecip: Double = 0
        }
        var buckets = [
            PeriodBucket(label: "Notte", hourRange: 0..<6),
            PeriodBucket(label: "Mattina", hourRange: 6..<12),
            PeriodBucket(label: "Pomeriggio", hourRange: 12..<18),
            PeriodBucket(label: "Sera", hourRange: 18..<24)
        ]

        for (idx, item) in items.enumerated() {
            let hour = cal2.component(.hour, from: item.time)
            for b in 0..<buckets.count {
                if buckets[b].hourRange.contains(hour) {
                    buckets[b].indices.append(idx)
                    if case .weather(let h) = item.type, let prob = h.precipitationProb {
                        buckets[b].maxPrecip = max(buckets[b].maxPrecip, prob)
                    }
                    break
                }
            }
        }

        let periods: [DayPeriod] = buckets.compactMap { bucket in
            guard let first = bucket.indices.first, let last = bucket.indices.last else { return nil }
            let xStart = CGFloat(first) * 80
            let xEnd = CGFloat(last) * 80 + 80
            return DayPeriod(label: bucket.label, xStart: xStart, xEnd: xEnd, maxPrecipProb: bucket.maxPrecip)
        }

        self.chartData = ChartData(items: items, minTemp: minTemp, maxTemp: maxTemp, width: width, height: height, periods: periods)
    }
    
    private func generateDailyDescription() -> String {
        let calendar = Calendar.current
        
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
            }()
        ]
        
        let simpleFormatter = DateFormatter()
        simpleFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        
        func parseDate(_ str: String) -> Date? {
            for f in formatters {
                if let d = f.date(from: str) { return d }
            }
            return simpleFormatter.date(from: str)
        }
        
        var morningCodes: [Int: Int] = [:]
        var afternoonCodes: [Int: Int] = [:]
        var eveningCodes: [Int: Int] = [:]
        var maxTemp: Double = -100
        var minTemp: Double = 100
        var hasTodayData = false
        
        for h in hourly {
            guard let date = parseDate(h.time), calendar.isDateInToday(date) else { continue }
            hasTodayData = true
            let hour = calendar.component(.hour, from: date)
            let code = Int(h.conditionCode) ?? normalizedToWMO(h.conditionCode)
            
            if hour >= 6 && hour < 12 {
                morningCodes[code, default: 0] += 1
            } else if hour >= 12 && hour < 18 {
                afternoonCodes[code, default: 0] += 1
            } else if hour >= 18 && hour < 24 {
                eveningCodes[code, default: 0] += 1
            }
            
            if h.temp > maxTemp { maxTemp = h.temp }
            if h.temp < minTemp { minTemp = h.temp }
        }
        
        if !hasTodayData {
            return "Previsioni dettagliate per la giornata odierna in fase di aggiornamento."
        }
        
        func topCondition(_ codes: [Int: Int]) -> Int? {
            return codes.max(by: { $0.value < $1.value })?.key
        }
        
        let topMorning = topCondition(morningCodes)
        let topAfternoon = topCondition(afternoonCodes)
        let topEvening = topCondition(eveningCodes)
        
        let firstCode = topAfternoon ?? topMorning ?? topEvening ?? 0
        let secondCode = topEvening ?? topAfternoon ?? 0
        
        let timePeriod1 = topAfternoon != nil ? "questo pomeriggio" : (topMorning != nil ? "questa mattina" : "questa sera")
        let timePeriod2 = (topEvening != nil && topAfternoon != nil) ? "in serata" : "più tardi"
        
        var desc = "Cieli \(conditionAdjectivePlural(for: firstCode)) \(timePeriod1)"
        if firstCode != secondCode && topEvening != nil {
            desc += ", \(conditionAdjectiveSingular(for: secondCode)) \(timePeriod2)."
        } else {
            desc += " e \(timePeriod2)."
        }
        
        if maxTemp > -100 {
            desc += " Temperature previste tra \(Int(round(minTemp)))° e \(Int(round(maxTemp)))°."
        }
        
        let sunsetStr = astronomy?.sunset ?? "17:10"
        let sunsetTime = extractTime(from: sunsetStr)
        desc += " Tramonto alle \(sunsetTime)."
        
        return desc
    }
    
    private func normalizedToWMO(_ code: String) -> Int {
        switch code.lowercased() {
        case "clear": return 0
        case "cloudy": return 3
        case "rain": return 61
        case "snow": return 71
        case "storm": return 95
        case "fog": return 45
        default: return 0
        }
    }

    private func conditionAdjectivePlural(for code: Int) -> String {
        switch code {
        case 0: return "sereni"
        case 1, 2: return "poco nuvolosi"
        case 3: return "coperti"
        case 45, 48: return "nebbiosi"
        case 51...57: return "con pioviggine"
        case 61...67, 80...81: return "con pioggia"
        case 71...77, 85...86: return "con neve"
        case 82, 95...99: return "temporaleschi"
        default: return "variabili"
        }
    }
    
    private func conditionAdjectiveSingular(for code: Int) -> String {
        switch code {
        case 0: return "sereno"
        case 1, 2: return "poco nuvoloso"
        case 3: return "coperto"
        case 45, 48: return "nebbioso"
        case 51...57: return "con pioviggine"
        case 61...67, 80...81: return "piovoso"
        case 71...77, 85...86: return "nevoso"
        case 82, 95...99: return "temporalesco"
        default: return "variabile"
        }
    }
}

// MARK: - Subviews
private struct Layout {
    static let sectionHeaderHeight: CGFloat = 45
    static let topPadding: CGFloat = 80 + sectionHeaderHeight
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
            
            // Draw gradient fill below the line
            var fillPath = path
            fillPath.addLine(to: CGPoint(x: points.last!.x, y: size.height - Layout.bottomPadding))
            fillPath.addLine(to: CGPoint(x: points.first!.x, y: size.height - Layout.bottomPadding))
            fillPath.closeSubpath()
            context.fill(fillPath, with: .linearGradient(Gradient(colors: [Color.black.opacity(0.05), Color.clear]), startPoint: CGPoint(x: 0, y: Layout.topPadding), endPoint: CGPoint(x: 0, y: size.height - Layout.bottomPadding)))
            
            context.stroke(path, with: .color(.black.opacity(0.8)), lineWidth: 3)
        }
    }
}

struct ChartPointView: View {
    let item: HourlyForecastView.TimelineItem
    let index: Int
    let total: Int
    let data: HourlyForecastView.ChartData
    var showHourlyPrecip: Bool = false

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
                // Info Group (Icon & Temp) - Above
                VStack(spacing: 4) {
                    switch item.type {
                    case .weather(let h):
                        Image(systemName: iconName(for: h.conditionCode))
                            .renderingMode(.template)
                            .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2)) // Dark gray
                            .font(.title2)
                        Text("\(Int(round(item.temp)))°")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.black)
                    case .sun(let label, let icon):
                        Text(label)
                            .font(.system(size: 10, weight: .bold))
                            .textCase(.uppercase)
                            .foregroundColor(.orange)
                        Image(systemName: icon)
                            .foregroundColor(.orange)
                            .font(.title2)
                    }
                }
                .frame(width: 80)
                .position(x: x, y: y - 50)
                
                // Dot Line (Optional, design has dotted line pointing down, we'll keep it simple)
                
                // Dot on the curve
                Circle()
                    .fill(Color.white)
                    .frame(width: 8, height: 8)
                    .overlay(Circle().stroke(Color.black, lineWidth: 2))
                    .position(x: x, y: y)
                
                // Time & optional hourly precip - Below
                VStack(spacing: 2) {
                    if index == 0 {
                        Text("Ora")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255))
                    } else {
                        Text(formatTime(item.time))
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.gray)
                    }

                    if showHourlyPrecip, case .weather(let h) = item.type, let prob = h.precipitationProb, prob > 0 {
                        Text("\(Int(prob))%")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(precipitationColor(for: prob))
                            .transition(.opacity)
                    }
                }
                .frame(width: 80)
                .position(x: x, y: data.height - Layout.bottomPadding + 20)
            }
        }
    }
    
    private func formatTime(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm" // 24h format
        return f.string(from: date)
    }
    
    private func iconName(for code: String) -> String {
        // Try WMO numeric codes first
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
            default: return "questionmark"
            }
        }
        // Handle normalized condition strings (from non-WMO sources)
        switch code.lowercased() {
        case "clear": return "sun.max.fill"
        case "cloudy": return "cloud.fill"
        case "rain": return "cloud.rain.fill"
        case "snow": return "snowflake"
        case "storm": return "cloud.bolt.rain.fill"
        case "fog": return "cloud.fog.fill"
        default: return "questionmark"
        }
    }
}

