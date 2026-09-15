import SwiftUI

/// Impostazioni generali.
///
/// La card «Unità» era informativa — tre righe che **dichiaravano** °C, km/h e
/// millimetri — perché i selettori precedenti erano legati a `.constant(...)`:
/// si muovevano e non cambiavano niente, e un comando finto è peggio di un
/// comando assente. Ora sono comandi veri: `UnitPrefs` persiste la scelta e
/// tutto ciò che scrive un numero passa da `Units`.
///
/// Riferimento: `ios Redisign/README.md`, schermata 4.
struct GeneralSettingsView: View {
    @StateObject private var pushService = PushNotificationService.shared
    @ObservedObject private var units = UnitPrefs.shared
    @State private var isForYouPresented = false

    var theme: WeatherTheme = WeatherTheme.of(.clear)

    var body: some View {
        SettingsPage(theme: theme) {
            SettingsCard("Personalizzazione") {
                SettingsRow(
                    title: "Sezione «Per te»",
                    note: "Quali schede vedi in dashboard, e in che ordine"
                ) {
                    isForYouPresented = true
                }

                SettingsSeparator()

                NavigationLink(destination: AlertRulesView()) {
                    SettingsRowContent(
                        title: "Avvisi personali",
                        note: "Soglie su gelate, pioggia, vento, temporali"
                    )
                }
                .buttonStyle(.plain)
            }

            SettingsCard("Notifiche") {
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
                            // interruttore che finge di spegnerle lascerebbe
                            // l'utente convinto di averle tolte mentre
                            // continuano ad arrivare.
                            if nuovo { pushService.requestAuthorization() }
                        }
                    ))
                    .labelsHidden()
                    .tint(theme.accent)
                    .disabled(pushService.isAuthorized)
                }
                .padding(.vertical, 12)
            }

            SettingsCard("Unità") {
                // `Menu` e non `Picker(.segmented)`: quattro unità di vento non
                // stanno in una barra segmentata senza abbreviarle fino a
                // renderle indovinelli, e il valore corrente resta leggibile
                // anche a menu chiuso.
                unitRow(
                    "Temperatura",
                    selection: $units.temperature,
                    options: TemperatureUnit.allCases,
                    label: { "\($0.label) (\($0.short))" },
                    short: { $0.short }
                )

                SettingsSeparator()

                unitRow(
                    "Vento",
                    selection: $units.wind,
                    options: WindUnit.allCases,
                    label: { "\($0.label) (\($0.short))" },
                    short: { $0.short }
                )

                SettingsSeparator()

                unitRow(
                    "Precipitazioni",
                    selection: $units.precipitation,
                    options: PrecipitationUnit.allCases,
                    label: { "\($0.label) (\($0.short))" },
                    short: { $0.short }
                )
            }

            SettingsCard("App") {
                SettingsInfoRow(title: "Versione", value: Self.version)
                SettingsSeparator()
                SettingsInfoRow(title: "Build", value: Self.build)
            }
        }
        .navigationTitle("Impostazioni")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isForYouPresented) {
            ForYouSettingsView()
        }
    }

    // MARK: - Riga di scelta

    /// Etichetta a sinistra, unità corrente e chevron a destra, menu al tocco.
    ///
    /// Generica sui tre enum invece di tre copie: sono la stessa riga con tre
    /// elenchi diversi, e tre copie sarebbero divergute alla prima modifica.
    private func unitRow<Unit: Hashable & Identifiable>(
        _ title: String,
        selection: Binding<Unit>,
        options: [Unit],
        label: @escaping (Unit) -> String,
        short: @escaping (Unit) -> String
    ) -> some View {
        Menu {
            Picker(title, selection: selection) {
                ForEach(options) { option in
                    Text(label(option)).tag(option)
                }
            }
        } label: {
            HStack {
                Text(title)
                    .font(.duetUI(13))
                    .foregroundColor(Duet.ink)

                Spacer(minLength: 8)

                Text(short(selection.wrappedValue))
                    .font(.duetUI(13, .semibold))
                    .foregroundColor(theme.accent)

                Image(systemName: "chevron.up.chevron.down")
                    .font(.duetUI(10, .semibold))
                    .foregroundColor(Duet.ink.opacity(0.3))
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .accessibilityLabel("\(title): \(label(selection.wrappedValue))")
        .accessibilityHint("Tocca per cambiare unità")
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
