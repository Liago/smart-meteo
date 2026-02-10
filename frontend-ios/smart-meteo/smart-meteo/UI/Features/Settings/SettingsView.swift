import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingLogin = false
    
    var body: some View {
        GlassContainer {
            VStack(alignment: .leading, spacing: 20) {
                Text("Settings")
                    .font(.largeTitle)
                    .bold()
                    .foregroundColor(.white)
                
                // Auth Section
                Section(header: Text("Account").font(.headline).foregroundColor(.white.opacity(0.8))) {
                    if appState.isAuthenticated {
                        HStack {
                            Image(systemName: "person.circle.fill")
                                .resizable()
                                .frame(width: 40, height: 40)
                                .foregroundColor(.white)
                            VStack(alignment: .leading) {
                                Text(appState.currentUser?.email ?? "User")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                Text("Premium Member")
                                    .font(.caption)
                                    .foregroundColor(.green)
                            }
                            Spacer()
                            Button("Sign Out") {
                                Task {
                                    try? await AuthService.shared.signOut()
                                }
                            }
                            .buttonStyle(.bordered)
                            .tint(.red)
                        }
                        .padding()
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                    } else {
                        Button(action: { showingLogin = true }) {
                            Text("Sign In / Sign Up")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                        }
                    }
                }
                
                // Preferences Section
                Section(header: Text("Preferences").font(.headline).foregroundColor(.white.opacity(0.8))) {
                    Toggle("Use Metric Units", isOn: .constant(true))
                        .toggleStyle(SwitchToggleStyle(tint: .blue))
                        .foregroundColor(.white)
                    
                    Toggle("Haptic Feedback", isOn: .constant(true))
                        .toggleStyle(SwitchToggleStyle(tint: .blue))
                        .foregroundColor(.white)
                }
                
                Spacer()
                
                Text("Smart Meteo v1.0")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .padding()
        }
        .padding()
        .presentationDetents([.medium, .large])
        .sheet(isPresented: $showingLogin) {
            LoginView()
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState.shared)
        .background(Color.black)
}
