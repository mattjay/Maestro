/**
 * Unit tests for iOS Tools - Diff Formatter
 *
 * Tests the agent-consumable output formatting for visual regression comparisons.
 */

import {
  formatDiffForAgent,
  formatRegressionReport,
  formatChange,
  formatChangeSummaryCompact,
  formatDiffAsJson,
  formatSeverity,
  calculateSeverityBreakdown,
  DEFAULT_MAX_REGIONS,
  SEVERITY_THRESHOLDS,
  type DiffFormatOptions,
  type RegressionEntry,
} from '../diff-formatter';
import type {
  ImageCompareResult,
  ImageAnalysisResult,
  DetectedChange,
  ChangeSummary,
} from '../image-diff/types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockCompareResult(overrides: Partial<ImageCompareResult> = {}): ImageCompareResult {
  return {
    match: false,
    diffPixels: 1234,
    totalPixels: 100000,
    diffPercent: 1.234,
    similarity: 0.98766,
    comparisonTimeMs: 150,
    dimensions: { width: 375, height: 812 },
    dimensionMismatch: false,
    ...overrides,
  };
}

function createMockChange(overrides: Partial<DetectedChange> = {}): DetectedChange {
  return {
    id: 'change_1',
    bounds: { x: 100, y: 200, width: 50, height: 30 },
    pixelCount: 500,
    changePercent: 33.3,
    changeType: 'color',
    confidence: 0.8,
    description: 'Color change detected in button area',
    severity: 0.5,
    isIgnored: false,
    ...overrides,
  };
}

function createMockAnalysisResult(
  changes: DetectedChange[] = [],
  overrides: Partial<ImageAnalysisResult> = {}
): ImageAnalysisResult {
  const nonIgnored = changes.filter((c) => !c.isIgnored);

  const byType: Record<string, number> = {
    layout: 0,
    color: 0,
    text: 0,
    added: 0,
    removed: 0,
    unknown: 0,
  };
  for (const change of nonIgnored) {
    byType[change.changeType]++;
  }

  const summary: ChangeSummary = {
    regionCount: nonIgnored.length,
    totalChangedPixels: nonIgnored.reduce((sum, c) => sum + c.pixelCount, 0),
    byType: byType as ChangeSummary['byType'],
    severityDistribution: {
      low: nonIgnored.filter((c) => c.severity < 0.3).length,
      medium: nonIgnored.filter((c) => c.severity >= 0.3 && c.severity < 0.7).length,
      high: nonIgnored.filter((c) => c.severity >= 0.7).length,
    },
    summaryText: `Found ${nonIgnored.length} changed regions.`,
    mostSignificant: nonIgnored[0],
  };

  return {
    changes,
    summary,
    analysisTimeMs: 50,
    ignoredRegions: [],
    ...overrides,
  };
}

function createMockPaths(overrides: Partial<{ baseline: string; current: string; diff?: string }> = {}) {
  return {
    baseline: '/path/to/baseline.png',
    current: '/path/to/current.png',
    diff: '/path/to/diff.png',
    ...overrides,
  };
}

// =============================================================================
// formatDiffForAgent Tests
// =============================================================================

