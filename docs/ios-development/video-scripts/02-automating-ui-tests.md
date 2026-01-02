# Video Script: Automating iOS UI Tests

**Duration**: 10 minutes
**Target Audience**: iOS developers familiar with Maestro basics
**Objective**: Master flow creation, playbook management, and comprehensive UI test automation

---

## Pre-Production Notes

### Required Footage
- [ ] Maestro app with sample iOS project
- [ ] YAML flow file creation and editing
- [ ] Flow execution with real-time output
- [ ] Playbook creation and management
- [ ] Error handling and recovery demonstrations

### Assets Needed
- Flow diagram animations showing action sequences
- Code syntax highlighting for YAML
- Progress indicator animations
- Success/failure state graphics

---

## Script

### [00:00 - 00:20] Intro

**[VISUAL: Maestro logo animation, then fade to iOS Simulator with app]**

**NARRATOR:**
"In the last video, you ran your first automation flow. Now let's master flow creation—writing comprehensive UI tests that cover login, navigation, forms, and complex user journeys. By the end, you'll have the skills to automate any iOS workflow."

---

### [00:20 - 01:00] Understanding Flow Structure

**[VISUAL: Open a sample flow YAML file in editor]**

**NARRATOR:**
"Every Maestro flow is a YAML file. Let's look at the anatomy of a flow."

**[VISUAL: Highlight app configuration section]**

```yaml
appId: com.example.myapp
---
```

**NARRATOR:**
"First, specify your app's bundle ID. This tells Maestro which app to target. The three dashes separate configuration from actions."

**[VISUAL: Highlight action list]**

```yaml
- launchApp
- tapOn:
    id: "login_button"
- inputText:
    text: "hello@example.com"
```

**NARRATOR:**
"Actions are a list of steps to execute. Each action has a type—like `tapOn`, `inputText`, or `assertVisible`—and optional parameters."

**[VISUAL: Animate arrows showing flow execution order]**

**NARRATOR:**
"Maestro executes actions top to bottom. If any action fails, the flow stops—unless you configure it to continue on errors."

---

### [01:00 - 02:30] The Login Flow

**[VISUAL: Create new file `maestro/login_flow.yaml`]**

**NARRATOR:**
"Let's write a login flow from scratch. This is the most common starting point for iOS automation."

**[VISUAL: Type out the flow with narration]**

```yaml
appId: com.example.myapp
---
# Launch and navigate to login
- launchApp:
    clearState: true

- assertVisible:
    text: "Welcome"
```

**NARRATOR:**
"We launch with `clearState: true` to ensure a fresh start every run. Then we verify the welcome screen is visible."

**[VISUAL: Continue typing]**

```yaml
# Enter credentials
- tapOn:
    id: "email_field"

- inputText:
    text: "${EMAIL}"

- tapOn:
    id: "password_field"

- inputText:
    text: "${PASSWORD}"
```

**NARRATOR:**
"Notice the `${EMAIL}` syntax? That's a variable. You can pass values at runtime or define them in your flow—keeping sensitive data out of version control."

**[VISUAL: Add final steps]**

```yaml
# Submit and verify success
- tapOn:
    id: "login_button"

- assertVisible:
    text: "Home"
    timeout: 5000

- takeScreenshot: "login_success"
```

**NARRATOR:**
"After tapping login, we wait up to 5 seconds for the Home screen to appear. The `takeScreenshot` action captures proof of success."

**[VISUAL: Run the flow with `/ios.run_flow maestro/login_flow.yaml`]**

**NARRATOR:**
"Let's run it."

**[VISUAL: Show execution output step by step]**

**NARRATOR:**
"Watch each step execute. Green checkmarks confirm success. If something fails, you'll see exactly which action and why."

---

### [02:30 - 04:00] Form Handling and Gestures

**[VISUAL: Create `maestro/form_flow.yaml`]**

