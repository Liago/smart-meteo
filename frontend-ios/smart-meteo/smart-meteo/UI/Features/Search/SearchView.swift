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

/// Località: ricerca e preferiti nella stessa schermata.
///
/// Prima erano due posti diversi — si cercava qui e si gestivano i preferiti
/// nelle impostazioni — il che è esattamente il contrario di come si usa: nove
/// volte su dieci si apre la lente per tornare su una località che si ha già
/// salvato, non per cercarne una nuova. Ora i preferiti sono la **prima** cosa
/// che si vede, e il campo di ricerca serve al caso meno frequente.
///
/// Riferimento: `ios Redisign/README.md`, schermata 3.
struct SearchView: View {
    @StateObject private var viewModel = SearchViewModel()
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss

    var theme: WeatherTheme = WeatherTheme.of(.clear)

    private var isBrowsing: Bool {
        viewModel.searchQuery.isEmpty && !viewModel.isSearching
    }

    var body: some View {
        ZStack {
            theme.page.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    searchField

                    if isBrowsing {
                        favourites
                    } else if viewModel.isSearching {
                        searching
                    } else if viewModel.results.isEmpty {
                        noResults
                    } else {
                        results
                    }
                }
                .padding(.vertical, 16)
            }

            if viewModel.isSelecting {
                selectionOverlay
            }
        }
        .animation(.easeInOut(duration: 0.25), value: viewModel.isSelecting)
    }

    // MARK: - Intestazione e campo

    private var header: some View {
        HStack(spacing: 10) {
            Button {
                HapticManager.light()
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.duetUI(16, .semibold))
                    .foregroundColor(theme.ink.opacity(0.8))
                    .frame(width: 38, height: 38)
                    .background(
                        RoundedRectangle(cornerRadius: 13).fill(Color.white.opacity(0.8))
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Chiudi")

            Text("Località")
                .font(.duetDisplay(26))
                .foregroundColor(Duet.ink)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.duetUI(16, .medium))
                .foregroundColor(Duet.ink.opacity(0.4))

            TextField("Cerca città o CAP", text: $viewModel.searchQuery)
                .font(.duetUI(14, .semibold))
                .foregroundColor(Duet.ink)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.words)
                .tint(theme.accent)

            if !viewModel.searchQuery.isEmpty {
                Button {
                    viewModel.searchQuery = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.duetUI(15))
                        .foregroundColor(Duet.ink.opacity(0.25))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Cancella la ricerca")
            }
        }
        .padding(.vertical, 13)
        .padding(.horizontal, 16)
        .background(RoundedRectangle(cornerRadius: 18).fill(Duet.surface))
        .shadow(color: Duet.shadowCard, radius: 10, x: 0, y: 2)
        .padding(.horizontal, 16)
    }

    // MARK: - Preferiti

    @ViewBuilder
    private var favourites: some View {
        if appState.favoriteLocations.isEmpty {
            emptyState
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Text("PREFERITI")
                    .font(.duetUI(10.5, .semibold))
                    .tracking(1.25)
                    .foregroundColor(Duet.ink.opacity(0.45))
                    .padding(.horizontal, 20)
                    .padding(.top, 4)

                ForEach(ordinati) { location in
                    Button {
                        HapticManager.selection()
                        appState.selectLocation(coordinate: location.coordinate, name: location.name)
                        dismiss()
                    } label: {
                        favouriteRow(location)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 16)
                }
            }
        }
    }

    /// Casa per prima: è la località che si riapre più spesso.
    private var ordinati: [SavedLocation] {
        let casa = appState.homeLocation
        let altre = appState.favoriteLocations.filter { $0.name != casa?.name }
        if let casa, appState.favoriteLocations.contains(where: { $0.name == casa.name }) {
            return [casa] + altre
        }
        return altre
    }

    private func favouriteRow(_ location: SavedLocation) -> some View {
        HStack(spacing: 12) {
            Image(systemName: appState.isHome(location: location) ? "house.fill" : "mappin")
                .font(.duetUI(15, .medium))
                .foregroundColor(theme.accent)
                .frame(width: 22)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(location.name)
                        .font(.duetUI(14, .bold))
                        .foregroundColor(Duet.ink)
                        .lineLimit(1)

                    if appState.isHome(location: location) {
                        Text("CASA")
                            .font(.duetUI(9, .bold))
                            .tracking(0.5)
                            .foregroundColor(theme.accent)
                    }
                }

                // Nessuna temperatura accanto al nome, a differenza del mockup:
                // richiederebbe una chiamata per ogni preferito, e inventarla
                // sarebbe peggio che non mostrarla.
                Text(Self.coordinates(location.coordinate))
                    .font(.duetUI(11.5))
                    .foregroundColor(Duet.ink.opacity(0.45))
            }

            Spacer(minLength: 4)

            Image(systemName: "chevron.right")
                .font(.duetUI(12, .semibold))
                .foregroundColor(Duet.ink.opacity(0.25))
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 16)
        .background(RoundedRectangle(cornerRadius: Duet.rCard).fill(Duet.surface))
        .contentShape(Rectangle())
    }

    static func coordinates(_ coordinate: Coordinate) -> String {
        String(format: "%.2f, %.2f", coordinate.lat, coordinate.lon)
            .replacingOccurrences(of: ".", with: ",")
    }

    // MARK: - Risultati

    private var results: some View {
        VStack(spacing: 8) {
            ForEach(viewModel.results, id: \.self) { result in
                Button {
                    HapticManager.selection()
                    viewModel.selectLocation(result) { dismiss() }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "mappin")
                            .font(.duetUI(15, .medium))
                            .foregroundColor(theme.accent)
                            .frame(width: 22)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.title)
                                .font(.duetUI(14, .bold))
                                .foregroundColor(Duet.ink)
                                .lineLimit(1)

                            if !result.subtitle.isEmpty {
                                Text(result.subtitle)
                                    .font(.duetUI(11.5))
                                    .foregroundColor(Duet.ink.opacity(0.45))
                                    .lineLimit(1)
                            }
                        }

                        Spacer(minLength: 4)

                        Image(systemName: "chevron.right")
                            .font(.duetUI(12, .semibold))
                            .foregroundColor(Duet.ink.opacity(0.25))
                    }
                    .padding(.vertical, 14)
                    .padding(.horizontal, 16)
                    .background(RoundedRectangle(cornerRadius: Duet.rCard).fill(Duet.surface))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
    }

    private var searching: some View {
        VStack(spacing: 12) {
            ProgressView().tint(theme.accent)
            Text("Ricerca in corso…")
                .font(.duetUI(12))
                .foregroundColor(Duet.ink.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    private var noResults: some View {
        VStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 30))
                .foregroundColor(Duet.ink.opacity(0.2))
            Text("Nessun risultato per «\(viewModel.searchQuery)»")
                .font(.duetUI(13))
                .foregroundColor(Duet.ink.opacity(0.5))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
        .padding(.horizontal, 32)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "location.magnifyingglass")
                .font(.system(size: 30))
                .foregroundColor(theme.accent.opacity(0.5))

            Text("Nessun preferito")
                .font(.duetUI(14, .semibold))
                .foregroundColor(Duet.ink)

            Text("Cerca una città qui sopra, poi tieni premuto il nome sulla dashboard per salvarla.")
                .font(.duetUI(11.5))
                .foregroundColor(Duet.ink.opacity(0.5))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
        .padding(.horizontal, 40)
    }

    private var selectionOverlay: some View {
        ZStack {
            Color.black.opacity(0.2).ignoresSafeArea()

            VStack(spacing: 14) {
                ProgressView().scaleEffect(1.1).tint(theme.accent)

                if let city = viewModel.selectedCityName {
                    Text(city)
                        .font(.duetUI(16, .bold))
                        .foregroundColor(Duet.ink)
                }

                Text("Caricamento previsioni…")
                    .font(.duetUI(12))
                    .foregroundColor(Duet.ink.opacity(0.5))
            }
            .padding(28)
            .background(RoundedRectangle(cornerRadius: 18).fill(Duet.surface))
            .shadow(color: .black.opacity(0.12), radius: 24, x: 0, y: 12)
        }
        .transition(.opacity)
    }
}

#Preview {
    SearchView()
        .environmentObject(AppState.shared)
}
