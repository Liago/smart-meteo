import Foundation
import SwiftUI
// Serve per `ObservableObject`: `@Published` si risolve anche solo con
// SwiftUI, ma la sintesi di `objectWillChange` no, e senza questo import
// il compilatore dice «Type 'UnitPrefs' does not conform to protocol
// 'ObservableObject'» segnalandolo sul punto d'uso invece che qui.
import Combine

/// Le unità di misura scelte dall'utente, e la formattazione che ne consegue.
///
/// ## Perché esiste
///
/// Fino a oggi l'app dichiarava tre unità e non ne offriva nessuna: i selettori
/// erano legati a `.constant(...)`, si muovevano e non cambiavano niente. Li
/// avevo tolti perché un comando finto è peggio di un comando assente; ora
/// funzionano davvero, il che vuol dire che ogni punto dell'app che scrive un
/// grado, un km/h o un millimetro passa da qui.
///
/// ## La regola che tiene insieme tutto
///
/// **Si classifica sul canonico, si mostra sul convertito.** Le soglie
/// dell'app — `WindScale` in km/h, `PrecipIntensity` in mm/h, `tempColor` in
/// °C — restano nella loro unità e non si toccano: 20 mph non è «vento teso»
/// solo perché 20 km/h lo è, e una barra di pioggia colorata sui pollici
/// direbbe «debole» su un temporale. Il backend manda m/s, °C e mm; qui si
/// converte **solo** l'ultimo passo, quello che finisce sullo schermo.
///
/// ## Come si osserva
///
/// `UnitPrefs.shared` è un `ObservableObject`: le schermate che scrivono numeri
/// dichiarano `@ObservedObject private var units = UnitPrefs.shared` e si
/// ridisegnano quando l'utente cambia idea. Le funzioni statiche di
/// formattazione leggono lo stesso singleton senza poterlo osservare — è la
/// ragione per cui l'osservazione sta nella view e non in loro.

// MARK: - Le unità

enum TemperatureUnit: String, CaseIterable, Identifiable {
    case celsius
    case fahrenheit

    var id: String { rawValue }

    /// Nome esteso, per il selettore.
    var label: String {
        switch self {
        case .celsius: return "Gradi Celsius"
        case .fahrenheit: return "Gradi Fahrenheit"
        }
    }

    /// Sigla breve, per le righe strette.
    var short: String {
        switch self {
        case .celsius: return "°C"
        case .fahrenheit: return "°F"
        }
    }

    func convert(fromCelsius celsius: Double) -> Double {
        switch self {
        case .celsius: return celsius
        case .fahrenheit: return celsius * 9 / 5 + 32
        }
    }

    /// Il ritorno al canonico: serve a colorare e a classificare, che restano
    /// definiti in gradi Celsius.
    func toCelsius(_ value: Double) -> Double {
        switch self {
        case .celsius: return value
        case .fahrenheit: return (value - 32) * 5 / 9
        }
    }

    /// Una differenza di temperatura non si converte come una temperatura: lo
    /// zero delle due scale non coincide, quindi la traslazione **non** va
    /// applicata. Serve per le escursioni e per le larghezze di banda.
    func convertDelta(fromCelsius celsius: Double) -> Double {
        switch self {
        case .celsius: return celsius
        case .fahrenheit: return celsius * 9 / 5
        }
    }
}

enum WindUnit: String, CaseIterable, Identifiable {
    case kmh
    case ms
    case mph
    case knots

    var id: String { rawValue }

    var label: String {
        switch self {
        case .kmh: return "Chilometri orari"
        case .ms: return "Metri al secondo"
        case .mph: return "Miglia orarie"
        case .knots: return "Nodi"
        }
    }

    var short: String {
        switch self {
        case .kmh: return "km/h"
        case .ms: return "m/s"
        case .mph: return "mph"
        case .knots: return "kn"
        }
    }

    /// Il backend manda metri al secondo: è il canonico del filo.
    var perMeterPerSecond: Double {
        switch self {
        case .kmh: return 3.6
        case .ms: return 1
        case .mph: return 2.236936
        case .knots: return 1.943844
        }
    }

    func convert(fromMs ms: Double) -> Double { ms * perMeterPerSecond }

