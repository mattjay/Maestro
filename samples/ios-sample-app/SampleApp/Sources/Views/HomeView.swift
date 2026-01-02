import SwiftUI

/// Home/Dashboard view with welcome message and recent activity.
struct HomeView: View {
    @EnvironmentObject var appState: AppState
    @State private var isRefreshing = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Welcome banner
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Dashboard")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .accessibilityIdentifier("dashboardTitle")

                        if let user = appState.currentUser {
                            Text("Welcome back, \(user.name)")
                                .foregroundColor(.secondary)
                                .accessibilityIdentifier("welcomeMessage")
                        }
                    }
                    .padding(.horizontal)

                    // Quick stats cards
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 16) {
                        StatCard(
                            title: "Orders",
                            value: "5",
                            icon: "bag.fill",
                            color: .blue
                        )
                        StatCard(
                            title: "Wishlist",
                            value: "12",
                            icon: "heart.fill",
                            color: .pink
                        )
                        StatCard(
                            title: "Reviews",
                            value: "8",
                            icon: "star.fill",
                            color: .orange
                        )
                        StatCard(
                            title: "Points",
                            value: "250",
                            icon: "gift.fill",
                            color: .green
                        )
                    }
                    .padding(.horizontal)

                    // Recent activity section
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Recent Activity")
                            .font(.headline)
                            .padding(.horizontal)

                        VStack(spacing: 0) {
                            ActivityRow(
                                title: "Order #12345 Shipped",
                                subtitle: "Premium Widget is on its way",
                                time: "2 hours ago",
                                icon: "shippingbox.fill"
                            )
                            Divider()
                            ActivityRow(
                                title: "New Promotion",
                                subtitle: "20% off on selected items",
                                time: "1 day ago",
                                icon: "tag.fill"
                            )
                            Divider()
                            ActivityRow(
                                title: "Review Posted",
                                subtitle: "Thanks for your feedback",
                                time: "3 days ago",
                                icon: "star.fill"
                            )
                        }
                        .background(Color(.systemBackground))
                        .cornerRadius(12)
                        .padding(.horizontal)
                    }

                    Spacer(minLength: 100)
                }
                .padding(.top)
            }
            .refreshable {
                await refresh()
            }
            .navigationBarHidden(true)
        }
    }

    private func refresh() async {
        isRefreshing = true
        try? await Task.sleep(nanoseconds: 1_500_000_000)
        isRefreshing = false
    }
}

/// Stat card component for the dashboard grid.
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Spacer()
                Text(value)
                    .font(.title2)
                    .fontWeight(.bold)
            }
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

/// Activity row component for the recent activity list.
struct ActivityRow: View {
    let title: String
    let subtitle: String
    let time: String
    let icon: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
                .frame(width: 40)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text(time)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}

#Preview {
    HomeView()
        .environmentObject(AppState())
}
