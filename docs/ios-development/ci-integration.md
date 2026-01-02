---
title: CI/CD Integration
description: Running iOS tests in continuous integration pipelines.
icon: circle-nodes
---

Maestro's iOS tools can be integrated into CI/CD pipelines to automate testing, visual regression, and quality checks.

## Overview

Running iOS tests in CI enables:

- **Automated Testing**: Run Maestro flows on every commit
- **Visual Regression**: Detect unintended UI changes
- **Quality Gates**: Block PRs that fail tests
- **Artifact Collection**: Save screenshots and reports

## Requirements

Your CI environment needs:

| Requirement | Details |
|-------------|---------|
| **macOS Runner** | iOS Simulator only runs on macOS |
| **Xcode** | Required for `xcrun simctl` commands |
| **Maestro CLI** | For flow execution |
| **Simulators** | Pre-configured or created on-the-fly |

## GitHub Actions

### Basic Workflow

```yaml
name: iOS Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ios-tests:
    runs-on: macos-14  # or macos-13, macos-12

    steps:
      - uses: actions/checkout@v4

      - name: Select Xcode version
        run: sudo xcode-select -s /Applications/Xcode_15.2.app

      - name: Install Maestro CLI
        run: |
          brew tap mobile-dev-inc/tap
          brew install maestro

      - name: Boot Simulator
        run: |
          xcrun simctl boot "iPhone 15 Pro" || true
          xcrun simctl bootstatus "iPhone 15 Pro"

      - name: Build App
        run: |
          xcodebuild build-for-testing \
            -workspace MyApp.xcworkspace \
            -scheme MyApp \
            -destination 'platform=iOS Simulator,name=iPhone 15 Pro'

      - name: Install App
        run: |
          xcrun simctl install booted build/MyApp.app

      - name: Run Maestro Flows
        run: |
          maestro test maestro/

      - name: Upload Test Artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: |
            ~/.maestro/ios-artifacts/
            ./test-reports/
```

### With Visual Regression

```yaml
name: iOS Visual Regression

on:
  pull_request:
    branches: [main]

jobs:
  visual-regression:
    runs-on: macos-14

    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true  # For baseline images

      - name: Setup Environment
        run: |
          sudo xcode-select -s /Applications/Xcode_15.2.app
          brew tap mobile-dev-inc/tap && brew install maestro

      - name: Boot Simulator
        run: |
          xcrun simctl boot "iPhone 15 Pro" || true
          xcrun simctl bootstatus "iPhone 15 Pro"

      - name: Build and Install App
        run: |
          xcodebuild build \
            -workspace MyApp.xcworkspace \
            -scheme MyApp \
            -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
            -derivedDataPath build/
          xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/MyApp.app

      - name: Run Visual Regression
        run: |
          maestro test maestro/visual-regression/
        continue-on-error: true

      - name: Generate Report
        run: |
          # Convert results to HTML report
          node scripts/generate-visual-report.js

      - name: Upload Diff Images
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: visual-diffs
          path: |
            ios-baselines/diffs/
            visual-regression-report.html

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('visual-summary.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
```

## GitLab CI

```yaml
stages:
  - build
  - test
  - report

variables:
  SIMULATOR_NAME: "iPhone 15 Pro"

.macos_job:
  tags:
    - macos
    - xcode-15

build_app:
  extends: .macos_job
  stage: build
  script:
    - xcodebuild build-for-testing
        -workspace MyApp.xcworkspace
        -scheme MyApp
        -destination "platform=iOS Simulator,name=$SIMULATOR_NAME"
        -derivedDataPath build/
  artifacts:
    paths:
      - build/

run_tests:
  extends: .macos_job
  stage: test
  dependencies:
    - build_app
  before_script:
    - brew tap mobile-dev-inc/tap && brew install maestro
    - xcrun simctl boot "$SIMULATOR_NAME" || true
    - xcrun simctl bootstatus "$SIMULATOR_NAME"
    - xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/MyApp.app
  script:
    - maestro test maestro/ --format junit --output test-results.xml
  artifacts:
    when: always
    reports:
      junit: test-results.xml
    paths:
      - ~/.maestro/ios-artifacts/

visual_regression:
  extends: .macos_job
  stage: test
  dependencies:
    - build_app
  script:
    - maestro test maestro/visual-regression/
  artifacts:
    when: always
    paths:
      - ios-baselines/diffs/
```

## CircleCI

```yaml
version: 2.1

orbs:
  macos: circleci/macos@2

jobs:
  ios-tests:
    macos:
      xcode: "15.2.0"
    resource_class: macos.m1.large.gen1

    steps:
      - checkout

      - run:
          name: Install Maestro
          command: |
            brew tap mobile-dev-inc/tap
            brew install maestro

      - run:
          name: Boot Simulator
          command: |
            xcrun simctl boot "iPhone 15 Pro" || true
            xcrun simctl bootstatus "iPhone 15 Pro"

      - run:
          name: Build App
          command: |
            xcodebuild build \
              -workspace MyApp.xcworkspace \
              -scheme MyApp \
              -destination 'platform=iOS Simulator,name=iPhone 15 Pro'

      - run:
          name: Run Tests
          command: maestro test maestro/

      - store_artifacts:
          path: ~/.maestro/ios-artifacts
          destination: ios-artifacts

      - store_test_results:
          path: test-results

workflows:
  test:
    jobs:
      - ios-tests
```

