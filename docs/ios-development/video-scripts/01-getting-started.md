# Video Script: Getting Started with iOS in Maestro

**Duration**: 5 minutes
**Target Audience**: iOS developers new to Maestro
**Objective**: Guide users through initial setup and running their first iOS commands

---

## Pre-Production Notes

### Required Footage
- [ ] macOS desktop with Maestro app open
- [ ] Terminal showing `/ios.setup` wizard
- [ ] iOS Simulator with sample app running
- [ ] Screenshot capture demonstration
- [ ] UI inspection tree display

### Assets Needed
- Maestro logo animation (intro/outro)
- iOS device frame overlay
- Callout graphics for UI elements
- Lower thirds for command syntax

---

## Script

### [00:00 - 00:15] Intro

**[VISUAL: Maestro logo animation, then fade to Maestro app window]**

**NARRATOR:**
"Welcome to Maestro's iOS development tools. In the next five minutes, you'll go from zero to capturing screenshots, inspecting UI elements, and running your first automation flow. Let's get started."

---

### [00:15 - 00:45] Prerequisites Check

**[VISUAL: Show terminal with xcode-select -p command]**

**NARRATOR:**
"Before we begin, let's verify you have the essentials. You'll need macOS, Xcode, and the Xcode Command Line Tools. If you're watching this, you probably have these already—but Maestro will check for you."

**[VISUAL: Type `/ios.setup --check` in Maestro]**

**NARRATOR:**
"In Maestro, type `/ios.setup --check`. This scans your environment and reports exactly what's installed and what's missing."

**[VISUAL: Show the environment check output with checkmarks and warnings]**

**NARRATOR:**
"Green checkmarks mean you're ready. Yellow warnings indicate optional components like the Maestro CLI for flow automation. Red X marks show blockers that need attention."

---

### [00:45 - 01:30] Running the Setup Wizard

**[VISUAL: Type `/ios.setup` and show wizard starting]**

**NARRATOR:**
"Let's run the full setup wizard. Type `/ios.setup` without any flags."

**[VISUAL: Show Step 1 - Environment Check]**

**NARRATOR:**
"Step one verifies your environment. The wizard detects your Xcode version, available simulators, and offers to install optional tools like the Maestro Mobile CLI."

**[VISUAL: Show Step 2 - Project Detection]**

**NARRATOR:**
"Step two analyzes your current directory. It finds your Xcode project or workspace, detects available schemes, and identifies your app's bundle ID."

**[VISUAL: Show Step 3 - Simulator Selection]**

**NARRATOR:**
"Step three lets you choose your default simulator. Pick one that matches your target devices—iPhone 15 Pro is a great choice for modern apps."

**[VISUAL: Show remaining steps completing]**

**NARRATOR:**
"The remaining steps configure XCUITest integration, MaestroBridge for deep debugging, and generate a sample automation flow. Don't worry—we'll explore each of these in detail in later videos."

---

### [01:30 - 02:15] Your First Screenshot

**[VISUAL: Show iOS Simulator with an app running]**

**NARRATOR:**
"With setup complete, let's capture our first screenshot. Make sure you have a simulator running with your app—or any app—visible on screen."

**[VISUAL: Type `/ios.snapshot` in Maestro]**

**NARRATOR:**
"Type `/ios.snapshot` and press Enter."

**[VISUAL: Show the snapshot output with screenshot preview, logs summary, and artifact paths]**

**NARRATOR:**
"Maestro captures the current screen, grabs recent system logs, and packages everything into a timestamped artifact folder. The screenshot appears right here in your session, and you can find the files at the path shown."

**[VISUAL: Show opening the artifact folder in Finder]**

**NARRATOR:**
"Each snapshot includes the PNG image, a text summary of system logs, and any crash data if something went wrong."

---

### [02:15 - 03:00] Inspecting UI Elements

**[VISUAL: Type `/ios.inspect` in Maestro]**

**NARRATOR:**
"Capturing screenshots is great, but understanding what's on screen requires more. Type `/ios.inspect` to see the UI element tree."

