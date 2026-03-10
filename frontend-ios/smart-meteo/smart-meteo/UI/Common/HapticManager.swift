import UIKit

enum HapticManager {
    static var isEnabled: Bool { AppState.shared.isHapticEnabled }
    
    static func light() {
        guard isEnabled else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    
    static func medium() {
        guard isEnabled else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
    
    static func heavy() {
        guard isEnabled else { return }
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
    }
    
    static func selection() {
        guard isEnabled else { return }
        UISelectionFeedbackGenerator().selectionChanged()
    }
    
    static func error() {
        guard isEnabled else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }
    
    static func success() {
        guard isEnabled else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
