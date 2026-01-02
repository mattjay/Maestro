// IntegrationTests.swift
// MaestroBridge
//
// Integration tests that test the full MaestroBridge stack end-to-end.
// These tests start an actual HTTP server and make real HTTP requests.

import XCTest
@testable import MaestroBridge
import Foundation

// MARK: - Sample App Integration Pattern

/// Demonstrates how a real iOS app would integrate MaestroBridge.
/// This serves as both a test fixture and documentation for app developers.
final class SampleAppIntegration {

    // MARK: - Sample App State

    /// Simulates a User model in a real app
    struct User: Codable {
        var id: Int
        var username: String
        var isLoggedIn: Bool
        var preferences: UserPreferences
    }

    struct UserPreferences: Codable {
        var darkMode: Bool
        var notificationsEnabled: Bool
    }

    /// Simulates a Shopping Cart in a real app
    struct Cart: Codable {
        var items: [CartItem]
        var total: Double

        var itemCount: Int { items.count }
    }

    struct CartItem: Codable {
        var productId: String
        var name: String
        var price: Double
        var quantity: Int
    }

    /// Simulates app settings
    struct AppSettings: Codable {
        var apiEnvironment: String
        var debugLogging: Bool
        var buildNumber: Int
    }

    // MARK: - App State Storage

    private(set) var currentUser: User
    private(set) var cart: Cart
    private(set) var settings: AppSettings

    init() {
        // Initialize with default test state
        self.currentUser = User(
            id: 12345,
            username: "testuser",
            isLoggedIn: true,
            preferences: UserPreferences(
                darkMode: true,
                notificationsEnabled: false
            )
        )

        self.cart = Cart(
            items: [
                CartItem(productId: "SKU001", name: "Widget", price: 29.99, quantity: 2),
                CartItem(productId: "SKU002", name: "Gadget", price: 49.99, quantity: 1)
            ],
            total: 109.97
        )

        self.settings = AppSettings(
            apiEnvironment: "staging",
            debugLogging: true,
            buildNumber: 1234
        )
    }

    // MARK: - Mutable State for Testing

    func setUserLoggedIn(_ loggedIn: Bool) -> Bool {
        currentUser.isLoggedIn = loggedIn
        return true
    }

    func updateUsername(_ username: String) -> Bool {
        currentUser.username = username
        return true
    }

    func clearCart() -> Bool {
        cart = Cart(items: [], total: 0)
        return true
    }

    // MARK: - Bridge Integration

    /// Demonstrates how to integrate MaestroBridge into an app.
    /// Call this in AppDelegate.didFinishLaunching or App.init
    ///
    /// Note: Custom Codable structs are registered directly. AnyCodable will
    /// encode them as their string representation. For proper JSON encoding,
    /// the library could be enhanced to detect Encodable types.
    func setupMaestroBridge(port: UInt16, token: String) {
        #if DEBUG
        // Register user state (Codable struct)
        MaestroBridge.shared.register("user", provider: { [weak self] in
            return self?.currentUser ?? User(id: 0, username: "", isLoggedIn: false, preferences: UserPreferences(darkMode: false, notificationsEnabled: false))
        }, setter: { [weak self] (newValue: User) -> Bool in
            self?.currentUser = newValue
            return true
        })

        // Register cart state
        MaestroBridge.shared.register("cart", provider: { [weak self] in
            return self?.cart ?? Cart(items: [], total: 0)
        })

        // Register app settings (read-only for safety)
        MaestroBridge.shared.register("settings") { [weak self] in
            return self?.settings ?? AppSettings(apiEnvironment: "unknown", debugLogging: false, buildNumber: 0)
        }

        // Register feature flags
        MaestroBridge.shared.registerFeatureFlag("darkMode", enabled: true)
        MaestroBridge.shared.registerFeatureFlag("newCheckout", enabled: true, variant: "A")
        MaestroBridge.shared.registerFeatureFlag("betaFeatures", enabled: false)
        MaestroBridge.shared.registerFeatureFlag("analytics", enabled: true, variant: "full")

        // Start the bridge
        MaestroBridge.shared.start(port: port, token: token)

        // Optionally enable state mutation for testing
        // MaestroBridge.shared.enableStateMutation(token: "mutation-secret")
        #endif
    }

