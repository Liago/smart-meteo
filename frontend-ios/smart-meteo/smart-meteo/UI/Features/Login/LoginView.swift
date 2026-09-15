import SwiftUI
import Combine

/// L'accesso.
///
/// Era l'ultima schermata rimasta al vecchio linguaggio: gradiente blu notte,
/// campi in vetro scuro, pulsante blu di sistema — e **tutta in inglese**, in
/// un'app che parla italiano dappertutto. «Welcome Back» era anche l'unica
/// frase dell'app scritta in una lingua che l'utente non ha scelto.
///
/// Ora usa i mattoni di `SettingsKit` come le altre quattro schermate della
/// sidebar, e il tema della condizione meteo come il resto dell'app.
struct LoginView: View {
    @StateObject private var viewModel = LoginViewModel()
    @Environment(\.dismiss) var dismiss

    var theme: WeatherTheme = WeatherTheme.of(.clear)

    /// Quale campo ha il fuoco: serve a far passare «Invio» dall'email alla
    /// password e da lì all'accesso, invece di costringere a due tocchi.
    @FocusState private var campoAttivo: Campo?

    private enum Campo: Hashable { case email, password }

    /// Con un campo vuoto il pulsante non faceva niente — il `guard` usciva in
    /// silenzio. Un pulsante che si preme e non risponde fa credere a un guasto
    /// della rete; disattivato dice quello che manca.
    private var puoAccedere: Bool {
        !viewModel.emailPulita.isEmpty && !viewModel.password.isEmpty && !viewModel.isLoading
    }

    var body: some View {
        ZStack {
            theme.page.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    intestazione

                    SettingsCard("Credenziali") {
                        campo(
                            icona: "envelope",
                            segnaposto: "Email",
                            testo: $viewModel.email,
                            fuoco: .email
                        )

                        SettingsSeparator()

                        campo(
                            icona: "lock",
                            segnaposto: "Password",
                            testo: $viewModel.password,
                            fuoco: .password,
                            sicuro: true
                        )
                    }

                    if let errore = viewModel.errorMessage {
                        messaggioErrore(errore)
                    }

                    pulsanti

                    nota
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .onAppear { campoAttivo = .email }
    }

    // MARK: - Intestazione

    private var intestazione: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "cloud.sun.fill")
                .font(.system(size: 42))
                // L'accento del tema al posto del giallo-arancio fisso: la
                // schermata di accesso non è un'isola con una sua tavolozza.
                .foregroundStyle(theme.accent, theme.hero)
                .padding(.bottom, 6)

            Text("Bentornato")
                .font(.duetDisplay(30))
                .foregroundColor(Duet.ink)

