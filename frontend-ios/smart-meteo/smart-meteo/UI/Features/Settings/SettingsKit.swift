import SwiftUI

/// I mattoni delle schermate di impostazioni.
///
/// Erano dentro `GeneralSettingsView` come metodi privati, e le altre tre
/// schermate della sidebar avevano ognuna il proprio stile — liste di sistema,
/// card bianche con raggi diversi, titoli in tre pesi diversi. Estrarli qui
/// costa un file e rende impossibile la divergenza: se domani cambia il raggio
/// delle card, cambia in un punto solo.
///
/// Riferimento visivo: la schermata «Impostazioni», che è quella che il
/// ridisegno aveva già portato a termine.

// MARK: - Pagina

/// Sfondo a tinta piena, contenuto scorrevole, spaziature uniformi.
struct SettingsPage<Content: View>: View {
    let theme: WeatherTheme
    let content: () -> Content

    init(
        theme: WeatherTheme = WeatherTheme.of(.clear),
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.theme = theme
        self.content = content
    }

    var body: some View {
        ZStack {
            theme.page.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    content()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
        }
    }
}

// MARK: - Card

/// Etichetta in maiuscoletto spaziato più il foglio bianco che contiene le righe.
///
/// Il titolo sta **fuori** dalla card, non dentro: è un'etichetta di gruppo, e
/// dentro competerebbe con la prima riga.
struct SettingsCard<Content: View>: View {
    let title: String?
    @ViewBuilder var content: () -> Content

    init(_ title: String? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let title {
                Text(title.uppercased())
                    .font(.duetUI(10.5, .semibold))
                    .tracking(1.2)
                    .foregroundColor(Duet.ink.opacity(0.45))
                    .padding(.horizontal, 4)
            }

            VStack(spacing: 0) {
                content()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 24).fill(Duet.surface))
            .shadow(color: Duet.shadowCard, radius: 10, x: 0, y: 2)
        }
    }
}

/// Filo di separazione fra due righe della stessa card.
struct SettingsSeparator: View {
    var body: some View {
        Rectangle()
            .fill(Duet.ink.opacity(0.06))
            .frame(height: 1)
    }
}

// MARK: - Righe

/// Titolo, nota e chevron: il contenuto di una riga che porta altrove.
///
/// Separato dal bottone perché serve identico dentro un `NavigationLink`, che
/// il bottone non può avvolgere.
struct SettingsRowContent: View {
    let title: String
    var note: String? = nil
    /// Glifo a sinistra, quando la riga ne ha uno (la sidebar sì, le card no).
    var icon: String? = nil
    var tint: Color = Duet.ink
    var showsChevron: Bool = true

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            if let icon {
                Image(systemName: icon)
                    .font(.duetUI(15, .medium))
                    .foregroundColor(tint.opacity(0.75))
                    .frame(width: 22)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.duetUI(13.5, .bold))
                    .foregroundColor(tint)

                if let note {
                    Text(note)
                        .font(.duetUI(11))
                        .foregroundColor(Duet.ink.opacity(0.5))
                        .fixedSize(horizontal: false, vertical: true)
                        .multilineTextAlignment(.leading)
                }
            }

            Spacer(minLength: 8)

            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.duetUI(12, .semibold))
                    .foregroundColor(Duet.ink.opacity(0.25))
            }
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

/// Riga che esegue un'azione al tocco.
struct SettingsRow: View {
    let title: String
    var note: String? = nil
    var icon: String? = nil
    var tint: Color = Duet.ink
    var showsChevron: Bool = true
    let action: () -> Void

    var body: some View {
        Button {
            HapticManager.light()
            action()
        } label: {
            SettingsRowContent(
                title: title,
                note: note,
                icon: icon,
                tint: tint,
                showsChevron: showsChevron
            )
        }
        .buttonStyle(.plain)
    }
}

/// Riga di sola lettura: etichetta a sinistra, valore a destra.
struct SettingsInfoRow: View {
    let title: String
    let value: String

    var body: some View {
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
}

// MARK: - Stato vuoto

/// Quello che si vede quando non c'è niente da elencare.
///
/// Dice **cosa fare**, non solo che l'elenco è vuoto: «Nessuna località
/// preferita» lascia l'utente fermo, la riga sotto gli dice dove andare.
struct SettingsEmptyState: View {
    let icon: String
    let title: String
    let note: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 34))
                .foregroundColor(Duet.ink.opacity(0.25))

            Text(title)
                .font(.duetUI(14, .semibold))
                .foregroundColor(Duet.ink)

            Text(note)
                .font(.duetUI(11.5))
                .foregroundColor(Duet.ink.opacity(0.5))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 50)
    }
}
