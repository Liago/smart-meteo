import SwiftUI

struct CurrentWeatherView: View {
    let current: ForecastCurrent
    let today: DailyForecast?
    let astronomy: AstronomyData?

    @State private var showMore = false
    @State private var showAirQuality = false
    @State private var sunProgress: Double = 0.0
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Adesso")
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundColor(.black)
                .padding(.horizontal, 8)
            
            HStack(alignment: .center, spacing: 24) {
                // Large Icon
                ResizableWeatherIcon(systemName: iconName(for: current.conditionCode ?? current.condition), size: 100)
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

                        // Pioggia -> Nuvole
                        FlipWeatherDetail(
                            icon: "drop.fill",
                            mainValue: "\(Int(current.precipitationProb))%",
                            mainLabel: "Pioggia",
                            altValue: current.cloudCover != nil ? "\(Int(current.cloudCover!))%" : "--",
                            altLabel: "Nuvole",
                            altIcon: "cloud.fill"
                        )
                    }
                    .frame(maxWidth: .infinity)

                    // Seconda riga: UV, Pressione/Visibilità, AQI/PM2.5
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

                        // AQI -> PM2.5 (con info icon per dettaglio qualità aria)
                        ZStack(alignment: .topTrailing) {
                            FlipWeatherDetail(
                                icon: "aqi.medium",
                                mainValue: aqiValue(current.aqi),
                                mainLabel: "AQI",
                                altValue: current.airQuality?.pm25 != nil ? String(format: "%.1f", current.airQuality!.pm25!) : "--",
                                altLabel: "PM2.5",
                                altIcon: "aqi.medium"
                            )

                            if current.airQuality != nil {
                                Button {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                        showAirQuality.toggle()
                                    }
                                } label: {
                                    Image(systemName: "info.circle")
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundColor(.gray)
                                }
                                .offset(x: 4, y: -2)
                            }
                        }
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

                            // Moon Section
                            MoonInfoSection(astronomy: astronomy)
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
        .overlay {
            if showAirQuality, let aq = current.airQuality {
                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
                    .onTapGesture {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            showAirQuality = false
                        }
                    }

                AirQualityBalloon(airQuality: aq) {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        showAirQuality = false
                    }
                }
                .transition(.scale(scale: 0.9).combined(with: .opacity))
            }
        }
        .onAppear {
            calculateSunPosition()
        }
        .onChange(of: astronomy?.sunrise) { calculateSunPosition() }
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
        simpleFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        if let d = simpleFormatter.date(from: str) { return d }

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

// MARK: - Moon Calculations

private struct MoonData {
    let phaseName: String
    let phaseIcon: String
    let illumination: Int
    let daysToFullMoon: Int
    let moonrise: String?
    let moonset: String?
}

/// Calculates the moon's synodic age (days since last new moon) for a given date.
/// Returns a value from 0 to ~29.53.
private func moonAge(for date: Date) -> Double {
    let calendar = Calendar.current
    let year = Double(calendar.component(.year, from: date))
    let month = Double(calendar.component(.month, from: date))
    let day = Double(calendar.component(.day, from: date))
    let hour = Double(calendar.component(.hour, from: date))

    var y = year
    var m = month
    if m < 3 {
        y -= 1
        m += 12
    }
    m += 1

    let c = 365.25 * y
    let e = 30.6 * m
    let jd = c + e + day + (hour / 24.0) - 694039.09
    let synodicMonth = 29.5305882
    let age = jd.truncatingRemainder(dividingBy: synodicMonth)
    return age < 0 ? age + synodicMonth : age
}

private func computeMoonData(astronomy: AstronomyData?) -> MoonData {
    let age = moonAge(for: Date())
    let synodicMonth = 29.5305882

    // Illumination: use backend value if available, otherwise calculate
    let illumination: Int
    if let backendIllum = astronomy?.moonIllumination {
        illumination = backendIllum
    } else {
        illumination = Int(round((1 - cos(age / synodicMonth * 2 * .pi)) / 2 * 100))
    }

    // Days to next full moon (age ≈ 14.76 at full)
    let fullMoonAge = synodicMonth / 2.0
    let daysToFull: Int
    if age <= fullMoonAge {
        daysToFull = Int(round(fullMoonAge - age))
    } else {
        daysToFull = Int(round(synodicMonth - age + fullMoonAge))
    }

    // Phase name and SF Symbol icon
    let phase: Int = {
        let p = Int(round(age / synodicMonth * 8)) % 8
        return p
    }()

    let (name, icon): (String, String) = {
        switch phase {
        case 0: return ("Luna Nuova", "moonphase.new.moon")
        case 1: return ("Luna Crescente", "moonphase.waxing.crescent")
        case 2: return ("Primo Quarto", "moonphase.first.quarter")
        case 3: return ("Gibbosa Crescente", "moonphase.waxing.gibbous")
        case 4: return ("Luna Piena", "moonphase.full.moon")
        case 5: return ("Gibbosa Calante", "moonphase.waning.gibbous")
        case 6: return ("Ultimo Quarto", "moonphase.last.quarter")
        case 7: return ("Luna Calante", "moonphase.waning.crescent")
        default: return ("Luna Nuova", "moonphase.new.moon")
        }
    }()

    return MoonData(
        phaseName: name,
        phaseIcon: icon,
        illumination: illumination,
        daysToFullMoon: daysToFull,
        moonrise: astronomy?.moonrise,
        moonset: astronomy?.moonset
    )
}

