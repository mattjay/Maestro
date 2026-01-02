/**
 * iOS Bridge Slash Commands Handler
 *
 * Handles the /ios.bridge.* commands for introspecting iOS app state
 * via the MaestroBridge Swift package.
 *
 * Commands:
 *   /ios.bridge.state [key] [--json]
 *   /ios.bridge.route [--stack]
 *   /ios.bridge.network [--last <n>] [--errors]
 *   /ios.bridge.analytics [--filter <term>] [--last <n>]
 *   /ios.bridge.flags [name]
 *   /ios.bridge.set <key> <value> [--confirm]
 */

import {
  BridgeClient,
  createBridgeClient,
  getCachedBridgeClient,
  AppState,
  RouteInfo,
  NetworkLog,
  AnalyticsLog,
  FeatureFlags,
  NetworkRequestEntry,
} from '../ios-tools/bridge-client';
import * as iosTools from '../ios-tools';
import { logger } from '../utils/logger';

const LOG_CONTEXT = '[SlashCmd-ios.bridge]';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed arguments from /ios.bridge.state command
 */
export interface BridgeStateCommandArgs {
  /** Specific state key to retrieve */
  key?: string;
  /** Output as raw JSON */
  json?: boolean;
  /** Simulator name or UDID */
  simulator?: string;
  /** Bridge port override */
  port?: number;
  /** Bridge token override */
  token?: string;
}

/**
 * Parsed arguments from /ios.bridge.route command
 */
export interface BridgeRouteCommandArgs {
  /** Show full navigation stack */
  stack?: boolean;
  /** Simulator name or UDID */
  simulator?: string;
  /** Bridge port override */
  port?: number;
  /** Bridge token override */
  token?: string;
}

/**
 * Parsed arguments from /ios.bridge.network command
 */
export interface BridgeNetworkCommandArgs {
  /** Number of recent requests to show */
  last?: number;
  /** Show only error requests */
  errors?: boolean;
  /** Simulator name or UDID */
  simulator?: string;
  /** Bridge port override */
  port?: number;
  /** Bridge token override */
  token?: string;
}

/**
 * Parsed arguments from /ios.bridge.analytics command
 */
export interface BridgeAnalyticsCommandArgs {
  /** Filter events by name/property */
  filter?: string;
  /** Number of recent events to show */
  last?: number;
  /** Simulator name or UDID */
  simulator?: string;
  /** Bridge port override */
  port?: number;
  /** Bridge token override */
  token?: string;
}

/**
 * Parsed arguments from /ios.bridge.flags command
 */
export interface BridgeFlagsCommandArgs {
  /** Specific flag name to retrieve */
  name?: string;
  /** Simulator name or UDID */
  simulator?: string;
  /** Bridge port override */
  port?: number;
  /** Bridge token override */
  token?: string;
}

/**
 * Parsed arguments from /ios.bridge.set command
 */
export interface BridgeSetCommandArgs {
  /** State key to set */
  key?: string;
  /** Value to set */
  value?: string;
  /** Confirm dangerous operation */
  confirm?: boolean;
  /** Simulator name or UDID */
  simulator?: string;
  /** Bridge port override */
  port?: number;
  /** Bridge token override */
  token?: string;
}

/**
 * Result of executing a bridge command
 */
