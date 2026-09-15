import SwiftUI

/// «Personalizza sezioni»: quali schede compaiono in «Per te» e in che ordine.
///
/// È la schermata che rende difendibile l'intero ridisegno. Le schede sono
/// spente per scelta di chi usa l'app, non nascoste da noi: senza un posto dove
/// riaccenderle, spegnerle sarebbe stato togliere funzioni.
///
/// La scelta vive in `UserDefaults` e non raggiunge il backend, per la stessa
/// ragione della potenza dell'impianto fotovoltaico: è un dato dell'utente, e
/// nella richiesta frammenterebbe la cache della previsione per utente invece
/// di servire tutti quelli sulla stessa località.
struct ForYouSettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @AppStorage(ForYouPrefs.enabledKey) private var enabledRaw: String = ForYouPrefs.defaultEnabledRaw
    @AppStorage(ForYouPrefs.orderKey) private var orderRaw: String = ForYouPrefs.defaultOrderRaw
    @AppStorage(DashboardPrefs.heroVariantKey) private var heroVariantRaw: String = HeroVariant.sheet.rawValue

    private var order: [ForYouKey] { ForYouPrefs.order(orderRaw) }
    private var enabled: Set<ForYouKey> { Set(ForYouPrefs.keys(enabledRaw)) }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(order) { key in
                        row(key)
                    }
                    .onMove(perform: move)
                } header: {
                    Text("Sezione «Per te»")
                } footer: {
                    Text("Una scheda compare solo se è accesa **e** se c'è qualcosa da dire: il mare resta nascosto nell'entroterra, la neve d'estate, i pollini fuori dall'Europa.")
                }

                Section {
                    Picker("Stile della testata", selection: $heroVariantRaw) {
                        ForEach(HeroVariant.allCases) { variant in
                            Text(variant.label).tag(variant.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Aspetto")
                } footer: {
                    Text("«Foglio» dà alla temperatura tutto lo spazio. «Tessere» ne cede un po' per mostrare vento, UV, nowcast e tramonto senza aprire nulla.")
                }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Personalizza")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine") { dismiss() }
                }
            }
        }
    }

    private func row(_ key: ForYouKey) -> some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8)
                .fill(key.fill)
                .frame(width: 30, height: 30)
                .overlay(
                    Circle()
                        .fill(key.tagColor)
                        .frame(width: 8, height: 8)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(key.tag)
                    .font(.duetUI(13.5, .bold))
                    .foregroundColor(Duet.ink)
                Text(key.blurb)
                    .font(.duetUI(11))
                    .foregroundColor(Duet.ink.opacity(0.5))
            }

            Spacer(minLength: 4)

            Toggle("", isOn: binding(for: key))
                .labelsHidden()
        }
        .padding(.vertical, 2)
    }

    private func binding(for key: ForYouKey) -> Binding<Bool> {
        Binding(
            get: { enabled.contains(key) },
            set: { isOn in
                HapticManager.selection()
                var attive = enabled
                if isOn { attive.insert(key) } else { attive.remove(key) }
                // Si salva nell'ordine scelto dall'utente, non in quello di
                // inserimento: così l'elenco salvato resta leggibile e
                // riordinarlo non cambia quali sono accese.
                enabledRaw = ForYouPrefs.raw(order.filter { attive.contains($0) })
            }
        )
    }

    private func move(from source: IndexSet, to destination: Int) {
        var nuovo = order
        nuovo.move(fromOffsets: source, toOffset: destination)
        orderRaw = ForYouPrefs.raw(nuovo)
        // Anche le accese vanno riscritte nel nuovo ordine, o la griglia
        // seguirebbe l'ordine vecchio.
        enabledRaw = ForYouPrefs.raw(nuovo.filter { enabled.contains($0) })
        HapticManager.light()
    }
}

// MARK: - Variante della testata

enum HeroVariant: String, CaseIterable, Identifiable {
    case sheet
    case bento

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sheet: return "Foglio"
        case .bento: return "Tessere"
        }
    }
}

enum DashboardPrefs {
    static let heroVariantKey = "smart-meteo-hero-variant"
}
