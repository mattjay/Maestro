/**
 * iOS Tools - HTML Regression Report Generator
 *
 * Generates interactive HTML reports for visual regression test results.
 * Features:
 * - Summary statistics dashboard
 * - Thumbnail grid of all comparisons
 * - Side-by-side comparison viewer
 * - Diff overlay toggle
 * - Filter by status (passed/failed/skipped)
 * - Zoom and pan controls
 */

import * as fs from 'fs';
import * as path from 'path';
import type { RegressionEntry, FormattedRegressionReport } from './diff-formatter';
import type {
  RegressionReport,
  RegressionSummary,
  BaselineMetadata,
  DeviceFamily,
} from './baselines/types';
import type { ImageCompareResult, ImageAnalysisResult } from './image-diff/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for HTML report generation.
 */
export interface HTMLReportOptions {
  /** Output file path for the HTML report */
  outputPath: string;
  /** Report title */
  title?: string;
  /** Project name */
  projectName?: string;
  /** Device family filter applied */
  deviceFamily?: DeviceFamily;
  /** Comparison threshold used */
  threshold?: number;
  /** Whether to embed images as base64 (larger file but self-contained) */
  embedImages?: boolean;
  /** Base path for relative image paths (when embedImages is false) */
  imageBasePath?: string;
  /** Include timestamp in report */
  includeTimestamp?: boolean;
  /** Custom CSS to inject */
  customCSS?: string;
  /** Generate dark mode compatible report */
  darkMode?: boolean;
}

/**
 * Single comparison entry for HTML report.
 */
export interface HTMLReportEntry {
  /** Baseline name */
  name: string;
  /** Pass/fail status */
  status: 'passed' | 'failed' | 'error' | 'skipped' | 'updated';
  /** Similarity percentage (0-100) */
  similarity: number;
  /** Diff percentage */
  diffPercent: number;
  /** Number of changed regions */
  changedRegions: number;
  /** File paths */
  paths: {
    baseline: string;
    current: string;
    diff?: string;
  };
  /** Baseline metadata */
  metadata?: BaselineMetadata;
  /** Error message if status is 'error' */
  error?: string;
  /** Whether baseline was updated */
  updated?: boolean;
  /** Thumbnail data (base64 or path) */
  thumbnails?: {
    baseline?: string;
    current?: string;
    diff?: string;
  };
}

/**
 * Result of HTML report generation.
 */
