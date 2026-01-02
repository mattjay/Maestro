/**
 * iOS Tools - Diff Image Generator
 *
 * Generates visual diff images including overlays, side-by-side comparisons,
 * and annotated images with bounding boxes around changed regions.
 */

import { logger } from '../../utils/logger';
import { loadImage, saveImage } from './comparator';
import type {
  ImageData,
  DiffGenerationOptions,
  DiffGenerationResult,
  DiffMode,
  DiffOutputOptions,
  DetectedChange,
  Rectangle,
} from './types';

const LOG_CONTEXT = '[iOS-ImageDiff]';

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_UNCHANGED_ALPHA = 0.1;
export const DEFAULT_DIFF_COLOR: [number, number, number] = [255, 0, 0];
export const DEFAULT_BOUNDING_BOX_COLOR: [number, number, number] = [255, 0, 0];
export const DEFAULT_BOUNDING_BOX_THICKNESS = 2;
export const DEFAULT_SIDE_BY_SIDE_GAP = 10;

// =============================================================================
// Overlay Diff Generation
// =============================================================================

/**
 * Generate an overlay diff image where changed pixels are highlighted
 * and unchanged pixels are faded.
 *
 * @param baseline - Baseline image data
 * @param current - Current image data
 * @param diffData - Raw diff data from pixelmatch
 * @param options - Generation options
 * @returns Overlay diff image data
 */
export function generateOverlayDiff(
  baseline: ImageData,
  current: ImageData,
  diffData: Buffer,
  options: DiffOutputOptions = {}
): ImageData {
  const width = Math.min(baseline.width, current.width);
  const height = Math.min(baseline.height, current.height);
  const unchangedAlpha = options.unchangedAlpha ?? DEFAULT_UNCHANGED_ALPHA;
  const diffColor = options.diffColor ?? DEFAULT_DIFF_COLOR;

  const result = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const pixelIdx = i * 4;

    // Check if this pixel is marked as different in the diff data
    // pixelmatch marks different pixels with the diffColor
    const isDiff =
      diffData[pixelIdx] === diffColor[0] &&
      diffData[pixelIdx + 1] === diffColor[1] &&
      diffData[pixelIdx + 2] === diffColor[2];

    if (isDiff) {
      // Show the diff color for changed pixels
      result[pixelIdx] = diffColor[0];
      result[pixelIdx + 1] = diffColor[1];
      result[pixelIdx + 2] = diffColor[2];
      result[pixelIdx + 3] = 255;
    } else {
      // Show baseline with reduced alpha for unchanged pixels
      result[pixelIdx] = baseline.data[pixelIdx];
      result[pixelIdx + 1] = baseline.data[pixelIdx + 1];
      result[pixelIdx + 2] = baseline.data[pixelIdx + 2];
      result[pixelIdx + 3] = Math.floor(255 * unchangedAlpha);
    }
  }

  return {
    data: result,
    width,
    height,
    channels: 4,
  };
}

/**
 * Generate a highlight-only diff showing just the changed pixels.
 *
 * @param diffData - Raw diff data from pixelmatch
 * @param width - Image width
 * @param height - Image height
 * @param options - Generation options
 * @returns Highlight diff image data
 */
export function generateHighlightDiff(
  diffData: Buffer,
  width: number,
  height: number,
  options: DiffOutputOptions = {}
): ImageData {
  const diffColor = options.diffColor ?? DEFAULT_DIFF_COLOR;
  const result = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const pixelIdx = i * 4;

    // Check if this pixel is marked as different
    const isDiff =
      diffData[pixelIdx] === diffColor[0] &&
      diffData[pixelIdx + 1] === diffColor[1] &&
      diffData[pixelIdx + 2] === diffColor[2];

    if (isDiff) {
      // Copy the diff pixel
      result[pixelIdx] = diffData[pixelIdx];
      result[pixelIdx + 1] = diffData[pixelIdx + 1];
      result[pixelIdx + 2] = diffData[pixelIdx + 2];
      result[pixelIdx + 3] = 255;
    } else {
      // Transparent for unchanged pixels
      result[pixelIdx] = 0;
      result[pixelIdx + 1] = 0;
      result[pixelIdx + 2] = 0;
      result[pixelIdx + 3] = 0;
    }
  }

  return {
    data: result,
    width,
    height,
    channels: 4,
  };
}

// =============================================================================
// Side-by-Side Generation
// =============================================================================

