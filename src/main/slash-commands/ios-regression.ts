/**
 * iOS Regression Slash Command Handler
 *
 * Handles the /ios.regression command for running comprehensive visual
 * regression tests across all baselines in a project.
 *
 * Usage:
 *   /ios.regression              - Run full regression check (all baselines)
 *   /ios.regression --quick      - Quick check (stop on first failure)
 *   /ios.regression --flows      - Include flow baselines
 *
 * Options:
 *   --project, -p       Project name (default: current directory name)
 *   --simulator, -s     Target simulator name or UDID (default: first booted)
 *   --threshold, -t     Pixel difference threshold 0-1 (default: 0.1)
 *   --output, -o        Directory to save diff images and report
 *   --device-family     Filter by device family
 *   --fail-fast         Stop on first failure
 *   --update            Auto-update all failed baselines
 *   --verbose           Include detailed change analysis
 */

import path from 'path';
import fs from 'fs';
import * as iosTools from '../ios-tools';
import { logger } from '../utils/logger';

const LOG_CONTEXT = '[SlashCmd-ios.regression]';

// =============================================================================
// Types
// =============================================================================

/**
 * Regression run mode
 */
export type RegressionMode = 'full' | 'quick' | 'flows-only';

/**
 * Parsed arguments from /ios.regression command
 */
export interface RegressionCommandArgs {
  /** Run mode */
  mode: RegressionMode;
  /** Project name */
  project?: string;
  /** Simulator name or UDID */
  simulator?: string;
  /** Pixel difference threshold (0-1) */
  threshold?: number;
  /** Directory to save diff images and report */
  outputDir?: string;
  /** Device family filter */
  deviceFamily?: iosTools.DeviceFamily;
  /** Stop on first failure */
  failFast?: boolean;
  /** Auto-update failed baselines */
  update?: boolean;
  /** Include detailed change analysis */
  verbose?: boolean;
  /** Include flows in regression test */
  includeFlows?: boolean;
  /** Raw input (unparsed portion) */
  raw?: string;
}

/**
 * Individual baseline test result
 */
export interface BaselineTestResult {
  name: string;
  type: 'screen' | 'flow-step';
  flowName?: string;
  stepNumber?: number;
  deviceFamily?: iosTools.DeviceFamily;
  passed: boolean;
  similarity: number;
  diffPercent: number;
  diffPixels: number;
  changedRegions: number;
  baselinePath: string;
  currentPath: string;
  diffPath?: string;
  analysis?: iosTools.ImageAnalysisResult;
  updated?: boolean;
  error?: string;
  duration: number;
}

/**
 * Flow test result (aggregated)
 */
export interface FlowTestResult {
  flowName: string;
  passed: boolean;
  steps: BaselineTestResult[];
  passedSteps: number;
  failedSteps: number;
  totalSteps: number;
  duration: number;
}

/**
 * Full regression test result
 */
export interface RegressionTestResult {
  project: string;
  timestamp: Date;
  duration: number;
  passed: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
    updated: number;
    skipped: number;
    passRate: number;
  };
  screenResults: BaselineTestResult[];
  flowResults: FlowTestResult[];
  deviceFamily?: iosTools.DeviceFamily;
  threshold: number;
  simulator: {
    udid: string;
    name?: string;
  };
  outputDir?: string;
}

/**
 * Result of executing the regression command
 */
