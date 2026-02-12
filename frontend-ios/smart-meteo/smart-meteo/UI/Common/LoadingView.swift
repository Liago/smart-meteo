import SwiftUI

struct LoadingView: View {
    var message: String = "Loading..."
    
    var body: some View {
        ZStack {
            // Removed background dim/material to blend with dashboard
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                .scaleEffect(1.5)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    ZStack {
        Color.black
        LoadingView()
    }
}
