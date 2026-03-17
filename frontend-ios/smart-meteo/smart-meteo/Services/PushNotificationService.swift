import Foundation
import Combine
import CoreLocation
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
    
    // Device token salvato in attesa di coordinate GPS valide
    private(set) var pendingDeviceToken: String?

    // Inoltra il token al backend solo se le coordinate GPS sono valide
    func registerDeviceTokenWithBackend(token: String) {
        Task { @MainActor in
            guard let location = AppState.shared.currentLocation else {
                // GPS non ancora disponibile: salva il token e attendi
                print("GPS not available yet, storing device token for deferred registration")
                self.pendingDeviceToken = token
                return
            }

            let lat = location.coordinate.latitude
            let lon = location.coordinate.longitude

            // Protezione aggiuntiva contro coordinate (0,0) — punto nell'Oceano Atlantico
            guard abs(lat) > 0.01 || abs(lon) > 0.01 else {
                print("Invalid coordinates (0,0), deferring device token registration")
                self.pendingDeviceToken = token
                return
            }

            let locationName = AppState.shared.currentLocationName

            do {
                try await APIService.shared.subscribeToAlerts(deviceToken: token, lat: lat, lon: lon, locationName: locationName)
                print("Successfully registered device token with backend at \(lat),\(lon)")
                self.pendingDeviceToken = nil
            } catch {
                print("Failed to register device token with backend: \(error)")
                self.pendingDeviceToken = token
            }
        }
    }

    /// Chiamato da AppState quando la posizione GPS viene confermata, per registrare un token in attesa
    func registerPendingTokenIfNeeded(lat: Double, lon: Double, locationName: String) {
        guard let token = pendingDeviceToken else { return }

        // Protezione contro coordinate (0,0)
        guard abs(lat) > 0.01 || abs(lon) > 0.01 else { return }

        Task {
            do {
                try await APIService.shared.subscribeToAlerts(deviceToken: token, lat: lat, lon: lon, locationName: locationName)
                print("Successfully registered deferred device token at \(lat),\(lon)")
                await MainActor.run { self.pendingDeviceToken = nil }
            } catch {
                print("Failed to register deferred device token: \(error)")
            }
        }
    }
    
    // Disiscrizione dalle allerte (da chiamare ad es. nel logout o toggle disattivato)
    func unregisterDeviceToken() {
        // Implementazione disiscrizione opzionale
    }
    
    // GESTIONE DELEGATE (FOREGROUND NOTIFICATIONS)
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let userInfo = notification.request.content.userInfo

        // Se è un'allerta meteo, aggiorna le allerte attive
        if let type = userInfo["type"] as? String, type == "weather_alert" {
            Task { @MainActor in
                if let location = AppState.shared.currentLocation {
                    await AppState.shared.fetchAlerts(
                        lat: location.coordinate.latitude,
                        lon: location.coordinate.longitude
                    )
                }
            }
        }

        completionHandler([.banner, .sound, .badge])
    }

    // Gestisce il tap dell'utente sulla notifica
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo

        if let type = userInfo["type"] as? String, type == "weather_alert" {
            Task { @MainActor in
                // Aggiorna le allerte e apri la modale
                if let location = AppState.shared.currentLocation {
                    await AppState.shared.fetchAlerts(
                        lat: location.coordinate.latitude,
                        lon: location.coordinate.longitude
                    )
                }

                if let alertId = userInfo["alertId"] as? String {
                    AppState.shared.handlePushAlert(alertId: alertId)
                } else {
                    AppState.shared.showAlertsModal = true
                }
            }
        }

        completionHandler()
    }
}
