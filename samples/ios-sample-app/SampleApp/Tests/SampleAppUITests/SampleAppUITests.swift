import XCTest

/// XCUITest target for SampleApp.
///
/// This test class enables Maestro's /ios.inspect command to access
/// the accessibility tree and element coordinates through XCUITest.
///
/// While these tests can be run directly, their primary purpose is
/// to provide the XCUITest infrastructure for Maestro iOS integration.
final class SampleAppUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Login Flow Tests

    func testLoginScreenAppears() throws {
        // Verify login screen elements are visible
        XCTAssertTrue(app.staticTexts["Welcome to SampleApp"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.textFields["usernameField"].exists)
        XCTAssertTrue(app.secureTextFields["passwordField"].exists)
        XCTAssertTrue(app.buttons["loginButton"].exists)
    }

    func testSuccessfulLogin() throws {
        // Enter credentials
        let usernameField = app.textFields["usernameField"]
        usernameField.tap()
        usernameField.typeText("test@example.com")

        let passwordField = app.secureTextFields["passwordField"]
        passwordField.tap()
        passwordField.typeText("password123")

        // Tap login
        app.buttons["loginButton"].tap()

        // Verify dashboard appears
        XCTAssertTrue(app.staticTexts["Dashboard"].waitForExistence(timeout: 5))
    }

    // MARK: - Navigation Tests

    func testTabBarNavigation() throws {
        // Login first
        loginIfNeeded()

        // Navigate to each tab
        app.buttons["tabBar_profile"].tap()
        XCTAssertTrue(app.navigationBars["Profile Settings"].waitForExistence(timeout: 3))

        app.buttons["tabBar_settings"].tap()
        XCTAssertTrue(app.navigationBars["App Settings"].waitForExistence(timeout: 3))

        app.buttons["tabBar_shop"].tap()
        XCTAssertTrue(app.staticTexts["Featured Products"].waitForExistence(timeout: 3))

        app.buttons["tabBar_home"].tap()
        XCTAssertTrue(app.staticTexts["Dashboard"].waitForExistence(timeout: 3))
    }

    // MARK: - Shop Tests

    func testAddProductToCart() throws {
        loginIfNeeded()

        // Navigate to shop
        app.buttons["tabBar_shop"].tap()
        XCTAssertTrue(app.staticTexts["Featured Products"].waitForExistence(timeout: 3))

        // Tap on first product
        app.staticTexts["Premium Widget"].tap()
        XCTAssertTrue(app.staticTexts["Product Details"].waitForExistence(timeout: 3))

        // Add to cart
        app.buttons["addToCartButton"].tap()

        // Verify cart badge appears
        XCTAssertTrue(app.staticTexts["cartBadge"].waitForExistence(timeout: 3))
    }

    // MARK: - Checkout Tests

    func testCheckoutFlow() throws {
        loginIfNeeded()
        addProductToCart()

        // Go to cart
        app.buttons["cartButton"].tap()
        XCTAssertTrue(app.staticTexts["Your Cart"].waitForExistence(timeout: 3))

        // Proceed to checkout
        app.buttons["checkoutButton"].tap()
        XCTAssertTrue(app.staticTexts["Shipping Information"].waitForExistence(timeout: 3))

        // Fill shipping info
        fillShippingForm()

        // Continue to payment
        app.buttons["continueToPaymentButton"].tap()
        XCTAssertTrue(app.staticTexts["Payment Information"].waitForExistence(timeout: 3))

        // Fill payment info
        fillPaymentForm()

        // Review order
        app.buttons["reviewOrderButton"].tap()
        XCTAssertTrue(app.staticTexts["Order Summary"].waitForExistence(timeout: 3))

        // Place order
        app.buttons["placeOrderButton"].tap()
        XCTAssertTrue(app.staticTexts["Order Confirmed"].waitForExistence(timeout: 10))
    }

    // MARK: - Maestro Integration Support

    /// This test is specifically for Maestro's /ios.inspect command.
    /// It provides a stable entry point for element inspection.
    func testMaestroInspection() throws {
        // Keep app running for Maestro inspection
        // This test intentionally does nothing and passes
        XCTAssertTrue(true)
    }

    /// Provides element tree snapshot for debugging.
    func testElementTreeSnapshot() throws {
        loginIfNeeded()

        // Print element tree (useful for debugging)
        print("--- ELEMENT TREE SNAPSHOT ---")
        print(app.debugDescription)
        print("--- END SNAPSHOT ---")

        XCTAssertTrue(true)
    }

    // MARK: - Helper Methods

    private func loginIfNeeded() {
        if app.staticTexts["Welcome to SampleApp"].exists {
            let usernameField = app.textFields["usernameField"]
            usernameField.tap()
            usernameField.typeText("test@example.com")

            let passwordField = app.secureTextFields["passwordField"]
            passwordField.tap()
            passwordField.typeText("password")

            app.buttons["loginButton"].tap()
            _ = app.staticTexts["Dashboard"].waitForExistence(timeout: 5)
        }
    }

    private func addProductToCart() {
        app.buttons["tabBar_shop"].tap()
        _ = app.staticTexts["Featured Products"].waitForExistence(timeout: 3)

        app.staticTexts["Premium Widget"].tap()
        _ = app.buttons["addToCartButton"].waitForExistence(timeout: 3)

        app.buttons["addToCartButton"].tap()
        app.buttons["Continue Shopping"].tap()
    }

    private func fillShippingForm() {
        let nameField = app.textFields["shippingName"]
        nameField.tap()
        nameField.typeText("John Doe")

        let addressField = app.textFields["shippingAddress"]
        addressField.tap()
        addressField.typeText("123 Test Street")

        let cityField = app.textFields["shippingCity"]
        cityField.tap()
        cityField.typeText("San Francisco")

        let zipField = app.textFields["shippingZip"]
        zipField.tap()
        zipField.typeText("94105")
    }

    private func fillPaymentForm() {
        let cardField = app.textFields["cardNumber"]
        cardField.tap()
        cardField.typeText("4242424242424242")

        let expiryField = app.textFields["cardExpiry"]
        expiryField.tap()
        expiryField.typeText("12/28")

        let cvcField = app.textFields["cardCvc"]
        cvcField.tap()
        cvcField.typeText("123")
    }
}
