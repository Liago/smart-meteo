import SwiftUI

/// Gestione delle regole di allerta personali.
///
/// Le allerte governative arrivano già: questa schermata aggiunge le soglie
/// dell'utente («avvisami se stanotte gela», «se le raffiche superano 50 km/h»).
///
/// Le metriche non sono cablate qui: arrivano da `/api/alerts/rules/metrics`,
/// che serve il registro del backend. Così l'app non può proporre una regola
/// che il server rifiuterebbe, e aggiungere una metrica non richiede di
/// aggiornare l'app.
struct AlertRulesView: View {
    @StateObject private var push = PushNotificationService.shared

    @State private var metrics: [AlertRuleMetric] = []
    @State private var rules: [AlertRule] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isAddPresented = false

    private var deviceToken: String? { push.deviceToken }

    var body: some View {
        ZStack {
            Color.black.opacity(0.02).ignoresSafeArea()

            if deviceToken == nil {
                // Senza token APNs non c'è niente a cui legare una regola, e
                // crearla darebbe l'impressione di un avviso che non arriverà
                // mai.
                messageView(
                    icon: "bell.slash",
                    title: "Notifiche non attive",
                    detail: "Attiva le notifiche per ricevere gli avvisi sulle tue soglie."
                )
            } else if isLoading {
                ProgressView()
            } else if let errorMessage {
                messageView(icon: "exclamationmark.triangle", title: "Errore", detail: errorMessage)
            } else if rules.isEmpty {
                messageView(
                    icon: "slider.horizontal.3",
                    title: "Nessuna soglia impostata",
                    detail: "Aggiungi una regola per essere avvisato quando la previsione la supera."
                )
            } else {
                List {
                    ForEach(rules) { rule in
                        ruleRow(rule)
                    }
                    .onDelete(perform: deleteRules)
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Avvisi personali")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    isAddPresented = true
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(deviceToken == nil || metrics.isEmpty)
            }
        }
        .sheet(isPresented: $isAddPresented) {
            AddAlertRuleView(metrics: metrics) { metric, comparator, threshold, horizon in
                await createRule(metric: metric, comparator: comparator, threshold: threshold, horizon: horizon)
            }
        }
        .task { await load() }
    }

    // MARK: - Righe

    @ViewBuilder
    private func ruleRow(_ rule: AlertRule) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(rule.describe(using: metrics))
                .font(.system(size: 15, weight: .semibold))

            Text(rule.horizonLabel)
                .font(.system(size: 12))
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 2)
        .swipeActions(edge: .leading) {
            Button(rule.enabled ? "Sospendi" : "Riattiva") {
                Task { await toggle(rule) }
            }
            .tint(rule.enabled ? .orange : .green)
        }
        .opacity(rule.enabled ? 1 : 0.45)
    }

    @ViewBuilder
    private func messageView(icon: String, title: String, detail: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 32))
                .foregroundColor(.secondary)
            Text(title)
                .font(.system(size: 16, weight: .semibold))
            Text(detail)
                .font(.system(size: 13))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
    }

    // MARK: - Rete

    private func load() async {
        guard let deviceToken else {
            isLoading = false
            return
        }
        isLoading = true
        errorMessage = nil
        do {
            // Il registro prima delle regole: senza le metriche una regola non
            // sarebbe nemmeno descrivibile a schermo.
            metrics = try await APIService.shared.fetchAlertRuleMetrics()
            rules = try await APIService.shared.fetchAlertRules(deviceToken: deviceToken)
        } catch {
            errorMessage = "Impossibile caricare le soglie."
        }
        isLoading = false
    }

    private func createRule(metric: String, comparator: String, threshold: Double, horizon: Int) async {
        guard let deviceToken else { return }
        do {
            let rule = try await APIService.shared.createAlertRule(
                deviceToken: deviceToken,
                metric: metric,
                comparator: comparator,
                threshold: threshold,
                horizonHours: horizon
            )
            // Una regola identica non è un errore: il backend restituisce
            // quella esistente, e va sostituita invece di comparire due volte.
            rules.removeAll { $0.id == rule.id }
            rules.append(rule)
        } catch {
            errorMessage = "Impossibile creare la soglia."
        }
    }

    private func toggle(_ rule: AlertRule) async {
        guard let deviceToken else { return }
        do {
            let updated = try await APIService.shared.setAlertRuleEnabled(
                deviceToken: deviceToken,
                ruleId: rule.id,
                enabled: !rule.enabled
            )
            if let index = rules.firstIndex(where: { $0.id == updated.id }) {
                rules[index] = updated
            }
        } catch {
            errorMessage = "Impossibile aggiornare la soglia."
        }
    }

    private func deleteRules(at offsets: IndexSet) {
        guard let deviceToken else { return }
        let daEliminare = offsets.map { rules[$0] }
        // Rimozione ottimistica: la lista non deve restare ferma mentre la
        // richiesta viaggia. Se fallisce, il ricaricamento la riporta.
        rules.remove(atOffsets: offsets)

        Task {
            for rule in daEliminare {
                do {
                    try await APIService.shared.deleteAlertRule(deviceToken: deviceToken, ruleId: rule.id)
                } catch {
                    errorMessage = "Impossibile eliminare la soglia."
                    await load()
                }
            }
        }
    }
}

