---
title: iOS Development Tools
description: Capture screenshots, logs, and crash data from iOS simulators to close the feedback loop.
icon: mobile
---

Maestro includes built-in iOS development tools that allow AI agents to "see" what's happening in iOS simulators. This closes the feedback loop between code changes and their visual/behavioral results.

## Overview

The iOS tools provide:

- **Screenshot capture** - Instant snapshots of simulator screens
- **System log collection** - Recent logs filtered by time and app bundle ID
- **Crash detection** - Automatic identification of crash logs
- **Organized artifacts** - All data stored in a structured directory for analysis

These tools work with any booted iOS Simulator and require Xcode to be installed.

## The `/ios.snapshot` Command

Capture the current state of an iOS simulator with a single command:

```
/ios.snapshot
```

This captures:
1. A screenshot of the simulator screen
2. Recent system logs (last 60 seconds by default)
3. Any crash logs that occurred

### Command Options

| Option | Short | Description |
|--------|-------|-------------|
| `--simulator <name\|udid>` | `-s` | Target simulator by name or UDID (default: first booted) |
| `--app <bundleId>` | `-a` | Filter logs to a specific app |
| `--duration <seconds>` | `-d` | Seconds of logs to capture (default: 60) |
| `--include-crash` | | Include full crash log content |
| `--output <path>` | `-o` | Custom output directory |

### Examples

**Basic snapshot** - Uses the first booted simulator:
```
/ios.snapshot
```

**Target a specific simulator**:
```
/ios.snapshot --simulator "iPhone 15 Pro"
```

**Filter logs to your app**:
```
/ios.snapshot --app com.example.myapp
```

**Capture more log history**:
```
/ios.snapshot -d 300
```

**Combined options**:
```
/ios.snapshot -s "iPhone 15" -a com.example.app -d 120 --include-crash
```

### Agent Output

When you run `/ios.snapshot`, the AI agent receives a structured summary:

```markdown
## iOS Snapshot Captured

**Timestamp**: 2024-01-15T10:30:00
**Simulator**: iPhone 15 Pro (iOS 17.2)
**App**: com.example.myapp

### Screenshot
Saved to: ~/Library/Application Support/Maestro/ios-artifacts/{session}/screenshot.png

### System Log Summary
- Total entries: 245
- Errors: 3
- Faults: 0
- Warnings: 12
- Last error: "Failed to load resource at..."

### Crash Logs
No crash logs found

### Artifacts
All artifacts saved to: ~/Library/Application Support/Maestro/ios-artifacts/{session}/{snapshot}/
```

This structured output enables the AI to:
- Identify errors and warnings in logs
- Detect crashes and analyze stack traces
- Reference the screenshot path for image analysis
- Track the artifact directory for follow-up queries

## Auto Run Integration

Use `ios.snapshot` in playbook YAML files for automated iOS testing workflows:

```yaml
name: iOS Debug Workflow
steps:
  - action: ios.snapshot
    simulator: "iPhone 15 Pro"
    app: com.example.myapp
    duration: 120
    include_crash: true
    store_as: snapshot_result

  - action: message
    content: |
      Analyze the iOS snapshot:
      - Screenshot: {{snapshot_result.screenshotPath}}
      - Logs: {{snapshot_result.logsPath}}
      - Errors found: {{snapshot_result.summary.errorCount}}
      - Crashes: {{snapshot_result.hasCrashes}}
```

### Action Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `simulator` | string | No | First booted | Simulator name or UDID |
| `app` | string | No | - | Bundle ID to filter logs |
| `duration` | number | No | 60 | Seconds of log history |
| `include_crash` | boolean | No | false | Include full crash content |

### Action Outputs

When using `store_as`, the following fields are available:

| Output | Type | Description |
|--------|------|-------------|
| `screenshotPath` | string | Path to captured screenshot |
| `logsPath` | string | Path to logs JSON file |
| `hasCrashes` | boolean | Whether crashes were found |
| `crashPaths` | array | Paths to crash log files |
| `artifactDir` | string | Directory with all artifacts |
| `summary.errorCount` | number | Count of error-level logs |
| `summary.faultCount` | number | Count of fault-level logs |
| `summary.warningCount` | number | Count of warning-level logs |
| `simulator.name` | string | Simulator device name |
| `simulator.iosVersion` | string | iOS version string |

## Artifact Directory Structure

All iOS artifacts are stored in a structured directory:

```
~/Library/Application Support/Maestro/ios-artifacts/
└── {sessionId}/
    ├── snapshot-20240115-103000-123/
    │   ├── screenshot.png
    │   ├── logs.json
    │   └── metadata.json
    ├── snapshot-20240115-103500-456/
    │   ├── screenshot.png
    │   ├── logs.json
    │   ├── crash-0.log
    │   └── metadata.json
    └── ...
```

### Files

| File | Description |
|------|-------------|
| `screenshot.png` | Simulator screen capture |
| `logs.json` | Array of log entries with timestamp, level, message, process, subsystem |
| `crash-N.log` | Crash reports (when `--include-crash` is used) |
| `metadata.json` | Snapshot metadata (timestamp, simulator info, counts) |

### Log Entry Format

Each entry in `logs.json`:

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "error",
  "message": "Failed to load resource",
  "process": "MyApp",
  "pid": 12345,
  "subsystem": "com.example.myapp.network",
  "category": "URLSession"
}
```

Log levels: `error`, `fault`, `warning`, `info`, `debug`, `default`

### Artifact Retention

By default, Maestro keeps the 50 most recent snapshots per session. Older artifacts are automatically pruned to manage disk space.

## UI Panel (iOS Sessions)

For sessions working with iOS projects, the Right Bar includes an **iOS** tab that provides:

- **Screenshot viewer** - Display captured screenshot with zoom
- **Log viewer** - Filterable, searchable log display
  - Filter by log level (error, fault, warning, info, debug)
  - Full-text search with `Cmd+F`
  - Expandable entries with full details
- **Crash alerts** - Highlighted crash log section
- **History dropdown** - Browse previous snapshots

The iOS tab appears when enabled for a session and provides a visual interface to the same data available via the slash command.

## Requirements

- **macOS only** - iOS Simulator requires macOS
- **Xcode installed** - Required for `xcrun simctl` commands
- **Booted simulator** - At least one simulator must be running

Check if a simulator is booted:
```bash
xcrun simctl list devices booted
```

Start a simulator:
```bash
xcrun simctl boot "iPhone 15 Pro"
```

## Troubleshooting

### "No simulator booted" Error

Ensure at least one simulator is running:
```bash
# List booted simulators
xcrun simctl list devices booted

# Boot a simulator if none running
xcrun simctl boot "iPhone 15 Pro"

# Or open Simulator app
open -a Simulator
```

### "Simulator not found" Error

The simulator name must match exactly (case-insensitive). List available simulators:
```bash
xcrun simctl list devices available
```

### Screenshot Timeout

If the simulator is frozen or unresponsive:
1. Quit and restart Simulator.app
2. Erase simulator content: `xcrun simctl erase "iPhone 15 Pro"`
3. Try a different simulator

### Permission Errors

Ensure Maestro has access to the artifacts directory:
```bash
ls -la ~/Library/Application\ Support/Maestro/ios-artifacts/
```

### Missing Logs

If no logs appear:
- Increase `--duration` to capture more history
- Remove `--app` filter to see all logs
- Ensure the app is actually running in the simulator

## The `/ios.run_flow` Command

Execute Maestro Mobile test flows on iOS simulators. This command runs YAML-based UI automation flows using the [Maestro Mobile CLI](https://maestro.mobile.dev/).

```
/ios.run_flow <path>
/ios.run_flow --inline "tap:Login" "type:password123"
```

### Prerequisites

Install Maestro Mobile CLI before using this command:

```bash
# Option 1: Homebrew (recommended)
brew tap mobile-dev-inc/tap && brew install maestro

# Option 2: Direct installation
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Verify installation:
```bash
maestro --version
```

### Command Options