describe('formatDiffForAgent', () => {
  describe('basic formatting', () => {
    it('should format a matching comparison correctly', () => {
      const comparison = createMockCompareResult({ match: true, diffPixels: 0, diffPercent: 0, similarity: 1 });
      const analysis = createMockAnalysisResult([]);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths, { baselineName: 'login_screen' });

      expect(result.markdown).toContain('## Visual Comparison: login_screen');
      expect(result.markdown).toContain('**Status**: ✅ MATCH');
      expect(result.markdown).toContain('**Similarity**: 100.0%');
      expect(result.summary.status).toBe('match');
      expect(result.summary.changedRegions).toBe(0);
    });

    it('should format a non-matching comparison correctly', () => {
      const comparison = createMockCompareResult({ match: false, similarity: 0.942 });
      const changes = [
        createMockChange({ changeType: 'color', severity: 0.5 }),
        createMockChange({ id: 'change_2', changeType: 'layout', severity: 0.8 }),
      ];
      const analysis = createMockAnalysisResult(changes);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths, { baselineName: 'home_screen' });

      expect(result.markdown).toContain('## Visual Comparison: home_screen');
      expect(result.markdown).toContain('**Status**: ❌ DIFFERENCES DETECTED');
      expect(result.markdown).toContain('**Similarity**: 94.2%');
      expect(result.markdown).toContain('### Changed Regions');
      expect(result.summary.status).toBe('differences');
      expect(result.summary.changedRegions).toBe(2);
    });

    it('should include changed pixels information', () => {
      const comparison = createMockCompareResult({ diffPixels: 12345, diffPercent: 5.67 });
      const analysis = createMockAnalysisResult([createMockChange()]);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths);

      expect(result.markdown).toContain('**Changed Pixels**: 12,345 (5.67%)');
    });
  });

  describe('changed regions formatting', () => {
    it('should format change types correctly', () => {
      const comparison = createMockCompareResult();
      const changes = [
        createMockChange({ changeType: 'added', severity: 0.9 }),
        createMockChange({ id: 'c2', changeType: 'removed', severity: 0.85 }),
        createMockChange({ id: 'c3', changeType: 'layout', severity: 0.6 }),
        createMockChange({ id: 'c4', changeType: 'color', severity: 0.4 }),
        createMockChange({ id: 'c5', changeType: 'text', severity: 0.3 }),
      ];
      const analysis = createMockAnalysisResult(changes);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths);

      expect(result.markdown).toContain('**New Element**');
      expect(result.markdown).toContain('**Removed Element**');
      expect(result.markdown).toContain('**Layout Change**');
      expect(result.markdown).toContain('**Color Change**');
      expect(result.markdown).toContain('**Text Change**');
    });

    it('should show severity icons correctly', () => {
      const comparison = createMockCompareResult();
      const changes = [
        createMockChange({ severity: 0.9 }), // high - red
        createMockChange({ id: 'c2', severity: 0.5 }), // medium - yellow
        createMockChange({ id: 'c3', severity: 0.1 }), // low - green
      ];
      const analysis = createMockAnalysisResult(changes);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths);

      expect(result.markdown).toContain('🔴'); // high
      expect(result.markdown).toContain('🟡'); // medium
      expect(result.markdown).toContain('🟢'); // low
    });

    it('should include location and size information', () => {
      const comparison = createMockCompareResult();
      const changes = [
        createMockChange({ bounds: { x: 100, y: 200, width: 50, height: 30 } }),
      ];
      const analysis = createMockAnalysisResult(changes);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths);

      expect(result.markdown).toContain('Location: (100, 200) - (150, 230)');
      expect(result.markdown).toContain('Size: 50x30');
    });

    it('should limit displayed regions to maxRegions', () => {
      const comparison = createMockCompareResult();
      const changes = Array.from({ length: 15 }, (_, i) =>
        createMockChange({ id: `change_${i + 1}` })
      );
      const analysis = createMockAnalysisResult(changes);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths, { maxRegions: 5 });

      // Should show "and X more" message
      expect(result.markdown).toContain('*... and 10 more changed regions*');
    });

    it('should exclude ignored changes from output', () => {
      const comparison = createMockCompareResult();
      const changes = [
        createMockChange({ isIgnored: true, description: 'Ignored change' }),
        createMockChange({ id: 'c2', isIgnored: false, description: 'Visible change' }),
      ];
      const analysis = createMockAnalysisResult(changes);
      const paths = createMockPaths();

      // Verbose mode is needed to show descriptions
      const result = formatDiffForAgent(comparison, analysis, paths, { verbose: true });

      expect(result.summary.changedRegions).toBe(1);
      expect(result.markdown).toContain('Visible change');
      // Ignored changes should not appear
      expect(result.markdown).not.toContain('Ignored change');
    });
  });

  describe('file paths', () => {
    it('should include file paths when includePaths is true', () => {
      const comparison = createMockCompareResult();
      const analysis = createMockAnalysisResult([]);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths, { includePaths: true });

      expect(result.markdown).toContain('### Files');
      expect(result.markdown).toContain('- Baseline: /path/to/baseline.png');
      expect(result.markdown).toContain('- Current: /path/to/current.png');
      expect(result.markdown).toContain('- Diff: /path/to/diff.png');
    });

    it('should exclude file paths when includePaths is false', () => {
      const comparison = createMockCompareResult();
      const analysis = createMockAnalysisResult([]);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths, { includePaths: false });

      expect(result.markdown).not.toContain('### Files');
    });

    it('should handle missing diff path', () => {
      const comparison = createMockCompareResult();
      const analysis = createMockAnalysisResult([]);
      const paths = { baseline: '/path/baseline.png', current: '/path/current.png' };

      const result = formatDiffForAgent(comparison, analysis, paths, { includePaths: true });

      expect(result.markdown).not.toContain('- Diff:');
    });
  });

  describe('recommendations', () => {
    it('should include recommendations for non-matching comparisons', () => {
      const comparison = createMockCompareResult({ match: false });
      const analysis = createMockAnalysisResult([createMockChange()]);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths, {
        baselineName: 'my_screen',
        includeRecommendations: true,
      });

      expect(result.markdown).toContain('### Recommendation');
      expect(result.markdown).toContain('/ios.baseline update my_screen');
    });

    it('should exclude recommendations when disabled', () => {
      const comparison = createMockCompareResult({ match: false });
      const analysis = createMockAnalysisResult([createMockChange()]);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths, {
        includeRecommendations: false,
      });

      expect(result.markdown).not.toContain('### Recommendation');
    });

    it('should not show recommendations for matching comparisons', () => {
      const comparison = createMockCompareResult({ match: true });
      const analysis = createMockAnalysisResult([]);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths, {
        includeRecommendations: true,
      });

      expect(result.markdown).not.toContain('### Recommendation');
    });
  });

  describe('verbose mode', () => {
    it('should include descriptions in verbose mode', () => {
      const comparison = createMockCompareResult();
      const changes = [createMockChange({ description: 'Detailed change description' })];
      const analysis = createMockAnalysisResult(changes);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths, { verbose: true });

      expect(result.markdown).toContain('Detailed change description');
    });

    it('should include type-specific explanations in verbose mode', () => {
      const comparison = createMockCompareResult();
      const changes = [
        createMockChange({ changeType: 'color' }),
        createMockChange({ id: 'c2', changeType: 'added' }),
      ];
      const analysis = createMockAnalysisResult(changes);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths, { verbose: true });

      expect(result.markdown).toContain('Color values differ in this region');
      expect(result.markdown).toContain('New element appeared in this location');
    });
  });

  describe('summary structure', () => {
    it('should return correct severity breakdown', () => {
      const comparison = createMockCompareResult();
      const changes = [
        createMockChange({ severity: 0.9 }), // high
        createMockChange({ id: 'c2', severity: 0.8 }), // high
        createMockChange({ id: 'c3', severity: 0.5 }), // medium
        createMockChange({ id: 'c4', severity: 0.1 }), // low
      ];
      const analysis = createMockAnalysisResult(changes);
      const paths = createMockPaths();

      const result = formatDiffForAgent(comparison, analysis, paths);

      expect(result.summary.severityBreakdown).toEqual({
        high: 2,
        medium: 1,
        low: 1,
      });
    });
  });
});

