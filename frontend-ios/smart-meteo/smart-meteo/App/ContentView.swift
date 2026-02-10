import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Meteo", systemImage: "cloud.sun.fill")
                }
            
            SearchView()
                .tabItem {
                    Label("Cerca", systemImage: "magnifyingglass")
                }
            
            SettingsView()
                .tabItem {
                    Label("Impostazioni", systemImage: "gearshape.fill")
                }
        }
        .tint(.white)
        .preferredColorScheme(.dark) // Force dark mode for now as per design
    }
}

#Preview {
    ContentView()
}