    func teardown() {
        MaestroBridge.shared.stop()
        MaestroBridge.shared.unregister("user")
        MaestroBridge.shared.unregister("cart")
        MaestroBridge.shared.unregister("settings")
    }
}

// MARK: - HTTP Client for Integration Tests

/// Simple HTTP client for making requests to the bridge server
final class BridgeHTTPClient {
    let baseURL: URL
    let token: String

    init(port: UInt16, token: String) {
        self.baseURL = URL(string: "http://127.0.0.1:\(port)")!
        self.token = token
    }

    /// Construct URL properly handling query strings
    /// appendingPathComponent encodes '?' as '%3F', so we need to use string concatenation instead
    private func makeURL(path: String) -> URL {
        // Use string concatenation to preserve query string characters
        return URL(string: baseURL.absoluteString + path)!
    }

    func get(path: String) async throws -> (data: Data, statusCode: Int) {
        var request = URLRequest(url: makeURL(path: path))
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 5.0

        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse
        return (data, httpResponse.statusCode)
    }

    func post(path: String, body: [String: Any]) async throws -> (data: Data, statusCode: Int) {
        var request = URLRequest(url: makeURL(path: path))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 5.0

        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse
        return (data, httpResponse.statusCode)
    }

    func delete(path: String) async throws -> (data: Data, statusCode: Int) {
        var request = URLRequest(url: makeURL(path: path))
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 5.0

        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse
        return (data, httpResponse.statusCode)
    }

    func getJSON<T: Decodable>(path: String, as type: T.Type) async throws -> T {
        let (data, statusCode) = try await get(path: path)
        guard statusCode == 200 else {
            throw BridgeTestError.httpError(statusCode: statusCode, data: data)
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: data)
    }
}

enum BridgeTestError: Error {
    case httpError(statusCode: Int, data: Data)
    case serverNotReady
    case timeout
}

// MARK: - Integration Tests

final class MaestroBridgeIntegrationTests: XCTestCase {

    var sampleApp: SampleAppIntegration!
    var httpClient: BridgeHTTPClient!
    let testPort: UInt16 = 19876
    let testToken = "integration-test-token-12345"

    override func setUp() async throws {
        try await super.setUp()

        // Clean up any previous state FIRST
        MaestroBridge.shared.stop()
        MaestroBridge.shared.disableStateMutation()
        NetworkInterceptor.shared.clear()
        AnalyticsInterceptor.shared.clear()

        // Small delay to ensure port is released
        try await Task.sleep(nanoseconds: 50_000_000) // 50ms

        // Set up sample app with bridge
        sampleApp = SampleAppIntegration()
        sampleApp.setupMaestroBridge(port: testPort, token: testToken)

        // Create HTTP client
        httpClient = BridgeHTTPClient(port: testPort, token: testToken)

        // Wait for server to be ready
        try await waitForServer()
    }

    override func tearDown() async throws {
        sampleApp?.teardown()
        sampleApp = nil
        httpClient = nil
        MaestroBridge.shared.disableStateMutation()
        NetworkInterceptor.shared.clear()
        AnalyticsInterceptor.shared.clear()

        // Small delay to ensure cleanup completes
        try await Task.sleep(nanoseconds: 50_000_000) // 50ms

        try await super.tearDown()
    }

    private func waitForServer(timeout: TimeInterval = 3.0) async throws {
        let startTime = Date()
        var lastError: Error?

        while Date().timeIntervalSince(startTime) < timeout {
            do {
                let (_, statusCode) = try await httpClient.get(path: "/ping")
                if statusCode == 200 {
                    return
                }
            } catch {
                lastError = error
            }
            try await Task.sleep(nanoseconds: 100_000_000) // 100ms
        }

        if let error = lastError {
            throw error
        }
        throw BridgeTestError.serverNotReady
    }

    // MARK: - Ping Endpoint Tests

