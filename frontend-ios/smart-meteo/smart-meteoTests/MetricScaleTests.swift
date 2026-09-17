import XCTest
@testable import smart_meteo

/// La geometria delle barre del dettaglio orario.
///
/// Nasce da un difetto visibile: sulla metrica «Percepita» le colonne uscivano
/// dal grafico e venivano disegnate sopra le tessere di riepilogo. La causa non
/// era il dominio — che per una temperatura è giusto non parta da zero — ma
/// l'aver dato per scontato che il fondo dell'asse *fosse* zero: `BarMark(x:y:)`
/// ancora la barra a zero, e Swift Charts non ritaglia i segni all'area del
/// grafico, quindi su un asse 16…26 la colonna partiva da 0 °C, cioè da un
/// paio di centinaia di punti sotto il bordo inferiore.
///
/// Le prove stanno sulla funzione pura invece che sul rendering, coerentemente
/// con il resto della suite: quello che si può sbagliare qui è un'aritmetica,
/// e un test di aritmetica non ha bisogno di uno snapshot.
final class MetricScaleTests: XCTestCase {

    /// Il dominio della percepita in una giornata mite, come quella della
    /// segnalazione: 18-24 °C.
    private let mildDay: [Double] = [18, 19, 20, 21, 22, 23, 24, 22, 20, 19]

    /// Le preferenze sono un singleton globale: senza ripristino, il test sui
    /// nodi lascerebbe i nodi a tutte le suite successive.
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

    // MARK: - Il difetto

    /// La condizione che rendeva possibile il difetto: su una giornata mite lo
    /// zero **non è** nel dominio dell'asse. Una barra ancorata a zero comincia
    /// quindi fuori dal grafico, e finisce dove capita.
    func testFeelsLikeDomainDoesNotContainZero() {
        let domain = MetricSection.feelsLike.domain(mildDay)

        XCTAssertFalse(domain.contains(0))
        XCTAssertEqual(domain.lowerBound, 16)
        XCTAssertEqual(domain.upperBound, 26)
    }

    /// La correzione: la barra parte dal fondo dell'asse, mai da zero.
    func testBarStartsAtAxisFloorNotAtZero() {
        let section = MetricSection.feelsLike
        let domain = section.domain(mildDay)

        let bounds = section.barBounds(for: 22, in: domain)

        XCTAssertEqual(bounds.start, domain.lowerBound)
        XCTAssertEqual(bounds.end, 22)
    }

    /// Il fondo dell'asse resta zero dove zero è il fondo naturale: la
    /// correzione non deve cambiare come si disegnano millimetri, vento e UV,
    /// che partivano già da lì.
    func testZeroBasedSectionsAreUnchanged() {
        let sections: [(MetricSection, [Double])] = [
            (.precipitationMm, [0, 1.2, 4.8]),
            (.wind, [5, 18, 44]),
            (.uv, [0, 3, 7]),
            (.humidity, [40, 55, 80]),
            (.storm, [10, 40, 70]),
            (.precipitationProbability, [0, 30, 90]),
            (.thunderProbability, [0, 20, 60])
        ]

        for (section, values) in sections {
            let domain = section.domain(values)
            XCTAssertEqual(domain.lowerBound, 0, "\(section.id): il fondo dell'asse non è più zero")
            XCTAssertEqual(
                section.barBounds(for: values[1], in: domain).start,
                0,
                "\(section.id): la barra non parte più da zero"
            )
        }
    }

    // MARK: - Valori fuori scala

    /// Un dato fuori scala accorcia la barra fino al bordo invece di uscire dal
    /// grafico. È il caso di una fonte che manda un'umidità al 105%: prima
    /// sarebbe finita qualche pixel sopra il riquadro, adesso arriva al bordo.
    func testValueAboveDomainIsClamped() {
        let section = MetricSection.humidity
        let domain = section.domain([40, 105])

        XCTAssertEqual(section.barBounds(for: 105, in: domain).end, 100)
        XCTAssertEqual(section.clamped(105, in: domain), 100)
    }

