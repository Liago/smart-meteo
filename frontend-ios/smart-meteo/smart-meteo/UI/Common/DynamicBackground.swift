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
                SpriteView(scene: createScene(for: condition), options: [.allowsTransparency])
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }
        }
    }
    
    private func createScene(for condition: String) -> SKScene {
        let scene = WeatherParticleScene()
        scene.condition = condition
        scene.size = UIScreen.main.bounds.size
        scene.scaleMode = .resizeFill
        scene.backgroundColor = .clear
        return scene
    }
    
    private func shouldShowParticles(for condition: String) -> Bool {
        let c = condition.lowercased()
        return c.contains("rain") || c.contains("snow") || c.contains("storm")
    }
}

#Preview {
    DynamicBackground(condition: "rain")
}
