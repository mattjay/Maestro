/**
 * Tests for iOS Tools - HTML Regression Report Generator
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  generateHTMLReport,
  generateHTMLFromReport,
  DEFAULT_REPORT_TITLE,
  DEFAULT_THUMBNAIL_WIDTH,
  DEFAULT_THUMBNAIL_HEIGHT,
  type HTMLReportOptions,
  type HTMLReportEntry,
  type HTMLReportResult,
  type ReportSummary,
} from '../regression-report';
import type { RegressionEntry } from '../diff-formatter';
import type { RegressionReport } from '../baselines/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createMockEntry(overrides: Partial<RegressionEntry> = {}): RegressionEntry {
  return {
    name: 'test-baseline',
    comparison: {
      match: true,
      diffPixels: 0,
      totalPixels: 1000000,
      diffPercent: 0,
      similarity: 1.0,
      comparisonTimeMs: 100,
      dimensions: { width: 1000, height: 1000 },
      dimensionMismatch: false,
    },
    paths: {
      baseline: '/path/to/baseline.png',
      current: '/path/to/current.png',
    },
    ...overrides,
  };
}

function createMockAnalysis() {
  return {
    changes: [
      {
        id: 'change-1',
        bounds: { x: 100, y: 100, width: 50, height: 50 },
        pixelCount: 2500,
        changePercent: 0.25,
        changeType: 'color' as const,
        confidence: 0.9,
        severity: 0.5,
        isIgnored: false,
      },
    ],
    summary: {
      regionCount: 1,
      totalChangedPixels: 2500,
      byType: {
        layout: 0,
        color: 1,
        text: 0,
        added: 0,
        removed: 0,
        unknown: 0,
      },
      severityDistribution: {
        low: 0,
        medium: 1,
        high: 0,
      },
      summaryText: '1 change detected',
    },
    analysisTimeMs: 50,
    ignoredRegions: [],
  };
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'regression-report-test-'));
}

function cleanupTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

// =============================================================================
// generateHTMLReport Tests
// =============================================================================

describe('generateHTMLReport', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('basic report generation', () => {
    it('should generate an HTML report file', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries: RegressionEntry[] = [createMockEntry()];

      const result = await generateHTMLReport(entries, { outputPath });

      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should return correct entry count', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [
        createMockEntry({ name: 'baseline-1' }),
        createMockEntry({ name: 'baseline-2' }),
        createMockEntry({ name: 'baseline-3' }),
      ];

      const result = await generateHTMLReport(entries, { outputPath });

      expect(result.entryCount).toBe(3);
    });

    it('should report file size', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      const result = await generateHTMLReport(entries, { outputPath });

      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('should create output directory if it does not exist', async () => {
      const outputPath = path.join(tempDir, 'nested', 'dir', 'report.html');
      const entries = [createMockEntry()];

      const result = await generateHTMLReport(entries, { outputPath });

      expect(result.success).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);
    });
  });

  describe('HTML content', () => {
    it('should include default title', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain(DEFAULT_REPORT_TITLE);
    });

    it('should include custom title', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];
      const customTitle = 'My Custom Report Title';

      await generateHTMLReport(entries, {
        outputPath,
        title: customTitle,
      });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain(customTitle);
    });

    it('should include project name', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];
      const projectName = 'TestProject';

      await generateHTMLReport(entries, {
        outputPath,
        projectName,
      });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain(projectName);
    });

    it('should include device family when provided', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, {
        outputPath,
        deviceFamily: 'iPhone',
      });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('iPhone');
    });

    it('should include baseline names', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [
        createMockEntry({ name: 'login-screen' }),
        createMockEntry({ name: 'home-screen' }),
      ];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('login-screen');
      expect(content).toContain('home-screen');
    });
  });

  describe('summary statistics', () => {
    it('should calculate correct pass count', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [
        createMockEntry({ name: 'passed-1', comparison: { ...createMockEntry().comparison, match: true } }),
        createMockEntry({ name: 'passed-2', comparison: { ...createMockEntry().comparison, match: true } }),
        createMockEntry({ name: 'failed', comparison: { ...createMockEntry().comparison, match: false } }),
      ];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      // Check summary cards
      expect(content).toContain('Passed');
      expect(content).toContain('Failed');
    });

    it('should calculate correct pass rate', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [
        createMockEntry({ comparison: { ...createMockEntry().comparison, match: true } }),
        createMockEntry({ comparison: { ...createMockEntry().comparison, match: false } }),
      ];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('Pass Rate');
      expect(content).toContain('50.0%');
    });

    it('should handle entries with errors', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [
        createMockEntry({ error: 'File not found' }),
        createMockEntry({ comparison: { ...createMockEntry().comparison, match: true } }),
      ];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('Errors');
    });

    it('should handle updated entries', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [
        createMockEntry({ updated: true }),
        createMockEntry({ comparison: { ...createMockEntry().comparison, match: true } }),
      ];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('Updated');
    });
  });

  describe('filter controls', () => {
    it('should include filter buttons', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('filter-btn');
      expect(content).toContain('data-filter="all"');
      expect(content).toContain('data-filter="passed"');
      expect(content).toContain('data-filter="failed"');
    });

    it('should include search input', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('search-input');
      expect(content).toContain('Search baselines');
    });
  });

  describe('thumbnail grid', () => {
    it('should include thumbnail cards for each entry', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [
        createMockEntry({ name: 'entry-1' }),
        createMockEntry({ name: 'entry-2' }),
      ];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('thumbnail-card');
      expect(content).toContain('data-index="0"');
      expect(content).toContain('data-index="1"');
    });

    it('should include status classes on cards', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [
        createMockEntry({ name: 'passed', comparison: { ...createMockEntry().comparison, match: true } }),
        createMockEntry({ name: 'failed', comparison: { ...createMockEntry().comparison, match: false } }),
      ];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('status-passed');
      expect(content).toContain('status-failed');
    });

    it('should display similarity percentage', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [
        createMockEntry({
          comparison: { ...createMockEntry().comparison, similarity: 0.942 },
        }),
      ];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('94.2%');
    });
  });

  describe('comparison modal', () => {
    it('should include modal structure', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('comparison-modal');
      expect(content).toContain('modal-content');
      expect(content).toContain('modal-close');
    });

    it('should include view toggle buttons', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('data-view="side-by-side"');
      expect(content).toContain('data-view="overlay"');
      expect(content).toContain('data-view="diff"');
      expect(content).toContain('data-view="swipe"');
    });

    it('should include zoom controls', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('zoom-controls');
      expect(content).toContain('zoom-in');
      expect(content).toContain('zoom-out');
      expect(content).toContain('zoom-fit');
      expect(content).toContain('zoom-level');
    });
  });

  describe('dark mode', () => {
    it('should include dark mode class when enabled', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, {
        outputPath,
        darkMode: true,
      });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('class="dark"');
    });

    it('should not include dark mode class when disabled', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, {
        outputPath,
        darkMode: false,
      });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).not.toContain('class="dark"');
    });
  });

  describe('custom CSS', () => {
    it('should inject custom CSS', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];
      const customCSS = '.custom-class { color: blue; }';

      await generateHTMLReport(entries, {
        outputPath,
        customCSS,
      });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain(customCSS);
    });
  });

  describe('timestamp', () => {
    it('should include timestamp by default', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should have an ISO timestamp format
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should exclude timestamp when disabled', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, {
        outputPath,
        includeTimestamp: false,
      });
      const content = fs.readFileSync(outputPath, 'utf-8');

      // Should not have timestamp span
      expect(content).not.toContain('class="timestamp"');
    });
  });

  describe('error handling', () => {
    it('should handle invalid output path gracefully', async () => {
      // Try to write to a path that should fail
      const entries = [createMockEntry()];

      const result = await generateHTMLReport(entries, {
        outputPath: '/nonexistent/readonly/path/report.html',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty entries array', async () => {
      const outputPath = path.join(tempDir, 'report.html');

      const result = await generateHTMLReport([], { outputPath });

      expect(result.success).toBe(true);
      expect(result.entryCount).toBe(0);
    });
  });

  describe('threshold display', () => {
    it('should display configured threshold', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, {
        outputPath,
        threshold: 0.05,
      });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('Threshold: 0.05');
    });
  });

  describe('JavaScript interactivity', () => {
    it('should include entries data as JSON', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry({ name: 'test-entry-json' })];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('const entries =');
      expect(content).toContain('test-entry-json');
    });

    it('should include summary data as JSON', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('const summary =');
    });

    it('should include event listeners for filter buttons', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('filter-btn');
      expect(content).toContain('addEventListener');
      expect(content).toContain('filterEntries');
    });

    it('should include keyboard navigation handlers', async () => {
      const outputPath = path.join(tempDir, 'report.html');
      const entries = [createMockEntry()];

      await generateHTMLReport(entries, { outputPath });
      const content = fs.readFileSync(outputPath, 'utf-8');

      expect(content).toContain('keydown');
      expect(content).toContain('Escape');
      expect(content).toContain('ArrowLeft');
      expect(content).toContain('ArrowRight');
    });
  });
});

// =============================================================================
// generateHTMLFromReport Tests
// =============================================================================

describe('generateHTMLFromReport', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should generate report from RegressionReport object', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const report: RegressionReport = {
      timestamp: new Date(),
      project: 'TestProject',
      totalBaselines: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
      results: [
        {
          baseline: '/path/to/baseline1/baseline.png',
          current: '/path/to/current1.png',
          match: true,
          similarity: 1.0,
          diffPixels: 0,
          diffPercent: 0,
          changedRegions: [],
        },
        {
          baseline: '/path/to/baseline2/baseline.png',
          current: '/path/to/current2.png',
          match: false,
          similarity: 0.9,
          diffPixels: 10000,
          diffPercent: 1.0,
          changedRegions: [],
        },
      ],
      passRate: 0.5,
      duration: 1000,
    };

    const result = await generateHTMLFromReport(report, { outputPath });

    expect(result.success).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(true);

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('TestProject');
  });

  it('should use report project name', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const report: RegressionReport = {
      timestamp: new Date(),
      project: 'MyProjectName',
      totalBaselines: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      results: [
        {
          baseline: '/path/to/baseline.png',
          current: '/path/to/current.png',
          match: true,
          similarity: 1.0,
          diffPixels: 0,
          diffPercent: 0,
          changedRegions: [],
        },
      ],
      passRate: 1.0,
      duration: 500,
    };

    await generateHTMLFromReport(report, { outputPath });
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(content).toContain('MyProjectName');
  });

  it('should override project name with option', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const report: RegressionReport = {
      timestamp: new Date(),
      project: 'OriginalProject',
      totalBaselines: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      results: [
        {
          baseline: '/path/to/baseline.png',
          current: '/path/to/current.png',
          match: true,
          similarity: 1.0,
          diffPixels: 0,
          diffPercent: 0,
          changedRegions: [],
        },
      ],
      passRate: 1.0,
      duration: 500,
    };

    await generateHTMLFromReport(report, {
      outputPath,
      projectName: 'OverriddenProject',
    });
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(content).toContain('OverriddenProject');
  });
});

// =============================================================================
// HTML Escaping Tests
// =============================================================================

describe('HTML escaping', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should escape special characters in baseline names', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const entries = [
      createMockEntry({ name: '<script>alert("xss")</script>' }),
    ];

    await generateHTMLReport(entries, { outputPath });
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(content).not.toContain('<script>alert("xss")</script>');
    expect(content).toContain('&lt;script&gt;');
  });

  it('should escape ampersands', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const entries = [createMockEntry({ name: 'test & baseline' })];

    await generateHTMLReport(entries, { outputPath });
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(content).toContain('test &amp; baseline');
  });

  it('should escape quotes', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const entries = [createMockEntry({ name: 'test "quoted" baseline' })];

    await generateHTMLReport(entries, { outputPath });
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(content).toContain('&quot;');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should handle entries with missing analysis', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const entries = [
      createMockEntry({ analysis: undefined }),
    ];

    const result = await generateHTMLReport(entries, { outputPath });

    expect(result.success).toBe(true);
  });

  it('should handle entries with all errors', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const entries = [
      createMockEntry({ error: 'Error 1' }),
      createMockEntry({ error: 'Error 2' }),
    ];

    const result = await generateHTMLReport(entries, { outputPath });
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(result.success).toBe(true);
    expect(content).toContain('Errors');
  });

  it('should handle entries with 100% similarity', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const entries = [
      createMockEntry({
        comparison: {
          ...createMockEntry().comparison,
          similarity: 1.0,
          match: true,
        },
      }),
    ];

    const result = await generateHTMLReport(entries, { outputPath });
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(result.success).toBe(true);
    expect(content).toContain('100.0%');
  });

  it('should handle entries with 0% similarity', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const entries = [
      createMockEntry({
        comparison: {
          ...createMockEntry().comparison,
          similarity: 0,
          match: false,
        },
      }),
    ];

    const result = await generateHTMLReport(entries, { outputPath });
    const content = fs.readFileSync(outputPath, 'utf-8');

    expect(result.success).toBe(true);
    expect(content).toContain('0.0%');
  });

  it('should handle very long baseline names', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const longName = 'a'.repeat(200);
    const entries = [createMockEntry({ name: longName })];

    const result = await generateHTMLReport(entries, { outputPath });

    expect(result.success).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('should handle entries with analysis and changed regions', async () => {
    const outputPath = path.join(tempDir, 'report.html');
    const entries = [
      createMockEntry({ analysis: createMockAnalysis() }),
    ];

    const result = await generateHTMLReport(entries, { outputPath });

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('constants', () => {
  it('should export DEFAULT_THUMBNAIL_WIDTH', () => {
    expect(DEFAULT_THUMBNAIL_WIDTH).toBe(200);
  });

  it('should export DEFAULT_THUMBNAIL_HEIGHT', () => {
    expect(DEFAULT_THUMBNAIL_HEIGHT).toBe(400);
  });

  it('should export DEFAULT_REPORT_TITLE', () => {
    expect(DEFAULT_REPORT_TITLE).toBe('Visual Regression Report');
  });
});
