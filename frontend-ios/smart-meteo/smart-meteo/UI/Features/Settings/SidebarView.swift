import SwiftUI

struct SidebarView: View {
    @EnvironmentObject var appState: AppState
    @Binding var isPresented: Bool
    @State private var showingLogin = false
    
    var body: some View {
        ZStack {
            // Background Layer
            Color(hex: "0B1120").ignoresSafeArea()
            
            VStack(alignment: .leading, spacing: 0) {
                // Header (User Profile)
                VStack(alignment: .leading, spacing: 16) {
                    if appState.isAuthenticated {
                        HStack(spacing: 16) {
                            Image(systemName: "person.circle.fill")
                                .resizable()
                                .frame(width: 50, height: 50)
                                .foregroundColor(.blue)
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(appState.currentUser?.email ?? "Utente")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                Text("Premium")
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.blue.opacity(0.2))
                                    .foregroundColor(.blue)
                                    .cornerRadius(8)
                            }
                        }
                    } else {
                        Button(action: { showingLogin = true }) {
                            HStack {
                                Image(systemName: "person.crop.circle.badge.plus")
                                    .font(.title2)
                                Text("Accedi / Registrati")
                                    .font(.headline)
                            }
                            .foregroundColor(.white)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(Color.blue)
                            .cornerRadius(12)
                        }
                    }
                }
                .padding(24)
                .background(Color.white.opacity(0.05))
                
                // Menu Items
                ScrollView {
                    VStack(spacing: 8) {
                        // Section: Meteo
                        Text("METEO")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.gray)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 24)
                            .padding(.top, 24)
                            .padding(.bottom, 8)
                        
                        NavigationLink(destination: SourcesView()) {
                            SidebarRow(icon: "server.rack", title: "Gestione Fonti", subtitle: "Configura provider dati")
                        }
                        
                        NavigationLink(destination: FavoritesView()) {
                            SidebarRow(icon: "star.fill", title: "Località Preferite", subtitle: "Gestisci i tuoi luoghi salavati")
                        }
                        
                        // Section: App
                        Text("APP")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.gray)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 24)
                            .padding(.top, 24)
                            .padding(.bottom, 8)
                        
                        SidebarRow(icon: "gearshape", title: "Impostazioni Generali", subtitle: "Unità, notifiche, lingua")
                        
                        if appState.isAuthenticated {
                            Button(action: {
                                Task { try? await AuthService.shared.signOut() }
                            }) {
                                SidebarRow(icon: "rectangle.portrait.and.arrow.right", title: "Esci", subtitle: nil, color: .red)
                            }
                        }
                    }
                    .padding(.vertical)
                }
                
                Spacer()
                
                // Footer
                VStack(spacing: 4) {
                    Text("Smart Meteo v1.0.2")
                        .font(.caption2)
                        .foregroundColor(.gray)
                    Text("Build 2024.11.20")
                        .font(.caption2)
                        .foregroundColor(.gray.opacity(0.5))
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 24)
            }
        }
        .sheet(isPresented: $showingLogin) {
            LoginView()
        }
    }
}

struct SidebarRow: View {
    let icon: String
    let title: String
    let subtitle: String?
    var color: Color = .white
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .frame(width: 30)
                .foregroundColor(color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                    .foregroundColor(color)
                
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }
            
            Spacer()
            
            if subtitle != nil {
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.gray.opacity(0.5))
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}



#Preview {
    SidebarView(isPresented: .constant(true))
        .environmentObject(AppState.shared)
}
