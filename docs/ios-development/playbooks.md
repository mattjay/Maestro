---
title: iOS Playbook Integration
description: Using iOS commands in Auto Run playbooks and YAML workflows.
icon: play
---

Maestro's iOS tools integrate seamlessly with the Auto Run playbook system, enabling automated iOS testing workflows.

## Overview

Playbooks are YAML files that define sequences of actions. iOS commands can be used as actions within playbooks, allowing you to:

- Capture screenshots at key points in a workflow
- Run UI automation flows
- Perform visual regression testing
- Collect logs and crash data
- Build complex multi-step test scenarios

## Basic Playbook Structure

```yaml
name: iOS Test Workflow
description: Test the login flow on iOS
tags:
  - ios
  - login
  - smoke

steps:
  - action: ios.snapshot
    inputs:
      simulator: "iPhone 15 Pro"
      app: com.example.myapp
    store_as: initial_snapshot

  - action: ios.run_flow
    inputs:
      flow: flows/login_flow.yaml
      app: com.example.myapp
    store_as: flow_result

  - action: ios.snapshot
    store_as: final_snapshot

  - action: message
    content: |
      Login test completed.
      Flow passed: {{flow_result.passed}}
      Duration: {{flow_result.durationSeconds}}s
```

## iOS Actions Reference

### `ios.snapshot`

Capture simulator screenshot, logs, and crash data.

```yaml
- action: ios.snapshot
  inputs:
    simulator: "iPhone 15 Pro"    # optional
    app: com.example.myapp        # optional
    duration: 120                 # optional, log duration in seconds
    include_crash: true           # optional
  store_as: snapshot_result
```

**Outputs:**

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

### `ios.run_flow`

Execute a Maestro Mobile flow.

```yaml
- action: ios.run_flow
  inputs:
    flow: flows/login_flow.yaml   # required
    app: com.example.myapp        # optional
    simulator: "iPhone 15 Pro"    # optional
    timeout: 120                  # optional, seconds
    retry: 2                      # optional
    continue_on_error: false      # optional
    env:                          # optional
      USERNAME: testuser
      PASSWORD: secret123
  store_as: flow_result
```

**Outputs:**

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

### `ios.tap`

Tap on an element.

```yaml
- action: ios.tap
  inputs:
    target: "#login_button"       # required (#id, "label", or x,y)
    app: com.example.myapp        # required
    simulator: "iPhone 15 Pro"    # optional
    double_tap: false             # optional
    long_press: 2.0               # optional, duration in seconds
    offset:                       # optional
      x: 10
      y: -5
    timeout: 10000                # optional, ms
  store_as: tap_result
```

### `ios.type`

Type text into an element.

```yaml
- action: ios.type
  inputs:
    text: "user@example.com"      # required
    into: "#email_field"          # optional (#id or "label")
    app: com.example.myapp        # required
    simulator: "iPhone 15 Pro"    # optional
    clear: true                   # optional
    timeout: 10000                # optional, ms
  store_as: type_result
```

### `ios.scroll`

Scroll in a direction or to an element.

```yaml
# Scroll direction
- action: ios.scroll
  inputs:
    direction: down               # up, down, left, right
    app: com.example.myapp
    distance: 0.5                 # optional, 0.0-1.0

# Scroll to element
- action: ios.scroll
  inputs:
    to: "#footer_element"         # target element
    app: com.example.myapp
    attempts: 15                  # optional, max scrolls
    in: "#scroll_view"            # optional, container
```

### `ios.swipe`

Perform a swipe gesture.

```yaml
- action: ios.swipe
  inputs:
    direction: left               # up, down, left, right
    app: com.example.myapp
    velocity: fast                # optional: slow, normal, fast
    from: "#carousel"             # optional, start element
```

### `ios.baseline`

Create a visual baseline.

```yaml
- action: ios.baseline
  inputs:
    name: login_screen            # required
    simulator: "iPhone 15 Pro"    # optional
    app: com.example.myapp        # optional
    directory: ./ios-baselines    # optional
    force: false                  # optional
  store_as: baseline_result
```

### `ios.diff`

Compare against a baseline.

```yaml
- action: ios.diff
  inputs:
    name: login_screen            # required
    simulator: "iPhone 15 Pro"    # optional
    app: com.example.myapp        # optional
    threshold: 0.01               # optional, 0.0-1.0
  store_as: diff_result
```

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| `matches` | boolean | Whether screens match |
| `difference` | number | Difference percentage |
| `diffImagePath` | string | Path to diff image |
| `baselinePath` | string | Path to baseline image |
| `currentPath` | string | Path to current screenshot |

## Example Playbooks

### Login Flow Test

```yaml
name: iOS Login Test
description: Verify login functionality

steps:
  # Initial state
  - action: ios.snapshot
    inputs:
      app: com.example.myapp
    store_as: before_login

  # Run login flow
  - action: ios.run_flow
    inputs:
      flow: flows/login_flow.yaml
      app: com.example.myapp
      retry: 2
    store_as: login_result

  # Verify success
  - action: assert
    inputs:
      condition: "{{ login_result.passed }}"
      message: "Login flow should pass"

  # Capture final state
  - action: ios.snapshot
    inputs:
      app: com.example.myapp
    store_as: after_login

  # Report results
  - action: message
    content: |
      ## Login Test Results

      | Metric | Value |
      |--------|-------|
      | Status | {{login_result.passed ? 'PASSED' : 'FAILED'}} |
      | Duration | {{login_result.durationSeconds}}s |
      | Steps | {{login_result.passedSteps}}/{{login_result.totalSteps}} |
```

