import SwiftUI

/// Tramonti e cielo notturno.
///
/// Gemello di `SkyPanel.tsx`. Nasce da un'osservazione che la copertura
/// nuvolosa totale non riesce a esprimere: un tramonto memorabile vuole nuvole
/// **alte** — cirri, che prendono la luce da sotto quando il sole è già sceso —
/// e l'orizzonte libero perché quella luce ci arrivi. Un cielo terso e uno
/// coperto danno entrambi un tramonto ordinario, per ragioni opposte, e un solo
/// numero di copertura li confonde.
struct SkyPanelView: View {
    let sky: SkyOutlook

    // MARK: - Etichette

    static let levelLabels = [
        "plain": "Ordinario",
        "fair": "Discreto",
        "good": "Bello",
        "excellent": "Spettacolare",
    ]

    /// Per la notte le stesse fasce vogliono parole diverse.
    static let nightLabels = [
        "plain": "Cielo chiuso",
        "fair": "Discreta",
        "good": "Buona",
        "excellent": "Ottima",
    ]

    static let levelColors: [String: Color] = [
        "plain": Color.gray.opacity(0.5),
        "fair": Color(hex: "7FA8C4"),
        "good": Color(hex: "F5A623"),
        "excellent": Color(hex: "E8632A"),
    ]

    /// Ordine di gravità, per decidere che cosa mettere in cima.
    private static let rank = ["excellent": 3, "good": 2, "fair": 1, "plain": 0]

    // MARK: - Formattazione

    /// Ora dello slot, dalla chiave locale `YYYY-MM-DDTHH:00`.
    ///
    /// Si legge dai caratteri invece che con `ISO8601DateFormatter`: il backend
    /// garantisce il formato già in ora locale della località, e parsarlo come
    /// data lo sposterebbe nel fuso del dispositivo.
    static func formatHour(_ slot: String?) -> String? {
        guard let slot, slot.count >= 16 else { return nil }
        let start = slot.index(slot.startIndex, offsetBy: 11)
        let end = slot.index(slot.startIndex, offsetBy: 16)
        let hour = String(slot[start..<end])
        return hour.contains(":") ? hour : nil
    }

    /// Il prossimo evento solare fra alba e tramonto, quello che c'è.
    static func nextSolarEvent(_ sky: SkyOutlook) -> (event: SkyEvent, isSunset: Bool)? {
        if let sunset = sky.sunset, let sunrise = sky.sunrise {
            // Il primo in ordine di tempo: è quello che l'utente vedrà per primo.
            return sunset.at <= sunrise.at ? (sunset, true) : (sunrise, false)
        }
        if let sunset = sky.sunset { return (sunset, true) }
        if let sunrise = sky.sunrise { return (sunrise, false) }
        return nil
    }

    /// La riga in cima: vince l'indice più alto fra il solare e la notte.
    ///
    /// Con un titolo fisso sul tramonto, una notte eccezionale sotto un tramonto
    /// ordinario resterebbe invisibile — ed è proprio il caso che fa aprire il
    /// pannello.
    static func headline(_ sky: SkyOutlook) -> String {
        let solar = nextSolarEvent(sky)
        let night = sky.stargazing

        let solarRank = solar.map { rank[$0.event.level] ?? 0 } ?? -1
        let nightRank = night.map { rank[$0.level] ?? 0 } ?? -1

        if solarRank >= nightRank, let solar {
            let nome = solar.isSunset ? "Tramonto" : "Alba"
            let giudizio = (levelLabels[solar.event.level] ?? solar.event.level).lowercased()
            if let quando = formatHour(solar.event.at) {
                return "\(nome) \(giudizio) verso le \(quando)"
            }
            return "\(nome) \(giudizio)"
        }

        if let night {
            let giudizio = (nightLabels[night.level] ?? night.level).lowercased()
            return "Notte \(giudizio) per le stelle"
        }
        return "Nessuna previsione sul cielo"
    }

    /// Perché la notte è (o non è) buona: nuvole e luna, i due ingredienti.
    ///
    /// Senza, il giudizio sarebbe un verdetto senza appello.
    static func stargazingReason(_ night: StargazingOutlook) -> String {
        let nuvole: String
        if night.cloudCover <= 20 {
            nuvole = "cielo terso"
        } else if night.cloudCover >= 70 {
            nuvole = "cielo coperto"
        } else {
            nuvole = "\(Int(night.cloudCover.rounded()))% di nuvole"
        }

        guard let illum = night.moonIllumination else { return nuvole }

        let luna: String
        if illum <= 15 {
            luna = "luna quasi nuova"
        } else if illum >= 85 {
            luna = "luna piena"
        } else {
            luna = "luna al \(Int(illum.rounded()))%"
        }
        return "\(nuvole), \(luna)"
    }

    // MARK: - Body

    var body: some View {
        let solar = Self.nextSolarEvent(sky)
        let night = sky.stargazing

        // Senza nessuno dei due indici non c'è riquadro da mostrare.
        if solar != nil || night != nil {
            let headlineLevel = solar?.event.level ?? night?.level ?? "plain"

            GlassContainer {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Image(systemName: "moon.stars.fill")
                            .font(.system(size: 13))
                            .foregroundColor(.gray)

                        Text("Cielo")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.black)

                        Spacer(minLength: 0)

                        Circle()
                            .fill(Self.levelColors[headlineLevel] ?? Color.gray)
                            .frame(width: 8, height: 8)
                    }

                    Text(Self.headline(sky))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.black)

                    VStack(alignment: .leading, spacing: 6) {
                        if let solar {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text(solar.isSunset ? "Tramonto" : "Alba")
                                    .font(.system(size: 12))
                                    .foregroundColor(.gray)

                                Spacer(minLength: 0)

                                if let quando = Self.formatHour(solar.event.at) {
                                    Text(quando)
                                        .font(.system(size: 11))
                                        .foregroundColor(.gray.opacity(0.8))
                                        .monospacedDigit()
                                }

                                Text(Self.levelLabels[solar.event.level] ?? solar.event.level)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(Self.levelColors[solar.event.level] ?? .black)
                            }
                        }

                        if let night {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text("Stelle stanotte")
                                    .font(.system(size: 12))
                                    .foregroundColor(.gray)

                                Spacer(minLength: 0)

                                Text(Self.stargazingReason(night))
                                    .font(.system(size: 11))
                                    .foregroundColor(.gray.opacity(0.8))

                                Text(Self.nightLabels[night.level] ?? night.level)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(Self.levelColors[night.level] ?? .black)
                            }
                        }
                    }

                    Text("I tramonti migliori nascono da nuvole alte con l'orizzonte libero.")
                        .font(.system(size: 10))
                        .foregroundColor(.gray.opacity(0.8))
                }
            }
        }
    }
}
