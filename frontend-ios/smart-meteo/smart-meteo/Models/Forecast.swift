import Foundation

// MARK: - Weather Alert
struct WeatherAlert: Codable, Identifiable, Equatable {
    let id: String
    let areaId: String?
    let areaName: String?
    let certainty: String?
    let countryCode: String?
    let description: String
    let effectiveTime: String
    let expireTime: String
    let issuedTime: String?
    let eventSource: String?
    let severity: String
    let source: String?
    let urgency: String?
    let detailsUrl: String?

    static func == (lhs: WeatherAlert, rhs: WeatherAlert) -> Bool {
        lhs.id == rhs.id
    }

    /// Colore associato alla severity
    var severityColor: (red: Double, green: Double, blue: Double) {
        switch severity.lowercased() {
        case "extreme": return (0.9, 0.1, 0.1)    // rosso
        case "severe":  return (1.0, 0.5, 0.0)    // arancione
        case "moderate": return (1.0, 0.8, 0.0)   // giallo
        default:        return (0.3, 0.6, 1.0)    // azzurro
        }
    }

    /// Icona SF Symbol per la severity
    var severityIcon: String {
        switch severity.lowercased() {
        case "extreme": return "exclamationmark.triangle.fill"
        case "severe":  return "exclamationmark.triangle.fill"
        case "moderate": return "exclamationmark.triangle"
        default:        return "info.circle"
        }
    }

    /// Label italiana per la severity
    var severityLabel: String {
        switch severity.lowercased() {
        case "extreme": return "Estrema"
        case "severe":  return "Severa"
        case "moderate": return "Moderata"
        case "minor":   return "Lieve"
        default:        return severity.capitalized
        }
    }

    /// Controlla se l'allerta è ancora attiva
    var isActive: Bool {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let expire = formatter.date(from: expireTime) ?? ISO8601DateFormatter().date(from: expireTime) else {
            return true // Se non riesce a parsare, mostrala comunque
        }
        return expire > Date()
    }
}

// MARK: - API Response
struct ForecastResponse: Codable {
    let location: Coordinate
    let generatedAt: String
    let sourcesUsed: [String]
    /// Offset locale della località rispetto a UTC, in secondi. Le chiavi di
    /// `hourly` sono in ora locale: senza, non si può dire quale slot è "adesso"
    /// per una località in un altro fuso.
    let utcOffsetSeconds: Int?
    let current: ForecastCurrent
    let daily: [DailyForecast]?
    let hourly: [HourlyForecast]?
    let astronomy: AstronomyData?
    let alerts: [WeatherAlert]?
    /// Quanto le fonti sono d'accordo. Opzionale: manca sulle risposte in cache
    /// scritte prima della sua introduzione.
    let confidence: ConfidenceIndex?
    /// Pollini per specie: presenti solo dove il modello CAMS copre (Europa).
    let pollen: [PollenReading]?
    /// Neve e gelate nelle prossime 24 ore. Il backend manda il blocco solo
    /// quando c'è qualcosa da segnalare, quindi la sua sola presenza basta a
    /// decidere se mostrare il riquadro.
    let snow: SnowOutlook?
    /// Orto: presente ovunque Open-Meteo dia i dati agronomici.
    let garden: GardenOutlook?
    /// Nowcast al minuto per la prossima ora. Presente solo dove Apple WeatherKit
    /// copre il dataset `forecastNextHour` (Italia inclusa).
    let forecastNextHour: ForecastNextHour?

    enum CodingKeys: String, CodingKey {
        case location
        case generatedAt = "generated_at"
        case sourcesUsed = "sources_used"
        case utcOffsetSeconds = "utc_offset_seconds"
        case current
        case daily
        case hourly
        case astronomy
        case alerts
        case confidence
        case pollen
        case snow
        case garden
        case forecastNextHour
    }
}

struct Coordinate: Codable {
    let lat: Double
    let lon: Double
}

