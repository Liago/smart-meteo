import XCTest
@testable import smart_meteo

/// Le decisioni del riquadro cielo.
///
/// Quella che vale la pena fissare è **quale dei due indici va in cima**: il
/// pannello ha una riga sola di titolo, e dire «tramonto ordinario» quando è la
/// notte a essere eccezionale sprecherebbe l'unica riga che qualcuno legge.
final class SkyPanelViewTests: XCTestCase {

    private func event(_ level: String, at: String = "2026-09-14T20:00") -> SkyEvent {
        SkyEvent(at: at, score: 50, level: level)
    }

    private func night(_ level: String, cloud: Double = 30, moon: Double? = 60) -> StargazingOutlook {
        StargazingOutlook(score: 50, level: level, cloudCover: cloud, moonIllumination: moon)
    }

    // MARK: - Titolo

    func testHeadlineGoesToTheSunsetWhenItIsTheRemarkableOne() {
        let sky = SkyOutlook(sunset: event("excellent"), sunrise: nil, stargazing: night("plain"))
        XCTAssertEqual(SkyPanelView.headline(sky), "Tramonto spettacolare verso le 20:00")
    }

    func testHeadlineYieldsToTheNightWhenTheNightIsTheRemarkableOne() {
        // Senza questa regola una notte ottima sotto un tramonto ordinario
        // resterebbe invisibile — ed è proprio il caso che fa aprire il pannello.
        let sky = SkyOutlook(sunset: event("plain"), sunrise: nil, stargazing: night("excellent"))
        XCTAssertEqual(SkyPanelView.headline(sky), "Notte ottima per le stelle")
    }

    func testOnATieTheSolarEventKeepsTheTitle() {
        // A parità vince il tramonto: è imminente, la notte viene dopo.
        let sky = SkyOutlook(sunset: event("good"), sunrise: nil, stargazing: night("good"))
        XCTAssertEqual(SkyPanelView.headline(sky), "Tramonto bello verso le 20:00")
    }

    func testHeadlineWithoutAnyIndex() {
        let sky = SkyOutlook(sunset: nil, sunrise: nil, stargazing: nil)
        XCTAssertEqual(SkyPanelView.headline(sky), "Nessuna previsione sul cielo")
    }

    // MARK: - Quale evento solare

    func testTheEarlierSolarEventWins() {
        // Quello che l'utente vedrà per primo, non quello dichiarato per primo.
        let sky = SkyOutlook(
            sunset: event("good", at: "2026-09-14T20:00"),
            sunrise: event("excellent", at: "2026-09-15T06:50"),
            stargazing: nil
        )
        let solar = SkyPanelView.nextSolarEvent(sky)
        XCTAssertEqual(solar?.isSunset, true)
    }

    func testTheSunriseIsUsedWhenItComesFirst() {
        let sky = SkyOutlook(
            sunset: event("good", at: "2026-09-15T20:00"),
            sunrise: event("good", at: "2026-09-14T06:50"),
            stargazing: nil
        )
        let solar = SkyPanelView.nextSolarEvent(sky)
        XCTAssertEqual(solar?.isSunset, false)
        XCTAssertEqual(SkyPanelView.headline(sky), "Alba bella verso le 06:50")
    }

    // MARK: - Gli ingredienti della notte

    func testStargazingReasonNamesCloudsAndMoon() {
        // Senza i due ingredienti in chiaro il giudizio sarebbe un verdetto
        // senza appello.
        XCTAssertEqual(
            SkyPanelView.stargazingReason(night("fair", cloud: 30, moon: 60)),
            "30% di nuvole, luna al 60%"
        )
    }

    func testStargazingReasonUsesWordsAtTheExtremes() {
        XCTAssertEqual(
            SkyPanelView.stargazingReason(night("excellent", cloud: 5, moon: 4)),
            "cielo terso, luna quasi nuova"
        )
        XCTAssertEqual(
            SkyPanelView.stargazingReason(night("plain", cloud: 90, moon: 95)),
            "cielo coperto, luna piena"
        )
    }

    func testStargazingReasonWithoutMoonData() {
        XCTAssertEqual(
            SkyPanelView.stargazingReason(night("fair", cloud: 40, moon: nil)),
            "40% di nuvole"
        )
    }

    // MARK: - Ora

    func testFormatHourReadsTheLocalKey() {
        // Si legge dai caratteri, non con un parser ISO: il backend manda già
        // l'ora locale della località, e parsarla come data la sposterebbe nel
        // fuso del dispositivo.
        XCTAssertEqual(SkyPanelView.formatHour("2026-09-14T20:15"), "20:15")
        XCTAssertNil(SkyPanelView.formatHour("2026-09-14"))
        XCTAssertNil(SkyPanelView.formatHour(nil))
    }
}
