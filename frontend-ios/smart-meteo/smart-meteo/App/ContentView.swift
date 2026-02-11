import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        DashboardView()
            .preferredColorScheme(.dark) // Force dark mode for now as per design
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState.shared)
}