    /// I km/h sono il canonico delle **soglie** (`WindScale`), non del filo:
    /// una soglia scritta in km/h va portata nell'unità del grafico, o l'asse
    /// e le sue linee di riferimento finirebbero su scale diverse.
    func convert(fromKmh kmh: Double) -> Double { kmh / 3.6 * perMeterPerSecond }

    func toKmh(_ value: Double) -> Double { value / perMeterPerSecond * 3.6 }
}

enum PrecipitationUnit: String, CaseIterable, Identifiable {
    case millimeters
    case inches

    var id: String { rawValue }

    var label: String {
        switch self {
        case .millimeters: return "Millimetri"
        case .inches: return "Pollici"
        }
    }

    var short: String {
        switch self {
        case .millimeters: return "mm"
        case .inches: return "in"
        }
    }

    func convert(fromMm mm: Double) -> Double {
        switch self {
        case .millimeters: return mm
        case .inches: return mm / 25.4
        }
    }

    func toMm(_ value: Double) -> Double {
        switch self {
        case .millimeters: return value
        case .inches: return value * 25.4
        }
    }

    /// Un pollice di pioggia è un diluvio, un decimo è una giornata piovosa:
    /// con un decimale sole le quantità utili si schiacciano tutte su «0,0».
    var decimals: Int {
        switch self {
        case .millimeters: return 1
        case .inches: return 2
        }
    }
}

/// Anche la neve si misura in lunghezza, ma in centimetri: segue i
/// millimetri di pioggia per non chiedere all'utente due scelte per lo stesso
/// concetto, e in sistema imperiale diventa pollici.
enum SnowUnit {
    case centimeters
    case inches

    var short: String {
        switch self {
        case .centimeters: return "cm"
        case .inches: return "in"
        }
    }

    func convert(fromCm cm: Double) -> Double {
        switch self {
        case .centimeters: return cm
        case .inches: return cm / 2.54
        }
    }
}

// MARK: - Preferenze

/// Le tre scelte, persistite in `UserDefaults` come tutto il resto delle
/// preferenze locali (la potenza dell'impianto, le schede «Per te»): sono un
/// dato dell'utente, non della previsione, e nella richiesta frammenterebbero
/// la cache del backend per utente.
final class UnitPrefs: ObservableObject {
    static let shared = UnitPrefs()

    static let temperatureKey = "smart-meteo-unit-temperature"
    static let windKey = "smart-meteo-unit-wind"
    static let precipitationKey = "smart-meteo-unit-precipitation"

    @Published var temperature: TemperatureUnit {
        didSet { store.set(temperature.rawValue, forKey: Self.temperatureKey) }
    }

    @Published var wind: WindUnit {
        didSet { store.set(wind.rawValue, forKey: Self.windKey) }
    }

    @Published var precipitation: PrecipitationUnit {
        didSet { store.set(precipitation.rawValue, forKey: Self.precipitationKey) }
    }

    /// I pollici valgono per pioggia **e** neve: l'utente sceglie un sistema,
    /// non un'unità per grandezza.
    var snow: SnowUnit {
        precipitation == .inches ? .inches : .centimeters
    }

    private let store: UserDefaults

    /// L'archivio è iniettabile per i test: una suite che scrive in
    /// `UserDefaults.standard` lascia il simulatore configurato come l'ha
    /// lasciato l'ultimo test eseguito.
    init(store: UserDefaults = .standard) {
        self.store = store
        temperature = TemperatureUnit(rawValue: store.string(forKey: Self.temperatureKey) ?? "")
            ?? .celsius
        wind = WindUnit(rawValue: store.string(forKey: Self.windKey) ?? "") ?? .kmh
        precipitation = PrecipitationUnit(rawValue: store.string(forKey: Self.precipitationKey) ?? "")
            ?? .millimeters
    }
}

// MARK: - Formattazione

/// Il punto unico in cui un numero diventa testo con un'unità accanto.
enum Units {

    private static var prefs: UnitPrefs { UnitPrefs.shared }

    // ---------------------------------------------------------- Temperatura

    static var temperatureUnit: TemperatureUnit { prefs.temperature }

    /// Valore numerico convertito, per chi deve disegnarlo invece di scriverlo.
    static func temperature(fromCelsius celsius: Double) -> Double {
        prefs.temperature.convert(fromCelsius: celsius)
    }

