/**
 * iOS Tools - Telemetry Module
 *
 * Opt-in telemetry for tracking iOS development tool usage patterns.
 * All data is anonymized and stored locally until explicitly synced.
 *
 * This module tracks:
 * - Most used commands (command frequency, duration, success rate)
 * - Common error types (error codes, recovery rates)
 * - Setup completion rate (wizard steps, completion percentage)
 * - Playbook usage (which playbooks, success rates, duration)
 *
 * Privacy-focused design:
 * - All telemetry is opt-in via IOSGlobalSettings.telemetry.enabled
 * - No personal data is collected
 * - No file paths, project names, or identifiable information
 * - Data is aggregated locally before any potential sync
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import * as os from 'os';
import { logger } from '../utils/logger';
import { loadGlobalSettings, updateGlobalSettings } from './config';

const LOG_CONTEXT = '[iOS-Telemetry]';

// =============================================================================
// Constants
// =============================================================================

/** Telemetry data version for schema evolution */
export const TELEMETRY_VERSION = '1.0.0';

/** Telemetry data directory */
export const TELEMETRY_DIRECTORY = '.maestro';

/** Telemetry data filename */
export const TELEMETRY_FILENAME = 'ios-telemetry.json';

/** Maximum number of events to store before aggregation */
export const MAX_RAW_EVENTS = 1000;

/** Maximum age of raw events in days before cleanup */
export const MAX_EVENT_AGE_DAYS = 30;

// =============================================================================
// Types
// =============================================================================

/**
 * Types of telemetry events
 */
export type TelemetryEventType =
  | 'command'
  | 'error'
  | 'setup'
  | 'playbook'
  | 'flow'
  | 'interaction';

/**
 * Base telemetry event structure
 */
export interface TelemetryEventBase {
  /** Event type */
  type: TelemetryEventType;
  /** ISO timestamp */
  timestamp: string;
  /** Duration in milliseconds (if applicable) */
  durationMs?: number;
  /** Whether the action succeeded */
  success: boolean;
}

/**
 * Command usage event
 */
export interface CommandEvent extends TelemetryEventBase {
  type: 'command';
  /** Command name (e.g., 'snapshot', 'inspect', 'tap') */
  command: string;
  /** Command category */
  category: CommandCategory;
  /** Error code if failed */
  errorCode?: string;
}

/**
 * Command categories for grouping
 */
export type CommandCategory =
  | 'setup'
  | 'capture'
  | 'inspect'
  | 'interaction'
  | 'flow'
  | 'assertion'
  | 'baseline'
  | 'playbook'
  | 'bridge'
  | 'other';

/**
 * Error occurrence event
 */
export interface ErrorEvent extends TelemetryEventBase {
  type: 'error';
  /** Error code */
  errorCode: string;
  /** Error category */
  errorCategory: ErrorCategory;
  /** Whether auto-recovery was attempted */
  recoveryAttempted: boolean;
  /** Whether recovery succeeded */
  recoverySucceeded?: boolean;
  /** Command that triggered the error */
  command?: string;
}

/**
 * Error categories
 */
export type ErrorCategory =
  | 'environment'
  | 'simulator'
  | 'app'
  | 'element'
  | 'flow'
  | 'capture'
  | 'timeout'
  | 'build'
  | 'other';

/**
 * Setup wizard event
 */
export interface SetupEvent extends TelemetryEventBase {
  type: 'setup';
  /** Setup mode */
  mode: 'wizard' | 'check' | 'fix' | 'reset';
  /** Current step (for wizard mode) */
  step?: SetupStep;
  /** Whether this was the final step */
  isFinalStep: boolean;
  /** Wizard completion percentage (0-100) */
  completionPercentage?: number;
  /** Issues detected during setup */
  issuesDetected?: number;
  /** Issues fixed during setup */
  issuesFixed?: number;
}

/**
 * Setup wizard steps
 */
export type SetupStep =
  | 'environment'
  | 'project'
  | 'simulator'
  | 'xcuitest'
  | 'bridge'
  | 'sample-flow'
  | 'summary';

/**
 * Playbook usage event
 */
