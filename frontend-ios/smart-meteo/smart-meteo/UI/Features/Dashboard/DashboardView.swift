import SwiftUI

/// La dashboard ridisegnata.
///
/// Prima erano tredici pannelli impilati nello stesso ordine fisso, tutti con
/// lo stesso peso visivo: nowcast, neve, meteo corrente, orario, orto, solare,
/// cielo, mare, attività, pollini, giorni, fonti. Nessuna gerarchia, e i
/// pannelli che interessano a *qualcuno* sepolti a metà dello scroll per
/// *tutti*.
///
/// Ora c'è una gerarchia sola: **la condizione in corso** — a tutta tinta, con
/// la temperatura in serif — e sotto un unico foglio bianco con quattro sezioni
/// che si aprono e si chiudono. Tutto ciò che riguarda solo alcuni utenti
/// (orto, fotovoltaico, cielo, mare, attività, pollini, neve) è finito dentro
/// «Per te», dove l'utente decide cosa vedere.
///
/// Riferimento: `ios Redisign/README.md`.
struct DashboardView: View {
    @EnvironmentObject var appState: AppState

    // Navigazione
    @State private var isSidebarPresented = false
    @State private var isSearchPresented = false
    @State private var isAlertsPresented = false
    @State private var isForYouSettingsPresented = false
    @State private var precipTarget: PrecipTarget?

    // Stato della dashboard
    @State private var openSections: Set<DashboardSection> = [.hourly, .daily, .forYou]
    @State private var openCard: ForYouKey?
    @State private var scrubIndex: Int = 0

    // Preferenze
    @AppStorage(ForYouPrefs.enabledKey) private var enabledRaw: String = ForYouPrefs.defaultEnabledRaw
    @AppStorage(ForYouPrefs.orderKey) private var orderRaw: String = ForYouPrefs.defaultOrderRaw
    @AppStorage(DashboardPrefs.heroVariantKey) private var heroVariantRaw: String = HeroVariant.sheet.rawValue
    @AppStorage("smart-meteo-pv-kwp") private var plantKwp: Double = 0

    /// Wrapper Identifiable: serve a `.sheet(item:)` perché la data va passata al foglio.
    private struct PrecipTarget: Identifiable {
        let id: String // "yyyy-MM-dd"
    }

    enum DashboardSection: Hashable {
        case hourly, daily, forYou, sources
    }

    // MARK: - Derivati

    private var currentForecast: ForecastResponse? {
        if case .success(let forecast) = appState.weatherState { return forecast }
        return nil
    }

    private var condition: SkyCondition {
        SkyCondition.from(currentForecast?.current)
    }

    private var theme: WeatherTheme { WeatherTheme.of(condition) }

    private var heroVariant: HeroVariant {
        HeroVariant(rawValue: heroVariantRaw) ?? .sheet
    }

    private var isCurrentLocationHome: Bool {
        appState.homeLocation?.name == appState.currentLocationName
    }

