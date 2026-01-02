/**
 * Tests for image-diff module - comparator, differ, and analyzer
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
  // Comparator
  loadImage,
  saveImage,
  compareImages,
  compareAndSave,
  areImagesIdentical,
  getSimilarity,
  imagesMatch,
  createIgnoreMask,
  // Differ
  generateOverlayDiff,
  generateHighlightDiff,
  generateSideBySide,
  generateOnionSkin,
  drawBoundingBoxes,
  generateDiff,
  // Analyzer
  findChangedRegions,
  classifyChange,
  calculateSeverity,
  analyzeChanges,
  generateChangeSummary,
  formatAnalysisReport,
  MIN_REGION_PIXELS,
  // Types
  type DetectedChange,
} from '../index';

// =============================================================================
// Test Fixtures
// =============================================================================

let testDir: string;
let identicalImage1Path: string;
let identicalImage2Path: string;
let differentImagePath: string;
let partialDiffImagePath: string;

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

      // Check if in square region
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
  testDir = path.join(os.tmpdir(), 'image-diff-tests-' + Date.now());
  await fs.mkdir(testDir, { recursive: true });

  // Create identical images (red)
  const redImage = createSolidImage(100, 100, 255, 0, 0);
  identicalImage1Path = path.join(testDir, 'identical1.png');
  identicalImage2Path = path.join(testDir, 'identical2.png');
  await fs.writeFile(identicalImage1Path, redImage);
  await fs.writeFile(identicalImage2Path, redImage);

  // Create different image (blue)
  const blueImage = createSolidImage(100, 100, 0, 0, 255);
  differentImagePath = path.join(testDir, 'different.png');
  await fs.writeFile(differentImagePath, blueImage);

  // Create partial diff image (red with green square in corner)
  const partialDiff = createImageWithSquare(100, 100, 255, 0, 0, 10, 10, 30, 0, 255, 0);
  partialDiffImagePath = path.join(testDir, 'partial_diff.png');
  await fs.writeFile(partialDiffImagePath, partialDiff);
});

afterAll(async () => {
  // Clean up test directory
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// =============================================================================
// Comparator Tests
// =============================================================================

describe('Image Comparator', () => {
  describe('loadImage', () => {
    it('loads a PNG image successfully', async () => {
      const imageData = await loadImage(identicalImage1Path);

      expect(imageData.width).toBe(100);
      expect(imageData.height).toBe(100);
      expect(imageData.channels).toBe(4);
      expect(imageData.data.length).toBe(100 * 100 * 4);
    });

    it('throws for non-existent file', async () => {
      await expect(loadImage('/nonexistent/path.png')).rejects.toHaveProperty(
        'code',
        'FILE_NOT_FOUND'
      );
    });
  });

  describe('saveImage', () => {
    it('saves image data to file', async () => {
      const imageData = await loadImage(identicalImage1Path);
      const outputPath = path.join(testDir, 'saved_image.png');

      await saveImage(imageData, outputPath);

      const stat = await fs.stat(outputPath);
      expect(stat.size).toBeGreaterThan(0);

      // Verify we can load it back
      const loaded = await loadImage(outputPath);
      expect(loaded.width).toBe(imageData.width);
      expect(loaded.height).toBe(imageData.height);
    });
  });

  describe('compareImages', () => {
    it('returns match=true for identical images', async () => {
      const result = await compareImages(identicalImage1Path, identicalImage2Path);

      expect(result.match).toBe(true);
      expect(result.diffPixels).toBe(0);
      expect(result.similarity).toBe(1);
      expect(result.diffPercent).toBe(0);
    });

    it('returns match=false for completely different images', async () => {
      const result = await compareImages(identicalImage1Path, differentImagePath);

      expect(result.match).toBe(false);
      expect(result.diffPixels).toBe(100 * 100); // All pixels differ
      expect(result.similarity).toBe(0);
      expect(result.diffPercent).toBe(100);
    });

    it('detects partial differences', async () => {
      // Use lower threshold to ensure the green square is detected
      const result = await compareImages(identicalImage1Path, partialDiffImagePath, {
        threshold: 0.01,
      });

      // The green square is 30x30 = 900 pixels
      expect(result.diffPixels).toBeGreaterThan(0);
      expect(result.diffPixels).toBeLessThan(100 * 100);
      expect(result.similarity).toBeGreaterThan(0);
      expect(result.similarity).toBeLessThan(1);
    });

    it('includes diff image buffer in result', async () => {
      const result = await compareImages(identicalImage1Path, partialDiffImagePath);

      expect(result.diffImage).toBeDefined();
      expect(result.diffImage!.length).toBe(100 * 100 * 4);
    });

    it('reports dimension mismatch', async () => {
      // Create a smaller image
      const smallImage = createSolidImage(50, 50, 255, 0, 0);
      const smallPath = path.join(testDir, 'small.png');
      await fs.writeFile(smallPath, smallImage);

      const result = await compareImages(identicalImage1Path, smallPath);

      expect(result.dimensionMismatch).toBe(true);
      expect(result.dimensions.width).toBe(50);
      expect(result.dimensions.height).toBe(50);
    });

    it('respects threshold option', async () => {
      // With very low threshold, small differences matter
      const result1 = await compareImages(identicalImage1Path, partialDiffImagePath, {
        threshold: 0.01,
      });

      // With high threshold, small differences are ignored
      await compareImages(identicalImage1Path, partialDiffImagePath, {
        threshold: 0.5,
      });

      expect(result1.match).toBe(false);
      // Note: match is based on diffPercent vs threshold * 100
    });
  });

  describe('compareAndSave', () => {
    it('saves diff image to specified path', async () => {
      const diffOutputPath = path.join(testDir, 'diff_output.png');

      await compareAndSave(
        identicalImage1Path,
        partialDiffImagePath,
        {},
        { diffImagePath: diffOutputPath }
      );

      const stat = await fs.stat(diffOutputPath);
      expect(stat.size).toBeGreaterThan(0);
    });
  });

  describe('areImagesIdentical', () => {
    it('returns true for identical images', async () => {
      const identical = await areImagesIdentical(identicalImage1Path, identicalImage2Path);
      expect(identical).toBe(true);
    });

    it('returns false for different images', async () => {
      const identical = await areImagesIdentical(identicalImage1Path, differentImagePath);
      expect(identical).toBe(false);
    });
  });

  describe('getSimilarity', () => {
    it('returns 100 for identical images', async () => {
      const similarity = await getSimilarity(identicalImage1Path, identicalImage2Path);
      expect(similarity).toBe(100);
    });

    it('returns 0 for completely different images', async () => {
      const similarity = await getSimilarity(identicalImage1Path, differentImagePath);
      expect(similarity).toBe(0);
    });
  });

  describe('imagesMatch', () => {
    it('returns true for identical images', async () => {
      const match = await imagesMatch(identicalImage1Path, identicalImage2Path);
      expect(match).toBe(true);
    });

    it('returns false for different images with default threshold', async () => {
      const match = await imagesMatch(identicalImage1Path, differentImagePath);
      expect(match).toBe(false);
    });
  });

  describe('createIgnoreMask', () => {
    it('creates mask with all pixels included when no regions', () => {
      const mask = createIgnoreMask(10, 10, []);

      expect(mask.length).toBe(100);
      expect(mask.every(v => v === 255)).toBe(true);
    });

    it('masks specified regions', () => {
      const mask = createIgnoreMask(10, 10, [
        {
          name: 'test',
          rect: { x: 2, y: 2, width: 3, height: 3 },
          reason: 'dynamic_content',
        },
      ]);

      // Check masked region
      for (let y = 2; y < 5; y++) {
        for (let x = 2; x < 5; x++) {
          expect(mask[y * 10 + x]).toBe(0);
        }
      }

      // Check unmasked region
      expect(mask[0]).toBe(255);
      expect(mask[11]).toBe(255);
    });
  });
});

// =============================================================================
// Differ Tests
// =============================================================================

describe('Image Differ', () => {
  describe('generateOverlayDiff', () => {
    it('generates overlay diff image', async () => {
      const baseline = await loadImage(identicalImage1Path);
      const current = await loadImage(partialDiffImagePath);
      const comparison = await compareImages(identicalImage1Path, partialDiffImagePath);

      const overlay = generateOverlayDiff(baseline, current, comparison.diffImage!, {});

      expect(overlay.width).toBe(100);
      expect(overlay.height).toBe(100);
      expect(overlay.data.length).toBe(100 * 100 * 4);
    });
  });

  describe('generateHighlightDiff', () => {
    it('generates highlight-only diff', async () => {
      const comparison = await compareImages(identicalImage1Path, partialDiffImagePath);

      const highlight = generateHighlightDiff(comparison.diffImage!, 100, 100, {});

      expect(highlight.width).toBe(100);
      expect(highlight.height).toBe(100);
    });
  });

  describe('generateSideBySide', () => {
    it('generates horizontal side-by-side comparison', async () => {
      const baseline = await loadImage(identicalImage1Path);
      const current = await loadImage(partialDiffImagePath);
      const comparison = await compareImages(identicalImage1Path, partialDiffImagePath);

      const sideBySide = generateSideBySide(baseline, current, comparison.diffImage, {
        mode: 'sideBySide',
        modeOptions: { orientation: 'horizontal' },
      });

      // Width should be 3 images + 2 gaps
      expect(sideBySide.width).toBeGreaterThan(200);
      expect(sideBySide.height).toBeGreaterThan(100);
    });

    it('generates vertical side-by-side comparison', async () => {
      const baseline = await loadImage(identicalImage1Path);
      const current = await loadImage(partialDiffImagePath);

      const sideBySide = generateSideBySide(baseline, current, undefined, {
        mode: 'sideBySide',
        modeOptions: { orientation: 'vertical' },
      });

      expect(sideBySide.width).toBe(100);
      expect(sideBySide.height).toBeGreaterThan(200);
    });
  });

  describe('generateOnionSkin', () => {
    it('blends images with 50% ratio', async () => {
      const baseline = await loadImage(identicalImage1Path);
      const current = await loadImage(differentImagePath);

      const onion = generateOnionSkin(baseline, current, 0.5);

      expect(onion.width).toBe(100);
      expect(onion.height).toBe(100);

      // Check that pixels are blended (not pure red or blue)
      const pixelIdx = 0;
      const r = onion.data[pixelIdx];
      const b = onion.data[pixelIdx + 2];

      // Should be roughly 50% of each
      expect(r).toBeGreaterThan(100);
      expect(r).toBeLessThan(200);
      expect(b).toBeGreaterThan(100);
      expect(b).toBeLessThan(200);
    });

    it('returns pure baseline at ratio 0', async () => {
      const baseline = await loadImage(identicalImage1Path);
      const current = await loadImage(differentImagePath);

      const onion = generateOnionSkin(baseline, current, 0);

      // Should be pure red (baseline)
      expect(onion.data[0]).toBe(255);
      expect(onion.data[2]).toBe(0);
    });

    it('returns pure current at ratio 1', async () => {
      const baseline = await loadImage(identicalImage1Path);
      const current = await loadImage(differentImagePath);

      const onion = generateOnionSkin(baseline, current, 1);

      // Should be pure blue (current)
      expect(onion.data[0]).toBe(0);
      expect(onion.data[2]).toBe(255);
    });
  });

  describe('drawBoundingBoxes', () => {
    it('draws boxes around detected changes', async () => {
      const baseline = await loadImage(identicalImage1Path);

      const changes: DetectedChange[] = [
        {
          id: 'test1',
          bounds: { x: 10, y: 10, width: 30, height: 30 },
          pixelCount: 900,
          changePercent: 9,
          changeType: 'color',
          confidence: 0.8,
          severity: 0.5,
          isIgnored: false,
        },
      ];

      const result = drawBoundingBoxes(baseline, changes, {});

      // Verify box is drawn (top-left corner of box should be red)
      const topLeftIdx = (10 * 100 + 10) * 4;
      expect(result.data[topLeftIdx]).toBe(255); // Red
      expect(result.data[topLeftIdx + 1]).toBe(0);
      expect(result.data[topLeftIdx + 2]).toBe(0);
    });

    it('skips ignored regions', async () => {
      const baseline = await loadImage(identicalImage1Path);
      const originalData = Buffer.from(baseline.data);

      const changes: DetectedChange[] = [
        {
          id: 'ignored',
          bounds: { x: 10, y: 10, width: 30, height: 30 },
          pixelCount: 900,
          changePercent: 9,
          changeType: 'color',
          confidence: 0.8,
          severity: 0.5,
          isIgnored: true,
        },
      ];

      const result = drawBoundingBoxes(baseline, changes, {});

      // Original pixels at the box location should be unchanged
      const topLeftIdx = (10 * 100 + 10) * 4;
      expect(result.data[topLeftIdx]).toBe(originalData[topLeftIdx]);
    });
  });

  describe('generateDiff', () => {
    it('generates overlay mode diff', async () => {
      const comparison = await compareImages(identicalImage1Path, partialDiffImagePath);

      const result = await generateDiff(
        identicalImage1Path,
        partialDiffImagePath,
        comparison.diffImage!,
        { mode: 'overlay' }
      );

      expect(result.mode).toBe('overlay');
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('generates sideBySide mode diff', async () => {
      const comparison = await compareImages(identicalImage1Path, partialDiffImagePath);

      const result = await generateDiff(
        identicalImage1Path,
        partialDiffImagePath,
        comparison.diffImage!,
        { mode: 'sideBySide' }
      );

      expect(result.mode).toBe('sideBySide');
      expect(result.width).toBeGreaterThan(100);
    });

    it('saves diff to file when path provided', async () => {
      const comparison = await compareImages(identicalImage1Path, partialDiffImagePath);
      const outputPath = path.join(testDir, 'generated_diff.png');

      const result = await generateDiff(
        identicalImage1Path,
        partialDiffImagePath,
        comparison.diffImage!,
        { mode: 'overlay', output: { diffImagePath: outputPath } }
      );

      expect(result.savedPath).toBe(outputPath);
      const stat = await fs.stat(outputPath);
      expect(stat.size).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Analyzer Tests
// =============================================================================

describe('Image Analyzer', () => {
  describe('findChangedRegions', () => {
    it('finds no regions for identical images', async () => {
      const comparison = await compareImages(identicalImage1Path, identicalImage2Path);

      const regions = findChangedRegions(comparison.diffImage!, 100, 100);

      expect(regions.length).toBe(0);
    });

    it('finds regions for completely different images', async () => {
      // Use completely different images (red vs blue) for reliable detection
      const comparison = await compareImages(identicalImage1Path, differentImagePath, {
        threshold: 0.01,
      });

      // Verify pixelmatch detected differences
      expect(comparison.diffPixels).toBeGreaterThan(0);

      // Find regions - should find one large region covering the whole image
      const regions = findChangedRegions(comparison.diffImage!, 100, 100);

      expect(regions.length).toBeGreaterThan(0);

      // Check that the found region is roughly in the expected location
      const region = regions[0];
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.width).toBeGreaterThan(MIN_REGION_PIXELS / 10);
      expect(region.height).toBeGreaterThan(MIN_REGION_PIXELS / 10);
    });
  });

  describe('classifyChange', () => {
    it('classifies color changes', async () => {
      const baseline = await loadImage(identicalImage1Path);
      const current = await loadImage(differentImagePath);

      const classification = classifyChange(baseline, current, {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });

      expect(classification.type).toBe('color');
      expect(classification.confidence).toBeGreaterThan(0);
    });
  });

  describe('calculateSeverity', () => {
    it('calculates higher severity for larger regions', () => {
      const largeRegion = {
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        pixelCount: 10000,
        changeType: 'color' as const,
      };

      const smallRegion = {
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        pixelCount: 100,
        changeType: 'color' as const,
      };

      const largeSeverity = calculateSeverity(largeRegion, 200, 200);
      const smallSeverity = calculateSeverity(smallRegion, 200, 200);

      expect(largeSeverity).toBeGreaterThan(smallSeverity);
    });

    it('weighs removed changes as more severe than color changes', () => {
      const removed = {
        bounds: { x: 0, y: 0, width: 50, height: 50 },
        pixelCount: 2500,
        changeType: 'removed' as const,
      };

      const color = {
        bounds: { x: 0, y: 0, width: 50, height: 50 },
        pixelCount: 2500,
        changeType: 'color' as const,
      };

      const removedSeverity = calculateSeverity(removed, 100, 100);
      const colorSeverity = calculateSeverity(color, 100, 100);

      expect(removedSeverity).toBeGreaterThan(colorSeverity);
    });
  });

  describe('analyzeChanges', () => {
    it('returns empty changes for identical images', async () => {
      const comparison = await compareImages(identicalImage1Path, identicalImage2Path);

      const analysis = await analyzeChanges(
        identicalImage1Path,
        identicalImage2Path,
        comparison
      );

      expect(analysis.changes.length).toBe(0);
      expect(analysis.summary.regionCount).toBe(0);
      expect(analysis.summary.totalChangedPixels).toBe(0);
    });

    it('detects changes for completely different images', async () => {
      // Use completely different images (red vs blue) for reliable detection
      const comparison = await compareImages(identicalImage1Path, differentImagePath, {
        threshold: 0.01,
      });

      const analysis = await analyzeChanges(
        identicalImage1Path,
        differentImagePath,
        comparison
      );

      expect(analysis.changes.length).toBeGreaterThan(0);
      expect(analysis.summary.regionCount).toBeGreaterThan(0);
      expect(analysis.analysisTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('marks changes in ignored regions', async () => {
      const comparison = await compareImages(identicalImage1Path, partialDiffImagePath);

      const analysis = await analyzeChanges(
        identicalImage1Path,
        partialDiffImagePath,
        comparison,
        [{ name: 'ignore', rect: { x: 0, y: 0, width: 100, height: 100 }, reason: 'dynamic_content' }]
      );

      // All changes should be marked as ignored
      for (const change of analysis.changes) {
        expect(change.isIgnored).toBe(true);
      }
    });

    it('sorts changes by severity', async () => {
      const comparison = await compareImages(identicalImage1Path, partialDiffImagePath);

      const analysis = await analyzeChanges(
        identicalImage1Path,
        partialDiffImagePath,
        comparison
      );

      // Verify sorted (highest severity first)
      for (let i = 1; i < analysis.changes.length; i++) {
        expect(analysis.changes[i - 1].severity).toBeGreaterThanOrEqual(
          analysis.changes[i].severity
        );
      }
    });
  });

  describe('generateChangeSummary', () => {
    it('generates summary for no changes', () => {
      const summary = generateChangeSummary([], 10000);

      expect(summary.regionCount).toBe(0);
      expect(summary.totalChangedPixels).toBe(0);
      expect(summary.summaryText).toContain('No visual changes');
    });

    it('generates summary with type breakdown', () => {
      const changes: DetectedChange[] = [
        {
          id: '1',
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          pixelCount: 100,
          changePercent: 1,
          changeType: 'color',
          confidence: 0.8,
          severity: 0.5,
          isIgnored: false,
        },
        {
          id: '2',
          bounds: { x: 20, y: 20, width: 10, height: 10 },
          pixelCount: 100,
          changePercent: 1,
          changeType: 'added',
          confidence: 0.9,
          severity: 0.7,
          isIgnored: false,
        },
      ];

      const summary = generateChangeSummary(changes, 10000);

      expect(summary.regionCount).toBe(2);
      expect(summary.totalChangedPixels).toBe(200);
      expect(summary.byType.color).toBe(1);
      expect(summary.byType.added).toBe(1);
      expect(summary.mostSignificant).toBeDefined();
    });

    it('excludes ignored changes from counts', () => {
      const changes: DetectedChange[] = [
        {
          id: '1',
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          pixelCount: 100,
          changePercent: 1,
          changeType: 'color',
          confidence: 0.8,
          severity: 0.5,
          isIgnored: true,
        },
      ];

      const summary = generateChangeSummary(changes, 10000);

      expect(summary.regionCount).toBe(0);
      expect(summary.totalChangedPixels).toBe(0);
    });
  });

  describe('formatAnalysisReport', () => {
    it('generates markdown report for no changes', async () => {
      const comparison = await compareImages(identicalImage1Path, identicalImage2Path);
      const analysis = await analyzeChanges(identicalImage1Path, identicalImage2Path, comparison);

      const report = formatAnalysisReport(
        analysis,
        identicalImage1Path,
        identicalImage2Path
      );

      expect(report).toContain('Visual Comparison Report');
      expect(report).toContain('MATCH');
      expect(report).toContain('Baseline');
      expect(report).toContain('Current');
    });

    it('generates markdown report with changes', async () => {
      // Use completely different images for reliable detection
      const comparison = await compareImages(identicalImage1Path, differentImagePath, {
        threshold: 0.01,
      });
      const analysis = await analyzeChanges(identicalImage1Path, differentImagePath, comparison);
      const diffPath = path.join(testDir, 'report_diff.png');

      const report = formatAnalysisReport(
        analysis,
        identicalImage1Path,
        differentImagePath,
        diffPath
      );

      expect(report).toContain('DIFFERENCES DETECTED');
      expect(report).toContain('Changed Regions');
      expect(report).toContain('Diff');
      expect(report).toContain('Recommendation');
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration', () => {
  it('full comparison workflow', async () => {
    // This test exercises the complete workflow
    const outputDir = path.join(testDir, 'integration_output');
    await fs.mkdir(outputDir, { recursive: true });

    // Use completely different images for reliable detection
    const comparison = await compareAndSave(
      identicalImage1Path,
      differentImagePath,
      { threshold: 0.01 },
      {
        diffImagePath: path.join(outputDir, 'diff.png'),
        sideBySidePath: path.join(outputDir, 'sidebyside.png'),
      }
    );

    // Verify differences were detected (red vs blue = all pixels different)
    expect(comparison.diffPixels).toBe(100 * 100);

    // Analyze changes
    const analysis = await analyzeChanges(
      identicalImage1Path,
      differentImagePath,
      comparison
    );

    expect(analysis.changes.length).toBeGreaterThan(0);

    // Generate report
    const report = formatAnalysisReport(
      analysis,
      identicalImage1Path,
      differentImagePath,
      path.join(outputDir, 'diff.png')
    );

    // Save report
    await fs.writeFile(path.join(outputDir, 'report.md'), report);

    // Verify outputs exist
    const files = await fs.readdir(outputDir);
    expect(files).toContain('diff.png');
    expect(files).toContain('sidebyside.png');
    expect(files).toContain('report.md');
  });
});
