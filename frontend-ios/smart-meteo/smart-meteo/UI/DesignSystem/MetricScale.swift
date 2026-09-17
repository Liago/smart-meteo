import SwiftUI

/// Registry delle metriche orarie mostrabili nel dettaglio.
///
/// Gemello di `lib/metrics.ts` sul web: `HourlyDetailView` è agnostica rispetto
/// alla metrica e legge da qui come estrarre il valore da un'ora, come colorarlo,
/// che dominio dare all'asse e cosa scrivere nell'intestazione. Aggiungere una
/// metrica significa aggiungere un caso, non toccare la view.
enum HourlyMetric: String, CaseIterable, Identifiable {
    case temperature
    case precipitation
    case storm
    case wind
    case humidity
    case feelsLike
    case uv

    var id: String { rawValue }

    var label: String {
        switch self {
        case .temperature: return "Temperatura"
        case .precipitation: return "Precipitazioni"
        case .storm: return "Temporali"
        case .wind: return "Vento"
        case .humidity: return "Umidità"
        case .feelsLike: return "Percepita"
        case .uv: return "Indice UV"
        }
    }

    var systemImage: String {
        switch self {
        case .temperature: return "thermometer"
        case .precipitation: return "drop.fill"
        case .storm: return "cloud.bolt.fill"
        case .wind: return "wind"
        case .humidity: return "humidity.fill"
        case .feelsLike: return "thermometer.medium"
        case .uv: return "sun.max.fill"
        }
    }

    var sections: [MetricSection] {
        switch self {
        case .temperature: return [.temperature]
        case .precipitation: return [.precipitationMm, .precipitationProbability]
        // Due sezioni come per le precipitazioni: gli indici convettivi dicono
        // quanta energia c'è, la probabilità di tuono quanto è probabile che si
        // scarichi. Due domande diverse, da fonti diverse.
        case .storm: return [.storm, .thunderProbability]
        case .wind: return [.wind]
        case .humidity: return [.humidity]
        case .feelsLike: return [.feelsLike]
        case .uv: return [.uv]
        }
    }
}

/// Descrizione di un singolo grafico all'interno di una metrica.
struct MetricSection: Identifiable {
    let id: String
    let height: CGFloat
    /// Valore della barra, già nell'unità di visualizzazione.
    let valueOf: (HourlyForecast) -> Double?
    /// Valore secondario (raffica), disegnato come tacca sopra la barra.
    let secondaryOf: ((HourlyForecast) -> Double?)?
    let colorOf: (Double) -> Color
    /// Dominio dell'asse Y, dai valori del giorno (principali e secondari insieme,
    /// così una raffica alta non finisce fuori dal grafico).
    let domain: ([Double]) -> ClosedRange<Double>
    /// Valori a cui disegnare una linea di riferimento.
    let gridValues: (ClosedRange<Double>) -> [Double]
    /// Etichetta della linea, `nil` per una linea muta.
    let gridLabel: (Double) -> String?
    /// Punti in cui scrivere l'etichetta di fascia (il centro della fascia stessa).
    let bandValues: (ClosedRange<Double>) -> [Double]
    let bandLabel: (Double) -> String
    /// Valore grande dell'intestazione. `nil` = ora non coperta da nessuna fonte.
    let headline: (HourlyForecast?) -> String
    let caption: (HourlyForecast?) -> String
    /// Mostrato al posto del grafico quando nessuna ora del giorno ha il dato.
    let emptyMessage: String
    /// Sovrapposto al grafico quando tutti i valori del giorno sono a zero.
    let flatMessage: String?

    /// Come disegnare la serie.
    ///
    /// Le barre vanno bene per le quantità che partono da zero — millimetri,
    /// vento, UV. La temperatura no: è un andamento continuo, e una colonna
    /// per ora suggerisce che fra le 14 e le 15 non esista nulla. In coda alla
    /// struct, con un default, così i costruttori già scritti restano validi.
    var kind: MetricChartKind = .bars

    /// Estremi della banda d'incertezza, quando la metrica ne ha una.
    var bandLowOf: ((HourlyForecast) -> Double?)? = nil
    var bandHighOf: ((HourlyForecast) -> Double?)? = nil
}

enum MetricChartKind {
    case bars
    case lineWithBand
}

