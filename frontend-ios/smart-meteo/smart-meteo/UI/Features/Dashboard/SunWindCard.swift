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
                        
                        // Shift center left to make room for text on the right
                        let centerX = w * 0.4
                        let centerY = h - 20
                        
                        // Radius constrained by the left side (centerX - padding)
                        let radius = centerX - 20
                        
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
                    
                    // 3. Wind Turbines
                    GeometryReader { proxy in
                         let w = proxy.size.width
                         let h = proxy.size.height - 20 // Ground level approx
                        
                        // Turbine 1 (Left-ish)
                        TurbineView(scale: 0.8, rotation: turbineRotation1)
                            .position(x: w * 0.25, y: h)
                        
                        // Turbine 2 (Center-ish)
                        TurbineView(scale: 0.6, rotation: turbineRotation2)
                            .position(x: w * 0.5, y: h)
                    }
                    
                    // 4. Info Overlay (Right side)
                    HStack {
                        Spacer()
                        VStack(alignment: .trailing, spacing: 12) {
                            // Wind
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("VENTO")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.white.opacity(0.6))
                                    .tracking(1)
                                
                                HStack(alignment: .lastTextBaseline, spacing: 2) {
                                    Text("\(Int(round((current?.windSpeed ?? 0) * 3.6)))")
                                        .font(.system(size: 24, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("km/h")
                                        .font(.caption)
                                        .foregroundColor(.white)
                                }
                                
                                Text("Dir: \(current?.windDirectionLabel ?? "--")")
                                    .font(.caption2)
                                    .foregroundColor(.white.opacity(0.5))
                            }
                            
                            // Pressure
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("BAROMETRO")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.white.opacity(0.6))
                                    .tracking(1)
                                
                                Text("\(Int(round(current?.pressure ?? 0)))")
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundColor(.white)
                                
                                Text("mBar")
                                    .font(.caption2)
                                    .foregroundColor(.white.opacity(0.5))
                            }
                        }
                        .padding(.trailing, 16)
                    }
                    
                }
                .frame(height: 160)
                
                // Footer (Sunrise/Sunset times)
                HStack {
                    Text(formatTime(astronomy?.sunrise))
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.5))
                    
                    Spacer()
                    
                    Text(formatTime(astronomy?.sunset))
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.5))
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }
        }
        .onAppear {
            calculateSunPosition()
            
            // Replicate animations
            withAnimation(.linear(duration: 4).repeatForever(autoreverses: false)) {
                turbineRotation1 = 360
            }
            withAnimation(.linear(duration: 3).repeatForever(autoreverses: false)) {
                turbineRotation2 = -360
            }
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

// Helper View for Turbine
struct TurbineView: View {
    let scale: CGFloat
    let rotation: Double
    
    var body: some View {
        VStack(spacing: 0) {
            // Blades Header
            ZStack {
                ForEach(0..<3) { i in
                    BladeShape()
                        .fill(Color.white)
                        .frame(width: 14, height: 35)
                        // Pivot at bottom center of blade
                        .offset(y: -17.5) // Blade center is at 0,0. This moves it up so bottom is at 0,0?
                        // Wait. BladeShape draws (w/2, h) as base.
                        // Frame (14, 35). Base is at (7, 35).
                        // View center is (7, 17.5).
                        // Base relative to center is y = 17.5.
                        // We want base at (0,0) of the ZStack rotation point.
                        // So we need to move the view up by 17.5.
                        .offset(y: -17.5)
                        .rotationEffect(.degrees(Double(i) * 120))
                }
                Circle()
                    .fill(Color.white)
                    .frame(width: 4, height: 4)
            }
            .rotationEffect(.degrees(rotation))
            .zIndex(10)
            
            // Pole
            Rectangle()
                .fill(Color.white)
                .frame(width: 2, height: 40)
                .offset(y: -2) // Connect to hub
        }
        .scaleEffect(scale)
    }
}

struct BladeShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        
        // Base center at (w/2, h)
        path.move(to: CGPoint(x: w/2, y: h))
        // Top Left
        path.addLine(to: CGPoint(x: 0, y: h * 0.2))
        // Tip
        path.addLine(to: CGPoint(x: w/2, y: 0))
        // Top Right
        path.addLine(to: CGPoint(x: w, y: h * 0.2))
        path.closeSubpath()
        return path
    }
}
