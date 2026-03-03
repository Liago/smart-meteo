import SwiftUI

struct GeneralSettingsView: View {
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Section: Unità di Misura
                VStack(alignment: .leading, spacing: 0) {
                    Text("Unità di Misura")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.gray)
                        .textCase(.uppercase)
                        .padding(.horizontal, 4)
                        .padding(.bottom, 8)
                    
                    VStack(spacing: 0) {
                        HStack {
                            Text("Temperatura")
                                .foregroundColor(.black)
                            Spacer()
                            Picker("", selection: .constant(0)) {
                                Text("Celsius (°C)").tag(0)
                                Text("Fahrenheit (°F)").tag(1)
                            }
                            .labelsHidden()
                            .tint(.gray)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        
                        Divider()
                            .padding(.leading, 16)
                        
                        HStack {
                            Text("Vento")
                                .foregroundColor(.black)
                            Spacer()
                            Picker("", selection: .constant(0)) {
                                Text("km/h").tag(0)
                                Text("m/s").tag(1)
                                Text("mph").tag(2)
                            }
                            .labelsHidden()
                            .tint(.gray)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(Color.white)
                            .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
                    )
                }
                
                // Section: Notifiche
                VStack(alignment: .leading, spacing: 0) {
                    Text("Notifiche")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.gray)
                        .textCase(.uppercase)
                        .padding(.horizontal, 4)
                        .padding(.bottom, 8)
                    
                    VStack(spacing: 0) {
                        HStack {
                            Text("Push Notifications")
                                .foregroundColor(.black)
                            Spacer()
                            Toggle("", isOn: .constant(true))
                                .labelsHidden()
                                .tint(Color(red: 236/255, green: 104/255, blue: 90/255))
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        
                        Divider()
                            .padding(.leading, 16)
                        
                        HStack {
                            Text("Email Alerts")
                                .foregroundColor(.black)
                            Spacer()
                            Toggle("", isOn: .constant(false))
                                .labelsHidden()
                                .tint(Color(red: 236/255, green: 104/255, blue: 90/255))
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(Color.white)
                            .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
                    )
                }
                
                // Section: App Info
                VStack(alignment: .leading, spacing: 0) {
                    Text("App Info")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.gray)
                        .textCase(.uppercase)
                        .padding(.horizontal, 4)
                        .padding(.bottom, 8)
                    
                    VStack(spacing: 0) {
                        HStack {
                            Text("Versione")
                                .foregroundColor(.black)
                            Spacer()
                            Text("1.0.2")
                                .foregroundColor(.gray)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        
                        Divider()
                            .padding(.leading, 16)
                        
                        HStack {
                            Text("Build")
                                .foregroundColor(.black)
                            Spacer()
                            Text("2024.11.20")
                                .foregroundColor(.gray)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(Color.white)
                            .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
        }
        .background(Color(red: 252/255, green: 249/255, blue: 246/255).ignoresSafeArea())
        .navigationTitle("Impostazioni Generali")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationView {
        GeneralSettingsView()
    }
}