export interface BridgeCommandResult {
  success: boolean;
  /** Formatted output for display in AI terminal */
  output: string;
  /** Raw data (for programmatic use) */
  data?: unknown;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Tokenizer
// =============================================================================

/**
 * Tokenize a string respecting quoted values.
 * Handles both single and double quotes.
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
// Common Helpers
// =============================================================================

/**
 * Check if a string looks like a simulator UDID.
 */
function isUdid(value: string): boolean {
  return /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(
    value
  );
}

/**
 * Resolve a simulator name to its UDID.
 */
async function resolveSimulatorName(
  name: string
): Promise<{ success: boolean; udid?: string; error?: string }> {
  // First try to get booted simulators (most common case)
  const bootedResult = await iosTools.getBootedSimulators();
  if (bootedResult.success && bootedResult.data) {
    const booted = bootedResult.data.find(
      (sim) => sim.name.toLowerCase() === name.toLowerCase()
    );
    if (booted) {
      return { success: true, udid: booted.udid };
    }
  }

  // Fall back to searching all simulators
  const allResult = await iosTools.listSimulators();
  if (!allResult.success || !allResult.data) {
    return {
      success: false,
      error: allResult.error || 'Failed to list simulators',
    };
  }

  // Search by exact name match first
  const exactMatch = allResult.data.find(
    (sim) => sim.name.toLowerCase() === name.toLowerCase()
  );
  if (exactMatch) {
    return { success: true, udid: exactMatch.udid };
  }

  // Search by partial match
  const partialMatch = allResult.data.find((sim) =>
    sim.name.toLowerCase().includes(name.toLowerCase())
  );
  if (partialMatch) {
    return { success: true, udid: partialMatch.udid };
  }

  return {
    success: false,
    error: `No simulator found matching "${name}"`,
  };
}

/**
 * Get a bridge client, resolving simulator name if needed.
 */
async function getBridgeClient(
  simulator?: string,
  port?: number,
  token?: string
): Promise<{ success: boolean; client?: BridgeClient; udid?: string; error?: string }> {
  let udid = simulator;

  // Resolve simulator name to UDID if provided and not already a UDID
  if (udid && !isUdid(udid)) {
    const resolveResult = await resolveSimulatorName(udid);
    if (!resolveResult.success) {
      return { success: false, error: resolveResult.error };
    }
    udid = resolveResult.udid;
  }

  // Get bridge client
  const clientResult = await (udid
    ? getCachedBridgeClient(udid, { port, token })
    : createBridgeClient(undefined, { port, token }));

  if (!clientResult.success || !clientResult.data) {
    return {
      success: false,
      error: clientResult.error || 'Failed to connect to bridge',
    };
  }

  return { success: true, client: clientResult.data, udid };
}

/**
 * Format a bridge connection error.
 */
function formatBridgeError(error: string): string {
  return `## Bridge Connection Failed

**Error**: ${error}

### Troubleshooting
- Ensure the app is running with MaestroBridge enabled
- Check the bridge is started in the app: \`MaestroBridge.shared.start()\`
- Try specifying the port: \`--port 9876\`
- Check simulator logs for "MaestroBridge: Token:"
`;
}

// =============================================================================
// /ios.bridge.state Command
// =============================================================================

/**
 * Parse /ios.bridge.state command arguments.
 */
export function parseBridgeStateArgs(commandText: string): BridgeStateCommandArgs {
  const args: BridgeStateCommandArgs = {};

  // Remove the command prefix
  const argsText = commandText.replace(/^\/ios\.bridge\.state\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  const tokens = tokenize(argsText);
  const positional: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '--json') {
      args.json = true;
    } else if (token === '--simulator' || token === '-s') {
      if (i + 1 < tokens.length) {
        args.simulator = tokens[++i];
      }
    } else if (token === '--port' || token === '-p') {
      if (i + 1 < tokens.length) {
        const portStr = tokens[++i];
        const port = parseInt(portStr, 10);
        if (!isNaN(port) && port > 0) {
          args.port = port;
        }
      }
    } else if (token === '--token' || token === '-t') {
      if (i + 1 < tokens.length) {
        args.token = tokens[++i];
      }
    } else if (!token.startsWith('-')) {
      positional.push(token);
    }

    i++;
  }

  // First positional argument is the key
  if (positional.length > 0) {
    args.key = positional[0];
  }

  return args;
}

/**
 * Format app state for human-readable output.
 */