/// Form di creazione di una regola.
private struct AddAlertRuleView: View {
    let metrics: [AlertRuleMetric]
    let onCreate: (String, String, Double, Int) async -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var metricId: String = ""
    @State private var comparator: String = "above"
    @State private var thresholdText: String = ""
    @State private var horizonHours: Int = 24
    @State private var isSaving = false

    private var selected: AlertRuleMetric? {
        metrics.first { $0.metricId == metricId }
    }

    /// La soglia scritta dall'utente, accettando anche la virgola decimale.
    private var threshold: Double? {
        Double(thresholdText.replacingOccurrences(of: ",", with: "."))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Cosa monitorare") {
                    Picker("Metrica", selection: $metricId) {
                        ForEach(metrics) { metric in
                            Text(metric.label).tag(metric.metricId)
                        }
                    }

                    // Il selettore del verso compare solo dove entrambi hanno
                    // senso: nessuno chiede di essere avvisato quando il vento
                    // cala, e mostrare la scelta suggerirebbe il contrario.
                    if let selected, selected.isBidirectional {
                        Picker("Quando", selection: $comparator) {
                            Text("Supera").tag("above")
                            Text("Scende sotto").tag("below")
                        }
                        .pickerStyle(.segmented)
                    }

                    HStack {
                        Text("Soglia")
                        Spacer()
                        TextField("0", text: $thresholdText)
                            .keyboardType(.numbersAndPunctuation)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 100)
                        if let selected, !selected.unit.isEmpty {
                            Text(selected.unit.trimmingCharacters(in: .whitespaces))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Section("Quanto in là guardare") {
                    Picker("Orizzonte", selection: $horizonHours) {
                        Text("6 ore").tag(6)
                        Text("12 ore").tag(12)
                        Text("24 ore").tag(24)
                        Text("48 ore").tag(48)
                    }
                }

                if let selected, selected.aggregation == "sum" {
                    // Somma e massimo rispondono a domande diverse, e la
                    // differenza cambia quando la regola scatta.
                    Text("La soglia è sul totale della finestra, non sul valore di una singola ora.")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Nuova soglia")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Annulla") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Salva") {
                        guard let value = threshold, let selected else { return }
                        isSaving = true
                        Task {
                            await onCreate(selected.metricId, comparator, value, horizonHours)
                            dismiss()
                        }
                    }
                    .disabled(threshold == nil || selected == nil || isSaving)
                }
            }
            .onAppear {
                if metricId.isEmpty, let first = metrics.first {
                    metricId = first.metricId
                    comparator = first.comparators.first ?? "above"
                }
            }
            .onChange(of: metricId) { _, _ in
                // Cambiando metrica il verso precedente può non essere più
                // ammesso: si riparte da quello di default della nuova.
                if let selected, !selected.comparators.contains(comparator) {
                    comparator = selected.comparators.first ?? "above"
                }
            }
        }
    }
}
