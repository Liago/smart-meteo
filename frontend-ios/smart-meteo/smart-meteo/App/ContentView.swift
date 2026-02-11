import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        TabView(selection: $appState.selectedTab) {
            DashboardView()
                .tabItem {
                    Label("Meteo", systemImage: "cloud.sun.fill")
                }
                .tag(0)
            
            SearchView()
                .tabItem {
                    Label("Cerca", systemImage: "magnifyingglass")
                }
                .tag(1)
            
            SettingsView()
                .tabItem {
                    Label("Impostazioni", systemImage: "gearshape.fill")
                }
                .tag(2)
        }
        .tint(.white)
        .preferredColorScheme(.dark) // Force dark mode for now as per design
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState.shared)
}
