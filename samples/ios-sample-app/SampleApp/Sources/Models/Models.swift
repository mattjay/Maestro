import Foundation

/// User model representing an authenticated user.
struct User: Identifiable, Codable {
    let id: String
    let email: String
    let name: String
}

/// Product model for the e-commerce demo.
struct Product: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let description: String
    let price: Decimal
    let imageUrl: String

    var formattedPrice: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        return formatter.string(from: price as NSDecimalNumber) ?? "$\(price)"
    }

    static let sampleProducts: [Product] = [
        Product(
            id: "prod_001",
            name: "Premium Widget",
            description: "A high-quality widget for all your needs",
            price: 29.99,
            imageUrl: "widget_premium"
        ),
        Product(
            id: "prod_002",
            name: "Basic Gadget",
            description: "An everyday gadget that just works",
            price: 14.99,
            imageUrl: "gadget_basic"
        ),
        Product(
            id: "prod_003",
            name: "Deluxe Gizmo",
            description: "The ultimate gizmo experience",
            price: 49.99,
            imageUrl: "gizmo_deluxe"
        ),
        Product(
            id: "prod_004",
            name: "Smart Device",
            description: "Connected and intelligent",
            price: 99.99,
            imageUrl: "device_smart"
        ),
        Product(
            id: "prod_005",
            name: "Compact Tool",
            description: "Small but mighty",
            price: 19.99,
            imageUrl: "tool_compact"
        )
    ]
}

/// Cart item representing a product with quantity.
struct CartItem: Identifiable {
    let id = UUID()
    let product: Product
    var quantity: Int

    var totalPrice: Decimal {
        product.price * Decimal(quantity)
    }
}

/// Shipping address for checkout.
struct ShippingAddress {
    var name: String = ""
    var address: String = ""
    var city: String = ""
    var zipCode: String = ""

    var isValid: Bool {
        !name.isEmpty && !address.isEmpty && !city.isEmpty && zipCode.count >= 5
    }
}

/// Payment information for checkout.
struct PaymentInfo {
    var cardNumber: String = ""
    var expiry: String = ""
    var cvc: String = ""

    var isValid: Bool {
        cardNumber.count >= 16 && expiry.count >= 5 && cvc.count >= 3
    }
}

/// Order model representing a completed purchase.
struct Order: Identifiable {
    let id: String
    let items: [CartItem]
    let shippingAddress: ShippingAddress
    let total: Decimal
    let createdAt: Date

    var formattedOrderNumber: String {
        "Order #\(id.prefix(8).uppercased())"
    }
}
