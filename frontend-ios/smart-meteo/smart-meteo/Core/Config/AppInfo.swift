import Foundation

/// Versione e build dell'app, lette dal bundle.
///
/// I due numeri nascono in `version.json` in radice del repository, che
/// `npm run version:sync` riversa su `MARKETING_VERSION` e
/// `CURRENT_PROJECT_VERSION` nel progetto Xcode; con
/// `GENERATE_INFOPLIST_FILE = YES` Xcode li trasforma in
/// `CFBundleShortVersionString` e `CFBundleVersion`, che sono ciò che si
/// legge qui. Quindi: nessuna stringa scritta a mano in tutta la catena, e
/// l'unico punto in cui cambiarla è un file solo.
///
/// Vive in `Core/Config` e non più come due proprietà statiche di
/// `GeneralSettingsView`: erano già usate da `SidebarView`, cioè una schermata
/// che ne importava un'altra per leggere un dato che non appartiene a nessuna
/// delle due.
enum AppInfo {
    /// Versione pubblica, es. `1.1.0`.
    ///
    /// Il trattino lungo, e non `"?"` o `"1.0"`, quando la chiave manca: un
    /// segnaposto che somiglia a una versione plausibile è peggio di un buco
    /// visibile, perché verrebbe riportato come se fosse vero.
    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
    }

    /// Numero di build monotono, es. `2`.
    static var build: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
    }

    /// `1.1.0 (2)` — la forma con cui Apple stessa scrive la coppia.
    ///
    /// Per log e segnalazioni: la versione da sola non distingue due archivi
    /// dello stesso rilascio, che è esattamente la differenza che serve quando
    /// un problema compare «solo su alcuni telefoni».
    static var full: String {
        "\(version) (\(build))"
    }
}