/// Dominio che parte da zero e lascia un margine sopra al valore massimo.
///
/// Il minimo garantito dell'asse si valuta **a ogni disegno**, non una volta
/// sola: le sezioni sono `static let`, quindi inizializzate una volta per
/// processo, e un minimo calcolato lì dentro resterebbe congelato nell'unità in
/// vigore al primo accesso. Chi fosse passato ai nodi dopo aver aperto il
/// dettaglio si sarebbe ritrovato un asse alto 50 **nodi** — le soglie sono in
/// km/h — con le barre schiacciate in fondo e le etichette di fascia, che
/// invece si convertono a ogni chiamata, alla quota sbagliata.
private func domainFromZero(_ floor: @autoclosure @escaping () -> Double) -> ([Double]) -> ClosedRange<Double> {
    { values in 0...max(floor(), (values.max() ?? 0) * 1.15) }
}

/// Passo delle linee dell'asse termico, nell'unità corrente.
private var tempTickStep: Double {
    Units.temperatureUnit == .fahrenheit ? 10 : 5
}

/// Multipli di `step` interni al dominio, per gli assi senza soglie naturali.
private func niceTicks(_ domain: ClosedRange<Double>, step: Double) -> [Double] {
    var out: [Double] = []
    var v = (domain.lowerBound / step).rounded(.up) * step
    while v <= domain.upperBound {
        out.append(v)
        v += step
    }
    return out
}

/// Etichetta leggibile della condizione di un'ora.
///
/// Riusa la tabella di `WeatherDescriptionEngine` con lo stesso fallback che usa
/// lei: le fonti non-WMO mandano stringhe normalizzate ("rain", "clear") invece
/// di un codice numerico.
private func conditionLabel(_ h: HourlyForecast) -> String {
    let code = Int(h.conditionCode) ?? WeatherDescriptionEngine.normalizedToWMO(h.conditionCode)
    let noun = WeatherDescriptionEngine.conditionLabel(for: code)
    return noun.prefix(1).uppercased() + noun.dropFirst()
}

// MARK: - Geometria delle barre

extension MetricSection {

    /// Estremi verticali della barra di un valore, **dentro il dominio dell'asse**.
    ///
    /// `BarMark(x:y:)` ancora la colonna a **zero**, non al fondo dell'asse, e
    /// Swift Charts non ritaglia i segni all'area del grafico. Sulla percepita —
    /// l'unica metrica a barre il cui dominio non parte da zero, perché una
    /// giornata fra 18 e 24 gradi su un asse che parte da 0 sarebbe una fila di
    /// barre tutte uguali — le colonne partivano quindi da 0 °C, cioè da un paio
    /// di centinaia di punti sotto il bordo inferiore, e venivano disegnate sopra
    /// le tessere di riepilogo e la nota in fondo alla scheda. Il difetto non è
    /// nel dominio: è nell'aver dato per scontato che il fondo dell'asse fosse
    /// zero. Il web non lo ha mai avuto perché il suo SVG disegna da `baselineY`,
    /// cioè dal fondo del dominio, e la baseline lì è sempre stata esplicita.
    ///
    /// Il valore viene **limitato** al dominio, come sul web: un dato fuori scala
    /// (un'umidità al 105% da una fonte sciatta) accorcia la barra fino al bordo
    /// invece di uscire dal grafico. Il colore continua a venire dal valore vero,
    /// perché la classificazione non è geometria.
    func barBounds(for value: Double, in domain: ClosedRange<Double>) -> (start: Double, end: Double) {
        (start: domain.lowerBound, end: clamped(value, in: domain))
    }

    /// Un valore riportato dentro il dominio, per i segni che barre non sono —
    /// la tacca della raffica.
    func clamped(_ value: Double, in domain: ClosedRange<Double>) -> Double {
        min(max(value, domain.lowerBound), domain.upperBound)
    }
}

extension MetricSection {

    // MARK: - Precipitazioni

