/**
 * Tests for iOS Regression Slash Command
 *
 * These tests verify the parsing and execution of the /ios.regression command
 * for running comprehensive visual regression tests across all baselines.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  parseRegressionArgs,
  executeRegressionCommand,
  regressionCommandMetadata,
} from '../ios-regression';

// Mock iosTools module
vi.mock('../../ios-tools', () => ({
  // Simulator functions
  getBootedSimulators: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: [
        { udid: 'test-udid-1234', name: 'iPhone 15 Pro', state: 'Booted' },
      ],
    })
  ),
  getSimulator: vi.fn((udid: string) =>
    Promise.resolve({
      success: true,
      data: {
        udid,
        name: 'iPhone 15 Pro',
        runtime: 'iOS 17.5',
        state: 'Booted',
      },
    })
  ),
  captureScreenshot: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        path: '/tmp/screenshot.png',
        size: 12345,
        timestamp: new Date(),
      },
    })
  ),
  // Baseline storage functions
  getBaseline: vi.fn(() =>
    Promise.resolve({
      metadata: {
        name: 'test_baseline',
        createdAt: new Date(),
        updatedAt: new Date(),
        device: {
          name: 'iPhone 15 Pro',
          osVersion: '17.5',
          screenSize: { width: 393, height: 852 },
        },
        bundleId: 'com.example.app',
        ignoreRegions: [],
        tags: ['test'],
      },
      imagePath: '/path/to/baseline.png',
    })
  ),
  listBaselines: vi.fn(() =>
    Promise.resolve([
      {
        name: 'login_screen',
        type: 'screen',
        path: '/baselines/screens/login_screen',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['auth'],
      },
      {
        name: 'home_screen',
        type: 'screen',
        path: '/baselines/screens/home_screen',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'profile_screen',
        type: 'screen',
        path: '/baselines/screens/profile_screen',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
  ),
  listFlows: vi.fn(() =>
    Promise.resolve([
      {
        name: 'checkout_flow',
        path: '/baselines/flows/checkout_flow',
        stepCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'login_flow',
        path: '/baselines/flows/login_flow',
        stepCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
  ),
  getFlowBaselineStorage: vi.fn(() =>
    Promise.resolve({
      name: 'checkout_flow',
      createdAt: new Date(),
      updatedAt: new Date(),
      device: {
        name: 'iPhone 15 Pro',
        osVersion: '17.5',
        screenSize: { width: 393, height: 852 },
      },
      bundleId: 'com.example.app',
      steps: [
        { stepNumber: 1, name: 'cart', capturedAt: new Date() },
        { stepNumber: 2, name: 'shipping', capturedAt: new Date() },
        { stepNumber: 3, name: 'payment', capturedAt: new Date() },
      ],
    })
  ),
  getFlowPath: vi.fn((project: string, flowName: string) =>
    `/baselines/${project}/flows/${flowName}`
  ),
  updateBaseline: vi.fn(() =>
    Promise.resolve({
      name: 'test_baseline',
      createdAt: new Date(),
      updatedAt: new Date(),
      device: {
        name: 'iPhone 15 Pro',
        osVersion: '17.5',
        screenSize: { width: 393, height: 852 },
      },
      bundleId: 'com.example.app',
      ignoreRegions: [],
    })
  ),
  // Image comparison functions
  fullComparison: vi.fn(() =>
    Promise.resolve({
      comparison: {
        match: false,
        similarity: 0.942,
        diffPercent: 5.8,
        diffPixels: 1234,
        totalPixels: 21276,
        comparisonTimeMs: 150,
        dimensions: { width: 393, height: 852 },
        dimensionMismatch: false,
      },
      analysis: {
        changes: [
          {
            id: 'change_1',
            bounds: { x: 100, y: 200, width: 150, height: 50 },
            pixelCount: 800,
            changePercent: 10.7,
            changeType: 'layout',
            confidence: 0.7,
            description: 'Layout change at (100, 200)',
            severity: 0.6,
            isIgnored: false,
          },
        ],
        summary: {
          regionCount: 1,
          totalChangedPixels: 800,
          byType: { layout: 1, color: 0, text: 0, added: 0, removed: 0, unknown: 0 },
          severityDistribution: { low: 0, medium: 1, high: 0 },
          summaryText: 'Changes detected',
        },
        analysisTimeMs: 50,
        ignoredRegions: [],
      },
      report: '## Visual Comparison Report\n\nDifferences detected...',
    })
  ),
  // Constants
  DEFAULT_THRESHOLD: 0.1,
}));

// =============================================================================
// Test Helpers
// =============================================================================

let testDir: string;

/**
 * Create a temporary test directory
 */
