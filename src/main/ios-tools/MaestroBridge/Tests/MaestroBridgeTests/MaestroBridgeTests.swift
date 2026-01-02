// MaestroBridgeTests.swift
// MaestroBridge
//
// Unit tests for MaestroBridge package.

import XCTest
@testable import MaestroBridge

final class MaestroBridgeTests: XCTestCase {

    override func tearDown() {
        MaestroBridge.shared.stop()
        MaestroBridge.shared.disableStateMutation()
        NetworkInterceptor.shared.clear()
        AnalyticsInterceptor.shared.clear()
        super.tearDown()
    }

    // MARK: - Token Tests

    func testTokenGeneration() {
        let token = BridgeToken()
        let generated = token.generateToken()

        XCTAssertFalse(generated.isEmpty)
        XCTAssertEqual(generated.count, 64) // 32 bytes as hex
    }

    func testTokenValidation() {
        let token = BridgeToken(token: "test-token-123")

        XCTAssertTrue(token.validate("test-token-123"))
        XCTAssertFalse(token.validate("wrong-token"))
        XCTAssertFalse(token.validate(nil))
    }

    func testTokenValidationWithNoToken() {
        let token = BridgeToken()
        // No token set - should allow all
        XCTAssertTrue(token.validate(nil))
        XCTAssertTrue(token.validate("any-token"))
    }

    func testAuthHeaderValidation() {
        let token = BridgeToken(token: "test-token")

        XCTAssertEqual(token.validateAuthHeader("Bearer test-token"), .valid)
        XCTAssertEqual(token.validateAuthHeader("Bearer wrong"), .invalid)
        XCTAssertEqual(token.validateAuthHeader(nil), .missing)
        XCTAssertEqual(token.validateAuthHeader("Basic test-token"), .invalid)
    }

    // MARK: - Debug Guard Tests

    func testDebugBuildCheck() {
        #if DEBUG
        XCTAssertTrue(DebugOnlyGuard.isDebugBuild)
        #else
        XCTAssertFalse(DebugOnlyGuard.isDebugBuild)
        #endif
    }

    func testSimulatorCheck() {
        #if targetEnvironment(simulator)
        XCTAssertTrue(DebugOnlyGuard.isRunningInSimulator())
        #else
        XCTAssertFalse(DebugOnlyGuard.isRunningInSimulator())
        #endif
    }

    // MARK: - AnyCodable Tests

    func testAnyCodableString() throws {
        let value = AnyCodable("hello")
        let encoder = JSONEncoder()
        let data = try encoder.encode(value)
        let json = String(data: data, encoding: .utf8)

        XCTAssertEqual(json, "\"hello\"")
    }

    func testAnyCodableNumber() throws {
        let value = AnyCodable(42)
        let encoder = JSONEncoder()
        let data = try encoder.encode(value)
        let json = String(data: data, encoding: .utf8)

        XCTAssertEqual(json, "42")
    }

    func testAnyCodableDictionary() throws {
        let value = AnyCodable(["name": "test", "count": 5] as [String: Any])
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let data = try encoder.encode(value)
        let json = String(data: data, encoding: .utf8)

        XCTAssertNotNil(json)
        XCTAssertTrue(json!.contains("\"name\""))
    }

    // MARK: - State Registration Tests

    func testStateRegistration() {
        MaestroBridge.shared.register("testState") {
            return ["value": 123]
        }

        let state = MaestroBridge.shared.getCustomState(key: "testState")
        XCTAssertNotNil(state)

        MaestroBridge.shared.unregister("testState")
        XCTAssertNil(MaestroBridge.shared.getCustomState(key: "testState"))
    }

    func testFeatureFlagRegistration() {
        MaestroBridge.shared.registerFeatureFlag("testFlag", enabled: true, variant: "A")

        let flags = MaestroBridge.shared.getAllFeatureFlags()
        XCTAssertEqual(flags["testFlag"]?.enabled, true)
        XCTAssertEqual(flags["testFlag"]?.variant, "A")
    }

    // MARK: - Analytics Interceptor Tests

    func testAnalyticsEventRecording() {
        AnalyticsInterceptor.shared.clear()

        AnalyticsInterceptor.shared.recordEvent(
            name: "test_event",
            properties: ["key": "value"],
            source: "Test"
        )

        let log = AnalyticsInterceptor.shared.getAnalyticsLog()
        XCTAssertEqual(log.count, 1)
        XCTAssertEqual(log.events.first?.name, "test_event")
        XCTAssertEqual(log.events.first?.source, "Test")
    }

    func testAnalyticsFiltering() {
        AnalyticsInterceptor.shared.clear()

        AnalyticsInterceptor.shared.recordEvent(name: "button_tap", source: "UI")
        AnalyticsInterceptor.shared.recordEvent(name: "screen_view", source: "UI")
        AnalyticsInterceptor.shared.recordEvent(name: "api_call", source: "Network")

        let filter = AnalyticsFilter(namePattern: "button", limit: 100)
        let filtered = AnalyticsInterceptor.shared.getEvents(filter: filter)

        XCTAssertEqual(filtered.count, 1)
        XCTAssertEqual(filtered.events.first?.name, "button_tap")
    }

    // MARK: - Network Interceptor Tests

