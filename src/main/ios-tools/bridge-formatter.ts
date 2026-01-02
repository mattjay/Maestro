/**
 * iOS Tools - Bridge Formatter
 *
 * Formats MaestroBridge introspection data into agent-friendly output.
 * Produces structured, readable text that AI agents can understand.
 */

import {
  AppState,
  RouteInfo,
  NetworkLog,
  NetworkRequestEntry,
  AnalyticsLog,
  AnalyticsEvent,
  FeatureFlags,
  FeatureFlagEntry,
} from './bridge-client';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for formatting bridge state
 */
export interface BridgeFormatOptions {
  /** Maximum number of network requests to show */
  maxNetworkRequests?: number;
  /** Maximum number of analytics events to show */
  maxAnalyticsEvents?: number;
  /** Show timestamps in output */
  showTimestamps?: boolean;
  /** Include all details vs compact output */
  verbose?: boolean;
}

/**
 * Formatted bridge state output for agents
 */
export interface FormattedBridgeState {
  /** Human-readable summary */
  summary: string;
  /** Detailed sections */
  sections: {
    navigation: string;
    viewControllers: string;
    userState: string;
    featureFlags: string;
    network: string;
    analytics: string;
  };
  /** Full formatted output */
  fullOutput: string;
}

/**
 * Combined introspection data from bridge
 */
