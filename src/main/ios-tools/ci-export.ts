/**
 * iOS Tools - CI Export Module
 *
 * Exports visual regression test results in formats consumable by CI systems.
 * Supports:
 * - JUnit XML format (Jenkins, CircleCI, GitHub Actions, etc.)
 * - JSON format (programmatic consumption)
 * - Artifact bundle generation (zip files with images + reports)
 *
 * @example
 * ```typescript
 * // Export to JUnit XML
 * const xmlResult = await exportToJUnitXML(entries, {
 *   outputPath: './test-results/visual-regression.xml',
 *   suiteName: 'Visual Regression',
 * });
 *
 * // Export to JSON
 * const jsonResult = await exportToJSON(entries, {
 *   outputPath: './test-results/results.json',
 *   pretty: true,
 * });
 *
 * // Generate artifact bundle
 * const bundleResult = await generateArtifactBundle(entries, {
 *   outputPath: './artifacts/visual-regression.zip',
 *   includeImages: true,
 *   includeReport: true,
 * });
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { RegressionEntry } from './diff-formatter';
import type { DeviceFamily } from './baselines/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Common options for all export formats.
 */
export interface CIExportOptions {
  /** Output file path */
  outputPath: string;
  /** Project name for report headers */
  projectName?: string;
  /** Device family filter applied */
  deviceFamily?: DeviceFamily;
  /** Comparison threshold used */
  threshold?: number;
  /** Test execution timestamp */
  timestamp?: Date;
  /** Total execution duration in milliseconds */
  durationMs?: number;
}

/**
 * Options for JUnit XML export.
 */
export interface JUnitExportOptions extends CIExportOptions {
  /** Test suite name */
  suiteName?: string;
  /** Package name for test cases */
  packageName?: string;
  /** Hostname where tests ran */
  hostname?: string;
  /** Include image paths in failure messages */
  includeImagePaths?: boolean;
  /** Include similarity percentages in test names */
  includeSimilarity?: boolean;
}

/**
 * Options for JSON export.
 */
export interface JSONExportOptions extends CIExportOptions {
  /** Pretty print JSON with indentation */
  pretty?: boolean;
  /** Indentation size (default: 2) */
  indent?: number;
  /** Include full image paths */
  includeImagePaths?: boolean;
  /** Include analysis details (changed regions, etc.) */
  includeAnalysis?: boolean;
  /** Include metadata for each baseline */
  includeMetadata?: boolean;
}

/**
 * Options for artifact bundle generation.
 */
export interface ArtifactBundleOptions extends CIExportOptions {
  /** Include baseline images */
  includeBaselineImages?: boolean;
  /** Include current images */
  includeCurrentImages?: boolean;
  /** Include diff images */
  includeDiffImages?: boolean;
  /** Include HTML report */
  includeHtmlReport?: boolean;
  /** Include JUnit XML */
  includeJUnitXml?: boolean;
  /** Include JSON results */
  includeJson?: boolean;
  /** Format: 'directory' creates a folder, 'zip' creates a compressed archive */
  format?: 'directory' | 'zip';
  /** Custom report title */
  reportTitle?: string;
}

/**
 * Result of an export operation.
 */
export interface ExportResult {
  /** Whether export succeeded */
  success: boolean;
  /** Output path */
  outputPath: string;
  /** File size in bytes */
  fileSize: number;
  /** Number of entries exported */
  entryCount: number;
  /** Format that was exported */
  format: 'junit-xml' | 'json' | 'artifact-bundle';
  /** Error message if failed */
  error?: string;
}

/**
 * Summary statistics for exports.
 */
export interface ExportSummary {
  /** Total test cases */
  total: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Tests with errors */
  errors: number;
  /** Skipped tests */
  skipped: number;
  /** Updated baselines */
  updated: number;
  /** Pass rate (0-100) */
  passRate: number;
  /** Total execution time in seconds */
  timeSeconds: number;
}

/**
 * CI system environment info.
 */
export interface CIEnvironment {
  /** CI system name */
  name: string;
  /** Build number */
  buildNumber?: string;
  /** Build URL */
  buildUrl?: string;
  /** Branch name */
  branch?: string;
  /** Commit SHA */
  commitSha?: string;
  /** Pull request number */
  pullRequest?: string;
  /** Job name */
  jobName?: string;
}

/**
 * JSON export structure.
 */
