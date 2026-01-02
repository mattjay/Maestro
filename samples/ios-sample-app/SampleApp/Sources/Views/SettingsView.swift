import SwiftUI

/// App settings view with preferences and about info.
struct SettingsView: View {
    @State private var notificationsEnabled = true
    @State private var darkModeEnabled = false
    @State private var biometricEnabled = false

    var body: some View {
        NavigationView {
            List {
                // Appearance
                Section("Appearance") {
                    Toggle(isOn: $darkModeEnabled) {
                        Label("Dark Mode", systemImage: "moon.fill")
                    }
                    .accessibilityIdentifier("darkModeToggle")

                    NavigationLink(destination: Text("Theme Settings")) {
                        Label("Theme", systemImage: "paintpalette.fill")
                    }

                    NavigationLink(destination: Text("App Icon")) {
                        Label("App Icon", systemImage: "app.fill")
                    }
                }

                // Privacy & Security
                Section("Privacy & Security") {
                    Toggle(isOn: $biometricEnabled) {
                        Label("Face ID / Touch ID", systemImage: "faceid")
                    }
                    .accessibilityIdentifier("biometricToggle")

                    NavigationLink(destination: Text("Privacy Settings")) {
                        Label("Privacy", systemImage: "hand.raised.fill")
                    }

                    NavigationLink(destination: Text("Data & Storage")) {
                        Label("Data & Storage", systemImage: "internaldrive.fill")
                    }
                }

                // Notifications
                Section("Notifications") {
                    Toggle(isOn: $notificationsEnabled) {
                        Label("Push Notifications", systemImage: "bell.badge.fill")
                    }
                    .accessibilityIdentifier("notificationsToggle")

                    NavigationLink(destination: Text("Email Preferences")) {
                        Label("Email Preferences", systemImage: "envelope.fill")
                    }
                }

                // About
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0 (42)")
                            .foregroundColor(.secondary)
                    }

                    NavigationLink(destination: Text("Terms of Service")) {
                        Text("Terms of Service")
                    }

                    NavigationLink(destination: Text("Privacy Policy")) {
                        Text("Privacy Policy")
                    }

                    NavigationLink(destination: Text("Open Source Licenses")) {
                        Text("Licenses")
                    }
                }

                // Debug (only in debug builds)
                #if DEBUG
                Section("Developer") {
                    NavigationLink(destination: Text("Debug Menu")) {
                        Label("Debug Menu", systemImage: "ant.fill")
                    }
                    .accessibilityIdentifier("debugMenuRow")

                    Button(action: {
                        // Reset app data
                    }) {
                        Label("Reset App Data", systemImage: "trash.fill")
                            .foregroundColor(.red)
                    }
                }
                #endif
            }
            .navigationTitle("App Settings")
            .accessibilityIdentifier("appSettingsTitle")
        }
    }
}

#Preview {
    SettingsView()
}
