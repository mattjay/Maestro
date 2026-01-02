# Maestro iOS Samples

This directory contains sample projects and resources demonstrating Maestro iOS integration.

## ios-sample-app/

A complete sample iOS application with full Maestro integration. Demonstrates:

- **Project Configuration**: `.maestro/ios-config.json` with all settings
- **Maestro Flows**: Example YAML flows in `maestro/`
- **Visual Baselines**: Baseline screenshots in `ios-baselines/`
- **XCUITest Integration**: UI testing target for `/ios.inspect`
- **MaestroBridge**: Optional debug-time introspection

### Quick Start

```bash
cd ios-sample-app
open SampleApp/SampleApp.xcodeproj
```

Then in Maestro:
```
/ios.setup
/ios.run_flow maestro/login_flow.yaml
```

## flows/

Standalone Maestro flow examples demonstrating common patterns:

- `login_flow.yaml` - Standard login flow
- `navigation_flow.yaml` - Tab navigation patterns
- `form_flow.yaml` - Form filling techniques
- `scroll_flow.yaml` - Scrolling and list handling
- `modal_flow.yaml` - Modal and alert handling

These flows are designed to be copied and adapted for your own projects.

## Contributing

When adding new samples:

1. Include complete, runnable examples
2. Add comprehensive comments explaining each step
3. Demonstrate accessibility identifiers
4. Include both simple and complex patterns
5. Update this README with the new sample
