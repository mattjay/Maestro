/**
 * iOS Tools - State Verification
 *
 * Utilities for capturing and comparing app state across UI and internal bridge data.
 * Enables agents to confirm that both UI AND internal state have changed after actions.
 */

import { IOSResult } from './types';
import {
  BridgeClient,
  RouteInfo,
  AnalyticsLog,
} from './bridge-client';
import { logger } from '../utils/logger';

const LOG_CONTEXT = '[iOS-StateVerify]';

// =============================================================================
// Types
// =============================================================================

/**
 * A snapshot of app state at a point in time
 */
export interface AppStateSnapshot {
  /** Timestamp when snapshot was taken */
  timestamp: Date;
  /** Current screen/view controller */
  currentScreen: string;
  /** Navigation stack */
  navigationStack: string[];
  /** Current route (if using routing) */
  currentRoute?: string;
  /** Route stack (if using routing) */
  routeStack?: Array<{ route: string; title: string }>;
  /** Custom state keys and their values */
  customState: Record<string, unknown>;
  /** Feature flags */
  featureFlags: Record<string, boolean | { enabled: boolean; variant?: string }>;
  /** Recent analytics event names (for quick comparison) */
  recentEventNames: string[];
  /** Analytics event count */
  analyticsEventCount: number;
}

/**
 * Changes detected between two state snapshots
 */
export interface StateChanges {
  /** Whether any changes were detected */
  hasChanges: boolean;
  /** UI-level changes */
  ui: {
    /** Screen changed */
    screenChanged: boolean;
    /** Previous screen */
    previousScreen?: string;
    /** Current screen */
    currentScreen?: string;
    /** Navigation stack changed */
    navigationChanged: boolean;
    /** Route changed */
    routeChanged: boolean;
    /** Previous route */
    previousRoute?: string;
    /** Current route */
    currentRoute?: string;
  };
  /** Internal state changes */
  internal: {
    /** Custom state keys that changed */
    changedKeys: string[];
    /** Keys that were added */
    addedKeys: string[];
    /** Keys that were removed */
    removedKeys: string[];
    /** Feature flags that changed */
    changedFlags: string[];
    /** Detailed changes for each key */
    keyChanges: Array<{
      key: string;
      type: 'added' | 'removed' | 'modified';
      oldValue?: unknown;
      newValue?: unknown;
    }>;
  };
  /** Analytics events fired between snapshots */
  analytics: {
    /** New events since previous snapshot */
    newEvents: string[];
    /** Event count change */
    eventCountDelta: number;
  };
}

/**
 * Result of a state change verification
 */
export interface StateVerificationResult {
  /** Whether verification passed */
  passed: boolean;
  /** Human-readable summary */
  summary: string;
  /** Detailed changes detected */
  changes: StateChanges;
  /** Before snapshot */
  before: AppStateSnapshot;
  /** After snapshot */
  after: AppStateSnapshot;
  /** What was expected vs found */
  expectations?: {
    /** Expected changes that were found */
    matched: string[];
    /** Expected changes that were not found */
    missing: string[];
    /** Unexpected changes found */
    unexpected: string[];
  };
}

/**
 * Options for state verification
 */
export interface StateVerificationOptions {
  /** Require screen/navigation change */
  expectScreenChange?: boolean;
  /** Require route change */
  expectRouteChange?: boolean;
  /** Expect specific keys to change */
  expectKeysChanged?: string[];
  /** Expect specific keys to have specific values */
  expectKeyValues?: Record<string, unknown>;
  /** Expect specific analytics events */
  expectEvents?: string[];
  /** Expect specific flags to change */
  expectFlagsChanged?: string[];
}

// =============================================================================
// Snapshot Capture
// =============================================================================

/**
 * Capture a snapshot of the current app state from the bridge.
 *
 * @param client - Connected bridge client
 * @returns Snapshot of app state
 */
export async function captureStateSnapshot(
  client: BridgeClient
): Promise<IOSResult<AppStateSnapshot>> {
  logger.debug(`${LOG_CONTEXT} Capturing state snapshot...`);

  // Fetch state in parallel
  const [stateResult, routeResult, analyticsResult] = await Promise.all([
    client.getState(),
    client.getRoute().catch(() => ({ success: false, data: undefined })),
    client.getAnalytics({ limit: 20 }).catch(() => ({ success: false, data: undefined })),
  ]);

  if (!stateResult.success || !stateResult.data) {
    return {
      success: false,
      error: stateResult.error || 'Failed to get app state',
      errorCode: 'COMMAND_FAILED',
    };
  }

  const state = stateResult.data;
  const route = routeResult.success ? (routeResult as IOSResult<RouteInfo>).data : undefined;
  const analytics = analyticsResult.success ? (analyticsResult as IOSResult<AnalyticsLog>).data : undefined;

  const snapshot: AppStateSnapshot = {
    timestamp: new Date(),
    currentScreen: state.currentViewController,
    navigationStack: state.viewControllerStack,
    currentRoute: route?.currentRoute,
    routeStack: route?.stack,
    customState: state.customState || {},
    featureFlags: state.featureFlags || {},
    recentEventNames: analytics?.events?.map(e => e.name) || [],
    analyticsEventCount: analytics?.count || 0,
  };

  logger.debug(`${LOG_CONTEXT} Snapshot captured: screen=${snapshot.currentScreen}, route=${snapshot.currentRoute}`);

  return {
    success: true,
    data: snapshot,
  };
}

