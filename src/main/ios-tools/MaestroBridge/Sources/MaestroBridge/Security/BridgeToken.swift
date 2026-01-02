// BridgeToken.swift
// MaestroBridge
//
// Token-based authentication for bridge security.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Manages authentication tokens for the bridge server
public final class BridgeToken: @unchecked Sendable {
    /// Current token (nil if not set)
    private var _token: String?

    /// Lock for thread-safe access
    private let lock = NSLock()

    /// The current authentication token
    public var token: String? {
        lock.lock()
        defer { lock.unlock() }
        return _token
    }

    public init(token: String? = nil) {
        self._token = token
    }

    /// Generate a new random token
    public func generateToken() -> String {
        let token = generateRandomToken()
        lock.lock()
        _token = token
        lock.unlock()
        return token
    }

    /// Set a specific token (for testing or explicit configuration)
    public func setToken(_ token: String) {
        lock.lock()
        _token = token
        lock.unlock()
    }

    /// Clear the current token
    public func clearToken() {
        lock.lock()
        _token = nil
        lock.unlock()
    }

    /// Validate a token against the stored token
    /// - Parameter providedToken: Token to validate
    /// - Returns: true if token matches or no token is required
    public func validate(_ providedToken: String?) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        // If no token is set, allow all requests (dev convenience)
        guard let storedToken = _token else {
            return true
        }

        // Compare tokens securely
        guard let provided = providedToken else {
            return false
        }

        return constantTimeCompare(storedToken, provided)
    }

    // MARK: - Private

    /// Generate a cryptographically secure random token
    private func generateRandomToken() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let result = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)

        guard result == errSecSuccess else {
            // Fallback to UUID if SecRandom fails
            return UUID().uuidString.replacingOccurrences(of: "-", with: "")
        }

        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    /// Constant-time string comparison to prevent timing attacks
    private func constantTimeCompare(_ a: String, _ b: String) -> Bool {
        let aBytes = Array(a.utf8)
        let bBytes = Array(b.utf8)

        guard aBytes.count == bBytes.count else {
            return false
        }

        var result: UInt8 = 0
        for i in 0..<aBytes.count {
            result |= aBytes[i] ^ bBytes[i]
        }

        return result == 0
    }
}

/// Token validation result
public enum TokenValidationResult {
    case valid
    case invalid
    case missing

    public var isAuthorized: Bool {
        self == .valid
    }
}

extension BridgeToken {
    /// Validate request authorization header
    /// - Parameter authHeader: Value of Authorization header
    /// - Returns: Validation result
    public func validateAuthHeader(_ authHeader: String?) -> TokenValidationResult {
        guard let header = authHeader else {
            return token == nil ? .valid : .missing
        }

        // Expected format: "Bearer <token>"
        let prefix = "Bearer "
        guard header.hasPrefix(prefix) else {
            return .invalid
        }

        let providedToken = String(header.dropFirst(prefix.count))
        return validate(providedToken) ? .valid : .invalid
    }
}