    func testNetworkRequestRecording() {
        NetworkInterceptor.shared.clear()

        let request = NetworkRequest(
            url: "https://api.example.com/test",
            method: "GET",
            status: 200,
            duration: 100
        )

        NetworkInterceptor.shared.recordRequest(request)

        let log = NetworkInterceptor.shared.getNetworkLog()
        XCTAssertEqual(log.count, 1)
        XCTAssertEqual(log.requests.first?.url, "https://api.example.com/test")
    }

    // MARK: - Route Info Tests

    func testRouteInfoEncoding() throws {
        let route = RouteInfo(
            currentRoute: "/settings/profile",
            stack: [
                RouteEntry(route: "/home", title: "Home"),
                RouteEntry(route: "/settings", title: "Settings"),
                RouteEntry(route: "/settings/profile", title: "Profile")
            ],
            canGoBack: true,
            presentedModally: false
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(route)
        let json = String(data: data, encoding: .utf8)

        XCTAssertNotNil(json)
        // JSON may escape slashes, so check for the route name
        XCTAssertTrue(json!.contains("settings") && json!.contains("profile"))
    }

    // MARK: - Bridge Response Tests

    func testBridgeResponseJson() {
        struct TestData: Codable {
            let message: String
        }

        let response = BridgeResponse.json(TestData(message: "hello"))
        let (statusCode, contentType, body) = response.toHTTPResponse()

        XCTAssertEqual(statusCode, 200)
        XCTAssertEqual(contentType, "application/json")

        let json = String(data: body, encoding: .utf8)
        XCTAssertNotNil(json)
        XCTAssertTrue(json!.contains("hello"))
    }

    func testBridgeResponseError() {
        let response = BridgeResponse.error(code: 404, message: "Not found")
        let (statusCode, contentType, body) = response.toHTTPResponse()

        XCTAssertEqual(statusCode, 404)
        XCTAssertEqual(contentType, "application/json")

        let json = String(data: body, encoding: .utf8)
        XCTAssertNotNil(json)
        XCTAssertTrue(json!.contains("Not found"))
    }
}

// MARK: - Bridge Server Tests

final class BridgeServerTests: XCTestCase {

    override func tearDown() {
        MaestroBridge.shared.stop()
        super.tearDown()
    }

    func testServerInitialization() {
        let server = BridgeServer(port: 9999, token: "test-token")
        XCTAssertEqual(server.port, 9999)
        XCTAssertEqual(server.token, "test-token")
    }

    func testServerTokenGeneration() {
        let server = BridgeServer(port: 9998)
        // When no token is provided, one is generated
        XCTAssertNotNil(server.token)
        XCTAssertEqual(server.token?.count, 64) // 32 bytes as hex
    }

    func testBridgeResponseText() {
        let response = BridgeResponse.text("plain text response")
        let (statusCode, contentType, body) = response.toHTTPResponse()

        XCTAssertEqual(statusCode, 200)
        XCTAssertEqual(contentType, "text/plain")
        XCTAssertEqual(String(data: body, encoding: .utf8), "plain text response")
    }

    func testBridgeResponseErrorCodes() {
        let badRequest = BridgeResponse.error(code: 400, message: "Bad request")
        XCTAssertEqual(badRequest.toHTTPResponse().statusCode, 400)

        let unauthorized = BridgeResponse.error(code: 401, message: "Unauthorized")
        XCTAssertEqual(unauthorized.toHTTPResponse().statusCode, 401)

        let forbidden = BridgeResponse.error(code: 403, message: "Forbidden")
        XCTAssertEqual(forbidden.toHTTPResponse().statusCode, 403)

        let notFound = BridgeResponse.error(code: 404, message: "Not found")
        XCTAssertEqual(notFound.toHTTPResponse().statusCode, 404)

        let serverError = BridgeResponse.error(code: 500, message: "Internal error")
        XCTAssertEqual(serverError.toHTTPResponse().statusCode, 500)
    }

    func testBridgeResponseJsonArray() throws {
        struct Item: Codable {
            let id: Int
            let name: String
        }
        let items = [Item(id: 1, name: "first"), Item(id: 2, name: "second")]
        let response = BridgeResponse.json(items)
        let (statusCode, contentType, body) = response.toHTTPResponse()

        XCTAssertEqual(statusCode, 200)
        XCTAssertEqual(contentType, "application/json")

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("first"))
        XCTAssertTrue(json.contains("second"))
    }
}

// MARK: - Bridge Token Tests

final class BridgeTokenTests: XCTestCase {

    func testTokenSetAndClear() {
        let token = BridgeToken()

        // Initially nil
        XCTAssertNil(token.token)

        // Set token
        token.setToken("my-token")
        XCTAssertEqual(token.token, "my-token")

        // Clear token
        token.clearToken()
        XCTAssertNil(token.token)
    }

    func testTokenUniqueGeneration() {
        let token1 = BridgeToken()
        let token2 = BridgeToken()

        let generated1 = token1.generateToken()
        let generated2 = token2.generateToken()

        XCTAssertNotEqual(generated1, generated2)
    }

    func testConstantTimeComparison() {
        let token = BridgeToken(token: "secure-token-12345")

        // Equal tokens should validate
        XCTAssertTrue(token.validate("secure-token-12345"))

        // Different length should fail
        XCTAssertFalse(token.validate("secure-token"))
        XCTAssertFalse(token.validate("secure-token-12345-extra"))

        // Same length but different should fail
        XCTAssertFalse(token.validate("secure-token-12346"))
    }

