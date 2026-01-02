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

- [x] Create `src/main/slash-commands/ios-regression.ts`
  - [x] `/ios.regression` - run full regression check
  - [x] Iterates through all baselines
  - [x] Generates comprehensive report

  **Completed**: Created full /ios.regression slash command with comprehensive regression testing. Supports three modes (full, quick, flows-only), options (--project, --simulator, --threshold, --output, --device-family, --fail-fast, --update, --verbose). Features include:
  - Screen baseline regression with per-baseline comparison
  - Flow baseline regression with step-by-step comparison
  - Summary statistics (total, passed, failed, skipped, updated, pass rate)
  - HTML report generation with styling
  - Detailed verbose output for failed baselines
  - Auto-update mode for updating failed baselines
  - Fail-fast mode for quick feedback
  - 74 passing unit tests

---

## Agent-Consumable Output

- [x] Create `src/main/ios-tools/diff-formatter.ts`
  - [x] Format comparison results for agent
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

  - [x] Implement `formatRegressionReport(results)` - full regression summary

  **Completed**: Created comprehensive diff-formatter.ts module with:
  - `formatDiffForAgent()` - formats single comparison with status, similarity, changed pixels, changed regions with severity indicators (🔴/🟡/🟢), file paths, and recommendations
  - `formatRegressionReport()` - formats full regression report with summary statistics, results table, detailed failure info, error sections, and recommendations
  - `formatChange()` - formats individual change entries
  - `formatChangeSummaryCompact()` - compact summary of changes
  - `formatDiffAsJson()` - JSON output for programmatic consumption
  - Helper functions: `formatSeverity()`, `calculateSeverityBreakdown()`
  - Constants: `DEFAULT_MAX_REGIONS` (10), `SEVERITY_THRESHOLDS` (HIGH: 0.7, MEDIUM: 0.3)
  - All types exported: `DiffFormatOptions`, `FormattedDiff`, `RegressionEntry`, `FormattedRegressionReport`
  - Added 50 passing unit tests in `__tests__/diff-formatter.test.ts`
  - Exported from `ios-tools/index.ts`

---

## Ignore Region Management

### Dynamic Content Handling

- [x] Implement ignore region types
  - [x] **Static regions**: Fixed coordinates (e.g., clock area)
  - [x] **Element-based**: Ignore by accessibility ID
  - [x] **Pattern-based**: Ignore matching patterns (timestamps, etc.)
  **Completed**: Created comprehensive `ignore-regions.ts` module with:
  - `IgnoreRegionType` enum: 'static' | 'element' | 'pattern'
  - `ExtendedIgnoreRegion` interface with type, elementId, patternType, confidence
  - `PatternType` enum for 11 pattern types (clock, date, timestamp, battery, signal, wifi, user_avatar, loading, random_id, carousel, animation)
  - `DynamicPattern` definitions with keywords, element types, and confidence thresholds

- [x] Create `src/main/ios-tools/ignore-regions.ts`
  - [x] `addIgnoreRegion(baseline, region)` - add region to baseline (via metadata.ts addIgnoreRegion)
  - [x] `detectDynamicContent(screenshot)` - auto-detect likely dynamic areas
  - [x] `suggestIgnoreRegions(baseline, current)` - suggest regions based on patterns
  **Completed**: Full module with:
  - Static region creation: `createStaticIgnoreRegion`, `createStatusBarRegion`, `createHomeIndicatorRegion`, `createSystemUIIgnoreRegions`
  - Element-based: `createElementBasedIgnoreRegion`, `resolveElementBasedRegions`
  - Pattern-based: `createPatternBasedIgnoreRegion`
  - Detection: `detectDynamicContent` with element pattern matching
  - Suggestions: `suggestIgnoreRegions` with priority-based suggestions
  - Validation: `validateIgnoreRegion`, `isPointInRegion`, `regionsOverlap`, `mergeOverlappingRegions`
  - Presets: `IGNORE_PRESETS` for iPhone/iPad variants, `getDevicePreset`
  - 73 passing unit tests

### Common Ignore Patterns

- [x] Implement common ignore patterns
  - [x] Status bar (time, battery, signal)
  - [x] Timestamps
  - [x] User avatars
  - [x] Random content placeholders
  **Completed**: Implemented via `DYNAMIC_PATTERNS` constant with 11 pattern types, each with keywords, element types, default rectangles, and confidence thresholds. Added `STATUS_BAR_HEIGHTS` for different device types (dynamicIsland: 59px, notch: 47px, homeButton: 20px, iPad: 24px).

