/**
 * iOS Tools - Image Diff Module
 *
 * Central export point for image comparison and visual diff functionality.
 * Provides pixel-level comparison, diff image generation, and change analysis.
 */

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Image data types
  ImageData,
  ImageInfo,
  // Comparison options
  ImageCompareOptions,
  DiffOutputOptions,
  // Comparison results
  ImageCompareResult,
  // Changed region types
  ChangeType,
  DetectedChange,
  ChangeSummary,
  // Analysis results
  ImageAnalysisResult,
  // Diff generation
  DiffMode,
  DiffGenerationOptions,
  DiffGenerationResult,
  // Batch operations
  BatchCompareItem,
  BatchCompareItemResult,
  BatchCompareResult,
  // Error types
  ImageDiffErrorCode,
  ImageDiffError,
  // Re-exports from baselines
  Rectangle,
  IgnoreRegion,
} from './types';

// =============================================================================
// Comparator Functions
// =============================================================================

export {
  // Constants
  DEFAULT_THRESHOLD,
  DEFAULT_ANTIALIASING,
  DEFAULT_INCLUDE_TRANSPARENT,
  DEFAULT_ALPHA_TOLERANCE,
  DEFAULT_UNCHANGED_ALPHA,
  DEFAULT_DIFF_COLOR,
  DEFAULT_ANTIALIAS_COLOR,
  // Image loading
  loadImage,
  getImageInfo,
  saveImage,
  // Ignore mask handling
  createIgnoreMask,
  applyIgnoreMask,
  // Core comparison
  compareImages,
  compareAndSave,
  // Quick helpers
  areImagesIdentical,
  getSimilarity,
  imagesMatch,
} from './comparator';

// =============================================================================
// Diff Generator Functions
// =============================================================================

export {
  // Constants
  DEFAULT_BOUNDING_BOX_COLOR,
  DEFAULT_BOUNDING_BOX_THICKNESS,
  DEFAULT_SIDE_BY_SIDE_GAP,
  // Overlay generation
  generateOverlayDiff,
  generateHighlightDiff,
  // Side-by-side generation
  generateSideBySide,
  generateOnionSkin,
  // Bounding box drawing
  drawBoundingBoxes,
  // Main generation function
  generateDiff,
  generateMultipleDiffs,
} from './differ';

// =============================================================================
// Analyzer Functions
// =============================================================================

export {
  // Constants
  MIN_REGION_PIXELS,
  REGION_MERGE_GAP,
  SEVERITY_THRESHOLDS,
  // Region detection
  findChangedRegions,
  // Change classification
  classifyChange,
  calculateSeverity,
  // Main analysis
  analyzeChanges,
  // Summary generation
  generateChangeSummary,
  formatAnalysisReport,
} from './analyzer';

// =============================================================================
// Convenience Functions
// =============================================================================

import { compareImages, compareAndSave } from './comparator';
import { generateDiff } from './differ';
import { analyzeChanges, formatAnalysisReport } from './analyzer';
import type {
  ImageCompareOptions,
  DiffOutputOptions,
  DiffGenerationOptions,
  ImageCompareResult,
  ImageAnalysisResult,
  DiffGenerationResult,
  IgnoreRegion,
} from './types';

/**
 * Comprehensive comparison with analysis and diff generation.
 * This is the main entry point for most use cases.
 *
 * @param baselinePath - Path to baseline image
 * @param currentPath - Path to current image
 * @param options - Comparison and output options
 * @returns Combined results from comparison, analysis, and diff generation
 */
export async function fullComparison(
  baselinePath: string,
  currentPath: string,
  options: {
    compare?: ImageCompareOptions;
    output?: DiffOutputOptions;
    diffMode?: DiffGenerationOptions['mode'];
    ignoreRegions?: IgnoreRegion[];
  } = {}
): Promise<{
  comparison: ImageCompareResult;
  analysis: ImageAnalysisResult;
  diff?: DiffGenerationResult;
  report: string;
}> {
  // Run comparison
  const comparison = await compareAndSave(
    baselinePath,
    currentPath,
    {
      ...options.compare,
      ignoreRegions: options.ignoreRegions,
    },
    options.output
  );

  // Run analysis
  const analysis = await analyzeChanges(
    baselinePath,
    currentPath,
    comparison,
    options.ignoreRegions
  );

  // Generate diff image if requested
  let diff: DiffGenerationResult | undefined;
  if (options.diffMode && comparison.diffImage) {
    diff = await generateDiff(baselinePath, currentPath, comparison.diffImage, {
      mode: options.diffMode,
      highlightRegions: analysis.changes,
      output: options.output,
    });
  }

  // Generate report
  const report = formatAnalysisReport(
    analysis,
    baselinePath,
    currentPath,
    options.output?.diffImagePath
  );

  return { comparison, analysis, diff, report };
}

/**
 * Quick check if two images are visually similar.
 * Returns true if similarity is above the threshold.
 *
 * @param baselinePath - Path to baseline image
 * @param currentPath - Path to current image
 * @param threshold - Minimum similarity (0-1, default: 0.95)
 * @returns True if images are similar
 */
export async function quickCompare(
  baselinePath: string,
  currentPath: string,
  threshold: number = 0.95
): Promise<boolean> {
  const result = await compareImages(baselinePath, currentPath);
  return result.similarity >= threshold;
}

/**
 * Generate a visual diff report with all artifacts.
 *
 * @param baselinePath - Path to baseline image
 * @param currentPath - Path to current image
 * @param outputDir - Directory to save diff artifacts
 * @param baselineName - Name for the baseline (used in filenames)
 * @returns Paths to generated artifacts
 */
export async function generateDiffReport(
  baselinePath: string,
  currentPath: string,
  outputDir: string,
  baselineName: string
): Promise<{
  overlayPath: string;
  sideBySidePath: string;
  reportPath: string;
  comparison: ImageCompareResult;
}> {
  const { join } = await import('path');
  const { writeFile } = await import('fs/promises');

  const overlayPath = join(outputDir, `${baselineName}_overlay.png`);
  const sideBySidePath = join(outputDir, `${baselineName}_sidebyside.png`);
  const reportPath = join(outputDir, `${baselineName}_report.md`);

  // Run comparison with overlay output
  const comparison = await compareAndSave(baselinePath, currentPath, {}, {
    diffImagePath: overlayPath,
    sideBySidePath,
  });

  // Run analysis
  const analysis = await analyzeChanges(baselinePath, currentPath, comparison);

  // Generate and save report
  const report = formatAnalysisReport(analysis, baselinePath, currentPath, overlayPath);
  await writeFile(reportPath, report);

  return {
    overlayPath,
    sideBySidePath,
    reportPath,
    comparison,
  };
}
