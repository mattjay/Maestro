/**
 * iOS Tools - Contextual Tips System
 *
 * Provides contextual tips for iOS commands that:
 * - Show tips when errors occur
 * - Suggest next steps after actions
 * - Link to relevant documentation
 *
 * Tips are context-aware and adapt based on:
 * - The command being executed
 * - The success/failure state
 * - The current action context
 * - Previously executed commands in the session
 */

import { IOSErrorCode } from './types';
import { InteractionErrorCode } from './interaction-errors';
import { logger } from '../utils/logger';

const LOG_CONTEXT = '[iOS-ContextualTips]';

// =============================================================================
// Constants
// =============================================================================

/**
 * Base URL for iOS development documentation
 */
export const DOCS_BASE_URL = 'https://docs.runmaestro.ai/ios-development';

/**
 * Documentation page paths
 */
export const DOCS_PAGES = {
  overview: '',
  setup: '/setup',
  commands: '/commands',
  playbooks: '/playbooks',
  bridge: '/bridge',
  visualRegression: '/visual-regression',
  ciIntegration: '/ci-integration',
  troubleshooting: '/troubleshooting',
} as const;

// =============================================================================
// Types
// =============================================================================

/**
 * iOS command identifier
 */
export type IOSCommand =
  | 'snapshot'
  | 'inspect'
  | 'tap'
  | 'type'
  | 'scroll'
  | 'swipe'
  | 'run_flow'
  | 'playbook'
  | 'baseline'
  | 'diff'
  | 'regression'
  | 'setup'
  | 'bridge.state'
  | 'bridge.route'
  | 'bridge.network'
  | 'bridge.analytics'
  | 'bridge.flags'
  | 'bridge.set'
  | 'help';

/**
 * Contextual tip structure
 */
export interface ContextualTip {
  /** Tip message */
  message: string;
  /** Tip priority (higher = more important) */
  priority: number;
  /** Related command if applicable */
  relatedCommand?: string;
  /** Documentation link if applicable */
  docLink?: string;
  /** Whether this is a quick action suggestion */
  isQuickAction?: boolean;
}

/**
 * Action context for generating tips
 */
export interface ActionContext {
  /** The command that was executed */
  command: IOSCommand;
  /** Whether the action succeeded */
  success: boolean;
  /** Error code if failed */
  errorCode?: IOSErrorCode | InteractionErrorCode | string;
  /** Target element if applicable */
  target?: string;
  /** Additional action data */
  data?: Record<string, unknown>;
  /** Previous commands in this session (most recent first) */
  previousCommands?: IOSCommand[];
  /** Whether this is the first time this error occurred in the session */
  isFirstOccurrence?: boolean;
}

/**
 * Next step suggestion
 */
export interface NextStep {
  /** Description of the next step */
  description: string;
  /** The suggested command */
  command: string;
  /** Why this step is suggested */
  reason?: string;
}

/**
 * Error tip with recovery information
 */
export interface ErrorTip {
  /** Title of the error */
  title: string;
  /** Main error message */
  message: string;
  /** Recovery tip */
  recoveryTip: string;
  /** Quick fix commands if available */
  quickFixes?: string[];
  /** Documentation link */
  docLink?: string;
  /** Related commands for context */
  relatedCommands?: string[];
}

// =============================================================================
// Documentation Links
// =============================================================================

/**
 * Get documentation link for a specific topic
 */
export function getDocLink(page: keyof typeof DOCS_PAGES, anchor?: string): string {
  const path = DOCS_PAGES[page];
  const url = `${DOCS_BASE_URL}${path}`;
  return anchor ? `${url}#${anchor}` : url;
}

/**
 * Get documentation link for a command
 */
export function getCommandDocLink(command: IOSCommand): string {
  const commandDocAnchors: Record<IOSCommand, string> = {
    snapshot: 'snapshot',
    inspect: 'inspect',
    tap: 'tap',
    type: 'type',
    scroll: 'scroll',
    swipe: 'swipe',
    run_flow: 'run-flow',
    playbook: 'playbook',
    baseline: 'baseline',
    diff: 'diff',
    regression: 'regression',
    setup: 'setup',
    'bridge.state': 'bridge-state',
    'bridge.route': 'bridge-route',
    'bridge.network': 'bridge-network',
    'bridge.analytics': 'bridge-analytics',
    'bridge.flags': 'bridge-flags',
    'bridge.set': 'bridge-set',
    help: 'help',
  };

  return getDocLink('commands', commandDocAnchors[command]);
}

