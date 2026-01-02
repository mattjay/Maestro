/**
 * iOS Tools - Diff Formatter
 *
 * Formats visual regression comparison results for agent consumption.
 * Provides structured, readable output that AI agents can use to
 * understand visual differences and take appropriate actions.
 */

import type {
  ImageCompareResult,
  ImageAnalysisResult,
  DetectedChange,
  ChangeSummary,
  ChangeType,
} from './image-diff/types';
import type {
  BaselineMetadata,
  RegressionReport,
  RegressionSummary,
  ChangedRegion,
} from './baselines/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for formatting comparison output.
 */
export interface DiffFormatOptions {
  /** Include file paths in output */
  includePaths?: boolean;
  /** Include recommendations for next steps */
  includeRecommendations?: boolean;
  /** Maximum number of changed regions to show */
  maxRegions?: number;
  /** Include verbose change descriptions */
  verbose?: boolean;
  /** Baseline name for context */
  baselineName?: string;
  /** Project name for context */
  projectName?: string;
}

/**
 * Result of formatting a comparison.
 */
export interface FormattedDiff {
  /** Formatted markdown output */
  markdown: string;
  /** Structured data summary */
  summary: {
    status: 'match' | 'differences';
    similarity: number;
    diffPercent: number;
    changedRegions: number;
    severityBreakdown: {
      high: number;
      medium: number;
      low: number;
    };
  };
}

/**
 * Single comparison entry for regression report.
 */
export interface RegressionEntry {
  /** Baseline name */
  name: string;
  /** Comparison result */
  comparison: ImageCompareResult;
  /** Analysis result */
  analysis?: ImageAnalysisResult;
  /** File paths */
  paths: {
    baseline: string;
    current: string;
    diff?: string;
  };
  /** Baseline metadata */
  metadata?: BaselineMetadata;
  /** Whether baseline was updated */
  updated?: boolean;
  /** Error if comparison failed */
  error?: string;
}

/**
 * Result of formatting a regression report.
 */
