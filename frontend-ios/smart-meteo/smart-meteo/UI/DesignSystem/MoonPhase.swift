import Foundation

/// La fase lunare, con quello che serve a raccontarla.
///
/// Viveva come tre funzioni private in fondo a `CurrentWeatherView`, il
/// pannello del vecchio layout, ed è sparita con lui: il ridisegno non aveva
/// un posto per la luna e nessuno se n'è accorto perché una dashboard senza
/// luna sembra semplicemente una dashboard. Ora sta qui, senza vista attorno,
/// perché la usa la scheda «Luna» di «Per te» e perché così si prova senza
/// costruire una `View`.
///
/// Il backend manda già `moon_phase` come nome, ma non sempre nella stessa
/// lingua: il motore preferisce la fonte che ha anche sorgere e tramonto, e
/// quella scrive la fase in inglese. Si accettano entrambe le grafie e, se il
/// nome non si riconosce, si ricalcola: la fase di stanotte non è un dato che
/// valga la pena mostrare come «—».
enum MoonPhase: Int, CaseIterable {
    case new = 0
    case waxingCrescent
    case firstQuarter
    case waxingGibbous
    case full
    case waningGibbous
    case lastQuarter
    case waningCrescent

    /// Durata del mese sinodico, in giorni. Stesso valore di `utils/moon.ts`.
    static let synodicMonth = 29.5305882

    var label: String {
        switch self {
        case .new: return "Luna nuova"
        case .waxingCrescent: return "Luna crescente"
        case .firstQuarter: return "Primo quarto"
        case .waxingGibbous: return "Gibbosa crescente"
        case .full: return "Luna piena"
        case .waningGibbous: return "Gibbosa calante"
        case .lastQuarter: return "Ultimo quarto"
        case .waningCrescent: return "Luna calante"
        }
    }

    var symbol: String {
        switch self {
        case .new: return "moonphase.new.moon"
        case .waxingCrescent: return "moonphase.waxing.crescent"
        case .firstQuarter: return "moonphase.first.quarter"
        case .waxingGibbous: return "moonphase.waxing.gibbous"
        case .full: return "moonphase.full.moon"
        case .waningGibbous: return "moonphase.waning.gibbous"
        case .lastQuarter: return "moonphase.last.quarter"
        case .waningCrescent: return "moonphase.waning.crescent"
        }
    }

    // MARK: - Dal nome del backend

    /// Riconosce il nome italiano di `utils/moon.ts` e quello inglese dei
    /// provider. Il confronto ignora maiuscole e spazi: «Luna Piena»,
    /// «luna piena» e «Full Moon» sono la stessa fase.
    static func parse(_ text: String?) -> MoonPhase? {
        guard let text else { return nil }
        let chiave = text.lowercased()
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "_", with: "")
        return names[chiave]
    }

    private static let names: [String: MoonPhase] = [
        "lunanuova": .new, "newmoon": .new, "new": .new,
        "lunacrescente": .waxingCrescent, "waxingcrescent": .waxingCrescent,
        "primoquarto": .firstQuarter, "firstquarter": .firstQuarter,
        "gibbosacrescente": .waxingGibbous, "waxinggibbous": .waxingGibbous,
        "lunapiena": .full, "fullmoon": .full, "full": .full,
        "gibbosacalante": .waningGibbous, "waninggibbous": .waningGibbous,
        "ultimoquarto": .lastQuarter, "lastquarter": .lastQuarter, "thirdquarter": .lastQuarter,
        "lunacalante": .waningCrescent, "waningcrescent": .waningCrescent,
    ]

    // MARK: - Dal calendario

    /// Giorni dall'ultima luna nuova, 0…29,53. Stesso algoritmo di
    /// `utils/moon.ts`, così i due client e il backend chiamano la stessa
    /// notte con lo stesso nome.
    static func age(on date: Date, calendar: Calendar = .current) -> Double {
        var year = Double(calendar.component(.year, from: date))
        var month = Double(calendar.component(.month, from: date))
        let day = Double(calendar.component(.day, from: date))
        let hour = Double(calendar.component(.hour, from: date))

        if month < 3 {
            year -= 1
            month += 12
        }
        month += 1

        let jd = 365.25 * year + 30.6 * month + day + hour / 24 - 694039.09
        let resto = jd.truncatingRemainder(dividingBy: synodicMonth)
        return resto < 0 ? resto + synodicMonth : resto
    }

    static func computed(on date: Date, calendar: Calendar = .current) -> MoonPhase {
        let indice = Int((age(on: date, calendar: calendar) / synodicMonth * 8).rounded()) % 8
        return MoonPhase(rawValue: indice) ?? .new
    }

    /// Quella del backend se si riconosce, altrimenti quella calcolata.
    static func resolve(_ text: String?, on date: Date = Date()) -> MoonPhase {
        parse(text) ?? computed(on: date)
    }

    /// Frazione illuminata in percento, dall'età: serve solo quando la fonte
    /// non manda `moon_illumination`.
    static func illumination(age: Double) -> Int {
        Int(((1 - cos(age / synodicMonth * 2 * .pi)) / 2 * 100).rounded())
    }

    /// Giorni alla prossima luna piena, 0 finché la fase è «piena».
    ///
    /// Le due risposte devono concordare: la fase piena copre quasi quattro
    /// notti (un ottavo del mese), e contare i giorni dall'istante esatto
    /// avrebbe scritto «Luna piena · piena fra 28 giorni» già la notte dopo.
    static func daysToFull(age: Double) -> Int {
        let piena = synodicMonth / 2
        let mezzaFase = synodicMonth / 16
        if abs(age - piena) <= mezzaFase { return 0 }
        let giorni = age < piena ? piena - age : synodicMonth - age + piena
        return Int(giorni.rounded())
    }
}
