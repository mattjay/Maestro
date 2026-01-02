---
title: Visual Regression Testing
description: Baseline management, diff detection, and visual testing for iOS apps.
icon: code-compare
---

Maestro's visual regression tools detect and report visual changes between app versions. This enables automated detection of unintended UI changes and provides evidence that fixes actually resolve visual issues.

## Overview

The visual regression system provides:

| Feature | Description |
|---------|-------------|
| **Baseline Management** | Save, update, list, and delete reference screenshots |
| **Image Comparison** | Pixel-level comparison with configurable thresholds |
| **Change Detection** | Identify and categorize visual differences |
| **Ignore Regions** | Exclude dynamic content from comparison |
| **Multi-Device Support** | Device-family specific baselines |
| **CI Integration** | JUnit XML, JSON, and HTML report generation |

## Core Workflow

### 1. Capture Initial Baselines

Navigate to each screen and save baselines:

```
/ios.baseline save login_screen --app com.example.myapp
/ios.baseline save home_screen --app com.example.myapp
/ios.baseline save settings_screen --app com.example.myapp
```

Baselines are stored in `~/.maestro/ios-baselines/{project}/screens/`.

### 2. Compare Against Baselines

After making code changes, compare current screens:

```
/ios.diff login_screen
```

**Example output:**

```markdown
## Visual Comparison: login_screen

**Status**: DIFFERENCES DETECTED
**Similarity**: 94.2%
**Changed Pixels**: 1,234 (5.8%)

### Changed Regions

1. **Button Area** (100, 450) - (200, 500)
   - Color changed: #007AFF → #34C759
   - Severity: Medium

2. **Header Text** (20, 80) - (300, 120)
   - Text content likely changed
   - Severity: Low

### Recommendation
Review the changes above. If intentional:
`/ios.baseline update login_screen`
```

### 3. Update Baselines When Intended

If the visual changes are intentional (new design, bug fix, etc.):

```
/ios.baseline update login_screen
```

### 4. Run Full Regression

Before releases or after significant changes:

```
/ios.regression --project myproject
```

## The `/ios.baseline` Command

Manage visual regression baselines.

### Subcommands

| Subcommand | Description | Example |
|------------|-------------|---------|
| `save <name>` | Capture current screen as baseline | `/ios.baseline save login_screen` |
| `update <name>` | Update existing baseline | `/ios.baseline update login_screen` |
| `list` | List all baselines | `/ios.baseline list` |
| `show <name>` | Display baseline info | `/ios.baseline show login_screen` |
| `delete <name>` | Remove baseline | `/ios.baseline delete login_screen` |
| `ignore <name> <region>` | Add ignore region | `/ios.baseline ignore login_screen status_bar` |

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--project <name>` | `-p` | Project name (default: current directory name) |
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--app <bundleId>` | `-a` | App bundle ID for metadata |
| `--device-family <family>` | `-f` | Device family (iPhone-SE, iPhone, iPhone-Pro-Max, iPad) |
| `--auto-device-family` | | Auto-detect device family from screen size |
| `--description <text>` | `-d` | Description for baseline |
| `--tags <tag1,tag2>` | `-t` | Tags for organization |

### Examples

**Save baseline with metadata:**
```
/ios.baseline save checkout_flow --app com.example.store \
  --description "Checkout page with cart items" --tags "checkout,critical"
```

**Save with auto device family detection:**
```
/ios.baseline save home_screen --auto-device-family
```

**List baselines for a project:**
```
/ios.baseline list --project myproject
```

**Add ignore region:**
```
/ios.baseline ignore login_screen status_bar --reason "Dynamic time display"
```

## The `/ios.diff` Command

Compare current screen against baselines.

### Modes

| Mode | Description | Example |
|------|-------------|---------|
| Single baseline | Compare to one baseline | `/ios.diff login_screen` |
| Flow | Compare all steps in a flow | `/ios.diff --flow checkout` |
| All | Compare all baselines | `/ios.diff --all` |

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--project <name>` | `-p` | Project name |
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--threshold <0-1>` | `-t` | Pixel difference threshold (default: 0.1) |
| `--output <path>` | `-o` | Save diff image to path |
| `--update` | `-u` | Update baseline if different |
| `--device-family <family>` | `-f` | Use device-specific baseline |

### Examples

```bash
# Basic comparison
/ios.diff login_screen

# With custom threshold
/ios.diff login_screen --threshold 0.05

# Save diff image
/ios.diff login_screen --output ./diffs/login-diff.png

# Compare all baselines
/ios.diff --all --project myproject
```

## The `/ios.regression` Command

Run comprehensive visual regression tests.

```
/ios.regression [--mode <mode>] [--project <name>]
```

### Modes

| Mode | Description |
|------|-------------|
| `full` (default) | All screens and flows |
| `quick` | Screens only, higher threshold |
| `flows-only` | Only flow baselines |

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--project <name>` | `-p` | Project name |
| `--simulator <name\|udid>` | `-s` | Target simulator |
| `--threshold <0-1>` | `-t` | Pixel difference threshold |
| `--output <path>` | `-o` | Output directory for reports |
| `--device-family <family>` | `-f` | Filter to device family |
| `--fail-fast` | | Stop on first failure |
| `--update` | `-u` | Update failed baselines |
| `--verbose` | `-v` | Show detailed output |

### Example Output

```markdown
## Visual Regression Report

**Project**: myproject
**Device**: iPhone 15 Pro (iOS 17.5)
**Timestamp**: 2024-01-15T10:30:00Z

