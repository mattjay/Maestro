/**
 * iOS Diff Slash Command Handler
 *
 * Handles the /ios.diff command for comparing current screen state against
 * visual regression baselines.
 *
 * Usage:
 *   /ios.diff <baseline>           - Compare current screen to baseline
 *   /ios.diff --flow <flowName>    - Compare all steps in a flow
 *   /ios.diff --all                - Compare all baselines in project
 *
 * Options:
 *   --project, -p       Project name (default: current directory name)
 *   --simulator, -s     Target simulator name or UDID (default: first booted)
 *   --threshold, -t     Pixel difference threshold 0-1 (default: 0.1)
 *   --output, -o        Directory to save diff images
 *   --update, -u        Update baseline if different
 *   --device-family     Use device family directories
 */

import path from 'path';
import * as iosTools from '../ios-tools';
import { logger } from '../utils/logger';

const LOG_CONTEXT = '[SlashCmd-ios.diff]';

// =============================================================================
// Types
// =============================================================================

/**
 * Mode of diff operation
 */
export type DiffMode = 'single' | 'flow' | 'all';

/**
 * Parsed arguments from /ios.diff command
 */
export interface DiffCommandArgs {
  /** Diff mode */
  mode: DiffMode;
  /** Baseline name (for single mode) */
  baseline?: string;
  /** Flow name (for flow mode) */
  flowName?: string;
  /** Project name */
  project?: string;
  /** Simulator name or UDID */
  simulator?: string;
  /** Pixel difference threshold (0-1) */
  threshold?: number;
  /** Directory to save diff images */
  outputDir?: string;
  /** Update baseline if different */
  update?: boolean;
  /** Device family */
  deviceFamily?: iosTools.DeviceFamily;
  /** Raw input (unparsed portion) */
  raw?: string;
}

/**
 * Single baseline comparison result
 */
export interface SingleDiffResult {
  baselineName: string;
  match: boolean;
  similarity: number;
  diffPercent: number;
  diffPixels: number;
  changedRegions: number;
  baselinePath: string;
  currentPath: string;
  diffPath?: string;
  analysis?: iosTools.ImageAnalysisResult;
  updated?: boolean;
}

/**
 * Flow comparison result
 */
export interface FlowDiffResult {
  flowName: string;
  steps: SingleDiffResult[];
  allMatch: boolean;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
}

/**
 * Result of executing the diff command
 */
