/**
 * iOS Tools - Performance Metrics Module
 *
 * Tracks and displays performance metrics for iOS development operations.
 * This module provides user-facing performance insights including:
 * - Build times
 * - Test execution times
 * - Screenshot capture times
 * - Comparison with previous runs
 *
 * Unlike telemetry (which is aggregated and anonymized), this module
 * stores per-project metrics for the user's reference and optimization.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import * as os from 'os';
import { logger } from '../utils/logger';

const LOG_CONTEXT = '[iOS-PerformanceMetrics]';

// =============================================================================
// Constants
// =============================================================================

/** Metrics data version for schema evolution */
export const METRICS_VERSION = '1.0.0';

/** Metrics data directory */
export const METRICS_DIRECTORY = '.maestro';

/** Metrics data filename */
export const METRICS_FILENAME = 'ios-performance-metrics.json';

/** Maximum number of runs to keep per metric type */
export const MAX_RUNS_PER_METRIC = 100;

/** Maximum age of runs in days before cleanup */
export const MAX_RUN_AGE_DAYS = 30;

// =============================================================================
// Types
// =============================================================================

/**
 * Types of operations we track
 */
export type MetricType =
  | 'build'
  | 'test'
  | 'screenshot'
  | 'flow'
  | 'playbook'
  | 'inspect'
  | 'baseline_compare'
  | 'app_launch'
  | 'simulator_boot';

/**
 * Single performance measurement
 */
