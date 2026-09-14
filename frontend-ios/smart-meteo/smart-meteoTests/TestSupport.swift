import Foundation
import XCTest
@testable import smart_meteo

/// Appoggio comune alle prove.
///
/// I modelli si costruiscono **decodificando JSON**, non con l'inizializzatore
/// di membro, ogni volta che la prova riguarda il contratto con il backend: è
/// l'unico modo di verificare che le chiavi snake_case siano quelle giuste. Una
/// chiave sbagliata compila benissimo e fallisce in silenzio a runtime, che è
/// peggio di un errore di compilazione.
enum Fixture {
    static func decode<T: Decodable>(_ type: T.Type, from json: String) throws -> T {
        let data = Data(json.utf8)
        return try JSONDecoder().decode(T.self, from: data)
    }
}

/// Chiave locale `yyyy-MM-dd` di un giorno, con lo stesso formato del backend.
///
/// Le prove che dipendono da «oggi» costruiscono le date da qui invece di
/// scriverle a mano: una data fissa nel codice trasforma una prova in una
/// bomba a tempo, che è esattamente l'inciampo già trovato sulla suite web.
func dayKey(offsetDays: Int = 0, from now: Date = Date()) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    let date = Calendar.current.date(byAdding: .day, value: offsetDays, to: now) ?? now
    return formatter.string(from: date)
}

/// Le 24 ore di un giorno, come le manda il backend: chiave locale, niente fuso.
func hourlyJSON(day: String) -> String {
    let hours = (0..<24).map { hour -> String in
        let hh = String(format: "%02d", hour)
        return """
        {"time":"\(day)T\(hh):00","temp":20,"precipitation_prob":10,"condition_code":"1"}
        """
    }
    return hours.joined(separator: ",")
}

/// Un array di `HourlyForecast` sui giorni indicati.
func makeHourly(days: [String]) throws -> [HourlyForecast] {
    let json = "[" + days.map { hourlyJSON(day: $0) }.joined(separator: ",") + "]"
    return try Fixture.decode([HourlyForecast].self, from: json)
}
