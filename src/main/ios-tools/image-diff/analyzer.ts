/**
 * iOS Tools - Change Analyzer
 *
 * Analyzes image differences to identify discrete changed regions,
 * categorize change types, and generate human-readable summaries.
 */

import { logger } from '../../utils/logger';
import { loadImage } from './comparator';
import type {
  ImageData,
  ImageCompareResult,
  DetectedChange,
  ChangeSummary,
  ImageAnalysisResult,
  ChangeType,
  Rectangle,
  IgnoreRegion,
} from './types';

const LOG_CONTEXT = '[iOS-ImageDiff]';

// =============================================================================
// Constants
// =============================================================================

/**
 * Minimum pixels in a region to be considered significant.
 */
export const MIN_REGION_PIXELS = 10;

/**
 * Maximum gap between pixels to consider them part of the same region.
 */
export const REGION_MERGE_GAP = 5;

/**
 * Severity thresholds.
 */
export const SEVERITY_THRESHOLDS = {
  LOW: 0.3,
  MEDIUM: 0.7,
};

// =============================================================================
// Region Detection
// =============================================================================

/**
 * Find connected regions of changed pixels using flood fill.
 *
 * @param diffData - Diff image data from comparison
 * @param width - Image width
 * @param height - Image height
 * @param diffColor - Color used to mark diff pixels (or undefined to detect any non-faded pixels)
 * @returns Array of bounding rectangles for each region
 */
export function findChangedRegions(
  diffData: Buffer,
  width: number,
  height: number,
  diffColor?: [number, number, number]
): Rectangle[] {
  // Create a visited map
  const visited = new Uint8Array(width * height);

  // Create a diff pixel map for faster lookup
  // pixelmatch marks diff pixels with the specified color, but also marks
  // unchanged pixels with a very low alpha/faded appearance
  // We detect diff pixels by looking for high-alpha pixels that aren't faded
  const isDiffPixel = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const pixelIdx = i * 4;
    const r = diffData[pixelIdx];
    const g = diffData[pixelIdx + 1];
    const b = diffData[pixelIdx + 2];
    const a = diffData[pixelIdx + 3];

    if (diffColor) {
      // Exact color match mode
      if (r === diffColor[0] && g === diffColor[1] && b === diffColor[2]) {
        isDiffPixel[i] = 1;
      }
    } else {
      // Auto-detect mode: look for red-ish or yellow-ish pixels with high alpha
      // These are the colors pixelmatch uses for different and antialiasing pixels
      const isRedish = r > 200 && g < 100 && b < 100;
      const isYellowish = r > 200 && g > 200 && b < 100;
      const hasHighAlpha = a > 128;

      if (hasHighAlpha && (isRedish || isYellowish)) {
        isDiffPixel[i] = 1;
      }
    }
  }

  const regions: Rectangle[] = [];

  // Scan for connected regions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (visited[idx] || !isDiffPixel[idx]) continue;

      // Found an unvisited diff pixel - start a new region
      const region = floodFillRegion(
        isDiffPixel,
        visited,
        width,
        height,
        x,
        y,
        REGION_MERGE_GAP
      );

      if (region.pixelCount >= MIN_REGION_PIXELS) {
        regions.push(region.bounds);
      }
    }
  }

  // Merge overlapping or nearby regions
  return mergeNearbyRegions(regions, REGION_MERGE_GAP);
}

/**
 * Flood fill to find a connected region of diff pixels.
 *
 * @param isDiffPixel - Boolean map of diff pixels
 * @param visited - Visited pixel map
 * @param width - Image width
 * @param height - Image height
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param gap - Maximum gap to consider pixels connected
 * @returns Region bounds and pixel count
 */