/**
 * Generate a side-by-side comparison image with optional diff.
 *
 * @param baseline - Baseline image data
 * @param current - Current image data
 * @param diffData - Optional diff image data
 * @param options - Generation options
 * @returns Side-by-side comparison image
 */
export function generateSideBySide(
  baseline: ImageData,
  current: ImageData,
  diffData?: Buffer,
  options: DiffGenerationOptions = { mode: 'sideBySide' }
): ImageData {
  const gap = options.modeOptions?.gap ?? DEFAULT_SIDE_BY_SIDE_GAP;
  const orientation = options.modeOptions?.orientation ?? 'horizontal';
  const labelHeight = 30;

  const numImages = diffData ? 3 : 2;

  let totalWidth: number;
  let totalHeight: number;

  if (orientation === 'horizontal') {
    const maxWidth = Math.max(baseline.width, current.width);
    const maxHeight = Math.max(baseline.height, current.height);
    totalWidth = maxWidth * numImages + gap * (numImages - 1);
    totalHeight = maxHeight + labelHeight;
  } else {
    const maxWidth = Math.max(baseline.width, current.width);
    const maxHeight = Math.max(baseline.height, current.height);
    totalWidth = maxWidth;
    totalHeight = maxHeight * numImages + gap * (numImages - 1) + labelHeight;
  }

  const result = Buffer.alloc(totalWidth * totalHeight * 4);

  // Fill with background color (light gray)
  fillBackground(result, totalWidth, totalHeight, [240, 240, 240, 255]);

  if (orientation === 'horizontal') {
    // Horizontal layout: [Baseline] [Current] [Diff]
    const maxWidth = Math.max(baseline.width, current.width);
    copyImageAt(baseline, result, totalWidth, 0, labelHeight);
    copyImageAt(current, result, totalWidth, maxWidth + gap, labelHeight);

    if (diffData) {
      const diffImg: ImageData = {
        data: diffData,
        width: Math.min(baseline.width, current.width),
        height: Math.min(baseline.height, current.height),
        channels: 4,
      };
      copyImageAt(diffImg, result, totalWidth, (maxWidth + gap) * 2, labelHeight);
    }
  } else {
    // Vertical layout
    const maxHeight = Math.max(baseline.height, current.height);
    copyImageAt(baseline, result, totalWidth, 0, labelHeight);
    copyImageAt(current, result, totalWidth, 0, labelHeight + maxHeight + gap);

    if (diffData) {
      const diffImg: ImageData = {
        data: diffData,
        width: Math.min(baseline.width, current.width),
        height: Math.min(baseline.height, current.height),
        channels: 4,
      };
      copyImageAt(diffImg, result, totalWidth, 0, labelHeight + (maxHeight + gap) * 2);
    }
  }

  // Add labels (simple text placeholders - actual text rendering would need a font library)
  addLabels(result, totalWidth, labelHeight, orientation, numImages, gap, baseline.width);

  return {
    data: result,
    width: totalWidth,
    height: totalHeight,
    channels: 4,
  };
}

/**
 * Generate an onion skin blend of two images.
 *
 * @param baseline - Baseline image data
 * @param current - Current image data
 * @param blendRatio - Blend ratio (0 = baseline, 1 = current)
 * @returns Blended image data
 */
export function generateOnionSkin(
  baseline: ImageData,
  current: ImageData,
  blendRatio: number = 0.5
): ImageData {
  const width = Math.min(baseline.width, current.width);
  const height = Math.min(baseline.height, current.height);
  const result = Buffer.alloc(width * height * 4);

  const baselineWeight = 1 - blendRatio;
  const currentWeight = blendRatio;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const baseIdx = (y * baseline.width + x) * 4;
      const currIdx = (y * current.width + x) * 4;
      const outIdx = (y * width + x) * 4;

      result[outIdx] = Math.round(
        baseline.data[baseIdx] * baselineWeight + current.data[currIdx] * currentWeight
      );
      result[outIdx + 1] = Math.round(
        baseline.data[baseIdx + 1] * baselineWeight + current.data[currIdx + 1] * currentWeight
      );
      result[outIdx + 2] = Math.round(
        baseline.data[baseIdx + 2] * baselineWeight + current.data[currIdx + 2] * currentWeight
      );
      result[outIdx + 3] = Math.max(baseline.data[baseIdx + 3], current.data[currIdx + 3]);
    }
  }

  return {
    data: result,
    width,
    height,
    channels: 4,
  };
}

