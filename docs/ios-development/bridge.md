---
title: MaestroBridge Guide
description: Deep app introspection and debug-time state inspection for iOS apps.
icon: plug
---

MaestroBridge provides debug-time "X-ray vision" into iOS app internals. It exposes view/controller stack, feature flags, network requests, analytics events, and optionally allows test state injection—all via HTTP endpoints that Maestro can query.

<Warning>
MaestroBridge is a **debug-only** feature that should **NEVER** ship to production. The package includes multiple safety guards, but you must ensure it's only linked in debug builds.
</Warning>

## Overview

MaestroBridge runs a lightweight HTTP server inside your iOS app that exposes internal state:

| Feature | Description |
|---------|-------------|
| **App State** | View controller stack, custom registered state |
| **Navigation** | Current route, navigation stack, history |
| **Network Requests** | Recent HTTP requests with timing and status |
| **Analytics Events** | Captured analytics events from any SDK |
| **Feature Flags** | Current flag states and variants |
| **Test State Injection** | Set app state during testing (opt-in) |

## Quick Start

### UIKit Integration

Add MaestroBridge to your AppDelegate (debug only):

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

## Installation

Add MaestroBridge using Swift Package Manager:

```swift
// Package.swift
dependencies: [
    .package(path: "../path/to/MaestroBridge")
]

// Target configuration - DEBUG ONLY
.target(
    name: "YourApp",
    dependencies: [
        .product(name: "MaestroBridge", package: "MaestroBridge",
                 condition: .when(configuration: .debug))
    ]
)
```

**Requirements:**
- iOS 14.0+ / macOS 11.0+
- Swift 5.9+
- Xcode 15.0+

## Bridge Commands

Once MaestroBridge is running in your app, use these Maestro commands:

### `/ios.bridge.connect`

Connect to the bridge and verify it's running.

```
/ios.bridge.connect --app com.example.myapp
/ios.bridge.connect --port 9876
```

### `/ios.bridge.state`

View app internal state.

```
/ios.bridge.state              # Full state snapshot
/ios.bridge.state user         # Specific state key
/ios.bridge.state --json       # JSON output format
```

**Example Output:**

```markdown
## App Internal State

### Navigation
Current Route: /settings/profile
Stack Depth: 3
Can Go Back: Yes

### View Controller Hierarchy
1. RootNavigationController
2. HomeViewController
3. SettingsViewController (current)

### User State
- isLoggedIn: true
- username: "testuser"
- cartItems: 3

### Feature Flags
- newCheckout: enabled (variant A)
- darkMode: disabled
```

### `/ios.bridge.route`

View navigation state.

```
/ios.bridge.route              # Current route
/ios.bridge.route --stack      # Full navigation stack
```

**Response includes:**
- Current route path
- Navigation stack with titles
- Whether user can go back
- Modal presentation status

### `/ios.bridge.network`

View recent network requests.

```
/ios.bridge.network            # Recent network requests
/ios.bridge.network --last 5   # Last 5 requests
/ios.bridge.network --errors   # Only failed requests
```

**Example Output:**

```
Recent Network Requests (15 total, 1 error)
- GET /api/user → 200 (245ms)
- POST /api/cart → 201 (180ms)
- GET /api/products → 200 (320ms)
- GET /api/broken → 500 (45ms) ❌
```

### `/ios.bridge.analytics`

View analytics events.

```
/ios.bridge.analytics              # Recent events
/ios.bridge.analytics --filter "checkout"
/ios.bridge.analytics --last 10
```

**Example Output:**

```
Recent Analytics (50 events)
- screen_view: cart (10:29:55)
- button_tap: add_to_cart (10:30:00)
- purchase_started (10:30:05)
```

### `/ios.bridge.flags`

View feature flags.

```
/ios.bridge.flags              # All feature flags
/ios.bridge.flags newCheckout  # Specific flag value
```

**Example Output:**

```
Feature Flags (4 total)
- newCheckout: enabled (variant A)
- darkMode: disabled
- experimentalSearch: enabled (variant B)
- premiumFeatures: enabled
```

### `/ios.bridge.set`

Set test state (requires opt-in).

<Warning>
State mutation requires explicit opt-in via `enableStateMutation()` and the `--confirm` flag.
</Warning>

```
/ios.bridge.set user.isLoggedIn true --confirm
/ios.bridge.set cart.itemCount 5 --confirm
```

## Registering Custom State

Expose your app's internal state to Maestro:

```swift
// Simple state
MaestroBridge.shared.register("user") {
    return UserState(
        isLoggedIn: AuthManager.shared.isAuthenticated,
        username: AuthManager.shared.currentUser?.name
    )
}

// State with test injection support
MaestroBridge.shared.register(
    "user.isLoggedIn",
    provider: { AuthManager.shared.isAuthenticated },
    setter: { newValue in
        AuthManager.shared.setMockAuthenticated(newValue)
        return true
    }
)
```

## Analytics Integration

Capture events from popular analytics SDKs:

