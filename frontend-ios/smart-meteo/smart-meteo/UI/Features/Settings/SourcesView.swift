import SwiftUI

/// Le fonti che alimentano la previsione, una per riga, accendibili.
///
/// Sullo stesso linguaggio della schermata Impostazioni: una card per gruppo
/// invece di una card per fonte. Nove riquadri bianchi affiancati davano nove
/// elementi di pari peso e nessuna gerarchia — e soprattutto non facevano
/// vedere la cosa che conta di questo elenco, cioè che le fonti **non sono
/// tutte uguali**: hanno un peso, e il peso decide quanto contano nella media.
struct SourcesView: View {
    @EnvironmentObject var appState: AppState

    var theme: WeatherTheme = WeatherTheme.of(.clear)

    /// Le più pesanti in cima.
    ///
    /// L'ordine di arrivo dal backend non significa niente per chi legge,
    /// mentre il peso sì: chi apre questa schermata vuole sapere chi comanda
    /// nella media, e chi comanda deve stare in alto.
    private var ordered: [WeatherSource] {
        appState.weatherSources.sorted { $0.weight > $1.weight }
    }

    private var activeCount: Int {
        appState.weatherSources.filter(\.active).count
    }

    var body: some View {
        SettingsPage(theme: theme) {
            if appState.weatherSources.isEmpty {
                SettingsEmptyState(
                    icon: "antenna.radiowaves.left.and.right.slash",
                    title: "Nessuna fonte",
                    note: "L'elenco arriva dal backend: se resta vuoto, la previsione non sta ricevendo dati."
                )
            } else {
                SettingsCard("\(activeCount) fonti attive su \(appState.weatherSources.count)") {
                    ForEach(Array(ordered.enumerated()), id: \.element.id) { index, source in
                        if index > 0 { SettingsSeparator() }
                        sourceRow(source)
                    }
                }

                note
            }
        }
        .navigationTitle("Gestione Fonti")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Riga

    private func sourceRow(_ source: WeatherSource) -> some View {
        HStack(alignment: .top, spacing: 11) {
            Circle()
                .fill(source.active ? theme.accent : Duet.ink.opacity(0.18))
                .frame(width: 7, height: 7)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 3) {
                Text(source.name)
                    .font(.duetUI(13.5, .bold))
                    .foregroundColor(Duet.ink)

                if let description = source.description, !description.isEmpty {
                    Text(description)
                        .font(.duetUI(11))
                        .foregroundColor(Duet.ink.opacity(0.5))
                        .fixedSize(horizontal: false, vertical: true)
                        .multilineTextAlignment(.leading)
                }

                Text(Self.weightLabel(source.weight))
                    .font(.duetUI(10.5, .semibold))
                    .foregroundColor(Self.weightColor(source.weight, accent: theme.accent))
                    .padding(.top, 1)
            }

            Spacer(minLength: 8)

            Toggle("", isOn: Binding(
                get: { source.active },
                set: { _ in
                    HapticManager.light()
                    appState.toggleSource(source.id)
                }
            ))
            .labelsHidden()
            .tint(theme.accent)
        }
        .padding(.vertical, 12)
        .opacity(source.active ? 1 : 0.5)
    }

    private var note: some View {
        Text("Il peso decide quanto una fonte conta nella media, e viene corretto dall'accuratezza misurata sulle osservazioni. Spegnere una fonte ne toglie anche le allerte, perché viaggiano nella stessa chiamata.")
            .font(.duetUI(11))
            .foregroundColor(Duet.ink.opacity(0.45))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
    }

    // MARK: - Peso

    /// «Peso 1.2» diceva il numero e non il suo senso.
    ///
    /// Il numero resta — chi lo sa leggere lo vuole — ma accanto c'è la parola
    /// che lo traduce, perché su una scala da 0 a 1.2 senza estremi dichiarati
    /// 1.0 può sembrare il massimo mentre è la media.
    static func weightLabel(_ weight: Double) -> String {
        let numero = Units.number(weight, decimals: 1)
        if weight <= 0 { return "Peso \(numero) · non entra nella media" }
        if weight >= 1.15 { return "Peso \(numero) · alto" }
        if weight >= 1.05 { return "Peso \(numero) · sopra la media" }
        return "Peso \(numero) · standard"
    }

    static func weightColor(_ weight: Double, accent: Color) -> Color {
        if weight <= 0 { return Duet.ink.opacity(0.35) }
        if weight >= 1.15 { return accent }
        return Duet.ink.opacity(0.45)
    }
}

#Preview {
    NavigationStack {
        SourcesView()
            .environmentObject(AppState.shared)
    }
}