// =============================================================================
// formatRegressionReport Tests
// =============================================================================

describe('formatRegressionReport', () => {
  function createMockEntry(overrides: Partial<RegressionEntry> = {}): RegressionEntry {
    return {
      name: 'test_baseline',
      comparison: createMockCompareResult(),
      analysis: createMockAnalysisResult([createMockChange()]),
      paths: createMockPaths(),
      ...overrides,
    };
  }

  describe('basic formatting', () => {
    it('should format a passing regression report', () => {
      const entries = [
        createMockEntry({ name: 'screen_1', comparison: createMockCompareResult({ match: true }) }),
        createMockEntry({ name: 'screen_2', comparison: createMockCompareResult({ match: true }) }),
      ];

      const result = formatRegressionReport(entries, { projectName: 'MyApp' });

      expect(result.markdown).toContain('## Visual Regression Report: MyApp');
      expect(result.markdown).toContain('✅ ALL TESTS PASSED');
      expect(result.summary.status).toBe('passed');
    });

    it('should format a failing regression report', () => {
      const entries = [
        createMockEntry({ name: 'screen_1', comparison: createMockCompareResult({ match: true }) }),
        createMockEntry({ name: 'screen_2', comparison: createMockCompareResult({ match: false }) }),
      ];

      const result = formatRegressionReport(entries, { projectName: 'MyApp' });

      expect(result.markdown).toContain('❌ TESTS FAILED');
      expect(result.summary.status).toBe('failed');
      expect(result.summary.differencesFound).toBe(1);
    });
  });

  describe('summary statistics', () => {
    it('should include correct summary statistics', () => {
      const entries = [
        createMockEntry({ name: 's1', comparison: createMockCompareResult({ match: true }) }),
        createMockEntry({ name: 's2', comparison: createMockCompareResult({ match: true }) }),
        createMockEntry({ name: 's3', comparison: createMockCompareResult({ match: false }) }),
        createMockEntry({ name: 's4', comparison: createMockCompareResult({ match: false }), updated: true }),
        createMockEntry({ name: 's5', error: 'Failed to load baseline' }),
      ];

      const result = formatRegressionReport(entries);

      expect(result.markdown).toContain('| Total Baselines | 5 |');
      expect(result.markdown).toContain('| Passed | 2 |');
      expect(result.markdown).toContain('| Failed | 2 |');
      expect(result.markdown).toContain('| Errors | 1 |');
      expect(result.markdown).toContain('| Updated | 1 |');
      expect(result.markdown).toContain('| Pass Rate | 40.0% |');
    });

    it('should include threshold in summary', () => {
      const entries = [createMockEntry()];

      const result = formatRegressionReport(entries, { threshold: 0.05 });

      expect(result.markdown).toContain('| Threshold | 0.05 |');
    });

    it('should include device family filter', () => {
      const entries = [createMockEntry()];

      const result = formatRegressionReport(entries, {
        projectName: 'Test',
        deviceFamily: 'iPhone-Pro-Max',
      });

      expect(result.markdown).toContain('## Visual Regression Report: Test (iPhone-Pro-Max)');
    });
  });

  describe('results table', () => {
    it('should include results table with correct columns', () => {
      const entries = [
        createMockEntry({
          name: 'login_screen',
          comparison: createMockCompareResult({ match: true, similarity: 1 }),
        }),
        createMockEntry({
          name: 'home_screen',
          comparison: createMockCompareResult({ match: false, similarity: 0.95 }),
        }),
      ];

      const result = formatRegressionReport(entries);

      expect(result.markdown).toContain('| Baseline | Status | Similarity | Diff % | Regions |');
      expect(result.markdown).toContain('| login_screen | ✅ |');
      expect(result.markdown).toContain('| home_screen | ❌ |');
    });

    it('should mark updated baselines with ⚡', () => {
      const entries = [
        createMockEntry({ name: 'updated_screen', updated: true }),
      ];

      const result = formatRegressionReport(entries);

      // The formatter adds a space before ⚡
      expect(result.markdown).toContain('| updated_screen ⚡ |');
    });

    it('should mark error entries with ⚠️', () => {
      const entries = [
        createMockEntry({ name: 'error_screen', error: 'Some error' }),
      ];

      const result = formatRegressionReport(entries);

      expect(result.markdown).toContain('| error_screen | ⚠️ |');
    });
  });

  describe('failed baselines detail', () => {
    it('should include detailed failure information when enabled', () => {
      const changes = [
        createMockChange({ changeType: 'color', severity: 0.8 }),
        createMockChange({ id: 'c2', changeType: 'layout', severity: 0.5 }),
      ];
      const entries = [
        createMockEntry({
          name: 'failed_screen',
          comparison: createMockCompareResult({ match: false, similarity: 0.92, diffPixels: 5000 }),
          analysis: createMockAnalysisResult(changes),
          paths: createMockPaths({ diff: '/path/to/failed_diff.png' }),
        }),
      ];

      const result = formatRegressionReport(entries, { includeDetails: true });

      expect(result.markdown).toContain('### Failed Baselines');
      expect(result.markdown).toContain('#### failed_screen');
      expect(result.markdown).toContain('**Similarity**: 92.0%');
      expect(result.markdown).toContain('**Changed Pixels**: 5,000');
      expect(result.markdown).toContain('**Changed Regions**: 2');
      expect(result.markdown).toContain('**Top Changes**:');
      expect(result.markdown).toContain('/path/to/failed_diff.png');
    });

    it('should limit detailed failures to maxDetailedFailures', () => {
      const entries = Array.from({ length: 10 }, (_, i) =>
        createMockEntry({
          name: `failed_screen_${i}`,
          comparison: createMockCompareResult({ match: false }),
        })
      );

      const result = formatRegressionReport(entries, {
        includeDetails: true,
        maxDetailedFailures: 3,
      });

      expect(result.markdown).toContain('#### failed_screen_0');
      expect(result.markdown).toContain('#### failed_screen_1');
      expect(result.markdown).toContain('#### failed_screen_2');
      expect(result.markdown).not.toContain('#### failed_screen_3');
      expect(result.markdown).toContain('*... and 7 more failed baselines*');
    });

    it('should exclude details when disabled', () => {
      const entries = [
        createMockEntry({
          name: 'failed_screen',
          comparison: createMockCompareResult({ match: false }),
        }),
      ];

      const result = formatRegressionReport(entries, { includeDetails: false });

      expect(result.markdown).not.toContain('### Failed Baselines');
    });
  });

  describe('error entries', () => {
    it('should include error section when there are errors', () => {
      const entries = [
        createMockEntry({ name: 'error_1', error: 'Baseline not found' }),
        createMockEntry({ name: 'error_2', error: 'Failed to capture screenshot' }),
      ];

      const result = formatRegressionReport(entries, { includeDetails: true });

      expect(result.markdown).toContain('### Errors');
      expect(result.markdown).toContain('**error_1**: Baseline not found');
      expect(result.markdown).toContain('**error_2**: Failed to capture screenshot');
    });
  });

  describe('recommendations', () => {
    it('should include recommendations when there are failures', () => {
      const entries = [
        createMockEntry({ comparison: createMockCompareResult({ match: false }) }),
      ];

      const result = formatRegressionReport(entries);

      expect(result.markdown).toContain('### Recommendations');
      expect(result.markdown).toContain('`/ios.baseline update <name>`');
      expect(result.markdown).toContain('`/ios.regression --update`');
    });

    it('should not include recommendations when all pass', () => {
      const entries = [
        createMockEntry({ comparison: createMockCompareResult({ match: true }) }),
      ];

      const result = formatRegressionReport(entries);

      expect(result.markdown).not.toContain('### Recommendations');
    });
  });

  describe('summary structure', () => {
    it('should return correct summary status', () => {
      const passingEntries = [
        createMockEntry({ comparison: createMockCompareResult({ match: true }) }),
      ];
      expect(formatRegressionReport(passingEntries).summary.status).toBe('passed');

      const failingEntries = [
        createMockEntry({ comparison: createMockCompareResult({ match: false }) }),
      ];
      expect(formatRegressionReport(failingEntries).summary.status).toBe('failed');

      const errorOnlyEntries = [
        createMockEntry({ comparison: createMockCompareResult({ match: true }), error: 'error' }),
      ];
      expect(formatRegressionReport(errorOnlyEntries).summary.status).toBe('partial');
    });

    it('should return correct averageSimilarity', () => {
      const entries = [
        createMockEntry({ comparison: createMockCompareResult({ similarity: 1.0 }) }),
        createMockEntry({ comparison: createMockCompareResult({ similarity: 0.9 }) }),
        createMockEntry({ comparison: createMockCompareResult({ similarity: 0.8 }) }),
      ];

      const result = formatRegressionReport(entries);

      expect(result.summary.averageSimilarity).toBeCloseTo(0.9, 2);
    });

    it('should return recommendations based on status', () => {
      const entries = [
        createMockEntry({
          comparison: createMockCompareResult({ match: false }),
        }),
        createMockEntry({
          error: 'Some error',
        }),
      ];

      const result = formatRegressionReport(entries);

      expect(result.summary.recommendations).toContain(
        'Update 1 baselines if changes are intentional'
      );
      expect(result.summary.recommendations).toContain('Fix 1 comparison errors');
    });
  });
});

