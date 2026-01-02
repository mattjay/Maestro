// AnalyticsInterceptor.swift
// MaestroBridge
//
// Intercepts and logs analytics events for debugging.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Intercepts and records analytics events for debugging
public final class AnalyticsInterceptor: @unchecked Sendable {
    /// Shared instance
    public static let shared = AnalyticsInterceptor()

    /// Maximum number of events to keep in memory
    public var maxEvents: Int = 500

    /// Lock for thread-safe access
    private let lock = NSLock()

    /// Stored events
    private var _events: [AnalyticsEvent] = []

    /// Event handlers for different analytics SDKs
    private var _handlers: [String: (String, [String: Any]) -> Void] = [:]

    private init() {}

    // MARK: - Public API

    /// Get all captured events
    public func getEvents() -> [AnalyticsEvent] {
        lock.lock()
        defer { lock.unlock() }
        return _events
    }

    /// Get analytics log summary
    public func getAnalyticsLog() -> AnalyticsLog {
        lock.lock()
        defer { lock.unlock() }

        return AnalyticsLog(
            events: _events,
            count: _events.count
        )
    }

    /// Get filtered events
    public func getEvents(filter: AnalyticsFilter) -> AnalyticsLog {
        lock.lock()
        defer { lock.unlock() }

        var filtered = _events

        // Filter by name pattern
        if let pattern = filter.namePattern, !pattern.isEmpty {
            filtered = filtered.filter {
                $0.name.localizedCaseInsensitiveContains(pattern)
            }
        }

        // Filter by source
        if let source = filter.source {
            filtered = filtered.filter { $0.source == source }
        }

        // Filter by time
        if let since = filter.since {
            filtered = filtered.filter { $0.timestamp >= since }
        }

        // Apply limit
        if filtered.count > filter.limit {
            filtered = Array(filtered.suffix(filter.limit))
        }

        return AnalyticsLog(events: filtered, count: filtered.count)
    }

    /// Clear all captured events
    public func clear() {
        lock.lock()
        defer { lock.unlock() }
        _events.removeAll()
    }

    /// Record an analytics event manually
    /// Use this to hook into your analytics implementation
    public func recordEvent(
        name: String,
        properties: [String: Any] = [:],
        source: String? = nil,
        userId: String? = nil
    ) {
        let event = AnalyticsEvent(
            name: name,
            properties: properties,
            source: source,
            userId: userId
        )

        lock.lock()
        _events.append(event)

        // Trim old events if needed
        if _events.count > maxEvents {
            _events = Array(_events.suffix(maxEvents))
        }
        lock.unlock()
    }

    /// Record an event with typed properties
    public func recordEvent<T: Encodable>(
        name: String,
        properties: T,
        source: String? = nil,
        userId: String? = nil
    ) {
        // Convert Encodable to dictionary
        guard let data = try? JSONEncoder().encode(properties),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            // Fallback to recording without properties
            recordEvent(name: name, properties: [:], source: source, userId: userId)
            return
        }

        recordEvent(name: name, properties: dict, source: source, userId: userId)
    }

    // MARK: - SDK Integration Helpers

    /// Create a Firebase Analytics interceptor
    /// Call from your Firebase wrapper to capture events
    public func firebaseLogEvent(name: String, parameters: [String: Any]?) {
        recordEvent(
            name: name,
            properties: parameters ?? [:],
            source: "Firebase"
        )
    }

    /// Create an Amplitude interceptor
    /// Call from your Amplitude wrapper to capture events
    public func amplitudeLogEvent(eventType: String, eventProperties: [String: Any]?) {
        recordEvent(
            name: eventType,
            properties: eventProperties ?? [:],
            source: "Amplitude"
        )
    }

    /// Create a Mixpanel interceptor
    /// Call from your Mixpanel wrapper to capture events
    public func mixpanelTrack(event: String, properties: [String: Any]?) {
        recordEvent(
            name: event,
            properties: properties ?? [:],
            source: "Mixpanel"
        )
    }

    /// Create a Segment interceptor
    /// Call from your Segment wrapper to capture events
    public func segmentTrack(event: String, properties: [String: Any]?) {
        recordEvent(
            name: event,
            properties: properties ?? [:],
            source: "Segment"
        )
    }

    // MARK: - Custom SDK Support

    /// Register a custom analytics source
    /// - Parameters:
    ///   - name: Source name (e.g., "MyAnalytics")
    ///   - handler: Handler called when events should be sent to the actual SDK
    public func registerSource(
        name: String,
        handler: @escaping (String, [String: Any]) -> Void
    ) {
        lock.lock()
        _handlers[name] = handler
        lock.unlock()
    }

    /// Get list of registered sources
    public func registeredSources() -> [String] {
        lock.lock()
        defer { lock.unlock() }
        return Array(_handlers.keys)
    }
}

// MARK: - SwiftUI Integration

#if canImport(SwiftUI)
import SwiftUI

/// View modifier for automatic screen view tracking
@available(iOS 13.0, macOS 10.15, *)
public struct AnalyticsScreenViewModifier: ViewModifier {
    let screenName: String
    let properties: [String: Any]

    public func body(content: Content) -> some View {
        content.onAppear {
            AnalyticsInterceptor.shared.recordEvent(
                name: "screen_view",
                properties: ["screen_name": screenName].merging(properties) { $1 },
                source: "SwiftUI"
            )
        }
    }
}

@available(iOS 13.0, macOS 10.15, *)
public extension View {
    /// Track screen view when this view appears
    func trackScreenView(_ name: String, properties: [String: Any] = [:]) -> some View {
        modifier(AnalyticsScreenViewModifier(screenName: name, properties: properties))
    }
}
#endif