export interface HTMLReportResult {
  /** Path to the generated report */
  outputPath: string;
  /** Report generation success */
  success: boolean;
  /** File size in bytes */
  fileSize: number;
  /** Number of comparisons included */
  entryCount: number;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Summary statistics for the report.
 */
export interface ReportSummary {
  /** Total baselines compared */
  total: number;
  /** Number passed */
  passed: number;
  /** Number failed */
  failed: number;
  /** Number with errors */
  errors: number;
  /** Number skipped */
  skipped: number;
  /** Number updated */
  updated: number;
  /** Pass rate (0-100) */
  passRate: number;
  /** Average similarity */
  averageSimilarity: number;
  /** Report generation timestamp */
  timestamp: Date;
  /** Duration in milliseconds */
  duration?: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default thumbnail dimensions.
 */
export const DEFAULT_THUMBNAIL_WIDTH = 200;
export const DEFAULT_THUMBNAIL_HEIGHT = 400;

/**
 * Default report title.
 */
export const DEFAULT_REPORT_TITLE = 'Visual Regression Report';

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Generate an HTML regression report from comparison entries.
 *
 * Creates an interactive HTML report with:
 * - Summary statistics dashboard
 * - Thumbnail grid of all comparisons
 * - Side-by-side comparison viewer
 * - Diff overlay toggle
 * - Filter by status
 * - Zoom and pan controls
 *
 * @param entries - Regression comparison entries
 * @param options - Report generation options
 * @returns Result of report generation
 *
 * @example
 * ```typescript
 * const result = await generateHTMLReport(entries, {
 *   outputPath: './report.html',
 *   projectName: 'my-app',
 *   embedImages: true,
 * });
 * console.log(`Report saved to: ${result.outputPath}`);
 * ```
 */
export async function generateHTMLReport(
  entries: RegressionEntry[],
  options: HTMLReportOptions
): Promise<HTMLReportResult> {
  const {
    outputPath,
    title = DEFAULT_REPORT_TITLE,
    projectName = 'Visual Regression',
    deviceFamily,
    threshold = 0.1,
    embedImages = false,
    imageBasePath,
    includeTimestamp = true,
    customCSS,
    darkMode = false,
  } = options;

  try {
    // Convert entries to HTML report format
    const reportEntries = await convertEntries(entries, {
      embedImages,
      imageBasePath,
    });

    // Calculate summary statistics
    const summary = calculateSummary(reportEntries);

    // Generate HTML content
    const htmlContent = generateHTMLContent({
      title,
      projectName,
      deviceFamily,
      threshold,
      summary,
      entries: reportEntries,
      includeTimestamp,
      customCSS,
      darkMode,
    });

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write the HTML file
    fs.writeFileSync(outputPath, htmlContent, 'utf-8');

    // Get file size
    const stats = fs.statSync(outputPath);

    return {
      outputPath,
      success: true,
      fileSize: stats.size,
      entryCount: entries.length,
    };
  } catch (error) {
    return {
      outputPath,
      success: false,
      fileSize: 0,
      entryCount: entries.length,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate HTML report from a RegressionReport object.
 *
 * @param report - Regression report data
 * @param options - Report options
 * @returns Result of report generation
 */
export async function generateHTMLFromReport(
  report: RegressionReport,
  options: HTMLReportOptions
): Promise<HTMLReportResult> {
  // Convert RegressionReport to RegressionEntry format
  const entries: RegressionEntry[] = report.results.map((result) => ({
    name: extractBaselineName(result.baseline),
    comparison: {
      match: result.match,
      diffPixels: result.diffPixels,
      totalPixels: 0,
      diffPercent: result.diffPercent,
      similarity: result.similarity,
      comparisonTimeMs: result.comparisonTime || 0,
      dimensions: { width: 0, height: 0 },
      dimensionMismatch: false,
    },
    paths: {
      baseline: result.baseline,
      current: result.current,
      diff: result.diff,
    },
    metadata: result.baselineMetadata,
  }));

  return generateHTMLReport(entries, {
    ...options,
    projectName: options.projectName || report.project,
  });
}

// =============================================================================
// Entry Conversion
// =============================================================================

/**
 * Convert RegressionEntry array to HTMLReportEntry array.
 */
async function convertEntries(
  entries: RegressionEntry[],
  options: {
    embedImages?: boolean;
    imageBasePath?: string;
  }
): Promise<HTMLReportEntry[]> {
  const { embedImages = false, imageBasePath } = options;

  const reportEntries: HTMLReportEntry[] = [];

  for (const entry of entries) {
    const status = determineStatus(entry);
    const thumbnails = embedImages
      ? await loadThumbnailsAsBase64(entry.paths)
      : computeRelativePaths(entry.paths, imageBasePath);

    reportEntries.push({
      name: entry.name,
      status,
      similarity: entry.comparison.similarity * 100,
      diffPercent: entry.comparison.diffPercent,
      changedRegions: entry.analysis
        ? entry.analysis.changes.filter((c) => !c.isIgnored).length
        : 0,
      paths: entry.paths,
      metadata: entry.metadata,
      error: entry.error,
      updated: entry.updated,
      thumbnails,
    });
  }

  return reportEntries;
}

/**
 * Determine entry status.
 */
function determineStatus(
  entry: RegressionEntry
): 'passed' | 'failed' | 'error' | 'skipped' | 'updated' {
  if (entry.error) return 'error';
  if (entry.updated) return 'updated';
  return entry.comparison.match ? 'passed' : 'failed';
}

/**
 * Load images as base64 for embedding.
 */
async function loadThumbnailsAsBase64(paths: {
  baseline: string;
  current: string;
  diff?: string;
}): Promise<HTMLReportEntry['thumbnails']> {
  const thumbnails: HTMLReportEntry['thumbnails'] = {};

  if (fs.existsSync(paths.baseline)) {
    const data = fs.readFileSync(paths.baseline);
    thumbnails.baseline = `data:image/png;base64,${data.toString('base64')}`;
  }

  if (fs.existsSync(paths.current)) {
    const data = fs.readFileSync(paths.current);
    thumbnails.current = `data:image/png;base64,${data.toString('base64')}`;
  }

  if (paths.diff && fs.existsSync(paths.diff)) {
    const data = fs.readFileSync(paths.diff);
    thumbnails.diff = `data:image/png;base64,${data.toString('base64')}`;
  }

  return thumbnails;
}

/**
 * Compute relative paths for images.
 */
function computeRelativePaths(
  paths: { baseline: string; current: string; diff?: string },
  basePath?: string
): HTMLReportEntry['thumbnails'] {
  if (!basePath) return undefined;

  return {
    baseline: path.relative(basePath, paths.baseline),
    current: path.relative(basePath, paths.current),
    diff: paths.diff ? path.relative(basePath, paths.diff) : undefined,
  };
}

/**
 * Extract baseline name from file path.
 */
function extractBaselineName(filePath: string): string {
  return path.basename(path.dirname(filePath));
}

// =============================================================================
// Summary Calculation
// =============================================================================

/**
 * Calculate summary statistics from entries.
 */
function calculateSummary(entries: HTMLReportEntry[]): ReportSummary {
  const total = entries.length;
  const passed = entries.filter((e) => e.status === 'passed').length;
  const failed = entries.filter((e) => e.status === 'failed').length;
  const errors = entries.filter((e) => e.status === 'error').length;
  const skipped = entries.filter((e) => e.status === 'skipped').length;
  const updated = entries.filter((e) => e.status === 'updated').length;

  const successfulEntries = entries.filter(
    (e) => e.status !== 'error' && e.status !== 'skipped'
  );
  const averageSimilarity =
    successfulEntries.length > 0
      ? successfulEntries.reduce((sum, e) => sum + e.similarity, 0) /
        successfulEntries.length
      : 0;

  return {
    total,
    passed,
    failed,
    errors,
    skipped,
    updated,
    passRate: total > 0 ? (passed / (total - skipped - errors)) * 100 : 0,
    averageSimilarity,
    timestamp: new Date(),
  };
}

// =============================================================================
// HTML Generation
// =============================================================================

/**
 * Generate complete HTML content.
 */
function generateHTMLContent(options: {
  title: string;
  projectName: string;
  deviceFamily?: DeviceFamily;
  threshold: number;
  summary: ReportSummary;
  entries: HTMLReportEntry[];
  includeTimestamp: boolean;
  customCSS?: string;
  darkMode: boolean;
}): string {
  const {
    title,
    projectName,
    deviceFamily,
    threshold,
    summary,
    entries,
    includeTimestamp,
    customCSS,
    darkMode,
  } = options;

  const entriesJson = JSON.stringify(entries);
  const summaryJson = JSON.stringify(summary);

  return `<!DOCTYPE html>
<html lang="en"${darkMode ? ' class="dark"' : ''}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${generateCSS(darkMode)}
${customCSS || ''}
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <h1>${escapeHtml(title)}</h1>
      <div class="header-meta">
        <span class="project-name">${escapeHtml(projectName)}</span>
        ${deviceFamily ? `<span class="device-badge">${escapeHtml(deviceFamily)}</span>` : ''}
        ${includeTimestamp ? `<span class="timestamp">${summary.timestamp.toISOString()}</span>` : ''}
      </div>
    </header>

    <!-- Summary Dashboard -->
    <section class="summary-dashboard">
      <div class="summary-cards">
        <div class="summary-card ${summary.failed === 0 && summary.errors === 0 ? 'card-success' : 'card-failure'}">
          <div class="card-value">${summary.passRate.toFixed(1)}%</div>
          <div class="card-label">Pass Rate</div>
        </div>
        <div class="summary-card">
          <div class="card-value">${summary.total}</div>
          <div class="card-label">Total</div>
        </div>
        <div class="summary-card card-success">
          <div class="card-value">${summary.passed}</div>
          <div class="card-label">Passed</div>
        </div>
        <div class="summary-card card-failure">
          <div class="card-value">${summary.failed}</div>
          <div class="card-label">Failed</div>
        </div>
        ${summary.errors > 0 ? `
        <div class="summary-card card-warning">
          <div class="card-value">${summary.errors}</div>
          <div class="card-label">Errors</div>
        </div>
        ` : ''}
        ${summary.updated > 0 ? `
        <div class="summary-card card-info">
          <div class="card-value">${summary.updated}</div>
          <div class="card-label">Updated</div>
        </div>
        ` : ''}
      </div>
      <div class="summary-meta">
        <span>Threshold: ${threshold}</span>
        <span>Avg Similarity: ${summary.averageSimilarity.toFixed(1)}%</span>
      </div>
    </section>

    <!-- Filter Controls -->
    <section class="filter-controls">
      <div class="filter-buttons">
        <button class="filter-btn active" data-filter="all">All (${summary.total})</button>
        <button class="filter-btn" data-filter="passed">Passed (${summary.passed})</button>
        <button class="filter-btn" data-filter="failed">Failed (${summary.failed})</button>
        ${summary.errors > 0 ? `<button class="filter-btn" data-filter="error">Errors (${summary.errors})</button>` : ''}
        ${summary.updated > 0 ? `<button class="filter-btn" data-filter="updated">Updated (${summary.updated})</button>` : ''}
      </div>
      <div class="search-box">
        <input type="text" id="search-input" placeholder="Search baselines..." />
      </div>
    </section>

    <!-- Thumbnail Grid -->
    <section class="thumbnail-grid" id="thumbnail-grid">
      ${generateThumbnailGrid(entries)}
    </section>

    <!-- Comparison Modal -->
    <div class="modal" id="comparison-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="modal-title">Comparison</h2>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="comparison-controls">
            <div class="view-toggle">
              <button class="view-btn active" data-view="side-by-side">Side by Side</button>
              <button class="view-btn" data-view="overlay">Overlay</button>
              <button class="view-btn" data-view="diff">Diff Only</button>
              <button class="view-btn" data-view="swipe">Swipe</button>
            </div>
            <div class="zoom-controls">
              <button class="zoom-btn" id="zoom-out">−</button>
              <span id="zoom-level">100%</span>
              <button class="zoom-btn" id="zoom-in">+</button>
              <button class="zoom-btn" id="zoom-fit">Fit</button>
            </div>
          </div>
          <div class="comparison-viewer" id="comparison-viewer">
            <div class="image-container" id="image-container">
              <!-- Images rendered by JavaScript -->
            </div>
          </div>
          <div class="comparison-info" id="comparison-info">
            <!-- Info rendered by JavaScript -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
${generateJavaScript(entriesJson, summaryJson)}
  </script>
</body>
</html>`;
}

/**
 * Generate CSS styles.
 */
function generateCSS(darkMode: boolean): string {
  const vars = darkMode
    ? `
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-tertiary: #0f3460;
    --text-primary: #eaeaea;
    --text-secondary: #a0a0a0;
    --border-color: #2a2a4a;
    --success-color: #4ade80;
    --failure-color: #f87171;
    --warning-color: #fbbf24;
    --info-color: #60a5fa;
    --card-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    `
    : `
    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --bg-tertiary: #f1f5f9;
    --text-primary: #1e293b;
    --text-secondary: #64748b;
    --border-color: #e2e8f0;
    --success-color: #22c55e;
    --failure-color: #ef4444;
    --warning-color: #f59e0b;
    --info-color: #3b82f6;
    --card-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

  return `
    :root {
      ${vars}
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      line-height: 1.5;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 2rem;
      margin-bottom: 10px;
    }

    .header-meta {
      display: flex;
      justify-content: center;
      gap: 15px;
      flex-wrap: wrap;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .device-badge {
      background: var(--bg-tertiary);
      padding: 2px 10px;
      border-radius: 12px;
      font-weight: 500;
    }

    /* Summary Dashboard */
    .summary-dashboard {
      background: var(--bg-primary);
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 25px;
      box-shadow: var(--card-shadow);
    }

    .summary-cards {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 15px;
    }

    .summary-card {
      background: var(--bg-secondary);
      border-radius: 10px;
      padding: 20px 30px;
      text-align: center;
      min-width: 120px;
      border: 1px solid var(--border-color);
    }

    .summary-card.card-success {
      border-color: var(--success-color);
    }

    .summary-card.card-failure {
      border-color: var(--failure-color);
    }

    .summary-card.card-warning {
      border-color: var(--warning-color);
    }

    .summary-card.card-info {
      border-color: var(--info-color);
    }

    .card-value {
      font-size: 2rem;
      font-weight: 700;
    }

    .card-success .card-value {
      color: var(--success-color);
    }

    .card-failure .card-value {
      color: var(--failure-color);
    }

    .card-warning .card-value {
      color: var(--warning-color);
    }

    .card-info .card-value {
      color: var(--info-color);
    }

    .card-label {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-top: 5px;
    }

    .summary-meta {
      display: flex;
      justify-content: center;
      gap: 30px;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    /* Filter Controls */
    .filter-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 15px;
    }

    .filter-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 8px 16px;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      color: var(--text-primary);
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .filter-btn:hover {
      background: var(--bg-tertiary);
    }

    .filter-btn.active {
      background: var(--info-color);
      color: white;
      border-color: var(--info-color);
    }

    .search-box input {
      padding: 8px 16px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-primary);
      width: 250px;
      font-size: 0.9rem;
    }

    .search-box input:focus {
      outline: none;
      border-color: var(--info-color);
    }

    /* Thumbnail Grid */
    .thumbnail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }

    .thumbnail-card {
      background: var(--bg-primary);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: var(--card-shadow);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .thumbnail-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
    }

    .thumbnail-card.status-passed {
      border-left: 4px solid var(--success-color);
    }

    .thumbnail-card.status-failed {
      border-left: 4px solid var(--failure-color);
    }

    .thumbnail-card.status-error {
      border-left: 4px solid var(--warning-color);
    }

    .thumbnail-card.status-updated {
      border-left: 4px solid var(--info-color);
    }

    .thumbnail-card.hidden {
      display: none;
    }

    .thumbnail-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
      background: var(--bg-tertiary);
    }

    .thumbnail-info {
      padding: 15px;
    }

    .thumbnail-name {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .thumbnail-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .status-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-badge.passed {
      background: rgba(34, 197, 94, 0.15);
      color: var(--success-color);
    }

    .status-badge.failed {
      background: rgba(239, 68, 68, 0.15);
      color: var(--failure-color);
    }

    .status-badge.error {
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning-color);
    }

    .status-badge.updated {
      background: rgba(59, 130, 246, 0.15);
      color: var(--info-color);
    }

    /* Modal */
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      overflow: auto;
    }

    .modal.active {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 20px;
    }

    .modal-content {
      background: var(--bg-primary);
      border-radius: 12px;
      width: 100%;
      max-width: 1200px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      margin: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .modal-header h2 {
      font-size: 1.25rem;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--text-secondary);
      cursor: pointer;
    }

    .modal-close:hover {
      color: var(--text-primary);
    }

    .modal-body {
      padding: 20px;
      overflow: auto;
      flex: 1;
    }

    /* Comparison Controls */
    .comparison-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 15px;
    }