// MARK: - Current Weather
struct ForecastCurrent: Codable {
    let temperature: Double?
    let feelsLike: Double?
    let humidity: Double?
    let windSpeed: Double?
    let precipitationProb: Double
    /// mm/h che stanno cadendo adesso. Opzionale: manca sulle risposte in cache
    /// scritte prima della sua introduzione.
    let precipitationIntensity: Double?
    let condition: String
    let conditionCode: String?
    let conditionText: String
    
    // New fields
    let dewPoint: Double?
    let windGust: Double?
    let windDirectionLabel: String?
    let aqi: Double?
    let pressure: Double?
    let uvIndex: Double?
    let visibility: Double?       // km
    let cloudCover: Double?       // percentuale 0-100
    let airQuality: AirQualityDetail?

    enum CodingKeys: String, CodingKey {
        case temperature
        case feelsLike = "feels_like"
        case humidity
        case windSpeed = "wind_speed"
        case precipitationProb = "precipitation_prob"
        case precipitationIntensity = "precipitation_intensity"
        case condition
        case conditionCode = "condition_code"
        case conditionText = "condition_text"

        // New keys
        case dewPoint = "dew_point"
        case windGust = "wind_gust"
        case windDirectionLabel = "wind_direction_label"
        case aqi
        case pressure
        case uvIndex = "uv_index"
        case visibility
        case cloudCover = "cloud_cover"
        case airQuality = "air_quality"
    }
}

// MARK: - Daily Forecast
struct DailyForecast: Codable, Identifiable {
    var id: String { date }
    let date: String
    let tempMax: Double?
    let tempMin: Double?
    let precipitationProb: Double?
    let conditionCode: String
    let conditionText: String?
    let uvIndexMax: Double?
    /// mm totali previsti per il giorno. Opzionale: manca sulle risposte in
    /// cache scritte prima dell'introduzione del campo.
    let precipitationMm: Double?
    /// cm di neve fresca previsti per il giorno.
    let snowfallCm: Double?

    enum CodingKeys: String, CodingKey {
        case date
        case tempMax = "temp_max"
        case tempMin = "temp_min"
        case precipitationProb = "precipitation_prob"
        case conditionCode = "condition_code"
        case conditionText = "condition_text"
        case uvIndexMax = "uv_index_max"
        case precipitationMm = "precipitation_mm"
        case snowfallCm = "snowfall_cm"
    }
}

// MARK: - Hourly Forecast
struct HourlyForecast: Codable, Identifiable {
    var id: String { time } // Use time (ISO) as ID
    let time: String
    let temp: Double
    let precipitationProb: Double?
    let conditionCode: String
    let conditionText: String?
    /// mm accumulati nell'ora. Opzionale: manca sulle risposte in cache scritte
    /// prima dell'introduzione del campo e sulle fonti che non lo forniscono.
    let precipitationMm: Double?
    /// Temperatura percepita in °C. Opzionale come i campi qui sotto: manca
    /// sulle risposte in cache scritte prima della sua introduzione.
    let feelsLike: Double?
    let humidity: Double?
    let windSpeed: Double?
    /// Direzione del vento in gradi, 0 = da nord.
    let windDirection: Double?
    /// Raffica in m/s, come `windSpeed`.
    let windGust: Double?
    let uvIndex: Double?
    /// Banda di incertezza della temperatura dai membri dell'ensemble
    /// (percentili 10 e 90). Presente solo dove il modello di ensemble copre
    /// l'orizzonte: si assottiglia sulle ore vicine e si allarga in avanti.
    let tempP10: Double?
    let tempP90: Double?
    /// Neve fresca dell'ora in cm (non equivalente in acqua).
    let snowfallCm: Double?
    /// Manto nevoso al suolo, in cm.
    let snowDepthCm: Double?
    /// Quota dello zero termico, in metri.
    let freezingLevel: Double?
    /// Temperatura della superficie del suolo, °C: è lì che si forma la brina.
    let soilTemperature: Double?
    /// Temperatura dello strato 0-7 cm, °C: è lì che germinano i semi.
    let soilTemperatureRoot: Double?
    /// Contenuto d'acqua volumetrico dello strato 0-7 cm, m³/m³.
    let soilMoisture: Double?
    /// Evapotraspirazione di riferimento FAO dell'ora, mm.
    let evapotranspiration: Double?
    /// Deficit di pressione di vapore, kPa.
    let vapourPressureDeficit: Double?
    /// Energia potenziale convettiva disponibile, J/kg.
    let cape: Double?
    /// Lifted index, °C: negativo = instabile.
    let liftedIndex: Double?
    /// Indice 0-100 di rischio temporali, calcolato dal backend a partire dagli
    /// indici convettivi. Presente solo dove i modelli li espongono.
    let stormIndex: Double?
    /// Probabilità di tuono in %, da WorldWeatherOnline.
    let thunderProb: Double?

