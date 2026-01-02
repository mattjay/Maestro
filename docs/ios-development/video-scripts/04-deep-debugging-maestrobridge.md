# Video Script: Deep Debugging with MaestroBridge

**Duration**: 10 minutes
**Target Audience**: iOS developers seeking advanced debugging capabilities
**Objective**: Master MaestroBridge for app state inspection, feature flags, network monitoring, and analytics tracking

---

## Pre-Production Notes

### Required Footage
- [ ] MaestroBridge setup in Xcode project
- [ ] Bridge connection and health check
- [ ] State inspection with live app
- [ ] Feature flag viewing and toggling
- [ ] Network request monitoring
- [ ] Analytics event capture

### Assets Needed
- Architecture diagram (app -> bridge -> Maestro)
- Security model visualization
- HTTP endpoint reference table
- Code syntax highlighting for Swift

---

## Script

### [00:00 - 00:25] Intro

**[VISUAL: Maestro logo animation, then diagram showing hidden app internals being revealed]**

**NARRATOR:**
"You've mastered screenshots, flows, and visual regression. But what about what's happening inside your app? MaestroBridge gives you X-ray vision—view controller stacks, feature flags, network requests, and analytics events, all from Maestro. Let's dive in."

---

### [00:25 - 01:30] What is MaestroBridge?

**[VISUAL: Architecture diagram showing bridge server inside app]**

**NARRATOR:**
"MaestroBridge is a lightweight HTTP server that runs inside your iOS app during debug builds. It exposes internal state through simple endpoints that Maestro can query."

**[VISUAL: Show capabilities list]**

| Feature | What You Can See |
|---------|------------------|
| **App State** | View controller stack, custom state |
| **Navigation** | Current route, history, can go back |
| **Network** | Recent HTTP requests, timing, errors |
| **Analytics** | Captured events from any SDK |
| **Feature Flags** | Current flag states and variants |

**NARRATOR:**
"Think of it as a debug console that your AI assistant can read. Perfect for understanding why the app behaves the way it does."

**[VISUAL: Show security warning]**

**NARRATOR:**
"Important: MaestroBridge is debug-only. It should never ship to production. The package includes multiple safety guards, but always verify your release builds."

---

### [01:30 - 03:00] Adding MaestroBridge to Your App

**[VISUAL: Open Xcode project, show Package.swift]**

**NARRATOR:**
"Let's add MaestroBridge to a project. First, add the Swift package."

**[VISUAL: Type package dependency]**

```swift
// Package.swift
dependencies: [
    .package(path: "../path/to/MaestroBridge")
]

// Target - DEBUG ONLY
.target(
    name: "YourApp",
    dependencies: [
        .product(name: "MaestroBridge", package: "MaestroBridge",
                 condition: .when(configuration: .debug))
    ]
)
```

**NARRATOR:**
"Notice the configuration condition—this ensures the package only links in debug builds. Production builds won't include it at all."

**[VISUAL: Open AppDelegate.swift]**

**NARRATOR:**
"Now initialize the bridge in your app delegate."

**[VISUAL: Type bridge initialization]**

```swift
#if DEBUG
import MaestroBridge

func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [...]) -> Bool {

    // Start the bridge server
    MaestroBridge.shared.start(token: "my-debug-token")

    return true
}
#endif
```

**NARRATOR:**
"Wrap everything in `#if DEBUG`. The token is for authentication—only requests with this token can access the bridge."

**[VISUAL: Show SwiftUI alternative]**

```swift
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

**NARRATOR:**
"SwiftUI apps can use the view modifier instead. Same result, cleaner syntax."

---

### [03:00 - 04:15] Connecting and Inspecting State

**[VISUAL: Run app in simulator, show Maestro]**

**NARRATOR:**
"With the bridge running, let's connect from Maestro."

**[VISUAL: Type `/ios.bridge.connect --app com.example.myapp`]**

**NARRATOR:**
"The connect command verifies the bridge is running and responsive."

**[VISUAL: Show connection success]**

```
Connected to MaestroBridge
App: com.example.myapp
Port: 9876
Status: Healthy
```

**NARRATOR:**
"Green means we're ready. Now let's see what's inside."

**[VISUAL: Type `/ios.bridge.state`]**

**NARRATOR:**
"The state command shows everything the bridge knows about."

**[VISUAL: Show state output]**

```
## App Internal State

