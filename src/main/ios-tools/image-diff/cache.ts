/**
 * iOS Tools - Image Comparison Caching
 *
 * Performance optimizations for visual regression testing:
 * - Hash-based quick rejection for identical images
 * - Progressive comparison (coarse-to-fine)
 * - Parallel comparison for multiple baselines
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import { PNG } from 'pngjs';
import { logger } from '../../utils/logger';
import { compareImages, loadImage } from './comparator';
import type {
  ImageCompareOptions,
  ImageCompareResult,
  ImageData,
  BatchCompareItem,
  BatchCompareResult,
  BatchCompareItemResult,
} from './types';

const LOG_CONTEXT = '[iOS-ImageDiff-Cache]';

// =============================================================================
// Constants
// =============================================================================

/** Default maximum concurrent comparisons for parallel processing */
export const DEFAULT_CONCURRENCY = 4;

/** Default cache TTL in milliseconds (1 hour) */
export const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

/** Maximum cache entries before eviction */
export const DEFAULT_MAX_CACHE_ENTRIES = 100;

/** Downsample factor for coarse comparison (1/4 of original dimensions) */
export const COARSE_DOWNSAMPLE_FACTOR = 4;

/** Similarity threshold to skip detailed comparison (if coarse is this similar, skip detailed) */
export const COARSE_SKIP_THRESHOLD = 0.99;

/** Similarity threshold to fail fast (if coarse is this different, skip detailed) */
export const COARSE_FAIL_THRESHOLD = 0.5;

// =============================================================================
// Types
// =============================================================================

/**
 * Cache entry for image hash.
 */
export interface ImageHashCacheEntry {
  /** File hash (MD5 of file contents) */
  fileHash: string;
  /** Content hash (hash of pixel data) */
  contentHash: string;
  /** Image dimensions */
  dimensions: { width: number; height: number };
  /** Timestamp when cached */
  timestamp: number;
  /** File modification time when cached */
  mtime: number;
}

/**
 * Cache entry for comparison result.
 */
export interface ComparisonCacheEntry {
  /** Hash of baseline + current + options */
  cacheKey: string;
  /** Comparison result (without image buffers) */
  result: Omit<ImageCompareResult, 'diffImage' | 'sideBySideImage'>;
  /** Timestamp when cached */
  timestamp: number;
}

/**
 * Options for progressive comparison.
 */
export interface ProgressiveCompareOptions extends ImageCompareOptions {
  /** Enable progressive comparison (default: true) */
  progressive?: boolean;
  /** Skip detailed comparison if coarse similarity >= this value (default: 0.99) */
  coarseSkipThreshold?: number;
  /** Fail fast if coarse similarity < this value (default: 0.5) */
  coarseFailThreshold?: number;
}

/**
 * Options for parallel batch comparison.
 */
export interface ParallelCompareOptions {
  /** Maximum concurrent comparisons (default: 4) */
  concurrency?: number;
  /** Comparison options for all items (can be overridden per-item) */
  compareOptions?: ImageCompareOptions;
  /** Enable hash-based quick rejection (default: true) */
  useHashRejection?: boolean;
  /** Enable progressive comparison (default: true) */
  useProgressive?: boolean;
  /** Stop on first failure (default: false) */
  failFast?: boolean;
}

/**
 * Result of progressive comparison.
 */
export interface ProgressiveCompareResult extends ImageCompareResult {
  /** Whether the result is from coarse comparison only */
  isCoarseOnly: boolean;
  /** Time spent on coarse comparison (ms) */
  coarseTimeMs?: number;
  /** Time spent on detailed comparison (ms) */
  detailedTimeMs?: number;
}

// =============================================================================
// Image Hash Cache
// =============================================================================

/**
 * In-memory cache for image hashes.
 * Used for quick rejection of identical images without full comparison.
 */
