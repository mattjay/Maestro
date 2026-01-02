/**
 * iOS Help Slash Command Handler
 *
 * Handles the /ios.help command which provides comprehensive help for all iOS commands.
 *
 * Usage:
 *   /ios.help                     - Show all iOS commands overview
 *   /ios.help <command>           - Detailed help for specific command
 *   /ios.help --troubleshoot      - Common troubleshooting guide
 *
 * Options:
 *   --troubleshoot, -t    Show troubleshooting guide
 *   --examples, -e        Show extended examples
 */

import { logger } from '../utils/logger';
import {
  snapshotCommandMetadata,
  inspectCommandMetadata,
  runFlowCommandMetadata,
  tapCommandMetadata,
  typeCommandMetadata,
  scrollCommandMetadata,
  swipeCommandMetadata,
  playbookCommandMetadata,
  bridgeStateCommandMetadata,
  bridgeRouteCommandMetadata,
  bridgeNetworkCommandMetadata,
  bridgeAnalyticsCommandMetadata,
  bridgeFlagsCommandMetadata,
  bridgeSetCommandMetadata,
  baselineCommandMetadata,
  diffCommandMetadata,
  regressionCommandMetadata,
  setupCommandMetadata,
  type SlashCommandMetadata,
} from './index';

const LOG_CONTEXT = '[SlashCmd-ios.help]';

// =============================================================================
// Types
// =============================================================================

/**
 * Help mode
 */
export type HelpMode = 'overview' | 'command' | 'troubleshoot';

/**
 * Parsed arguments from /ios.help command
 */
export interface HelpCommandArgs {
  /** Mode of operation */
  mode: HelpMode;
  /** Command name (for command mode) */
  commandName?: string;
  /** Show extended examples */
  showExamples?: boolean;
  /** Raw unparsed input */
  raw?: string;
}

/**
 * Result of executing the help command
 */