export interface DiffCommandResult {
  success: boolean;
  /** Formatted output for display in AI terminal */
  output: string;
  /** Raw data (for programmatic use) */
  data?: SingleDiffResult | FlowDiffResult | SingleDiffResult[];
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Argument Parsing
// =============================================================================

/**
 * Parse command line arguments from /ios.diff command text.
 *
 * @param commandText - Full command text including /ios.diff
 * @returns Parsed arguments
 */
export function parseDiffArgs(commandText: string): DiffCommandArgs {
  const args: DiffCommandArgs = {
    mode: 'single',
  };

  // Remove the command prefix
  const argsText = commandText.replace(/^\/ios\.diff\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  // Tokenize respecting quoted strings
  const tokens = tokenize(argsText);

  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Handle --flow or -f
    if (token === '--flow' || token === '-f') {
      args.mode = 'flow';
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        args.flowName = tokens[++i];
      }
    }
    // Handle --all
    else if (token === '--all') {
      args.mode = 'all';
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
    // Handle --update or -u
    else if (token === '--update' || token === '-u') {
      args.update = true;
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
    // Positional arguments - baseline name
    else if (!token.startsWith('-')) {
      if (!args.baseline && args.mode === 'single') {
        args.baseline = token;
      } else {
        args.raw = args.raw ? `${args.raw} ${token}` : token;
      }
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
 * Execute the /ios.diff command.
 *
 * @param commandText - Full command text
 * @param sessionId - Session ID for artifact storage
 * @param projectPath - Current project path (used for default project name)
 * @returns Command result with formatted output
 */
export async function executeDiffCommand(
  commandText: string,
  sessionId: string,
  projectPath?: string
): Promise<DiffCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing diff command: ${commandText}`);

  // Parse arguments
  const args = parseDiffArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  // Determine project name
  const project = args.project || (projectPath ? path.basename(projectPath) : 'default');

  // Route to appropriate handler
  switch (args.mode) {
    case 'single':
      return executeSingleDiff(args, project, sessionId);
    case 'flow':
      return executeFlowDiff(args, project, sessionId);
    case 'all':
      return executeAllDiff(args, project, sessionId);
    default:
      return {
        success: false,
        output: formatUsageHelp(),
        error: 'Unknown diff mode',
      };
  }
}

// =============================================================================
// Single Baseline Diff
// =============================================================================

/**
 * Compare current screen to a single baseline.
 */
async function executeSingleDiff(
  args: DiffCommandArgs,
  project: string,
  sessionId: string
): Promise<DiffCommandResult> {
  if (!args.baseline) {
    return {
      success: false,
      output: formatError(
        'Baseline name is required',
        'Usage: /ios.diff <baseline_name>\n\nList baselines with: /ios.baseline list'
      ),
      error: 'Baseline name is required',
    };
  }

  try {
    // Get the baseline
    const baseline = await iosTools.getBaseline(project, args.baseline, args.deviceFamily);
    if (!baseline) {
      return {
        success: false,
        output: formatError(
          `Baseline "${args.baseline}" not found`,
          `Check available baselines with: /ios.baseline list\n\n` +
            `Create a new baseline with: /ios.baseline save ${args.baseline}`
        ),
        error: `Baseline "${args.baseline}" not found`,
      };
    }

    // Get booted simulator
    const udid = await resolveSimulator(args.simulator);
    if (!udid) {
      return {
        success: false,
        output: formatError(
          'No booted simulator found',
          'Boot a simulator first with `xcrun simctl boot <device>`'
        ),
        error: 'No booted simulator found',
      };
    }

    // Capture current screenshot
    const tempDir = path.join(process.env.TMPDIR || '/tmp', 'maestro-diff', sessionId);
    const screenshotResult = await iosTools.captureScreenshot(udid, tempDir, 'current');
    if (!screenshotResult.success || !screenshotResult.data) {
      return {
        success: false,
        output: formatError(
          'Failed to capture screenshot',
          screenshotResult.error || 'Unknown error'
        ),
        error: screenshotResult.error || 'Failed to capture screenshot',
      };
    }

    const currentPath = screenshotResult.data.path;

    // Set up output path for diff image
    const diffOutputPath = args.outputDir
      ? path.join(args.outputDir, `${args.baseline}_diff.png`)
      : path.join(tempDir, `${args.baseline}_diff.png`);

    // Run comparison
    const threshold = args.threshold ?? iosTools.DEFAULT_THRESHOLD;
    const comparison = await iosTools.fullComparison(baseline.imagePath, currentPath, {
      compare: {
        threshold,
        ignoreRegions: baseline.metadata.ignoreRegions,
      },
      output: {
        diffImagePath: diffOutputPath,
      },
      diffMode: 'overlay',
      ignoreRegions: baseline.metadata.ignoreRegions,
    });

    // Build result
    const result: SingleDiffResult = {
      baselineName: args.baseline,
      match: comparison.comparison.match,
      similarity: comparison.comparison.similarity,
      diffPercent: comparison.comparison.diffPercent,
      diffPixels: comparison.comparison.diffPixels,
      changedRegions: comparison.analysis.changes.filter((c) => !c.isIgnored).length,
      baselinePath: baseline.imagePath,
      currentPath,
      diffPath: diffOutputPath,
      analysis: comparison.analysis,
    };

    // Update baseline if requested and there are differences
    if (args.update && !comparison.comparison.match) {
      await iosTools.updateBaseline(project, args.baseline, currentPath, args.deviceFamily);
      result.updated = true;
    }

    const output = formatSingleDiffResult(args.baseline, project, result, comparison.report);

    return {
      success: true,
      output,
      data: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Error in single diff: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Failed to compare baseline', errorMessage),
      error: errorMessage,
    };
  }
}

// =============================================================================
// Flow Diff
// =============================================================================

/**
 * Compare all steps in a flow against baselines.
 */
async function executeFlowDiff(
  args: DiffCommandArgs,
  project: string,
  sessionId: string
): Promise<DiffCommandResult> {
  if (!args.flowName) {
    return {
      success: false,
      output: formatError(
        'Flow name is required',
        'Usage: /ios.diff --flow <flow_name>\n\nList flows with: /ios.baseline list'
      ),
      error: 'Flow name is required',
    };
  }

  try {
    // Get the flow baseline
    const flow = await iosTools.getFlowBaselineStorage(project, args.flowName);
    if (!flow) {
      return {
        success: false,
        output: formatError(
          `Flow "${args.flowName}" not found`,
          `Check available flows with: /ios.baseline list`
        ),
        error: `Flow "${args.flowName}" not found`,
      };
    }

    // Get booted simulator
    const udid = await resolveSimulator(args.simulator);
    if (!udid) {
      return {
        success: false,
        output: formatError(
          'No booted simulator found',
          'Boot a simulator first with `xcrun simctl boot <device>`'
        ),
        error: 'No booted simulator found',
      };
    }

    // This mode requires the agent to navigate through the flow manually
    // For now, we'll compare any existing flow steps that have both baseline and current
    // In a full implementation, this would integrate with flow execution

    const results: SingleDiffResult[] = [];
    const tempDir = path.join(process.env.TMPDIR || '/tmp', 'maestro-diff', sessionId);
    const threshold = args.threshold ?? iosTools.DEFAULT_THRESHOLD;

    // For each step, compare if we can get a current screenshot
    // Note: This is a simplified implementation - full flow diffing would
    // involve executing the flow and capturing at each step
    for (const step of flow.steps) {
      const baselineStepPath = path.join(
        iosTools.getFlowPath(project, args.flowName),
        `step_${step.stepNumber}.png`
      );

      // Capture current screen for this step
      // In full implementation, this would be triggered after flow step execution
      const screenshotResult = await iosTools.captureScreenshot(
        udid,
        tempDir,
        `step_${step.stepNumber}`
      );

      if (!screenshotResult.success || !screenshotResult.data) {
        results.push({
          baselineName: step.name,
          match: false,
          similarity: 0,
          diffPercent: 100,
          diffPixels: 0,
          changedRegions: 0,
          baselinePath: baselineStepPath,
          currentPath: '',
          analysis: undefined,
        });
        continue;
      }

      const currentPath = screenshotResult.data.path;
      const diffOutputPath = args.outputDir
        ? path.join(args.outputDir, `${args.flowName}_step_${step.stepNumber}_diff.png`)
        : path.join(tempDir, `${args.flowName}_step_${step.stepNumber}_diff.png`);

      try {
        const comparison = await iosTools.fullComparison(baselineStepPath, currentPath, {
          compare: { threshold },
          output: { diffImagePath: diffOutputPath },
          diffMode: 'overlay',
        });

        results.push({
          baselineName: step.name,
          match: comparison.comparison.match,
          similarity: comparison.comparison.similarity,
          diffPercent: comparison.comparison.diffPercent,
          diffPixels: comparison.comparison.diffPixels,
          changedRegions: comparison.analysis.changes.filter((c) => !c.isIgnored).length,
          baselinePath: baselineStepPath,
          currentPath,
          diffPath: diffOutputPath,
          analysis: comparison.analysis,
        });
      } catch (stepError) {
        results.push({
          baselineName: step.name,
          match: false,
          similarity: 0,
          diffPercent: 100,
          diffPixels: 0,
          changedRegions: 0,
          baselinePath: baselineStepPath,
          currentPath,
        });
      }
    }

    const flowResult: FlowDiffResult = {
      flowName: args.flowName,
      steps: results,
      allMatch: results.every((r) => r.match),
      totalSteps: results.length,
      passedSteps: results.filter((r) => r.match).length,
      failedSteps: results.filter((r) => !r.match).length,
    };

    const output = formatFlowDiffResult(args.flowName, project, flowResult);

    return {
      success: true,
      output,
      data: flowResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Error in flow diff: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Failed to compare flow', errorMessage),
      error: errorMessage,
    };
  }
}

// =============================================================================
// All Baselines Diff
// =============================================================================

/**
 * Compare all baselines in a project.
 */
async function executeAllDiff(
  args: DiffCommandArgs,
  project: string,
  sessionId: string
): Promise<DiffCommandResult> {
  try {
    // List all baselines
    const baselines = await iosTools.listBaselines(project, args.deviceFamily);

    if (baselines.length === 0) {
      return {
        success: true,
        output: formatEmptyBaselines(project),
        data: [],
      };
    }

    // Get booted simulator
    const udid = await resolveSimulator(args.simulator);
    if (!udid) {
      return {
        success: false,
        output: formatError(
          'No booted simulator found',
          'Boot a simulator first with `xcrun simctl boot <device>`'
        ),
        error: 'No booted simulator found',
      };
    }

    const results: SingleDiffResult[] = [];
    const tempDir = path.join(process.env.TMPDIR || '/tmp', 'maestro-diff', sessionId);
    const threshold = args.threshold ?? iosTools.DEFAULT_THRESHOLD;

    // Capture current screenshot once (for now - full implementation would
    // navigate to each screen)
    const screenshotResult = await iosTools.captureScreenshot(udid, tempDir, 'current');
    if (!screenshotResult.success || !screenshotResult.data) {
      return {
        success: false,
        output: formatError(
          'Failed to capture screenshot',
          screenshotResult.error || 'Unknown error'
        ),
        error: screenshotResult.error || 'Failed to capture screenshot',
      };
    }

    const currentPath = screenshotResult.data.path;

    // Compare each baseline
    for (const baselineEntry of baselines) {
      const baseline = await iosTools.getBaseline(
        project,
        baselineEntry.name,
        baselineEntry.deviceFamily
      );

      if (!baseline) {
        results.push({
          baselineName: baselineEntry.name,
          match: false,
          similarity: 0,
          diffPercent: 100,
          diffPixels: 0,
          changedRegions: 0,
          baselinePath: '',
          currentPath,
        });
        continue;
      }

      const diffOutputPath = args.outputDir
        ? path.join(args.outputDir, `${baselineEntry.name}_diff.png`)
        : path.join(tempDir, `${baselineEntry.name}_diff.png`);

      try {
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
        if (args.update && !comparison.comparison.match) {
          await iosTools.updateBaseline(
            project,
            baselineEntry.name,
            currentPath,
            baselineEntry.deviceFamily
          );
          updated = true;
        }

        results.push({
          baselineName: baselineEntry.name,
          match: comparison.comparison.match,
          similarity: comparison.comparison.similarity,
          diffPercent: comparison.comparison.diffPercent,
          diffPixels: comparison.comparison.diffPixels,
          changedRegions: comparison.analysis.changes.filter((c) => !c.isIgnored).length,
          baselinePath: baseline.imagePath,
          currentPath,
          diffPath: diffOutputPath,
          analysis: comparison.analysis,
          updated,
        });
      } catch (compareError) {
        results.push({
          baselineName: baselineEntry.name,
          match: false,
          similarity: 0,
          diffPercent: 100,
          diffPixels: 0,
          changedRegions: 0,
          baselinePath: baseline.imagePath,
          currentPath,
        });
      }
    }

    const output = formatAllDiffResults(project, results, args.deviceFamily);

    return {
      success: true,
      output,
      data: results,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Error in all diff: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Failed to compare baselines', errorMessage),
      error: errorMessage,
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

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
 * Check if a string looks like a simulator UDID.
 */
function isUdid(value: string): boolean {
  return /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(
    value
  );
}

// =============================================================================
// Output Formatters
// =============================================================================

/**
 * Format single diff result.
 */
function formatSingleDiffResult(
  baselineName: string,
  project: string,
  result: SingleDiffResult,
  detailedReport: string
): string {
  const status = result.match ? '✅ MATCH' : '❌ DIFFERENCES DETECTED';
  const similarityPct = (result.similarity * 100).toFixed(1);

  let output = `## Visual Comparison: ${baselineName}

**Project**: ${project}
**Status**: ${status}
**Similarity**: ${similarityPct}%
**Changed Pixels**: ${result.diffPixels.toLocaleString()} (${result.diffPercent.toFixed(2)}%)
**Changed Regions**: ${result.changedRegions}
`;

  if (result.updated) {
    output += `
### ⚡ Baseline Updated
The baseline has been updated with the current screen.
`;
  }

  // Add changed regions detail if there are differences
  if (!result.match && result.analysis && result.analysis.changes.length > 0) {
    output += `
### Changed Regions

`;
    const displayChanges = result.analysis.changes.filter((c) => !c.isIgnored).slice(0, 10);
    for (const change of displayChanges) {
      const severity = change.severity >= 0.7 ? '🔴' : change.severity >= 0.3 ? '🟡' : '🟢';
      output += `${severity} **${change.changeType.toUpperCase()}** at (${Math.round(
        change.bounds.x
      )}, ${Math.round(change.bounds.y)}) - ${Math.round(change.bounds.width)}x${Math.round(
        change.bounds.height
      )}\n`;
      if (change.description) {
        output += `   ${change.description}\n`;
      }
    }

    if (result.analysis.changes.length > 10) {
      output += `\n   ... and ${result.analysis.changes.length - 10} more regions\n`;
    }
  }

  output += `
### Files
- **Baseline**: \`${result.baselinePath}\`
- **Current**: \`${result.currentPath}\``;

  if (result.diffPath) {
    output += `
- **Diff**: \`${result.diffPath}\``;
  }

  if (!result.match && !result.updated) {
    output += `

### Recommendation
Review the changes above. If intentional:
\`/ios.baseline update ${baselineName}\``;
  }

  return output;
}

/**
 * Format flow diff result.
 */
function formatFlowDiffResult(
  flowName: string,
  project: string,
  result: FlowDiffResult
): string {
  const status = result.allMatch
    ? '✅ ALL STEPS MATCH'
    : `❌ ${result.failedSteps} OF ${result.totalSteps} STEPS DIFFER`;

  let output = `## Flow Comparison: ${flowName}

**Project**: ${project}
**Status**: ${status}
**Passed**: ${result.passedSteps}/${result.totalSteps} steps

### Step Results

| # | Step | Status | Similarity | Changes |
|---|------|--------|------------|---------|
`;

  for (let i = 0; i < result.steps.length; i++) {
    const step = result.steps[i];
    const statusIcon = step.match ? '✅' : '❌';
    const similarity = (step.similarity * 100).toFixed(1);
    output += `| ${i + 1} | ${step.baselineName} | ${statusIcon} | ${similarity}% | ${step.changedRegions} |\n`;
  }

  // Show details for failed steps
  const failedSteps = result.steps.filter((s) => !s.match);
  if (failedSteps.length > 0) {
    output += `
### Failed Steps Detail

`;
    for (const step of failedSteps) {
      output += `#### ${step.baselineName}
- **Similarity**: ${(step.similarity * 100).toFixed(1)}%
- **Changed Pixels**: ${step.diffPixels.toLocaleString()}
- **Changed Regions**: ${step.changedRegions}
`;
      if (step.diffPath) {
        output += `- **Diff Image**: \`${step.diffPath}\`\n`;
      }
      output += '\n';
    }
  }

  return output;
}

/**
 * Format all baselines diff results.
 */
function formatAllDiffResults(
  project: string,
  results: SingleDiffResult[],
  deviceFamily?: iosTools.DeviceFamily
): string {
  const passed = results.filter((r) => r.match).length;
  const failed = results.filter((r) => !r.match).length;
  const updated = results.filter((r) => r.updated).length;
  const status =
    failed === 0 ? '✅ ALL BASELINES MATCH' : `❌ ${failed} OF ${results.length} BASELINES DIFFER`;

  const familyFilter = deviceFamily ? ` (${deviceFamily})` : '';

  let output = `## Visual Regression Check: ${project}${familyFilter}

**Status**: ${status}
**Passed**: ${passed}/${results.length}
**Failed**: ${failed}
${updated > 0 ? `**Updated**: ${updated}\n` : ''}
### Results Summary

| Baseline | Status | Similarity | Diff Pixels | Regions |
|----------|--------|------------|-------------|---------|
`;

  for (const result of results) {
    const statusIcon = result.match ? '✅' : '❌';
    const similarity = (result.similarity * 100).toFixed(1);
    const updatedIcon = result.updated ? ' ⚡' : '';
    output += `| ${result.baselineName}${updatedIcon} | ${statusIcon} | ${similarity}% | ${result.diffPixels.toLocaleString()} | ${result.changedRegions} |\n`;
  }

  // Show failed baselines detail
  const failedResults = results.filter((r) => !r.match);
  if (failedResults.length > 0 && failedResults.length <= 5) {
    output += `
### Failed Baselines

`;
    for (const result of failedResults) {
      output += `#### ${result.baselineName}
- **Similarity**: ${(result.similarity * 100).toFixed(1)}%
- **Changed Regions**: ${result.changedRegions}
`;
      if (result.diffPath) {
        output += `- **Diff**: \`${result.diffPath}\`\n`;
      }
      output += '\n';
    }
  }

  if (failed > 0 && updated === 0) {
    output += `
### Next Steps
To update baselines with current state:
- Single: \`/ios.baseline update <name>\`
- All at once: \`/ios.diff --all --update\``;
  }

  return output;
}

/**
 * Format empty baselines message.
 */
function formatEmptyBaselines(project: string): string {
  return `## Visual Regression Check: ${project}

**No baselines found.**

Create baselines first with:
\`/ios.baseline save <name>\`
`;
}

/**
 * Format error message.
 */
function formatError(title: string, detail: string): string {
  return `## iOS Diff Failed

**Error**: ${title}

${detail}
`;
}

/**
 * Format usage help.
 */
function formatUsageHelp(): string {
  return `## iOS Diff Command

Compare current screen state against visual regression baselines.

### Usage

| Command | Description |
|---------|-------------|
| \`/ios.diff <baseline>\` | Compare current screen to named baseline |
| \`/ios.diff --flow <name>\` | Compare all steps in a flow |
| \`/ios.diff --all\` | Compare all baselines in project |

### Options

| Option | Description |
|--------|-------------|
| \`--project, -p\` | Project name |
| \`--simulator, -s\` | Target simulator |
| \`--threshold, -t\` | Pixel difference threshold (0-1, default: 0.1) |
| \`--output, -o\` | Directory to save diff images |
| \`--update, -u\` | Update baseline if different |
| \`--device-family\` | Device family (iPhone-SE, iPhone, etc.) |

### Examples

\`\`\`
/ios.diff login_screen
/ios.diff login_screen --threshold 0.05
/ios.diff login_screen --update
/ios.diff --flow checkout_flow
/ios.diff --all
/ios.diff --all --update
\`\`\`

### Workflow

1. Create baselines: \`/ios.baseline save <name>\`
2. Make changes to your app
3. Compare: \`/ios.diff <name>\`
4. If changes are intentional: \`/ios.baseline update <name>\`
`;
}

// =============================================================================
// Command Metadata
// =============================================================================

/**
 * Metadata for the /ios.diff command.
 */
export const diffCommandMetadata = {
  command: '/ios.diff',
  description: 'Compare current screen against visual regression baselines',
  usage: '/ios.diff <baseline> | --flow <name> | --all [options]',
  options: [
    {
      name: '--flow, -f',
      description: 'Compare all steps in a flow',
      valueHint: '<flowName>',
    },
    {
      name: '--all',
      description: 'Compare all baselines in project',
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
      description: 'Directory to save diff images',
      valueHint: '<path>',
    },
    {
      name: '--update, -u',
      description: 'Update baseline if different',
      valueHint: null,
    },
    {
      name: '--device-family',
      description: 'Device family (iPhone-SE, iPhone, etc.)',
      valueHint: '<family>',
    },
  ],
  examples: [
    '/ios.diff login_screen',
    '/ios.diff login_screen --threshold 0.05',
    '/ios.diff login_screen --update',
    '/ios.diff --flow checkout_flow',
    '/ios.diff --all',
    '/ios.diff --all -p my_project --update',
  ],
};
