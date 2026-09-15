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

/// Quali giorni entrano nella sezione «Prossimi giorni».
///
/// Stessa regressione della finestra oraria, sull'altro array e trovata dallo
/// stesso posto: uno screenshot con «Lun» sopra a «Oggi» di martedì. `daily`
/// può cominciare da **ieri** per la stessa ragione di `hourly` — le fonti
/// ragionano in UTC e il primo cassetto del giorno locale cade il giorno
/// prima — e la riga mostrava una previsione che i fatti hanno già smentito.
final class DailyWindowTests: XCTestCase {

    func testDropsYesterday() throws {
        let days = try makeDaily(days: [
            dayKey(offsetDays: -1),
            dayKey(offsetDays: 0),
            dayKey(offsetDays: 1),
        ])

        let mostrati = DailyRowsView.upcoming(days).map(\.date)

        XCTAssertEqual(mostrati, [dayKey(offsetDays: 0), dayKey(offsetDays: 1)])
        XCTAssertFalse(mostrati.contains(dayKey(offsetDays: -1)))
    }

    /// Il taglio costa due volte.
    ///
    /// Con otto giorni a partire da ieri, il `prefix(7)` senza filtro ne
    /// lasciava sette *contando ieri*: l'ultimo giorno utile spariva in coda
    /// per far posto a uno passato. Due errori in un colpo, e il secondo non
    /// si vede perché quello che manca non si nota.
    func testAFutureDayIsNotEatenToMakeRoomForAPastOne() throws {
        let days = try makeDaily(days: (-1...6).map { dayKey(offsetDays: $0) })

        let mostrati = DailyRowsView.upcoming(days).map(\.date)

        XCTAssertEqual(mostrati.count, 7)
        XCTAssertEqual(mostrati.first, dayKey(offsetDays: 0))
        XCTAssertEqual(mostrati.last, dayKey(offsetDays: 6))
    }

    func testNeverMoreThanSevenRows() throws {
        let days = try makeDaily(days: (0...12).map { dayKey(offsetDays: $0) })

        XCTAssertEqual(DailyRowsView.upcoming(days).count, 7)
    }

    /// Una risposta vecchia in cache copre solo il passato: meglio una sezione
    /// vuota che sette previsioni già smentite.
    func testAnEntirelyPastForecastShowsNothing() throws {
        let days = try makeDaily(days: [dayKey(offsetDays: -3), dayKey(offsetDays: -1)])

        XCTAssertTrue(DailyRowsView.upcoming(days).isEmpty)
    }

    /// L'hero prende il giorno giusto.
    ///
    /// `daily.first` alimentava massimo e minimo dell'intestazione: con un
    /// array che apre da ieri, il blocco di numeri più grande della schermata
    /// mostrava la giornata di ieri. Plausibile, quindi invisibile.
    func testTheHeroTakesTodayNotTheFirstRow() throws {
        let days = try makeDaily(days: [
            dayKey(offsetDays: -1),
            dayKey(offsetDays: 0),
            dayKey(offsetDays: 1),
        ])

        XCTAssertEqual(DailyRowsView.today(days)?.date, dayKey(offsetDays: 0))
    }

    func testTheHeroFallsBackToTomorrowWhenTodayIsMissing() throws {
        let days = try makeDaily(days: [dayKey(offsetDays: -1), dayKey(offsetDays: 2)])

        XCTAssertEqual(DailyRowsView.today(days)?.date, dayKey(offsetDays: 2))
    }

    func testTheHeroShowsNothingRatherThanAPastDay() throws {
        let days = try makeDaily(days: [dayKey(offsetDays: -2), dayKey(offsetDays: -1)])

        XCTAssertNil(DailyRowsView.today(days))
        XCTAssertNil(DailyRowsView.today(nil))
    }

    func testTodayIsLabelledOggi() {
        XCTAssertEqual(DailyRowsView.dayLabel(dayKey(offsetDays: 0)), "Oggi")
        XCTAssertNotEqual(DailyRowsView.dayLabel(dayKey(offsetDays: 1)), "Oggi")
    }
}