### Summary

| Metric | Value |
|--------|-------|
| Total Baselines | 15 |
| Passed | 13 |
| Failed | 2 |
| Pass Rate | 86.7% |

### Failed Baselines

#### login_screen
- **Similarity**: 94.2%
- **Changed Regions**: 2
- **Diff**: ~/.maestro/.../login_screen-diff.png

### Files
- HTML Report: ./visual-regression-report.html
- JUnit XML: ./visual-regression.xml
- JSON: ./visual-regression.json
```

## Threshold Configuration

The comparison threshold controls how strict pixel matching is. Lower values are more strict.

| Threshold | Sensitivity | Use Case |
|-----------|-------------|----------|
| `0.01` | Very strict | Pixel-perfect designs |
| `0.05` | Strict | High-fidelity UI |
| `0.1` | Default | General visual regression |
| `0.2` | Moderate | Allow minor antialiasing differences |
| `0.3` | Relaxed | Focus on major layout changes |
| `0.5` | Very relaxed | Only catch significant regressions |

### Setting Thresholds

**Per-comparison:**
```
/ios.diff login_screen --threshold 0.05
```

**Per-regression:**
```
/ios.regression --threshold 0.15
```

**In playbooks:**
```yaml
- action: ios.diff
  inputs:
    name: login_screen
    threshold: 0.05
```

## Ignore Regions

Ignore regions exclude dynamic content from comparison, reducing false positives.

### Built-in Regions

| Region | Description |
|--------|-------------|
| `status_bar` | Time, battery, signal (top 47-59px) |
| `home_indicator` | Home button area (bottom 34px) |

```
/ios.baseline ignore login_screen status_bar
```

### Custom Static Regions

Define fixed-coordinate regions:

```
/ios.baseline ignore login_screen custom --rect "100,200,80,40" --reason "Dynamic avatar"
```

The `--rect` format is `x,y,width,height`.

### Element-Based Regions

Ignore regions based on accessibility identifiers:

```
/ios.baseline ignore login_screen element --id "timestamp_label" --reason "Dynamic timestamp"
```

### Pattern-Based Regions

Auto-detect common dynamic patterns:

| Pattern | Description |
|---------|-------------|
| `clock` | System clock display |
| `date` | Date displays |
| `timestamp` | Relative timestamps ("2 hours ago") |
| `battery` | Battery indicator |
| `user_avatar` | Profile pictures |
| `loading` | Loading spinners |
| `carousel` | Image carousels |

**Suggest ignore regions:**
```
/ios.baseline suggest-ignore login_screen
```

## Device-Family Baselines

Different devices have different screen sizes and status bar heights:

| Device Type | Status Bar Height |
|-------------|-------------------|
| Dynamic Island (14 Pro+) | 59px |
| Notch (X-13) | 47px |
| Home Button (SE, 8) | 20px |
| iPad | 24px |

Save baselines per device family:

```
/ios.baseline save login --device-family iPhone-Pro-Max
/ios.baseline save login --device-family iPhone-SE
/ios.baseline save login --device-family iPad
```

Or auto-detect:

```
/ios.baseline save login --auto-device-family
```

## Playbook Integration

Use visual regression in playbooks:

```yaml
name: Visual Regression Suite
description: Compare all key screens against baselines

steps:
  # Create baselines (first run)
  - action: ios.run_flow
    inputs:
      flow: flows/navigate_to_login.yaml
      app: com.example.myapp

  - action: ios.baseline
    inputs:
      action: save
      name: login_screen
      description: "Login screen baseline"

  # Compare against baselines
  - action: ios.diff
    inputs:
      name: login_screen
      threshold: 0.05
    store_as: login_diff

  - action: assert
    inputs:
      condition: "{{ login_diff.matches }}"
      message: "Login screen should match baseline"

  # Full regression run
  - action: ios.regression
    inputs:
      project: myproject
      output: ./reports
    store_as: regression

  - action: message
    content: |
      ## Regression Results
      Pass rate: {{regression.passRate}}%
      Failed: {{regression.failedCount}}
```

## Report Formats

### HTML Report

Interactive report with:
- Side-by-side comparison
- Diff overlay toggle
- Zoom controls
- Filter by pass/fail

### JUnit XML

CI-compatible format for build systems:

```xml
<testsuite name="Visual Regression" tests="15" failures="2">
  <testcase name="login_screen" classname="myproject">
    <failure message="Similarity 94.2%, threshold 99%">
      Diff regions: Button Area, Header Text
    </failure>
  </testcase>
</testsuite>
```

### JSON

Programmatic access to results:

```json
{
  "project": "myproject",
  "timestamp": "2024-01-15T10:30:00Z",
  "summary": {
    "total": 15,
    "passed": 13,
    "failed": 2
  },
  "results": [...]
}
```

## Best Practices

1. **Stable state**: Ensure the app is in a stable state before capturing baselines
2. **Wait for animations**: Let animations complete before comparison
3. **Consistent data**: Use mock data for consistent screenshots
4. **Ignore dynamic regions**: Add ignore regions for timestamps, user data
5. **Device-specific baselines**: Use device families for responsive layouts
6. **Reasonable thresholds**: Start with 0.1, adjust based on results
7. **Regular updates**: Update baselines when intentional changes are made

## Next Steps

- [Command Reference](./commands) - Full command documentation
- [Playbook Integration](./playbooks) - Automate visual testing
- [CI Integration](./ci-integration) - Run in CI/CD pipelines
