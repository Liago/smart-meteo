import SwiftUI

struct CurrentWeatherView: View {
    let current: ForecastCurrent
    let today: DailyForecast?
    let astronomy: AstronomyData?
    
    @State private var showMore = false
    @State private var sunProgress: Double = 0.0
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Adesso")
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundColor(.black)
                .padding(.horizontal, 8)
            
            HStack(alignment: .center, spacing: 24) {
                // Large Icon
                Image(systemName: iconName(for: current.condition))
                    .renderingMode(.template) // Change from .original to .template to tint it
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 100, height: 100)
                    .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2)) // Dark gray
                    .symbolEffect(.bounce, value: current.condition)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(Int(current.temperature ?? 0))°")
                        .font(.system(size: 48, weight: .regular))
                        .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2))
                    
                    Text("Percepita \(Int(current.feelsLike ?? 0))°")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                    
                    if let today = today {
                        Text("Max \(Int(today.tempMax ?? 0))° Min \(Int(today.tempMin ?? 0))°")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                    
                    Button(action: {
                        withAnimation { showMore.toggle() }
                    }) {
                        HStack(spacing: 4) {
                            Text(showMore ? "Meno" : "Altro")
                            Image(systemName: showMore ? "chevron.up" : "chevron.down")
                        }
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255)) // Red accent
                    }
                    .padding(.top, 2)
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            
            if showMore {
                VStack(spacing: 16) {
                    // Extra details from the original FlipWeatherDetail
                    HStack(spacing: 20) {
                        // Wind -> Gusts
                        FlipWeatherDetail(
                            icon: "wind",
                            mainValue: "\(Int((current.windSpeed ?? 0) * 3.6)) km/h",
                            mainLabel: "Vento",
                            altValue: "\(Int((current.windGust ?? 0) * 3.6)) km/h",
                            altLabel: current.windDirectionLabel != nil ? "Raffica \(current.windDirectionLabel!)" : "Raffica",
                            altIcon: "wind"
                        )
                        
                        // Humidity -> Dew Point
                        FlipWeatherDetail(
                            icon: "humidity",
                            mainValue: "\(Int(current.humidity ?? 0))%",
                            mainLabel: "Umidità",
                            altValue: "\(Int(current.dewPoint ?? 0))°",
                            altLabel: "Punto rugiada",
                            altIcon: "drop.triangle"
                        )
                        
                        // Rain -> AQI
                        FlipWeatherDetail(
                            icon: "drop.fill",
                            mainValue: "\(Int(current.precipitationProb))%",
                            mainLabel: "Pioggia",
                            altValue: aqiValue(current.aqi),
                            altLabel: "AQI",
                            altIcon: "aqi.medium"
                        )
                    }
                    .frame(maxWidth: .infinity)
                    
                    // Sun Arc Section
                    if astronomy != nil {
                        VStack(spacing: 16) {
                            // Sun Arc
                            ZStack {
                                GeometryReader { proxy in
                                    let w = proxy.size.width
                                    let h = proxy.size.height
                                    let centerX = w / 2
                                    let arcBottom = h - 5 // Arc baseline near the bottom
                                    let radius = min((w / 2) - 50, h - 30) // Fit within frame
                                    
                                    // Dashed Arc (full semicircle background - upper half)
                                    Path { path in
                                        path.addArc(center: CGPoint(x: centerX, y: arcBottom),
                                                    radius: radius,
                                                    startAngle: .degrees(180),
                                                    endAngle: .degrees(360),
                                                    clockwise: false)
                                    }
                                    .stroke(Color.gray.opacity(0.25), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                                    
                                    // Highlighted arc (sunrise to current sun position - upper half)
                                    if sunProgress > 0 {
                                        Path { path in
                                            path.addArc(center: CGPoint(x: centerX, y: arcBottom),
                                                        radius: radius,
                                                        startAngle: .degrees(180),
                                                        endAngle: .degrees(180 + (sunProgress * 180)),
                                                        clockwise: false)
                                        }
                                        .stroke(
                                            Color(red: 236/255, green: 104/255, blue: 90/255).opacity(0.6),
                                            lineWidth: 2.5
                                        )
                                    }
                                    
                                    // Sun Icon on the arc
                                    let angle = Angle.degrees(180 - (sunProgress * 180))
                                    let sunX = centerX + radius * cos(angle.radians)
                                    let sunY = arcBottom - radius * sin(angle.radians)
                                    
                                    Image(systemName: "sun.max.fill")
                                        .font(.system(size: 20))
                                        .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255))
                                        .shadow(color: Color(red: 236/255, green: 104/255, blue: 90/255).opacity(0.4), radius: 4, x: 0, y: 0)
                                        .position(x: sunX, y: sunY)
                                    
                                    // Sunrise Label (Left end of arc)
                                    VStack(spacing: 1) {
                                        Image(systemName: "sunrise.fill")
                                            .font(.system(size: 12))
                                            .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255).opacity(0.6))
                                        Text(formatTime(astronomy?.sunrise))
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(.gray)
                                    }
                                    .position(x: centerX - radius, y: arcBottom + 20)
                                    
                                    // Sunset Label (Right end of arc)
                                    VStack(spacing: 1) {
                                        Image(systemName: "sunset.fill")
                                            .font(.system(size: 12))
                                            .foregroundColor(Color(red: 236/255, green: 104/255, blue: 90/255).opacity(0.6))
                                        Text(formatTime(astronomy?.sunset))
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(.gray)
                                    }
                                    .position(x: centerX + radius, y: arcBottom + 20)
                                }
                            }
                            .frame(height: 130)
                            
                            Divider()
                            
                            // Wind & Pressure Row
                            HStack {
                                // Wind
                                HStack(spacing: 10) {
                                    Image(systemName: "wind")
                                        .font(.title3)
                                        .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2))
                                    
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("VENTO")
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundColor(.gray)
                                            .tracking(1)
                                        
                                        HStack(alignment: .lastTextBaseline, spacing: 4) {
                                            Text("\(Int(round((current.windSpeed ?? 0) * 3.6)))")
                                                .font(.system(size: 18, weight: .bold))
                                                .foregroundColor(.black)
                                            Text("km/h")
                                                .font(.caption)
                                                .foregroundColor(.gray)
                                            Text("• \(current.windDirectionLabel ?? "--")")
                                                .font(.caption)
                                                .foregroundColor(.gray)
                                        }
                                    }
                                }
                                
                                Spacer()
                                
                                // Pressure
                                HStack(spacing: 10) {
                                    Image(systemName: "gauge.medium")
                                        .font(.title3)
                                        .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2))
                                    
                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text("BAROMETRO")
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundColor(.gray)
                                            .tracking(1)
                                        
                                        HStack(alignment: .lastTextBaseline, spacing: 4) {
                                            Text("\(Int(round(current.pressure ?? 0)))")
                                                .font(.system(size: 18, weight: .bold))
                                                .foregroundColor(.black)
                                            Text("mBar")
                                                .font(.caption)
                                                .foregroundColor(.gray)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(16)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(Color.white)
                                .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
                        )
                        .padding(.horizontal, 4)
                    }
                }
                .padding(.top, 10)
            }
        }
        .padding()
        .onAppear {
            calculateSunPosition()
        }
        .onChange(of: astronomy?.sunrise) { _ in calculateSunPosition() }
    }
    
    private func iconName(for condition: String) -> String {
        switch condition.lowercased() {
        case "clear": return "sun.max.fill"
        case "cloudy": return "cloud.fill"
        case "rain": return "cloud.rain.fill"
        case "snow": return "cloud.snow.fill"
        case "storm": return "cloud.bolt.rain.fill"
        case "fog": return "cloud.fog.fill"
        default: return "cloud.sun.fill"
        }
    }
    
    private func conditionLabel(for current: ForecastCurrent) -> String {
        let text = current.conditionText
        if text.uppercased() == "UNKNOWN" {
            return current.condition.capitalized
        }
        return text
    }
    
    private func aqiValue(_ aqi: Double?) -> String {
        guard let aqi = aqi else { return "--" }
        return "\(Int(aqi))"
    }
    
    // MARK: - Sun helpers
    
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
        }
    }
}

