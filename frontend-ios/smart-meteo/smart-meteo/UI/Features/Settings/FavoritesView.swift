import SwiftUI

struct FavoritesView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        List {
            if appState.favoriteLocations.isEmpty {
                Text("Nessuna località preferita")
                    .foregroundColor(.gray)
                    .listRowBackground(Color.clear)
            } else {
                ForEach(appState.favoriteLocations) { location in
                    Button(action: {
                        appState.selectLocation(coordinate: location.coordinate, name: location.name)
                        // Close sidebar? handled by parent or state
                    }) {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(location.name)
                                    .font(.headline)
                                    .foregroundColor(.white)
                                Text("\(String(format: "%.4f", location.coordinate.lat)), \(String(format: "%.4f", location.coordinate.lon))")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.gray)
                        }
                        .padding()
                        .background(Color.white.opacity(0.05))
                        .cornerRadius(12)
                    }
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
                .onDelete(perform: appState.removeFavorite)
            }
        }
        .listStyle(.plain)
        .background(Color.black.edgesIgnoringSafeArea(.all))
        .navigationTitle("Località Preferite")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationView {
        FavoritesView()
            .environmentObject(AppState.shared)
            .background(Color(hex: "0B1120"))
    }
}
