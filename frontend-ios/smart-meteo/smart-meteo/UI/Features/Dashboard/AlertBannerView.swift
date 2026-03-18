import SwiftUI

/// Banner prominente per le allerte meteo, mostrato nella dashboard sopra il meteo corrente.
/// Tappando apre la modale con i dettagli completi.
struct AlertBannerView: View {
    let alerts: [WeatherAlert]
    let onTap: () -> Void

    private var highestSeverity: String {
        let rank = ["extreme": 4, "severe": 3, "moderate": 2, "minor": 1]
        return alerts.max(by: { (rank[$0.severity.lowercased()] ?? 0) < (rank[$1.severity.lowercased()] ?? 0) })?.severity ?? "moderate"
    }

    private var bannerColor: Color {
        switch highestSeverity.lowercased() {
        case "extreme": return Color(red: 0.85, green: 0.1, blue: 0.1)
        case "severe":  return Color(red: 0.95, green: 0.45, blue: 0.0)
        case "moderate": return Color(red: 0.9, green: 0.7, blue: 0.0)
        default:        return Color(red: 0.3, green: 0.55, blue: 0.95)
        }
    }

    private var bannerIcon: String {
        switch highestSeverity.lowercased() {
        case "extreme", "severe": return "exclamationmark.triangle.fill"
        case "moderate": return "exclamationmark.triangle"
        default: return "info.circle.fill"
        }
    }

    private var primaryAlert: WeatherAlert? {
        let rank = ["extreme": 4, "severe": 3, "moderate": 2, "minor": 1]
        return alerts.max(by: { (rank[$0.severity.lowercased()] ?? 0) < (rank[$1.severity.lowercased()] ?? 0) })
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Icona animata
                Image(systemName: bannerIcon)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.white)
                    .symbolEffect(.pulse, options: .repeating)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(alerts.count == 1 ? "Allerta Meteo" : "\(alerts.count) Allerte Meteo")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.white)

                        if let alert = primaryAlert {
                            Text(alert.severityLabel)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(bannerColor)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    Capsule().fill(Color.white.opacity(0.9))
                                )
                        }
                    }

                    if let alert = primaryAlert {
                        Text(alert.description.prefix(80) + (alert.description.count > 80 ? "..." : ""))
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.9))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.7))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(bannerColor)
                    .shadow(color: bannerColor.opacity(0.4), radius: 8, x: 0, y: 4)
            )
        }
        .buttonStyle(.plain)
    }
}
