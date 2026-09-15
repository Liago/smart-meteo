import SwiftUI

/// L'elenco delle allerte attive.
///
/// La barra colorata in cima a ogni card è l'unico elemento che fa capire la
/// gravità **prima** di leggere: in un elenco di tre allerte, sapere quale
/// guardare per prima conta più del testo di ognuna.
///
/// Riferimento: `ios Redisign/README.md`, schermata 5.
struct WeatherAlertsView: View {
    let alerts: [WeatherAlert]
    var theme: WeatherTheme = WeatherTheme.of(.clear)

    @Environment(\.dismiss) private var dismiss
    @State private var expandedAlertId: String?

    /// Le più gravi in cima: l'ordine di lettura deve seguire l'urgenza, non
    /// l'ordine in cui i provider hanno risposto.
    private var ordered: [WeatherAlert] {
        let rank = ["extreme": 0, "severe": 1, "moderate": 2, "minor": 3]
        return alerts.sorted {
            (rank[$0.severity.lowercased()] ?? 4) < (rank[$1.severity.lowercased()] ?? 4)
        }
    }

    var body: some View {
        ZStack {
            theme.page.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header

                    if alerts.isEmpty {
                        empty
                    } else {
                        ForEach(ordered) { alert in
                            AlertCardView(
                                alert: alert,
                                isExpanded: expandedAlertId == alert.id,
                                onTap: {
                                    HapticManager.light()
                                    withAnimation(Duet.section) {
                                        expandedAlertId = expandedAlertId == alert.id ? nil : alert.id
                                    }
                                }
                            )
                            .padding(.horizontal, 16)
                        }
                    }
                }
                .padding(.vertical, 16)
            }
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Button {
                HapticManager.light()
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.duetUI(16, .semibold))
                    .foregroundColor(theme.ink.opacity(0.8))
                    .frame(width: 38, height: 38)
                    .background(
                        RoundedRectangle(cornerRadius: 13).fill(Color.white.opacity(0.8))
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Chiudi")

            Text("Allerte")
                .font(.duetDisplay(26))
                .foregroundColor(Duet.ink)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
    }

    private var empty: some View {
        VStack(spacing: 10) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 40))
                .foregroundColor(Duet.green)

            Text("Nessuna allerta attiva")
                .font(.duetUI(14, .semibold))
                .foregroundColor(Duet.ink)

            Text("Le allerte arrivano dalla protezione civile e dai provider meteo, e compaiono qui appena vengono emesse.")
                .font(.duetUI(11.5))
                .foregroundColor(Duet.ink.opacity(0.5))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
}

// MARK: - Card

struct AlertCardView: View {
    let alert: WeatherAlert
    let isExpanded: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // La barra è lo stato di gravità reso leggibile di sfuggita.
            Rectangle()
                .fill(Self.severityColor(alert.severity))
                .frame(height: 5)

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(alert.severityLabel.uppercased())
                        .font(.duetUI(9.5, .heavy))
                        .tracking(0.95)
                        .foregroundColor(Self.severityColor(alert.severity))
                        .padding(.vertical, 4)
                        .padding(.horizontal, 9)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Self.severityTint(alert.severity))
                        )

                    if let area = alert.areaName {
                        Text(area)
                            .font(.duetUI(10.5, .semibold))
                            .foregroundColor(Duet.ink.opacity(0.45))
                            .lineLimit(1)
                    }

                    Spacer(minLength: 4)

                    Image(systemName: "chevron.down")
                        .font(.duetUI(11, .semibold))
                        .foregroundColor(Duet.ink.opacity(0.3))
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                }

                Text(Self.title(alert))
                    .font(.duetUI(14, .bold))
                    .foregroundColor(Duet.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)

                if !alert.description.isEmpty {
                    Text(alert.description)
                        .font(.duetUI(12))
                        .foregroundColor(Duet.ink.opacity(0.6))
                        .fixedSize(horizontal: false, vertical: true)
                        // Chiusa mostra tre righe: il bollettino della
                        // protezione civile è lungo, e un muro di testo in un
                        // elenco di allerte si salta invece di leggerlo.
                        .lineLimit(isExpanded ? nil : 3)
                }

                if let finestra = Self.window(alert) {
                    Text(finestra.uppercased())
                        .font(.duetUI(10.5, .semibold))
                        .tracking(0.6)
                        .foregroundColor(Duet.ink.opacity(0.38))
                }

                if isExpanded, let fonte = alert.source ?? alert.eventSource {
                    Text("Fonte: \(fonte)")
                        .font(.duetUI(10.5))
                        .foregroundColor(Duet.ink.opacity(0.38))
                }
            }
            .padding(16)
        }
        .background(RoundedRectangle(cornerRadius: 22).fill(Duet.surface))
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .shadow(color: Duet.shadowCard, radius: 12, x: 0, y: 2)
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }

    // MARK: - Testi

    /// Il titolo: l'evento quando c'è, altrimenti la gravità.
    ///
    /// `event` è in inglese sui feed EUMETNET («Yellow Thunderstorm Warning»),
    /// ma è quello che descrive il fenomeno: meglio una parola inglese esatta
    /// di un'etichetta italiana generica.
    static func title(_ alert: WeatherAlert) -> String {
        if let event = alert.event, !event.isEmpty { return event }
        if !alert.description.isEmpty { return alert.description }
        return "Allerta \(alert.severityLabel.lowercased())"
    }

    /// «fino alle 22:00 di oggi», o la finestra intera quando non è in corso.
    static func window(_ alert: WeatherAlert, now: Date = Date()) -> String? {
        guard let fine = parse(alert.expireTime) else { return nil }

        let inizio = parse(alert.effectiveTime)
        if let inizio, inizio > now {
            return "dalle \(clock(inizio)) alle \(clock(fine))"
        }
        return "fino alle \(clock(fine))"
    }

    private static func parse(_ iso: String) -> Date? {
        let conFrazioni = ISO8601DateFormatter()
        conFrazioni.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return conFrazioni.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    private static func clock(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "it_IT")
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }

    // MARK: - Colori

    static func severityColor(_ severity: String) -> Color {
        switch severity.lowercased() {
        case "extreme", "severe": return Duet.orangeRed
        case "moderate": return Duet.yellow
        default: return Color(hex: "2F7D7D")
        }
    }

    static func severityTint(_ severity: String) -> Color {
        switch severity.lowercased() {
        case "extreme", "severe": return Duet.tintOrange
        case "moderate": return Duet.tintYellow
        default: return Duet.tintTeal
        }
    }
}
