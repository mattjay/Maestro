/**
 * iOS Tools - Visual Regression Baseline Types
 *
 * Type definitions for baseline management and visual comparison.
 */

// =============================================================================
// Baseline Metadata Types
// =============================================================================

/**
 * Metadata about a baseline image.
 */
export interface BaselineMetadata {
  /** Name/identifier for this baseline */
  name: string;
  /** When the baseline was first created */
  createdAt: Date;
  /** When the baseline was last updated */
  updatedAt: Date;
  /** Device information when baseline was captured */
  device: BaselineDeviceInfo;
  /** Bundle ID of the app being tested */
  bundleId: string;
  /** App version if available */
  appVersion?: string;
  /** Regions to ignore during comparison */
  ignoreRegions: IgnoreRegion[];
  /** Optional description of this baseline */
  description?: string;
  /** Tags for organization/filtering */
  tags?: string[];
}

/**
 * Device information captured with baseline.
 */
export interface BaselineDeviceInfo {
  /** Device name (e.g., "iPhone 15 Pro") */
  name: string;
  /** iOS version (e.g., "17.5") */
  osVersion: string;
  /** Screen dimensions */
  screenSize: ScreenSize;
  /** Device type identifier */
  deviceType?: string;
  /** Simulator UDID */
  udid?: string;
}

/**
 * Screen size dimensions.
 */
export interface ScreenSize {
  width: number;
  height: number;
}

// =============================================================================
// Ignore Region Types
// =============================================================================

/**
 * Region to ignore during visual comparison.
 */
export interface IgnoreRegion {
  /** Name/identifier for this region */
  name: string;
  /** Rectangle bounds of the region */
  rect: Rectangle;
  /** Reason for ignoring this region */
  reason: IgnoreReason;
  /** Custom description */
  description?: string;
}

/**
 * Rectangle coordinates.
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Standard reasons for ignoring regions.
 */
export type IgnoreReason =
  | 'status_bar'        // iOS status bar (time, battery, signal)
  | 'dynamic_content'   // Content that changes between runs
  | 'timestamp'         // Time/date displays
  | 'user_avatar'       // User profile images
  | 'random_content'    // Randomly generated content
  | 'animation'         // Animated areas
  | 'external_data'     // Data from external sources
  | 'custom';           // User-defined reason

// =============================================================================
// Comparison Types
// =============================================================================

/**
 * Result of comparing current screenshot to baseline.
 */
export interface BaselineComparison {
  /** Path to baseline image */
  baseline: string;
  /** Path to current screenshot */
  current: string;
  /** Path to diff image (if generated) */
  diff?: string;
  /** Whether images match within threshold */
  match: boolean;
  /** Similarity score (0-1, where 1 is identical) */
  similarity: number;
  /** Number of pixels that differ */
  diffPixels: number;
  /** Percentage of pixels that differ */
  diffPercent: number;
  /** Regions where changes were detected */
  changedRegions: ChangedRegion[];
  /** Time taken for comparison in milliseconds */
  comparisonTime?: number;
  /** Baseline metadata */
  baselineMetadata?: BaselineMetadata;
}

/**
 * A region where visual changes were detected.
 */
export interface ChangedRegion {
  /** Bounding rectangle of the changed area */
  bounds: Rectangle;
  /** Estimated type of change */
  changeType: ChangeType;
  /** Number of changed pixels in this region */
  pixelCount: number;
  /** Human-readable description of the change */
  description?: string;
  /** Severity of the change (0-1) */
  severity?: number;
}

/**
 * Types of visual changes that can be detected.
 */
export type ChangeType =
  | 'layout'        // Position/size changes
  | 'color'         // Color changes
  | 'text'          // Text content changes
  | 'added'         // New element appeared
  | 'removed'       // Element was removed
  | 'unknown';      // Unable to categorize

// =============================================================================
// Baseline Storage Types
// =============================================================================

/**
 * Project-level metadata for baseline storage.
 */
export interface ProjectMetadata {
  /** Project name/identifier */
  name: string;
  /** When the project baselines were created */
  createdAt: Date;
  /** When any baseline was last updated */
  updatedAt: Date;
  /** Default bundle ID for this project */
  bundleId?: string;
  /** Number of screen baselines */
  screenCount: number;
  /** Number of flow baselines */
  flowCount: number;
  /** Project description */
  description?: string;
}

/**
 * Entry in the baseline index.
 */
export interface BaselineEntry {
  /** Baseline name/identifier */
  name: string;
  /** Type of baseline */
  type: 'screen' | 'flow';
  /** Relative path to baseline directory */
  path: string;
  /** When created */
  createdAt: Date;
  /** When last updated */
  updatedAt: Date;
  /** Device family this baseline is for */
  deviceFamily?: DeviceFamily;
  /** Tags for organization */
  tags?: string[];
}

/**
 * Device families for organizing baselines.
 */
