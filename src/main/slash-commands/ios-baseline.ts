/**
 * iOS Baseline Slash Command Handler
 *
 * Handles the /ios.baseline command for managing visual regression baselines.
 * Provides subcommands for saving, updating, listing, showing, and deleting baselines.
 *
 * Usage:
 *   /ios.baseline save <name>      - Capture current screen as baseline
 *   /ios.baseline update <name>    - Update existing baseline with current screen
 *   /ios.baseline list             - List all baselines in project
 *   /ios.baseline show <name>      - Display baseline info
 *   /ios.baseline delete <name>    - Remove baseline
 *   /ios.baseline ignore <name> <region> - Add ignore region to baseline
 *
 * Options:
 *   --project, -p     Project name (default: current directory name)
 *   --simulator, -s   Target simulator name or UDID (default: first booted)
 *   --app, -a         App bundle ID
 *   --device-family   Use device family directories (iPhone-SE, iPhone, iPhone-Pro-Max, iPad, iPad-Pro)
 *   --description     Description for the baseline
 *   --tags            Comma-separated tags for organization
 */

import path from 'path';
import * as iosTools from '../ios-tools';
import { logger } from '../utils/logger';

const LOG_CONTEXT = '[SlashCmd-ios.baseline]';

// =============================================================================
// Types
// =============================================================================

/**
 * Subcommand type for baseline operations
 */
export type BaselineSubcommand = 'save' | 'update' | 'list' | 'show' | 'delete' | 'ignore';

/**
 * Ignore region definition for adding via command
 */
export interface IgnoreRegionArg {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  reason?: iosTools.IgnoreReason;
}

/**
 * Parsed arguments from /ios.baseline command
 */
export interface BaselineCommandArgs {
  /** The subcommand to execute */
  subcommand?: BaselineSubcommand;
  /** Baseline name (for save, update, show, delete, ignore) */
  name?: string;
  /** Project name */
  project?: string;
  /** Simulator name or UDID */
  simulator?: string;
  /** App bundle ID */
  app?: string;
  /** Use device family directories */
  deviceFamily?: iosTools.DeviceFamily;
  /** Use auto-detected device family based on device name */
  useDeviceFamilyDir?: boolean;
  /** Description for the baseline */
  description?: string;
  /** Tags for organization */
  tags?: string[];
  /** Ignore region for 'ignore' subcommand */
  ignoreRegion?: IgnoreRegionArg;
  /** Raw input (unparsed portion) */
  raw?: string;
}

/**
 * Result of executing the baseline command
 */
