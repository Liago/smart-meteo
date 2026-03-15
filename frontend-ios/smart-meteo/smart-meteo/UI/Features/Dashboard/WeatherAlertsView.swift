import SwiftUI

// MARK: - Lista allerte meteo (modale)
struct WeatherAlertsView: View {
    let alerts: [WeatherAlert]
    @Environment(\.dismiss) private var dismiss
    @State private var expandedAlertId: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Icona header
                    VStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 44))
                            .foregroundColor(.orange)

                        Text("\(alerts.count) Allert\(alerts.count == 1 ? "a" : "e") Meteo")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(.primary)
                    }
                    .padding(.top, 8)

                    if alerts.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "checkmark.circle")
                                .font(.system(size: 48))
                                .foregroundColor(.green)
                            Text("Nessuna allerta attiva")
                                .font(.headline)
                                .foregroundColor(.secondary)
                        }
                        .padding(.top, 40)
                    } else {
                        ForEach(alerts) { alert in
                            WeatherAlertCard(
                                alert: alert,
                                isExpanded: expandedAlertId == alert.id,
                                onTap: {
                                    withAnimation(.easeInOut(duration: 0.25)) {
                                        expandedAlertId = expandedAlertId == alert.id ? nil : alert.id
                                    }
                                }
                            )
                        }
                    }
                }
                .padding()
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }
}

// MARK: - Card singola allerta
struct WeatherAlertCard: View {
    let alert: WeatherAlert
    let isExpanded: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header card
            Button(action: onTap) {
                HStack(spacing: 12) {
                    // Icona severity
                    Image(systemName: alert.severityIcon)
                        .font(.title2)
                        .foregroundColor(Color(
                            red: alert.severityColor.red,
                            green: alert.severityColor.green,
                            blue: alert.severityColor.blue
                        ))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(alert.source ?? alert.eventSource ?? "Allerta Meteo")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.primary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        HStack(spacing: 6) {
                            Text(alert.severityLabel)
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(
                                    Capsule().fill(Color(
                                        red: alert.severityColor.red,
                                        green: alert.severityColor.green,
                                        blue: alert.severityColor.blue
                                    ))
                                )

                            if let area = alert.areaName {
                                Text(area)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(16)
            }
            .buttonStyle(.plain)

            // Dettaglio espanso
            if isExpanded {
                Divider()
                    .padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 12) {
                    // Descrizione
                    Text(alert.description)
                        .font(.subheadline)
                        .foregroundColor(.primary)
                        .fixedSize(horizontal: false, vertical: true)

                    // Tempi
                    VStack(alignment: .leading, spacing: 6) {
                        alertTimeRow(label: "Inizio", time: alert.effectiveTime)
                        alertTimeRow(label: "Scadenza", time: alert.expireTime)
                    }

                    // Info aggiuntive
                    if let certainty = alert.certainty {
                        HStack {
                            Text("Certezza:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(certaintyLabel(certainty))
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                    }

                    if let urgency = alert.urgency {
                        HStack {
                            Text("Urgenza:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(urgencyLabel(urgency))
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                    }
                }
                .padding(16)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private func alertTimeRow(label: String, time: String) -> some View {
        HStack {
            Text("\(label):")
                .font(.caption)
                .foregroundColor(.secondary)
            Text(formatAlertTime(time))
                .font(.caption)
                .fontWeight(.medium)
        }
    }

    private func formatAlertTime(_ isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: isoString) ?? ISO8601DateFormatter().date(from: isoString)
        guard let date else { return isoString }

        let display = DateFormatter()
        display.locale = Locale(identifier: "it_IT")
        display.dateFormat = "d MMM, HH:mm"
        return display.string(from: date)
    }

    private func certaintyLabel(_ value: String) -> String {
        switch value.lowercased() {
        case "observed": return "Osservata"
        case "likely": return "Probabile"
        case "possible": return "Possibile"
        case "unlikely": return "Improbabile"
        default: return value.capitalized
        }
    }

    private func urgencyLabel(_ value: String) -> String {
        switch value.lowercased() {
        case "immediate": return "Immediata"
        case "expected": return "Prevista"
        case "future": return "Futura"
        default: return value.capitalized
        }
    }
}
