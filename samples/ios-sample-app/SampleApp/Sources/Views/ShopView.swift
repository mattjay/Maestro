import SwiftUI

/// Shop view displaying featured products.
struct ShopView: View {
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""

    var filteredProducts: [Product] {
        if searchText.isEmpty {
            return Product.sampleProducts
        }
        return Product.sampleProducts.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.description.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Search bar
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        TextField("Search products", text: $searchText)
                            .accessibilityIdentifier("searchField")
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(10)
                    .padding(.horizontal)

                    // Featured Products header
                    Text("Featured Products")
                        .font(.title2)
                        .fontWeight(.bold)
                        .padding(.horizontal)
                        .accessibilityIdentifier("featuredProductsTitle")

                    // Products list
                    LazyVStack(spacing: 16) {
                        ForEach(filteredProducts) { product in
                            NavigationLink(destination: ProductDetailView(product: product)) {
                                ProductCard(product: product)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.top)
            }
            .navigationTitle("Shop")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

/// Product card for the shop list.
struct ProductCard: View {
    let product: Product

    var body: some View {
        HStack(spacing: 16) {
            // Product image placeholder
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.tertiarySystemBackground))
                .frame(width: 80, height: 80)
                .overlay(
                    Image(systemName: "cube.box.fill")
                        .font(.title)
                        .foregroundColor(.secondary)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(product.name)
                    .font(.headline)
                    .foregroundColor(.primary)

                Text(product.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                Text(product.formattedPrice)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.blue)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

/// Product detail view showing full product info with add to cart.
struct ProductDetailView: View {
    @EnvironmentObject var appState: AppState
    let product: Product
    @State private var showAddedToCart = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Product image placeholder
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.tertiarySystemBackground))
                    .frame(height: 300)
                    .overlay(
                        Image(systemName: "cube.box.fill")
                            .font(.system(size: 80))
                            .foregroundColor(.secondary)
                    )
                    .padding(.horizontal)

                VStack(alignment: .leading, spacing: 12) {
                    // Title and price
                    Text(product.name)
                        .font(.title)
                        .fontWeight(.bold)
                        .accessibilityIdentifier("productTitle")

                    Text(product.formattedPrice)
                        .font(.title2)
                        .foregroundColor(.blue)
                        .accessibilityIdentifier("productPrice")

                    Divider()

                    // Description
                    Text("Product Details")
                        .font(.headline)
                        .accessibilityIdentifier("productDetailsTitle")

                    Text(product.description)
                        .foregroundColor(.secondary)

                    Spacer(minLength: 40)

                    // Add to cart button
                    Button(action: {
                        appState.addToCart(product)
                        showAddedToCart = true
                    }) {
                        Text("Add to Cart")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                    .accessibilityIdentifier("addToCartButton")
                }
                .padding(.horizontal)
            }
        }
        .navigationTitle("Product Details")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Added to Cart", isPresented: $showAddedToCart) {
            Button("Continue Shopping", role: .cancel) {}
            NavigationLink("View Cart") {
                CartView()
            }
        } message: {
            Text("\(product.name) has been added to your cart.")
        }
    }
}

#Preview {
    ShopView()
        .environmentObject(AppState())
}
