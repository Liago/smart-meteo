import SwiftUI

@main
struct SmartMeteoApp: App {
    @StateObject private var appState = AppState.shared
    
    var body: some Scene {
        WindowGroup {
            SplashView()
                .environmentObject(appState)
        }
    }
}
