// FeatureFlagsEndpoint.swift
// MaestroBridge
//
// Endpoint for feature flags introspection.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Response for all feature flags
struct AllFlagsResponse: Codable {
    let flags: [String: FeatureFlag]
}

/// Response for specific feature flag
struct SingleFlagResponse: Codable {
    let name: String
    let enabled: Bool
    let variant: String?
}

/// Handler for feature flags endpoints
public struct FeatureFlagsEndpoint {
    /// Reference to the bridge for accessing feature flags
    weak var bridge: MaestroBridge?

    public init(bridge: MaestroBridge?) {
        self.bridge = bridge
    }

    /// Handle GET /flags - all feature flags
    public func handleGetFlags() -> BridgeResponse {
        guard let bridge = bridge else {
            return .error(code: 500, message: "Bridge not available")
        }

        let flags = bridge.getAllFeatureFlags()
        return .json(AllFlagsResponse(flags: flags))
    }

    /// Handle GET /flags/{name} - specific flag
    public func handleGetFlag(name: String) -> BridgeResponse {
        guard let bridge = bridge else {
            return .error(code: 500, message: "Bridge not available")
        }

        let flags = bridge.getAllFeatureFlags()
        if let flag = flags[name] {
            return .json(SingleFlagResponse(
                name: name,
                enabled: flag.enabled,
                variant: flag.variant
            ))
        }

        return .error(code: 404, message: "Feature flag '\(name)' not found")
    }
}
