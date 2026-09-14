import XCTest
@testable import smart_meteo

/// Le decisioni del riquadro mare.
///
/// Le soglie devono restare **identiche** a quelle di `backend/utils/sea.ts` e
/// di `frontend-web/lib/sea.ts`: due client che chiamano «mosso» due altezze
/// d'onda diverse sarebbero peggio di un client solo.
final class SeaPanelViewTests: XCTestCase {

    private func sea(
        state: String,
        temp: Double? = 24.6,
        wave: Double? = 0.3,
        direction: Double? = 110,
        swell: Double? = 0.2,
        maxWave: Double? = nil,
        maxWaveAt: String? = nil
    ) -> SeaOutlook {
        SeaOutlook(
            seaTemperature: temp,
            waveHeight: wave,
            waveDirection: direction,
            wavePeriod: 4.2,
            swellHeight: swell,
            state: state,
            maxWave24h: maxWave,
            maxWaveAt: maxWaveAt
        )
    }

    // MARK: - Scala dello stato del mare

    func testSeaStateThresholds() {
        XCTAssertEqual(SeaPanelView.seaState(0.2), "calm")
        // Le soglie sono inclusive: 0,5 è già poco mosso.
        XCTAssertEqual(SeaPanelView.seaState(0.5), "slight")
        XCTAssertEqual(SeaPanelView.seaState(1.24), "slight")
        XCTAssertEqual(SeaPanelView.seaState(1.25), "moderate")
        XCTAssertEqual(SeaPanelView.seaState(2.49), "moderate")
        XCTAssertEqual(SeaPanelView.seaState(2.5), "rough")
    }

    func testSeaStateWithoutData() {
        XCTAssertEqual(SeaPanelView.seaState(nil), "calm")
    }

    // MARK: - Titolo

    func testHeadlinePutsTheWaterFirst() {
        // È la prima domanda di chi va al mare: «si fa il bagno?».
        XCTAssertEqual(SeaPanelView.headline(sea(state: "calm")), "Acqua a 25°, mare calmo")
    }

    func testHeadlineFallsBackToTheStateWithoutWaterTemperature() {
        XCTAssertEqual(SeaPanelView.headline(sea(state: "moderate", temp: nil)), "Mare mosso")
    }

    // MARK: - Avviso di peggioramento

    func testWorseningNoteAppearsWhenThePeakChangesBand() {
        let outlook = sea(state: "calm", wave: 0.3, maxWave: 1.8, maxWaveAt: "2026-09-14T17:00")
        XCTAssertEqual(
            SeaPanelView.worseningNote(outlook),
            "Verso le 17:00 diventa mosso (1,8 m)"
        )
    }

    func testNoWorseningNoteInsideTheSameBand() {
        // Dentro la stessa fascia il numero è già nella riga dell'onda:
        // ripeterlo come avviso sarebbe un falso allarme.
        let outlook = sea(state: "calm", wave: 0.2, maxWave: 0.41, maxWaveAt: "2026-09-14T18:00")
        XCTAssertNil(SeaPanelView.worseningNote(outlook))
    }

    func testWorseningNoteWithoutAnHourStillSaysWhat() {
        let outlook = sea(state: "calm", maxWave: 2.6, maxWaveAt: nil)
        XCTAssertEqual(SeaPanelView.worseningNote(outlook), "In giornata diventa molto mosso (2,6 m)")
    }

    func testNoWorseningNoteWithoutAPeak() {
        XCTAssertNil(SeaPanelView.worseningNote(sea(state: "calm", maxWave: nil)))
    }

    // MARK: - Formattazione

    func testWaveHeightKeepsTheCentimetreBelowOneMetre() {
        // Sotto il metro il centimetro conta, sopra no.
        XCTAssertEqual(SeaPanelView.formatWave(0.32), "0,32 m")
        XCTAssertEqual(SeaPanelView.formatWave(1.8), "1,8 m")
        XCTAssertEqual(SeaPanelView.formatWave(nil), "—")
    }

    func testSeaTemperatureIsAWholeNumber() {
        // Mezzo grado sull'acqua è precisione finta.
        XCTAssertEqual(SeaPanelView.formatSeaTemp(24.6), "25°")
        XCTAssertEqual(SeaPanelView.formatSeaTemp(nil), "—")
    }

    // MARK: - Provenienza dell'onda

    func testWaveDirectionUsesEightPoints() {
        // Otto e non sedici: fra NNE e NE non cambia nulla per chi sceglie una
        // spiaggia, e allunga solo l'etichetta.
        XCTAssertEqual(SeaPanelView.waveDirectionLabel(0), "N")
        XCTAssertEqual(SeaPanelView.waveDirectionLabel(110), "E")
        XCTAssertEqual(SeaPanelView.waveDirectionLabel(180), "S")
        XCTAssertEqual(SeaPanelView.waveDirectionLabel(225), "SO")
        // 350° è nord, non nord-ovest: il giro si chiude.
        XCTAssertEqual(SeaPanelView.waveDirectionLabel(350), "N")
        XCTAssertEqual(SeaPanelView.waveDirectionLabel(360), "N")
    }

    func testWaveDirectionWithoutData() {
        XCTAssertNil(SeaPanelView.waveDirectionLabel(nil))
    }
}
