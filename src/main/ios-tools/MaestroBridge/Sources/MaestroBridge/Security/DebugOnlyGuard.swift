// DebugOnlyGuard.swift
// MaestroBridge
//
// Ensures MaestroBridge only runs in debug builds.
// IMPORTANT: This package should NEVER ship to production.

import Foundation

/// Guard that ensures code only runs in DEBUG builds
public enum DebugOnlyGuard {
    /// Check if running in debug mode
    public static var isDebugBuild: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    /// Check if MAESTRO_BRIDGE_ENABLED is defined
    public static var isBridgeEnabled: Bool {
        #if MAESTRO_BRIDGE_ENABLED
        return true
        #else
        return false
        #endif
    }

    /// Perform runtime check for debug environment
    /// Returns true if we're in a debug-like environment
    public static func performRuntimeCheck() -> Bool {
        // Check for debugger attachment
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]

        let result = sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0)
        guard result == 0 else { return false }

        let isBeingDebugged = (info.kp_proc.p_flag & P_TRACED) != 0

        // Also check for simulator
        let isSimulator = isRunningInSimulator()

        return isBeingDebugged || isSimulator
    }

    /// Check if running in iOS Simulator
    public static func isRunningInSimulator() -> Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }

    /// Assert that we're in a debug build - crashes in release
    /// Call this at bridge startup to prevent accidental release usage
    public static func assertDebugBuild(
        file: StaticString = #file,
        line: UInt = #line
    ) {
        #if DEBUG
        // All good in debug
        #else
        // In release builds, crash immediately with clear message
        fatalError(
            """

            =====================================================
            SECURITY ERROR: MaestroBridge in Release Build
            =====================================================

            MaestroBridge is a debug-only introspection tool and
            MUST NOT be included in release/production builds.

            Remove MaestroBridge from your release target or
            wrap its usage in #if DEBUG blocks.

            =====================================================
            """,
            file: file,
            line: line
        )
        #endif
    }

    /// Log a warning if potentially in a non-debug environment
    public static func warnIfNotDebug() {
        #if !DEBUG
        print("""
        ⚠️ WARNING: MaestroBridge may be running in a non-debug build.
        This is a security risk - ensure MaestroBridge is not in your release target.
        """)
        #endif
    }
}

// MARK: - Compile-time enforcement

/// Wrapper that only compiles in debug builds
/// Usage: DebugOnly { bridgeOperation() }
@inlinable
public func DebugOnly(_ operation: () -> Void) {
    #if DEBUG
    operation()
    #endif
}

/// Wrapper that returns a value only in debug builds
/// Usage: let result = DebugOnlyValue { computeDebugInfo() }
@inlinable
public func DebugOnlyValue<T>(_ operation: () -> T) -> T? {
    #if DEBUG
    return operation()
    #else
    return nil
    #endif
}

// MARK: - Property wrapper for debug-only properties

/// Property wrapper that only stores values in debug builds
@propertyWrapper
public struct DebugOnlyProperty<T> {
    private var _value: T?

    public var wrappedValue: T? {
        get {
            #if DEBUG
            return _value
            #else
            return nil
            #endif
        }
        set {
            #if DEBUG
            _value = newValue
            #endif
        }
    }

    public init(wrappedValue: T? = nil) {
        #if DEBUG
        self._value = wrappedValue
        #else
        self._value = nil
        #endif
    }
}