    static func celsius(fromTemperature value: Double) -> Double {
        prefs.temperature.toCelsius(value)
    }

    static func temperatureDelta(fromCelsius celsius: Double) -> Double {
        prefs.temperature.convertDelta(fromCelsius: celsius)
    }

    /// «24°» — il simbolo di scala resta implicito, come su Apple Meteo:
    /// l'utente ha scelto l'unità e ripeterla su ogni numero della schermata
    /// ruba spazio senza aggiungere niente.
    static func temp(_ celsius: Double?, decimals: Int = 0) -> String {
        guard let celsius, celsius.isFinite else { return "—" }
        return "\(number(temperature(fromCelsius: celsius), decimals: decimals))°"
    }

    /// «24 °C» — esplicito, per le poche righe in cui la scala è essa stessa
    /// l'informazione (le impostazioni, una legenda).
    static func tempWithUnit(_ celsius: Double?, decimals: Int = 0) -> String {
        guard let celsius, celsius.isFinite else { return "—" }
        return "\(number(temperature(fromCelsius: celsius), decimals: decimals)) \(prefs.temperature.short)"
    }

    // ---------------------------------------------------------------- Vento

    static var windUnit: WindUnit { prefs.wind }
    static var windSymbol: String { prefs.wind.short }

    static func wind(fromMs ms: Double) -> Double { prefs.wind.convert(fromMs: ms) }
    static func wind(fromKmh kmh: Double) -> Double { prefs.wind.convert(fromKmh: kmh) }
    static func kmh(fromWind value: Double) -> Double { prefs.wind.toKmh(value) }

    /// «12 km/h», partendo dai metri al secondo del backend.
    static func windSpeed(fromMs ms: Double?) -> String {
        guard let ms, ms.isFinite else { return "—" }
        return "\(number(wind(fromMs: ms), decimals: 0)) \(prefs.wind.short)"
    }

    /// Solo il numero, per chi l'unità la scrive già per conto suo (una
    /// colonna con l'etichetta sotto, per esempio).
    static func windValue(fromMs ms: Double?) -> String {
        guard let ms, ms.isFinite else { return "—" }
        return number(wind(fromMs: ms), decimals: 0)
    }

    // -------------------------------------------------------- Precipitazioni

    static var precipitationUnit: PrecipitationUnit { prefs.precipitation }
    static var precipitationSymbol: String { prefs.precipitation.short }

    static func precipitation(fromMm mm: Double) -> Double {
        prefs.precipitation.convert(fromMm: mm)
    }

    static func mm(fromPrecipitation value: Double) -> Double {
        prefs.precipitation.toMm(value)
    }

    /// «0,5 mm» oppure «0,02 in».
    static func precip(_ mm: Double?) -> String {
        guard let mm, mm.isFinite else { return "—" }
        let unit = prefs.precipitation
        return "\(number(unit.convert(fromMm: mm), decimals: unit.decimals)) \(unit.short)"
    }

    /// «12 mm/h».
    static func precipRate(_ mmPerHour: Double?) -> String {
        guard let mmPerHour, mmPerHour.isFinite else { return "—" }
        let unit = prefs.precipitation
        return "\(number(unit.convert(fromMm: mmPerHour), decimals: unit.decimals)) \(unit.short)/h"
    }

    // ----------------------------------------------------------------- Neve

    /// «14 cm» oppure «5,5 in». La neve arriva dal backend in centimetri.
    static func snow(fromCm cm: Double?, decimals: Int? = nil) -> String {
        guard let cm, cm.isFinite else { return "—" }
        let unit = prefs.snow
        let digits = decimals ?? (unit == .inches ? 1 : 0)
        return "\(number(unit.convert(fromCm: cm), decimals: digits)) \(unit.short)"
    }

    // ------------------------------------------------------------- Supporto

    /// Virgola decimale, come vuole l'italiano: «0,5 mm», non «0.5 mm».
    static func number(_ value: Double, decimals: Int) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "it_IT")
        formatter.minimumFractionDigits = decimals
        formatter.maximumFractionDigits = decimals
        formatter.roundingMode = .halfUp
        return formatter.string(from: NSNumber(value: value))
            ?? String(format: "%.\(decimals)f", value)
    }
}