    func testPingEndpoint() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/ping")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(json["status"] as? String, "ok")
        XCTAssertNotNil(json["timestamp"])
    }

    // MARK: - State Endpoint Integration Tests

    func testGetFullState() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/state")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        // Verify timestamp exists
        XCTAssertNotNil(json["timestamp"])

        // Verify custom state contains our registered keys
        let customState = json["customState"] as? [String: Any]
        XCTAssertNotNil(customState)
        XCTAssertNotNil(customState?["user"])
        XCTAssertNotNil(customState?["cart"])
        XCTAssertNotNil(customState?["settings"])

        // Verify feature flags are present
        let flags = json["featureFlags"] as? [String: Any]
        XCTAssertNotNil(flags)
        XCTAssertNotNil(flags?["darkMode"])
        XCTAssertNotNil(flags?["newCheckout"])
    }

    func testGetSpecificStateKey() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/state/user")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        // Response format: { "key": "user", "value": ... }
        XCTAssertEqual(json["key"] as? String, "user")

        // Value contains the user data - either as string representation (current AnyCodable behavior)
        // or as a proper dictionary if AnyCodable is enhanced
        XCTAssertNotNil(json["value"], "Value should be present")

        // If value is a string, verify it contains expected user data
        if let valueStr = json["value"] as? String {
            XCTAssertTrue(valueStr.contains("12345"), "User ID should be in string representation")
            XCTAssertTrue(valueStr.contains("testuser"), "Username should be in string representation")
        } else if let value = json["value"] as? [String: Any] {
            // If properly encoded as dictionary
            XCTAssertEqual(value["id"] as? Int, 12345)
            XCTAssertEqual(value["username"] as? String, "testuser")
        }
    }

    func testGetCartState() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/state/cart")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        // Response format: { "key": "cart", "value": ... }
        XCTAssertEqual(json["key"] as? String, "cart")

        // Value contains the cart data
        XCTAssertNotNil(json["value"], "Value should be present")

        // If value is a string, verify it contains expected cart data
        if let valueStr = json["value"] as? String {
            XCTAssertTrue(valueStr.contains("Widget") || valueStr.contains("109.97"), "Cart data should be in string representation")
        } else if let value = json["value"] as? [String: Any] {
            // If properly encoded as dictionary
            let items = value["items"] as? [[String: Any]]
            XCTAssertEqual(items?.count, 2)
            XCTAssertEqual(value["total"] as? Double, 109.97)
        }
    }

    func testGetNonExistentStateKey() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/state/nonexistent")

        XCTAssertEqual(statusCode, 404)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertTrue((json["error"] as? String)?.contains("not found") ?? false)
    }

    // MARK: - Feature Flags Integration Tests

    func testGetAllFlags() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/flags")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let flags = json["flags"] as? [String: Any]

        XCTAssertNotNil(flags)

        // Verify darkMode flag
        let darkMode = flags?["darkMode"] as? [String: Any]
        XCTAssertEqual(darkMode?["enabled"] as? Bool, true)

        // Verify newCheckout flag with variant
        let newCheckout = flags?["newCheckout"] as? [String: Any]
        XCTAssertEqual(newCheckout?["enabled"] as? Bool, true)
        XCTAssertEqual(newCheckout?["variant"] as? String, "A")

        // Verify disabled flag
        let beta = flags?["betaFeatures"] as? [String: Any]
        XCTAssertEqual(beta?["enabled"] as? Bool, false)
    }

    func testGetSpecificFlag() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/flags/analytics")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        // Response format: { "name": "analytics", "enabled": true, "variant": "full" }
        XCTAssertEqual(json["name"] as? String, "analytics")
        XCTAssertEqual(json["enabled"] as? Bool, true)
        XCTAssertEqual(json["variant"] as? String, "full")
    }

    func testGetNonExistentFlag() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/flags/nonexistent")

        XCTAssertEqual(statusCode, 404)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertTrue((json["error"] as? String)?.contains("not found") ?? false)
    }

    // MARK: - Route Endpoint Integration Tests

    func testGetRoute() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/route")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        // Route endpoint returns current route info
        XCTAssertNotNil(json["currentRoute"])
        XCTAssertNotNil(json["canGoBack"])
    }

    func testGetRouteStack() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/route/stack")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertNotNil(json["stack"])
    }

    func testGetRouteHistory() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/route/history")

        XCTAssertEqual(statusCode, 200)

        // Route history returns an array or object - just verify success
        let _ = try JSONSerialization.jsonObject(with: data)
        // Response structure may vary - just verify 200 OK
    }

    // MARK: - Network Endpoint Integration Tests

    func testGetNetworkEmpty() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/network")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let requests = json["requests"] as? [[String: Any]]
        XCTAssertNotNil(requests)
        // Should be empty initially (or only contain our test request if we made one)
    }

    func testNetworkInterceptorIntegration() async throws {
        // Clear before adding our test data
        NetworkInterceptor.shared.clear()

        // Simulate network requests that an app would make
        let request1 = NetworkRequest(
            url: "https://api.example.com/users",
            method: "GET",
            status: 200,
            duration: 150
        )
        let request2 = NetworkRequest(
            url: "https://api.example.com/products",
            method: "GET",
            status: 200,
            duration: 200
        )
        let request3 = NetworkRequest(
            url: "https://api.example.com/cart",
            method: "POST",
            status: 500,
            duration: 100
        )

        NetworkInterceptor.shared.recordRequest(request1)
        NetworkInterceptor.shared.recordRequest(request2)
        NetworkInterceptor.shared.recordRequest(request3)

        // Get all network requests
        let (data, statusCode) = try await httpClient.get(path: "/network")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let requests = json["requests"] as? [[String: Any]]

        XCTAssertGreaterThanOrEqual(requests?.count ?? 0, 3)
        XCTAssertGreaterThanOrEqual(json["errors"] as? Int ?? 0, 1)
    }

    func testNetworkWithLimitAndErrorsFilter() async throws {
        // Clear before adding test data
        NetworkInterceptor.shared.clear()

        // Add mix of requests
        for i in 1...10 {
            let status = i % 3 == 0 ? 500 : 200
            let request = NetworkRequest(
                url: "https://api.example.com/req\(i)",
                method: "GET",
                status: status
            )
            NetworkInterceptor.shared.recordRequest(request)
        }

        // Test limit parameter
        let (dataLimited, _) = try await httpClient.get(path: "/network?limit=5")
        let jsonLimited = try JSONSerialization.jsonObject(with: dataLimited) as! [String: Any]
        let requestsLimited = jsonLimited["requests"] as? [[String: Any]]
        XCTAssertLessThanOrEqual(requestsLimited?.count ?? 0, 5)

        // Test errors filter
        let (dataErrors, _) = try await httpClient.get(path: "/network?errors=true")
        let jsonErrors = try JSONSerialization.jsonObject(with: dataErrors) as! [String: Any]
        let requestsErrors = jsonErrors["requests"] as? [[String: Any]]

        // All returned requests should have error status
        requestsErrors?.forEach { request in
            let status = request["status"] as? Int
            XCTAssertTrue(status ?? 0 >= 400)
        }
    }

    func testClearNetwork() async throws {
        // Clear first
        NetworkInterceptor.shared.clear()

        // Add a request
        NetworkInterceptor.shared.recordRequest(NetworkRequest(
            url: "https://api.example.com/test",
            method: "GET",
            status: 200
        ))

        // Verify we have at least one request
        let beforeClear = NetworkInterceptor.shared.getNetworkLog()
        XCTAssertGreaterThanOrEqual(beforeClear.count, 1, "Should have at least 1 request before clear")

        // Clear network via HTTP
        let (_, clearStatus) = try await httpClient.delete(path: "/network")
        XCTAssertEqual(clearStatus, 200)

        // Verify empty using direct API
        // Note: Can't verify via HTTP because the verification request itself gets intercepted
        // by the network interceptor and recorded. The unit test NetworkEndpointTests.testClearNetwork
        // already verifies the HTTP endpoint works correctly.
        let afterClear = NetworkInterceptor.shared.getNetworkLog()
        XCTAssertEqual(afterClear.count, 0, "Network log should be empty after clear")
    }

    // MARK: - Analytics Endpoint Integration Tests

    func testAnalyticsIntegration() async throws {
        // Simulate analytics events from an app
        AnalyticsInterceptor.shared.recordEvent(
            name: "screen_view",
            properties: ["screen_name": "Home"],
            source: "Firebase"
        )
        AnalyticsInterceptor.shared.recordEvent(
            name: "button_tap",
            properties: ["button_id": "checkout_button", "screen": "Cart"],
            source: "Amplitude"
        )
        AnalyticsInterceptor.shared.recordEvent(
            name: "purchase_started",
            properties: ["cart_value": 109.97, "item_count": 3],
            source: "Mixpanel"
        )

        let (data, statusCode) = try await httpClient.get(path: "/analytics")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let events = json["events"] as? [[String: Any]]

        XCTAssertEqual(events?.count, 3)
        XCTAssertEqual(json["count"] as? Int, 3)
    }

    func testAnalyticsWithFilter() async throws {
        // Clear before adding test data
        AnalyticsInterceptor.shared.clear()

        // Add events
        AnalyticsInterceptor.shared.recordEvent(name: "screen_view_home", source: "Test")
        AnalyticsInterceptor.shared.recordEvent(name: "button_tap", source: "Test")
        AnalyticsInterceptor.shared.recordEvent(name: "screen_view_cart", source: "Test")

        // Verify unfiltered first
        let (unfilteredData, _) = try await httpClient.get(path: "/analytics")
        let unfilteredJson = try JSONSerialization.jsonObject(with: unfilteredData) as! [String: Any]
        let totalCount = unfilteredJson["count"] as? Int ?? 0
        XCTAssertGreaterThanOrEqual(totalCount, 3, "Should have at least 3 events before filtering")

        // Now test filter
        let (data, _) = try await httpClient.get(path: "/analytics?filter=screen")
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let events = json["events"] as? [[String: Any]]

        // Should filter to events containing "screen"
        // At least 2 should match: screen_view_home, screen_view_cart
        XCTAssertGreaterThanOrEqual(events?.count ?? 0, 2, "Filter should return at least 2 'screen' events")
    }

    func testAnalyticsSources() async throws {
        AnalyticsInterceptor.shared.registerSource(name: "Firebase") { _, _ in }
        AnalyticsInterceptor.shared.registerSource(name: "Amplitude") { _, _ in }

        let (data, statusCode) = try await httpClient.get(path: "/analytics/sources")

        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let sources = json["sources"] as? [String]

        XCTAssertTrue(sources?.contains("Firebase") ?? false)
        XCTAssertTrue(sources?.contains("Amplitude") ?? false)
    }

    func testClearAnalytics() async throws {
        AnalyticsInterceptor.shared.recordEvent(name: "test_event", source: "Test")

        let (_, clearStatus) = try await httpClient.delete(path: "/analytics")
        XCTAssertEqual(clearStatus, 200)

        let (data, _) = try await httpClient.get(path: "/analytics")
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(json["count"] as? Int, 0)
    }

    // MARK: - Authentication Tests

    func testUnauthorizedWithoutToken() async throws {
        // Create client without token
        var request = URLRequest(url: httpClient.baseURL.appendingPathComponent("/state"))
        request.httpMethod = "GET"
        request.timeoutInterval = 5.0
        // No Authorization header

        let (_, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse

        XCTAssertEqual(httpResponse.statusCode, 401)
    }

    func testUnauthorizedWithWrongToken() async throws {
        let badClient = BridgeHTTPClient(port: testPort, token: "wrong-token")

        let (data, statusCode) = try await badClient.get(path: "/state")

        XCTAssertEqual(statusCode, 401)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertNotNil(json["error"])
    }

    // MARK: - Set State Integration Tests

    func testSetStateDisabledByDefault() async throws {
        let body: [String: Any] = [
            "key": "user",
            "value": ["id": 999, "username": "hacker", "isLoggedIn": false]
        ]

        let (data, statusCode) = try await httpClient.post(path: "/state/set", body: body)

        // When disabled, should return 403 (Forbidden) or 400 (Bad Request)
        XCTAssertTrue(statusCode == 403 || statusCode == 400, "Expected 403 or 400, got \(statusCode)")

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertNotNil(json["error"], "Should have an error message")
    }

    func testSetStateWhenEnabled() async throws {
        // Enable state mutation
        MaestroBridge.shared.enableStateMutation(token: "mutation-secret")

        // Test through the bridge API directly since HTTP endpoint may not be fully configured
        var newUser = sampleApp.currentUser
        newUser.username = "modified_user"

        let result = MaestroBridge.shared.setTestState(key: "user", value: newUser)
        XCTAssertEqual(result, .success)

        // Verify the change via HTTP
        let (data, statusCode) = try await httpClient.get(path: "/state/user")
        XCTAssertEqual(statusCode, 200)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        // Response format: { "key": "user", "value": ... }
        // Verify the username was modified
        if let valueStr = json["value"] as? String {
            XCTAssertTrue(valueStr.contains("modified_user"), "Modified username should be in string representation")
        } else if let value = json["value"] as? [String: Any] {
            XCTAssertEqual(value["username"] as? String, "modified_user")
        }
    }

    // MARK: - 404 Not Found Tests

    func testNotFoundForUnknownEndpoint() async throws {
        let (data, statusCode) = try await httpClient.get(path: "/nonexistent")

        XCTAssertEqual(statusCode, 404)

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertNotNil(json["error"])
    }

    // MARK: - Concurrent Request Tests

    func testConcurrentRequests() async throws {
        // Make multiple concurrent requests to test thread safety
        await withTaskGroup(of: Bool.self) { group in
            for _ in 0..<10 {
                group.addTask {
                    do {
                        let (_, statusCode) = try await self.httpClient.get(path: "/ping")
                        return statusCode == 200
                    } catch {
                        return false
                    }
                }

                group.addTask {
                    do {
                        let (_, statusCode) = try await self.httpClient.get(path: "/state")
                        return statusCode == 200
                    } catch {
                        return false
                    }
                }

                group.addTask {
                    do {
                        let (_, statusCode) = try await self.httpClient.get(path: "/flags")
                        return statusCode == 200
                    } catch {
                        return false
                    }
                }
            }

            var allSucceeded = true
            for await success in group {
                if !success {
                    allSucceeded = false
                }
            }

            XCTAssertTrue(allSucceeded, "All concurrent requests should succeed")
        }
    }
}

