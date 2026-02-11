import SwiftUI

struct GeneralSettingsView: View {
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        Form {
            Section(header: Text("Unità di Misura")) {
                Picker("Temperatura", selection: .constant(0)) {
                    Text("Celsius (°C)").tag(0)
                    Text("Fahrenheit (°F)").tag(1)
                }
                
                Picker("Vento", selection: .constant(0)) {
                    Text("km/h").tag(0)
                    Text("m/s").tag(1)
                    Text("mph").tag(2)
                }
            }
            
            Section(header: Text("Notifiche")) {
                Toggle("Push Notifications", isOn: .constant(true))
                Toggle("Email Alerts", isOn: .constant(false))
            }
            
            Section(header: Text("App Info")) {
                HStack {
                    Text("Versione")
                    Spacer()
                    Text("1.0.2")
                        .foregroundColor(.gray)
                }
                HStack {
                    Text("Build")
                    Spacer()
                    Text("2024.11.20")
                        .foregroundColor(.gray)
                }
            }
        }
        .navigationTitle("Impostazioni Generali")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationView {
        GeneralSettingsView()
    }
}
