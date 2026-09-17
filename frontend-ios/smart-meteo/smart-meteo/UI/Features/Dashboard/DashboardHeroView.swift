import SwiftUI

// MARK: - Intestazione

/// Ricerca a sinistra, località al centro, impostazioni a destra.
///
/// La riga sotto il nome — «aggiornato 2 min fa · 5 fonti» — è la sola cosa che
/// dichiara quanto è fresca la previsione. Senza, un dato di mezz'ora fa e uno
/// appena arrivato hanno lo stesso aspetto.
struct DashboardHeaderView: View {
    let locationName: String
    let isHome: Bool
    let subtitle: String
    let theme: WeatherTheme
    let onSearch: () -> Void
    let onSettings: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            circleButton(symbol: "magnifyingglass", action: onSearch)
                .accessibilityLabel("Cerca località")

            VStack(spacing: 2) {
                HStack(spacing: 5) {
                    Image(systemName: isHome ? "house.fill" : "location.fill")
                        .font(.duetUI(11, .semibold))
                        .foregroundColor(theme.ink.opacity(0.75))

                    Text(locationName)
                        .font(.duetUI(15, .heavy))
                        .tracking(-0.15)
                        .foregroundColor(theme.ink)
                        .lineLimit(1)
                }

                Text(subtitle)
                    .font(.duetUI(11, .medium))
                    .foregroundColor(theme.ink.opacity(0.5))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)

            circleButton(symbol: "gearshape", action: onSettings)
                .accessibilityLabel("Impostazioni")
        }
        .padding(.horizontal, 20)
    }

    private func circleButton(symbol: String, action: @escaping () -> Void) -> some View {
        Button {
            HapticManager.light()
            action()
        } label: {
            Image(systemName: symbol)
                .font(.duetUI(17, .medium))
                .foregroundColor(theme.ink.opacity(0.8))
                .frame(width: 40, height: 40)
                .background(
                    RoundedRectangle(cornerRadius: Duet.rSmall)
                        .fill(Color.white.opacity(0.75))
                )
                .shadow(color: Duet.shadowControl, radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Banner allerte

/// L'allerta in cima, sopra a tutto tranne l'intestazione.
///
/// Compatta di proposito: una sola riga con il titolo dell'allerta più grave e
/// un chevron. Il dettaglio sta nella schermata dedicata — un banner che
/// racconta tutto occupa mezzo schermo proprio nei giorni in cui il resto della
/// previsione serve di più.
struct AlertPillView: View {
    let alerts: [WeatherAlert]
    let onTap: () -> Void

    private var worst: WeatherAlert? {
        let rank = ["extreme": 0, "severe": 1, "moderate": 2, "minor": 3]
        return alerts.min { (rank[$0.severity.lowercased()] ?? 4) < (rank[$1.severity.lowercased()] ?? 4) }
    }

    var body: some View {
        if let worst {
            Button {
                HapticManager.light()
                onTap()
            } label: {
                HStack(spacing: 11) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 9)
                            .fill(Self.markColor(worst.severity))
                            .frame(width: 26, height: 26)
                        Text("!")
                            .font(.duetUI(14, .heavy))
                            .foregroundColor(.white)
                    }

                    Text(Self.headline(worst, total: alerts.count))
                        .font(.duetUI(12.5, .bold))
                        .foregroundColor(Self.inkColor(worst.severity))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Spacer(minLength: 4)

                    Image(systemName: "chevron.right")
                        .font(.duetUI(12, .semibold))
                        .foregroundColor(Self.inkColor(worst.severity).opacity(0.6))
                }
                .padding(.vertical, 11)
                .padding(.horizontal, 14)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Self.tintColor(worst.severity))
                )
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
        }
    }

    /// Il titolo dell'allerta più grave, con il conteggio quando ce n'è più di
    /// una: «e altre 2» dice che vale la pena aprire.
    static func headline(_ alert: WeatherAlert, total: Int) -> String {
        // Stesso titolo della card nella schermata allerte: il banner e la
        // schermata che apre devono chiamare la stessa allerta allo stesso modo.
        let titolo = AlertCardView.title(alert)
        guard total > 1 else { return titolo }
        return "\(titolo) · e altre \(total - 1)"
    }

    static func markColor(_ severity: String) -> Color {
        switch severity.lowercased() {
        case "extreme", "severe": return Duet.orangeRed
        case "moderate": return Duet.yellow
        default: return Duet.dataBlue
        }
    }

    static func tintColor(_ severity: String) -> Color {
        switch severity.lowercased() {
        case "extreme", "severe": return Duet.tintOrange
        case "moderate": return Duet.tintYellow
        default: return Color(hex: "E3EDF7")
        }
    }

    static func inkColor(_ severity: String) -> Color {
        switch severity.lowercased() {
        case "extreme", "severe": return Color(hex: "7A2E19")
        case "moderate": return Color(hex: "7A5A15")
        default: return Color(hex: "27455F")
        }
    }
}

