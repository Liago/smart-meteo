import SwiftUI

/// Le località salvate.
///
/// Era una `List` di sistema con card bianche dentro le righe — due
/// contenitori sovrapposti, con lo sfondo crema che spariva dietro allo sfondo
/// della lista. Ora è una `SettingsCard` come le altre: **una** card, una riga
/// per località, e Casa in cima nel suo gruppo.
struct FavoritesView: View {
    @EnvironmentObject var appState: AppState
    @Binding var isSidebarPresented: Bool
    @Environment(\.dismiss) var dismiss

    var theme: WeatherTheme = WeatherTheme.of(.clear)

    private var home: SavedLocation? {
        guard let home = appState.homeLocation,
              appState.favoriteLocations.contains(where: { $0.id == home.id })
        else { return nil }
        return home
    }

    private var others: [SavedLocation] {
        appState.favoriteLocations.filter { $0.id != appState.homeLocation?.id }
    }

    var body: some View {
        SettingsPage(theme: theme) {
            if appState.favoriteLocations.isEmpty {
                SettingsEmptyState(
                    icon: "star",
                    title: "Nessuna località preferita",
                    note: "Cerca una località dalla lente in alto e toccane la stella: la ritrovi qui, e quella marcata come Casa apre l'app."
                )
            } else {
                if let home {
                    SettingsCard("Casa") {
                        locationRow(home)
                    }
                }

                if !others.isEmpty {
                    SettingsCard(home != nil ? "Altre località" : "Località") {
                        ForEach(Array(others.enumerated()), id: \.element.id) { index, location in
                            if index > 0 { SettingsSeparator() }
                            locationRow(location)
                        }
                    }
                }

                note
            }
        }
        .navigationTitle("Località Preferite")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Riga

    /// Nome, coordinate e il bottone Casa.
    ///
    /// Niente temperatura accanto al nome, come già nella schermata Località:
    /// costerebbe una richiesta per preferita, e inventarla è peggio che
    /// ometterla.
    private func locationRow(_ location: SavedLocation) -> some View {
        HStack(spacing: 10) {
            Button {
                HapticManager.light()
                appState.selectLocation(coordinate: location.coordinate, name: location.name)
                dismiss()

                // La sidebar si chiude dopo il pop, non insieme: chiuderle
                // entrambe nello stesso istante fa vedere il fondale nero
                // scorrere via sopra la dashboard che sta ancora entrando.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                    withAnimation { isSidebarPresented = false }
                }
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(location.name)
                        .font(.duetUI(13.5, .bold))
                        .foregroundColor(Duet.ink)
                        .multilineTextAlignment(.leading)

                    Text(Self.coordinates(location.coordinate))
                        .font(.duetUI(11))
                        .foregroundColor(Duet.ink.opacity(0.45))
                        .monospacedDigit()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Button {
                HapticManager.light()
                appState.setAsHome(location: location)
            } label: {
                Image(systemName: appState.isHome(location: location) ? "house.fill" : "house")
                    .font(.duetUI(15, .medium))
                    .foregroundColor(
                        appState.isHome(location: location)
                            ? theme.accent
                            : Duet.ink.opacity(0.25)
                    )
                    .frame(width: 34, height: 34)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(
                appState.isHome(location: location)
                    ? "\(location.name) è la località di casa"
                    : "Imposta \(location.name) come casa"
            )
        }
        .padding(.vertical, 10)
        // Lo swipe della `List` è sparito insieme alla `List`: senza questo
        // menu la rimozione non esisterebbe più, e una schermata ristilizzata
        // che perde una funzione è una regressione travestita.
        .contextMenu {
            Button {
                appState.setAsHome(location: location)
            } label: {
                Label(
                    appState.isHome(location: location) ? "È già casa" : "Imposta come casa",
                    systemImage: "house"
                )
            }
            .disabled(appState.isHome(location: location))

            Button(role: .destructive) {
                remove(location)
            } label: {
                Label("Rimuovi dai preferiti", systemImage: "trash")
            }
        }
    }

    /// La rimozione passa da `AppState`, che sincronizza anche il backend.
    ///
    /// Lo swipe di prima toglieva la località **solo dall'array**: spariva
    /// dallo schermo e tornava al login successivo, perché su Supabase era
    /// ancora lì.
    private func remove(_ location: SavedLocation) {
        guard let index = appState.favoriteLocations.firstIndex(where: { $0.id == location.id })
        else { return }
        HapticManager.medium()
        withAnimation(Duet.section) {
            appState.removeFavorite(at: IndexSet(integer: index))
        }
    }

    private var note: some View {
        Text("Tocca una località per vederne la previsione, la casetta per sceglierla come predefinita. Tieni premuto per rimuoverla.")
            .font(.duetUI(11))
            .foregroundColor(Duet.ink.opacity(0.45))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
    }

    /// «45,4642, 9,1900» — quattro decimali, circa undici metri: abbastanza per
    /// distinguere due omonime, non tanti da sembrare una misura.
    static func coordinates(_ coordinate: Coordinate) -> String {
        "\(Units.number(coordinate.lat, decimals: 4)), \(Units.number(coordinate.lon, decimals: 4))"
    }
}

#Preview {
    NavigationStack {
        FavoritesView(isSidebarPresented: .constant(true))
            .environmentObject(AppState.shared)
    }
}