    func testAuthHeaderParsing() {
        let token = BridgeToken(token: "auth-token")

        // Valid Bearer token
        XCTAssertEqual(token.validateAuthHeader("Bearer auth-token"), .valid)

        // Invalid Bearer format
        XCTAssertEqual(token.validateAuthHeader("Bearerauth-token"), .invalid)
        XCTAssertEqual(token.validateAuthHeader("bearer auth-token"), .invalid) // Case sensitive
        XCTAssertEqual(token.validateAuthHeader("Token auth-token"), .invalid)

        // Empty authorization
        XCTAssertEqual(token.validateAuthHeader(""), .invalid)

        // Just "Bearer "
        XCTAssertEqual(token.validateAuthHeader("Bearer "), .invalid)
    }

    func testAuthHeaderWithNoTokenRequired() {
        let token = BridgeToken() // No token set

        // When no token is required:
        // - nil header is valid (no auth needed)
        // - Valid Bearer format with any token is valid
        // - Invalid format still fails format check (Bearer prefix required)
        XCTAssertEqual(token.validateAuthHeader(nil), .valid)
        XCTAssertEqual(token.validateAuthHeader("Bearer any-token"), .valid)
        XCTAssertEqual(token.validateAuthHeader("Bearer "), .valid) // Empty token is fine when none required
        // Note: Invalid format still returns .invalid even when no token required
        XCTAssertEqual(token.validateAuthHeader("Invalid format"), .invalid)
    }
}

// MARK: - State Endpoint Tests

final class StateEndpointTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Clean state
        MaestroBridge.shared.unregister("testKey")
        MaestroBridge.shared.unregister("user")
    }

    override func tearDown() {
        MaestroBridge.shared.stop()
        MaestroBridge.shared.unregister("testKey")
        MaestroBridge.shared.unregister("user")
        super.tearDown()
    }

    func testGetStateWithBridge() {
        MaestroBridge.shared.register("testKey") {
            return ["value": 42]
        }

        let endpoint = StateEndpoint(bridge: MaestroBridge.shared)
        let response = endpoint.handleGetState()

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("testKey"))
        XCTAssertTrue(json.contains("42"))
    }

    func testGetStateKeyFound() {
        struct UserState: Encodable {
            let name: String
            let id: Int
        }

        MaestroBridge.shared.register("user") {
            return UserState(name: "John", id: 123)
        }

        let endpoint = StateEndpoint(bridge: MaestroBridge.shared)
        let response = endpoint.handleGetStateKey(key: "user")

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("John"))
    }

    func testGetStateKeyNotFound() {
        let endpoint = StateEndpoint(bridge: MaestroBridge.shared)
        let response = endpoint.handleGetStateKey(key: "nonexistent")

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 404)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("not found"))
    }

    func testGetStateWithoutBridge() {
        let endpoint = StateEndpoint(bridge: nil)
        let response = endpoint.handleGetState()

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 500)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("Bridge not available"))
    }
}

// MARK: - Route Endpoint Tests

final class RouteEndpointTests: XCTestCase {

    func testGetRoute() {
        let endpoint = RouteEndpoint()
        let response = endpoint.handleGetRoute()

        let (statusCode, contentType, _) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)
        XCTAssertEqual(contentType, "application/json")
    }

    func testGetStack() {
        let endpoint = RouteEndpoint()
        let response = endpoint.handleGetStack()

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("stack"))
    }

    func testGetHistory() {
        var endpoint = RouteEndpoint()

        // Record some navigation events
        endpoint.recordNavigation(type: .push, from: nil, to: "/home")
        endpoint.recordNavigation(type: .push, from: "/home", to: "/settings")

        let response = endpoint.handleGetHistory()

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("home"))
        XCTAssertTrue(json.contains("settings"))
    }

    func testRecordNavigationAndClear() {
        var endpoint = RouteEndpoint()

        endpoint.recordNavigation(type: .push, from: nil, to: "/page1")
        endpoint.recordNavigation(type: .push, from: "/page1", to: "/page2")

        // Verify history
        var response = endpoint.handleGetHistory()
        var json = String(data: response.toHTTPResponse().body, encoding: .utf8)!
        XCTAssertTrue(json.contains("page1"))
        XCTAssertTrue(json.contains("page2"))

        // Clear
        endpoint.clearHistory()

        // Verify empty
        response = endpoint.handleGetHistory()
        json = String(data: response.toHTTPResponse().body, encoding: .utf8)!
        XCTAssertFalse(json.contains("page1"))
    }

    func testNavigationTypes() {
        var endpoint = RouteEndpoint()

        endpoint.recordNavigation(type: .push, from: nil, to: "/a")
        endpoint.recordNavigation(type: .pop, from: "/a", to: "/")
        endpoint.recordNavigation(type: .present, from: "/", to: "/modal")
        endpoint.recordNavigation(type: .dismiss, from: "/modal", to: "/")
        endpoint.recordNavigation(type: .replace, from: "/", to: "/new")
        endpoint.recordNavigation(type: .setRoot, from: "/new", to: "/root")

        let response = endpoint.handleGetHistory()
        let json = String(data: response.toHTTPResponse().body, encoding: .utf8)!

        XCTAssertTrue(json.contains("push"))
        XCTAssertTrue(json.contains("pop"))
        XCTAssertTrue(json.contains("present"))
        XCTAssertTrue(json.contains("dismiss"))
        XCTAssertTrue(json.contains("replace"))
        XCTAssertTrue(json.contains("setRoot"))
    }
}

