import SwiftUI

struct SourcesView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        List {
            ForEach(appState.weatherSources) { source in
                HStack(alignment: .top, spacing: 12) {
                    Circle()
                        .fill(source.active ? Color.blue : Color.gray)
                        .frame(width: 10, height: 10)
                        .padding(.top, 6)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(source.name)
                                .font(.headline)
                                .foregroundColor(.white)
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { source.active },
                                set: { _ in appState.toggleSource(source.id) }
                            ))
                            .labelsHidden()
                            .tint(.green)
                        }
                        
                        Text(source.description ?? "No description available")
                            .font(.caption)
                            .foregroundColor(.gray)
                        
                        Text("Peso: \(String(format: "%.1f", source.weight))")
                            .font(.caption2)
                            .foregroundColor(.gray.opacity(0.8))
                            .padding(.top, 2)
                    }
                }
                .padding()
                .background(Color.white.opacity(0.05))
                .cornerRadius(12)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .background(Color.black.edgesIgnoringSafeArea(.all)) // fallback background
        .navigationTitle("Gestione Fonti")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationView {
        SourcesView()
            .environmentObject(AppState.shared)
            .background(Color(hex: "0B1120"))
    }
}