    enum CodingKeys: String, CodingKey {
        case time
        case temp
        case precipitationProb = "precipitation_prob"
        case conditionCode = "condition_code"
        case conditionText = "condition_text"
        case precipitationMm = "precipitation_mm"
        case feelsLike = "feels_like"
        case humidity
        case windSpeed = "wind_speed"
        case windDirection = "wind_direction"
        case windGust = "wind_gust"
        case uvIndex = "uv_index"
        case tempP10 = "temp_p10"
        case tempP90 = "temp_p90"
        case snowfallCm = "snowfall_cm"
        case snowDepthCm = "snow_depth_cm"
        case freezingLevel = "freezing_level"
        case soilTemperature = "soil_temperature"
        case soilTemperatureRoot = "soil_temperature_root"
        case soilMoisture = "soil_moisture"
        case evapotranspiration
        case vapourPressureDeficit = "vapour_pressure_deficit"
        case cape
        case liftedIndex = "lifted_index"
        case stormIndex = "storm_index"
        case thunderProb = "thunder_prob"
    }
}

// MARK: - Astronomy
struct AstronomyData: Codable {
    let sunrise: String
    let sunset: String
    let moonPhase: String?
    let moonrise: String?
    let moonset: String?
    let moonIllumination: Int?

    enum CodingKeys: String, CodingKey {
        case sunrise
        case sunset
        case moonPhase = "moon_phase"
        case moonrise
        case moonset
        case moonIllumination = "moon_illumination"
    }
}

// MARK: - Air Quality Detail
struct AirQualityDetail: Codable {
    let aqiUsEpa: Double?
    let pm25: Double?
    let pm10: Double?
    let no2: Double?
    let o3: Double?
    let co: Double?
    let so2: Double?
    /// Indice europeo (0-100+), da Open-Meteo: scala diversa dall'EPA 1-6.
    let europeanAqi: Double?

    enum CodingKeys: String, CodingKey {
        case aqiUsEpa = "aqi_us_epa"
        case pm25 = "pm2_5"
        case pm10, no2, o3, co, so2
        case europeanAqi = "european_aqi"
    }
}

// MARK: - Pollini

/// Livello pollinico, secondo le soglie della singola specie: 30 granuli/m³ di
/// graminacee sono una giornata pesante, gli stessi 30 di olivo poca cosa.
struct PollenReading: Codable, Identifiable {
    var id: String { species }
    let species: String
    let label: String
    /// Granuli/m³ nell'ora corrente.
    let value: Double?
    /// Massimo previsto in giornata.
    let dailyMax: Double?
    /// "none" | "low" | "moderate" | "high" | "very_high"
    let level: String
    let dailyLevel: String

    enum CodingKeys: String, CodingKey {
        case species, label, value, level
        case dailyMax = "daily_max"
        case dailyLevel = "daily_level"
    }
}

// MARK: - Neve e gelate

/// Rischio gelate nelle prossime 24 ore.
struct FrostOutlook: Codable {
    /// "none" | "possible" | "likely" | "severe"
    let level: String
    /// Temperatura minima prevista nella finestra, °C.
    let minTemp: Double?
    /// Slot orario del minimo, nella stessa chiave locale degli hourly.
    let at: String?
    /// "soil" | "air": se la minima è quella della superficie o quella dei due
    /// metri. Cambia il significato della frase, e il backend usa soglie
    /// diverse per le due.
    let source: String

    enum CodingKeys: String, CodingKey {
        case level
        case minTemp = "min_temp"
        case at
        case source
    }
}

