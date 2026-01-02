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

- [x] Create `src/main/slash-commands/ios-setup.ts`
  - [x] `/ios.setup` - run interactive wizard
  - [x] `/ios.setup --check` - only check environment
  - [x] `/ios.setup --fix` - attempt to fix issues
  - [x] `/ios.setup --reset` - reset configuration

  **Implementation Notes (Jan 2, 2026):**
  - Created comprehensive slash command handler with 4 modes: wizard, check, fix, reset
  - Argument parsing with `parseSetupArgs()` supporting `-p/--project` for custom paths
  - Wizard mode integrates with wizard.ts for step-by-step setup flow
  - Check mode runs `detectEnvironment()`, `detectProjectType()`, `detectExistingIntegration()` in parallel
  - Fix mode automatically creates `.maestro/`, `maestro/`, and `ios-baselines/` directories, boots recommended simulator
  - Reset mode safely deletes config with backup info display
  - All modes return formatted Markdown output for AI terminal display
  - 52 unit tests covering all modes, argument parsing, and edge cases
  - Command metadata registered in `src/main/slash-commands/index.ts` for autocomplete

---

## Configuration Management

### Project Configuration

- [x] Create `src/main/ios-tools/config.ts`
  - [x] Store project-level iOS configuration
  - [x] Support `.maestro/ios-config.json`

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

  **Completed Notes:**
  - Created comprehensive config module with 64 unit tests
  - `IOSProjectConfig` interface with full project, simulator, XCUITest, bridge, baselines, and flows settings
  - `IOSGlobalSettings` interface for user-wide settings (default simulator, screenshot format, log retention, diff threshold)
  - `IOSMergedConfig` combines project + global with effective values resolved via precedence
  - Functions: `loadProjectConfig`, `saveProjectConfig`, `updateProjectConfig`, `deleteProjectConfig`
  - Validation functions with errors, warnings, and suggestions
  - Recent projects tracking in global settings
  - Path utilities: `resolveProjectPath`, `getEffectiveFlowsDirectory`, `getEffectiveBaselinesDirectory`
  - Exported from `ios-tools/index.ts` with proper naming to avoid conflicts

### Global Configuration

- [x] Support global iOS settings in `~/.maestro/ios-settings.json`
  ```json
  {
    "defaultSimulator": "iPhone 15 Pro",
    "maestroCliPath": "/opt/homebrew/bin/maestro",
    "screenshotFormat": "png",
    "logRetentionDays": 7
  }
  ```

  **Completed Notes:**
  - Includes: `defaultSimulator`, `defaultSimulatorUdid`, `maestroCliPath`, `screenshotFormat`, `logRetentionDays`, `defaultBridgePort`, `autoBootSimulator`, `diffThreshold`, `telemetry`, `recentProjects`, `customFlowsDirectory`, `customBaselinesDirectory`
  - Functions: `loadGlobalSettings`, `saveGlobalSettings`, `updateGlobalSettings`, `initializeGlobalSettings`
  - Falls back to sensible defaults when file doesn't exist

---

## Sample Projects

### Starter Templates

- [x] Create sample iOS project with full integration
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

  **Implementation Notes (Jan 2, 2026):**
  - Created complete sample iOS app in `samples/ios-sample-app/` with:
    - SwiftUI app with login, home, shop, profile, settings, cart, and checkout views
    - All views have proper accessibility identifiers for Maestro automation
    - Models for User, Product, CartItem, Order, ShippingAddress, PaymentInfo
    - AppState for authentication and cart management
  - Maestro flows in `maestro/`: login_flow.yaml, home_flow.yaml, checkout_flow.yaml
  - Configuration in `.maestro/ios-config.json` with full project settings
  - XCUITest target in `Tests/SampleAppUITests/` with inspector support
  - Unit tests in `Tests/SampleAppTests/`
  - Comprehensive README.md with usage instructions

- [x] Include MaestroBridge integration example
  - Configuration enables bridge with port 9876
  - README documents bridge usage commands

- [x] Include XCUITest inspector setup
  - `SampleAppUITests.swift` provides XCUITest target
  - Includes `testMaestroInspection()` and `testElementTreeSnapshot()` for debugging
  - Full test coverage for login, navigation, and checkout flows

- [x] Include common flow patterns
  - Login flow: app launch, text input, assertions, screenshots
  - Home flow: tab navigation, pull-to-refresh, swipe gestures
  - Checkout flow: form filling, env variables, multi-step flows

### Demo Flows

- [x] Create `samples/flows/` directory
  - [x] `login_flow.yaml` - standard login flow with detailed comments
  - [x] `navigation_flow.yaml` - tab navigation, push navigation, modals
  - [x] `form_flow.yaml` - text input, pickers, toggles, validation
  - [x] `scroll_flow.yaml` - scrolling, scroll until visible, pull to refresh
  - [x] `modal_flow.yaml` - system alerts, app alerts, bottom sheets, action sheets

  **Implementation Notes (Jan 2, 2026):**
  - All flows include comprehensive comments explaining each step
  - Designed as templates that can be copied and adapted
  - Demonstrate accessibility identifiers and best practices

---

## Documentation

### In-App Help

- [x] Create `/ios.help` command *(Completed: Created comprehensive help command at `src/main/slash-commands/ios-help.ts` with 89 passing tests)*
  - [x] `/ios.help` - show all iOS commands *(Displays categorized command overview: Setup & Configuration, Screen Capture & Inspection, UI Interactions, Flow Automation, Visual Regression, Debug Introspection)*
  - [x] `/ios.help <command>` - detailed help for specific command *(Shows overview, usage, options table, examples, troubleshooting, and related commands)*
  - [x] Examples for each command *(Extended examples available with `--examples` or `-e` flag)*
  - [x] Common troubleshooting *(Full troubleshooting guide with `--troubleshoot` or `-t` flag covering: Xcode setup, simulators, Maestro CLI, element interactions, flow automation, visual regression, and MaestroBridge)*

- [x] Create contextual tips *(Completed: Created comprehensive contextual tips system at `src/main/ios-tools/contextual-tips.ts` with 81 passing tests)*
  - [x] Show tips when errors occur *(Error tips with title, message, recovery tips, quick fixes, doc links, and related commands for all IOSErrorCode and InteractionErrorCode values)*
  - [x] Suggest next steps after actions *(Next steps generated for all commands based on success/failure state and action context)*
  - [x] Link to relevant documentation *(Documentation links via `getDocLink()`, `getCommandDocLink()`, `getErrorDocLink()` pointing to docs.runmaestro.ai/ios-development)*

  **Implementation Notes (Jan 2, 2026):**
  - Core types: `IOSCommand`, `ContextualTip`, `ActionContext`, `NextStep`, `ErrorTip`, `WorkflowSuggestion`
  - Documentation helpers: `DOCS_BASE_URL`, `DOCS_PAGES`, `getDocLink()`, `getCommandDocLink()`, `getErrorDocLink()`
  - Next step generation via `getNextSteps()` for all iOS commands (snapshot, inspect, tap, type, scroll, swipe, run_flow, playbook, baseline, diff, regression, setup, bridge.*)
  - Error tips via `getErrorTip()` covering environment, element interaction, Maestro/flow, and screenshot/timeout errors
  - Contextual tips generation via `generateContextualTips()` with priority-based sorting
  - Workflow suggestions: Feature Development, Visual Regression Setup, Debug Element Issue, Environment Check
  - Formatting functions: `formatContextualTips()`, `formatNextSteps()`, `formatErrorTip()`, `formatCompactTip()`, `formatWorkflowSuggestion()`
  - Exported from `ios-tools/index.ts` for use in slash commands

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
