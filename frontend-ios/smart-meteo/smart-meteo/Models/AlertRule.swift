import Foundation

/// Regola di allerta personale: una soglia scelta dall'utente.
///
/// Le allerte governative scattano su criteri di protezione civile — utili, ma
/// non rispondono a «avvisami se stanotte gela», che è la domanda di chi ha un
/// orto o una moto. Queste regole riusano la stessa pipeline: stessa
/// subscription, stesso APNs, stesso poller.
///
/// La regola è legata al **device**, non alla località: vale ovunque il telefono
/// sia registrato, e sopravvive agli spostamenti che riscrivono la subscription.
struct AlertRule: Codable, Identifiable {
    let id: String
    /// Id di una `AlertRuleMetric`.
    let metric: String
    /// "above" | "below"
    let comparator: String
    /// Nell'unità che l'utente vede: km/h per il vento, non m/s.
    let threshold: Double
    /// Quante ore in avanti guardare.
    let horizonHours: Int
    let enabled: Bool

    enum CodingKeys: String, CodingKey {
        case id, metric, comparator, threshold, enabled
        case horizonHours = "horizon_hours"
    }
}

/// Una metrica su cui si può porre una soglia.
///
/// Il registro vive nel backend (`backend/utils/alertRules.ts`) ed è servito da
/// `/api/alerts/rules/metrics`: etichette, unità e confronti ammessi stanno in
/// un posto solo, così l'app non può proporre una regola che il server
/// rifiuterebbe.
struct AlertRuleMetric: Codable, Identifiable {
    var id: String { metricId }
    let metricId: String
    let label: String
    /// Unità mostrata accanto alla soglia ("°", " km/h", " mm"…).
    ///
    /// **Non segue le preferenze di `UnitPrefs`, ed è voluto.** La soglia è
    /// archiviata sul server nell'unità che l'utente ha digitato, e il poller
    /// la confronta così com'è: seguire il selettore rileggerebbe «50» come
    /// nodi una regola scritta in km/h, cioè cambierebbe di nascosto un avviso
    /// già configurato. Qui l'unità è **scritta accanto al numero** in ogni
    /// punto della schermata, quindi non c'è ambiguità da risolvere — mentre
    /// nel resto dell'app il grado è nudo e l'unità la decide il selettore.
    let unit: String
    /// "min" | "max" | "sum" | "current"
    let aggregation: String
    let decimals: Int
    let comparators: [String]

    enum CodingKeys: String, CodingKey {
        case metricId = "id"
        case label, unit, aggregation, decimals, comparators
    }

    /// Se la metrica accetta entrambi i versi del confronto.
    var isBidirectional: Bool { comparators.count > 1 }
}

extension AlertRule {

    /// Verso del confronto in italiano.
    var comparatorLabel: String {
        comparator == "above" ? "oltre" : "sotto"
    }

    /// Descrizione leggibile della regola, es. «Temperatura minima sotto 0°».
    ///
    /// Richiede la metrica perché l'unità e i decimali vivono lì: senza, una
    /// soglia di 50 sarebbe indistinguibile fra gradi e km/h.
    func describe(using metrics: [AlertRuleMetric]) -> String {
        guard let spec = metrics.first(where: { $0.metricId == metric }) else {
            return "\(metric) \(comparatorLabel) \(threshold)"
        }
        let value = String(format: "%.\(spec.decimals)f", threshold).replacingOccurrences(of: ".", with: ",")
        return "\(spec.label) \(comparatorLabel) \(value)\(spec.unit)"
    }

    /// Finestra della regola, scritta per esteso.
    var horizonLabel: String {
        horizonHours == 24 ? "prossime 24 ore" : "prossime \(horizonHours) ore"
    }
}