function formatAppState(state: AppState, key?: string): string {
  if (key) {
    // Return just the specific key
    if (key in state.customState) {
      return `## App State: ${key}

\`\`\`json
${JSON.stringify(state.customState[key], null, 2)}
\`\`\`
`;
    } else if (key in state.featureFlags) {
      const flag = state.featureFlags[key];
      const enabled = typeof flag === 'boolean' ? flag : flag.enabled;
      const variant = typeof flag === 'object' && flag.variant ? ` (variant: ${flag.variant})` : '';
      return `## Feature Flag: ${key}

**Status**: ${enabled ? '✓ Enabled' : '✗ Disabled'}${variant}
`;
    } else {
      return `## App State: ${key}

**Error**: Key "${key}" not found in app state.

### Available Keys
**Custom State**: ${Object.keys(state.customState).join(', ') || '(none)'}
**Feature Flags**: ${Object.keys(state.featureFlags).join(', ') || '(none)'}
`;
    }
  }

  // Format full state
  let output = `## App Internal State

**Timestamp**: ${state.timestamp}

### Navigation
**Current View Controller**: ${state.currentViewController}
**Stack Depth**: ${state.viewControllerStack.length}

### View Controller Hierarchy
`;

  state.viewControllerStack.forEach((vc, idx) => {
    const isCurrent = idx === state.viewControllerStack.length - 1;
    output += `${idx + 1}. ${vc}${isCurrent ? ' (current)' : ''}\n`;
  });

  // Custom state
  const customKeys = Object.keys(state.customState);
  if (customKeys.length > 0) {
    output += `\n### Custom State\n`;
    for (const key of customKeys) {
      const value = state.customState[key];
      if (typeof value === 'object') {
        output += `- **${key}**: \`${JSON.stringify(value)}\`\n`;
      } else {
        output += `- **${key}**: ${value}\n`;
      }
    }
  }

  // Feature flags
  const flagKeys = Object.keys(state.featureFlags);
  if (flagKeys.length > 0) {
    output += `\n### Feature Flags\n`;
    for (const key of flagKeys) {
      const flag = state.featureFlags[key];
      const enabled = typeof flag === 'boolean' ? flag : flag.enabled;
      const variant = typeof flag === 'object' && flag.variant ? ` (variant: ${flag.variant})` : '';
      output += `- **${key}**: ${enabled ? '✓ enabled' : '✗ disabled'}${variant}\n`;
    }
  }

  return output;
}

/**
 * Execute the /ios.bridge.state command.
 */
export async function executeBridgeStateCommand(
  commandText: string,
  _sessionId: string
): Promise<BridgeCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing bridge.state command: ${commandText}`);

  const args = parseBridgeStateArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  // Get bridge client
  const clientResult = await getBridgeClient(args.simulator, args.port, args.token);
  if (!clientResult.success || !clientResult.client) {
    return {
      success: false,
      output: formatBridgeError(clientResult.error || 'Connection failed'),
      error: clientResult.error,
    };
  }

  // Fetch state
  const stateResult = await clientResult.client.getState();
  if (!stateResult.success || !stateResult.data) {
    return {
      success: false,
      output: formatBridgeError(stateResult.error || 'Failed to get app state'),
      error: stateResult.error,
    };
  }

  const state = stateResult.data;

  // Format output
  if (args.json) {
    if (args.key) {
      const keyData = state.customState[args.key] ?? state.featureFlags[args.key];
      return {
        success: true,
        output: `\`\`\`json\n${JSON.stringify(keyData, null, 2)}\n\`\`\``,
        data: keyData,
      };
    }
    return {
      success: true,
      output: `\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``,
      data: state,
    };
  }

  return {
    success: true,
    output: formatAppState(state, args.key),
    data: state,
  };
}

// =============================================================================
// /ios.bridge.route Command
// =============================================================================

/**
 * Parse /ios.bridge.route command arguments.
 */
export function parseBridgeRouteArgs(commandText: string): BridgeRouteCommandArgs {
  const args: BridgeRouteCommandArgs = {};

  const argsText = commandText.replace(/^\/ios\.bridge\.route\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  const tokens = tokenize(argsText);

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '--stack') {
      args.stack = true;
    } else if (token === '--simulator' || token === '-s') {
      if (i + 1 < tokens.length) {
        args.simulator = tokens[++i];
      }
    } else if (token === '--port' || token === '-p') {
      if (i + 1 < tokens.length) {
        const portStr = tokens[++i];
        const port = parseInt(portStr, 10);
        if (!isNaN(port) && port > 0) {
          args.port = port;
        }
      }
    } else if (token === '--token' || token === '-t') {
      if (i + 1 < tokens.length) {
        args.token = tokens[++i];
      }
    }

    i++;
  }

  return args;
}

/**
 * Format route info for human-readable output.
 */
function formatRouteInfo(route: RouteInfo, showStack: boolean): string {
  let output = `## Navigation State

**Current Route**: ${route.currentRoute}
**Can Go Back**: ${route.canGoBack ? 'Yes' : 'No'}
**Modal**: ${route.presentedModally ? 'Yes' : 'No'}
`;

  if (showStack && route.stack.length > 0) {
    output += `\n### Navigation Stack\n`;
    route.stack.forEach((entry, idx) => {
      const isCurrent = idx === route.stack.length - 1;
      output += `${idx + 1}. **${entry.title}** → \`${entry.route}\`${isCurrent ? ' (current)' : ''}\n`;
    });
  }

  return output;
}

