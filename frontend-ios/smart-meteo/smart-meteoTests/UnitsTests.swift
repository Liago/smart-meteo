import XCTest
@testable import smart_meteo

/// Le conversioni e la formattazione delle unità scelte dall'utente.
///
/// La suite che conta più di tutte è la terza: **le soglie non si convertono**.
/// È l'errore che questo sistema rende facile — convertire tutto ciò che
/// assomiglia a una misura — e che non si vede provando l'app in Celsius.
final class UnitsTests: XCTestCase {

    /// Le preferenze sono un singleton globale: senza ripristino, un test che
    /// passa ai Fahrenheit lascia i Fahrenheit a tutte le suite successive, e
    /// il fallimento compare in un file che non c'entra.
    private var originale: (TemperatureUnit, WindUnit, PrecipitationUnit)!

    override func setUp() {
        super.setUp()
        let prefs = UnitPrefs.shared
        originale = (prefs.temperature, prefs.wind, prefs.precipitation)
    }

    override func tearDown() {
        let prefs = UnitPrefs.shared
        prefs.temperature = originale.0
        prefs.wind = originale.1
        prefs.precipitation = originale.2
        super.tearDown()
    }

    // MARK: - Conversioni

    func testTemperatureConversion() {
        XCTAssertEqual(TemperatureUnit.fahrenheit.convert(fromCelsius: 0), 32, accuracy: 0.001)
        XCTAssertEqual(TemperatureUnit.fahrenheit.convert(fromCelsius: 100), 212, accuracy: 0.001)
        XCTAssertEqual(TemperatureUnit.fahrenheit.convert(fromCelsius: -40), -40, accuracy: 0.001)
        XCTAssertEqual(TemperatureUnit.celsius.convert(fromCelsius: 21.5), 21.5, accuracy: 0.001)
    }

    /// Una **differenza** di temperatura non porta con sé la traslazione.
    ///
    /// Dieci gradi Celsius di escursione sono diciotto Fahrenheit, non
    /// cinquanta: applicare il +32 a un intervallo è l'errore classico, e su
    /// una banda di incertezza sposterebbe il grafico invece di allargarlo.
    func testTemperatureDeltaDoesNotShift() {
        XCTAssertEqual(TemperatureUnit.fahrenheit.convertDelta(fromCelsius: 10), 18, accuracy: 0.001)
        XCTAssertEqual(TemperatureUnit.fahrenheit.convertDelta(fromCelsius: 0), 0, accuracy: 0.001)
    }

    func testTemperatureRoundTrip() {
        for unit in TemperatureUnit.allCases {
            let andata = unit.convert(fromCelsius: 18.3)
            XCTAssertEqual(unit.toCelsius(andata), 18.3, accuracy: 0.0001, unit.rawValue)
        }
    }

    func testWindConversion() {
        XCTAssertEqual(WindUnit.kmh.convert(fromMs: 10), 36, accuracy: 0.001)
        XCTAssertEqual(WindUnit.ms.convert(fromMs: 10), 10, accuracy: 0.001)
        XCTAssertEqual(WindUnit.mph.convert(fromMs: 10), 22.369, accuracy: 0.01)
        XCTAssertEqual(WindUnit.knots.convert(fromMs: 10), 19.438, accuracy: 0.01)
    }

    /// Le soglie dell'app sono in km/h, il filo è in m/s: due sorgenti diverse
    /// che devono atterrare sulla stessa scala.
    func testWindFromKmhAndFromMsAgree() {
        for unit in WindUnit.allCases {
            let daMs = unit.convert(fromMs: 10)       // 36 km/h
            let daKmh = unit.convert(fromKmh: 36)
            XCTAssertEqual(daMs, daKmh, accuracy: 0.0001, unit.rawValue)
            XCTAssertEqual(unit.toKmh(daMs), 36, accuracy: 0.0001, unit.rawValue)
        }
    }

    func testPrecipitationConversion() {
        XCTAssertEqual(PrecipitationUnit.inches.convert(fromMm: 25.4), 1, accuracy: 0.0001)
        XCTAssertEqual(PrecipitationUnit.millimeters.convert(fromMm: 7.6), 7.6, accuracy: 0.0001)
        XCTAssertEqual(PrecipitationUnit.inches.toMm(1), 25.4, accuracy: 0.0001)
    }

    // MARK: - Formattazione