**[VISUAL: Show the inspect output with element hierarchy]**

**NARRATOR:**
"This shows every element on screen—buttons, labels, text fields—organized by their hierarchy. Notice the accessibility identifiers, labels, and element types."

**[VISUAL: Highlight a specific element like #login_button]**

**NARRATOR:**
"See this `#login_button`? That's an accessibility identifier. It's the most reliable way to target elements in your automation flows. If your elements don't have identifiers, now's a great time to add them in your app."

**[VISUAL: Type `/ios.inspect --element #login_button`]**

**NARRATOR:**
"You can focus on a specific element with the `--element` flag. This shows detailed properties including frame coordinates, traits, and the element's full accessibility description."

---

### [03:00 - 03:45] Basic Interactions

**[VISUAL: Type `/ios.tap #login_button --app com.example.myapp`]**

**NARRATOR:**
"Let's interact with the app. To tap the login button, use the `/ios.tap` command followed by the target and your app's bundle ID."

**[VISUAL: Show the simulator responding to the tap]**

**NARRATOR:**
"Watch the simulator—the tap registers and the UI responds. These commands use XCUITest under the hood, so they're the same interactions your UI tests would perform."

**[VISUAL: Type `/ios.type "hello@example.com" --into #email_field --app com.example.myapp`]**

**NARRATOR:**
"To enter text, use `/ios.type`. The `--into` flag specifies which text field receives the input."

**[VISUAL: Show text appearing in the simulator]**

**NARRATOR:**
"For production testing, you'll typically use Maestro flows instead of individual commands—but these are perfect for exploration and debugging."

---

### [03:45 - 04:30] Running Your First Flow

**[VISUAL: Show the sample_flow.yaml file generated by setup]**

**NARRATOR:**
"Remember that sample flow the wizard created? Let's run it. You'll find it in the `maestro` folder of your project."

**[VISUAL: Show contents of sample_flow.yaml]**

**NARRATOR:**
"This YAML file describes a sequence of actions—launch the app, take a screenshot, maybe tap a few buttons. It's readable, version-controllable, and shareable with your team."

**[VISUAL: Type `/ios.run_flow maestro/sample_flow.yaml`]**

**NARRATOR:**
"Run it with `/ios.run_flow` and the path to your YAML file."

**[VISUAL: Show the flow executing with step-by-step output]**

**NARRATOR:**
"Maestro executes each step, reporting success or failure as it goes. Screenshots taken during the flow are saved automatically."

**[VISUAL: Show the flow completing successfully]**

**NARRATOR:**
"And just like that, you've run your first automated iOS test flow."

---

### [04:30 - 05:00] What's Next

**[VISUAL: Show documentation links and related videos]**

**NARRATOR:**
"In five minutes, you've set up your environment, captured screenshots, inspected elements, and run an automation flow. That's a solid foundation."

**[VISUAL: Show thumbnails of next videos in the series]**

**NARRATOR:**
"In the next video, we'll dive deeper into automating iOS UI tests—writing flows that cover your critical user journeys. After that, we'll explore visual regression testing and the powerful MaestroBridge debugging tools."

**[VISUAL: Show /ios.help command]**

**NARRATOR:**
"Need help anytime? Type `/ios.help` for the complete command reference, or `/ios.help --troubleshoot` when something goes wrong."

**[VISUAL: Maestro logo outro]**

**NARRATOR:**
"Thanks for watching. Happy testing!"

---

## Post-Production Notes

### Timing Breakdown
- Intro: 15 seconds
- Prerequisites: 30 seconds
- Setup Wizard: 45 seconds
- First Screenshot: 45 seconds
- UI Inspection: 45 seconds
- Basic Interactions: 45 seconds
- First Flow: 45 seconds
- Outro: 30 seconds

### Suggested B-Roll
- Keyboard typing close-ups during commands
- Simulator device animations
- Split-screen showing Maestro + Simulator

### Captions/Annotations
- Show commands in large font when typed
- Highlight important output with circles/arrows
- Add timestamps when showing file paths