/**
 * Execute the /ios.bridge.route command.
 */
export async function executeBridgeRouteCommand(
  commandText: string,
  _sessionId: string
): Promise<BridgeCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing bridge.route command: ${commandText}`);

  const args = parseBridgeRouteArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  // Get bridge client
  const clientResult = await getBridgeClient(args.simulator, args.port, args.token);
  if (!clientResult.success || !clientResult.client) {
    return {
      success: false,
      output: formatBridgeError(clientResult.error || 'Connection failed'),
      error: clientResult.error,
    };
  }

  // Fetch route - use full stack endpoint if --stack
  const routeResult = args.stack
    ? await clientResult.client.getRouteStack()
    : await clientResult.client.getRoute();

  if (!routeResult.success || !routeResult.data) {
    return {
      success: false,
      output: formatBridgeError(routeResult.error || 'Failed to get route info'),
      error: routeResult.error,
    };
  }

  return {
    success: true,
    output: formatRouteInfo(routeResult.data, args.stack || false),
    data: routeResult.data,
  };
}

// =============================================================================
// /ios.bridge.network Command
// =============================================================================

/**
 * Parse /ios.bridge.network command arguments.
 */
export function parseBridgeNetworkArgs(commandText: string): BridgeNetworkCommandArgs {
  const args: BridgeNetworkCommandArgs = {};

  const argsText = commandText.replace(/^\/ios\.bridge\.network\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  const tokens = tokenize(argsText);

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '--last' || token === '-l') {
      if (i + 1 < tokens.length) {
        const numStr = tokens[++i];
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > 0) {
          args.last = num;
        }
      }
    } else if (token === '--errors') {
      args.errors = true;
    } else if (token === '--simulator' || token === '-s') {
      if (i + 1 < tokens.length) {
        args.simulator = tokens[++i];
      }
    } else if (token === '--port' || token === '-p') {
      if (i + 1 < tokens.length) {
        const portStr = tokens[++i];
        const port = parseInt(portStr, 10);
        if (!isNaN(port) && port > 0) {
          args.port = port;
        }
      }
    } else if (token === '--token' || token === '-t') {
      if (i + 1 < tokens.length) {
        args.token = tokens[++i];
      }
    }

    i++;
  }

  return args;
}

/**
 * Format network log for human-readable output.
 */
function formatNetworkLog(log: NetworkLog): string {
  let output = `## Network Requests

**Total Requests**: ${log.count}
**Errors**: ${log.errors}
`;

  if (log.requests.length === 0) {
    output += `\n*No network requests recorded.*\n`;
    return output;
  }

  output += `\n### Recent Requests\n`;
  log.requests.forEach((req: NetworkRequestEntry) => {
    const statusEmoji = req.status >= 200 && req.status < 300 ? '✓' : req.status >= 400 ? '✗' : '⚠';
    const time = req.timestamp.split('T')[1]?.split('.')[0] || req.timestamp;
    output += `- ${statusEmoji} **${req.method}** \`${req.url}\` → ${req.status} (${req.duration}ms) [${time}]\n`;
  });

  return output;
}

/**
 * Execute the /ios.bridge.network command.
 */