export interface FormattedRegressionReport {
  /** Formatted markdown output */
  markdown: string;
  /** Structured summary */
  summary: RegressionSummary;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default maximum regions to display in output.
 */
export const DEFAULT_MAX_REGIONS = 10;

/**
 * Severity thresholds for categorizing changes.
 */
export const SEVERITY_THRESHOLDS = {
  HIGH: 0.7,
  MEDIUM: 0.3,
};

// =============================================================================
// Main Formatting Functions
// =============================================================================

/**
 * Format a visual comparison result for agent consumption.
 *
 * Generates a structured markdown report showing:
 * - Status (match/differences)
 * - Similarity percentage
 * - Changed regions with severity indicators
 * - File paths
 * - Recommendations for next steps
 *
 * @param comparison - Image comparison result
 * @param analysis - Change analysis result
 * @param paths - File paths for baseline, current, and diff images
 * @param options - Formatting options
 * @returns Formatted diff output
 *
 * @example
 * ```typescript
 * const result = formatDiffForAgent(comparison, analysis, {
 *   baseline: '/path/to/baseline.png',
 *   current: '/path/to/current.png',
 *   diff: '/path/to/diff.png',
 * }, {
 *   baselineName: 'login_screen',
 *   includeRecommendations: true,
 * });
 * console.log(result.markdown);
 * ```
 */
export function formatDiffForAgent(
  comparison: ImageCompareResult,
  analysis: ImageAnalysisResult,
  paths: { baseline: string; current: string; diff?: string },
  options: DiffFormatOptions = {}
): FormattedDiff {
  const {
    includePaths = true,
    includeRecommendations = true,
    maxRegions = DEFAULT_MAX_REGIONS,
    verbose = false,
    baselineName = 'baseline',
    projectName,
  } = options;

  const lines: string[] = [];

  // Header with baseline name
  lines.push(`## Visual Comparison: ${baselineName}`);
  lines.push('');

  // Status badge
  const status = comparison.match ? '✅ MATCH' : '❌ DIFFERENCES DETECTED';
  lines.push(`**Status**: ${status}`);

  // Similarity percentage
  const similarityPct = (comparison.similarity * 100).toFixed(1);
  lines.push(`**Similarity**: ${similarityPct}%`);

  // Changed pixels stats
  const changedPixelsStr = comparison.diffPixels.toLocaleString();
  const diffPercentStr = comparison.diffPercent.toFixed(2);
  lines.push(`**Changed Pixels**: ${changedPixelsStr} (${diffPercentStr}%)`);
  lines.push('');

  // Changed regions section
  const nonIgnoredChanges = analysis.changes.filter((c) => !c.isIgnored);

  if (nonIgnoredChanges.length > 0) {
    lines.push('### Changed Regions');
    lines.push('');

    const displayChanges = nonIgnoredChanges.slice(0, maxRegions);

    for (let i = 0; i < displayChanges.length; i++) {
      const change = displayChanges[i];
      const regionNum = i + 1;

      // Severity indicator
      const severityIcon = getSeverityIcon(change.severity);

      // Format region header
      lines.push(
        `${regionNum}. **${formatChangeType(change.changeType)}** ${severityIcon}`
      );

      // Format bounds
      const startX = Math.round(change.bounds.x);
      const startY = Math.round(change.bounds.y);
      const endX = Math.round(change.bounds.x + change.bounds.width);
      const endY = Math.round(change.bounds.y + change.bounds.height);
      lines.push(`   - Location: (${startX}, ${startY}) - (${endX}, ${endY})`);
      lines.push(`   - Size: ${Math.round(change.bounds.width)}x${Math.round(change.bounds.height)}`);

      // Add description if available and verbose
      if (verbose && change.description) {
        lines.push(`   - ${change.description}`);
      }

      // Detailed change info for specific types
      if (verbose) {
        switch (change.changeType) {
          case 'color':
            lines.push('   - Color values differ in this region');
            break;
          case 'text':
            lines.push('   - Text content appears to have changed');
            break;
          case 'layout':
            lines.push('   - Element position or size has shifted');
            break;
          case 'added':
            lines.push('   - New element appeared in this location');
            break;
          case 'removed':
            lines.push('   - Element was removed from this location');
            break;
        }
      }

      lines.push('');
    }

    // Show count of remaining regions
    if (nonIgnoredChanges.length > maxRegions) {
      const remaining = nonIgnoredChanges.length - maxRegions;
      lines.push(`*... and ${remaining} more changed regions*`);
      lines.push('');
    }
  }

  // File paths section
  if (includePaths) {
    lines.push('### Files');
    lines.push(`- Baseline: ${paths.baseline}`);
    lines.push(`- Current: ${paths.current}`);
    if (paths.diff) {
      lines.push(`- Diff: ${paths.diff}`);
    }
    lines.push('');
  }

  // Recommendations section
  if (includeRecommendations && !comparison.match) {
    lines.push('### Recommendation');
    lines.push('Review the changes above. If intentional:');
    lines.push(`\`/ios.baseline update ${baselineName}\``);
    lines.push('');
  }

  // Calculate severity breakdown
  const severityBreakdown = {
    high: nonIgnoredChanges.filter((c) => c.severity >= SEVERITY_THRESHOLDS.HIGH).length,
    medium: nonIgnoredChanges.filter(
      (c) => c.severity >= SEVERITY_THRESHOLDS.MEDIUM && c.severity < SEVERITY_THRESHOLDS.HIGH
    ).length,
    low: nonIgnoredChanges.filter((c) => c.severity < SEVERITY_THRESHOLDS.MEDIUM).length,
  };

  return {
    markdown: lines.join('\n'),
    summary: {
      status: comparison.match ? 'match' : 'differences',
      similarity: comparison.similarity,
      diffPercent: comparison.diffPercent,
      changedRegions: nonIgnoredChanges.length,
      severityBreakdown,
    },
  };
}

/**
 * Format a full regression test report for agent consumption.
 *
 * Generates a comprehensive markdown report with:
 * - Overall pass/fail status
 * - Summary statistics
 * - Per-baseline results table
 * - Detailed failure information
 * - Recommendations for addressing failures
 *
 * @param entries - Array of regression comparison entries
 * @param options - Report options
 * @returns Formatted regression report
 *
 * @example
 * ```typescript
 * const report = formatRegressionReport(entries, {
 *   projectName: 'my-app',
 *   includeDetails: true,
 * });
 * console.log(report.markdown);
 * ```
 */
export function formatRegressionReport(
  entries: RegressionEntry[],
  options: {
    projectName?: string;
    deviceFamily?: string;
    threshold?: number;
    includeDetails?: boolean;
    maxDetailedFailures?: number;
  } = {}
): FormattedRegressionReport {
  const {
    projectName = 'Project',
    deviceFamily,
    threshold = 0.1,
    includeDetails = true,
    maxDetailedFailures = 5,
  } = options;

  const lines: string[] = [];

  // Calculate stats
  const passed = entries.filter((e) => e.comparison.match && !e.error).length;
  const failed = entries.filter((e) => !e.comparison.match && !e.error).length;
  const errors = entries.filter((e) => e.error).length;
  const updated = entries.filter((e) => e.updated).length;
  const total = entries.length;
  const passRate = total > 0 ? passed / total : 0;

  const overallStatus = failed === 0 && errors === 0 ? 'passed' : 'failed';

  // Header
  const familyFilter = deviceFamily ? ` (${deviceFamily})` : '';
  lines.push(`## Visual Regression Report: ${projectName}${familyFilter}`);
  lines.push('');

  // Status badge
  const statusIcon = overallStatus === 'passed' ? '✅' : '❌';
  const statusText = overallStatus === 'passed' ? 'ALL TESTS PASSED' : 'TESTS FAILED';
  lines.push(`**Status**: ${statusIcon} ${statusText}`);
  lines.push('');

  // Summary table
  lines.push('### Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Baselines | ${total} |`);
  lines.push(`| Passed | ${passed} |`);
  lines.push(`| Failed | ${failed} |`);
  if (errors > 0) {
    lines.push(`| Errors | ${errors} |`);
  }
  if (updated > 0) {
    lines.push(`| Updated | ${updated} |`);
  }
  lines.push(`| Pass Rate | ${(passRate * 100).toFixed(1)}% |`);
  lines.push(`| Threshold | ${threshold} |`);
  lines.push('');

  // Results table
  lines.push('### Results');
  lines.push('');
  lines.push('| Baseline | Status | Similarity | Diff % | Regions |');
  lines.push('|----------|--------|------------|--------|---------|');

  for (const entry of entries) {
    const statusIcon = entry.error ? '⚠️' : entry.comparison.match ? '✅' : '❌';
    const similarity = entry.error ? '-' : `${(entry.comparison.similarity * 100).toFixed(1)}%`;
    const diffPercent = entry.error ? '-' : `${entry.comparison.diffPercent.toFixed(2)}%`;
    const regions = entry.analysis
      ? entry.analysis.changes.filter((c) => !c.isIgnored).length.toString()
      : '-';
    const updatedMark = entry.updated ? ' ⚡' : '';

    lines.push(`| ${entry.name}${updatedMark} | ${statusIcon} | ${similarity} | ${diffPercent} | ${regions} |`);
  }
  lines.push('');

  // Detailed failures section
  if (includeDetails) {
    const failedEntries = entries.filter((e) => !e.comparison.match && !e.error);

    if (failedEntries.length > 0) {
      lines.push('### Failed Baselines');
      lines.push('');

      const displayFailures = failedEntries.slice(0, maxDetailedFailures);

      for (const entry of displayFailures) {
        lines.push(`#### ${entry.name}`);
        lines.push('');
        lines.push(`- **Similarity**: ${(entry.comparison.similarity * 100).toFixed(1)}%`);
        lines.push(`- **Changed Pixels**: ${entry.comparison.diffPixels.toLocaleString()}`);

        if (entry.analysis) {
          const changes = entry.analysis.changes.filter((c) => !c.isIgnored);
          lines.push(`- **Changed Regions**: ${changes.length}`);

          // Show top changes
          if (changes.length > 0) {
            lines.push('- **Top Changes**:');
            const topChanges = changes.slice(0, 3);
            for (const change of topChanges) {
              const icon = getSeverityIcon(change.severity);
              lines.push(
                `  - ${icon} ${formatChangeType(change.changeType)} at ` +
                `(${Math.round(change.bounds.x)}, ${Math.round(change.bounds.y)})`
              );
            }
          }
        }

        if (entry.paths.diff) {
          lines.push(`- **Diff**: \`${entry.paths.diff}\``);
        }

        lines.push('');
      }

      if (failedEntries.length > maxDetailedFailures) {
        const remaining = failedEntries.length - maxDetailedFailures;
        lines.push(`*... and ${remaining} more failed baselines*`);
        lines.push('');
      }
    }

    // Error section
    const errorEntries = entries.filter((e) => e.error);
    if (errorEntries.length > 0) {
      lines.push('### Errors');
      lines.push('');

      for (const entry of errorEntries) {
        lines.push(`- **${entry.name}**: ${entry.error}`);
      }
      lines.push('');
    }
  }

  // Recommendations
  if (failed > 0 || errors > 0) {
    lines.push('### Recommendations');
    lines.push('');
    lines.push('1. Review the diff images to understand the changes');
    lines.push('2. If changes are intentional, update baselines:');
    lines.push('   - Single: `/ios.baseline update <name>`');
    lines.push('   - All failed: `/ios.regression --update`');
    lines.push('3. If changes are bugs, fix the app and re-run: `/ios.regression`');
    lines.push('');
  }

  // Build summary for structured output
  const topChangedAreas: ChangedRegion[] = [];
  for (const entry of entries) {
    if (entry.analysis) {
      const changes = entry.analysis.changes.filter((c) => !c.isIgnored);
      for (const change of changes.slice(0, 2)) {
        topChangedAreas.push({
          bounds: change.bounds,
          changeType: change.changeType,
          pixelCount: change.pixelCount,
          description: change.description,
          severity: change.severity,
        });
      }
    }
  }

  const avgSimilarity =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + (e.error ? 0 : e.comparison.similarity), 0) / entries.length
      : 0;

  const recommendations: string[] = [];
  if (failed > 0) {
    recommendations.push(`Update ${failed} baselines if changes are intentional`);
    recommendations.push('Review diff images before updating');
  }
  if (errors > 0) {
    recommendations.push(`Fix ${errors} comparison errors`);
  }

  return {
    markdown: lines.join('\n'),
    summary: {
      status: overallStatus === 'passed' ? 'passed' : failed === 0 ? 'partial' : 'failed',
      differencesFound: failed,
      averageSimilarity: avgSimilarity,
      topChangedAreas: topChangedAreas.slice(0, 5),
      recommendations,
    },
  };
}

/**
 * Format a single change description for agent output.
 *
 * @param change - Detected change
 * @param index - Change index (1-based)
 * @returns Formatted change description
 */
export function formatChange(change: DetectedChange, index: number): string {
  const lines: string[] = [];

  const severityIcon = getSeverityIcon(change.severity);
  const typeName = formatChangeType(change.changeType);

  // Header
  lines.push(`${index}. **${typeName}** ${severityIcon}`);

  // Bounds
  const startX = Math.round(change.bounds.x);
  const startY = Math.round(change.bounds.y);
  const endX = Math.round(change.bounds.x + change.bounds.width);
  const endY = Math.round(change.bounds.y + change.bounds.height);
  lines.push(`   - Location: (${startX}, ${startY}) - (${endX}, ${endY})`);

  // Size
  const width = Math.round(change.bounds.width);
  const height = Math.round(change.bounds.height);
  lines.push(`   - Size: ${width}x${height}`);

  // Pixels
  lines.push(`   - Pixels: ${change.pixelCount.toLocaleString()}`);

  // Description if available
  if (change.description) {
    lines.push(`   - ${change.description}`);
  }

  return lines.join('\n');
}

/**
 * Format a change summary for compact output.
 *
 * @param summary - Change summary
 * @returns Formatted summary text
 */
export function formatChangeSummaryCompact(summary: ChangeSummary): string {
  if (summary.regionCount === 0) {
    return 'No visual changes detected.';
  }

  const parts: string[] = [];

  // Region count
  parts.push(`${summary.regionCount} change${summary.regionCount === 1 ? '' : 's'}`);

  // Type breakdown
  const types: string[] = [];
  if (summary.byType.added > 0) types.push(`${summary.byType.added} added`);
  if (summary.byType.removed > 0) types.push(`${summary.byType.removed} removed`);
  if (summary.byType.layout > 0) types.push(`${summary.byType.layout} layout`);
  if (summary.byType.color > 0) types.push(`${summary.byType.color} color`);
  if (summary.byType.text > 0) types.push(`${summary.byType.text} text`);

  if (types.length > 0) {
    parts.push(`(${types.join(', ')})`);
  }

  // Total pixels
  parts.push(`affecting ${summary.totalChangedPixels.toLocaleString()} pixels`);

  return parts.join(' ');
}

/**
 * Format as JSON for programmatic consumption.
 *
 * @param comparison - Comparison result
 * @param analysis - Analysis result
 * @param paths - File paths
 * @param options - Format options
 * @returns JSON string
 */
export function formatDiffAsJson(
  comparison: ImageCompareResult,
  analysis: ImageAnalysisResult,
  paths: { baseline: string; current: string; diff?: string },
  options: DiffFormatOptions = {}
): string {
  const result = formatDiffForAgent(comparison, analysis, paths, options);

  return JSON.stringify(
    {
      status: result.summary.status,
      similarity: comparison.similarity,
      diffPercent: comparison.diffPercent,
      diffPixels: comparison.diffPixels,
      changedRegions: analysis.changes.filter((c) => !c.isIgnored).length,
      severityBreakdown: result.summary.severityBreakdown,
      changes: analysis.changes.filter((c) => !c.isIgnored).map((c) => ({
        id: c.id,
        type: c.changeType,
        bounds: c.bounds,
        pixelCount: c.pixelCount,
        severity: c.severity,
        description: c.description,
      })),
      paths,
    },
    null,
    2
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get severity icon based on severity score.
 */
function getSeverityIcon(severity: number): string {
  if (severity >= SEVERITY_THRESHOLDS.HIGH) {
    return '🔴';
  } else if (severity >= SEVERITY_THRESHOLDS.MEDIUM) {
    return '🟡';
  } else {
    return '🟢';
  }
}

/**
 * Format change type for display.
 */
function formatChangeType(type: ChangeType): string {
  switch (type) {
    case 'added':
      return 'New Element';
    case 'removed':
      return 'Removed Element';
    case 'layout':
      return 'Layout Change';
    case 'color':
      return 'Color Change';
    case 'text':
      return 'Text Change';
    default:
      return 'Visual Change';
  }
}

/**
 * Format severity for display.
 */
export function formatSeverity(severity: number): string {
  if (severity >= SEVERITY_THRESHOLDS.HIGH) {
    return 'high';
  } else if (severity >= SEVERITY_THRESHOLDS.MEDIUM) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Calculate severity breakdown from changes.
 */
export function calculateSeverityBreakdown(changes: DetectedChange[]): {
  high: number;
  medium: number;
  low: number;
} {
  return {
    high: changes.filter((c) => c.severity >= SEVERITY_THRESHOLDS.HIGH).length,
    medium: changes.filter(
      (c) => c.severity >= SEVERITY_THRESHOLDS.MEDIUM && c.severity < SEVERITY_THRESHOLDS.HIGH
    ).length,
    low: changes.filter((c) => c.severity < SEVERITY_THRESHOLDS.MEDIUM).length,
  };
}