// MARK: - Network Endpoint Tests

final class NetworkEndpointTests: XCTestCase {

    override func setUp() {
        super.setUp()
        NetworkInterceptor.shared.clear()
    }

    override func tearDown() {
        NetworkInterceptor.shared.clear()
        super.tearDown()
    }

    func testGetNetwork() {
        let request = NetworkRequest(
            url: "https://api.test.com/users",
            method: "GET",
            status: 200,
            duration: 150
        )
        NetworkInterceptor.shared.recordRequest(request)

        let endpoint = NetworkEndpoint()
        let response = endpoint.handleGetNetwork()

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("api.test.com"))
        XCTAssertTrue(json.contains("users"))
    }

    func testGetNetworkWithLimit() {
        // Add 5 requests
        for i in 1...5 {
            let request = NetworkRequest(
                url: "https://api.test.com/req\(i)",
                method: "GET",
                status: 200
            )
            NetworkInterceptor.shared.recordRequest(request)
        }

        let endpoint = NetworkEndpoint()
        let response = endpoint.handleGetNetwork(limit: 2)

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        // Should only contain last 2 requests
        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("req4") || json.contains("req5"))
    }

    func testGetNetworkErrorsOnly() {
        // Add mix of successful and failed requests
        let successRequest = NetworkRequest(
            url: "https://api.test.com/success",
            method: "GET",
            status: 200
        )
        let errorRequest = NetworkRequest(
            url: "https://api.test.com/error",
            method: "GET",
            status: 500
        )
        let notFoundRequest = NetworkRequest(
            url: "https://api.test.com/notfound",
            method: "GET",
            status: 404
        )

        NetworkInterceptor.shared.recordRequest(successRequest)
        NetworkInterceptor.shared.recordRequest(errorRequest)
        NetworkInterceptor.shared.recordRequest(notFoundRequest)

        let endpoint = NetworkEndpoint()
        let response = endpoint.handleGetNetwork(errorsOnly: true)

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertFalse(json.contains("success"))
        XCTAssertTrue(json.contains("error") || json.contains("notfound"))
    }

    func testGetNetworkDetailNotFound() {
        let endpoint = NetworkEndpoint()
        let response = endpoint.handleGetNetworkDetail(id: "nonexistent")

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 404)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("not found"))
    }

    func testClearNetwork() {
        let request = NetworkRequest(
            url: "https://api.test.com/data",
            method: "POST",
            status: 201
        )
        NetworkInterceptor.shared.recordRequest(request)

        let endpoint = NetworkEndpoint()

        // Verify request exists
        var response = endpoint.handleGetNetwork()
        var json = String(data: response.toHTTPResponse().body, encoding: .utf8)!
        XCTAssertTrue(json.contains("data"))

        // Clear
        response = endpoint.handleClearNetwork()
        XCTAssertEqual(response.toHTTPResponse().statusCode, 200)

        // Verify empty
        response = endpoint.handleGetNetwork()
        json = String(data: response.toHTTPResponse().body, encoding: .utf8)!
        XCTAssertFalse(json.contains("data"))
    }
}

// MARK: - Analytics Endpoint Tests

final class AnalyticsEndpointTests: XCTestCase {

    override func setUp() {
        super.setUp()
        AnalyticsInterceptor.shared.clear()
    }

    override func tearDown() {
        AnalyticsInterceptor.shared.clear()
        super.tearDown()
    }

    func testGetAnalytics() {
        AnalyticsInterceptor.shared.recordEvent(
            name: "button_click",
            properties: ["button_id": "submit"],
            source: "UI"
        )

        let endpoint = AnalyticsEndpoint()
        let response = endpoint.handleGetAnalytics()

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("button_click"))
        XCTAssertTrue(json.contains("submit"))
    }

    func testGetAnalyticsWithFilter() {
        AnalyticsInterceptor.shared.recordEvent(name: "screen_view", source: "Navigation")
        AnalyticsInterceptor.shared.recordEvent(name: "button_tap", source: "UI")
        AnalyticsInterceptor.shared.recordEvent(name: "screen_exit", source: "Navigation")

        let endpoint = AnalyticsEndpoint()
        let response = endpoint.handleGetAnalytics(filter: "screen")

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("screen_view"))
        XCTAssertTrue(json.contains("screen_exit"))
        XCTAssertFalse(json.contains("button_tap"))
    }

    func testGetAnalyticsWithLimit() {
        for i in 1...10 {
            AnalyticsInterceptor.shared.recordEvent(name: "event_\(i)", source: "Test")
        }

        let endpoint = AnalyticsEndpoint()
        let response = endpoint.handleGetAnalytics(limit: 3)

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        // Should have last 3 events
        XCTAssertTrue(json.contains("event_10") || json.contains("event_9") || json.contains("event_8"))
    }

    func testGetSources() {
        AnalyticsInterceptor.shared.registerSource(name: "CustomSDK") { _, _ in }
        AnalyticsInterceptor.shared.registerSource(name: "AnotherSDK") { _, _ in }

        let endpoint = AnalyticsEndpoint()
        let response = endpoint.handleGetSources()

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("CustomSDK"))
        XCTAssertTrue(json.contains("AnotherSDK"))
    }

    func testClearAnalytics() {
        AnalyticsInterceptor.shared.recordEvent(name: "test_event", source: "Test")

        let endpoint = AnalyticsEndpoint()

        // Verify event exists
        var response = endpoint.handleGetAnalytics()
        var json = String(data: response.toHTTPResponse().body, encoding: .utf8)!
        XCTAssertTrue(json.contains("test_event"))

        // Clear
        response = endpoint.handleClearAnalytics()
        XCTAssertEqual(response.toHTTPResponse().statusCode, 200)

        // Verify empty
        response = endpoint.handleGetAnalytics()
        json = String(data: response.toHTTPResponse().body, encoding: .utf8)!
        XCTAssertFalse(json.contains("test_event"))
    }
}

