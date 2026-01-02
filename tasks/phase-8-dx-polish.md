# Phase 8: DX Polish - Make It Magical

**Goal**: Streamline the onboarding experience and make iOS integration feel effortless for new users.

**Deliverable**: `/ios.setup` wizard command, sample projects, comprehensive documentation, and polished UX.

**Dependency**: All previous phases

---

## /ios.setup Wizard

### Setup Detection

- [x] Create `src/main/ios-tools/setup/detector.ts`
  - [x] `detectXcodeInstallation()` - check Xcode and command line tools
  - [x] `detectSimulators()` - check available simulators
  - [x] `detectMaestroCli()` - check mobile-dev-inc Maestro
  - [x] `detectProjectType(path)` - identify iOS project structure
  - [x] `detectExistingIntegration(path)` - check if already set up

  **Implementation Notes (Jan 2, 2026):**
  - Created comprehensive detection module with 5 main functions plus `detectEnvironment()` for combined detection
  - All functions return `IOSResult<T>` pattern with success/error handling
  - Includes detailed result types with issues and recommendations
  - 24 unit tests covering all detection scenarios

### Setup Wizard Implementation

- [x] Create `src/main/ios-tools/setup/wizard.ts`
  - [x] Interactive setup wizard flow
  - [x] Step-by-step guidance
  - [x] Progress indicators
  - [x] Error recovery

  **Implementation Notes (Jan 2, 2026):**
  - Created comprehensive wizard module with 7 steps: environment, project, simulator, xcuitest, bridge, sample-flow, summary
  - State management with `createWizardState()`, `advanceStep()`, `processDecision()`, etc.
  - Step execution functions for each step with detailed output formatting
  - Progress tracking via `getProgress()` with percentage and step counts
  - Error recovery through retry capability (step status can be reset from failed to pending)
  - Configuration generation with `generateConfig()` and persistence via `saveConfig()`
  - Sample flow generation with `generateSampleFlow()`
  - 51 unit tests covering all wizard functionality

### Wizard Steps

- [x] **Step 1: Environment Check** (implemented in `executeEnvironmentStep()`)
  ```
  🔍 Checking iOS Development Environment...

  ✅ Xcode 15.2 installed
  ✅ Command Line Tools installed
  ✅ iOS 17.2 Simulator available
  ⚠️ Maestro CLI not installed

  Would you like to install Maestro CLI? (recommended for UI automation)
  [Yes] [Skip for now]
  ```

- [x] **Step 2: Project Detection** (implemented in `executeProjectStep()`)
  ```
  📁 Analyzing project at /path/to/project...

  ✅ Found: MyApp.xcworkspace
  ✅ Schemes: MyApp, MyAppTests, MyAppUITests
  ✅ Bundle ID: com.example.myapp

  Is this correct? [Yes] [Select different project]
  ```

- [x] **Step 3: Simulator Selection** (implemented in `executeSimulatorStep()`)
  ```
  📱 Select default simulator for testing:

  > iPhone 15 Pro (iOS 17.2) [Recommended]
    iPhone 15 (iOS 17.2)
    iPhone SE (3rd generation) (iOS 17.2)
    iPad Pro 12.9" (iOS 17.2)

  [Select] [Use all]
  ```

- [x] **Step 4: XCUITest Setup** (implemented in `executeXCUITestStep()`)
  ```
  🧪 XCUITest Configuration

  ❌ No XCUITest target found

  Would you like to create one? This enables:
  • UI inspection (/ios.inspect)
  • Native interactions (/ios.tap, /ios.type)
  • Accessibility tree access

  [Create XCUITest target] [Skip - use Maestro CLI only]
  ```

- [x] **Step 5: MaestroBridge Setup (Optional)** (implemented in `executeBridgeStep()`)
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

- [x] **Step 6: Sample Flow Generation** (implemented in `executeSampleFlowStep()` and `generateSampleFlow()`)
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

- [x] **Step 7: Summary** (implemented in `executeSummaryStep()`)
  ```
  🎉 iOS Development Environment Ready!

  Configuration saved to: .maestro/ios-config.json

  Quick Start Commands:
  • /ios.snapshot - Capture current screen
  • /ios.inspect - View UI element tree
  • /ios.run_flow maestro/sample_flow.yaml - Run sample flow
  • /ios.playbook list - View available playbooks

  Documentation: https://docs.runmaestro.ai/ios-development

  [Open documentation] [Start coding]
  ```

### Slash Command

- [ ] Create `src/main/slash-commands/ios-setup.ts`
  - [ ] `/ios.setup` - run interactive wizard
  - [ ] `/ios.setup --check` - only check environment
  - [ ] `/ios.setup --fix` - attempt to fix issues
  - [ ] `/ios.setup --reset` - reset configuration

---

## Configuration Management

### Project Configuration

- [ ] Create `src/main/ios-tools/config.ts`
  - [ ] Store project-level iOS configuration
  - [ ] Support `.maestro/ios-config.json`

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

### Global Configuration

- [ ] Support global iOS settings in `~/.maestro/ios-settings.json`
  ```json
  {
    "defaultSimulator": "iPhone 15 Pro",
    "maestroCliPath": "/opt/homebrew/bin/maestro",
    "screenshotFormat": "png",
    "logRetentionDays": 7
  }
  ```

---

## Sample Projects

### Starter Templates

