// BridgeServer.swift
// MaestroBridge
//
// HTTP server for bridge communication.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Response type for bridge endpoints
public enum BridgeResponse {
    case json(_ value: Encodable)
    case text(_ value: String)
    case error(code: Int, message: String)

    /// Convert to HTTP response data
    func toHTTPResponse() -> (statusCode: Int, contentType: String, body: Data) {
        switch self {
        case .json(let value):
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            if let data = try? encoder.encode(AnyEncodable(value)) {
                return (200, "application/json", data)
            }
            return (500, "application/json", Data("{\"error\": \"Encoding failed\"}".utf8))

        case .text(let value):
            return (200, "text/plain", Data(value.utf8))

        case .error(let code, let message):
            let errorResponse = ["error": message, "code": code] as [String: Any]
            if let data = try? JSONSerialization.data(withJSONObject: errorResponse) {
                return (code, "application/json", data)
            }
            return (code, "text/plain", Data(message.utf8))
        }
    }
}

/// Type-erased Encodable wrapper
private struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void

    init<T: Encodable>(_ value: T) {
        encode = { encoder in
            try value.encode(to: encoder)
        }
    }

    func encode(to encoder: Encoder) throws {
        try encode(encoder)
    }
}

/// Simple HTTP server for localhost-only bridge communication
public final class BridgeServer: @unchecked Sendable {
    /// The port the server is listening on
    public let port: UInt16

    /// Authentication token
    private let tokenManager: BridgeToken

    /// Reference to the bridge
    private weak var bridge: MaestroBridge?

    /// Endpoints
    private var stateEndpoint: StateEndpoint!
    private var routeEndpoint: RouteEndpoint!
    private let networkEndpoint = NetworkEndpoint()
    private let analyticsEndpoint = AnalyticsEndpoint()
    private var featureFlagsEndpoint: FeatureFlagsEndpoint!
    private var setStateEndpoint: SetStateEndpoint!

    /// Server socket file descriptor
    private var serverSocket: Int32 = -1

    /// Whether the server is running
    private var isRunning = false

    /// Lock for thread-safe operations
    private let lock = NSLock()

    /// Dispatch queue for accepting connections
    private var acceptQueue: DispatchQueue?

    public init(port: UInt16, token: String? = nil, bridge: MaestroBridge? = nil) {
        self.port = port
        self.tokenManager = BridgeToken(token: token)
        self.bridge = bridge

        // Initialize endpoints
        self.stateEndpoint = StateEndpoint(bridge: bridge)
        self.routeEndpoint = RouteEndpoint()
        self.featureFlagsEndpoint = FeatureFlagsEndpoint(bridge: bridge)
        self.setStateEndpoint = SetStateEndpoint(bridge: bridge, enabled: false)

        // Generate token if not provided
        if token == nil {
            let generatedToken = tokenManager.generateToken()
            printServerInfo(generatedToken: generatedToken)
        }
    }

