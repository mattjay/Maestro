import SwiftUI

/// Profile settings view with user info and preferences.
struct ProfileView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationView {
            List {
                // User info section
                Section {
                    HStack(spacing: 16) {
                        Circle()
                            .fill(Color.blue.gradient)
                            .frame(width: 60, height: 60)
                            .overlay(
                                Text(appState.currentUser?.name.prefix(1).uppercased() ?? "?")
                                    .font(.title)
                                    .fontWeight(.bold)
                                    .foregroundColor(.white)
                            )

                        VStack(alignment: .leading, spacing: 4) {
                            Text(appState.currentUser?.name ?? "Guest")
                                .font(.headline)
                            Text(appState.currentUser?.email ?? "")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 8)
                }

                // Account settings
                Section("Account") {
                    NavigationLink(destination: Text("Edit Profile")) {
                        Label("Edit Profile", systemImage: "person.fill")
                    }
                    .accessibilityIdentifier("editProfileRow")

                    NavigationLink(destination: Text("Change Password")) {
                        Label("Change Password", systemImage: "lock.fill")
                    }

                    NavigationLink(destination: Text("Notification Preferences")) {
                        Label("Notifications", systemImage: "bell.fill")
                    }
                }

                // Order history
                Section("Orders") {
                    NavigationLink(destination: Text("Order History")) {
                        Label("Order History", systemImage: "bag.fill")
                    }

                    NavigationLink(destination: Text("Saved Addresses")) {
                        Label("Saved Addresses", systemImage: "location.fill")
                    }

                    NavigationLink(destination: Text("Payment Methods")) {
                        Label("Payment Methods", systemImage: "creditcard.fill")
                    }
                }

                // Support
                Section("Support") {
                    NavigationLink(destination: Text("Help Center")) {
                        Label("Help Center", systemImage: "questionmark.circle.fill")
                    }

                    NavigationLink(destination: Text("Contact Us")) {
                        Label("Contact Us", systemImage: "envelope.fill")
                    }
                }

                // Logout
                Section {
                    Button(action: {
                        appState.logout()
                    }) {
                        Label("Log Out", systemImage: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(.red)
                    }
                    .accessibilityIdentifier("logoutButton")
                }
            }
            .navigationTitle("Profile Settings")
            .accessibilityIdentifier("profileSettingsTitle")
        }
    }
}

#Preview {
    ProfileView()
        .environmentObject({
            let state = AppState()
            state.currentUser = User(id: "1", email: "test@example.com", name: "testuser")
            state.isLoggedIn = true
            return state
        }())
}
