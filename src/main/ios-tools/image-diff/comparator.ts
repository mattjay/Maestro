/**
 * iOS Tools - Image Comparator
 *
 * Core image comparison functionality using pixelmatch.
 * Provides pixel-level comparison with configurable thresholds
 * and ignore region support.
 */

import fs from 'fs/promises';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { logger } from '../../utils/logger';
import {
  ImageDiffErrorCode,
} from './types';
import type {
  ImageCompareOptions,
  ImageCompareResult,
  ImageData,
  ImageInfo,
  DiffOutputOptions,
  IgnoreRegion,
  ImageDiffError,
} from './types';

const LOG_CONTEXT = '[iOS-ImageDiff]';

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_THRESHOLD = 0.1;
export const DEFAULT_ANTIALIASING = true;
export const DEFAULT_INCLUDE_TRANSPARENT = false;
export const DEFAULT_ALPHA_TOLERANCE = 0.1;
export const DEFAULT_UNCHANGED_ALPHA = 0.1;
export const DEFAULT_DIFF_COLOR: [number, number, number] = [255, 0, 0];
export const DEFAULT_ANTIALIAS_COLOR: [number, number, number] = [255, 255, 0];

// =============================================================================
// Image Loading
// =============================================================================

/**
 * Load a PNG image from file and return its raw data.
 *
 * @param imagePath - Path to the PNG image
 * @returns Image data with raw RGBA buffer
 * @throws ImageDiffError if image cannot be loaded
 */
export async function loadImage(imagePath: string): Promise<ImageData> {
  try {
    const buffer = await fs.readFile(imagePath);
    const png = PNG.sync.read(buffer);

    return {
      data: Buffer.from(png.data),
      width: png.width,
      height: png.height,
      channels: 4, // RGBA
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw createImageDiffError(
        ImageDiffErrorCode.FILE_NOT_FOUND,
        `Image not found: ${imagePath}`,
        { path: imagePath }
      );
    }
    throw createImageDiffError(
      ImageDiffErrorCode.DECODE_ERROR,
      `Failed to load image: ${err.message}`,
      { path: imagePath },
      error as Error
    );
  }
}

/**
 * Get information about an image file without loading full data.
 *
 * @param imagePath - Path to the image
 * @returns Image information
 */
export async function getImageInfo(imagePath: string): Promise<ImageInfo> {
  const stat = await fs.stat(imagePath);
  const buffer = await fs.readFile(imagePath);
  const png = PNG.sync.read(buffer);

  return {
    path: imagePath,
    width: png.width,
    height: png.height,
    size: stat.size,
    format: path.extname(imagePath).slice(1).toLowerCase(),
  };
}

/**
 * Save image data to a PNG file.
 *
 * @param imageData - Image data to save
 * @param outputPath - Path to save the image
 */
export async function saveImage(imageData: ImageData, outputPath: string): Promise<void> {
  const png = new PNG({ width: imageData.width, height: imageData.height });
  png.data = imageData.data;

  const buffer = PNG.sync.write(png);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
}

// =============================================================================
// Ignore Region Handling
// =============================================================================

/**
 * Create a mask buffer for ignore regions.
 * Masked pixels (in ignore regions) are set to 0, others to 255.
 *
 * @param width - Image width
 * @param height - Image height
 * @param regions - Regions to ignore
 * @returns Mask buffer
 */
export function createIgnoreMask(
  width: number,
  height: number,
  regions: IgnoreRegion[]
): Uint8Array {
  // Start with all pixels included (255)
  const mask = new Uint8Array(width * height).fill(255);

  for (const region of regions) {
    const { x, y, width: rw, height: rh } = region.rect;

    // Clamp to image bounds
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(width, Math.ceil(x + rw));
    const endY = Math.min(height, Math.ceil(y + rh));

    // Set masked pixels to 0
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        mask[py * width + px] = 0;
      }
    }
  }

  return mask;
}

/**
 * Apply ignore mask to image data, making ignored pixels transparent.
 *
 * @param imageData - Image data to modify
 * @param mask - Ignore mask
 * @returns Modified image data
 */
export function applyIgnoreMask(imageData: ImageData, mask: Uint8Array): ImageData {
  const result = Buffer.from(imageData.data);

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) {
      // Set pixel to transparent black (will be ignored)
      const pixelIndex = i * 4;
      result[pixelIndex] = 0;     // R
      result[pixelIndex + 1] = 0; // G
      result[pixelIndex + 2] = 0; // B
      result[pixelIndex + 3] = 0; // A
    }
  }

  return {
    ...imageData,
    data: result,
  };
}

// =============================================================================
// Image Comparison
// =============================================================================

/**
 * Compare two images using pixelmatch.
 *
 * @param baseline - Path to baseline image or ImageData
 * @param current - Path to current image or ImageData
 * @param options - Comparison options
 * @returns Comparison result
 */