export async function executeBridgeNetworkCommand(
  commandText: string,
  _sessionId: string
): Promise<BridgeCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing bridge.network command: ${commandText}`);

  const args = parseBridgeNetworkArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  // Get bridge client
  const clientResult = await getBridgeClient(args.simulator, args.port, args.token);
  if (!clientResult.success || !clientResult.client) {
    return {
      success: false,
      output: formatBridgeError(clientResult.error || 'Connection failed'),
      error: clientResult.error,
    };
  }

  // Fetch network log
  const networkResult = await clientResult.client.getNetwork({
    limit: args.last,
    errorsOnly: args.errors,
  });

  if (!networkResult.success || !networkResult.data) {
    return {
      success: false,
      output: formatBridgeError(networkResult.error || 'Failed to get network log'),
      error: networkResult.error,
    };
  }

  return {
    success: true,
    output: formatNetworkLog(networkResult.data),
    data: networkResult.data,
  };
}

// =============================================================================
// /ios.bridge.analytics Command
// =============================================================================

/**
 * Parse /ios.bridge.analytics command arguments.
 */
export function parseBridgeAnalyticsArgs(commandText: string): BridgeAnalyticsCommandArgs {
  const args: BridgeAnalyticsCommandArgs = {};

  const argsText = commandText.replace(/^\/ios\.bridge\.analytics\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  const tokens = tokenize(argsText);

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '--filter' || token === '-f') {
      if (i + 1 < tokens.length) {
        args.filter = tokens[++i];
      }
    } else if (token === '--last' || token === '-l') {
      if (i + 1 < tokens.length) {
        const numStr = tokens[++i];
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > 0) {
          args.last = num;
        }
      }
    } else if (token === '--simulator' || token === '-s') {
      if (i + 1 < tokens.length) {
        args.simulator = tokens[++i];
      }
    } else if (token === '--port' || token === '-p') {
      if (i + 1 < tokens.length) {
        const portStr = tokens[++i];
        const port = parseInt(portStr, 10);
        if (!isNaN(port) && port > 0) {
          args.port = port;
        }
      }
    } else if (token === '--token' || token === '-t') {
      if (i + 1 < tokens.length) {
        args.token = tokens[++i];
      }
    }

    i++;
  }

  return args;
}

/**
 * Format analytics log for human-readable output.
 */
function formatAnalyticsLog(log: AnalyticsLog): string {
  let output = `## Analytics Events

**Total Events**: ${log.count}
`;

  if (log.events.length === 0) {
    output += `\n*No analytics events recorded.*\n`;
    return output;
  }

  output += `\n### Recent Events\n`;
  log.events.forEach((event) => {
    const time = event.timestamp.split('T')[1]?.split('.')[0] || event.timestamp;
    const propsStr = Object.keys(event.properties).length > 0
      ? ` - ${JSON.stringify(event.properties)}`
      : '';
    output += `- **${event.name}**${propsStr} [${time}]\n`;
  });

  return output;
}

/**
 * Execute the /ios.bridge.analytics command.
 */
export async function executeBridgeAnalyticsCommand(
  commandText: string,
  _sessionId: string
): Promise<BridgeCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing bridge.analytics command: ${commandText}`);

  const args = parseBridgeAnalyticsArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  // Get bridge client
  const clientResult = await getBridgeClient(args.simulator, args.port, args.token);
  if (!clientResult.success || !clientResult.client) {
    return {
      success: false,
      output: formatBridgeError(clientResult.error || 'Connection failed'),
      error: clientResult.error,
    };
  }

  // Fetch analytics log
  const analyticsResult = await clientResult.client.getAnalytics({
    filter: args.filter,
    limit: args.last,
  });

  if (!analyticsResult.success || !analyticsResult.data) {
    return {
      success: false,
      output: formatBridgeError(analyticsResult.error || 'Failed to get analytics'),
      error: analyticsResult.error,
    };
  }

  return {
    success: true,
    output: formatAnalyticsLog(analyticsResult.data),
    data: analyticsResult.data,
  };
}

// =============================================================================
// /ios.bridge.flags Command
// =============================================================================

/**
 * Parse /ios.bridge.flags command arguments.
 */
export function parseBridgeFlagsArgs(commandText: string): BridgeFlagsCommandArgs {
  const args: BridgeFlagsCommandArgs = {};

  const argsText = commandText.replace(/^\/ios\.bridge\.flags\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  const tokens = tokenize(argsText);
  const positional: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '--simulator' || token === '-s') {
      if (i + 1 < tokens.length) {
        args.simulator = tokens[++i];
      }
    } else if (token === '--port' || token === '-p') {
      if (i + 1 < tokens.length) {
        const portStr = tokens[++i];
        const port = parseInt(portStr, 10);
        if (!isNaN(port) && port > 0) {
          args.port = port;
        }
      }
    } else if (token === '--token' || token === '-t') {
      if (i + 1 < tokens.length) {
        args.token = tokens[++i];
      }
    } else if (!token.startsWith('-')) {
      positional.push(token);
    }

    i++;
  }

  // First positional argument is the flag name
  if (positional.length > 0) {
    args.name = positional[0];
  }

  return args;
}

/**
 * Format feature flags for human-readable output.
 */
function formatFeatureFlags(flags: FeatureFlags, name?: string): string {
  if (name) {
    const flag = flags.flags[name];
    if (!flag) {
      return `## Feature Flag: ${name}