    static let precipitationMm = MetricSection(
        id: "mm",
        height: 160,
        // Il grafico è nell'unità dell'utente; le soglie, che sono in
        // millimetri, ci vengono portate con `Units.precipitation(fromMm:)`, e
        // la classificazione fa il viaggio inverso. Convertire in un verso solo
        // sposterebbe le bande senza spostare i colori.
        valueOf: { $0.precipitationMm.map(Units.precipitation(fromMm:)) },
        secondaryOf: nil,
        colorOf: { PrecipIntensity.classify(Units.mm(fromPrecipitation: $0)).color },
        domain: domainFromZero(Units.precipitation(fromMm: PrecipIntensity.Threshold.heavy * 1.25)),
        // Le linee marcano i confini fra le fasce…
        gridValues: { _ in
            [PrecipIntensity.Threshold.moderate, PrecipIntensity.Threshold.heavy]
                .map(Units.precipitation(fromMm:))
        },
        gridLabel: { _ in nil },
        // …e le etichette stanno al centro della fascia che nominano. Una linea a
        // 0,1 mm sarebbe appiccicata alla base e illeggibile.
        bandValues: { domain in
            [
                Units.precipitation(fromMm: (PrecipIntensity.Threshold.light + PrecipIntensity.Threshold.moderate) / 2),
                Units.precipitation(fromMm: (PrecipIntensity.Threshold.moderate + PrecipIntensity.Threshold.heavy) / 2),
                (Units.precipitation(fromMm: PrecipIntensity.Threshold.heavy) + domain.upperBound) / 2
            ]
        },
        bandLabel: { PrecipIntensity.classify(Units.mm(fromPrecipitation: $0)).label },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            let intensity = PrecipIntensity.classify(h.precipitationMm)
            return intensity == .none ? formatPrecipMm(h.precipitationMm) : intensity.label
        },
        caption: { h in
            guard let h else { return "" }
            let intensity = PrecipIntensity.classify(h.precipitationMm)
            let amount = intensity != .none && h.precipitationMm != nil
                ? " · \(formatPrecipMm(h.precipitationMm))"
                : ""
            return conditionLabel(h) + amount
        },
        emptyMessage: "Quantità in mm non disponibile per questa località",
        flatMessage: "Nessuna precipitazione prevista"
    )

    static let precipitationProbability = MetricSection(
        id: "prob",
        height: 110,
        valueOf: { $0.precipitationProb },
        secondaryOf: nil,
        colorOf: { _ in Color(hex: "60A5FA").opacity(0.85) },
        domain: { _ in 0...100 },
        gridValues: { _ in [80, 100] },
        gridLabel: { "\(Int($0))%" },
        bandValues: { _ in [] },
        bandLabel: { _ in "" },
        headline: { h in
            guard let prob = h?.precipitationProb else { return "—%" }
            return "\(Int(prob.rounded()))%"
        },
        caption: { _ in "Probabilità" },
        emptyMessage: "Probabilità non disponibile per questa località",
        flatMessage: nil
    )

    // MARK: - Vento

    static let wind = MetricSection(
        id: "wind",
        height: 160,
        // Stessa regola delle precipitazioni: le soglie Beaufort restano in
        // km/h, il grafico è nell'unità dell'utente.
        valueOf: { $0.windSpeed.map(Units.wind(fromMs:)) },
        secondaryOf: { $0.windGust.map(Units.wind(fromMs:)) },
        colorOf: { WindScale.classify(Units.kmh(fromWind: $0)).color },
        domain: domainFromZero(Units.wind(fromKmh: WindScale.Threshold.strong * 1.25)),
        gridValues: { _ in
            [WindScale.Threshold.moderate, WindScale.Threshold.strong].map(Units.wind(fromKmh:))
        },
        gridLabel: { _ in nil },
        bandValues: { domain in
            [
                Units.wind(fromKmh: WindScale.Threshold.moderate / 2),
                Units.wind(fromKmh: (WindScale.Threshold.moderate + WindScale.Threshold.strong) / 2),
                (Units.wind(fromKmh: WindScale.Threshold.strong) + domain.upperBound) / 2
            ]
        },
        bandLabel: { WindScale.classify(Units.kmh(fromWind: $0)).label },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            return Units.windSpeed(fromMs: h.windSpeed)
        },
        caption: { h in
            guard let h, let speed = h.windSpeed else { return "" }
            var parts: [String] = []
            if let deg = h.windDirection {
                parts.append("Da \(windDegreesToDirection(deg))")
            }
            parts.append(WindScale.classify(speed * 3.6).label)
            if let gust = h.windGust {
                parts.append("raffiche \(Units.windSpeed(fromMs: gust))")
            }
            return parts.joined(separator: " · ")
        },
        emptyMessage: "Dati del vento non disponibili per questa località",
        flatMessage: "Assenza di vento prevista"
    )

    // MARK: - Umidità

    static let humidity = MetricSection(
        id: "humidity",
        height: 160,
        valueOf: { $0.humidity },
        secondaryOf: nil,
        colorOf: humidityColor,
        domain: { _ in 0...100 },
        gridValues: { _ in [30, 60, 90] },
        gridLabel: { "\(Int($0))%" },
        bandValues: { _ in [] },
        bandLabel: { _ in "" },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            guard let value = h.humidity else { return "—" }
            return "\(Int(value.rounded()))%"
        },
        caption: { _ in "Umidità relativa" },
        emptyMessage: "Umidità non disponibile per questa località",
        flatMessage: nil
    )

    // MARK: - Temperatura percepita

    static let feelsLike = MetricSection(
        id: "feels_like",
        height: 160,
        valueOf: { $0.feelsLike.map(Units.temperature(fromCelsius:)) },
        secondaryOf: nil,
        colorOf: { tempColor(Units.celsius(fromTemperature: $0)) },
        // A differenza delle altre metriche il fondo non è zero: barre che partono
        // da 0 °C su una giornata fra 18 e 24 °C non mostrerebbero alcuna
        // variazione, e con temperature sotto zero non avrebbero proprio senso.
        domain: { values in
            guard let min = values.min(), let max = values.max() else { return 0...1 }
            return (min.rounded(.down) - 2)...(max.rounded(.up) + 2)
        },
        // Passo di 5 in Celsius, di 10 in Fahrenheit: cinque gradi Fahrenheit
        // sono meno di tre Celsius, e l'asse si riempirebbe di linee.
        gridValues: { niceTicks($0, step: tempTickStep) },
        gridLabel: { "\(Int($0))°" },
        bandValues: { _ in [] },
        bandLabel: { _ in "" },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            return Units.temp(h.feelsLike)
        },
        caption: { h in
            guard let h else { return "" }
            return "Reale \(Units.temp(h.temp)) · \(conditionLabel(h))"
        },
        emptyMessage: "Temperatura percepita non disponibile per questa località",
        flatMessage: nil
    )

    // MARK: - Temperatura

    /// La temperatura con la banda dell'ensemble.
    ///
    /// La banda è il motivo per cui questa metrica esiste separata dalla
    /// percepita: i percentili 10 e 90 dei membri dell'ensemble dicono **quanto
    /// è incerta** la previsione, e su un orizzonte di due giorni è
    /// un'informazione che vale quanto il valore centrale. Una curva sottile
    /// promette una precisione che il modello non ha.
    static let temperature = MetricSection(
        id: "temperature",
        height: 170,
        valueOf: { Units.temperature(fromCelsius: $0.temp) },
        secondaryOf: nil,
        colorOf: { tempColor(Units.celsius(fromTemperature: $0)) },
        // Come per la percepita il fondo non è zero: una giornata fra 18 e 24
        // gradi su un asse che parte da 0 sarebbe una linea piatta. Il dominio
        // tiene conto anche della banda, o i percentili uscirebbero dal grafico.
        domain: { values in
            guard let min = values.min(), let max = values.max() else { return 0...1 }
            return (min.rounded(.down) - 2)...(max.rounded(.up) + 2)
        },
        gridValues: { niceTicks($0, step: tempTickStep) },
        gridLabel: { "\(Int($0))°" },
        bandValues: { _ in [] },
        bandLabel: { _ in "" },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            return Units.temp(h.temp)
        },
        caption: { h in
            guard let h else { return "" }
            var parti = [conditionLabel(h)]
            if let p10 = h.tempP10, let p90 = h.tempP90 {
                parti.append("fra \(Units.temp(p10)) e \(Units.temp(p90))")
            }
            // Il confronto resta in gradi Celsius: la soglia «almeno un grado
            // di differenza» in Fahrenheit sarebbe poco più di mezzo grado
            // reale, e la percepita comparirebbe anche quando non c'è.
            if let feels = h.feelsLike, abs(feels - h.temp) >= 1 {
                parti.append("percepita \(Units.temp(feels))")
            }
            return parti.joined(separator: " · ")
        },
        emptyMessage: "Temperatura oraria non disponibile per questa località",
        flatMessage: nil,
        kind: .lineWithBand,
        bandLowOf: { $0.tempP10.map(Units.temperature(fromCelsius:)) },
        bandHighOf: { $0.tempP90.map(Units.temperature(fromCelsius:)) }
    )

    // MARK: - Indice UV

    // MARK: - Temporali

    static let storm = MetricSection(
        id: "storm",
        height: 160,
        valueOf: { $0.stormIndex },
        secondaryOf: nil,
        colorOf: { StormScale.classify($0).color },
        // L'asse resta 0-100 anche con valori bassi: un indice è una
        // percentuale, non una quantità, e un dominio che si adatta al massimo
        // del giorno farebbe sembrare grave un 12.
        domain: { _ in 0...100 },
        gridValues: { _ in [StormScale.Threshold.weak, StormScale.Threshold.moderate, StormScale.Threshold.strong] },
        gridLabel: { _ in nil },
        bandValues: { _ in
            [
                StormScale.Threshold.weak / 2,
                (StormScale.Threshold.weak + StormScale.Threshold.moderate) / 2,
                (StormScale.Threshold.moderate + StormScale.Threshold.strong) / 2,
                (StormScale.Threshold.strong + 100) / 2
            ]
        },
        bandLabel: { StormScale.classify($0).label },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            guard let index = h.stormIndex else { return "—" }
            return StormScale.classify(index).label
        },
        caption: { h in
            guard let h, let index = h.stormIndex else { return "" }
            // Il CAPE in chiaro accanto all'indice: chi sa leggerlo ha il
            // numero, chi non lo sa ha l'etichetta, e nessuno dei due deve
            // fidarsi a scatola chiusa di un punteggio senza unità di misura.
            var parts = ["Indice \(Int(index.rounded()))/100"]
            if let cape = h.cape {
                parts.append("CAPE \(Int(cape.rounded())) J/kg")
            }
            return parts.joined(separator: " · ")
        },
        emptyMessage: "Indici convettivi non disponibili per questa località",
        flatMessage: "Nessuna instabilità prevista"
    )

    static let thunderProbability = MetricSection(
        id: "thunder_prob",
        height: 110,
        valueOf: { $0.thunderProb },
        secondaryOf: nil,
        colorOf: { _ in Color(hex: "C4B5FD") },
        domain: { _ in 0...100 },
        gridValues: { _ in [50, 100] },
        gridLabel: { "\(Int($0))%" },
        bandValues: { _ in [] },
        bandLabel: { _ in "" },
        headline: { h in
            guard let value = h?.thunderProb else { return "—%" }
            return "\(Int(value.rounded()))%"
        },
        caption: { _ in "Probabilità di tuono" },
        emptyMessage: "Probabilità di tuono non disponibile per questa località",
        flatMessage: nil
    )

    static let uv = MetricSection(
        id: "uv",
        height: 160,
        valueOf: { $0.uvIndex },
        secondaryOf: nil,
        colorOf: { UVScale.classify($0).color },
        domain: domainFromZero(UVScale.Threshold.extreme),
        gridValues: { _ in [UVScale.Threshold.moderate, UVScale.Threshold.high, UVScale.Threshold.veryHigh] },
        gridLabel: { _ in nil },
        // Quattro fasce e non cinque: "Estremo" parte da 11 e la sua etichetta
        // finirebbe sovrapposta a quella sotto. Il livello resta comunque nel
        // colore della barra e nella didascalia.
        bandValues: { domain in
            [
                UVScale.Threshold.moderate / 2,
                (UVScale.Threshold.moderate + UVScale.Threshold.high) / 2,
                (UVScale.Threshold.high + UVScale.Threshold.veryHigh) / 2,
                (UVScale.Threshold.veryHigh + domain.upperBound) / 2
            ]
        },
        bandLabel: { UVScale.classify($0).label },
        headline: { h in
            guard let h else { return "Dato non disponibile" }
            guard let value = h.uvIndex else { return "—" }
            return "\(Int(value.rounded()))"
        },
        caption: { h in
            guard let uv = h?.uvIndex else { return "" }
            return "Indice UV · \(UVScale.classify(uv).label)"
        },
        emptyMessage: "Indice UV non disponibile per questa località",
        flatMessage: "Nessuna radiazione UV prevista"
    )
}