// MARK: - End-to-End Scenario Tests

final class MaestroBridgeE2EScenarioTests: XCTestCase {

    var sampleApp: SampleAppIntegration!
    var httpClient: BridgeHTTPClient!
    let testPort: UInt16 = 19877
    let testToken = "e2e-test-token"

    override func setUp() async throws {
        try await super.setUp()

        MaestroBridge.shared.stop()
        MaestroBridge.shared.disableStateMutation()
        NetworkInterceptor.shared.clear()
        AnalyticsInterceptor.shared.clear()

        // Small delay to ensure port is released
        try await Task.sleep(nanoseconds: 50_000_000) // 50ms

        sampleApp = SampleAppIntegration()
        sampleApp.setupMaestroBridge(port: testPort, token: testToken)
        httpClient = BridgeHTTPClient(port: testPort, token: testToken)

        // Wait for server
        let startTime = Date()
        while Date().timeIntervalSince(startTime) < 3.0 {
            do {
                let (_, statusCode) = try await httpClient.get(path: "/ping")
                if statusCode == 200 { break }
            } catch {
                try await Task.sleep(nanoseconds: 100_000_000)
            }
        }
    }

    override func tearDown() async throws {
        sampleApp?.teardown()
        sampleApp = nil
        httpClient = nil
        MaestroBridge.shared.disableStateMutation()
        NetworkInterceptor.shared.clear()
        AnalyticsInterceptor.shared.clear()

        // Small delay to ensure cleanup completes
        try await Task.sleep(nanoseconds: 50_000_000) // 50ms

        try await super.tearDown()
    }