**Error**: Flag "${name}" not found.

### Available Flags
${Object.keys(flags.flags).map((k) => `- ${k}`).join('\n') || '(none)'}
`;
    }
    const variant = flag.variant ? ` (variant: ${flag.variant})` : '';
    return `## Feature Flag: ${name}

**Status**: ${flag.enabled ? '✓ Enabled' : '✗ Disabled'}${variant}
`;
  }

  let output = `## Feature Flags\n\n`;

  const flagNames = Object.keys(flags.flags);
  if (flagNames.length === 0) {
    output += `*No feature flags registered.*\n`;
    return output;
  }

  flagNames.forEach((flagName) => {
    const flag = flags.flags[flagName];
    const variant = flag.variant ? ` (variant: ${flag.variant})` : '';
    output += `- **${flagName}**: ${flag.enabled ? '✓ enabled' : '✗ disabled'}${variant}\n`;
  });

  return output;
}

/**
 * Execute the /ios.bridge.flags command.
 */
export async function executeBridgeFlagsCommand(
  commandText: string,
  _sessionId: string
): Promise<BridgeCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing bridge.flags command: ${commandText}`);

  const args = parseBridgeFlagsArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  // Get bridge client
  const clientResult = await getBridgeClient(args.simulator, args.port, args.token);
  if (!clientResult.success || !clientResult.client) {
    return {
      success: false,
      output: formatBridgeError(clientResult.error || 'Connection failed'),
      error: clientResult.error,
    };
  }

  // Fetch specific flag or all flags
  if (args.name) {
    const flagResult = await clientResult.client.getFlag(args.name);
    if (!flagResult.success) {
      // Might not exist, try getting all flags
      const allFlagsResult = await clientResult.client.getFlags();
      if (allFlagsResult.success && allFlagsResult.data) {
        return {
          success: true,
          output: formatFeatureFlags(allFlagsResult.data, args.name),
          data: allFlagsResult.data,
        };
      }
      return {
        success: false,
        output: formatBridgeError(flagResult.error || 'Failed to get flag'),
        error: flagResult.error,
      };
    }

    // Convert single flag to FeatureFlags format for formatting
    const singleFlagData: FeatureFlags = {
      flags: { [args.name]: flagResult.data! },
    };
    return {
      success: true,
      output: formatFeatureFlags(singleFlagData, args.name),
      data: flagResult.data,
    };
  }

  const flagsResult = await clientResult.client.getFlags();
  if (!flagsResult.success || !flagsResult.data) {
    return {
      success: false,
      output: formatBridgeError(flagsResult.error || 'Failed to get flags'),
      error: flagsResult.error,
    };
  }

  return {
    success: true,
    output: formatFeatureFlags(flagsResult.data),
    data: flagsResult.data,
  };
}

// =============================================================================
// /ios.bridge.set Command
// =============================================================================

/**
 * Parse /ios.bridge.set command arguments.
 */
export function parseBridgeSetArgs(commandText: string): BridgeSetCommandArgs {
  const args: BridgeSetCommandArgs = {};

  const argsText = commandText.replace(/^\/ios\.bridge\.set\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  const tokens = tokenize(argsText);
  const positional: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '--confirm') {
      args.confirm = true;
    } else if (token === '--simulator' || token === '-s') {
      if (i + 1 < tokens.length) {
        args.simulator = tokens[++i];
      }
    } else if (token === '--port' || token === '-p') {
      if (i + 1 < tokens.length) {
        const portStr = tokens[++i];
        const port = parseInt(portStr, 10);
        if (!isNaN(port) && port > 0) {
          args.port = port;
        }
      }
    } else if (token === '--token' || token === '-t') {
      if (i + 1 < tokens.length) {
        args.token = tokens[++i];
      }
    } else if (!token.startsWith('-')) {
      positional.push(token);
    }

    i++;
  }

  // First positional is key, rest is value
  if (positional.length > 0) {
    args.key = positional[0];
  }
  if (positional.length > 1) {
    args.value = positional.slice(1).join(' ');
  }

  return args;
}

/**
 * Execute the /ios.bridge.set command.
 */
export async function executeBridgeSetCommand(
  commandText: string,
  _sessionId: string
): Promise<BridgeCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing bridge.set command: ${commandText}`);

  const args = parseBridgeSetArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  // Validate required arguments
  if (!args.key) {
    return {
      success: false,
      output: `## Set State Failed

**Error**: Missing required key argument.

### Usage
\`\`\`
/ios.bridge.set <key> <value> [--confirm]
\`\`\`

### Examples
\`\`\`
/ios.bridge.set user.isLoggedIn true --confirm
/ios.bridge.set cart.itemCount 5 --confirm
\`\`\`
`,
      error: 'Missing key argument',
    };
  }

  if (args.value === undefined) {
    return {
      success: false,
      output: `## Set State Failed

**Error**: Missing required value argument.

### Usage
\`\`\`
/ios.bridge.set ${args.key} <value> [--confirm]
\`\`\`
`,
      error: 'Missing value argument',
    };
  }

  // Require confirmation for this dangerous operation
  if (!args.confirm) {
    return {
      success: false,
      output: `## Set State - Confirmation Required

⚠️ **Warning**: Setting app state can cause unexpected behavior.

To confirm this operation, add \`--confirm\`:
\`\`\`
/ios.bridge.set ${args.key} ${args.value} --confirm
\`\`\`

**You are about to set**:
- Key: \`${args.key}\`
- Value: \`${args.value}\`
`,
      error: 'Confirmation required',
    };
  }

  // Get bridge client
  const clientResult = await getBridgeClient(args.simulator, args.port, args.token);
  if (!clientResult.success || !clientResult.client) {
    return {
      success: false,
      output: formatBridgeError(clientResult.error || 'Connection failed'),
      error: clientResult.error,
    };
  }

  // Parse value (try JSON first, then use as string)
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(args.value);
  } catch {
    parsedValue = args.value;
  }

  // Set state
  const setResult = await clientResult.client.setState(args.key, parsedValue);
  if (!setResult.success) {
    return {
      success: false,
      output: `## Set State Failed

**Error**: ${setResult.error || 'Unknown error'}

### Note
The app must explicitly enable state modification in MaestroBridge:
\`\`\`swift
MaestroBridge.shared.enableSetState(token: "your-secret-token")
\`\`\`
`,
      error: setResult.error,
    };
  }

  return {
    success: true,
    output: `## State Updated

**Key**: \`${args.key}\`
**Value**: \`${JSON.stringify(parsedValue)}\`
**Status**: ✓ Success
`,
    data: { key: args.key, value: parsedValue },
  };
}

