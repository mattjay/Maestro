# Phase 7: Visual Regression Diffs

**Goal**: Automatically detect and report visual changes between app versions or across development iterations.

**Deliverable**: `ios.baseline` + `ios.diff` commands for baseline management and visual comparison.

**Dependency**: Phase 1 (snapshot), Phase 3 (interact for navigation)

---

## Baseline Management

### Baseline Storage

- [x] Create `src/main/ios-tools/baselines/` module
  ```
  src/main/ios-tools/baselines/
  ├── index.ts
  ├── storage.ts          # Baseline file management
  ├── metadata.ts         # Baseline metadata
  └── types.ts            # Type definitions
  ```
  **Completed**: Created full baselines module with types.ts (all baseline/comparison types), metadata.ts (CRUD + ignore regions + device family detection), storage.ts (project/baseline/flow management + export/import), index.ts (all exports), updated ios-tools/index.ts exports. Added 36 passing unit tests.

- [x] Define baseline storage structure
  ```
  ~/.maestro/ios-baselines/{project}/
  ├── metadata.json       # Project-level metadata
  ├── screens/
  │   ├── login/
  │   │   ├── baseline.png
  │   │   ├── metadata.json
  │   │   └── mask.png     # Ignore regions
  │   ├── home/
  │   │   ├── baseline.png
  │   │   ├── metadata.json
  │   │   └── mask.png
  │   └── ...
  └── flows/
      ├── checkout/
      │   ├── step_1.png
      │   ├── step_2.png
      │   └── metadata.json
      └── ...
  ```
  **Completed**: Storage structure implemented in storage.ts with all path helpers and directory creation functions.

### Baseline Types

- [x] Implement `types.ts`
  ```typescript
  interface BaselineMetadata {
    name: string;
    createdAt: Date;
    updatedAt: Date;
    device: {
      name: string;
      osVersion: string;
      screenSize: { width: number; height: number };
    };
    bundleId: string;
    appVersion?: string;
    ignoreRegions: IgnoreRegion[];
  }

  interface IgnoreRegion {
    name: string;
    rect: { x: number; y: number; width: number; height: number };
    reason: string;  // e.g., "dynamic content", "timestamp"
  }

  interface BaselineComparison {
    baseline: string;       // Path to baseline image
    current: string;        // Path to current image
    diff?: string;          // Path to diff image
    match: boolean;
    similarity: number;     // 0-1
    diffPixels: number;
    diffPercent: number;
    changedRegions: Region[];
  }
  ```
  **Completed**: All types implemented plus additional types (DeviceFamily, FlowBaseline, FlowBaselineStep, CompareOptions, CompareResult, ExportOptions/Result, ImportOptions/Result, RegressionReport, RegressionSummary).

### Baseline Storage Service

- [x] Implement `storage.ts`
  - [x] `createBaseline(name, imagePath, metadata)` - save new baseline
  - [x] `updateBaseline(name, imagePath)` - update existing baseline
  - [x] `getBaseline(name)` - retrieve baseline
  - [x] `listBaselines(project?)` - list all baselines
  - [x] `deleteBaseline(name)` - remove baseline
  - [x] `exportBaselines(outputPath)` - export for CI
  - [x] `importBaselines(inputPath)` - import baselines
  **Completed**: All storage functions implemented, plus flow baseline support (createFlowBaselineStorage, getFlowBaselineStorage, addFlowStepImage, listFlows, deleteFlow), project management (ensureProjectExists, listProjects, deleteProject), and device-family specific baselines.

---

## Image Comparison Engine

### Comparison Library

- [x] Create `src/main/ios-tools/image-diff/` module
  ```
  src/main/ios-tools/image-diff/
  ├── index.ts
  ├── comparator.ts       # Main comparison logic
  ├── differ.ts           # Diff image generation
  ├── analyzer.ts         # Change analysis
  └── types.ts
  ```
  **Completed**: Created full image-diff module with all components.

- [x] Implement `comparator.ts`
  - [x] Use `pixelmatch` or similar library
  - [x] Implement `compareImages(baseline, current, options)`
    ```typescript
    interface CompareOptions {
      threshold: number;      // Pixel difference threshold (0-1)
      antialiasing: boolean;  // Ignore antialiasing differences
      ignoreRegions?: IgnoreRegion[];
      outputDiff?: string;    // Path to save diff image
    }

    interface CompareResult {
      match: boolean;
      diffPixels: number;
      diffPercent: number;
      similarity: number;
      diffImage?: Buffer;
    }
    ```
  **Completed**: Implemented using pixelmatch library with ignore region support, dimension mismatch handling, hash-based identical image detection, and convenience functions (areImagesIdentical, getSimilarity, imagesMatch).