| Option | Short | Description |
|--------|-------|-------------|
| `--simulator <name\|udid>` | `-s` | Target simulator by name or UDID (default: first booted) |
| `--app <bundleId>` | `-a` | App bundle ID to target |
| `--timeout <seconds>` | `-t` | Maximum execution time in seconds (default: 300) |
| `--screenshot-dir <path>` | | Output directory for screenshots |
| `--inline` | | Run inline action strings instead of a file |
| `--retry <count>` | | Number of retry attempts on failure (default: 1) |
| `--continue` | | Continue on error (don't stop at first failure) |
| `--debug` | | Enable debug mode with verbose output |

### Examples

**Run a flow file**:
```
/ios.run_flow login_flow.yaml
```

**Target a specific simulator**:
```
/ios.run_flow flows/signup.yaml --simulator "iPhone 15 Pro"
```

**Specify app and timeout**:
```
/ios.run_flow test.yaml --app com.example.myapp --timeout 60
```

**Retry on failure**:
```
/ios.run_flow flow.yaml --retry 3
```

**Run inline steps**:
```
/ios.run_flow --inline "tap:Login" "type:password123" "tap:Submit"
```

**Combined options**:
```
/ios.run_flow flow.yaml -s "iPhone 15" -a com.example.app --debug
```

### Agent Output

When you run `/ios.run_flow`, the AI agent receives a structured summary:

```markdown
## ✓ Flow Execution PASSED

| Metric | Value |
|--------|-------|
| Status | PASSED |
| Duration | 12.5s |
| Steps Passed | 8/8 |

### Steps

- ✓ Launch app (2100ms)
- ✓ Tap on "Login" (450ms)
- ✓ Input text (120ms)
- ✓ Tap on "Submit" (380ms)
- ✓ Assert visible "Welcome" (250ms)
- ✓ Take screenshot (180ms)
- ✓ Scroll down (320ms)
- ✓ Tap on "Settings" (400ms)

### Artifacts

- Report: `~/Library/Application Support/Maestro/ios-artifacts/{session}/report.html`
```

For failed flows, the output includes:
- Error message with details
- Failure screenshot path
- Step-by-step results showing which step failed
- Troubleshooting suggestions

### Maestro Mobile YAML Format

Flow files use Maestro Mobile's YAML syntax. This section provides a comprehensive reference of all supported actions and configuration options.

#### Flow Structure

A Maestro flow file consists of an optional configuration header followed by a list of steps:

```yaml
# Configuration (optional)
appId: com.example.myapp
name: My Flow Name
tags:
  - smoke
  - regression
env:
  USERNAME: testuser
  PASSWORD: secret123
---
# Steps (required)
- launchApp
- tapOn: "Login"
- inputText: "${USERNAME}"
```

| Config Option | Description |
|---------------|-------------|
| `appId` | Bundle ID of the app to target |
| `name` | Human-readable flow name |
| `tags` | Array of tags for filtering flows |
| `env` | Environment variables accessible as `${VAR_NAME}` |

#### Tap Actions

```yaml
# Tap on element by text
- tapOn: "Login"

# Tap on element by accessibility ID
- tapOn:
    id: "login_button"

# Tap at specific coordinates
- tapOn:
    point: "150,300"

# Tap with partial text match
- tapOn:
    containsText: "Log"

# Tap on nth element when multiple matches exist
- tapOn:
    text: "Item"
    index: 0  # 0-based index

# Tap without waiting for element to settle
- tapOn:
    text: "Button"
    waitToSettle: false

# Double tap
- doubleTapOn: "Image"

# Long press
- longPressOn: "Delete"
```

#### Text Input Actions

```yaml
# Input text (into focused element)
- inputText: "hello@example.com"

# Erase all text from focused field
- eraseText

# Erase specific number of characters
- eraseText: 10

# Hide keyboard
- hideKeyboard

# Copy text from element
- copyTextFrom: "Username"
- copyTextFrom:
    id: "username_label"
```

#### Scrolling and Swiping

```yaml
# Scroll in direction
- scroll:
    direction: DOWN  # UP, DOWN, LEFT, RIGHT

# Scroll within a specific element
- scroll:
    elementId: "scroll_view"
    direction: DOWN

# Scroll until element visible
- scrollUntilVisible:
    element:
      text: "Terms of Service"
    direction: DOWN

# Scroll until element with ID visible
- scrollUntilVisible:
    element:
      id: "footer"
    direction: DOWN

# Swipe gesture with start/end points
- swipe:
    start: "50%, 80%"
    end: "50%, 20%"
    duration: 500  # milliseconds
```

#### Assertions and Waiting

```yaml
# Assert element is visible
- assertVisible: "Welcome"

# Assert by ID
- assertVisible:
    id: "welcome_message"

# Assert with partial text match
- assertVisible:
    containsText: "Welc"

# Assert with timeout
- assertVisible:
    text: "Loading Complete"
    timeout: 15000  # milliseconds

# Assert element is NOT visible
- assertNotVisible: "Loading..."

# Assert by ID not visible
- assertNotVisible:
    id: "error_message"

# Wait for element (with timeout)
- extendedWaitUntil:
    visible:
      text: "Dashboard"
    timeout: 10000

# Wait for element by ID
- extendedWaitUntil:
    visible:
      id: "main_content"
    timeout: 10000

# Wait for animation to complete
- waitForAnimationToEnd:
    timeout: 5000
```

#### App Control

```yaml
# Launch app (uses appId from config)
- launchApp

# Launch specific app with options
- launchApp:
    appId: "com.example.myapp"
    clearState: true      # Reset app data
    clearKeychain: true   # Clear keychain entries
    stopApp: true         # Stop if running first

# Stop current app
- stopApp

# Stop specific app
- stopApp: "com.example.myapp"

# Open deep link or URL
- openLink: "myapp://settings"
- openLink: "https://example.com/login"
```

#### Screenshots and Utility

```yaml
# Take screenshot (auto-named)
- takeScreenshot

# Take named screenshot
- takeScreenshot: "login_page"

# Press hardware keys
- pressKey: home
- pressKey: back
- pressKey: enter
- pressKey: backspace
- pressKey: volume_up
- pressKey: volume_down

# Wait (in milliseconds)
- wait: 2000
```

#### Complete Flow Example

```yaml
appId: com.example.myapp
name: Login Flow
tags:
  - auth
  - smoke
env:
  TEST_EMAIL: test@example.com
  TEST_PASSWORD: password123
---
# Launch the app fresh
- launchApp:
    clearState: true

# Wait for login screen
- assertVisible: "Sign In"

# Enter credentials
- tapOn:
    id: "email_field"
- inputText: "${TEST_EMAIL}"
- tapOn:
    id: "password_field"
- inputText: "${TEST_PASSWORD}"

# Submit
- tapOn: "Sign In"

# Wait for dashboard
- extendedWaitUntil:
    visible:
      text: "Welcome"
    timeout: 10000

# Verify success and capture
- assertVisible: "Welcome"
- takeScreenshot: "login_success"
```

### Inline Action Shortcuts

When using `--inline`, these shorthand formats are supported:

| Shorthand | Description | Example |
|-----------|-------------|---------|
| `tap:<text>` | Tap element by text | `tap:Login` |
| `tapid:<id>` | Tap element by accessibility ID | `tapid:login_button` |
| `type:<text>` | Input text | `type:hello@example.com` |
| `scroll:<dir>` | Scroll direction | `scroll:down` |
| `screenshot` | Take screenshot | `screenshot` |
| `screenshot:<name>` | Named screenshot | `screenshot:login` |
| `visible:<text>` | Assert visible | `visible:Welcome` |
| `notvisible:<text>` | Assert not visible | `notvisible:Error` |
| `wait:<ms>` | Wait duration | `wait:2000` |
| `waitfor:<text>` | Wait for element | `waitfor:Dashboard` |
| `press:<key>` | Press key | `press:home` |
| `open:<url>` | Open URL | `open:myapp://home` |
| `launchapp` | Launch app | `launchapp` |
| `launchapp:<id>` | Launch specific app | `launchapp:com.example.app` |
| `stopapp` | Stop app | `stopapp` |
| `hidekeyboard` | Hide keyboard | `hidekeyboard` |
| `erasetext` | Erase text | `erasetext` |

**Example inline flow**:
```
/ios.run_flow --inline "launchapp:com.example.app" "waitfor:Login" "tap:Login" "type:user@example.com" "tap:Submit" "visible:Welcome" "screenshot:success"
```

### Auto Run Integration

Use `ios.run_flow` in playbook YAML files:

```yaml
name: iOS Login Test
steps:
  - action: ios.run_flow
    inputs:
      flow: flows/login_flow.yaml
      app: com.example.myapp
      simulator: "iPhone 15 Pro"
      timeout: 120
      retry: 2
    store_as: flow_result

  - action: assert
    inputs:
      condition: "{{ variables.flow_result.passed }}"
      message: "Login flow should pass"

  - action: message
    content: |
      Flow completed in {{flow_result.durationSeconds}}s
      Steps: {{flow_result.passedSteps}}/{{flow_result.totalSteps}}
```

### Action Inputs for Auto Run

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `flow` | string | Yes | - | Path to flow YAML file |
| `app` | string | No | - | Bundle ID to target |
| `simulator` | string | No | First booted | Simulator name or UDID |
| `timeout` | number | No | 300 | Timeout in seconds |
| `retry` | number | No | 1 | Retry attempts |
| `continue_on_error` | boolean | No | false | Continue past failures |
| `env` | object | No | - | Environment variables |

### Action Outputs for Auto Run

When using `store_as`, these fields are available:

| Output | Type | Description |
|--------|------|-------------|
| `passed` | boolean | Whether flow passed |
| `duration` | number | Duration in milliseconds |
| `durationSeconds` | string | Duration as string (e.g., "12.5") |
| `totalSteps` | number | Total steps in flow |
| `passedSteps` | number | Number of passed steps |
| `failedSteps` | number | Number of failed steps |
| `error` | string | Error message if failed |
| `failureScreenshotPath` | string | Path to failure screenshot |
| `reportPath` | string | Path to HTML report |

### Troubleshooting

#### "Maestro CLI not installed" Error

Install Maestro Mobile CLI:
```bash
brew tap mobile-dev-inc/tap && brew install maestro
```

Or:
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

#### "No simulator booted" Error

Ensure a simulator is running:
```bash
xcrun simctl list devices booted
xcrun simctl boot "iPhone 15 Pro"
```

#### Flow Validation Errors

Validate your YAML syntax:
```bash
maestro validate path/to/flow.yaml
```

#### Element Not Found

- Check element accessibility IDs using Xcode Accessibility Inspector
- Use `/ios.snapshot` to capture current UI state
- Try using `containsText` for partial matches:
  ```yaml
  - tapOn:
      containsText: "Log"
  ```

#### Timeout Errors

- Increase `--timeout` value
- Add explicit waits before actions:
  ```yaml
  - extendedWaitUntil:
      visible:
        text: "Login"
      timeout: 15000
  ```

#### Flaky Tests

- Use `--retry` to automatically retry on failure
- Add `wait` steps between rapid actions
- Use `waitForAnimationToEnd` before assertions

## Primitive Interaction Commands

For direct UI interactions without YAML flow files, Maestro provides primitive commands that tap, type, scroll, and swipe on iOS simulator elements. These commands use the native XCUITest driver internally.

<Note>
The native XCUITest driver is not yet fully implemented. While these commands are available, they currently return "not yet implemented". For production use, prefer Maestro Mobile flows via `/ios.run_flow`.
</Note>

### The `/ios.tap` Command

Tap an element on the iOS simulator by accessibility identifier, label, or coordinates.

```
/ios.tap <target> --app <bundleId>
```

#### Target Formats

| Format | Description | Example |
|--------|-------------|---------|
| `#identifier` | Tap by accessibility ID | `/ios.tap #login_button --app com.example.app` |
| `"label text"` | Tap by accessibility label | `/ios.tap "Sign In" --app com.example.app` |
| `x,y` | Tap at screen coordinates | `/ios.tap 100,200 --app com.example.app` |

#### Command Options

| Option | Short | Description |
|--------|-------|-------------|
| `--app <bundleId>` | `-a` | App bundle ID (required) |
| `--simulator <name\|udid>` | `-s` | Target simulator (default: first booted) |
| `--double` | | Perform double tap instead of single tap |
| `--long [seconds]` | | Perform long press (default: 1.0 seconds) |
| `--offset <x,y>` | | Offset from element center for tap |
| `--timeout <ms>` | | Element wait timeout (default: 10000) |
| `--debug` | | Enable debug output |

#### Examples

**Tap by accessibility identifier**:
```
/ios.tap #submit_button --app com.example.app
```

**Tap by label**:
```
/ios.tap "Continue" -a com.example.app
```

**Tap at coordinates**:
```
/ios.tap 150,300 --app com.example.app
```

**Double tap**:
```
/ios.tap #image_view --double --app com.example.app
```

**Long press for 2 seconds**:
```
/ios.tap #delete_button --long 2 --app com.example.app
```

**Tap with offset from element center**:
```
/ios.tap #cell --offset 10,-5 --app com.example.app
```

### The `/ios.type` Command

Type text into the focused element or a specific text field.

```
/ios.type "text" --app <bundleId>
/ios.type --into <target> "text" --app <bundleId>
```

#### Target Formats (for --into)

| Format | Description | Example |
|--------|-------------|---------|
| `#identifier` | Type into element by accessibility ID | `--into #email_field` |
| `"label text"` | Type into element by label | `--into "Email"` |

#### Command Options

| Option | Short | Description |
|--------|-------|-------------|
| `--app <bundleId>` | `-a` | App bundle ID (required) |
| `--into <target>` | `-i` | Target element to type into (default: focused element) |
| `--simulator <name\|udid>` | `-s` | Target simulator (default: first booted) |
| `--clear` | `-c` | Clear existing text before typing |
| `--timeout <ms>` | | Element wait timeout (default: 10000) |
| `--debug` | | Enable debug output |

#### Examples

**Type into focused element**:
```
/ios.type "hello world" --app com.example.app
```

**Type into specific field by ID**:
```
/ios.type --into #email_field "user@example.com" --app com.example.app
```

**Type into field by label**:
```
/ios.type -i "Password" "secret123" -a com.example.app
```

**Clear field before typing**:
```
/ios.type --into #search_field "new query" --clear --app com.example.app
```

### The `/ios.scroll` Command

Scroll in a direction or scroll until an element is visible.

```
/ios.scroll <direction> --app <bundleId>
/ios.scroll --to <target> --app <bundleId>
```

#### Directions

| Direction | Aliases | Description |
|-----------|---------|-------------|
| `up` | `u` | Scroll up |
| `down` | `d` | Scroll down |
| `left` | `l` | Scroll left |
| `right` | `r` | Scroll right |

#### Target Formats (for --to)

| Format | Description | Example |
|--------|-------------|---------|
| `#identifier` | Scroll to element by accessibility ID | `--to #footer` |
| `"label text"` | Scroll to element by label | `--to "Terms of Service"` |

#### Command Options

| Option | Short | Description |
|--------|-------|-------------|
| `--app <bundleId>` | `-a` | App bundle ID (required) |
| `--to <target>` | `-t` | Target element to scroll to |
| `--simulator <name\|udid>` | `-s` | Target simulator (default: first booted) |
| `--distance <n>` | | Scroll distance as fraction (0.0-1.0, default: 0.5) |
| `--attempts <n>` | | Max scroll attempts when targeting element (default: 10) |
| `--in <target>` | | Scroll within a specific container element |
| `--timeout <ms>` | | Element wait timeout (default: 10000) |
| `--debug` | | Enable debug output |

#### Examples

**Scroll down**:
```
/ios.scroll down --app com.example.app
```

**Scroll with custom distance**:
```
/ios.scroll up --distance 0.8 --app com.example.app
```

**Scroll to specific element**:
```
/ios.scroll --to #footer_element --app com.example.app
```

**Scroll to element by label**:
```
/ios.scroll --to "Privacy Policy" -a com.example.app
```

**Scroll within a container**:
```
/ios.scroll down --in #scroll_view --app com.example.app
```

**Scroll to element with more attempts**:
```
/ios.scroll --to #end_of_list --attempts 20 --app com.example.app
```

### The `/ios.swipe` Command

Perform swipe gestures for navigation and UI interactions.

```
/ios.swipe <direction> --app <bundleId>
```

#### Directions

| Direction | Aliases | Common Use Cases |
|-----------|---------|-----------------|
| `up` | `u` | Dismiss modal, pull to refresh |
| `down` | `d` | Dismiss notification |
| `left` | `l` | Delete action, next page |
| `right` | `r` | Back navigation |

#### Command Options

| Option | Short | Description |
|--------|-------|-------------|
| `--app <bundleId>` | `-a` | App bundle ID (required) |
| `--simulator <name\|udid>` | `-s` | Target simulator (default: first booted) |
| `--velocity <v>` | `-v` | Swipe velocity: `slow`, `normal`, `fast` (default: normal) |
| `--from <target>` | | Start swipe from specific element |
| `--timeout <ms>` | | Element wait timeout (default: 10000) |
| `--debug` | | Enable debug output |

#### Target Formats (for --from)

| Format | Description | Example |
|--------|-------------|---------|
| `#identifier` | Swipe from element by accessibility ID | `--from #carousel` |
| `"label text"` | Swipe from element by label | `--from "Image Gallery"` |

#### Examples

**Swipe left (e.g., for delete action)**:
```
/ios.swipe left --app com.example.app
```

**Swipe right (e.g., for back navigation)**:
```
/ios.swipe right -a com.example.app
```

**Fast swipe up**:
```
/ios.swipe up --velocity fast --app com.example.app
```

**Swipe on a specific element**:
```
/ios.swipe left --from #carousel --app com.example.app
```

**Swipe from element by label**:
```
/ios.swipe right --from "Card View" -a com.example.app
```

### Auto Run Integration for Primitives

Use primitive commands in playbook YAML files:

```yaml
name: iOS Interaction Workflow
steps:
  - action: ios.tap
    inputs:
      target: "#login_button"
      app: com.example.myapp
    store_as: tap_result

  - action: ios.type
    inputs:
      into: "#email_field"
      text: "user@example.com"
      app: com.example.myapp
      clear: true

  - action: ios.type
    inputs:
      into: "#password_field"
      text: "password123"
      app: com.example.myapp

  - action: ios.tap
    inputs:
      target: "#submit_button"
      app: com.example.myapp

  - action: ios.scroll
    inputs:
      direction: down
      app: com.example.myapp
      distance: 0.5

  - action: ios.scroll
    inputs:
      to: "#footer_element"
      app: com.example.myapp
      attempts: 15

  - action: ios.swipe
    inputs:
      direction: left
      app: com.example.myapp
      velocity: fast
```

#### Action Inputs

**ios.tap**:

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `target` | string | Yes | - | Target element (#id, "label", or x,y) |
| `app` | string | Yes | - | Bundle ID |
| `simulator` | string | No | First booted | Simulator name or UDID |
| `double_tap` | boolean | No | false | Perform double tap |
| `long_press` | number | No | - | Long press duration in seconds |
| `offset` | object | No | - | Offset from center (`{x, y}`) |
| `timeout` | number | No | 10000 | Timeout in ms |

**ios.type**:

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `text` | string | Yes | - | Text to type |
| `into` | string | No | Focused | Target element (#id or "label") |
| `app` | string | Yes | - | Bundle ID |
| `simulator` | string | No | First booted | Simulator name or UDID |
| `clear` | boolean | No | false | Clear existing text first |
| `timeout` | number | No | 10000 | Timeout in ms |

**ios.scroll**:

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `direction` | string | No* | - | Scroll direction (up/down/left/right) |
| `to` | string | No* | - | Target element to scroll to |
| `app` | string | Yes | - | Bundle ID |
| `simulator` | string | No | First booted | Simulator name or UDID |
| `distance` | number | No | 0.5 | Scroll distance (0.0-1.0) |
| `attempts` | number | No | 10 | Max scroll attempts for --to |
| `in` | string | No | - | Container to scroll within |
| `timeout` | number | No | 10000 | Timeout in ms |

*Either `direction` or `to` is required.

**ios.swipe**:

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `direction` | string | Yes | - | Swipe direction (up/down/left/right) |
| `app` | string | Yes | - | Bundle ID |
| `simulator` | string | No | First booted | Simulator name or UDID |
| `velocity` | string | No | normal | Swipe velocity (slow/normal/fast) |
| `from` | string | No | - | Element to start swipe from |
| `timeout` | number | No | 10000 | Timeout in ms |

### Troubleshooting Primitives

#### Element Not Found

- Use `/ios.inspect` to view the current UI hierarchy
- Verify accessibility identifiers/labels match exactly (case-sensitive)
- Increase timeout if elements appear after animations: `--timeout 15000`
- Try alternate targeting (ID vs label)

#### Element Not Hittable

- Ensure element is visible on screen
- Check if element is obscured by another view
- Scroll to reveal the element first
- Verify element is enabled for interaction

#### Coordinator/Display Errors

- Ensure the simulator is in foreground
- Check that the app is running and responsive
- Try restarting the simulator

#### Using Maestro Mobile Instead

Until the native driver is fully implemented, use Maestro Mobile flows for reliable interactions:

```
# Instead of: /ios.tap #login_button --app com.example.app
/ios.run_flow --inline "tap:Login" --app com.example.app

# Instead of: /ios.type "hello" --app com.example.app
/ios.run_flow --inline "inputText:hello" --app com.example.app

# Instead of: /ios.scroll down --app com.example.app
/ios.run_flow --inline "scroll:down" --app com.example.app
```

## Native Driver Swift Integration

The primitive commands (`/ios.tap`, `/ios.type`, `/ios.scroll`, `/ios.swipe`) are powered by a native XCUITest driver that provides direct access to iOS UI testing APIs. This section documents the Swift integration architecture for developers extending or maintaining the native driver.

<Note>
The native driver is not yet fully implemented—execution currently returns "not yet implemented". The Swift code and TypeScript wrapper are complete and ready for when XCUITest project building is implemented. For production use, prefer Maestro Mobile flows via `/ios.run_flow`.
</Note>

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript Layer                          │
│  src/main/ios-tools/native-driver.ts                        │
│  - NativeDriver class                                        │
│  - Target helpers (byId, byLabel, byCoordinates, etc.)      │
│  - Action helpers (tap, doubleTap, typeText, etc.)          │
└──────────────────────────┬──────────────────────────────────┘
                           │ JSON ActionRequest
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Swift Layer                              │
│  src/main/ios-tools/xcuitest-driver/                        │
│  - ActionTypes.swift   - Action and target definitions       │
│  - ActionResult.swift  - Result serialization with markers   │
│  - ActionRunner.swift  - Main action executor                │
└──────────────────────────┬──────────────────────────────────┘
                           │ XCUITest APIs
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    iOS Simulator                             │
│  - XCUIApplication                                           │
│  - XCUIElement interactions                                  │
└─────────────────────────────────────────────────────────────┘
```

### Swift Components

The native driver consists of three Swift files in `src/main/ios-tools/xcuitest-driver/`:

#### ActionTypes.swift

Defines all action types and target specifications. Designed to be JSON-deserializable from TypeScript.

**Action Types:**

| Type | Description |
|------|-------------|
| `tap` | Single tap on element |
| `doubleTap` | Double tap on element |
| `longPress` | Long press with duration |
| `typeText` | Type text into element |
| `clearText` | Clear text from element |
| `scroll` | Scroll in direction |
| `scrollTo` | Scroll until element visible |
| `swipe` | Swipe gesture |
| `pinch` | Pinch gesture for zoom |
| `rotate` | Rotation gesture |
| `waitForElement` | Wait for element to exist |
| `waitForNotExist` | Wait for element to disappear |
| `assertExists` | Verify element exists |
| `assertNotExists` | Verify element does not exist |
| `assertEnabled` | Verify element is enabled |
| `assertDisabled` | Verify element is disabled |

**Target Types:**

| Type | Description | Example Value |
|------|-------------|---------------|
| `identifier` | Accessibility identifier | `"login_button"` |
| `label` | Accessibility label | `"Sign In"` |
| `text` | Text content (label or value) | `"Welcome"` |
| `predicate` | NSPredicate format | `"label BEGINSWITH 'Sign'"` |
| `coordinates` | Screen coordinates | `"150,300"` |
| `type` | Element type with optional index | `"button"` |

**Direction and Velocity:**

```swift
enum SwipeDirection: String, Codable {
    case up, down, left, right
}

enum SwipeVelocity: String, Codable {
    case slow    // XCUIGestureVelocity.slow
    case normal  // XCUIGestureVelocity.default
    case fast    // XCUIGestureVelocity.fast
}
```

#### ActionResult.swift

Handles result serialization with JSON markers for extraction from mixed stdout output.

**Output Markers:**

```swift
// Results are wrapped with markers for extraction
===MAESTRO_ACTION_RESULT_START===
{ "success": true, "status": "success", ... }
===MAESTRO_ACTION_RESULT_END===
```

**Status Codes:**

| Status | Description |
|--------|-------------|
| `success` | Action completed successfully |
| `failed` | Action failed (generic) |
| `timeout` | Element wait timed out |
| `notFound` | Element not found |
| `notHittable` | Element found but not tappable |
| `notEnabled` | Element is disabled |
| `error` | Unexpected error |

**Result Structure:**

```json
{
  "success": true,
  "status": "success",
  "actionType": "tap",
  "duration": 245,
  "timestamp": "2024-01-15T10:30:00Z",
  "details": {
    "element": {
      "type": "button",
      "identifier": "login_button",
      "label": "Sign In",
      "frame": { "x": 100, "y": 200, "width": 80, "height": 44 },
      "isEnabled": true,
      "isHittable": true
    }
  }
}
```

#### ActionRunner.swift

The main action executor that finds elements and performs interactions using XCUITest APIs.

**Key Methods:**

```swift
class ActionRunner {
    let app: XCUIApplication
    var defaultTimeout: TimeInterval = 10.0
    var screenshotOnFailure: Bool = true

    // Execute a single action
    func execute(_ request: ActionRequest) -> ActionResult

    // Execute multiple actions in sequence
    func executeAll(_ requests: [ActionRequest], stopOnFailure: Bool = true) -> BatchActionResult
}
```

**Element Finding:**

The `findElement` method supports all target types:

```swift
private func findElement(_ target: ActionTarget, timeout: TimeInterval? = nil) throws -> XCUIElement {
    switch target.type {
    case .identifier:
        // app.descendants(matching: .any).matching(identifier: "...")
    case .label:
        // NSPredicate(format: "label == %@", label)
    case .text:
        // NSPredicate(format: "label CONTAINS %@ OR value CONTAINS %@", ...)
    case .predicate:
        // NSPredicate(format: predicateString)
    case .coordinates:
        // app.windows.firstMatch + normalized coordinates
    case .type:
        // app.descendants(matching: xcType)
    }
}
```

**Error Handling with Suggestions:**

When an element is not found, the driver searches for similar elements to provide suggestions:

```swift
private func findSimilarElements(_ target: ActionTarget) -> [String] {
    // Searches buttons, text fields, static texts
    // Returns identifiers/labels containing the search term
    // Limited to 5 suggestions
}
```

### TypeScript API

The TypeScript wrapper in `src/main/ios-tools/native-driver.ts` provides a high-level API.

#### Target Helpers

```typescript
import { byId, byLabel, byText, byPredicate, byCoordinates, byType } from './native-driver';

// By accessibility identifier
const target1 = byId('login_button');

// By accessibility label
const target2 = byLabel('Sign In');

// By text content
const target3 = byText('Welcome');

// By NSPredicate
const target4 = byPredicate('label BEGINSWITH "Sign"');

// By screen coordinates
const target5 = byCoordinates(150, 300);

// By element type with optional index
const target6 = byType('button', 0);  // First button
```

#### Action Helpers

```typescript
import {
  tap, doubleTap, longPress,
  typeText, clearText,
  scroll, scrollTo, swipe,
  pinch, rotate,
  waitForElement, waitForNotExist,
  assertExists, assertNotExists, assertEnabled, assertDisabled
} from './native-driver';

// Tap actions
const tapAction = tap(byId('button'));
const tapWithOffset = tap(byId('cell'), { offsetX: 0.9, offsetY: 0.5 });
const doubleTapAction = doubleTap(byLabel('Image'));
const longPressAction = longPress(byId('delete'), 2.0);  // 2 seconds

// Text actions
const typeAction = typeText('hello@example.com');
const typeIntoAction = typeText('password', { target: byId('password_field'), clearFirst: true });
const clearAction = clearText(byId('search_field'));

// Scroll/swipe actions
const scrollAction = scroll('down', { distance: 0.5 });
const scrollToAction = scrollTo(byId('footer'), { maxAttempts: 15 });
const swipeAction = swipe('left', { velocity: 'fast' });

// Gesture actions
const pinchAction = pinch(2.0, { target: byId('image') });  // Zoom in
const rotateAction = rotate(Math.PI / 4);  // 45 degrees

// Wait actions
const waitAction = waitForElement(byId('loading'), 5000);
const waitGoneAction = waitForNotExist(byLabel('Spinner'), 10000);

// Assert actions
const assertAction = assertExists(byId('welcome_message'));
const assertGoneAction = assertNotExists(byId('error'));
const assertEnabledAction = assertEnabled(byId('submit_button'));
```

#### NativeDriver Class

```typescript
import { NativeDriver, createNativeDriver } from './native-driver';

// Create driver instance
const driver = createNativeDriver({
  bundleId: 'com.example.myapp',
  udid: 'SIMULATOR_UDID',  // Optional, auto-detects if omitted
  timeout: 10000,           // Default element timeout (ms)
  screenshotDir: '/path/to/screenshots',
  debug: true
});

// Initialize (verifies simulator, etc.)
await driver.initialize();

// Execute single action
const result = await driver.execute(tap(byId('login')));

// Execute batch of actions
const batchResult = await driver.executeAll([
  tap(byId('email_field')),
  typeText('user@example.com'),
  tap(byId('password_field')),
  typeText('password123'),
  tap(byId('login_button'))
], { stopOnFailure: true });

// Convenience methods
await driver.tapById('submit_button');
await driver.tapByLabel('Continue');
await driver.tapAt(150, 300);
await driver.type('hello world');
await driver.typeInto('search_field', 'query', true);  // clearFirst=true
await driver.scrollDown(0.5);
await driver.scrollUp(0.5);
await driver.scrollToId('footer_element', 15);  // maxAttempts=15
await driver.swipeDirection('left');
await driver.waitFor('loading_indicator', 5000);
await driver.waitForGone('spinner', 10000);
await driver.assertElementExists('welcome_message');
await driver.assertElementNotExists('error_banner');
```

### Result Types

```typescript
interface ActionResult {
  success: boolean;
  status: 'success' | 'failed' | 'timeout' | 'notFound' | 'notHittable' | 'notEnabled' | 'error';
  actionType: ActionType;
  duration: number;  // milliseconds
  error?: string;
  details?: {
    element?: ElementInfo;
    suggestions?: string[];  // Alternative targets on notFound
    typedText?: string;
    scrollAttempts?: number;
    direction?: string;
    screenshotPath?: string;
  };
  timestamp: string;  // ISO8601
}

interface BatchActionResult {
  allPassed: boolean;
  totalActions: number;
  passedActions: number;
  failedActions: number;
  totalDuration: number;
  results: ActionResult[];
  timestamp: string;
}
```

### Extending the Native Driver

To add a new action type:

1. **Swift: ActionTypes.swift**
   ```swift
   // Add to ActionType enum
   enum ActionType: String, Codable {
       // ... existing types
       case newAction
   }

   // Create action struct
   struct NewAction: Action, Codable {
       let actionType = ActionType.newAction
       let target: ActionTarget
       let customParam: String
   }

   // Add to ActionRequest if needed
   struct ActionRequest: Codable {
       // ... existing fields
       let customParam: String?
   }
   ```

2. **Swift: ActionRunner.swift**
   ```swift
   private func executeAction(_ request: ActionRequest) throws -> ActionResult {
       switch request.type {
       // ... existing cases
       case .newAction:
           return try executeNewAction(request, startTime: startTime)
       }
   }

   private func executeNewAction(_ request: ActionRequest, startTime: Date) throws -> ActionResult {
       // Implementation
   }
   ```

3. **TypeScript: native-driver.ts**
   ```typescript
   // Add to ActionType union
   export type ActionType = /* existing */ | 'newAction';

   // Add action helper
   export function newAction(target: ActionTarget, customParam: string): ActionRequest {
       return { type: 'newAction', target, customParam };
   }

   // Add convenience method to NativeDriver class
   async newActionById(identifier: string, customParam: string): Promise<IOSResult<ActionResult>> {
       return this.execute(newAction(byId(identifier), customParam));
   }
   ```

### Element Type Mappings

The Swift driver maps string element types to XCUIElement.ElementType:

| String | XCUIElement.ElementType |
|--------|------------------------|
| `button` | `.button` |
| `textField`, `text_field` | `.textField` |
| `secureTextField`, `password` | `.secureTextField` |
| `staticText`, `text` | `.staticText` |
| `image` | `.image` |
| `switch`, `toggle` | `.switch` |
| `slider` | `.slider` |
| `picker` | `.picker` |
| `datePicker`, `date_picker` | `.datePicker` |
| `table` | `.table` |
| `cell` | `.cell` |
| `collectionView` | `.collectionView` |
| `scrollView` | `.scrollView` |
| `navigationBar` | `.navigationBar` |
| `tabBar` | `.tabBar` |
| `toolbar` | `.toolbar` |
| `alert` | `.alert` |
| `sheet` | `.sheet` |
| `searchField` | `.searchField` |
| `textView` | `.textView` |
| `link` | `.link` |
| `menu` | `.menu` |
| `menuItem` | `.menuItem` |
| `webView` | `.webView` |
| `window` | `.window` |
| `any` | `.any` |

### Hardware Key Codes

For keyboard interactions:

| KeyCode | XCUIKeyboardKey |
|---------|-----------------|
| `return` | `.return` |
| `delete` | `.delete` |
| `escape` | `.escape` |
| `tab` | `.tab` |
| `space` | `.space` |
| `up` | `.upArrow` |
| `down` | `.downArrow` |
| `left` | `.leftArrow` |
| `right` | `.rightArrow` |
| `home` | `.home` |
| `end` | `.end` |
| `pageUp` | `.pageUp` |
| `pageDown` | `.pageDown` |

## Example Flows

The `docs/examples/ios-flows/` directory contains ready-to-use Maestro Mobile flow templates for common iOS automation scenarios. Each example demonstrates best practices for UI testing.

### Available Examples

| Flow | Description | Key Patterns |
|------|-------------|--------------|
| `login-flow.yaml` | Complete authentication flow | Env vars, assertions, screenshots |
| `onboarding-flow.yaml` | Multi-screen onboarding | Swipe gestures, carousel navigation |
| `search-flow.yaml` | Search and results | Text input, keyboard, scrolling |
| `form-validation-flow.yaml` | Input validation | Error states, field clearing |
| `settings-navigation-flow.yaml` | Settings hierarchy | Toggle switches, nested navigation |
| `shopping-cart-flow.yaml` | E-commerce checkout | Cart management, promo codes |
| `pull-to-refresh-flow.yaml` | Refresh gestures | Pull-to-refresh, animation waits |
| `deep-link-flow.yaml` | URL schemes | Deep links, universal links |
| `photo-picker-flow.yaml` | Photo selection | Permissions, image upload |
| `logout-flow.yaml` | User logout | Session cleanup, confirmation dialogs |

### Quick Start

1. **Copy an example** to your project:
   ```bash
   cp docs/examples/ios-flows/login-flow.yaml my-flows/
   ```

2. **Update the bundle ID**:
   ```yaml
   appId: com.yourcompany.yourapp
   ```

3. **Update element identifiers** to match your app's accessibility IDs

4. **Run the flow**:
   ```
   /ios.run_flow my-flows/login-flow.yaml
   ```

### Login Flow Example

A complete authentication flow demonstrating credentials entry and success verification:

```yaml
appId: com.example.myapp
name: Login Flow
env:
  TEST_EMAIL: test@example.com
  TEST_PASSWORD: SecurePass123!
---
- launchApp:
    clearState: true

- assertVisible: "Sign In"
- takeScreenshot: "01-login-screen"

- tapOn:
    id: "email_field"
- inputText: "${TEST_EMAIL}"

- tapOn:
    id: "password_field"
- inputText: "${TEST_PASSWORD}"

- tapOn: "Sign In"

- extendedWaitUntil:
    visible:
      text: "Welcome"
    timeout: 15000

- assertVisible: "Welcome"
- takeScreenshot: "02-login-success"
```

### Form Validation Example

Testing input validation and error states:

```yaml
appId: com.example.myapp
name: Form Validation
---
- launchApp
- tapOn: "Create Account"

# Test empty form submission
- tapOn: "Submit"
- assertVisible: "Email is required"
- assertVisible: "Password is required"

# Test invalid email
- tapOn:
    id: "email_field"
- inputText: "invalid-email"
- tapOn: "Submit"
- assertVisible: "Please enter a valid email"

# Fix and submit
- tapOn:
    id: "email_field"
- eraseText
- inputText: "valid@example.com"
- tapOn:
    id: "password_field"
- inputText: "ValidPass123!"
- tapOn: "Submit"

- assertVisible: "Account created"
```

### E-Commerce Cart Example

Shopping cart with quantity changes and promo codes:

```yaml
appId: com.example.store
name: Shopping Cart
env:
  PROMO_CODE: SAVE20
---
- launchApp
- tapOn: "Shop"

# Add product to cart
- tapOn:
    id: "product_0"
- tapOn: "Add to Cart"
- tapOn:
    id: "back_button"

# Go to cart
- tapOn:
    id: "cart_button"
- assertVisible: "Your Cart"

# Apply promo code
- tapOn:
    id: "promo_code_field"
- inputText: "${PROMO_CODE}"
- tapOn: "Apply"
- assertVisible: "Discount applied"

# Checkout
- tapOn: "Checkout"
- tapOn: "Credit Card"
- tapOn: "Confirm Order"

- extendedWaitUntil:
    visible:
      text: "Order Confirmed"
    timeout: 15000
```

### Deep Link Example

Testing URL scheme handling:

```yaml
appId: com.example.myapp
name: Deep Link Handling
---
- launchApp:
    clearState: true

# Open product via deep link
- openLink: "myapp://product/12345"
- assertVisible: "Product Details"

# Open settings page
- openLink: "myapp://settings/notifications"
- assertVisible: "Notification Settings"

# Handle universal link
- openLink: "https://example.com/share/abc123"
- assertVisible: "Shared Content"
```

### Best Practices in Examples

1. **Environment Variables** - Sensitive data like passwords stored in `env`
2. **Strategic Screenshots** - Numbered screenshots at key verification points
3. **Explicit Waits** - `extendedWaitUntil` instead of arbitrary delays
4. **Clean State** - `clearState: true` for consistent test starts
5. **Accessibility IDs** - Prefer `id` over text matching for reliability
6. **Scroll Until Visible** - Handle off-screen elements gracefully

See the [README](examples/ios-flows/README.md) in the examples directory for more customization tips and troubleshooting

## iOS Assertion Commands

Maestro provides verification assertions for automated testing workflows. These assertions help prove that features work correctly by checking UI state, text content, and system behavior.

### Overview

All assertions share common behaviors:

- **Polling**: Assertions poll at configurable intervals (default: 500ms) until the condition is met or timeout is reached
- **Timeout**: Maximum wait time before assertion fails (default: 10s)
- **Evidence capture**: Screenshots are automatically captured on failure
- **Retry support**: Transient failures can be retried with exponential backoff

### Common Options

All assertion commands accept these base options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--simulator <udid>` | string | First booted | Target simulator by UDID |
| `--timeout <ms>` | number | 10000 | Maximum time to wait for condition |
| `--poll-interval <ms>` | number | 500 | Interval between checks |
| `--retry <count>` | number | 0 | Number of retry attempts on failure |

### Element Visibility Assertions

#### `/ios.assert_visible`

Verify an element is visible on screen.

```
/ios.assert_visible <target> [--timeout <ms>] [--require-enabled]
```

**Target Formats:**

| Format | Description | Example |
|--------|-------------|---------|
| `#identifier` | Accessibility identifier | `#login_button` |
| `@label` | Accessibility label | `@"Sign In"` |
| `"text"` | Text content | `"Welcome"` |
| `Type#id` | Type + identifier | `Button#submit` |

**Examples:**
```
/ios.assert_visible #login_button
/ios.assert_visible "Welcome to App"
/ios.assert_visible @"Sign In" --timeout 15000
/ios.assert_visible Button#submit --require-enabled
```

#### `/ios.assert_not_visible`

Verify an element is NOT visible (or doesn't exist).

```
/ios.assert_not_visible <target> [--timeout <ms>]
```

Useful for verifying:
- Modals/dialogs have closed
- Loading spinners have disappeared
- Error messages are not shown

**Examples:**
```
/ios.assert_not_visible #loading_spinner
/ios.assert_not_visible "Error occurred"
/ios.assert_not_visible @"Loading..." --timeout 30000
```

#### `/ios.wait_for`

Wait for an element to appear (returns element info when found).

```
/ios.wait_for <target> [--timeout <ms>] [--not]
```

| Option | Description |
|--------|-------------|
| `--not` | Wait for element to disappear instead |

**Examples:**
```
/ios.wait_for #home_screen
/ios.wait_for "Dashboard loaded" --timeout 20000
/ios.wait_for #loading_indicator --not
```

### Text & Content Assertions

#### `/ios.assert_text`

Verify element text matches expected value.

```
/ios.assert_text <target> <expected> [--mode <mode>] [--case-insensitive]
```

**Match Modes:**

| Mode | Description | Example Usage |
|------|-------------|---------------|
| `exact` (default) | Text equals expected exactly | `"John Doe"` |
| `contains` | Text includes expected substring | `"contains Welcome"` |
| `startsWith` | Text starts with expected | `"starts with Hello"` |
| `endsWith` | Text ends with expected | `"ends with !"` |
| `regex` | Text matches regex pattern | `"regex .*@.*\\.com"` |

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--mode <mode>` | exact | Match mode (exact/contains/startsWith/endsWith/regex) |
| `--case-insensitive` | false | Ignore case when matching |
| `--property <prop>` | any | Check 'label', 'value', or 'any' |

**Examples:**
```
/ios.assert_text #username_label "John Doe"
/ios.assert_text #status "Success" --mode contains
/ios.assert_text #email "EMAIL" --case-insensitive
/ios.assert_text #price "\\$\\d+\\.\\d{2}" --mode regex
```

#### `/ios.assert_value`

Verify an input field's value (for text fields, switches, etc.).

```
/ios.assert_value <target> <expected> [--mode <mode>]
```

Same match modes as `assert_text`. Additionally supports:

| Mode | Description |
|------|-------------|
| `empty` | Value is empty or nil |
| `notEmpty` | Value has content |

**Examples:**
```
/ios.assert_value #email_field "user@example.com"
/ios.assert_value #search_input "" --mode empty
/ios.assert_value #password_field --mode notEmpty
```

### State Assertions

#### `/ios.assert_enabled`

Verify element is enabled for interaction.

```
/ios.assert_enabled <target> [--timeout <ms>]
```

**Examples:**
```
/ios.assert_enabled #submit_button
/ios.assert_enabled @"Continue"
```

#### `/ios.assert_disabled`

Verify element is disabled.

```
/ios.assert_disabled <target> [--timeout <ms>]
```

**Examples:**
```
/ios.assert_disabled #submit_button  # Before form is filled
/ios.assert_disabled @"Next" --timeout 5000
```

#### `/ios.assert_selected`

Verify element is selected (for tabs, checkboxes, toggles).

```
/ios.assert_selected <target> [--timeout <ms>]
/ios.assert_selected <target> --not  # Assert NOT selected
```

**Examples:**
```
/ios.assert_selected #dark_mode_toggle
/ios.assert_selected @"Profile Tab"
/ios.assert_selected #newsletter_checkbox --not
```

#### `/ios.assert_hittable`

Verify element can receive tap events (useful for debugging tap issues).

```
/ios.assert_hittable <target> [--timeout <ms>]
```

Checks:
- Element is visible
- Element is enabled
- Element has non-zero size
- Element is not off-screen
- Element is not obscured by overlays

**Examples:**
```
/ios.assert_hittable #action_button
/ios.assert_hittable @"Purchase" --timeout 5000
```

### Log & Crash Assertions

#### `/ios.assert_no_crash`

Verify app has not crashed.

```
/ios.assert_no_crash --app <bundleId> [--since <timestamp>]
```

| Option | Description |
|--------|-------------|
| `--app <bundleId>` | Bundle ID to monitor (required) |
| `--since <timestamp>` | Check for crashes since this time |

**Examples:**
```
/ios.assert_no_crash --app com.example.myapp
/ios.assert_no_crash --app com.example.myapp --since "2024-01-15T10:00:00"
```

#### `/ios.assert_no_errors`

Verify no error patterns appear in system logs.

```
/ios.assert_no_errors [--app <bundleId>] [--since <timestamp>] [--pattern <regex>]
```

**Default Error Patterns:**
- Generic: `error`, `failed`, `exception`, `crash`, `fatal`
- iOS: `EXC_BAD_ACCESS`, `SIGABRT`, `SIGSEGV`, `NSException`
- Swift: `fatalError`, `preconditionFailure`, `unexpectedly found nil`
- Network: `HTTP 4xx/5xx`, `API error`, `network error`, `timeout`

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--app <bundleId>` | All apps | Filter logs to specific app |
| `--since <timestamp>` | 60s ago | Check logs since this time |
| `--pattern <regex>` | Defaults | Add custom error pattern |
| `--ignore <regex>` | Defaults | Pattern to ignore (false positive) |
| `--max-errors <n>` | 10 | Maximum errors to return |
| `--context-lines <n>` | 2 | Log lines around each error |

**Examples:**
```
/ios.assert_no_errors --app com.example.myapp
/ios.assert_no_errors --pattern "database.*error"
/ios.assert_no_errors --ignore "debug_error_message"
```

#### `/ios.assert_log_contains`

Verify a pattern appears in system logs.

```
/ios.assert_log_contains <pattern> [--app <bundleId>] [--mode <mode>]
```

Useful for verifying:
- API calls were made
- Analytics events fired
- Specific log messages appear

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--app <bundleId>` | All apps | Filter logs to specific app |
| `--mode <mode>` | contains | Match mode (contains/exact/regex/startsWith/endsWith) |
| `--not` | false | Assert pattern does NOT appear |
| `--min-matches <n>` | 1 | Minimum required matches |
| `--since <timestamp>` | 60s ago | Check logs since this time |

**Examples:**
```
/ios.assert_log_contains "Login successful"
/ios.assert_log_contains "API response: \\d+" --mode regex
/ios.assert_log_contains "analytics.track.*purchase" --mode regex --app com.example.myapp
/ios.assert_log_contains "ERROR" --not  # Assert no ERROR in logs
```

### Compound Assertions

#### `/ios.assert_screen`

Verify multiple conditions that define a "screen" state.

```
/ios.assert_screen <screen_definition> [--timeout <ms>]
```

A screen definition specifies:
- Elements that must be visible
- Elements that must NOT be visible
- Elements that must be enabled/disabled

**Screen Definition Format:**

```yaml
name: login_screen
description: Login form ready for input
elements:                    # Must be visible
  - "#email_field"
  - "#password_field"
  - "#login_button"
not_visible:                 # Must NOT be visible
  - "#loading_spinner"
  - "#error_message"
disabled:                    # Must be disabled
  - "#login_button"          # Disabled until form filled
```

**Shorthand Prefixes:**
- `#identifier` - accessibility identifier
- `@label` - accessibility label
- `"text"` - text content

**Examples:**

```
# Define screen inline
/ios.assert_screen name=login elements="#email,#password,#login" not_visible="#loading"

# Use screen from registry
/ios.assert_screen login_screen --timeout 15000
```

**Using Screen Definitions in Code:**

```typescript
import { assertScreen, createScreenDefinition } from './ios-tools/assertions';

// Quick creation
const loginScreen = createScreenDefinition('login', [
  '#email_field',
  '#password_field',
  '#login_button'
], ['#loading_spinner']);

// Full definition
const homeScreen = {
  name: 'home',
  elements: [
    { identifier: 'home_header' },
    { label: 'Profile' },
    { text: 'Welcome' }
  ],
  notVisible: [
    { identifier: 'onboarding_modal' }
  ],
  enabled: [
    { identifier: 'action_button' }
  ]
};
```

### Timeout and Retry Configuration

#### Timeout Behavior

Assertions poll until either:
1. Condition is met (pass)
2. Timeout is reached (fail with timeout status)
3. Hard error occurs (fail with error status)

```
/ios.assert_visible #element --timeout 5000 --poll-interval 250
```

This will check every 250ms for up to 5 seconds.

#### Retry Policy

For handling transient failures (network glitches, simulator timing):

```typescript
{
  retry: {
    maxAttempts: 3,         // Total attempts including first
    initialDelay: 500,      // Delay before first retry
    maxDelay: 5000,         // Maximum delay cap
    backoffMultiplier: 2,   // Exponential backoff multiplier
    exponentialBackoff: true
  }
}
```

**Backoff Calculation:**
- Attempt 1: 500ms delay
- Attempt 2: 1000ms delay
- Attempt 3: 2000ms delay (capped at maxDelay)

### Auto Run Integration

Use assertions in Auto Run task documents:

```markdown
# Feature: User Login

## Tasks

- [ ] Navigate to login screen
  - ios.tap: "#login_nav_button"
  - ios.wait_for: "#login_screen"

- [ ] Verify login form elements
  - ios.assert_visible: "#email_field"
  - ios.assert_visible: "#password_field"
  - ios.assert_visible: "#login_button"
  - ios.assert_disabled: "#login_button"

- [ ] Fill and submit form
  - ios.type: { into: "#email_field", text: "test@example.com" }
  - ios.type: { into: "#password_field", text: "password123" }
  - ios.assert_enabled: "#login_button"
  - ios.tap: "#login_button"

- [ ] Verify successful login
  - ios.wait_for: "#home_screen"
  - ios.assert_visible: "#welcome_message"
  - ios.assert_text: { element: "#welcome_message", contains: "Welcome" }
  - ios.assert_no_crash: { app: "com.example.myapp" }
```

### Assertion Results

All assertions return structured results:

```typescript
interface VerificationResult {
  id: string;              // Unique assertion ID
  type: string;            // Assertion type (visible, text, etc.)
  status: 'passed' | 'failed' | 'timeout' | 'error';
  passed: boolean;         // Quick check for pass/fail
  message: string;         // Human-readable result
  target: string;          // What was being verified
  duration: number;        // Total time in ms
  attempts: Attempt[];     // All polling attempts
  artifacts?: {
    screenshots?: string[];  // Captured screenshots
    logs?: string[];         // Collected logs
  };
  simulator?: {
    udid: string;
    name: string;
    iosVersion: string;
  };
  data?: any;              // Type-specific data
}
```

### Error Messages

When assertions fail, helpful messages are provided:

**Element not found:**
```
Element "#submit_button" not found in UI tree.
Suggestions:
- Did you mean "#submit_btn"? (Button, visible)
- Check if the element has the correct identifier
- The element may not have loaded yet - try increasing timeout
```

**Timeout:**
```
Timeout after 10000ms waiting for visibility of "#loading_complete"
- 20 attempts made
- Last state: element not found
```

**Text mismatch:**
```
Text does not equal "John Doe". Found: label="Jonathan Doe", value=""
```

### Troubleshooting

#### Assertion Times Out

1. **Increase timeout**: Element may load slower than expected
   ```
   /ios.assert_visible #element --timeout 30000
   ```

2. **Check selector**: Use `/ios.inspect` to verify element exists
   ```
   /ios.inspect --app com.example.app
   ```

3. **Verify simulator state**: Ensure simulator is booted and app is running

#### Flaky Assertions

1. **Add retry**: Handle transient failures
   ```
   /ios.assert_visible #element --retry 3
   ```

2. **Wait for animations**: Add explicit wait before assertion
   ```
   /ios.wait_for #animation_complete
   /ios.assert_visible #result
   ```

3. **Use appropriate timeout**: Consider app performance characteristics

#### Element Found But Not Hittable

Use `/ios.assert_hittable` to diagnose:

```
/ios.assert_hittable #button
```

Common causes:
- Element obscured by overlay
- Element outside visible bounds
- Element has zero size
- Element is disabled

## MaestroBridge - App Introspection

MaestroBridge provides debug-time "X-ray vision" into iOS app internals. It exposes view/controller stack, feature flags, network requests, analytics events, and optionally allows test state injection—all via HTTP endpoints that Maestro can query.

<Warning>
MaestroBridge is a **debug-only** feature that should **NEVER** ship to production. The package includes multiple safety guards, but you must ensure it's only linked in debug builds.
</Warning>

### Overview

MaestroBridge runs a lightweight HTTP server inside your iOS app that exposes internal state:

- **App State** - View controller stack, custom registered state
- **Navigation** - Current route, navigation stack, history
- **Network Requests** - Recent HTTP requests with timing and status
- **Analytics Events** - Captured analytics events from any SDK
- **Feature Flags** - Current flag states and variants
- **Test State Injection** - Set app state during testing (opt-in)

### Quick Start

Add MaestroBridge to your app's AppDelegate (debug only):

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

For SwiftUI apps:

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

### Installation

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
        .product(name: "MaestroBridge", package: "MaestroBridge", condition: .when(configuration: .debug))
    ]
)
```

**Requirements:**
- iOS 14.0+ / macOS 11.0+
- Swift 5.9+
- Xcode 15.0+

### Bridge Slash Commands

Once MaestroBridge is running in your app, use these Maestro commands:

#### `/ios.bridge.state` - View App State

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

#### `/ios.bridge.route` - View Navigation

```
/ios.bridge.route              # Current route
/ios.bridge.route --stack      # Full navigation stack
```

**Response includes:**
- Current route path
- Navigation stack with titles
- Whether user can go back
- Modal presentation status

#### `/ios.bridge.network` - View Network Requests

```
/ios.bridge.network            # Recent network requests
/ios.bridge.network --last 5   # Last 5 requests
/ios.bridge.network --errors   # Only failed requests (non-2xx)
```

**Example Output:**
```
Recent Network Requests (15 total, 1 error)
- GET /api/user → 200 (245ms)
- POST /api/cart → 201 (180ms)
- GET /api/products → 200 (320ms)
- GET /api/broken → 500 (45ms) ❌
```

#### `/ios.bridge.analytics` - View Analytics Events

```
/ios.bridge.analytics              # Recent events
/ios.bridge.analytics --filter "checkout"  # Filter events by name
/ios.bridge.analytics --last 10    # Last 10 events
```

**Example Output:**
```
Recent Analytics (50 events)
- screen_view: cart (10:29:55)
- button_tap: add_to_cart (10:30:00)
- purchase_started (10:30:05)
```

#### `/ios.bridge.flags` - View Feature Flags

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

#### `/ios.bridge.set` - Set Test State

<Warning>
State mutation requires explicit opt-in via `enableStateMutation()` and the `--confirm` flag.
</Warning>

```
/ios.bridge.set user.isLoggedIn true --confirm
/ios.bridge.set cart.itemCount 5 --confirm
```

### HTTP Endpoints Reference

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

### Registering Custom State

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

### Analytics Integration

Capture events from popular analytics SDKs:

```swift
// Firebase Analytics
#if DEBUG
AnalyticsInterceptor.shared.firebaseLogEvent(name: name, parameters: parameters)
#endif

// Amplitude
#if DEBUG
AnalyticsInterceptor.shared.amplitudeLogEvent(eventType: "purchase", eventProperties: ["amount": 99.99])
#endif

// Mixpanel
#if DEBUG
AnalyticsInterceptor.shared.mixpanelTrack(event: "signup", properties: ["method": "google"])
#endif

// Segment
#if DEBUG
AnalyticsInterceptor.shared.segmentTrack(event: "item_viewed", properties: ["item_id": "12345"])
#endif
```

### Feature Flags

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

### Security Model

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

### Network Interceptor

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

### Auto Run Integration

Use bridge commands in Auto Run task documents:

```markdown
# Feature: Verify Cart State

## Tasks

- [ ] Add item to cart
  - ios.tap: "#add_to_cart_button"
  - ios.bridge.state: cart
  - Verify cart.itemCount increased

- [ ] Verify analytics fired
  - ios.bridge.analytics: --filter "add_to_cart"
  - Confirm purchase_intent event captured

- [ ] Check feature flag behavior
  - ios.bridge.flags: newCheckout
  - If enabled, verify new checkout flow UI
```

### Troubleshooting

#### Bridge Not Starting

Ensure you're running a DEBUG build:
```swift
#if DEBUG
print("Debug mode: \(DebugOnlyGuard.isDebugBuild)")
#endif
```

#### Port Already in Use

Use a different port:
```swift
MaestroBridge.shared.start(port: 9877)
```

Default ports tried: 9876, 9877, 9878, 9879, 9880

#### Token Not Working

1. Check the token printed in console when bridge starts
2. Ensure Bearer prefix: `Authorization: Bearer <token>`
3. Verify token matches exactly (case-sensitive)

#### State Not Showing

Ensure registration happens before state access:
```swift
MaestroBridge.shared.register("myState") { ... }
```

#### Network Requests Not Captured

1. Verify `NetworkInterceptor.shared.enable()` was called
2. For custom network layers, use `NetworkInterceptor.shared.recordRequest()`
3. WebSocket/custom protocols aren't automatically captured

#### App Crashes in Release

If you see "MaestroBridge in Release Build" error:
1. Remove MaestroBridge from release target
2. Wrap all usage in `#if DEBUG`
3. Use SPM configuration condition

## Visual Regression Testing

Maestro's visual regression tools detect and report visual changes between app versions. This enables automated detection of unintended UI changes and provides evidence that fixes actually resolve visual issues.

### Overview

The visual regression system provides:

- **Baseline Management** - Save, update, list, and delete reference screenshots
- **Image Comparison** - Pixel-level comparison with configurable thresholds
- **Change Detection** - Identify and categorize visual differences
- **Ignore Regions** - Exclude dynamic content from comparison
- **Multi-Device Support** - Device-family specific baselines
- **CI Integration** - JUnit XML, JSON, and HTML report generation

### Baseline Workflow

The core workflow for visual regression testing follows these steps:

#### 1. Capture Initial Baselines

First, navigate to each screen and save baselines:

```
/ios.baseline save login_screen --app com.example.myapp
/ios.baseline save home_screen --app com.example.myapp
/ios.baseline save settings_screen --app com.example.myapp
```

Baselines are stored in `~/.maestro/ios-baselines/{project}/screens/`.

#### 2. Compare Against Baselines

After making code changes, compare current screens to baselines:

```
/ios.diff login_screen
```

Example output:

```markdown
## Visual Comparison: login_screen

**Status**: DIFFERENCES DETECTED
**Similarity**: 94.2%
**Changed Pixels**: 1,234 (5.8%)

### Changed Regions

1. **Button Area** (100, 450) - (200, 500)
   - Color changed: #007AFF → #34C759
   - Severity: Medium

2. **Header Text** (20, 80) - (300, 120)
   - Text content likely changed
   - Severity: Low

### Files
- Baseline: ~/.maestro/ios-baselines/myproject/screens/login_screen/baseline.png
- Current: /tmp/ios-diff-current.png
- Diff: /tmp/ios-diff-result.png

### Recommendation
Review the changes above. If intentional:
`/ios.baseline update login_screen`
```

#### 3. Update Baselines When Intended

If the visual changes are intentional (new design, bug fix, etc.):

```
/ios.baseline update login_screen
```

#### 4. Run Full Regression

Before releases or after significant changes, run a full regression check:

```
/ios.regression --project myproject
```

This compares all baselines and generates a comprehensive report.

### The `/ios.baseline` Command

Manage visual regression baselines.

#### Subcommands

| Subcommand | Description | Example |
|------------|-------------|---------|
| `save <name>` | Capture current screen as baseline | `/ios.baseline save login_screen` |
| `update <name>` | Update existing baseline | `/ios.baseline update login_screen` |
| `list` | List all baselines | `/ios.baseline list` |
| `show <name>` | Display baseline info | `/ios.baseline show login_screen` |
| `delete <name>` | Remove baseline | `/ios.baseline delete login_screen` |
| `ignore <name> <region>` | Add ignore region | `/ios.baseline ignore login_screen status_bar` |

#### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--project <name>` | `-p` | Project name (default: current directory name) |
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--app <bundleId>` | `-a` | App bundle ID for metadata |
| `--device-family <family>` | `-f` | Device family (iPhone-SE, iPhone, iPhone-Pro-Max, iPad) |
| `--auto-device-family` | | Auto-detect device family from screen size |
| `--description <text>` | `-d` | Description for baseline |
| `--tags <tag1,tag2>` | `-t` | Tags for organization |

#### Examples

**Save baseline with metadata**:
```
/ios.baseline save checkout_flow --app com.example.store --description "Checkout page with cart items" --tags "checkout,critical"
```

**Save with auto device family detection**:
```
/ios.baseline save home_screen --auto-device-family
```

**List baselines for a project**:
```
/ios.baseline list --project myproject
```

**Add ignore region**:
```
/ios.baseline ignore login_screen status_bar --reason "Dynamic time display"
```

### The `/ios.diff` Command

Compare current screen against baselines.

#### Modes

| Mode | Description | Example |
|------|-------------|---------|
| Single baseline | Compare to one baseline | `/ios.diff login_screen` |
| Flow | Compare all steps in a flow | `/ios.diff --flow checkout` |
| All | Compare all baselines | `/ios.diff --all` |

#### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--project <name>` | `-p` | Project name |
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--threshold <0-1>` | `-t` | Pixel difference threshold (default: 0.1) |
| `--output <path>` | `-o` | Save diff image to path |
| `--update` | `-u` | Update baseline if different |
| `--device-family <family>` | `-f` | Use device-specific baseline |

#### Examples

**Basic comparison**:
```
/ios.diff login_screen
```

**Comparison with custom threshold**:
```
/ios.diff login_screen --threshold 0.05
```

**Save diff image**:
```
/ios.diff login_screen --output ./diffs/login-diff.png
```

**Compare all baselines**:
```
/ios.diff --all --project myproject
```

### The `/ios.regression` Command

Run comprehensive visual regression tests.

```
/ios.regression [--mode <mode>] [--project <name>]
```

#### Modes

| Mode | Description |
|------|-------------|
| `full` (default) | All screens and flows |
| `quick` | Screens only, higher threshold |
| `flows-only` | Only flow baselines |

#### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--project <name>` | `-p` | Project name |
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--threshold <0-1>` | `-t` | Pixel difference threshold |
| `--output <path>` | `-o` | Output directory for reports |
| `--device-family <family>` | `-f` | Filter to device family |
| `--fail-fast` | | Stop on first failure |
| `--update` | `-u` | Update failed baselines |
| `--verbose` | `-v` | Show detailed output |

#### Example Output

```markdown
## Visual Regression Report

**Project**: myproject
**Device**: iPhone 15 Pro (iOS 17.5)
**Timestamp**: 2024-01-15T10:30:00Z

### Summary

| Metric | Value |
|--------|-------|
| Total Baselines | 15 |
| Passed | 13 |
| Failed | 2 |
| Skipped | 0 |
| Pass Rate | 86.7% |

### Failed Baselines

#### login_screen
- **Similarity**: 94.2%
- **Changed Regions**: 2
- **Diff**: ~/.maestro/ios-baselines/myproject/diffs/login_screen-diff.png

#### checkout_screen
- **Similarity**: 89.1%
- **Changed Regions**: 3
- **Diff**: ~/.maestro/ios-baselines/myproject/diffs/checkout_screen-diff.png

### Files
- HTML Report: ./visual-regression-report.html
- JUnit XML: ./visual-regression.xml
- JSON: ./visual-regression.json
```

### Threshold Configuration

The comparison threshold controls how strict pixel matching is. Lower values are more strict.

#### Threshold Values

| Threshold | Sensitivity | Use Case |
|-----------|-------------|----------|
| `0.01` | Very strict | Pixel-perfect designs, exact matching |
| `0.05` | Strict | High-fidelity UI, minimal tolerance |
| `0.1` | Default | General visual regression |
| `0.2` | Moderate | Allow minor antialiasing differences |
| `0.3` | Relaxed | Focus on major layout changes |
| `0.5` | Very relaxed | Only catch significant regressions |

#### Setting Thresholds

**Per-comparison threshold**:
```
/ios.diff login_screen --threshold 0.05
```

**Per-regression threshold**:
```
/ios.regression --threshold 0.15
```

**Auto Run threshold**:
```yaml
- ios.diff:
    baseline: "login_screen"
    threshold: 0.05
```

#### Antialiasing Handling

By default, antialiasing differences are detected and can be ignored. Antialiasing pixels are typically on shape boundaries and change based on rendering. To include antialiasing in comparison:

```typescript
// In programmatic API
const result = await compareImages(baseline, current, {
  antialiasing: false  // Include antialiasing differences
});
```

### Ignore Region Setup

Ignore regions exclude dynamic content from comparison, reducing false positives.

#### Built-in Ignore Regions

Common iOS regions that change between runs:

| Region | Description | Rectangle |
|--------|-------------|-----------|
| `status_bar` | Time, battery, signal | Top 47-59px (varies by device) |
| `home_indicator` | Home button area | Bottom 34px |

**Add status bar ignore region**:
```
/ios.baseline ignore login_screen status_bar
```

#### Custom Static Regions

Define fixed-coordinate regions:

```
/ios.baseline ignore login_screen custom --rect "100,200,80,40" --reason "Dynamic avatar"
```

The `--rect` format is `x,y,width,height`.

#### Element-Based Regions

Ignore regions based on accessibility identifiers:

```
/ios.baseline ignore login_screen element --id "timestamp_label" --reason "Dynamic timestamp"
```

These regions update automatically when element positions change.

#### Pattern-Based Regions

Auto-detect common dynamic patterns:

| Pattern | Description |
|---------|-------------|
| `clock` | System clock display |
| `date` | Date displays |
| `timestamp` | Relative timestamps ("2 hours ago") |
| `battery` | Battery indicator |
| `signal` | Cell signal indicator |
| `user_avatar` | Profile pictures |
| `loading` | Loading spinners |
| `carousel` | Image carousels |

**Suggest ignore regions**:
```
/ios.baseline suggest-ignore login_screen
```

This analyzes the baseline and suggests regions likely to cause false positives.

#### Device-Specific Ignore Regions

Different devices have different status bar heights:

| Device Type | Status Bar Height |
|-------------|-------------------|
| Dynamic Island (14 Pro+) | 59px |
| Notch (X-13) | 47px |
| Home Button (SE, 8) | 20px |
| iPad | 24px |

The system auto-detects device type when using `--auto-device-family`.

### Multi-Device Baseline Support

Store and manage baselines for different device families.

#### Device Families

| Family | Examples |
|--------|----------|
| `iPhone-SE` | iPhone SE (2nd/3rd gen) |
| `iPhone` | iPhone 12, 13, 14, 15 |
| `iPhone-Plus` | iPhone Plus variants |
| `iPhone-Pro-Max` | iPhone Pro Max variants |
| `iPad` | Standard iPads |
| `iPad-Pro` | iPad Pro variants |

#### Creating Device-Specific Baselines

```
# Save for current device family (auto-detected)
/ios.baseline save home_screen --auto-device-family

# Save for specific family
/ios.baseline save home_screen --device-family iPhone-Pro-Max
```

#### Baseline Storage Structure

```
~/.maestro/ios-baselines/myproject/
├── metadata.json
├── screens/
│   ├── login_screen/
│   │   ├── baseline.png          # Generic baseline
│   │   └── metadata.json
│   ├── login_screen@iPhone-SE/
│   │   ├── baseline.png          # iPhone SE specific
│   │   └── metadata.json
│   └── login_screen@iPhone-Pro-Max/
│       ├── baseline.png          # Pro Max specific
│       └── metadata.json
└── flows/
    └── checkout/
        ├── step_1.png
        ├── step_2.png
        └── metadata.json
```

#### Fallback Chain

When comparing, the system looks for baselines in this order:

1. Exact device family match (`login_screen@iPhone-Pro-Max`)
2. Generic baseline (`login_screen`)
3. Closest family baseline
4. Any available baseline (with warning)

#### Coverage Report

Check which device families have baselines:

```
/ios.baseline coverage --project myproject
```

Example output:

```
Device Baseline Coverage: myproject

| Baseline | iPhone-SE | iPhone | iPhone-Pro-Max | iPad |
|----------|-----------|--------|----------------|------|
| login    | ✓         | ✓      | ✓              | -    |
| home     | -         | ✓      | -              | -    |
| settings | -         | ✓      | ✓              | ✓    |

Coverage: 50% (6/12 slots)

Recommendations:
- Add iPhone-SE baselines for: home, settings
- Add iPhone-Pro-Max baselines for: home
- Add iPad baselines for: login, home
```

### CI Integration

Export visual regression results for CI systems.

#### JUnit XML Format

Compatible with Jenkins, CircleCI, GitHub Actions, GitLab CI, and Azure Pipelines:

```
/ios.regression --output ./test-results --format junit
```

Output: `./test-results/visual-regression.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Visual Regression" tests="15" failures="2" errors="0" time="12.5">
  <testsuite name="myproject" tests="15" failures="2" errors="0" time="12.5">
    <testcase name="login_screen" classname="visual-regression" time="0.45">
      <failure message="Visual differences detected">
        Similarity: 94.2%
        Changed regions: 2
        Diff: /path/to/diff.png
      </failure>
    </testcase>
    <testcase name="home_screen" classname="visual-regression" time="0.38" />
    <!-- ... -->
  </testsuite>
</testsuites>
```

#### JSON Format

For programmatic consumption:

```
/ios.regression --output ./test-results --format json
```

Output: `./test-results/visual-regression.json`

```json
{
  "meta": {
    "version": "1.0",
    "generator": "maestro-visual-regression",
    "timestamp": "2024-01-15T10:30:00Z",
    "ci": {
      "system": "github-actions",
      "buildNumber": "123",
      "branch": "main",
      "commit": "abc1234"
    }
  },
  "summary": {
    "total": 15,
    "passed": 13,
    "failed": 2,
    "errors": 0,
    "passRate": 0.867
  },
  "results": [
    {
      "name": "login_screen",
      "status": "failed",
      "similarity": 0.942,
      "diffPercent": 5.8,
      "changedRegions": 2,
      "paths": {
        "baseline": "/path/to/baseline.png",
        "current": "/path/to/current.png",
        "diff": "/path/to/diff.png"
      }
    }
  ]
}
```

#### HTML Report

Interactive report with image viewer:

```
/ios.regression --output ./test-results --format html
```

Features:
- Thumbnail grid of all comparisons
- Side-by-side comparison viewer
- Diff overlay toggle
- Filter by status (passed/failed)
- Zoom and pan controls
- Dark mode support

#### Artifact Bundle

Generate a zip file with all images and reports:

```
/ios.regression --output ./artifacts --format bundle
```

Contents:
```
visual-regression-bundle.zip
├── baselines/
│   ├── login_screen.png
│   └── home_screen.png
├── current/
│   ├── login_screen.png
│   └── home_screen.png
├── diffs/
│   ├── login_screen-diff.png
│   └── home_screen-diff.png
├── report.html
├── results.xml
├── results.json
└── SUMMARY.md
```

#### CI Configuration Examples

**GitHub Actions**:

```yaml
- name: Run Visual Regression
  run: |
    /ios.regression --project myapp --output ./test-results --format junit

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: visual-regression-results
    path: ./test-results/

- name: Publish Test Results
  uses: EnricoMi/publish-unit-test-result-action@v2
  if: always()
  with:
    files: ./test-results/*.xml
```

**CircleCI**:

```yaml
- run:
    name: Visual Regression Tests
    command: /ios.regression --project myapp --output ./test-results --format junit

- store_test_results:
    path: ./test-results

- store_artifacts:
    path: ./test-results
    destination: visual-regression
```

**GitLab CI**:

```yaml
visual_regression:
  script:
    - /ios.regression --project myapp --output ./test-results --format junit
  artifacts:
    when: always
    reports:
      junit: ./test-results/*.xml
    paths:
      - ./test-results/
```

### Auto Run Integration

Use visual regression in Auto Run task documents.

#### Baseline Step Types

```markdown
## Visual Regression Tasks

- [ ] Capture login flow baselines
  - ios.baseline: { save: "login_step_1", app: "com.example.myapp" }
  - ios.tap: "#continue_button"
  - ios.baseline: { save: "login_step_2", app: "com.example.myapp" }
  - ios.tap: "#submit_button"
  - ios.baseline: { save: "login_complete", app: "com.example.myapp" }
```

#### Diff Step Types

```markdown
- [ ] Verify no visual regressions in login
  - ios.diff: { baseline: "login_step_1", threshold: 0.05 }
  - ios.diff: { baseline: "login_step_2", threshold: 0.05 }
  - ios.diff: { baseline: "login_complete", threshold: 0.05 }
```

#### Regression Step Types

```markdown
- [ ] Full regression check
  - ios.regression: { project: "myapp", mode: "full", threshold: 0.1 }
```

#### Conditional Updates

```markdown
- [ ] Update baseline if review approved
  - ios.baseline: { update: "home_screen", if_approved: true }
```

### Example Visual Regression Flow

A complete example demonstrating the visual regression workflow:

#### Initial Setup

```markdown
# Visual Regression Setup

## Create Baselines

- [ ] Launch app and capture initial baselines
  - ios.tap: { target: "#launch_app" }
  - ios.wait_for: "#home_screen"
  - ios.baseline: { save: "home_screen", app: "com.example.myapp", auto_device_family: true }

- [ ] Navigate to login and capture
  - ios.tap: { target: "#login_button" }
  - ios.wait_for: "#login_form"
  - ios.baseline: { save: "login_screen", app: "com.example.myapp" }
  - ios.baseline: { ignore: "login_screen", region: "status_bar" }

- [ ] Navigate to settings and capture
  - ios.tap: { target: "#settings_button" }
  - ios.wait_for: "#settings_screen"
  - ios.baseline: { save: "settings_screen", app: "com.example.myapp" }
```

#### Regular Regression Check

```markdown
# Pre-Release Visual Regression

## Full Regression

- [ ] Run comprehensive visual regression
  - ios.regression: { project: "myapp", mode: "full", output: "./reports", verbose: true }

## Review Failures

- [ ] Review any failed comparisons
  - If changes are intentional, update baselines
  - If changes are bugs, file issues

## Update Approved Baselines

- [ ] Update login_screen baseline (new button design approved)
  - ios.baseline: { update: "login_screen" }
```

#### CI Integration Example

```markdown
# CI Visual Regression Pipeline

## Setup

- [ ] Boot simulator and install app
  - shell: xcrun simctl boot "iPhone 15 Pro"
  - shell: xcrun simctl install booted ./MyApp.app

## Run Tests

- [ ] Execute visual regression suite
  - ios.regression:
      project: "myapp"
      mode: "full"
      threshold: 0.1
      output: "./test-results"
      fail_fast: false

## Export Results

- [ ] Generate CI reports
  - Export JUnit XML for CI system
  - Export HTML report for manual review
  - Archive diff images as artifacts

## Cleanup

- [ ] Shutdown simulator
  - shell: xcrun simctl shutdown all
```

### Troubleshooting

#### Baseline Not Found

```
Error: Baseline 'login_screen' not found
```

Solutions:
1. Check baseline exists: `/ios.baseline list`
2. Verify project name: `/ios.baseline list --project myproject`
3. Create baseline if missing: `/ios.baseline save login_screen`

#### Device Family Mismatch

```
Warning: No baseline for iPhone-Pro-Max, using generic baseline
```

Solutions:
1. Create device-specific baseline: `/ios.baseline save login_screen --device-family iPhone-Pro-Max`
2. Use auto-detection: `/ios.baseline save login_screen --auto-device-family`
3. Run coverage report: `/ios.baseline coverage`

#### High False Positive Rate

Solutions:
1. Add ignore regions for dynamic content
2. Increase threshold: `--threshold 0.15`
3. Enable antialiasing tolerance
4. Use element-based ignore regions for moving elements

#### Comparison Timeout

```
Error: Comparison timed out after 30000ms
```

Solutions:
1. Reduce image size if screenshots are very large
2. Use progressive comparison for faster feedback
3. Check for system resource constraints

#### Images Have Different Dimensions

```
Warning: Image dimensions differ (375x812 vs 393x852)
```

This occurs when comparing baselines from different device families. Solutions:
1. Use device-specific baselines
2. Enable `--auto-device-family` when saving
3. Comparison uses overlapping area with dimension mismatch warning