struct FlipWeatherDetail: View {
    let icon: String
    let mainValue: String
    let mainLabel: String
    
    let altValue: String
    let altLabel: String
    let altIcon: String
    
    @State private var isFlipped = false
    
    var body: some View {
        Button(action: {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                isFlipped.toggle()
            }
        }) {
            VStack(spacing: 4) {
                 if isFlipped {
                     Image(systemName: altIcon)
                         .font(.system(size: 20))
                         .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2))
                         .transition(.scale.combined(with: .opacity))
                     Text(altValue)
                         .font(.system(size: 16, weight: .bold))
                         .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2))
                         .transition(.scale.combined(with: .opacity))
                     Text(altLabel)
                         .font(.caption)
                         .foregroundColor(.gray)
                         .transition(.scale.combined(with: .opacity))
                 } else {
                     Image(systemName: icon)
                         .font(.system(size: 20))
                         .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2))
                         .transition(.scale.combined(with: .opacity))
                     Text(mainValue)
                         .font(.system(size: 16, weight: .bold))
                         .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2))
                         .transition(.scale.combined(with: .opacity))
                     Text(mainLabel)
                         .font(.caption)
                         .foregroundColor(.gray)
                         .transition(.scale.combined(with: .opacity))
                 }
            }
            .frame(minWidth: 80)
            .contentShape(Rectangle()) // Make tappable area consistent
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    ZStack {
        Color(red: 252/255, green: 249/255, blue: 246/255)
            .ignoresSafeArea()
        CurrentWeatherView(current: ForecastCurrent(
            temperature: 24.5,
            feelsLike: 26,
            humidity: 60,
            windSpeed: 12,
            precipitationProb: 0.1,
            condition: "clear",
            conditionText: "Sunny",
            dewPoint: 18,
            windGust: 20,
            windDirectionLabel: "NW",
            aqi: 2,
            pressure: 1013
        ), today: DailyForecast(
            date: "2026-03-02",
            tempMax: 30,
            tempMin: 8,
            precipitationProb: 0,
            conditionCode: "0",
            conditionText: "Clear"
        ), astronomy: AstronomyData(
            sunrise: "2026-03-02T06:45:00Z",
            sunset: "2026-03-02T18:10:00Z",
            moonPhase: "Waxing Gibbous"
        ))
    }
}