class ImageHashCache {
  private cache: Map<string, ImageHashCacheEntry> = new Map();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = DEFAULT_MAX_CACHE_ENTRIES, ttlMs = DEFAULT_CACHE_TTL_MS) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /**
   * Get cached hash entry for an image path.
   * Returns undefined if not cached or cache is stale.
   */
  async get(imagePath: string): Promise<ImageHashCacheEntry | undefined> {
    const entry = this.cache.get(imagePath);
    if (!entry) return undefined;

    // Check if cache is stale
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(imagePath);
      return undefined;
    }

    // Check if file was modified
    try {
      const stat = await fs.stat(imagePath);
      if (stat.mtimeMs !== entry.mtime) {
        this.cache.delete(imagePath);
        return undefined;
      }
    } catch {
      this.cache.delete(imagePath);
      return undefined;
    }

    return entry;
  }

  /**
   * Cache hash entry for an image path.
   */
  async set(imagePath: string, fileHash: string, contentHash: string, width: number, height: number): Promise<void> {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    try {
      const stat = await fs.stat(imagePath);
      this.cache.set(imagePath, {
        fileHash,
        contentHash,
        dimensions: { width, height },
        timestamp: Date.now(),
        mtime: stat.mtimeMs,
      });
    } catch {
      // Ignore errors during caching
    }
  }

  /**
   * Remove oldest entries to make room for new ones.
   */
  private evictOldest(): void {
    const entriesToRemove = Math.ceil(this.maxEntries * 0.2); // Remove 20%
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size.
   */
  get size(): number {
    return this.cache.size;
  }
}

// Global hash cache instance
const hashCache = new ImageHashCache();

// =============================================================================
// Comparison Result Cache
// =============================================================================

/**
 * In-memory cache for comparison results.
 */