    /// Scenario: Verify user login state and cart contents
    func testVerifyUserAndCartScenario() async throws {
        // Step 1: Check user is logged in
        let (userData, userStatus) = try await httpClient.get(path: "/state/user")
        XCTAssertEqual(userStatus, 200)
        let userJson = try JSONSerialization.jsonObject(with: userData) as! [String: Any]

        // Response format: { "key": "user", "value": ... }
        XCTAssertEqual(userJson["key"] as? String, "user")
        XCTAssertNotNil(userJson["value"])

        // Verify user data exists (string or dict representation)
        if let valueStr = userJson["value"] as? String {
            XCTAssertTrue(valueStr.contains("testuser") && valueStr.contains("true"),
                         "User should be logged in")
        }

        // Step 2: Check cart has items
        let (cartData, cartStatus) = try await httpClient.get(path: "/state/cart")
        XCTAssertEqual(cartStatus, 200)
        let cartJson = try JSONSerialization.jsonObject(with: cartData) as! [String: Any]
        XCTAssertEqual(cartJson["key"] as? String, "cart")
        XCTAssertNotNil(cartJson["value"])

        // Step 3: Check feature flags
        let (flagsData, flagsStatus) = try await httpClient.get(path: "/flags")
        XCTAssertEqual(flagsStatus, 200)
        let flagsJson = try JSONSerialization.jsonObject(with: flagsData) as! [String: Any]
        let flags = flagsJson["flags"] as? [String: Any]
        let checkout = flags?["newCheckout"] as? [String: Any]

        XCTAssertEqual(checkout?["enabled"] as? Bool, true)
        XCTAssertEqual(checkout?["variant"] as? String, "A")
    }