// MARK: - Hero, variante «Foglio»

/// La condizione a tinta piena, con la temperatura grande.
///
/// Il glifo grande dietro al numero non è decorazione gratuita: è la ragione
/// per cui si capisce che tempo fa **prima** di leggere la cifra, da un metro
/// di distanza e con lo schermo di sbieco.
///
/// L'hero è tutto in SF Pro, con la temperatura in peso leggero. L'handoff
/// la voleva in serif, e così era stata fatta: ma il numero in New York sopra
/// etichette e valori in SF Pro leggeva come due font presi a caso più che
/// come una scelta, e la cosa è stata segnalata come difetto. Il serif resta
/// dove sta da solo — i titoli delle sezioni, i fogli secondari.
struct HeroSheetView: View {
    /// Ridisegna quando cambiano le unità: le funzioni di formattazione
    /// leggono `UnitPrefs.shared` ma non possono osservarlo.
    @ObservedObject private var units = UnitPrefs.shared
    let current: ForecastCurrent
    let today: DailyForecast?
    /// Il nowcast al minuto, quando WeatherKit copre la località.
    ///
    /// Non è nella specifica dell'handoff, che in questa variante lo lascia
    /// cadere del tutto: nel ridisegno il nowcast esiste solo come tessera
    /// della variante «Tessere». Ma «inizia a piovere fra 12 minuti» è
    /// l'informazione più urgente che l'app possieda — l'unica per cui si apre
    /// il telefono mentre si esce di casa — e perderla per una scelta di
    /// impaginazione sarebbe un peggioramento travestito da ridisegno. Compare
    /// come una riga sola, e solo quando c'è qualcosa da annunciare.
    let nextHour: ForecastNextHour?
    let condition: SkyCondition
    let theme: WeatherTheme

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Image(systemName: condition.heroSymbol)
                .font(.system(size: 150))
                .foregroundColor(theme.glyph)
                .offset(x: 18, y: -14)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 10) {
                Text("ADESSO")
                    .font(.duetUI(12, .medium))
                    .tracking(1.7)
                    .foregroundColor(theme.ink.opacity(0.65))

                Text(HeroText.temperature(current.temperature))
                    .font(.duetUI(92, .light))
                    .tracking(-3.5)
                    .foregroundColor(theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)

                Text(HeroText.narrative(current: current, condition: condition))
                    .font(.duetUI(19, .medium))
                    .tracking(-0.2)
                    .foregroundColor(theme.ink.opacity(0.9))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 250, alignment: .leading)

                if let nowcast = HeroText.nowcastLine(nextHour) {
                    HStack(spacing: 6) {
                        Image(systemName: "drop.fill")
                            .font(.duetUI(11, .semibold))
                        Text(nowcast)
                            .font(.duetUI(12.5, .bold))
                    }
                    .foregroundColor(theme.accent)
                }

                HStack(alignment: .top, spacing: 18) {
                    metric("Percepita", HeroText.temperature(current.feelsLike))
                    metric("Max / Min", HeroText.range(today))
                    metric("Pioggia", "\(Int(current.precipitationProb.rounded()))%")
                }
                .padding(.top, 4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.top, 22)
        .padding(.horizontal, 22)
        .padding(.bottom, 18)
        .background(RoundedRectangle(cornerRadius: Duet.rHero).fill(theme.hero))
        .clipShape(RoundedRectangle(cornerRadius: Duet.rHero))
        .padding(.horizontal, 16)
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.duetUI(10.5, .medium))
                .tracking(0.85)
                .foregroundColor(theme.ink.opacity(0.55))
            Text(value)
                .font(.duetUI(15, .bold))
                .foregroundColor(theme.ink)
                .monospacedDigit()
        }
    }
}

// MARK: - Hero, variante «Bento»