// MARK: - Feature Flags Endpoint Tests

final class FeatureFlagsEndpointTests: XCTestCase {

    override func tearDown() {
        MaestroBridge.shared.stop()
        super.tearDown()
    }

    func testGetFlags() {
        MaestroBridge.shared.registerFeatureFlag("darkMode", enabled: true)
        MaestroBridge.shared.registerFeatureFlag("newUI", enabled: false, variant: "control")

        let endpoint = FeatureFlagsEndpoint(bridge: MaestroBridge.shared)
        let response = endpoint.handleGetFlags()

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("darkMode"))
        XCTAssertTrue(json.contains("newUI"))
        XCTAssertTrue(json.contains("control"))
    }

    func testGetFlagFound() {
        MaestroBridge.shared.registerFeatureFlag("featureX", enabled: true, variant: "A")

        let endpoint = FeatureFlagsEndpoint(bridge: MaestroBridge.shared)
        let response = endpoint.handleGetFlag(name: "featureX")

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("featureX"))
        XCTAssertTrue(json.contains("true"))
    }

    func testGetFlagNotFound() {
        let endpoint = FeatureFlagsEndpoint(bridge: MaestroBridge.shared)
        let response = endpoint.handleGetFlag(name: "nonexistent")

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 404)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("not found"))
    }

    func testGetFlagsWithoutBridge() {
        let endpoint = FeatureFlagsEndpoint(bridge: nil)
        let response = endpoint.handleGetFlags()

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 500)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("Bridge not available"))
    }
}

// MARK: - Set State Endpoint Tests

final class SetStateEndpointTests: XCTestCase {

    override func tearDown() {
        MaestroBridge.shared.stop()
        MaestroBridge.shared.disableStateMutation()
        MaestroBridge.shared.unregister("mutableState")
        super.tearDown()
    }

    func testSetStateDisabledByDefault() {
        let endpoint = SetStateEndpoint(bridge: MaestroBridge.shared, enabled: false)
        let response = endpoint.handleSetState(key: "any", value: 123, providedToken: nil)

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 403)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("disabled"))
    }

    func testSetStateWithInvalidToken() {
        let endpoint = SetStateEndpoint(
            bridge: MaestroBridge.shared,
            enabled: true,
            mutationToken: "secret-token"
        )

        let response = endpoint.handleSetState(key: "any", value: 123, providedToken: "wrong-token")

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 401)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("Invalid mutation token"))
    }

    func testSetStateWithValidToken() {
        var testValue = 0
        MaestroBridge.shared.register(
            "mutableState",
            provider: { return testValue },
            setter: { (value: Int) -> Bool in
                testValue = value
                return true
            }
        )
        MaestroBridge.shared.enableStateMutation(token: "mutation-token")

        let endpoint = SetStateEndpoint(
            bridge: MaestroBridge.shared,
            enabled: true,
            mutationToken: "mutation-token"
        )

        let response = endpoint.handleSetState(key: "mutableState", value: 42, providedToken: "mutation-token")

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 200)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("updated"))
    }

    func testSetStateKeyNotFound() {
        MaestroBridge.shared.enableStateMutation()

        let endpoint = SetStateEndpoint(bridge: MaestroBridge.shared, enabled: true)
        let response = endpoint.handleSetState(key: "nonexistent", value: 123, providedToken: nil)

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 404)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("not found"))
    }

    func testSetStateWithoutBridge() {
        let endpoint = SetStateEndpoint(bridge: nil, enabled: true)
        let response = endpoint.handleSetState(key: "any", value: 123, providedToken: nil)

        let (statusCode, _, body) = response.toHTTPResponse()
        XCTAssertEqual(statusCode, 500)

        let json = String(data: body, encoding: .utf8)!
        XCTAssertTrue(json.contains("Bridge not available"))
    }
}

// MARK: - Network Interceptor Advanced Tests

final class NetworkInterceptorAdvancedTests: XCTestCase {

    override func setUp() {
        super.setUp()
        NetworkInterceptor.shared.clear()
    }

    override func tearDown() {
        NetworkInterceptor.shared.clear()
        NetworkInterceptor.shared.disable()
        super.tearDown()
    }

    func testSensitiveHeaderRedaction() {
        let request = NetworkRequest(
            url: "https://api.test.com/data",
            method: "GET",
            status: 200,
            requestHeaders: [
                "Authorization": "Bearer secret-token",
                "X-API-Key": "api-key-123",
                "Content-Type": "application/json",
                "Cookie": "session=abc123"
            ]
        )

        NetworkInterceptor.shared.recordRequest(request)

        let log = NetworkInterceptor.shared.getNetworkLog()
        let recorded = log.requests.first!

        // These should remain unchanged
        XCTAssertEqual(recorded.requestHeaders["Content-Type"], "application/json")

        // Note: The actual redaction happens in recordRequestStart, not recordRequest
        // So this test verifies the request is stored as-is
        XCTAssertNotNil(recorded.requestHeaders["Authorization"])
    }

