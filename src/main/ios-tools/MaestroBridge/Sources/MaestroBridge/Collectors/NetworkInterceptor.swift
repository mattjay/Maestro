// NetworkInterceptor.swift
// MaestroBridge
//
// Intercepts and logs network requests for debugging.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Intercepts URLSession network requests for debugging
public final class NetworkInterceptor: @unchecked Sendable {
    /// Shared instance
    public static let shared = NetworkInterceptor()

    /// Maximum number of requests to keep in memory
    public var maxRequests: Int = 100

    /// Headers to redact (case-insensitive)
    public var sensitiveHeaders: Set<String> = [
        "authorization",
        "x-api-key",
        "x-auth-token",
        "cookie",
        "set-cookie",
        "x-csrf-token"
    ]

    /// Lock for thread-safe access
    private let lock = NSLock()

    /// Stored requests
    private var _requests: [NetworkRequest] = []

    /// Detailed request data (keyed by request ID)
    private var _details: [String: NetworkRequestDetail] = [:]

    /// Whether interception is enabled
    private var _isEnabled = false

    private init() {}

    // MARK: - Public API

    /// Enable network interception
    public func enable() {
        lock.lock()
        defer { lock.unlock() }

        guard !_isEnabled else { return }
        _isEnabled = true

        #if DEBUG
        // Register our protocol class to intercept requests
        URLProtocol.registerClass(MaestroBridgeURLProtocol.self)
        #endif
    }

    /// Disable network interception
    public func disable() {
        lock.lock()
        defer { lock.unlock() }

        guard _isEnabled else { return }
        _isEnabled = false

        #if DEBUG
        URLProtocol.unregisterClass(MaestroBridgeURLProtocol.self)
        #endif
    }

    /// Get all captured requests
    public func getRequests() -> [NetworkRequest] {
        lock.lock()
        defer { lock.unlock() }
        return _requests
    }

    /// Get network log summary
    public func getNetworkLog() -> NetworkLog {
        lock.lock()
        defer { lock.unlock() }

        let errors = _requests.filter { $0.error != nil || ($0.status ?? 0) >= 400 }.count

        return NetworkLog(
            requests: _requests,
            count: _requests.count,
            errors: errors
        )
    }

    /// Get detailed information for a specific request
    public func getRequestDetail(id: String) -> NetworkRequestDetail? {
        lock.lock()
        defer { lock.unlock() }
        return _details[id]
    }

    /// Clear all captured requests
    public func clear() {
        lock.lock()
        defer { lock.unlock() }
        _requests.removeAll()
        _details.removeAll()
    }

    /// Manually record a request (for custom network layers)
    public func recordRequest(_ request: NetworkRequest, detail: NetworkRequestDetail? = nil) {
        lock.lock()
        defer { lock.unlock() }

        _requests.append(request)
        if let detail = detail {
            _details[request.id] = detail
        }

        // Trim old requests if needed
        if _requests.count > maxRequests {
            let toRemove = _requests.prefix(_requests.count - maxRequests)
            for req in toRemove {
                _details.removeValue(forKey: req.id)
            }
            _requests = Array(_requests.suffix(maxRequests))
        }
    }

    // MARK: - Internal

    /// Record start of a request (called by URLProtocol)
    func recordRequestStart(
        id: String,
        url: String,
        method: String,
        headers: [String: String]
    ) {
        let request = NetworkRequest(
            id: id,
            url: url,
            method: method,
            status: nil,
            duration: nil,
            timestamp: Date(),
            requestHeaders: redactHeaders(headers),
            responseHeaders: nil,
            responseSize: nil,
            error: nil,
            inProgress: true
        )
        recordRequest(request)
    }

