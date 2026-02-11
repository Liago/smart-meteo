import SwiftUI
import MapKit
import Combine

class SearchViewModel: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {
    @Published var searchQuery = ""
    @Published var results: [MKLocalSearchCompletion] = []
    @Published var isLoading = false
    
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
        let searchRequest = MKLocalSearch.Request(completion: completion)
        let search = MKLocalSearch(request: searchRequest)
        search.start { [weak self] response, error in
            guard let self = self,
                  let response = response,
                  let item = response.mapItems.first else { return }
            
            let coordinate = item.placemark.coordinate
            // Update AppState
            self.appState.selectLocation(
                coordinate: Coordinate(lat: coordinate.latitude, lon: coordinate.longitude),
                name: completion.title
            )
            
            print("Selected: \(completion.title)")
            
            // Execute completion for navigation
            DispatchQueue.main.async {
                onComplete()
            }
        }
    }
}

struct SearchView: View {
    @StateObject private var viewModel = SearchViewModel()
    @EnvironmentObject var appState: AppState
    
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            List(viewModel.results, id: \.self) { result in
                Button {
                    viewModel.selectLocation(result) {
                        dismiss()
                    }
                } label: {
                    VStack(alignment: .leading) {
                        Text(result.title)
                            .font(.headline)
                        Text(result.subtitle)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Cerca Località")
            .searchable(text: $viewModel.searchQuery, prompt: "Cerca città...")
        }
    }
}

#Preview {
    SearchView()
}