export interface BaselineCommandResult {
  success: boolean;
  /** Formatted output for display in AI terminal */
  output: string;
  /** Raw data (for programmatic use) */
  data?: iosTools.BaselineMetadata | iosTools.BaselineEntry[] | { imagePath: string; metadata: iosTools.BaselineMetadata };
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Argument Parsing
// =============================================================================

/**
 * Parse command line arguments from /ios.baseline command text.
 *
 * @param commandText - Full command text including /ios.baseline
 * @returns Parsed arguments
 */
export function parseBaselineArgs(commandText: string): BaselineCommandArgs {
  const args: BaselineCommandArgs = {};

  // Remove the command prefix
  const argsText = commandText.replace(/^\/ios\.baseline\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  // Tokenize respecting quoted strings
  const tokens = tokenize(argsText);

  let i = 0;
  let positionalIndex = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Handle --project or -p
    if (token === '--project' || token === '-p') {
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
    // Handle --app or -a
    else if (token === '--app' || token === '-a') {
      if (i + 1 < tokens.length) {
        args.app = tokens[++i];
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
    // Handle --auto-device-family flag
    else if (token === '--auto-device-family') {
      args.useDeviceFamilyDir = true;
    }
    // Handle --description
    else if (token === '--description') {
      if (i + 1 < tokens.length) {
        args.description = tokens[++i];
      }
    }
    // Handle --tags
    else if (token === '--tags') {
      if (i + 1 < tokens.length) {
        args.tags = tokens[++i].split(',').map((t) => t.trim()).filter(Boolean);
      }
    }
    // Handle --region (for ignore subcommand)
    else if (token === '--region') {
      if (i + 1 < tokens.length) {
        const regionStr = tokens[++i];
        args.ignoreRegion = parseIgnoreRegion(regionStr);
      }
    }
    // Handle --reason (for ignore subcommand)
    else if (token === '--reason') {
      if (i + 1 < tokens.length && args.ignoreRegion) {
        const reason = tokens[++i];
        if (isValidIgnoreReason(reason)) {
          args.ignoreRegion.reason = reason as iosTools.IgnoreReason;
        }
      }
    }
    // Positional arguments
    else if (!token.startsWith('-')) {
      if (positionalIndex === 0) {
        // First positional: subcommand
        if (isValidSubcommand(token)) {
          args.subcommand = token as BaselineSubcommand;
        } else {
          args.raw = args.raw ? `${args.raw} ${token}` : token;
        }
      } else if (positionalIndex === 1) {
        // Second positional: baseline name
        args.name = token;
      } else if (positionalIndex === 2 && args.subcommand === 'ignore') {
        // Third positional for ignore: region name
        if (!args.ignoreRegion) {
          args.ignoreRegion = { name: token, x: 0, y: 0, width: 0, height: 0 };
        } else {
          args.ignoreRegion.name = token;
        }
      } else {
        args.raw = args.raw ? `${args.raw} ${token}` : token;
      }
      positionalIndex++;
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
 * Check if a string is a valid subcommand.
 */
function isValidSubcommand(value: string): boolean {
  const subcommands: BaselineSubcommand[] = ['save', 'update', 'list', 'show', 'delete', 'ignore'];
  return subcommands.includes(value as BaselineSubcommand);
}

/**
 * Check if a string is a valid device family.
 */
function isValidDeviceFamily(value: string): boolean {
  const families: iosTools.DeviceFamily[] = ['iPhone-SE', 'iPhone', 'iPhone-Plus', 'iPhone-Pro-Max', 'iPad', 'iPad-Pro'];
  return families.includes(value as iosTools.DeviceFamily);
}

/**
 * Check if a string is a valid ignore reason.
 */
function isValidIgnoreReason(value: string): boolean {
  const reasons: iosTools.IgnoreReason[] = [
    'status_bar', 'dynamic_content', 'timestamp', 'user_avatar',
    'random_content', 'animation', 'external_data', 'custom'
  ];
  return reasons.includes(value as iosTools.IgnoreReason);
}

/**
 * Parse an ignore region from string format: name:x,y,width,height
 */
function parseIgnoreRegion(regionStr: string): IgnoreRegionArg | undefined {
  // Format: x,y,width,height  or  name:x,y,width,height
  const colonIndex = regionStr.indexOf(':');
  let name = 'custom_region';
  let coordPart = regionStr;

  if (colonIndex > 0) {
    name = regionStr.slice(0, colonIndex);
    coordPart = regionStr.slice(colonIndex + 1);
  }

  const parts = coordPart.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length !== 4 || parts.some(isNaN)) {
    return undefined;
  }

  return {
    name,
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  };
}

// =============================================================================
// Command Execution
// =============================================================================

/**
 * Execute the /ios.baseline command.
 *
 * @param commandText - Full command text
 * @param sessionId - Session ID for artifact storage
 * @param projectPath - Current project path (used for default project name)
 * @returns Command result with formatted output
 */
export async function executeBaselineCommand(
  commandText: string,
  sessionId: string,
  projectPath?: string
): Promise<BaselineCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing baseline command: ${commandText}`);

  // Parse arguments
  const args = parseBaselineArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  // Determine project name
  const project = args.project || (projectPath ? path.basename(projectPath) : 'default');

  // Route to appropriate handler
  switch (args.subcommand) {
    case 'save':
      return executeSaveBaseline(args, project, sessionId);
    case 'update':
      return executeUpdateBaseline(args, project, sessionId);
    case 'list':
      return executeListBaselines(args, project);
    case 'show':
      return executeShowBaseline(args, project);
    case 'delete':
      return executeDeleteBaseline(args, project);
    case 'ignore':
      return executeAddIgnoreRegion(args, project);
    default:
      return {
        success: false,
        output: formatUsageHelp(),
        error: args.subcommand
          ? `Unknown subcommand: ${args.subcommand}`
          : 'No subcommand specified',
      };
  }
}

// =============================================================================
// Subcommand Handlers
// =============================================================================

/**
 * Save a new baseline from current simulator screen.
 */
async function executeSaveBaseline(
  args: BaselineCommandArgs,
  project: string,
  _sessionId: string
): Promise<BaselineCommandResult> {
  if (!args.name) {
    return {
      success: false,
      output: formatError('Baseline name is required', 'Usage: /ios.baseline save <name>'),
      error: 'Baseline name is required',
    };
  }

  try {
    // Get booted simulator
    const udid = await resolveSimulator(args.simulator);
    if (!udid) {
      return {
        success: false,
        output: formatError('No booted simulator found', 'Boot a simulator first with `xcrun simctl boot <device>`'),
        error: 'No booted simulator found',
      };
    }

    // Get simulator info for device metadata
    const simInfo = await iosTools.getSimulator(udid);
    if (!simInfo.success || !simInfo.data) {
      return {
        success: false,
        output: formatError('Failed to get simulator info', simInfo.error || 'Unknown error'),
        error: simInfo.error || 'Failed to get simulator info',
      };
    }

    // Capture screenshot - needs directory and optional prefix
    const tempDir = path.join(process.env.TMPDIR || '/tmp', 'maestro-baselines');
    const screenshotResult = await iosTools.captureScreenshot(udid, tempDir, 'baseline');
    if (!screenshotResult.success || !screenshotResult.data) {
      return {
        success: false,
        output: formatError('Failed to capture screenshot', screenshotResult.error || 'Unknown error'),
        error: screenshotResult.error || 'Failed to capture screenshot',
      };
    }

    // Get screen size
    const screenSizeResult = await iosTools.getScreenSize(udid);
    const screenSize = screenSizeResult.success && screenSizeResult.data
      ? screenSizeResult.data
      : { width: 0, height: 0 };

    // Prepare device info
    const deviceInfo: iosTools.BaselineDeviceInfo = {
      name: simInfo.data.name,
      osVersion: simInfo.data.iosVersion || '',
      screenSize,
      deviceType: simInfo.data.deviceType,
      udid: simInfo.data.udid,
    };

    // Create baseline using the screenshot path
    const screenshotPath = screenshotResult.data.path;
    const metadata = await iosTools.createBaseline(
      project,
      args.name,
      screenshotPath,
      deviceInfo,
      args.app || 'unknown',
      {
        description: args.description,
        tags: args.tags,
        deviceFamily: args.deviceFamily,
        useDeviceFamilyDir: args.useDeviceFamilyDir,
      }
    );

    const output = formatSaveSuccess(args.name, project, metadata, screenshotPath);

    return {
      success: true,
      output,
      data: { imagePath: screenshotPath, metadata },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Error saving baseline: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Failed to save baseline', errorMessage),
      error: errorMessage,
    };
  }
}

/**
 * Update an existing baseline with current simulator screen.
 */
async function executeUpdateBaseline(
  args: BaselineCommandArgs,
  project: string,
  _sessionId: string
): Promise<BaselineCommandResult> {
  if (!args.name) {
    return {
      success: false,
      output: formatError('Baseline name is required', 'Usage: /ios.baseline update <name>'),
      error: 'Baseline name is required',
    };
  }

  try {
    // Check if baseline exists
    const existing = await iosTools.getBaseline(project, args.name, args.deviceFamily);
    if (!existing) {
      return {
        success: false,
        output: formatError(
          `Baseline "${args.name}" not found`,
          `Use /ios.baseline save ${args.name} to create a new baseline`
        ),
        error: `Baseline "${args.name}" not found`,
      };
    }

    // Get booted simulator
    const udid = await resolveSimulator(args.simulator);
    if (!udid) {
      return {
        success: false,
        output: formatError('No booted simulator found', 'Boot a simulator first'),
        error: 'No booted simulator found',
      };
    }

    // Capture screenshot - needs directory and optional prefix
    const tempDir = path.join(process.env.TMPDIR || '/tmp', 'maestro-baselines');
    const screenshotResult = await iosTools.captureScreenshot(udid, tempDir, 'baseline-update');
    if (!screenshotResult.success || !screenshotResult.data) {
      return {
        success: false,
        output: formatError('Failed to capture screenshot', screenshotResult.error || 'Unknown error'),
        error: screenshotResult.error || 'Failed to capture screenshot',
      };
    }

    // Update baseline using the screenshot path
    const screenshotPath = screenshotResult.data.path;
    const metadata = await iosTools.updateBaseline(
      project,
      args.name,
      screenshotPath,
      args.deviceFamily
    );

    const output = formatUpdateSuccess(args.name, project, metadata);

    return {
      success: true,
      output,
      data: metadata,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Error updating baseline: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Failed to update baseline', errorMessage),
      error: errorMessage,
    };
  }
}

/**
 * List all baselines in a project.
 */
async function executeListBaselines(
  args: BaselineCommandArgs,
  project: string
): Promise<BaselineCommandResult> {
  try {
    // List screen baselines
    const screens = await iosTools.listBaselines(project, args.deviceFamily);

    // List flow baselines
    const flows = await iosTools.listFlows(project);

    const output = formatBaselineList(project, screens, flows, args.deviceFamily);

    return {
      success: true,
      output,
      data: [...screens, ...flows],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle case where project doesn't exist
    if (errorMessage.includes('ENOENT')) {
      return {
        success: true,
        output: formatEmptyBaselineList(project),
        data: [],
      };
    }

    logger.error(`${LOG_CONTEXT} Error listing baselines: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Failed to list baselines', errorMessage),
      error: errorMessage,
    };
  }
}

/**
 * Show details of a specific baseline.
 */
async function executeShowBaseline(
  args: BaselineCommandArgs,
  project: string
): Promise<BaselineCommandResult> {
  if (!args.name) {
    return {
      success: false,
      output: formatError('Baseline name is required', 'Usage: /ios.baseline show <name>'),
      error: 'Baseline name is required',
    };
  }

  try {
    // Try to get as screen baseline
    const baseline = await iosTools.getBaseline(project, args.name, args.deviceFamily);

    if (baseline) {
      const output = formatBaselineDetails(args.name, project, baseline.metadata, baseline.imagePath, baseline.maskPath);

      return {
        success: true,
        output,
        data: baseline.metadata,
      };
    }

    // Try to get as flow baseline
    const flow = await iosTools.getFlowBaselineStorage(project, args.name);
    if (flow) {
      const output = formatFlowBaselineDetails(args.name, project, flow);

      return {
        success: true,
        output,
        data: flow as unknown as iosTools.BaselineMetadata,
      };
    }

    return {
      success: false,
      output: formatError(`Baseline "${args.name}" not found`, `Check available baselines with /ios.baseline list`),
      error: `Baseline "${args.name}" not found`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Error showing baseline: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Failed to show baseline', errorMessage),
      error: errorMessage,
    };
  }
}

/**
 * Delete a baseline.
 */
async function executeDeleteBaseline(
  args: BaselineCommandArgs,
  project: string
): Promise<BaselineCommandResult> {
  if (!args.name) {
    return {
      success: false,
      output: formatError('Baseline name is required', 'Usage: /ios.baseline delete <name>'),
      error: 'Baseline name is required',
    };
  }

  try {
    // Try to delete as screen baseline first
    const baseline = await iosTools.getBaseline(project, args.name, args.deviceFamily);
    if (baseline) {
      await iosTools.deleteBaseline(project, args.name, args.deviceFamily);
      return {
        success: true,
        output: formatDeleteSuccess(args.name, project, 'screen'),
      };
    }

    // Try to delete as flow baseline
    const flow = await iosTools.getFlowBaselineStorage(project, args.name);
    if (flow) {
      await iosTools.deleteFlow(project, args.name);
      return {
        success: true,
        output: formatDeleteSuccess(args.name, project, 'flow'),
      };
    }

    return {
      success: false,
      output: formatError(`Baseline "${args.name}" not found`, `Check available baselines with /ios.baseline list`),
      error: `Baseline "${args.name}" not found`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Error deleting baseline: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Failed to delete baseline', errorMessage),
      error: errorMessage,
    };
  }
}

/**
 * Add an ignore region to a baseline.
 */
async function executeAddIgnoreRegion(
  args: BaselineCommandArgs,
  project: string
): Promise<BaselineCommandResult> {
  if (!args.name) {
    return {
      success: false,
      output: formatError('Baseline name is required', 'Usage: /ios.baseline ignore <name> --region <x,y,width,height>'),
      error: 'Baseline name is required',
    };
  }

  if (!args.ignoreRegion || args.ignoreRegion.width === 0 || args.ignoreRegion.height === 0) {
    return {
      success: false,
      output: formatError(
        'Region specification is required',
        'Usage: /ios.baseline ignore <name> --region <name:x,y,width,height>\n' +
        'Example: /ios.baseline ignore login_screen --region status_bar:0,0,390,54'
      ),
      error: 'Region specification is required',
    };
  }

  try {
    const baselinePath = iosTools.getBaselinePath(project, args.name, args.deviceFamily);

    const region: iosTools.IgnoreRegion = {
      name: args.ignoreRegion.name,
      rect: {
        x: args.ignoreRegion.x,
        y: args.ignoreRegion.y,
        width: args.ignoreRegion.width,
        height: args.ignoreRegion.height,
      },
      reason: args.ignoreRegion.reason || 'custom',
    };

    const metadata = await iosTools.addIgnoreRegion(baselinePath, region);

    const output = formatIgnoreRegionSuccess(args.name, project, region, metadata.ignoreRegions.length);

    return {
      success: true,
      output,
      data: metadata,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Error adding ignore region: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Failed to add ignore region', errorMessage),
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
  // Get booted simulators
  const bootedResult = await iosTools.getBootedSimulators();
  if (!bootedResult.success || !bootedResult.data || bootedResult.data.length === 0) {
    return undefined;
  }

  // If no simulator specified, return first booted
  if (!simulator) {
    return bootedResult.data[0].udid;
  }

  // Check if it's already a UDID
  if (isUdid(simulator)) {
    const found = bootedResult.data.find((s) => s.udid === simulator);
    return found?.udid;
  }

  // Search by name
  const byName = bootedResult.data.find(
    (s) => s.name.toLowerCase() === simulator.toLowerCase()
  );
  if (byName) {
    return byName.udid;
  }

  // Partial match
  const partial = bootedResult.data.find((s) =>
    s.name.toLowerCase().includes(simulator.toLowerCase())
  );
  return partial?.udid;
}

/**
 * Check if a string looks like a simulator UDID.
 */
function isUdid(value: string): boolean {
  return /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(value);
}

// =============================================================================
// Output Formatters
// =============================================================================

/**
 * Format success message for save operation.
 */
function formatSaveSuccess(
  name: string,
  project: string,
  metadata: iosTools.BaselineMetadata,
  imagePath: string
): string {
  return `## Baseline Saved

**Name**: ${name}
**Project**: ${project}
**Device**: ${metadata.device.name} (iOS ${metadata.device.osVersion})
**Screen Size**: ${metadata.device.screenSize.width}x${metadata.device.screenSize.height}
**Created**: ${metadata.createdAt.toISOString()}

### Screenshot
\`${imagePath}\`

### Next Steps
- Compare current screen to baseline: \`/ios.diff ${name}\`
- Add ignore regions: \`/ios.baseline ignore ${name} --region status_bar:0,0,390,54\`
- Update baseline: \`/ios.baseline update ${name}\`
`;
}

/**
 * Format success message for update operation.
 */
function formatUpdateSuccess(
  name: string,
  project: string,
  metadata: iosTools.BaselineMetadata
): string {
  return `## Baseline Updated

**Name**: ${name}
**Project**: ${project}
**Updated**: ${metadata.updatedAt.toISOString()}
**Device**: ${metadata.device.name}

The baseline has been updated with the current screen.

### Next Steps
- Compare current screen: \`/ios.diff ${name}\`
- View baseline details: \`/ios.baseline show ${name}\`
`;
}

/**
 * Format baseline list output.
 */
function formatBaselineList(
  project: string,
  screens: iosTools.BaselineEntry[],
  flows: iosTools.BaselineEntry[],
  deviceFamily?: iosTools.DeviceFamily
): string {
  const total = screens.length + flows.length;
  const familyFilter = deviceFamily ? ` (${deviceFamily})` : '';

  let output = `## Baselines for "${project}"${familyFilter}

**Total**: ${total} baselines (${screens.length} screens, ${flows.length} flows)

`;

  if (screens.length > 0) {
    output += `### Screen Baselines

| Name | Device Family | Updated | Tags |
|------|---------------|---------|------|
`;
    for (const screen of screens) {
      const family = screen.deviceFamily || '-';
      const updated = screen.updatedAt.toLocaleDateString();
      const tags = screen.tags?.join(', ') || '-';
      output += `| ${screen.name} | ${family} | ${updated} | ${tags} |\n`;
    }
    output += '\n';
  }

  if (flows.length > 0) {
    output += `### Flow Baselines

| Name | Updated |
|------|---------|
`;
    for (const flow of flows) {
      const updated = flow.updatedAt.toLocaleDateString();
      output += `| ${flow.name} | ${updated} |\n`;
    }
    output += '\n';
  }

  if (total === 0) {
    output += `*No baselines found.*

### Getting Started
1. Navigate to a screen you want to baseline
2. Run: \`/ios.baseline save <name>\`
`;
  }

  return output;
}

/**
 * Format empty baseline list.
 */
function formatEmptyBaselineList(project: string): string {
  return `## Baselines for "${project}"

**Total**: 0 baselines

*No baselines found. Project "${project}" will be created when you save your first baseline.*

### Getting Started
1. Navigate to a screen you want to baseline
2. Run: \`/ios.baseline save <name>\`
`;
}

/**
 * Format baseline details output.
 */
function formatBaselineDetails(
  name: string,
  project: string,
  metadata: iosTools.BaselineMetadata,
  imagePath: string,
  maskPath?: string
): string {
  let output = `## Baseline: ${name}

**Project**: ${project}
**Bundle ID**: ${metadata.bundleId}
${metadata.appVersion ? `**App Version**: ${metadata.appVersion}` : ''}
${metadata.description ? `**Description**: ${metadata.description}` : ''}

### Device
- **Name**: ${metadata.device.name}
- **iOS Version**: ${metadata.device.osVersion}
- **Screen Size**: ${metadata.device.screenSize.width}x${metadata.device.screenSize.height}

### Timestamps
- **Created**: ${metadata.createdAt.toISOString()}
- **Updated**: ${metadata.updatedAt.toISOString()}

### Files
- **Baseline**: \`${imagePath}\`
${maskPath ? `- **Mask**: \`${maskPath}\`` : ''}
`;

  if (metadata.tags && metadata.tags.length > 0) {
    output += `
### Tags
${metadata.tags.map((t) => `- ${t}`).join('\n')}
`;
  }

  if (metadata.ignoreRegions.length > 0) {
    output += `
### Ignore Regions

| Name | Bounds | Reason |
|------|--------|--------|
`;
    for (const region of metadata.ignoreRegions) {
      const bounds = `(${region.rect.x}, ${region.rect.y}) ${region.rect.width}x${region.rect.height}`;
      output += `| ${region.name} | ${bounds} | ${region.reason} |\n`;
    }
  }

  output += `
### Actions
- Compare to current: \`/ios.diff ${name}\`
- Update baseline: \`/ios.baseline update ${name}\`
- Delete baseline: \`/ios.baseline delete ${name}\`
`;

  return output;
}

/**
 * Format flow baseline details output.
 */
function formatFlowBaselineDetails(
  name: string,
  project: string,
  flow: iosTools.FlowBaseline
): string {
  let output = `## Flow Baseline: ${name}

**Project**: ${project}
**Bundle ID**: ${flow.bundleId}
${flow.description ? `**Description**: ${flow.description}` : ''}

### Device
- **Name**: ${flow.device.name}
- **iOS Version**: ${flow.device.osVersion}
- **Screen Size**: ${flow.device.screenSize.width}x${flow.device.screenSize.height}

### Timestamps
- **Created**: ${flow.createdAt.toISOString()}
- **Updated**: ${flow.updatedAt.toISOString()}

### Steps (${flow.steps.length} total)

| # | Name | Captured |
|---|------|----------|
`;

  for (const step of flow.steps) {
    const captured = step.capturedAt.toLocaleDateString();
    output += `| ${step.stepNumber} | ${step.name} | ${captured} |\n`;
  }

  output += `
### Actions
- Compare flow to current: \`/ios.diff --flow ${name}\`
- Delete flow: \`/ios.baseline delete ${name}\`
`;

  return output;
}

/**
 * Format success message for delete operation.
 */
function formatDeleteSuccess(
  name: string,
  project: string,
  type: 'screen' | 'flow'
): string {
  return `## Baseline Deleted

**Name**: ${name}
**Project**: ${project}
**Type**: ${type}

The baseline has been permanently deleted.
`;
}

/**
 * Format success message for ignore region addition.
 */
function formatIgnoreRegionSuccess(
  baselineName: string,
  project: string,
  region: iosTools.IgnoreRegion,
  totalRegions: number
): string {
  return `## Ignore Region Added

**Baseline**: ${baselineName}
**Project**: ${project}

### Added Region
- **Name**: ${region.name}
- **Bounds**: (${region.rect.x}, ${region.rect.y}) ${region.rect.width}x${region.rect.height}
- **Reason**: ${region.reason}

**Total ignore regions**: ${totalRegions}

This region will be excluded from visual comparisons.
`;
}

/**
 * Format error message for display.
 */
function formatError(title: string, detail: string): string {
  return `## iOS Baseline Failed

**Error**: ${title}

${detail}
`;
}

/**
 * Format usage help.
 */
function formatUsageHelp(): string {
  return `## iOS Baseline Command

Visual regression baseline management.

### Subcommands

| Command | Description |
|---------|-------------|
| \`save <name>\` | Capture current screen as baseline |
| \`update <name>\` | Update existing baseline |
| \`list\` | List all baselines |
| \`show <name>\` | Display baseline details |
| \`delete <name>\` | Remove baseline |
| \`ignore <name>\` | Add ignore region |

### Options

| Option | Description |
|--------|-------------|
| \`--project, -p\` | Project name |
| \`--simulator, -s\` | Target simulator |
| \`--app, -a\` | App bundle ID |
| \`--device-family\` | Device family (iPhone-SE, iPhone, etc.) |
| \`--auto-device-family\` | Auto-detect device family |
| \`--description\` | Baseline description |
| \`--tags\` | Comma-separated tags |

### Examples

\`\`\`
/ios.baseline save login_screen
/ios.baseline save home --tags critical,release
/ios.baseline update login_screen
/ios.baseline list
/ios.baseline show login_screen
/ios.baseline delete old_baseline
/ios.baseline ignore login_screen --region status_bar:0,0,390,54
\`\`\`
`;
}

// =============================================================================
// Command Metadata
// =============================================================================

/**
 * Metadata for the /ios.baseline command.
 */
export const baselineCommandMetadata = {
  command: '/ios.baseline',
  description: 'Manage visual regression baselines',
  usage: '/ios.baseline <save|update|list|show|delete|ignore> [name] [options]',
  options: [
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
      name: '--app, -a',
      description: 'App bundle ID',
      valueHint: '<bundleId>',
    },
    {
      name: '--device-family',
      description: 'Store baseline in device family directory',
      valueHint: '<family>',
    },
    {
      name: '--auto-device-family',
      description: 'Auto-detect device family from simulator',
      valueHint: null,
    },
    {
      name: '--description',
      description: 'Baseline description',
      valueHint: '<text>',
    },
    {
      name: '--tags',
      description: 'Comma-separated tags',
      valueHint: '<tag1,tag2>',
    },
    {
      name: '--region',
      description: 'Ignore region (for ignore subcommand)',
      valueHint: '<name:x,y,w,h>',
    },
    {
      name: '--reason',
      description: 'Ignore reason (status_bar, timestamp, dynamic_content, etc.)',
      valueHint: '<reason>',
    },
  ],
  examples: [
    '/ios.baseline save login_screen',
    '/ios.baseline save home -a com.example.app --tags release',
    '/ios.baseline update login_screen',
    '/ios.baseline list',
    '/ios.baseline list --device-family iPhone',
    '/ios.baseline show login_screen',
    '/ios.baseline delete old_baseline',
    '/ios.baseline ignore login_screen --region status_bar:0,0,390,54 --reason status_bar',
  ],
};
