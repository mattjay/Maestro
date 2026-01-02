/**
 * iOS Tools - Image Diff Types
 *
 * Type definitions for image comparison, diff generation, and change analysis.
 */

import type { Rectangle, IgnoreRegion, ChangeType as BaseChangeType } from '../baselines/types';

// Re-export types from baselines that are used in image comparison
export type { Rectangle, IgnoreRegion };

// =============================================================================
// Image Data Types
// =============================================================================

/**
 * Raw image data for comparison operations.
 */
export interface ImageData {
  /** Raw pixel data buffer (RGBA format) */
  data: Buffer;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Channels per pixel (typically 4 for RGBA) */
  channels: number;
}

/**
 * Image file information.
 */
export interface ImageInfo {
  /** File path */
  path: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** File size in bytes */
  size: number;
  /** File format (png, jpg, etc.) */
  format: string;
}

// =============================================================================
// Comparison Options
// =============================================================================

/**
 * Options for pixel-level image comparison.
 */
export interface ImageCompareOptions {
  /**
   * Pixel color difference threshold (0-1).
   * Lower values are more strict.
   * Default: 0.1
   */
  threshold?: number;

  /**
   * Whether to ignore antialiasing differences.
   * Antialiasing detection looks for pixels that are on the edge
   * of a shape boundary.
   * Default: true
   */
  antialiasing?: boolean;

  /**
   * Regions to exclude from comparison.
   * Useful for ignoring dynamic content like timestamps or avatars.
   */
  ignoreRegions?: IgnoreRegion[];

  /**
   * Whether to include invisible (fully transparent) pixels in comparison.
   * Default: false
   */
  includeTransparent?: boolean;

  /**
   * Alpha tolerance for considering pixels as "different".
   * Pixels with alpha difference less than this value are considered equal.
   * Default: 0.1
   */
  alphaTolerance?: number;
}

/**
 * Options for generating diff images.
 */
export interface DiffOutputOptions {
  /**
   * Path to save the diff overlay image.
   */
  diffImagePath?: string;

  /**
   * Path to save a side-by-side comparison image.
   */
  sideBySidePath?: string;

  /**
   * Alpha value for unchanged pixels in the diff overlay (0-1).
   * Lower values make unchanged areas more transparent.
   * Default: 0.1
   */
  unchangedAlpha?: number;

  /**
   * Color for highlighting different pixels in the diff image.
   * Format: [R, G, B] where each value is 0-255.
   * Default: [255, 0, 0] (red)
   */
  diffColor?: [number, number, number];

  /**
   * Color for highlighting antialiasing pixels.
   * Format: [R, G, B] where each value is 0-255.
   * Default: [255, 255, 0] (yellow)
   */
  antialiasColor?: [number, number, number];

  /**
   * Whether to draw bounding boxes around changed regions.
   * Default: true
   */
  drawBoundingBoxes?: boolean;

  /**
   * Color for bounding boxes.
   * Format: [R, G, B] where each value is 0-255.
   * Default: [255, 0, 0] (red)
   */
  boundingBoxColor?: [number, number, number];

  /**
   * Line thickness for bounding boxes in pixels.
   * Default: 2
   */
  boundingBoxThickness?: number;
}

// =============================================================================
// Comparison Results
// =============================================================================

/**
 * Result of comparing two images.
 */
export interface ImageCompareResult {
  /**
   * Whether the images match within the given threshold.
   */
  match: boolean;

  /**
   * Number of pixels that differ between the images.
   */
  diffPixels: number;

  /**
   * Total number of pixels compared.
   */
  totalPixels: number;

  /**
   * Percentage of pixels that differ (0-100).
   */
  diffPercent: number;

  /**
   * Similarity score (0-1, where 1 is identical).
   */
  similarity: number;

  /**
   * Time taken for comparison in milliseconds.
   */
  comparisonTimeMs: number;

  /**
   * Raw diff image data (if generated).
   */
  diffImage?: Buffer;

  /**
   * Side-by-side comparison image data (if generated).
   */
  sideBySideImage?: Buffer;

  /**
   * Dimensions of compared images.
   */
  dimensions: {
    width: number;
    height: number;
  };

  /**
   * Whether images had different dimensions.
   * If true, comparison was done on the overlapping area.
   */
  dimensionMismatch: boolean;
}

// =============================================================================
// Changed Region Types
// =============================================================================

/**
 * Types of visual changes that can be detected.
 */
export type ChangeType = BaseChangeType;

/**
 * A region where visual changes were detected.
 */
export interface DetectedChange {
  /** Unique identifier for this change */
  id: string;

  /** Bounding rectangle of the changed area */
  bounds: Rectangle;

  /** Number of changed pixels in this region */
  pixelCount: number;

  /** Percentage of region that changed */
  changePercent: number;

  /** Estimated type of change */
  changeType: ChangeType;

  /** Confidence in the change type classification (0-1) */
  confidence: number;

  /** Human-readable description of the change */
  description?: string;

  /** Severity of the change (0-1, where 1 is most severe) */
  severity: number;

