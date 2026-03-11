import SwiftUI

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        print("Device Token: \(token)")
        PushNotificationService.shared.registerDeviceTokenWithBackend(token: token)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Failed to register for remote notifications: \(error.localizedDescription)")
    }
}

@main
struct SmartMeteoApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var appState = AppState.shared
    
    var body: some Scene {
        WindowGroup {
            SplashView()
                .environmentObject(appState)
                .task {
                    // Check push notification status on launch
                    PushNotificationService.shared.checkStatus()
                    // Richiedi il permesso per le notifiche push al primo avvio
                    PushNotificationService.shared.requestAuthorization()
                }
        }
    }
}