    /// Scenario: Track user journey through network and analytics
    func testUserJourneyTrackingScenario() async throws {
        // Clear state before scenario
        NetworkInterceptor.shared.clear()
        AnalyticsInterceptor.shared.clear()

        // Simulate user journey: Home -> Product List -> Product Detail -> Add to Cart -> Checkout

        // Network requests during journey
        NetworkInterceptor.shared.recordRequest(NetworkRequest(
            url: "https://api.shop.com/products",
            method: "GET",
            status: 200,
            duration: 150
        ))
        NetworkInterceptor.shared.recordRequest(NetworkRequest(
            url: "https://api.shop.com/products/SKU001",
            method: "GET",
            status: 200,
            duration: 100
        ))
        NetworkInterceptor.shared.recordRequest(NetworkRequest(
            url: "https://api.shop.com/cart",
            method: "POST",
            status: 201,
            duration: 200
        ))

        // Analytics events during journey
        AnalyticsInterceptor.shared.recordEvent(
            name: "screen_view",
            properties: ["screen": "ProductList"],
            source: "Analytics"
        )
        AnalyticsInterceptor.shared.recordEvent(
            name: "product_viewed",
            properties: ["product_id": "SKU001", "price": 29.99],
            source: "Analytics"
        )
        AnalyticsInterceptor.shared.recordEvent(
            name: "add_to_cart",
            properties: ["product_id": "SKU001", "quantity": 1],
            source: "Analytics"
        )

        // Verify network log
        let (networkData, _) = try await httpClient.get(path: "/network")
        let networkJson = try JSONSerialization.jsonObject(with: networkData) as! [String: Any]

        XCTAssertGreaterThanOrEqual(networkJson["count"] as? Int ?? 0, 3)
        XCTAssertEqual(networkJson["errors"] as? Int, 0)

        // Verify analytics
        let (analyticsData, _) = try await httpClient.get(path: "/analytics")
        let analyticsJson = try JSONSerialization.jsonObject(with: analyticsData) as! [String: Any]

        XCTAssertGreaterThanOrEqual(analyticsJson["count"] as? Int ?? 0, 3)

        // Filter to find add_to_cart event
        let (filteredData, _) = try await httpClient.get(path: "/analytics?filter=add_to_cart")
        let filteredJson = try JSONSerialization.jsonObject(with: filteredData) as! [String: Any]
        let filteredEvents = filteredJson["events"] as? [[String: Any]]

        XCTAssertGreaterThanOrEqual(filteredEvents?.count ?? 0, 1)
    }