**NARRATOR:**
"iOS apps are full of forms, pickers, and scrollable content. Let's tackle these common patterns."

**[VISUAL: Show form handling flow]**

```yaml
appId: com.example.myapp
---
# Handle different input types
- tapOn:
    id: "settings_tab"

# Toggle a switch
- tapOn:
    id: "dark_mode_toggle"

# Select from a picker
- tapOn:
    id: "language_picker"

- tapOn:
    text: "English"
```

**NARRATOR:**
"Toggles and pickers work with simple tap actions. Target by ID when possible—it's more reliable than text matching."

**[VISUAL: Show scrolling and visibility actions]**

```yaml
# Scroll until element is visible
- scrollUntilVisible:
    element:
      id: "save_button"
    direction: DOWN
    timeout: 10000

# Alternative: scroll by percentage
- scroll:
    direction: DOWN
    percentage: 50
```

**NARRATOR:**
"For long forms, use `scrollUntilVisible` to find elements below the fold. Maestro scrolls automatically until the element appears or the timeout expires."

**[VISUAL: Show swipe gestures]**

```yaml
# Swipe to delete
- swipe:
    start: "90%, 50%"
    end: "10%, 50%"
    duration: 500

# Pull to refresh
- swipe:
    direction: DOWN
    start: "50%, 20%"
```

**NARRATOR:**
"Swipe gestures handle deletions, carousels, and pull-to-refresh. Specify start and end coordinates as percentages for device-independent flows."

---

### [04:00 - 05:30] Conditional Logic and Variables

**[VISUAL: Show flow with conditions]**

**NARRATOR:**
"Real apps have conditional states. Maybe a tutorial appears on first launch, or an A/B test changes the UI. Flows can handle this."

**[VISUAL: Show runFlow with conditions]**

```yaml
appId: com.example.myapp
---
- launchApp

# Handle optional onboarding
- runFlow:
    when:
      visible:
        text: "Get Started"
    file: flows/skip_onboarding.yaml

# Continue with main flow
- tapOn:
    id: "login_button"
```

**NARRATOR:**
"The `runFlow` action with a `when` condition only executes if the condition is true. Here, we only run the onboarding skip if that screen appears."

**[VISUAL: Show environment variables]**

```yaml
env:
  USERNAME: "testuser"
  TIMEOUT: "5000"
---
- inputText:
    text: "${USERNAME}"

- assertVisible:
    text: "Welcome, ${USERNAME}"
    timeout: ${TIMEOUT}
```

**NARRATOR:**
"Define environment variables in the `env` block or pass them at runtime. This makes flows reusable across different test accounts and configurations."

**[VISUAL: Show command-line override]**

```
/ios.run_flow login_flow.yaml -e USERNAME=admin -e PASSWORD=secret123
```

**NARRATOR:**
"Override variables at runtime with the `-e` flag. Sensitive values never touch your YAML files."

---

### [05:30 - 07:00] Inline Commands for Quick Testing

**[VISUAL: Show /ios.run_flow --inline usage]**

**NARRATOR:**
"Sometimes you don't need a full flow file. For quick testing, use inline actions."

**[VISUAL: Type inline command]**

```
/ios.run_flow --inline "tap:Login" "type:hello@test.com" "tap:Submit"
```

**NARRATOR:**
"Chain actions using shorthand syntax. `tap:` finds elements by text, `tapid:` by accessibility ID, `type:` enters text."

**[VISUAL: Show shorthand reference]**

| Shorthand | Description |
|-----------|-------------|
| `tap:<text>` | Tap by text |
| `tapid:<id>` | Tap by ID |
| `type:<text>` | Input text |
| `scroll:<dir>` | Scroll |
| `visible:<text>` | Assert visible |
| `wait:<ms>` | Wait duration |
| `screenshot` | Take screenshot |

**NARRATOR:**
"This shorthand is perfect for exploring app behavior or running one-off tests without creating files."

