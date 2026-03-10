import SwiftUI

struct SourcesView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ForEach(appState.weatherSources) { source in
                    HStack(alignment: .top, spacing: 12) {
                        Circle()
                            .fill(source.active ? Color(red: 236/255, green: 104/255, blue: 90/255) : Color.gray.opacity(0.4))
                            .frame(width: 10, height: 10)
                            .padding(.top, 6)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(source.name)
                                    .font(.headline)
                                    .foregroundColor(.black)
                                Spacer()
                                Toggle("", isOn: Binding(
                                    get: { source.active },
                                    set: { _ in
                                        HapticManager.light()
                                        appState.toggleSource(source.id)
                                    }
                                ))
                                .labelsHidden()
                                .tint(Color(red: 236/255, green: 104/255, blue: 90/255))
                            }
                            
                            Text(source.description ?? "No description available")
                                .font(.caption)
                                .foregroundColor(.gray)
                            
                            Text("Peso: \(String(format: "%.1f", source.weight))")
                                .font(.caption2)
                                .foregroundColor(.gray.opacity(0.6))
                                .padding(.top, 2)
                        }
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(Color.white)
                            .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
        }
        .background(Color(red: 252/255, green: 249/255, blue: 246/255).ignoresSafeArea())
        .navigationTitle("Gestione Fonti")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationView {
        SourcesView()
            .environmentObject(AppState.shared)
    }
}
