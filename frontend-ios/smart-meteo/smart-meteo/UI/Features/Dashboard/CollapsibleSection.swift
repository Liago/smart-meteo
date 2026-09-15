import SwiftUI

/// Le quattro sezioni del foglio bianco: Ora per ora, Prossimi giorni, Per te,
/// Fonti dati.
///
/// Il riepilogo nell'intestazione è la parte che fa funzionare il richiudere:
/// «max 28° · min 15°» accanto a «Ora per ora» dice abbastanza da non dover
/// aprire, e chiudere una sezione smette di essere una perdita.
struct CollapsibleSection<Content: View>: View {
    let title: String
    let summary: String?
    /// Colore del riepilogo, quando vale la pena distinguerlo (le fonti in
    /// verde quando concordano).
    var summaryColor: Color = Duet.ink.opacity(0.45)
    @Binding var isOpen: Bool
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                HapticManager.light()
                withAnimation(Duet.section) { isOpen.toggle() }
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(title)
                        .font(.duetDisplay(22))
                        .foregroundColor(Duet.ink)

                    Spacer(minLength: 4)

                    if let summary {
                        Text(summary)
                            .font(.duetUI(11.5, .semibold))
                            .foregroundColor(summaryColor)
                    }

                    Image(systemName: "chevron.down")
                        .font(.duetUI(11, .semibold))
                        .foregroundColor(Duet.ink.opacity(0.35))
                        .rotationEffect(.degrees(isOpen ? 180 : 0))
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 18)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isOpen {
                content()
                    .padding(.horizontal, 20)
                    .padding(.bottom, 18)
            }
        }
    }
}

/// Il foglio bianco che contiene le sezioni.
///
/// È l'elemento che dà al ridisegno la sua gerarchia: l'hero è la condizione,
/// tutto il resto «sale» dentro un unico foglio invece di essere una pila di
/// card che si contendono l'attenzione.
struct SectionSheet<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            content()
        }
        .background(
            RoundedRectangle(cornerRadius: Duet.rSheet)
                .fill(Duet.surface)
        )
        .clipShape(RoundedRectangle(cornerRadius: Duet.rSheet))
        .shadow(color: Duet.shadowCard, radius: 14, x: 0, y: 2)
        .padding(.horizontal, 16)
    }
}

/// Il filo fra una sezione e l'altra, con il rientro dell'handoff.
struct SectionDivider: View {
    var body: some View {
        Rectangle()
            .fill(Duet.hairline)
            .frame(height: 1)
            .padding(.horizontal, 20)
    }
}
