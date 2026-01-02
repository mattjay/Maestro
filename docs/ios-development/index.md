---
title: iOS Development Tools
description: Comprehensive iOS development integration for AI-assisted mobile development.
icon: mobile
---

Maestro includes powerful iOS development tools that enable AI agents to "see" and interact with iOS simulators. This closes the feedback loop between code changes and their visual/behavioral results, making AI-assisted iOS development seamless.

## What's Included

<CardGroup cols={2}>
  <Card title="Screen Capture" icon="camera" href="./commands#snapshot">
    Instant screenshots and UI inspection for any running simulator
  </Card>
  <Card title="UI Automation" icon="robot" href="./commands#run-flow">
    Run Maestro Mobile flows for automated testing and interaction
  </Card>
  <Card title="Visual Regression" icon="eye" href="./visual-regression">
    Baseline comparisons and diff detection for visual testing
  </Card>
  <Card title="App Introspection" icon="magnifying-glass" href="./bridge">
    MaestroBridge for deep debugging and state inspection
  </Card>
</CardGroup>

## Why iOS Tools?

Traditional iOS development has a fragmented feedback loop:

1. Write code in IDE
2. Build and run in simulator
3. Manually inspect the UI
4. Debug with Xcode tools
5. Return to IDE to iterate

**With Maestro's iOS tools**, the AI agent can:

- Capture screenshots to verify UI changes
- Run automated flows to test interactions
- Inspect the UI element tree for debugging
- Compare screens against baselines for regression testing
- Access app internal state via MaestroBridge

This tight integration means faster iterations and more reliable results.

## Quick Start

<Steps>
  <Step title="Check Your Environment">
    Run the setup wizard to verify Xcode, simulators, and Maestro CLI are ready:
    ```
    /ios.setup --check
    ```
  </Step>
  <Step title="Capture Your First Screenshot">
    With a simulator running, capture the current screen:
    ```
    /ios.snapshot
    ```
  </Step>
  <Step title="Inspect UI Elements">
    View the accessibility tree and element hierarchy:
    ```
    /ios.inspect
    ```
  </Step>
  <Step title="Run a Test Flow">
    Execute a Maestro Mobile YAML flow:
    ```
    /ios.run_flow maestro/login_flow.yaml
    ```
  </Step>
</Steps>

## Requirements

| Requirement | Details |
|-------------|---------|
| **macOS** | iOS Simulator only runs on macOS |
| **Xcode** | Required for `xcrun simctl` commands |
| **Simulator** | At least one iOS Simulator must be booted |
| **Maestro CLI** | Required for `/ios.run_flow` (optional for other commands) |

Check your environment status:
```bash
# Check Xcode
xcode-select -p

# List booted simulators
xcrun simctl list devices booted

# Check Maestro CLI
maestro --version
```

## Documentation Sections

<CardGroup cols={2}>
  <Card title="Setup Guide" icon="gear" href="./setup">
    Environment setup, project configuration, and the `/ios.setup` wizard
  </Card>
  <Card title="Command Reference" icon="terminal" href="./commands">
    Complete reference for all iOS slash commands
  </Card>
  <Card title="Playbook Integration" icon="play" href="./playbooks">
    Using iOS commands in Auto Run playbooks and YAML workflows
  </Card>
  <Card title="MaestroBridge" icon="plug" href="./bridge">
    Deep app introspection and debug-time state inspection
  </Card>
  <Card title="Visual Regression" icon="code-compare" href="./visual-regression">
    Baseline management, diff detection, and regression workflows
  </Card>
  <Card title="CI Integration" icon="circle-nodes" href="./ci-integration">
    Running iOS tests in CI/CD pipelines
  </Card>
  <Card title="Troubleshooting" icon="life-ring" href="./troubleshooting">
    Common issues and their solutions
  </Card>
</CardGroup>

## Sample Flows

Maestro includes sample Maestro Mobile flows to get you started. See the [examples directory](/docs/examples/ios-flows) for ready-to-use templates:

- `login-flow.yaml` - Standard login with credentials
- `onboarding-flow.yaml` - First-run user experience
- `form-validation-flow.yaml` - Form input and validation
- `shopping-cart-flow.yaml` - E-commerce cart interactions
- And more...

## Getting Help

- **In-app help**: `/ios.help` shows all iOS commands
- **Command help**: `/ios.help <command>` for detailed usage
- **Troubleshooting**: `/ios.help --troubleshoot` for common issues
- **Discord**: [Join the community](https://discord.gg/SVSRy593)
