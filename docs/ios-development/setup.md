---
title: iOS Setup Guide
description: Set up your iOS development environment for AI-assisted development with Maestro.
icon: gear
---

This guide walks you through setting up your macOS environment for iOS development with Maestro.

## Prerequisites

Before using Maestro's iOS tools, ensure you have:

| Requirement | How to Install | Verification |
|-------------|----------------|--------------|
| **macOS** | Required (iOS Simulator is macOS-only) | - |
| **Xcode** | [App Store](https://apps.apple.com/app/xcode/id497799835) | `xcode-select -p` |
| **Xcode Command Line Tools** | `xcode-select --install` | `xcode-select -p` |
| **iOS Simulator** | Included with Xcode | `xcrun simctl list devices` |
| **Maestro CLI** (optional) | See [below](#install-maestro-cli) | `maestro --version` |

## Quick Environment Check

Run the setup wizard to verify your environment:

```
/ios.setup --check
```

This detects:
- Xcode installation and version
- Command Line Tools
- Available simulators
- Maestro CLI installation
- Any issues with recommendations

## The `/ios.setup` Wizard

For new projects or first-time setup, use the interactive wizard:

```
/ios.setup
```

The wizard guides you through:

### Step 1: Environment Check

```
🔍 Checking iOS Development Environment...

✅ Xcode 15.2 installed
✅ Command Line Tools installed
✅ iOS 17.2 Simulator available
⚠️ Maestro CLI not installed

Would you like to install Maestro CLI? (recommended for UI automation)
[Yes] [Skip for now]
```

### Step 2: Project Detection

```
📁 Analyzing project at /path/to/project...

✅ Found: MyApp.xcworkspace
✅ Schemes: MyApp, MyAppTests, MyAppUITests
✅ Bundle ID: com.example.myapp

Is this correct? [Yes] [Select different project]
```

### Step 3: Simulator Selection

```
📱 Select default simulator for testing:

> iPhone 15 Pro (iOS 17.2) [Recommended]
  iPhone 15 (iOS 17.2)
  iPhone SE (3rd generation) (iOS 17.2)
  iPad Pro 12.9" (iOS 17.2)

[Select] [Use all]
```

### Step 4: XCUITest Setup

```
🧪 XCUITest Configuration

❌ No XCUITest target found

Would you like to create one? This enables:
• UI inspection (/ios.inspect)
• Native interactions (/ios.tap, /ios.type)
• Accessibility tree access

[Create XCUITest target] [Skip - use Maestro CLI only]
```

### Step 5: MaestroBridge Setup (Optional)

```
🔌 MaestroBridge Integration (Optional)

MaestroBridge provides debug-time introspection:
• View controller stack visibility
• Feature flag inspection
• Network request logging
• Analytics event tracking

Would you like to add MaestroBridge to your project?
[Add to project] [Skip]
```

### Step 6: Sample Flow Generation

```
📝 Generate Sample Flow

Creating sample Maestro flow for your app...

Generated: maestro/sample_flow.yaml

This flow:
• Launches your app
• Takes a screenshot
• Demonstrates basic interactions

Try it with: /ios.run_flow maestro/sample_flow.yaml
```

### Step 7: Summary

```
🎉 iOS Development Environment Ready!

Configuration saved to: .maestro/ios-config.json

Quick Start Commands:
• /ios.snapshot - Capture current screen
• /ios.inspect - View UI element tree
• /ios.run_flow maestro/sample_flow.yaml - Run sample flow
• /ios.playbook list - View available playbooks

Documentation: https://docs.runmaestro.ai/ios-development
```

## Command Options

| Command | Description |
|---------|-------------|
| `/ios.setup` | Run interactive wizard |
| `/ios.setup --check` | Check environment only |
| `/ios.setup --fix` | Attempt to fix issues automatically |
| `/ios.setup --reset` | Reset configuration |
| `/ios.setup -p /path` | Specify project path |

## Install Maestro CLI

Maestro CLI is required for `/ios.run_flow` but optional for other commands.

### Option 1: Homebrew (Recommended)

```bash
brew tap mobile-dev-inc/tap
brew install maestro
```

### Option 2: Direct Installation

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### Verify Installation

```bash
maestro --version
```

## Project Configuration

After setup, configuration is saved to `.maestro/ios-config.json`:

```json
{
  "project": {
    "path": "/path/to/MyApp.xcworkspace",
    "scheme": "MyApp",
    "bundleId": "com.example.myapp"
  },
  "simulator": {
    "default": "iPhone 15 Pro",
    "udid": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
  },
  "xcuitest": {
    "enabled": true,
    "targetName": "MyAppUITests"
  },
  "bridge": {
    "enabled": false,
    "port": 9876
  },
  "baselines": {
    "directory": "./ios-baselines"
  },
  "flows": {
    "directory": "./maestro"
  }
}
```

## Global Settings

User-wide settings are stored in `~/.maestro/ios-settings.json`:

```json
{
  "defaultSimulator": "iPhone 15 Pro",
  "maestroCliPath": "/opt/homebrew/bin/maestro",
  "screenshotFormat": "png",
  "logRetentionDays": 7,
  "diffThreshold": 0.01
}
```

## Simulator Management

### List Available Simulators

```bash
xcrun simctl list devices available
```

### Boot a Simulator

```bash
xcrun simctl boot "iPhone 15 Pro"
```

Or use the Simulator app:
```bash
open -a Simulator
```

### Boot via Maestro

```
/ios.setup --fix
```

This boots the recommended simulator if none are running.

### Check Booted Simulators

```bash
xcrun simctl list devices booted
```

## Directory Structure

A typical iOS project with Maestro integration:

```
MyApp/
├── MyApp.xcodeproj
├── Sources/
├── Tests/
├── UITests/                    # XCUITest target
├── maestro/                    # Maestro Mobile flows
│   ├── login_flow.yaml
│   ├── home_flow.yaml
│   └── checkout_flow.yaml
├── ios-baselines/              # Visual regression baselines
│   ├── login.png
│   └── home.png
└── .maestro/
    └── ios-config.json         # Project configuration
```

## Next Steps

After setup is complete:

1. **Capture a screenshot**: `/ios.snapshot`
2. **Inspect UI elements**: `/ios.inspect`
3. **Run your first flow**: `/ios.run_flow maestro/sample_flow.yaml`
4. **Create a baseline**: `/ios.baseline login_screen`

See the [Command Reference](./commands) for all available commands.