export interface PlaybookEvent extends TelemetryEventBase {
  type: 'playbook';
  /** Playbook ID (built-in or hash of custom) */
  playbookId: string;
  /** Whether this is a built-in playbook */
  isBuiltIn: boolean;
  /** Number of steps in the playbook */
  stepCount: number;
  /** Number of steps completed */
  stepsCompleted: number;
  /** Number of steps failed */
  stepsFailed: number;
}

/**
 * Flow execution event
 */
export interface FlowEvent extends TelemetryEventBase {
  type: 'flow';
  /** Number of steps in the flow */
  stepCount: number;
  /** Number of steps passed */
  stepsPassed: number;
  /** Number of steps failed */
  stepsFailed: number;
  /** Whether this was a retry */
  isRetry: boolean;
}

/**
 * UI interaction event
 */
export interface InteractionEvent extends TelemetryEventBase {
  type: 'interaction';
  /** Interaction type */
  interactionType: InteractionType;
  /** Target type used */
  targetType: TargetType;
  /** Whether the element was found on first try */
  foundOnFirstTry: boolean;
}

/**
 * Types of UI interactions
 */
export type InteractionType =
  | 'tap'
  | 'doubleTap'
  | 'longPress'
  | 'type'
  | 'scroll'
  | 'swipe'
  | 'pinch'
  | 'rotate';

/**
 * Types of element targets
 */
export type TargetType =
  | 'id'
  | 'label'
  | 'text'
  | 'predicate'
  | 'coordinates'
  | 'type';

/**
 * Union type for all events
 */
export type TelemetryEvent =
  | CommandEvent
  | ErrorEvent
  | SetupEvent
  | PlaybookEvent
  | FlowEvent
  | InteractionEvent;

/**
 * Aggregated statistics for commands
 */
export interface CommandStats {
  /** Command name */
  command: string;
  /** Category */
  category: CommandCategory;
  /** Total invocations */
  count: number;
  /** Successful invocations */
  successCount: number;
  /** Failed invocations */
  failureCount: number;
  /** Average duration in ms */
  avgDurationMs: number;
  /** Min duration in ms */
  minDurationMs: number;
  /** Max duration in ms */
  maxDurationMs: number;
  /** First use timestamp */
  firstUsed: string;
  /** Last use timestamp */
  lastUsed: string;
}

/**
 * Aggregated statistics for errors
 */
export interface ErrorStats {
  /** Error code */
  errorCode: string;
  /** Error category */
  category: ErrorCategory;
  /** Total occurrences */
  count: number;
  /** Recovery attempts */
  recoveryAttempts: number;
  /** Successful recoveries */
  recoverySuccesses: number;
  /** Commands that triggered this error */
  triggeringCommands: { command: string; count: number }[];
  /** First occurrence timestamp */
  firstOccurred: string;
  /** Last occurrence timestamp */
  lastOccurred: string;
}

/**
 * Aggregated statistics for setup wizard
 */
export interface SetupStats {
  /** Total wizard starts */
  wizardStarts: number;
  /** Completed wizard runs */
  wizardCompletions: number;
  /** Average completion percentage */
  avgCompletionPercentage: number;
  /** Step completion rates */
  stepCompletionRates: { step: SetupStep; rate: number }[];
  /** Check mode usage */
  checkModeCount: number;
  /** Fix mode usage */
  fixModeCount: number;
  /** Reset mode usage */
  resetModeCount: number;
  /** Average issues detected per setup */
  avgIssuesDetected: number;
  /** Average issues fixed per setup */
  avgIssuesFixed: number;
}

/**
 * Aggregated statistics for playbooks
 */
export interface PlaybookStats {
  /** Playbook ID */
  playbookId: string;
  /** Whether this is a built-in playbook */
  isBuiltIn: boolean;
  /** Total runs */
  runCount: number;
  /** Successful runs */
  successCount: number;
  /** Failed runs */
  failureCount: number;
  /** Average duration in ms */
  avgDurationMs: number;
  /** Average step count */
  avgStepCount: number;
  /** Average completion rate (steps completed / total steps) */
  avgCompletionRate: number;
}