    .view-toggle {
      display: flex;
      gap: 5px;
    }

    .view-btn {
      padding: 8px 14px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
    }

    .view-btn:hover {
      background: var(--bg-tertiary);
    }

    .view-btn.active {
      background: var(--info-color);
      color: white;
      border-color: var(--info-color);
    }

    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .zoom-btn {
      width: 32px;
      height: 32px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }

    .zoom-btn:hover {
      background: var(--bg-tertiary);
    }

    #zoom-level {
      min-width: 50px;
      text-align: center;
      font-size: 0.9rem;
    }

    /* Comparison Viewer */
    .comparison-viewer {
      background: var(--bg-tertiary);
      border-radius: 8px;
      overflow: auto;
      min-height: 400px;
      position: relative;
    }

    .image-container {
      display: flex;
      gap: 20px;
      padding: 20px;
      justify-content: center;
      transition: transform 0.2s;
      transform-origin: center center;
    }

    .image-container.side-by-side {
      flex-direction: row;
    }

    .image-container.overlay {
      position: relative;
    }

    .image-container.overlay .comparison-image:last-child {
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      opacity: 0.5;
    }

    .comparison-image {
      max-width: 100%;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .image-wrapper {
      text-align: center;
    }

    .image-label {
      margin-top: 10px;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    /* Swipe Comparison */
    .swipe-container {
      position: relative;
      overflow: hidden;
    }

    .swipe-slider {
      position: absolute;
      top: 0;
      left: 50%;
      width: 4px;
      height: 100%;
      background: var(--info-color);
      cursor: ew-resize;
      z-index: 10;
    }

    .swipe-slider::after {
      content: '⟷';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--info-color);
      color: white;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    /* Comparison Info */
    .comparison-info {
      margin-top: 20px;
      padding: 15px;
      background: var(--bg-secondary);
      border-radius: 8px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }

    .info-item {
      text-align: center;
    }

    .info-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-bottom: 3px;
    }

    .info-value {
      font-size: 1.1rem;
      font-weight: 600;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .summary-cards {
        gap: 10px;
      }

      .summary-card {
        padding: 15px 20px;
        min-width: 100px;
      }

      .card-value {
        font-size: 1.5rem;
      }

      .filter-controls {
        flex-direction: column;
      }

      .search-box input {
        width: 100%;
      }

      .thumbnail-grid {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      }

      .comparison-controls {
        flex-direction: column;
      }

      .view-toggle {
        flex-wrap: wrap;
      }
    }
  `;
}

/**
 * Generate thumbnail grid HTML.
 */
function generateThumbnailGrid(entries: HTMLReportEntry[]): string {
  return entries
    .map(
      (entry, index) => `
    <div class="thumbnail-card status-${entry.status}" data-index="${index}" data-status="${entry.status}" data-name="${escapeHtml(entry.name.toLowerCase())}">
      <img class="thumbnail-image"
           src="${entry.thumbnails?.diff || entry.thumbnails?.current || entry.thumbnails?.baseline || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e2e8f0" width="100" height="100"/%3E%3C/svg%3E'}"
           alt="${escapeHtml(entry.name)}"
           loading="lazy" />
      <div class="thumbnail-info">
        <div class="thumbnail-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</div>
        <div class="thumbnail-meta">
          <span class="status-badge ${entry.status}">${entry.status}</span>
          <span>${entry.similarity.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  `
    )
    .join('');
}

/**
 * Generate JavaScript for interactivity.
 */
function generateJavaScript(entriesJson: string, summaryJson: string): string {
  return `
    (function() {
      const entries = ${entriesJson};
      const summary = ${summaryJson};

      let currentIndex = 0;
      let currentView = 'side-by-side';
      let zoomLevel = 100;

      // DOM Elements
      const modal = document.getElementById('comparison-modal');
      const modalTitle = document.getElementById('modal-title');
      const modalClose = document.getElementById('modal-close');
      const imageContainer = document.getElementById('image-container');
      const comparisonInfo = document.getElementById('comparison-info');
      const thumbnailGrid = document.getElementById('thumbnail-grid');
      const searchInput = document.getElementById('search-input');

      // Filter functionality
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const filter = btn.dataset.filter;
          filterEntries(filter);
        });
      });

