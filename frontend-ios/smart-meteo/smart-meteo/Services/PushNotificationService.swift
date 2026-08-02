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

    // Ultimo device token ricevuto da APNs, serve per ri-registrare la
    // subscription quando il dispositivo si sposta
    private(set) var deviceToken: String?

    private static let lastSubscriptionLatKey = "alertSubscriptionLat"
    private static let lastSubscriptionLonKey = "alertSubscriptionLon"

    /// Spostamento oltre il quale la subscription alle allerte viene aggiornata (~10 km).
    /// Il backend cerca i destinatari in un raggio di 0.5°, quindi non serve
    /// inseguire ogni singolo aggiornamento GPS.
    private static let subscriptionUpdateDistanceMeters: CLLocationDistance = 10_000

    private func storeSubscriptionLocation(lat: Double, lon: Double) {
        UserDefaults.standard.set(lat, forKey: Self.lastSubscriptionLatKey)
        UserDefaults.standard.set(lon, forKey: Self.lastSubscriptionLonKey)
    }

    private func lastSubscriptionLocation() -> CLLocation? {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: Self.lastSubscriptionLatKey) != nil else { return nil }
        return CLLocation(
            latitude: defaults.double(forKey: Self.lastSubscriptionLatKey),
            longitude: defaults.double(forKey: Self.lastSubscriptionLonKey)
        )
    }

    // Inoltra il token al backend solo se le coordinate GPS sono valide
    func registerDeviceTokenWithBackend(token: String) {
        deviceToken = token
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
                self.storeSubscriptionLocation(lat: lat, lon: lon)
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
                await MainActor.run {
                    self.pendingDeviceToken = nil
                    self.storeSubscriptionLocation(lat: lat, lon: lon)
                }
            } catch {
                print("Failed to register deferred device token: \(error)")
            }
        }
    }

    /// Aggiorna la posizione della subscription alle allerte quando il dispositivo
    /// si sposta in modo significativo: altrimenti la subscription resterebbe
    /// ancorata alla località di prima registrazione e le notifiche continuerebbero
    /// ad arrivare per quella zona anche stando altrove.
    /// `/alerts/subscribe` sostituisce la subscription esistente del device.
    func updateSubscriptionLocationIfNeeded(lat: Double, lon: Double, locationName: String) {
        // Protezione contro coordinate (0,0)
        guard abs(lat) > 0.01 || abs(lon) > 0.01 else { return }

        // Token non ancora consegnato al backend: ci pensa la registrazione differita
        guard pendingDeviceToken == nil, let token = deviceToken else {
            registerPendingTokenIfNeeded(lat: lat, lon: lon, locationName: locationName)
            return
        }

        if let last = lastSubscriptionLocation() {
            let moved = CLLocation(latitude: lat, longitude: lon).distance(from: last)
            guard moved > Self.subscriptionUpdateDistanceMeters else { return }
        }

        Task {
            do {
                try await APIService.shared.subscribeToAlerts(deviceToken: token, lat: lat, lon: lon, locationName: locationName)
                print("Alert subscription location updated to \(lat),\(lon)")
                await MainActor.run { self.storeSubscriptionLocation(lat: lat, lon: lon) }
            } catch {
                print("Failed to update alert subscription location: \(error)")
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
