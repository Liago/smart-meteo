import SwiftUI

/// Preferenze delle schede «Per te».
///
/// Vivono in `UserDefaults` e non toccano il backend, per la stessa ragione
/// della potenza dell'impianto fotovoltaico: sono un dato dell'utente, non
/// della previsione, e nella richiesta frammenterebbero la cache per utente.
enum ForYouPrefs {
    static let enabledKey = "smart-meteo-foryou-enabled"
    static let orderKey = "smart-meteo-foryou-order"

    static var defaultEnabledRaw: String {
        raw(ForYouKey.allCases.filter(\.onByDefault))
    }

    static var defaultOrderRaw: String {
        raw(ForYouKey.allCases)
    }

    static func raw(_ keys: [ForYouKey]) -> String {
        keys.map(\.rawValue).joined(separator: ",")
    }

    static func keys(_ raw: String) -> [ForYouKey] {
        raw.split(separator: ",").compactMap { ForYouKey(rawValue: String($0)) }
    }

    /// L'ordine salvato, completato con le schede che non contiene.
    ///
    /// Serve per il futuro: una scheda aggiunta dopo che l'utente ha già
    /// riordinato le sue non deve restare invisibile per sempre. Le nuove
    /// finiscono in fondo, dove non disturbano.
    static func order(_ raw: String) -> [ForYouKey] {
        let salvate = keys(raw)
        return salvate + ForYouKey.allCases.filter { !salvate.contains($0) }
    }
}

// MARK: - Griglia

struct ForYouSectionView: View {
    let cards: [ForYouCard]
    /// Una sola scheda aperta per volta: due aperte sarebbero due colonne
    /// intere e la griglia smetterebbe di essere una griglia.
    @Binding var openCard: ForYouKey?
    let onCustomise: () -> Void

    /// Le righe della griglia: due schede chiuse affiancate, una aperta da sola.
    ///
    /// Non è una `LazyVGrid` perché una cella che occupa due colonne non si
    /// esprime in una griglia a colonne fisse senza `matchedGeometryEffect` e
    /// un bel po' di fragilità. Comporre le righe a mano costa dieci righe di
    /// codice e si comporta sempre allo stesso modo.
    private var rows: [[ForYouCard]] {
        var result: [[ForYouCard]] = []
        var pending: [ForYouCard] = []

        for card in cards {
            if card.key == openCard {
                if !pending.isEmpty {
                    result.append(pending)
                    pending = []
                }
                result.append([card])
            } else {
                pending.append(card)
                if pending.count == 2 {
                    result.append(pending)
                    pending = []
                }
            }
        }
        if !pending.isEmpty { result.append(pending) }
        return result
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(alignment: .top, spacing: 10) {
                    ForEach(row) { card in
                        ForYouCardView(
                            card: card,
                            isOpen: card.key == openCard,
                            onTap: { toggle(card.key) }
                        )
                    }
                    // Una scheda chiusa e spaiata non deve allargarsi a tutta
                    // la riga: resterebbe una tessera sola grande il doppio
                    // delle altre.
                    if row.count == 1, row[0].key != openCard {
                        Color.clear.frame(maxWidth: .infinity)
                    }
                }
            }

            Button(action: onCustomise) {
                Text("Personalizza sezioni")
                    .font(.duetUI(11.5, .bold))
                    .foregroundColor(Duet.ink.opacity(0.6))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                            .foregroundColor(Duet.ink.opacity(0.25))
                    )
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
        }
    }

    private func toggle(_ key: ForYouKey) {
        HapticManager.selection()
        withAnimation(Duet.cardExpand) {
            openCard = (openCard == key) ? nil : key
        }
    }
}

// MARK: - Scheda

struct ForYouCardView: View {
    let card: ForYouCard
    let isOpen: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(card.key.tag.uppercased())
                    .font(.duetUI(10, .semibold))
                    .tracking(1.0)
                    .foregroundColor(card.key.tagColor)

                Spacer(minLength: 4)

                Image(systemName: "chevron.down")
                    .font(.duetUI(10, .semibold))
                    .foregroundColor(card.key.tagColor.opacity(0.6))
                    .rotationEffect(.degrees(isOpen ? 180 : 0))
            }

            Text(card.headline)
                .font(.duetUI(13.5, .bold))
                .foregroundColor(Duet.ink)
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)

            Text(card.detail)
                .font(.duetUI(11))
                .foregroundColor(Duet.ink.opacity(0.58))
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)

            if isOpen {
                Divider()
                    .overlay(Duet.ink.opacity(0.1))
                    .padding(.vertical, 4)

                VStack(alignment: .leading, spacing: 7) {
                    ForEach(card.rows) { row in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(row.label)
                                .font(.duetUI(11.5))
                                .foregroundColor(Duet.ink.opacity(0.55))

                            Spacer(minLength: 4)

                            if let hint = row.hint {
                                Text(hint)
                                    .font(.duetUI(10.5))
                                    .foregroundColor(Duet.ink.opacity(0.4))
                                    .lineLimit(1)
                            }

                            Text(row.value)
                                .font(.duetUI(11.5, .bold))
                                .foregroundColor(Duet.ink)
                                .monospacedDigit()
                        }
                    }
                }

                if let note = card.note {
                    Text(note)
                        .font(.duetUI(10))
                        .foregroundColor(Duet.ink.opacity(0.42))
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 6)
                }
            }
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: Duet.rCard)
                .fill(card.key.fill)
        )
        .shadow(
            color: isOpen ? Duet.shadowOpenCard : .clear,
            radius: isOpen ? 11 : 0,
            x: 0,
            y: isOpen ? 8 : 0
        )
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
        .accessibilityElement(children: .combine)
        .accessibilityHint(isOpen ? "Tocca per chiudere" : "Tocca per i dettagli")
    }
}