// MARK: - Scale

/// Intensità del vento in km/h, semplificazione della scala Beaufort: fino a
/// 20 km/h è brezza (Beaufort ≤ 3), fino a 40 km/h vento teso (4-5), oltre è
/// vento forte (6+).
enum WindScale {
    case light
    case moderate
    case strong

    enum Threshold {
        static let moderate: Double = 20
        static let strong: Double = 40
    }

    static func classify(_ kmh: Double?) -> WindScale {
        guard let kmh, kmh.isFinite else { return .light }
        if kmh >= Threshold.strong { return .strong }
        if kmh >= Threshold.moderate { return .moderate }
        return .light
    }

    var label: String {
        switch self {
        case .light: return "Debole"
        case .moderate: return "Teso"
        case .strong: return "Forte"
        }
    }

    var color: Color {
        switch self {
        case .light: return Color(hex: "7FB3E8")
        case .moderate: return Color(hex: "3B82F6")
        case .strong: return Color(hex: "EC685A")
        }
    }
}

/// Fasce dell'indice UV secondo l'OMS.
/// Fasce dell'indice di rischio temporali, 0-100.
///
/// Le soglie sono quelle di `backend/utils/storm.ts`: qui non si rifà il
/// calcolo, si colora e si nomina quello che il backend ha già prodotto.
enum StormScale {
    case none
    case weak
    case moderate
    case strong