class ComparisonCache {
  private cache: Map<string, ComparisonCacheEntry> = new Map();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = DEFAULT_MAX_CACHE_ENTRIES, ttlMs = DEFAULT_CACHE_TTL_MS) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key from comparison inputs.
   */
  private generateKey(baselinePath: string, currentPath: string, options: ImageCompareOptions): string {
    const optionsStr = JSON.stringify({
      threshold: options.threshold,
      antialiasing: options.antialiasing,
      ignoreRegions: options.ignoreRegions,
    });
    return crypto.createHash('md5').update(`${baselinePath}:${currentPath}:${optionsStr}`).digest('hex');
  }

  /**
   * Get cached comparison result.
   */
  get(baselinePath: string, currentPath: string, options: ImageCompareOptions): Omit<ImageCompareResult, 'diffImage' | 'sideBySideImage'> | undefined {
    const key = this.generateKey(baselinePath, currentPath, options);
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    // Check if cache is stale
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.result;
  }

  /**
   * Cache comparison result (without image buffers).
   */
  set(baselinePath: string, currentPath: string, options: ImageCompareOptions, result: ImageCompareResult): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const key = this.generateKey(baselinePath, currentPath, options);

    // Store result without buffers to save memory
    const { diffImage: _diff, sideBySideImage: _sbs, ...resultWithoutBuffers } = result;

    this.cache.set(key, {
      cacheKey: key,
      result: resultWithoutBuffers,
      timestamp: Date.now(),
    });
  }

  private evictOldest(): void {
    const entriesToRemove = Math.ceil(this.maxEntries * 0.2);
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Global comparison cache instance
const comparisonCache = new ComparisonCache();

// =============================================================================
// Hash-Based Quick Rejection
// =============================================================================

/**
 * Calculate file hash (MD5 of raw file bytes).
 */
export async function calculateFileHash(imagePath: string): Promise<string> {
  const buffer = await fs.readFile(imagePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Calculate content hash (hash of pixel data, ignoring metadata).
 */
export async function calculateContentHash(imagePath: string): Promise<{ hash: string; width: number; height: number }> {
  const buffer = await fs.readFile(imagePath);
  const png = PNG.sync.read(buffer);

  // Hash the raw pixel data
  const hash = crypto.createHash('md5').update(Buffer.from(png.data)).digest('hex');

  return { hash, width: png.width, height: png.height };
}

/**
 * Quick check if two images are identical using cached hashes.
 * Returns true if images are identical (same content hash).
 *
 * @param imagePath1 - Path to first image
 * @param imagePath2 - Path to second image
 * @returns True if images have identical content
 */
export async function areImagesIdenticalCached(
  imagePath1: string,
  imagePath2: string
): Promise<{ identical: boolean; cached: boolean }> {
  // Check cache for both images
  let entry1 = await hashCache.get(imagePath1);
  let entry2 = await hashCache.get(imagePath2);

  // Calculate hashes for images not in cache
  if (!entry1) {
    const fileHash = await calculateFileHash(imagePath1);
    const { hash: contentHash, width, height } = await calculateContentHash(imagePath1);
    await hashCache.set(imagePath1, fileHash, contentHash, width, height);
    entry1 = await hashCache.get(imagePath1);
  }

  if (!entry2) {
    const fileHash = await calculateFileHash(imagePath2);
    const { hash: contentHash, width, height } = await calculateContentHash(imagePath2);
    await hashCache.set(imagePath2, fileHash, contentHash, width, height);
    entry2 = await hashCache.get(imagePath2);
  }

  if (!entry1 || !entry2) {
    return { identical: false, cached: false };
  }

  // Quick check: different dimensions = different images
  if (entry1.dimensions.width !== entry2.dimensions.width ||
      entry1.dimensions.height !== entry2.dimensions.height) {
    return { identical: false, cached: true };
  }

  // Compare content hashes
  return { identical: entry1.contentHash === entry2.contentHash, cached: true };
}

// =============================================================================
// Progressive Comparison
// =============================================================================

/**
 * Downsample image data for coarse comparison.
 * Uses simple point sampling for speed.
 */
export function downsampleImage(image: ImageData, factor: number = COARSE_DOWNSAMPLE_FACTOR): ImageData {
  const newWidth = Math.max(1, Math.floor(image.width / factor));
  const newHeight = Math.max(1, Math.floor(image.height / factor));
  const newData = Buffer.alloc(newWidth * newHeight * 4);

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      // Sample from original image
      const srcX = Math.min(x * factor, image.width - 1);
      const srcY = Math.min(y * factor, image.height - 1);
      const srcIdx = (srcY * image.width + srcX) * 4;
      const dstIdx = (y * newWidth + x) * 4;

      newData[dstIdx] = image.data[srcIdx];
      newData[dstIdx + 1] = image.data[srcIdx + 1];
      newData[dstIdx + 2] = image.data[srcIdx + 2];
      newData[dstIdx + 3] = image.data[srcIdx + 3];
    }
  }

  return {
    data: newData,
    width: newWidth,
    height: newHeight,
    channels: 4,
  };
}

/**
 * Progressive image comparison: coarse first, then detailed if needed.
 *
 * This approach:
 * 1. First compares downsampled images (fast, rough estimate)
 * 2. If coarse comparison shows high similarity, skip detailed (saves time)
 * 3. If coarse comparison shows low similarity, fail fast (saves time)
 * 4. Otherwise, run full detailed comparison
 *
 * @param baseline - Path to baseline image or ImageData
 * @param current - Path to current image or ImageData
 * @param options - Progressive comparison options
 * @returns Comparison result with timing breakdown
 */
export async function progressiveCompare(
  baseline: string | ImageData,
  current: string | ImageData,
  options: ProgressiveCompareOptions = {}
): Promise<ProgressiveCompareResult> {
  const progressive = options.progressive ?? true;
  const coarseSkipThreshold = options.coarseSkipThreshold ?? COARSE_SKIP_THRESHOLD;
  const coarseFailThreshold = options.coarseFailThreshold ?? COARSE_FAIL_THRESHOLD;

  // If progressive is disabled, just run normal comparison
  if (!progressive) {
    const result = await compareImages(baseline, current, options);
    return {
      ...result,
      isCoarseOnly: false,
    };
  }

  // Load images
  const img1 = typeof baseline === 'string' ? await loadImage(baseline) : baseline;
  const img2 = typeof current === 'string' ? await loadImage(current) : current;

  // Phase 1: Coarse comparison
  const coarseStart = Date.now();
  const coarseImg1 = downsampleImage(img1);
  const coarseImg2 = downsampleImage(img2);

  const coarseResult = await compareImages(coarseImg1, coarseImg2, {
    ...options,
    // Adjust ignore regions for downsampled image
    ignoreRegions: options.ignoreRegions?.map(region => ({
      ...region,
      rect: {
        x: Math.floor(region.rect.x / COARSE_DOWNSAMPLE_FACTOR),
        y: Math.floor(region.rect.y / COARSE_DOWNSAMPLE_FACTOR),
        width: Math.ceil(region.rect.width / COARSE_DOWNSAMPLE_FACTOR),
        height: Math.ceil(region.rect.height / COARSE_DOWNSAMPLE_FACTOR),
      },
    })),
  });
  const coarseTimeMs = Date.now() - coarseStart;

  logger.debug(
    `${LOG_CONTEXT} Coarse comparison: ${(coarseResult.similarity * 100).toFixed(1)}% similarity in ${coarseTimeMs}ms`
  );

  // Decision: skip detailed if coarse shows high similarity
  if (coarseResult.similarity >= coarseSkipThreshold) {
    logger.debug(
      `${LOG_CONTEXT} Skipping detailed comparison (coarse similarity ${(coarseResult.similarity * 100).toFixed(1)}% >= ${(coarseSkipThreshold * 100).toFixed(1)}%)`
    );

    // Return coarse result adjusted for full resolution
    return {
      match: true,
      diffPixels: 0,
      totalPixels: img1.width * img1.height,
      diffPercent: 0,
      similarity: coarseResult.similarity,
      comparisonTimeMs: coarseTimeMs,
      dimensions: { width: img1.width, height: img1.height },
      dimensionMismatch: img1.width !== img2.width || img1.height !== img2.height,
      isCoarseOnly: true,
      coarseTimeMs,
    };
  }

  // Decision: fail fast if coarse shows low similarity
  if (coarseResult.similarity < coarseFailThreshold) {
    logger.debug(
      `${LOG_CONTEXT} Failing fast (coarse similarity ${(coarseResult.similarity * 100).toFixed(1)}% < ${(coarseFailThreshold * 100).toFixed(1)}%)`
    );

    // Return coarse result (we know it's different, no need for detailed)
    return {
      match: false,
      diffPixels: Math.round(coarseResult.diffPercent * img1.width * img1.height / 100),
      totalPixels: img1.width * img1.height,
      diffPercent: coarseResult.diffPercent,
      similarity: coarseResult.similarity,
      comparisonTimeMs: coarseTimeMs,
      dimensions: { width: img1.width, height: img1.height },
      dimensionMismatch: img1.width !== img2.width || img1.height !== img2.height,
      isCoarseOnly: true,
      coarseTimeMs,
    };
  }

  // Phase 2: Detailed comparison
  const detailedStart = Date.now();
  const detailedResult = await compareImages(img1, img2, options);
  const detailedTimeMs = Date.now() - detailedStart;

  logger.debug(
    `${LOG_CONTEXT} Detailed comparison: ${(detailedResult.similarity * 100).toFixed(1)}% similarity in ${detailedTimeMs}ms`
  );

  return {
    ...detailedResult,
    comparisonTimeMs: coarseTimeMs + detailedTimeMs,
    isCoarseOnly: false,
    coarseTimeMs,
    detailedTimeMs,
  };
}

// =============================================================================
// Parallel Batch Comparison
// =============================================================================

/**
 * Compare a single item with all optimizations.
 */
async function compareSingleItem(
  item: BatchCompareItem,
  options: ParallelCompareOptions
): Promise<BatchCompareItemResult> {
  const startTime = Date.now();

  try {
    // Hash-based quick rejection
    if (options.useHashRejection !== false) {
      const { identical, cached } = await areImagesIdenticalCached(item.baselinePath, item.currentPath);

      if (identical) {
        logger.debug(`${LOG_CONTEXT} Quick match for ${item.name} (hash-identical, cached=${cached})`);

        return {
          name: item.name,
          result: {
            match: true,
            diffPixels: 0,
            totalPixels: 0, // Not calculated for hash match
            diffPercent: 0,
            similarity: 1,
            comparisonTimeMs: Date.now() - startTime,
            dimensions: { width: 0, height: 0 }, // Not calculated for hash match
            dimensionMismatch: false,
          },
        };
      }
    }

    // Merge item-specific options with global options
    const compareOpts: ProgressiveCompareOptions = {
      ...options.compareOptions,
      ...item.options,
      progressive: options.useProgressive !== false,
    };

    // Run progressive comparison
    const result = await progressiveCompare(item.baselinePath, item.currentPath, compareOpts);

    return {
      name: item.name,
      result,
    };
  } catch (error) {
    const err = error as Error;
    logger.error(`${LOG_CONTEXT} Comparison failed for ${item.name}: ${err.message}`);

    return {
      name: item.name,
      result: {
        match: false,
        diffPixels: 0,
        totalPixels: 0,
        diffPercent: 100,
        similarity: 0,
        comparisonTimeMs: Date.now() - startTime,
        dimensions: { width: 0, height: 0 },
        dimensionMismatch: false,
      },
      error: err.message,
    };
  }
}

/**
 * Compare multiple baseline/current pairs in parallel with optimizations.
 *
 * Features:
 * - Hash-based quick rejection for identical images
 * - Progressive comparison (coarse-to-fine)
 * - Configurable concurrency
 * - Fail-fast option
 *
 * @param items - Array of comparison items
 * @param options - Parallel comparison options
 * @returns Batch comparison result
 */
export async function compareInParallel(
  items: BatchCompareItem[],
  options: ParallelCompareOptions = {}
): Promise<BatchCompareResult> {
  const startTime = Date.now();
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const failFast = options.failFast ?? false;

  logger.info(`${LOG_CONTEXT} Starting parallel comparison of ${items.length} items (concurrency=${concurrency})`);

  const results: BatchCompareItemResult[] = [];
  let stopped = false;

  // Process items in batches based on concurrency
  for (let i = 0; i < items.length && !stopped; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(item => compareSingleItem(item, options))
    );

    for (const result of batchResults) {
      results.push(result);

      // Check fail-fast condition
      if (failFast && (!result.result.match || result.error)) {
        logger.debug(`${LOG_CONTEXT} Fail-fast triggered on ${result.name}`);
        stopped = true;
        break;
      }
    }
  }

  // Calculate summary statistics
  const passedCount = results.filter(r => r.result.match && !r.error).length;
  const failedCount = results.filter(r => !r.result.match && !r.error).length;
  const errorCount = results.filter(r => !!r.error).length;
  const totalTimeMs = Date.now() - startTime;

  logger.info(
    `${LOG_CONTEXT} Parallel comparison complete: ${passedCount} passed, ${failedCount} failed, ${errorCount} errors in ${totalTimeMs}ms`
  );

  return {
    items: results,
    totalItems: results.length,
    passedCount,
    failedCount,
    errorCount,
    passRate: results.length > 0 ? passedCount / results.length : 1,
    totalTimeMs,
  };
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear all caches.
 */
export function clearCaches(): void {
  hashCache.clear();
  comparisonCache.clear();
  logger.debug(`${LOG_CONTEXT} All caches cleared`);
}

/**
 * Clear the image hash cache.
 */
export function clearHashCache(): void {
  hashCache.clear();
}

/**
 * Clear the comparison result cache.
 */
export function clearComparisonCache(): void {
  comparisonCache.clear();
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): {
  hashCacheSize: number;
  comparisonCacheSize: number;
} {
  return {
    hashCacheSize: hashCache.size,
    comparisonCacheSize: comparisonCache.size,
  };
}

// =============================================================================
// Cached Comparison
// =============================================================================

/**
 * Compare images with caching of results.
 * If the same comparison was done recently, returns cached result.
 *
 * Note: Cached results don't include diff image buffers.
 * If you need the diff image, use compareImages directly.
 */
export async function compareImagesCached(
  baseline: string,
  current: string,
  options: ImageCompareOptions = {}
): Promise<ImageCompareResult> {
  // Check cache first
  const cached = comparisonCache.get(baseline, current, options);
  if (cached) {
    logger.debug(`${LOG_CONTEXT} Cache hit for comparison ${baseline} vs ${current}`);
    return {
      ...cached,
      diffImage: undefined,
      sideBySideImage: undefined,
    };
  }

  // Run comparison
  const result = await compareImages(baseline, current, options);

  // Cache the result
  comparisonCache.set(baseline, current, options, result);

  return result;
}
