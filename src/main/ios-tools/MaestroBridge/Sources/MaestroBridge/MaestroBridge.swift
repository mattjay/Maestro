// MaestroBridge.swift
// MaestroBridge
//
// Main entry point for app introspection bridge.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// MaestroBridge provides debug-time "X-ray vision" into app internals.
///
/// Features:
/// - View/controller stack introspection
/// - Feature flags inspection
/// - Network request logging
/// - Analytics event capture
/// - Optional test state injection
///
/// Usage:
/// ```swift
/// #if DEBUG
/// import MaestroBridge
///
/// // In AppDelegate or App init:
/// MaestroBridge.shared.start(token: "debug-token-123")
///
/// // Register custom state providers:
/// MaestroBridge.shared.register("cart") {
///     return CartManager.shared.cartState
/// }
///
/// // Register feature flags:
/// MaestroBridge.shared.registerFeatureFlag("newCheckout", enabled: true)
/// #endif
/// ```
///
/// - Warning: This is a debug-only feature. Never include in production builds.
public final class MaestroBridge: @unchecked Sendable {
    /// Shared singleton instance
    public static let shared = MaestroBridge()

    /// The HTTP server instance
    private var server: BridgeServer?

    /// Whether the bridge is currently enabled
    public private(set) var isEnabled = false

    /// Lock for thread-safe access
    private let lock = NSLock()

    /// Custom state providers registered by the app
    private var stateProviders: [String: () -> Any] = [:]

    /// Feature flag values
    private var featureFlags: [String: FeatureFlag] = [:]

    /// State setters for test injection (keyed by state path)
    private var stateSetters: [String: (Any) -> Bool] = [:]

    /// Whether state mutation is enabled
    private var stateMutationEnabled = false

    /// Mutation token for additional security
    private var mutationToken: String?

    private init() {}

    // MARK: - Lifecycle

    /// Enable and start the bridge server.
    ///
    /// - Parameters:
    ///   - port: Port to listen on (default: 9876)
    ///   - token: Authentication token (generated if nil)
    ///
    /// - Note: Only works in DEBUG builds. In release, this is a no-op.
    public func start(port: UInt16 = 9876, token: String? = nil) {
        #if DEBUG
        lock.lock()
        defer { lock.unlock() }

        guard !isEnabled else {
            print("⚠️ MaestroBridge: Already running")
            return
        }

        // Ensure we're in debug
        DebugOnlyGuard.assertDebugBuild()

        // Create and start server
        server = BridgeServer(port: port, token: token, bridge: self)
        server?.start()

        // Enable network interception
        NetworkInterceptor.shared.enable()

        isEnabled = true

        print("✅ MaestroBridge: Started on port \(port)")
        #else
        print("⚠️ MaestroBridge: Disabled in release builds")
        #endif
    }

    /// Stop the bridge server.
    public func stop() {
        lock.lock()
        defer { lock.unlock() }

        guard isEnabled else { return }

        server?.stop()
        server = nil

        NetworkInterceptor.shared.disable()

        isEnabled = false

        print("🛑 MaestroBridge: Stopped")
    }

    /// Get the current server port (nil if not running)
    public var port: UInt16? {
        server?.port
    }

    /// Get the current authentication token (nil if not running)
    public var token: String? {
        server?.token
    }

    // MARK: - Custom State Registration

    /// Register a custom state provider.
    ///
    /// - Parameters:
    ///   - key: Unique key for this state (e.g., "user", "cart")
    ///   - provider: Closure that returns the current state value
    ///
    /// Example:
    /// ```swift
    /// MaestroBridge.shared.register("cart") {
    ///     return CartManager.shared.cartState
    /// }
    /// ```
    public func register<T: Encodable>(
        _ key: String,
        provider: @escaping () -> T
    ) {
        lock.lock()
        stateProviders[key] = { provider() }
        lock.unlock()
    }

    /// Register a custom state provider with setter for test injection.
    ///
    /// - Parameters:
    ///   - key: Unique key for this state
    ///   - provider: Closure that returns the current state value
    ///   - setter: Closure that accepts a new value (returns true if successful)
    public func register<T: Encodable>(
        _ key: String,
        provider: @escaping () -> T,
        setter: @escaping (T) -> Bool
    ) {
        lock.lock()
        stateProviders[key] = { provider() }
        stateSetters[key] = { value in
            guard let typedValue = value as? T else { return false }
            return setter(typedValue)
        }
        lock.unlock()
    }

    /// Unregister a state provider.
    public func unregister(_ key: String) {
        lock.lock()
        stateProviders.removeValue(forKey: key)
        stateSetters.removeValue(forKey: key)
        lock.unlock()
    }

