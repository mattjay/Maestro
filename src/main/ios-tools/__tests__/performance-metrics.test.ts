/**
 * Performance Metrics Module Tests
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, mkdirSync, rmSync } from 'fs';
import * as os from 'os';
import {
  // Constants
  METRICS_VERSION,
  METRICS_DIRECTORY,
  METRICS_FILENAME,
  MAX_RUNS_PER_METRIC,
  MAX_RUN_AGE_DAYS,
  // Types
  MetricType,
  PerformanceRun,
  MetricStats,
  NamedMetricStats,
  RunComparison,
  MetricsSummary,
  PerformanceMetricsData,
  RecordMetricOptions,
  // Utility functions
  getMetricsPath,
  generateRunId,
  createDefaultMetricsData,
  // Data persistence
  loadMetricsData,
  saveMetricsData,
  clearMetricsCache,
  clearMetricsData,
  // Recording operations
  recordMetric,
  recordBuildTime,
  recordTestTime,
  recordScreenshotTime,
  recordFlowTime,
  recordPlaybookTime,
  recordInspectTime,
  recordBaselineCompareTime,
  recordAppLaunchTime,
  recordSimulatorBootTime,
  // Cleanup
  cleanupOldRuns,
  // Statistics & Analysis
  getMetricStats,
  getNamedMetricStats,
  compareToHistory,
  getMetricsSummary,
  getRecentRuns,
  // Formatting
  formatDuration,
  formatRunComparison,
  formatMetricStats,
  formatMetricsSummary,
  formatMetricsAsJson,
  formatMetricsCompact,
} from '../performance-metrics';

// Test directory
const TEST_DIR = path.join(os.tmpdir(), 'ios-performance-metrics-test');

describe('Performance Metrics Module', () => {
  beforeEach(async () => {
    // Clear cache before each test
    clearMetricsCache();

    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  // ===========================================================================
  // Constants Tests
  // ===========================================================================

  describe('Constants', () => {
    test('METRICS_VERSION is defined', () => {
      expect(METRICS_VERSION).toBe('1.0.0');
    });

    test('METRICS_DIRECTORY is defined', () => {
      expect(METRICS_DIRECTORY).toBe('.maestro');
    });

    test('METRICS_FILENAME is defined', () => {
      expect(METRICS_FILENAME).toBe('ios-performance-metrics.json');
    });

    test('MAX_RUNS_PER_METRIC is reasonable', () => {
      expect(MAX_RUNS_PER_METRIC).toBeGreaterThan(0);
      expect(MAX_RUNS_PER_METRIC).toBeLessThanOrEqual(1000);
    });

    test('MAX_RUN_AGE_DAYS is reasonable', () => {
      expect(MAX_RUN_AGE_DAYS).toBeGreaterThan(0);
      expect(MAX_RUN_AGE_DAYS).toBeLessThanOrEqual(365);
    });
  });

  // ===========================================================================
  // Utility Function Tests
  // ===========================================================================

  describe('Utility Functions', () => {
    describe('getMetricsPath', () => {
      test('returns home directory path when no project path', () => {
        const result = getMetricsPath();
        expect(result).toContain(os.homedir());
        expect(result).toContain(METRICS_DIRECTORY);
        expect(result).toContain(METRICS_FILENAME);
      });

      test('returns project path when provided', () => {
        const projectPath = '/some/project';
        const result = getMetricsPath(projectPath);
        expect(result).toBe(path.join(projectPath, METRICS_DIRECTORY, METRICS_FILENAME));
      });
    });

    describe('generateRunId', () => {
      test('generates unique IDs', () => {
        const id1 = generateRunId();
        const id2 = generateRunId();
        expect(id1).not.toBe(id2);
      });

      test('generates IDs with expected format', () => {
        const id = generateRunId();
        expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
      });
    });

    describe('createDefaultMetricsData', () => {
      test('creates data with correct version', () => {
        const data = createDefaultMetricsData();
        expect(data.version).toBe(METRICS_VERSION);
      });

      test('creates data with empty runs', () => {
        const data = createDefaultMetricsData();
        expect(data.runs).toEqual([]);
      });

      test('includes project path when provided', () => {
        const projectPath = '/test/project';
        const data = createDefaultMetricsData(projectPath);
        expect(data.projectPath).toBe(projectPath);
      });
    });
  });

  // ===========================================================================
  // Data Persistence Tests
  // ===========================================================================

  describe('Data Persistence', () => {
    describe('loadMetricsData', () => {
      test('returns default data when file does not exist', async () => {
        const data = await loadMetricsData(TEST_DIR);
        expect(data.version).toBe(METRICS_VERSION);
        expect(data.runs).toEqual([]);
      });

      test('loads existing data from file', async () => {
        const metricsDir = path.join(TEST_DIR, METRICS_DIRECTORY);
        mkdirSync(metricsDir, { recursive: true });

        const testData: PerformanceMetricsData = {
          version: METRICS_VERSION,
          runs: [
            {
              id: 'test-1',
              type: 'build',
              name: 'TestScheme',
              durationMs: 1000,
              success: true,
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
            },
          ],
        };

        await fs.writeFile(
          path.join(metricsDir, METRICS_FILENAME),
          JSON.stringify(testData)
        );

        clearMetricsCache();
        const data = await loadMetricsData(TEST_DIR);
        expect(data.runs).toHaveLength(1);
        expect(data.runs[0].name).toBe('TestScheme');
      });

      test('uses cache on subsequent calls', async () => {
        const data1 = await loadMetricsData(TEST_DIR);
        data1.runs.push({
          id: 'cached-run',
          type: 'test',
          name: 'CachedTest',
          durationMs: 500,
          success: true,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        });

        const data2 = await loadMetricsData(TEST_DIR);
        expect(data2.runs).toHaveLength(1);
        expect(data2.runs[0].id).toBe('cached-run');
      });
    });

    describe('saveMetricsData', () => {
      test('saves data to file', async () => {
        const data: PerformanceMetricsData = {
          version: METRICS_VERSION,
          runs: [
            {
              id: 'save-test',
              type: 'screenshot',
              name: 'TestScreen',
              durationMs: 250,
              success: true,
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
            },
          ],
        };

        await saveMetricsData(data, TEST_DIR);

        const filePath = path.join(TEST_DIR, METRICS_DIRECTORY, METRICS_FILENAME);
        expect(existsSync(filePath)).toBe(true);

        const content = await fs.readFile(filePath, 'utf-8');
        const loaded = JSON.parse(content);
        expect(loaded.runs[0].id).toBe('save-test');
      });

      test('creates directory if it does not exist', async () => {
        const newDir = path.join(TEST_DIR, 'new-project');
        const data: PerformanceMetricsData = {
          version: METRICS_VERSION,
          runs: [],
        };

        await saveMetricsData(data, newDir);

        const filePath = path.join(newDir, METRICS_DIRECTORY, METRICS_FILENAME);
        expect(existsSync(filePath)).toBe(true);
      });
    });

    describe('clearMetricsData', () => {
      test('removes metrics file', async () => {
        const data: PerformanceMetricsData = {
          version: METRICS_VERSION,
          runs: [],
        };
        await saveMetricsData(data, TEST_DIR);

        const filePath = getMetricsPath(TEST_DIR);
        expect(existsSync(filePath)).toBe(true);

        await clearMetricsData(TEST_DIR);
        expect(existsSync(filePath)).toBe(false);
      });

      test('handles non-existent file gracefully', async () => {
        await expect(clearMetricsData(TEST_DIR)).resolves.not.toThrow();
      });
    });
  });

  // ===========================================================================
  // Recording Operations Tests
  // ===========================================================================

  describe('Recording Operations', () => {
    describe('recordMetric', () => {
      test('records a metric and returns the run', async () => {
        const options: RecordMetricOptions = {
          type: 'build',
          name: 'MyApp',
          durationMs: 5000,
          success: true,
        };

        const run = await recordMetric(options, TEST_DIR);

        expect(run.type).toBe('build');
        expect(run.name).toBe('MyApp');
        expect(run.durationMs).toBe(5000);
        expect(run.success).toBe(true);
        expect(run.id).toBeDefined();
        expect(run.startTime).toBeDefined();
        expect(run.endTime).toBeDefined();
      });

      test('includes metadata when provided', async () => {
        const options: RecordMetricOptions = {
          type: 'test',
          name: 'UnitTests',
          durationMs: 3000,
          success: true,
          metadata: { testsRun: 50, testsFailed: 2 },
        };

        const run = await recordMetric(options, TEST_DIR);
        expect(run.metadata).toEqual({ testsRun: 50, testsFailed: 2 });
      });

      test('uses provided startTime', async () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const options: RecordMetricOptions = {
          type: 'flow',
          name: 'LoginFlow',
          durationMs: 2000,
          success: true,
          startTime,
        };

        const run = await recordMetric(options, TEST_DIR);
        expect(run.startTime).toBe(startTime.toISOString());
      });
    });

    describe('Convenience recording functions', () => {
      test('recordBuildTime', async () => {
        const run = await recordBuildTime('MyScheme', 10000, true, TEST_DIR);
        expect(run.type).toBe('build');
        expect(run.name).toBe('MyScheme');
        expect(run.durationMs).toBe(10000);
      });

      test('recordTestTime', async () => {
        const run = await recordTestTime('AllTests', 5000, true, TEST_DIR);
        expect(run.type).toBe('test');
        expect(run.name).toBe('AllTests');
      });

      test('recordScreenshotTime', async () => {
        const run = await recordScreenshotTime('HomeScreen', 500, true, TEST_DIR);
        expect(run.type).toBe('screenshot');
        expect(run.name).toBe('HomeScreen');
      });

      test('recordFlowTime', async () => {
        const run = await recordFlowTime('CheckoutFlow', 8000, true, TEST_DIR);
        expect(run.type).toBe('flow');
        expect(run.name).toBe('CheckoutFlow');
      });

      test('recordPlaybookTime', async () => {
        const run = await recordPlaybookTime('FeatureShipLoop', 60000, true, TEST_DIR);
        expect(run.type).toBe('playbook');
        expect(run.name).toBe('FeatureShipLoop');
      });

      test('recordInspectTime', async () => {
        const run = await recordInspectTime('FullInspect', 1500, true, TEST_DIR);
        expect(run.type).toBe('inspect');
        expect(run.name).toBe('FullInspect');
      });

      test('recordBaselineCompareTime', async () => {
        const run = await recordBaselineCompareTime('LoginBaseline', 200, true, TEST_DIR);
        expect(run.type).toBe('baseline_compare');
        expect(run.name).toBe('LoginBaseline');
      });

      test('recordAppLaunchTime', async () => {
        const run = await recordAppLaunchTime('com.example.app', 1200, true, TEST_DIR);
        expect(run.type).toBe('app_launch');
        expect(run.name).toBe('com.example.app');
      });

      test('recordSimulatorBootTime', async () => {
        const run = await recordSimulatorBootTime('iPhone 15 Pro', 8000, true, TEST_DIR);
        expect(run.type).toBe('simulator_boot');
        expect(run.name).toBe('iPhone 15 Pro');
      });
    });
  });

  // ===========================================================================
  // Cleanup Tests
  // ===========================================================================

  describe('Cleanup', () => {
    describe('cleanupOldRuns', () => {
      test('removes runs older than MAX_RUN_AGE_DAYS', async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - MAX_RUN_AGE_DAYS - 10);

        const data: PerformanceMetricsData = {
          version: METRICS_VERSION,
          runs: [
            {
              id: 'old-run',
              type: 'build',
              name: 'OldBuild',
              durationMs: 1000,
              success: true,
              startTime: oldDate.toISOString(),
              endTime: oldDate.toISOString(),
            },
            {
              id: 'new-run',
              type: 'build',
              name: 'NewBuild',
              durationMs: 1000,
              success: true,
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
            },
          ],
        };

        const removed = await cleanupOldRuns(data);

        expect(removed).toBe(1);
        expect(data.runs).toHaveLength(1);
        expect(data.runs[0].id).toBe('new-run');
      });

      test('keeps only MAX_RUNS_PER_METRIC per type/name', async () => {
        const runs: PerformanceRun[] = [];
        for (let i = 0; i < MAX_RUNS_PER_METRIC + 50; i++) {
          runs.push({
            id: `run-${i}`,
            type: 'build',
            name: 'TestScheme',
            durationMs: 1000,
            success: true,
            startTime: new Date(Date.now() - i * 60000).toISOString(), // 1 minute apart
            endTime: new Date(Date.now() - i * 60000 + 1000).toISOString(),
          });
        }

        const data: PerformanceMetricsData = {
          version: METRICS_VERSION,
          runs,
        };

        await cleanupOldRuns(data);

        expect(data.runs.length).toBeLessThanOrEqual(MAX_RUNS_PER_METRIC);
      });

      test('sets lastCleanup timestamp', async () => {
        const data: PerformanceMetricsData = {
          version: METRICS_VERSION,
          runs: [],
        };

        await cleanupOldRuns(data);
        expect(data.lastCleanup).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // Statistics & Analysis Tests
  // ===========================================================================

  describe('Statistics & Analysis', () => {
    beforeEach(async () => {
      // Add some test data
      await recordBuildTime('AppBuild', 10000, true, TEST_DIR);
      await recordBuildTime('AppBuild', 11000, true, TEST_DIR);
      await recordBuildTime('AppBuild', 9500, true, TEST_DIR);
      await recordBuildTime('AppBuild', 10500, true, TEST_DIR);
      await recordBuildTime('AppBuild', 12000, false, TEST_DIR);

      await recordTestTime('UnitTests', 5000, true, TEST_DIR);
      await recordTestTime('UnitTests', 5200, true, TEST_DIR);
      await recordTestTime('IntegrationTests', 15000, true, TEST_DIR);

      await recordScreenshotTime('HomeScreen', 500, true, TEST_DIR);
      await recordScreenshotTime('HomeScreen', 450, true, TEST_DIR);
    });

    describe('getMetricStats', () => {
      test('returns null for non-existent metric type', async () => {
        const stats = await getMetricStats('playbook', TEST_DIR);
        expect(stats).toBeNull();
      });

      test('returns stats for existing metric type', async () => {
        const stats = await getMetricStats('build', TEST_DIR);

        expect(stats).not.toBeNull();
        expect(stats!.type).toBe('build');
        expect(stats!.totalRuns).toBe(5);
        expect(stats!.successfulRuns).toBe(4);
        expect(stats!.failedRuns).toBe(1);
      });

      test('calculates correct average', async () => {
        const stats = await getMetricStats('build', TEST_DIR);
        // (10000 + 11000 + 9500 + 10500) / 4 = 10250
        expect(stats!.avgDurationMs).toBe(10250);
      });

      test('calculates correct min and max', async () => {
        const stats = await getMetricStats('build', TEST_DIR);
        expect(stats!.minDurationMs).toBe(9500);
        expect(stats!.maxDurationMs).toBe(11000);
      });

      test('filters by name when provided', async () => {
        const stats = await getMetricStats('test', TEST_DIR, 'UnitTests');

        expect(stats!.totalRuns).toBe(2);
        expect(stats!.avgDurationMs).toBe(5100);
      });
    });

    describe('getNamedMetricStats', () => {
      test('returns stats grouped by name', async () => {
        const stats = await getNamedMetricStats('test', TEST_DIR);

        expect(stats).toHaveLength(2);
        const names = stats.map(s => s.name);
        expect(names).toContain('UnitTests');
        expect(names).toContain('IntegrationTests');
      });

      test('includes name in each stat', async () => {
        const stats = await getNamedMetricStats('test', TEST_DIR);
        const unitTests = stats.find(s => s.name === 'UnitTests');

        expect(unitTests).toBeDefined();
        expect(unitTests!.totalRuns).toBe(2);
      });
    });

    describe('compareToHistory', () => {
      test('returns comparison for existing runs', async () => {
        const comparison = await compareToHistory('build', 'AppBuild', 10000, TEST_DIR);

        expect(comparison.currentMs).toBe(10000);
        expect(comparison.avgRecentMs).toBe(10250);
        expect(comparison.sampleSize).toBe(4); // Only successful runs
      });

      test('identifies new records', async () => {
        const comparison = await compareToHistory('build', 'AppBuild', 8000, TEST_DIR);
        expect(comparison.isNewRecord).toBe(true);
      });

      test('identifies slower runs', async () => {
        // Average is 10250, 20% slower would be 12300
        const comparison = await compareToHistory('build', 'AppBuild', 15000, TEST_DIR);
        expect(comparison.isSlower).toBe(true);
      });

      test('identifies faster runs', async () => {
        // Average is 10250, 20% faster would be 8200
        const comparison = await compareToHistory('build', 'AppBuild', 7000, TEST_DIR);
        expect(comparison.isFaster).toBe(true);
      });

      test('handles first run gracefully', async () => {
        const comparison = await compareToHistory('flow', 'NewFlow', 5000, TEST_DIR);

        expect(comparison.sampleSize).toBe(0);
        expect(comparison.isNewRecord).toBe(true);
        expect(comparison.currentMs).toBe(5000);
        expect(comparison.avgRecentMs).toBe(5000);
      });
    });

    describe('getMetricsSummary', () => {
      test('returns summary with all types', async () => {
        const summary = await getMetricsSummary(TEST_DIR);

        expect(summary.totalOperations).toBe(10); // 5 builds + 3 tests + 2 screenshots
        expect(summary.byType.length).toBeGreaterThan(0);
      });

      test('calculates overall success rate', async () => {
        const summary = await getMetricsSummary(TEST_DIR);
        // 9 successful out of 10
        expect(summary.successRate).toBe(0.9);
      });

      test('includes lastUpdated timestamp', async () => {
        const summary = await getMetricsSummary(TEST_DIR);
        expect(summary.lastUpdated).toBeDefined();
      });
    });

    describe('getRecentRuns', () => {
      test('returns most recent runs', async () => {
        const runs = await getRecentRuns('build', TEST_DIR, 3);

        expect(runs.length).toBe(3);
        // Should be sorted by most recent first
        expect(new Date(runs[0].startTime).getTime())
          .toBeGreaterThanOrEqual(new Date(runs[1].startTime).getTime());
      });

      test('filters by name', async () => {
        const runs = await getRecentRuns('test', TEST_DIR, 10, 'UnitTests');
        expect(runs.length).toBe(2);
        expect(runs.every(r => r.name === 'UnitTests')).toBe(true);
      });

      test('respects limit', async () => {
        const runs = await getRecentRuns('build', TEST_DIR, 2);
        expect(runs.length).toBe(2);
      });
    });
  });

  // ===========================================================================
  // Formatting Tests
  // ===========================================================================

  describe('Formatting', () => {
    describe('formatDuration', () => {
      test('formats milliseconds', () => {
        expect(formatDuration(500)).toBe('500ms');
        expect(formatDuration(999)).toBe('999ms');
      });

      test('formats seconds', () => {
        expect(formatDuration(1000)).toBe('1.0s');
        expect(formatDuration(5500)).toBe('5.5s');
        expect(formatDuration(59999)).toBe('60.0s');
      });

      test('formats minutes and seconds', () => {
        expect(formatDuration(60000)).toBe('1m 0s');
        expect(formatDuration(90000)).toBe('1m 30s');
        expect(formatDuration(125000)).toBe('2m 5s');
      });
    });

    describe('formatRunComparison', () => {
      test('formats first run message', () => {
        const comparison: RunComparison = {
          currentMs: 5000,
          avgRecentMs: 5000,
          bestRecentMs: 5000,
          worstRecentMs: 5000,
          diffFromAvgMs: 0,
          diffFromAvgPercent: 0,
          isNewRecord: true,
          isSlower: false,
          isFaster: false,
          sampleSize: 0,
        };

        const result = formatRunComparison(comparison, 'build', 'TestApp');
        expect(result).toContain('build');
        expect(result).toContain('TestApp');
        expect(result).toContain('First recorded run');
      });

      test('includes new record message', () => {
        const comparison: RunComparison = {
          currentMs: 4000,
          avgRecentMs: 5000,
          bestRecentMs: 4500,
          worstRecentMs: 5500,
          diffFromAvgMs: -1000,
          diffFromAvgPercent: -20,
          isNewRecord: true,
          isSlower: false,
          isFaster: true,
          sampleSize: 5,
        };

        const result = formatRunComparison(comparison, 'build', 'FastBuild');
        expect(result).toContain('New personal best');
        expect(result).toContain('🏆');
      });

      test('includes slower warning', () => {
        const comparison: RunComparison = {
          currentMs: 7000,
          avgRecentMs: 5000,
          bestRecentMs: 4500,
          worstRecentMs: 5500,
          diffFromAvgMs: 2000,
          diffFromAvgPercent: 40,
          isNewRecord: false,
          isSlower: true,
          isFaster: false,
          sampleSize: 5,
        };

        const result = formatRunComparison(comparison, 'build', 'SlowBuild');
        expect(result).toContain('Significantly slower');
        expect(result).toContain('🐢');
      });
    });

    describe('formatMetricStats', () => {
      test('formats stats as markdown table', () => {
        const stats: MetricStats = {
          type: 'build',
          totalRuns: 10,
          successfulRuns: 9,
          failedRuns: 1,
          avgDurationMs: 10000,
          minDurationMs: 8000,
          maxDurationMs: 12000,
          medianDurationMs: 10000,
          p95DurationMs: 11500,
          trend: 'stable',
          trendPercent: 2,
        };

        const result = formatMetricStats(stats);
        expect(result).toContain('Total Runs');
        expect(result).toContain('10');
        expect(result).toContain('Success Rate');
        expect(result).toContain('90.0%');
        expect(result).toContain('Average');
      });

      test('includes trend information', () => {
        const stats: MetricStats = {
          type: 'test',
          totalRuns: 20,
          successfulRuns: 20,
          failedRuns: 0,
          avgDurationMs: 5000,
          minDurationMs: 4000,
          maxDurationMs: 6000,
          medianDurationMs: 5000,
          p95DurationMs: 5800,
          trend: 'improving',
          trendPercent: -15,
        };

        const result = formatMetricStats(stats);
        expect(result).toContain('Trend');
        expect(result).toContain('improving');
        expect(result).toContain('📈');
      });
    });

    describe('formatMetricsSummary', () => {
      test('shows message for empty data', () => {
        const summary: MetricsSummary = {
          byType: [],
          totalOperations: 0,
          successRate: 1,
          lastUpdated: new Date().toISOString(),
        };

        const result = formatMetricsSummary(summary);
        expect(result).toContain('No performance data recorded');
      });

      test('formats summary with data', () => {
        const summary: MetricsSummary = {
          byType: [
            {
              type: 'build',
              totalRuns: 10,
              successfulRuns: 9,
              failedRuns: 1,
              avgDurationMs: 10000,
              minDurationMs: 8000,
              maxDurationMs: 12000,
              medianDurationMs: 10000,
              p95DurationMs: 11500,
              trend: 'stable',
              trendPercent: 0,
            },
          ],
          totalOperations: 10,
          successRate: 0.9,
          mostImproved: { type: 'build', improvement: -20 },
          lastUpdated: new Date().toISOString(),
        };

        const result = formatMetricsSummary(summary);
        expect(result).toContain('Performance Metrics Summary');
        expect(result).toContain('Total Operations');
        expect(result).toContain('10');
        expect(result).toContain('Success Rate');
        expect(result).toContain('Most Improved');
      });
    });

    describe('formatMetricsAsJson', () => {
      test('returns valid JSON', () => {
        const summary: MetricsSummary = {
          byType: [],
          totalOperations: 5,
          successRate: 1,
          lastUpdated: new Date().toISOString(),
        };

        const result = formatMetricsAsJson(summary);
        const parsed = JSON.parse(result);
        expect(parsed.totalOperations).toBe(5);
      });
    });

    describe('formatMetricsCompact', () => {
      test('formats empty data', () => {
        const summary: MetricsSummary = {
          byType: [],
          totalOperations: 0,
          successRate: 1,
          lastUpdated: new Date().toISOString(),
        };

        const result = formatMetricsCompact(summary);
        expect(result).toBe('No metrics recorded');
      });

      test('formats data in single line', () => {
        const summary: MetricsSummary = {
          byType: [
            {
              type: 'build',
              totalRuns: 10,
              successfulRuns: 9,
              failedRuns: 1,
              avgDurationMs: 10000,
              minDurationMs: 8000,
              maxDurationMs: 12000,
              medianDurationMs: 10000,
              p95DurationMs: 11500,
              trend: 'stable',
              trendPercent: 0,
            },
          ],
          totalOperations: 10,
          successRate: 0.9,
          lastUpdated: new Date().toISOString(),
        };

        const result = formatMetricsCompact(summary);
        expect(result).toContain('10 ops');
        expect(result).toContain('90% success');
        expect(result).toContain('build=');
      });
    });
  });

  // ===========================================================================
  // Trend Calculation Tests
  // ===========================================================================

  describe('Trend Calculation', () => {
    beforeEach(() => {
      clearMetricsCache();
    });

    test('detects improving trend when newer runs are faster', async () => {
      // Old runs (slower)
      for (let i = 0; i < 5; i++) {
        const run: PerformanceRun = {
          id: `old-${i}`,
          type: 'build',
          name: 'TrendTest',
          durationMs: 15000 + i * 100, // 15000-15400
          success: true,
          startTime: new Date(Date.now() - (10 - i) * 86400000).toISOString(), // 10-6 days ago
          endTime: new Date(Date.now() - (10 - i) * 86400000 + 15000).toISOString(),
        };
        const data = await loadMetricsData(TEST_DIR);
        data.runs.push(run);
        await saveMetricsData(data, TEST_DIR);
      }

      // New runs (faster)
      for (let i = 0; i < 5; i++) {
        const run: PerformanceRun = {
          id: `new-${i}`,
          type: 'build',
          name: 'TrendTest',
          durationMs: 10000 + i * 100, // 10000-10400
          success: true,
          startTime: new Date(Date.now() - (5 - i) * 86400000).toISOString(), // 5-1 days ago
          endTime: new Date(Date.now() - (5 - i) * 86400000 + 10000).toISOString(),
        };
        const data = await loadMetricsData(TEST_DIR);
        data.runs.push(run);
        await saveMetricsData(data, TEST_DIR);
      }

      clearMetricsCache();
      const stats = await getMetricStats('build', TEST_DIR, 'TrendTest');
      expect(stats!.trend).toBe('improving');
      expect(stats!.trendPercent).toBeLessThan(-10);
    });

    test('detects degrading trend when newer runs are slower', async () => {
      // Old runs (faster)
      for (let i = 0; i < 5; i++) {
        const run: PerformanceRun = {
          id: `old-${i}`,
          type: 'build',
          name: 'DegradingTest',
          durationMs: 8000 + i * 100,
          success: true,
          startTime: new Date(Date.now() - (10 - i) * 86400000).toISOString(),
          endTime: new Date(Date.now() - (10 - i) * 86400000 + 8000).toISOString(),
        };
        const data = await loadMetricsData(TEST_DIR);
        data.runs.push(run);
        await saveMetricsData(data, TEST_DIR);
      }

      // New runs (slower)
      for (let i = 0; i < 5; i++) {
        const run: PerformanceRun = {
          id: `new-${i}`,
          type: 'build',
          name: 'DegradingTest',
          durationMs: 12000 + i * 100,
          success: true,
          startTime: new Date(Date.now() - (5 - i) * 86400000).toISOString(),
          endTime: new Date(Date.now() - (5 - i) * 86400000 + 12000).toISOString(),
        };
        const data = await loadMetricsData(TEST_DIR);
        data.runs.push(run);
        await saveMetricsData(data, TEST_DIR);
      }

      clearMetricsCache();
      const stats = await getMetricStats('build', TEST_DIR, 'DegradingTest');
      expect(stats!.trend).toBe('degrading');
      expect(stats!.trendPercent).toBeGreaterThan(10);
    });

    test('returns unknown trend with insufficient data', async () => {
      await recordBuildTime('FewRuns', 10000, true, TEST_DIR);
      await recordBuildTime('FewRuns', 10500, true, TEST_DIR);

      const stats = await getMetricStats('build', TEST_DIR, 'FewRuns');
      expect(stats!.trend).toBe('unknown');
    });
  });
});