// =============================================================================
// Bounding Box Drawing
// =============================================================================

/**
 * Draw bounding boxes around detected changes on an image.
 *
 * @param imageData - Image to draw on (modified in place)
 * @param changes - Detected changes with bounds
 * @param options - Drawing options
 * @returns Modified image data
 */
export function drawBoundingBoxes(
  imageData: ImageData,
  changes: DetectedChange[],
  options: DiffOutputOptions = {}
): ImageData {
  const color = options.boundingBoxColor ?? DEFAULT_BOUNDING_BOX_COLOR;
  const thickness = options.boundingBoxThickness ?? DEFAULT_BOUNDING_BOX_THICKNESS;

  // Create a copy to avoid modifying the original
  const result = Buffer.from(imageData.data);

  for (const change of changes) {
    if (change.isIgnored) continue; // Skip ignored regions

    drawRectangle(
      result,
      imageData.width,
      imageData.height,
      change.bounds,
      color,
      thickness
    );
  }

  return {
    ...imageData,
    data: result,
  };
}

/**
 * Draw a rectangle outline on an image buffer.
 *
 * @param buffer - Image buffer to draw on
 * @param width - Image width
 * @param height - Image height
 * @param rect - Rectangle to draw
 * @param color - RGB color values
 * @param thickness - Line thickness
 */
function drawRectangle(
  buffer: Buffer,
  width: number,
  height: number,
  rect: Rectangle,
  color: [number, number, number],
  thickness: number
): void {
  const x1 = Math.max(0, Math.floor(rect.x));
  const y1 = Math.max(0, Math.floor(rect.y));
  const x2 = Math.min(width - 1, Math.floor(rect.x + rect.width));
  const y2 = Math.min(height - 1, Math.floor(rect.y + rect.height));

  // Draw horizontal lines (top and bottom)
  for (let t = 0; t < thickness; t++) {
    // Top line
    if (y1 + t < height) {
      for (let x = x1; x <= x2; x++) {
        setPixel(buffer, width, x, y1 + t, color);
      }
    }
    // Bottom line
    if (y2 - t >= 0) {
      for (let x = x1; x <= x2; x++) {
        setPixel(buffer, width, x, y2 - t, color);
      }
    }
  }

  // Draw vertical lines (left and right)
  for (let t = 0; t < thickness; t++) {
    // Left line
    if (x1 + t < width) {
      for (let y = y1; y <= y2; y++) {
        setPixel(buffer, width, x1 + t, y, color);
      }
    }
    // Right line
    if (x2 - t >= 0) {
      for (let y = y1; y <= y2; y++) {
        setPixel(buffer, width, x2 - t, y, color);
      }
    }
  }
}

/**
 * Set a pixel color in an image buffer.
 */
function setPixel(
  buffer: Buffer,
  width: number,
  x: number,
  y: number,
  color: [number, number, number]
): void {
  const idx = (y * width + x) * 4;
  buffer[idx] = color[0];
  buffer[idx + 1] = color[1];
  buffer[idx + 2] = color[2];
  buffer[idx + 3] = 255;
}

// =============================================================================
// Main Diff Generation
// =============================================================================

/**
 * Generate a diff image based on the specified mode.
 *
 * @param baselinePath - Path to baseline image
 * @param currentPath - Path to current image
 * @param diffData - Raw diff data from comparison
 * @param options - Generation options
 * @returns Generated diff image result
 */
