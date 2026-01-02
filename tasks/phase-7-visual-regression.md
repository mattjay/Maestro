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

- [x] Create `src/main/ios-tools/regression-report.ts`
  - [x] Generate HTML report with:
    - [x] Summary statistics
    - [x] Thumbnail grid of all comparisons
    - [x] Side-by-side comparison viewer
    - [x] Diff overlay toggle
    - [x] Filter by status (passed/failed)
    - [x] Zoom and pan controls
  **Completed**: Created comprehensive `regression-report.ts` module with:
  - `generateHTMLReport(entries, options)` - Generate HTML from RegressionEntry array
  - `generateHTMLFromReport(report, options)` - Generate HTML from RegressionReport object
  - Interactive features: thumbnail grid with click-to-expand, side-by-side/overlay/diff/swipe view modes
  - Filter controls: All/Passed/Failed/Errors/Updated filter buttons + search input
  - Zoom controls: +/- buttons and fit-to-screen option
  - Keyboard navigation: Escape to close, Arrow keys to navigate between comparisons
  - Dark mode support with CSS custom properties
  - HTML escaping for security (XSS prevention)
  - Embedded images option (base64) for self-contained reports
  - Custom CSS injection support
  - Exports: `HTMLReportOptions`, `HTMLReportEntry`, `HTMLReportResult`, `ReportSummary` types
  - Added 48 passing unit tests in `__tests__/regression-report.test.ts`
  - Exported from `ios-tools/index.ts`

### CI Integration

- [x] Create `src/main/ios-tools/ci-export.ts`
  - [x] Export results in JUnit XML format
  - [x] Export results in JSON format
  - [x] Generate artifact bundle for CI systems
  - [x] Support GitHub Actions, CircleCI, etc.
  **Completed**: Created comprehensive `ci-export.ts` module with:
  - `exportToJUnitXML(entries, options)` - Export to JUnit XML format compatible with Jenkins, CircleCI, GitHub Actions, GitLab CI, Azure Pipelines, etc.
    - Includes test counts (total, passed, failed, errors)
    - Properties section with project metadata
    - Failure/error elements with detailed messages
    - System output with similarity percentages and changed regions
    - XML character escaping for security
  - `exportToJSON(entries, options)` - Export to structured JSON format
    - Meta section with version, generator, timestamp, CI environment
    - Summary statistics (total, passed, failed, errors, updated, pass rate)
    - Per-test results with status, similarity, diff percent, changed regions
    - Optional analysis details and metadata
    - Pretty or compact output modes
  - `generateArtifactBundle(entries, options)` - Generate complete artifact package
    - Directory or zip format output
    - Includes baseline, current, and diff images
    - HTML report, JUnit XML, and JSON results
    - SUMMARY.md with statistics and file listing
  - `detectCIEnvironment()` - Auto-detect CI system from environment variables
    - Supports 8+ CI systems: GitHub Actions, CircleCI, Jenkins, GitLab CI, Travis CI, Azure Pipelines, Bitbucket Pipelines, Buildkite
    - Extracts build number, URL, branch, commit SHA, PR number, job name
  - `getCIConfigSnippet(ciSystem)` - Generate CI-specific configuration snippets
  - `exportAll(entries, outputDir)` - Convenience function to export all formats
  - Constants: `EXPORT_FORMAT_VERSION`, `GENERATOR_NAME`, `DEFAULT_SUITE_NAME`, `DEFAULT_PACKAGE_NAME`
  - Types exported: `CIExportOptions`, `JUnitExportOptions`, `JSONExportOptions`, `ArtifactBundleOptions`, `ExportResult`, `ExportSummary`, `CIEnvironment`, `JSONExportData`, `JSONTestResult`
  - Added 57 passing unit tests in `__tests__/ci-export.test.ts`
  - Exported from `ios-tools/index.ts`

---

## Performance Optimization

- [x] Implement comparison caching
  - [x] Hash-based quick rejection (identical images)
  - [x] Progressive comparison (coarse first, then detailed)
  - [x] Parallel comparison for multiple baselines
  **Completed**: Created comprehensive `cache.ts` module in `src/main/ios-tools/image-diff/` with:

  **Hash-Based Quick Rejection**:
  - `calculateFileHash(imagePath)` - MD5 hash of file contents
  - `calculateContentHash(imagePath)` - MD5 hash of pixel data (ignores metadata)
  - `areImagesIdenticalCached(path1, path2)` - Fast cache-based identity check
  - `ImageHashCache` class with TTL expiration and LRU eviction

  **Progressive Comparison**:
  - `downsampleImage(image, factor)` - Point-sample downsample for speed
  - `progressiveCompare(baseline, current, options)` - Two-phase comparison:
    1. Coarse comparison on downsampled images (1/4 resolution)
    2. Skip detailed if coarse >= 99% similar (configurable)
    3. Fail fast if coarse < 50% similar (configurable)
    4. Full detailed comparison for intermediate cases
  - Returns `ProgressiveCompareResult` with timing breakdown

  **Parallel Batch Comparison**:
  - `compareInParallel(items, options)` - Concurrent comparison of multiple baselines
  - Configurable concurrency (default: 4)
  - Fail-fast option for early termination on failure
  - Combines hash rejection + progressive comparison for max speed
  - Returns `BatchCompareResult` with pass/fail/error counts

  **Cache Management**:
  - `clearCaches()`, `clearHashCache()`, `clearComparisonCache()`
  - `getCacheStats()` - Get current cache sizes
  - `compareImagesCached()` - Comparison with result caching

  All exports added to `image-diff/index.ts`. Added 45 passing unit tests in `__tests__/cache.test.ts`.

