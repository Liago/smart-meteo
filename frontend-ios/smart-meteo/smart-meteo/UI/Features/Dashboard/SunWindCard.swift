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
                        let centerX = w / 2
                        let centerY = h - 20
                        let radius = min(w, h * 2) / 2 - 20
                        
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
                        let sunY = centerY + radius * sin(angle.radians) // SwiftUI Y is down, but sin(180...0) is 0...0 positive? Wait.
                        // Standard unit circle: 180 deg is (-1, 0). 0 deg is (1, 0). 90 deg is (0, 1).
                        // In screen coords: Y is down.
                        // We want 180 (left) to 0 (right).
                        // cos(180) = -1. CenterX + R*(-1) = Left. Correct.
                        // sin(180) = 0. CenterY + R*(0) = CenterY. Correct.
                        // We want UP for 90 deg. sin(90) = 1. CenterY + R*(1) = Down. Incorrect.
                        // So we need CenterY - R*sin(angle).
                        
                        let correctedSunY = centerY - radius * sin(angle.radians)
                        
                        Image(systemName: "sun.max.fill")
                            .font(.system(size: 24))
                            .foregroundColor(.yellow)
                            .shadow(color: .orange.opacity(0.6), radius: 4, x: 0, y: 0)
                            .position(x: sunX, y: correctedSunY)
                    }
                    
                    // 3. Wind Turbines
                    GeometryReader { proxy in
                         let w = proxy.size.width
                         let h = proxy.size.height - 20 // Ground level approx
                        
                        // Turbine 1 (Left-ish center)
                        TurbineView(scale: 0.8, rotation: turbineRotation1)
                            .position(x: w * 0.35, y: h)
                        
                        // Turbine 2 (Right-ish center, smaller)
                        TurbineView(scale: 0.6, rotation: turbineRotation2)
                            .position(x: w * 0.55, y: h)
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
    
    private func formatTime(_ iso: String?) -> String {
        guard let iso = iso else { return "--:--" }
        // Simple parser or shared formatter
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        if let d = f.date(from: iso) {
            let p = DateFormatter()
            p.dateFormat = "HH:mm"
            return p.string(from: d)
        }
        // Fallback for types that might not match exactly or if just time string
        return "--:--"
    }
    
    private func calculateSunPosition() {
        guard let astro = astronomy else { return }
        
        // Parse dates (Needs proper parsing, assume ISO with timezone)
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        
        guard let sunriseDate = f.date(from: astro.sunrise),
              let sunsetDate = f.date(from: astro.sunset) else { return }
        
        let now = Date()
        
        if now >= sunriseDate && now <= sunsetDate {
            let total = sunsetDate.timeIntervalSince(sunriseDate)
            let elapsed = now.timeIntervalSince(sunriseDate)
            sunProgress = min(max(elapsed / total, 0), 1)
        } else {
            sunProgress = 0 // Or 0 if night?
        }
    }
}

// Helper View for Turbine
struct TurbineView: View {
    let scale: CGFloat
    let rotation: Double
    
    var body: some View {
        ZStack(alignment: .top) {
            // Pole
            Rectangle()
                .fill(Color.white)
                .frame(width: 2, height: 50)
                .offset(y: 0) // Grows down from top? No, ZStack aligns center by default
            
            // Blades
            // To animate correctly around "top" of pole:
            // We can just put them in a group and rotate
            
            GeometryReader { _ in
                ZStack {
                    ForEach(0..<3) { i in
                        BladeShape()
                            .fill(Color.white)
                            .frame(width: 20, height: 30) // Aspect ratio roughly
                            .offset(y: -15) // Move up so bottom is at center?
                            .rotationEffect(.degrees(Double(i) * 120))
                    }
                    Circle()
                        .fill(Color.white)
                        .frame(width: 4, height: 4)
                }
            }
            .frame(width: 60, height: 60) // Container for blades
            .rotationEffect(.degrees(rotation))
            .offset(y: 0) // Center of blades at top of pole (0,0 in ZStack alignment top)
        }
        // Combined structure:
        // The ZStack alignment is top.
        // Pole is here.
        // Blades are at top.
        .scaleEffect(scale)
    }
}

struct BladeShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        // Simple blade shape: wider at base, pointy at tip
        // rect.midX, rect.maxY is base center
        let w = rect.width
        let h = rect.height
        
        path.move(to: CGPoint(x: w/2, y: h)) // Base center
        path.addLine(to: CGPoint(x: 0, y: h * 0.2)) // Top Left
        path.addLine(to: CGPoint(x: w/2, y: 0)) // Tip
        path.addLine(to: CGPoint(x: w, y: h * 0.2)) // Top Right
        path.closeSubpath()
        
        return path
    }
}