function createTestDir(): string {
  const dir = path.join(
    os.tmpdir(),
    `regression-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Clean up test directory
 */
function cleanupTestDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// =============================================================================
// Argument Parsing Tests
// =============================================================================

describe('parseRegressionArgs', () => {
  describe('mode detection', () => {
    it('should default to full mode with no arguments', () => {
      const args = parseRegressionArgs('/ios.regression');
      expect(args.mode).toBe('full');
      expect(args.failFast).toBe(false);
    });

    it('should detect quick mode with --quick', () => {
      const args = parseRegressionArgs('/ios.regression --quick');
      expect(args.mode).toBe('quick');
      expect(args.failFast).toBe(true);
    });

    it('should detect quick mode with -q', () => {
      const args = parseRegressionArgs('/ios.regression -q');
      expect(args.mode).toBe('quick');
      expect(args.failFast).toBe(true);
    });

    it('should detect flows-only mode', () => {
      const args = parseRegressionArgs('/ios.regression --flows-only');
      expect(args.mode).toBe('flows-only');
      expect(args.includeFlows).toBe(true);
    });

    it('should enable flows with --flows flag', () => {
      const args = parseRegressionArgs('/ios.regression --flows');
      expect(args.includeFlows).toBe(true);
      expect(args.mode).toBe('full'); // Mode stays full
    });
  });

  describe('flag parsing', () => {
    it('should parse --project with short form', () => {
      const args = parseRegressionArgs('/ios.regression -p MyProject');
      expect(args.project).toBe('MyProject');
    });

    it('should parse --project with long form', () => {
      const args = parseRegressionArgs('/ios.regression --project MyProject');
      expect(args.project).toBe('MyProject');
    });

    it('should parse --simulator with short form', () => {
      const args = parseRegressionArgs('/ios.regression -s "iPhone 15"');
      expect(args.simulator).toBe('iPhone 15');
    });

    it('should parse --simulator with long form', () => {
      const args = parseRegressionArgs('/ios.regression --simulator "iPhone SE"');
      expect(args.simulator).toBe('iPhone SE');
    });

    it('should parse --threshold with short form', () => {
      const args = parseRegressionArgs('/ios.regression -t 0.05');
      expect(args.threshold).toBe(0.05);
    });

    it('should parse --threshold with long form', () => {
      const args = parseRegressionArgs('/ios.regression --threshold 0.2');
      expect(args.threshold).toBe(0.2);
    });

    it('should parse --output with short form', () => {
      const args = parseRegressionArgs('/ios.regression -o /tmp/report');
      expect(args.outputDir).toBe('/tmp/report');
    });

    it('should parse --output with long form', () => {
      const args = parseRegressionArgs('/ios.regression --output /path/to/output');
      expect(args.outputDir).toBe('/path/to/output');
    });

    it('should parse --update with short form', () => {
      const args = parseRegressionArgs('/ios.regression -u');
      expect(args.update).toBe(true);
    });

    it('should parse --update with long form', () => {
      const args = parseRegressionArgs('/ios.regression --update');
      expect(args.update).toBe(true);
    });

    it('should parse --verbose with short form', () => {
      const args = parseRegressionArgs('/ios.regression -v');
      expect(args.verbose).toBe(true);
    });

    it('should parse --verbose with long form', () => {
      const args = parseRegressionArgs('/ios.regression --verbose');
      expect(args.verbose).toBe(true);
    });

    it('should parse --fail-fast', () => {
      const args = parseRegressionArgs('/ios.regression --fail-fast');
      expect(args.failFast).toBe(true);
    });

    it('should parse --device-family', () => {
      const args = parseRegressionArgs('/ios.regression --device-family iPhone-Pro-Max');
      expect(args.deviceFamily).toBe('iPhone-Pro-Max');
    });
  });

  describe('combined arguments', () => {
    it('should parse multiple flags together', () => {
      const args = parseRegressionArgs(
        '/ios.regression -p MyProject -t 0.05 --update -o /tmp/report --verbose'
      );
      expect(args.project).toBe('MyProject');
      expect(args.threshold).toBe(0.05);
      expect(args.update).toBe(true);
      expect(args.outputDir).toBe('/tmp/report');
      expect(args.verbose).toBe(true);
    });

    it('should parse quick mode with other flags', () => {
      const args = parseRegressionArgs('/ios.regression --quick -p MyProject -v');
      expect(args.mode).toBe('quick');
      expect(args.failFast).toBe(true);
      expect(args.project).toBe('MyProject');
      expect(args.verbose).toBe(true);
    });

    it('should parse flows mode with other flags', () => {
      const args = parseRegressionArgs('/ios.regression --flows -t 0.01 --update');
      expect(args.includeFlows).toBe(true);
      expect(args.threshold).toBe(0.01);
      expect(args.update).toBe(true);
    });
  });

  describe('threshold validation', () => {
    it('should accept threshold 0', () => {
      const args = parseRegressionArgs('/ios.regression -t 0');
      expect(args.threshold).toBe(0);
    });

    it('should accept threshold 1', () => {
      const args = parseRegressionArgs('/ios.regression -t 1');
      expect(args.threshold).toBe(1);
    });

    it('should reject threshold above 1', () => {
      const args = parseRegressionArgs('/ios.regression -t 1.5');
      expect(args.threshold).toBeUndefined();
    });

    it('should reject negative threshold', () => {
      const args = parseRegressionArgs('/ios.regression -t -0.5');
      expect(args.threshold).toBeUndefined();
    });

    it('should reject non-numeric threshold', () => {
      const args = parseRegressionArgs('/ios.regression -t abc');
      expect(args.threshold).toBeUndefined();
    });
  });

  describe('quoted string handling', () => {
    it('should handle double-quoted strings', () => {
      const args = parseRegressionArgs('/ios.regression -s "iPhone 15 Pro Max"');
      expect(args.simulator).toBe('iPhone 15 Pro Max');
    });

    it('should handle single-quoted strings', () => {
      const args = parseRegressionArgs("/ios.regression -s 'iPhone SE (3rd generation)'");
      expect(args.simulator).toBe('iPhone SE (3rd generation)');
    });

    it('should handle quoted output path with spaces', () => {
      const args = parseRegressionArgs('/ios.regression -o "/path/with spaces/output"');
      expect(args.outputDir).toBe('/path/with spaces/output');
    });
  });

  describe('device family validation', () => {
    it('should accept valid device families', () => {
      const validFamilies = [
        'iPhone-SE',
        'iPhone',
        'iPhone-Plus',
        'iPhone-Pro-Max',
        'iPad',
        'iPad-Pro',
      ];
      for (const family of validFamilies) {
        const args = parseRegressionArgs(`/ios.regression --device-family ${family}`);
        expect(args.deviceFamily).toBe(family);
      }
    });

    it('should reject invalid device family', () => {
      const args = parseRegressionArgs('/ios.regression --device-family InvalidFamily');
      expect(args.deviceFamily).toBeUndefined();
    });
  });
});

// =============================================================================
// Command Execution Tests
// =============================================================================

describe('executeRegressionCommand', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe('full regression', () => {
    it('should run full regression successfully', async () => {
      const result = await executeRegressionCommand(
        '/ios.regression',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Visual Regression Report');
      expect(result.output).toContain('Summary');
    });

    it('should show screen baselines results', async () => {
      const result = await executeRegressionCommand(
        '/ios.regression',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Screen Baselines');
      expect(result.output).toContain('login_screen');
      expect(result.output).toContain('home_screen');
    });

    it('should show summary statistics', async () => {
      const result = await executeRegressionCommand(
        '/ios.regression',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Total Tests');
      expect(result.output).toContain('Passed');
      expect(result.output).toContain('Failed');
      expect(result.output).toContain('Pass Rate');
    });

    it('should include duration in output', async () => {
      const result = await executeRegressionCommand(
        '/ios.regression',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Duration');
    });
  });

  describe('quick mode', () => {
    it('should stop on first failure in quick mode', async () => {
      const iosTools = await import('../../ios-tools');
      // First baseline fails
      vi.mocked(iosTools.fullComparison).mockResolvedValueOnce({
        comparison: {
          match: false,
          similarity: 0.5,
          diffPercent: 50,
          diffPixels: 5000,
          totalPixels: 10000,
          comparisonTimeMs: 100,
          dimensions: { width: 393, height: 852 },
          dimensionMismatch: false,
        },
        analysis: {
          changes: [],
          summary: {
            regionCount: 0,
            totalChangedPixels: 5000,
            byType: { layout: 0, color: 0, text: 0, added: 0, removed: 0, unknown: 0 },
            severityDistribution: { low: 0, medium: 0, high: 0 },
            summaryText: 'Failed',
          },
          analysisTimeMs: 50,
          ignoredRegions: [],
        },
        report: 'Failed',
      });

      const result = await executeRegressionCommand(
        '/ios.regression --quick',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      // Should have stopped after first failure
      expect(result.data?.summary.failed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('flows regression', () => {
    it('should include flows when --flows flag is set', async () => {
      const result = await executeRegressionCommand(
        '/ios.regression --flows',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Flow Baselines');
      expect(result.output).toContain('checkout_flow');
    });

    it('should only test flows in flows-only mode', async () => {
      const result = await executeRegressionCommand(
        '/ios.regression --flows-only',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.data?.screenResults.length).toBe(0);
      expect(result.data?.flowResults.length).toBeGreaterThan(0);
    });
  });

  describe('update mode', () => {
    it('should update baselines when --update flag is set', async () => {
      const iosTools = await import('../../ios-tools');

      await executeRegressionCommand('/ios.regression --update', 'test-session', testDir);

      // Should have attempted to update failed baselines
      expect(iosTools.updateBaseline).toHaveBeenCalled();
    });

    it('should not update baselines when all pass', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.fullComparison).mockResolvedValue({
        comparison: {
          match: true,
          similarity: 1.0,
          diffPercent: 0,
          diffPixels: 0,
          totalPixels: 21276,
          comparisonTimeMs: 150,
          dimensions: { width: 393, height: 852 },
          dimensionMismatch: false,
        },
        analysis: {
          changes: [],
          summary: {
            regionCount: 0,
            totalChangedPixels: 0,
            byType: { layout: 0, color: 0, text: 0, added: 0, removed: 0, unknown: 0 },
            severityDistribution: { low: 0, medium: 0, high: 0 },
            summaryText: 'No changes',
          },
          analysisTimeMs: 50,
          ignoredRegions: [],
        },
        report: 'Match',
      });

      await executeRegressionCommand('/ios.regression --update', 'test-session', testDir);

      expect(iosTools.updateBaseline).not.toHaveBeenCalled();
    });
  });

  describe('simulator handling', () => {
    it('should return error when no simulator is booted', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.getBootedSimulators).mockResolvedValueOnce({
        success: true,
        data: [],
      });

      const result = await executeRegressionCommand(
        '/ios.regression',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No booted simulator');
    });

    it('should return error when screenshot fails', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.captureScreenshot).mockResolvedValueOnce({
        success: false,
        error: 'Failed to capture screenshot',
      });

      const result = await executeRegressionCommand(
        '/ios.regression',
        'test-session',
        testDir
      );

      // Should have error in results
      expect(result.data?.screenResults.some((r) => r.error)).toBe(true);
    });
  });

  describe('threshold handling', () => {
    it('should pass custom threshold to comparisons', async () => {
      const iosTools = await import('../../ios-tools');

      await executeRegressionCommand(
        '/ios.regression -t 0.05',
        'test-session',
        testDir
      );

      expect(iosTools.fullComparison).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          compare: expect.objectContaining({
            threshold: 0.05,
          }),
        })
      );
    });

    it('should use default threshold when not specified', async () => {
      const iosTools = await import('../../ios-tools');

      await executeRegressionCommand('/ios.regression', 'test-session', testDir);

      expect(iosTools.fullComparison).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          compare: expect.objectContaining({
            threshold: 0.1,
          }),
        })
      );
    });
  });

  describe('device family filtering', () => {
    it('should filter by device family', async () => {
      const iosTools = await import('../../ios-tools');

      await executeRegressionCommand(
        '/ios.regression --device-family iPhone-Pro-Max',
        'test-session',
        testDir
      );

      expect(iosTools.listBaselines).toHaveBeenCalledWith(
        expect.any(String),
        'iPhone-Pro-Max'
      );
    });
  });

  describe('empty baselines', () => {
    it('should handle project with no baselines', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.listBaselines).mockResolvedValueOnce([]);
      vi.mocked(iosTools.listFlows).mockResolvedValueOnce([]);

      const result = await executeRegressionCommand(
        '/ios.regression --flows',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.data?.summary.total).toBe(0);
    });
  });

  describe('output directory', () => {
    it('should create output directory if specified', async () => {
      const outputDir = path.join(testDir, 'regression-output');

      await executeRegressionCommand(
        `/ios.regression -o "${outputDir}"`,
        'test-session',
        testDir
      );

      expect(fs.existsSync(outputDir)).toBe(true);
    });

    it('should generate HTML report when output specified', async () => {
      const outputDir = path.join(testDir, 'regression-output');

      await executeRegressionCommand(
        `/ios.regression -o "${outputDir}"`,
        'test-session',
        testDir
      );

      const reportPath = path.join(outputDir, 'report.html');
      expect(fs.existsSync(reportPath)).toBe(true);
    });

    it('should include output directory in result', async () => {
      const result = await executeRegressionCommand(
        '/ios.regression',
        'test-session',
        testDir
      );

      expect(result.data?.outputDir).toBeDefined();
    });
  });
});

// =============================================================================
// Metadata Tests
// =============================================================================

describe('regressionCommandMetadata', () => {
  it('should have correct command name', () => {
    expect(regressionCommandMetadata.command).toBe('/ios.regression');
  });

  it('should have description', () => {
    expect(regressionCommandMetadata.description).toBeTruthy();
    expect(regressionCommandMetadata.description.length).toBeGreaterThan(10);
  });

  it('should have usage instructions', () => {
    expect(regressionCommandMetadata.usage).toContain('/ios.regression');
  });

  it('should have options documented', () => {
    expect(regressionCommandMetadata.options.length).toBeGreaterThan(0);

    const optionNames = regressionCommandMetadata.options.map((o) => o.name);
    expect(optionNames).toContain('--quick, -q');
    expect(optionNames).toContain('--flows');
    expect(optionNames).toContain('--project, -p');
    expect(optionNames).toContain('--simulator, -s');
    expect(optionNames).toContain('--threshold, -t');
    expect(optionNames).toContain('--output, -o');
    expect(optionNames).toContain('--update, -u');
    expect(optionNames).toContain('--verbose, -v');
    expect(optionNames).toContain('--fail-fast');
    expect(optionNames).toContain('--device-family');
  });

  it('should have examples', () => {
    expect(regressionCommandMetadata.examples.length).toBeGreaterThan(0);

    for (const example of regressionCommandMetadata.examples) {
      expect(example).toContain('/ios.regression');
    }
  });

  it('should have examples for different modes', () => {
    const examples = regressionCommandMetadata.examples;

    expect(examples.some((e) => e === '/ios.regression')).toBe(true);
    expect(examples.some((e) => e.includes('--quick'))).toBe(true);
    expect(examples.some((e) => e.includes('--flows'))).toBe(true);
    expect(examples.some((e) => e.includes('--verbose'))).toBe(true);
  });
});

// =============================================================================
// Output Format Tests
// =============================================================================

describe('output formatting', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should show PASSED status when all tests pass', async () => {
    const iosTools = await import('../../ios-tools');
    vi.mocked(iosTools.fullComparison).mockResolvedValue({
      comparison: {
        match: true,
        similarity: 1.0,
        diffPercent: 0,
        diffPixels: 0,
        totalPixels: 21276,
        comparisonTimeMs: 150,
        dimensions: { width: 393, height: 852 },
        dimensionMismatch: false,
      },
      analysis: {
        changes: [],
        summary: {
          regionCount: 0,
          totalChangedPixels: 0,
          byType: { layout: 0, color: 0, text: 0, added: 0, removed: 0, unknown: 0 },
          severityDistribution: { low: 0, medium: 0, high: 0 },
          summaryText: 'No changes',
        },
        analysisTimeMs: 50,
        ignoredRegions: [],
      },
      report: 'Match',
    });

    const result = await executeRegressionCommand(
      '/ios.regression',
      'test-session',
      testDir
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('ALL TESTS PASSED');
    expect(result.data?.passed).toBe(true);
  });

  it('should show FAILED status when tests fail', async () => {
    // Set up failing mock
    const iosTools = await import('../../ios-tools');
    vi.mocked(iosTools.fullComparison).mockResolvedValue({
      comparison: {
        match: false,
        similarity: 0.8,
        diffPercent: 20,
        diffPixels: 4255,
        totalPixels: 21276,
        comparisonTimeMs: 150,
        dimensions: { width: 393, height: 852 },
        dimensionMismatch: false,
      },
      analysis: {
        changes: [],
        summary: {
          regionCount: 0,
          totalChangedPixels: 0,
          byType: { layout: 0, color: 0, text: 0, added: 0, removed: 0, unknown: 0 },
          severityDistribution: { low: 0, medium: 0, high: 0 },
          summaryText: 'Failed',
        },
        analysisTimeMs: 50,
        ignoredRegions: [],
      },
      report: 'Failed',
    });

    const result = await executeRegressionCommand(
      '/ios.regression',
      'test-session',
      testDir
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('TESTS FAILED');
    expect(result.data?.passed).toBe(false);
  });

  it('should show simulator info', async () => {
    const result = await executeRegressionCommand(
      '/ios.regression',
      'test-session',
      testDir
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('Simulator');
    expect(result.output).toContain('iPhone 15 Pro');
  });

  it('should show pass rate percentage', async () => {
    const result = await executeRegressionCommand(
      '/ios.regression',
      'test-session',
      testDir
    );

    expect(result.success).toBe(true);
    expect(result.output).toMatch(/\d+(\.\d+)?%/);
  });

  it('should show next steps on failure', async () => {
    // Ensure failures by setting up failing mock
    const iosTools = await import('../../ios-tools');
    vi.mocked(iosTools.fullComparison).mockResolvedValue({
      comparison: {
        match: false,
        similarity: 0.942,
        diffPercent: 5.8,
        diffPixels: 1234,
        totalPixels: 21276,
        comparisonTimeMs: 150,
        dimensions: { width: 393, height: 852 },
        dimensionMismatch: false,
      },
      analysis: {
        changes: [],
        summary: {
          regionCount: 0,
          totalChangedPixels: 0,
          byType: { layout: 0, color: 0, text: 0, added: 0, removed: 0, unknown: 0 },
          severityDistribution: { low: 0, medium: 0, high: 0 },
          summaryText: 'Failed',
        },
        analysisTimeMs: 50,
        ignoredRegions: [],
      },
      report: 'Failed',
    });

    const result = await executeRegressionCommand(
      '/ios.regression',
      'test-session',
      testDir
    );

    expect(result.output).toContain('Next Steps');
  });

  it('should show verbose detail when --verbose flag is set and tests fail', async () => {
    // Use default mock that has matching false - so tests fail
    const iosTools = await import('../../ios-tools');
    vi.mocked(iosTools.fullComparison).mockResolvedValue({
      comparison: {
        match: false,
        similarity: 0.942,
        diffPercent: 5.8,
        diffPixels: 1234,
        totalPixels: 21276,
        comparisonTimeMs: 150,
        dimensions: { width: 393, height: 852 },
        dimensionMismatch: false,
      },
      analysis: {
        changes: [
          {
            id: 'change_1',
            bounds: { x: 100, y: 200, width: 150, height: 50 },
            pixelCount: 800,
            changePercent: 10.7,
            changeType: 'layout',
            confidence: 0.7,
            description: 'Layout change at (100, 200)',
            severity: 0.6,
            isIgnored: false,
          },
        ],
        summary: {
          regionCount: 1,
          totalChangedPixels: 800,
          byType: { layout: 1, color: 0, text: 0, added: 0, removed: 0, unknown: 0 },
          severityDistribution: { low: 0, medium: 1, high: 0 },
          summaryText: 'Failed',
        },
        analysisTimeMs: 50,
        ignoredRegions: [],
      },
      report: 'Failed',
    });

    const result = await executeRegressionCommand(
      '/ios.regression --verbose',
      'test-session',
      testDir
    );

    expect(result.success).toBe(true);
    // Verbose mode shows failed baseline details
    expect(result.output).toContain('Detail');
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('integration tests', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should use directory name as default project', async () => {
    const iosTools = await import('../../ios-tools');

    await executeRegressionCommand(
      '/ios.regression',
      'test-session',
      '/Users/test/MyAppProject'
    );

    expect(iosTools.listBaselines).toHaveBeenCalledWith('MyAppProject', undefined);
  });

  it('should respect explicit project name over path', async () => {
    const iosTools = await import('../../ios-tools');

    await executeRegressionCommand(
      '/ios.regression -p CustomProject',
      'test-session',
      '/Users/test/DifferentPath'
    );

    expect(iosTools.listBaselines).toHaveBeenCalledWith('CustomProject', undefined);
  });

  it('should return proper data structure', async () => {
    const result = await executeRegressionCommand(
      '/ios.regression',
      'test-session',
      testDir
    );

    expect(result.data).toBeDefined();
    expect(result.data?.project).toBeDefined();
    expect(result.data?.timestamp).toBeDefined();
    expect(result.data?.duration).toBeDefined();
    expect(result.data?.passed).toBeDefined();
    expect(result.data?.summary).toBeDefined();
    expect(result.data?.screenResults).toBeDefined();
    expect(result.data?.flowResults).toBeDefined();
    expect(result.data?.threshold).toBeDefined();
    expect(result.data?.simulator).toBeDefined();
  });

  it('should calculate summary correctly', async () => {
    const result = await executeRegressionCommand(
      '/ios.regression',
      'test-session',
      testDir
    );

    expect(result.data?.summary.total).toBe(result.data?.screenResults.length);
    const { passed = 0, failed = 0, skipped = 0, total = 0 } = result.data?.summary ?? {};
    expect(passed + failed + skipped).toBe(total);
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('edge cases', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe('parseRegressionArgs edge cases', () => {
    it('should handle extra whitespace', () => {
      const args = parseRegressionArgs('/ios.regression   --quick  ');
      expect(args.mode).toBe('quick');
    });

    it('should handle multiple mode flags (last wins)', () => {
      const args = parseRegressionArgs('/ios.regression --quick --flows-only');
      expect(args.mode).toBe('flows-only');
    });

    it('should not fail on unknown flags', () => {
      const args = parseRegressionArgs('/ios.regression --unknown-flag');
      expect(args.mode).toBe('full');
    });
  });

  describe('execution edge cases', () => {
    it('should handle comparison error gracefully', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.fullComparison).mockRejectedValueOnce(new Error('Comparison failed'));

      const result = await executeRegressionCommand(
        '/ios.regression',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.data?.screenResults.some((r) => r.error)).toBe(true);
    });

    it('should handle missing baseline gracefully', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.getBaseline).mockResolvedValueOnce(null);

      const result = await executeRegressionCommand(
        '/ios.regression',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.data?.screenResults.some((r) => r.error)).toBe(true);
    });
  });
});

// =============================================================================
// HTML Report Tests
// =============================================================================

describe('HTML report generation', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should generate valid HTML', async () => {
    const outputDir = path.join(testDir, 'report-output');

    await executeRegressionCommand(
      `/ios.regression -o "${outputDir}"`,
      'test-session',
      testDir
    );

    const reportPath = path.join(outputDir, 'report.html');
    const html = fs.readFileSync(reportPath, 'utf-8');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
    expect(html).toContain('Visual Regression Report');
  });

  it('should include project name in HTML', async () => {
    const outputDir = path.join(testDir, 'report-output');

    await executeRegressionCommand(
      `/ios.regression -o "${outputDir}" -p TestProject`,
      'test-session',
      testDir
    );

    const reportPath = path.join(outputDir, 'report.html');
    const html = fs.readFileSync(reportPath, 'utf-8');

    expect(html).toContain('TestProject');
  });

  it('should include status styling in HTML', async () => {
    const outputDir = path.join(testDir, 'report-output');

    await executeRegressionCommand(
      `/ios.regression -o "${outputDir}"`,
      'test-session',
      testDir
    );

    const reportPath = path.join(outputDir, 'report.html');
    const html = fs.readFileSync(reportPath, 'utf-8');

    // Should contain either pass or fail class for status styling
    expect(html.includes('class="pass"') || html.includes('class="fail"')).toBe(true);
  });
});