// =============================================================================
// Command Metadata
// =============================================================================

/**
 * Metadata for the /ios.bridge.state command.
 */
export const bridgeStateCommandMetadata = {
  command: '/ios.bridge.state',
  description: 'Get app internal state from MaestroBridge',
  usage: '/ios.bridge.state [key] [--json]',
  options: [
    {
      name: '--json',
      description: 'Output as raw JSON',
      valueHint: null,
    },
    {
      name: '--simulator, -s',
      description: 'Target simulator name or UDID',
      valueHint: '<name|udid>',
    },
    {
      name: '--port, -p',
      description: 'Bridge port (default: 9876)',
      valueHint: '<port>',
    },
    {
      name: '--token, -t',
      description: 'Bridge authentication token',
      valueHint: '<token>',
    },
  ],
  examples: [
    '/ios.bridge.state',
    '/ios.bridge.state user',
    '/ios.bridge.state --json',
    '/ios.bridge.state cart.items --json',
  ],
};

/**
 * Metadata for the /ios.bridge.route command.
 */
export const bridgeRouteCommandMetadata = {
  command: '/ios.bridge.route',
  description: 'Get navigation state from MaestroBridge',
  usage: '/ios.bridge.route [--stack]',
  options: [
    {
      name: '--stack',
      description: 'Show full navigation stack',
      valueHint: null,
    },
    {
      name: '--simulator, -s',
      description: 'Target simulator name or UDID',
      valueHint: '<name|udid>',
    },
    {
      name: '--port, -p',
      description: 'Bridge port (default: 9876)',
      valueHint: '<port>',
    },
    {
      name: '--token, -t',
      description: 'Bridge authentication token',
      valueHint: '<token>',
    },
  ],
  examples: [
    '/ios.bridge.route',
    '/ios.bridge.route --stack',
  ],
};

