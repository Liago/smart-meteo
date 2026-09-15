import SwiftUI

/// La sezione «Prossimi giorni».
///
/// La barra dell'escursione è la ragione per cui questa riga funziona meglio di
/// due numeri: **tutte le barre stanno sulla stessa scala** (−5…40 °C), quindi
/// un giorno più caldo è visibilmente più a destra di quello sopra. Con due
/// colonne di cifre il confronto fra giorni va fatto a mente.
struct DailyRowsView: View {
    /// Ridisegna quando cambiano le unità: le funzioni di formattazione
    /// leggono `UnitPrefs.shared` ma non possono osservarlo.
    @ObservedObject private var units = UnitPrefs.shared
    let days: [DailyForecast]
    let onTapDay: (String) -> Void

    /// Scala fissa **in gradi Celsius**. Fissa e non adattata alla settimana:
    /// una scala che si riadatta ogni giorno renderebbe incomparabili due
    /// schermate diverse, e 18° sembrerebbe caldo a novembre e freddo ad agosto.
    ///
    /// Resta in Celsius anche quando l'utente legge in Fahrenheit: è la
    /// **geometria** della barra, non un'etichetta, e convertirla insieme ai
    /// numeri non cambierebbe nulla se non introdurre un modo di sbagliare.
    static let scaleMin: Double = -5
    static let scaleMax: Double = 40

    /// I giorni da oggi in avanti, al massimo sette.
    ///
    /// Il filtro sul passato non è cosmetico, ed è lo stesso che la strip del
    /// dettaglio orario ha già: `daily` può cominciare da **ieri** — le fonti
    /// ragionano in UTC e il primo cassetto del giorno locale cade il giorno
    /// prima — e la prima riga mostrava allora una previsione che i fatti
    /// hanno già smentito.
    ///
    /// Il taglio costa due volte: il `prefix(7)` mangiava anche un giorno
    /// futuro per far posto a quello passato, quindi la settimana finiva un
    /// giorno prima del dovuto.
    static func upcoming(_ days: [DailyForecast], now: Date = Date()) -> [DailyForecast] {
        let oggi = todayKey(now)
        return Array(days.filter { String($0.date.prefix(10)) >= oggi }.prefix(7))
    }

    /// Il giorno di **oggi**, scelto per data e non per posizione.
    ///
    /// `daily.first` sembrava oggi e spesso lo era; quando `daily` apre da ieri
    /// era ieri — e quel valore alimenta il massimo e il minimo dell'hero, cioè
    /// il blocco di numeri più grande della schermata. Sbagliato lì vale più
    /// che sbagliato in una riga della settimana, e si nota meno: 21°/10° è
    /// perfettamente plausibile, solo che è la giornata di ieri.
    ///
    /// Senza oggi ripiega sul primo giorno futuro: una previsione di domani
    /// dichiara almeno qualcosa di vero, una di ieri no.
    static func today(_ days: [DailyForecast]?, now: Date = Date()) -> DailyForecast? {
        guard let days else { return nil }
        let oggi = todayKey(now)
        return days.first { String($0.date.prefix(10)) == oggi }
            ?? days.first { String($0.date.prefix(10)) > oggi }
    }

    static func todayKey(_ now: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: now)
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Self.upcoming(days), id: \.date) { day in
                Button {
                    HapticManager.light()
                    onTapDay(day.date)
                } label: {
                    row(day)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func row(_ day: DailyForecast) -> some View {
        HStack(spacing: 8) {
            Text(Self.dayLabel(day.date))
                .font(.duetUI(13, .bold))
                .foregroundColor(Duet.ink)
                .frame(width: 34, alignment: .leading)

            WeatherIcon(systemName: WeatherSymbol.name(for: day.conditionCode), font: .duetUI(20))
                .frame(width: 22)

            Text(Self.probText(day.precipitationProb))
                .font(.duetUI(11, .semibold))
                .foregroundColor(Duet.dataBlue)
                .frame(width: 34, alignment: .leading)

            Text(Self.tempText(day.tempMin))
                .font(.duetUI(12.5))
                .foregroundColor(Duet.ink.opacity(0.45))
                .monospacedDigit()
                .frame(width: 26, alignment: .trailing)

            rangeBar(min: day.tempMin, max: day.tempMax)

            Text(Self.tempText(day.tempMax))
                .font(.duetUI(12.5, .bold))
                .foregroundColor(Duet.ink)
                .monospacedDigit()
                .frame(width: 28, alignment: .trailing)
        }
        .padding(.vertical, 7)
        .contentShape(Rectangle())
    }

    private func rangeBar(min lo: Double?, max hi: Double?) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Duet.ink.opacity(0.08))

                if let lo, let hi, hi >= lo {
                    let start = Self.ratio(lo) * geo.size.width
                    let end = Self.ratio(hi) * geo.size.width
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(hex: "A9CBE8"),
                                    Color(hex: "F2D9A4"),
                                    Color(hex: "E8A183"),
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        // Sotto i 6 pt la capsula non si vede: un giorno senza
                        // escursione resta comunque un segno leggibile.
                        .frame(width: Swift.max(end - start, 6))
                        .offset(x: start)
                }
            }
        }
        .frame(height: 7)
    }

    // MARK: - Scala e formattazione

    static func ratio(_ temp: Double) -> Double {
        let clamped = Swift.min(Swift.max(temp, scaleMin), scaleMax)
        return (clamped - scaleMin) / (scaleMax - scaleMin)
    }

    static func tempText(_ value: Double?) -> String {
        Units.temp(value)
    }

    static func probText(_ value: Double?) -> String {
        guard let value, value >= 1 else { return "" }
        return "\(Int(value.rounded()))%"
    }

    /// «Oggi» per il giorno corrente, altrimenti il giorno abbreviato.
    ///
    /// La data si costruisce dai pezzi della stringa: un parser ISO la
    /// interpreterebbe come UTC e in Italia mostrerebbe il giorno prima per
    /// tutta la sera.
    static func dayLabel(_ date: String, now: Date = Date()) -> String {
        if date == todayKey(now) { return "Oggi" }

        let parts = date.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return date }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        guard let day = Calendar.current.date(from: components) else { return date }

        let weekday = DateFormatter()
        weekday.locale = Locale(identifier: "it_IT")
        weekday.dateFormat = "EEE"
        return weekday.string(from: day)
            .replacingOccurrences(of: ".", with: "")
            .capitalized
    }
}
