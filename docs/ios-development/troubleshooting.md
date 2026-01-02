---
title: iOS Troubleshooting
description: Common issues and solutions for iOS development with Maestro.
icon: life-ring
---

This guide covers common issues you may encounter when using Maestro's iOS development tools and how to resolve them.

## Environment Issues

### "Xcode Not Found"

Maestro couldn't find Xcode on your system.

**Solution:**
1. Install Xcode from the App Store
2. Open Xcode once to accept the license
3. Install Command Line Tools:
   ```bash
   xcode-select --install
   ```
4. Verify installation:
   ```bash
   xcode-select -p
   # Should output: /Applications/Xcode.app/Contents/Developer
   ```

### "Command Line Tools Not Installed"

The Xcode Command Line Tools are missing.

**Solution:**
```bash
xcode-select --install
```

Or from Xcode:
1. Open Xcode
2. Go to **Preferences** → **Locations**
3. Select the Command Line Tools version

### "No Simulator Booted"

No iOS Simulator is currently running.

**Solution:**
```bash
# List available simulators
xcrun simctl list devices available

# Boot a simulator
xcrun simctl boot "iPhone 15 Pro"

# Or open the Simulator app
open -a Simulator
```

### "Simulator Not Found"

The specified simulator doesn't exist.

**Solution:**
```bash
# List all available simulators
xcrun simctl list devices available

# Use exact name (case-insensitive)
/ios.snapshot --simulator "iPhone 15 Pro"
```

Common simulator names:
- `iPhone 15 Pro`
- `iPhone 15`
- `iPhone SE (3rd generation)`
- `iPad Pro 12.9-inch (6th generation)`

### "Maestro CLI Not Installed"

The Maestro Mobile CLI is not installed.

**Solution:**
```bash
# Homebrew (recommended)
brew tap mobile-dev-inc/tap
brew install maestro

# Or direct installation
curl -Ls "https://get.maestro.mobile.dev" | bash

# Verify
maestro --version
```

## Simulator Issues

### Simulator Frozen or Unresponsive

The simulator is not responding to commands.

**Solution:**
1. Quit Simulator app completely
2. Kill stuck processes:
   ```bash
   killall Simulator
   killall com.apple.CoreSimulator.CoreSimulatorService
   ```
3. Erase the simulator:
   ```bash
   xcrun simctl erase "iPhone 15 Pro"
   ```
4. Reboot the simulator:
   ```bash
   xcrun simctl boot "iPhone 15 Pro"
   ```

### Screenshot Timeout

Screenshot capture is timing out.

**Solution:**
1. Check if simulator is responsive
2. Wait for any animations to complete
3. Restart the simulator if frozen
4. Try a different simulator

### Simulator Performance Issues

The simulator is running slowly.

**Solution:**
1. Close unnecessary applications
2. Increase RAM allocation in Xcode preferences
3. Use a lighter simulator (e.g., iPhone SE instead of iPad Pro)
4. Disable unnecessary simulator features:
   ```bash
   # Disable animations
   defaults write com.apple.iphonesimulator AppleShowScrollBars -string "Always"
   ```

## Command Issues

### Element Not Found

The specified element cannot be located.

**Diagnosis:**
```
/ios.inspect --app com.example.myapp
```

**Solutions:**
1. Verify the accessibility identifier/label is correct
2. Check if element is visible on screen
3. Wait for element to appear:
   ```
   /ios.run_flow --inline "waitfor:Login"
   ```
4. Increase timeout:
   ```
   /ios.tap #element --timeout 15000
   ```
5. Try different targeting methods:
   ```
   # By accessibility ID
   /ios.tap #login_button

   # By label
   /ios.tap "Sign In"

   # By coordinates
   /ios.tap 150,300
   ```

### Element Not Hittable

The element exists but cannot be tapped.

**Causes:**
- Element is obscured by another view
- Element is outside visible bounds
- Element has zero size
- Element is disabled

**Solutions:**
1. Scroll to reveal element:
   ```
   /ios.scroll --to #element
   ```
2. Dismiss any overlays (modals, alerts)
3. Check element state:
   ```
   /ios.inspect --element #element
   ```
4. Wait for animations to complete

### Flow Validation Error

The Maestro flow YAML has syntax errors.

**Solution:**
```bash
# Validate flow syntax
maestro validate path/to/flow.yaml
```

Common issues:
- Incorrect indentation
- Missing quotes around values with special characters
- Invalid action names

### Timeout Errors

Actions are timing out.

**Solutions:**
1. Increase command timeout:
   ```
   /ios.run_flow flow.yaml --timeout 600
   ```
2. Add explicit waits in flows:
   ```yaml
   - wait: 2000
   - extendedWaitUntil:
       visible:
         text: "Dashboard"
       timeout: 15000
   ```
