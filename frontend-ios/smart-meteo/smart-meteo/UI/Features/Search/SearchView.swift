import SwiftUI
import MapKit
import Combine

class SearchViewModel: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {
    @Published var searchQuery = ""
    @Published var results: [MKLocalSearchCompletion] = []
    @Published var isLoading = false
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
            .debounce(for: .milliseconds(500), scheduler: RunLoop.main)
            .sink { [weak self] query in
                if query.isEmpty {
                    self?.results = []
                } else {
                    self?.completer.queryFragment = query
                }
            }
            .store(in: &cancellables)
    }
    
    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        self.results = completer.results
    }
    
    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
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
            // Update AppState
            self.appState.selectLocation(
                coordinate: Coordinate(lat: coordinate.latitude, lon: coordinate.longitude),
                name: completion.title
            )
            
            // Brief delay for visual feedback, then dismiss
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
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Results List
                List {
                    if viewModel.results.isEmpty && !viewModel.searchQuery.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 32))
                                .foregroundColor(.gray.opacity(0.4))
                            Text("Nessun risultato")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    } else if viewModel.results.isEmpty && viewModel.searchQuery.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "location.magnifyingglass")
                                .font(.system(size: 40))
                                .foregroundColor(accentColor.opacity(0.3))
                            Text("Cerca una città")
                                .font(.headline)
                                .foregroundColor(.gray.opacity(0.6))
                            Text("Digita il nome per trovare le previsioni")
                                .font(.caption)
                                .foregroundColor(.gray.opacity(0.4))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 60)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    } else {
                        ForEach(viewModel.results, id: \.self) { result in
                            Button {
                                viewModel.selectLocation(result) {
                                    dismiss()
                                }
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: "mappin.circle.fill")
                                        .font(.title3)
                                        .foregroundColor(accentColor)
                                    
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(result.title)
                                            .font(.headline)
                                            .foregroundColor(.black)
                                        Text(result.subtitle)
                                            .font(.subheadline)
                                            .foregroundColor(.gray)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                }
                .listStyle(.plain)
                
                // Loading Overlay when selecting
                if viewModel.isSelecting {
                    Color.black.opacity(0.15)
                        .ignoresSafeArea()
                        .transition(.opacity)
                    
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.2)
                            .tint(accentColor)
                        
                        Text("Caricamento previsioni...")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.black)
                        
                        if let city = viewModel.selectedCityName {
                            Text(city)
                                .font(.headline)
                                .foregroundColor(accentColor)
                        }
                    }
                    .padding(28)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.white)
                            .shadow(color: .black.opacity(0.1), radius: 20, x: 0, y: 10)
                    )
                    .transition(.scale.combined(with: .opacity))
                }
            }
            .animation(.easeInOut(duration: 0.25), value: viewModel.isSelecting)
            .background(Color(red: 252/255, green: 249/255, blue: 246/255).ignoresSafeArea())
            .navigationTitle("Cerca Località")
            .searchable(text: $viewModel.searchQuery, prompt: "Cerca città...")
        }
    }
}

#Preview {
    SearchView()
}