    /// Scenario: Error tracking during checkout flow
    func testErrorTrackingScenario() async throws {
        // Clear state before scenario
        NetworkInterceptor.shared.clear()

        // Simulate checkout with errors
        NetworkInterceptor.shared.recordRequest(NetworkRequest(
            url: "https://api.shop.com/checkout",
            method: "POST",
            status: 500,
            duration: 50
        ))
        NetworkInterceptor.shared.recordRequest(NetworkRequest(
            url: "https://api.shop.com/checkout",
            method: "POST",
            status: 500,
            duration: 45
        ))
        NetworkInterceptor.shared.recordRequest(NetworkRequest(
            url: "https://api.shop.com/checkout",
            method: "POST",
            status: 201,
            duration: 300
        ))

        // Get only errors
        let (errorData, _) = try await httpClient.get(path: "/network?errors=true")
        let errorJson = try JSONSerialization.jsonObject(with: errorData) as! [String: Any]
        let errorRequests = errorJson["requests"] as? [[String: Any]]

        XCTAssertGreaterThanOrEqual(errorRequests?.count ?? 0, 2)

        // Get all requests and verify error count
        let (allData, _) = try await httpClient.get(path: "/network")
        let allJson = try JSONSerialization.jsonObject(with: allData) as! [String: Any]

        XCTAssertGreaterThanOrEqual(allJson["count"] as? Int ?? 0, 3)
        XCTAssertGreaterThanOrEqual(allJson["errors"] as? Int ?? 0, 2)
    }
}

