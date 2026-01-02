---
title: iOS Command Reference
description: Complete reference for all iOS slash commands in Maestro.
icon: terminal
---

This page documents all iOS-related slash commands available in Maestro.

## Command Categories

| Category | Commands | Description |
|----------|----------|-------------|
| **Setup** | `/ios.setup` | Environment configuration |
| **Capture** | `/ios.snapshot`, `/ios.inspect` | Screen capture and UI inspection |
| **Interaction** | `/ios.tap`, `/ios.type`, `/ios.scroll`, `/ios.swipe` | UI element interactions |
| **Automation** | `/ios.run_flow`, `/ios.playbook` | Flow automation and playbooks |
| **Visual** | `/ios.baseline`, `/ios.diff`, `/ios.regression` | Visual regression testing |
| **Debug** | `/ios.bridge.*` | MaestroBridge introspection |
| **Help** | `/ios.help` | Documentation and troubleshooting |

---

## Setup Commands

### `/ios.setup`

Run the interactive setup wizard or check environment status.

```
/ios.setup
/ios.setup --check
/ios.setup --fix
/ios.setup --reset
```

| Option | Short | Description |
|--------|-------|-------------|
| `--check` | `-c` | Check environment only |
| `--fix` | `-f` | Attempt to fix issues automatically |
| `--reset` | `-r` | Reset configuration |
| `--project <path>` | `-p` | Specify project path |

See [Setup Guide](./setup) for complete details.

---

## Capture Commands

### `/ios.snapshot` {#snapshot}

Capture the current state of an iOS simulator including screenshot, logs, and crash data.

```
/ios.snapshot
/ios.snapshot --simulator "iPhone 15 Pro"
/ios.snapshot --app com.example.myapp --duration 120
```

| Option | Short | Description |
|--------|-------|-------------|
| `--simulator <name\|udid>` | `-s` | Target simulator (default: first booted) |
| `--app <bundleId>` | `-a` | Filter logs to a specific app |
| `--duration <seconds>` | `-d` | Seconds of logs to capture (default: 60) |
| `--include-crash` | | Include full crash log content |
| `--output <path>` | `-o` | Custom output directory |

**Example output:**

```markdown
## iOS Snapshot Captured

**Timestamp**: 2024-01-15T10:30:00
**Simulator**: iPhone 15 Pro (iOS 17.2)
**App**: com.example.myapp

### Screenshot
Saved to: ~/Library/.../screenshot.png

### System Log Summary
- Total entries: 245
- Errors: 3
- Warnings: 12

### Artifacts
All artifacts saved to: ~/Library/.../ios-artifacts/{session}/
```

### `/ios.inspect`

Inspect the current UI hierarchy and accessibility tree.

```
/ios.inspect
/ios.inspect --app com.example.myapp
/ios.inspect --element #login_button
```

| Option | Short | Description |
|--------|-------|-------------|
| `--simulator <name\|udid>` | `-s` | Target simulator (default: first booted) |
| `--app <bundleId>` | `-a` | Filter to specific app |
| `--element <target>` | `-e` | Focus on specific element |
| `--depth <n>` | `-d` | Maximum depth to display |
| `--format <type>` | `-f` | Output format: `tree`, `json`, `table` |

---

## Interaction Commands

<Note>
These commands use the native XCUITest driver internally. For production use, prefer Maestro Mobile flows via `/ios.run_flow`.
</Note>

### `/ios.tap`

Tap an element by accessibility identifier, label, or coordinates.

```
/ios.tap #login_button --app com.example.app
/ios.tap "Sign In" --app com.example.app
/ios.tap 150,300 --app com.example.app
```

**Target formats:**

| Format | Description | Example |
|--------|-------------|---------|
| `#identifier` | Accessibility ID | `#login_button` |
| `"label"` | Accessibility label | `"Sign In"` |
| `x,y` | Screen coordinates | `150,300` |