/**
 * Get documentation link for an error code
 */
export function getErrorDocLink(
  errorCode: IOSErrorCode | InteractionErrorCode | string
): string {
  // Map error codes to troubleshooting sections
  const errorDocAnchors: Partial<Record<string, string>> = {
    XCODE_NOT_FOUND: 'xcode',
    XCODE_VERSION_UNSUPPORTED: 'xcode',
    SIMULATOR_NOT_FOUND: 'simulator',
    SIMULATOR_NOT_BOOTED: 'simulator',
    SIMULATOR_BOOT_FAILED: 'simulator',
    APP_NOT_INSTALLED: 'app-issues',
    APP_INSTALL_FAILED: 'app-issues',
    APP_LAUNCH_FAILED: 'app-issues',
    APP_CRASHED: 'app-issues',
    APP_NOT_RUNNING: 'app-issues',
    ELEMENT_NOT_FOUND: 'element-not-found',
    ELEMENT_NOT_HITTABLE: 'element-not-hittable',
    ELEMENT_NOT_VISIBLE: 'element-visibility',
    ELEMENT_NOT_ENABLED: 'element-state',
    ELEMENT_OBSCURED: 'element-obscured',
    ELEMENT_OFF_SCREEN: 'element-position',
    ELEMENT_ZERO_SIZE: 'element-state',
    MAESTRO_NOT_INSTALLED: 'maestro-cli',
    FLOW_TIMEOUT: 'flow-issues',
    FLOW_VALIDATION_FAILED: 'flow-issues',
    SCREENSHOT_FAILED: 'screenshot-issues',
    TIMEOUT: 'timeout-issues',
    INTERACTION_TIMEOUT: 'timeout-issues',
  };

  const anchor = errorDocAnchors[errorCode] || 'common-issues';
  return getDocLink('troubleshooting', anchor);
}

// =============================================================================
// Next Step Suggestions
// =============================================================================

/**
 * Get suggested next steps after a successful action
 */
export function getNextSteps(context: ActionContext): NextStep[] {
  const steps: NextStep[] = [];

  if (!context.success) {
    return steps; // No next steps for failed actions - use error tips instead
  }

  const { command, target, data, previousCommands = [] } = context;

  switch (command) {
    case 'snapshot':
      steps.push({
        description: 'Analyze UI elements',
        command: '/ios.inspect',
        reason: 'View the element tree of the captured screen',
      });
      if (!previousCommands.includes('baseline')) {
        steps.push({
          description: 'Save as baseline',
          command: '/ios.baseline save <name>',
          reason: 'Create a visual baseline for regression testing',
        });
      }
      steps.push({
        description: 'Compare to existing baseline',
        command: '/ios.diff <baseline-name>',
        reason: 'Check for visual differences',
      });
      break;

    case 'inspect':
      steps.push({
        description: 'Interact with an element',
        command: '/ios.tap #<identifier>',
        reason: 'Tap on one of the discovered elements',
      });
      steps.push({
        description: 'Type into an element',
        command: '/ios.type "text" #<identifier>',
        reason: 'Enter text in an input field',
      });
      break;

    case 'tap':
      steps.push({
        description: 'Capture the result',
        command: '/ios.snapshot',
        reason: 'Verify the tap triggered the expected change',
      });
      if (data?.isTextField) {
        steps.push({
          description: 'Type text',
          command: `/ios.type "your text" ${target ? `#${target}` : ''}`,
          reason: 'Enter text in the focused field',
        });
      }
      break;

    case 'type':
      steps.push({
        description: 'Capture the result',
        command: '/ios.snapshot',
        reason: 'Verify the text was entered correctly',
      });
      steps.push({
        description: 'Submit the form',
        command: '/ios.tap #submit-button',
        reason: 'If entering text in a form, tap the submit button',
      });
      break;

    case 'scroll':
    case 'swipe':
      steps.push({
        description: 'Inspect new elements',
        command: '/ios.inspect',
        reason: 'View elements that are now visible',
      });
      steps.push({
        description: 'Capture the new state',
        command: '/ios.snapshot',
        reason: 'Document the scroll/swipe result',
      });
      break;

    case 'run_flow':
      steps.push({
        description: 'Save baselines from this flow',
        command: '/ios.baseline save <flow-name>',
        reason: 'Create visual baselines for key screens in the flow',
      });
      steps.push({
        description: 'Run visual regression',
        command: '/ios.regression',
        reason: 'Compare all screens against baselines',
      });
      break;

    case 'baseline':
      if (data?.subcommand === 'save') {
        steps.push({
          description: 'Run a comparison',
          command: `/ios.diff ${data.baselineName || '<name>'}`,
          reason: 'Verify the baseline matches your expectations',
        });
        steps.push({
          description: 'Run full regression suite',
          command: '/ios.regression',
          reason: 'Run all baseline comparisons',
        });
      } else if (data?.subcommand === 'list') {
        steps.push({
          description: 'Update a baseline',
          command: '/ios.baseline update <name>',
          reason: 'Update an existing baseline with new screenshot',
        });
      }
      break;

    case 'diff':
      if (data?.hasDifferences) {
        steps.push({
          description: 'Update the baseline',
          command: `/ios.baseline update ${data.baselineName || '<name>'}`,
          reason: 'If the change is intentional, update the baseline',
        });
      }
      steps.push({
        description: 'Run full regression',
        command: '/ios.regression',
        reason: 'Check all baselines for similar issues',
      });
      break;

    case 'setup':
      if (data?.mode === 'wizard') {
        steps.push({
          description: 'Capture your first screenshot',
          command: '/ios.snapshot',
          reason: 'Verify the environment is working correctly',
        });
        steps.push({
          description: 'Run a sample flow',
          command: '/ios.run_flow maestro/sample_flow.yaml',
          reason: 'Test the generated sample automation',
        });
      }
      break;

    case 'bridge.state':
    case 'bridge.route':
    case 'bridge.network':
    case 'bridge.analytics':
    case 'bridge.flags':
      steps.push({
        description: 'View app state',
        command: '/ios.bridge.state',
        reason: 'See the full app state',
      });
      steps.push({
        description: 'Modify a flag',
        command: '/ios.bridge.set --flag <name> <value>',
        reason: 'Test different configurations',
      });
      break;
  }

  logger.debug(`${LOG_CONTEXT} Generated ${steps.length} next steps for ${command}`);
  return steps;
}

