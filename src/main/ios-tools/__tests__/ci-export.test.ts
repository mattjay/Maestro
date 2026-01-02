/**
 * Unit tests for iOS Tools - CI Export Module
 *
 * Tests the CI export functionality for visual regression results including:
 * - JUnit XML export
 * - JSON export
 * - Artifact bundle generation
 * - CI environment detection
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  exportToJUnitXML,
  exportToJSON,
  generateArtifactBundle,
  detectCIEnvironment,
  isCI,
  exportAll,
  getCIConfigSnippet,
  EXPORT_FORMAT_VERSION,
  GENERATOR_NAME,
  DEFAULT_SUITE_NAME,
  DEFAULT_PACKAGE_NAME,
  type JUnitExportOptions,
  type JSONExportOptions,
  type ArtifactBundleOptions,
  type ExportResult,
  type CIEnvironment,
  type JSONExportData,
} from '../ci-export';
import type { RegressionEntry } from '../diff-formatter';
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

function createMockRegressionEntry(overrides: Partial<RegressionEntry> = {}): RegressionEntry {
  return {
    name: 'login_screen',
    comparison: createMockCompareResult(),
    analysis: createMockAnalysisResult([createMockChange()]),
    paths: {
      baseline: '/path/to/baseline.png',
      current: '/path/to/current.png',
      diff: '/path/to/diff.png',
    },
    ...overrides,
  };
}

function createMockEntries(): RegressionEntry[] {
  return [
    createMockRegressionEntry({
      name: 'login_screen',
      comparison: createMockCompareResult({ match: true, similarity: 1.0, diffPixels: 0, diffPercent: 0 }),
    }),
    createMockRegressionEntry({
      name: 'home_screen',
      comparison: createMockCompareResult({ match: false, similarity: 0.95, diffPixels: 5000, diffPercent: 5.0 }),
      analysis: createMockAnalysisResult([
        createMockChange({ changeType: 'color', severity: 0.5 }),
        createMockChange({ id: 'change_2', changeType: 'layout', severity: 0.8 }),
      ]),
    }),
    createMockRegressionEntry({
      name: 'settings_screen',
      comparison: createMockCompareResult({ match: false, similarity: 0.85, diffPixels: 15000, diffPercent: 15.0 }),
      error: 'Baseline not found',
    }),
    createMockRegressionEntry({
      name: 'profile_screen',
      comparison: createMockCompareResult({ match: true, similarity: 0.99, diffPixels: 100, diffPercent: 0.1 }),
      updated: true,
    }),
  ];
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let testTempDir: string;

beforeEach(() => {
  testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-export-test-'));
});

afterEach(() => {
  if (fs.existsSync(testTempDir)) {
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }
  // Clean up CI environment variables
  delete process.env.GITHUB_ACTIONS;
  delete process.env.CIRCLECI;
  delete process.env.JENKINS_URL;
  delete process.env.GITLAB_CI;
  delete process.env.TRAVIS;
  delete process.env.TF_BUILD;
  delete process.env.BITBUCKET_BUILD_NUMBER;
  delete process.env.BUILDKITE;
  delete process.env.CI;
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('Constants', () => {
  test('EXPORT_FORMAT_VERSION is valid semver', () => {
    expect(EXPORT_FORMAT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('GENERATOR_NAME is non-empty', () => {
    expect(GENERATOR_NAME).toBeTruthy();
    expect(GENERATOR_NAME.length).toBeGreaterThan(0);
  });

  test('DEFAULT_SUITE_NAME is non-empty', () => {
    expect(DEFAULT_SUITE_NAME).toBeTruthy();
  });

  test('DEFAULT_PACKAGE_NAME is valid Java package format', () => {
    expect(DEFAULT_PACKAGE_NAME).toMatch(/^[a-z]+(\.[a-z]+)*$/);
  });
});

// =============================================================================
// CI Environment Detection Tests
// =============================================================================

describe('CI Environment Detection', () => {
  describe('detectCIEnvironment', () => {
    test('detects GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_RUN_NUMBER = '42';
      process.env.GITHUB_SHA = 'abc123';
      process.env.GITHUB_REF_NAME = 'main';
      process.env.GITHUB_JOB = 'test';

      const env = detectCIEnvironment();
      expect(env).toBeDefined();
      expect(env?.name).toBe('GitHub Actions');
      expect(env?.buildNumber).toBe('42');
      expect(env?.commitSha).toBe('abc123');
      expect(env?.branch).toBe('main');
      expect(env?.jobName).toBe('test');
    });

    test('detects CircleCI', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_BUILD_NUM = '123';
      process.env.CIRCLE_BRANCH = 'feature';
      process.env.CIRCLE_SHA1 = 'def456';
      process.env.CIRCLE_JOB = 'build';

      const env = detectCIEnvironment();
      expect(env).toBeDefined();
      expect(env?.name).toBe('CircleCI');
      expect(env?.buildNumber).toBe('123');
      expect(env?.branch).toBe('feature');
      expect(env?.commitSha).toBe('def456');
    });

    test('detects Jenkins', () => {
      process.env.JENKINS_URL = 'https://jenkins.example.com';
      process.env.BUILD_NUMBER = '456';
      process.env.GIT_BRANCH = 'develop';
      process.env.GIT_COMMIT = 'ghi789';
      process.env.JOB_NAME = 'my-job';

      const env = detectCIEnvironment();
      expect(env).toBeDefined();
      expect(env?.name).toBe('Jenkins');
      expect(env?.buildNumber).toBe('456');
      expect(env?.branch).toBe('develop');
    });

    test('detects GitLab CI', () => {
      process.env.GITLAB_CI = 'true';
      process.env.CI_PIPELINE_ID = '789';
      process.env.CI_COMMIT_BRANCH = 'master';
      process.env.CI_COMMIT_SHA = 'jkl012';
      process.env.CI_JOB_NAME = 'test-job';

      const env = detectCIEnvironment();
      expect(env).toBeDefined();
      expect(env?.name).toBe('GitLab CI');
      expect(env?.buildNumber).toBe('789');
      expect(env?.branch).toBe('master');
    });

    test('detects Travis CI', () => {
      process.env.TRAVIS = 'true';
      process.env.TRAVIS_BUILD_NUMBER = '101';
      process.env.TRAVIS_BRANCH = 'release';
      process.env.TRAVIS_COMMIT = 'mno345';
      process.env.TRAVIS_PULL_REQUEST = 'false';

      const env = detectCIEnvironment();
      expect(env).toBeDefined();
      expect(env?.name).toBe('Travis CI');
      expect(env?.buildNumber).toBe('101');
      expect(env?.pullRequest).toBeUndefined();
    });

    test('detects Azure Pipelines', () => {
      process.env.TF_BUILD = 'True';
      process.env.BUILD_BUILDNUMBER = '202';
      process.env.BUILD_SOURCEBRANCHNAME = 'azure-test';
      process.env.BUILD_SOURCEVERSION = 'pqr678';
      process.env.AGENT_JOBNAME = 'BuildJob';

      const env = detectCIEnvironment();
      expect(env).toBeDefined();
      expect(env?.name).toBe('Azure Pipelines');
      expect(env?.buildNumber).toBe('202');
      expect(env?.branch).toBe('azure-test');
    });

    test('detects Bitbucket Pipelines', () => {
      process.env.BITBUCKET_BUILD_NUMBER = '303';
      process.env.BITBUCKET_BRANCH = 'bitbucket-test';
      process.env.BITBUCKET_COMMIT = 'stu901';

      const env = detectCIEnvironment();
      expect(env).toBeDefined();
      expect(env?.name).toBe('Bitbucket Pipelines');
      expect(env?.buildNumber).toBe('303');
      expect(env?.branch).toBe('bitbucket-test');
    });

    test('detects Buildkite', () => {
      process.env.BUILDKITE = 'true';
      process.env.BUILDKITE_BUILD_NUMBER = '404';
      process.env.BUILDKITE_BRANCH = 'buildkite-test';
      process.env.BUILDKITE_COMMIT = 'vwx234';
      process.env.BUILDKITE_LABEL = 'Test Label';

      const env = detectCIEnvironment();
      expect(env).toBeDefined();
      expect(env?.name).toBe('Buildkite');
      expect(env?.buildNumber).toBe('404');
      expect(env?.jobName).toBe('Test Label');
    });

    test('detects generic CI', () => {
      process.env.CI = 'true';

      const env = detectCIEnvironment();
      expect(env).toBeDefined();
      expect(env?.name).toBe('Unknown CI');
    });

    test('returns undefined when not in CI', () => {
      const env = detectCIEnvironment();
      expect(env).toBeUndefined();
    });
  });

  describe('isCI', () => {
    test('returns true when in CI', () => {
      process.env.CI = 'true';
      expect(isCI()).toBe(true);
    });

    test('returns false when not in CI', () => {
      expect(isCI()).toBe(false);
    });
  });
});

// =============================================================================
// JUnit XML Export Tests
// =============================================================================

describe('JUnit XML Export', () => {
  test('exports valid JUnit XML', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'junit.xml');

    const result = await exportToJUnitXML(entries, { outputPath });

    expect(result.success).toBe(true);
    expect(result.format).toBe('junit-xml');
    expect(result.entryCount).toBe(entries.length);
    expect(fs.existsSync(outputPath)).toBe(true);

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(content).toContain('<testsuites>');
    expect(content).toContain('<testsuite');
    expect(content).toContain('</testsuites>');
  });

  test('includes correct test counts', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'junit.xml');

    await exportToJUnitXML(entries, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('tests="4"');
    expect(content).toContain('failures="1"'); // home_screen failed
    expect(content).toContain('errors="1"'); // settings_screen has error
  });

  test('uses custom suite name', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'junit.xml');

    await exportToJUnitXML(entries, {
      outputPath,
      suiteName: 'My Custom Suite',
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('name="My Custom Suite"');
  });

  test('uses custom package name', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'junit.xml');

    await exportToJUnitXML(entries, {
      outputPath,
      packageName: 'com.myapp.tests',
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('classname="com.myapp.tests');
  });

  test('includes failure elements for failed tests', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'junit.xml');

    await exportToJUnitXML(entries, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<failure');
    expect(content).toContain('type="VisualDifference"');
  });

  test('includes error elements for error tests', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'junit.xml');

    await exportToJUnitXML(entries, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<error');
    expect(content).toContain('type="ComparisonError"');
    expect(content).toContain('Baseline not found');
  });

  test('includes image paths when requested', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'junit.xml');

    await exportToJUnitXML(entries, {
      outputPath,
      includeImagePaths: true,
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('Image Paths:');
    expect(content).toContain('Baseline:');
    expect(content).toContain('Current:');
    expect(content).toContain('Diff:');
  });

  test('includes similarity in test name when requested', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'junit.xml');

    await exportToJUnitXML(entries, {
      outputPath,
      includeSimilarity: true,
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toMatch(/login_screen \(\d+\.\d+%\)/);
  });

  test('escapes XML special characters', async () => {
    const entries = [
      createMockRegressionEntry({
        name: 'test<with>special&"chars\'',
        comparison: createMockCompareResult({ match: false }),
      }),
    ];
    const outputPath = path.join(testTempDir, 'junit.xml');

    await exportToJUnitXML(entries, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('&lt;');
    expect(content).toContain('&gt;');
    expect(content).toContain('&amp;');
    expect(content).toContain('&quot;');
    expect(content).toContain('&apos;');
  });

  test('creates output directory if not exists', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'subdir', 'deep', 'junit.xml');

    const result = await exportToJUnitXML(entries, { outputPath });

    expect(result.success).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  test('includes system-out with details', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'junit.xml');

    await exportToJUnitXML(entries, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<system-out>');
    expect(content).toContain('<![CDATA[');
    expect(content).toContain('Similarity:');
    expect(content).toContain('Diff Pixels:');
  });

  test('includes properties with metadata', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'junit.xml');

    await exportToJUnitXML(entries, {
      outputPath,
      projectName: 'Test Project',
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<properties>');
    expect(content).toContain('property name="project"');
    expect(content).toContain('Test Project');
    expect(content).toContain('property name="generator"');
    expect(content).toContain('property name="passRate"');
  });
});

// =============================================================================
// JSON Export Tests
// =============================================================================

describe('JSON Export', () => {
  test('exports valid JSON', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    const result = await exportToJSON(entries, { outputPath });

    expect(result.success).toBe(true);
    expect(result.format).toBe('json');
    expect(result.entryCount).toBe(entries.length);
    expect(fs.existsSync(outputPath)).toBe(true);

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  test('includes correct meta section', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    await exportToJSON(entries, {
      outputPath,
      projectName: 'My App',
      threshold: 0.05,
      durationMs: 5000,
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    const data: JSONExportData = JSON.parse(content);

    expect(data.meta.version).toBe(EXPORT_FORMAT_VERSION);
    expect(data.meta.generator).toBe(GENERATOR_NAME);
    expect(data.meta.projectName).toBe('My App');
    expect(data.meta.threshold).toBe(0.05);
    expect(data.meta.durationMs).toBe(5000);
    expect(data.meta.timestamp).toBeDefined();
  });

  test('includes correct summary', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    await exportToJSON(entries, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    const data: JSONExportData = JSON.parse(content);

    expect(data.summary.total).toBe(4);
    expect(data.summary.passed).toBe(1); // login_screen
    expect(data.summary.failed).toBe(1); // home_screen
    expect(data.summary.errors).toBe(1); // settings_screen
    expect(data.summary.updated).toBe(1); // profile_screen
    expect(data.summary.passRate).toBeGreaterThan(0);
  });

  test('includes all results', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    await exportToJSON(entries, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    const data: JSONExportData = JSON.parse(content);

    expect(data.results).toHaveLength(4);
    expect(data.results.map((r) => r.name)).toContain('login_screen');
    expect(data.results.map((r) => r.name)).toContain('home_screen');
    expect(data.results.map((r) => r.name)).toContain('settings_screen');
    expect(data.results.map((r) => r.name)).toContain('profile_screen');
  });

  test('includes correct status for each entry', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    await exportToJSON(entries, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    const data: JSONExportData = JSON.parse(content);

    const login = data.results.find((r) => r.name === 'login_screen');
    const home = data.results.find((r) => r.name === 'home_screen');
    const settings = data.results.find((r) => r.name === 'settings_screen');
    const profile = data.results.find((r) => r.name === 'profile_screen');

    expect(login?.status).toBe('passed');
    expect(home?.status).toBe('failed');
    expect(settings?.status).toBe('error');
    expect(profile?.status).toBe('updated');
  });

  test('includes image paths when requested', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    await exportToJSON(entries, {
      outputPath,
      includeImagePaths: true,
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    const data: JSONExportData = JSON.parse(content);

    expect(data.results[0].paths).toBeDefined();
    expect(data.results[0].paths?.baseline).toBeDefined();
    expect(data.results[0].paths?.current).toBeDefined();
  });

  test('excludes image paths when not requested', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    await exportToJSON(entries, {
      outputPath,
      includeImagePaths: false,
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    const data: JSONExportData = JSON.parse(content);

    expect(data.results[0].paths).toBeUndefined();
  });

  test('includes analysis when requested', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    await exportToJSON(entries, {
      outputPath,
      includeAnalysis: true,
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    const data: JSONExportData = JSON.parse(content);

    const home = data.results.find((r) => r.name === 'home_screen');
    expect(home?.analysis).toBeDefined();
    expect(home?.analysis?.changes).toBeDefined();
    expect(home?.analysis?.changes.length).toBeGreaterThan(0);
  });

  test('outputs pretty JSON when requested', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    await exportToJSON(entries, {
      outputPath,
      pretty: true,
      indent: 4,
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    // Pretty JSON should have newlines and indentation
    expect(content).toContain('\n');
    expect(content).toMatch(/^\s{4}/m); // 4-space indentation
  });

  test('outputs compact JSON when pretty is false', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    await exportToJSON(entries, {
      outputPath,
      pretty: false,
    });

    const content = fs.readFileSync(outputPath, 'utf-8');
    // Compact JSON should be on single line (no line breaks in structure)
    const lines = content.split('\n').filter((l) => l.trim());
    expect(lines).toHaveLength(1);
  });

  test('includes CI environment when detected', async () => {
    process.env.CI = 'true';
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'results.json');

    await exportToJSON(entries, { outputPath });

    const content = fs.readFileSync(outputPath, 'utf-8');
    const data: JSONExportData = JSON.parse(content);

    expect(data.meta.ciEnvironment).toBeDefined();
    expect(data.meta.ciEnvironment?.name).toBe('Unknown CI');
  });
});

// =============================================================================
// Artifact Bundle Tests
// =============================================================================

describe('Artifact Bundle Generation', () => {
  test('generates directory bundle', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'artifacts');

    const result = await generateArtifactBundle(entries, {
      outputPath,
      format: 'directory',
      includeBaselineImages: false, // Skip image copy since files don't exist
      includeCurrentImages: false,
      includeDiffImages: false,
    });

    expect(result.success).toBe(true);
    expect(result.format).toBe('artifact-bundle');
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.statSync(outputPath).isDirectory()).toBe(true);
  });

  test('includes summary markdown', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'artifacts');

    await generateArtifactBundle(entries, {
      outputPath,
      format: 'directory',
      projectName: 'My App',
      includeBaselineImages: false,
      includeCurrentImages: false,
      includeDiffImages: false,
    });

    const summaryPath = path.join(outputPath, 'SUMMARY.md');
    expect(fs.existsSync(summaryPath)).toBe(true);

    const content = fs.readFileSync(summaryPath, 'utf-8');
    expect(content).toContain('My App');
    expect(content).toContain('Visual Regression Summary');
    expect(content).toContain('Total Tests');
    expect(content).toContain('Passed');
    expect(content).toContain('Failed');
  });

  test('includes JUnit XML when requested', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'artifacts');

    await generateArtifactBundle(entries, {
      outputPath,
      format: 'directory',
      includeJUnitXml: true,
      includeHtmlReport: false,
      includeBaselineImages: false,
      includeCurrentImages: false,
      includeDiffImages: false,
    });

    const junitPath = path.join(outputPath, 'reports', 'junit.xml');
    expect(fs.existsSync(junitPath)).toBe(true);
  });

  test('includes JSON when requested', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'artifacts');

    await generateArtifactBundle(entries, {
      outputPath,
      format: 'directory',
      includeJson: true,
      includeHtmlReport: false,
      includeBaselineImages: false,
      includeCurrentImages: false,
      includeDiffImages: false,
    });

    const jsonPath = path.join(outputPath, 'reports', 'results.json');
    expect(fs.existsSync(jsonPath)).toBe(true);
  });

  test('creates images directory only when images included', async () => {
    const entries = createMockEntries();
    const outputPath = path.join(testTempDir, 'artifacts');

    await generateArtifactBundle(entries, {
      outputPath,
      format: 'directory',
      includeBaselineImages: false,
      includeCurrentImages: false,
      includeDiffImages: false,
    });

    const imagesPath = path.join(outputPath, 'images');
    // Directory should not exist when no images are included
    expect(fs.existsSync(imagesPath)).toBe(false);
  });

  test('copies images when they exist', async () => {
    // Create actual image files
    const baselinePath = path.join(testTempDir, 'baseline.png');
    const currentPath = path.join(testTempDir, 'current.png');
    fs.writeFileSync(baselinePath, 'fake-png-data');
    fs.writeFileSync(currentPath, 'fake-png-data');

    const entries = [
      createMockRegressionEntry({
        name: 'test_screen',
        paths: {
          baseline: baselinePath,
          current: currentPath,
        },
      }),
    ];
    const outputPath = path.join(testTempDir, 'artifacts');

    await generateArtifactBundle(entries, {
      outputPath,
      format: 'directory',
      includeBaselineImages: true,
      includeCurrentImages: true,
      includeDiffImages: false,
      includeHtmlReport: false,
      includeJUnitXml: false,
      includeJson: false,
    });

    const imagesPath = path.join(outputPath, 'images');
    expect(fs.existsSync(path.join(imagesPath, 'test_screen_baseline.png'))).toBe(true);
    expect(fs.existsSync(path.join(imagesPath, 'test_screen_current.png'))).toBe(true);
  });
});

// =============================================================================
// Export All Tests
// =============================================================================

describe('Export All', () => {
  test('exports both JUnit and JSON', async () => {
    const entries = createMockEntries();
    const outputDir = path.join(testTempDir, 'results');

    const results = await exportAll(entries, outputDir, {
      projectName: 'Test App',
    });

    expect(results).toHaveLength(2);
    expect(results[0].format).toBe('junit-xml');
    expect(results[1].format).toBe('json');
    expect(results.every((r) => r.success)).toBe(true);
  });

  test('creates output directory', async () => {
    const entries = createMockEntries();
    const outputDir = path.join(testTempDir, 'new-dir', 'results');

    await exportAll(entries, outputDir);

    expect(fs.existsSync(outputDir)).toBe(true);
  });
});

// =============================================================================
// CI Config Snippet Tests
// =============================================================================

describe('CI Config Snippets', () => {
  test('returns GitHub Actions config', () => {
    const config = getCIConfigSnippet('github-actions');
    expect(config).toContain('actions/upload-artifact');
    expect(config).toContain('visual-regression-results');
    expect(config).toContain('junit-report');
  });

  test('returns CircleCI config', () => {
    const config = getCIConfigSnippet('circleci');
    expect(config).toContain('store_test_results');
    expect(config).toContain('store_artifacts');
  });

  test('returns GitLab config', () => {
    const config = getCIConfigSnippet('gitlab');
    expect(config).toContain('artifacts');
    expect(config).toContain('reports');
    expect(config).toContain('junit');
  });

  test('returns Jenkins config', () => {
    const config = getCIConfigSnippet('jenkins');
    expect(config).toContain('junit');
    expect(config).toContain('archiveArtifacts');
  });

  test('returns Azure config', () => {
    const config = getCIConfigSnippet('azure');
    expect(config).toContain('PublishTestResults');
    expect(config).toContain('JUnit');
    expect(config).toContain('PublishBuildArtifacts');
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('Error Handling', () => {
  test('handles invalid output path gracefully', async () => {
    const entries = createMockEntries();
    // Use a path that can't be written to (null device as directory)
    const outputPath = '/dev/null/impossible/path.xml';

    const result = await exportToJUnitXML(entries, { outputPath });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('handles empty entries array', async () => {
    const entries: RegressionEntry[] = [];
    const outputPath = path.join(testTempDir, 'empty.xml');

    const result = await exportToJUnitXML(entries, { outputPath });

    expect(result.success).toBe(true);
    expect(result.entryCount).toBe(0);

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('tests="0"');
  });

  test('handles entries with missing analysis', async () => {
    const entries = [
      createMockRegressionEntry({
        name: 'no_analysis',
        analysis: undefined,
      }),
    ];
    const outputPath = path.join(testTempDir, 'results.json');

    const result = await exportToJSON(entries, {
      outputPath,
      includeAnalysis: true,
    });

    expect(result.success).toBe(true);
  });

  test('handles entries with special characters in names', async () => {
    const entries = [
      createMockRegressionEntry({
        name: 'screen/with\\path:chars*?',
      }),
    ];
    const outputPath = path.join(testTempDir, 'results.json');

    const result = await exportToJSON(entries, { outputPath });

    expect(result.success).toBe(true);
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });
});

// =============================================================================
// Performance Tests
// =============================================================================

describe('Performance', () => {
  test('handles large number of entries', async () => {
    // Generate 100 entries
    const entries: RegressionEntry[] = [];
    for (let i = 0; i < 100; i++) {
      entries.push(createMockRegressionEntry({
        name: `screen_${i}`,
        comparison: createMockCompareResult({
          match: i % 3 === 0,
        }),
      }));
    }

    const outputPath = path.join(testTempDir, 'large.xml');

    const start = Date.now();
    const result = await exportToJUnitXML(entries, { outputPath });
    const duration = Date.now() - start;

    expect(result.success).toBe(true);
    expect(result.entryCount).toBe(100);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });
});