### Diff Image Generation

- [x] Implement `differ.ts`
  - [x] Generate visual diff overlay
  - [x] Highlight changed pixels in red
  - [x] Show unchanged pixels faded
  - [x] Draw bounding boxes around changed regions
  - [x] Generate side-by-side comparison image
  **Completed**: Implemented overlay, highlight, side-by-side (horizontal/vertical), and onion skin diff modes. Added bounding box drawing with configurable colors/thickness.

### Change Analysis

- [x] Implement `analyzer.ts`
  - [x] `findChangedRegions(baseline, current)` - identify discrete change areas
  - [x] `categorizeChanges(regions)` - classify changes (layout, color, content)
  - [x] `generateChangeSummary(comparison)` - human-readable summary
    ```
    Changes detected:
    - Text changed at (100, 200): "Login" → "Sign In"
    - Button color changed at (150, 300): blue → green
    - New element appeared at (50, 400): Badge icon
    ```
  **Completed**: Implemented flood-fill region detection (optimized for large images), change classification (color/layout/text/added/removed), severity calculation, and markdown report generation. Added 45 unit tests.

---

## Slash Commands

### /ios.baseline

- [x] Create `src/main/slash-commands/ios-baseline.ts`
  - [x] `/ios.baseline save <name>` - capture current screen as baseline
  - [x] `/ios.baseline update <name>` - update existing baseline
  - [x] `/ios.baseline list` - list all baselines
  - [x] `/ios.baseline show <name>` - display baseline info
  - [x] `/ios.baseline delete <name>` - remove baseline
  - [x] `/ios.baseline ignore <name> <region>` - add ignore region
  **Completed**: Created full /ios.baseline slash command with all 6 subcommands. Supports --project, --simulator, --app, --device-family, --auto-device-family, --description, --tags options. Added 56 passing unit tests.

  Arguments:
  - `--device <name>` - specify device for baseline
  - `--navigate <flow>` - navigate to screen before capture
  - `--app <bundleId>` - target app

### /ios.diff

- [x] Create `src/main/slash-commands/ios-diff.ts`
  - [x] `/ios.diff <baseline>` - compare current screen to baseline
  - [x] `/ios.diff --flow <flowName>` - compare all steps in flow
  - [x] `/ios.diff --all` - compare all baselines

  Arguments:
  - `--threshold <0-1>` - pixel difference threshold
  - `--output <path>` - save diff image
  - `--update` - update baseline if different

  **Completed**: Created full /ios.diff slash command with three comparison modes (single, flow, all). Supports --project, --simulator, --threshold, --output, --update, --device-family options. Integrates with image-diff module for fullComparison. Generates rich markdown output with similarity percentages, changed regions, severity indicators, file paths, and recommendations. Added 67 passing unit tests.

### /ios.regression

- [ ] Create `src/main/slash-commands/ios-regression.ts`
  - [ ] `/ios.regression` - run full regression check
  - [ ] Iterates through all baselines
  - [ ] Generates comprehensive report

---

## Agent-Consumable Output

- [ ] Create `src/main/ios-tools/diff-formatter.ts`
  - [ ] Format comparison results for agent
    ```
    ## Visual Comparison: login_screen

    **Status**: ❌ DIFFERENCES DETECTED
    **Similarity**: 94.2%
    **Changed Pixels**: 1,234 (5.8%)

    ### Changed Regions

    1. **Button Area** (100, 450) - (200, 500)
       - Size changed: 100x50 → 120x50
       - Color changed: #007AFF → #34C759

    2. **Header Text** (20, 80) - (300, 120)
       - Text content likely changed
       - Font size appears larger

    3. **New Element** (250, 300) - (300, 350)
       - Badge icon added

    ### Files
    - Baseline: /path/to/baseline.png
    - Current: /path/to/current.png
    - Diff: /path/to/diff.png

    ### Recommendation
    Review the changes above. If intentional:
    `/ios.baseline update login_screen`
    ```

  - [ ] Implement `formatRegressionReport(results)` - full regression summary

---

## Ignore Region Management

### Dynamic Content Handling