| Option | Short | Description |
|--------|-------|-------------|
| `--app <bundleId>` | `-a` | App bundle ID (required) |
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--double` | | Perform double tap |
| `--long [seconds]` | | Long press (default: 1.0s) |
| `--offset <x,y>` | | Offset from element center |
| `--timeout <ms>` | | Element wait timeout (default: 10000) |

**Examples:**

```bash
# Double tap
/ios.tap #image_view --double --app com.example.app

# Long press for 2 seconds
/ios.tap #delete_button --long 2 --app com.example.app

# Tap with offset from element center
/ios.tap #cell --offset 10,-5 --app com.example.app
```

### `/ios.type`

Type text into the focused element or a specific text field.

```
/ios.type "hello world" --app com.example.app
/ios.type --into #email_field "user@example.com" --app com.example.app
```

| Option | Short | Description |
|--------|-------|-------------|
| `--app <bundleId>` | `-a` | App bundle ID (required) |
| `--into <target>` | `-i` | Target element (default: focused) |
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--clear` | `-c` | Clear existing text before typing |
| `--timeout <ms>` | | Element wait timeout (default: 10000) |

### `/ios.scroll`

Scroll in a direction or scroll until an element is visible.

```
/ios.scroll down --app com.example.app
/ios.scroll --to #footer --app com.example.app
```

| Direction | Aliases | Description |
|-----------|---------|-------------|
| `up` | `u` | Scroll up |
| `down` | `d` | Scroll down |
| `left` | `l` | Scroll left |
| `right` | `r` | Scroll right |

| Option | Short | Description |
|--------|-------|-------------|
| `--app <bundleId>` | `-a` | App bundle ID (required) |
| `--to <target>` | `-t` | Target element to scroll to |
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--distance <n>` | | Scroll distance fraction (0.0-1.0) |
| `--attempts <n>` | | Max scroll attempts for `--to` (default: 10) |
| `--in <target>` | | Scroll within container element |
| `--timeout <ms>` | | Element wait timeout (default: 10000) |

### `/ios.swipe`

Perform swipe gestures.

```
/ios.swipe left --app com.example.app
/ios.swipe up --velocity fast --app com.example.app
```

| Direction | Common Use Cases |
|-----------|-----------------|
| `up` | Dismiss modal, pull to refresh |
| `down` | Dismiss notification |
| `left` | Delete action, next page |
| `right` | Back navigation |

| Option | Short | Description |
|--------|-------|-------------|
| `--app <bundleId>` | `-a` | App bundle ID (required) |
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--velocity <v>` | `-v` | Speed: `slow`, `normal`, `fast` |
| `--from <target>` | | Start swipe from element |
| `--timeout <ms>` | | Element wait timeout (default: 10000) |

---

## Automation Commands

### `/ios.run_flow` {#run-flow}

Execute Maestro Mobile test flows on iOS simulators.

```
/ios.run_flow login_flow.yaml
/ios.run_flow flows/signup.yaml --simulator "iPhone 15 Pro"
/ios.run_flow --inline "tap:Login" "type:password123" "tap:Submit"
```

