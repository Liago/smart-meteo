import XCTest
@testable import smart_meteo

/// Su quale giorno si apre il dettaglio orario.
///
/// Regressione vera, segnalata da uno screenshot: toccando la goccia accanto a
/// «Prossime 24 ore» il foglio si apriva su **ieri**. L'array `hourly` può
/// cominciare dalla sera prima — le fonti in UTC, riportate nell'ora locale
/// della località, consegnano qualche ora del giorno precedente — e il
/// chiamante passava la data della prima riga.
final class HourlyWindowTests: XCTestCase {

    func testOpensOnTodayEvenWhenTheArrayStartsYesterday() throws {
        let hourly = try makeHourly(days: [
            dayKey(offsetDays: -1),
            dayKey(offsetDays: 0),
            dayKey(offsetDays: 1),
        ])

        XCTAssertEqual(HourlyForecastView.openingDate(for: hourly), dayKey(offsetDays: 0))
    }

    func testNeverOpensOnAPastDay() throws {
        // Caso limite: la previsione copre solo il passato (risposta vecchia in
        // cache sul telefono). Meglio un giorno senza righe che una previsione
        // già smentita dai fatti.
        let hourly = try makeHourly(days: [dayKey(offsetDays: -2), dayKey(offsetDays: -1)])

        let opening = HourlyForecastView.openingDate(for: hourly)
        XCTAssertEqual(opening, dayKey(offsetDays: 0))
        XCTAssertGreaterThanOrEqual(opening, dayKey(offsetDays: 0))
    }

    func testFallsBackToTheFirstFutureDayWhenTodayIsNotCovered() throws {
        let hourly = try makeHourly(days: [
            dayKey(offsetDays: -1),
            dayKey(offsetDays: 2),
            dayKey(offsetDays: 3),
        ])

        XCTAssertEqual(HourlyForecastView.openingDate(for: hourly), dayKey(offsetDays: 2))
    }

    func testWithoutHoursItStillAnswersToday() throws {
        XCTAssertEqual(HourlyForecastView.openingDate(for: []), dayKey(offsetDays: 0))
    }

    /// Le chiavi orarie restano quelle locali della località, non del telefono.
    ///
    /// È l'assunzione su cui si regge tutto il resto: se qualcuno le parsasse
    /// come date, un utente in un altro fuso vedrebbe le ore slittare.
    func testHourlyKeysAreLocalStrings() throws {
        let hourly = try makeHourly(days: ["2026-09-14"])

        XCTAssertEqual(hourly.first?.time, "2026-09-14T00:00")
        XCTAssertEqual(hourly.last?.time, "2026-09-14T23:00")
        // Nessun suffisso di fuso: se comparisse, l'aggregazione del backend è
        // cambiata e i client vanno rivisti.
        XCTAssertFalse(try XCTUnwrap(hourly.first?.time).hasSuffix("Z"))
    }
}