// =============================================================================
// State Comparison
// =============================================================================

/**
 * Compare two state snapshots and identify changes.
 *
 * @param before - State before action
 * @param after - State after action
 * @returns Detected changes
 */
export function compareStateSnapshots(
  before: AppStateSnapshot,
  after: AppStateSnapshot
): StateChanges {
  // UI changes
  const screenChanged = before.currentScreen !== after.currentScreen;
  const navigationChanged = !arraysEqual(before.navigationStack, after.navigationStack);
  const routeChanged = before.currentRoute !== after.currentRoute;

  // Custom state changes
  const beforeKeys = new Set(Object.keys(before.customState));
  const afterKeys = new Set(Object.keys(after.customState));

  const addedKeys = [...afterKeys].filter(k => !beforeKeys.has(k));
  const removedKeys = [...beforeKeys].filter(k => !afterKeys.has(k));
  const commonKeys = [...beforeKeys].filter(k => afterKeys.has(k));
  const changedKeys = commonKeys.filter(
    k => !deepEqual(before.customState[k], after.customState[k])
  );

  const keyChanges = [
    ...addedKeys.map(key => ({
      key,
      type: 'added' as const,
      newValue: after.customState[key],
    })),
    ...removedKeys.map(key => ({
      key,
      type: 'removed' as const,
      oldValue: before.customState[key],
    })),
    ...changedKeys.map(key => ({
      key,
      type: 'modified' as const,
      oldValue: before.customState[key],
      newValue: after.customState[key],
    })),
  ];

  // Feature flag changes
  const beforeFlagKeys = new Set(Object.keys(before.featureFlags));
  const afterFlagKeys = new Set(Object.keys(after.featureFlags));
  const allFlagKeys = new Set([...beforeFlagKeys, ...afterFlagKeys]);
  const changedFlags = [...allFlagKeys].filter(k => {
    const beforeFlag = before.featureFlags[k];
    const afterFlag = after.featureFlags[k];
    return !deepEqual(beforeFlag, afterFlag);
  });

  // Analytics changes
  const newEvents = after.recentEventNames.filter(
    e => !before.recentEventNames.includes(e)
  );
  const eventCountDelta = after.analyticsEventCount - before.analyticsEventCount;

  const hasChanges =
    screenChanged ||
    navigationChanged ||
    routeChanged ||
    addedKeys.length > 0 ||
    removedKeys.length > 0 ||
    changedKeys.length > 0 ||
    changedFlags.length > 0 ||
    newEvents.length > 0;

  return {
    hasChanges,
    ui: {
      screenChanged,
      previousScreen: screenChanged ? before.currentScreen : undefined,
      currentScreen: screenChanged ? after.currentScreen : undefined,
      navigationChanged,
      routeChanged,
      previousRoute: routeChanged ? before.currentRoute : undefined,
      currentRoute: routeChanged ? after.currentRoute : undefined,
    },
    internal: {
      changedKeys,
      addedKeys,
      removedKeys,
      changedFlags,
      keyChanges,
    },
    analytics: {
      newEvents,
      eventCountDelta,
    },
  };
}

// =============================================================================
// State Verification
// =============================================================================

/**
 * Verify that expected state changes occurred.
 *
 * @param before - State before action
 * @param after - State after action
 * @param options - What changes are expected
 * @returns Verification result
 */
