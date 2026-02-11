import SwiftUI
import Combine

struct LoginView: View {
    @StateObject private var viewModel = LoginViewModel()
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ZStack {
            // Premium Background
            LinearGradient(gradient: Gradient(colors: [Color(hex: "1a2a44"), Color(hex: "0B1120")]), startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()
            
            VStack(spacing: 30) {
                // Header
                VStack(spacing: 8) {
                    Image(systemName: "cloud.sun.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(LinearGradient(colors: [.yellow, .orange], startPoint: .top, endPoint: .bottom))
                        .padding(.bottom, 10)
                    
                    Text("Welcome Back")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    
                    Text("Sign in to continue")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.6))
                }
                .padding(.top, 40)
                
                // Form
                VStack(spacing: 20) {
                    CustomTextField(icon: "envelope.fill", placeholder: "Email", text: $viewModel.email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    
                    CustomSecureField(icon: "lock.fill", placeholder: "Password", text: $viewModel.password)
                    
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.caption)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                    }
                }
                .padding(.horizontal)
                
                Spacer()
                
                // Action Buttons
                VStack(spacing: 16) {
                    Button(action: {
                        viewModel.signIn {
                            dismiss()
                        }
                    }) {
                        HStack {
                            if viewModel.isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            }
                            Text(viewModel.isLoading ? "Signing In..." : "Sign In")
                                .font(.headline)
                                .fontWeight(.bold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            LinearGradient(gradient: Gradient(colors: [Color.blue, Color.blue.opacity(0.8)]), startPoint: .leading, endPoint: .trailing)
                        )
                        .foregroundColor(.white)
                        .cornerRadius(16)
                        .shadow(color: .blue.opacity(0.3), radius: 10, x: 0, y: 5)
                    }
                    .disabled(viewModel.isLoading)
                    .opacity(viewModel.isLoading ? 0.7 : 1)
                    
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white.opacity(0.6))
                    .font(.subheadline)
                }
                .padding(.horizontal)
                .padding(.bottom, 20)
            }
            .padding()
        }
    }
}

// Custom Components for Premium Feel
struct CustomTextField: View {
    var icon: String
    var placeholder: String
    @Binding var text: String
    
    var body: some View {
        HStack(spacing: 15) {
            Image(systemName: icon)
                .foregroundColor(.white.opacity(0.5))
                .frame(width: 20)
            
            TextField("", text: $text)
                .placeholder(when: text.isEmpty) {
                    Text(placeholder).foregroundColor(.white.opacity(0.3))
                }
                .foregroundColor(.white)
        }
        .padding()
        .background(Color.white.opacity(0.05))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
    }
}

struct CustomSecureField: View {
    var icon: String
    var placeholder: String
    @Binding var text: String
    
    var body: some View {
        HStack(spacing: 15) {
            Image(systemName: icon)
                .foregroundColor(.white.opacity(0.5))
                .frame(width: 20)
            
            SecureField("", text: $text)
                .placeholder(when: text.isEmpty) {
                    Text(placeholder).foregroundColor(.white.opacity(0.3))
                }
                .foregroundColor(.white)
        }
        .padding()
        .background(Color.white.opacity(0.05))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
    }
}

extension View {
    func placeholder<Content: View>(
        when shouldShow: Bool,
        alignment: Alignment = .leading,
        @ViewBuilder placeholder: () -> Content) -> some View {

        ZStack(alignment: alignment) {
            placeholder().opacity(shouldShow ? 1 : 0)
            self
        }
    }
}

class LoginViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    func signIn(onSuccess: @escaping () -> Void) {
        guard !email.isEmpty, !password.isEmpty else { return }
        
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                try await AuthService.shared.signIn(email: email, password: password)
                await MainActor.run {
                    isLoading = false
                    onSuccess()
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}

#Preview {
    LoginView()
}
