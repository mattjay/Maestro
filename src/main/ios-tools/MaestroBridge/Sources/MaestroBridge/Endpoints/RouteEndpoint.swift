// RouteEndpoint.swift
// MaestroBridge
//
// Endpoint for navigation state introspection.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Handler for route-related endpoints
public struct RouteEndpoint {
    /// Navigation history storage
    private var navigationHistory: [NavigationEvent] = []
    private let historyLock = NSLock()
    private let maxHistorySize = 100

    public init() {}

    /// Handle GET /route - current navigation state
    public func handleGetRoute() -> BridgeResponse {
        let routeInfo = ViewHierarchyCollector.shared.getCurrentRoute()
        return .json(routeInfo)
    }

    /// Handle GET /route/stack - full navigation stack
    public func handleGetStack() -> BridgeResponse {
        let routeInfo = ViewHierarchyCollector.shared.getCurrentRoute()
        return .json(["stack": routeInfo.stack])
    }

    /// Handle GET /route/history - navigation history
    public func handleGetHistory() -> BridgeResponse {
        historyLock.lock()
        let history = navigationHistory
        historyLock.unlock()

        return .json(NavigationHistory(events: history))
    }

    /// Record a navigation event (call from your navigation handling code)
    public mutating func recordNavigation(
        type: NavigationType,
        from: String?,
        to: String
    ) {
        let event = NavigationEvent(
            type: type,
            from: from,
            to: to,
            timestamp: Date()
        )

        historyLock.lock()
        navigationHistory.append(event)
        if navigationHistory.count > maxHistorySize {
            navigationHistory = Array(navigationHistory.suffix(maxHistorySize))
        }
        historyLock.unlock()
    }

    /// Clear navigation history
    public mutating func clearHistory() {
        historyLock.lock()
        navigationHistory.removeAll()
        historyLock.unlock()
    }
}