    /// Record completion of a request
    func recordRequestComplete(
        id: String,
        status: Int,
        duration: Int,
        responseHeaders: [String: String],
        responseSize: Int,
        responseBody: String?
    ) {
        lock.lock()
        defer { lock.unlock() }

        if let index = _requests.firstIndex(where: { $0.id == id }) {
            let original = _requests[index]
            let updated = NetworkRequest(
                id: original.id,
                url: original.url,
                method: original.method,
                status: status,
                duration: duration,
                timestamp: original.timestamp,
                requestHeaders: original.requestHeaders,
                responseHeaders: redactHeaders(responseHeaders),
                responseSize: responseSize,
                error: nil,
                inProgress: false
            )
            _requests[index] = updated

            // Store detailed response if small enough
            if let body = responseBody, body.count < 10000 {
                _details[id] = NetworkRequestDetail(
                    request: updated,
                    requestBody: nil,
                    responseBody: body,
                    requestContentType: nil,
                    responseContentType: responseHeaders["Content-Type"]
                )
            }
        }
    }

    /// Record request failure
    func recordRequestError(id: String, error: String) {
        lock.lock()
        defer { lock.unlock() }

        if let index = _requests.firstIndex(where: { $0.id == id }) {
            let original = _requests[index]
            let updated = NetworkRequest(
                id: original.id,
                url: original.url,
                method: original.method,
                status: nil,
                duration: nil,
                timestamp: original.timestamp,
                requestHeaders: original.requestHeaders,
                responseHeaders: nil,
                responseSize: nil,
                error: error,
                inProgress: false
            )
            _requests[index] = updated
        }
    }

    // MARK: - Private

    private func redactHeaders(_ headers: [String: String]) -> [String: String] {
        var result = headers
        for key in headers.keys {
            if sensitiveHeaders.contains(key.lowercased()) {
                result[key] = "[REDACTED]"
            }
        }
        return result
    }
}

// MARK: - URLProtocol for Interception

#if DEBUG

/// Custom URLProtocol to intercept network requests
final class MaestroBridgeURLProtocol: URLProtocol {
    private static let handledKey = "MaestroBridgeURLProtocolHandled"
    private var requestId: String = ""
    private var startTime: Date = Date()
    private var session: URLSession?
    private var dataTask: URLSessionDataTask?
    private var receivedData = Data()

    override class func canInit(with request: URLRequest) -> Bool {
        // Don't intercept if already handled
        if URLProtocol.property(forKey: handledKey, in: request) != nil {
            return false
        }

        // Only intercept HTTP/HTTPS
        guard let scheme = request.url?.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }

    override func startLoading() {
        requestId = UUID().uuidString
        startTime = Date()

        // Mark as handled
        guard let mutableRequest = (request as NSURLRequest).mutableCopy() as? NSMutableURLRequest else {
            return
        }
        URLProtocol.setProperty(true, forKey: Self.handledKey, in: mutableRequest)

        // Record request start
        NetworkInterceptor.shared.recordRequestStart(
            id: requestId,
            url: request.url?.absoluteString ?? "",
            method: request.httpMethod ?? "GET",
            headers: request.allHTTPHeaderFields ?? [:]
        )

        // Create session and task
        let config = URLSessionConfiguration.default
        session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        dataTask = session?.dataTask(with: mutableRequest as URLRequest)
        dataTask?.resume()
    }

    override func stopLoading() {
        dataTask?.cancel()
        session?.invalidateAndCancel()
    }
}

extension MaestroBridgeURLProtocol: URLSessionDataDelegate {
    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        receivedData.append(data)
        client?.urlProtocol(self, didLoad: data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let duration = Int(Date().timeIntervalSince(startTime) * 1000)

        if let error = error {
            NetworkInterceptor.shared.recordRequestError(
                id: requestId,
                error: error.localizedDescription
            )
            client?.urlProtocol(self, didFailWithError: error)
        } else {
            let response = task.response as? HTTPURLResponse
            let headers = response?.allHeaderFields as? [String: String] ?? [:]

            NetworkInterceptor.shared.recordRequestComplete(
                id: requestId,
                status: response?.statusCode ?? 0,
                duration: duration,
                responseHeaders: headers,
                responseSize: receivedData.count,
                responseBody: String(data: receivedData.prefix(10000), encoding: .utf8)
            )
            client?.urlProtocolDidFinishLoading(self)
        }
    }
}

#endif