/// Neve e gelate nelle prossime 24 ore.
///
/// La quota dello zero termico da sola è un dato da bollettino: quello che
/// serve sapere è se a *casa propria* verrà giù neve o acqua. `elevation` è la
/// quota del punto di griglia dichiarata da Open-Meteo, ed è lei a rendere
/// leggibile `snowLine`.
struct SnowOutlook: Codable {
    /// Quota della località secondo i modelli, in metri.
    let elevation: Double?
    /// Quota neve più bassa prevista nella finestra, in metri.
    let snowLine: Double?
    /// "snow" | "sleet" | "rain"; nil se non è prevista precipitazione.
    let phase: String?
    /// Manto nevoso presente adesso, in cm.
    let snowDepthCm: Double?
    /// Neve fresca attesa nella finestra, in cm.
    let snowfallCm: Double?
    let frost: FrostOutlook

    enum CodingKeys: String, CodingKey {
        case elevation
        case snowLine = "snow_line"
        case phase
        case snowDepthCm = "snow_depth_cm"
        case snowfallCm = "snowfall_cm"
        case frost
    }
}

// MARK: - Orto e giardino

/// Orto e giardino nelle prossime 24 ore.
///
/// A differenza di `SnowOutlook`, il backend manda questo blocco anche quando è
/// tutto tranquillo: «non serve innaffiare» è una risposta, ed è quella che chi
/// ha un orto va a cercare la sera.
struct GardenOutlook: Codable {
    /// Umidità volumetrica attuale dello strato 0-7 cm, m³/m³.
    let soilMoisture: Double?
    /// "very_dry" | "dry" | "adequate" | "wet"
    let moistureLevel: String?
    /// Temperatura media dello strato radicale nella finestra, °C.
    let soilTemperature: Double?
    /// Evapotraspirazione attesa nella finestra, mm.
    let evapotranspirationMm: Double?
    /// Pioggia attesa nella finestra, mm.
    let rainMm: Double?
    /// Evapotraspirazione meno pioggia: positivo = il terreno perde acqua.
    let waterBalanceMm: Double?
    /// "rain_expected" | "water_now" | "water_soon" | "not_needed"
    let advice: String
    /// Se lo strato radicale è abbastanza caldo per seminare.
    let sowingOk: Bool?

    enum CodingKeys: String, CodingKey {
        case soilMoisture = "soil_moisture"
        case moistureLevel = "moisture_level"
        case soilTemperature = "soil_temperature"
        case evapotranspirationMm = "evapotranspiration_mm"
        case rainMm = "rain_mm"
        case waterBalanceMm = "water_balance_mm"
        case advice
        case sowingOk = "sowing_ok"
    }
}

// MARK: - Next Hour Precipitation

/// Un minuto della previsione di precipitazione per la prossima ora.
/// `startTime` è un istante UTC, così come lo restituisce WeatherKit.
struct MinutelyPrecipitation: Codable, Identifiable {
    var id: String { startTime }
    let startTime: String
    /// 0-100.
    let precipitationChance: Double
    /// mm/h.
    let precipitationIntensity: Double
}

struct ForecastNextHourSummary: Codable {
    let condition: String
    let startTime: String
    let endTime: String
}

struct ForecastNextHour: Codable {
    let summary: [ForecastNextHourSummary]
    let minutes: [MinutelyPrecipitation]
}

// MARK: - Confidence

/// Dispersione di una grandezza fra le fonti che hanno risposto.
struct ConsensusSpread: Codable {
    /// Deviazione standard pesata.
    let spread: Double
    let min: Double
    let max: Double
}

/// Quanto le fonti sono d'accordo: 100 = unanimi e numerose, 50 = nessuna
/// informazione utile (poche fonti, oppure dispersione massima).
struct ConfidenceIndex: Codable {
    let score: Int
    /// "high" | "medium" | "low".
    let level: String
    let sourcesCount: Int
    let temperature: ConsensusSpread?
    let precipitationProb: ConsensusSpread?

    enum CodingKeys: String, CodingKey {
        case score
        case level
        case sourcesCount = "sources_count"
        case temperature
        case precipitationProb = "precipitation_prob"
    }
}
