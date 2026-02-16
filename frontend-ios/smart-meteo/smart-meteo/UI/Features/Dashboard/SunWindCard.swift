import SwiftUI

struct SunWindCard: View {
    let astronomy: AstronomyData?
    let current: ForecastCurrent?
    
    @State private var turbineRotation1 = 0.0
    @State private var turbineRotation2 = 0.0
    
    // Sun position state
    @State private var sunProgress: Double = 0.0
    
    var body: some View {
        GlassContainer(cornerRadius: 16) {
            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("Sole & Vento")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Spacer()
                    
                    if let phase = astronomy?.moonPhase {
                        HStack(spacing: 6) {
                            Circle()
                                .strokeBorder(Color.white.opacity(0.4), lineWidth: 1)
                                .background(Circle().fill(Color.white.opacity(0.1)))
                                .frame(width: 16, height: 16)
                            
                            Text(phase)
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.white.opacity(0.8))
                        }
                    }
                }
                .padding([.horizontal, .top], 16)
                
                // Main Content
                VStack(spacing: 0) {
                    // Arc & Sun
                    ZStack {
                        // 1. Background Mountains (Decorative)
                        GeometryReader { proxy in
                            let w = proxy.size.width
                            let h = proxy.size.height
                            
                            Path { path in
                                path.move(to: CGPoint(x: 0, y: h))
                                path.addCurve(to: CGPoint(x: w, y: h),
                                              control1: CGPoint(x: w * 0.25, y: h - 30),
                                              control2: CGPoint(x: w * 0.75, y: h - 50))
                                path.addLine(to: CGPoint(x: w, y: h))
                                path.addLine(to: CGPoint(x: 0, y: h))
                            }
                            .fill(LinearGradient(colors: [.black.opacity(0.2), .clear], startPoint: .bottom, endPoint: .top))
                        }
                        
                        // 2. Arc & Sun
                        GeometryReader { proxy in
                            let w = proxy.size.width
                            let h = proxy.size.height
                            
                            // Center horizontally, near bottom
                            let centerX = w / 2
                            let centerY = h - 10
                            
                            // Radius based on width (leaving some padding)
                            let radius = (w / 2) - 30
                            
                            // Dashed Arc
                            Path { path in
                                path.addArc(center: CGPoint(x: centerX, y: centerY),
                                            radius: radius,
                                            startAngle: .degrees(180),
                                            endAngle: .degrees(0),
                                            clockwise: false)
                            }
                            .stroke(Color.white.opacity(0.3), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                            
                            // Sun Icon
                            let angle = Angle.degrees(180 - (sunProgress * 180))
                            let sunX = centerX + radius * cos(angle.radians)
                            let sunY = centerY - radius * sin(angle.radians)
                            
                            Image(systemName: "sun.max.fill")
                                .font(.system(size: 24))
                                .foregroundColor(.yellow)
                                .shadow(color: .orange.opacity(0.6), radius: 4, x: 0, y: 0)
                                .position(x: sunX, y: sunY)
                        }
                        
                        // Sunrise / Sunset Labels placed at the ends of the arc
                        GeometryReader { proxy in
                            let w = proxy.size.width
                            let h = proxy.size.height
                            let centerX = w / 2
                            let centerY = h - 10
                            let radius = (w / 2) - 30
                            
                            // Sunrise (Left)
                            Text(formatTime(astronomy?.sunrise))
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.6))
                                .position(x: centerX - radius, y: centerY + 15)
                            
                            // Sunset (Right)
                            Text(formatTime(astronomy?.sunset))
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.6))
                                .position(x: centerX + radius, y: centerY + 15)
                        }
                    }
                    .frame(height: 140)
                    
                    // Divider
                    Divider()
                        .background(Color.white.opacity(0.1))
                        .padding(.horizontal, 16)
                    
                    // Data Footer (Wind & Pressure)
                    HStack {
                        // Wind
                        HStack(spacing: 12) {
                            Image(systemName: "wind")
                                .font(.title2)
                                .foregroundColor(.white.opacity(0.7))
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("VENTO")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.white.opacity(0.6))
                                    .tracking(1)
                                
                                HStack(alignment: .lastTextBaseline, spacing: 4) {
                                    Text("\(Int(round((current?.windSpeed ?? 0) * 3.6)))")
                                        .font(.system(size: 20, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("km/h")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.8))
                                    Text("• \(current?.windDirectionLabel ?? "--")")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.6))
                                }
                            }
                        }
                        
                        Spacer()
                        
                        // Pressure
                        HStack(spacing: 12) {
                            Image(systemName: "gauge.medium")
                                .font(.title2)
                                .foregroundColor(.white.opacity(0.7))
                            
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("BAROMETRO")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.white.opacity(0.6))
                                    .tracking(1)
                                
                                HStack(alignment: .lastTextBaseline, spacing: 4) {
                                    Text("\(Int(round(current?.pressure ?? 0)))")
                                        .font(.system(size: 20, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("mBar")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.8))
                                }
                            }
                        }
                    }
                    .padding(16)
                }
            }
        }
        .onAppear {
            calculateSunPosition()
        }
        .onChange(of: astronomy?.sunrise) { _ in calculateSunPosition() }
    }
    
    // Helper for robust date parsing
    private func parseDate(_ str: String) -> Date? {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = isoFormatter.date(from: str) { return d }
        
        isoFormatter.formatOptions = [.withInternetDateTime]
        if let d = isoFormatter.date(from: str) { return d }
        
        let simpleFormatter = DateFormatter()
        simpleFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return simpleFormatter.date(from: str)
    }

    private func formatTime(_ iso: String?) -> String {
        guard let iso = iso, let date = parseDate(iso) else { return "--:--" }
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }
    
    private func calculateSunPosition() {
        guard let astro = astronomy else { return }
        
        guard let sunriseDate = parseDate(astro.sunrise),
              let sunsetDate = parseDate(astro.sunset) else { return }
        
        let now = Date()
        
        if now >= sunriseDate && now <= sunsetDate {
            let total = sunsetDate.timeIntervalSince(sunriseDate)
            let elapsed = now.timeIntervalSince(sunriseDate)
            sunProgress = min(max(elapsed / total, 0), 1)
        } else {
            sunProgress = 0
            // Optionally set to 0 or 1 based on if it's before sunrise or after sunset
            // For now 0 to hide or start is fine across the arc logic
        }
    }
}
