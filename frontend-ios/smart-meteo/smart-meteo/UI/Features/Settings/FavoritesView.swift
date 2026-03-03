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
                // HOME SECTION
                if let home = appState.homeLocation, appState.favoriteLocations.contains(where: { $0.id == home.id }) {
                    Section {
                        FavoriteRowView(
                            location: home,
                            appState: appState,
                            isSidebarPresented: $isSidebarPresented,
                            dismiss: dismiss
                        )
                    } header: {
                        Text("CASA")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.gray)
                    }
                }
                
                // OTHER LOCATIONS SECTION
                Section {
                    ForEach(appState.favoriteLocations.filter { $0.id != appState.homeLocation?.id }) { location in
                        FavoriteRowView(
                            location: location,
                            appState: appState,
                            isSidebarPresented: $isSidebarPresented,
                            dismiss: dismiss
                        )
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
                } header: {
                    Text(appState.homeLocation != nil ? "ALTRE LOCALITÀ" : "LOCALITÀ")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.gray)
                }
            }
        }
        .listStyle(.plain)
        .background(Color(red: 252/255, green: 249/255, blue: 246/255).ignoresSafeArea()) // Off-white
        .navigationTitle("Località Preferite")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct FavoriteRowView: View {
    let location: SavedLocation
    @ObservedObject var appState: AppState
    @Binding var isSidebarPresented: Bool
    var dismiss: DismissAction
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(location.name)
                    .font(.headline)
                    .foregroundColor(.black)
                    
                Text("\(String(format: "%.4f", location.coordinate.lat)), \(String(format: "%.4f", location.coordinate.lon))")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            // Home Toggle Button
            Button(action: {
                appState.setAsHome(location: location)
            }) {
                Image(systemName: appState.isHome(location: location) ? "house.fill" : "house")
                    .foregroundColor(appState.isHome(location: location) ? Color(red: 236/255, green: 104/255, blue: 90/255) : .gray)
                    .font(.title3)
                    .padding(8)
            }
            .buttonStyle(.plain)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white)
                .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
        )
        // Row Tap Gesture
        .onTapGesture {
            // 1. Trigger weather fetch FIRST
            appState.selectLocation(coordinate: location.coordinate, name: location.name)
            
            // 2. Then close everything
            withAnimation {
                isSidebarPresented = false
            }
            dismiss()
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }
}

#Preview {
    NavigationView {
        FavoritesView(isSidebarPresented: .constant(true))
            .environmentObject(AppState.shared)
            .background(Color(red: 252/255, green: 249/255, blue: 246/255))
    }
}