| Option | Short | Description |
|--------|-------|-------------|
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--app <bundleId>` | `-a` | App bundle ID |
| `--timeout <seconds>` | `-t` | Maximum execution time (default: 300) |
| `--screenshot-dir <path>` | | Output directory for screenshots |
| `--inline` | | Run inline action strings |
| `--retry <count>` | | Retry attempts on failure (default: 1) |
| `--continue` | | Continue on error |
| `--debug` | | Verbose output |

**Inline shortcuts:**

| Shorthand | Description | Example |
|-----------|-------------|---------|
| `tap:<text>` | Tap by text | `tap:Login` |
| `tapid:<id>` | Tap by ID | `tapid:login_button` |
| `type:<text>` | Input text | `type:hello@example.com` |
| `scroll:<dir>` | Scroll | `scroll:down` |
| `screenshot` | Take screenshot | `screenshot` |
| `visible:<text>` | Assert visible | `visible:Welcome` |
| `wait:<ms>` | Wait duration | `wait:2000` |

See the [full Maestro Mobile YAML reference](../ios-development#maestro-mobile-yaml-format) in the main documentation.

### `/ios.playbook`

Manage and run iOS-specific playbooks.

```
/ios.playbook list
/ios.playbook run login_test
/ios.playbook create my_test
```

| Subcommand | Description |
|------------|-------------|
| `list` | Show available playbooks |
| `run <name>` | Execute a playbook |
| `create <name>` | Create a new playbook |
| `edit <name>` | Open playbook for editing |
| `delete <name>` | Remove a playbook |

See [Playbook Integration](./playbooks) for details.

---

## Visual Regression Commands

### `/ios.baseline`

Create or update visual regression baselines.

```
/ios.baseline login_screen
/ios.baseline home --simulator "iPhone 15 Pro"
```

| Option | Short | Description |
|--------|-------|-------------|
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--app <bundleId>` | `-a` | App bundle ID |
| `--directory <path>` | `-d` | Baseline storage directory |
| `--force` | `-f` | Overwrite existing baseline |

### `/ios.diff`

Compare current screen against a baseline.

```
/ios.diff login_screen
/ios.diff home --threshold 0.02
```

| Option | Short | Description |
|--------|-------|-------------|
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--app <bundleId>` | `-a` | App bundle ID |
| `--threshold <n>` | `-t` | Diff threshold (0.0-1.0, default: 0.01) |
| `--output <path>` | `-o` | Save diff image to path |

### `/ios.regression`

Run a full visual regression test suite.

```
/ios.regression
/ios.regression --suite smoke
/ios.regression --update-approved
```

| Option | Short | Description |
|--------|-------|-------------|
| `--suite <name>` | `-s` | Run specific test suite |
| `--update-approved` | | Update all approved baselines |
| `--threshold <n>` | `-t` | Diff threshold for all tests |
| `--report` | `-r` | Generate HTML report |

See [Visual Regression Testing](./visual-regression) for complete guide.

---

## Debug Commands (MaestroBridge)

These commands require MaestroBridge integration in your app.

### `/ios.bridge.connect`

Connect to MaestroBridge in a running app.

```
/ios.bridge.connect --app com.example.myapp
/ios.bridge.connect --port 9876
```

### `/ios.bridge.state`

Query app internal state.

```
/ios.bridge.state
/ios.bridge.state --path user.preferences
```

### `/ios.bridge.features`

Inspect feature flags.

```
/ios.bridge.features
/ios.bridge.features --set darkMode=true
```

### `/ios.bridge.network`

View network request log.

```
/ios.bridge.network
/ios.bridge.network --filter api.example.com
```

### `/ios.bridge.analytics`

View analytics events.

```
/ios.bridge.analytics
/ios.bridge.analytics --last 50
```

See [MaestroBridge Guide](./bridge) for setup and full documentation.

---

## Help Commands

### `/ios.help`

Access iOS command documentation.

```
/ios.help                    # Overview of all commands
/ios.help snapshot           # Help for specific command
/ios.help --examples         # Extended examples
/ios.help --troubleshoot     # Troubleshooting guide
```

| Option | Short | Description |
|--------|-------|-------------|
| `<command>` | | Show help for specific command |
| `--examples` | `-e` | Show extended examples |
| `--troubleshoot` | `-t` | Show troubleshooting guide |

---

## Common Options

These options are available across most iOS commands:

| Option | Short | Description |
|--------|-------|-------------|
| `--simulator <name\|udid>` | `-s` | Target simulator by name or UDID |
| `--app <bundleId>` | `-a` | Target app by bundle ID |
| `--timeout <ms>` | | Operation timeout in milliseconds |
| `--debug` | | Enable verbose debug output |

## Next Steps

- [Setup Guide](./setup) - Configure your environment
- [Playbook Integration](./playbooks) - Automate iOS testing
- [Visual Regression](./visual-regression) - Baseline and diff testing
- [Troubleshooting](./troubleshooting) - Common issues and solutions
