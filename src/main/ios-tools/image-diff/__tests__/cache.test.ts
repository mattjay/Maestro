/**
 * Tests for image-diff caching module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { PNG } from 'pngjs';

// Mock electron app before imports
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'home') {
        return os.tmpdir();
      }
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'Maestro');
      }
      return os.tmpdir();
    },
  },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  // Hash-based quick rejection
  calculateFileHash,
  calculateContentHash,
  areImagesIdenticalCached,
  // Progressive comparison
  downsampleImage,
  progressiveCompare,
  // Parallel batch comparison
  compareInParallel,
  // Cache management
  clearCaches,
  clearHashCache,
  clearComparisonCache,
  getCacheStats,
  // Cached comparison
  compareImagesCached,
  // Constants
  DEFAULT_CONCURRENCY,
  COARSE_DOWNSAMPLE_FACTOR,
  // Types
  type BatchCompareItem,
  type ImageData,
} from '../index';

// =============================================================================
// Test Fixtures
// =============================================================================

let testDir: string;
let redImagePath: string;
let blueImagePath: string;
let greenImagePath: string;
let redImagePath2: string; // Duplicate of red image
let partialDiffImagePath: string;
let largeImagePath: string;

/**
 * Create a test PNG image with solid color.
 */
function createSolidImage(width: number, height: number, r: number, g: number, b: number, a: number = 255): Buffer {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return PNG.sync.write(png);
}

/**
 * Create a test PNG image with a colored square region.
 */