function floodFillRegion(
  isDiffPixel: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  gap: number
): { bounds: Rectangle; pixelCount: number } {
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;
  let pixelCount = 0;

  // Track which pixels are in queue to avoid duplicates
  const inQueue = new Uint8Array(width * height);

  // Use array with index pointer instead of shift() for O(1) dequeue
  const queue: Array<[number, number]> = [[startX, startY]];
  let queueHead = 0;
  inQueue[startY * width + startX] = 1;

  while (queueHead < queue.length) {
    const [x, y] = queue[queueHead++];
    const idx = y * width + x;

    if (visited[idx]) continue;
    if (!isDiffPixel[idx]) continue;

    visited[idx] = 1;
    pixelCount++;

    // Update bounds
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    // Check neighbors (with gap tolerance for nearby clusters)
    for (let dy = -gap; dy <= gap; dy++) {
      for (let dx = -gap; dx <= gap; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx;
          if (!visited[nidx] && isDiffPixel[nidx] && !inQueue[nidx]) {
            inQueue[nidx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  return {
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    pixelCount,
  };
}

/**
 * Merge regions that are close together or overlapping.
 *
 * @param regions - Array of rectangles to merge
 * @param gap - Maximum gap between regions to merge
 * @returns Merged regions
 */
function mergeNearbyRegions(regions: Rectangle[], gap: number): Rectangle[] {
  if (regions.length <= 1) return regions;

  const merged: Rectangle[] = [];
  const used = new Set<number>();

  for (let i = 0; i < regions.length; i++) {
    if (used.has(i)) continue;

    let current = { ...regions[i] };
    used.add(i);

    // Keep trying to merge with other regions
    let changed = true;
    while (changed) {
      changed = false;

      for (let j = 0; j < regions.length; j++) {
        if (used.has(j)) continue;

        if (regionsOverlapOrNear(current, regions[j], gap)) {
          current = mergeRectangles(current, regions[j]);
          used.add(j);
          changed = true;
        }
      }
    }

    merged.push(current);
  }

  return merged;
}

/**
 * Check if two rectangles overlap or are within gap distance.
 */
function regionsOverlapOrNear(a: Rectangle, b: Rectangle, gap: number): boolean {
  const expandedA = {
    x: a.x - gap,
    y: a.y - gap,
    width: a.width + gap * 2,
    height: a.height + gap * 2,
  };

  return !(
    expandedA.x + expandedA.width < b.x ||
    b.x + b.width < expandedA.x ||
    expandedA.y + expandedA.height < b.y ||
    b.y + b.height < expandedA.y
  );
}

/**
 * Merge two rectangles into one encompassing both.
 */
function mergeRectangles(a: Rectangle, b: Rectangle): Rectangle {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// =============================================================================
// Change Type Classification
// =============================================================================

/**
 * Classify the type of change in a region.
 *
 * @param baseline - Baseline image data
 * @param current - Current image data
 * @param region - Region bounds
 * @returns Classified change type with confidence
 */
export function classifyChange(
  baseline: ImageData,
  current: ImageData,
  region: Rectangle
): { type: ChangeType; confidence: number } {
  // Extract region pixel statistics
  const baselineStats = getRegionStats(baseline, region);
  const currentStats = getRegionStats(current, region);

  // Check for added element (region was mostly transparent/background in baseline)
  if (baselineStats.avgAlpha < 50 && currentStats.avgAlpha > 200) {
    return { type: 'added', confidence: 0.8 };
  }

  // Check for removed element (region is now mostly transparent/background)
  if (baselineStats.avgAlpha > 200 && currentStats.avgAlpha < 50) {
    return { type: 'removed', confidence: 0.8 };
  }

  // Check for color change (similar structure, different colors)
  const colorDiff = Math.abs(baselineStats.avgLuminance - currentStats.avgLuminance);
  const structureSimilar =
    Math.abs(baselineStats.edgeDensity - currentStats.edgeDensity) < 0.2;

  if (structureSimilar && colorDiff > 30) {
    return { type: 'color', confidence: 0.7 };
  }

  // Check for layout change (position/size shift)
  const edgeDiff = Math.abs(baselineStats.edgeDensity - currentStats.edgeDensity);
  if (edgeDiff > 0.3) {
    return { type: 'layout', confidence: 0.6 };
  }

  // Check for text change (high edge density, moderate color variance)
  if (baselineStats.edgeDensity > 0.5 && currentStats.edgeDensity > 0.5) {
    return { type: 'text', confidence: 0.5 };
  }

  return { type: 'unknown', confidence: 0.3 };
}

/**
 * Get statistical measures for a region of an image.
 */
function getRegionStats(
  image: ImageData,
  region: Rectangle
): {
  avgAlpha: number;
  avgLuminance: number;
  colorVariance: number;
  edgeDensity: number;
} {
  const startX = Math.max(0, Math.floor(region.x));
  const startY = Math.max(0, Math.floor(region.y));
  const endX = Math.min(image.width, Math.ceil(region.x + region.width));
  const endY = Math.min(image.height, Math.ceil(region.y + region.height));

  let totalAlpha = 0;
  let totalLuminance = 0;
  const luminances: number[] = [];
  let edgeCount = 0;
  let pixelCount = 0;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * image.width + x) * 4;
      const r = image.data[idx];
      const g = image.data[idx + 1];
      const b = image.data[idx + 2];
      const a = image.data[idx + 3];

      totalAlpha += a;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += lum;
      luminances.push(lum);

      // Simple edge detection (compare with right and bottom neighbors)
      if (x < endX - 1 && y < endY - 1) {
        const rightIdx = (y * image.width + x + 1) * 4;
        const bottomIdx = ((y + 1) * image.width + x) * 4;

        const rightLum =
          0.299 * image.data[rightIdx] +
          0.587 * image.data[rightIdx + 1] +
          0.114 * image.data[rightIdx + 2];
        const bottomLum =
          0.299 * image.data[bottomIdx] +
          0.587 * image.data[bottomIdx + 1] +
          0.114 * image.data[bottomIdx + 2];

        if (Math.abs(lum - rightLum) > 30 || Math.abs(lum - bottomLum) > 30) {
          edgeCount++;
        }
      }

      pixelCount++;
    }
  }

  const avgLum = totalLuminance / pixelCount;
  const variance =
    luminances.reduce((sum, l) => sum + Math.pow(l - avgLum, 2), 0) / pixelCount;

  return {
    avgAlpha: totalAlpha / pixelCount,
    avgLuminance: avgLum,
    colorVariance: Math.sqrt(variance),
    edgeDensity: edgeCount / pixelCount,
  };
}

// =============================================================================
// Change Severity
// =============================================================================

/**
 * Calculate severity of a change based on size, location, and type.
 *
 * @param change - Detected change
 * @param imageWidth - Total image width
 * @param imageHeight - Total image height
 * @returns Severity score (0-1)
 */
export function calculateSeverity(
  change: Partial<DetectedChange>,
  imageWidth: number,
  imageHeight: number
): number {
  let severity = 0;

  // Size factor (larger changes are more severe)
  if (change.bounds) {
    const regionArea = change.bounds.width * change.bounds.height;
    const imageArea = imageWidth * imageHeight;
    const sizeFactor = Math.min(1, (regionArea / imageArea) * 10);
    severity += sizeFactor * 0.4;
  }

  // Pixel count factor
  if (change.pixelCount) {
    const pixelFactor = Math.min(1, change.pixelCount / 10000);
    severity += pixelFactor * 0.3;
  }

  // Type factor
  const typeSeverity: Record<ChangeType, number> = {
    added: 0.8,
    removed: 0.9,
    layout: 0.7,
    text: 0.6,
    color: 0.4,
    unknown: 0.5,
  };

  if (change.changeType) {
    severity += (typeSeverity[change.changeType] || 0.5) * 0.3;
  }

  return Math.min(1, severity);
}

// =============================================================================
// Main Analysis
// =============================================================================

/**
 * Analyze differences between two images.
 *
 * @param baseline - Path to baseline image or ImageData
 * @param current - Path to current image or ImageData
 * @param comparisonResult - Result from compareImages
 * @param ignoreRegions - Regions to exclude from analysis
 * @returns Analysis result with detected changes and summary
 */
export async function analyzeChanges(
  baseline: string | ImageData,
  current: string | ImageData,
  comparisonResult: ImageCompareResult,
  ignoreRegions: IgnoreRegion[] = []
): Promise<ImageAnalysisResult> {
  const startTime = Date.now();

  // Load images if paths provided
  const baselineData = typeof baseline === 'string' ? await loadImage(baseline) : baseline;
  const currentData = typeof current === 'string' ? await loadImage(current) : current;

  const { dimensions, diffImage } = comparisonResult;
  const { width, height } = dimensions;

  // Find changed regions from diff image
  const regions = diffImage
    ? findChangedRegions(diffImage, width, height)
    : [];

  // Create ignore region bounds for checking
  const ignoreBounds = ignoreRegions.map((r) => r.rect);

  // Analyze each region
  const changes: DetectedChange[] = [];

  for (let i = 0; i < regions.length; i++) {
    const bounds = regions[i];

    // Check if region overlaps with any ignore region
    const isIgnored = ignoreBounds.some((ignore) => rectanglesOverlap(bounds, ignore));

    // Count pixels in this region from the diff
    const pixelCount = diffImage
      ? countDiffPixelsInRegion(diffImage, width, bounds)
      : bounds.width * bounds.height;

    // Classify the change type
    const { type, confidence } = classifyChange(baselineData, currentData, bounds);

    // Calculate severity
    const severity = calculateSeverity(
      { bounds, pixelCount, changeType: type },
      width,
      height
    );

    // Generate description
    const description = generateChangeDescription(type, bounds, pixelCount);

    changes.push({
      id: `change_${i + 1}`,
      bounds,
      pixelCount,
      changePercent: (pixelCount / (bounds.width * bounds.height)) * 100,
      changeType: type,
      confidence,
      description,
      severity,
      isIgnored,
    });
  }

  // Sort by severity (highest first)
  changes.sort((a, b) => b.severity - a.severity);

  // Generate summary
  const summary = generateChangeSummary(changes, width * height);

  const analysisTimeMs = Date.now() - startTime;

  logger.debug(
    `${LOG_CONTEXT} Analysis complete: ${changes.length} regions, ` +
    `${summary.totalChangedPixels} changed pixels`
  );

  return {
    changes,
    summary,
    analysisTimeMs,
    ignoredRegions: ignoreBounds,
  };
}

/**
 * Check if two rectangles overlap.
 */
function rectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Count diff pixels within a specific region.
 */
function countDiffPixelsInRegion(
  diffData: Buffer,
  width: number,
  region: Rectangle,
  diffColor: [number, number, number] = [255, 0, 0]
): number {
  const startX = Math.max(0, Math.floor(region.x));
  const startY = Math.max(0, Math.floor(region.y));
  const endX = Math.min(width, Math.ceil(region.x + region.width));
  const endY = startY + Math.ceil(region.height);

  let count = 0;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * width + x) * 4;
      if (
        diffData[idx] === diffColor[0] &&
        diffData[idx + 1] === diffColor[1] &&
        diffData[idx + 2] === diffColor[2]
      ) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Generate a human-readable description for a change.
 */
function generateChangeDescription(
  type: ChangeType,
  bounds: Rectangle,
  pixelCount: number
): string {
  const location = `(${Math.round(bounds.x)}, ${Math.round(bounds.y)})`;
  const size = `${Math.round(bounds.width)}x${Math.round(bounds.height)}`;

  switch (type) {
    case 'added':
      return `New element appeared at ${location} (${size})`;
    case 'removed':
      return `Element removed at ${location} (${size})`;
    case 'layout':
      return `Layout change at ${location} (${size})`;
    case 'color':
      return `Color change at ${location} (${size})`;
    case 'text':
      return `Text change at ${location} (${size})`;
    default:
      return `Visual change at ${location} (${size}, ${pixelCount} pixels)`;
  }
}

// =============================================================================
// Summary Generation
// =============================================================================

/**
 * Generate a summary of all detected changes.
 *
 * @param changes - Array of detected changes
 * @param totalPixels - Total pixels in image
 * @returns Change summary
 */
export function generateChangeSummary(
  changes: DetectedChange[],
  totalPixels: number
): ChangeSummary {
  const nonIgnoredChanges = changes.filter((c) => !c.isIgnored);

  // Count by type
  const byType: Record<ChangeType, number> = {
    layout: 0,
    color: 0,
    text: 0,
    added: 0,
    removed: 0,
    unknown: 0,
  };

  for (const change of nonIgnoredChanges) {
    byType[change.changeType]++;
  }

  // Count total changed pixels
  const totalChangedPixels = nonIgnoredChanges.reduce((sum, c) => sum + c.pixelCount, 0);

  // Severity distribution
  const severityDistribution = {
    low: nonIgnoredChanges.filter((c) => c.severity < SEVERITY_THRESHOLDS.LOW).length,
    medium: nonIgnoredChanges.filter(
      (c) => c.severity >= SEVERITY_THRESHOLDS.LOW && c.severity < SEVERITY_THRESHOLDS.MEDIUM
    ).length,
    high: nonIgnoredChanges.filter((c) => c.severity >= SEVERITY_THRESHOLDS.MEDIUM).length,
  };

  // Find most significant change
  const mostSignificant = nonIgnoredChanges[0]; // Already sorted by severity

  // Generate summary text
  const summaryText = generateSummaryText(
    nonIgnoredChanges.length,
    totalChangedPixels,
    totalPixels,
    byType,
    mostSignificant
  );

  return {
    regionCount: nonIgnoredChanges.length,
    totalChangedPixels,
    byType,
    severityDistribution,
    mostSignificant,
    summaryText,
  };
}

/**
 * Generate human-readable summary text.
 */
function generateSummaryText(
  regionCount: number,
  changedPixels: number,
  totalPixels: number,
  byType: Record<ChangeType, number>,
  mostSignificant?: DetectedChange
): string {
  if (regionCount === 0) {
    return 'No visual changes detected.';
  }

  const parts: string[] = [];

  // Overall stats
  const changePercent = ((changedPixels / totalPixels) * 100).toFixed(2);
  parts.push(
    `Found ${regionCount} changed region${regionCount === 1 ? '' : 's'} ` +
    `affecting ${changedPixels.toLocaleString()} pixels (${changePercent}% of image).`
  );

  // Type breakdown
  const typeDescriptions: string[] = [];
  if (byType.added > 0) typeDescriptions.push(`${byType.added} added`);
  if (byType.removed > 0) typeDescriptions.push(`${byType.removed} removed`);
  if (byType.layout > 0) typeDescriptions.push(`${byType.layout} layout`);
  if (byType.color > 0) typeDescriptions.push(`${byType.color} color`);
  if (byType.text > 0) typeDescriptions.push(`${byType.text} text`);

  if (typeDescriptions.length > 0) {
    parts.push(`Changes: ${typeDescriptions.join(', ')}.`);
  }

  // Most significant
  if (mostSignificant && mostSignificant.description) {
    parts.push(`Most significant: ${mostSignificant.description}`);
  }

  return parts.join(' ');
}

/**
 * Generate a formatted report of changes for agent consumption.
 *
 * @param analysisResult - Analysis result
 * @param baselinePath - Path to baseline image
 * @param currentPath - Path to current image
 * @param diffPath - Path to diff image (optional)
 * @returns Formatted markdown report
 */
export function formatAnalysisReport(
  analysisResult: ImageAnalysisResult,
  baselinePath: string,
  currentPath: string,
  diffPath?: string
): string {
  const { changes, summary } = analysisResult;

  const lines: string[] = [];

  // Header
  lines.push('## Visual Comparison Report');
  lines.push('');

  // Status
  const status = changes.length === 0 ? '✅ MATCH' : '❌ DIFFERENCES DETECTED';
  lines.push(`**Status**: ${status}`);
  lines.push(`**Similarity**: ${((1 - summary.totalChangedPixels / 1000000) * 100).toFixed(1)}%`);
  lines.push(`**Changed Regions**: ${summary.regionCount}`);
  lines.push('');

  // Changed regions detail
  if (changes.length > 0) {
    lines.push('### Changed Regions');
    lines.push('');

    const displayChanges = changes.filter((c) => !c.isIgnored).slice(0, 10);
    for (const change of displayChanges) {
      const severity = change.severity >= 0.7 ? '🔴' : change.severity >= 0.3 ? '🟡' : '🟢';
      lines.push(
        `${severity} **${change.changeType.toUpperCase()}** at ` +
        `(${Math.round(change.bounds.x)}, ${Math.round(change.bounds.y)}) - ` +
        `${Math.round(change.bounds.width)}x${Math.round(change.bounds.height)}`
      );
      if (change.description) {
        lines.push(`   ${change.description}`);
      }
    }

    if (changes.length > 10) {
      lines.push(`   ... and ${changes.length - 10} more regions`);
    }
    lines.push('');
  }

  // File paths
  lines.push('### Files');
  lines.push(`- **Baseline**: ${baselinePath}`);
  lines.push(`- **Current**: ${currentPath}`);
  if (diffPath) {
    lines.push(`- **Diff**: ${diffPath}`);
  }
  lines.push('');

  // Recommendations
  if (changes.length > 0) {
    lines.push('### Recommendation');
    lines.push('Review the changes above. If intentional, update the baseline.');
    lines.push('');
  }

  return lines.join('\n');
}