/// Hero compatta più quattro tessere.
///
/// Stessa struttura della «Foglio», altro compromesso: si perde la scala della
/// temperatura e si guadagnano quattro dati che altrimenti vivono dentro una
/// sezione da aprire. Chi guarda il meteo di sfuggita preferisce questa; chi lo
/// guarda per decidere qualcosa preferisce l'altra.
struct HeroBentoView: View {
    /// Ridisegna quando cambiano le unità: le funzioni di formattazione
    /// leggono `UnitPrefs.shared` ma non possono osservarlo.
    @ObservedObject private var units = UnitPrefs.shared
    let current: ForecastCurrent
    let today: DailyForecast?
    let astronomy: AstronomyData?
    let nextHour: ForecastNextHour?
    let condition: SkyCondition
    let theme: WeatherTheme

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
    ]

    var body: some View {
        VStack(spacing: 10) {
            heroTile

            LazyVGrid(columns: columns, spacing: 10) {
                tile(
                    label: "Prossima ora",
                    value: HeroText.nextHourVerdict(nextHour),
                    note: "nowcast al minuto",
                    fill: Color(hex: "E6EEF6")
                )
                tile(
                    label: "Vento",
                    value: HeroText.wind(current.windSpeed),
                    note: HeroText.windNote(current),
                    fill: Color(hex: "EAEEE6")
                )
                tile(
                    label: "UV",
                    value: HeroText.uv(current.uvIndex),
                    note: HeroText.uvNote(current.uvIndex),
                    fill: Color(hex: "FBEED2")
                )
                tile(
                    label: "Alba · tramonto",
                    value: HeroText.hour(astronomy?.sunset) ?? "—",
                    note: HeroText.hour(astronomy?.sunrise).map { "alba \($0)" } ?? "",
                    fill: Color(hex: "F1E7F1")
                )
            }
        }
        .padding(.horizontal, 16)
    }

    private var heroTile: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text("ADESSO")
                    .font(.duetUI(11, .medium))
                    .tracking(1.5)
                    .foregroundColor(theme.ink.opacity(0.65))

                Text(HeroText.temperature(current.temperature))
                    .font(.duetUI(66, .light))
                    .tracking(-2.5)
                    .foregroundColor(theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)

                Text(HeroText.bentoSummary(current: current, today: today))
                    .font(.duetUI(12.5, .bold))
                    .foregroundColor(theme.ink.opacity(0.85))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            Spacer(minLength: 8)

            Image(systemName: condition.heroSymbol)
                .font(.system(size: 74))
                .foregroundColor(theme.glyph)
                .accessibilityHidden(true)
        }
        .padding(.vertical, 18)
        .padding(.horizontal, 20)
        .background(RoundedRectangle(cornerRadius: Duet.rPanel).fill(theme.hero))
    }

    private func tile(label: String, value: String, note: String, fill: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.duetUI(10.5, .semibold))
                .tracking(0.95)
                .foregroundColor(Color(hex: "1E1E28").opacity(0.5))

            Text(value)
                .font(.duetUI(24, .bold))
                .tracking(-0.5)
                .foregroundColor(Color(hex: "26262E"))
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Text(note)
                .font(.duetUI(11.5, .medium))
                .foregroundColor(Color(hex: "26262E").opacity(0.55))
                .lineLimit(2)

            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 22).fill(fill))
    }
}

// MARK: - Testi dell'hero

/// Le frasi dell'hero, fuori dalle viste perché le usano entrambe le varianti
/// e perché così sono verificabili da un test senza costruire una `View`.
enum HeroText {

    static func temperature(_ value: Double?) -> String {
        Units.temp(value)
    }

    static func range(_ day: DailyForecast?) -> String {
        guard let day, let hi = day.tempMax, let lo = day.tempMin else { return "—" }
        return "\(Units.temp(hi)) / \(Units.temp(lo))"
    }

    /// La riga discorsiva dell'hero: condizione e, quando c'è, il vento.
    ///
    /// Deliberatamente corta — due righe al massimo. Il racconto lungo della
    /// giornata è un'altra cosa e sta altrove: qui serve la frase che si legge
    /// senza fermarsi.
    static func narrative(current: ForecastCurrent, condition: SkyCondition) -> String {
        let apertura: String
        switch condition {
        case .clear: apertura = "Sole pieno"
        case .cloudy: apertura = "Cielo coperto"
        case .rain: apertura = "Pioggia in arrivo"
        case .snow: apertura = "Neve in arrivo"
        case .storm: apertura = "Temporali in transito"
        }

        // La soglia degli 8 km/h resta in km/h: è il confine fra «aria calma»
        // e «si sente», e non cambia perché l'utente legge in nodi.
        guard let vento = current.windSpeed, vento * 3.6 >= 8 else {
            return "\(apertura), aria calma."
        }
        guard let direzione = current.windDirectionLabel else {
            return "\(apertura), \(Units.windSpeed(fromMs: vento)) di vento."
        }
        // La sigla resta maiuscola: «SSW» è un punto cardinale, «ssw» una
        // parola che non esiste.
        return "\(apertura), brezza da \(direzione.uppercased())."
    }

    static func bentoSummary(current: ForecastCurrent, today: DailyForecast?) -> String {
        var parti = ["Percepita \(temperature(current.feelsLike))"]
        if let day = today, let hi = day.tempMax, let lo = day.tempMin {
            parti.append("Max \(Units.temp(hi)) Min \(Units.temp(lo))")
        }
        return parti.joined(separator: " · ")
    }

    /// Asciutto o pioggia nella prossima ora, dal nowcast al minuto.
    static func nextHourVerdict(_ nextHour: ForecastNextHour?) -> String {
        let slots = upcomingMinutes(nextHour)
        guard !slots.isEmpty else { return "—" }
        return slots.contains { $0.chance >= WET_CHANCE } ? "Pioggia" : "Asciutto"
    }

