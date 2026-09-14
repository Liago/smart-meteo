import XCTest
@testable import smart_meteo

/// Le decisioni del riquadro fotovoltaico.
///
/// La più importante non si vede qui ma si vede *da* qui: il backend dà la resa
/// **specifica** (kWh per kWp) e la moltiplicazione per la potenza
/// dell'impianto avviene solo sul telefono. Se la potenza entrasse nella
/// richiesta, la cache della previsione si frammenterebbe per utente invece di
/// servire tutti quelli sulla stessa località.
final class SolarPanelViewTests: XCTestCase {

    private func day(_ date: String, yield: Double, sun: Double? = 11) -> SolarDay {
        SolarDay(date: date, kwhPerKwp: yield, sunshineHours: sun, peakW: 890)
    }

    private func outlook(plane: String = "tilted", days: [SolarDay]) -> SolarOutlook {
        SolarOutlook(plane: plane, tiltDeg: 30, azimuthDeg: 0, performanceRatio: 0.75, days: days)
    }

    // MARK: - Potenza dell'impianto

    func testPlantSizeAcceptsTheItalianComma() {
        XCTAssertEqual(SolarPanelView.parsePlantKwp("4,5"), 4.5)
        XCTAssertEqual(SolarPanelView.parsePlantKwp("4.5"), 4.5)
    }

    func testPlantSizeRejectsWhatIsNotAPlant() {
        XCTAssertNil(SolarPanelView.parsePlantKwp(""))
        XCTAssertNil(SolarPanelView.parsePlantKwp("zero"))
        XCTAssertNil(SolarPanelView.parsePlantKwp("0"))
        XCTAssertNil(SolarPanelView.parsePlantKwp("-3"))
        // Oltre i 100 kWp non è più un impianto domestico: più probabile un
        // errore di battitura che una centrale sul tetto.
        XCTAssertNil(SolarPanelView.parsePlantKwp("200"))
        XCTAssertEqual(SolarPanelView.parsePlantKwp("100"), 100)
    }

    // MARK: - Dalla resa specifica ai kWh

    func testEnergyMultipliesBySize() throws {
        let energy = SolarPanelView.dayEnergyKwh(day("2026-09-14", yield: 5.2), kwp: 3)
        XCTAssertEqual(try XCTUnwrap(energy), 15.6, accuracy: 0.001)
    }

    func testWithoutASizeThereAreNoKwh() {
        // E non è un ripiego: la resa specifica è il numero fisicamente
        // corretto, quello che il pannello mostra al suo posto.
        XCTAssertNil(SolarPanelView.dayEnergyKwh(day("2026-09-14", yield: 5.2), kwp: nil))
        XCTAssertNil(SolarPanelView.dayEnergyKwh(day("2026-09-14", yield: 5.2), kwp: 0))
    }

    func testFormatting() {
        XCTAssertEqual(SolarPanelView.formatKwh(15.6), "15,6 kWh")
        XCTAssertEqual(SolarPanelView.formatKwh(nil), "—")
        XCTAssertEqual(SolarPanelView.formatSpecificYield(5.2), "5,20 kWh/kWp")
        XCTAssertEqual(SolarPanelView.formatKwp(3), "3 kWp")
        XCTAssertEqual(SolarPanelView.formatKwp(4.5), "4,5 kWp")
    }

    // MARK: - Etichette dei giorni

    func testDayLabelNamesTodayAndTomorrow() {
        let now = Date()
        XCTAssertEqual(SolarPanelView.dayLabel(dayKey(offsetDays: 0, from: now), now: now), "Oggi")
        XCTAssertEqual(SolarPanelView.dayLabel(dayKey(offsetDays: 1, from: now), now: now), "Domani")
    }

    func testDayLabelFallsBackToTheWeekday() {
        let now = Date()
        let label = SolarPanelView.dayLabel(dayKey(offsetDays: 3, from: now), now: now)
        XCTAssertFalse(label.isEmpty)
        XCTAssertNotEqual(label, "Oggi")
        XCTAssertNotEqual(label, "Domani")
        // Non deve restare la data grezza.
        XCTAssertFalse(label.contains("-"))
    }

    // MARK: - Assunzioni dichiarate

    func testAssumptionsAreSpelledOut() {
        // Senza, il numero non è verificabile: chi ha un impianto sa la propria
        // inclinazione e ha diritto di sapere quale abbiamo supposto noi.
        XCTAssertEqual(
            SolarPanelView.assumptionsNote(outlook(days: [day("2026-09-14", yield: 5.2)])),
            "Stima su pannelli a 30° esposti a sud, con 25% di perdite di impianto."
        )
    }

    func testAssumptionsDeclareTheHorizontalFallback() {
        // Il piano usato viaggia fino all'utente perché cambia il numero:
        // d'inverno un impianto inclinato produce parecchio più di una stima
        // sul piano orizzontale.
        XCTAssertEqual(
            SolarPanelView.assumptionsNote(
                outlook(plane: "horizontal", days: [day("2026-09-14", yield: 3.1)])
            ),
            "Stima su piano orizzontale, con 25% di perdite di impianto."
        )
    }
}