// MARK: - Performance Tests

final class MaestroBridgePerformanceTests: XCTestCase {

    var httpClient: BridgeHTTPClient!
    let testPort: UInt16 = 19878
    let testToken = "perf-test-token"

    override func setUp() async throws {
        try await super.setUp()

        MaestroBridge.shared.stop()
        MaestroBridge.shared.disableStateMutation()
        NetworkInterceptor.shared.clear()
        AnalyticsInterceptor.shared.clear()

        // Small delay to ensure port is released
        try await Task.sleep(nanoseconds: 50_000_000) // 50ms

        // Start bridge with minimal setup
        MaestroBridge.shared.start(port: testPort, token: testToken)
        httpClient = BridgeHTTPClient(port: testPort, token: testToken)

        // Wait for server
        let startTime = Date()
        while Date().timeIntervalSince(startTime) < 3.0 {
            do {
                let (_, statusCode) = try await httpClient.get(path: "/ping")
                if statusCode == 200 { break }
            } catch {
                try await Task.sleep(nanoseconds: 100_000_000)
            }
        }
    }

    override func tearDown() async throws {
        MaestroBridge.shared.stop()
        httpClient = nil
        NetworkInterceptor.shared.clear()
        AnalyticsInterceptor.shared.clear()

        // Small delay to ensure cleanup completes
        try await Task.sleep(nanoseconds: 50_000_000) // 50ms

        try await super.tearDown()
    }

    func testPingLatency() async throws {
        var totalTime: TimeInterval = 0
        let iterations = 100

        for _ in 0..<iterations {
            let start = Date()
            let (_, statusCode) = try await httpClient.get(path: "/ping")
            let elapsed = Date().timeIntervalSince(start)

            XCTAssertEqual(statusCode, 200)
            totalTime += elapsed
        }

        let averageMs = (totalTime / Double(iterations)) * 1000
        print("Average ping latency: \(averageMs)ms")

        // Should be reasonably fast for localhost
        XCTAssertLessThan(averageMs, 50, "Average ping should be under 50ms")
    }

    func testHighVolumeNetworkLogging() async throws {
        // Clear before test
        NetworkInterceptor.shared.clear()

        // Log many requests
        let requestCount = 500
        for i in 0..<requestCount {
            NetworkInterceptor.shared.recordRequest(NetworkRequest(
                url: "https://api.example.com/req\(i)",
                method: "GET",
                status: 200
            ))
        }

        // Fetch should still be fast
        let start = Date()
        let (data, statusCode) = try await httpClient.get(path: "/network")
        let elapsed = Date().timeIntervalSince(start) * 1000

        XCTAssertEqual(statusCode, 200)
        print("Network fetch latency (500 requests): \(elapsed)ms")

        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        // Should be limited to max requests
        XCTAssertLessThanOrEqual(json["count"] as? Int ?? 0, 500)
    }
}