// =============================================================================
// Error Tips
// =============================================================================

/**
 * Get error tips for a specific error code
 */
export function getErrorTip(
  errorCode: IOSErrorCode | InteractionErrorCode | string,
  context?: ActionContext
): ErrorTip {
  const docLink = getErrorDocLink(errorCode);

  // Default error tip
  const defaultTip: ErrorTip = {
    title: 'Error',
    message: `An error occurred: ${errorCode}`,
    recoveryTip: 'Check the error message and try again.',
    docLink,
    relatedCommands: ['/ios.help --troubleshoot'],
  };

  const errorTips: Record<string, ErrorTip> = {
    // Environment errors
    XCODE_NOT_FOUND: {
      title: 'Xcode Not Found',
      message: 'Xcode is not installed or not properly configured.',
      recoveryTip:
        'Install Xcode from the App Store, open it once to accept the license, then run `xcode-select --install`.',
      quickFixes: ['/ios.setup --check', '/ios.setup --fix'],
      docLink: getDocLink('troubleshooting', 'xcode'),
      relatedCommands: ['/ios.setup', '/ios.help setup'],
    },
    SIMULATOR_NOT_BOOTED: {
      title: 'No Simulator Running',
      message: 'No iOS simulator is currently booted.',
      recoveryTip:
        'Boot a simulator to continue. You can use the fix command to automatically boot the default simulator.',
      quickFixes: [
        '/ios.setup --fix',
        'xcrun simctl boot "iPhone 15 Pro"',
      ],
      docLink: getDocLink('troubleshooting', 'simulator'),
      relatedCommands: ['/ios.setup --check'],
    },
    SIMULATOR_NOT_FOUND: {
      title: 'Simulator Not Found',
      message: 'The specified simulator was not found.',
      recoveryTip:
        'Check available simulators with `xcrun simctl list devices` or install a simulator runtime in Xcode.',
      quickFixes: ['/ios.setup --check'],
      docLink: getDocLink('troubleshooting', 'simulator'),
      relatedCommands: ['/ios.setup'],
    },
    APP_NOT_INSTALLED: {
      title: 'App Not Installed',
      message: 'The app is not installed on the simulator.',
      recoveryTip:
        'Build and install the app on the simulator. Check that the bundle ID is correct.',
      quickFixes: [
        'xcrun simctl install booted /path/to/App.app',
        '/ios.run_flow --inline "launchApp: <bundleId>"',
      ],
      docLink: getDocLink('troubleshooting', 'app-issues'),
    },
    APP_NOT_RUNNING: {
      title: 'App Not Running',
      message: 'The app is not currently running on the simulator.',
      recoveryTip: 'Launch the app before trying to interact with it.',
      quickFixes: ['/ios.run_flow --inline "launchApp: <bundleId>"'],
      docLink: getDocLink('troubleshooting', 'app-issues'),
    },
    APP_CRASHED: {
      title: 'App Crashed',
      message: 'The app crashed during the operation.',
      recoveryTip:
        'Check crash logs for the root cause. The app may need to be restarted.',
      quickFixes: [
        '/ios.run_flow --inline "launchApp: <bundleId>"',
        'View crash logs in Console.app',
      ],
      docLink: getDocLink('troubleshooting', 'app-issues'),
    },

    // Element interaction errors
    ELEMENT_NOT_FOUND: {
      title: 'Element Not Found',
      message: 'Could not find the specified element on the screen.',
      recoveryTip:
        'Use `/ios.inspect` to view available elements and their identifiers. Make sure you are using the correct accessibility identifier or label.',
      quickFixes: ['/ios.inspect', '/ios.snapshot'],
      docLink: getDocLink('troubleshooting', 'element-not-found'),
      relatedCommands: ['/ios.inspect', '/ios.help tap'],
    },
    ELEMENT_NOT_HITTABLE: {
      title: 'Element Not Hittable',
      message: 'The element exists but cannot be tapped.',
      recoveryTip:
        'The element may be covered by another view, off-screen, or disabled. Try scrolling it into view or dismissing any overlays.',
      quickFixes: ['/ios.scroll --to #<identifier>', '/ios.inspect'],
      docLink: getDocLink('troubleshooting', 'element-not-hittable'),
    },
    ELEMENT_NOT_VISIBLE: {
      title: 'Element Not Visible',
      message: 'The element exists but is not visible on screen.',
      recoveryTip: 'Scroll the element into view before interacting with it.',
      quickFixes: [
        '/ios.scroll --to #<identifier>',
        '/ios.scroll down',
      ],
      docLink: getDocLink('troubleshooting', 'element-visibility'),
      relatedCommands: ['/ios.scroll', '/ios.inspect'],
    },
    ELEMENT_NOT_ENABLED: {
      title: 'Element Disabled',
      message: 'The element is in a disabled state.',
      recoveryTip:
        'Complete any required preceding steps to enable the element. Check if form validation is preventing the action.',
      docLink: getDocLink('troubleshooting', 'element-state'),
    },
    ELEMENT_OBSCURED: {
      title: 'Element Obscured',
      message: 'Another element is covering the target element.',
      recoveryTip:
        'Dismiss any alerts, popovers, modals, or keyboard overlays before interacting with the element.',
      quickFixes: ['/ios.tap #close-button', '/ios.swipe down'],
      docLink: getDocLink('troubleshooting', 'element-obscured'),
    },
    ELEMENT_OFF_SCREEN: {
      title: 'Element Off Screen',
      message: 'The element is outside the visible screen bounds.',
      recoveryTip: 'Scroll the element into the visible area.',
      quickFixes: ['/ios.scroll --to #<identifier>'],
      docLink: getDocLink('troubleshooting', 'element-position'),
    },

    // Maestro/Flow errors
    MAESTRO_NOT_INSTALLED: {
      title: 'Maestro CLI Not Installed',
      message: 'The Maestro CLI tool is not installed or not in PATH.',
      recoveryTip:
        'Install Maestro using the curl installer and restart your terminal.',
      quickFixes: [
        'curl -Ls "https://get.maestro.mobile.dev" | bash',
        '/ios.setup --fix',
      ],
      docLink: getDocLink('troubleshooting', 'maestro-cli'),
      relatedCommands: ['/ios.setup'],
    },
    FLOW_TIMEOUT: {
      title: 'Flow Timed Out',
      message: 'The flow execution exceeded the timeout limit.',
      recoveryTip:
        'Increase the timeout value or break the flow into smaller steps. The app may be slow or unresponsive.',
      quickFixes: ['/ios.run_flow <flow> --timeout 120'],
      docLink: getDocLink('troubleshooting', 'flow-issues'),
    },
    FLOW_VALIDATION_FAILED: {
      title: 'Flow Validation Failed',
      message: 'The flow file contains invalid syntax or configuration.',
      recoveryTip:
        'Check the YAML syntax and ensure all action types are valid. Use `maestro validate` to see detailed errors.',
      quickFixes: ['maestro validate <flow.yaml>'],
      docLink: getDocLink('troubleshooting', 'flow-issues'),
    },

    // Screenshot/Capture errors
    SCREENSHOT_FAILED: {
      title: 'Screenshot Failed',
      message: 'Failed to capture a screenshot of the simulator.',
      recoveryTip:
        'Ensure the simulator is running and responsive. If the simulator is frozen, try restarting it.',
      quickFixes: ['/ios.setup --check', 'Restart Simulator.app'],
      docLink: getDocLink('troubleshooting', 'screenshot-issues'),
    },
    TIMEOUT: {
      title: 'Operation Timed Out',
      message: 'The operation took too long to complete.',
      recoveryTip:
        'The simulator or app may be under heavy load or frozen. Try increasing the timeout or restarting the simulator.',
      docLink: getDocLink('troubleshooting', 'timeout-issues'),
    },
    INTERACTION_TIMEOUT: {
      title: 'Interaction Timed Out',
      message: 'The interaction did not complete in time.',
      recoveryTip:
        'The element may not have responded. Try increasing the timeout or check if the app is responsive.',
      quickFixes: ['/ios.tap #<identifier> --timeout 10'],
      docLink: getDocLink('troubleshooting', 'timeout-issues'),
    },
  };

  const tip = errorTips[errorCode] || defaultTip;

  // Add context-specific enhancements
  if (context?.isFirstOccurrence === false) {
    tip.recoveryTip += ' This error has occurred multiple times in this session.';
  }

  logger.debug(`${LOG_CONTEXT} Generated error tip for ${errorCode}`);
  return tip;
}

