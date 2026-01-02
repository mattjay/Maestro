// StateEndpoint.swift
// MaestroBridge
//
// Endpoint for app state introspection.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Response for specific state key
struct StateKeyResponse: Codable {
    let key: String
    let value: AnyCodable
}

/// Handler for state-related endpoints
public struct StateEndpoint {
    /// Reference to the bridge for accessing registered providers
    weak var bridge: MaestroBridge?

    public init(bridge: MaestroBridge?) {
        self.bridge = bridge
    }

    /// Handle GET /state - full app state snapshot
    public func handleGetState() -> BridgeResponse {
        guard let bridge = bridge else {
            return .error(code: 500, message: "Bridge not available")
        }

        let state = AppState(
            timestamp: Date(),
            viewControllerStack: ViewHierarchyCollector.shared.getViewControllerStack(),
            currentViewController: ViewHierarchyCollector.shared.getCurrentViewController(),
            customState: bridge.getAllCustomState(),
            featureFlags: bridge.getAllFeatureFlags()
        )

        return .json(state)
    }

    /// Handle GET /state/{key} - specific state key
    public func handleGetStateKey(key: String) -> BridgeResponse {
        guard let bridge = bridge else {
            return .error(code: 500, message: "Bridge not available")
        }

        if let value = bridge.getCustomState(key: key) {
            return .json(StateKeyResponse(key: key, value: value))
        }

        return .error(code: 404, message: "State key '\(key)' not found")
    }
}
