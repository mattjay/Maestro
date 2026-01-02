// SetStateEndpoint.swift
// MaestroBridge
//
// Endpoint for test state injection (DANGEROUS).
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Response for successful state mutation
struct SetStateResponse: Codable {
    let message: String
    let key: String
    let value: AnyCodable
}

/// Handler for state mutation endpoints
/// WARNING: This endpoint can modify app state and should be used with extreme caution
public struct SetStateEndpoint {
    /// Reference to the bridge for accessing state handlers
    weak var bridge: MaestroBridge?

    /// Whether state mutation is enabled (off by default)
    private let isMutationEnabled: Bool

    /// Additional token required for mutation (defense in depth)
    private let mutationToken: String?

    public init(
        bridge: MaestroBridge?,
        enabled: Bool = false,
        mutationToken: String? = nil
    ) {
        self.bridge = bridge
        self.isMutationEnabled = enabled
        self.mutationToken = mutationToken
    }

    /// Handle POST /state/set - inject test state
    public func handleSetState(
        key: String,
        value: Any,
        providedToken: String?
    ) -> BridgeResponse {
        // Check if mutation is enabled
        guard isMutationEnabled else {
            return .error(
                code: 403,
                message: "State mutation is disabled. Enable with MaestroBridge.enableStateMutation()"
            )
        }

        // Verify mutation token if required
        if let required = mutationToken {
            guard let provided = providedToken, provided == required else {
                return .error(
                    code: 401,
                    message: "Invalid mutation token"
                )
            }
        }

        guard let bridge = bridge else {
            return .error(code: 500, message: "Bridge not available")
        }

        // Attempt to set the state
        let result = bridge.setTestState(key: key, value: value)

        switch result {
        case .success:
            return .json(SetStateResponse(message: "State updated", key: key, value: AnyCodable(value)))
        case .notFound:
            return .error(code: 404, message: "State key '\(key)' not found or not settable")
        case .invalidValue:
            return .error(code: 400, message: "Invalid value for key '\(key)'")
        case .disabled:
            return .error(code: 403, message: "Setting state for key '\(key)' is disabled")
        }
    }
}

/// Result of attempting to set state
public enum SetStateResult {
    case success
    case notFound
    case invalidValue
    case disabled
}

/// Request body for set state endpoint
public struct SetStateRequest: Codable {
    public let key: String
    public let value: AnyCodable
    public let token: String?

    public init(key: String, value: Any, token: String? = nil) {
        self.key = key
        self.value = AnyCodable(value)
        self.token = token
    }
}