---

## Testing

- [x] Write unit tests for image comparator
  **Completed**: 45 tests in `image-diff/__tests__/image-diff.test.ts` covering loadImage, saveImage, compareImages, compareAndSave, areImagesIdentical, getSimilarity, imagesMatch, createIgnoreMask, generateOverlayDiff, generateHighlightDiff, generateSideBySide, generateOnionSkin, drawBoundingBoxes, generateDiff, findChangedRegions, classifyChange, calculateSeverity, analyzeChanges, generateChangeSummary, formatAnalysisReport.

- [x] Write unit tests for baseline storage
  **Completed**: 36 tests in `baselines/__tests__/baselines.test.ts` covering createBaselineMetadata, createProjectMetadata, createFlowBaseline, serializeMetadata, parseMetadata, readBaselineMetadata, writeBaselineMetadata, addIgnoreRegion, removeIgnoreRegion, createStatusBarIgnoreRegion, createHomeIndicatorIgnoreRegion, detectDeviceFamily, ensureProjectExists, createBaseline, updateBaseline, getBaseline, listBaselines, deleteBaseline, exportBaselines, importBaselines, listProjects, deleteProject.

- [x] Write unit tests for ignore regions
  **Completed**: 73 tests in `__tests__/ignore-regions.test.ts` covering createStaticIgnoreRegion, createStatusBarRegion, createHomeIndicatorRegion, createSystemUIIgnoreRegions, createElementBasedIgnoreRegion, resolveElementBasedRegions, createPatternBasedIgnoreRegion, detectDynamicContent, suggestIgnoreRegions, validateIgnoreRegion, isPointInRegion, regionsOverlap, mergeOverlappingRegions, getDevicePreset, toBasicIgnoreRegion, toBasicIgnoreRegions.

- [x] Test with various image sizes
  **Completed**: Tests cover multiple image sizes including tiny (4x4 pixels), small (50x50), standard (100x100), and large (400x400) images. Tests include dimension mismatch handling and non-divisible dimensions (97x103).

- [x] Test with edge cases (empty images, corrupt files)
  **Completed**: Edge cases tested in `cache.test.ts` include: very small images, empty batch comparisons, single item batches, non-existent file paths, downsample factor of 1, and dimension mismatches. File loading errors return proper error codes (FILE_NOT_FOUND).

- [x] Test performance with large baseline sets
  **Completed**: Performance tests in `cache.test.ts` verify: progressive comparison vs detailed timing, hash rejection speed for cached lookups (<100ms), parallel comparison with 4 items and concurrency=4 (<5000ms). Multi-device tests cover device baseline matrix operations at scale.

## Documentation

- [x] Document baseline workflow
  **Completed**: Added comprehensive "Visual Regression Testing" section to `docs/ios-development.md` covering the full baseline workflow with 4 main steps: capture initial baselines, compare against baselines, update when intended, and run full regression. Includes detailed `/ios.baseline` command reference with subcommands (save, update, list, show, delete, ignore) and options (--project, --simulator, --app, --device-family, --auto-device-family, --description, --tags).
- [x] Document threshold configuration
  **Completed**: Added "Threshold Configuration" section with threshold values table (0.01 very strict to 0.5 very relaxed), per-comparison and per-regression threshold examples, Auto Run threshold syntax, and antialiasing handling documentation.
- [x] Document ignore region setup
  **Completed**: Added "Ignore Region Setup" section covering built-in regions (status_bar, home_indicator), custom static regions with --rect format, element-based regions by accessibility ID, pattern-based regions (clock, date, timestamp, battery, signal, user_avatar, loading, carousel), suggest-ignore command, and device-specific status bar heights.
- [x] Document CI integration
  **Completed**: Added "CI Integration" section documenting JUnit XML format, JSON format, HTML report features, artifact bundle contents, and CI configuration examples for GitHub Actions, CircleCI, and GitLab CI.
- [x] Provide example visual regression flow
  **Completed**: Added "Example Visual Regression Flow" section with three complete Auto Run document examples: Initial Setup (baseline capture), Regular Regression Check (pre-release workflow), and CI Integration Example (full pipeline).

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