    enum Threshold {
        static let weak: Double = 25
        static let moderate: Double = 50
        static let strong: Double = 75
    }

    static func classify(_ index: Double?) -> StormScale {
        guard let index, index.isFinite else { return .none }
        if index >= Threshold.strong { return .strong }
        if index >= Threshold.moderate { return .moderate }
        if index >= Threshold.weak { return .weak }
        return .none
    }

    var label: String {
        switch self {
        case .none: return "Assente"
        case .weak: return "Debole"
        case .moderate: return "Moderato"
        case .strong: return "Forte"
        }
    }

    var color: Color {
        switch self {
        case .none: return Color(hex: "22C55E")
        case .weak: return Color(hex: "F97316")
        case .moderate: return Color(hex: "EF4444")
        case .strong: return Color(hex: "A855F7")
        }
    }
}

enum UVScale {
    case low
    case moderate
    case high
    case veryHigh
    case extreme

    enum Threshold {
        static let moderate: Double = 3
        static let high: Double = 6
        static let veryHigh: Double = 8
        static let extreme: Double = 11
    }

    static func classify(_ uv: Double?) -> UVScale {
        guard let uv, uv.isFinite else { return .low }
        if uv >= Threshold.extreme { return .extreme }
        if uv >= Threshold.veryHigh { return .veryHigh }
        if uv >= Threshold.high { return .high }
        if uv >= Threshold.moderate { return .moderate }
        return .low
    }

