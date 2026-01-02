// NetworkEndpoint.swift
// MaestroBridge
//
// Endpoint for network request introspection.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Handler for network-related endpoints
public struct NetworkEndpoint {
    public init() {}

    /// Handle GET /network - recent network requests
    public func handleGetNetwork(limit: Int? = nil, errorsOnly: Bool = false) -> BridgeResponse {
        var log = NetworkInterceptor.shared.getNetworkLog()

        // Filter to errors only if requested
        if errorsOnly {
            let errorRequests = log.requests.filter {
                $0.error != nil || ($0.status ?? 0) >= 400
            }
            log = NetworkLog(
                requests: errorRequests,
                count: errorRequests.count,
                errors: errorRequests.count
            )
        }

        // Apply limit if specified
        if let limit = limit, log.requests.count > limit {
            let limited = Array(log.requests.suffix(limit))
            log = NetworkLog(
                requests: limited,
                count: log.count,
                errors: log.errors
            )
        }

        return .json(log)
    }

    /// Handle GET /network/{id} - specific request details
    public func handleGetNetworkDetail(id: String) -> BridgeResponse {
        if let detail = NetworkInterceptor.shared.getRequestDetail(id: id) {
            return .json(detail)
        }

        // Try to find the request without details
        let requests = NetworkInterceptor.shared.getRequests()
        if let request = requests.first(where: { $0.id == id }) {
            return .json(NetworkRequestDetail(request: request))
        }

        return .error(code: 404, message: "Request '\(id)' not found")
    }

    /// Handle DELETE /network - clear network log
    public func handleClearNetwork() -> BridgeResponse {
        NetworkInterceptor.shared.clear()
        return .json(["message": "Network log cleared"])
    }
}
