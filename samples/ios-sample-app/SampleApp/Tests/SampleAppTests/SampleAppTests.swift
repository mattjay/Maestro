import XCTest
@testable import SampleApp

/// Unit tests for SampleApp models and business logic.
final class SampleAppTests: XCTestCase {

    // MARK: - User Model Tests

    func testUserCreation() {
        let user = User(id: "123", email: "test@example.com", name: "testuser")

        XCTAssertEqual(user.id, "123")
        XCTAssertEqual(user.email, "test@example.com")
        XCTAssertEqual(user.name, "testuser")
    }

    // MARK: - Product Model Tests

    func testProductFormattedPrice() {
        let product = Product(
            id: "prod_001",
            name: "Test Product",
            description: "A test product",
            price: 29.99,
            imageUrl: "test"
        )

        XCTAssertTrue(product.formattedPrice.contains("29.99"))
    }

    func testSampleProductsExist() {
        XCTAssertFalse(Product.sampleProducts.isEmpty)
        XCTAssertEqual(Product.sampleProducts.count, 5)
    }

    // MARK: - CartItem Tests

    func testCartItemTotalPrice() {
        let product = Product(
            id: "prod_001",
            name: "Test Product",
            description: "A test product",
            price: 10.00,
            imageUrl: "test"
        )

        let cartItem = CartItem(product: product, quantity: 3)

        XCTAssertEqual(cartItem.totalPrice, 30.00)
    }

    // MARK: - ShippingAddress Tests

    func testShippingAddressValidation() {
        var address = ShippingAddress()

        // Empty address should be invalid
        XCTAssertFalse(address.isValid)

        // Partial address should be invalid
        address.name = "John Doe"
        XCTAssertFalse(address.isValid)

        address.address = "123 Test St"
        XCTAssertFalse(address.isValid)

        address.city = "San Francisco"
        XCTAssertFalse(address.isValid)

        // Complete address should be valid
        address.zipCode = "94105"
        XCTAssertTrue(address.isValid)
    }

    // MARK: - PaymentInfo Tests

    func testPaymentInfoValidation() {
        var payment = PaymentInfo()

        // Empty payment should be invalid
        XCTAssertFalse(payment.isValid)

        // Partial payment should be invalid
        payment.cardNumber = "4242424242424242"
        XCTAssertFalse(payment.isValid)

        payment.expiry = "12/28"
        XCTAssertFalse(payment.isValid)

        // Complete payment should be valid
        payment.cvc = "123"
        XCTAssertTrue(payment.isValid)
    }

    // MARK: - Order Tests

    func testOrderFormattedNumber() {
        let order = Order(
            id: "abc12345-6789-0000-0000-000000000000",
            items: [],
            shippingAddress: ShippingAddress(),
            total: 0,
            createdAt: Date()
        )

        XCTAssertEqual(order.formattedOrderNumber, "Order #ABC12345")
    }

    // MARK: - AppState Tests

    func testAppStateInitialState() {
        let state = AppState()

        XCTAssertFalse(state.isLoggedIn)
        XCTAssertNil(state.currentUser)
        XCTAssertTrue(state.cart.isEmpty)
        XCTAssertEqual(state.cartItemCount, 0)
    }

    func testAppStateAddToCart() {
        let state = AppState()
        let product = Product.sampleProducts[0]

        state.addToCart(product)

        XCTAssertEqual(state.cart.count, 1)
        XCTAssertEqual(state.cartItemCount, 1)

        // Adding same product should increase quantity
        state.addToCart(product)

        XCTAssertEqual(state.cart.count, 1)
        XCTAssertEqual(state.cartItemCount, 2)
    }

    func testAppStateRemoveFromCart() {
        let state = AppState()
        let product = Product.sampleProducts[0]

        state.addToCart(product)
        XCTAssertEqual(state.cart.count, 1)

        state.removeFromCart(product)
        XCTAssertTrue(state.cart.isEmpty)
    }

    func testAppStateClearCart() {
        let state = AppState()

        state.addToCart(Product.sampleProducts[0])
        state.addToCart(Product.sampleProducts[1])

        XCTAssertEqual(state.cart.count, 2)

        state.clearCart()
        XCTAssertTrue(state.cart.isEmpty)
    }

    func testAppStateLogout() {
        let state = AppState()

        // Set up logged in state
        state.isLoggedIn = true
        state.currentUser = User(id: "1", email: "test@example.com", name: "test")
        state.addToCart(Product.sampleProducts[0])

        state.logout()

        XCTAssertFalse(state.isLoggedIn)
        XCTAssertNil(state.currentUser)
        XCTAssertTrue(state.cart.isEmpty)
    }
}