      function filterEntries(filter) {
        const searchTerm = searchInput.value.toLowerCase();
        document.querySelectorAll('.thumbnail-card').forEach(card => {
          const status = card.dataset.status;
          const name = card.dataset.name;

          const matchesFilter = filter === 'all' || status === filter;
          const matchesSearch = !searchTerm || name.includes(searchTerm);

          card.classList.toggle('hidden', !(matchesFilter && matchesSearch));
        });
      }

      // Search functionality
      searchInput.addEventListener('input', () => {
        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        filterEntries(activeFilter);
      });

      // Thumbnail click handlers
      thumbnailGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.thumbnail-card');
        if (card) {
          currentIndex = parseInt(card.dataset.index, 10);
          openModal();
        }
      });

      // Modal functions
      function openModal() {
        const entry = entries[currentIndex];
        modalTitle.textContent = entry.name;
        renderComparison();
        renderInfo();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }

      function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }

      modalClose.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('active')) return;

        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          currentIndex--;
          openModal();
        }
        if (e.key === 'ArrowRight' && currentIndex < entries.length - 1) {
          currentIndex++;
          openModal();
        }
      });

      // View toggle
      document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentView = btn.dataset.view;
          renderComparison();
        });
      });

      // Zoom controls
      document.getElementById('zoom-in').addEventListener('click', () => {
        zoomLevel = Math.min(300, zoomLevel + 25);
        updateZoom();
      });

      document.getElementById('zoom-out').addEventListener('click', () => {
        zoomLevel = Math.max(25, zoomLevel - 25);
        updateZoom();
      });

      document.getElementById('zoom-fit').addEventListener('click', () => {
        zoomLevel = 100;
        updateZoom();
      });

      function updateZoom() {
        document.getElementById('zoom-level').textContent = zoomLevel + '%';
        imageContainer.style.transform = 'scale(' + (zoomLevel / 100) + ')';
      }

      // Render comparison based on view
      function renderComparison() {
        const entry = entries[currentIndex];
        const thumbs = entry.thumbnails || {};

        imageContainer.className = 'image-container ' + currentView;

        if (currentView === 'side-by-side') {
          imageContainer.innerHTML = \`
            <div class="image-wrapper">
              <img class="comparison-image" src="\${thumbs.baseline || ''}" alt="Baseline" />
              <div class="image-label">Baseline</div>
            </div>
            <div class="image-wrapper">
              <img class="comparison-image" src="\${thumbs.current || ''}" alt="Current" />
              <div class="image-label">Current</div>
            </div>
            \${thumbs.diff ? \`
            <div class="image-wrapper">
              <img class="comparison-image" src="\${thumbs.diff}" alt="Diff" />
              <div class="image-label">Diff</div>
            </div>
            \` : ''}
          \`;
        } else if (currentView === 'overlay') {
          imageContainer.innerHTML = \`
            <div class="image-wrapper overlay-wrapper">
              <img class="comparison-image" src="\${thumbs.baseline || ''}" alt="Baseline" />
              <img class="comparison-image" src="\${thumbs.current || ''}" alt="Current" style="position: absolute; top: 0; left: 0; opacity: 0.5;" />
            </div>
          \`;
        } else if (currentView === 'diff') {
          imageContainer.innerHTML = thumbs.diff ? \`
            <div class="image-wrapper">
              <img class="comparison-image" src="\${thumbs.diff}" alt="Diff" />
              <div class="image-label">Diff Overlay</div>
            </div>
          \` : '<p style="padding: 40px; color: var(--text-secondary);">No diff image available</p>';
        } else if (currentView === 'swipe') {
          renderSwipeComparison(entry);
        }
      }

      function renderSwipeComparison(entry) {
        const thumbs = entry.thumbnails || {};
        imageContainer.innerHTML = \`
          <div class="swipe-container" style="position: relative; display: inline-block;">
            <img class="comparison-image" src="\${thumbs.baseline || ''}" alt="Baseline" style="display: block;" />
            <div style="position: absolute; top: 0; left: 0; width: 50%; overflow: hidden;">
              <img class="comparison-image" src="\${thumbs.current || ''}" alt="Current" style="display: block;" />
            </div>
            <div class="swipe-slider" id="swipe-slider"></div>
          </div>
        \`;

        const container = imageContainer.querySelector('.swipe-container');
        const overlay = container.querySelector('div');
        const slider = document.getElementById('swipe-slider');

        let isDragging = false;

        slider.addEventListener('mousedown', () => isDragging = true);
        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('mousemove', (e) => {
          if (!isDragging) return;

          const rect = container.getBoundingClientRect();
          const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          const percent = (x / rect.width) * 100;

          overlay.style.width = percent + '%';
          slider.style.left = percent + '%';
        });
      }

      // Render comparison info
      function renderInfo() {
        const entry = entries[currentIndex];
        comparisonInfo.innerHTML = \`
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Status</div>
              <div class="info-value"><span class="status-badge \${entry.status}">\${entry.status}</span></div>
            </div>
            <div class="info-item">
              <div class="info-label">Similarity</div>
              <div class="info-value">\${entry.similarity.toFixed(1)}%</div>
            </div>
            <div class="info-item">
              <div class="info-label">Diff %</div>
              <div class="info-value">\${entry.diffPercent.toFixed(2)}%</div>
            </div>
            <div class="info-item">
              <div class="info-label">Changed Regions</div>
              <div class="info-value">\${entry.changedRegions}</div>
            </div>
          </div>
          \${entry.error ? '<p style="color: var(--warning-color); margin-top: 10px;">Error: ' + escapeHtml(entry.error) + '</p>' : ''}
        \`;

        function escapeHtml(str) {
          const div = document.createElement('div');
          div.textContent = str;
          return div.innerHTML;
        }
      }
    })();
  `;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

