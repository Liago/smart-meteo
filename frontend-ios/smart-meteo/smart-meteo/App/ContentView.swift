import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        DashboardView()
            .preferredColorScheme(.light) // Force light mode as per new design
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState.shared)
}