export type DeviceFamily =
  | 'iPhone-SE'       // Small iPhone screens
  | 'iPhone'          // Standard iPhone
  | 'iPhone-Plus'     // iPhone Plus/Max
  | 'iPhone-Pro-Max'  // iPhone Pro Max
  | 'iPad'            // Standard iPad
  | 'iPad-Pro';       // iPad Pro

// =============================================================================
// Flow Baseline Types
// =============================================================================

/**
 * Baseline for a multi-step flow.
 */
export interface FlowBaseline {
  /** Flow name/identifier */
  name: string;
  /** Flow description */
  description?: string;
  /** When created */
  createdAt: Date;
  /** When last updated */
  updatedAt: Date;
  /** Steps in the flow */
  steps: FlowBaselineStep[];
  /** Bundle ID being tested */
  bundleId: string;
  /** Device info */
  device: BaselineDeviceInfo;
}

/**
 * Single step in a flow baseline.
 */
export interface FlowBaselineStep {
  /** Step number (1-indexed) */
  stepNumber: number;
  /** Step name/description */
  name: string;
  /** Path to screenshot for this step */
  screenshotPath: string;
  /** Step-specific ignore regions */
  ignoreRegions?: IgnoreRegion[];
  /** Timestamp when step was captured */
  capturedAt: Date;
}

// =============================================================================
// Comparison Options
// =============================================================================

/**
 * Options for comparing images.
 */
export interface CompareOptions {
  /** Pixel difference threshold (0-1, default: 0.1) */
  threshold?: number;
  /** Whether to ignore antialiasing differences */
  antialiasing?: boolean;
  /** Regions to ignore during comparison */
  ignoreRegions?: IgnoreRegion[];
  /** Path to save diff image */
  outputDiff?: string;
  /** Whether to generate a side-by-side comparison */
  generateSideBySide?: boolean;
  /** Alpha value for unchanged pixels in diff (0-1, default: 0.1) */
  diffAlpha?: number;
  /** Color for highlighting differences (hex) */
  diffColor?: string;
}

/**
 * Result of a pixel-level comparison.
 */
export interface CompareResult {
  /** Whether images match within threshold */
  match: boolean;
  /** Number of different pixels */
  diffPixels: number;
  /** Percentage of different pixels */
  diffPercent: number;
  /** Similarity score (0-1) */
  similarity: number;
  /** Diff image buffer (if generated) */
  diffImage?: Buffer;
  /** Side-by-side image buffer (if generated) */
  sideBySideImage?: Buffer;
}

// =============================================================================
// Export/Import Types
// =============================================================================

/**
 * Options for exporting baselines.
 */
export interface ExportOptions {
  /** Output directory or file path */
  outputPath: string;
  /** Format for export */
  format?: 'zip' | 'directory';
  /** Filter by baseline names */
  names?: string[];
  /** Filter by tags */
  tags?: string[];
  /** Include metadata files */
  includeMetadata?: boolean;
}

/**
 * Result of baseline export.
 */
export interface ExportResult {
  /** Path to exported baselines */
  path: string;
  /** Number of baselines exported */
  baselineCount: number;
  /** Total size in bytes */
  totalSize: number;
  /** List of exported baseline names */
  exportedNames: string[];
}

/**
 * Options for importing baselines.
 */
export interface ImportOptions {
  /** Input path (zip file or directory) */
  inputPath: string;
  /** Whether to overwrite existing baselines */
  overwrite?: boolean;
  /** Filter by baseline names */
  names?: string[];
  /** Prefix to add to imported baseline names */
  prefix?: string;
}

/**
 * Result of baseline import.
 */
export interface ImportResult {
  /** Number of baselines imported */
  imported: number;
  /** Number of baselines skipped (already exist) */
  skipped: number;
  /** Number of baselines that failed to import */
  failed: number;
  /** List of imported baseline names */
  importedNames: string[];
  /** Errors encountered during import */
  errors?: string[];
}

// =============================================================================
// Regression Report Types
// =============================================================================

/**
 * Full regression test report.
 */
export interface RegressionReport {
  /** Report generation timestamp */
  timestamp: Date;
  /** Project name */
  project: string;
  /** Total baselines checked */
  totalBaselines: number;
  /** Number of passed comparisons */
  passed: number;
  /** Number of failed comparisons */
  failed: number;
  /** Number of skipped comparisons */
  skipped: number;
  /** Individual comparison results */
  results: BaselineComparison[];
  /** Overall pass rate (0-1) */
  passRate: number;
  /** Total time taken in milliseconds */
  duration: number;
  /** Device info used for testing */
  device?: BaselineDeviceInfo;
}

/**
 * Summary statistics for a regression report.
 */
export interface RegressionSummary {
  /** Pass/fail status */
  status: 'passed' | 'failed' | 'partial';
  /** Number of baselines with differences */
  differencesFound: number;
  /** Average similarity score */
  averageSimilarity: number;
  /** Most changed regions */
  topChangedAreas: ChangedRegion[];
  /** Recommendations */
  recommendations: string[];
}
