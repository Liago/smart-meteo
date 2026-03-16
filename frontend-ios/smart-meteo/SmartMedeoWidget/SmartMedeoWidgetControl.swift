import AppIntents
import SwiftUI
import WidgetKit

// Control Widget per aprire l'app Smart Meteo dal Control Center (iOS 18+)
struct SmartMedeoWidgetControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(
            kind: "com.liagosoft.smartmeteo.widget.control",
            provider: Provider()
        ) { value in
            ControlWidgetButton(action: OpenSmartMeteoIntent()) {
                Label(value ? "Meteo" : "Meteo", systemImage: "cloud.sun.fill")
            }
        }
        .displayName("Smart Meteo")
        .description("Apri Smart Meteo per le previsioni.")
    }
}

extension SmartMedeoWidgetControl {
    struct Provider: ControlValueProvider {
        var previewValue: Bool { true }

        func currentValue() async throws -> Bool {
            true
        }
    }
}

struct OpenSmartMeteoIntent: AppIntent {
    static let title: LocalizedStringResource = "Apri Smart Meteo"
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