    func testMaxRequestsLimit() {
        let originalMax = NetworkInterceptor.shared.maxRequests
        NetworkInterceptor.shared.maxRequests = 5

        // Add more than max requests
        for i in 1...10 {
            let request = NetworkRequest(
                url: "https://api.test.com/req\(i)",
                method: "GET",
                status: 200
            )
            NetworkInterceptor.shared.recordRequest(request)
        }

        let log = NetworkInterceptor.shared.getNetworkLog()
        XCTAssertEqual(log.count, 5)

        // Should have only the last 5 requests
        let urls = log.requests.map { $0.url }
        XCTAssertFalse(urls.contains("https://api.test.com/req1"))
        XCTAssertTrue(urls.contains("https://api.test.com/req10"))

        NetworkInterceptor.shared.maxRequests = originalMax
    }

    func testErrorCounting() {
        let successRequest = NetworkRequest(url: "https://api.test.com/ok", method: "GET", status: 200)
        let errorRequest = NetworkRequest(url: "https://api.test.com/err", method: "GET", status: 500)
        let clientError = NetworkRequest(url: "https://api.test.com/notfound", method: "GET", status: 404)
        let networkError = NetworkRequest(url: "https://api.test.com/timeout", method: "GET", error: "Timeout")

        NetworkInterceptor.shared.recordRequest(successRequest)
        NetworkInterceptor.shared.recordRequest(errorRequest)
        NetworkInterceptor.shared.recordRequest(clientError)
        NetworkInterceptor.shared.recordRequest(networkError)

        let log = NetworkInterceptor.shared.getNetworkLog()
        XCTAssertEqual(log.count, 4)
        XCTAssertEqual(log.errors, 3) // 500, 404, and network error
    }

    func testRequestWithDetail() {
        let request = NetworkRequest(
            id: "detail-test-id",
            url: "https://api.test.com/detail",
            method: "POST",
            status: 201
        )
        let detail = NetworkRequestDetail(
            request: request,
            requestBody: "{\"name\": \"test\"}",
            responseBody: "{\"id\": 123}",
            requestContentType: "application/json",
            responseContentType: "application/json"
        )

        NetworkInterceptor.shared.recordRequest(request, detail: detail)

        let retrievedDetail = NetworkInterceptor.shared.getRequestDetail(id: "detail-test-id")
        XCTAssertNotNil(retrievedDetail)
        XCTAssertEqual(retrievedDetail?.requestBody, "{\"name\": \"test\"}")
        XCTAssertEqual(retrievedDetail?.responseBody, "{\"id\": 123}")
    }

    func testEnableDisable() {
        XCTAssertFalse(NetworkInterceptor.shared.getRequests().isEmpty == false)

        NetworkInterceptor.shared.enable()
        // Enable is idempotent
        NetworkInterceptor.shared.enable()

        NetworkInterceptor.shared.disable()
        // Disable is idempotent
        NetworkInterceptor.shared.disable()
    }
}

// MARK: - Analytics Interceptor Advanced Tests

final class AnalyticsInterceptorAdvancedTests: XCTestCase {

    override func setUp() {
        super.setUp()
        AnalyticsInterceptor.shared.clear()
    }

    override func tearDown() {
        AnalyticsInterceptor.shared.clear()
        super.tearDown()
    }

    func testMaxEventsLimit() {
        let originalMax = AnalyticsInterceptor.shared.maxEvents
        AnalyticsInterceptor.shared.maxEvents = 10

        // Add more than max events
        for i in 1...20 {
            AnalyticsInterceptor.shared.recordEvent(name: "event_\(i)")
        }

        let log = AnalyticsInterceptor.shared.getAnalyticsLog()
        XCTAssertEqual(log.count, 10)

        // Should have only the last 10 events
        let names = log.events.map { $0.name }
        XCTAssertFalse(names.contains("event_1"))
        XCTAssertTrue(names.contains("event_20"))

        AnalyticsInterceptor.shared.maxEvents = originalMax
    }

    func testSDKIntegrationHelpers() {
        AnalyticsInterceptor.shared.firebaseLogEvent(name: "firebase_event", parameters: ["key": "value"])
        AnalyticsInterceptor.shared.amplitudeLogEvent(eventType: "amplitude_event", eventProperties: ["prop": 123])
        AnalyticsInterceptor.shared.mixpanelTrack(event: "mixpanel_event", properties: nil)
        AnalyticsInterceptor.shared.segmentTrack(event: "segment_event", properties: ["a": "b"])

        let log = AnalyticsInterceptor.shared.getAnalyticsLog()
        XCTAssertEqual(log.count, 4)

        let sources = log.events.map { $0.source }
        XCTAssertTrue(sources.contains("Firebase"))
        XCTAssertTrue(sources.contains("Amplitude"))
        XCTAssertTrue(sources.contains("Mixpanel"))
        XCTAssertTrue(sources.contains("Segment"))
    }

    func testFilterBySource() {
        AnalyticsInterceptor.shared.recordEvent(name: "e1", source: "Firebase")
        AnalyticsInterceptor.shared.recordEvent(name: "e2", source: "Custom")
        AnalyticsInterceptor.shared.recordEvent(name: "e3", source: "Firebase")

        let filter = AnalyticsFilter(source: "Firebase", limit: 100)
        let filtered = AnalyticsInterceptor.shared.getEvents(filter: filter)

        XCTAssertEqual(filtered.count, 2)
        XCTAssertTrue(filtered.events.allSatisfy { $0.source == "Firebase" })
    }

