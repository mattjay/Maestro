import SwiftUI

/// SampleApp - A demonstration iOS app for Maestro integration testing.
///
/// This app showcases common UI patterns that can be automated with Maestro:
/// - Login/authentication flows
/// - Tab-based navigation
/// - Form inputs and validation
/// - E-commerce checkout flows
/// - Pull-to-refresh and scrolling
@main
struct SampleAppApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}

/// Global app state for managing authentication and user data.
class AppState: ObservableObject {
    @Published var isLoggedIn = false
    @Published var currentUser: User?
    @Published var cart: [CartItem] = []

    var cartItemCount: Int {
        cart.reduce(0) { $0 + $1.quantity }
    }

    func login(email: String, password: String) async -> Bool {
        // Simulate network delay
        try? await Task.sleep(nanoseconds: 1_000_000_000)

        // Accept any non-empty credentials for demo
        if !email.isEmpty && !password.isEmpty {
            currentUser = User(
                id: "user_123",
                email: email,
                name: "testuser"
            )
            isLoggedIn = true
            return true
        }
        return false
    }

    func logout() {
        isLoggedIn = false
        currentUser = nil
        cart = []
    }

    func addToCart(_ product: Product) {
        if let index = cart.firstIndex(where: { $0.product.id == product.id }) {
            cart[index].quantity += 1
        } else {
            cart.append(CartItem(product: product, quantity: 1))
        }
    }

    func removeFromCart(_ product: Product) {
        cart.removeAll { $0.product.id == product.id }
    }

    func clearCart() {
        cart = []
    }
}