/**
 * Metadata for the /ios.bridge.network command.
 */
export const bridgeNetworkCommandMetadata = {
  command: '/ios.bridge.network',
  description: 'Get network request log from MaestroBridge',
  usage: '/ios.bridge.network [--last <n>] [--errors]',
  options: [
    {
      name: '--last, -l',
      description: 'Number of recent requests to show',
      valueHint: '<count>',
    },
    {
      name: '--errors',
      description: 'Show only error requests',
      valueHint: null,
    },
    {
      name: '--simulator, -s',
      description: 'Target simulator name or UDID',
      valueHint: '<name|udid>',
    },
    {
      name: '--port, -p',
      description: 'Bridge port (default: 9876)',
      valueHint: '<port>',
    },
    {
      name: '--token, -t',
      description: 'Bridge authentication token',
      valueHint: '<token>',
    },
  ],
  examples: [
    '/ios.bridge.network',
    '/ios.bridge.network --last 5',
    '/ios.bridge.network --errors',
  ],
};

/**
 * Metadata for the /ios.bridge.analytics command.
 */
export const bridgeAnalyticsCommandMetadata = {
  command: '/ios.bridge.analytics',
  description: 'Get analytics events from MaestroBridge',
  usage: '/ios.bridge.analytics [--filter <term>] [--last <n>]',
  options: [
    {
      name: '--filter, -f',
      description: 'Filter events by name',
      valueHint: '<term>',
    },
    {
      name: '--last, -l',
      description: 'Number of recent events to show',
      valueHint: '<count>',
    },
    {
      name: '--simulator, -s',
      description: 'Target simulator name or UDID',
      valueHint: '<name|udid>',
    },
    {
      name: '--port, -p',
      description: 'Bridge port (default: 9876)',
      valueHint: '<port>',
    },
    {
      name: '--token, -t',
      description: 'Bridge authentication token',
      valueHint: '<token>',
    },
  ],
  examples: [
    '/ios.bridge.analytics',
    '/ios.bridge.analytics --filter checkout',
    '/ios.bridge.analytics --last 10',
  ],
};

/**
 * Metadata for the /ios.bridge.flags command.
 */
export const bridgeFlagsCommandMetadata = {
  command: '/ios.bridge.flags',
  description: 'Get feature flags from MaestroBridge',
  usage: '/ios.bridge.flags [name]',
  options: [
    {
      name: '--simulator, -s',
      description: 'Target simulator name or UDID',
      valueHint: '<name|udid>',
    },
    {
      name: '--port, -p',
      description: 'Bridge port (default: 9876)',
      valueHint: '<port>',
    },
    {
      name: '--token, -t',
      description: 'Bridge authentication token',
      valueHint: '<token>',
    },
  ],
  examples: [
    '/ios.bridge.flags',
    '/ios.bridge.flags newCheckout',
    '/ios.bridge.flags darkMode',
  ],
};

/**
 * Metadata for the /ios.bridge.set command.
 */
export const bridgeSetCommandMetadata = {
  command: '/ios.bridge.set',
  description: 'Set app state via MaestroBridge (requires confirmation)',
  usage: '/ios.bridge.set <key> <value> [--confirm]',
  options: [
    {
      name: '--confirm',
      description: 'Confirm the state change (required)',
      valueHint: null,
    },
    {
      name: '--simulator, -s',
      description: 'Target simulator name or UDID',
      valueHint: '<name|udid>',
    },
    {
      name: '--port, -p',
      description: 'Bridge port (default: 9876)',
      valueHint: '<port>',
    },
    {
      name: '--token, -t',
      description: 'Bridge authentication token',
      valueHint: '<token>',
    },
  ],
  examples: [
    '/ios.bridge.set user.isLoggedIn true --confirm',
    '/ios.bridge.set cart.itemCount 5 --confirm',
  ],
};