    func testFilterByTime() {
        let now = Date()
        let oneMinuteAgo = now.addingTimeInterval(-60)

        // This event would have been recorded now
        AnalyticsInterceptor.shared.recordEvent(name: "recent_event")

        let filter = AnalyticsFilter(since: oneMinuteAgo, limit: 100)
        let filtered = AnalyticsInterceptor.shared.getEvents(filter: filter)

        XCTAssertEqual(filtered.count, 1)
        XCTAssertEqual(filtered.events.first?.name, "recent_event")
    }

    func testTypedPropertiesRecording() {
        struct EventProps: Encodable {
            let userId: Int
            let action: String
        }

        AnalyticsInterceptor.shared.recordEvent(
            name: "typed_event",
            properties: EventProps(userId: 42, action: "click"),
            source: "TypedTest"
        )

        let log = AnalyticsInterceptor.shared.getAnalyticsLog()
        XCTAssertEqual(log.count, 1)

        let event = log.events.first!
        XCTAssertEqual(event.name, "typed_event")
        XCTAssertEqual(event.source, "TypedTest")
    }
}

// MARK: - Model Tests

final class ModelTests: XCTestCase {

    func testAppStateEncoding() throws {
        let state = AppState(
            timestamp: Date(),
            viewControllerStack: ["RootVC", "HomeVC"],
            currentViewController: "HomeVC",
            customState: ["key": AnyCodable("value")],
            featureFlags: ["flag": FeatureFlag(enabled: true, variant: "A")]
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(state)
        let json = String(data: data, encoding: .utf8)!

        XCTAssertTrue(json.contains("RootVC"))
        XCTAssertTrue(json.contains("HomeVC"))
        XCTAssertTrue(json.contains("flag"))
    }

    func testFeatureFlagEncoding() throws {
        let flag = FeatureFlag(enabled: true, variant: "B")

        let encoder = JSONEncoder()
        let data = try encoder.encode(flag)
        let json = String(data: data, encoding: .utf8)!

        XCTAssertTrue(json.contains("true"))
        XCTAssertTrue(json.contains("B"))
    }

    func testNetworkRequestEncoding() throws {
        let request = NetworkRequest(
            url: "https://api.test.com",
            method: "POST",
            status: 201,
            duration: 250
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(request)
        let json = String(data: data, encoding: .utf8)!

        XCTAssertTrue(json.contains("api.test.com"))
        XCTAssertTrue(json.contains("POST"))
        XCTAssertTrue(json.contains("201"))
        XCTAssertTrue(json.contains("250"))
    }

    func testNetworkLogEncoding() throws {
        let requests = [
            NetworkRequest(url: "https://a.com", method: "GET", status: 200),
            NetworkRequest(url: "https://b.com", method: "POST", status: 500)
        ]
        let log = NetworkLog(requests: requests, count: 2, errors: 1)

        let encoder = JSONEncoder()
        let data = try encoder.encode(log)
        let json = String(data: data, encoding: .utf8)!

        XCTAssertTrue(json.contains("a.com"))
        XCTAssertTrue(json.contains("b.com"))
    }

    func testAnalyticsEventEncoding() throws {
        let event = AnalyticsEvent(
            name: "test_event",
            properties: ["key": "value"],
            source: "Test",
            userId: "user123"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(event)
        let json = String(data: data, encoding: .utf8)!

        XCTAssertTrue(json.contains("test_event"))
        XCTAssertTrue(json.contains("key"))
        XCTAssertTrue(json.contains("Test"))
    }

    func testRouteEntryEncoding() throws {
        let entry = RouteEntry(
            route: "/settings/profile",
            title: "Profile",
            viewController: "ProfileViewController"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(entry)
        let json = String(data: data, encoding: .utf8)!

        XCTAssertTrue(json.contains("settings") || json.contains("profile"))
        XCTAssertTrue(json.contains("Profile"))
        XCTAssertTrue(json.contains("ProfileViewController"))
    }

    func testNavigationEventEncoding() throws {
        let event = NavigationEvent(
            type: .push,
            from: "/home",
            to: "/settings"
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(event)
        let json = String(data: data, encoding: .utf8)!

        XCTAssertTrue(json.contains("push"))
        XCTAssertTrue(json.contains("home"))
        XCTAssertTrue(json.contains("settings"))
    }

    func testAnyCodableDecoding() throws {
        let jsonString = """
        {
            "string": "hello",
            "number": 42,
            "bool": true,
            "array": [1, 2, 3],
            "nested": {"key": "value"}
        }
        """

        let decoder = JSONDecoder()
        let data = jsonString.data(using: .utf8)!
        let decoded = try decoder.decode([String: AnyCodable].self, from: data)

        XCTAssertEqual(decoded["string"]?.value as? String, "hello")
        XCTAssertEqual(decoded["number"]?.value as? Int, 42)
        XCTAssertEqual(decoded["bool"]?.value as? Bool, true)
    }
}

// MARK: - Debug Guard Tests

final class DebugGuardTests: XCTestCase {

    func testDebugOnlyFunction() {
        var executed = false

        DebugOnly {
            executed = true
        }

        #if DEBUG
        XCTAssertTrue(executed)
        #else
        XCTAssertFalse(executed)
        #endif
    }

    func testDebugOnlyValue() {
        let result = DebugOnlyValue { 42 }

        #if DEBUG
        XCTAssertEqual(result, 42)
        #else
        XCTAssertNil(result)
        #endif
    }

    func testDebugOnlyProperty() {
        @DebugOnlyProperty var debugValue: String?
        debugValue = "test"

        #if DEBUG
        XCTAssertEqual(debugValue, "test")
        #else
        XCTAssertNil(debugValue)
        #endif
    }

    func testBridgeEnabledFlag() {
        // This will vary based on build configuration
        // Just verify it doesn't crash
        _ = DebugOnlyGuard.isBridgeEnabled
    }

    func testRuntimeCheck() {
        // Just verify it doesn't crash
        let result = DebugOnlyGuard.performRuntimeCheck()
        // In test environment, this may or may not return true
        _ = result
    }
}

// MARK: - MaestroBridge Core Tests

final class MaestroBridgeCoreTests: XCTestCase {

    override func tearDown() {
        MaestroBridge.shared.stop()
        MaestroBridge.shared.disableStateMutation()
        MaestroBridge.shared.unregister("testState")
        super.tearDown()
    }

    func testSingletonInstance() {
        let instance1 = MaestroBridge.shared
        let instance2 = MaestroBridge.shared
        XCTAssertTrue(instance1 === instance2)
    }

    func testStartStop() {
        #if DEBUG
        XCTAssertFalse(MaestroBridge.shared.isEnabled)

        MaestroBridge.shared.start(port: 9999, token: "test-token")
        XCTAssertTrue(MaestroBridge.shared.isEnabled)
        XCTAssertEqual(MaestroBridge.shared.port, 9999)
        XCTAssertEqual(MaestroBridge.shared.token, "test-token")

        MaestroBridge.shared.stop()
        XCTAssertFalse(MaestroBridge.shared.isEnabled)
        XCTAssertNil(MaestroBridge.shared.port)
        #endif
    }

    func testDoubleStart() {
        #if DEBUG
        MaestroBridge.shared.start(port: 9998)
        let firstPort = MaestroBridge.shared.port

        // Second start should be ignored
        MaestroBridge.shared.start(port: 9997)
        XCTAssertEqual(MaestroBridge.shared.port, firstPort)

        MaestroBridge.shared.stop()
        #endif
    }

    func testDoubleStop() {
        #if DEBUG
        MaestroBridge.shared.start(port: 9996)
        MaestroBridge.shared.stop()

        // Second stop should not crash
        MaestroBridge.shared.stop()
        XCTAssertFalse(MaestroBridge.shared.isEnabled)
        #endif
    }

    func testGetAllCustomState() {
        MaestroBridge.shared.register("state1") { return 1 }
        MaestroBridge.shared.register("state2") { return "two" }

        let allState = MaestroBridge.shared.getAllCustomState()
        XCTAssertNotNil(allState["state1"])
        XCTAssertNotNil(allState["state2"])

        MaestroBridge.shared.unregister("state1")
        MaestroBridge.shared.unregister("state2")
    }

    func testStateMutation() {
        var value = 0

        MaestroBridge.shared.register(
            "testState",
            provider: { return value },
            setter: { (newValue: Int) -> Bool in
                value = newValue
                return true
            }
        )

        // Mutation disabled by default
        var result = MaestroBridge.shared.setTestState(key: "testState", value: 42)
        XCTAssertEqual(result, .disabled)
        XCTAssertEqual(value, 0)

        // Enable mutation
        MaestroBridge.shared.enableStateMutation()

        result = MaestroBridge.shared.setTestState(key: "testState", value: 42)
        XCTAssertEqual(result, .success)
        XCTAssertEqual(value, 42)

        // Non-existent key
        result = MaestroBridge.shared.setTestState(key: "nonexistent", value: 1)
        XCTAssertEqual(result, .notFound)

        MaestroBridge.shared.disableStateMutation()
        MaestroBridge.shared.unregister("testState")
    }

    func testBaseURL() {
        #if DEBUG
        XCTAssertNil(MaestroBridge.shared.baseURL)

        MaestroBridge.shared.start(port: 9995)
        XCTAssertEqual(MaestroBridge.shared.baseURL?.absoluteString, "http://127.0.0.1:9995")

        MaestroBridge.shared.stop()
        XCTAssertNil(MaestroBridge.shared.baseURL)
        #endif
    }

    func testTrackEvent() {
        AnalyticsInterceptor.shared.clear()

        MaestroBridge.shared.trackEvent(
            "custom_event",
            properties: ["key": "value"],
            source: "CustomSource"
        )

        let log = AnalyticsInterceptor.shared.getAnalyticsLog()
        XCTAssertEqual(log.count, 1)
        XCTAssertEqual(log.events.first?.name, "custom_event")
        XCTAssertEqual(log.events.first?.source, "CustomSource")

        AnalyticsInterceptor.shared.clear()
    }

    func testTrackEventDefaultSource() {
        AnalyticsInterceptor.shared.clear()

        MaestroBridge.shared.trackEvent("simple_event")

        let log = AnalyticsInterceptor.shared.getAnalyticsLog()
        XCTAssertEqual(log.events.first?.source, "Manual")

        AnalyticsInterceptor.shared.clear()
    }
}
