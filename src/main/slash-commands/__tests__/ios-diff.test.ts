/**
 * Tests for iOS Diff Slash Command
 *
 * These tests verify the parsing and execution of the /ios.diff command
 * including single baseline, flow, and all baselines comparison modes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  parseDiffArgs,
  executeDiffCommand,
  diffCommandMetadata,
  type DiffMode,
} from '../ios-diff';

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
          {
            id: 'change_2',
            bounds: { x: 50, y: 400, width: 100, height: 100 },
            pixelCount: 400,
            changePercent: 4.0,
            changeType: 'color',
            confidence: 0.8,
            description: 'Color change at (50, 400)',
            severity: 0.4,
            isIgnored: false,
          },
        ],
        summary: {
          regionCount: 2,
          totalChangedPixels: 1200,
          byType: { layout: 1, color: 1, text: 0, added: 0, removed: 0, unknown: 0 },
          severityDistribution: { low: 1, medium: 1, high: 0 },
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
    `diff-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

describe('parseDiffArgs', () => {
  describe('mode detection', () => {
    it('should default to single mode with baseline name', () => {
      const args = parseDiffArgs('/ios.diff login_screen');
      expect(args.mode).toBe('single');
      expect(args.baseline).toBe('login_screen');
    });

    it('should detect flow mode with --flow', () => {
      const args = parseDiffArgs('/ios.diff --flow checkout_flow');
      expect(args.mode).toBe('flow');
      expect(args.flowName).toBe('checkout_flow');
    });

    it('should detect flow mode with -f', () => {
      const args = parseDiffArgs('/ios.diff -f checkout_flow');
      expect(args.mode).toBe('flow');
      expect(args.flowName).toBe('checkout_flow');
    });

    it('should detect all mode with --all', () => {
      const args = parseDiffArgs('/ios.diff --all');
      expect(args.mode).toBe('all');
    });

    it('should return single mode with empty args', () => {
      const args = parseDiffArgs('/ios.diff');
      expect(args.mode).toBe('single');
      expect(args.baseline).toBeUndefined();
    });
  });

  describe('flag parsing', () => {
    it('should parse --project with short form', () => {
      const args = parseDiffArgs('/ios.diff login_screen -p MyProject');
      expect(args.project).toBe('MyProject');
    });

    it('should parse --project with long form', () => {
      const args = parseDiffArgs('/ios.diff login_screen --project MyProject');
      expect(args.project).toBe('MyProject');
    });

    it('should parse --simulator with short form', () => {
      const args = parseDiffArgs('/ios.diff login_screen -s "iPhone 15"');
      expect(args.simulator).toBe('iPhone 15');
    });

    it('should parse --simulator with long form', () => {
      const args = parseDiffArgs('/ios.diff login_screen --simulator "iPhone SE"');
      expect(args.simulator).toBe('iPhone SE');
    });

    it('should parse --threshold with short form', () => {
      const args = parseDiffArgs('/ios.diff login_screen -t 0.05');
      expect(args.threshold).toBe(0.05);
    });

    it('should parse --threshold with long form', () => {
      const args = parseDiffArgs('/ios.diff login_screen --threshold 0.2');
      expect(args.threshold).toBe(0.2);
    });

    it('should parse --output with short form', () => {
      const args = parseDiffArgs('/ios.diff login_screen -o /tmp/diffs');
      expect(args.outputDir).toBe('/tmp/diffs');
    });

    it('should parse --output with long form', () => {
      const args = parseDiffArgs('/ios.diff login_screen --output /path/to/output');
      expect(args.outputDir).toBe('/path/to/output');
    });

    it('should parse --update with short form', () => {
      const args = parseDiffArgs('/ios.diff login_screen -u');
      expect(args.update).toBe(true);
    });

    it('should parse --update with long form', () => {
      const args = parseDiffArgs('/ios.diff login_screen --update');
      expect(args.update).toBe(true);
    });

    it('should parse --device-family', () => {
      const args = parseDiffArgs('/ios.diff login_screen --device-family iPhone-Pro-Max');
      expect(args.deviceFamily).toBe('iPhone-Pro-Max');
    });
  });

  describe('combined arguments', () => {
    it('should parse multiple flags together for single mode', () => {
      const args = parseDiffArgs(
        '/ios.diff login_screen -p MyProject -t 0.05 --update -o /tmp/diffs'
      );
      expect(args.mode).toBe('single');
      expect(args.baseline).toBe('login_screen');
      expect(args.project).toBe('MyProject');
      expect(args.threshold).toBe(0.05);
      expect(args.update).toBe(true);
      expect(args.outputDir).toBe('/tmp/diffs');
    });

    it('should parse multiple flags together for all mode', () => {
      const args = parseDiffArgs('/ios.diff --all -p MyProject --update -t 0.01');
      expect(args.mode).toBe('all');
      expect(args.project).toBe('MyProject');
      expect(args.update).toBe(true);
      expect(args.threshold).toBe(0.01);
    });

    it('should parse multiple flags together for flow mode', () => {
      const args = parseDiffArgs(
        '/ios.diff --flow checkout -p MyProject -s "iPhone 15 Pro"'
      );
      expect(args.mode).toBe('flow');
      expect(args.flowName).toBe('checkout');
      expect(args.project).toBe('MyProject');
      expect(args.simulator).toBe('iPhone 15 Pro');
    });
  });

  describe('threshold validation', () => {
    it('should accept threshold 0', () => {
      const args = parseDiffArgs('/ios.diff login_screen -t 0');
      expect(args.threshold).toBe(0);
    });

    it('should accept threshold 1', () => {
      const args = parseDiffArgs('/ios.diff login_screen -t 1');
      expect(args.threshold).toBe(1);
    });

    it('should reject threshold above 1', () => {
      const args = parseDiffArgs('/ios.diff login_screen -t 1.5');
      expect(args.threshold).toBeUndefined();
    });

    it('should reject negative threshold', () => {
      const args = parseDiffArgs('/ios.diff login_screen -t -0.5');
      expect(args.threshold).toBeUndefined();
    });

    it('should reject non-numeric threshold', () => {
      const args = parseDiffArgs('/ios.diff login_screen -t abc');
      expect(args.threshold).toBeUndefined();
    });
  });

  describe('quoted string handling', () => {
    it('should handle double-quoted strings', () => {
      const args = parseDiffArgs('/ios.diff login_screen -s "iPhone 15 Pro Max"');
      expect(args.simulator).toBe('iPhone 15 Pro Max');
    });

    it('should handle single-quoted strings', () => {
      const args = parseDiffArgs("/ios.diff login_screen -s 'iPhone SE (3rd generation)'");
      expect(args.simulator).toBe('iPhone SE (3rd generation)');
    });

    it('should handle quoted output path with spaces', () => {
      const args = parseDiffArgs('/ios.diff login_screen -o "/path/with spaces/output"');
      expect(args.outputDir).toBe('/path/with spaces/output');
    });
  });
});

// =============================================================================
// Command Execution Tests
// =============================================================================

describe('executeDiffCommand', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe('single baseline diff', () => {
    it('should compare a single baseline successfully', async () => {
      const result = await executeDiffCommand(
        '/ios.diff login_screen',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Visual Comparison');
      expect(result.output).toContain('login_screen');
      expect(result.output).toContain('DIFFERENCES DETECTED');
    });

    it('should return error when baseline name is missing', async () => {
      const result = await executeDiffCommand('/ios.diff', 'test-session', testDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Baseline name is required');
    });

    it('should return error when baseline not found', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.getBaseline).mockResolvedValueOnce(null);

      const result = await executeDiffCommand(
        '/ios.diff nonexistent_baseline',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should include similarity percentage in output', async () => {
      const result = await executeDiffCommand(
        '/ios.diff login_screen',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('94.2%'); // From mock
    });

    it('should show changed regions in output', async () => {
      const result = await executeDiffCommand(
        '/ios.diff login_screen',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Changed Regions');
      expect(result.output).toContain('LAYOUT');
      expect(result.output).toContain('COLOR');
    });

    it('should update baseline when --update flag is set', async () => {
      const iosTools = await import('../../ios-tools');

      const result = await executeDiffCommand(
        '/ios.diff login_screen --update',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(iosTools.updateBaseline).toHaveBeenCalled();
      expect(result.output).toContain('Baseline Updated');
    });

    it('should not update baseline when images match', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.fullComparison).mockResolvedValueOnce({
        comparison: {
          match: true,
          similarity: 0.999,
          diffPercent: 0.1,
          diffPixels: 10,
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
        report: '## Visual Comparison Report\n\nNo differences.',
      });

      await executeDiffCommand('/ios.diff login_screen --update', 'test-session', testDir);

      expect(iosTools.updateBaseline).not.toHaveBeenCalled();
    });
  });

  describe('flow diff', () => {
    it('should compare a flow successfully', async () => {
      const result = await executeDiffCommand(
        '/ios.diff --flow checkout_flow',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Flow Comparison');
      expect(result.output).toContain('checkout_flow');
      expect(result.output).toContain('Step Results');
    });

    it('should return error when flow name is missing', async () => {
      const result = await executeDiffCommand('/ios.diff --flow', 'test-session', testDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Flow name is required');
    });

    it('should return error when flow not found', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.getFlowBaselineStorage).mockResolvedValueOnce(null);

      const result = await executeDiffCommand(
        '/ios.diff --flow nonexistent_flow',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should show step count in output', async () => {
      const result = await executeDiffCommand(
        '/ios.diff --flow checkout_flow',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+\/\d+ steps/);
    });
  });

  describe('all baselines diff', () => {
    it('should compare all baselines successfully', async () => {
      const result = await executeDiffCommand('/ios.diff --all', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Visual Regression Check');
      expect(result.output).toContain('Results Summary');
    });

    it('should show empty message when no baselines exist', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.listBaselines).mockResolvedValueOnce([]);

      const result = await executeDiffCommand('/ios.diff --all', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('No baselines found');
    });

    it('should include baseline count in output', async () => {
      const result = await executeDiffCommand('/ios.diff --all', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+\/\d+/); // x/y format for passed/total
    });

    it('should update baselines when --update flag is set', async () => {
      const iosTools = await import('../../ios-tools');

      await executeDiffCommand('/ios.diff --all --update', 'test-session', testDir);

      // Should be called for each baseline that doesn't match
      expect(iosTools.updateBaseline).toHaveBeenCalled();
    });
  });

  describe('simulator handling', () => {
    it('should return error when no simulator is booted', async () => {
      const iosTools = await import('../../ios-tools');
      vi.mocked(iosTools.getBootedSimulators).mockResolvedValueOnce({
        success: true,
        data: [],
      });

      const result = await executeDiffCommand(
        '/ios.diff login_screen',
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

      const result = await executeDiffCommand(
        '/ios.diff login_screen',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to capture screenshot');
    });
  });

  describe('threshold handling', () => {
    it('should pass custom threshold to comparison', async () => {
      const iosTools = await import('../../ios-tools');

      await executeDiffCommand(
        '/ios.diff login_screen -t 0.05',
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

      await executeDiffCommand('/ios.diff login_screen', 'test-session', testDir);

      expect(iosTools.fullComparison).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          compare: expect.objectContaining({
            threshold: 0.1, // DEFAULT_THRESHOLD
          }),
        })
      );
    });
  });
});

// =============================================================================
// Metadata Tests
// =============================================================================

describe('diffCommandMetadata', () => {
  it('should have correct command name', () => {
    expect(diffCommandMetadata.command).toBe('/ios.diff');
  });

  it('should have description', () => {
    expect(diffCommandMetadata.description).toBeTruthy();
    expect(diffCommandMetadata.description.length).toBeGreaterThan(10);
  });

  it('should have usage instructions', () => {
    expect(diffCommandMetadata.usage).toContain('/ios.diff');
  });

  it('should have options documented', () => {
    expect(diffCommandMetadata.options.length).toBeGreaterThan(0);

    // Check for key options
    const optionNames = diffCommandMetadata.options.map((o) => o.name);
    expect(optionNames).toContain('--flow, -f');
    expect(optionNames).toContain('--all');
    expect(optionNames).toContain('--project, -p');
    expect(optionNames).toContain('--simulator, -s');
    expect(optionNames).toContain('--threshold, -t');
    expect(optionNames).toContain('--output, -o');
    expect(optionNames).toContain('--update, -u');
    expect(optionNames).toContain('--device-family');
  });

  it('should have examples', () => {
    expect(diffCommandMetadata.examples.length).toBeGreaterThan(0);

    // Check examples contain the command
    for (const example of diffCommandMetadata.examples) {
      expect(example).toContain('/ios.diff');
    }
  });

  it('should have examples for each mode', () => {
    const examples = diffCommandMetadata.examples;

    // Should have single baseline example
    expect(examples.some((e) => e.match(/\/ios\.diff \w+/))).toBe(true);

    // Should have flow example
    expect(examples.some((e) => e.includes('--flow'))).toBe(true);

    // Should have all example
    expect(examples.some((e) => e.includes('--all'))).toBe(true);
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('edge cases', () => {
  describe('parseDiffArgs edge cases', () => {
    it('should handle extra whitespace', () => {
      const args = parseDiffArgs('/ios.diff   login_screen  ');
      expect(args.baseline).toBe('login_screen');
    });

    it('should handle baseline names with underscores', () => {
      const args = parseDiffArgs('/ios.diff my_test_baseline');
      expect(args.baseline).toBe('my_test_baseline');
    });

    it('should handle baseline names with hyphens', () => {
      const args = parseDiffArgs('/ios.diff my-test-baseline');
      expect(args.baseline).toBe('my-test-baseline');
    });

    it('should handle invalid device family gracefully', () => {
      const args = parseDiffArgs('/ios.diff login_screen --device-family InvalidFamily');
      expect(args.deviceFamily).toBeUndefined();
    });

    it('should not set baseline in all mode', () => {
      const args = parseDiffArgs('/ios.diff --all login_screen');
      expect(args.mode).toBe('all');
      // In all mode, the baseline argument is ignored
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
        const args = parseDiffArgs(`/ios.diff login_screen --device-family ${family}`);
        expect(args.deviceFamily).toBe(family);
      }
    });
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

    await executeDiffCommand('/ios.diff login_screen', 'test-session', '/Users/test/MyAppProject');

    expect(iosTools.getBaseline).toHaveBeenCalledWith(
      'MyAppProject',
      'login_screen',
      undefined
    );
  });

  it('should respect explicit project name over path', async () => {
    const iosTools = await import('../../ios-tools');

    await executeDiffCommand(
      '/ios.diff login_screen -p CustomProject',
      'test-session',
      '/Users/test/DifferentPath'
    );

    expect(iosTools.getBaseline).toHaveBeenCalledWith(
      'CustomProject',
      'login_screen',
      undefined
    );
  });

  it('should pass device family to get baseline', async () => {
    const iosTools = await import('../../ios-tools');

    await executeDiffCommand(
      '/ios.diff login_screen --device-family iPhone-Pro-Max',
      'test-session',
      testDir
    );

    expect(iosTools.getBaseline).toHaveBeenCalledWith(
      expect.any(String),
      'login_screen',
      'iPhone-Pro-Max'
    );
  });

  it('should pass device family to list baselines in all mode', async () => {
    const iosTools = await import('../../ios-tools');

    await executeDiffCommand('/ios.diff --all --device-family iPad', 'test-session', testDir);

    expect(iosTools.listBaselines).toHaveBeenCalledWith(expect.any(String), 'iPad');
  });

  it('should include update indicator in output', async () => {
    const result = await executeDiffCommand(
      '/ios.diff login_screen --update',
      'test-session',
      testDir
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('Updated');
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

  it('should show MATCH status when images are identical', async () => {
    const iosTools = await import('../../ios-tools');
    vi.mocked(iosTools.fullComparison).mockResolvedValueOnce({
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
      report: '## Visual Comparison Report\n\nMatch!',
    });

    const result = await executeDiffCommand(
      '/ios.diff login_screen',
      'test-session',
      testDir
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('MATCH');
  });

  it('should show file paths in output', async () => {
    const result = await executeDiffCommand(
      '/ios.diff login_screen',
      'test-session',
      testDir
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('Baseline');
    expect(result.output).toContain('Current');
    expect(result.output).toContain('Diff');
  });

  it('should show recommendation when differences detected', async () => {
    const result = await executeDiffCommand(
      '/ios.diff login_screen',
      'test-session',
      testDir
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('Recommendation');
    expect(result.output).toContain('/ios.baseline update');
  });

  it('should not show recommendation when images match', async () => {
    const iosTools = await import('../../ios-tools');
    vi.mocked(iosTools.fullComparison).mockResolvedValueOnce({
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
      report: '## Visual Comparison Report\n\nMatch!',
    });

    const result = await executeDiffCommand(
      '/ios.diff login_screen',
      'test-session',
      testDir
    );

    expect(result.success).toBe(true);
    expect(result.output).not.toContain('Recommendation');
  });
});