export async function compareImages(
  baseline: string | ImageData,
  current: string | ImageData,
  options: ImageCompareOptions = {}
): Promise<ImageCompareResult> {
  const startTime = Date.now();

  // Load images if paths provided
  const img1 = typeof baseline === 'string' ? await loadImage(baseline) : baseline;
  const img2 = typeof current === 'string' ? await loadImage(current) : current;

  // Check dimension mismatch
  const dimensionMismatch = img1.width !== img2.width || img1.height !== img2.height;

  // For dimension mismatch, compare the overlapping area
  const width = Math.min(img1.width, img2.width);
  const height = Math.min(img1.height, img2.height);

  if (dimensionMismatch) {
    logger.warn(
      `${LOG_CONTEXT} Image dimensions differ: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}. ` +
      `Comparing overlapping area: ${width}x${height}`
    );
  }

  // Prepare images (handle dimension mismatch by extracting overlapping region)
  let baselineData = img1.data;
  let currentData = img2.data;

  if (dimensionMismatch) {
    baselineData = extractRegion(img1, 0, 0, width, height);
    currentData = extractRegion(img2, 0, 0, width, height);
  }

  // Apply ignore mask if regions specified
  if (options.ignoreRegions && options.ignoreRegions.length > 0) {
    const mask = createIgnoreMask(width, height, options.ignoreRegions);
    const maskedBaseline = applyIgnoreMask({ data: baselineData, width, height, channels: 4 }, mask);
    const maskedCurrent = applyIgnoreMask({ data: currentData, width, height, channels: 4 }, mask);
    baselineData = maskedBaseline.data;
    currentData = maskedCurrent.data;
  }

  // Create diff output buffer
  const diffOutput = Buffer.alloc(width * height * 4);

  // Configure pixelmatch options
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const pmOptions: {
    threshold: number;
    includeAA: boolean;
    alpha: number;
    aaColor: [number, number, number];
    diffColor: [number, number, number];
    diffColorAlt?: [number, number, number];
  } = {
    threshold,
    includeAA: !(options.antialiasing ?? DEFAULT_ANTIALIASING),
    alpha: options.alphaTolerance ?? DEFAULT_ALPHA_TOLERANCE,
    aaColor: DEFAULT_ANTIALIAS_COLOR,
    diffColor: DEFAULT_DIFF_COLOR,
  };

  // Create a Uint8Array view of the diffOutput buffer (not a copy)
  // This allows pixelmatch to write directly to the buffer
  const diffOutputView = new Uint8Array(
    diffOutput.buffer,
    diffOutput.byteOffset,
    diffOutput.length
  );

  // Perform comparison
  const diffPixels = pixelmatch(
    new Uint8Array(baselineData),
    new Uint8Array(currentData),
    diffOutputView,
    width,
    height,
    pmOptions
  );

  const totalPixels = width * height;
  const diffPercent = (diffPixels / totalPixels) * 100;
  const similarity = 1 - (diffPixels / totalPixels);

  // Determine if images match (use threshold as percent of pixels allowed to differ)
  // This is a configurable decision - could also use similarity score
  const match = diffPercent <= (threshold * 100);

  const comparisonTimeMs = Date.now() - startTime;

  logger.debug(
    `${LOG_CONTEXT} Comparison complete: ${diffPixels} different pixels ` +
    `(${diffPercent.toFixed(2)}%), similarity: ${(similarity * 100).toFixed(2)}%`
  );

  return {
    match,
    diffPixels,
    totalPixels,
    diffPercent,
    similarity,
    comparisonTimeMs,
    diffImage: diffOutput,
    dimensions: { width, height },
    dimensionMismatch,
  };
}

/**
 * Compare images and optionally save diff outputs.
 *
 * @param baselinePath - Path to baseline image
 * @param currentPath - Path to current image
 * @param options - Comparison options
 * @param outputOptions - Output file options
 * @returns Comparison result
 */