/**
 * Aggregated telemetry data
 */
export interface AggregatedTelemetry {
  /** Telemetry version */
  version: string;
  /** Aggregation period start */
  periodStart: string;
  /** Aggregation period end */
  periodEnd: string;
  /** Total events processed */
  totalEvents: number;
  /** Command statistics */
  commands: CommandStats[];
  /** Error statistics */
  errors: ErrorStats[];
  /** Setup statistics */
  setup: SetupStats;
  /** Playbook statistics */
  playbooks: PlaybookStats[];
  /** Summary metrics */
  summary: TelemetrySummary;
}

/**
 * Summary metrics for quick reference
 */
export interface TelemetrySummary {
  /** Total commands executed */
  totalCommands: number;
  /** Command success rate */
  commandSuccessRate: number;
  /** Total errors encountered */
  totalErrors: number;
  /** Error recovery rate */
  errorRecoveryRate: number;
  /** Setup completion rate */
  setupCompletionRate: number;
  /** Total playbook runs */
  totalPlaybookRuns: number;
  /** Playbook success rate */
  playbookSuccessRate: number;
  /** Most used commands (top 5) */
  topCommands: { command: string; count: number }[];
  /** Most common errors (top 5) */
  topErrors: { errorCode: string; count: number }[];
  /** Most used playbooks (top 5) */
  topPlaybooks: { playbookId: string; count: number }[];
}

/**
 * Stored telemetry data (raw events + aggregated)
 */