    /// Start the server
    public func start() {
        lock.lock()
        defer { lock.unlock() }

        guard !isRunning else {
            print("⚠️ MaestroBridge: Server already running")
            return
        }

        #if !DEBUG
        print("⚠️ MaestroBridge: Refusing to start in non-debug build")
        return
        #endif

        // Create socket
        serverSocket = socket(AF_INET, SOCK_STREAM, 0)
        guard serverSocket >= 0 else {
            print("❌ MaestroBridge: Failed to create socket")
            return
        }

        // Set socket options
        var yes: Int32 = 1
        setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))

        // Bind to localhost only
        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = port.bigEndian
        addr.sin_addr.s_addr = inet_addr("127.0.0.1") // Localhost only!

        let bindResult = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(serverSocket, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }

        guard bindResult >= 0 else {
            print("❌ MaestroBridge: Failed to bind to port \(port)")
            close(serverSocket)
            serverSocket = -1
            return
        }

        // Listen
        guard Darwin.listen(serverSocket, 5) >= 0 else {
            print("❌ MaestroBridge: Failed to listen on socket")
            close(serverSocket)
            serverSocket = -1
            return
        }

        isRunning = true
        print("✅ MaestroBridge: Server started on http://127.0.0.1:\(port)")

        // Accept connections in background
        acceptQueue = DispatchQueue(label: "com.maestro.bridge.accept", qos: .utility)
        acceptQueue?.async { [weak self] in
            self?.acceptLoop()
        }
    }

    /// Stop the server
    public func stop() {
        lock.lock()
        defer { lock.unlock() }

        guard isRunning else { return }

        isRunning = false
        if serverSocket >= 0 {
            close(serverSocket)
            serverSocket = -1
        }

        print("🛑 MaestroBridge: Server stopped")
    }

    /// Get the current authentication token
    public var token: String? {
        tokenManager.token
    }

    // MARK: - Private

    private func printServerInfo(generatedToken: String) {
        print("""
        ╔═══════════════════════════════════════════════════════════════╗
        ║                    MaestroBridge Started                      ║
        ╠═══════════════════════════════════════════════════════════════╣
        ║  URL:   http://127.0.0.1:\(String(port).padding(toLength: 5, withPad: " ", startingAt: 0))                                   ║
        ║  Token: \(generatedToken.prefix(40))... ║
        ╠═══════════════════════════════════════════════════════════════╣
        ║  Endpoints:                                                   ║
        ║    GET  /state       - App state snapshot                     ║
        ║    GET  /route       - Navigation state                       ║
        ║    GET  /network     - Network request log                    ║
        ║    GET  /analytics   - Analytics events                       ║
        ║    GET  /flags       - Feature flags                          ║
        ║    POST /state/set   - Set test state (if enabled)            ║
        ╚═══════════════════════════════════════════════════════════════╝
        """)
    }

    private func acceptLoop() {
        while isRunning {
            var clientAddr = sockaddr_in()
            var addrLen = socklen_t(MemoryLayout<sockaddr_in>.size)

            let clientSocket = withUnsafeMutablePointer(to: &clientAddr) {
                $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                    accept(serverSocket, $0, &addrLen)
                }
            }

            if clientSocket >= 0 {
                DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                    self?.handleConnection(clientSocket)
                }
            }
        }
    }

    private func handleConnection(_ socket: Int32) {
        defer { close(socket) }

        // Read request
        var buffer = [UInt8](repeating: 0, count: 8192)
        let bytesRead = read(socket, &buffer, buffer.count)

        guard bytesRead > 0 else { return }

        let requestData = Data(buffer[0..<bytesRead])
        guard let requestString = String(data: requestData, encoding: .utf8) else { return }

        // Parse HTTP request
        let lines = requestString.components(separatedBy: "\r\n")
        guard let firstLine = lines.first else { return }

        let parts = firstLine.split(separator: " ")
        guard parts.count >= 2 else { return }

        let method = String(parts[0])
        let path = String(parts[1])

        // Extract headers
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            if line.isEmpty { break }
            let headerParts = line.split(separator: ":", maxSplits: 1)
            if headerParts.count == 2 {
                headers[String(headerParts[0]).trimmingCharacters(in: .whitespaces)] =
                    String(headerParts[1]).trimmingCharacters(in: .whitespaces)
            }
        }

        // Validate token
        let authResult = tokenManager.validateAuthHeader(headers["Authorization"])
        if !authResult.isAuthorized {
            let response = BridgeResponse.error(
                code: 401,
                message: authResult == .missing ? "Authorization required" : "Invalid token"
            )
            sendResponse(response, to: socket)
            return
        }

        // Route request
        let response = routeRequest(method: method, path: path, headers: headers, body: extractBody(from: requestString))
        sendResponse(response, to: socket)
    }

    private func extractBody(from request: String) -> Data? {
        if let range = request.range(of: "\r\n\r\n") {
            let body = String(request[range.upperBound...])
            return body.data(using: .utf8)
        }
        return nil
    }

    private func routeRequest(method: String, path: String, headers: [String: String], body: Data?) -> BridgeResponse {
        // Parse path and query parameters
        let components = path.split(separator: "?", maxSplits: 1)
        let cleanPath = String(components[0])
        var queryParams: [String: String] = [:]

        if components.count > 1 {
            let queryString = String(components[1])
            for param in queryString.split(separator: "&") {
                let parts = param.split(separator: "=", maxSplits: 1)
                if parts.count == 2 {
                    queryParams[String(parts[0])] = String(parts[1])
                }
            }
        }

        // Route to appropriate endpoint
        switch (method, cleanPath) {
        // Ping
        case ("GET", "/ping"):
            return .json(["status": "ok", "timestamp": ISO8601DateFormatter().string(from: Date())])

        // State endpoints
        case ("GET", "/state"):
            return stateEndpoint.handleGetState()

        case ("GET", let p) where p.hasPrefix("/state/"):
            let key = String(p.dropFirst("/state/".count))
            return stateEndpoint.handleGetStateKey(key: key)

        // Route endpoints
        case ("GET", "/route"):
            return routeEndpoint.handleGetRoute()

        case ("GET", "/route/stack"):
            return routeEndpoint.handleGetStack()

        case ("GET", "/route/history"):
            return routeEndpoint.handleGetHistory()

        // Network endpoints
        case ("GET", "/network"):
            let limit = queryParams["limit"].flatMap { Int($0) }
            let errorsOnly = queryParams["errors"] == "true"
            return networkEndpoint.handleGetNetwork(limit: limit, errorsOnly: errorsOnly)

        case ("GET", let p) where p.hasPrefix("/network/"):
            let id = String(p.dropFirst("/network/".count))
            return networkEndpoint.handleGetNetworkDetail(id: id)

        case ("DELETE", "/network"):
            return networkEndpoint.handleClearNetwork()

        // Analytics endpoints
        case ("GET", "/analytics"):
            let filter = queryParams["filter"]
            let limit = queryParams["limit"].flatMap { Int($0) }
            return analyticsEndpoint.handleGetAnalytics(filter: filter, limit: limit)

        case ("GET", "/analytics/sources"):
            return analyticsEndpoint.handleGetSources()

        case ("DELETE", "/analytics"):
            return analyticsEndpoint.handleClearAnalytics()

        // Feature flags endpoints
        case ("GET", "/flags"):
            return featureFlagsEndpoint.handleGetFlags()

        case ("GET", let p) where p.hasPrefix("/flags/"):
            let name = String(p.dropFirst("/flags/".count))
            return featureFlagsEndpoint.handleGetFlag(name: name)

        // Set state endpoint
        case ("POST", "/state/set"):
            if let body = body,
               let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
               let key = json["key"] as? String,
               let value = json["value"] {
                let token = json["token"] as? String
                return setStateEndpoint.handleSetState(key: key, value: value, providedToken: token)
            }
            return .error(code: 400, message: "Invalid request body. Expected {key, value, token?}")

        default:
            return .error(code: 404, message: "Not found: \(method) \(path)")
        }
    }

    private func sendResponse(_ response: BridgeResponse, to socket: Int32) {
        let (statusCode, contentType, body) = response.toHTTPResponse()

        let statusText: String
        switch statusCode {
        case 200: statusText = "OK"
        case 400: statusText = "Bad Request"
        case 401: statusText = "Unauthorized"
        case 403: statusText = "Forbidden"
        case 404: statusText = "Not Found"
        case 500: statusText = "Internal Server Error"
        default: statusText = "Unknown"
        }

        let httpResponse = """
        HTTP/1.1 \(statusCode) \(statusText)\r
        Content-Type: \(contentType)\r
        Content-Length: \(body.count)\r
        Connection: close\r
        Access-Control-Allow-Origin: *\r
        \r

        """

        var responseData = Data(httpResponse.utf8)
        responseData.append(body)

        _ = responseData.withUnsafeBytes {
            write(socket, $0.baseAddress!, responseData.count)
        }
    }
}