export async function compareAndSave(
  baselinePath: string,
  currentPath: string,
  options: ImageCompareOptions = {},
  outputOptions: DiffOutputOptions = {}
): Promise<ImageCompareResult> {
  const result = await compareImages(baselinePath, currentPath, options);

  // Save diff image if requested and there are differences
  if (outputOptions.diffImagePath && result.diffImage) {
    const diffImageData: ImageData = {
      data: result.diffImage,
      width: result.dimensions.width,
      height: result.dimensions.height,
      channels: 4,
    };
    await saveImage(diffImageData, outputOptions.diffImagePath);
    logger.info(`${LOG_CONTEXT} Diff image saved to: ${outputOptions.diffImagePath}`);
  }

  // Generate and save side-by-side if requested
  if (outputOptions.sideBySidePath) {
    const baseline = await loadImage(baselinePath);
    const current = await loadImage(currentPath);
    const sideBySide = generateSideBySide(baseline, current, result.diffImage, result.dimensions);
    await saveImage(sideBySide, outputOptions.sideBySidePath);
    result.sideBySideImage = sideBySide.data;
    logger.info(`${LOG_CONTEXT} Side-by-side image saved to: ${outputOptions.sideBySidePath}`);
  }

  return result;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract a rectangular region from image data.
 *
 * @param image - Source image data
 * @param x - X coordinate of region
 * @param y - Y coordinate of region
 * @param width - Width of region
 * @param height - Height of region
 * @returns Buffer containing the extracted region
 */
function extractRegion(
  image: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): Buffer {
  const result = Buffer.alloc(width * height * 4);
  const srcWidth = image.width;

  for (let row = 0; row < height; row++) {
    const srcOffset = ((y + row) * srcWidth + x) * 4;
    const dstOffset = row * width * 4;
    image.data.copy(result, dstOffset, srcOffset, srcOffset + width * 4);
  }

  return result;
}

/**
 * Generate a side-by-side comparison image.
 *
 * @param baseline - Baseline image
 * @param current - Current image
 * @param diff - Diff image buffer (optional)
 * @param diffDimensions - Dimensions of diff image
 * @returns Side-by-side image data
 */
function generateSideBySide(
  baseline: ImageData,
  current: ImageData,
  diff?: Buffer,
  diffDimensions?: { width: number; height: number }
): ImageData {
  const gap = 10; // Gap between images
  const labelHeight = 30; // Space for labels

  // Calculate dimensions
  const maxWidth = Math.max(baseline.width, current.width);
  const maxHeight = Math.max(baseline.height, current.height);
  const numImages = diff ? 3 : 2;
  const totalWidth = maxWidth * numImages + gap * (numImages - 1);
  const totalHeight = maxHeight + labelHeight;

  // Create output buffer
  const result = Buffer.alloc(totalWidth * totalHeight * 4);

  // Fill with background color (light gray)
  for (let i = 0; i < result.length; i += 4) {
    result[i] = 240;     // R
    result[i + 1] = 240; // G
    result[i + 2] = 240; // B
    result[i + 3] = 255; // A
  }

  // Copy baseline image
  copyImageToBuffer(baseline, result, totalWidth, 0, labelHeight);

  // Copy current image
  copyImageToBuffer(current, result, totalWidth, maxWidth + gap, labelHeight);

  // Copy diff image if provided
  if (diff && diffDimensions) {
    const diffData: ImageData = {
      data: diff,
      width: diffDimensions.width,
      height: diffDimensions.height,
      channels: 4,
    };
    copyImageToBuffer(diffData, result, totalWidth, (maxWidth + gap) * 2, labelHeight);
  }

  return {
    data: result,
    width: totalWidth,
    height: totalHeight,
    channels: 4,
  };
}

/**
 * Copy an image into a larger buffer at a specified position.
 *
 * @param source - Source image
 * @param target - Target buffer
 * @param targetWidth - Width of target buffer
 * @param offsetX - X offset in target
 * @param offsetY - Y offset in target
 */
function copyImageToBuffer(
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
 * Create an ImageDiffError.
 */
function createImageDiffError(
  code: ImageDiffErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: Error
): ImageDiffError {
  return { code, message, details, cause };
}

// =============================================================================
// Quick Comparison Helpers
// =============================================================================

/**
 * Quick check if two images are identical (hash-based).
 * Returns true if images are byte-for-byte identical.
 *
 * @param imagePath1 - Path to first image
 * @param imagePath2 - Path to second image
 * @returns True if images are identical
 */
export async function areImagesIdentical(
  imagePath1: string,
  imagePath2: string
): Promise<boolean> {
  try {
    const [buf1, buf2] = await Promise.all([
      fs.readFile(imagePath1),
      fs.readFile(imagePath2),
    ]);

    if (buf1.length !== buf2.length) {
      return false;
    }

    return buf1.equals(buf2);
  } catch {
    return false;
  }
}

/**
 * Calculate similarity percentage between two images.
 *
 * @param baseline - Path to baseline image
 * @param current - Path to current image
 * @param options - Comparison options
 * @returns Similarity percentage (0-100)
 */
export async function getSimilarity(
  baseline: string,
  current: string,
  options: ImageCompareOptions = {}
): Promise<number> {
  const result = await compareImages(baseline, current, options);
  return result.similarity * 100;
}

/**
 * Check if images match within a threshold.
 *
 * @param baseline - Path to baseline image
 * @param current - Path to current image
 * @param threshold - Maximum allowed difference (0-1)
 * @returns True if images match within threshold
 */
export async function imagesMatch(
  baseline: string,
  current: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<boolean> {
  const result = await compareImages(baseline, current, { threshold });
  return result.match;
}
