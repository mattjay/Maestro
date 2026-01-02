/**
 * iOS Tools - Command Suggestions
 *
 * Provides intelligent command suggestions after iOS slash command execution.
 * Suggests related commands based on:
 * - The command that was just executed
 * - The result of that command (success/failure)
 * - The current context (elements found, baselines available, etc.)
 *
 * This module focuses on discoverability - helping users understand
 * what commands naturally follow their current action.
 */

import { logger } from '../utils/logger';

const LOG_CONTEXT = '[iOS-CommandSuggestions]';

// =============================================================================
// Types
// =============================================================================

/**
 * A suggested command with description and context
 */
export interface CommandSuggestion {
  /** The command to suggest (e.g., "/ios.inspect") */
  command: string;
  /** Short description of what the command does */
  description: string;
  /** Why this command is suggested after the current action */
  reason?: string;
  /** Example usage with arguments */
  example?: string;
  /** Priority for sorting (lower = higher priority) */
  priority: number;
  /** Category for grouping suggestions */
  category: 'verify' | 'interact' | 'capture' | 'automate' | 'debug';
}

/**
 * Context for generating command suggestions
 */
export interface SuggestionContext {
  /** The command that was just executed */
  executedCommand: string;
  /** Whether the command succeeded */
  success: boolean;
  /** Error code if failed */
  errorCode?: string;
  /** Any elements found/interacted with */
  elements?: string[];
  /** Available baselines */
  baselines?: string[];
  /** Available flows */
  flows?: string[];
  /** Current simulator name/UDID */
  simulator?: string;
  /** Current app bundle ID */
  bundleId?: string;
  /** Screenshot path if one was taken */
  screenshotPath?: string;
  /** Additional context data */
  data?: Record<string, unknown>;
}

/**
 * Result of command suggestion generation
 */