    /// Sotto il fondo dell'asse la barra è alta zero, non negativa: una barra
    /// con `end` minore di `start` verrebbe disegnata al contrario.
    func testValueBelowDomainCollapsesToZeroHeight() {
        let section = MetricSection.feelsLike
        let domain = section.domain(mildDay)

        let bounds = section.barBounds(for: 4, in: domain)

        XCTAssertEqual(bounds.start, domain.lowerBound)
        XCTAssertEqual(bounds.end, domain.lowerBound)
        XCTAssertGreaterThanOrEqual(bounds.end, bounds.start)
    }

    /// Sui dati veri il limite non deve mai entrare in funzione: il dominio è
    /// costruito **dai** valori del giorno, quindi li contiene tutti. Se questa
    /// prova fallisse, il limite starebbe nascondendo un dominio sbagliato
    /// invece di proteggere da una fonte sciatta.
    func testClampIsInertOnRealValues() {
        let section = MetricSection.feelsLike
        let domain = section.domain(mildDay)

        for value in mildDay {
            XCTAssertEqual(section.barBounds(for: value, in: domain).end, value)
        }
    }

    /// La raffica entra nel dominio insieme al vento (è nelle "compagne
    /// dell'asse"), quindi anche la sua tacca resta dentro il grafico.
    func testGustStaysInsideTheChart() {
        let section = MetricSection.wind
        let speeds: [Double] = [10, 22, 31]
        let gusts: [Double] = [18, 40, 62]
        let domain = section.domain(speeds + gusts)

        for gust in gusts {
            XCTAssertEqual(section.clamped(gust, in: domain), gust)
        }
    }

    // MARK: - Dominio della percepita

    /// Il dominio si adatta al giorno, con due gradi di margine per lato: è il
    /// motivo per cui non parte da zero, e va riaffermato qui perché la
    /// tentazione, davanti a barre che escono, è di "aggiustare" il dominio.
    /// Sarebbe la correzione sbagliata: con un asse da 0 una giornata fra 18 e
    /// 24 gradi diventerebbe una fila di barre quasi identiche.
    func testFeelsLikeDomainFollowsTheDay() {
        let cold = MetricSection.feelsLike.domain([-4.2, -1, 0.5])
        XCTAssertEqual(cold.lowerBound, -7)
        XCTAssertEqual(cold.upperBound, 3)

        let hot = MetricSection.feelsLike.domain([28.4, 33.1])
        XCTAssertEqual(hot.lowerBound, 26)
        XCTAssertEqual(hot.upperBound, 36)
    }

    /// Nessun valore (giorno senza dato) non deve produrre un dominio
    /// degenere: `0...1` è arbitrario ma disegnabile, e comunque la view mostra
    /// `emptyMessage` invece del grafico.
    func testFeelsLikeDomainWithNoValues() {
        let domain = MetricSection.feelsLike.domain([])
        XCTAssertLessThan(domain.lowerBound, domain.upperBound)
    }

    /// Il minimo garantito dell'asse segue l'unità di lettura **al disegno**.
    ///
    /// Le sezioni sono `static let`: calcolato una volta sola, quel minimo
    /// sarebbe rimasto nell'unità in vigore al primo accesso, e chi fosse
    /// passato ai nodi avrebbe trovato un asse alto 50 nodi con le barre
    /// schiacciate in fondo e le etichette di fascia — che si convertono a ogni
    /// chiamata — alla quota sbagliata.
    func testZeroBasedFloorFollowsTheUnit() {
        let section = MetricSection.wind
        let calm: [Double] = [3, 5, 8]

        UnitPrefs.shared.wind = .kmh
        XCTAssertEqual(section.domain(calm).upperBound, 50, accuracy: 0.001)

        UnitPrefs.shared.wind = .knots
        XCTAssertEqual(
            section.domain(calm).upperBound,
            WindUnit.knots.convert(fromKmh: 50),
            accuracy: 0.001
        )
    }
}
