// NetworkRequest.swift
// MaestroBridge
//
// Debug-only introspection models for network requests.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Network log containing recent requests
public struct NetworkLog: Codable, Sendable {
    /// List of recent network requests
    public let requests: [NetworkRequest]

    /// Total count of captured requests
    public let count: Int

    /// Number of requests with errors
    public let errors: Int

    public init(requests: [NetworkRequest], count: Int, errors: Int) {
        self.requests = requests
        self.count = count
        self.errors = errors
    }
}

/// Single network request with metadata
public struct NetworkRequest: Codable, Sendable {
    /// Unique identifier for this request
    public let id: String

    /// Request URL
    public let url: String

    /// HTTP method (GET, POST, etc.)
    public let method: String

    /// HTTP status code (nil if request failed)
    public let status: Int?

    /// Request duration in milliseconds
    public let duration: Int?

    /// When the request was initiated
    public let timestamp: Date

    /// Request headers (sensitive values redacted)
    public let requestHeaders: [String: String]

    /// Response headers
    public let responseHeaders: [String: String]?

    /// Response body size in bytes
    public let responseSize: Int?

    /// Error message if request failed
    public let error: String?

    /// Whether request is still in flight
    public let inProgress: Bool

    public init(
        id: String = UUID().uuidString,
        url: String,
        method: String,
        status: Int? = nil,
        duration: Int? = nil,
        timestamp: Date = Date(),
        requestHeaders: [String: String] = [:],
        responseHeaders: [String: String]? = nil,
        responseSize: Int? = nil,
        error: String? = nil,
        inProgress: Bool = false
    ) {
        self.id = id
        self.url = url
        self.method = method
        self.status = status
        self.duration = duration
        self.timestamp = timestamp
        self.requestHeaders = requestHeaders
        self.responseHeaders = responseHeaders
        self.responseSize = responseSize
        self.error = error
        self.inProgress = inProgress
    }
}

/// Detailed network request for specific request inspection
public struct NetworkRequestDetail: Codable, Sendable {
    /// Base request info
    public let request: NetworkRequest

    /// Request body (if captured and not too large)
    public let requestBody: String?

    /// Response body (if captured and not too large)
    public let responseBody: String?

    /// Content type of request
    public let requestContentType: String?

    /// Content type of response
    public let responseContentType: String?

    public init(
        request: NetworkRequest,
        requestBody: String? = nil,
        responseBody: String? = nil,
        requestContentType: String? = nil,
        responseContentType: String? = nil
    ) {
        self.request = request
        self.requestBody = requestBody
        self.responseBody = responseBody
        self.requestContentType = requestContentType
        self.responseContentType = responseContentType
    }
}