export async function generateDiff(
  baselinePath: string,
  currentPath: string,
  diffData: Buffer,
  options: DiffGenerationOptions
): Promise<DiffGenerationResult> {
  const startTime = Date.now();

  const baseline = await loadImage(baselinePath);
  const current = await loadImage(currentPath);
  const width = Math.min(baseline.width, current.width);
  const height = Math.min(baseline.height, current.height);

  let resultImage: ImageData;

  switch (options.mode) {
    case 'overlay':
      resultImage = generateOverlayDiff(baseline, current, diffData, options.output);
      break;

    case 'highlight':
      resultImage = generateHighlightDiff(diffData, width, height, options.output);
      break;

    case 'sideBySide':
      resultImage = generateSideBySide(baseline, current, diffData, options);
      break;

    case 'onion':
      const blendRatio = options.modeOptions?.blendRatio ?? 0.5;
      resultImage = generateOnionSkin(baseline, current, blendRatio);
      break;

    case 'swipe':
      // Swipe mode returns metadata for interactive viewers
      // Just return the raw images stacked
      resultImage = generateSideBySide(baseline, current, undefined, {
        ...options,
        modeOptions: { ...options.modeOptions, orientation: 'horizontal' },
      });
      break;

    default:
      resultImage = generateOverlayDiff(baseline, current, diffData, options.output);
  }

  // Draw bounding boxes if regions provided
  if (options.highlightRegions && options.highlightRegions.length > 0 &&
      options.output?.drawBoundingBoxes !== false) {
    resultImage = drawBoundingBoxes(resultImage, options.highlightRegions, options.output);
  }

  // Save if path provided
  let savedPath: string | undefined;
  if (options.output?.diffImagePath) {
    await saveImage(resultImage, options.output.diffImagePath);
    savedPath = options.output.diffImagePath;
    logger.info(`${LOG_CONTEXT} Generated diff image: ${savedPath}`);
  }

  const generationTimeMs = Date.now() - startTime;

  return {
    image: resultImage.data,
    width: resultImage.width,
    height: resultImage.height,
    savedPath,
    generationTimeMs,
    mode: options.mode,
  };
}

/**
 * Generate multiple diff views at once.
 *
 * @param baselinePath - Path to baseline image
 * @param currentPath - Path to current image
 * @param diffData - Raw diff data
 * @param modes - Array of modes to generate
 * @param baseOutputPath - Base path for output files
 * @returns Map of mode to generation result
 */
export async function generateMultipleDiffs(
  baselinePath: string,
  currentPath: string,
  diffData: Buffer,
  modes: DiffMode[],
  baseOutputPath: string
): Promise<Map<DiffMode, DiffGenerationResult>> {
  const results = new Map<DiffMode, DiffGenerationResult>();

  for (const mode of modes) {
    const outputPath = `${baseOutputPath}_${mode}.png`;
    const result = await generateDiff(baselinePath, currentPath, diffData, {
      mode,
      output: { diffImagePath: outputPath },
    });
    results.set(mode, result);
  }

  return results;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Fill a buffer with a background color.
 */
function fillBackground(
  buffer: Buffer,
  width: number,
  height: number,
  color: [number, number, number, number]
): void {
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    buffer[idx] = color[0];
    buffer[idx + 1] = color[1];
    buffer[idx + 2] = color[2];
    buffer[idx + 3] = color[3];
  }
}

/**
 * Copy an image to a specific position in a buffer.
 */
function copyImageAt(
  source: ImageData,
  target: Buffer,
  targetWidth: number,
  offsetX: number,
  offsetY: number
): void {
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const srcIdx = (y * source.width + x) * 4;
      const dstIdx = ((y + offsetY) * targetWidth + (x + offsetX)) * 4;

      target[dstIdx] = source.data[srcIdx];
      target[dstIdx + 1] = source.data[srcIdx + 1];
      target[dstIdx + 2] = source.data[srcIdx + 2];
      target[dstIdx + 3] = source.data[srcIdx + 3];
    }
  }
}

/**
 * Add simple label indicators (colored rectangles) to a side-by-side image.
 * Note: Actual text rendering would require a font/canvas library.
 */
function addLabels(
  buffer: Buffer,
  width: number,
  labelHeight: number,
  orientation: 'horizontal' | 'vertical',
  numImages: number,
  gap: number,
  imageWidth: number
): void {
  // Add colored indicators for each image section
  // Green for baseline, Blue for current, Red for diff
  const colors: Array<[number, number, number]> = [
    [0, 150, 0],   // Baseline: green
    [0, 0, 200],   // Current: blue
    [200, 0, 0],   // Diff: red
  ];

  const indicatorWidth = 60;
  const indicatorHeight = 8;
  const indicatorY = Math.floor((labelHeight - indicatorHeight) / 2);

  for (let i = 0; i < numImages; i++) {
    let startX: number;

    if (orientation === 'horizontal') {
      startX = i * (imageWidth + gap) + Math.floor((imageWidth - indicatorWidth) / 2);
    } else {
      startX = Math.floor((width - indicatorWidth) / 2);
    }

    // Draw colored indicator
    for (let y = indicatorY; y < indicatorY + indicatorHeight; y++) {
      for (let x = startX; x < startX + indicatorWidth; x++) {
        if (x >= 0 && x < width && y >= 0 && y < labelHeight) {
          setPixel(buffer, width, x, y, colors[i]);
        }
      }
    }
  }
}