export interface RegressionCommandResult {
  success: boolean;
  /** Formatted output for display in AI terminal */
  output: string;
  /** Raw data (for programmatic use) */
  data?: RegressionTestResult;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Argument Parsing
// =============================================================================

/**
 * Parse command line arguments from /ios.regression command text.
 *
 * @param commandText - Full command text including /ios.regression
 * @returns Parsed arguments
 */
export function parseRegressionArgs(commandText: string): RegressionCommandArgs {
  const args: RegressionCommandArgs = {
    mode: 'full',
    includeFlows: false,
    verbose: false,
    failFast: false,
    update: false,
  };

  // Remove the command prefix
  const argsText = commandText.replace(/^\/ios\.regression\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  // Tokenize respecting quoted strings
  const tokens = tokenize(argsText);

  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Handle --quick
    if (token === '--quick' || token === '-q') {
      args.mode = 'quick';
      args.failFast = true;
    }
    // Handle --flows or --flows-only
    else if (token === '--flows' || token === '--flows-only') {
      if (token === '--flows-only') {
        args.mode = 'flows-only';
      }
      args.includeFlows = true;
    }
    // Handle --project or -p
    else if (token === '--project' || token === '-p') {
      if (i + 1 < tokens.length) {
        args.project = tokens[++i];
      }
    }
    // Handle --simulator or -s
    else if (token === '--simulator' || token === '-s') {
      if (i + 1 < tokens.length) {
        args.simulator = tokens[++i];
      }
    }
    // Handle --threshold or -t
    else if (token === '--threshold' || token === '-t') {
      if (i + 1 < tokens.length) {
        const val = parseFloat(tokens[++i]);
        if (!isNaN(val) && val >= 0 && val <= 1) {
          args.threshold = val;
        }
      }
    }
    // Handle --output or -o
    else if (token === '--output' || token === '-o') {
      if (i + 1 < tokens.length) {
        args.outputDir = tokens[++i];
      }
    }
    // Handle --device-family
    else if (token === '--device-family') {
      if (i + 1 < tokens.length) {
        const family = tokens[++i];
        if (isValidDeviceFamily(family)) {
          args.deviceFamily = family as iosTools.DeviceFamily;
        }
      }
    }
    // Handle --fail-fast
    else if (token === '--fail-fast') {
      args.failFast = true;
    }
    // Handle --update or -u
    else if (token === '--update' || token === '-u') {
      args.update = true;
    }
    // Handle --verbose or -v
    else if (token === '--verbose' || token === '-v') {
      args.verbose = true;
    }
    // Handle unknown tokens
    else if (!token.startsWith('-')) {
      args.raw = args.raw ? `${args.raw} ${token}` : token;
    }

    i++;
  }

  return args;
}

/**
 * Tokenize a string respecting quoted values.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Check if a string is a valid device family.
 */
function isValidDeviceFamily(value: string): boolean {
  const families: iosTools.DeviceFamily[] = [
    'iPhone-SE',
    'iPhone',
    'iPhone-Plus',
    'iPhone-Pro-Max',
    'iPad',
    'iPad-Pro',
  ];
  return families.includes(value as iosTools.DeviceFamily);
}

// =============================================================================
// Command Execution
// =============================================================================

/**
 * Execute the /ios.regression command.
 *
 * @param commandText - Full command text
 * @param sessionId - Session ID for artifact storage
 * @param projectPath - Current project path (used for default project name)
 * @returns Command result with formatted output
 */
export async function executeRegressionCommand(
  commandText: string,
  sessionId: string,
  projectPath?: string
): Promise<RegressionCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing regression command: ${commandText}`);
  const startTime = Date.now();

  // Parse arguments
  const args = parseRegressionArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  // Determine project name
  const project = args.project || (projectPath ? path.basename(projectPath) : 'default');

  try {
    // Get booted simulator
    const udid = await resolveSimulator(args.simulator);
    if (!udid) {
      return {
        success: false,
        output: formatError(
          'No booted simulator found',
          'Boot a simulator first with `xcrun simctl boot <device>`\n\n' +
            'Or specify a simulator with `--simulator <name>`'
        ),
        error: 'No booted simulator found',
      };
    }

    // Get simulator info
    const simInfo = await getSimulatorInfo(udid);

    // Set up output directory
    const outputDir =
      args.outputDir || path.join(process.env.TMPDIR || '/tmp', 'maestro-regression', sessionId);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Initialize result
    const result: RegressionTestResult = {
      project,
      timestamp: new Date(),
      duration: 0,
      passed: true,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        updated: 0,
        skipped: 0,
        passRate: 0,
      },
      screenResults: [],
      flowResults: [],
      deviceFamily: args.deviceFamily,
      threshold: args.threshold ?? iosTools.DEFAULT_THRESHOLD,
      simulator: {
        udid,
        name: simInfo?.name,
      },
      outputDir,
    };

    // Run screen baseline tests (unless flows-only mode)
    if (args.mode !== 'flows-only') {
      const screenResults = await runScreenBaselineTests(
        project,
        udid,
        args,
        result.threshold,
        outputDir
      );
      result.screenResults = screenResults;

      // Check for fail-fast
      if (args.failFast && screenResults.some((r) => !r.passed)) {
        result.passed = false;
        result.duration = Date.now() - startTime;
        updateSummary(result);
        return {
          success: true,
          output: formatRegressionResult(result, args.verbose ?? false),
          data: result,
        };
      }
    }

    // Run flow baseline tests if requested
    if (args.includeFlows || args.mode === 'flows-only') {
      const flowResults = await runFlowBaselineTests(
        project,
        udid,
        args,
        result.threshold,
        outputDir
      );
      result.flowResults = flowResults;
    }

    // Calculate final stats
    result.duration = Date.now() - startTime;
    updateSummary(result);
    result.passed = result.summary.failed === 0;

    // Generate HTML report if output dir specified
    if (args.outputDir) {
      await generateHtmlReport(result, outputDir);
    }

    const output = formatRegressionResult(result, args.verbose ?? false);

    return {
      success: true,
      output,
      data: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Error in regression test: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Regression test failed', errorMessage),
      error: errorMessage,
    };
  }
}

// =============================================================================
// Screen Baseline Tests
// =============================================================================

/**
 * Run tests for all screen baselines.
 */
async function runScreenBaselineTests(
  project: string,
  udid: string,
  args: RegressionCommandArgs,
  threshold: number,
  outputDir: string
): Promise<BaselineTestResult[]> {
  const results: BaselineTestResult[] = [];

  // List all baselines
  const baselines = await iosTools.listBaselines(project, args.deviceFamily);

  if (baselines.length === 0) {
    logger.info(`${LOG_CONTEXT} No screen baselines found for project: ${project}`);
    return results;
  }

  logger.info(`${LOG_CONTEXT} Testing ${baselines.length} screen baselines`);

  // Capture current screenshot
  const tempDir = path.join(outputDir, 'current');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const screenshotResult = await iosTools.captureScreenshot(udid, tempDir, 'current');
  if (!screenshotResult.success || !screenshotResult.data) {
    // All baselines will be marked as error
    for (const baseline of baselines) {
      results.push({
        name: baseline.name,
        type: 'screen',
        deviceFamily: baseline.deviceFamily,
        passed: false,
        similarity: 0,
        diffPercent: 100,
        diffPixels: 0,
        changedRegions: 0,
        baselinePath: '',
        currentPath: '',
        error: screenshotResult.error || 'Failed to capture screenshot',
        duration: 0,
      });
    }
    return results;
  }

  const currentPath = screenshotResult.data.path;

  // Test each baseline
  for (const baselineEntry of baselines) {
    const testStart = Date.now();
    const testResult = await testSingleBaseline(
      project,
      baselineEntry,
      currentPath,
      threshold,
      outputDir,
      args.update ?? false
    );
    testResult.duration = Date.now() - testStart;
    results.push(testResult);

    // Fail-fast check
    if (args.failFast && !testResult.passed) {
      break;
    }
  }

  return results;
}

/**
 * Test a single baseline.
 */
async function testSingleBaseline(
  project: string,
  baselineEntry: iosTools.BaselineEntry,
  currentPath: string,
  threshold: number,
  outputDir: string,
  update: boolean
): Promise<BaselineTestResult> {
  try {
    const baseline = await iosTools.getBaseline(
      project,
      baselineEntry.name,
      baselineEntry.deviceFamily
    );

    if (!baseline) {
      return {
        name: baselineEntry.name,
        type: 'screen',
        deviceFamily: baselineEntry.deviceFamily,
        passed: false,
        similarity: 0,
        diffPercent: 100,
        diffPixels: 0,
        changedRegions: 0,
        baselinePath: '',
        currentPath,
        error: 'Baseline not found',
        duration: 0,
      };
    }

    const diffOutputPath = path.join(outputDir, `${baselineEntry.name}_diff.png`);

    const comparison = await iosTools.fullComparison(baseline.imagePath, currentPath, {
      compare: {
        threshold,
        ignoreRegions: baseline.metadata.ignoreRegions,
      },
      output: { diffImagePath: diffOutputPath },
      diffMode: 'overlay',
      ignoreRegions: baseline.metadata.ignoreRegions,
    });

    let updated = false;
    if (update && !comparison.comparison.match) {
      await iosTools.updateBaseline(project, baselineEntry.name, currentPath, baselineEntry.deviceFamily);
      updated = true;
    }

    return {
      name: baselineEntry.name,
      type: 'screen',
      deviceFamily: baselineEntry.deviceFamily,
      passed: comparison.comparison.match,
      similarity: comparison.comparison.similarity,
      diffPercent: comparison.comparison.diffPercent,
      diffPixels: comparison.comparison.diffPixels,
      changedRegions: comparison.analysis.changes.filter((c) => !c.isIgnored).length,
      baselinePath: baseline.imagePath,
      currentPath,
      diffPath: diffOutputPath,
      analysis: comparison.analysis,
      updated,
      duration: 0,
    };
  } catch (error) {
    return {
      name: baselineEntry.name,
      type: 'screen',
      deviceFamily: baselineEntry.deviceFamily,
      passed: false,
      similarity: 0,
      diffPercent: 100,
      diffPixels: 0,
      changedRegions: 0,
      baselinePath: '',
      currentPath,
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}

// =============================================================================
// Flow Baseline Tests
// =============================================================================

/**
 * Run tests for all flow baselines.
 */
async function runFlowBaselineTests(
  project: string,
  udid: string,
  args: RegressionCommandArgs,
  threshold: number,
  outputDir: string
): Promise<FlowTestResult[]> {
  const results: FlowTestResult[] = [];

  // List all flows
  const flows = await iosTools.listFlows(project);

  if (flows.length === 0) {
    logger.info(`${LOG_CONTEXT} No flow baselines found for project: ${project}`);
    return results;
  }

  logger.info(`${LOG_CONTEXT} Testing ${flows.length} flow baselines`);

  // Note: Full flow testing would require executing flow steps
  // For now, we compare current screen against each flow step
  // This is a simplified implementation

  for (const flowEntry of flows) {
    const flowStart = Date.now();
    const flow = await iosTools.getFlowBaselineStorage(project, flowEntry.name);

    if (!flow || flow.steps.length === 0) {
      results.push({
        flowName: flowEntry.name,
        passed: false,
        steps: [],
        passedSteps: 0,
        failedSteps: 0,
        totalSteps: 0,
        duration: 0,
      });
      continue;
    }

    const stepResults: BaselineTestResult[] = [];

    // Capture current screenshot for comparison
    const tempDir = path.join(outputDir, 'flows', flowEntry.name);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const screenshotResult = await iosTools.captureScreenshot(udid, tempDir, 'current');
    if (!screenshotResult.success || !screenshotResult.data) {
      // All steps marked as error
      for (const step of flow.steps) {
        stepResults.push({
          name: step.name,
          type: 'flow-step',
          flowName: flowEntry.name,
          stepNumber: step.stepNumber,
          passed: false,
          similarity: 0,
          diffPercent: 100,
          diffPixels: 0,
          changedRegions: 0,
          baselinePath: '',
          currentPath: '',
          error: screenshotResult.error || 'Failed to capture screenshot',
          duration: 0,
        });
      }
    } else {
      const currentPath = screenshotResult.data.path;

      for (const step of flow.steps) {
        const stepStart = Date.now();
        const baselineStepPath = path.join(
          iosTools.getFlowPath(project, flowEntry.name),
          `step_${step.stepNumber}.png`
        );

        if (!fs.existsSync(baselineStepPath)) {
          stepResults.push({
            name: step.name,
            type: 'flow-step',
            flowName: flowEntry.name,
            stepNumber: step.stepNumber,
            passed: false,
            similarity: 0,
            diffPercent: 100,
            diffPixels: 0,
            changedRegions: 0,
            baselinePath: baselineStepPath,
            currentPath,
            error: 'Step baseline image not found',
            duration: Date.now() - stepStart,
          });
          continue;
        }

        try {
          const diffOutputPath = path.join(
            outputDir,
            'flows',
            flowEntry.name,
            `step_${step.stepNumber}_diff.png`
          );

          const comparison = await iosTools.fullComparison(baselineStepPath, currentPath, {
            compare: { threshold },
            output: { diffImagePath: diffOutputPath },
            diffMode: 'overlay',
          });

          stepResults.push({
            name: step.name,
            type: 'flow-step',
            flowName: flowEntry.name,
            stepNumber: step.stepNumber,
            passed: comparison.comparison.match,
            similarity: comparison.comparison.similarity,
            diffPercent: comparison.comparison.diffPercent,
            diffPixels: comparison.comparison.diffPixels,
            changedRegions: comparison.analysis.changes.filter((c) => !c.isIgnored).length,
            baselinePath: baselineStepPath,
            currentPath,
            diffPath: diffOutputPath,
            analysis: comparison.analysis,
            duration: Date.now() - stepStart,
          });
        } catch (error) {
          stepResults.push({
            name: step.name,
            type: 'flow-step',
            flowName: flowEntry.name,
            stepNumber: step.stepNumber,
            passed: false,
            similarity: 0,
            diffPercent: 100,
            diffPixels: 0,
            changedRegions: 0,
            baselinePath: baselineStepPath,
            currentPath,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - stepStart,
          });
        }
      }
    }

    results.push({
      flowName: flowEntry.name,
      passed: stepResults.every((s) => s.passed),
      steps: stepResults,
      passedSteps: stepResults.filter((s) => s.passed).length,
      failedSteps: stepResults.filter((s) => !s.passed).length,
      totalSteps: stepResults.length,
      duration: Date.now() - flowStart,
    });

    // Fail-fast check
    if (args.failFast && !results[results.length - 1].passed) {
      break;
    }
  }

  return results;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Update summary statistics from results.
 */
function updateSummary(result: RegressionTestResult): void {
  const screenPassed = result.screenResults.filter((r) => r.passed).length;
  const screenFailed = result.screenResults.filter((r) => !r.passed && !r.error).length;
  const screenUpdated = result.screenResults.filter((r) => r.updated).length;
  const screenSkipped = result.screenResults.filter((r) => r.error).length;

  let flowPassed = 0;
  let flowFailed = 0;
  let flowSkipped = 0;

  for (const flow of result.flowResults) {
    flowPassed += flow.passedSteps;
    flowFailed += flow.failedSteps;
    flowSkipped += flow.steps.filter((s) => s.error).length;
  }

  result.summary = {
    total:
      result.screenResults.length + result.flowResults.reduce((sum, f) => sum + f.totalSteps, 0),
    passed: screenPassed + flowPassed,
    failed: screenFailed + flowFailed,
    updated: screenUpdated,
    skipped: screenSkipped + flowSkipped,
    passRate: 0,
  };

  if (result.summary.total > 0) {
    result.summary.passRate = result.summary.passed / result.summary.total;
  }
}

/**
 * Resolve simulator name/UDID to a booted simulator UDID.
 */
async function resolveSimulator(simulator?: string): Promise<string | undefined> {
  const bootedResult = await iosTools.getBootedSimulators();
  if (!bootedResult.success || !bootedResult.data || bootedResult.data.length === 0) {
    return undefined;
  }

  if (!simulator) {
    return bootedResult.data[0].udid;
  }

  if (isUdid(simulator)) {
    const found = bootedResult.data.find((s) => s.udid === simulator);
    return found?.udid;
  }

  const byName = bootedResult.data.find(
    (s) => s.name.toLowerCase() === simulator.toLowerCase()
  );
  if (byName) {
    return byName.udid;
  }

  const partial = bootedResult.data.find((s) =>
    s.name.toLowerCase().includes(simulator.toLowerCase())
  );
  return partial?.udid;
}

/**
 * Get simulator info.
 */
async function getSimulatorInfo(
  udid: string
): Promise<{ name: string; runtime: string } | undefined> {
  const result = await iosTools.getSimulator(udid);
  if (result.success && result.data) {
    return {
      name: result.data.name,
      runtime: result.data.runtime,
    };
  }
  return undefined;
}

/**
 * Check if a string looks like a simulator UDID.
 */
function isUdid(value: string): boolean {
  return /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(
    value
  );
}

/**
 * Generate HTML report.
 */
async function generateHtmlReport(result: RegressionTestResult, outputDir: string): Promise<void> {
  const htmlPath = path.join(outputDir, 'report.html');
  const html = generateHtmlContent(result);
  fs.writeFileSync(htmlPath, html, 'utf-8');
  logger.info(`${LOG_CONTEXT} Generated HTML report: ${htmlPath}`);
}

/**
 * Generate HTML content for report.
 */
function generateHtmlContent(result: RegressionTestResult): string {
  const statusClass = result.passed ? 'passed' : 'failed';
  const statusText = result.passed ? 'PASSED' : 'FAILED';

  let screenRows = '';
  for (const screen of result.screenResults) {
    const rowClass = screen.passed ? 'pass' : 'fail';
    screenRows += `
      <tr class="${rowClass}">
        <td>${screen.name}</td>
        <td>${screen.passed ? '✅' : '❌'}</td>
        <td>${(screen.similarity * 100).toFixed(1)}%</td>
        <td>${screen.diffPixels.toLocaleString()}</td>
        <td>${screen.changedRegions}</td>
        <td>${screen.duration}ms</td>
      </tr>`;
  }

  let flowRows = '';
  for (const flow of result.flowResults) {
    const rowClass = flow.passed ? 'pass' : 'fail';
    flowRows += `
      <tr class="${rowClass}">
        <td>${flow.flowName}</td>
        <td>${flow.passed ? '✅' : '❌'}</td>
        <td>${flow.passedSteps}/${flow.totalSteps}</td>
        <td colspan="2">-</td>
        <td>${flow.duration}ms</td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <title>Visual Regression Report - ${result.project}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { display: flex; gap: 20px; margin-bottom: 20px; }
    .stat { padding: 15px; border-radius: 8px; background: #f5f5f5; }
    .stat.passed { background: #d4edda; }
    .stat.failed { background: #f8d7da; }
    .stat-value { font-size: 24px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    tr.pass td { background: #d4edda; }
    tr.fail td { background: #f8d7da; }
    .timestamp { color: #666; }
  </style>
</head>
<body>
  <h1>Visual Regression Report: ${result.project}</h1>
  <p class="timestamp">Generated: ${result.timestamp.toISOString()}</p>

  <div class="summary">
    <div class="stat ${statusClass}">
      <div class="stat-value">${statusText}</div>
      <div>Overall Status</div>
    </div>
    <div class="stat">
      <div class="stat-value">${result.summary.passed}/${result.summary.total}</div>
      <div>Passed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${(result.summary.passRate * 100).toFixed(1)}%</div>
      <div>Pass Rate</div>
    </div>
    <div class="stat">
      <div class="stat-value">${result.duration}ms</div>
      <div>Duration</div>
    </div>
  </div>

  ${result.screenResults.length > 0 ? `
  <h2>Screen Baselines</h2>
  <table>
    <thead>
      <tr>
        <th>Baseline</th>
        <th>Status</th>
        <th>Similarity</th>
        <th>Diff Pixels</th>
        <th>Regions</th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody>
      ${screenRows}
    </tbody>
  </table>
  ` : ''}

  ${result.flowResults.length > 0 ? `
  <h2>Flow Baselines</h2>
  <table>
    <thead>
      <tr>
        <th>Flow</th>
        <th>Status</th>
        <th>Steps</th>
        <th colspan="2"></th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody>
      ${flowRows}
    </tbody>
  </table>
  ` : ''}
</body>
</html>`;
}

// =============================================================================
// Output Formatters
// =============================================================================

/**
 * Format regression result as markdown.
 */
function formatRegressionResult(result: RegressionTestResult, verbose: boolean): string {
  const status = result.passed ? '✅ ALL TESTS PASSED' : '❌ TESTS FAILED';
  const familyFilter = result.deviceFamily ? ` (${result.deviceFamily})` : '';

  let output = `## Visual Regression Report: ${result.project}${familyFilter}

**Status**: ${status}
**Duration**: ${formatDuration(result.duration)}
**Simulator**: ${result.simulator.name || result.simulator.udid}

### Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${result.summary.total} |
| Passed | ${result.summary.passed} |
| Failed | ${result.summary.failed} |
| Skipped | ${result.summary.skipped} |
| Updated | ${result.summary.updated} |
| Pass Rate | ${(result.summary.passRate * 100).toFixed(1)}% |
`;

  // Screen baselines
  if (result.screenResults.length > 0) {
    output += `
### Screen Baselines

| Baseline | Status | Similarity | Diff Pixels | Regions |
|----------|--------|------------|-------------|---------|
`;

    for (const screen of result.screenResults) {
      const statusIcon = screen.passed ? '✅' : screen.error ? '⚠️' : '❌';
      const similarity = screen.error ? '-' : `${(screen.similarity * 100).toFixed(1)}%`;
      const updatedIcon = screen.updated ? ' ⚡' : '';
      output += `| ${screen.name}${updatedIcon} | ${statusIcon} | ${similarity} | ${screen.diffPixels.toLocaleString()} | ${screen.changedRegions} |\n`;
    }

    // Verbose: show failed baselines detail
    if (verbose) {
      const failedScreens = result.screenResults.filter((r) => !r.passed);
      if (failedScreens.length > 0) {
        output += `
### Failed Screen Baselines Detail

`;
        for (const screen of failedScreens.slice(0, 5)) {
          output += formatFailedBaselineDetail(screen);
        }
        if (failedScreens.length > 5) {
          output += `\n*... and ${failedScreens.length - 5} more failed baselines*\n`;
        }
      }
    }
  }

  // Flow baselines
  if (result.flowResults.length > 0) {
    output += `
### Flow Baselines

| Flow | Status | Steps | Passed | Failed |
|------|--------|-------|--------|--------|
`;

    for (const flow of result.flowResults) {
      const statusIcon = flow.passed ? '✅' : '❌';
      output += `| ${flow.flowName} | ${statusIcon} | ${flow.totalSteps} | ${flow.passedSteps} | ${flow.failedSteps} |\n`;
    }
  }

  // Output directory
  if (result.outputDir) {
    output += `
### Output

- **Diff Images**: \`${result.outputDir}\`
- **HTML Report**: \`${path.join(result.outputDir, 'report.html')}\`
`;
  }

  // Next steps for failures
  if (!result.passed) {
    output += `
### Next Steps

1. Review the diff images to understand the changes
2. If changes are intentional, update baselines:
   - Single: \`/ios.baseline update <name>\`
   - All failed: \`/ios.regression --update\`
3. If changes are bugs, fix the app and re-run: \`/ios.regression\`
`;
  }

  return output;
}

/**
 * Format failed baseline detail.
 */
function formatFailedBaselineDetail(result: BaselineTestResult): string {
  let output = `#### ${result.name}

- **Similarity**: ${(result.similarity * 100).toFixed(1)}%
- **Changed Pixels**: ${result.diffPixels.toLocaleString()} (${result.diffPercent.toFixed(2)}%)
- **Changed Regions**: ${result.changedRegions}
`;

  if (result.error) {
    output += `- **Error**: ${result.error}\n`;
  }

  if (result.analysis && result.analysis.changes.length > 0) {
    const changes = result.analysis.changes.filter((c) => !c.isIgnored).slice(0, 3);
    output += `- **Top Changes**:\n`;
    for (const change of changes) {
      const severity = change.severity >= 0.7 ? '🔴' : change.severity >= 0.3 ? '🟡' : '🟢';
      output += `  - ${severity} ${change.changeType} at (${Math.round(change.bounds.x)}, ${Math.round(change.bounds.y)})\n`;
    }
  }

  if (result.diffPath) {
    output += `- **Diff**: \`${result.diffPath}\`\n`;
  }

  output += '\n';
  return output;
}

/**
 * Format duration.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format error message.
 */
function formatError(title: string, detail: string): string {
  return `## iOS Regression Failed

**Error**: ${title}

${detail}
`;
}

// =============================================================================
// Command Metadata
// =============================================================================

/**
 * Metadata for the /ios.regression command.
 */
export const regressionCommandMetadata = {
  command: '/ios.regression',
  description: 'Run comprehensive visual regression tests across all baselines',
  usage: '/ios.regression [options]',
  options: [
    {
      name: '--quick, -q',
      description: 'Stop on first failure',
      valueHint: null,
    },
    {
      name: '--flows',
      description: 'Include flow baselines in regression test',
      valueHint: null,
    },
    {
      name: '--flows-only',
      description: 'Only test flow baselines',
      valueHint: null,
    },
    {
      name: '--project, -p',
      description: 'Project name for baseline storage',
      valueHint: '<name>',
    },
    {
      name: '--simulator, -s',
      description: 'Target simulator name or UDID',
      valueHint: '<name|udid>',
    },
    {
      name: '--threshold, -t',
      description: 'Pixel difference threshold (0-1, default: 0.1)',
      valueHint: '<0-1>',
    },
    {
      name: '--output, -o',
      description: 'Directory to save diff images and HTML report',
      valueHint: '<path>',
    },
    {
      name: '--device-family',
      description: 'Device family filter (iPhone-SE, iPhone, etc.)',
      valueHint: '<family>',
    },
    {
      name: '--fail-fast',
      description: 'Stop on first failure',
      valueHint: null,
    },
    {
      name: '--update, -u',
      description: 'Auto-update all failed baselines',
      valueHint: null,
    },
    {
      name: '--verbose, -v',
      description: 'Include detailed change analysis in output',
      valueHint: null,
    },
  ],
  examples: [
    '/ios.regression',
    '/ios.regression --quick',
    '/ios.regression --flows',
    '/ios.regression --flows-only',
    '/ios.regression --verbose',
    '/ios.regression --output ~/regression-report',
    '/ios.regression --update',
    '/ios.regression -p my_project --device-family iPhone',
  ],
};
