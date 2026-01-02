# Video Script: Visual Regression Testing

**Duration**: 8 minutes
**Target Audience**: iOS developers who have completed flow automation
**Objective**: Master baseline management, diff detection, and visual testing workflows

---

## Pre-Production Notes

### Required Footage
- [ ] Baseline capture and storage
- [ ] Side-by-side comparison (baseline vs current)
- [ ] Diff visualization with highlighted changes
- [ ] Ignore region configuration
- [ ] Full regression report generation

### Assets Needed
- Split-screen comparison animation
- Diff overlay (red highlighting for changes)
- Threshold visualization diagram
- Device family comparison grid

---

## Script

### [00:00 - 00:20] Intro

**[VISUAL: Maestro logo animation, then split screen showing two similar-but-different screenshots]**

**NARRATOR:**
"Every release should look right. Visual regression testing catches unintended UI changes before your users do. In this video, you'll learn to capture baselines, detect differences, and integrate visual testing into your workflow."

---

### [00:20 - 01:30] Why Visual Regression?

**[VISUAL: Animation showing code change causing subtle UI shift]**

**NARRATOR:**
"Imagine updating a font library or tweaking a constraint. Your unit tests pass. Your UI tests verify the button exists. But did the layout actually stay correct?"

**[VISUAL: Show subtle misalignment in two screenshots]**

**NARRATOR:**
"Visual regression testing captures reference screenshots—baselines—and compares them pixel by pixel. Changes that slip past functional tests get caught immediately."

**[VISUAL: Show common issues caught]**

| Issue | Caught By |
|-------|-----------|
| Font weight changes | Visual regression |
| Spacing inconsistencies | Visual regression |
| Color drift | Visual regression |
| Truncated text | Visual regression |
| Misaligned elements | Visual regression |

**NARRATOR:**
"Layout issues, color changes, font rendering differences—visual regression catches them all."

---

### [01:30 - 03:00] Capturing Your First Baseline

**[VISUAL: Show iOS Simulator on login screen]**

**NARRATOR:**
"Let's capture a baseline. Navigate to the screen you want to test—we'll start with the login screen."

**[VISUAL: Type `/ios.baseline save login_screen --app com.example.myapp`]**

**NARRATOR:**
"Use `/ios.baseline save` with a descriptive name. The name becomes the identifier for this baseline."

**[VISUAL: Show baseline confirmation output]**

```
Baseline saved: login_screen
Location: ~/.maestro/ios-baselines/myproject/screens/login_screen.png
Metadata: login_screen.json
```

**NARRATOR:**
"Maestro captures the screenshot and stores it with metadata—timestamp, simulator device, app version. This becomes your reference point."

**[VISUAL: Show multiple baseline captures]**

```
/ios.baseline save home_screen
/ios.baseline save settings_screen
/ios.baseline save checkout_screen
```

**NARRATOR:**
"Capture baselines for all your critical screens. A typical app might have 10-30 baselines covering key user journeys."

**[VISUAL: List baselines with `/ios.baseline list`]**

**NARRATOR:**
"View all saved baselines with the `list` subcommand. You'll see names, capture dates, and device information."

---

### [03:00 - 04:30] Comparing Against Baselines

**[VISUAL: Make a visual change to the app (change button color)]**

**NARRATOR:**
"Now let's simulate a regression. I've changed the login button color from blue to green—a deliberate change, but maybe not what we intended."

**[VISUAL: Type `/ios.diff login_screen`]**

**NARRATOR:**
"Run `/ios.diff` with the baseline name to compare the current screen against the reference."

**[VISUAL: Show diff output with changes highlighted]**

```
## Visual Comparison: login_screen

**Status**: DIFFERENCES DETECTED
**Similarity**: 97.2%
**Changed Pixels**: 1,234 (2.8%)

### Changed Regions
1. **Button Area** (100, 450) - (200, 500)
   - Color changed: #007AFF → #34C759
   - Severity: Medium
```

**NARRATOR:**
"The diff report shows exactly what changed and where. 97.2% similarity means 2.8% of pixels are different—mostly in the button area."

**[VISUAL: Show the diff image with highlighted region]**

**NARRATOR:**
"The diff image visualizes changes. Red highlighting shows pixels that don't match. This makes it easy to spot intentional changes versus regressions."

**[VISUAL: Show update command]**

```
/ios.baseline update login_screen
```

**NARRATOR:**
"If the change is intentional—like our new button color—update the baseline. The current screenshot becomes the new reference."

---

### [04:30 - 05:30] Configuring Thresholds

**[VISUAL: Show threshold diagram]**

**NARRATOR:**
"Not all differences are regressions. Anti-aliasing, subpixel rendering, and compression can cause minor pixel variations. Thresholds let you control sensitivity."