    var label: String {
        switch self {
        case .low: return "Basso"
        case .moderate: return "Moderato"
        case .high: return "Alto"
        case .veryHigh: return "Molto alto"
        case .extreme: return "Estremo"
        }
    }

    var color: Color {
        switch self {
        case .low: return Color(hex: "22C55E")
        // Tonalità più profonde delle equivalenti web: qui lo sfondo è crema e
        // un giallo chiaro non si staccherebbe.
        case .moderate: return Color(hex: "CA8A04")
        case .high: return Color(hex: "F97316")
        case .veryHigh: return Color(hex: "EF4444")
        case .extreme: return Color(hex: "A855F7")
        }
    }
}

/// Colore per l'umidità relativa: dal secco ambrato all'afoso blu pieno.
func humidityColor(_ pct: Double) -> Color {
    guard pct.isFinite else { return Color.black.opacity(0.15) }
    if pct >= 80 { return Color(hex: "3B82F6") }
    if pct >= 60 { return Color(hex: "60A5FA") }
    if pct >= 30 { return Color(hex: "7FB3E8") }
    return Color(hex: "D97706")
}

/// Colore per una temperatura in °C, dal freddo viola al caldo rosso.
func tempColor(_ celsius: Double) -> Color {
    guard celsius.isFinite else { return Color.black.opacity(0.15) }
    if celsius >= 35 { return Color(hex: "DC2626") }
    if celsius >= 28 { return Color(hex: "F97316") }
    if celsius >= 20 { return Color(hex: "CA8A04") }
    if celsius >= 10 { return Color(hex: "22C55E") }
    if celsius >= 0 { return Color(hex: "60A5FA") }
    return Color(hex: "A78BFA")
}

/// Sigla della direzione da cui soffia il vento, es. 315° → "NO".
func windDegreesToDirection(_ deg: Double) -> String {
    let directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]
    let index = Int((deg / 45).rounded()) % 8
    return directions[(index + 8) % 8]
}
