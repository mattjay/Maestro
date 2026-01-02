// RouteInfo.swift
// MaestroBridge
//
// Debug-only introspection models for navigation state.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Navigation state information
public struct RouteInfo: Codable, Sendable {
    /// Current route path (e.g., "/settings/profile")
    public let currentRoute: String

    /// Navigation stack with full history
    public let stack: [RouteEntry]

    /// Whether the user can navigate back
    public let canGoBack: Bool

    /// Whether current view is presented modally
    public let presentedModally: Bool

    public init(
        currentRoute: String,
        stack: [RouteEntry] = [],
        canGoBack: Bool = false,
        presentedModally: Bool = false
    ) {
        self.currentRoute = currentRoute
        self.stack = stack
        self.canGoBack = canGoBack
        self.presentedModally = presentedModally
    }
}

/// Single entry in navigation stack
public struct RouteEntry: Codable, Sendable {
    /// Route path
    public let route: String

    /// Display title
    public let title: String?

    /// View controller class name
    public let viewController: String?

    /// Timestamp when route was pushed
    public let timestamp: Date?

    public init(
        route: String,
        title: String? = nil,
        viewController: String? = nil,
        timestamp: Date? = nil
    ) {
        self.route = route
        self.title = title
        self.viewController = viewController
        self.timestamp = timestamp
    }
}

/// Navigation history for debugging
public struct NavigationHistory: Codable, Sendable {
    /// All navigation events
    public let events: [NavigationEvent]

    /// Total count of navigation events
    public let count: Int

    public init(events: [NavigationEvent]) {
        self.events = events
        self.count = events.count
    }
}

/// Single navigation event
public struct NavigationEvent: Codable, Sendable {
    /// Type of navigation action
    public let type: NavigationType

    /// Route navigated from
    public let from: String?

    /// Route navigated to
    public let to: String

    /// When the navigation occurred
    public let timestamp: Date

    public init(
        type: NavigationType,
        from: String? = nil,
        to: String,
        timestamp: Date = Date()
    ) {
        self.type = type
        self.from = from
        self.to = to
        self.timestamp = timestamp
    }
}

/// Type of navigation action
public enum NavigationType: String, Codable, Sendable {
    case push
    case pop
    case present
    case dismiss
    case replace
    case setRoot
}