export interface HelpCommandResult {
  success: boolean;
  /** Formatted output for display in AI terminal */
  output: string;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Command Registry
// =============================================================================

/**
 * All iOS slash command metadata organized by category
 */
interface CommandCategory {
  name: string;
  description: string;
  commands: SlashCommandMetadata[];
}

/**
 * Extended command info with detailed help
 */
interface ExtendedCommandInfo {
  command: string;
  category: string;
  overview: string;
  detailedDescription: string;
  commonPatterns: string[];
  relatedCommands: string[];
  troubleshooting: string[];
}

/**
 * Get all command categories with their commands
 */
function getCommandCategories(): CommandCategory[] {
  return [
    {
      name: 'Setup & Configuration',
      description: 'Set up and configure your iOS development environment',
      commands: [setupCommandMetadata],
    },
    {
      name: 'Screen Capture & Inspection',
      description: 'Capture and analyze simulator screens',
      commands: [snapshotCommandMetadata, inspectCommandMetadata],
    },
    {
      name: 'UI Interactions',
      description: 'Interact with UI elements on the simulator',
      commands: [
        tapCommandMetadata,
        typeCommandMetadata,
        scrollCommandMetadata,
        swipeCommandMetadata,
      ],
    },
    {
      name: 'Flow Automation',
      description: 'Run and manage Maestro automation flows',
      commands: [runFlowCommandMetadata, playbookCommandMetadata],
    },
    {
      name: 'Visual Regression',
      description: 'Visual testing and baseline management',
      commands: [
        baselineCommandMetadata,
        diffCommandMetadata,
        regressionCommandMetadata,
      ],
    },
    {
      name: 'Debug Introspection (MaestroBridge)',
      description: 'Deep app debugging via MaestroBridge integration',
      commands: [
        bridgeStateCommandMetadata,
        bridgeRouteCommandMetadata,
        bridgeNetworkCommandMetadata,
        bridgeAnalyticsCommandMetadata,
        bridgeFlagsCommandMetadata,
        bridgeSetCommandMetadata,
      ],
    },
  ];
}

/**
 * Get all commands as a flat list
 */
function getAllCommands(): SlashCommandMetadata[] {
  return getCommandCategories().flatMap((cat) => cat.commands);
}

/**
 * Find a command by name (supports partial matching)
 */
function findCommand(name: string): SlashCommandMetadata | undefined {
  const normalizedName = name.toLowerCase().replace(/^\//, '');
  const allCommands = getAllCommands();

  // Exact match first
  const exact = allCommands.find(
    (cmd) =>
      cmd.command.toLowerCase() === `/${normalizedName}` ||
      cmd.command.toLowerCase() === normalizedName
  );
  if (exact) return exact;

  // Partial match (e.g., "snapshot" matches "/ios.snapshot")
  return allCommands.find(
    (cmd) =>
      cmd.command.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(cmd.command.toLowerCase().replace('/ios.', ''))
  );
}

/**
 * Get extended info for a command
 */
function getExtendedInfo(command: SlashCommandMetadata): ExtendedCommandInfo {
  const commandName = command.command.replace('/ios.', '');

  // Extended descriptions and patterns for each command
  const extendedInfoMap: Record<string, Partial<ExtendedCommandInfo>> = {
    'snapshot': {
      overview: 'Capture the current simulator screen and optionally analyze logs',
      detailedDescription: `The snapshot command captures a screenshot of the simulator's current screen
and can optionally include recent system logs. This is useful for debugging UI issues,
documenting app state, and creating visual records of test runs.

The screenshot is saved to the session's artifact directory and a unique snapshot ID is returned.
Use this ID to reference the snapshot in subsequent commands like /ios.diff.`,
      commonPatterns: [
        'Capture screen after each test step for debugging',
        'Save snapshots before and after actions to verify changes',
        'Include logs when investigating crashes or errors',
        'Use --simulator to target a specific device',
      ],
      relatedCommands: ['/ios.inspect', '/ios.baseline', '/ios.diff'],
      troubleshooting: [
        'No simulator booted: Boot a simulator first with `xcrun simctl boot <device>`',
        'Screenshot timeout: Increase timeout with --timeout or check simulator responsiveness',
        'Empty screenshot: Ensure the app is visible and not in background',
      ],
    },
    'inspect': {
      overview: 'Analyze the UI element tree of the current screen',
      detailedDescription: `The inspect command captures the accessibility tree of the current screen,
providing detailed information about all visible UI elements. This includes:

- Element types (buttons, text fields, labels, etc.)
- Accessibility identifiers and labels
- Element frames and positions
- Interactable element suggestions
- Accessibility warnings

This is essential for writing reliable UI automation as it shows what identifiers
and labels are available for targeting elements.`,
      commonPatterns: [
        'Find element identifiers before writing tap commands',
        'Verify accessibility setup for UI elements',
        'Debug why an element cannot be found',
        'Get element hierarchy for complex UIs',
      ],
      relatedCommands: ['/ios.tap', '/ios.type', '/ios.snapshot'],
      troubleshooting: [
        'Empty element tree: App may not be running or screen is loading',
        'Missing elements: Check accessibility settings in Xcode',
        'Timeout: UI may be blocked by animation or alert',
      ],
    },
    'tap': {
      overview: 'Tap on a UI element by identifier, label, text, or coordinates',
      detailedDescription: `The tap command simulates a user tap on a UI element. Elements can be
targeted in several ways:

- By accessibility identifier: #login-button
- By label: @"Sign In"
- By text content: "Welcome"
- By coordinates: 100,200

The command validates that the element exists and is hittable before tapping.
If the element cannot be found, suggestions for similar elements are provided.`,
      commonPatterns: [
        'Use accessibility identifiers (#id) for reliable automation',
        'Combine with /ios.inspect to find the right identifier',
        'Use --wait to wait for element before tapping',
        'Chain taps for multi-step interactions',
      ],
      relatedCommands: ['/ios.inspect', '/ios.type', '/ios.swipe'],
      troubleshooting: [
        'Element not found: Use /ios.inspect to verify identifier',
        'Element not hittable: Check if element is covered or disabled',
        'Wrong element tapped: Use more specific identifier',
      ],
    },
    'type': {
      overview: 'Type text into a text field or input element',
      detailedDescription: `The type command simulates keyboard input into a focused text field
or targets a specific element to type into.

The command can:
- Type into the currently focused field
- Target a specific element by identifier
- Clear existing text before typing (--clear)
- Submit/enter after typing (--enter)`,
      commonPatterns: [
        'Use with /ios.tap to focus an element first',
        'Use --clear to replace existing text',
        'Use --enter to submit forms',
        'Target element directly with #identifier',
      ],
      relatedCommands: ['/ios.tap', '/ios.inspect', '/ios.swipe'],
      troubleshooting: [
        'No text appears: Ensure a text field is focused',
        'Wrong field receives input: Target field explicitly with #id',
        'Keyboard not shown: Tap the field first to bring up keyboard',
      ],
    },
    'scroll': {
      overview: 'Scroll within a scrollable view',
      detailedDescription: `The scroll command scrolls a scrollable view in a specified direction.
This is useful for navigating long lists, reaching off-screen elements, or
testing scroll behavior.

Supports:
- Direction: up, down, left, right
- Target: scroll within a specific element
- Amount: control scroll distance`,
      commonPatterns: [
        'Scroll until element becomes visible',
        'Scroll through lists to load more items',
        'Combine with assertions to verify scroll content',
      ],
      relatedCommands: ['/ios.swipe', '/ios.tap', '/ios.inspect'],
      troubleshooting: [
        'Scroll not working: Verify the view is scrollable',
        'Wrong direction: iOS scroll semantics - "down" scrolls content up',
        'Element still not visible: Increase scroll amount or repeat',
      ],
    },
    'swipe': {
      overview: 'Swipe gesture in any direction',
      detailedDescription: `The swipe command performs a swipe gesture from one point to another.
More precise than scroll, swipe is useful for:

- Dismissing modals or bottom sheets
- Navigating carousels
- Triggering swipe-to-delete actions
- Custom gesture-based interactions`,
      commonPatterns: [
        'Swipe left on list item for delete action',
        'Swipe down to dismiss modal',
        'Swipe through carousel/onboarding screens',
      ],
      relatedCommands: ['/ios.scroll', '/ios.tap'],
      troubleshooting: [
        'Swipe not recognized: Adjust velocity or distance',
        'Wrong gesture detected: Be more precise with start/end points',
      ],
    },
    'run_flow': {
      overview: 'Execute a Maestro automation flow file',
      detailedDescription: `The run_flow command executes a Maestro YAML flow file, running
a sequence of automated UI actions. Flows can:

- Navigate through app screens
- Perform data entry
- Validate screen states
- Capture screenshots at key points

Maestro flows are portable, reusable, and can be version controlled.`,
      commonPatterns: [
        'Run smoke tests on new builds',
        'Automate repetitive testing tasks',
        'Record user journeys for regression testing',
        'Validate critical paths (login, checkout, etc.)',
      ],
      relatedCommands: ['/ios.playbook', '/ios.baseline', '/ios.regression'],
      troubleshooting: [
        'Flow not found: Check file path and extension (.yaml)',
        'Step failed: Add --continue to see all failures',
        'Maestro not installed: Run /ios.setup --fix',
      ],
    },
    'playbook': {
      overview: 'Run multi-step iOS testing playbooks',
      detailedDescription: `Playbooks are comprehensive testing workflows that orchestrate
multiple commands and flows. Built-in playbooks include:

- **Feature-Ship-Loop**: Build → Test → Screenshot → Iterate
- **Crash-Hunt**: Automated crash detection and reproduction
- **Design-Review**: Visual consistency checking
- **Regression-Check**: Full regression test suite
- **Performance-Check**: Performance metrics collection`,
      commonPatterns: [
        'Run Feature-Ship-Loop during development',
        'Use Crash-Hunt after user reports',
        'Run Design-Review before releases',
        'Automate Regression-Check in CI',
      ],
      relatedCommands: ['/ios.run_flow', '/ios.baseline', '/ios.regression'],
      troubleshooting: [
        'Missing inputs: Check required inputs with /ios.playbook info <name>',
        'Playbook not found: Verify playbook name with /ios.playbook list',
      ],
    },
    'baseline': {
      overview: 'Manage visual regression baselines',
      detailedDescription: `Baselines are reference screenshots used for visual regression testing.
The baseline command helps you:

- Save new baselines from current screen state
- Update existing baselines after intentional changes
- List all baselines in the project
- Delete obsolete baselines

Baselines support ignore regions for dynamic content (timestamps, etc.).`,
      commonPatterns: [
        'Save baselines for each screen after design approval',
        'Update baselines after intentional UI changes',
        'Use ignore regions for dynamic content',
        'Organize baselines by device family',
      ],
      relatedCommands: ['/ios.diff', '/ios.regression', '/ios.snapshot'],
      troubleshooting: [
        'Baseline already exists: Use update subcommand',
        'Different device sizes: Baselines are device-specific',
      ],
    },
    'diff': {
      overview: 'Compare current screen to a baseline',
      detailedDescription: `The diff command compares the current simulator screen against
a saved baseline, highlighting visual differences. Features:

- Pixel-level comparison with configurable threshold
- Side-by-side and overlay diff visualization
- Change region detection and classification
- Severity scoring for detected changes`,
      commonPatterns: [
        'Compare after UI changes to verify impact',
        'Quick visual regression check during development',
        'Generate diff reports for design review',
      ],
      relatedCommands: ['/ios.baseline', '/ios.regression', '/ios.snapshot'],
      troubleshooting: [
        'Baseline not found: Save baseline first with /ios.baseline save',
        'False positives: Add ignore regions for dynamic content',
        'Threshold too sensitive: Increase diff threshold',
      ],
    },
    'regression': {
      overview: 'Run visual regression tests across baselines',
      detailedDescription: `The regression command runs comprehensive visual regression testing,
comparing current app state against all saved baselines. It can:

- Run a full suite of baseline comparisons
- Generate HTML reports with visual diffs
- Export results for CI integration (JUnit XML)
- Track regression trends over time`,
      commonPatterns: [
        'Run before releases to catch visual regressions',
        'Integrate into CI/CD pipelines',
        'Generate reports for stakeholder review',
        'Compare across device families',
      ],
      relatedCommands: ['/ios.baseline', '/ios.diff', '/ios.playbook'],
      troubleshooting: [
        'No baselines found: Create baselines first',
        'Many false positives: Review and update ignore regions',
      ],
    },
    'setup': {
      overview: 'Set up iOS development environment',
      detailedDescription: `The setup wizard guides you through configuring your iOS development
environment for Maestro integration. It detects and configures:

- Xcode installation and command line tools
- Available simulators
- Project structure and schemes
- XCUITest targets
- MaestroBridge integration

Use --check to diagnose issues, --fix to auto-repair common problems.`,
      commonPatterns: [
        'Run on fresh project to set up automation',
        'Use --check to diagnose CI environment',
        'Use --fix to repair broken configuration',
      ],
      relatedCommands: ['/ios.help', '/ios.playbook'],
      troubleshooting: [
        'Xcode not found: Install from App Store',
        'No simulators: Install iOS runtime in Xcode preferences',
        'Command line tools: Run xcode-select --install',
      ],
    },
    'bridge.state': {
      overview: 'Get current app state via MaestroBridge',
      detailedDescription: `Query the app\'s internal state including view controller hierarchy,
user session data, and custom app state exposed via MaestroBridge.

Requires MaestroBridge SDK integration in your app.`,
      commonPatterns: [
        'Debug authentication state',
        'Verify data loaded correctly',
        'Inspect view controller stack',
      ],
      relatedCommands: ['/ios.bridge.route', '/ios.bridge.flags', '/ios.setup'],
      troubleshooting: [
        'Bridge not connected: Verify MaestroBridge is integrated',
        'No state data: Implement MaestroBridge delegates',
      ],
    },
    'bridge.route': {
      overview: 'Get navigation route stack via MaestroBridge',
      detailedDescription: `View the current navigation stack and route history.
Useful for debugging deep linking and navigation issues.`,
      commonPatterns: [
        'Debug deep link handling',
        'Verify navigation flow',
        'Check route parameters',
      ],
      relatedCommands: ['/ios.bridge.state', '/ios.inspect'],
      troubleshooting: [
        'Empty route stack: Navigation may not use tracked routing',
      ],
    },
    'bridge.network': {
      overview: 'View network request logs via MaestroBridge',
      detailedDescription: `Monitor network requests made by the app, including:
- Request URLs and methods
- Response status codes
- Timing information
- Request/response bodies (if configured)`,
      commonPatterns: [
        'Debug API integration issues',
        'Verify correct endpoints called',
        'Inspect request payloads',
      ],
      relatedCommands: ['/ios.bridge.state', '/ios.bridge.analytics'],
      troubleshooting: [
        'No requests logged: Verify network monitoring is enabled',
      ],
    },
    'bridge.analytics': {
      overview: 'View analytics events via MaestroBridge',
      detailedDescription: `Monitor analytics events fired by the app, including:
- Event names and parameters
- Timestamp information
- User properties

Useful for verifying analytics implementation.`,
      commonPatterns: [
        'Verify analytics events fire correctly',
        'Debug event parameters',
        'Audit analytics coverage',
      ],
      relatedCommands: ['/ios.bridge.state', '/ios.bridge.network'],
      troubleshooting: [
        'No events shown: Verify analytics logging is implemented',
      ],
    },
    'bridge.flags': {
      overview: 'View feature flags via MaestroBridge',
      detailedDescription: `Query feature flags and their current values.
Useful for testing feature flag-dependent behavior.`,
      commonPatterns: [
        'Debug feature flag state',
        'Verify flag values in different environments',
      ],
      relatedCommands: ['/ios.bridge.state', '/ios.bridge.set'],
      troubleshooting: [
        'Empty flags: Feature flag provider may not be integrated',
      ],
    },
    'bridge.set': {
      overview: 'Modify feature flags or state via MaestroBridge',
      detailedDescription: `Override feature flags or inject state for testing purposes.
Allows testing different configurations without changing server data.`,
      commonPatterns: [
        'Test feature flag variations',
        'Simulate edge case states',
        'Override configuration for testing',
      ],
      relatedCommands: ['/ios.bridge.flags', '/ios.bridge.state'],
      troubleshooting: [
        'Override not working: Verify state injection is implemented',
      ],
    },
  };

  const info = extendedInfoMap[commandName] || {};

  return {
    command: command.command,
    category: getCommandCategory(command),
    overview: info.overview || command.description,
    detailedDescription: info.detailedDescription || command.description,
    commonPatterns: info.commonPatterns || [],
    relatedCommands: info.relatedCommands || [],
    troubleshooting: info.troubleshooting || [],
  };
}

/**
 * Get the category name for a command
 */
function getCommandCategory(command: SlashCommandMetadata): string {
  const categories = getCommandCategories();
  for (const cat of categories) {
    if (cat.commands.some((c) => c.command === command.command)) {
      return cat.name;
    }
  }
  return 'Other';
}

// =============================================================================
// Argument Parsing
// =============================================================================

/**
 * Parse command line arguments from /ios.help command text.
 *
 * @param commandText - Full command text including /ios.help
 * @returns Parsed arguments
 */
export function parseHelpArgs(commandText: string): HelpCommandArgs {
  const args: HelpCommandArgs = {
    mode: 'overview',
  };

  // Remove the command prefix
  const argsText = commandText.replace(/^\/ios\.help\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  // Tokenize
  const tokens = tokenize(argsText);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '--troubleshoot' || token === '-t') {
      args.mode = 'troubleshoot';
    } else if (token === '--examples' || token === '-e') {
      args.showExamples = true;
    } else if (!token.startsWith('-')) {
      // Non-flag argument is the command name
      if (!args.commandName) {
        args.commandName = token;
        args.mode = 'command';
      } else {
        args.raw = args.raw ? `${args.raw} ${token}` : token;
      }
    }
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

// =============================================================================
// Command Execution
// =============================================================================

/**
 * Execute the /ios.help command.
 *
 * @param commandText - Full command text
 * @returns Command result with formatted output
 */
export async function executeHelpCommand(
  commandText: string
): Promise<HelpCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing help command: ${commandText}`);

  // Parse arguments
  const args = parseHelpArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  switch (args.mode) {
    case 'troubleshoot':
      return {
        success: true,
        output: formatTroubleshootingGuide(),
      };

    case 'command':
      if (!args.commandName) {
        return {
          success: false,
          output: formatError('Command name required. Usage: /ios.help <command>'),
          error: 'Missing command name',
        };
      }
      return executeCommandHelp(args.commandName, args.showExamples);

    case 'overview':
    default:
      return {
        success: true,
        output: formatOverview(args.showExamples),
      };
  }
}

/**
 * Execute help for a specific command
 */
function executeCommandHelp(
  commandName: string,
  showExamples?: boolean
): HelpCommandResult {
  const command = findCommand(commandName);

  if (!command) {
    // Try to suggest similar commands
    const allCommands = getAllCommands();
    const suggestions = allCommands.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(commandName.toLowerCase()) ||
        cmd.description.toLowerCase().includes(commandName.toLowerCase())
    );

    return {
      success: false,
      output: formatCommandNotFound(commandName, suggestions),
      error: `Command not found: ${commandName}`,
    };
  }

  const extendedInfo = getExtendedInfo(command);
  return {
    success: true,
    output: formatCommandHelp(command, extendedInfo, showExamples),
  };
}

// =============================================================================
// Formatters
// =============================================================================

/**
 * Format the main help overview
 */
function formatOverview(showExamples?: boolean): string {
  const categories = getCommandCategories();
  const lines: string[] = [];

  lines.push('# iOS Development Commands');
  lines.push('');
  lines.push('Comprehensive tools for iOS app development, testing, and automation.');
  lines.push('');

  for (const category of categories) {
    lines.push(`## ${category.name}`);
    lines.push('');
    lines.push(`*${category.description}*`);
    lines.push('');
    lines.push('| Command | Description |');
    lines.push('|---------|-------------|');

    for (const cmd of category.commands) {
      const shortDesc =
        cmd.description.length > 60
          ? cmd.description.substring(0, 57) + '...'
          : cmd.description;
      lines.push(`| \`${cmd.command}\` | ${shortDesc} |`);
    }

    lines.push('');
  }

  // Quick start section
  lines.push('## Quick Start');
  lines.push('');
  lines.push('```');
  lines.push('/ios.setup                    # Set up your environment');
  lines.push('/ios.snapshot                 # Capture current screen');
  lines.push('/ios.inspect                  # View UI element tree');
  lines.push('/ios.tap #login-button        # Tap an element');
  lines.push('/ios.type "hello" #textfield  # Type into a field');
  lines.push('/ios.run_flow login.yaml      # Run automation flow');
  lines.push('```');
  lines.push('');

  if (showExamples) {
    lines.push('## Common Workflows');
    lines.push('');
    lines.push('### Feature Development');
    lines.push('```');
    lines.push('/ios.snapshot                 # Capture initial state');
    lines.push('/ios.inspect                  # Find element identifiers');
    lines.push('/ios.tap #button             # Interact with UI');
    lines.push('/ios.snapshot                 # Capture result');
    lines.push('/ios.diff login              # Compare to baseline');
    lines.push('```');
    lines.push('');
    lines.push('### Visual Regression Testing');
    lines.push('```');
    lines.push('/ios.baseline save home      # Save baseline');
    lines.push('/ios.baseline list           # View all baselines');
    lines.push('/ios.regression              # Run all comparisons');
    lines.push('```');
    lines.push('');
  }

  // Help for help
  lines.push('## Getting More Help');
  lines.push('');
  lines.push('| Command | Description |');
  lines.push('|---------|-------------|');
  lines.push('| `/ios.help <command>` | Detailed help for specific command |');
  lines.push('| `/ios.help --troubleshoot` | Common troubleshooting guide |');
  lines.push('| `/ios.help --examples` | Extended examples |');
  lines.push('');
  lines.push('**Documentation**: https://docs.runmaestro.ai/ios-development');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format detailed help for a specific command
 */
function formatCommandHelp(
  command: SlashCommandMetadata,
  info: ExtendedCommandInfo,
  showExamples?: boolean
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${command.command}`);
  lines.push('');
  lines.push(`*${info.category}*`);
  lines.push('');

  // Overview
  lines.push('## Overview');
  lines.push('');
  lines.push(info.overview);
  lines.push('');

  // Detailed description
  if (info.detailedDescription && info.detailedDescription !== info.overview) {
    lines.push('## Description');
    lines.push('');
    lines.push(info.detailedDescription);
    lines.push('');
  }

  // Usage
  lines.push('## Usage');
  lines.push('');
  lines.push('```');
  lines.push(command.usage);
  lines.push('```');
  lines.push('');

  // Options
  if (command.options.length > 0) {
    lines.push('## Options');
    lines.push('');
    lines.push('| Option | Description | Value |');
    lines.push('|--------|-------------|-------|');

    for (const opt of command.options) {
      const value = opt.valueHint || '-';
      lines.push(`| \`${opt.name}\` | ${opt.description} | ${value} |`);
    }
    lines.push('');
  }

  // Examples
  if (command.examples.length > 0) {
    lines.push('## Examples');
    lines.push('');
    lines.push('```');
    for (const example of command.examples) {
      lines.push(example);
    }
    lines.push('```');
    lines.push('');
  }

  // Common patterns
  if (info.commonPatterns.length > 0 && showExamples) {
    lines.push('## Common Patterns');
    lines.push('');
    for (const pattern of info.commonPatterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push('');
  }

  // Troubleshooting
  if (info.troubleshooting.length > 0) {
    lines.push('## Troubleshooting');
    lines.push('');
    for (const tip of info.troubleshooting) {
      lines.push(`- ${tip}`);
    }
    lines.push('');
  }

  // Related commands
  if (info.relatedCommands.length > 0) {
    lines.push('## Related Commands');
    lines.push('');
    lines.push(info.relatedCommands.map((c) => `\`${c}\``).join(' | '));
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('**More help**: `/ios.help` | **Troubleshooting**: `/ios.help --troubleshoot`');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format command not found message
 */
function formatCommandNotFound(
  name: string,
  suggestions: SlashCommandMetadata[]
): string {
  const lines: string[] = [];

  lines.push('# Command Not Found');
  lines.push('');
  lines.push(`No iOS command matching "${name}" was found.`);
  lines.push('');

  if (suggestions.length > 0) {
    lines.push('## Did you mean?');
    lines.push('');
    for (const cmd of suggestions.slice(0, 5)) {
      lines.push(`- \`${cmd.command}\` - ${cmd.description}`);
    }
    lines.push('');
  }

  lines.push('## All Commands');
  lines.push('');
  const allCommands = getAllCommands();
  lines.push(allCommands.map((c) => `\`${c.command}\``).join(' | '));
  lines.push('');
  lines.push('Use `/ios.help` to see all commands organized by category.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format troubleshooting guide
 */
function formatTroubleshootingGuide(): string {
  const lines: string[] = [];

  lines.push('# iOS Commands Troubleshooting Guide');
  lines.push('');

  // Environment issues
  lines.push('## Environment Issues');
  lines.push('');

  lines.push('### Xcode Not Found');
  lines.push('```');
  lines.push('Error: Xcode is not installed or not configured');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('1. Install Xcode from the App Store');
  lines.push('2. Open Xcode once to accept the license agreement');
  lines.push('3. Run: `xcode-select --install` to install command line tools');
  lines.push('4. Run: `/ios.setup --check` to verify');
  lines.push('');

  lines.push('### No Simulators Available');
  lines.push('```');
  lines.push('Error: No booted simulator found');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('1. Open Xcode → Window → Devices and Simulators');
  lines.push('2. Click + to add simulators if none exist');
  lines.push('3. Boot a simulator: `xcrun simctl boot "iPhone 15 Pro"`');
  lines.push('4. Or use: `/ios.setup --fix` to auto-boot');
  lines.push('');

  lines.push('### Maestro CLI Not Installed');
  lines.push('```');
  lines.push('Error: Maestro CLI not found');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('```bash');
  lines.push('curl -Ls "https://get.maestro.mobile.dev" | bash');
  lines.push('```');
  lines.push('Then restart your terminal and verify with `maestro --version`.');
  lines.push('');

  // UI Interaction issues
  lines.push('## UI Interaction Issues');
  lines.push('');

  lines.push('### Element Not Found');
  lines.push('```');
  lines.push('Error: Element with identifier "loginButton" not found');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('1. Run `/ios.inspect` to see available elements');
  lines.push('2. Check if the element has an accessibility identifier set in Xcode');
  lines.push('3. Try alternative selectors:');
  lines.push('   - By label: `@"Sign In"`');
  lines.push('   - By text: `"Sign In"`');
  lines.push('   - By coordinates: `100,200`');
  lines.push('');

  lines.push('### Element Not Hittable');
  lines.push('```');
  lines.push('Error: Element exists but is not hittable');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('- Element may be covered by another view');
  lines.push('- Element may be off-screen - try scrolling first');
  lines.push('- Element may be disabled - check `enabled` property');
  lines.push('- Use `/ios.inspect #element` to see element state');
  lines.push('');

  lines.push('### Timeout Waiting for Element');
  lines.push('```');
  lines.push('Error: Timeout waiting for element to appear');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('- Increase timeout: `--timeout 30`');
  lines.push('- Check if the app is still loading');
  lines.push('- Verify you\'re on the correct screen');
  lines.push('- Check for blocking modals or alerts');
  lines.push('');

  // Flow issues
  lines.push('## Flow & Automation Issues');
  lines.push('');

  lines.push('### Flow File Not Found');
  lines.push('```');
  lines.push('Error: Flow file "login.yaml" not found');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('1. Check the file path is correct');
  lines.push('2. Ensure file has `.yaml` extension');
  lines.push('3. Create flows in the `maestro/` directory');
  lines.push('4. Use `/ios.setup` to configure flows directory');
  lines.push('');

  lines.push('### Flow Validation Failed');
  lines.push('```');
  lines.push('Error: Invalid flow configuration');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('1. Check YAML syntax with a YAML validator');
  lines.push('2. Verify all required fields are present');
  lines.push('3. Check indentation (use spaces, not tabs)');
  lines.push('4. Use `maestro test <flow.yaml> --dry-run` to validate');
  lines.push('');

  // Visual regression issues
  lines.push('## Visual Regression Issues');
  lines.push('');

  lines.push('### Baseline Not Found');
  lines.push('```');
  lines.push('Error: No baseline found for "home"');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('1. Save a baseline first: `/ios.baseline save home`');
  lines.push('2. Check baseline name matches exactly');
  lines.push('3. Verify baselines directory exists');
  lines.push('');

  lines.push('### Too Many Differences Detected');
  lines.push('```');
  lines.push('Multiple visual differences detected');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('1. Add ignore regions for dynamic content:');
  lines.push('   - Status bar (time, battery)');
  lines.push('   - Timestamps');
  lines.push('   - User-specific data');
  lines.push('2. Increase threshold if small differences are acceptable');
  lines.push('3. Update baseline if changes are intentional');
  lines.push('');

  // MaestroBridge issues
  lines.push('## MaestroBridge Issues');
  lines.push('');

  lines.push('### Bridge Not Connected');
  lines.push('```');
  lines.push('Error: Cannot connect to MaestroBridge');
  lines.push('```');
  lines.push('**Solution:**');
  lines.push('1. Verify MaestroBridge SDK is integrated in your app');
  lines.push('2. Check the app is running and bridge is initialized');
  lines.push('3. Verify port configuration matches (default: 9876)');
  lines.push('4. Check for firewall blocking the connection');
  lines.push('');

  // Quick reference
  lines.push('## Quick Diagnostic Commands');
  lines.push('');
  lines.push('```');
  lines.push('/ios.setup --check    # Check environment status');
  lines.push('/ios.setup --fix      # Auto-fix common issues');
  lines.push('/ios.inspect          # View current UI tree');
  lines.push('/ios.snapshot         # Capture screen with logs');
  lines.push('```');
  lines.push('');

  // Links
  lines.push('## More Resources');
  lines.push('');
  lines.push('- **Documentation**: https://docs.runmaestro.ai/ios-development');
  lines.push('- **Maestro Docs**: https://maestro.mobile.dev');
  lines.push('- **Xcode Simulators**: https://developer.apple.com/documentation/xcode/simulator');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format error message
 */
function formatError(error: string): string {
  return `# iOS Help Error

**Error**: ${error}

## Usage

\`\`\`
/ios.help                     # Show all iOS commands
/ios.help <command>           # Detailed help for specific command
/ios.help --troubleshoot      # Common troubleshooting guide
/ios.help --examples          # Extended examples
\`\`\`

## Examples

\`\`\`
/ios.help
/ios.help snapshot
/ios.help tap
/ios.help --troubleshoot
\`\`\`
`;
}

// =============================================================================
// Command Metadata
// =============================================================================

/**
 * Metadata for the /ios.help command.
 * Used for autocomplete and self-documentation.
 */
export const helpCommandMetadata: SlashCommandMetadata = {
  command: '/ios.help',
  description: 'Get help for iOS development commands',
  usage: '/ios.help [<command>] [--troubleshoot] [--examples]',
  options: [
    {
      name: '<command>',
      description: 'Get detailed help for a specific command',
      valueHint: '<command-name>',
    },
    {
      name: '--troubleshoot, -t',
      description: 'Show common troubleshooting guide',
      valueHint: null,
    },
    {
      name: '--examples, -e',
      description: 'Show extended examples',
      valueHint: null,
    },
  ],
  examples: [
    '/ios.help',
    '/ios.help snapshot',
    '/ios.help tap',
    '/ios.help baseline',
    '/ios.help --troubleshoot',
    '/ios.help --examples',
    '/ios.help inspect --examples',
  ],
};
