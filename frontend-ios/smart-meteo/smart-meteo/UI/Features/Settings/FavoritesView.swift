import SwiftUI

struct FavoritesView: View {
    @EnvironmentObject var appState: AppState
    @Binding var isSidebarPresented: Bool
    @Environment(\.dismiss) var dismiss
    
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
                        withAnimation {
                            isSidebarPresented = false
                        }
                        dismiss()
                    }) {
                        HStack {
                            VStack(alignment: .leading) {
                                HStack {
                                    Text(location.name)
                                        .font(.headline)
                                        .foregroundColor(.white)
                                    
                                    if appState.isHome(location: location) {
                                        Image(systemName: "house.fill")
                                            .foregroundColor(.blue)
                                            .font(.caption)
                                    }
                                }
                                
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
                    .swipeActions(edge: .leading) {
                        Button {
                            appState.setAsHome(location: location)
                        } label: {
                            Label("Imposta come Casa", systemImage: "house")
                        }
                        .tint(.blue)
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            if let index = appState.favoriteLocations.firstIndex(of: location) {
                                appState.favoriteLocations.remove(at: index)
                            }
                        } label: {
                            Label("Elimina", systemImage: "trash")
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .background(Color(hex: "0B1120").ignoresSafeArea())
        .navigationTitle("Località Preferite")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationView {
        FavoritesView(isSidebarPresented: .constant(true))
            .environmentObject(AppState.shared)
            .background(Color(hex: "0B1120"))
    }
}
