import XCTest
@testable import smart_meteo

/// Indici lifestyle: le due frasi che l'utente legge davvero.
final class ActivitiesPanelViewTests: XCTestCase {

    private func activity(_ score: Double, limiting: String?) -> ActivityScore {
        ActivityScore(id: "running", label: "Correre", score: score, limiting: limiting)
    }

    func testHeadlineCelebratesAGoodDay() {
        let best = ActivityScore(id: "cycling", label: "Andare in bici", score: 100, limiting: nil)
        XCTAssertEqual(ActivitiesPanelView.headline(best), "andare in bici: condizioni ottime")
    }

    func testHeadlineNamesWhatIsWrongOnAMediocreDay() {
        // «65» non dice niente, «65, limita il vento» dice se rimandare o
        // cambiare percorso.
        XCTAssertEqual(
            ActivitiesPanelView.headline(activity(62, limiting: "temperatura")),
            "Niente di ideale: limita temperatura"
        )
    }

    func testHeadlineWithoutALimitingFactor() {
        // Sopra la soglia niente «limita» davvero: nominare un fattore
        // suggerirebbe un problema che non c'è.
        XCTAssertEqual(ActivitiesPanelView.headline(activity(70, limiting: nil)), "Condizioni nella media")
    }

    func testTheDayIsDeclaredOnlyWhenItIsNotToday() {
        let now = Date()
        XCTAssertNil(ActivitiesPanelView.dayNote(dayKey(offsetDays: 0, from: now), now: now))
        // Di sera la finestra scivola a domani, e il pannello lo dice invece di
        // lasciarlo intuire.
        XCTAssertEqual(ActivitiesPanelView.dayNote(dayKey(offsetDays: 1, from: now), now: now), "domani")
    }

    func testEveryActivityHasAnIcon() {
        for id in ["running", "cycling", "laundry"] {
            XCTAssertNotNil(ActivitiesPanelView.icons[id], "manca l'icona per \(id)")
        }
    }
}

/// Orto: il consiglio e, soprattutto, il suo motivo.
///
/// Un consiglio che non mostra il proprio motivo è un oracolo, e nessuno si fida
/// di un oracolo sul proprio orto.
final class GardenPanelViewTests: XCTestCase {

    private func garden(
        advice: String,
        moisture: Double? = 0.252,
        level: String? = "adequate",
        soilTemp: Double? = 18,
        et0: Double? = 4.8,
        rain: Double? = 0,
        balance: Double? = 4.8,
        sowing: Bool? = true
    ) -> GardenOutlook {
        GardenOutlook(
            soilMoisture: moisture,
            moistureLevel: level,
            soilTemperature: soilTemp,
            evapotranspirationMm: et0,
            rainMm: rain,
            waterBalanceMm: balance,
            advice: advice,
            sowingOk: sowing
        )
    }

    func testRainOutranksEverything() {
        // È il caso che si sbaglia da soli: terreno secco sotto gli occhi, e
        // un temporale fra tre ore che non si vede.
        let outlook = garden(advice: "rain_expected", level: "very_dry", rain: 6, balance: -1.2)
        XCTAssertEqual(
            GardenPanelView.adviceReason(outlook),
            "Attesi 6,0 mm nelle prossime 24 ore"
        )
    }

    func testTheDeficitIsTheReasonWhenTheSoilLosesWater() {
        XCTAssertEqual(
            GardenPanelView.adviceReason(garden(advice: "water_soon", balance: 4.8)),
            "Il terreno perde 4,8 mm più di quanti ne riceve"
        )
    }

    func testASaturatedSoilSaysSo() {
        XCTAssertEqual(
            GardenPanelView.adviceReason(garden(advice: "not_needed", level: "wet", balance: 0)),
            "Il terreno è già saturo"
        )
    }

    func testRainCoveringEvaporationIsAReasonToo() {
        XCTAssertEqual(
            GardenPanelView.adviceReason(garden(advice: "not_needed", balance: -0.5, rain: 3)),
            "La pioggia attesa copre l'evaporazione"
        )
    }

    func testMoistureIsShownAsPercentOfVolume() {
        // «25% vol.» si legge, «0,25 m³/m³» no. E il numero grezzo resta
        // accanto al giudizio perché le soglie dipendono dal tipo di terreno,
        // che l'API non dichiara.
        XCTAssertEqual(GardenPanelView.formatMoisture(0.252), "25% vol.")
        XCTAssertEqual(GardenPanelView.formatMoisture(nil), "—")
    }

    func testSowingSentenceFollowsTheSoilTemperature() {
        XCTAssertEqual(
            GardenPanelView.sowingSentence(garden(advice: "not_needed", soilTemp: 18, sowing: true)),
            "Suolo a 18°: si può seminare"
        )
        XCTAssertEqual(
            GardenPanelView.sowingSentence(garden(advice: "not_needed", soilTemp: 8, sowing: false)),
            "Suolo a 8°: ancora freddo per seminare"
        )
    }

    func testNoSowingSentenceWithoutData() {
        XCTAssertNil(GardenPanelView.sowingSentence(garden(advice: "not_needed", soilTemp: nil)))
    }
}
