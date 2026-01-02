// AnalyticsEvent.swift
// MaestroBridge
//
// Debug-only introspection models for analytics events.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Analytics log containing recent events
public struct AnalyticsLog: Codable, Sendable {
    /// List of recent analytics events
    public let events: [AnalyticsEvent]

    /// Total count of captured events
    public let count: Int

    public init(events: [AnalyticsEvent], count: Int) {
        self.events = events
        self.count = count
    }
}

/// Single analytics event
public struct AnalyticsEvent: Codable, Sendable {
    /// Unique identifier for this event
    public let id: String

    /// Event name (e.g., "button_tapped", "screen_view")
    public let name: String

    /// Event properties
    public let properties: [String: AnyCodable]

    /// When the event was recorded
    public let timestamp: Date

    /// Source of the event (e.g., "Firebase", "Amplitude", "Custom")
    public let source: String?

    /// User ID if available (should be anonymized in debug)
    public let userId: String?

    public init(
        id: String = UUID().uuidString,
        name: String,
        properties: [String: AnyCodable] = [:],
        timestamp: Date = Date(),
        source: String? = nil,
        userId: String? = nil
    ) {
        self.id = id
        self.name = name
        self.properties = properties
        self.timestamp = timestamp
        self.source = source
        self.userId = userId
    }

    /// Convenience initializer with dictionary properties
    public init(
        id: String = UUID().uuidString,
        name: String,
        properties: [String: Any],
        timestamp: Date = Date(),
        source: String? = nil,
        userId: String? = nil
    ) {
        self.id = id
        self.name = name
        self.properties = properties.mapValues { AnyCodable($0) }
        self.timestamp = timestamp
        self.source = source
        self.userId = userId
    }
}

/// Filter for querying analytics events
public struct AnalyticsFilter {
    /// Event name pattern to match
    public let namePattern: String?

    /// Only events after this time
    public let since: Date?

    /// Only events from this source
    public let source: String?

    /// Maximum number of events to return
    public let limit: Int

    public init(
        namePattern: String? = nil,
        since: Date? = nil,
        source: String? = nil,
        limit: Int = 100
    ) {
        self.namePattern = namePattern
        self.since = since
        self.source = source
        self.limit = limit
    }
}