// MARK: - Moon Info Section

private struct MoonInfoSection: View {
    let astronomy: AstronomyData?

    var body: some View {
        let moon = computeMoonData(astronomy: astronomy)

        HStack(spacing: 16) {
            // Left: Moon data rows
            VStack(alignment: .leading, spacing: 10) {
                // Phase header
                HStack(spacing: 6) {
                    Image(systemName: moon.phaseIcon)
                        .font(.system(size: 14))
                        .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2))
                    Text(moon.phaseName.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.gray)
                        .tracking(1)
                }

                // Illumination
                MoonDataRow(label: "Illuminazione", value: "\(moon.illumination)%")

                if let moonrise = moon.moonrise {
                    MoonDataRow(label: "Luna \u{2191}", value: formatMoonTime(moonrise))
                }

                if let moonset = moon.moonset {
                    MoonDataRow(label: "Luna \u{2193}", value: formatMoonTime(moonset))
                }

                if moon.daysToFullMoon == 0 {
                    MoonDataRow(label: "Luna piena", value: "Oggi")
                } else {
                    MoonDataRow(label: "Prossima luna piena", value: "\(moon.daysToFullMoon) giorni")
                }
            }

            Spacer()

            // Right: Moon phase visual
            Image(systemName: moon.phaseIcon)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 60, height: 60)
                .foregroundStyle(
                    .linearGradient(
                        colors: [Color(red: 0.6, green: 0.65, blue: 0.75), Color(red: 0.4, green: 0.45, blue: 0.55)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
        }
    }

    private func formatMoonTime(_ iso: String) -> String {
        // Try ISO8601 parsing
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
        for formatter in formatters {
            if let date = formatter.date(from: iso) {
                let df = DateFormatter()
                df.dateFormat = "HH:mm"
                return df.string(from: date)
            }
        }
        // Fallback: extract HH:mm from string
        if iso.contains("T") {
            let parts = iso.split(separator: "T")
            if parts.count > 1 {
                return String(parts[1].prefix(5))
            }
        }
        return iso
    }
}

private struct MoonDataRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(Color(red: 0.2, green: 0.2, blue: 0.2))
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.black)
        }
    }
}

// MARK: - Air Quality Balloon

struct AirQualityBalloon: View {
    let airQuality: AirQualityDetail
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Qualità dell'aria")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.primary)

                Text(WeatherDescriptionEngine.aqiCategoryLabel(airQuality.aqiUsEpa))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(WeatherDescriptionEngine.aqiCategoryColor(airQuality.aqiUsEpa)))

                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(.gray.opacity(0.5))
                }
            }

            Text(WeatherDescriptionEngine.generateAirQualityDescription(airQuality: airQuality))
                .font(.system(size: 13))
                .foregroundColor(Color(red: 0.3, green: 0.3, blue: 0.3))
                .lineSpacing(2)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                AQIDetailItem(label: "PM2.5", value: airQuality.pm25, unit: "µg/m³")
                AQIDetailItem(label: "PM10", value: airQuality.pm10, unit: "µg/m³")
                AQIDetailItem(label: "NO₂", value: airQuality.no2, unit: "µg/m³")
                AQIDetailItem(label: "O₃", value: airQuality.o3, unit: "µg/m³")
                AQIDetailItem(label: "CO", value: airQuality.co, unit: "µg/m³")
                AQIDetailItem(label: "SO₂", value: airQuality.so2, unit: "µg/m³")
            }
        }
        .padding(14)
        .frame(width: 300)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.12), radius: 16, x: 0, y: 8)
        )
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
            conditionCode: "0",
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
            moonrise: "2026-03-02T04:00:00",
            moonset: "2026-03-02T12:04:00",
            moonIllumination: 35
        ))
    }
}
