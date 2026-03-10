import Foundation
import UIKit
import UserNotifications

class PushNotificationService: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationService()
    
    @Published var isAuthorized: Bool = false
    
    override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
        checkStatus()
    }
    
    func checkStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                self.isAuthorized = settings.authorizationStatus == .authorized
            }
        }
    }
    
    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            DispatchQueue.main.async {
                self.isAuthorized = granted
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                } else {
                    print("Push permissions denied")
                }
                
                if let error = error {
                    print("Push permission error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    // Inoltra il token al backend
    func registerDeviceTokenWithBackend(token: String) {
        Task {
            // Prendiamo lat e lon dell'utente dallo stato corrente, oppure lasciamo 0 in attesa del primo fix GPS
            let lat = AppState.shared.location?.coordinate.latitude ?? 0.0
            let lon = AppState.shared.location?.coordinate.longitude ?? 0.0
            let locationName = AppState.shared.locationName
            
            do {
                try await APIService.shared.subscribeToAlerts(deviceToken: token, lat: lat, lon: lon, locationName: locationName)
                print("Successfully registered device token with backend: \(token)")
            } catch {
                print("Failed to register device token with backend: \(error)")
            }
        }
    }
    
    // Disiscrizione dalle allerte (da chiamare ad es. nel logout o toggle disattivato)
    func unregisterDeviceToken() {
        // Implementazione disiscrizione opzionale
    }
    
    // GESTIONE DELEGATE (FOREGROUND NOTIFICATIONS)
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // Mostra notifica anche con l'app aperta
        completionHandler([.banner, .sound, .badge])
    }
}
