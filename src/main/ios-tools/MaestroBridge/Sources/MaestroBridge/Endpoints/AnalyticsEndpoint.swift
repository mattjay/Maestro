// AnalyticsEndpoint.swift
// MaestroBridge
//
// Endpoint for analytics event introspection.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Handler for analytics-related endpoints
public struct AnalyticsEndpoint {
    public init() {}

    /// Handle GET /analytics - recent analytics events
    public func handleGetAnalytics(filter: String? = nil, limit: Int? = nil) -> BridgeResponse {
        let analyticsFilter = AnalyticsFilter(
            namePattern: filter,
            since: nil,
            source: nil,
            limit: limit ?? 100
        )

        let log = AnalyticsInterceptor.shared.getEvents(filter: analyticsFilter)
        return .json(log)
    }

    /// Handle GET /analytics/sources - list registered sources
    public func handleGetSources() -> BridgeResponse {
        let sources = AnalyticsInterceptor.shared.registeredSources()
        return .json(["sources": sources])
    }

    /// Handle DELETE /analytics - clear analytics log
    public func handleClearAnalytics() -> BridgeResponse {
        AnalyticsInterceptor.shared.clear()
        return .json(["message": "Analytics log cleared"])
    }
}