// =============================================================================
// formatChange Tests
// =============================================================================

describe('formatChange', () => {
  it('should format a single change correctly', () => {
    const change = createMockChange({
      changeType: 'color',
      bounds: { x: 100, y: 200, width: 50, height: 30 },
      pixelCount: 1500,
      severity: 0.6,
      description: 'Button color changed',
    });

    const result = formatChange(change, 1);

    expect(result).toContain('1. **Color Change** 🟡');
    expect(result).toContain('Location: (100, 200) - (150, 230)');
    expect(result).toContain('Size: 50x30');
    expect(result).toContain('Pixels: 1,500');
    expect(result).toContain('Button color changed');
  });

  it('should use correct severity icons', () => {
    const highSeverity = createMockChange({ severity: 0.9 });
    const medSeverity = createMockChange({ severity: 0.5 });
    const lowSeverity = createMockChange({ severity: 0.2 });

    expect(formatChange(highSeverity, 1)).toContain('🔴');
    expect(formatChange(medSeverity, 1)).toContain('🟡');
    expect(formatChange(lowSeverity, 1)).toContain('🟢');
  });

  it('should format different change types correctly', () => {
    const types: Array<{ type: string; expected: string }> = [
      { type: 'added', expected: 'New Element' },
      { type: 'removed', expected: 'Removed Element' },
      { type: 'layout', expected: 'Layout Change' },
      { type: 'color', expected: 'Color Change' },
      { type: 'text', expected: 'Text Change' },
      { type: 'unknown', expected: 'Visual Change' },
    ];

    for (const { type, expected } of types) {
      const change = createMockChange({ changeType: type as any });
      expect(formatChange(change, 1)).toContain(`**${expected}**`);
    }
  });
});