export interface TelemetryData {
  /** Telemetry version */
  version: string;
  /** Installation ID (anonymous, generated once) */
  installationId: string;
  /** When telemetry was first enabled */
  enabledAt: string;
  /** Raw events (before aggregation) */
  events: TelemetryEvent[];
  /** Aggregated data (from previous events) */
  aggregated?: AggregatedTelemetry;
  /** Last aggregation timestamp */
  lastAggregated?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get the telemetry data file path
 */
export function getTelemetryPath(): string {
  return path.join(os.homedir(), TELEMETRY_DIRECTORY, TELEMETRY_FILENAME);
}

/**
 * Generate a unique anonymous installation ID
 */
export function generateInstallationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${random}`;
}

/**
 * Create default telemetry data structure
 */
export function createDefaultTelemetryData(): TelemetryData {
  return {
    version: TELEMETRY_VERSION,
    installationId: generateInstallationId(),
    enabledAt: new Date().toISOString(),
    events: [],
  };
}

/**
 * Create default setup stats
 */
function createDefaultSetupStats(): SetupStats {
  return {
    wizardStarts: 0,
    wizardCompletions: 0,
    avgCompletionPercentage: 0,
    stepCompletionRates: [],
    checkModeCount: 0,
    fixModeCount: 0,
    resetModeCount: 0,
    avgIssuesDetected: 0,
    avgIssuesFixed: 0,
  };
}

// =============================================================================
// Telemetry State Management
// =============================================================================

/** In-memory cache of telemetry data */
let telemetryCache: TelemetryData | null = null;

/** Whether telemetry is enabled (cached from settings) */
let telemetryEnabled: boolean | null = null;

/**
 * Check if telemetry is enabled
 */
export async function isTelemetryEnabled(): Promise<boolean> {
  if (telemetryEnabled !== null) {
    return telemetryEnabled;
  }

  try {
    const result = await loadGlobalSettings();
    if (result.success && result.data) {
      telemetryEnabled = result.data.telemetry?.enabled ?? false;
    } else {
      telemetryEnabled = false;
    }
    return telemetryEnabled;
  } catch (error) {
    logger.debug('Failed to check telemetry status, assuming disabled', LOG_CONTEXT);
    return false;
  }
}

/**
 * Enable telemetry
 */
export async function enableTelemetry(): Promise<void> {
  await updateGlobalSettings({
    telemetry: {
      enabled: true,
      lastSent: undefined,
    },
  });
  telemetryEnabled = true;
  logger.info('Telemetry enabled', LOG_CONTEXT);
}

/**
 * Disable telemetry
 */
export async function disableTelemetry(): Promise<void> {
  await updateGlobalSettings({
    telemetry: {
      enabled: false,
    },
  });
  telemetryEnabled = false;
  logger.info('Telemetry disabled', LOG_CONTEXT);
}

/**
 * Clear telemetry status cache (for testing)
 */
export function clearTelemetryCache(): void {
  telemetryEnabled = null;
  telemetryCache = null;
}

// =============================================================================
// Data Persistence
// =============================================================================

/**
 * Load telemetry data from disk
 */
export async function loadTelemetryData(): Promise<TelemetryData> {
  if (telemetryCache) {
    return telemetryCache;
  }

  const filePath = getTelemetryPath();

  try {
    if (!existsSync(filePath)) {
      const defaultData = createDefaultTelemetryData();
      telemetryCache = defaultData;
      return defaultData;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as TelemetryData;

    // Validate version and migrate if needed
    if (data.version !== TELEMETRY_VERSION) {
      // For now, just update version (future: migration logic)
      data.version = TELEMETRY_VERSION;
    }

    telemetryCache = data;
    return data;
  } catch (error) {
    logger.warn(`Failed to load telemetry data: ${error}`, LOG_CONTEXT);
    const defaultData = createDefaultTelemetryData();
    telemetryCache = defaultData;
    return defaultData;
  }
}

/**
 * Save telemetry data to disk
 */
export async function saveTelemetryData(data: TelemetryData): Promise<void> {
  const filePath = getTelemetryPath();
  const dir = path.dirname(filePath);

  try {
    // Ensure directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    telemetryCache = data;
    logger.debug('Telemetry data saved', LOG_CONTEXT);
  } catch (error) {
    logger.error(`Failed to save telemetry data: ${error}`, LOG_CONTEXT);
  }
}

/**
 * Clear all telemetry data
 */
export async function clearTelemetryData(): Promise<void> {
  const filePath = getTelemetryPath();

  try {
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    telemetryCache = null;
    logger.info('Telemetry data cleared', LOG_CONTEXT);
  } catch (error) {
    logger.error(`Failed to clear telemetry data: ${error}`, LOG_CONTEXT);
  }
}

// =============================================================================
// Event Recording
// =============================================================================

/**
 * Record a telemetry event
 */
export async function recordEvent(event: TelemetryEvent): Promise<void> {
  const enabled = await isTelemetryEnabled();
  if (!enabled) {
    return;
  }

  try {
    const data = await loadTelemetryData();

    // Add event
    data.events.push(event);

    // Check if we need to aggregate
    if (data.events.length >= MAX_RAW_EVENTS) {
      await aggregateEvents(data);
    } else {
      await saveTelemetryData(data);
    }

    logger.debug(`Recorded telemetry event: ${event.type}`, LOG_CONTEXT);
  } catch (error) {
    logger.debug(`Failed to record telemetry event: ${error}`, LOG_CONTEXT);
  }
}

/**
 * Record a command execution
 */
export async function recordCommand(
  command: string,
  category: CommandCategory,
  success: boolean,
  durationMs?: number,
  errorCode?: string
): Promise<void> {
  const event: CommandEvent = {
    type: 'command',
    timestamp: new Date().toISOString(),
    command,
    category,
    success,
    durationMs,
    errorCode,
  };
  await recordEvent(event);
}

/**
 * Record an error occurrence
 */
export async function recordError(
  errorCode: string,
  errorCategory: ErrorCategory,
  recoveryAttempted: boolean = false,
  recoverySucceeded?: boolean,
  command?: string
): Promise<void> {
  const event: ErrorEvent = {
    type: 'error',
    timestamp: new Date().toISOString(),
    success: false,
    errorCode,
    errorCategory,
    recoveryAttempted,
    recoverySucceeded,
    command,
  };
  await recordEvent(event);
}

/**
 * Record a setup wizard event
 */
export async function recordSetup(
  mode: 'wizard' | 'check' | 'fix' | 'reset',
  success: boolean,
  options: {
    step?: SetupStep;
    isFinalStep?: boolean;
    completionPercentage?: number;
    issuesDetected?: number;
    issuesFixed?: number;
    durationMs?: number;
  } = {}
): Promise<void> {
  const event: SetupEvent = {
    type: 'setup',
    timestamp: new Date().toISOString(),
    success,
    mode,
    step: options.step,
    isFinalStep: options.isFinalStep ?? false,
    completionPercentage: options.completionPercentage,
    issuesDetected: options.issuesDetected,
    issuesFixed: options.issuesFixed,
    durationMs: options.durationMs,
  };
  await recordEvent(event);
}

/**
 * Record a playbook execution
 */
export async function recordPlaybook(
  playbookId: string,
  isBuiltIn: boolean,
  success: boolean,
  stepCount: number,
  stepsCompleted: number,
  stepsFailed: number,
  durationMs?: number
): Promise<void> {
  const event: PlaybookEvent = {
    type: 'playbook',
    timestamp: new Date().toISOString(),
    success,
    playbookId,
    isBuiltIn,
    stepCount,
    stepsCompleted,
    stepsFailed,
    durationMs,
  };
  await recordEvent(event);
}

/**
 * Record a flow execution
 */
export async function recordFlow(
  success: boolean,
  stepCount: number,
  stepsPassed: number,
  stepsFailed: number,
  isRetry: boolean = false,
  durationMs?: number
): Promise<void> {
  const event: FlowEvent = {
    type: 'flow',
    timestamp: new Date().toISOString(),
    success,
    stepCount,
    stepsPassed,
    stepsFailed,
    isRetry,
    durationMs,
  };
  await recordEvent(event);
}

/**
 * Record a UI interaction
 */
export async function recordInteraction(
  interactionType: InteractionType,
  targetType: TargetType,
  success: boolean,
  foundOnFirstTry: boolean = true,
  durationMs?: number
): Promise<void> {
  const event: InteractionEvent = {
    type: 'interaction',
    timestamp: new Date().toISOString(),
    success,
    interactionType,
    targetType,
    foundOnFirstTry,
    durationMs,
  };
  await recordEvent(event);
}

// =============================================================================
// Aggregation
// =============================================================================

/**
 * Aggregate raw events into statistics
 */
export async function aggregateEvents(data: TelemetryData): Promise<void> {
  const events = data.events;
  if (events.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const commandEvents = events.filter((e): e is CommandEvent => e.type === 'command');
  const errorEvents = events.filter((e): e is ErrorEvent => e.type === 'error');
  const setupEvents = events.filter((e): e is SetupEvent => e.type === 'setup');
  const playbookEvents = events.filter((e): e is PlaybookEvent => e.type === 'playbook');

  // Aggregate commands
  const commandStats = aggregateCommands(commandEvents, data.aggregated?.commands);

  // Aggregate errors
  const errorStats = aggregateErrors(errorEvents, data.aggregated?.errors);

  // Aggregate setup
  const setupStats = aggregateSetup(setupEvents, data.aggregated?.setup);

  // Aggregate playbooks
  const playbookStats = aggregatePlaybooks(playbookEvents, data.aggregated?.playbooks);

  // Create summary
  const summary = createSummary(commandStats, errorStats, setupStats, playbookStats);

  // Calculate period
  const timestamps = events.map((e) => e.timestamp).sort();
  const periodStart = data.aggregated?.periodStart ?? timestamps[0] ?? now;
  const periodEnd = now;

  // Create aggregated data
  data.aggregated = {
    version: TELEMETRY_VERSION,
    periodStart,
    periodEnd,
    totalEvents: (data.aggregated?.totalEvents ?? 0) + events.length,
    commands: commandStats,
    errors: errorStats,
    setup: setupStats,
    playbooks: playbookStats,
    summary,
  };

  // Clear raw events
  data.events = [];
  data.lastAggregated = now;

  await saveTelemetryData(data);
  logger.info(`Aggregated ${events.length} telemetry events`, LOG_CONTEXT);
}

/**
 * Aggregate command events
 */
function aggregateCommands(
  events: CommandEvent[],
  existing: CommandStats[] = []
): CommandStats[] {
  const statsMap = new Map<string, CommandStats>();

  // Load existing stats
  for (const stat of existing) {
    statsMap.set(stat.command, { ...stat });
  }

  // Process new events
  for (const event of events) {
    const key = event.command;
    const stat = statsMap.get(key) ?? {
      command: event.command,
      category: event.category,
      count: 0,
      successCount: 0,
      failureCount: 0,
      avgDurationMs: 0,
      minDurationMs: Infinity,
      maxDurationMs: 0,
      firstUsed: event.timestamp,
      lastUsed: event.timestamp,
    };

    stat.count++;
    if (event.success) {
      stat.successCount++;
    } else {
      stat.failureCount++;
    }

    if (event.durationMs !== undefined) {
      // Update rolling average
      const totalDuration = stat.avgDurationMs * (stat.count - 1) + event.durationMs;
      stat.avgDurationMs = totalDuration / stat.count;
      stat.minDurationMs = Math.min(stat.minDurationMs, event.durationMs);
      stat.maxDurationMs = Math.max(stat.maxDurationMs, event.durationMs);
    }

    stat.lastUsed = event.timestamp;
    statsMap.set(key, stat);
  }

  // Convert to array and fix Infinity
  return Array.from(statsMap.values()).map((s) => ({
    ...s,
    minDurationMs: s.minDurationMs === Infinity ? 0 : s.minDurationMs,
  }));
}

/**
 * Aggregate error events
 */
function aggregateErrors(
  events: ErrorEvent[],
  existing: ErrorStats[] = []
): ErrorStats[] {
  const statsMap = new Map<string, ErrorStats>();

  // Load existing stats
  for (const stat of existing) {
    statsMap.set(stat.errorCode, { ...stat });
  }

  // Process new events
  for (const event of events) {
    const key = event.errorCode;
    const stat = statsMap.get(key) ?? {
      errorCode: event.errorCode,
      category: event.errorCategory,
      count: 0,
      recoveryAttempts: 0,
      recoverySuccesses: 0,
      triggeringCommands: [],
      firstOccurred: event.timestamp,
      lastOccurred: event.timestamp,
    };

    stat.count++;
    if (event.recoveryAttempted) {
      stat.recoveryAttempts++;
      if (event.recoverySucceeded) {
        stat.recoverySuccesses++;
      }
    }

    if (event.command) {
      const cmdEntry = stat.triggeringCommands.find((c) => c.command === event.command);
      if (cmdEntry) {
        cmdEntry.count++;
      } else {
        stat.triggeringCommands.push({ command: event.command, count: 1 });
      }
    }

    stat.lastOccurred = event.timestamp;
    statsMap.set(key, stat);
  }

  return Array.from(statsMap.values());
}

/**
 * Aggregate setup events
 */
function aggregateSetup(
  events: SetupEvent[],
  existing?: SetupStats
): SetupStats {
  const stats: SetupStats = existing ? { ...existing } : createDefaultSetupStats();

  // Track step completions for rate calculation
  const stepCompletions = new Map<SetupStep, { total: number; completed: number }>();

  // Initialize from existing
  if (existing?.stepCompletionRates) {
    for (const sr of existing.stepCompletionRates) {
      stepCompletions.set(sr.step, { total: 0, completed: 0 });
    }
  }

  // Process events
  let totalCompletion = stats.avgCompletionPercentage * stats.wizardStarts;
  let totalIssuesDetected = stats.avgIssuesDetected * (stats.checkModeCount + stats.fixModeCount);
  let totalIssuesFixed = stats.avgIssuesFixed * stats.fixModeCount;

  for (const event of events) {
    switch (event.mode) {
      case 'wizard':
        if (!event.step) {
          stats.wizardStarts++;
        }
        if (event.isFinalStep && event.success) {
          stats.wizardCompletions++;
        }
        if (event.step) {
          const stepData = stepCompletions.get(event.step) ?? { total: 0, completed: 0 };
          stepData.total++;
          if (event.success) {
            stepData.completed++;
          }
          stepCompletions.set(event.step, stepData);
        }
        if (event.completionPercentage !== undefined) {
          totalCompletion += event.completionPercentage;
        }
        break;
      case 'check':
        stats.checkModeCount++;
        if (event.issuesDetected !== undefined) {
          totalIssuesDetected += event.issuesDetected;
        }
        break;
      case 'fix':
        stats.fixModeCount++;
        if (event.issuesDetected !== undefined) {
          totalIssuesDetected += event.issuesDetected;
        }
        if (event.issuesFixed !== undefined) {
          totalIssuesFixed += event.issuesFixed;
        }
        break;
      case 'reset':
        stats.resetModeCount++;
        break;
    }
  }

  // Calculate averages
  const wizardEventsWithCompletion = events.filter(
    (e) => e.mode === 'wizard' && e.completionPercentage !== undefined
  ).length;
  if (stats.wizardStarts > 0) {
    stats.avgCompletionPercentage = totalCompletion / (stats.wizardStarts + wizardEventsWithCompletion);
  }

  const checkFixCount = stats.checkModeCount + stats.fixModeCount;
  if (checkFixCount > 0) {
    stats.avgIssuesDetected = totalIssuesDetected / checkFixCount;
  }

  if (stats.fixModeCount > 0) {
    stats.avgIssuesFixed = totalIssuesFixed / stats.fixModeCount;
  }

  // Calculate step completion rates
  stats.stepCompletionRates = Array.from(stepCompletions.entries())
    .map(([step, data]) => ({
      step,
      rate: data.total > 0 ? data.completed / data.total : 0,
    }));

  return stats;
}

/**
 * Aggregate playbook events
 */
function aggregatePlaybooks(
  events: PlaybookEvent[],
  existing: PlaybookStats[] = []
): PlaybookStats[] {
  const statsMap = new Map<string, PlaybookStats>();

  // Load existing stats
  for (const stat of existing) {
    statsMap.set(stat.playbookId, { ...stat });
  }

  // Process new events
  for (const event of events) {
    const key = event.playbookId;
    const stat = statsMap.get(key) ?? {
      playbookId: event.playbookId,
      isBuiltIn: event.isBuiltIn,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      avgDurationMs: 0,
      avgStepCount: 0,
      avgCompletionRate: 0,
    };

    const prevRunCount = stat.runCount;
    stat.runCount++;

    if (event.success) {
      stat.successCount++;
    } else {
      stat.failureCount++;
    }

    // Update rolling averages
    if (event.durationMs !== undefined) {
      const totalDuration = stat.avgDurationMs * prevRunCount + event.durationMs;
      stat.avgDurationMs = totalDuration / stat.runCount;
    }

    const totalStepCount = stat.avgStepCount * prevRunCount + event.stepCount;
    stat.avgStepCount = totalStepCount / stat.runCount;

    const completionRate = event.stepCount > 0 ? event.stepsCompleted / event.stepCount : 0;
    const totalCompletionRate = stat.avgCompletionRate * prevRunCount + completionRate;
    stat.avgCompletionRate = totalCompletionRate / stat.runCount;

    statsMap.set(key, stat);
  }

  return Array.from(statsMap.values());
}

/**
 * Create summary from aggregated stats
 */
function createSummary(
  commands: CommandStats[],
  errors: ErrorStats[],
  setup: SetupStats,
  playbooks: PlaybookStats[]
): TelemetrySummary {
  // Commands
  const totalCommands = commands.reduce((sum, c) => sum + c.count, 0);
  const successfulCommands = commands.reduce((sum, c) => sum + c.successCount, 0);
  const commandSuccessRate = totalCommands > 0 ? successfulCommands / totalCommands : 0;

  // Errors
  const totalErrors = errors.reduce((sum, e) => sum + e.count, 0);
  const totalRecoveryAttempts = errors.reduce((sum, e) => sum + e.recoveryAttempts, 0);
  const totalRecoverySuccesses = errors.reduce((sum, e) => sum + e.recoverySuccesses, 0);
  const errorRecoveryRate = totalRecoveryAttempts > 0
    ? totalRecoverySuccesses / totalRecoveryAttempts
    : 0;

  // Setup
  const setupCompletionRate = setup.wizardStarts > 0
    ? setup.wizardCompletions / setup.wizardStarts
    : 0;

  // Playbooks
  const totalPlaybookRuns = playbooks.reduce((sum, p) => sum + p.runCount, 0);
  const successfulPlaybookRuns = playbooks.reduce((sum, p) => sum + p.successCount, 0);
  const playbookSuccessRate = totalPlaybookRuns > 0
    ? successfulPlaybookRuns / totalPlaybookRuns
    : 0;

  // Top commands (sorted by count, top 5)
  const topCommands = [...commands]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => ({ command: c.command, count: c.count }));

  // Top errors (sorted by count, top 5)
  const topErrors = [...errors]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((e) => ({ errorCode: e.errorCode, count: e.count }));

  // Top playbooks (sorted by run count, top 5)
  const topPlaybooks = [...playbooks]
    .sort((a, b) => b.runCount - a.runCount)
    .slice(0, 5)
    .map((p) => ({ playbookId: p.playbookId, count: p.runCount }));

  return {
    totalCommands,
    commandSuccessRate,
    totalErrors,
    errorRecoveryRate,
    setupCompletionRate,
    totalPlaybookRuns,
    playbookSuccessRate,
    topCommands,
    topErrors,
    topPlaybooks,
  };
}

// =============================================================================
// Data Access
// =============================================================================

/**
 * Get current telemetry data (for display to user)
 */
export async function getTelemetryData(): Promise<TelemetryData> {
  return await loadTelemetryData();
}

/**
 * Get aggregated statistics
 */
export async function getAggregatedStats(): Promise<AggregatedTelemetry | null> {
  const data = await loadTelemetryData();
  return data.aggregated ?? null;
}

/**
 * Get summary statistics
 */
export async function getSummary(): Promise<TelemetrySummary | null> {
  const data = await loadTelemetryData();
  return data.aggregated?.summary ?? null;
}

/**
 * Get raw event count (pending aggregation)
 */
export async function getRawEventCount(): Promise<number> {
  const data = await loadTelemetryData();
  return data.events.length;
}

/**
 * Force aggregation of current events
 */
export async function forceAggregation(): Promise<void> {
  const data = await loadTelemetryData();
  await aggregateEvents(data);
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format telemetry summary as markdown
 */
export function formatSummaryAsMarkdown(summary: TelemetrySummary): string {
  const lines: string[] = [
    '## iOS Development Usage Summary\n',
    '### Commands',
    `- Total executed: **${summary.totalCommands}**`,
    `- Success rate: **${(summary.commandSuccessRate * 100).toFixed(1)}%**`,
    '',
    '### Errors',
    `- Total encountered: **${summary.totalErrors}**`,
    `- Recovery rate: **${(summary.errorRecoveryRate * 100).toFixed(1)}%**`,
    '',
    '### Setup Wizard',
    `- Completion rate: **${(summary.setupCompletionRate * 100).toFixed(1)}%**`,
    '',
    '### Playbooks',
    `- Total runs: **${summary.totalPlaybookRuns}**`,
    `- Success rate: **${(summary.playbookSuccessRate * 100).toFixed(1)}%**`,
  ];

  if (summary.topCommands.length > 0) {
    lines.push('', '### Most Used Commands');
    for (const cmd of summary.topCommands) {
      lines.push(`- \`${cmd.command}\`: ${cmd.count} times`);
    }
  }

  if (summary.topErrors.length > 0) {
    lines.push('', '### Most Common Errors');
    for (const err of summary.topErrors) {
      lines.push(`- \`${err.errorCode}\`: ${err.count} occurrences`);
    }
  }

  if (summary.topPlaybooks.length > 0) {
    lines.push('', '### Most Used Playbooks');
    for (const pb of summary.topPlaybooks) {
      lines.push(`- \`${pb.playbookId}\`: ${pb.count} runs`);
    }
  }

  return lines.join('\n');
}

/**
 * Format telemetry data as JSON (for export)
 */
export function formatDataAsJson(data: TelemetryData): string {
  return JSON.stringify(data, null, 2);
}
