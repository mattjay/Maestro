// MaestroBridgeTests.swift
// MaestroBridge
//
// Unit tests for MaestroBridge package.

import XCTest
@testable import MaestroBridge

final class MaestroBridgeTests: XCTestCase {

    override func tearDown() {
        MaestroBridge.shared.stop()
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