### Visual Regression Suite

```yaml
name: iOS Visual Regression
description: Compare key screens against baselines

steps:
  # Login screen
  - action: ios.run_flow
    inputs:
      flow: flows/navigate_to_login.yaml
      app: com.example.myapp

  - action: ios.diff
    inputs:
      name: login_screen
      threshold: 0.01
    store_as: login_diff

  # Home screen
  - action: ios.run_flow
    inputs:
      flow: flows/login_flow.yaml
      app: com.example.myapp

  - action: ios.diff
    inputs:
      name: home_screen
      threshold: 0.01
    store_as: home_diff

  # Settings screen
  - action: ios.run_flow
    inputs:
      flow: flows/navigate_to_settings.yaml
      app: com.example.myapp

  - action: ios.diff
    inputs:
      name: settings_screen
      threshold: 0.01
    store_as: settings_diff

  # Summary
  - action: message
    content: |
      ## Visual Regression Results

      | Screen | Status | Difference |
      |--------|--------|------------|
      | Login | {{login_diff.matches ? '✓' : '✗'}} | {{login_diff.difference}}% |
      | Home | {{home_diff.matches ? '✓' : '✗'}} | {{home_diff.difference}}% |
      | Settings | {{settings_diff.matches ? '✓' : '✗'}} | {{settings_diff.difference}}% |
```

### Multi-Simulator Testing

```yaml
name: iOS Multi-Device Test
description: Run tests across different simulators

steps:
  # iPhone 15 Pro
  - action: ios.run_flow
    inputs:
      flow: flows/core_flow.yaml
      simulator: "iPhone 15 Pro"
      app: com.example.myapp
    store_as: iphone15_result

  # iPhone SE
  - action: ios.run_flow
    inputs:
      flow: flows/core_flow.yaml
      simulator: "iPhone SE (3rd generation)"
      app: com.example.myapp
    store_as: iphonese_result

  # iPad Pro
  - action: ios.run_flow
    inputs:
      flow: flows/core_flow.yaml
      simulator: "iPad Pro 12.9-inch (6th generation)"
      app: com.example.myapp
    store_as: ipadpro_result

  # Summary
  - action: message
    content: |
      ## Multi-Device Results

      | Device | Status | Duration |
      |--------|--------|----------|
      | iPhone 15 Pro | {{iphone15_result.passed ? '✓' : '✗'}} | {{iphone15_result.durationSeconds}}s |
      | iPhone SE | {{iphonese_result.passed ? '✓' : '✗'}} | {{iphonese_result.durationSeconds}}s |
      | iPad Pro | {{ipadpro_result.passed ? '✓' : '✗'}} | {{ipadpro_result.durationSeconds}}s |
```

### Error Investigation

```yaml
name: iOS Error Debug
description: Capture detailed state when issues occur

steps:
  # Run the problematic flow
  - action: ios.run_flow
    inputs:
      flow: flows/checkout_flow.yaml
      app: com.example.myapp
      continue_on_error: true
    store_as: flow_result

  # Capture state regardless of result
  - action: ios.snapshot
    inputs:
      app: com.example.myapp
      duration: 300          # 5 minutes of logs
      include_crash: true
    store_as: debug_snapshot

  # Check for crashes
  - action: conditional
    condition: "{{ debug_snapshot.hasCrashes }}"
    then:
      - action: message
        content: |
          ## Crash Detected!

          Crash logs saved to:
          {{debug_snapshot.crashPaths | join('\n')}}

          Screenshot: {{debug_snapshot.screenshotPath}}

  # Report errors in logs
  - action: message
    content: |
      ## Debug Information

      Flow status: {{flow_result.passed ? 'PASSED' : 'FAILED'}}
      Error count: {{debug_snapshot.summary.errorCount}}
      Warning count: {{debug_snapshot.summary.warningCount}}

      Artifacts: {{debug_snapshot.artifactDir}}
```

## Using Variables

Playbooks support variable interpolation with `{{ }}` syntax:

```yaml
name: iOS Parameterized Test
description: Test with different credentials

env:
  TEST_EMAIL: user@example.com
  TEST_PASSWORD: password123

steps:
  - action: ios.run_flow
    inputs:
      flow: flows/login_flow.yaml
      app: com.example.myapp
      env:
        USERNAME: "{{ env.TEST_EMAIL }}"
        PASSWORD: "{{ env.TEST_PASSWORD }}"
```

## Running Playbooks

Execute playbooks with the `/ios.playbook` command:

```
/ios.playbook run login_test
/ios.playbook run visual_regression --verbose
```

Or via Auto Run:

1. Save the playbook to your Auto Run folder
2. Select it in the Auto Run panel
3. Click "Run" or use the keyboard shortcut

## Best Practices

1. **Use descriptive names**: Give playbooks and steps clear names
2. **Store results**: Use `store_as` to capture outputs for reporting
3. **Add assertions**: Verify expected conditions with `assert` actions
4. **Handle errors**: Use `continue_on_error` and conditionals
5. **Capture context**: Take snapshots before and after critical actions
6. **Use variables**: Parameterize values for reusability
7. **Group related tests**: Organize playbooks by feature or flow

## Next Steps

- [Command Reference](./commands) - Full iOS command documentation
- [Visual Regression](./visual-regression) - Baseline and diff testing
- [CI Integration](./ci-integration) - Run playbooks in CI/CD