- [ ] Create sample iOS project with full integration
  ```
  ios-sample-app/
  ├── SampleApp/
  │   ├── SampleApp.xcodeproj
  │   ├── Sources/
  │   ├── Tests/
  │   └── UITests/
  ├── maestro/
  │   ├── login_flow.yaml
  │   ├── home_flow.yaml
  │   └── checkout_flow.yaml
  ├── ios-baselines/
  │   ├── login.png
  │   └── home.png
  └── .maestro/
      └── ios-config.json
  ```

- [ ] Include MaestroBridge integration example
- [ ] Include XCUITest inspector setup
- [ ] Include common flow patterns

### Demo Flows

- [ ] Create `samples/flows/` directory
  - [ ] `login_flow.yaml` - standard login flow
  - [ ] `navigation_flow.yaml` - tab navigation
  - [ ] `form_flow.yaml` - form filling
  - [ ] `scroll_flow.yaml` - scrolling and lists
  - [ ] `modal_flow.yaml` - modal handling

---

## Documentation

### In-App Help

- [ ] Create `/ios.help` command
  - [ ] `/ios.help` - show all iOS commands
  - [ ] `/ios.help <command>` - detailed help for specific command
  - [ ] Examples for each command
  - [ ] Common troubleshooting

- [ ] Create contextual tips
  - [ ] Show tips when errors occur
  - [ ] Suggest next steps after actions
  - [ ] Link to relevant documentation

### Online Documentation

- [ ] Create documentation pages
  - [ ] `docs/ios-development/index.md` - overview
  - [ ] `docs/ios-development/setup.md` - getting started
  - [ ] `docs/ios-development/commands.md` - command reference
  - [ ] `docs/ios-development/playbooks.md` - playbook guide
  - [ ] `docs/ios-development/bridge.md` - MaestroBridge guide
  - [ ] `docs/ios-development/visual-regression.md` - visual testing
  - [ ] `docs/ios-development/ci-integration.md` - CI setup
  - [ ] `docs/ios-development/troubleshooting.md` - common issues

### Video Tutorials

- [ ] Script tutorial videos
  - [ ] "Getting Started with iOS in Maestro" (5 min)
  - [ ] "Automating iOS UI Tests" (10 min)
  - [ ] "Visual Regression Testing" (8 min)
  - [ ] "Deep Debugging with MaestroBridge" (10 min)

---

## Error Messages & Recovery

### Friendly Error Messages

- [ ] Create `src/main/ios-tools/errors/messages.ts`
  - [ ] User-friendly error messages
  - [ ] Actionable recovery steps
  - [ ] Links to documentation

  ```
  ❌ Xcode Not Found

  Maestro couldn't find Xcode on your system.

  To fix this:
  1. Install Xcode from the App Store
  2. Open Xcode once to accept the license
  3. Run: xcode-select --install

  Need help? https://docs.runmaestro.ai/ios-development/troubleshooting#xcode
  ```

### Auto-Recovery

- [ ] Implement automatic recovery where possible
  - [ ] Auto-boot simulator if not running
  - [ ] Auto-install app if not present
  - [ ] Retry transient failures
  - [ ] Suggest fixes for common issues

---

## Command Autocomplete

### Enhanced Autocomplete

- [ ] Add iOS-aware autocomplete
  - [ ] Simulator names from available list
  - [ ] Bundle IDs from installed apps
  - [ ] Scheme names from project
  - [ ] Flow file paths
  - [ ] Baseline names
  - [ ] Element identifiers from last inspect

### Command Suggestions

- [ ] Suggest related commands
  ```
  After /ios.snapshot, you might want:
  • /ios.inspect - Analyze UI elements
  • /ios.diff login_screen - Compare to baseline
  • /ios.assert_visible #element - Verify element
  ```

---

## Status Bar Integration

### iOS Session Indicator

- [ ] Add iOS status indicators to session UI
  - [ ] Simulator status (booted/shutdown)
  - [ ] App status (running/stopped)
  - [ ] Bridge status (connected/disconnected)
  - [ ] Last action result

### Quick Actions

- [ ] Add iOS quick actions to toolbar
  - [ ] 📷 Quick screenshot
  - [ ] 🔍 Quick inspect
  - [ ] ▶️ Run last flow
  - [ ] 🔄 Restart app

---

## Performance Monitoring

### Telemetry (Opt-in)

- [ ] Track usage patterns for improvement
  - [ ] Most used commands
  - [ ] Common error types
  - [ ] Setup completion rate
  - [ ] Playbook usage

### Performance Metrics

- [ ] Show performance metrics to users
  - [ ] Build times
  - [ ] Test execution times
  - [ ] Screenshot capture times
  - [ ] Comparison with previous runs

---

## Testing

- [x] Write tests for setup wizard (51 tests in wizard.test.ts)
- [x] Write tests for configuration management (included in wizard.test.ts)
- [ ] Test on fresh macOS installation
- [ ] Test with various Xcode versions
- [ ] Test with various project structures
- [ ] User testing with iOS developers

## Acceptance Criteria

- [ ] `/ios.setup` guides new users through complete setup
- [ ] Environment detection accurately identifies issues
- [ ] XCUITest target can be created automatically
- [ ] Sample flows are generated and work
- [ ] Configuration is saved and loaded correctly
- [ ] Error messages are clear and actionable
- [ ] Documentation is comprehensive and searchable
- [ ] Autocomplete enhances discoverability
- [ ] Status indicators show current state
- [ ] New user can go from "clone repo" to "verified feature" in < 10 minutes
