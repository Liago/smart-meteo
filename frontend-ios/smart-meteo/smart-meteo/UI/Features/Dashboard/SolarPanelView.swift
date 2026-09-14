import SwiftUI

/// Resa fotovoltaica prevista.
///
/// Gemello di `SolarPanel.tsx`. In Italia il fotovoltaico domestico è
/// diffusissimo, e chi ce l'ha non chiede «c'è il sole» ma «quanto produco
/// domani».
///
/// La potenza dell'impianto è un dato dell'utente, non della previsione: vive
/// in `UserDefaults` e non tocca il backend, così la stessa risposta in cache
/// serve tutti quelli sulla stessa località. Senza, il pannello mostra la resa
/// specifica in kWh/kWp — che è comunque il numero fisicamente corretto, non un
/// ripiego.
struct SolarPanelView: View {
    let solar: SolarOutlook

    /// Potenza dell'impianto in kWp; 0 = non impostata.
    ///
    /// La chiave è la stessa del web (`localStorage`), anche se i due archivi
    /// non comunicano: tenerle allineate evita che una futura sincronizzazione
    /// debba inseguire due nomi diversi.
    @AppStorage("smart-meteo-pv-kwp") private var plantKwp: Double = 0

    @State private var isEditing = false
    @State private var draft = ""

    /// Taglia massima accettata: oltre non è più un impianto domestico.
    static let maxPlantKwp: Double = 100

    // MARK: - Formattazione

    /// Interpreta la potenza scritta dall'utente, accettando la virgola.
    static func parsePlantKwp(_ input: String) -> Double? {
        let value = Double(input.replacingOccurrences(of: ",", with: "."))
        guard let value, value > 0, value <= maxPlantKwp else { return nil }
        return value
    }

    /// Energia attesa dall'impianto in un giorno, kWh.
    static func dayEnergyKwh(_ day: SolarDay, kwp: Double?) -> Double? {
        guard let kwp, kwp > 0 else { return nil }
        return day.kwhPerKwp * kwp
    }

    static func formatKwh(_ value: Double?) -> String {
        guard let value else { return "—" }
        return String(format: "%.1f kWh", value).replacingOccurrences(of: ".", with: ",")
    }

    /// Resa specifica, sempre con l'unità che la rende leggibile.
    static func formatSpecificYield(_ value: Double) -> String {
        String(format: "%.2f kWh/kWp", value).replacingOccurrences(of: ".", with: ",")
    }

    static func formatKwp(_ value: Double) -> String {
        String(format: "%g kWp", value).replacingOccurrences(of: ".", with: ",")
    }

    /// Giorno della settimana abbreviato, o «Oggi»/«Domani».
    ///
    /// La data si costruisce dai pezzi della stringa, non da un parser ISO:
    /// quello la interpreterebbe come UTC e in Italia mostrerebbe il giorno
    /// prima per tutta la sera.
    static func dayLabel(_ date: String, now: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        if date == formatter.string(from: now) { return "Oggi" }
        if let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now),
           date == formatter.string(from: tomorrow) {
            return "Domani"
        }

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
        return weekday.string(from: day).replacingOccurrences(of: ".", with: "").capitalized
    }

    /// La frase che dichiara le assunzioni della stima.
    ///
    /// Senza, il numero non è verificabile: chi ha un impianto sa la propria
    /// inclinazione, e ha diritto di sapere quale abbiamo supposto noi.
    static func assumptionsNote(_ solar: SolarOutlook) -> String {
        let piano = solar.plane == "tilted"
            ? "pannelli a \(Int(solar.tiltDeg.rounded()))° esposti a sud"
            : "piano orizzontale"
        let perdite = Int(((1 - solar.performanceRatio) * 100).rounded())
        return "Stima su \(piano), con \(perdite)% di perdite di impianto."
    }

    // MARK: - Body

    var body: some View {
        if let best = solar.days.max(by: { $0.kwhPerKwp < $1.kwhPerKwp }) {
            let kwp: Double? = plantKwp > 0 ? plantKwp : nil

            GlassContainer {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Image(systemName: "sun.max.fill")
                            .font(.system(size: 13))
                            .foregroundColor(.gray)

                        Text("Fotovoltaico")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.black)

                        Spacer(minLength: 0)

                        Button {
                            draft = kwp.map { String(format: "%g", $0) } ?? ""
                            isEditing = true
                        } label: {
                            Text(kwp.map(Self.formatKwp) ?? "Imposta impianto")
                                .font(.system(size: 11, weight: .medium))
                                .underline()
                                .foregroundColor(Color(red: 236 / 255, green: 104 / 255, blue: 90 / 255))
                        }
                    }

                    Text(headline(best: best, kwp: kwp))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.black)

                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(solar.days) { day in
                            row(day, best: best, kwp: kwp)
                        }
                    }

                    Text(Self.assumptionsNote(solar)
                        + (kwp == nil ? " Imposta la potenza per vedere i kWh." : ""))
                        .font(.system(size: 10))
                        .foregroundColor(.gray.opacity(0.8))
                }
            }
            .alert("Potenza dell'impianto", isPresented: $isEditing) {
                TextField("3,0", text: $draft)
                    .keyboardType(.decimalPad)

                Button("Salva") {
                    // Un valore non valido azzera invece di conservare quello
                    // vecchio: se l'utente ha cancellato il campo, intendeva
                    // togliere l'impianto.
                    plantKwp = Self.parsePlantKwp(draft) ?? 0
                }
                Button("Annulla", role: .cancel) {}
            } message: {
                Text("In kWp. Serve solo sul telefono: non viene inviata al server.")
            }
        }
    }

    private func headline(best: SolarDay, kwp: Double?) -> String {
        if let energy = Self.dayEnergyKwh(best, kwp: kwp) {
            return "Giornata migliore: \(Self.formatKwh(energy)) \(Self.dayLabel(best.date).lowercased())"
        }
        return "Giornata migliore: \(Self.formatSpecificYield(best.kwhPerKwp))"
    }

    @ViewBuilder
    private func row(_ day: SolarDay, best: SolarDay, kwp: Double?) -> some View {
        let energy = Self.dayEnergyKwh(day, kwp: kwp)
        let fraction = best.kwhPerKwp > 0 ? day.kwhPerKwp / best.kwhPerKwp : 0

        HStack(alignment: .center, spacing: 8) {
            Text(Self.dayLabel(day.date))
                .font(.system(size: 12))
                .foregroundColor(.gray)
                .frame(width: 48, alignment: .leading)

            // La barra rende confrontabili i giorni a colpo d'occhio, cosa che
            // una colonna di numeri non fa.
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.gray.opacity(0.15))
                    Capsule()
                        .fill(Color(hex: "F5A623"))
                        .frame(width: geo.size.width * min(1, max(0, fraction)))
                }
            }
            .frame(height: 5)

            if let hours = day.sunshineHours {
                Text("\(Int(hours.rounded())) h sole")
                    .font(.system(size: 11))
                    .foregroundColor(.gray.opacity(0.8))
            }

            Text(energy != nil ? Self.formatKwh(energy) : Self.formatSpecificYield(day.kwhPerKwp))
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.black)
                .monospacedDigit()
                .frame(width: 88, alignment: .trailing)
        }
    }
}
