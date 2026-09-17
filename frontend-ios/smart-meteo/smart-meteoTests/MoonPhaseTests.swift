import XCTest
@testable import smart_meteo

/// La fase lunare e la scheda «Luna».
///
/// Le date sono fisse di proposito: la luna di una notte precisa è un fatto
/// astronomico, non «oggi». La luna piena del 1º ottobre 2020 e quella nuova
/// del 14 dicembre 2020 (eclissi totale) sono controllabili su qualunque
/// almanacco, e se l'algoritmo — lo stesso di `utils/moon.ts` — le sbaglia,
/// le sbaglia anche il backend.
final class MoonPhaseTests: XCTestCase {

    private var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    private func date(_ y: Int, _ m: Int, _ d: Int, hour: Int = 12) -> Date {
        utc.date(from: DateComponents(year: y, month: m, day: d, hour: hour))!
    }

    // MARK: - Dal calendario

    func testFullMoonOnAKnownNight() {
        XCTAssertEqual(MoonPhase.computed(on: date(2020, 10, 1), calendar: utc), .full)
        XCTAssertEqual(MoonPhase.daysToFull(age: MoonPhase.age(on: date(2020, 10, 1), calendar: utc)), 0)
    }

    func testNewMoonOnAKnownNight() {
        XCTAssertEqual(MoonPhase.computed(on: date(2020, 12, 14), calendar: utc), .new)
    }

    func testIlluminationFollowsTheAge() {
        XCTAssertEqual(MoonPhase.illumination(age: 0), 0)
        XCTAssertEqual(MoonPhase.illumination(age: MoonPhase.synodicMonth / 2), 100)
        // Primo quarto: mezza luna, e il valore deve stare intorno a 50 senza
        // che la prova dipenda dall'arrotondamento.
        let quarto = MoonPhase.illumination(age: MoonPhase.synodicMonth / 4)
        XCTAssert((48...52).contains(quarto), "primo quarto illuminato al \(quarto)%")
    }

    func testDaysToFullAgreesWithThePhase() {
        // Finché la fase dice «piena» i giorni dicono zero: il vecchio codice
        // contava dall'istante esatto e la notte dopo la piena scriveva
        // «fra 30 giorni» sotto a «Luna Piena».
        XCTAssertEqual(MoonPhase.daysToFull(age: 16), 0)
        XCTAssertEqual(MoonPhase.computed(on: date(2020, 10, 3), calendar: utc), .waningGibbous)
        XCTAssertEqual(MoonPhase.daysToFull(age: 17), 27)
        XCTAssertEqual(MoonPhase.daysToFull(age: 8), 7)
    }

    // MARK: - Dal nome del backend

    func testParsesTheItalianNamesOfTheBackend() {
        XCTAssertEqual(MoonPhase.parse("Gibbosa Crescente"), .waxingGibbous)
        XCTAssertEqual(MoonPhase.parse("Luna Piena"), .full)
        XCTAssertEqual(MoonPhase.parse("ultimo quarto"), .lastQuarter)
    }

    func testParsesTheEnglishNamesOfTheProviders() {
        // Il motore preferisce la fonte con sorgere e tramonto, che scrive la
        // fase in inglese: senza questo, proprio la risposta più completa
        // arriverebbe con la fase «sconosciuta».
        XCTAssertEqual(MoonPhase.parse("Waxing Gibbous"), .waxingGibbous)
        XCTAssertEqual(MoonPhase.parse("Full Moon"), .full)
        XCTAssertEqual(MoonPhase.parse("Third Quarter"), .lastQuarter)
    }

    func testUnknownNameFallsBackToTheCalendar() {
        XCTAssertNil(MoonPhase.parse("unknown"))
        XCTAssertNil(MoonPhase.parse(nil))
        XCTAssertEqual(MoonPhase.resolve("unknown", on: date(2020, 10, 1)), .full)
    }

    // MARK: - La scheda

    func testCardReadsTheBackendFirst() throws {
        let astronomy = try Fixture.decode(AstronomyData.self, from: """
        {"sunrise":"2026-09-14T06:52","sunset":"2026-09-14T19:23",
         "moon_phase":"Gibbosa Crescente","moonrise":"2026-09-14T21:12:00",
         "moonset":"2026-09-15T09:04:00","moon_illumination":35}
        """)
        let card = ForYouBuilder.moonCard(astronomy, now: date(2020, 10, 1))

        XCTAssertEqual(card.key, .moon)
        // La fase dichiarata vince su quella calcolata (che per quella data
        // sarebbe piena): il backend ha più fonti del client.
        XCTAssertEqual(card.headline, "Gibbosa crescente")
        XCTAssertEqual(card.rows.map(\.label), ["Illuminazione", "Sorge", "Tramonta", "Luna piena"])
        XCTAssertEqual(card.rows[0].value, "35%")
        XCTAssertEqual(card.rows[1].value, "21:12")
        XCTAssertEqual(card.rows[2].value, "09:04")
    }

    func testCardExistsEvenWithoutAstronomy() {
        // La luna non è mai «niente da dire»: senza il blocco si calcola.
        let card = ForYouBuilder.moonCard(nil, now: date(2020, 10, 1))
        XCTAssertEqual(card.headline, "Luna piena")
        XCTAssertEqual(card.detail, "Illuminata al 100% · piena stanotte")
        XCTAssertEqual(card.rows.map(\.label), ["Illuminazione", "Luna piena"])
        XCTAssertEqual(card.rows.last?.value, "Stanotte")
    }

    func testDetailCountsTheDaysToTheFullMoon() {
        XCTAssertEqual(ForYouBuilder.moonDetail(illumination: 35, daysToFull: 6), "Illuminata al 35% · piena fra 6 giorni")
        XCTAssertEqual(ForYouBuilder.moonDetail(illumination: 97, daysToFull: 1), "Illuminata al 97% · piena domani")
    }

    // MARK: - Preferenze

    func testANewDefaultCardTurnsOnForWhoeverHasNotSeenIt() {
        // Un utente che aveva salvato le sue scelte prima che esistesse «Luna»
        // la trova accesa: la lista salvata non la nomina, ma non l'ha mai
        // spenta nessuno.
        let salvate = "snow,garden,sky"
        XCTAssertTrue(ForYouPrefs.enabled(salvate, known: "").contains(.moon))
        XCTAssertFalse(ForYouPrefs.enabled(salvate, known: "").contains(.sea), "il mare è spento di default")
    }

    func testACardLeftOffInSettingsStaysOff() {
        let salvate = "snow,garden,sky"
        let viste = ForYouPrefs.raw(ForYouKey.allCases)
        XCTAssertFalse(ForYouPrefs.enabled(salvate, known: viste).contains(.moon))
    }
}
