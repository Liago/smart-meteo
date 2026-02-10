import SwiftUI

struct GlassContainer<Content: View>: View {
    let content: Content
    var cornerRadius: CGFloat = 20
    var material: Material = .ultraThinMaterial
    
    init(cornerRadius: CGFloat = 20, material: Material = .ultraThinMaterial, @ViewBuilder content: () -> Content) {
        self.cornerRadius = cornerRadius
        self.material = material
        self.content = content()
    }
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(material)
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
            
            content
                .padding()
        }
        // Ensure the glass effect works correctly by clipping if needed
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
    }
}


#Preview {
    ZStack {
        Color.blue // Background to show transparency
        GlassContainer {
            VStack(alignment: .leading) {
                Text("Glass Effect")
                    .font(.headline)
                    .foregroundColor(.white)
                Text("This is a glass container.")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.8))
            }
        }
        .padding()
    }
}