export interface CombinedBridgeData {
  state?: AppState;
  route?: RouteInfo;
  network?: NetworkLog;
  analytics?: AnalyticsLog;
  flags?: FeatureFlags;
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: Required<BridgeFormatOptions> = {
  maxNetworkRequests: 10,
  maxAnalyticsEvents: 15,
  showTimestamps: true,
  verbose: false,
};

// =============================================================================
// Main Formatter
// =============================================================================

/**
 * Format combined bridge data for agent consumption.
 * Creates a structured, readable output matching the spec format.
 *
 * @param data - Combined bridge data to format
 * @param options - Formatting options
 * @returns Formatted output
 */
export function formatBridgeStateForAgent(
  data: CombinedBridgeData,
  options: BridgeFormatOptions = {}
): FormattedBridgeState {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const sections = {
    navigation: formatNavigation(data.route, data.state),
    viewControllers: formatViewControllerHierarchy(data.state),
    userState: formatUserState(data.state),
    featureFlags: formatFeatureFlagsSection(data.flags || extractFlags(data.state)),
    network: formatRecentNetwork(data.network, opts.maxNetworkRequests),
    analytics: formatRecentAnalytics(data.analytics, opts.maxAnalyticsEvents),
  };

  const summary = createSummary(data);

  const fullOutput = `
## App Internal State

${summary}

### Navigation
${sections.navigation}

### View Controller Hierarchy
${sections.viewControllers}

### User State
${sections.userState}

### Feature Flags
${sections.featureFlags}

### Recent Network
${sections.network}

### Recent Analytics
${sections.analytics}
`.trim();

  return {
    summary,
    sections,
    fullOutput,
  };
}

// =============================================================================
// Summary
// =============================================================================

/**
 * Create a brief summary of the bridge state
 */
function createSummary(data: CombinedBridgeData): string {
  const parts: string[] = [];

  // Navigation state
  if (data.route) {
    parts.push(`Route: ${data.route.currentRoute}`);
    if (data.route.stack.length > 1) {
      parts.push(`Depth: ${data.route.stack.length}`);
    }
  } else if (data.state?.currentViewController) {
    parts.push(`Screen: ${data.state.currentViewController}`);
  }

  // Network summary
  if (data.network) {
    const errorCount = data.network.errors;
    if (errorCount > 0) {
      parts.push(`Network: ${errorCount} error(s)`);
    } else {
      parts.push(`Network: ${data.network.count} requests`);
    }
  }

  // Analytics summary
  if (data.analytics) {
    parts.push(`Events: ${data.analytics.count}`);
  }

  // Flags summary
  const flags = data.flags || extractFlags(data.state);
  if (flags) {
    const enabledCount = Object.values(flags.flags).filter(
      (f) => typeof f === 'boolean' ? f : f.enabled
    ).length;
    parts.push(`Flags: ${enabledCount}/${Object.keys(flags.flags).length} enabled`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'No bridge data available';
}

// =============================================================================
// Section Formatters
// =============================================================================

/**
 * Format navigation section
 */
export function formatNavigation(
  route?: RouteInfo,
  state?: AppState
): string {
  if (!route && !state) {
    return 'No navigation data available.';
  }

  const lines: string[] = [];

  if (route) {
    lines.push(`Current Route: ${route.currentRoute}`);
    lines.push(`Stack Depth: ${route.stack.length}`);
    lines.push(`Can Go Back: ${route.canGoBack ? 'Yes' : 'No'}`);

    if (route.presentedModally) {
      lines.push('Presented Modally: Yes');
    }
  } else if (state) {
    lines.push(`Current Screen: ${state.currentViewController}`);
    lines.push(`Stack Depth: ${state.viewControllerStack.length}`);
    lines.push(`Can Go Back: ${state.viewControllerStack.length > 1 ? 'Yes' : 'No'}`);
  }

  return lines.join('\n');
}

/**
 * Format view controller hierarchy section
 */
export function formatViewControllerHierarchy(state?: AppState): string {
  if (!state || !state.viewControllerStack || state.viewControllerStack.length === 0) {
    return 'No view controller data available.';
  }

  const lines: string[] = [];

  for (let i = 0; i < state.viewControllerStack.length; i++) {
    const vc = state.viewControllerStack[i];
    const isCurrent = i === state.viewControllerStack.length - 1;
    const marker = isCurrent ? ' (current)' : '';
    lines.push(`${i + 1}. ${vc}${marker}`);
  }

  return lines.join('\n');
}

/**
 * Format user/custom state section
 */
export function formatUserState(state?: AppState): string {
  if (!state || !state.customState || Object.keys(state.customState).length === 0) {
    return 'No custom state registered.';
  }

  const lines: string[] = [];

  for (const [key, value] of Object.entries(state.customState)) {
    if (typeof value === 'object' && value !== null) {
      // Nested object - format each property
      lines.push(`**${key}**:`);
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        lines.push(`- ${subKey}: ${formatValue(subValue)}`);
      }
    } else {
      lines.push(`- ${key}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format feature flags section
 */
export function formatFeatureFlagsSection(
  flags?: FeatureFlags | null
): string {
  if (!flags || Object.keys(flags.flags).length === 0) {
    return 'No feature flags registered.';
  }

  const lines: string[] = [];

  // Sort flags: enabled first, then disabled
  const sortedFlags = Object.entries(flags.flags).sort(([, a], [, b]) => {
    const aEnabled = typeof a === 'boolean' ? a : a.enabled;
    const bEnabled = typeof b === 'boolean' ? b : b.enabled;
    return bEnabled === aEnabled ? 0 : bEnabled ? 1 : -1;
  });

  for (const [name, flag] of sortedFlags) {
    const entry = normalizeFlag(flag);
    const status = entry.enabled ? 'enabled' : 'disabled';
    const variant = entry.variant ? ` (variant ${entry.variant})` : '';
    lines.push(`- ${name}: ${status}${variant}`);
  }

  return lines.join('\n');
}

/**
 * Format recent network requests section
 */
export function formatRecentNetwork(
  network?: NetworkLog,
  maxItems: number = 10
): string {
  if (!network || network.requests.length === 0) {
    return 'No recent network requests.';
  }

  const lines: string[] = [];

  // Show summary
  if (network.errors > 0) {
    lines.push(`**${network.errors} failed request(s) out of ${network.count} total**\n`);
  }

  // Show individual requests (most recent first)
  const requests = network.requests.slice(0, maxItems);

  for (const req of requests) {
    const statusEmoji = getStatusEmoji(req.status);
    const url = formatUrl(req.url);
    lines.push(`- ${statusEmoji} ${req.method} ${url} → ${req.status} (${req.duration}ms)`);
  }

  if (network.requests.length > maxItems) {
    lines.push(`\n... and ${network.requests.length - maxItems} more requests`);
  }

  return lines.join('\n');
}

/**
 * Format recent analytics events section
 */
export function formatRecentAnalytics(
  analytics?: AnalyticsLog,
  maxItems: number = 15
): string {
  if (!analytics || analytics.events.length === 0) {
    return 'No recent analytics events.';
  }

  const lines: string[] = [];

  // Show events (most recent first)
  const events = analytics.events.slice(0, maxItems);

  for (const event of events) {
    const time = formatTime(event.timestamp);
    const props = formatEventProperties(event.properties);
    lines.push(`- ${event.name}${props} (${time})`);
  }

  if (analytics.events.length > maxItems) {
    lines.push(`\n... and ${analytics.events.length - maxItems} more events`);
  }

  return lines.join('\n');
}

// =============================================================================
// Individual Item Formatters
// =============================================================================

/**
 * Format a single network request for detailed output
 */
export function formatNetworkRequest(request: NetworkRequestEntry): string {
  const lines: string[] = [];

  lines.push(`## Network Request: ${request.id}\n`);
  lines.push(`**${request.method}** ${request.url}`);
  lines.push(`Status: ${request.status} ${getStatusText(request.status)}`);
  lines.push(`Duration: ${request.duration}ms`);
  lines.push(`Response Size: ${formatBytes(request.responseSize)}`);
  lines.push(`Timestamp: ${request.timestamp}`);

  if (Object.keys(request.requestHeaders).length > 0) {
    lines.push('\n**Headers:**');
    for (const [key, value] of Object.entries(request.requestHeaders)) {
      lines.push(`- ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a single analytics event for detailed output
 */
export function formatAnalyticsEvent(event: AnalyticsEvent): string {
  const lines: string[] = [];

  lines.push(`## Event: ${event.name}\n`);
  lines.push(`Timestamp: ${event.timestamp}`);

  if (Object.keys(event.properties).length > 0) {
    lines.push('\n**Properties:**');
    for (const [key, value] of Object.entries(event.properties)) {
      lines.push(`- ${key}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format feature flags as a summary string
 */
export function formatFeatureFlagsSummary(flags: FeatureFlags): string {
  const entries = Object.entries(flags.flags);
  const enabled = entries.filter(([, f]) => typeof f === 'boolean' ? f : f.enabled);
  const disabled = entries.filter(([, f]) => typeof f === 'boolean' ? !f : !f.enabled);

  const parts: string[] = [];

  if (enabled.length > 0) {
    parts.push(`Enabled: ${enabled.map(([name]) => name).join(', ')}`);
  }

  if (disabled.length > 0) {
    parts.push(`Disabled: ${disabled.map(([name]) => name).join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Format a single feature flag
 */
export function formatFeatureFlag(name: string, flag: FeatureFlagEntry | boolean): string {
  const entry = normalizeFlag(flag);
  const lines: string[] = [];

  lines.push(`## Feature Flag: ${name}\n`);
  lines.push(`Enabled: ${entry.enabled ? 'Yes' : 'No'}`);

  if (entry.variant) {
    lines.push(`Variant: ${entry.variant}`);
  }

  return lines.join('\n');
}

// =============================================================================
// Route Formatters
// =============================================================================

/**
 * Format route stack for detailed output
 */
export function formatRouteStack(route: RouteInfo): string {
  const lines: string[] = [];

  lines.push('## Navigation Stack\n');

  for (let i = 0; i < route.stack.length; i++) {
    const item = route.stack[i];
    const isCurrent = i === route.stack.length - 1;
    const marker = isCurrent ? ' ← current' : '';
    lines.push(`${i + 1}. ${item.route} (${item.title})${marker}`);
  }

  lines.push('');
  lines.push(`Can Go Back: ${route.canGoBack ? 'Yes' : 'No'}`);
  if (route.presentedModally) {
    lines.push('Presented: Modal');
  }

  return lines.join('\n');
}

// =============================================================================
// JSON Formatter
// =============================================================================

/**
 * Format combined bridge data as JSON
 */
export function formatBridgeStateAsJson(data: CombinedBridgeData): string {
  const serializable = {
    state: data.state
      ? {
          timestamp: data.state.timestamp,
          currentViewController: data.state.currentViewController,
          viewControllerStack: data.state.viewControllerStack,
          customState: data.state.customState,
          featureFlags: data.state.featureFlags,
        }
      : null,
    route: data.route,
    network: data.network
      ? {
          count: data.network.count,
          errors: data.network.errors,
          requests: data.network.requests.slice(0, 10),
        }
      : null,
    analytics: data.analytics
      ? {
          count: data.analytics.count,
          events: data.analytics.events.slice(0, 15),
        }
      : null,
    flags: data.flags,
  };

  return JSON.stringify(serializable, null, 2);
}

// =============================================================================
// Compact Formatter
// =============================================================================

/**
 * Format bridge state in a compact form for quick reference
 */
export function formatBridgeStateCompact(data: CombinedBridgeData): string {
  const lines: string[] = [];

  // Navigation
  if (data.route) {
    lines.push(`Screen: ${data.route.currentRoute}`);
    if (data.route.canGoBack) {
      lines.push(`  (${data.route.stack.length} screens in stack)`);
    }
  } else if (data.state) {
    lines.push(`Screen: ${data.state.currentViewController}`);
  }

  // Key state values
  if (data.state?.customState) {
    const stateEntries = Object.entries(data.state.customState).slice(0, 3);
    if (stateEntries.length > 0) {
      const stateStr = stateEntries
        .map(([k, v]) => `${k}=${formatValueCompact(v)}`)
        .join(', ');
      lines.push(`State: ${stateStr}`);
    }
  }

  // Active feature flags
  const flags = data.flags || extractFlags(data.state);
  if (flags) {
    const enabledFlags = Object.entries(flags.flags)
      .filter(([, f]) => typeof f === 'boolean' ? f : f.enabled)
      .map(([name]) => name)
      .slice(0, 5);

    if (enabledFlags.length > 0) {
      lines.push(`Flags: ${enabledFlags.join(', ')}`);
    }
  }

  // Recent network
  if (data.network && data.network.requests.length > 0) {
    const recent = data.network.requests.slice(0, 3);
    const networkStr = recent
      .map((r) => `${r.method} ${formatUrl(r.url, 20)} ${r.status}`)
      .join(', ');
    lines.push(`Network: ${networkStr}`);
  }

  // Recent analytics
  if (data.analytics && data.analytics.events.length > 0) {
    const recent = data.analytics.events.slice(0, 3);
    const eventsStr = recent.map((e) => e.name).join(', ');
    lines.push(`Events: ${eventsStr}`);
  }

  return lines.join('\n');
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Extract feature flags from app state
 */
function extractFlags(state?: AppState): FeatureFlags | null {
  if (!state?.featureFlags) {
    return null;
  }

  const flags: Record<string, FeatureFlagEntry> = {};

  for (const [name, value] of Object.entries(state.featureFlags)) {
    if (typeof value === 'boolean') {
      flags[name] = { enabled: value };
    } else {
      flags[name] = value;
    }
  }

  return { flags };
}

/**
 * Normalize a flag value to FeatureFlagEntry
 */
function normalizeFlag(flag: boolean | FeatureFlagEntry): FeatureFlagEntry {
  if (typeof flag === 'boolean') {
    return { enabled: flag };
  }
  return flag;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return `"${truncate(value, 50)}"`;
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return `{${Object.keys(value).length} keys}`;
  return String(value);
}

/**
 * Format a value compactly
 */
function formatValueCompact(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return truncate(value, 15);
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === 'object') {
    // Try to extract a meaningful summary
    const obj = value as Record<string, unknown>;
    if ('isLoggedIn' in obj) return obj.isLoggedIn ? 'logged-in' : 'logged-out';
    if ('count' in obj) return `count=${obj.count}`;
    if ('itemCount' in obj) return `${obj.itemCount} items`;
    return `{...}`;
  }
  return '?';
}

/**
 * Format a URL, optionally truncating
 */
function formatUrl(url: string, maxLength?: number): string {
  // Try to extract just the path
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    const result = path.length > 1 ? path : url;
    return maxLength ? truncate(result, maxLength) : result;
  } catch {
    return maxLength ? truncate(url, maxLength) : url;
  }
}

/**
 * Format timestamp as time only
 */
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

/**
 * Format event properties for inline display
 */
function formatEventProperties(props: Record<string, unknown>): string {
  const entries = Object.entries(props);
  if (entries.length === 0) return '';

  // Show up to 2 key properties inline
  const inline = entries
    .slice(0, 2)
    .map(([k, v]) => `${k}=${formatValueCompact(v)}`)
    .join(', ');

  return `: ${inline}`;
}

/**
 * Get emoji for HTTP status code
 */
function getStatusEmoji(status: number): string {
  if (status >= 200 && status < 300) return '✓';
  if (status >= 400 && status < 500) return '⚠';
  if (status >= 500) return '✗';
  return '○';
}

/**
 * Get text description for HTTP status code
 */
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  return statusTexts[status] || '';
}

/**
 * Format bytes as human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Truncate a string to a maximum length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
