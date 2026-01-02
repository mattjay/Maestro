import SwiftUI

/// Cart view displaying items and checkout button.
struct CartView: View {
    @EnvironmentObject var appState: AppState
    @State private var showCheckout = false

    var totalPrice: Decimal {
        appState.cart.reduce(0) { $0 + $1.totalPrice }
    }

    var formattedTotal: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        return formatter.string(from: totalPrice as NSDecimalNumber) ?? "$\(totalPrice)"
    }

    var body: some View {
        VStack(spacing: 0) {
            if appState.cart.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "cart")
                        .font(.system(size: 60))
                        .foregroundColor(.secondary)
                    Text("Your cart is empty")
                        .font(.title2)
                        .foregroundColor(.secondary)
                    Text("Add some items to get started!")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(appState.cart) { item in
                            CartItemRow(item: item)
                        }
                    }
                    .padding()
                }

                // Bottom checkout section
                VStack(spacing: 16) {
                    Divider()

                    HStack {
                        Text("Total")
                            .font(.headline)
                        Spacer()
                        Text(formattedTotal)
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.blue)
                    }
                    .padding(.horizontal)

                    NavigationLink(destination: CheckoutView()) {
                        Text("Checkout")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                    .padding(.horizontal)
                    .accessibilityIdentifier("checkoutButton")
                }
                .padding(.bottom)
                .background(Color(.systemBackground))
            }
        }
        .navigationTitle("Your Cart")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Individual cart item row.
struct CartItemRow: View {
    @EnvironmentObject var appState: AppState
    let item: CartItem

    var body: some View {
        HStack(spacing: 12) {
            // Product image placeholder
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.tertiarySystemBackground))
                .frame(width: 60, height: 60)
                .overlay(
                    Image(systemName: "cube.box.fill")
                        .foregroundColor(.secondary)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(item.product.name)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(item.product.formattedPrice)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Quantity
            Text("x\(item.quantity)")
                .font(.subheadline)
                .foregroundColor(.secondary)

            // Remove button
            Button(action: {
                appState.removeFromCart(item.product)
            }) {
                Image(systemName: "trash")
                    .foregroundColor(.red)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

#Preview {
    NavigationView {
        CartView()
            .environmentObject({
                let state = AppState()
                state.addToCart(Product.sampleProducts[0])
                state.addToCart(Product.sampleProducts[1])
                return state
            }())
    }
}
