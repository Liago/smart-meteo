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
                Image(systemName: iconName(for: current.conditionCode ?? current.condition))
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

                    // Seconda riga: UV, Pressione/Visibilità, Nuvole/PM2.5
                    HStack(spacing: 20) {
                        // UV Index -> Livello UV
                        FlipWeatherDetail(
                            icon: "sun.max.fill",
                            mainValue: current.uvIndex != nil ? String(format: "%.0f", current.uvIndex!) : "--",
                            mainLabel: "UV Index",
                            altValue: current.uvIndex != nil ? uvLabel(current.uvIndex!) : "--",
                            altLabel: "Livello UV",
                            altIcon: "sun.max.trianglebadge.exclamationmark",
                            accentColor: current.uvIndex != nil ? uvColor(current.uvIndex!) : nil
                        )

                        // Pressione -> Visibilità
                        FlipWeatherDetail(
                            icon: "gauge.medium",
                            mainValue: current.pressure != nil ? "\(Int(current.pressure!))" : "--",
                            mainLabel: "Pressione",
                            altValue: current.visibility != nil ? String(format: "%.1f km", current.visibility!) : "--",
                            altLabel: "Visibilità",
                            altIcon: "eye.fill"
                        )

                        // Nuvole -> PM2.5
                        FlipWeatherDetail(
                            icon: "cloud.fill",
                            mainValue: current.cloudCover != nil ? "\(Int(current.cloudCover!))%" : "--",
                            mainLabel: "Nuvole",
                            altValue: current.airQuality?.pm25 != nil ? String(format: "%.1f", current.airQuality!.pm25!) : "--",
                            altLabel: "PM2.5",
                            altIcon: "aqi.medium"
                        )
                    }
                    .frame(maxWidth: .infinity)

                    // Dettaglio Qualità dell'Aria
                    if let aq = current.airQuality {
                        VStack(spacing: 8) {
                            Text("QUALITÀ DELL'ARIA")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.gray)
                                .tracking(1)

                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                                AQIDetailItem(label: "PM2.5", value: aq.pm25, unit: "µg/m³")
                                AQIDetailItem(label: "PM10", value: aq.pm10, unit: "µg/m³")
                                AQIDetailItem(label: "NO₂", value: aq.no2, unit: "µg/m³")
                                AQIDetailItem(label: "O₃", value: aq.o3, unit: "µg/m³")
                                AQIDetailItem(label: "CO", value: aq.co, unit: "µg/m³")
                                AQIDetailItem(label: "SO₂", value: aq.so2, unit: "µg/m³")
                            }
                        }
                        .padding(12)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.white)
                                .shadow(color: Color.black.opacity(0.05), radius: 6, x: 0, y: 2)
                        )
                        .padding(.horizontal, 4)
                    }
                    
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
    
    private func iconName(for code: String) -> String {
        // Try WMO numeric codes first (same logic as HourlyForecastView)
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
            default: return "cloud.sun.fill"
            }
        }
        // Fallback: normalized condition strings
        switch code.lowercased() {
        case "clear": return "sun.max.fill"
        case "cloudy": return "cloud.fill"
        case "rain": return "cloud.rain.fill"
        case "snow": return "snowflake"
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

    private func uvLabel(_ uv: Double) -> String {
        switch uv {
        case ...2: return "Basso"
        case ...5: return "Moderato"
        case ...7: return "Alto"
        case ...10: return "Molto Alto"
        default: return "Estremo"
        }
    }

    private func uvColor(_ uv: Double) -> Color {
        switch uv {
        case ...2: return .green
        case ...5: return .yellow
        case ...7: return .orange
        case ...10: return .red
        default: return .purple
        }
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
    var accentColor: Color? = nil

    @State private var isFlipped = false

    private var iconColor: Color {
        if isFlipped, let accent = accentColor {
            return accent
        }
        return Color(red: 0.2, green: 0.2, blue: 0.2)
    }

    private var valueColor: Color {
        if isFlipped, let accent = accentColor {
            return accent
        }
        return Color(red: 0.2, green: 0.2, blue: 0.2)
    }

    var body: some View {
        Button(action: {
            HapticManager.light()
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                isFlipped.toggle()
            }
        }) {
            VStack(spacing: 4) {
                 if isFlipped {
                     Image(systemName: altIcon)
                         .font(.system(size: 20))
                         .foregroundColor(iconColor)
                         .transition(.scale.combined(with: .opacity))
                     Text(altValue)
                         .font(.system(size: 16, weight: .bold))
                         .foregroundColor(valueColor)
                         .transition(.scale.combined(with: .opacity))
                     Text(altLabel)
                         .font(.caption)
                         .foregroundColor(.gray)
                         .transition(.scale.combined(with: .opacity))
                 } else {
                     Image(systemName: icon)
                         .font(.system(size: 20))
                         .foregroundColor(iconColor)
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
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct AQIDetailItem: View {
    let label: String
    let value: Double?
    let unit: String

    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.gray)
                .tracking(0.5)
            Text(value != nil ? String(format: "%.1f", value!) : "--")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2))
            Text(unit)
                .font(.system(size: 9))
                .foregroundColor(.gray)
        }
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
            pressure: 1013,
            uvIndex: 6,
            visibility: 10.5,
            cloudCover: 25,
            airQuality: AirQualityDetail(aqiUsEpa: 2, pm25: 12.3, pm10: 20.1, no2: 15.0, o3: 40.0, co: 200.0, so2: 5.0)
        ), today: DailyForecast(
            date: "2026-03-02",
            tempMax: 30,
            tempMin: 8,
            precipitationProb: 0,
            conditionCode: "0",
            conditionText: "Clear",
            uvIndexMax: 8
        ), astronomy: AstronomyData(
            sunrise: "2026-03-02T06:45:00Z",
            sunset: "2026-03-02T18:10:00Z",
            moonPhase: "Waxing Gibbous",
            moonrise: nil,
            moonset: nil
        ))
    }
}