// =============================================================================
// formatChangeSummaryCompact Tests
// =============================================================================

describe('formatChangeSummaryCompact', () => {
  it('should return "No visual changes detected" for empty summary', () => {
    const summary: ChangeSummary = {
      regionCount: 0,
      totalChangedPixels: 0,
      byType: { layout: 0, color: 0, text: 0, added: 0, removed: 0, unknown: 0 },
      severityDistribution: { low: 0, medium: 0, high: 0 },
      summaryText: '',
    };

    expect(formatChangeSummaryCompact(summary)).toBe('No visual changes detected.');
  });

  it('should format single change correctly', () => {
    const summary: ChangeSummary = {
      regionCount: 1,
      totalChangedPixels: 500,
      byType: { layout: 0, color: 1, text: 0, added: 0, removed: 0, unknown: 0 },
      severityDistribution: { low: 0, medium: 1, high: 0 },
      summaryText: '',
    };

    const result = formatChangeSummaryCompact(summary);

    expect(result).toContain('1 change');
    expect(result).toContain('1 color');
    expect(result).toContain('affecting 500 pixels');
  });

  it('should format multiple changes correctly', () => {
    const summary: ChangeSummary = {
      regionCount: 5,
      totalChangedPixels: 12345,
      byType: { layout: 1, color: 2, text: 0, added: 1, removed: 1, unknown: 0 },
      severityDistribution: { low: 2, medium: 2, high: 1 },
      summaryText: '',
    };

    const result = formatChangeSummaryCompact(summary);

    expect(result).toContain('5 changes');
    expect(result).toContain('1 added');
    expect(result).toContain('1 removed');
    expect(result).toContain('1 layout');
    expect(result).toContain('2 color');
    expect(result).toContain('affecting 12,345 pixels');
  });
});

