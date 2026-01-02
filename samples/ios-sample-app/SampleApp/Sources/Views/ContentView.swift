import SwiftUI

/// Main content view that switches between login and main app views.
struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        if appState.isLoggedIn {
            MainTabView()
        } else {
            LoginView()
        }
    }
}

/// Login view with email and password fields.
struct LoginView: View {
    @EnvironmentObject var appState: AppState
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var showError = false

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                // Welcome message
                Text("Welcome to SampleApp")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .accessibilityIdentifier("welcomeTitle")

                Text("Sign in to continue")
                    .foregroundColor(.secondary)

                VStack(spacing: 16) {
                    // Email field
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                        .accessibilityIdentifier("usernameField")

                    // Password field
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.password)
                        .accessibilityIdentifier("passwordField")
                }
                .padding(.horizontal)

                // Login button
                Button(action: {
                    login()
                }) {
                    if isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text("Log In")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(10)
                .padding(.horizontal)
                .disabled(isLoading)
                .accessibilityIdentifier("loginButton")

                Spacer()
            }
            .padding(.top, 60)
            .alert("Login Failed", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Please check your email and password.")
            }
        }
    }

    private func login() {
        isLoading = true
        Task {
            let success = await appState.login(email: email, password: password)
            await MainActor.run {
                isLoading = false
                if !success {
                    showError = true
                }
            }
        }
    }
}

/// Main tab view with Home, Shop, Profile, and Settings tabs.
struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)
                .accessibilityIdentifier("tabBar_home")

            ShopView()
                .tabItem {
                    Label("Shop", systemImage: "bag.fill")
                }
                .tag(1)
                .accessibilityIdentifier("tabBar_shop")

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
                .tag(2)
                .accessibilityIdentifier("tabBar_profile")

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(3)
                .accessibilityIdentifier("tabBar_settings")
        }
        .overlay(alignment: .topTrailing) {
            // Cart button
            NavigationLink(destination: CartView()) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "cart.fill")
                        .font(.title2)
                        .padding()

                    if appState.cartItemCount > 0 {
                        Text("\(appState.cartItemCount)")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .padding(5)
                            .background(Color.red)
                            .clipShape(Circle())
                            .accessibilityIdentifier("cartBadge")
                    }
                }
            }
            .accessibilityIdentifier("cartButton")
            .padding(.trailing)
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
}
