# SampleApp - Maestro iOS Integration Demo

This sample project demonstrates full Maestro iOS integration, including:

- **Project Configuration**: `.maestro/ios-config.json` with all settings
- **Maestro Flows**: Example YAML flows in `maestro/`
- **Visual Baselines**: Baseline screenshots in `ios-baselines/`
- **XCUITest Integration**: UI testing target for /ios.inspect
- **MaestroBridge**: Optional debug-time introspection

## Quick Start

1. Open the project in Xcode:
   ```bash
   open SampleApp/SampleApp.xcodeproj
   ```

2. Build and run on a simulator:
   ```bash
   /ios.build
   ```

3. Run a flow:
   ```bash
   /ios.run_flow maestro/login_flow.yaml
   ```

## Project Structure

```
ios-sample-app/
├── SampleApp/                    # Xcode project
│   ├── SampleApp.xcodeproj       # Project file
│   ├── Sources/                  # App source code
│   │   ├── App/                  # App entry point
│   │   ├── Views/                # SwiftUI views
│   │   ├── Models/               # Data models
│   │   └── Services/             # Business logic
│   ├── Resources/                # Assets and configs
│   └── Tests/
│       ├── SampleAppTests/       # Unit tests
│       └── SampleAppUITests/     # XCUITest target
├── maestro/                      # Maestro flows
│   ├── login_flow.yaml           # Login flow
│   ├── home_flow.yaml            # Home navigation
│   └── checkout_flow.yaml        # E-commerce checkout
├── ios-baselines/                # Visual regression baselines
│   ├── login.png
│   └── home.png
└── .maestro/
    └── ios-config.json           # Maestro iOS configuration
```

## Included Flows

### login_flow.yaml
Demonstrates:
- App launch with fresh state
- Text input in form fields
- Button tapping
- Element assertions
- Screenshot capture

### home_flow.yaml
Demonstrates:
- Tab bar navigation
- Screen transitions
- Pull-to-refresh gestures
- Multiple screenshots

### checkout_flow.yaml
Demonstrates:
- Complete e-commerce flow
- Scroll until visible
- Form filling
- Environment variables
- Error handling patterns

## Running Tests

### Run all flows:
```bash
/ios.playbook regression-check
```

### Run visual regression:
```bash
/ios.diff login
/ios.diff home
```

### Inspect UI elements:
```bash
/ios.inspect
```

### Take a snapshot:
```bash
/ios.snapshot
```

## XCUITest Integration

The `SampleAppUITests` target enables deep UI inspection through `/ios.inspect`. This provides:

- Full accessibility tree
- Element coordinates
- Accessibility identifiers
- State information (enabled, selected, etc.)

## MaestroBridge Integration

When enabled, MaestroBridge provides:

- View controller stack visibility
- Feature flag inspection
- Network request logging
- Analytics event tracking

Enable bridge in config:
```json
{
  "bridge": {
    "enabled": true,
    "port": 9876
  }
}
```

Then use:
```bash
/ios.bridge.state
/ios.bridge.analytics
```

## Customization

### Modify Configuration

Edit `.maestro/ios-config.json` to:
- Change default simulator
- Enable/disable features
- Adjust port settings
- Set custom directories

### Add New Flows

Create new `.yaml` files in `maestro/`:
```yaml
appId: com.maestro.sampleapp
name: My New Flow
---
- launchApp
- assertVisible: "Welcome"
- tapOn: "Continue"
```

### Update Baselines

When UI changes intentionally:
```bash
/ios.snapshot --save-baseline login
```

## Troubleshooting

### Flow fails to find element
1. Run `/ios.inspect` to see available elements
2. Check accessibility identifiers match
3. Increase timeout values

### Simulator not booting
```bash
/ios.setup --fix
```

### Configuration issues
```bash
/ios.setup --check
```