---

## Multi-Device Support

- [x] Implement device-specific baselines
  - [x] Store baselines per device/resolution
  - [x] Auto-detect device when comparing
  - [x] Support device families (iPhone SE, iPhone, iPhone Pro Max, iPad)

  **Completed**: Created comprehensive `multi-device.ts` module in `baselines/` with:

  **Constants & Types**:
  - `DEVICE_FAMILIES` array: iPhone-SE, iPhone, iPhone-Plus, iPhone-Pro-Max, iPad, iPad-Pro
  - `DEVICE_FAMILY_RANGES` with screen size ranges for auto-detection
  - `DeviceBaselineMatch`, `DeviceMatrixEntry`, `BaselineCoverage`, `SyncOptions`, `SyncResult` types

  **Device Detection Functions**:
  - `detectDeviceFamilyFromScreen(screenSize)` - detect family from screen dimensions
  - `detectDeviceFamilyFromDevice(device)` - detect from device info (name + screen size)

  **Device-Specific Baseline Operations**:
  - `findBestBaselineForDevice(project, name, device)` - intelligent baseline lookup with fallback chain:
    1. Exact device family match
    2. Generic baseline (no device family)
    3. Closest device family baseline
    4. Any available device family baseline
  - `createBaselineWithAutoDetect(project, name, imagePath, device, bundleId, options)` - create baseline with auto-detected device family

  **Device Baseline Matrix**:
  - `getDeviceBaselineMatrix(project)` - returns matrix of baselines and their device families
  - `hasBaselineForDevice(project, name, deviceFamily)` - check if baseline exists for specific family
  - `getMissingDeviceFamilies(project, name, targetFamilies)` - list missing device families

  **Coverage Reporting**:
  - `getBaselineCoverage(project)` - comprehensive coverage statistics
  - `formatCoverageReport(coverage)` - markdown report with progress bars and recommendations

  **Sync Operations**:
  - `syncBaselinesAcrossDevices(project, options)` - copy baselines from source to target families

  All exports added to `baselines/index.ts` and `ios-tools/index.ts`. Added 28 passing unit tests.

- [x] Create device baseline matrix
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
  **Completed**: Storage structure already supports device-family directories via `getBaselinePath(project, name, deviceFamily)`. The new `getDeviceBaselineMatrix()` function provides a view of which baselines exist for which device families.

---

## IPC Handlers

- [x] Add visual regression IPC handlers
  - [x] Register `ios:baseline:save` handler
  - [x] Register `ios:baseline:update` handler
  - [x] Register `ios:baseline:list` handler
  - [x] Register `ios:baseline:delete` handler
  - [x] Register `ios:diff:compare` handler
  - [x] Register `ios:diff:flow` handler
  - [x] Register `ios:regression:run` handler

  **Completed**: Added comprehensive IPC handlers in `src/main/ipc/handlers/ios.ts` and corresponding API methods in `src/main/preload.ts`:

  **Baseline handlers** (`ios:baseline:*`):
  - `save` - Create new baseline with optional device family auto-detection
  - `update` - Update existing baseline with new screenshot
  - `list` - List baselines with device family filter
  - `delete` - Remove baseline
  - `get` - Get baseline details including metadata and paths
  - `projects` - List all projects with baselines
  - `addIgnoreRegion` - Add dynamic ignore regions
  - `coverage` - Get device baseline coverage report
  - `export` - Export baselines for sharing
  - `import` - Import baselines

  **Diff/Comparison handlers** (`ios:diff:*`):
  - `compare` - Compare screenshot against baseline with full analysis and agent-formatted output
  - `flow` - Compare multi-step flow against baseline sequence

  **Regression handlers** (`ios:regression:*`):
  - `run` - Execute full regression test suite with configurable options (threshold, failFast, updateOnFail, mode)

  All handlers use `withIpcErrorLogging` for consistent error handling and are accessible via `window.maestro.ios.baseline.*`, `window.maestro.ios.diff.*`, and `window.maestro.ios.regression.*`.

---

## Auto Run Integration

- [x] Enable visual regression in Auto Run
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
  **Completed**: Added `ios.baseline`, `ios.diff`, and `ios.regression` step types to the Auto Run step parser and executor. Step types are defined in `step-types.ts`, parsing is handled in `step-parser.ts` (with `resolveBaseline`, `resolveDiff`, `resolveRegression` functions), and execution is implemented in `step-executor.ts` (with `executeBaseline`, `executeDiff`, `executeRegression` functions). All 90 step-parser tests pass including 26 new visual regression tests.

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