## Bitrise

```yaml
format_version: "11"
default_step_lib_source: https://github.com/bitrise-io/bitrise-steplib.git

trigger_map:
  - push_branch: main
    workflow: ios-tests
  - pull_request_target_branch: main
    workflow: ios-tests

workflows:
  ios-tests:
    steps:
      - activate-ssh-key@4: {}
      - git-clone@8: {}

      - xcode-build-for-simulator@0:
          inputs:
            - scheme: MyApp
            - simulator_device: iPhone 15 Pro

      - script@1:
          title: Install Maestro
          inputs:
            - content: |
                brew tap mobile-dev-inc/tap
                brew install maestro

      - script@1:
          title: Boot Simulator
          inputs:
            - content: |
                xcrun simctl boot "iPhone 15 Pro" || true
                xcrun simctl bootstatus "iPhone 15 Pro"

      - script@1:
          title: Run Tests
          inputs:
            - content: maestro test maestro/

      - deploy-to-bitrise-io@2:
          inputs:
            - deploy_path: ~/.maestro/ios-artifacts
```

## Caching Strategies

### Cache Simulators

```yaml
# GitHub Actions
- name: Cache iOS Simulator
  uses: actions/cache@v4
  with:
    path: ~/Library/Developer/CoreSimulator
    key: simulator-${{ runner.os }}-${{ hashFiles('.xcode-version') }}
```

### Cache Maestro

```yaml
- name: Cache Maestro
  uses: actions/cache@v4
  with:
    path: /opt/homebrew/Cellar/maestro
    key: maestro-${{ runner.os }}-${{ hashFiles('.maestro-version') }}
```

### Cache Build Products

```yaml
- name: Cache DerivedData
  uses: actions/cache@v4
  with:
    path: ~/Library/Developer/Xcode/DerivedData
    key: deriveddata-${{ runner.os }}-${{ hashFiles('*.xcodeproj/*') }}
```

## Parallel Testing

Run tests across multiple simulators:

```yaml
jobs:
  test:
    strategy:
      matrix:
        device:
          - "iPhone 15 Pro"
          - "iPhone SE (3rd generation)"
          - "iPad Pro 12.9-inch (6th generation)"

    runs-on: macos-14

    steps:
      - uses: actions/checkout@v4

      - name: Boot Simulator
        run: |
          xcrun simctl boot "${{ matrix.device }}" || true
          xcrun simctl bootstatus "${{ matrix.device }}"

      - name: Run Tests
        run: |
          maestro test maestro/ --device "${{ matrix.device }}"
```

## Baseline Management

### Store Baselines in Git LFS

```bash
# .gitattributes
ios-baselines/**/*.png filter=lfs diff=lfs merge=lfs -text
```

### Update Baselines in CI

```yaml
- name: Update Baselines
  if: github.event_name == 'workflow_dispatch' && github.event.inputs.update_baselines == 'true'
  run: |
    maestro test maestro/visual-regression/ --update-baselines
    git add ios-baselines/
    git commit -m "Update visual regression baselines"
    git push
```

## Report Generation

### JUnit XML

```bash
maestro test maestro/ --format junit --output test-results.xml
```

### HTML Report

```yaml
- name: Generate HTML Report
  run: |
    npx junit-viewer --results test-results.xml --output report.html
```

### Slack Notification

```yaml
- name: Notify Slack
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    fields: repo,message,commit,author
    text: "iOS tests failed! See artifacts for details."
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## Troubleshooting CI

### Simulator Not Booting

```yaml
- name: Reset Simulators
  run: |
    xcrun simctl shutdown all
    xcrun simctl erase all
    xcrun simctl boot "iPhone 15 Pro"
```

### Timeout Issues

```yaml
- name: Run Tests with Extended Timeout
  run: maestro test maestro/ --timeout 600
  timeout-minutes: 15
```

### Permission Issues

```yaml
- name: Fix Permissions
  run: |
    chmod -R 755 ~/.maestro
    chmod -R 755 ~/Library/Developer/CoreSimulator
```

### Xcode License

```yaml
- name: Accept Xcode License
  run: sudo xcodebuild -license accept
```

## Best Practices

1. **Use specific Xcode version**: Pin to a specific version for reproducibility
2. **Cache aggressively**: Cache simulators, build products, and dependencies
3. **Parallelize tests**: Run on multiple simulators concurrently
4. **Clean between runs**: Reset simulator state for isolation
5. **Upload artifacts**: Always upload screenshots and logs
6. **Set timeouts**: Configure reasonable timeouts for flows
7. **Use retry logic**: Handle flaky tests with retry mechanisms
8. **Monitor performance**: Track test duration over time

## Next Steps

- [Command Reference](./commands) - Full command documentation
- [Visual Regression](./visual-regression) - Baseline testing
- [Troubleshooting](./troubleshooting) - Common issues
