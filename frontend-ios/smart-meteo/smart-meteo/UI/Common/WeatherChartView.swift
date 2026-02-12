import SwiftUI

struct WeatherChartView: View {
    let hourly: [HourlyForecast]
    
    // MARK: - Processed Data
    struct ChartData {
        let items: [TimelineItem]
        let minTemp: Double
        let maxTemp: Double
        let width: CGFloat
        let height: CGFloat
    }
    
    struct TimelineItem: Identifiable {
        let id = UUID()
        let time: Date
        let weather: HourlyForecast
        let temp: Double
    }
    
    @State private var chartData: ChartData?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let data = chartData {
                ScrollView(.horizontal, showsIndicators: false) {
                    ZStack(alignment: .topLeading) {
                        // Chart Background (Line)
                        WeatherChartPath(data: data)
                            .frame(width: data.width, height: data.height)
                        
                        // Points & Labels
                        ForEach(Array(data.items.enumerated()), id: \.element.id) { index, item in
                            WeatherChartPointView(item: item, index: index, data: data)
                        }
                    }
                    .frame(width: data.width, height: data.height + 60) // Extra space for labels
                    .padding(.horizontal, 20)
                }
            } else {
                ProgressView()
                    .frame(height: 150)
            }
        }
        .onAppear {
            processData()
        }
        .onChange(of: hourly.count) { _ in processData() }
    }
    
    private func processData() {
        guard !hourly.isEmpty else { return }
        
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        // Fallback formatter
        let simpleFormatter = DateFormatter()
        simpleFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        
        let items = hourly.compactMap { h -> TimelineItem? in
            guard let date = isoFormatter.date(from: h.time) ?? simpleFormatter.date(from: h.time) else { return nil }
            return TimelineItem(time: date, weather: h, temp: h.temp)
        }.sorted { $0.time < $1.time }
        
        guard !items.isEmpty else { return }
        
        let temps = items.map { $0.temp }
        let minTemp = (temps.min() ?? 0) - 2
        let maxTemp = (temps.max() ?? 0) + 2
        
        let width = CGFloat(items.count * 60) // Slightly more compact than main chart (80)
        let height: CGFloat = 120 // Compact height for daily row
        
        self.chartData = ChartData(items: items, minTemp: minTemp, maxTemp: maxTemp, width: width, height: height)
    }
}

// MARK: - Subviews

private struct Layout {
    static let topPadding: CGFloat = 40
    static let bottomPadding: CGFloat = 30
    static let totalPadding: CGFloat = topPadding + bottomPadding
}

struct WeatherChartPath: View {
    let data: WeatherChartView.ChartData
    
    var body: some View {
        Canvas { context, size in
            let points = data.items.enumerated().map { index, item -> CGPoint in
                let x = CGFloat(index) * 60 + 30 // Center in 60px slot
                
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
            
            context.stroke(path, with: .color(.white.opacity(0.4)), lineWidth: 2)
        }
    }
}

struct WeatherChartPointView: View {
    let item: WeatherChartView.TimelineItem
    let index: Int
    let data: WeatherChartView.ChartData
    
    var body: some View {
        GeometryReader { proxy in
            let x = CGFloat(index) * 60 + 30
            
            let yRange = data.maxTemp - data.minTemp
            let range = yRange == 0 ? 1 : yRange
            
            let availableHeight = data.height - Layout.totalPadding
            let yStep = availableHeight / range
            
            let y = data.height - Layout.bottomPadding - ((item.temp - data.minTemp) * yStep)

            ZStack {
                // Dot
                Circle()
                    .fill(Color.white)
                    .frame(width: 6, height: 6)
                    .position(x: x, y: y)
                
                // Icon & Temp - Above
                VStack(spacing: 2) {
                    Image(systemName: iconName(for: item.weather.conditionCode))
                        .symbolRenderingMode(.multicolor)
                        .font(.body)
                        .shadow(radius: 1)
                    Text("\(Int(round(item.temp)))°")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .shadow(color: .black.opacity(0.3), radius: 1, x: 0, y: 1)
                }
                .frame(width: 60)
                .position(x: x, y: y - 25)
                
                // Time & Rain - Below
                VStack(spacing: 2) {
                    Text(formatTime(item.time))
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.6))
                    
                    if let prob = item.weather.precipitationProb, prob > 0 {
                        Text("\(Int(prob))%")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.cyan)
                    }
                }
                .frame(width: 60)
                .position(x: x, y: y + 35)
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
