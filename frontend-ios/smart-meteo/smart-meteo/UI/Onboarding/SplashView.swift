import SwiftUI

struct SplashView: View {
    @EnvironmentObject var appState: AppState
    @State private var isActive = false
    @State private var size = 0.8
    @State private var opacity = 0.5
    @State private var iconRotation = 0.0
    
    private let accentColor = Color(red: 236/255, green: 104/255, blue: 90/255)
    
    var body: some View {
        if isActive {
            ContentView()
        } else {
            ZStack {
                // Light background
                Color(red: 252/255, green: 249/255, blue: 246/255).ignoresSafeArea()
                
                VStack(spacing: 16) {
                    // Sun icon with subtle glow
                    ZStack {
                        // Glow ring
                        Circle()
                            .fill(accentColor.opacity(0.08))
                            .frame(width: 130, height: 130)
                        
                        Circle()
                            .fill(accentColor.opacity(0.05))
                            .frame(width: 160, height: 160)
                        
                        Image(systemName: "sun.max.fill")
                            .font(.system(size: 64))
                            .foregroundColor(accentColor)
                            .rotationEffect(.degrees(iconRotation))
                    }
                    
                    VStack(spacing: 6) {
                        Text("Smart Meteo")
                            .font(.system(size: 28, weight: .bold, design: .serif))
                            .foregroundColor(.black)
                        
                        Text("by Liago")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.gray)
                    }
                }
                .scaleEffect(size)
                .opacity(opacity)
                .onAppear {
                    appState.requestLocation()
                    withAnimation(.easeIn(duration: 1.2)) {
                        self.size = 0.9
                        self.opacity = 1.00
                    }
                    withAnimation(.linear(duration: 8).repeatForever(autoreverses: false)) {
                        self.iconRotation = 360
                    }
                }
            }
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    withAnimation {
                        self.isActive = true
                    }
                }
            }
        }
    }
}

#Preview {
    SplashView()
        .environmentObject(AppState.shared)
}