3. Wait for animations:
   ```yaml
   - waitForAnimationToEnd:
       timeout: 5000
   ```

## Flow Issues

### Flaky Tests

Tests pass sometimes and fail other times.

**Solutions:**
1. Add explicit waits before interactions
2. Wait for animations to complete
3. Use `--retry` option:
   ```
   /ios.run_flow flow.yaml --retry 3
   ```
4. Add stability assertions:
   ```yaml
   - extendedWaitUntil:
       visible:
         text: "Ready"
       timeout: 10000
   ```

### App Not Launching

The app fails to launch in flows.

**Solutions:**
1. Verify app is installed:
   ```bash
   xcrun simctl listapps booted | grep com.example.myapp
   ```
2. Install app if missing:
   ```bash
   xcrun simctl install booted path/to/MyApp.app
   ```
3. Clear app state:
   ```yaml
   - launchApp:
       appId: com.example.myapp
       clearState: true
       clearKeychain: true
   ```

### Keyboard Issues

Text input isn't working correctly.

**Solutions:**
1. Dismiss keyboard after input:
   ```yaml
   - inputText: "hello"
   - hideKeyboard
   ```
2. Tap the text field first:
   ```yaml
   - tapOn:
       id: "email_field"
   - inputText: "user@example.com"
   ```
3. Clear existing text:
   ```yaml
   - eraseText
   - inputText: "new text"
   ```

## Visual Regression Issues

### High False Positive Rate

Too many differences detected that aren't real issues.

**Solutions:**
1. Increase threshold:
   ```
   /ios.diff screen --threshold 0.2
   ```
2. Add ignore regions for dynamic content:
   ```
   /ios.baseline ignore screen status_bar
   /ios.baseline ignore screen element --id timestamp_label
   ```
3. Use device-specific baselines:
   ```
   /ios.baseline save screen --auto-device-family
   ```

### Baselines Don't Match After Update

Baselines are different after app changes.

**Solution:**
Update baselines after intentional changes:
```
/ios.baseline update screen_name
```

Or run regression with update flag:
```
/ios.regression --update
```

### Antialiasing Differences

Minor pixel differences at edges of shapes.

**Solution:**
Increase threshold to tolerate antialiasing:
```
/ios.diff screen --threshold 0.05
```

## MaestroBridge Issues

### Bridge Not Connecting

Cannot connect to MaestroBridge in the app.

**Solutions:**
1. Verify app is a DEBUG build
2. Check bridge is started:
   ```swift
   #if DEBUG
   MaestroBridge.shared.start(token: "token")
   #endif
   ```
3. Check port availability:
   ```bash
   lsof -i :9876
   ```
4. Try different port:
   ```
   /ios.bridge.connect --port 9877
   ```

### Token Not Working

Authentication is failing.

**Solutions:**
1. Check token in console when bridge starts
2. Use Bearer prefix:
   ```
   Authorization: Bearer <token>
   ```
3. Verify exact token match (case-sensitive)

### State Not Updating

Registered state isn't showing current values.

**Solutions:**
1. Verify provider returns current values
2. Check registration timing (before state access)
3. Look for errors in Xcode console

## Permission Issues

### Artifact Directory Access

Cannot write to artifacts directory.

**Solution:**
```bash
chmod -R 755 ~/Library/Application\ Support/Maestro/ios-artifacts/
```

### Simulator Access

Cannot access simulator for screenshots.

**Solution:**
```bash
# Reset simulators
xcrun simctl shutdown all
xcrun simctl erase all

# Restart CoreSimulator
sudo launchctl kickstart -k system/com.apple.CoreSimulator.CoreSimulatorService
```

## Getting Help

If you're still experiencing issues:

1. **Check Environment**:
   ```
   /ios.setup --check
   ```

2. **Enable Debug Mode**:
   ```
   /ios.snapshot --debug
   /ios.run_flow flow.yaml --debug
   ```

3. **Collect Logs**:
   - System logs: `/ios.snapshot --duration 300`
   - Crash logs: `/ios.snapshot --include-crash`

4. **Report Issues**:
   - [GitHub Issues](https://github.com/pedramamini/Maestro/issues)
   - [Discord Community](https://discord.gg/SVSRy593)

## Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| No simulator | `xcrun simctl boot "iPhone 15 Pro"` |
| Simulator frozen | `killall Simulator` then reboot |
| Element not found | `/ios.inspect` to view hierarchy |
| Timeout | Add `--timeout` or explicit waits |
| Flaky tests | Use `--retry` and add waits |
| Visual diffs | Increase threshold, add ignore regions |
| Bridge not connecting | Check DEBUG build and port |