export interface JSONExportData {
  /** Metadata */
  meta: {
    version: string;
    generator: string;
    timestamp: string;
    projectName?: string;
    deviceFamily?: DeviceFamily;
    threshold?: number;
    durationMs?: number;
    ciEnvironment?: CIEnvironment;
  };
  /** Summary statistics */
  summary: ExportSummary;
  /** Test results */
  results: JSONTestResult[];
}

/**
 * Single test result in JSON format.
 */
export interface JSONTestResult {
  /** Baseline name */
  name: string;
  /** Test status */
  status: 'passed' | 'failed' | 'error' | 'skipped' | 'updated';
  /** Similarity percentage (0-100) */
  similarity: number;
  /** Diff percentage */
  diffPercent: number;
  /** Number of changed pixels */
  diffPixels: number;
  /** Number of changed regions */
  changedRegions: number;
  /** Execution time in milliseconds */
  durationMs: number;
  /** Error message if any */
  error?: string;
  /** Image paths */
  paths?: {
    baseline: string;
    current: string;
    diff?: string;
  };
  /** Analysis details */
  analysis?: {
    changes: Array<{
      type: string;
      severity: number;
      bounds: { x: number; y: number; width: number; height: number };
      pixelCount: number;
      description?: string;
    }>;
  };
  /** Baseline metadata */
  metadata?: {
    createdAt: string;
    updatedAt: string;
    deviceFamily?: DeviceFamily;
    tags?: string[];
  };
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Export format version for JSON output.
 */
export const EXPORT_FORMAT_VERSION = '1.0.0';

/**
 * Generator name for reports.
 */
export const GENERATOR_NAME = 'Maestro iOS Visual Regression';

/**
 * Default test suite name.
 */
export const DEFAULT_SUITE_NAME = 'Visual Regression Tests';

/**
 * Default package name for JUnit.
 */
export const DEFAULT_PACKAGE_NAME = 'ios.visualregression';

// =============================================================================
// CI Environment Detection
// =============================================================================

/**
 * Detect the CI environment from environment variables.
 *
 * Supports:
 * - GitHub Actions
 * - CircleCI
 * - Jenkins
 * - GitLab CI
 * - Travis CI
 * - Azure Pipelines
 * - Bitbucket Pipelines
 * - Buildkite
 *
 * @returns CI environment info or undefined if not in CI
 */
export function detectCIEnvironment(): CIEnvironment | undefined {
  // GitHub Actions
  if (process.env.GITHUB_ACTIONS === 'true') {
    return {
      name: 'GitHub Actions',
      buildNumber: process.env.GITHUB_RUN_NUMBER,
      buildUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : undefined,
      branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME,
      commitSha: process.env.GITHUB_SHA,
      pullRequest: process.env.GITHUB_EVENT_NAME === 'pull_request'
        ? process.env.GITHUB_REF?.split('/')[2]
        : undefined,
      jobName: process.env.GITHUB_JOB,
    };
  }

  // CircleCI
  if (process.env.CIRCLECI === 'true') {
    return {
      name: 'CircleCI',
      buildNumber: process.env.CIRCLE_BUILD_NUM,
      buildUrl: process.env.CIRCLE_BUILD_URL,
      branch: process.env.CIRCLE_BRANCH,
      commitSha: process.env.CIRCLE_SHA1,
      pullRequest: process.env.CIRCLE_PULL_REQUEST
        ? process.env.CIRCLE_PULL_REQUEST.split('/').pop()
        : undefined,
      jobName: process.env.CIRCLE_JOB,
    };
  }

  // Jenkins
  if (process.env.JENKINS_URL) {
    return {
      name: 'Jenkins',
      buildNumber: process.env.BUILD_NUMBER,
      buildUrl: process.env.BUILD_URL,
      branch: process.env.GIT_BRANCH || process.env.BRANCH_NAME,
      commitSha: process.env.GIT_COMMIT,
      pullRequest: process.env.CHANGE_ID,
      jobName: process.env.JOB_NAME,
    };
  }

  // GitLab CI
  if (process.env.GITLAB_CI === 'true') {
    return {
      name: 'GitLab CI',
      buildNumber: process.env.CI_PIPELINE_ID,
      buildUrl: process.env.CI_PIPELINE_URL,
      branch: process.env.CI_COMMIT_BRANCH || process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME,
      commitSha: process.env.CI_COMMIT_SHA,
      pullRequest: process.env.CI_MERGE_REQUEST_IID,
      jobName: process.env.CI_JOB_NAME,
    };
  }

  // Travis CI
  if (process.env.TRAVIS === 'true') {
    return {
      name: 'Travis CI',
      buildNumber: process.env.TRAVIS_BUILD_NUMBER,
      buildUrl: process.env.TRAVIS_BUILD_WEB_URL,
      branch: process.env.TRAVIS_PULL_REQUEST_BRANCH || process.env.TRAVIS_BRANCH,
      commitSha: process.env.TRAVIS_COMMIT,
      pullRequest: process.env.TRAVIS_PULL_REQUEST !== 'false'
        ? process.env.TRAVIS_PULL_REQUEST
        : undefined,
      jobName: process.env.TRAVIS_JOB_NAME,
    };
  }

  // Azure Pipelines
  if (process.env.TF_BUILD === 'True') {
    return {
      name: 'Azure Pipelines',
      buildNumber: process.env.BUILD_BUILDNUMBER,
      buildUrl: process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI && process.env.SYSTEM_TEAMPROJECT && process.env.BUILD_BUILDID
        ? `${process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI}${process.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${process.env.BUILD_BUILDID}`
        : undefined,
      branch: process.env.BUILD_SOURCEBRANCHNAME,
      commitSha: process.env.BUILD_SOURCEVERSION,
      pullRequest: process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER,
      jobName: process.env.AGENT_JOBNAME,
    };
  }

  // Bitbucket Pipelines
  if (process.env.BITBUCKET_BUILD_NUMBER) {
    return {
      name: 'Bitbucket Pipelines',
      buildNumber: process.env.BITBUCKET_BUILD_NUMBER,
      buildUrl: process.env.BITBUCKET_WORKSPACE && process.env.BITBUCKET_REPO_SLUG && process.env.BITBUCKET_BUILD_NUMBER
        ? `https://bitbucket.org/${process.env.BITBUCKET_WORKSPACE}/${process.env.BITBUCKET_REPO_SLUG}/pipelines/results/${process.env.BITBUCKET_BUILD_NUMBER}`
        : undefined,
      branch: process.env.BITBUCKET_BRANCH,
      commitSha: process.env.BITBUCKET_COMMIT,
      pullRequest: process.env.BITBUCKET_PR_ID,
    };
  }

  // Buildkite
  if (process.env.BUILDKITE === 'true') {
    return {
      name: 'Buildkite',
      buildNumber: process.env.BUILDKITE_BUILD_NUMBER,
      buildUrl: process.env.BUILDKITE_BUILD_URL,
      branch: process.env.BUILDKITE_BRANCH,
      commitSha: process.env.BUILDKITE_COMMIT,
      pullRequest: process.env.BUILDKITE_PULL_REQUEST !== 'false'
        ? process.env.BUILDKITE_PULL_REQUEST
        : undefined,
      jobName: process.env.BUILDKITE_LABEL,
    };
  }

  // Generic CI detection
  if (process.env.CI === 'true') {
    return {
      name: 'Unknown CI',
      branch: process.env.BRANCH || process.env.GIT_BRANCH,
      commitSha: process.env.COMMIT || process.env.GIT_COMMIT,
    };
  }

  return undefined;
}

/**
 * Check if running in a CI environment.
 */
export function isCI(): boolean {
  return detectCIEnvironment() !== undefined;
}

// =============================================================================
// Summary Calculation
// =============================================================================

/**
 * Calculate summary statistics from entries.
 */
function calculateSummary(entries: RegressionEntry[], durationMs?: number): ExportSummary {
  const total = entries.length;
  const updated = entries.filter((e) => e.updated).length;
  const errors = entries.filter((e) => e.error && !e.updated).length;
  const passed = entries.filter((e) => e.comparison.match && !e.error && !e.updated).length;
  const failed = entries.filter((e) => !e.comparison.match && !e.error && !e.updated).length;
  const skipped = 0; // We don't have a skipped state in RegressionEntry

  const effectiveTotal = total - skipped - errors;
  const passRate = effectiveTotal > 0 ? (passed / effectiveTotal) * 100 : 0;

  return {
    total,
    passed,
    failed,
    errors,
    skipped,
    updated,
    passRate,
    timeSeconds: (durationMs || 0) / 1000,
  };
}

// =============================================================================
// JUnit XML Export
// =============================================================================

/**
 * Export regression results to JUnit XML format.
 *
 * The JUnit XML format is widely supported by CI systems:
 * - Jenkins (native support)
 * - CircleCI (test metadata)
 * - GitHub Actions (test reporter)
 * - GitLab CI (test reports)
 * - Azure Pipelines (publish test results)
 *
 * @param entries - Regression test entries
 * @param options - Export options
 * @returns Export result
 *
 * @example
 * ```typescript
 * const result = await exportToJUnitXML(entries, {
 *   outputPath: './test-results/visual.xml',
 *   suiteName: 'iOS Visual Regression',
 *   includeImagePaths: true,
 * });
 * ```
 */
export async function exportToJUnitXML(
  entries: RegressionEntry[],
  options: JUnitExportOptions
): Promise<ExportResult> {
  const {
    outputPath,
    projectName = 'Visual Regression',
    suiteName = DEFAULT_SUITE_NAME,
    packageName = DEFAULT_PACKAGE_NAME,
    hostname = os.hostname(),
    timestamp = new Date(),
    durationMs = 0,
    includeImagePaths = true,
    includeSimilarity = false,
  } = options;

  try {
    const summary = calculateSummary(entries, durationMs);

    // Generate XML content
    const xml = generateJUnitXML({
      entries,
      summary,
      suiteName,
      packageName,
      hostname,
      timestamp,
      projectName,
      includeImagePaths,
      includeSimilarity,
    });

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write XML file
    fs.writeFileSync(outputPath, xml, 'utf-8');

    // Get file size
    const stats = fs.statSync(outputPath);

    return {
      success: true,
      outputPath,
      fileSize: stats.size,
      entryCount: entries.length,
      format: 'junit-xml',
    };
  } catch (error) {
    return {
      success: false,
      outputPath,
      fileSize: 0,
      entryCount: entries.length,
      format: 'junit-xml',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate JUnit XML content.
 */
function generateJUnitXML(options: {
  entries: RegressionEntry[];
  summary: ExportSummary;
  suiteName: string;
  packageName: string;
  hostname: string;
  timestamp: Date;
  projectName: string;
  includeImagePaths: boolean;
  includeSimilarity: boolean;
}): string {
  const {
    entries,
    summary,
    suiteName,
    packageName,
    hostname,
    timestamp,
    projectName,
    includeImagePaths,
    includeSimilarity,
  } = options;

  const lines: string[] = [];

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  // Testsuites root element
  lines.push('<testsuites>');

  // Single testsuite for all visual regression tests
  lines.push(`  <testsuite name="${escapeXml(suiteName)}" ` +
    `tests="${summary.total}" ` +
    `failures="${summary.failed}" ` +
    `errors="${summary.errors}" ` +
    `skipped="${summary.skipped}" ` +
    `time="${summary.timeSeconds.toFixed(3)}" ` +
    `timestamp="${timestamp.toISOString()}" ` +
    `hostname="${escapeXml(hostname)}">`);

  // Properties
  lines.push('    <properties>');
  lines.push(`      <property name="project" value="${escapeXml(projectName)}"/>`);
  lines.push(`      <property name="generator" value="${escapeXml(GENERATOR_NAME)}"/>`);
  lines.push(`      <property name="passRate" value="${summary.passRate.toFixed(1)}%"/>`);
  if (summary.updated > 0) {
    lines.push(`      <property name="baselinesUpdated" value="${summary.updated}"/>`);
  }
  lines.push('    </properties>');

  // Test cases
  for (const entry of entries) {
    const testName = includeSimilarity
      ? `${entry.name} (${(entry.comparison.similarity * 100).toFixed(1)}%)`
      : entry.name;
    const className = `${packageName}.${sanitizeClassName(entry.name)}`;
    const timeSeconds = (entry.comparison.comparisonTimeMs || 0) / 1000;

    lines.push(`    <testcase name="${escapeXml(testName)}" ` +
      `classname="${escapeXml(className)}" ` +
      `time="${timeSeconds.toFixed(3)}">`);

    // Add failure or error elements
    if (entry.error) {
      lines.push(`      <error message="${escapeXml(entry.error)}" type="ComparisonError">`);
      lines.push(`        ${escapeXml(entry.error)}`);
      lines.push('      </error>');
    } else if (!entry.comparison.match) {
      const failureMessage = buildFailureMessage(entry, includeImagePaths);
      lines.push(`      <failure message="${escapeXml(failureMessage.summary)}" type="VisualDifference">`);
      lines.push(escapeXml(failureMessage.details));
      lines.push('      </failure>');
    }

    // System output with details
    const systemOut = buildSystemOutput(entry);
    if (systemOut) {
      lines.push('      <system-out>');
      lines.push(`        <![CDATA[${systemOut}]]>`);
      lines.push('      </system-out>');
    }

    lines.push('    </testcase>');
  }

  lines.push('  </testsuite>');
  lines.push('</testsuites>');

  return lines.join('\n');
}

/**
 * Build failure message for a failed test.
 */
function buildFailureMessage(
  entry: RegressionEntry,
  includeImagePaths: boolean
): { summary: string; details: string } {
  const similarityPct = (entry.comparison.similarity * 100).toFixed(1);
  const diffPct = entry.comparison.diffPercent.toFixed(2);
  const changedRegions = entry.analysis
    ? entry.analysis.changes.filter((c) => !c.isIgnored).length
    : 0;

  const summary = `Visual difference detected: ${similarityPct}% similar, ${diffPct}% diff`;

  const detailLines: string[] = [];
  detailLines.push(`Baseline: ${entry.name}`);
  detailLines.push(`Similarity: ${similarityPct}%`);
  detailLines.push(`Diff Percent: ${diffPct}%`);
  detailLines.push(`Changed Pixels: ${entry.comparison.diffPixels.toLocaleString()}`);
  detailLines.push(`Changed Regions: ${changedRegions}`);

  if (includeImagePaths) {
    detailLines.push('');
    detailLines.push('Image Paths:');
    detailLines.push(`  Baseline: ${entry.paths.baseline}`);
    detailLines.push(`  Current: ${entry.paths.current}`);
    if (entry.paths.diff) {
      detailLines.push(`  Diff: ${entry.paths.diff}`);
    }
  }

  return {
    summary,
    details: detailLines.join('\n'),
  };
}

/**
 * Build system output for a test case.
 */
function buildSystemOutput(entry: RegressionEntry): string {
  const lines: string[] = [];

  lines.push(`Test: ${entry.name}`);
  lines.push(`Status: ${entry.error ? 'error' : entry.comparison.match ? 'passed' : 'failed'}`);
  lines.push(`Similarity: ${(entry.comparison.similarity * 100).toFixed(1)}%`);
  lines.push(`Diff Pixels: ${entry.comparison.diffPixels.toLocaleString()}`);

  if (entry.analysis) {
    const changes = entry.analysis.changes.filter((c) => !c.isIgnored);
    if (changes.length > 0) {
      lines.push('');
      lines.push('Changed Regions:');
      for (let i = 0; i < Math.min(changes.length, 5); i++) {
        const change = changes[i];
        lines.push(`  - ${change.changeType} at (${Math.round(change.bounds.x)}, ${Math.round(change.bounds.y)})`);
      }
      if (changes.length > 5) {
        lines.push(`  ... and ${changes.length - 5} more`);
      }
    }
  }

  if (entry.updated) {
    lines.push('');
    lines.push('⚡ Baseline was updated');
  }

  return lines.join('\n');
}

// =============================================================================
// JSON Export
// =============================================================================

/**
 * Export regression results to JSON format.
 *
 * JSON format is useful for:
 * - Programmatic consumption
 * - Custom dashboards
 * - Post-processing and analysis
 * - Integration with other tools
 *
 * @param entries - Regression test entries
 * @param options - Export options
 * @returns Export result
 *
 * @example
 * ```typescript
 * const result = await exportToJSON(entries, {
 *   outputPath: './results.json',
 *   pretty: true,
 *   includeAnalysis: true,
 * });
 * ```
 */
export async function exportToJSON(
  entries: RegressionEntry[],
  options: JSONExportOptions
): Promise<ExportResult> {
  const {
    outputPath,
    projectName = 'Visual Regression',
    deviceFamily,
    threshold,
    timestamp = new Date(),
    durationMs,
    pretty = true,
    indent = 2,
    includeImagePaths = true,
    includeAnalysis = false,
    includeMetadata = false,
  } = options;

  try {
    const summary = calculateSummary(entries, durationMs);
    const ciEnv = detectCIEnvironment();

    // Build JSON data
    const data: JSONExportData = {
      meta: {
        version: EXPORT_FORMAT_VERSION,
        generator: GENERATOR_NAME,
        timestamp: timestamp.toISOString(),
        projectName,
        deviceFamily,
        threshold,
        durationMs,
        ciEnvironment: ciEnv,
      },
      summary,
      results: entries.map((entry) => buildJSONTestResult(entry, {
        includeImagePaths,
        includeAnalysis,
        includeMetadata,
      })),
    };

    // Serialize to JSON
    const json = pretty
      ? JSON.stringify(data, null, indent)
      : JSON.stringify(data);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON file
    fs.writeFileSync(outputPath, json, 'utf-8');

    // Get file size
    const stats = fs.statSync(outputPath);

    return {
      success: true,
      outputPath,
      fileSize: stats.size,
      entryCount: entries.length,
      format: 'json',
    };
  } catch (error) {
    return {
      success: false,
      outputPath,
      fileSize: 0,
      entryCount: entries.length,
      format: 'json',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build JSON test result from regression entry.
 */
function buildJSONTestResult(
  entry: RegressionEntry,
  options: {
    includeImagePaths: boolean;
    includeAnalysis: boolean;
    includeMetadata: boolean;
  }
): JSONTestResult {
  const { includeImagePaths, includeAnalysis, includeMetadata } = options;

  const result: JSONTestResult = {
    name: entry.name,
    status: determineStatus(entry),
    similarity: entry.comparison.similarity * 100,
    diffPercent: entry.comparison.diffPercent,
    diffPixels: entry.comparison.diffPixels,
    changedRegions: entry.analysis
      ? entry.analysis.changes.filter((c) => !c.isIgnored).length
      : 0,
    durationMs: entry.comparison.comparisonTimeMs || 0,
  };

  if (entry.error) {
    result.error = entry.error;
  }

  if (includeImagePaths) {
    result.paths = {
      baseline: entry.paths.baseline,
      current: entry.paths.current,
      diff: entry.paths.diff,
    };
  }

  if (includeAnalysis && entry.analysis) {
    result.analysis = {
      changes: entry.analysis.changes
        .filter((c) => !c.isIgnored)
        .map((c) => ({
          type: c.changeType,
          severity: c.severity,
          bounds: c.bounds,
          pixelCount: c.pixelCount,
          description: c.description,
        })),
    };
  }

  if (includeMetadata && entry.metadata) {
    result.metadata = {
      createdAt: entry.metadata.createdAt instanceof Date
        ? entry.metadata.createdAt.toISOString()
        : String(entry.metadata.createdAt),
      updatedAt: entry.metadata.updatedAt instanceof Date
        ? entry.metadata.updatedAt.toISOString()
        : String(entry.metadata.updatedAt),
      tags: entry.metadata.tags,
    };
  }

  return result;
}

/**
 * Determine test status from entry.
 */
function determineStatus(
  entry: RegressionEntry
): 'passed' | 'failed' | 'error' | 'skipped' | 'updated' {
  if (entry.error) return 'error';
  if (entry.updated) return 'updated';
  return entry.comparison.match ? 'passed' : 'failed';
}

// =============================================================================
// Artifact Bundle Generation
// =============================================================================

/**
 * Generate an artifact bundle containing images and reports.
 *
 * Creates a directory or zip file containing:
 * - Baseline images
 * - Current screenshots
 * - Diff images
 * - HTML report
 * - JUnit XML
 * - JSON results
 *
 * @param entries - Regression test entries
 * @param options - Bundle options
 * @returns Export result
 *
 * @example
 * ```typescript
 * const result = await generateArtifactBundle(entries, {
 *   outputPath: './artifacts/visual-regression',
 *   format: 'directory',
 *   includeHtmlReport: true,
 *   includeJUnitXml: true,
 * });
 * ```
 */
export async function generateArtifactBundle(
  entries: RegressionEntry[],
  options: ArtifactBundleOptions
): Promise<ExportResult> {
  const {
    outputPath,
    projectName = 'Visual Regression',
    deviceFamily,
    threshold,
    timestamp = new Date(),
    durationMs,
    includeBaselineImages = true,
    includeCurrentImages = true,
    includeDiffImages = true,
    includeHtmlReport = true,
    includeJUnitXml = true,
    includeJson = true,
    format = 'directory',
    reportTitle = 'Visual Regression Report',
  } = options;

  try {
    // Create output directory
    const bundleDir = format === 'zip'
      ? path.join(os.tmpdir(), `visual-regression-${Date.now()}`)
      : outputPath;

    if (!fs.existsSync(bundleDir)) {
      fs.mkdirSync(bundleDir, { recursive: true });
    }

    // Create subdirectories
    const imagesDir = path.join(bundleDir, 'images');
    const reportsDir = path.join(bundleDir, 'reports');

    if (includeBaselineImages || includeCurrentImages || includeDiffImages) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    if (includeHtmlReport || includeJUnitXml || includeJson) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Copy images
    if (includeBaselineImages || includeCurrentImages || includeDiffImages) {
      for (const entry of entries) {
        const safeEntryName = sanitizeFilename(entry.name);

        if (includeBaselineImages && fs.existsSync(entry.paths.baseline)) {
          const dest = path.join(imagesDir, `${safeEntryName}_baseline.png`);
          fs.copyFileSync(entry.paths.baseline, dest);
        }

        if (includeCurrentImages && fs.existsSync(entry.paths.current)) {
          const dest = path.join(imagesDir, `${safeEntryName}_current.png`);
          fs.copyFileSync(entry.paths.current, dest);
        }

        if (includeDiffImages && entry.paths.diff && fs.existsSync(entry.paths.diff)) {
          const dest = path.join(imagesDir, `${safeEntryName}_diff.png`);
          fs.copyFileSync(entry.paths.diff, dest);
        }
      }
    }

    // Generate HTML report
    if (includeHtmlReport) {
      const { generateHTMLReport } = await import('./regression-report');
      await generateHTMLReport(entries, {
        outputPath: path.join(reportsDir, 'report.html'),
        title: reportTitle,
        projectName,
        deviceFamily,
        threshold,
        embedImages: true, // Embed images for portability
      });
    }

    // Generate JUnit XML
    if (includeJUnitXml) {
      await exportToJUnitXML(entries, {
        outputPath: path.join(reportsDir, 'junit.xml'),
        projectName,
        deviceFamily,
        threshold,
        timestamp,
        durationMs,
      });
    }

    // Generate JSON
    if (includeJson) {
      await exportToJSON(entries, {
        outputPath: path.join(reportsDir, 'results.json'),
        projectName,
        deviceFamily,
        threshold,
        timestamp,
        durationMs,
        includeAnalysis: true,
        includeMetadata: true,
      });
    }

    // Generate summary file
    const summary = calculateSummary(entries, durationMs);
    const summaryContent = generateSummaryMarkdown(summary, {
      projectName,
      deviceFamily,
      timestamp,
    });
    fs.writeFileSync(path.join(bundleDir, 'SUMMARY.md'), summaryContent, 'utf-8');

    let finalOutputPath = bundleDir;
    let fileSize = getDirectorySize(bundleDir);

    // Create zip if requested
    if (format === 'zip') {
      finalOutputPath = outputPath.endsWith('.zip') ? outputPath : `${outputPath}.zip`;

      // Ensure parent directory exists
      const parentDir = path.dirname(finalOutputPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      await createZipArchive(bundleDir, finalOutputPath);
      fileSize = fs.statSync(finalOutputPath).size;

      // Clean up temp directory
      fs.rmSync(bundleDir, { recursive: true, force: true });
    }

    return {
      success: true,
      outputPath: finalOutputPath,
      fileSize,
      entryCount: entries.length,
      format: 'artifact-bundle',
    };
  } catch (error) {
    return {
      success: false,
      outputPath,
      fileSize: 0,
      entryCount: entries.length,
      format: 'artifact-bundle',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate summary markdown content.
 */
function generateSummaryMarkdown(
  summary: ExportSummary,
  options: {
    projectName: string;
    deviceFamily?: DeviceFamily;
    timestamp: Date;
  }
): string {
  const { projectName, deviceFamily, timestamp } = options;

  const lines: string[] = [];

  lines.push(`# ${projectName} - Visual Regression Summary`);
  lines.push('');
  lines.push(`Generated: ${timestamp.toISOString()}`);
  if (deviceFamily) {
    lines.push(`Device Family: ${deviceFamily}`);
  }
  lines.push('');

  // Status badge
  const status = summary.failed === 0 && summary.errors === 0 ? '✅ PASSED' : '❌ FAILED';
  lines.push(`## Status: ${status}`);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Tests | ${summary.total} |`);
  lines.push(`| Passed | ${summary.passed} |`);
  lines.push(`| Failed | ${summary.failed} |`);
  if (summary.errors > 0) {
    lines.push(`| Errors | ${summary.errors} |`);
  }
  if (summary.updated > 0) {
    lines.push(`| Updated | ${summary.updated} |`);
  }
  lines.push(`| Pass Rate | ${summary.passRate.toFixed(1)}% |`);
  lines.push(`| Duration | ${summary.timeSeconds.toFixed(2)}s |`);
  lines.push('');

  // Files included
  lines.push('## Included Files');
  lines.push('');
  lines.push('- `reports/report.html` - Interactive HTML report');
  lines.push('- `reports/junit.xml` - JUnit XML for CI systems');
  lines.push('- `reports/results.json` - JSON results for programmatic access');
  lines.push('- `images/` - Screenshot images (baseline, current, diff)');
  lines.push('');

  return lines.join('\n');
}

/**
 * Get total size of a directory.
 */
function getDirectorySize(dirPath: string): number {
  let totalSize = 0;

  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const file of files) {
    const filePath = path.join(dirPath, file.name);
    if (file.isDirectory()) {
      totalSize += getDirectorySize(filePath);
    } else {
      totalSize += fs.statSync(filePath).size;
    }
  }

  return totalSize;
}

/**
 * Create a zip archive from a directory.
 *
 * Uses native macOS `zip` command for simplicity.
 * Falls back to tar if zip is not available.
 */
async function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
  const { execFileNoThrow } = await import('../utils/execFile');

  // Use macOS native zip command
  const result = await execFileNoThrow(
    'zip',
    ['-r', outputPath, '.'],
    sourceDir
  );

  if (result.exitCode !== 0) {
    throw new Error(`Failed to create zip archive: ${result.stderr}`);
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Escape XML special characters.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitize string for use as XML class name.
 */
function sanitizeClassName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&');
}

/**
 * Sanitize string for use as filename.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Export results in all formats at once.
 *
 * @param entries - Regression test entries
 * @param outputDir - Base output directory
 * @param options - Common options
 * @returns Array of export results
 *
 * @example
 * ```typescript
 * const results = await exportAll(entries, './test-results', {
 *   projectName: 'My App',
 * });
 * ```
 */
export async function exportAll(
  entries: RegressionEntry[],
  outputDir: string,
  options: Omit<CIExportOptions, 'outputPath'> = {}
): Promise<ExportResult[]> {
  const results: ExportResult[] = [];

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Export JUnit XML
  results.push(await exportToJUnitXML(entries, {
    ...options,
    outputPath: path.join(outputDir, 'visual-regression.xml'),
  }));

  // Export JSON
  results.push(await exportToJSON(entries, {
    ...options,
    outputPath: path.join(outputDir, 'visual-regression.json'),
    includeAnalysis: true,
  }));

  return results;
}

/**
 * Get recommended CI configuration for different systems.
 *
 * @param ciSystem - CI system name
 * @returns Configuration snippet
 */
export function getCIConfigSnippet(
  ciSystem: 'github-actions' | 'circleci' | 'gitlab' | 'jenkins' | 'azure'
): string {
  switch (ciSystem) {
    case 'github-actions':
      return `
# Add to your GitHub Actions workflow
- name: Upload Visual Regression Results
  uses: actions/upload-artifact@v3
  with:
    name: visual-regression-results
    path: test-results/

- name: Publish Test Results
  uses: mikepenz/action-junit-report@v4
  if: always()
  with:
    report_paths: 'test-results/visual-regression.xml'
    check_name: 'Visual Regression Tests'
`;

    case 'circleci':
      return `
# Add to your CircleCI config
- store_test_results:
    path: test-results
- store_artifacts:
    path: test-results
    destination: visual-regression
`;

    case 'gitlab':
      return `
# Add to your .gitlab-ci.yml
artifacts:
  reports:
    junit: test-results/visual-regression.xml
  paths:
    - test-results/
  expire_in: 1 week
`;

    case 'jenkins':
      return `
// Add to your Jenkinsfile
junit 'test-results/visual-regression.xml'
archiveArtifacts artifacts: 'test-results/**/*'
`;

    case 'azure':
      return `
# Add to your azure-pipelines.yml
- task: PublishTestResults@2
  inputs:
    testResultsFormat: 'JUnit'
    testResultsFiles: 'test-results/visual-regression.xml'
    testRunTitle: 'Visual Regression Tests'

- task: PublishBuildArtifacts@1
  inputs:
    pathToPublish: 'test-results'
    artifactName: 'visual-regression'
`;

    default:
      return '';
  }
}