export function verifyStateChanges(
  before: AppStateSnapshot,
  after: AppStateSnapshot,
  options: StateVerificationOptions = {}
): StateVerificationResult {
  const changes = compareStateSnapshots(before, after);

  const matched: string[] = [];
  const missing: string[] = [];
  const unexpected: string[] = [];

  // Check screen change expectation
  if (options.expectScreenChange !== undefined) {
    if (options.expectScreenChange && changes.ui.screenChanged) {
      matched.push(`Screen changed from "${changes.ui.previousScreen}" to "${changes.ui.currentScreen}"`);
    } else if (options.expectScreenChange && !changes.ui.screenChanged) {
      missing.push('Expected screen change but screen remained the same');
    } else if (!options.expectScreenChange && changes.ui.screenChanged) {
      unexpected.push(`Screen unexpectedly changed from "${changes.ui.previousScreen}" to "${changes.ui.currentScreen}"`);
    }
  }

  // Check route change expectation
  if (options.expectRouteChange !== undefined) {
    if (options.expectRouteChange && changes.ui.routeChanged) {
      matched.push(`Route changed from "${changes.ui.previousRoute}" to "${changes.ui.currentRoute}"`);
    } else if (options.expectRouteChange && !changes.ui.routeChanged) {
      missing.push('Expected route change but route remained the same');
    } else if (!options.expectRouteChange && changes.ui.routeChanged) {
      unexpected.push(`Route unexpectedly changed from "${changes.ui.previousRoute}" to "${changes.ui.currentRoute}"`);
    }
  }

  // Check expected key changes
  if (options.expectKeysChanged && options.expectKeysChanged.length > 0) {
    const allChangedKeys = new Set([
      ...changes.internal.changedKeys,
      ...changes.internal.addedKeys,
      ...changes.internal.removedKeys,
    ]);

    for (const key of options.expectKeysChanged) {
      if (allChangedKeys.has(key)) {
        const change = changes.internal.keyChanges.find(c => c.key === key);
        if (change) {
          matched.push(`Key "${key}" ${change.type}: ${JSON.stringify(change.oldValue)} -> ${JSON.stringify(change.newValue)}`);
        } else {
          matched.push(`Key "${key}" changed`);
        }
      } else {
        missing.push(`Expected key "${key}" to change but it remained the same`);
      }
    }
  }

  // Check expected key values
  if (options.expectKeyValues) {
    for (const [key, expectedValue] of Object.entries(options.expectKeyValues)) {
      const actualValue = after.customState[key];
      if (deepEqual(actualValue, expectedValue)) {
        matched.push(`Key "${key}" has expected value: ${JSON.stringify(expectedValue)}`);
      } else {
        missing.push(`Expected key "${key}" to be ${JSON.stringify(expectedValue)} but was ${JSON.stringify(actualValue)}`);
      }
    }
  }

  // Check expected analytics events
  if (options.expectEvents && options.expectEvents.length > 0) {
    for (const eventName of options.expectEvents) {
      if (changes.analytics.newEvents.includes(eventName)) {
        matched.push(`Analytics event "${eventName}" was fired`);
      } else {
        missing.push(`Expected analytics event "${eventName}" was not fired`);
      }
    }
  }

  // Check expected flag changes
  if (options.expectFlagsChanged && options.expectFlagsChanged.length > 0) {
    for (const flag of options.expectFlagsChanged) {
      if (changes.internal.changedFlags.includes(flag)) {
        matched.push(`Feature flag "${flag}" changed`);
      } else {
        missing.push(`Expected feature flag "${flag}" to change but it remained the same`);
      }
    }
  }

  const passed = missing.length === 0;

  // Build summary
  let summary = '';
  if (passed) {
    summary = changes.hasChanges
      ? 'State verification passed with changes detected'
      : 'State verification passed (no changes detected)';
  } else {
    summary = `State verification failed: ${missing.length} expected change(s) not found`;
  }

  return {
    passed,
    summary,
    changes,
    before,
    after,
    expectations: matched.length > 0 || missing.length > 0 || unexpected.length > 0
      ? { matched, missing, unexpected }
      : undefined,
  };
}

// =============================================================================
// High-Level API
// =============================================================================

/**
 * Capture a before snapshot, execute an action, then verify state changes.
 *
 * @param client - Connected bridge client
 * @param action - Action to execute between snapshots
 * @param options - What changes are expected
 * @returns Verification result
 */