- [ ] Implement ignore region types
  - [ ] **Static regions**: Fixed coordinates (e.g., clock area)
  - [ ] **Element-based**: Ignore by accessibility ID
  - [ ] **Pattern-based**: Ignore matching patterns (timestamps, etc.)

- [ ] Create `src/main/ios-tools/ignore-regions.ts`
  - [ ] `addIgnoreRegion(baseline, region)` - add region to baseline
  - [ ] `detectDynamicContent(screenshot)` - auto-detect likely dynamic areas
  - [ ] `suggestIgnoreRegions(baseline, current)` - suggest regions based on patterns

### Common Ignore Patterns

- [ ] Implement common ignore patterns
  - [ ] Status bar (time, battery, signal)
  - [ ] Timestamps
  - [ ] User avatars
  - [ ] Random content placeholders

---

## Multi-Device Support

- [ ] Implement device-specific baselines
  - [ ] Store baselines per device/resolution
  - [ ] Auto-detect device when comparing
  - [ ] Support device families (iPhone SE, iPhone, iPhone Pro Max, iPad)

- [ ] Create device baseline matrix
  ```
  baselines/
  ├── iPhone-SE/
  │   ├── login.png
  │   └── home.png
  ├── iPhone-15/
  │   ├── login.png
  │   └── home.png
  └── iPad-Pro/
      ├── login.png
      └── home.png
  ```

---

## IPC Handlers

- [ ] Add visual regression IPC handlers
  - [ ] Register `ios:baseline:save` handler
  - [ ] Register `ios:baseline:update` handler
  - [ ] Register `ios:baseline:list` handler
  - [ ] Register `ios:baseline:delete` handler
  - [ ] Register `ios:diff:compare` handler
  - [ ] Register `ios:diff:flow` handler
  - [ ] Register `ios:regression:run` handler

---

## Auto Run Integration

- [ ] Enable visual regression in Auto Run
  ```markdown
  ## Visual Regression Check

  - [ ] Capture new baselines for login flow
    - ios.run_flow: login_flow.yaml
    - ios.baseline: { save: "login_step_1", after_step: 1 }
    - ios.baseline: { save: "login_step_2", after_step: 2 }
    - ios.baseline: { save: "login_complete", after_step: 3 }

  - [ ] Verify no visual regressions
    - ios.diff: { baseline: "login_step_1", threshold: 0.01 }
    - ios.assert: { condition: "diff.match", message: "Login step 1 matches baseline" }
  ```

---

## Reporting

### HTML Report Generation

- [ ] Create `src/main/ios-tools/regression-report.ts`
  - [ ] Generate HTML report with:
    - [ ] Summary statistics
    - [ ] Thumbnail grid of all comparisons
    - [ ] Side-by-side comparison viewer
    - [ ] Diff overlay toggle
    - [ ] Filter by status (passed/failed)
    - [ ] Zoom and pan controls

### CI Integration

- [ ] Create `src/main/ios-tools/ci-export.ts`
  - [ ] Export results in JUnit XML format
  - [ ] Export results in JSON format
  - [ ] Generate artifact bundle for CI systems
  - [ ] Support GitHub Actions, CircleCI, etc.

---

## Performance Optimization

- [ ] Implement comparison caching
  - [ ] Hash-based quick rejection (identical images)
  - [ ] Progressive comparison (coarse first, then detailed)
  - [ ] Parallel comparison for multiple baselines

---

## Testing

- [ ] Write unit tests for image comparator
- [ ] Write unit tests for baseline storage
- [ ] Write unit tests for ignore regions
- [ ] Test with various image sizes
- [ ] Test with edge cases (empty images, corrupt files)
- [ ] Test performance with large baseline sets

## Documentation

- [ ] Document baseline workflow
- [ ] Document threshold configuration
- [ ] Document ignore region setup
- [ ] Document CI integration
- [ ] Provide example visual regression flow

## Acceptance Criteria

- [ ] `/ios.baseline save` captures and stores baselines
- [ ] `/ios.baseline update` updates existing baselines
- [ ] `/ios.diff` compares current screen to baseline
- [ ] Diff image clearly shows changes
- [ ] Similarity percentage is accurate
- [ ] Changed regions are identified and described
- [ ] Ignore regions prevent false positives
- [ ] Multi-device baselines work correctly
- [ ] Agent can iterate until diff disappears
- [ ] HTML report generated for full regression
- [ ] Works in Auto Run documents