    /// Soglia oltre la quale un minuto conta come bagnato.
    static let WET_CHANCE: Double = 50
    /// Minuti asciutti consecutivi prima di annunciare che la pioggia è finita.
    ///
    /// Tre e non uno: un solo minuto sotto soglia in mezzo a un rovescio è
    /// rumore del modello, e annunciare «smette adesso» a chi è sotto l'acqua
    /// è il modo più rapido di far disinstallare un'app meteo.
    static let DRY_RUN = 3

    /// Un minuto del nowcast, con quanto manca da adesso.
    struct MinuteSlot {
        let offset: Int
        let chance: Double
    }

    /// I minuti ancora futuri, con l'attesa calcolata sull'istante vero.
    ///
    /// L'indice nell'array non basta: il nowcast viaggia dentro la risposta in
    /// cache, che vale trenta minuti, quindi il primo elemento può essere di
    /// mezz'ora fa.
    static func upcomingMinutes(_ nextHour: ForecastNextHour?, now: Date = Date()) -> [MinuteSlot] {
        guard let minutes = nextHour?.minutes else { return [] }

        let conFrazioni = ISO8601DateFormatter()
        conFrazioni.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        return minutes.compactMap { minute in
            guard let istante = conFrazioni.date(from: minute.startTime)
                ?? ISO8601DateFormatter().date(from: minute.startTime) else { return nil }
            let offset = Int(istante.timeIntervalSince(now) / 60)
            guard offset >= 0 else { return nil }
            return MinuteSlot(offset: offset, chance: minute.precipitationChance)
        }
    }

    /// «Inizia a piovere fra 12 minuti» o «smette fra 20», o niente.
    ///
    /// Niente è il caso normale, ed è giusto così: una riga che dice «asciutto»
    /// ogni giorno sereno diventa invisibile, e quando serve davvero non la
    /// legge più nessuno.
    static func nowcastLine(_ nextHour: ForecastNextHour?, now: Date = Date()) -> String? {
        let slots = upcomingMinutes(nextHour, now: now)
        guard slots.count > DRY_RUN else { return nil }

        let piovendo = slots[0].chance >= WET_CHANCE

        if piovendo {
            // Prima finestra di tre minuti asciutti consecutivi.
            for i in 0..<(slots.count - DRY_RUN) where slots[i...].prefix(DRY_RUN).allSatisfy({ $0.chance < WET_CHANCE }) {
                let fra = slots[i].offset
                return fra <= 1 ? "Sta smettendo" : "Smette fra \(fra) minuti"
            }
            return "Pioggia per tutta l'ora"
        }

        guard let inizio = slots.first(where: { $0.chance >= WET_CHANCE }) else { return nil }
        return inizio.offset <= 1 ? "Inizia a piovere adesso" : "Pioggia fra \(inizio.offset) minuti"
    }

    static func wind(_ msValue: Double?) -> String {
        Units.windSpeed(fromMs: msValue)
    }

    static func windNote(_ current: ForecastCurrent) -> String {
        var parti: [String] = []
        if let gust = current.windGust {
            // Senza unità: la riga sta sotto al vento, che l'unità ce l'ha già.
            parti.append("raffiche \(Units.windValue(fromMs: gust))")
        }
        if let direzione = current.windDirectionLabel {
            parti.append(direzione)
        }
        return parti.joined(separator: " · ")
    }

    static func uv(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int(value.rounded()))"
    }

    /// L'indice UV da solo non dice cosa fare: la fascia sì.
    static func uvNote(_ value: Double?) -> String {
        guard let value else { return "dato non disponibile" }
        switch Int(value.rounded()) {
        case ..<3: return "basso, nessuna protezione"
        case 3..<6: return "moderato, crema consigliata"
        case 6..<8: return "alto, evita le ore centrali"
        case 8..<11: return "molto alto, stai all'ombra"
        default: return "estremo, meglio non uscire"
        }
    }

    /// Ora da una data ISO o da una chiave locale: i provider non concordano
    /// sul formato, e l'astronomia arriva talvolta con il fuso e talvolta senza.
    static func hour(_ value: String?) -> String? {
        guard let value else { return nil }

        if value.count >= 16 {
            let start = value.index(value.startIndex, offsetBy: 11)
            let end = value.index(value.startIndex, offsetBy: 16)
            let candidato = String(value[start..<end])
            if candidato.contains(":") { return candidato }
        }

        // Formati brevi tipo «06:45 AM» di WorldWeatherOnline.
        if let range = value.range(of: #"\d{1,2}:\d{2}"#, options: .regularExpression) {
            return String(value[range])
        }
        return nil
    }
}