            Text("Accedi per sincronizzare le tue località preferite su tutti i dispositivi.")
                .font(.duetUI(12.5))
                .foregroundColor(Duet.ink.opacity(0.5))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 4)
        .padding(.top, 16)
    }

    // MARK: - Campi

    @ViewBuilder
    private func campo(
        icona: String,
        segnaposto: String,
        testo: Binding<String>,
        fuoco: Campo,
        sicuro: Bool = false
    ) -> some View {
        HStack(spacing: 11) {
            Image(systemName: icona)
                .font(.duetUI(14, .medium))
                .foregroundColor(Duet.ink.opacity(0.3))
                .frame(width: 20)

            Group {
                if sicuro {
                    SecureField(segnaposto, text: testo)
                        .submitLabel(.go)
                        .onSubmit(accedi)
                } else {
                    TextField(segnaposto, text: testo)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.next)
                        .onSubmit { campoAttivo = .password }
                }
            }
            .font(.duetUI(14))
            .foregroundColor(Duet.ink)
            .focused($campoAttivo, equals: fuoco)
        }
        .padding(.vertical, 14)
    }

    /// L'errore dentro un riquadro, non una riga rossa sotto ai campi.
    ///
    /// Un errore di accesso è la ragione per cui l'utente è ancora su questa
    /// schermata: se non si vede, riprova le stesse credenziali.
    private func messaggioErrore(_ testo: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 9) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.duetUI(12))
                .foregroundColor(Duet.orangeRed)

            Text(testo)
                .font(.duetUI(12))
                .foregroundColor(Duet.orangeRed)
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)

            Spacer(minLength: 0)
        }
        .padding(13)
        .background(RoundedRectangle(cornerRadius: Duet.rSmall).fill(Duet.tintOrange))
        .accessibilityAddTraits(.isStaticText)
    }

    // MARK: - Pulsanti

    private var pulsanti: some View {
        VStack(spacing: 10) {
            Button(action: accedi) {
                HStack(spacing: 8) {
                    if viewModel.isLoading {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(.white)
                            .scaleEffect(0.8)
                    }
                    Text(viewModel.isLoading ? "Accesso in corso…" : "Accedi")
                        .font(.duetUI(14, .bold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Duet.rSmall)
                        .fill(puoAccedere ? theme.accent : Duet.ink.opacity(0.15))
                )
            }
            .buttonStyle(.plain)
            .disabled(!puoAccedere)
            .animation(Duet.toggle, value: puoAccedere)

            Button("Annulla") { dismiss() }
                .font(.duetUI(13, .semibold))
                .foregroundColor(Duet.ink.opacity(0.5))
                .buttonStyle(.plain)
                .padding(.top, 2)
        }
        .padding(.top, 4)
    }

    /// Dice che cosa si perde restando fuori, invece di lasciarlo indovinare.
    ///
    /// L'app funziona benissimo senza account — le preferite vivono in locale —
    /// e una schermata di accesso che non lo dice fa sembrare l'account
    /// obbligatorio.
    private var nota: some View {
        Text("Senza account l'app funziona lo stesso: le località restano su questo dispositivo e non vengono sincronizzate.")
            .font(.duetUI(11))
            .foregroundColor(Duet.ink.opacity(0.42))
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
    }

    private func accedi() {
        guard puoAccedere else { return }
        HapticManager.light()
        campoAttivo = nil
        viewModel.signIn { dismiss() }
    }
}

// MARK: - ViewModel

class LoginViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    /// L'email senza spazi ai bordi.
    ///
    /// Incollandola da un gestore di password o dalla tastiera predittiva si
    /// porta dietro uno spazio finale, e Supabase risponde «credenziali non
    /// valide» — l'errore più fuorviante possibile, perché la password è
    /// giusta e l'utente la riscrive dieci volte.
    var emailPulita: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func signIn(onSuccess: @escaping () -> Void) {
        let indirizzo = emailPulita
        guard !indirizzo.isEmpty, !password.isEmpty else { return }

        isLoading = true
        errorMessage = nil

        Task {
            do {
                try await AuthService.shared.signIn(email: indirizzo, password: password)
                await MainActor.run {
                    isLoading = false
                    onSuccess()
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = Self.messaggio(per: error)
                }
            }
        }
    }

    /// Il caso frequente tradotto, il resto così com'è.
    ///
    /// «Invalid login credentials» è inglese e vago in una schermata italiana.
    /// Gli altri errori restano nella forma originale invece di essere
    /// riassunti in un generico «qualcosa è andato storto»: quello non aiuta
    /// nessuno a capire se il problema è la rete, il server o le credenziali.
    static func messaggio(per errore: Error) -> String {
        let testo = errore.localizedDescription
        if testo.localizedCaseInsensitiveContains("invalid login credentials")
            || testo.localizedCaseInsensitiveContains("invalid credentials") {
            return "Email o password non corretti."
        }
        if testo.localizedCaseInsensitiveContains("email not confirmed") {
            return "Devi prima confermare l'email: controlla la posta."
        }
        return testo
    }
}

#Preview {
    LoginView()
}