### Navigation
Current Route: /settings/profile
Stack Depth: 3
Can Go Back: Yes

### View Controller Hierarchy
1. RootNavigationController
2. HomeViewController
3. SettingsViewController (current)

### Registered State
- isLoggedIn: true
- username: "testuser"
- cartItems: 3
```

**NARRATOR:**
"Navigation stack, current route, and any custom state your app has registered. This is incredibly useful for understanding what state your app is in during test failures."

---

### [04:15 - 05:30] Registering Custom State

**[VISUAL: Open Swift file with state registration]**

**NARRATOR:**
"The bridge sees navigation automatically. For app-specific state, you register it explicitly."

**[VISUAL: Type registration code]**

```swift
#if DEBUG
MaestroBridge.shared.register("cart") {
    return CartManager.shared.cartState
}

MaestroBridge.shared.register("user") {
    return [
        "isLoggedIn": AuthManager.shared.isAuthenticated,
        "username": AuthManager.shared.currentUser?.name,
        "isPremium": AuthManager.shared.currentUser?.isPremium
    ]
}
#endif
```

**NARRATOR:**
"Each registration has a key and a closure that returns the current value. When Maestro queries that key, it gets fresh data."

**[VISUAL: Query specific state]**

```
/ios.bridge.state cart
/ios.bridge.state user.isPremium
```

**NARRATOR:**
"Query specific keys by name. Dot notation drills into nested structures."

---

### [05:30 - 06:45] Feature Flags

**[VISUAL: Show feature flag registration]**

**NARRATOR:**
"Feature flags control app behavior. MaestroBridge lets you see—and optionally set—flag values during testing."

**[VISUAL: Type flag registration]**

```swift
#if DEBUG
// Static flags
MaestroBridge.shared.registerFeatureFlag("newCheckout", enabled: true, variant: "A")
MaestroBridge.shared.registerFeatureFlag("darkMode", enabled: false)

// Dynamic flags (LaunchDarkly, Firebase, etc.)
MaestroBridge.shared.registerFeatureFlagProvider("premiumFeatures") {
    return FeatureFlag(
        enabled: FeatureFlagManager.shared.isEnabled("premiumFeatures"),
        variant: FeatureFlagManager.shared.variant("premiumFeatures")
    )
}
#endif
```

**NARRATOR:**
"Register flags directly or provide callbacks for dynamic flag systems like LaunchDarkly or Firebase Remote Config."

**[VISUAL: Query flags in Maestro]**

```
/ios.bridge.flags
```

**[VISUAL: Show flag output]**

```
Feature Flags (4 total)
- newCheckout: enabled (variant A)
- darkMode: disabled
- experimentalSearch: enabled (variant B)
- premiumFeatures: enabled
```

**NARRATOR:**
"Now you can verify your app is running with the expected flag configuration—essential for debugging A/B test issues."

---

### [06:45 - 08:00] Network Request Monitoring

**[VISUAL: Type `/ios.bridge.network`]**

**NARRATOR:**
"MaestroBridge automatically captures URLSession network requests. See exactly what your app is talking to."

**[VISUAL: Show network output]**

```
Recent Network Requests (15 total, 1 error)