  /** Whether this region overlaps with an ignore region */
  isIgnored: boolean;

  /** Average color difference in this region */
  averageColorDiff?: number;
}

/**
 * Summary of all detected changes.
 */
export interface ChangeSummary {
  /** Total number of changed regions */
  regionCount: number;

  /** Total number of changed pixels across all regions */
  totalChangedPixels: number;

  /** Breakdown by change type */
  byType: {
    [K in ChangeType]: number;
  };

  /** Severity distribution */
  severityDistribution: {
    low: number;    // severity < 0.3
    medium: number; // severity 0.3-0.7
    high: number;   // severity > 0.7
  };

  /** Most significant change (highest severity) */
  mostSignificant?: DetectedChange;

  /** Human-readable summary text */
  summaryText: string;
}

// =============================================================================
// Analysis Results
// =============================================================================

/**
 * Result of analyzing image differences.
 */
export interface ImageAnalysisResult {
  /** Individual detected changes */
  changes: DetectedChange[];

  /** Summary of all changes */
  summary: ChangeSummary;

  /** Time taken for analysis in milliseconds */
  analysisTimeMs: number;

  /** Regions that were excluded from analysis */
  ignoredRegions: Rectangle[];
}

// =============================================================================
// Diff Generation Types
// =============================================================================

/**
 * Type of diff visualization.
 */
export type DiffMode =
  | 'overlay'       // Changed pixels overlaid on faded original
  | 'highlight'     // Only changed pixels shown
  | 'sideBySide'    // Original and current side by side
  | 'swipe'         // For interactive comparison (metadata only)
  | 'onion';        // Blended overlay with adjustable opacity

/**
 * Configuration for generating a diff image.
 */
export interface DiffGenerationOptions {
  /** Type of diff visualization */
  mode: DiffMode;

  /** Options specific to the mode */
  modeOptions?: {
    /** For overlay mode: alpha of unchanged pixels (0-1) */
    unchangedAlpha?: number;
    /** For onion mode: blend ratio (0-1, 0=baseline, 1=current) */
    blendRatio?: number;
    /** For sideBySide: gap between images in pixels */
    gap?: number;
    /** For sideBySide: orientation */
    orientation?: 'horizontal' | 'vertical';
  };

  /** Regions to highlight (from analysis) */
  highlightRegions?: DetectedChange[];

  /** Output options */
  output?: DiffOutputOptions;
}

/**
 * Result of generating a diff image.
 */
export interface DiffGenerationResult {
  /** Generated diff image data */
  image: Buffer;

  /** Width of the generated image */
  width: number;

  /** Height of the generated image */
  height: number;

  /** Path where the image was saved (if saved) */
  savedPath?: string;

  /** Time taken for generation in milliseconds */
  generationTimeMs: number;

  /** Mode used for generation */
  mode: DiffMode;
}

// =============================================================================
// Batch Comparison Types
// =============================================================================

/**
 * Item in a batch comparison.
 */
export interface BatchCompareItem {
  /** Identifier for this comparison */
  name: string;

  /** Path to baseline image */
  baselinePath: string;

  /** Path to current image */
  currentPath: string;

  /** Comparison-specific options (override defaults) */
  options?: ImageCompareOptions;
}

/**
 * Result of a single item in a batch comparison.
 */
export interface BatchCompareItemResult {
  /** Item name/identifier */
  name: string;

  /** Comparison result */
  result: ImageCompareResult;

  /** Analysis result (if requested) */
  analysis?: ImageAnalysisResult;

  /** Diff generation result (if requested) */
  diff?: DiffGenerationResult;

  /** Error if comparison failed */
  error?: string;
}

/**
 * Result of a batch comparison operation.
 */
export interface BatchCompareResult {
  /** Individual comparison results */
  items: BatchCompareItemResult[];

  /** Total items compared */
  totalItems: number;

  /** Number of items that matched */
  passedCount: number;

  /** Number of items with differences */
  failedCount: number;

  /** Number of items that errored */
  errorCount: number;

  /** Pass rate (0-1) */
  passRate: number;

  /** Total time for all comparisons in milliseconds */
  totalTimeMs: number;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error codes for image comparison operations.
 */
export enum ImageDiffErrorCode {
  /** Image file not found */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  /** Invalid image format */
  INVALID_FORMAT = 'INVALID_FORMAT',
  /** Failed to decode image */
  DECODE_ERROR = 'DECODE_ERROR',
  /** Image dimensions don't match (when strict) */
  DIMENSION_MISMATCH = 'DIMENSION_MISMATCH',
  /** Failed to generate diff image */
  GENERATION_ERROR = 'GENERATION_ERROR',
  /** Failed to save output file */
  SAVE_ERROR = 'SAVE_ERROR',
  /** Comparison timed out */
  TIMEOUT = 'TIMEOUT',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error from image comparison operations.
 */
export interface ImageDiffError {
  /** Error code */
  code: ImageDiffErrorCode;

  /** Human-readable error message */
  message: string;

  /** Additional details */
  details?: Record<string, unknown>;

  /** Original error if this wraps another error */
  cause?: Error;
}