// =============================================================================
// formatDiffAsJson Tests
// =============================================================================

describe('formatDiffAsJson', () => {
  it('should return valid JSON', () => {
    const comparison = createMockCompareResult();
    const analysis = createMockAnalysisResult([createMockChange()]);
    const paths = createMockPaths();

    const result = formatDiffAsJson(comparison, analysis, paths);

    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should include all expected fields', () => {
    const comparison = createMockCompareResult({ match: false, similarity: 0.95, diffPercent: 5, diffPixels: 1000 });
    const changes = [createMockChange({ changeType: 'color', severity: 0.5 })];
    const analysis = createMockAnalysisResult(changes);
    const paths = createMockPaths();

    const result = JSON.parse(formatDiffAsJson(comparison, analysis, paths));

    expect(result.status).toBe('differences');
    expect(result.similarity).toBe(0.95);
    expect(result.diffPercent).toBe(5);
    expect(result.diffPixels).toBe(1000);
    expect(result.changedRegions).toBe(1);
    expect(result.severityBreakdown).toEqual({ high: 0, medium: 1, low: 0 });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].type).toBe('color');
    expect(result.paths).toEqual(paths);
  });

  it('should exclude ignored changes', () => {
    const comparison = createMockCompareResult();
    const changes = [
      createMockChange({ isIgnored: true }),
      createMockChange({ id: 'c2', isIgnored: false }),
    ];
    const analysis = createMockAnalysisResult(changes);
    const paths = createMockPaths();

    const result = JSON.parse(formatDiffAsJson(comparison, analysis, paths));

    expect(result.changedRegions).toBe(1);
    expect(result.changes).toHaveLength(1);
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('formatSeverity', () => {
  it('should return "high" for severity >= 0.7', () => {
    expect(formatSeverity(0.7)).toBe('high');
    expect(formatSeverity(0.9)).toBe('high');
    expect(formatSeverity(1.0)).toBe('high');
  });

  it('should return "medium" for severity >= 0.3 and < 0.7', () => {
    expect(formatSeverity(0.3)).toBe('medium');
    expect(formatSeverity(0.5)).toBe('medium');
    expect(formatSeverity(0.69)).toBe('medium');
  });

  it('should return "low" for severity < 0.3', () => {
    expect(formatSeverity(0.0)).toBe('low');
    expect(formatSeverity(0.1)).toBe('low');
    expect(formatSeverity(0.29)).toBe('low');
  });
});

describe('calculateSeverityBreakdown', () => {
  it('should calculate correct breakdown', () => {
    const changes = [
      createMockChange({ severity: 0.9 }), // high
      createMockChange({ id: 'c2', severity: 0.8 }), // high
      createMockChange({ id: 'c3', severity: 0.5 }), // medium
      createMockChange({ id: 'c4', severity: 0.4 }), // medium
      createMockChange({ id: 'c5', severity: 0.1 }), // low
    ];

    const result = calculateSeverityBreakdown(changes);

    expect(result).toEqual({
      high: 2,
      medium: 2,
      low: 1,
    });
  });

  it('should return zeros for empty array', () => {
    const result = calculateSeverityBreakdown([]);

    expect(result).toEqual({
      high: 0,
      medium: 0,
      low: 0,
    });
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('constants', () => {
  it('should have correct DEFAULT_MAX_REGIONS', () => {
    expect(DEFAULT_MAX_REGIONS).toBe(10);
  });

  it('should have correct SEVERITY_THRESHOLDS', () => {
    expect(SEVERITY_THRESHOLDS.HIGH).toBe(0.7);
    expect(SEVERITY_THRESHOLDS.MEDIUM).toBe(0.3);
  });
});