export interface CommandSuggestionResult {
  /** The header message to display */
  header: string;
  /** List of suggested commands */
  suggestions: CommandSuggestion[];
  /** Total number of suggestions before filtering */
  totalSuggestions: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Category labels for display
 */
export const CATEGORY_LABELS: Record<CommandSuggestion['category'], string> = {
  verify: 'Verify Results',
  interact: 'Interact with UI',
  capture: 'Capture & Document',
  automate: 'Automate & Test',
  debug: 'Debug & Troubleshoot',
};

/**
 * Category icons for display
 */
export const CATEGORY_ICONS: Record<CommandSuggestion['category'], string> = {
  verify: '✓',
  interact: '👆',
  capture: '📷',
  automate: '🔄',
  debug: '🔍',
};

// =============================================================================
// Suggestion Definitions
// =============================================================================

/**
 * Suggestions for each command
 */
const COMMAND_SUGGESTIONS: Record<string, (ctx: SuggestionContext) => CommandSuggestion[]> = {
  '/ios.snapshot': (ctx) => {
    const suggestions: CommandSuggestion[] = [
      {
        command: '/ios.inspect',
        description: 'Analyze UI elements',
        reason: 'View the element tree to find identifiers for interactions',
        example: '/ios.inspect',
        priority: 1,
        category: 'verify',
      },
    ];

    if (ctx.baselines && ctx.baselines.length > 0) {
      suggestions.push({
        command: '/ios.diff',
        description: 'Compare to baseline',
        reason: 'Check for visual differences against saved baseline',
        example: `/ios.diff ${ctx.baselines[0]}`,
        priority: 2,
        category: 'verify',
      });
    } else {
      suggestions.push({
        command: '/ios.baseline save',
        description: 'Save as baseline',
        reason: 'Create a visual baseline for regression testing',
        example: '/ios.baseline save login_screen',
        priority: 2,
        category: 'capture',
      });
    }

    suggestions.push(
      {
        command: '/ios.tap',
        description: 'Tap an element',
        reason: 'Interact with visible elements',
        example: '/ios.tap #button-id',
        priority: 3,
        category: 'interact',
      },
      {
        command: '/ios.scroll',
        description: 'Scroll the view',
        reason: 'Reveal more content',
        example: '/ios.scroll down',
        priority: 4,
        category: 'interact',
      }
    );

    return suggestions;
  },

  '/ios.inspect': (ctx) => {
    const suggestions: CommandSuggestion[] = [];

    // Suggest interactions with discovered elements
    if (ctx.elements && ctx.elements.length > 0) {
      const element = ctx.elements[0];
      suggestions.push(
        {
          command: '/ios.tap',
          description: 'Tap an element',
          reason: 'Interact with one of the discovered elements',
          example: `/ios.tap #${element}`,
          priority: 1,
          category: 'interact',
        },
        {
          command: '/ios.type',
          description: 'Type into input',
          reason: 'Enter text in a text field',
          example: `/ios.type "your text" #${element}`,
          priority: 2,
          category: 'interact',
        }
      );
    } else {
      suggestions.push(
        {
          command: '/ios.tap',
          description: 'Tap an element',
          reason: 'Interact with a UI element',
          example: '/ios.tap #element-id',
          priority: 1,
          category: 'interact',
        },
        {
          command: '/ios.type',
          description: 'Type into input',
          reason: 'Enter text in a text field',
          example: '/ios.type "text" #field-id',
          priority: 2,
          category: 'interact',
        }
      );
    }

    suggestions.push(
      {
        command: '/ios.scroll',
        description: 'Scroll to reveal elements',
        reason: 'Find elements that may be off-screen',
        example: '/ios.scroll down',
        priority: 3,
        category: 'interact',
      },
      {
        command: '/ios.snapshot',
        description: 'Capture screenshot',
        reason: 'Document the current state',
        example: '/ios.snapshot',
        priority: 4,
        category: 'capture',
      },
      {
        command: '/ios.run_flow',
        description: 'Run a flow',
        reason: 'Automate a sequence of interactions',
        example: '/ios.run_flow maestro/login.yaml',
        priority: 5,
        category: 'automate',
      }
    );

    return suggestions;
  },

  '/ios.tap': (ctx) => {
    const suggestions: CommandSuggestion[] = [
      {
        command: '/ios.snapshot',
        description: 'Capture result',
        reason: 'Verify the tap triggered the expected change',
        example: '/ios.snapshot',
        priority: 1,
        category: 'verify',
      },
      {
        command: '/ios.inspect',
        description: 'Inspect new state',
        reason: 'See what elements are now available',
        example: '/ios.inspect',
        priority: 2,
        category: 'verify',
      },
    ];

    // If tapping might have opened a text field
    suggestions.push({
      command: '/ios.type',
      description: 'Type text',
      reason: 'If the tap focused a text field, enter text',
      example: '/ios.type "your text"',
      priority: 3,
      category: 'interact',
    });

    suggestions.push(
      {
        command: '/ios.tap',
        description: 'Tap another element',
        reason: 'Continue interaction sequence',
        example: '/ios.tap #next-button',
        priority: 4,
        category: 'interact',
      },
      {
        command: '/ios.scroll',
        description: 'Scroll the view',
        reason: 'Reveal more content after navigation',
        example: '/ios.scroll down',
        priority: 5,
        category: 'interact',
      }
    );

    return suggestions;
  },

  '/ios.type': (ctx) => {
    const suggestions: CommandSuggestion[] = [
      {
        command: '/ios.snapshot',
        description: 'Capture result',
        reason: 'Verify text was entered correctly',
        example: '/ios.snapshot',
        priority: 1,
        category: 'verify',
      },
      {
        command: '/ios.tap',
        description: 'Submit form',
        reason: 'Tap submit button to complete the form',
        example: '/ios.tap #submit-button',
        priority: 2,
        category: 'interact',
      },
      {
        command: '/ios.type',
        description: 'Fill another field',
        reason: 'Continue filling form fields',
        example: '/ios.type "value" #next-field',
        priority: 3,
        category: 'interact',
      },
      {
        command: '/ios.inspect',
        description: 'Find next input',
        reason: 'Locate additional form fields',
        example: '/ios.inspect',
        priority: 4,
        category: 'verify',
      },
    ];

    return suggestions;
  },

  '/ios.scroll': (ctx) => {
    const suggestions: CommandSuggestion[] = [
      {
        command: '/ios.inspect',
        description: 'Inspect new elements',
        reason: 'View elements that scrolled into view',
        example: '/ios.inspect',
        priority: 1,
        category: 'verify',
      },
      {
        command: '/ios.snapshot',
        description: 'Capture new state',
        reason: 'Document the scroll result',
        example: '/ios.snapshot',
        priority: 2,
        category: 'capture',
      },
      {
        command: '/ios.tap',
        description: 'Tap revealed element',
        reason: 'Interact with newly visible element',
        example: '/ios.tap #element-id',
        priority: 3,
        category: 'interact',
      },
      {
        command: '/ios.scroll',
        description: 'Continue scrolling',
        reason: 'Scroll further to find more content',
        example: '/ios.scroll down',
        priority: 4,
        category: 'interact',
      },
    ];

    return suggestions;
  },

  '/ios.swipe': (ctx) => {
    const suggestions: CommandSuggestion[] = [
      {
        command: '/ios.snapshot',
        description: 'Capture result',
        reason: 'Document the swipe effect',
        example: '/ios.snapshot',
        priority: 1,
        category: 'capture',
      },
      {
        command: '/ios.inspect',
        description: 'Inspect new state',
        reason: 'See what changed after swipe',
        example: '/ios.inspect',
        priority: 2,
        category: 'verify',
      },
      {
        command: '/ios.swipe',
        description: 'Continue swiping',
        reason: 'Navigate through carousel or pages',
        example: '/ios.swipe left',
        priority: 3,
        category: 'interact',
      },
      {
        command: '/ios.tap',
        description: 'Select item',
        reason: 'Tap on revealed content',
        example: '/ios.tap #item-id',
        priority: 4,
        category: 'interact',
      },
    ];

    return suggestions;
  },

  '/ios.run_flow': (ctx) => {
    const suggestions: CommandSuggestion[] = [
      {
        command: '/ios.baseline save',
        description: 'Save baselines',
        reason: 'Create visual baselines for screens in the flow',
        example: '/ios.baseline save flow_end_state',
        priority: 1,
        category: 'capture',
      },
      {
        command: '/ios.regression',
        description: 'Run regression suite',
        reason: 'Compare all screens against baselines',
        example: '/ios.regression',
        priority: 2,
        category: 'automate',
      },
      {
        command: '/ios.snapshot',
        description: 'Capture final state',
        reason: 'Document the end state of the flow',
        example: '/ios.snapshot',
        priority: 3,
        category: 'capture',
      },
      {
        command: '/ios.run_flow',
        description: 'Run another flow',
        reason: 'Continue with another automation flow',
        example: '/ios.run_flow maestro/next_flow.yaml',
        priority: 4,
        category: 'automate',
      },
    ];

    if (ctx.flows && ctx.flows.length > 1) {
      suggestions.push({
        command: '/ios.playbook',
        description: 'Run playbook',
        reason: 'Execute a predefined testing playbook',
        example: '/ios.playbook feature-ship-loop',
        priority: 5,
        category: 'automate',
      });
    }

    return suggestions;
  },

  '/ios.baseline': (ctx) => {
    const suggestions: CommandSuggestion[] = [
      {
        command: '/ios.diff',
        description: 'Compare against baseline',
        reason: 'Verify baseline matches current state',
        example: '/ios.diff <baseline-name>',
        priority: 1,
        category: 'verify',
      },
      {
        command: '/ios.regression',
        description: 'Run regression suite',
        reason: 'Run all baseline comparisons',
        example: '/ios.regression',
        priority: 2,
        category: 'automate',
      },
      {
        command: '/ios.baseline list',
        description: 'List all baselines',
        reason: 'See all saved baselines',
        example: '/ios.baseline list',
        priority: 3,
        category: 'verify',
      },
      {
        command: '/ios.snapshot',
        description: 'Capture another screen',
        reason: 'Save more screens as baselines',
        example: '/ios.snapshot',
        priority: 4,
        category: 'capture',
      },
    ];

    return suggestions;
  },

  '/ios.diff': (ctx) => {
    const suggestions: CommandSuggestion[] = [];

    // Check if diff found differences
    if (ctx.data?.hasDifferences) {
      suggestions.push({
        command: '/ios.baseline update',
        description: 'Update baseline',
        reason: 'If changes are intentional, update the baseline',
        example: `/ios.baseline update ${ctx.data?.baselineName || '<name>'}`,
        priority: 1,
        category: 'capture',
      });
    }

    suggestions.push(
      {
        command: '/ios.regression',
        description: 'Run full regression',
        reason: 'Check all baselines for similar issues',
        example: '/ios.regression',
        priority: 2,
        category: 'automate',
      },
      {
        command: '/ios.snapshot',
        description: 'Capture current state',
        reason: 'Take a new screenshot for comparison',
        example: '/ios.snapshot',
        priority: 3,
        category: 'capture',
      },
      {
        command: '/ios.inspect',
        description: 'Inspect changes',
        reason: 'Understand what changed in the UI',
        example: '/ios.inspect',
        priority: 4,
        category: 'debug',
      }
    );

    return suggestions;
  },

  '/ios.regression': (ctx) => {
    const suggestions: CommandSuggestion[] = [
      {
        command: '/ios.baseline update',
        description: 'Update failed baselines',
        reason: 'Update baselines that intentionally changed',
        example: '/ios.baseline update <name>',
        priority: 1,
        category: 'capture',
      },
      {
        command: '/ios.diff',
        description: 'View specific diff',
        reason: 'Examine a specific baseline comparison',
        example: '/ios.diff <baseline-name>',
        priority: 2,
        category: 'verify',
      },
      {
        command: '/ios.run_flow',
        description: 'Run a flow',
        reason: 'Navigate to a screen that needs fixing',
        example: '/ios.run_flow maestro/login.yaml',
        priority: 3,
        category: 'automate',
      },
      {
        command: '/ios.snapshot',
        description: 'Capture current state',
        reason: 'Take screenshots for new baselines',
        example: '/ios.snapshot',
        priority: 4,
        category: 'capture',
      },
    ];

    return suggestions;
  },

  '/ios.setup': (ctx) => {
    const suggestions: CommandSuggestion[] = [
      {
        command: '/ios.snapshot',
        description: 'Capture first screenshot',
        reason: 'Verify the environment is working',
        example: '/ios.snapshot',
        priority: 1,
        category: 'verify',
      },
      {
        command: '/ios.inspect',
        description: 'Inspect app UI',
        reason: 'View available UI elements',
        example: '/ios.inspect',
        priority: 2,
        category: 'verify',
      },
      {
        command: '/ios.run_flow',
        description: 'Run sample flow',
        reason: 'Test the generated sample automation',
        example: '/ios.run_flow maestro/sample_flow.yaml',
        priority: 3,
        category: 'automate',
      },
      {
        command: '/ios.help',
        description: 'View all commands',
        reason: 'Learn about available iOS commands',
        example: '/ios.help',
        priority: 4,
        category: 'debug',
      },
    ];

    return suggestions;
  },

  '/ios.bridge.state': (ctx) => {
    const suggestions: CommandSuggestion[] = [
      {
        command: '/ios.bridge.flags',
        description: 'View feature flags',
        reason: 'See current flag values',
        example: '/ios.bridge.flags',
        priority: 1,
        category: 'debug',
      },
      {
        command: '/ios.bridge.set',
        description: 'Modify app state',
        reason: 'Change a flag or setting',
        example: '/ios.bridge.set --flag darkMode true',
        priority: 2,
        category: 'debug',
      },
      {
        command: '/ios.bridge.network',
        description: 'View network requests',
        reason: 'Inspect API calls',
        example: '/ios.bridge.network',
        priority: 3,
        category: 'debug',
      },
      {
        command: '/ios.snapshot',
        description: 'Capture state',
        reason: 'Document current app state',
        example: '/ios.snapshot',
        priority: 4,
        category: 'capture',
      },
    ];

    return suggestions;
  },
};

// Default suggestions for unknown commands
const DEFAULT_SUGGESTIONS: CommandSuggestion[] = [
  {
    command: '/ios.snapshot',
    description: 'Capture screenshot',
    reason: 'Document the current screen state',
    example: '/ios.snapshot',
    priority: 1,
    category: 'capture',
  },
  {
    command: '/ios.inspect',
    description: 'Analyze UI elements',
    reason: 'Find element identifiers for interactions',
    example: '/ios.inspect',
    priority: 2,
    category: 'verify',
  },
  {
    command: '/ios.help',
    description: 'View all commands',
    reason: 'Learn about available iOS commands',
    example: '/ios.help',
    priority: 3,
    category: 'debug',
  },
];

// Error-specific suggestions
const ERROR_SUGGESTIONS: Record<string, CommandSuggestion[]> = {
  ELEMENT_NOT_FOUND: [
    {
      command: '/ios.inspect',
      description: 'Inspect UI elements',
      reason: 'Find the correct element identifier',
      example: '/ios.inspect',
      priority: 1,
      category: 'debug',
    },
    {
      command: '/ios.scroll',
      description: 'Scroll to reveal',
      reason: 'Element may be off-screen',
      example: '/ios.scroll down',
      priority: 2,
      category: 'interact',
    },
    {
      command: '/ios.snapshot',
      description: 'Capture current state',
      reason: 'Verify you are on the expected screen',
      example: '/ios.snapshot',
      priority: 3,
      category: 'verify',
    },
  ],
  SIMULATOR_NOT_BOOTED: [
    {
      command: '/ios.setup --fix',
      description: 'Fix environment',
      reason: 'Automatically boot the simulator',
      example: '/ios.setup --fix',
      priority: 1,
      category: 'debug',
    },
    {
      command: '/ios.setup --check',
      description: 'Check environment',
      reason: 'Diagnose environment issues',
      example: '/ios.setup --check',
      priority: 2,
      category: 'debug',
    },
  ],
  MAESTRO_NOT_INSTALLED: [
    {
      command: '/ios.setup --fix',
      description: 'Fix environment',
      reason: 'Guide through Maestro CLI installation',
      example: '/ios.setup --fix',
      priority: 1,
      category: 'debug',
    },
    {
      command: '/ios.help setup',
      description: 'View setup guide',
      reason: 'Learn about setup requirements',
      example: '/ios.help setup',
      priority: 2,
      category: 'debug',
    },
  ],
  FLOW_TIMEOUT: [
    {
      command: '/ios.run_flow',
      description: 'Retry with longer timeout',
      reason: 'Increase timeout for slow operations',
      example: '/ios.run_flow <flow> --timeout 120',
      priority: 1,
      category: 'automate',
    },
    {
      command: '/ios.inspect',
      description: 'Check current state',
      reason: 'Verify app is in expected state',
      example: '/ios.inspect',
      priority: 2,
      category: 'debug',
    },
  ],
  APP_NOT_RUNNING: [
    {
      command: '/ios.run_flow --inline',
      description: 'Launch the app',
      reason: 'Start the app before interacting',
      example: '/ios.run_flow --inline "launchApp: <bundleId>"',
      priority: 1,
      category: 'debug',
    },
    {
      command: '/ios.setup --check',
      description: 'Check setup',
      reason: 'Verify app configuration',
      example: '/ios.setup --check',
      priority: 2,
      category: 'debug',
    },
  ],
};

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Get command suggestions based on executed command and context.
 *
 * @param context - The context of the executed command
 * @returns Command suggestions with header
 */
export function getCommandSuggestions(context: SuggestionContext): CommandSuggestionResult {
  logger.debug(`${LOG_CONTEXT} Getting suggestions for ${context.executedCommand}`);

  let suggestions: CommandSuggestion[] = [];
  let header = '';

  // Handle error cases first
  if (!context.success && context.errorCode) {
    const errorSuggestions = ERROR_SUGGESTIONS[context.errorCode];
    if (errorSuggestions) {
      suggestions = [...errorSuggestions];
      header = 'To resolve this issue, try:';
    } else {
      // Default error suggestions
      suggestions = [...DEFAULT_SUGGESTIONS];
      header = 'You might want to:';
    }
  } else {
    // Get command-specific suggestions
    const commandBase = normalizeCommand(context.executedCommand);
    const suggestionFn = COMMAND_SUGGESTIONS[commandBase];

    if (suggestionFn) {
      suggestions = suggestionFn(context);
      header = `After ${formatCommandName(commandBase)}, you might want:`;
    } else {
      suggestions = [...DEFAULT_SUGGESTIONS];
      header = 'You might want to:';
    }
  }

  // Sort by priority
  suggestions.sort((a, b) => a.priority - b.priority);

  const totalSuggestions = suggestions.length;

  logger.debug(`${LOG_CONTEXT} Generated ${totalSuggestions} suggestions`);

  return {
    header,
    suggestions,
    totalSuggestions,
  };
}

/**
 * Get suggestions for a specific category only.
 *
 * @param context - The context of the executed command
 * @param category - The category to filter by
 * @returns Filtered command suggestions
 */
export function getSuggestionsByCategory(
  context: SuggestionContext,
  category: CommandSuggestion['category']
): CommandSuggestionResult {
  const result = getCommandSuggestions(context);
  const filtered = result.suggestions.filter((s) => s.category === category);

  return {
    header: `${CATEGORY_ICONS[category]} ${CATEGORY_LABELS[category]}`,
    suggestions: filtered,
    totalSuggestions: filtered.length,
  };
}

/**
 * Get top N suggestions (for compact display).
 *
 * @param context - The context of the executed command
 * @param limit - Maximum number of suggestions to return
 * @returns Limited command suggestions
 */
export function getTopSuggestions(
  context: SuggestionContext,
  limit: number = 3
): CommandSuggestionResult {
  const result = getCommandSuggestions(context);

  return {
    header: result.header,
    suggestions: result.suggestions.slice(0, limit),
    totalSuggestions: result.totalSuggestions,
  };
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format suggestions as markdown for display.
 *
 * @param result - Command suggestion result
 * @param options - Formatting options
 * @returns Formatted markdown string
 */
export function formatSuggestionsAsMarkdown(
  result: CommandSuggestionResult,
  options: {
    showExamples?: boolean;
    showReasons?: boolean;
    groupByCategory?: boolean;
    maxSuggestions?: number;
  } = {}
): string {
  const {
    showExamples = true,
    showReasons = true,
    groupByCategory = false,
    maxSuggestions = 5,
  } = options;

  if (result.suggestions.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push(`### ${result.header}`);
  lines.push('');

  const suggestions = result.suggestions.slice(0, maxSuggestions);

  if (groupByCategory) {
    // Group suggestions by category
    const byCategory = new Map<CommandSuggestion['category'], CommandSuggestion[]>();
    for (const suggestion of suggestions) {
      const existing = byCategory.get(suggestion.category) || [];
      existing.push(suggestion);
      byCategory.set(suggestion.category, existing);
    }

    for (const [category, categorySuggestions] of byCategory) {
      lines.push(`#### ${CATEGORY_ICONS[category]} ${CATEGORY_LABELS[category]}`);
      lines.push('');
      for (const suggestion of categorySuggestions) {
        lines.push(formatSingleSuggestion(suggestion, showExamples, showReasons));
      }
      lines.push('');
    }
  } else {
    // Flat list
    for (const suggestion of suggestions) {
      lines.push(formatSingleSuggestion(suggestion, showExamples, showReasons));
    }
  }

  if (result.totalSuggestions > maxSuggestions) {
    lines.push('');
    lines.push(`*${result.totalSuggestions - maxSuggestions} more suggestions available*`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format a single suggestion
 */
function formatSingleSuggestion(
  suggestion: CommandSuggestion,
  showExample: boolean,
  showReason: boolean
): string {
  let line = `• **\`${suggestion.command}\`** - ${suggestion.description}`;

  if (showReason && suggestion.reason) {
    line += `\n  *${suggestion.reason}*`;
  }

  if (showExample && suggestion.example) {
    line += `\n  \`\`\`\n  ${suggestion.example}\n  \`\`\``;
  }

  return line;
}

/**
 * Format suggestions as a compact inline message.
 *
 * @param result - Command suggestion result
 * @param maxSuggestions - Maximum number to show
 * @returns Compact formatted string
 */
export function formatSuggestionsCompact(
  result: CommandSuggestionResult,
  maxSuggestions: number = 3
): string {
  if (result.suggestions.length === 0) {
    return '';
  }

  const suggestions = result.suggestions.slice(0, maxSuggestions);
  const items = suggestions.map((s) => `\`${s.command}\` - ${s.description}`);

  return `${result.header}\n${items.join('\n')}`;
}

/**
 * Format suggestions as JSON for programmatic use.
 *
 * @param result - Command suggestion result
 * @returns JSON string
 */
export function formatSuggestionsAsJson(result: CommandSuggestionResult): string {
  return JSON.stringify(result, null, 2);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize command name (remove arguments, fix casing)
 */
function normalizeCommand(command: string): string {
  // Extract base command (first word)
  const parts = command.trim().split(/\s+/);
  let base = parts[0].toLowerCase();

  // Remove leading slash if present
  if (base.startsWith('/')) {
    base = base.slice(1);
  }

  // Remove ios. prefix if present (we'll add it back)
  if (base.startsWith('ios.')) {
    base = base.slice(4);
  }

  // Return normalized form: /ios.<command>
  return `/ios.${base}`;
}

/**
 * Format command name for display
 */
function formatCommandName(command: string): string {
  // Remove /ios. prefix for display
  return command.replace('/ios.', '/ios.');
}

/**
 * Check if a command has specific suggestions defined
 */
export function hasDefinedSuggestions(command: string): boolean {
  const commandBase = normalizeCommand(command);
  return Object.prototype.hasOwnProperty.call(COMMAND_SUGGESTIONS, commandBase);
}

/**
 * Get all suggestion categories
 */
export function getAllCategories(): Array<{
  category: CommandSuggestion['category'];
  label: string;
  icon: string;
}> {
  return Object.entries(CATEGORY_LABELS).map(([category, label]) => ({
    category: category as CommandSuggestion['category'],
    label,
    icon: CATEGORY_ICONS[category as CommandSuggestion['category']],
  }));
}

/**
 * Register custom suggestions for a command
 * (Used for extensibility)
 */
export function registerCommandSuggestions(
  command: string,
  suggestionFn: (ctx: SuggestionContext) => CommandSuggestion[]
): void {
  const normalized = normalizeCommand(command);
  COMMAND_SUGGESTIONS[normalized] = suggestionFn;
  logger.debug(`${LOG_CONTEXT} Registered custom suggestions for ${normalized}`);
}

/**
 * Add error-specific suggestions
 * (Used for extensibility)
 */
export function registerErrorSuggestions(
  errorCode: string,
  suggestions: CommandSuggestion[]
): void {
  ERROR_SUGGESTIONS[errorCode] = suggestions;
  logger.debug(`${LOG_CONTEXT} Registered suggestions for error ${errorCode}`);
}
