import SpriteKit
import SwiftUI

class WeatherParticleScene: SKScene {
    var condition: String = ""
    private var baseEmitter: SKEmitterNode?
    
    override func sceneDidLoad() {
        backgroundColor = .clear
        scaleMode = .resizeFill
        anchorPoint = CGPoint(x: 0.5, y: 1.0)
    }
    
    override func didMove(to view: SKView) {
        view.allowsTransparency = true
        view.backgroundColor = .clear
        setupParticles()
    }
    
    override func didChangeSize(_ oldSize: CGSize) {
        super.didChangeSize(oldSize)
        if let emitter = baseEmitter {
            emitter.particlePositionRange = CGVector(dx: size.width, dy: 0)
        }
    }
    
    func setupParticles() {
        removeAllChildren()
        
        let c = condition.lowercased()
        if c.contains("storm") {
            setupStorm()
        } else if c.contains("rain") {
            setupRain(intensity: 1.0)
        } else if c.contains("snow") {
            setupSnow()
        }
    }
    
    private func createTexture(color: UIColor, size: CGSize, isCircle: Bool = false) -> SKTexture {
        UIGraphicsBeginImageContextWithOptions(size, false, 0.0)
        guard let context = UIGraphicsGetCurrentContext() else { return SKTexture() }
        context.setFillColor(color.cgColor)
        let rect = CGRect(origin: .zero, size: size)
        if isCircle {
            context.fillEllipse(in: rect)
        } else {
            let path = UIBezierPath(roundedRect: rect, cornerRadius: size.width / 2)
            path.fill()
        }
        let image = UIGraphicsGetImageFromCurrentImageContext() ?? UIImage()
        UIGraphicsEndImageContext()
        return SKTexture(image: image)
    }
    
    private func setupRain(intensity: CGFloat) {
        let emitter = SKEmitterNode()
        let dropSize = CGSize(width: 2, height: 16)
        emitter.particleTexture = createTexture(color: .white, size: dropSize, isCircle: false)
        
        emitter.particleBirthRate = 180 * intensity
        emitter.particleLifetime = 2.0
        emitter.particlePositionRange = CGVector(dx: UIScreen.main.bounds.width, dy: 0)
        
        emitter.particleSpeed = 600
        emitter.particleSpeedRange = 150
        emitter.emissionAngle = 3 * .pi / 2
        emitter.emissionAngleRange = 0.1
        
        emitter.particleAlpha = 0.4
        emitter.particleAlphaRange = 0.2
        emitter.particleScale = 0.3
        emitter.particleScaleRange = 0.2
        
        // Advance simulation so particles are already visible on screen
        emitter.advanceSimulationTime(2.0)
        
        self.baseEmitter = emitter
        addChild(emitter)
    }
    
    private func setupSnow() {
        let emitter = SKEmitterNode()
        let flakeSize = CGSize(width: 8, height: 8)
        emitter.particleTexture = createTexture(color: .white, size: flakeSize, isCircle: true)
        
        emitter.particleBirthRate = 40
        emitter.particleLifetime = 6.0
        emitter.particlePositionRange = CGVector(dx: UIScreen.main.bounds.width, dy: 0)
        
        emitter.particleSpeed = 80
        emitter.particleSpeedRange = 30
        emitter.emissionAngle = 3 * .pi / 2
        emitter.emissionAngleRange = .pi / 4
        
        emitter.particleAlpha = 0.6
        emitter.particleAlphaRange = 0.3
        emitter.particleScale = 0.4
        emitter.particleScaleRange = 0.3
        
        // Add lateral drifting
        emitter.xAcceleration = 10
        
        // Advance simulation
        emitter.advanceSimulationTime(6.0)
        
        self.baseEmitter = emitter
        addChild(emitter)
    }
    
    private func setupStorm() {
        // Heavy rain + lightning effect
        setupRain(intensity: 1.5)
        
        // Lightning sequence
        let wait = SKAction.wait(forDuration: 3.0, withRange: 2.0)
        let flash = SKAction.run { [weak self] in
            let lightningNode = SKShapeNode(rectOf: UIScreen.main.bounds.size)
            lightningNode.fillColor = .init(white: 1.0, alpha: 0.3)
            lightningNode.strokeColor = .clear
            lightningNode.position = CGPoint(x: 0, y: -(UIScreen.main.bounds.height / 2))
            lightningNode.blendMode = .add
            self?.addChild(lightningNode)
            
            let fadeOut = SKAction.fadeOut(withDuration: 0.2)
            let remove = SKAction.removeFromParent()
            lightningNode.run(SKAction.sequence([fadeOut, remove]))
            
            // Haptic for thunder
            DispatchQueue.main.async {
                HapticManager.heavy()
            }
        }
        let sequence = SKAction.sequence([wait, flash])
        run(SKAction.repeatForever(sequence))
    }
}
