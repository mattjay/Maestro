# MaestroBridge

Debug-time "X-ray vision" into iOS app internals. MaestroBridge exposes your app's view/controller stack, feature flags, network requests, analytics events, and optionally allows test state injection - all from your AI coding assistant via Maestro.

> **WARNING**: This is a **debug-only** feature that should **NEVER** ship to production. The package includes multiple safety guards, but you must ensure it's only linked in debug builds.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Registering Custom State](#registering-custom-state)
- [Analytics Integration](#analytics-integration)
- [Feature Flags](#feature-flags)
- [Test State Injection](#test-state-injection)
- [Security Model](#security-model)
- [API Reference](#api-reference)
- [Maestro Commands](#maestro-commands)
- [Troubleshooting](#troubleshooting)

## Quick Start

```swift
// AppDelegate.swift
#if DEBUG
import MaestroBridge

func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    // Start the bridge server
    MaestroBridge.shared.start(token: "my-debug-token")

    // Register custom state (optional)
    MaestroBridge.shared.register("cart") {
        return CartManager.shared.cartState
    }

    // Register feature flags (optional)
    MaestroBridge.shared.registerFeatureFlag("newCheckout", enabled: true, variant: "A")

    return true
}
#endif
```

## Installation

### Swift Package Manager

Add MaestroBridge to your project using SPM:

1. In Xcode, go to **File > Add Packages...**
2. Enter the package URL or local path to the MaestroBridge package
3. **IMPORTANT**: Add MaestroBridge only to your **Debug** configuration

```swift
// Package.swift (if using SPM manifest)
dependencies: [
    .package(path: "../path/to/MaestroBridge")
]

// For the target:
.target(
    name: "YourApp",
    dependencies: [
        .product(name: "MaestroBridge", package: "MaestroBridge", condition: .when(configuration: .debug))
    ]
)
```

### CocoaPods (Manual)

Since MaestroBridge is a Swift Package, you'll need to add it manually if using CocoaPods:

1. Copy the `MaestroBridge` folder into your project
2. Create a Debug-only target or use `#if DEBUG` guards

### Requirements

- iOS 14.0+ / macOS 11.0+
- Swift 5.9+
- Xcode 15.0+

## Basic Usage

### Starting the Bridge

```swift
#if DEBUG
import MaestroBridge

// Start with default port (9876)
MaestroBridge.shared.start()

// Or with custom port and token
MaestroBridge.shared.start(port: 9877, token: "my-secure-token")
#endif
```

When the bridge starts, you'll see output in the console:

```
╔═══════════════════════════════════════════════════════════════╗
║                    MaestroBridge Started                      ║
╠═══════════════════════════════════════════════════════════════╣
║  URL:   http://127.0.0.1:9876                                 ║
║  Token: a1b2c3d4e5f6...                                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                   ║
║    GET  /state       - App state snapshot                     ║
║    GET  /route       - Navigation state                       ║
║    GET  /network     - Network request log                    ║
║    GET  /analytics   - Analytics events                       ║
║    GET  /flags       - Feature flags                          ║
║    POST /state/set   - Set test state (if enabled)            ║
╚═══════════════════════════════════════════════════════════════╝
```

### SwiftUI Integration

```swift
import SwiftUI
#if DEBUG
import MaestroBridge
#endif

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                #if DEBUG
                .withMaestroBridge(port: 9876, token: "debug-token")
                #endif
        }
    }
}
```

### Stopping the Bridge

```swift
MaestroBridge.shared.stop()
```

## Registering Custom State

Expose your app's internal state to Maestro by registering state providers:

### Basic State Registration

```swift
// Register a simple state object
MaestroBridge.shared.register("user") {
    return UserState(
        isLoggedIn: AuthManager.shared.isAuthenticated,
        username: AuthManager.shared.currentUser?.name,
        role: AuthManager.shared.currentUser?.role
    )
}

// Register cart state
MaestroBridge.shared.register("cart") {
    return CartManager.shared.currentCart
}

// Register any Encodable type
MaestroBridge.shared.register("settings") {
    return AppSettings.current
}
```

### State with Test Injection

For testing, you can register state with a setter:

```swift
MaestroBridge.shared.register(
    "user.isLoggedIn",
    provider: { AuthManager.shared.isAuthenticated },
    setter: { newValue in
        // Only in DEBUG - set test state
        AuthManager.shared.setMockAuthenticated(newValue)
        return true
    }
)
```

### Unregistering State

```swift
MaestroBridge.shared.unregister("cart")
```

## Analytics Integration

MaestroBridge can capture analytics events from your app.

### Manual Event Recording

```swift
// Record events manually
MaestroBridge.shared.trackEvent("button_tapped", properties: [
    "button_id": "checkout",
    "screen": "cart"
])
```

### Firebase Analytics

```swift
// Wrap your Firebase calls
extension Analytics {
    static func logBridgedEvent(_ name: String, parameters: [String: Any]? = nil) {
        // Log to Firebase
        Analytics.logEvent(name, parameters: parameters)

        // Also capture in bridge
        #if DEBUG
        AnalyticsInterceptor.shared.firebaseLogEvent(name: name, parameters: parameters)
        #endif
    }
}
```

### Amplitude

```swift
#if DEBUG
AnalyticsInterceptor.shared.amplitudeLogEvent(
    eventType: "purchase_completed",
    eventProperties: ["amount": 99.99]
)
#endif
```

### Mixpanel

```swift
#if DEBUG
AnalyticsInterceptor.shared.mixpanelTrack(
    event: "signup",
    properties: ["method": "google"]
)
#endif
```

### Segment

```swift
#if DEBUG
AnalyticsInterceptor.shared.segmentTrack(
    event: "item_viewed",
    properties: ["item_id": "12345"]
)
#endif
```

### SwiftUI Screen View Tracking

```swift
struct ProductDetailView: View {
    var body: some View {
        VStack {
            // Your content
        }
        #if DEBUG
        .trackScreenView("product_detail", properties: ["product_id": productId])
        #endif
    }
}
```

## Feature Flags

Expose your feature flags for inspection:

### Static Flags

```swift
MaestroBridge.shared.registerFeatureFlag("newCheckout", enabled: true)
MaestroBridge.shared.registerFeatureFlag("darkMode", enabled: false)
MaestroBridge.shared.registerFeatureFlag("experimentalSearch", enabled: true, variant: "B")
```

### Dynamic Flags (from LaunchDarkly, Firebase Remote Config, etc.)

```swift
// Register a provider that fetches current flag state
MaestroBridge.shared.registerFeatureFlagProvider("premiumFeatures") {
    return FeatureFlag(
        enabled: FeatureFlagManager.shared.isEnabled("premiumFeatures"),
        variant: FeatureFlagManager.shared.variant("premiumFeatures")
    )
}
```

## Test State Injection

> **WARNING**: State injection is disabled by default and requires explicit opt-in. Only enable for testing scenarios.

### Enabling State Mutation

```swift
#if DEBUG
// Enable state mutation with optional additional token
MaestroBridge.shared.enableStateMutation(token: "mutation-secret-token")
#endif
```

### Registering Settable State

```swift
MaestroBridge.shared.register(
    "cart.itemCount",
    provider: { CartManager.shared.itemCount },
    setter: { count in
        CartManager.shared.setMockItemCount(count)
        return true
    }
)
```

### Using via Maestro

```bash
/ios.bridge.set cart.itemCount 5 --confirm
```

### Disabling State Mutation

```swift
MaestroBridge.shared.disableStateMutation()
```

## Security Model

MaestroBridge includes multiple layers of security:

### 1. Compile-Time Guards

The package uses `#if DEBUG` blocks throughout. In release builds, bridge operations become no-ops.

### 2. Build Configuration Check

`Package.swift` defines `MAESTRO_BRIDGE_ENABLED` only for debug configuration:

```swift
swiftSettings: [
    .define("MAESTRO_BRIDGE_ENABLED", .when(configuration: .debug))
]
```

### 3. Runtime Assertion

On startup, `assertDebugBuild()` is called, which will **crash** the app if somehow included in a release build:

```swift
#if !DEBUG
fatalError("SECURITY ERROR: MaestroBridge in Release Build")
#endif
```

### 4. Localhost-Only Binding

The HTTP server binds only to `127.0.0.1`:

```swift
addr.sin_addr.s_addr = inet_addr("127.0.0.1") // Localhost only!
```

This prevents any network access to the bridge.

### 5. Token Authentication

All requests require a Bearer token:

```http
Authorization: Bearer <token>
```

Tokens are generated cryptographically using `SecRandomCopyBytes` and compared using constant-time comparison to prevent timing attacks.

### 6. State Mutation Guards

- State mutation is disabled by default
- Requires explicit `enableStateMutation()` call
- Can require additional mutation token
- Each state key must be explicitly registered with a setter

### Best Practices

1. **Always wrap MaestroBridge code in `#if DEBUG`**:
   ```swift
   #if DEBUG
   import MaestroBridge
   // Bridge code
   #endif
   ```

2. **Link only in Debug configuration** via SPM condition:
   ```swift
   .product(name: "MaestroBridge", condition: .when(configuration: .debug))
   ```

3. **Never expose production tokens/credentials** in registered state

4. **Review state setters carefully** - they can modify app behavior

## API Reference

### MaestroBridge

| Method | Description |
|--------|-------------|
| `start(port:token:)` | Start the bridge server |
| `stop()` | Stop the bridge server |
| `register(_:provider:)` | Register a custom state provider |
| `register(_:provider:setter:)` | Register state with test injection support |
| `unregister(_:)` | Remove a state provider |
| `registerFeatureFlag(_:enabled:variant:)` | Register a feature flag |
| `registerFeatureFlagProvider(_:provider:)` | Register dynamic feature flag |
| `enableStateMutation(token:)` | Enable test state injection |
| `disableStateMutation()` | Disable test state injection |
| `trackEvent(_:properties:source:)` | Record an analytics event |

### NetworkInterceptor

| Property/Method | Description |
|--------|-------------|
| `maxRequests` | Maximum requests to keep (default: 100) |
| `sensitiveHeaders` | Headers to redact (auth, cookies, etc.) |
| `enable()` | Start intercepting URLSession requests |
| `disable()` | Stop intercepting |
| `getRequests()` | Get all captured requests |
| `recordRequest(_:detail:)` | Manually record a request |
| `clear()` | Clear all captured requests |

### AnalyticsInterceptor

| Method | Description |
|--------|-------------|
| `maxEvents` | Maximum events to keep (default: 500) |
| `recordEvent(name:properties:source:userId:)` | Record an event |
| `firebaseLogEvent(name:parameters:)` | Firebase integration |
| `amplitudeLogEvent(eventType:eventProperties:)` | Amplitude integration |
| `mixpanelTrack(event:properties:)` | Mixpanel integration |
| `segmentTrack(event:properties:)` | Segment integration |
| `clear()` | Clear all captured events |

## Maestro Commands

Once MaestroBridge is running in your app, use these Maestro commands:

### View App State
```bash
/ios.bridge.state              # Full state snapshot
/ios.bridge.state user         # Specific state key
/ios.bridge.state --json       # JSON output
```

### View Navigation
```bash
/ios.bridge.route              # Current route
/ios.bridge.route --stack      # Full navigation stack
```

### View Network Requests
```bash
/ios.bridge.network            # Recent network requests
/ios.bridge.network --last 5   # Last 5 requests
/ios.bridge.network --errors   # Only failed requests
```

### View Analytics Events
```bash
/ios.bridge.analytics              # Recent events
/ios.bridge.analytics --filter "checkout"  # Filter events
/ios.bridge.analytics --last 10    # Last 10 events
```

### View Feature Flags
```bash
/ios.bridge.flags              # All feature flags
/ios.bridge.flags newCheckout  # Specific flag
```

### Set Test State
```bash
/ios.bridge.set user.isLoggedIn true --confirm
```

## Troubleshooting

### Bridge Not Starting

**Symptom**: No console output when calling `start()`

**Solution**: Ensure you're running a DEBUG build:
```swift
#if DEBUG
print("Debug mode: \(DebugOnlyGuard.isDebugBuild)")
#endif
```

### Port Already in Use

**Symptom**: "Failed to bind to port" error

**Solution**: Use a different port:
```swift
MaestroBridge.shared.start(port: 9877)
```

### Token Not Working

**Symptom**: 401 Unauthorized responses

**Solution**:
1. Check the token printed in console
2. Ensure Bearer prefix: `Authorization: Bearer <token>`
3. Verify token matches exactly (case-sensitive)

### State Not Showing

**Symptom**: Custom state missing from `/state` response

**Solution**: Ensure registration happens before bridge start or state access:
```swift
MaestroBridge.shared.register("myState") { ... }
```

### Network Requests Not Captured

**Symptom**: `/network` returns empty

**Solution**:
1. Check `NetworkInterceptor.shared.enable()` was called (automatic with bridge start)
2. For custom network layers, use `NetworkInterceptor.shared.recordRequest()`
3. Verify requests use URLSession (WebSocket/custom protocols aren't captured)

### App Crashes in Release

**Symptom**: App crashes with "MaestroBridge in Release Build" error

**Solution**:
1. Remove MaestroBridge from release target
2. Wrap all usage in `#if DEBUG`
3. Use SPM configuration condition

## Example Integration

See the complete example in your app:

```swift
// AppDelegate.swift
import UIKit
#if DEBUG
import MaestroBridge
#endif

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        #if DEBUG
        setupMaestroBridge()
        #endif

        return true
    }

    #if DEBUG
    private func setupMaestroBridge() {
        // Start with custom port and token
        MaestroBridge.shared.start(port: 9876, token: "debug-\(Bundle.main.bundleIdentifier ?? "app")")

        // Register user state
        MaestroBridge.shared.register("user") {
            return [
                "isLoggedIn": AuthManager.shared.isAuthenticated,
                "username": AuthManager.shared.currentUser?.name ?? "anonymous",
                "role": AuthManager.shared.currentUser?.role ?? "guest"
            ]
        }

        // Register cart state with setter for testing
        MaestroBridge.shared.register(
            "cart",
            provider: { CartManager.shared.toDict() },
            setter: { dict in
                guard let count = dict["itemCount"] as? Int else { return false }
                CartManager.shared.setMockItems(count: count)
                return true
            }
        )

        // Register feature flags
        MaestroBridge.shared.registerFeatureFlag("newCheckout", enabled: true, variant: "A")
        MaestroBridge.shared.registerFeatureFlag("darkMode", enabled: UserDefaults.standard.bool(forKey: "darkMode"))

        // Enable state mutation for testing
        MaestroBridge.shared.enableStateMutation(token: "test-mutation-token")

        print("MaestroBridge ready at \(MaestroBridge.shared.baseURL?.absoluteString ?? "unknown")")
    }
    #endif
}
```