```swift
#if DEBUG
// Firebase Analytics
AnalyticsInterceptor.shared.firebaseLogEvent(name: name, parameters: parameters)

// Amplitude
AnalyticsInterceptor.shared.amplitudeLogEvent(eventType: "purchase", eventProperties: ["amount": 99.99])

// Mixpanel
AnalyticsInterceptor.shared.mixpanelTrack(event: "signup", properties: ["method": "google"])

// Segment
AnalyticsInterceptor.shared.segmentTrack(event: "item_viewed", properties: ["item_id": "12345"])
#endif
```

## Feature Flags

Register feature flags for inspection:

```swift
// Static flags
MaestroBridge.shared.registerFeatureFlag("newCheckout", enabled: true, variant: "A")
MaestroBridge.shared.registerFeatureFlag("darkMode", enabled: false)

// Dynamic flags (LaunchDarkly, Firebase Remote Config, etc.)
MaestroBridge.shared.registerFeatureFlagProvider("premiumFeatures") {
    return FeatureFlag(
        enabled: FeatureFlagManager.shared.isEnabled("premiumFeatures"),
        variant: FeatureFlagManager.shared.variant("premiumFeatures")
    )
}
```

## Network Interceptor

Automatically capture URLSession requests:

```swift
// Interceptor is enabled automatically with bridge start
// For manual recording (custom network layers):
NetworkInterceptor.shared.recordRequest(request, detail: detail)

// Configuration
NetworkInterceptor.shared.maxRequests = 100  // Keep last 100 requests
NetworkInterceptor.shared.sensitiveHeaders = ["Authorization", "Cookie"]  // Auto-redact

// Control
NetworkInterceptor.shared.enable()
NetworkInterceptor.shared.disable()
NetworkInterceptor.shared.clear()
```

## HTTP Endpoints Reference

MaestroBridge exposes these HTTP endpoints (all require Bearer token authentication):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ping` | GET | Health check |
| `/state` | GET | Full app state snapshot |
| `/state/{key}` | GET | Specific state key |
| `/route` | GET | Current navigation state |
| `/route/stack` | GET | Full navigation stack |
| `/route/history` | GET | Navigation history |
| `/network` | GET | Recent network requests |
| `/network/{id}` | GET | Specific request details |
| `/network` | DELETE | Clear network log |
| `/analytics` | GET | Recent analytics events |
| `/analytics/sources` | GET | Analytics SDK sources |
| `/analytics` | DELETE | Clear analytics log |
| `/flags` | GET | All feature flags |
| `/flags/{name}` | GET | Specific flag |
| `/state/set` | POST | Set test state (requires opt-in) |

**Authentication:**

```http
Authorization: Bearer <token>
```

## Security Model

MaestroBridge includes 6 layers of security to prevent production deployment:

| Layer | Protection |
|-------|------------|
| **Compile-Time Guards** | `#if DEBUG` blocks throughout the codebase |
| **Build Configuration** | `MAESTRO_BRIDGE_ENABLED` only defined for debug |
| **Runtime Assertion** | `assertDebugBuild()` crashes if running in release |
| **Localhost Binding** | Server only binds to `127.0.0.1` |
| **Token Authentication** | All requests require Bearer token |
| **State Mutation Guards** | Requires explicit opt-in + additional token |

**Best Practices:**

1. Always wrap MaestroBridge code in `#if DEBUG`
2. Use SPM configuration condition: `.when(configuration: .debug)`
3. Never expose production tokens/credentials in registered state
4. Review state setters carefully before enabling mutation

## Playbook Integration

Use bridge commands in playbook YAML files:

```yaml
name: Verify Cart State
description: Test cart functionality with state inspection

steps:
  # Add item to cart
  - action: ios.tap
    inputs:
      target: "#add_to_cart_button"
      app: com.example.myapp

  # Verify state via bridge
  - action: ios.bridge.state
    inputs:
      key: cart
    store_as: cart_state

  - action: assert
    inputs:
      condition: "{{ cart_state.itemCount > 0 }}"
      message: "Cart should have items"

  # Check analytics
  - action: ios.bridge.analytics
    inputs:
      filter: "add_to_cart"
    store_as: analytics

  - action: message
    content: |
      Cart items: {{cart_state.itemCount}}
      Analytics events captured: {{analytics.eventCount}}
```

## Troubleshooting

### Bridge Not Starting

Ensure you're running a DEBUG build:

```swift
#if DEBUG
print("Debug mode: \(DebugOnlyGuard.isDebugBuild)")
#endif
```

Check that the port isn't already in use:

```bash
lsof -i :9876
```

### Connection Refused

1. Verify the app is running in the simulator
2. Check the bridge port matches your configuration
3. Ensure token authentication matches

### State Not Updating

1. Verify state is registered correctly
2. Check that the provider closure returns current values
3. Look for errors in console output

### Network Requests Missing

1. Ensure `NetworkInterceptor` is enabled
2. Check if custom network layers need manual recording
3. Verify the app is making requests (not cached)

## Next Steps

- [Command Reference](./commands) - Full command documentation
- [Playbook Integration](./playbooks) - Automate bridge queries
- [Troubleshooting](./troubleshooting) - Common issues