    private var isCurrentLocationFavorite: Bool {
        appState.isFavorite(name: appState.currentLocationName)
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                theme.page
                    .ignoresSafeArea()
                    .animation(Duet.themeChange, value: condition)

                ScrollView {
                    VStack(spacing: 14) {
                        header

                        switch appState.weatherState {
                        case .idle:
                            placeholder("In attesa della località…")
                        case .loading:
                            loading
                        case .success(let forecast):
                            content(forecast)
                        case .error(let error):
                            errorBox(error)
                        }
                    }
                    .padding(.bottom, 40)
                }
                .refreshable {
                    HapticManager.medium()
                    if let location = appState.currentLocation {
                        appState.fetchWeather(for: location)
                    }
                }

                sidebarOverlay
            }
        }
        .sheet(isPresented: $isSearchPresented) {
            SearchView()
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $isAlertsPresented) {
            WeatherAlertsView(alerts: appState.activeAlerts)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $isForYouSettingsPresented) {
            ForYouSettingsView()
        }
        .sheet(item: $precipTarget) { target in
            // Solo .large: due grafici impilati più la strip dei giorni
            // verrebbero tagliati a .medium.
            HourlyDetailView(
                hourly: currentForecast?.hourly ?? [],
                daily: currentForecast?.daily,
                initialDate: target.id
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .onReceive(appState.$showAlertsModal) { show in
            if show {
                isAlertsPresented = true
                appState.showAlertsModal = false
            }
        }
        // Cambiando località il dito resta dov'era ma le ore no: senza questo,
        // la sparkline si aprirebbe su un'ora della località precedente.
        .onChange(of: appState.currentLocationName) { _, _ in
            scrubIndex = 0
            openCard = nil
        }
    }

    // MARK: - Intestazione

    private var header: some View {
        DashboardHeaderView(
            locationName: appState.currentLocationName,
            isHome: isCurrentLocationHome,
            subtitle: subtitle,
            theme: theme,
            onSearch: { isSearchPresented = true },
            onSettings: { withAnimation { isSidebarPresented = true } }
        )
        .padding(.top, 6)
        .contextMenu {
            Button {
                HapticManager.selection()
                appState.toggleFavorite()
            } label: {
                Label(
                    isCurrentLocationFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti",
                    systemImage: isCurrentLocationFavorite ? "star.slash" : "star"
                )
            }

            if isCurrentLocationFavorite {
                Button {
                    HapticManager.selection()
                    if let fav = appState.favoriteLocations.first(where: { $0.name == appState.currentLocationName }) {
                        appState.setAsHome(location: fav)
                    }
                } label: {
                    Label(
                        isCurrentLocationHome ? "Rimuovi come Casa" : "Imposta come Casa",
                        systemImage: isCurrentLocationHome ? "house.slash" : "house"
                    )
                }
            }
        }
    }

    /// «aggiornato 2 min fa · 5 fonti».
    private var subtitle: String {
        guard let forecast = currentForecast else { return "in aggiornamento…" }

        let fonti = "\(forecast.sourcesUsed.count) font\(forecast.sourcesUsed.count == 1 ? "e" : "i")"
        guard let quando = Self.relativeUpdate(forecast.generatedAt) else { return fonti }
        return "\(quando) · \(fonti)"
    }

    // MARK: - Contenuto

    @ViewBuilder
    private func content(_ forecast: ForecastResponse) -> some View {
        if !appState.activeAlerts.isEmpty {
            AlertPillView(alerts: appState.activeAlerts) {
                isAlertsPresented = true
            }
        }

        hero(forecast)

        SectionSheet {
            hourlySection(forecast)
            SectionDivider()
            dailySection(forecast)
            SectionDivider()
            forYouSection(forecast)
            SectionDivider()
            sourcesSection(forecast)
        }
    }

    @ViewBuilder
    private func hero(_ forecast: ForecastResponse) -> some View {
        switch heroVariant {
        case .sheet:
            HeroSheetView(
                current: forecast.current,
                today: forecast.daily?.first,
                nextHour: forecast.forecastNextHour,
                condition: condition,
                theme: theme
            )
        case .bento:
            HeroBentoView(
                current: forecast.current,
                today: forecast.daily?.first,
                astronomy: forecast.astronomy,
                nextHour: forecast.forecastNextHour,
                condition: condition,
                theme: theme
            )
        }
    }

    // MARK: - Sezioni

    @ViewBuilder
    private func hourlySection(_ forecast: ForecastResponse) -> some View {
        let hours = Self.upcomingHours(forecast)

        CollapsibleSection(
            title: "Ora per ora",
            summary: Self.hourlySummary(hours),
            isOpen: binding(for: .hourly)
        ) {
            if hours.count > 1 {
                HourlySparklineView(
                    hours: hours,
                    theme: theme,
                    scrubIndex: $scrubIndex,
                    onOpenDetail: {
                        precipTarget = PrecipTarget(id: HourlyForecastView.openingDate(for: forecast.hourly ?? []))
                    }
                )
            } else {
                Text("Dati orari non disponibili per questa località")
                    .font(.duetUI(12))
                    .foregroundColor(Duet.ink.opacity(0.5))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private func dailySection(_ forecast: ForecastResponse) -> some View {
        let days = forecast.daily ?? []

        CollapsibleSection(
            title: "Prossimi giorni",
            summary: days.isEmpty ? nil : "\(min(days.count, 7)) giorni",
            isOpen: binding(for: .daily)
        ) {
            if days.isEmpty {
                Text("Previsione a più giorni non disponibile")
                    .font(.duetUI(12))
                    .foregroundColor(Duet.ink.opacity(0.5))
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                DailyRowsView(days: days) { date in
                    precipTarget = PrecipTarget(id: date)
                }
            }
        }
    }

    @ViewBuilder
    private func forYouSection(_ forecast: ForecastResponse) -> some View {
        let cards = ForYouBuilder.cards(
            forecast: forecast,
            order: ForYouPrefs.order(orderRaw),
            enabled: Set(ForYouPrefs.keys(enabledRaw)),
            plantKwp: plantKwp > 0 ? plantKwp : nil
        )

        CollapsibleSection(
            title: "Per te",
            summary: cards.isEmpty ? nil : "\(cards.count) sched\(cards.count == 1 ? "a" : "e")",
            isOpen: binding(for: .forYou)
        ) {
            if cards.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Nessuna scheda da mostrare adesso.")
                        .font(.duetUI(12))
                        .foregroundColor(Duet.ink.opacity(0.5))

                    Button {
                        HapticManager.light()
                        isForYouSettingsPresented = true
                    } label: {
                        Text("Scegli le schede")
                            .font(.duetUI(11.5, .bold))
                            .foregroundColor(theme.accent)
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ForYouSectionView(
                    cards: cards,
                    openCard: $openCard,
                    onCustomise: {
                        HapticManager.light()
                        isForYouSettingsPresented = true
                    }
                )
            }
        }
    }

    @ViewBuilder
    private func sourcesSection(_ forecast: ForecastResponse) -> some View {
        CollapsibleSection(
            title: "Fonti dati",
            summary: SourcesSectionView.summary(
                sources: forecast.sourcesUsed,
                confidence: forecast.confidence
            ),
            summaryColor: forecast.confidence.map { SourcesSectionView.levelColor($0.level) } ?? Duet.ink.opacity(0.45),
            isOpen: binding(for: .sources)
        ) {
            SourcesSectionView(
                sources: forecast.sourcesUsed,
                confidence: forecast.confidence
            )
        }
    }

    private func binding(for section: DashboardSection) -> Binding<Bool> {
        Binding(
            get: { openSections.contains(section) },
            set: { isOpen in
                if isOpen { openSections.insert(section) } else { openSections.remove(section) }
            }
        )
    }

    // MARK: - Stati non riusciti

    private func placeholder(_ text: String) -> some View {
        Text(text)
            .font(.duetUI(13))
            .foregroundColor(Duet.ink.opacity(0.5))
            .frame(maxWidth: .infinity)
            .padding(.top, 120)
    }

    private var loading: some View {
        VStack(spacing: 14) {
            ProgressView()
                .scaleEffect(1.2)
                .tint(theme.accent)

            Text(appState.currentLocationName)
                .font(.duetUI(15, .semibold))
                .foregroundColor(Duet.ink)

            Text("Caricamento previsioni…")
                .font(.duetUI(12))
                .foregroundColor(Duet.ink.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 120)
    }

    private func errorBox(_ error: Error) -> some View {
        VStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 26))
                .foregroundColor(Duet.yellow)

            Text(error.localizedDescription)
                .font(.duetUI(13))
                .foregroundColor(Duet.ink)
                .multilineTextAlignment(.center)

            Button("Riprova") {
                if let location = appState.currentLocation {
                    appState.fetchWeather(for: location)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(theme.accent)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: Duet.rCard).fill(Duet.surface)
        )
        .padding(.horizontal, 16)
        .padding(.top, 50)
    }

    @ViewBuilder
    private var sidebarOverlay: some View {
        if isSidebarPresented {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture {
                    withAnimation { isSidebarPresented = false }
                }

            HStack(spacing: 0) {
                SidebarView(isPresented: $isSidebarPresented)
                    .frame(width: UIScreen.main.bounds.width * 0.85)
                    .transition(.move(edge: .leading))

                Spacer()
            }
            .ignoresSafeArea()
            .zIndex(2)
        }
    }

    // MARK: - Dati derivati

    /// Le ore da adesso in avanti, **nell'ora della località**.
    ///
    /// Il fuso conta: le chiavi di `hourly` sono locali, e confrontarle con
    /// l'ora del telefono farebbe partire il grafico dall'ora sbagliata per
    /// chiunque guardi una località in un altro fuso.
    static func upcomingHours(_ forecast: ForecastResponse) -> [HourlyForecast] {
        guard let hourly = forecast.hourly, !hourly.isEmpty else { return [] }

        let offset = forecast.utcOffsetSeconds ?? TimeZone.current.secondsFromGMT()
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:00"
        formatter.timeZone = TimeZone(secondsFromGMT: offset)
        let adesso = formatter.string(from: Date())

        let future = hourly.filter { $0.time >= adesso }
        // Se la risposta è vecchia e non c'è più nessuna ora futura, meglio le
        // ultime disponibili che un grafico vuoto.
        let scelte = future.isEmpty ? Array(hourly.suffix(24)) : future
        return Array(scelte.prefix(24))
    }

    static func hourlySummary(_ hours: [HourlyForecast]) -> String? {
        guard !hours.isEmpty else { return nil }
        let temps = hours.map(\.temp)
        guard let hi = temps.max(), let lo = temps.min() else { return nil }
        return "max \(Int(hi.rounded()))° · min \(Int(lo.rounded()))°"
    }

    /// «aggiornato 2 min fa», dalla data ISO della risposta.
    static func relativeUpdate(_ generatedAt: String, now: Date = Date()) -> String? {
        let conFrazioni = ISO8601DateFormatter()
        conFrazioni.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let quando = conFrazioni.date(from: generatedAt)
            ?? ISO8601DateFormatter().date(from: generatedAt) else { return nil }

        let minuti = Int(now.timeIntervalSince(quando) / 60)
        switch minuti {
        case ..<1: return "aggiornato adesso"
        case 1: return "aggiornato 1 min fa"
        case 2..<60: return "aggiornato \(minuti) min fa"
        case 60..<120: return "aggiornato 1 ora fa"
        default: return "aggiornato \(minuti / 60) ore fa"
        }
    }
}

#Preview {
    DashboardView()
        .environmentObject(AppState.shared)
}
