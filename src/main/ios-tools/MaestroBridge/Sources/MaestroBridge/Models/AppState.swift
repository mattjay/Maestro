// AppState.swift
// MaestroBridge
//
// Debug-only introspection models for app state.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Full app state snapshot returned by the bridge
public struct AppState: Codable, Sendable {
    /// Timestamp of state capture
    public let timestamp: Date

    /// View controller stack (from root to current)
    public let viewControllerStack: [String]

    /// Current (topmost) view controller name
    public let currentViewController: String

    /// Custom state registered by the app
    public let customState: [String: AnyCodable]

    /// Feature flags state
    public let featureFlags: [String: FeatureFlag]

    public init(
        timestamp: Date = Date(),
        viewControllerStack: [String] = [],
        currentViewController: String = "",
        customState: [String: AnyCodable] = [:],
        featureFlags: [String: FeatureFlag] = [:]
    ) {
        self.timestamp = timestamp
        self.viewControllerStack = viewControllerStack
        self.currentViewController = currentViewController
        self.customState = customState
        self.featureFlags = featureFlags
    }
}

/// Feature flag with optional variant
public struct FeatureFlag: Codable, Sendable {
    public let enabled: Bool
    public let variant: String?

    public init(enabled: Bool, variant: String? = nil) {
        self.enabled = enabled
        self.variant = variant
    }
}

/// Type-erased Codable wrapper for dynamic JSON values
public struct AnyCodable: Codable, Sendable {
    public let value: Any

    public init(_ value: Any) {
        self.value = value
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dictionary = try? container.decode([String: AnyCodable].self) {
            value = dictionary.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unable to decode value"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            // Try to encode as string representation
            try container.encode(String(describing: value))
        }
    }
}
