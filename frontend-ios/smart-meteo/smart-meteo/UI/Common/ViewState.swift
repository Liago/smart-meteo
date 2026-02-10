import Foundation

enum ViewState<T> {
    case idle
    case loading
    case success(T)
    case error(Error)
}

extension ViewState: Equatable where T: Equatable {
    static func == (lhs: ViewState<T>, rhs: ViewState<T>) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle): return true
        case (.loading, .loading): return true
        case (.success(let l), .success(let r)): return l == r
        case (.error, .error): return false // Error is tricky to compare, assume false for rebuild
        default: return false
        }
    }
}
