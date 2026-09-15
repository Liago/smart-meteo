import SwiftUI

/// Il menu laterale.
///
/// Ristilizzato sul linguaggio della schermata Impostazioni: sfondo crema,
/// etichette di gruppo in maiuscoletto spaziato, righe dentro una card bianca.
/// Prima erano righe nude su fondo crema con una fascia grigia in testa, in SF
/// Pro: la stessa app in due tipografie, e la sidebar era la prima cosa che si
/// apriva.
struct SidebarView: View {
    @EnvironmentObject var appState: AppState
    @Binding var isPresented: Bool
    @State private var showingLogin = false

    var theme: WeatherTheme = WeatherTheme.of(.clear)

    var body: some View {
        ZStack {
            theme.page.ignoresSafeArea()

            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        if appState.isAuthenticated {
                            account
                        }

                        SettingsCard("Meteo") {
                            NavigationLink(destination: SourcesView(theme: theme)) {
                                SettingsRowContent(
                                    title: "Gestione fonti",
                                    note: "Quali provider entrano nella media",
                                    icon: "antenna.radiowaves.left.and.right"
                                )
                            }
                            .buttonStyle(.plain)

                            SettingsSeparator()

                            NavigationLink(
                                destination: FavoritesView(
                                    isSidebarPresented: $isPresented,
                                    theme: theme
                                )
                            ) {
                                SettingsRowContent(
                                    title: "Località preferite",
                                    note: "I luoghi salvati, e quello di casa",
                                    icon: "star"
                                )
                            }
                            .buttonStyle(.plain)

                            SettingsSeparator()

                            NavigationLink(destination: AlertRulesView()) {
                                SettingsRowContent(
                                    title: "Avvisi personali",
                                    note: "Soglie su gelate, pioggia, vento",
                                    icon: "bell"
                                )
                            }
                            .buttonStyle(.plain)
                        }

                        SettingsCard("App") {
                            NavigationLink(destination: GeneralSettingsView(theme: theme)) {
                                SettingsRowContent(
                                    title: "Impostazioni",
                                    note: "Unità di misura, notifiche, schede",
                                    icon: "gearshape"
                                )
                            }
                            .buttonStyle(.plain)

                            if appState.isAuthenticated {
                                SettingsSeparator()

                                SettingsRow(
                                    title: "Esci",
                                    icon: "rectangle.portrait.and.arrow.right",
                                    tint: Duet.orangeRed,
                                    showsChevron: false
                                ) {
                                    Task { try? await AuthService.shared.signOut() }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 60)
                    .padding(.bottom, 16)
                }

                if !appState.isAuthenticated {
                    loginButton
                }

                footer
            }
        }
        .sheet(isPresented: $showingLogin) {
            LoginView(theme: theme)
        }
    }

    // MARK: - Account

    /// Chi sei, quando l'app lo sa.
    ///
    /// Il badge «Premium» è sparito: era scritto a mano su ogni utente
    /// autenticato, quindi non diceva niente di vero — e un'etichetta che
    /// afferma un piano che non esiste è peggio di nessuna etichetta.
    private var account: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 38))
                .foregroundColor(theme.accent.opacity(0.85))

            VStack(alignment: .leading, spacing: 2) {
                Text(appState.currentUser?.email ?? "Utente")
                    .font(.duetUI(13.5, .bold))
                    .foregroundColor(Duet.ink)
                    .lineLimit(1)
                    .truncationMode(.middle)

                Text("Preferite e località sincronizzate")
                    .font(.duetUI(11))
                    .foregroundColor(Duet.ink.opacity(0.5))
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 24).fill(Duet.surface))
        .shadow(color: Duet.shadowCard, radius: 10, x: 0, y: 2)
    }

    private var loginButton: some View {
        Button {
            HapticManager.light()
            showingLogin = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "person.crop.circle.badge.plus")
                    .font(.duetUI(15, .semibold))
                Text("Accedi")
                    .font(.duetUI(14, .bold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(RoundedRectangle(cornerRadius: Duet.rSmall).fill(theme.accent))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }

    /// Versione e build dal bundle, come nella schermata Impostazioni.
    ///
    /// Erano «v1.0.2» e «Build 2024.11.20» scritte a mano: sbagliate dalla
    /// prima build successiva, e in due punti diversi dell'app — quindi
    /// sbagliate in due modi diversi.
    private var footer: some View {
        VStack(spacing: 2) {
            Text("Smart Meteo \(GeneralSettingsView.version)")
                .font(.duetUI(10.5, .semibold))
                .foregroundColor(Duet.ink.opacity(0.4))

            Text("Build \(GeneralSettingsView.build)")
                .font(.duetUI(10))
                .foregroundColor(Duet.ink.opacity(0.28))
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 24)
    }
}

#Preview {
    NavigationStack {
        SidebarView(isPresented: .constant(true))
            .environmentObject(AppState.shared)
    }
}