**[VISUAL: Show threshold values]**

| Threshold | Use Case |
|-----------|----------|
| `0.01` | Pixel-perfect designs |
| `0.05` | High-fidelity UI |
| `0.10` | General visual regression |
| `0.20` | Allow minor variations |

**NARRATOR:**
"A threshold of 0.1 means up to 10% pixel difference is acceptable. Start here and adjust based on your app's needs."

**[VISUAL: Compare with different thresholds]**

```
/ios.diff login_screen --threshold 0.05
# Result: FAIL (2.8% difference)

/ios.diff login_screen --threshold 0.10
# Result: PASS (2.8% within tolerance)
```

**NARRATOR:**
"The same change can pass or fail depending on your threshold. Choose based on how strict you need to be."

---

### [05:30 - 06:30] Ignore Regions

**[VISUAL: Show dynamic content example—time in status bar]**

**NARRATOR:**
"Some screen areas always change—the system clock, live timestamps, user avatars. These cause false positives. Ignore regions exclude them from comparison."

**[VISUAL: Add built-in ignore region]**

```
/ios.baseline ignore login_screen status_bar
```

**NARRATOR:**
"Built-in regions handle common cases. `status_bar` excludes the time, battery, and signal indicators."

**[VISUAL: Add custom ignore region]**

```
/ios.baseline ignore login_screen custom \
  --rect "100,200,80,40" \
  --reason "User avatar"
```

**NARRATOR:**
"For app-specific dynamic content, define custom regions with coordinates. Add a reason so future you remembers why."

**[VISUAL: Show auto-suggestion]**

```
/ios.baseline suggest-ignore login_screen
```

**NARRATOR:**
"Maestro can suggest ignore regions by detecting patterns like clocks, dates, and loading indicators."

---

### [06:30 - 07:30] Full Regression Runs

**[VISUAL: Type `/ios.regression --project myproject`]**

**NARRATOR:**
"Before releases, run a full regression across all baselines."

**[VISUAL: Show regression execution]**

**NARRATOR:**
"Maestro captures each screen and compares against its baseline. This might take a few minutes for comprehensive suites."

**[VISUAL: Show regression report]**

```
## Visual Regression Report

**Project**: myproject
**Device**: iPhone 15 Pro (iOS 17.5)

### Summary
| Metric | Value |
|--------|-------|
| Total | 15 |
| Passed | 13 |
| Failed | 2 |
| Pass Rate | 86.7% |

### Failed Baselines
- login_screen: 97.2% (threshold: 99%)
- checkout_screen: 95.1% (threshold: 99%)
```

**NARRATOR:**
"The summary shows pass/fail counts. Failed baselines include similarity scores and diff images for investigation."

**[VISUAL: Show HTML report]**

**NARRATOR:**
"For detailed review, generate an HTML report. It includes side-by-side comparisons, diff overlays, and filters for pass/fail states."

---

### [07:30 - 08:00] What's Next

**[VISUAL: Show integration summary]**

**NARRATOR:**
"Visual regression testing completes your test coverage. Functional tests verify behavior. Visual tests verify appearance. Together, they catch what either would miss alone."

**[VISUAL: Show workflow diagram]**

1. Write flows that navigate to key screens
2. Capture baselines for each screen
3. Run regressions before releases
4. Update baselines for intentional changes

**NARRATOR:**
"Integrate visual regression into your release process. Run it in CI, review failures, and update baselines when designs intentionally change."

**[VISUAL: Show MaestroBridge teaser]**

**NARRATOR:**
"In the next video, we'll explore MaestroBridge—deep debugging that lets you inspect app internals, feature flags, network requests, and analytics events in real time."

**[VISUAL: Key commands summary]**

- `/ios.baseline save <name>` - Capture reference
- `/ios.baseline update <name>` - Update after changes
- `/ios.diff <name>` - Compare current vs baseline
- `/ios.regression` - Full test suite

**[VISUAL: Maestro logo outro]**

**NARRATOR:**
"Thanks for watching. Now go catch those visual regressions!"

---

## Post-Production Notes

### Timing Breakdown
- Intro: 20 seconds
- Why Visual Regression: 70 seconds
- Capturing Baselines: 90 seconds
- Comparing: 90 seconds
- Thresholds: 60 seconds
- Ignore Regions: 60 seconds
- Full Regression: 60 seconds
- Outro: 30 seconds

### Visual Effects
- Split-screen before/after comparisons
- Diff overlay animation (fade between images)
- Pixel zoom showing color values
- Threshold slider visualization

### Supplementary Materials
- Sample baseline images for download
- Threshold comparison chart
- Ignore region templates