    /// Get all registered custom state.
    func getAllCustomState() -> [String: AnyCodable] {
        lock.lock()
        let providers = stateProviders
        lock.unlock()

        var result: [String: AnyCodable] = [:]
        for (key, provider) in providers {
            result[key] = AnyCodable(provider())
        }
        return result
    }

    /// Get a specific custom state value.
    func getCustomState(key: String) -> AnyCodable? {
        lock.lock()
        let provider = stateProviders[key]
        lock.unlock()

        guard let provider = provider else { return nil }
        return AnyCodable(provider())
    }

    // MARK: - Feature Flags

    /// Register a feature flag.
    ///
    /// - Parameters:
    ///   - name: Flag name
    ///   - enabled: Whether the flag is enabled
    ///   - variant: Optional variant string
    public func registerFeatureFlag(
        _ name: String,
        enabled: Bool,
        variant: String? = nil
    ) {
        lock.lock()
        featureFlags[name] = FeatureFlag(enabled: enabled, variant: variant)
        lock.unlock()
    }

    /// Register a feature flag provider for dynamic flags.
    ///
    /// - Parameters:
    ///   - name: Flag name
    ///   - provider: Closure that returns the current flag state
    public func registerFeatureFlagProvider(
        _ name: String,
        provider: @escaping () -> FeatureFlag
    ) {
        // Store as state provider for dynamic evaluation
        lock.lock()
        stateProviders["__flag__\(name)"] = provider
        lock.unlock()
    }

    /// Get all feature flags.
    func getAllFeatureFlags() -> [String: FeatureFlag] {
        lock.lock()
        let flags = featureFlags
        lock.unlock()
        return flags
    }

    // MARK: - State Mutation (Test Injection)

    /// Enable state mutation for testing.
    ///
    /// - Parameter token: Optional additional token for mutation requests
    ///
    /// - Warning: Only enable this in debug/test builds!
    public func enableStateMutation(token: String? = nil) {
        #if DEBUG
        lock.lock()
        stateMutationEnabled = true
        mutationToken = token
        lock.unlock()
        print("⚠️ MaestroBridge: State mutation enabled")
        #endif
    }

    /// Disable state mutation.
    public func disableStateMutation() {
        lock.lock()
        stateMutationEnabled = false
        mutationToken = nil
        lock.unlock()
    }

    /// Set test state (called by SetStateEndpoint).
    func setTestState(key: String, value: Any) -> SetStateResult {
        lock.lock()
        let setter = stateSetters[key]
        let enabled = stateMutationEnabled
        lock.unlock()

        guard enabled else { return .disabled }
        guard let setter = setter else { return .notFound }

        return setter(value) ? .success : .invalidValue
    }

    // MARK: - Convenience Methods

    /// Record an analytics event manually.
    public func trackEvent(
        _ name: String,
        properties: [String: Any] = [:],
        source: String? = nil
    ) {
        AnalyticsInterceptor.shared.recordEvent(
            name: name,
            properties: properties,
            source: source ?? "Manual"
        )
    }

    /// Record a navigation event manually.
    public func trackNavigation(
        type: NavigationType,
        from: String?,
        to: String
    ) {
        // This would need endpoint access, simplified for now
        print("📍 Navigation: \(type.rawValue) \(from ?? "?") → \(to)")
    }

    /// Get the base URL for the bridge server.
    public var baseURL: URL? {
        guard let port = port else { return nil }
        return URL(string: "http://127.0.0.1:\(port)")
    }
}

// MARK: - SwiftUI Integration

#if canImport(SwiftUI)
import SwiftUI

@available(iOS 14.0, macOS 11.0, *)
public extension View {
    /// Start MaestroBridge when this view appears (debug only).
    func withMaestroBridge(port: UInt16 = 9876, token: String? = nil) -> some View {
        self.onAppear {
            #if DEBUG
            MaestroBridge.shared.start(port: port, token: token)
            #endif
        }
    }
}
#endif

// MARK: - UIKit Integration

#if canImport(UIKit) && !os(watchOS)
import UIKit

public extension MaestroBridge {
    /// Configure and start bridge from AppDelegate.
    ///
    /// Call this in `application(_:didFinishLaunchingWithOptions:)`:
    /// ```swift
    /// #if DEBUG
    /// MaestroBridge.shared.configure(
    ///     port: 9876,
    ///     token: "my-debug-token"
    /// )
    /// #endif
    /// ```
    func configure(port: UInt16 = 9876, token: String? = nil) {
        start(port: port, token: token)
    }
}
#endif