export async function verifyActionChangesState(
  client: BridgeClient,
  action: () => Promise<void>,
  options: StateVerificationOptions = {}
): Promise<IOSResult<StateVerificationResult>> {
  logger.info(`${LOG_CONTEXT} Starting state verification...`);

  // Capture before state
  const beforeResult = await captureStateSnapshot(client);
  if (!beforeResult.success || !beforeResult.data) {
    return {
      success: false,
      error: `Failed to capture before state: ${beforeResult.error}`,
      errorCode: beforeResult.errorCode,
    };
  }
  const before = beforeResult.data;

  // Execute the action
  logger.debug(`${LOG_CONTEXT} Executing action...`);
  try {
    await action();
  } catch (e) {
    return {
      success: false,
      error: `Action failed: ${e instanceof Error ? e.message : String(e)}`,
      errorCode: 'COMMAND_FAILED',
    };
  }

  // Small delay to let state settle
  await new Promise(resolve => setTimeout(resolve, 100));

  // Capture after state
  const afterResult = await captureStateSnapshot(client);
  if (!afterResult.success || !afterResult.data) {
    return {
      success: false,
      error: `Failed to capture after state: ${afterResult.error}`,
      errorCode: afterResult.errorCode,
    };
  }
  const after = afterResult.data;

  // Verify changes
  const result = verifyStateChanges(before, after, options);

  logger.info(`${LOG_CONTEXT} State verification ${result.passed ? 'passed' : 'failed'}: ${result.summary}`);

  return {
    success: true,
    data: result,
  };
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format state changes for agent-friendly output.
 *
 * @param changes - Detected state changes
 * @returns Formatted string
 */
export function formatStateChanges(changes: StateChanges): string {
  const lines: string[] = [];

  lines.push('## State Changes Detected\n');

  // UI Changes
  lines.push('### UI Changes');
  if (changes.ui.screenChanged || changes.ui.navigationChanged || changes.ui.routeChanged) {
    if (changes.ui.screenChanged) {
      lines.push(`- **Screen**: ${changes.ui.previousScreen} → ${changes.ui.currentScreen}`);
    }
    if (changes.ui.routeChanged) {
      lines.push(`- **Route**: ${changes.ui.previousRoute || '(none)'} → ${changes.ui.currentRoute}`);
    }
    if (changes.ui.navigationChanged) {
      lines.push('- **Navigation stack**: Modified');
    }
  } else {
    lines.push('*No UI changes detected*');
  }

  // Internal State Changes
  lines.push('\n### Internal State Changes');
  if (changes.internal.keyChanges.length > 0 || changes.internal.changedFlags.length > 0) {
    for (const change of changes.internal.keyChanges) {
      const emoji = change.type === 'added' ? '➕' : change.type === 'removed' ? '➖' : '✏️';
      if (change.type === 'modified') {
        lines.push(`- ${emoji} **${change.key}**: ${formatValue(change.oldValue)} → ${formatValue(change.newValue)}`);
      } else if (change.type === 'added') {
        lines.push(`- ${emoji} **${change.key}**: ${formatValue(change.newValue)} (added)`);
      } else {
        lines.push(`- ${emoji} **${change.key}**: ${formatValue(change.oldValue)} (removed)`);
      }
    }
    for (const flag of changes.internal.changedFlags) {
      lines.push(`- 🚩 **${flag}**: Flag changed`);
    }
  } else {
    lines.push('*No internal state changes detected*');
  }

  // Analytics
  lines.push('\n### Analytics Events');
  if (changes.analytics.newEvents.length > 0) {
    for (const event of changes.analytics.newEvents) {
      lines.push(`- 📊 \`${event}\``);
    }
    if (changes.analytics.eventCountDelta > changes.analytics.newEvents.length) {
      lines.push(`\n*Plus ${changes.analytics.eventCountDelta - changes.analytics.newEvents.length} more event(s)*`);
    }
  } else {
    lines.push('*No new analytics events*');
  }

  return lines.join('\n');
}

/**
 * Format a verification result for agent-friendly output.
 *
 * @param result - Verification result
 * @returns Formatted string
 */
export function formatVerificationResult(result: StateVerificationResult): string {
  const lines: string[] = [];

  const statusIcon = result.passed ? '✅' : '❌';
  lines.push(`## State Verification: ${statusIcon} ${result.passed ? 'PASSED' : 'FAILED'}\n`);
  lines.push(result.summary);
  lines.push('');

  if (result.expectations) {
    if (result.expectations.matched.length > 0) {
      lines.push('### ✓ Matched Expectations');
      for (const m of result.expectations.matched) {
        lines.push(`- ${m}`);
      }
      lines.push('');
    }

    if (result.expectations.missing.length > 0) {
      lines.push('### ✗ Missing Expectations');
      for (const m of result.expectations.missing) {
        lines.push(`- ${m}`);
      }
      lines.push('');
    }

    if (result.expectations.unexpected.length > 0) {
      lines.push('### ⚠ Unexpected Changes');
      for (const u of result.expectations.unexpected) {
        lines.push(`- ${u}`);
      }
      lines.push('');
    }
  }

  // Include the raw changes
  lines.push(formatStateChanges(result.changes));

  return lines.join('\n');
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if two arrays are equal.
 */
function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!deepEqual(a[i], b[i])) return false;
  }
  return true;
}

/**
 * Deep equality check.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    return arraysEqual(a, b);
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!bKeys.includes(key)) return false;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }

    return true;
  }

  return false;
}

/**
 * Format a value for display.
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return `"${value.length > 50 ? value.slice(0, 47) + '...' : value}"`;
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