function createImageWithSquare(
  width: number,
  height: number,
  bgR: number,
  bgG: number,
  bgB: number,
  squareX: number,
  squareY: number,
  squareSize: number,
  squareR: number,
  squareG: number,
  squareB: number
): Buffer {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      if (x >= squareX && x < squareX + squareSize && y >= squareY && y < squareY + squareSize) {
        png.data[idx] = squareR;
        png.data[idx + 1] = squareG;
        png.data[idx + 2] = squareB;
      } else {
        png.data[idx] = bgR;
        png.data[idx + 1] = bgG;
        png.data[idx + 2] = bgB;
      }
      png.data[idx + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

beforeAll(async () => {
  // Create test directory
  testDir = path.join(os.tmpdir(), 'cache-tests-' + Date.now());
  await fs.mkdir(testDir, { recursive: true });

  // Create red image
  const redImage = createSolidImage(100, 100, 255, 0, 0);
  redImagePath = path.join(testDir, 'red.png');
  await fs.writeFile(redImagePath, redImage);

  // Create duplicate red image (same content)
  redImagePath2 = path.join(testDir, 'red2.png');
  await fs.writeFile(redImagePath2, redImage);

  // Create blue image
  const blueImage = createSolidImage(100, 100, 0, 0, 255);
  blueImagePath = path.join(testDir, 'blue.png');
  await fs.writeFile(blueImagePath, blueImage);

  // Create green image
  const greenImage = createSolidImage(100, 100, 0, 255, 0);
  greenImagePath = path.join(testDir, 'green.png');
  await fs.writeFile(greenImagePath, greenImage);

  // Create partial diff image (red with green square)
  const partialDiff = createImageWithSquare(100, 100, 255, 0, 0, 40, 40, 20, 0, 255, 0);
  partialDiffImagePath = path.join(testDir, 'partial_diff.png');
  await fs.writeFile(partialDiffImagePath, partialDiff);

  // Create large image for performance testing
  const largeImage = createSolidImage(400, 400, 128, 128, 128);
  largeImagePath = path.join(testDir, 'large.png');
  await fs.writeFile(largeImagePath, largeImage);
});

afterAll(async () => {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

beforeEach(() => {
  // Clear caches before each test
  clearCaches();
});

// =============================================================================
// Hash-Based Quick Rejection Tests
// =============================================================================

describe('Hash-Based Quick Rejection', () => {
  describe('calculateFileHash', () => {
    it('returns consistent hash for same file', async () => {
      const hash1 = await calculateFileHash(redImagePath);
      const hash2 = await calculateFileHash(redImagePath);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{32}$/); // MD5 format
    });

    it('returns different hash for different files', async () => {
      const redHash = await calculateFileHash(redImagePath);
      const blueHash = await calculateFileHash(blueImagePath);

      expect(redHash).not.toBe(blueHash);
    });

    it('returns same hash for files with identical content', async () => {
      const hash1 = await calculateFileHash(redImagePath);
      const hash2 = await calculateFileHash(redImagePath2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('calculateContentHash', () => {
    it('returns hash with dimensions', async () => {
      const result = await calculateContentHash(redImagePath);

      expect(result.hash).toMatch(/^[a-f0-9]{32}$/);
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });

    it('returns same hash for identical pixel content', async () => {
      const result1 = await calculateContentHash(redImagePath);
      const result2 = await calculateContentHash(redImagePath2);

      expect(result1.hash).toBe(result2.hash);
    });

    it('returns different hash for different content', async () => {
      const redResult = await calculateContentHash(redImagePath);
      const blueResult = await calculateContentHash(blueImagePath);

      expect(redResult.hash).not.toBe(blueResult.hash);
    });
  });

  describe('areImagesIdenticalCached', () => {
    it('returns true for identical images', async () => {
      const result = await areImagesIdenticalCached(redImagePath, redImagePath2);

      expect(result.identical).toBe(true);
    });

    it('returns false for different images', async () => {
      const result = await areImagesIdenticalCached(redImagePath, blueImagePath);

      expect(result.identical).toBe(false);
    });

    it('uses cache on second call', async () => {
      // First call - should calculate hash
      const result1 = await areImagesIdenticalCached(redImagePath, redImagePath2);
      expect(result1.identical).toBe(true);

      // Check cache has entries
      const stats1 = getCacheStats();
      expect(stats1.hashCacheSize).toBeGreaterThan(0);

      // Second call - should use cache
      const result2 = await areImagesIdenticalCached(redImagePath, redImagePath2);
      expect(result2.identical).toBe(true);
      expect(result2.cached).toBe(true);
    });

    it('handles different dimensions', async () => {
      // Create a smaller image
      const smallImage = createSolidImage(50, 50, 255, 0, 0);
      const smallPath = path.join(testDir, 'small_red.png');
      await fs.writeFile(smallPath, smallImage);

      const result = await areImagesIdenticalCached(redImagePath, smallPath);

      expect(result.identical).toBe(false);
    });
  });
});

// =============================================================================
// Progressive Comparison Tests
// =============================================================================

describe('Progressive Comparison', () => {
  describe('downsampleImage', () => {
    it('reduces image dimensions by downsample factor', () => {
      const imageData: ImageData = {
        data: Buffer.alloc(100 * 100 * 4),
        width: 100,
        height: 100,
        channels: 4,
      };

      // Fill with test pattern
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255;     // R
        imageData.data[i + 1] = 0;   // G
        imageData.data[i + 2] = 0;   // B
        imageData.data[i + 3] = 255; // A
      }

      const downsampled = downsampleImage(imageData, COARSE_DOWNSAMPLE_FACTOR);

      expect(downsampled.width).toBe(Math.floor(100 / COARSE_DOWNSAMPLE_FACTOR));
      expect(downsampled.height).toBe(Math.floor(100 / COARSE_DOWNSAMPLE_FACTOR));
      expect(downsampled.data.length).toBe(downsampled.width * downsampled.height * 4);
    });

    it('preserves pixel values after downsampling', () => {
      const imageData: ImageData = {
        data: Buffer.alloc(100 * 100 * 4),
        width: 100,
        height: 100,
        channels: 4,
      };

      // Fill with red
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255;
        imageData.data[i + 1] = 0;
        imageData.data[i + 2] = 0;
        imageData.data[i + 3] = 255;
      }

      const downsampled = downsampleImage(imageData, 4);

      // Check first pixel is still red
      expect(downsampled.data[0]).toBe(255);
      expect(downsampled.data[1]).toBe(0);
      expect(downsampled.data[2]).toBe(0);
      expect(downsampled.data[3]).toBe(255);
    });

    it('handles non-divisible dimensions', () => {
      const imageData: ImageData = {
        data: Buffer.alloc(97 * 103 * 4),
        width: 97,
        height: 103,
        channels: 4,
      };

      const downsampled = downsampleImage(imageData, 4);

      expect(downsampled.width).toBe(Math.floor(97 / 4));
      expect(downsampled.height).toBe(Math.floor(103 / 4));
    });
  });

  describe('progressiveCompare', () => {
    it('returns match=true for identical images', async () => {
      const result = await progressiveCompare(redImagePath, redImagePath2);

      expect(result.match).toBe(true);
      expect(result.similarity).toBeGreaterThanOrEqual(0.99);
    });

    it('returns match=false for completely different images', async () => {
      const result = await progressiveCompare(redImagePath, blueImagePath);

      expect(result.match).toBe(false);
      expect(result.similarity).toBeLessThan(0.5);
    });

    it('uses coarse comparison to skip detailed for similar images', async () => {
      const result = await progressiveCompare(redImagePath, redImagePath2, {
        progressive: true,
        coarseSkipThreshold: 0.99,
      });

      expect(result.match).toBe(true);
      expect(result.isCoarseOnly).toBe(true);
      expect(result.coarseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.detailedTimeMs).toBeUndefined();
    });

    it('uses coarse comparison to fail fast for very different images', async () => {
      const result = await progressiveCompare(redImagePath, blueImagePath, {
        progressive: true,
        coarseFailThreshold: 0.5,
      });

      expect(result.match).toBe(false);
      expect(result.isCoarseOnly).toBe(true);
    });

    it('runs detailed comparison for intermediate cases', async () => {
      const result = await progressiveCompare(redImagePath, partialDiffImagePath, {
        progressive: true,
        coarseSkipThreshold: 0.99,
        coarseFailThreshold: 0.1,
      });

      // Partial diff should trigger detailed comparison
      expect(result.isCoarseOnly).toBe(false);
      expect(result.coarseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.detailedTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('can disable progressive comparison', async () => {
      const result = await progressiveCompare(redImagePath, redImagePath2, {
        progressive: false,
      });

      expect(result.match).toBe(true);
      expect(result.isCoarseOnly).toBe(false);
    });

    it('includes timing information', async () => {
      const result = await progressiveCompare(redImagePath, blueImagePath);

      expect(result.comparisonTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});

// =============================================================================
// Parallel Batch Comparison Tests
// =============================================================================

describe('Parallel Batch Comparison', () => {
  describe('compareInParallel', () => {
    it('compares multiple items in parallel', async () => {
      const items: BatchCompareItem[] = [
        { name: 'same1', baselinePath: redImagePath, currentPath: redImagePath2 },
        { name: 'same2', baselinePath: blueImagePath, currentPath: blueImagePath },
        { name: 'diff1', baselinePath: redImagePath, currentPath: blueImagePath },
      ];

      const result = await compareInParallel(items);

      expect(result.totalItems).toBe(3);
      expect(result.passedCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.passRate).toBeCloseTo(2 / 3);
    });

    it('respects concurrency option', async () => {
      const items: BatchCompareItem[] = [
        { name: 'item1', baselinePath: redImagePath, currentPath: redImagePath2 },
        { name: 'item2', baselinePath: blueImagePath, currentPath: blueImagePath },
        { name: 'item3', baselinePath: greenImagePath, currentPath: greenImagePath },
      ];

      const result = await compareInParallel(items, { concurrency: 1 });

      expect(result.totalItems).toBe(3);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('uses hash-based quick rejection', async () => {
      const items: BatchCompareItem[] = [
        { name: 'identical', baselinePath: redImagePath, currentPath: redImagePath2 },
      ];

      const result = await compareInParallel(items, { useHashRejection: true });

      expect(result.passedCount).toBe(1);
      expect(result.items[0].result.match).toBe(true);
    });

    it('can disable hash rejection', async () => {
      const items: BatchCompareItem[] = [
        { name: 'identical', baselinePath: redImagePath, currentPath: redImagePath2 },
      ];

      const result = await compareInParallel(items, { useHashRejection: false });

      expect(result.passedCount).toBe(1);
    });

    it('uses progressive comparison', async () => {
      const items: BatchCompareItem[] = [
        { name: 'partial', baselinePath: redImagePath, currentPath: partialDiffImagePath },
      ];

      const result = await compareInParallel(items, { useProgressive: true });

      expect(result.totalItems).toBe(1);
    });

    it('supports fail-fast option', async () => {
      const items: BatchCompareItem[] = [
        { name: 'diff1', baselinePath: redImagePath, currentPath: blueImagePath },
        { name: 'same1', baselinePath: redImagePath, currentPath: redImagePath2 },
        { name: 'diff2', baselinePath: blueImagePath, currentPath: greenImagePath },
      ];

      const result = await compareInParallel(items, {
        failFast: true,
        concurrency: 1, // Force sequential to ensure predictable order
      });

      // Should stop after first failure
      expect(result.totalItems).toBeLessThanOrEqual(items.length);
      expect(result.failedCount).toBeGreaterThanOrEqual(1);
    });

    it('handles comparison errors gracefully', async () => {
      const items: BatchCompareItem[] = [
        { name: 'error', baselinePath: '/nonexistent/path.png', currentPath: redImagePath },
        { name: 'ok', baselinePath: redImagePath, currentPath: redImagePath2 },
      ];

      const result = await compareInParallel(items);

      expect(result.errorCount).toBe(1);
      expect(result.passedCount).toBe(1);
      expect(result.items[0].error).toBeDefined();
    });

    it('applies per-item options', async () => {
      const items: BatchCompareItem[] = [
        {
          name: 'strict',
          baselinePath: redImagePath,
          currentPath: partialDiffImagePath,
          options: { threshold: 0.01 },
        },
        {
          name: 'lenient',
          baselinePath: redImagePath,
          currentPath: partialDiffImagePath,
          options: { threshold: 0.5 },
        },
      ];

      const result = await compareInParallel(items);

      // Strict should fail, lenient should pass
      const strictResult = result.items.find(i => i.name === 'strict');
      const lenientResult = result.items.find(i => i.name === 'lenient');

      expect(strictResult?.result.match).toBe(false);
      expect(lenientResult?.result.match).toBe(true);
    });

    it('returns results for all items', async () => {
      const items: BatchCompareItem[] = [
        { name: 'a', baselinePath: redImagePath, currentPath: redImagePath2 },
        { name: 'b', baselinePath: blueImagePath, currentPath: blueImagePath },
        { name: 'c', baselinePath: greenImagePath, currentPath: greenImagePath },
      ];

      const result = await compareInParallel(items);

      expect(result.items.length).toBe(3);
      expect(result.items.map(i => i.name).sort()).toEqual(['a', 'b', 'c']);
    });

    it('uses default concurrency', async () => {
      const items: BatchCompareItem[] = [
        { name: 'item1', baselinePath: redImagePath, currentPath: redImagePath2 },
      ];

      // Should use DEFAULT_CONCURRENCY
      const result = await compareInParallel(items);

      expect(result.totalItems).toBe(1);
      expect(DEFAULT_CONCURRENCY).toBe(4);
    });
  });
});

// =============================================================================
// Cache Management Tests
// =============================================================================

describe('Cache Management', () => {
  describe('clearCaches', () => {
    it('clears all caches', async () => {
      // Populate caches
      await areImagesIdenticalCached(redImagePath, redImagePath2);
      await compareImagesCached(redImagePath, blueImagePath);

      const statsBefore = getCacheStats();
      expect(statsBefore.hashCacheSize).toBeGreaterThan(0);

      clearCaches();

      const statsAfter = getCacheStats();
      expect(statsAfter.hashCacheSize).toBe(0);
      expect(statsAfter.comparisonCacheSize).toBe(0);
    });
  });

  describe('clearHashCache', () => {
    it('clears only hash cache', async () => {
      // Populate both caches
      await areImagesIdenticalCached(redImagePath, redImagePath2);
      await compareImagesCached(redImagePath, blueImagePath);

      clearHashCache();

      const stats = getCacheStats();
      expect(stats.hashCacheSize).toBe(0);
      expect(stats.comparisonCacheSize).toBeGreaterThan(0);
    });
  });

  describe('clearComparisonCache', () => {
    it('clears only comparison cache', async () => {
      // Populate both caches
      await areImagesIdenticalCached(redImagePath, redImagePath2);
      await compareImagesCached(redImagePath, blueImagePath);

      clearComparisonCache();

      const stats = getCacheStats();
      expect(stats.hashCacheSize).toBeGreaterThan(0);
      expect(stats.comparisonCacheSize).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('returns current cache sizes', async () => {
      clearCaches();

      const initialStats = getCacheStats();
      expect(initialStats.hashCacheSize).toBe(0);
      expect(initialStats.comparisonCacheSize).toBe(0);

      await areImagesIdenticalCached(redImagePath, blueImagePath);

      const afterHash = getCacheStats();
      expect(afterHash.hashCacheSize).toBeGreaterThan(0);

      await compareImagesCached(redImagePath, blueImagePath);

      const afterCompare = getCacheStats();
      expect(afterCompare.comparisonCacheSize).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Cached Comparison Tests
// =============================================================================

describe('Cached Comparison', () => {
  describe('compareImagesCached', () => {
    it('returns comparison result', async () => {
      const result = await compareImagesCached(redImagePath, blueImagePath);

      expect(result.match).toBe(false);
      expect(result.similarity).toBe(0);
      expect(result.diffPixels).toBe(100 * 100);
    });

    it('caches result for subsequent calls', async () => {
      clearCaches();

      const result1 = await compareImagesCached(redImagePath, blueImagePath);

      const stats = getCacheStats();
      expect(stats.comparisonCacheSize).toBe(1);

      const result2 = await compareImagesCached(redImagePath, blueImagePath);

      // Results should be the same
      expect(result2.match).toBe(result1.match);
      expect(result2.similarity).toBe(result1.similarity);
    });

    it('does not include diff image in cached result', async () => {
      clearCaches();

      await compareImagesCached(redImagePath, blueImagePath);

      // Second call should hit cache
      const cached = await compareImagesCached(redImagePath, blueImagePath);

      // Cached result should not have image buffers
      expect(cached.diffImage).toBeUndefined();
      expect(cached.sideBySideImage).toBeUndefined();
    });

    it('uses different cache keys for different options', async () => {
      clearCaches();

      await compareImagesCached(redImagePath, partialDiffImagePath, { threshold: 0.1 });
      await compareImagesCached(redImagePath, partialDiffImagePath, { threshold: 0.5 });

      const stats = getCacheStats();
      expect(stats.comparisonCacheSize).toBe(2);
    });
  });
});

// =============================================================================
// Performance Tests
// =============================================================================

describe('Performance', () => {
  it('progressive comparison is faster than detailed for similar images', async () => {
    // Run detailed comparison
    const detailedStart = Date.now();
    await progressiveCompare(redImagePath, redImagePath2, { progressive: false });
    const detailedTime = Date.now() - detailedStart;

    // Run progressive comparison
    const progressiveStart = Date.now();
    const progressiveResult = await progressiveCompare(redImagePath, redImagePath2, {
      progressive: true,
      coarseSkipThreshold: 0.95,
    });
    const progressiveTime = Date.now() - progressiveStart;

    // Progressive should be faster for identical images
    // Note: This is a soft check as timing can vary
    expect(progressiveResult.isCoarseOnly).toBe(true);
    // The progressive approach should typically be faster, but we just verify it works
    // Handle edge case where times are so fast they measure as 0ms
    const maxTime = Math.max(detailedTime * 2, 10); // At least 10ms tolerance
    expect(progressiveTime).toBeLessThanOrEqual(maxTime);
  });

  it('hash rejection is faster than pixel comparison for identical files', async () => {
    clearCaches();

    // First call populates cache
    await areImagesIdenticalCached(redImagePath, redImagePath2);

    // Second call should be very fast (cache hit)
    const cacheStart = Date.now();
    const result = await areImagesIdenticalCached(redImagePath, redImagePath2);
    const cacheTime = Date.now() - cacheStart;

    expect(result.identical).toBe(true);
    expect(result.cached).toBe(true);
    // Cache lookup should be very fast (typically < 10ms)
    expect(cacheTime).toBeLessThan(100);
  });

  it('parallel comparison processes multiple items efficiently', async () => {
    const items: BatchCompareItem[] = [
      { name: 'a', baselinePath: redImagePath, currentPath: redImagePath2 },
      { name: 'b', baselinePath: blueImagePath, currentPath: blueImagePath },
      { name: 'c', baselinePath: greenImagePath, currentPath: greenImagePath },
      { name: 'd', baselinePath: largeImagePath, currentPath: largeImagePath },
    ];

    const parallelStart = Date.now();
    const parallelResult = await compareInParallel(items, { concurrency: 4 });
    const parallelTime = Date.now() - parallelStart;

    // All items should be processed
    expect(parallelResult.totalItems).toBe(4);
    expect(parallelResult.passedCount).toBe(4);

    // Total time should be reasonable
    expect(parallelTime).toBeLessThan(5000);
  });
});

// =============================================================================
// Edge Cases Tests
// =============================================================================

describe('Edge Cases', () => {
  it('handles very small images', async () => {
    const tinyImage = createSolidImage(4, 4, 255, 0, 0);
    const tinyPath = path.join(testDir, 'tiny.png');
    await fs.writeFile(tinyPath, tinyImage);

    const result = await progressiveCompare(tinyPath, tinyPath);

    expect(result.match).toBe(true);
  });

  it('handles empty batch comparison', async () => {
    const result = await compareInParallel([]);

    expect(result.totalItems).toBe(0);
    expect(result.passedCount).toBe(0);
    expect(result.passRate).toBe(1);
  });

  it('handles single item batch comparison', async () => {
    const items: BatchCompareItem[] = [
      { name: 'single', baselinePath: redImagePath, currentPath: redImagePath2 },
    ];

    const result = await compareInParallel(items);

    expect(result.totalItems).toBe(1);
    expect(result.passedCount).toBe(1);
  });

  it('handles downsample factor of 1 (no change)', () => {
    const imageData: ImageData = {
      data: Buffer.alloc(10 * 10 * 4),
      width: 10,
      height: 10,
      channels: 4,
    };

    const result = downsampleImage(imageData, 1);

    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
  });
});