- GET /api/user → 200 (245ms)
- POST /api/cart → 201 (180ms)
- GET /api/products → 200 (320ms)
- GET /api/broken → 500 (45ms) X
```

**NARRATOR:**
"Each request shows method, endpoint, status code, and duration. Errors are highlighted for quick identification."

**[VISUAL: Filter to errors]**

```
/ios.bridge.network --errors
```

**NARRATOR:**
"Filter to errors only when debugging failures. See which API calls are causing problems."

**[VISUAL: Show sensitive data redaction]**

**NARRATOR:**
"Authorization headers and cookies are automatically redacted. Your debug data stays safe even in screenshots."

---

### [08:00 - 09:00] Analytics Event Tracking

**[VISUAL: Show analytics registration]**

**NARRATOR:**
"Finally, analytics events. Every SDK integration can feed into MaestroBridge."

**[VISUAL: Type analytics interceptor code]**

```swift
#if DEBUG
// Firebase Analytics
AnalyticsInterceptor.shared.firebaseLogEvent(name: name, parameters: parameters)

// Amplitude
AnalyticsInterceptor.shared.amplitudeLogEvent(eventType: "purchase", eventProperties: ["amount": 99.99])

// Mixpanel
AnalyticsInterceptor.shared.mixpanelTrack(event: "signup", properties: ["method": "google"])
#endif
```

**NARRATOR:**
"Add interceptor calls alongside your analytics SDK calls. In debug builds, events get captured for inspection."

**[VISUAL: Query analytics in Maestro]**

```
/ios.bridge.analytics
```

**[VISUAL: Show analytics output]**

```
Recent Analytics (50 events)

- screen_view: cart (10:29:55)
- button_tap: add_to_cart (10:30:00)
- purchase_started (10:30:05)
- purchase_completed (10:30:12)
```

**NARRATOR:**
"Verify your analytics are firing correctly. Filter by event name or time range to focus on what matters."

---

### [09:00 - 09:30] Using Bridge in Playbooks

**[VISUAL: Show playbook with bridge commands]**

```yaml
name: Verify Cart State
description: Test cart with state inspection

steps:
  - action: ios.tap
    inputs:
      target: "#add_to_cart_button"

  - action: ios.bridge.state
    inputs:
      key: cart
    store_as: cart_state

  - action: assert
    inputs:
      condition: "{{ cart_state.itemCount > 0 }}"
      message: "Cart should have items"

  - action: ios.bridge.analytics
    inputs:
      filter: "add_to_cart"
    store_as: analytics

  - action: message
    content: "Cart items: {{cart_state.itemCount}}"
```

**NARRATOR:**
"Bridge commands work in playbooks too. Store state in variables, assert conditions, and verify analytics all in one automated flow."

---

### [09:30 - 10:00] What's Next

**[VISUAL: Show security reminder]**

**NARRATOR:**
"Remember: MaestroBridge is powerful but debug-only. Always verify production builds exclude it."

**[VISUAL: Show command summary]**

**Key commands:**
- `/ios.bridge.connect` - Connect to bridge
- `/ios.bridge.state [key]` - View app state
- `/ios.bridge.flags` - View feature flags
- `/ios.bridge.network` - View network requests
- `/ios.bridge.analytics` - View analytics events

**NARRATOR:**
"With MaestroBridge, your AI assistant can see everything your app sees—making debugging collaborative and efficient."

**[VISUAL: Show series summary]**

**NARRATOR:**
"That completes our iOS development series. You've learned setup, UI automation, visual regression, and deep debugging. Check the documentation for complete references and happy testing!"

**[VISUAL: Maestro logo outro]**

**NARRATOR:**
"Thanks for watching!"

---

## Post-Production Notes

### Timing Breakdown
- Intro: 25 seconds
- What is MaestroBridge: 65 seconds
- Adding to App: 90 seconds
- Connecting and State: 75 seconds
- Custom State: 75 seconds
- Feature Flags: 75 seconds
- Network Monitoring: 75 seconds
- Analytics: 60 seconds
- Playbook Integration: 30 seconds
- Outro: 30 seconds

### Visual Effects
- Architecture diagram animation
- Code syntax highlighting
- Network request timeline visualization
- Security badge animations

### Supplementary Materials
- Sample MaestroBridge integration code
- Playbook template with bridge commands
- Security checklist for production verification