---

### [07:00 - 08:30] Playbooks: Organized Test Suites

**[VISUAL: Show `/ios.playbook list`]**

**NARRATOR:**
"As your flow library grows, playbooks help organize and execute related tests together."

**[VISUAL: Create a playbook]**

```
/ios.playbook create smoke_tests
```

**NARRATOR:**
"Create a playbook with a descriptive name. Playbooks are YAML files with additional configuration options."

**[VISUAL: Show playbook structure]**

```yaml
name: Smoke Tests
description: Critical path tests for release validation

runs:
  - flow: maestro/login_flow.yaml
    name: User Login
    tags: [auth, critical]

  - flow: maestro/checkout_flow.yaml
    name: Checkout Process
    tags: [commerce, critical]
    env:
      PRODUCT_ID: "12345"

  - flow: maestro/settings_flow.yaml
    name: User Settings
    tags: [settings]
```

**NARRATOR:**
"Define multiple flows to run in sequence. Each can have its own name, tags, and environment variables."

**[VISUAL: Run the playbook]**

```
/ios.playbook run smoke_tests
```

**NARRATOR:**
"Run all flows in the playbook with a single command. Maestro executes them in order and generates a combined report."

**[VISUAL: Show playbook execution output]**

**NARRATOR:**
"The output shows each flow's status, duration, and any failures. Perfect for CI integration or pre-release validation."

---

### [08:30 - 09:30] Error Handling and Recovery

**[VISUAL: Show flow with error handling]**

**NARRATOR:**
"Not every test run will pass. Let's make flows resilient."

**[VISUAL: Show retry configuration]**

```yaml
- tapOn:
    id: "flaky_button"
    retry:
      maxRetries: 3
      delay: 1000
```

**NARRATOR:**
"The `retry` block handles transient failures. This action will attempt up to 3 times with a 1-second delay between attempts."

**[VISUAL: Show onFlowError]**

```yaml
onFlowError:
  - takeScreenshot: "error_state"
  - runFlow: flows/cleanup.yaml
---
```

**NARRATOR:**
"The `onFlowError` section runs if any action fails. Use it to capture diagnostic screenshots and clean up test state."

**[VISUAL: Show continue on error]**

```
/ios.run_flow my_flow.yaml --continue
```

**NARRATOR:**
"The `--continue` flag tells Maestro to proceed even when actions fail. Useful for smoke tests where you want to see all failures, not just the first."

---

### [09:30 - 10:00] What's Next

**[VISUAL: Show test coverage concept]**

**NARRATOR:**
"You've learned to write flows for login, forms, gestures, and complex user journeys. You've organized them into playbooks and handled errors gracefully."

**[VISUAL: Show visual regression teaser]**

**NARRATOR:**
"In the next video, we'll add visual regression testing—automatically detecting unintended UI changes by comparing screenshots against baselines."

**[VISUAL: Show command summary]**

**Key commands covered:**
- `/ios.run_flow <path>` - Execute YAML flow
- `/ios.run_flow --inline` - Quick inline actions
- `/ios.playbook list/create/run` - Manage test suites

**NARRATOR:**
"Check out the documentation at `/ios.help playbook` for the complete playbook reference."

**[VISUAL: Maestro logo outro]**

**NARRATOR:**
"Thanks for watching. Now go automate those tests!"

---

## Post-Production Notes

### Timing Breakdown
- Intro: 20 seconds
- Flow Structure: 40 seconds
- Login Flow: 90 seconds
- Form Handling: 90 seconds
- Conditional Logic: 90 seconds
- Inline Commands: 90 seconds
- Playbooks: 90 seconds
- Error Handling: 60 seconds
- Outro: 30 seconds

### Code Samples
All YAML samples should be available for download/copy from the documentation.

### Suggested Overlays
- YAML syntax highlighting
- Flow diagram animations
- Success/failure state indicators
- Variable substitution visualization