export interface PerformanceRun {
  /** Unique run ID */
  id: string;
  /** Metric type */
  type: MetricType;
  /** Operation name (e.g., scheme name for builds, test name for tests) */
  name: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether the operation succeeded */
  success: boolean;
  /** ISO timestamp when run started */
  startTime: string;
  /** ISO timestamp when run ended */
  endTime: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated statistics for a metric type
 */
export interface MetricStats {
  /** Metric type */
  type: MetricType;
  /** Total runs */
  totalRuns: number;
  /** Successful runs */
  successfulRuns: number;
  /** Failed runs */
  failedRuns: number;
  /** Average duration in ms */
  avgDurationMs: number;
  /** Minimum duration in ms */
  minDurationMs: number;
  /** Maximum duration in ms */
  maxDurationMs: number;
  /** Median duration in ms */
  medianDurationMs: number;
  /** 95th percentile duration in ms */
  p95DurationMs: number;
  /** Last run timestamp */
  lastRun?: string;
  /** Trend: 'improving', 'stable', 'degrading' */
  trend: 'improving' | 'stable' | 'degrading' | 'unknown';
  /** Trend percentage (positive = slower, negative = faster) */
  trendPercent: number;
}

/**
 * Per-name breakdown within a metric type
 */
export interface NamedMetricStats extends MetricStats {
  /** Name (e.g., scheme, test name) */
  name: string;
}

/**
 * Comparison result between current run and historical data
 */
export interface RunComparison {
  /** Current run duration */
  currentMs: number;
  /** Average of recent runs */
  avgRecentMs: number;
  /** Best (fastest) recent run */
  bestRecentMs: number;
  /** Worst (slowest) recent run */
  worstRecentMs: number;
  /** Difference from average (positive = slower) */
  diffFromAvgMs: number;
  /** Percentage difference from average */
  diffFromAvgPercent: number;
  /** Whether this is a new record (best time) */
  isNewRecord: boolean;
  /** Whether this is significantly slower than average (>20%) */
  isSlower: boolean;
  /** Whether this is significantly faster than average (>20%) */
  isFaster: boolean;
  /** Number of runs used for comparison */
  sampleSize: number;
}

/**
 * Summary of all metrics
 */
export interface MetricsSummary {
  /** Summary per metric type */
  byType: MetricStats[];
  /** Total operations tracked */
  totalOperations: number;
  /** Overall success rate */
  successRate: number;
  /** Most improved metric (biggest speed improvement) */
  mostImproved?: { type: MetricType; name?: string; improvement: number };
  /** Needs attention (slowest trending) */
  needsAttention?: { type: MetricType; name?: string; degradation: number };
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Stored metrics data
 */
export interface PerformanceMetricsData {
  /** Schema version */
  version: string;
  /** Project path (for identification) */
  projectPath?: string;
  /** All performance runs */
  runs: PerformanceRun[];
  /** Last cleanup timestamp */
  lastCleanup?: string;
}

/**
 * Options for recording a metric
 */
export interface RecordMetricOptions {
  /** Metric type */
  type: MetricType;
  /** Operation name */
  name: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether operation succeeded */
  success: boolean;
  /** Start time (defaults to now - duration) */
  startTime?: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get the metrics data file path
 *
 * @param projectPath - Optional project path for project-specific metrics
 * @returns Full path to metrics file
 */
export function getMetricsPath(projectPath?: string): string {
  if (projectPath) {
    return path.join(projectPath, METRICS_DIRECTORY, METRICS_FILENAME);
  }
  return path.join(os.homedir(), METRICS_DIRECTORY, METRICS_FILENAME);
}

/**
 * Generate a unique run ID
 */
export function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Create default metrics data structure
 */
export function createDefaultMetricsData(projectPath?: string): PerformanceMetricsData {
  return {
    version: METRICS_VERSION,
    projectPath,
    runs: [],
  };
}

/**
 * Calculate average of numbers
 */
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate median of numbers
 */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate percentile
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Determine trend from recent runs
 */
function calculateTrend(runs: PerformanceRun[]): { trend: 'improving' | 'stable' | 'degrading' | 'unknown'; percent: number } {
  if (runs.length < 5) {
    return { trend: 'unknown', percent: 0 };
  }

  // Compare first half to second half
  const sorted = [...runs].sort((a, b) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const midpoint = Math.floor(sorted.length / 2);
  const olderHalf = sorted.slice(0, midpoint);
  const newerHalf = sorted.slice(midpoint);

  const olderAvg = average(olderHalf.filter(r => r.success).map(r => r.durationMs));
  const newerAvg = average(newerHalf.filter(r => r.success).map(r => r.durationMs));

  if (olderAvg === 0 || newerAvg === 0) {
    return { trend: 'unknown', percent: 0 };
  }

  const changePercent = ((newerAvg - olderAvg) / olderAvg) * 100;

  if (changePercent < -10) {
    return { trend: 'improving', percent: changePercent };
  } else if (changePercent > 10) {
    return { trend: 'degrading', percent: changePercent };
  }
  return { trend: 'stable', percent: changePercent };
}

// =============================================================================
// Data Persistence
// =============================================================================

/** In-memory cache keyed by path */
const metricsCache = new Map<string, PerformanceMetricsData>();

/**
 * Load metrics data from disk
 */
export async function loadMetricsData(projectPath?: string): Promise<PerformanceMetricsData> {
  const filePath = getMetricsPath(projectPath);
  const cacheKey = filePath;

  if (metricsCache.has(cacheKey)) {
    return metricsCache.get(cacheKey)!;
  }

  try {
    if (!existsSync(filePath)) {
      const defaultData = createDefaultMetricsData(projectPath);
      metricsCache.set(cacheKey, defaultData);
      return defaultData;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as PerformanceMetricsData;

    // Validate version and migrate if needed
    if (data.version !== METRICS_VERSION) {
      data.version = METRICS_VERSION;
    }

    metricsCache.set(cacheKey, data);
    return data;
  } catch (error) {
    logger.warn(`${LOG_CONTEXT} Failed to load metrics data: ${error}`);
    const defaultData = createDefaultMetricsData(projectPath);
    metricsCache.set(cacheKey, defaultData);
    return defaultData;
  }
}

/**
 * Save metrics data to disk
 */
export async function saveMetricsData(data: PerformanceMetricsData, projectPath?: string): Promise<void> {
  const filePath = getMetricsPath(projectPath);
  const dir = path.dirname(filePath);

  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    metricsCache.set(filePath, data);
    logger.debug(`${LOG_CONTEXT} Metrics data saved`, LOG_CONTEXT);
  } catch (error) {
    logger.error(`${LOG_CONTEXT} Failed to save metrics data: ${error}`);
  }
}

/**
 * Clear metrics cache (for testing)
 */
export function clearMetricsCache(): void {
  metricsCache.clear();
}

/**
 * Clear all metrics data
 */
export async function clearMetricsData(projectPath?: string): Promise<void> {
  const filePath = getMetricsPath(projectPath);

  try {
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    metricsCache.delete(filePath);
    logger.info(`${LOG_CONTEXT} Metrics data cleared`);
  } catch (error) {
    logger.error(`${LOG_CONTEXT} Failed to clear metrics data: ${error}`);
  }
}

// =============================================================================
// Recording Operations
// =============================================================================

/**
 * Record a performance metric
 */
export async function recordMetric(options: RecordMetricOptions, projectPath?: string): Promise<PerformanceRun> {
  const now = new Date();
  const startTime = options.startTime || new Date(now.getTime() - options.durationMs);

  const run: PerformanceRun = {
    id: generateRunId(),
    type: options.type,
    name: options.name,
    durationMs: options.durationMs,
    success: options.success,
    startTime: startTime.toISOString(),
    endTime: now.toISOString(),
    metadata: options.metadata,
  };

  try {
    const data = await loadMetricsData(projectPath);
    data.runs.push(run);

    // Cleanup old runs if needed
    if (data.runs.length > MAX_RUNS_PER_METRIC * 10) {
      await cleanupOldRuns(data);
    }

    await saveMetricsData(data, projectPath);
    logger.debug(`${LOG_CONTEXT} Recorded metric: ${options.type}/${options.name} = ${options.durationMs}ms`);
  } catch (error) {
    logger.debug(`${LOG_CONTEXT} Failed to record metric: ${error}`);
  }

  return run;
}

/**
 * Record a build time
 */
export async function recordBuildTime(
  scheme: string,
  durationMs: number,
  success: boolean,
  projectPath?: string,
  metadata?: Record<string, unknown>
): Promise<PerformanceRun> {
  return recordMetric({
    type: 'build',
    name: scheme,
    durationMs,
    success,
    metadata,
  }, projectPath);
}

/**
 * Record test execution time
 */
export async function recordTestTime(
  testName: string,
  durationMs: number,
  success: boolean,
  projectPath?: string,
  metadata?: Record<string, unknown>
): Promise<PerformanceRun> {
  return recordMetric({
    type: 'test',
    name: testName,
    durationMs,
    success,
    metadata,
  }, projectPath);
}

/**
 * Record screenshot capture time
 */
export async function recordScreenshotTime(
  name: string,
  durationMs: number,
  success: boolean,
  projectPath?: string,
  metadata?: Record<string, unknown>
): Promise<PerformanceRun> {
  return recordMetric({
    type: 'screenshot',
    name,
    durationMs,
    success,
    metadata,
  }, projectPath);
}

/**
 * Record flow execution time
 */
export async function recordFlowTime(
  flowName: string,
  durationMs: number,
  success: boolean,
  projectPath?: string,
  metadata?: Record<string, unknown>
): Promise<PerformanceRun> {
  return recordMetric({
    type: 'flow',
    name: flowName,
    durationMs,
    success,
    metadata,
  }, projectPath);
}

/**
 * Record playbook execution time
 */
export async function recordPlaybookTime(
  playbookName: string,
  durationMs: number,
  success: boolean,
  projectPath?: string,
  metadata?: Record<string, unknown>
): Promise<PerformanceRun> {
  return recordMetric({
    type: 'playbook',
    name: playbookName,
    durationMs,
    success,
    metadata,
  }, projectPath);
}

/**
 * Record inspect time
 */
export async function recordInspectTime(
  name: string,
  durationMs: number,
  success: boolean,
  projectPath?: string,
  metadata?: Record<string, unknown>
): Promise<PerformanceRun> {
  return recordMetric({
    type: 'inspect',
    name,
    durationMs,
    success,
    metadata,
  }, projectPath);
}

/**
 * Record baseline comparison time
 */
export async function recordBaselineCompareTime(
  baselineName: string,
  durationMs: number,
  success: boolean,
  projectPath?: string,
  metadata?: Record<string, unknown>
): Promise<PerformanceRun> {
  return recordMetric({
    type: 'baseline_compare',
    name: baselineName,
    durationMs,
    success,
    metadata,
  }, projectPath);
}

/**
 * Record app launch time
 */
export async function recordAppLaunchTime(
  bundleId: string,
  durationMs: number,
  success: boolean,
  projectPath?: string,
  metadata?: Record<string, unknown>
): Promise<PerformanceRun> {
  return recordMetric({
    type: 'app_launch',
    name: bundleId,
    durationMs,
    success,
    metadata,
  }, projectPath);
}

/**
 * Record simulator boot time
 */
export async function recordSimulatorBootTime(
  simulatorName: string,
  durationMs: number,
  success: boolean,
  projectPath?: string,
  metadata?: Record<string, unknown>
): Promise<PerformanceRun> {
  return recordMetric({
    type: 'simulator_boot',
    name: simulatorName,
    durationMs,
    success,
    metadata,
  }, projectPath);
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Cleanup old runs based on age and count limits
 */
export async function cleanupOldRuns(data: PerformanceMetricsData): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_RUN_AGE_DAYS);
  const cutoffTime = cutoffDate.getTime();

  const originalCount = data.runs.length;

  // Group by type and name
  const groups = new Map<string, PerformanceRun[]>();
  for (const run of data.runs) {
    const key = `${run.type}:${run.name}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(run);
  }

  // Keep only recent runs within limits
  const keptRuns: PerformanceRun[] = [];
  Array.from(groups.values()).forEach(runs => {
    // Sort by time (newest first)
    const sorted = runs
      .filter(r => new Date(r.startTime).getTime() > cutoffTime)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    // Keep up to MAX_RUNS_PER_METRIC
    keptRuns.push(...sorted.slice(0, MAX_RUNS_PER_METRIC));
  });

  data.runs = keptRuns;
  data.lastCleanup = new Date().toISOString();

  const removedCount = originalCount - data.runs.length;
  if (removedCount > 0) {
    logger.info(`${LOG_CONTEXT} Cleaned up ${removedCount} old metric runs`);
  }

  return removedCount;
}

// =============================================================================
// Statistics & Analysis
// =============================================================================

/**
 * Get statistics for a specific metric type
 */
export async function getMetricStats(
  type: MetricType,
  projectPath?: string,
  name?: string
): Promise<MetricStats | null> {
  const data = await loadMetricsData(projectPath);

  let runs = data.runs.filter(r => r.type === type);
  if (name) {
    runs = runs.filter(r => r.name === name);
  }

  if (runs.length === 0) {
    return null;
  }

  const successfulRuns = runs.filter(r => r.success);
  const durations = successfulRuns.map(r => r.durationMs);
  const { trend, percent } = calculateTrend(runs);

  return {
    type,
    totalRuns: runs.length,
    successfulRuns: successfulRuns.length,
    failedRuns: runs.length - successfulRuns.length,
    avgDurationMs: average(durations),
    minDurationMs: durations.length > 0 ? Math.min(...durations) : 0,
    maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
    medianDurationMs: median(durations),
    p95DurationMs: percentile(durations, 95),
    lastRun: runs.length > 0
      ? runs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0].startTime
      : undefined,
    trend,
    trendPercent: percent,
  };
}

/**
 * Get statistics broken down by name for a metric type
 */
export async function getNamedMetricStats(
  type: MetricType,
  projectPath?: string
): Promise<NamedMetricStats[]> {
  const data = await loadMetricsData(projectPath);

  const runs = data.runs.filter(r => r.type === type);

  // Group by name
  const byName = new Map<string, PerformanceRun[]>();
  for (const run of runs) {
    if (!byName.has(run.name)) {
      byName.set(run.name, []);
    }
    byName.get(run.name)!.push(run);
  }

  const stats: NamedMetricStats[] = [];
  Array.from(byName.entries()).forEach(([name, nameRuns]) => {
    const successfulRuns = nameRuns.filter(r => r.success);
    const durations = successfulRuns.map(r => r.durationMs);
    const { trend, percent } = calculateTrend(nameRuns);

    stats.push({
      type,
      name,
      totalRuns: nameRuns.length,
      successfulRuns: successfulRuns.length,
      failedRuns: nameRuns.length - successfulRuns.length,
      avgDurationMs: average(durations),
      minDurationMs: durations.length > 0 ? Math.min(...durations) : 0,
      maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
      medianDurationMs: median(durations),
      p95DurationMs: percentile(durations, 95),
      lastRun: nameRuns.length > 0
        ? nameRuns.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0].startTime
        : undefined,
      trend,
      trendPercent: percent,
    });
  });

  // Sort by most recent
  return stats.sort((a, b) => {
    if (!a.lastRun) return 1;
    if (!b.lastRun) return -1;
    return new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime();
  });
}

/**
 * Compare a run to historical data
 */
export async function compareToHistory(
  type: MetricType,
  name: string,
  currentDurationMs: number,
  projectPath?: string,
  recentCount: number = 10
): Promise<RunComparison> {
  const data = await loadMetricsData(projectPath);

  const runs = data.runs
    .filter(r => r.type === type && r.name === name && r.success)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, recentCount);

  if (runs.length === 0) {
    return {
      currentMs: currentDurationMs,
      avgRecentMs: currentDurationMs,
      bestRecentMs: currentDurationMs,
      worstRecentMs: currentDurationMs,
      diffFromAvgMs: 0,
      diffFromAvgPercent: 0,
      isNewRecord: true,
      isSlower: false,
      isFaster: false,
      sampleSize: 0,
    };
  }

  const durations = runs.map(r => r.durationMs);
  const avgRecent = average(durations);
  const bestRecent = Math.min(...durations);
  const worstRecent = Math.max(...durations);
  const diffFromAvg = currentDurationMs - avgRecent;
  const diffFromAvgPercent = avgRecent > 0 ? (diffFromAvg / avgRecent) * 100 : 0;

  return {
    currentMs: currentDurationMs,
    avgRecentMs: avgRecent,
    bestRecentMs: bestRecent,
    worstRecentMs: worstRecent,
    diffFromAvgMs: diffFromAvg,
    diffFromAvgPercent,
    isNewRecord: currentDurationMs < bestRecent,
    isSlower: diffFromAvgPercent > 20,
    isFaster: diffFromAvgPercent < -20,
    sampleSize: runs.length,
  };
}

/**
 * Get a summary of all metrics
 */
export async function getMetricsSummary(projectPath?: string): Promise<MetricsSummary> {
  const data = await loadMetricsData(projectPath);

  const types: MetricType[] = [
    'build', 'test', 'screenshot', 'flow', 'playbook',
    'inspect', 'baseline_compare', 'app_launch', 'simulator_boot'
  ];

  const byType: MetricStats[] = [];
  let mostImproved: MetricsSummary['mostImproved'];
  let needsAttention: MetricsSummary['needsAttention'];

  for (const type of types) {
    const stats = await getMetricStats(type, projectPath);
    if (stats && stats.totalRuns > 0) {
      byType.push(stats);

      // Track most improved
      if (stats.trend === 'improving' && stats.trendPercent < 0) {
        if (!mostImproved || stats.trendPercent < mostImproved.improvement) {
          mostImproved = { type, improvement: stats.trendPercent };
        }
      }

      // Track needs attention
      if (stats.trend === 'degrading' && stats.trendPercent > 0) {
        if (!needsAttention || stats.trendPercent > needsAttention.degradation) {
          needsAttention = { type, degradation: stats.trendPercent };
        }
      }
    }
  }

  const totalOperations = data.runs.length;
  const successfulOperations = data.runs.filter(r => r.success).length;
  const successRate = totalOperations > 0 ? successfulOperations / totalOperations : 1;

  return {
    byType,
    totalOperations,
    successRate,
    mostImproved,
    needsAttention,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get recent runs for a metric type
 */
export async function getRecentRuns(
  type: MetricType,
  projectPath?: string,
  limit: number = 10,
  name?: string
): Promise<PerformanceRun[]> {
  const data = await loadMetricsData(projectPath);

  let runs = data.runs.filter(r => r.type === type);
  if (name) {
    runs = runs.filter(r => r.name === name);
  }

  return runs
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, limit);
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}m ${secs}s`;
  }
}

/**
 * Format a run comparison as markdown
 */
export function formatRunComparison(comparison: RunComparison, type: MetricType, name: string): string {
  const lines: string[] = [];

  if (comparison.sampleSize === 0) {
    lines.push(`### ${type}: ${name}`);
    lines.push(`- Duration: **${formatDuration(comparison.currentMs)}**`);
    lines.push(`- _First recorded run_`);
    return lines.join('\n');
  }

  const icon = comparison.isNewRecord
    ? '🏆'
    : comparison.isFaster
      ? '🚀'
      : comparison.isSlower
        ? '🐢'
        : '✅';

  lines.push(`### ${icon} ${type}: ${name}`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Current | **${formatDuration(comparison.currentMs)}** |`);
  lines.push(`| Average | ${formatDuration(comparison.avgRecentMs)} |`);
  lines.push(`| Best | ${formatDuration(comparison.bestRecentMs)} |`);
  lines.push(`| Worst | ${formatDuration(comparison.worstRecentMs)} |`);

  const diffSign = comparison.diffFromAvgPercent > 0 ? '+' : '';
  lines.push(`| vs Average | ${diffSign}${comparison.diffFromAvgPercent.toFixed(1)}% |`);
  lines.push(`| Sample Size | ${comparison.sampleSize} runs |`);

  if (comparison.isNewRecord) {
    lines.push('');
    lines.push('**New personal best!** 🎉');
  } else if (comparison.isSlower) {
    lines.push('');
    lines.push('⚠️ _Significantly slower than average_');
  } else if (comparison.isFaster) {
    lines.push('');
    lines.push('🚀 _Significantly faster than average_');
  }

  return lines.join('\n');
}

/**
 * Format metric stats as markdown
 */
export function formatMetricStats(stats: MetricStats | NamedMetricStats): string {
  const lines: string[] = [];

  const name = 'name' in stats ? stats.name : stats.type;
  const trendIcon = stats.trend === 'improving'
    ? '📈'
    : stats.trend === 'degrading'
      ? '📉'
      : '➡️';

  lines.push(`### ${trendIcon} ${name}`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Runs | ${stats.totalRuns} |`);
  lines.push(`| Success Rate | ${((stats.successfulRuns / stats.totalRuns) * 100).toFixed(1)}% |`);
  lines.push(`| Average | ${formatDuration(stats.avgDurationMs)} |`);
  lines.push(`| Median | ${formatDuration(stats.medianDurationMs)} |`);
  lines.push(`| Min | ${formatDuration(stats.minDurationMs)} |`);
  lines.push(`| Max | ${formatDuration(stats.maxDurationMs)} |`);
  lines.push(`| P95 | ${formatDuration(stats.p95DurationMs)} |`);

  if (stats.trend !== 'unknown') {
    const trendSign = stats.trendPercent > 0 ? '+' : '';
    lines.push(`| Trend | ${stats.trend} (${trendSign}${stats.trendPercent.toFixed(1)}%) |`);
  }

  return lines.join('\n');
}

/**
 * Format metrics summary as markdown
 */
export function formatMetricsSummary(summary: MetricsSummary): string {
  const lines: string[] = [];

  lines.push('## iOS Performance Metrics Summary');
  lines.push('');

  if (summary.totalOperations === 0) {
    lines.push('_No performance data recorded yet._');
    lines.push('');
    lines.push('Run iOS commands like `/ios.build`, `/ios.test`, `/ios.snapshot` to start tracking metrics.');
    return lines.join('\n');
  }

  // Overview
  lines.push(`- **Total Operations**: ${summary.totalOperations}`);
  lines.push(`- **Success Rate**: ${(summary.successRate * 100).toFixed(1)}%`);
  lines.push('');

  // Highlights
  if (summary.mostImproved) {
    lines.push(`🚀 **Most Improved**: ${summary.mostImproved.type}${summary.mostImproved.name ? ` (${summary.mostImproved.name})` : ''} - ${summary.mostImproved.improvement.toFixed(1)}% faster`);
  }
  if (summary.needsAttention) {
    lines.push(`⚠️ **Needs Attention**: ${summary.needsAttention.type}${summary.needsAttention.name ? ` (${summary.needsAttention.name})` : ''} - ${summary.needsAttention.degradation.toFixed(1)}% slower`);
  }
  if (summary.mostImproved || summary.needsAttention) {
    lines.push('');
  }

  // By type table
  if (summary.byType.length > 0) {
    lines.push('### Metrics by Type');
    lines.push('');
    lines.push('| Type | Runs | Success | Avg | P95 | Trend |');
    lines.push('|------|------|---------|-----|-----|-------|');

    for (const stats of summary.byType) {
      const successRate = ((stats.successfulRuns / stats.totalRuns) * 100).toFixed(0);
      const trendIcon = stats.trend === 'improving'
        ? '📈'
        : stats.trend === 'degrading'
          ? '📉'
          : '➡️';
      lines.push(`| ${stats.type} | ${stats.totalRuns} | ${successRate}% | ${formatDuration(stats.avgDurationMs)} | ${formatDuration(stats.p95DurationMs)} | ${trendIcon} |`);
    }
  }

  return lines.join('\n');
}

/**
 * Format metrics as JSON
 */
export function formatMetricsAsJson(summary: MetricsSummary): string {
  return JSON.stringify(summary, null, 2);
}

/**
 * Format a compact metrics line
 */
export function formatMetricsCompact(summary: MetricsSummary): string {
  if (summary.totalOperations === 0) {
    return 'No metrics recorded';
  }

  const parts = summary.byType.map(s =>
    `${s.type}=${formatDuration(s.avgDurationMs)}`
  );

  return `${summary.totalOperations} ops | ${(summary.successRate * 100).toFixed(0)}% success | ${parts.join(', ')}`;
}
