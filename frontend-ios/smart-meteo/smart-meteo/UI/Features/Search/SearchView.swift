import SwiftUI
import MapKit
import Combine

class SearchViewModel: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {
    @Published var searchQuery = ""
    @Published var results: [MKLocalSearchCompletion] = []
    @Published var isSearching = false
    @Published var isSelecting = false
    @Published var selectedCityName: String?
    
    private let completer = MKLocalSearchCompleter()
    private var cancellables = Set<AnyCancellable>()
    private var appState: AppState
    
    init(appState: AppState = AppState.shared) {
        self.appState = appState
        super.init()
        completer.delegate = self
        completer.resultTypes = .address
        
        $searchQuery
            .debounce(for: .milliseconds(400), scheduler: RunLoop.main)
            .sink { [weak self] query in
                if query.isEmpty {
                    self?.results = []
                    self?.isSearching = false
                } else {
                    self?.isSearching = true
                    self?.completer.queryFragment = query
                }
            }
            .store(in: &cancellables)
    }
    
    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        isSearching = false
        self.results = completer.results
    }
    
    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        isSearching = false
        print("Search error: \(error.localizedDescription)")
    }
    
    func selectLocation(_ completion: MKLocalSearchCompletion, onComplete: @escaping () -> Void) {
        isSelecting = true
        selectedCityName = completion.title
        
        let searchRequest = MKLocalSearch.Request(completion: completion)
        let search = MKLocalSearch(request: searchRequest)
        search.start { [weak self] response, error in
            guard let self = self,
                  let response = response,
                  let item = response.mapItems.first else {
                DispatchQueue.main.async {
                    self?.isSelecting = false
                }
                return
            }
            
            let coordinate = item.placemark.coordinate
            self.appState.selectLocation(
                coordinate: Coordinate(lat: coordinate.latitude, lon: coordinate.longitude),
                name: completion.title
            )
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                self.isSelecting = false
                onComplete()
            }
        }
    }
}

struct SearchView: View {
    @StateObject private var viewModel = SearchViewModel()
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    
    private let accentColor = Color(red: 236/255, green: 104/255, blue: 90/255)
    private let bgColor = Color(red: 252/255, green: 249/255, blue: 246/255)
    
    var body: some View {
        NavigationStack {
            ZStack {
                bgColor.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 0) {
                        // Empty state
                        if viewModel.results.isEmpty && viewModel.searchQuery.isEmpty && !viewModel.isSearching {
                            emptyStateView
                        }
                        
                        // Searching spinner
                        if viewModel.isSearching {
                            VStack(spacing: 14) {
                                ProgressView()
                                    .scaleEffect(1.1)
                                    .tint(accentColor)
                                Text("Ricerca in corso...")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 60)
                        }
                        
                        // No results
                        if viewModel.results.isEmpty && !viewModel.searchQuery.isEmpty && !viewModel.isSearching {
                            VStack(spacing: 12) {
                                Image(systemName: "magnifyingglass")
                                    .font(.system(size: 32))
                                    .foregroundColor(.gray.opacity(0.3))
                                Text("Nessun risultato per \"\(viewModel.searchQuery)\"")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)
                                    .multilineTextAlignment(.center)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 60)
                            .padding(.horizontal, 32)
                        }
                        
                        // Results
                        if !viewModel.results.isEmpty {
                            LazyVStack(spacing: 8) {
                                ForEach(viewModel.results, id: \.self) { result in
                                    Button {
                                        viewModel.selectLocation(result) {
                                            dismiss()
                                        }
                                    } label: {
                                        HStack(spacing: 14) {
                                            ZStack {
                                                Circle()
                                                    .fill(accentColor.opacity(0.1))
                                                    .frame(width: 40, height: 40)
                                                Image(systemName: "mappin")
                                                    .font(.system(size: 16, weight: .semibold))
                                                    .foregroundColor(accentColor)
                                            }
                                            
                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(result.title)
                                                    .font(.system(size: 16, weight: .semibold))
                                                    .foregroundColor(.black)
                                                if !result.subtitle.isEmpty {
                                                    Text(result.subtitle)
                                                        .font(.system(size: 13))
                                                        .foregroundColor(.gray)
                                                }
                                            }
                                            
                                            Spacer()
                                            
                                            Image(systemName: "chevron.right")
                                                .font(.caption)
                                                .foregroundColor(.gray.opacity(0.4))
                                        }
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 14)
                                        .background(
                                            RoundedRectangle(cornerRadius: 14)
                                                .fill(Color.white)
                                                .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
                                        )
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                        }
                    }
                }
                
                // Selection overlay
                if viewModel.isSelecting {
                    Color.black.opacity(0.2)
                        .ignoresSafeArea()
                        .transition(.opacity)
                    
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.2)
                            .tint(accentColor)
                        
                        if let city = viewModel.selectedCityName {
                            Text(city)
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(.black)
                        }
                        
                        Text("Caricamento previsioni...")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                    .padding(32)
                    .background(
                        RoundedRectangle(cornerRadius: 18)
                            .fill(Color.white)
                            .shadow(color: .black.opacity(0.12), radius: 24, x: 0, y: 12)
                    )
                    .transition(.scale.combined(with: .opacity))
                }
            }
            .animation(.easeInOut(duration: 0.25), value: viewModel.isSelecting)
            .navigationTitle("Cerca Località")
            .searchable(text: $viewModel.searchQuery, prompt: "Cerca città...")
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(accentColor.opacity(0.08))
                    .frame(width: 80, height: 80)
                Image(systemName: "location.magnifyingglass")
                    .font(.system(size: 32))
                    .foregroundColor(accentColor.opacity(0.5))
            }
            
            VStack(spacing: 6) {
                Text("Cerca una città")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.black.opacity(0.7))
                Text("Digita il nome per trovare le previsioni meteo")
                    .font(.subheadline)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
        .padding(.horizontal, 40)
    }
}

#Preview {
    SearchView()
        .environmentObject(AppState.shared)
}