// =============================================================================
// Contextual Tips Generation
// =============================================================================

/**
 * Generate contextual tips based on action context
 */
export function generateContextualTips(context: ActionContext): ContextualTip[] {
  const tips: ContextualTip[] = [];

  if (context.success) {
    // Generate success-based tips
    const nextSteps = getNextSteps(context);
    for (const step of nextSteps.slice(0, 3)) {
      tips.push({
        message: step.description,
        priority: 50,
        relatedCommand: step.command,
        isQuickAction: true,
      });
    }

    // Add command-specific documentation tip
    tips.push({
      message: `Learn more about \`/ios.${context.command}\``,
      priority: 10,
      docLink: getCommandDocLink(context.command),
    });
  } else if (context.errorCode) {
    // Generate error-based tips
    const errorTip = getErrorTip(context.errorCode, context);

    // Add quick fix tips
    if (errorTip.quickFixes) {
      for (const fix of errorTip.quickFixes.slice(0, 2)) {
        tips.push({
          message: `Try: ${fix}`,
          priority: 80,
          relatedCommand: fix.startsWith('/') ? fix : undefined,
          isQuickAction: true,
        });
      }
    }

    // Add documentation tip
    tips.push({
      message: 'View troubleshooting guide',
      priority: 60,
      docLink: errorTip.docLink,
    });

    // Add related commands
    if (errorTip.relatedCommands) {
      for (const cmd of errorTip.relatedCommands.slice(0, 2)) {
        tips.push({
          message: `Related: ${cmd}`,
          priority: 40,
          relatedCommand: cmd,
        });
      }
    }
  }

  // Sort by priority (highest first)
  tips.sort((a, b) => b.priority - a.priority);

  logger.debug(`${LOG_CONTEXT} Generated ${tips.length} contextual tips`);
  return tips;
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format contextual tips for display in markdown
 */
export function formatContextualTips(tips: ContextualTip[]): string {
  if (tips.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('### Tips');
  lines.push('');

  for (const tip of tips.slice(0, 5)) {
    let line = `- ${tip.message}`;
    if (tip.relatedCommand && !tip.message.includes(tip.relatedCommand)) {
      line += ` → \`${tip.relatedCommand}\``;
    }
    if (tip.docLink && !tip.relatedCommand) {
      line += ` → [docs](${tip.docLink})`;
    }
    lines.push(line);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format next steps for display in markdown
 */
export function formatNextSteps(steps: NextStep[]): string {
  if (steps.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('### Next Steps');
  lines.push('');

  for (const step of steps.slice(0, 4)) {
    lines.push(`**${step.description}**`);
    lines.push(`\`\`\`\n${step.command}\n\`\`\``);
    if (step.reason) {
      lines.push(`*${step.reason}*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format error tip for display in markdown
 */
export function formatErrorTip(tip: ErrorTip): string {
  const lines: string[] = [];

  lines.push(`## ✗ ${tip.title}`);
  lines.push('');
  lines.push(tip.message);
  lines.push('');
  lines.push('### How to Fix');
  lines.push('');
  lines.push(tip.recoveryTip);
  lines.push('');

  if (tip.quickFixes && tip.quickFixes.length > 0) {
    lines.push('### Quick Fixes');
    lines.push('');
    lines.push('```');
    for (const fix of tip.quickFixes) {
      lines.push(fix);
    }
    lines.push('```');
    lines.push('');
  }

  if (tip.relatedCommands && tip.relatedCommands.length > 0) {
    lines.push('### Related Commands');
    lines.push('');
    lines.push(tip.relatedCommands.map((c) => `\`${c}\``).join(' | '));
    lines.push('');
  }

  if (tip.docLink) {
    lines.push(`**Documentation**: ${tip.docLink}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a compact tip message for inline display
 */
export function formatCompactTip(tip: ContextualTip): string {
  let message = tip.message;
  if (tip.relatedCommand) {
    message += ` → \`${tip.relatedCommand}\``;
  } else if (tip.docLink) {
    message += ` → ${tip.docLink}`;
  }
  return message;
}

// =============================================================================
// Workflow Suggestions
// =============================================================================

/**
 * Common workflow patterns
 */
export interface WorkflowSuggestion {
  name: string;
  description: string;
  steps: string[];
  trigger: (context: ActionContext) => boolean;
}

/**
 * Predefined workflow suggestions
 */
export const WORKFLOW_SUGGESTIONS: WorkflowSuggestion[] = [
  {
    name: 'Feature Development',
    description: 'Iterative development with visual verification',
    steps: [
      '/ios.snapshot          # Capture initial state',
      '/ios.inspect           # Find element identifiers',
      '/ios.tap #button       # Interact with UI',
      '/ios.snapshot          # Verify result',
    ],
    trigger: (ctx) =>
      ctx.command === 'snapshot' &&
      ctx.success &&
      !(ctx.previousCommands || []).includes('inspect'),
  },
  {
    name: 'Visual Regression Setup',
    description: 'Set up baseline for visual testing',
    steps: [
      '/ios.baseline save <name>  # Save current as baseline',
      '/ios.diff <name>           # Compare against baseline',
      '/ios.regression            # Run full suite',
    ],
    trigger: (ctx) =>
      ctx.command === 'snapshot' &&
      ctx.success &&
      (ctx.previousCommands || []).length >= 2,
  },
  {
    name: 'Debug Element Issue',
    description: 'Troubleshoot element interaction problems',
    steps: [
      '/ios.inspect           # View element tree',
      '/ios.snapshot          # Capture current state',
      '/ios.tap #identifier   # Retry interaction',
    ],
    trigger: (ctx) =>
      !ctx.success &&
      ['ELEMENT_NOT_FOUND', 'ELEMENT_NOT_HITTABLE'].includes(ctx.errorCode || ''),
  },
  {
    name: 'Environment Check',
    description: 'Verify iOS development environment',
    steps: [
      '/ios.setup --check     # Check environment',
      '/ios.setup --fix       # Auto-fix issues',
      '/ios.snapshot          # Verify connectivity',
    ],
    trigger: (ctx) =>
      !ctx.success &&
      [
        'SIMULATOR_NOT_BOOTED',
        'XCODE_NOT_FOUND',
        'MAESTRO_NOT_INSTALLED',
      ].includes(ctx.errorCode || ''),
  },
];

/**
 * Get workflow suggestions based on context
 */
export function getWorkflowSuggestions(context: ActionContext): WorkflowSuggestion[] {
  return WORKFLOW_SUGGESTIONS.filter((wf) => wf.trigger(context));
}

/**
 * Format workflow suggestion for display
 */
export function formatWorkflowSuggestion(workflow: WorkflowSuggestion): string {
  const lines: string[] = [];

  lines.push(`### Suggested Workflow: ${workflow.name}`);
  lines.push('');
  lines.push(`*${workflow.description}*`);
  lines.push('');
  lines.push('```');
  for (const step of workflow.steps) {
    lines.push(step);
  }
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}