    func testFormattingFollowsThePreference() {
        let prefs = UnitPrefs.shared

        prefs.temperature = .celsius
        XCTAssertEqual(Units.temp(21.4), "21°")

        prefs.temperature = .fahrenheit
        XCTAssertEqual(Units.temp(0), "32°")
        XCTAssertEqual(Units.tempWithUnit(0), "32 °F")

        prefs.wind = .kmh
        XCTAssertEqual(Units.windSpeed(fromMs: 10), "36 km/h")
        prefs.wind = .knots
        XCTAssertEqual(Units.windSpeed(fromMs: 10), "19 kn")

        prefs.precipitation = .millimeters
        XCTAssertEqual(Units.precip(2.5), "2,5 mm")
        prefs.precipitation = .inches
        // Due decimali sui pollici: con uno solo un rovescio da 2,5 mm
        // uscirebbe «0,1 in» e una pioggerella da 0,4 mm «0,0 in».
        XCTAssertEqual(Units.precip(2.5), "0,10 in")
        XCTAssertEqual(Units.precip(0.4), "0,02 in")
    }

    /// La virgola decimale, non il punto: il resto dell'app scrive in italiano.
    func testItalianDecimalSeparator() {
        XCTAssertEqual(Units.number(0.5, decimals: 1), "0,5")
    }

    func testNilIsADashNotAZero() {
        XCTAssertEqual(Units.temp(nil), "—")
        XCTAssertEqual(Units.windSpeed(fromMs: nil), "—")
        XCTAssertEqual(Units.precip(nil), "—")
        XCTAssertEqual(Units.snow(fromCm: nil), "—")
    }

    // MARK: - Le soglie NON si convertono

    /// 0,3 pollici sono un temporale; 0,3 mm sono una pioggerella.
    ///
    /// Se la classificazione seguisse l'unità di lettura, le due finirebbero
    /// nella stessa fascia — e la barra di un temporale verrebbe colorata come
    /// quella di una giornata appena umida.
    func testPrecipitationBandsStayInMillimetres() {
        UnitPrefs.shared.precipitation = .inches

        XCTAssertEqual(PrecipIntensity.classify(8), .heavy)
        XCTAssertEqual(PrecipIntensity.classify(0.3), .light)
        XCTAssertEqual(PrecipIntensity.classify(0.05), PrecipIntensity.none)
    }

    /// Stessa cosa sul vento: 20 nodi sono 37 km/h, cioè «teso», non «debole».
    func testWindBandsStayInKmh() {
        UnitPrefs.shared.wind = .knots

        XCTAssertEqual(WindScale.classify(20), .moderate)
        XCTAssertEqual(WindScale.classify(45), .strong)
    }

    /// E sui colori della temperatura, che sono definiti in gradi Celsius.
    func testTemperatureColoursStayInCelsius() {
        UnitPrefs.shared.temperature = .fahrenheit

        // 86 °F sono 30 °C: caldo. Letti come Celsius sarebbero fuori scala,
        // ma la conversione di ritorno li riporta dove devono stare.
        XCTAssertEqual(Units.celsius(fromTemperature: 86), 30, accuracy: 0.001)
        XCTAssertEqual(Units.celsius(fromTemperature: 32), 0, accuracy: 0.001)
    }

    // MARK: - Neve

    /// La neve segue la scelta fatta sulle precipitazioni: è un sistema di
    /// misura, non un'unità per grandezza.
    func testSnowFollowsThePrecipitationChoice() {
        let prefs = UnitPrefs.shared

        prefs.precipitation = .millimeters
        XCTAssertEqual(prefs.snow.short, "cm")
        XCTAssertEqual(Units.snow(fromCm: 14), "14 cm")

        prefs.precipitation = .inches
        XCTAssertEqual(prefs.snow.short, "in")
        XCTAssertEqual(Units.snow(fromCm: 2.54), "1,0 in")
    }

    // MARK: - Persistenza

    func testPreferencesSurviveARestart() throws {
        let suite = "smart-meteo-units-test-\(UUID().uuidString)"
        let store = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { store.removePersistentDomain(forName: suite) }

        let prima = UnitPrefs(store: store)
        prima.temperature = .fahrenheit
        prima.wind = .mph
        prima.precipitation = .inches

        let dopo = UnitPrefs(store: store)
        XCTAssertEqual(dopo.temperature, .fahrenheit)
        XCTAssertEqual(dopo.wind, .mph)
        XCTAssertEqual(dopo.precipitation, .inches)
    }

    /// Un valore salvato che non esiste più non deve lasciare l'app senza unità.
    func testAnUnknownStoredValueFallsBackToTheDefault() throws {
        let suite = "smart-meteo-units-test-\(UUID().uuidString)"
        let store = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { store.removePersistentDomain(forName: suite) }

        store.set("reaumur", forKey: UnitPrefs.temperatureKey)

        XCTAssertEqual(UnitPrefs(store: store).temperature, .celsius)
    }
}
