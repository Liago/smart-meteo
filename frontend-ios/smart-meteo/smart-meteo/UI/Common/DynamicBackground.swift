import SwiftUI
import SpriteKit

struct DynamicBackground: View {
    let condition: String
    
    var body: some View {
        ZStack {
            // Base Gradient
            AppColors.gradient(for: condition)
                .ignoresSafeArea()
            
            // Particle Effect (Optional)
            if shouldShowParticles(for: condition) {
                // Placeholder for SpriteKit scene initialization
                // SpriteView(scene: weatherScene(for: condition))
                //    .ignoresSafeArea()
            }
        }
    }
    
    private func shouldShowParticles(for condition: String) -> Bool {
        let c = condition.lowercased()
        return c.contains("rain") || c.contains("snow")
    }
}

#Preview {
    DynamicBackground(condition: "rain")
}
