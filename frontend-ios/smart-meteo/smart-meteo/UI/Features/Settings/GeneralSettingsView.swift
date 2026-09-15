import SwiftUI

/// Impostazioni generali.
///
/// Ristilizzata sul linguaggio del ridisegno — e ripulita da **tre controlli
/// che non facevano niente**. Il selettore °C/°F, quello delle unità del vento
/// e l'interruttore «Email Alerts» erano legati a `.constant(...)`: si potevano
/// toccare, si muovevano, e non cambiava nulla. Un comando finto è peggio di un
/// comando assente — il primo fa credere di aver scelto qualcosa.
///
/// Al loro posto: le unità **dichiarate** (informazione vera), e i collegamenti
/// alle due cose che l'utente può davvero configurare.
///
/// Riferimento: `ios Redisign/README.md`, schermata 4.
struct GeneralSettingsView: View {
    @StateObject private var pushService = PushNotificationService.shared
    @State private var isForYouPresented = false

    var theme: WeatherTheme = WeatherTheme.of(.clear)

    var body: some View {
        ZStack {
            theme.page.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    card(title: "Personalizzazione") {
                        row(
                            "Sezione «Per te»",
                            note: "Quali schede vedi in dashboard, e in che ordine"
                        ) {
                            isForYouPresented = true
                        }

                        separator

                        NavigationLink(destination: AlertRulesView()) {
                            rowContent(
                                "Avvisi personali",
                                note: "Soglie su gelate, pioggia, vento, temporali"
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    card(title: "Notifiche") {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Allerte push")
                                    .font(.duetUI(13.5, .bold))
                                    .foregroundColor(Duet.ink)

                                Text(pushService.isAuthorized
                                     ? "Attive. Per disattivarle, Impostazioni di iOS"
                                     : "Tocca per consentire le notifiche")
                                    .font(.duetUI(11))
                                    .foregroundColor(Duet.ink.opacity(0.5))
                                    .fixedSize(horizontal: false, vertical: true)
                            }

                            Spacer(minLength: 8)

                            Toggle("", isOn: Binding(
                                get: { pushService.isAuthorized },
                                set: { nuovo in
                                    // Il consenso si revoca solo da iOS: un
                                    // interruttore che finge di spegnerle
                                    // lascerebbe l'utente convinto di averle
                                    // tolte mentre continuano ad arrivare.
                                    if nuovo { pushService.requestAuthorization() }
                                }
                            ))
                            .labelsHidden()
                            .tint(theme.accent)
                            .disabled(pushService.isAuthorized)
                        }
                        .padding(.vertical, 12)
                    }

                    card(title: "Unità") {
                        // Dichiarate, non scelte: l'app calcola e formatta tutto
                        // in gradi Celsius e km/h. Il giorno in cui i Fahrenheit
                        // esisteranno davvero, questa riga tornerà un comando.
                        infoRow("Temperatura", "Gradi Celsius")
                        separator
                        infoRow("Vento", "km/h")
                        separator
                        infoRow("Precipitazioni", "Millimetri")
                    }

                    card(title: "App") {
                        infoRow("Versione", Self.version)
                        separator
                        infoRow("Build", Self.build)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
        }
        .navigationTitle("Impostazioni")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isForYouPresented) {
            ForYouSettingsView()
        }
    }

    // MARK: - Mattoni

    private func card<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(.duetUI(10.5, .semibold))
                .tracking(1.2)
                .foregroundColor(Duet.ink.opacity(0.45))
                .padding(.horizontal, 4)

            VStack(spacing: 0) {
                content()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 24).fill(Duet.surface))
            .shadow(color: Duet.shadowCard, radius: 10, x: 0, y: 2)
        }
    }

    private var separator: some View {
        Rectangle()
            .fill(Duet.ink.opacity(0.06))
            .frame(height: 1)
    }

    private func row(_ title: String, note: String, action: @escaping () -> Void) -> some View {
        Button {
            HapticManager.light()
            action()
        } label: {
            rowContent(title, note: note)
        }
        .buttonStyle(.plain)
    }

    private func rowContent(_ title: String, note: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.duetUI(13.5, .bold))
                    .foregroundColor(Duet.ink)
                Text(note)
                    .font(.duetUI(11))
                    .foregroundColor(Duet.ink.opacity(0.5))
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)
            }

            Spacer(minLength: 8)

            Image(systemName: "chevron.right")
                .font(.duetUI(12, .semibold))
                .foregroundColor(Duet.ink.opacity(0.25))
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private func infoRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .font(.duetUI(13))
                .foregroundColor(Duet.ink)

            Spacer(minLength: 8)

            Text(value)
                .font(.duetUI(13, .semibold))
                .foregroundColor(Duet.ink.opacity(0.5))
        }
        .padding(.vertical, 12)
    }

    // MARK: - Versione

    /// Letta dal bundle, non scritta a mano.
    ///
    /// Prima erano due stringhe fisse («1.0.2», «2024.11.20»): diventano
    /// sbagliate alla prima build e nessuno se ne accorge, perché nessuno
    /// guarda la schermata «App info» finché non deve segnalare un problema —
    /// che è esattamente il momento in cui quel numero deve essere giusto.
    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
    }

    static var build: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
    }
}

#Preview {
    NavigationStack {
        GeneralSettingsView()
    }
}
