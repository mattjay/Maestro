/**
 * Tests for iOS Telemetry Module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

import {
  // Constants
  TELEMETRY_VERSION,
  TELEMETRY_DIRECTORY,
  TELEMETRY_FILENAME,
  MAX_RAW_EVENTS,
  MAX_EVENT_AGE_DAYS,
  // Utility functions
  getTelemetryPath,
  generateInstallationId,
  createDefaultTelemetryData,
  // State management
  clearTelemetryCache,
  // Aggregation functions (we'll test aggregation logic directly)
  aggregateEvents,
  // Formatting
  formatSummaryAsMarkdown,
  formatDataAsJson,
  // Types
  TelemetryData,
  TelemetryEvent,
  CommandEvent,
  ErrorEvent,
  SetupEvent,
  PlaybookEvent,
  FlowEvent,
  InteractionEvent,
  TelemetrySummary,
  CommandStats,
} from '../telemetry';

// Test directory
const TEST_TELEMETRY_DIR = '/tmp/maestro-telemetry-test';
const TEST_TELEMETRY_FILE = path.join(TEST_TELEMETRY_DIR, TELEMETRY_FILENAME);

// Setup/teardown
beforeAll(async () => {
  await fs.mkdir(TEST_TELEMETRY_DIR, { recursive: true });
});

afterAll(async () => {
  try {
    await fs.rm(TEST_TELEMETRY_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

beforeEach(async () => {
  clearTelemetryCache();
  // Clean up test file before each test
  try {
    await fs.unlink(TEST_TELEMETRY_FILE);
  } catch {
    // File may not exist
  }
});

// ===========================================================================
// Constants
// ===========================================================================

describe('Constants', () => {
  it('exports correct version', () => {
    expect(TELEMETRY_VERSION).toBe('1.0.0');
  });

  it('exports correct directory name', () => {
    expect(TELEMETRY_DIRECTORY).toBe('.maestro');
  });

  it('exports correct filename', () => {
    expect(TELEMETRY_FILENAME).toBe('ios-telemetry.json');
  });

  it('exports max raw events threshold', () => {
    expect(MAX_RAW_EVENTS).toBe(1000);
  });

  it('exports max event age in days', () => {
    expect(MAX_EVENT_AGE_DAYS).toBe(30);
  });
});

// ===========================================================================
// Utility Functions
// ===========================================================================

describe('getTelemetryPath', () => {
  it('returns correct path in home directory', () => {
    const expectedPath = path.join(os.homedir(), TELEMETRY_DIRECTORY, TELEMETRY_FILENAME);
    expect(getTelemetryPath()).toBe(expectedPath);
  });
});

describe('generateInstallationId', () => {
  it('generates a unique ID', () => {
    const id1 = generateInstallationId();
    const id2 = generateInstallationId();
    expect(id1).not.toBe(id2);
  });

  it('generates ID with correct format', () => {
    const id = generateInstallationId();
    expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });

  it('generates ID with timestamp component', () => {
    const id = generateInstallationId();
    const parts = id.split('-');
    expect(parts.length).toBe(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });
});

describe('createDefaultTelemetryData', () => {
  it('creates data with correct version', () => {
    const data = createDefaultTelemetryData();
    expect(data.version).toBe(TELEMETRY_VERSION);
  });

  it('creates data with installation ID', () => {
    const data = createDefaultTelemetryData();
    expect(data.installationId).toBeDefined();
    expect(data.installationId.length).toBeGreaterThan(0);
  });

  it('creates data with enabledAt timestamp', () => {
    const data = createDefaultTelemetryData();
    expect(data.enabledAt).toBeDefined();
    expect(() => new Date(data.enabledAt)).not.toThrow();
  });

  it('creates data with empty events array', () => {
    const data = createDefaultTelemetryData();
    expect(data.events).toEqual([]);
  });

  it('creates data without aggregated data', () => {
    const data = createDefaultTelemetryData();
    expect(data.aggregated).toBeUndefined();
  });

  it('creates unique installation IDs for each call', () => {
    const data1 = createDefaultTelemetryData();
    const data2 = createDefaultTelemetryData();
    expect(data1.installationId).not.toBe(data2.installationId);
  });
});

// ===========================================================================
// Event Types
// ===========================================================================

describe('Event Types', () => {
  describe('CommandEvent', () => {
    it('has correct structure', () => {
      const event: CommandEvent = {
        type: 'command',
        timestamp: new Date().toISOString(),
        command: 'snapshot',
        category: 'capture',
        success: true,
        durationMs: 150,
      };

      expect(event.type).toBe('command');
      expect(event.command).toBe('snapshot');
      expect(event.category).toBe('capture');
      expect(event.success).toBe(true);
      expect(event.durationMs).toBe(150);
    });

    it('supports error code for failures', () => {
      const event: CommandEvent = {
        type: 'command',
        timestamp: new Date().toISOString(),
        command: 'tap',
        category: 'interaction',
        success: false,
        errorCode: 'ELEMENT_NOT_FOUND',
      };

      expect(event.success).toBe(false);
      expect(event.errorCode).toBe('ELEMENT_NOT_FOUND');
    });
  });

  describe('ErrorEvent', () => {
    it('has correct structure', () => {
      const event: ErrorEvent = {
        type: 'error',
        timestamp: new Date().toISOString(),
        success: false,
        errorCode: 'SIMULATOR_NOT_BOOTED',
        errorCategory: 'simulator',
        recoveryAttempted: true,
        recoverySucceeded: true,
        command: 'snapshot',
      };

      expect(event.type).toBe('error');
      expect(event.errorCode).toBe('SIMULATOR_NOT_BOOTED');
      expect(event.recoveryAttempted).toBe(true);
      expect(event.recoverySucceeded).toBe(true);
    });
  });

  describe('SetupEvent', () => {
    it('has correct structure for wizard mode', () => {
      const event: SetupEvent = {
        type: 'setup',
        timestamp: new Date().toISOString(),
        mode: 'wizard',
        success: true,
        step: 'environment',
        isFinalStep: false,
        completionPercentage: 14,
        durationMs: 500,
      };

      expect(event.type).toBe('setup');
      expect(event.mode).toBe('wizard');
      expect(event.step).toBe('environment');
      expect(event.completionPercentage).toBe(14);
    });

    it('has correct structure for fix mode', () => {
      const event: SetupEvent = {
        type: 'setup',
        timestamp: new Date().toISOString(),
        mode: 'fix',
        success: true,
        isFinalStep: false,
        issuesDetected: 3,
        issuesFixed: 3,
      };

      expect(event.mode).toBe('fix');
      expect(event.issuesDetected).toBe(3);
      expect(event.issuesFixed).toBe(3);
    });
  });

  describe('PlaybookEvent', () => {
    it('has correct structure', () => {
      const event: PlaybookEvent = {
        type: 'playbook',
        timestamp: new Date().toISOString(),
        success: true,
        playbookId: 'feature-ship-loop',
        isBuiltIn: true,
        stepCount: 10,
        stepsCompleted: 10,
        stepsFailed: 0,
        durationMs: 5000,
      };

      expect(event.type).toBe('playbook');
      expect(event.playbookId).toBe('feature-ship-loop');
      expect(event.isBuiltIn).toBe(true);
      expect(event.stepCount).toBe(10);
    });
  });

  describe('FlowEvent', () => {
    it('has correct structure', () => {
      const event: FlowEvent = {
        type: 'flow',
        timestamp: new Date().toISOString(),
        success: true,
        stepCount: 5,
        stepsPassed: 5,
        stepsFailed: 0,
        isRetry: false,
        durationMs: 3000,
      };

      expect(event.type).toBe('flow');
      expect(event.stepCount).toBe(5);
      expect(event.stepsPassed).toBe(5);
      expect(event.isRetry).toBe(false);
    });
  });

  describe('InteractionEvent', () => {
    it('has correct structure', () => {
      const event: InteractionEvent = {
        type: 'interaction',
        timestamp: new Date().toISOString(),
        success: true,
        interactionType: 'tap',
        targetType: 'id',
        foundOnFirstTry: true,
        durationMs: 100,
      };

      expect(event.type).toBe('interaction');
      expect(event.interactionType).toBe('tap');
      expect(event.targetType).toBe('id');
      expect(event.foundOnFirstTry).toBe(true);
    });
  });
});

// ===========================================================================
// Aggregation Logic (Unit Tests)
// ===========================================================================

describe('aggregateEvents', () => {
  // Helper to write and read test data
  const writeTestData = async (data: TelemetryData): Promise<void> => {
    await fs.mkdir(TEST_TELEMETRY_DIR, { recursive: true });
    await fs.writeFile(TEST_TELEMETRY_FILE, JSON.stringify(data, null, 2));
  };

  describe('Command Aggregation', () => {
    it('aggregates command events correctly', async () => {
      const events: CommandEvent[] = [
        { type: 'command', timestamp: '2024-01-01T00:00:00Z', command: 'snapshot', category: 'capture', success: true, durationMs: 100 },
        { type: 'command', timestamp: '2024-01-01T00:01:00Z', command: 'snapshot', category: 'capture', success: true, durationMs: 150 },
        { type: 'command', timestamp: '2024-01-01T00:02:00Z', command: 'snapshot', category: 'capture', success: false, durationMs: 50 },
        { type: 'command', timestamp: '2024-01-01T00:03:00Z', command: 'inspect', category: 'inspect', success: true, durationMs: 200 },
      ];

      const data: TelemetryData = {
        version: TELEMETRY_VERSION,
        installationId: 'test-123',
        enabledAt: '2024-01-01T00:00:00Z',
        events,
      };

      // Aggregate expects to write to file, so we mock by using the data object directly
      // Since aggregateEvents modifies the data object in place, we can check the results
      await writeTestData(data);

      // Create a fresh data object and run aggregation
      const testData: TelemetryData = JSON.parse(JSON.stringify(data));

      // We need to provide save functionality - for this unit test, we'll just verify the logic
      // by checking the aggregation result structure
      await aggregateEvents(testData);

      expect(testData.events).toEqual([]);
      expect(testData.aggregated).toBeDefined();
      expect(testData.aggregated!.commands).toHaveLength(2);

      const snapshotStats = testData.aggregated!.commands.find((c) => c.command === 'snapshot');
      expect(snapshotStats).toBeDefined();
      expect(snapshotStats!.count).toBe(3);
      expect(snapshotStats!.successCount).toBe(2);
      expect(snapshotStats!.failureCount).toBe(1);
      expect(snapshotStats!.avgDurationMs).toBe(100); // (100 + 150 + 50) / 3 = 100
      expect(snapshotStats!.minDurationMs).toBe(50);
      expect(snapshotStats!.maxDurationMs).toBe(150);

      const inspectStats = testData.aggregated!.commands.find((c) => c.command === 'inspect');
      expect(inspectStats).toBeDefined();
      expect(inspectStats!.count).toBe(1);
    });

    it('merges with existing aggregated data', async () => {
      const existingStats: CommandStats[] = [
        {
          command: 'snapshot',
          category: 'capture',
          count: 5,
          successCount: 4,
          failureCount: 1,
          avgDurationMs: 120,
          minDurationMs: 80,
          maxDurationMs: 200,
          firstUsed: '2024-01-01T00:00:00Z',
          lastUsed: '2024-01-01T12:00:00Z',
        },
      ];

      const newEvents: CommandEvent[] = [
        { type: 'command', timestamp: '2024-01-02T00:00:00Z', command: 'snapshot', category: 'capture', success: true, durationMs: 100 },
      ];

      const data: TelemetryData = {
        version: TELEMETRY_VERSION,
        installationId: 'test-123',
        enabledAt: '2024-01-01T00:00:00Z',
        events: newEvents,
        aggregated: {
          version: TELEMETRY_VERSION,
          periodStart: '2024-01-01T00:00:00Z',
          periodEnd: '2024-01-01T12:00:00Z',
          totalEvents: 5,
          commands: existingStats,
          errors: [],
          setup: {
            wizardStarts: 0,
            wizardCompletions: 0,
            avgCompletionPercentage: 0,
            stepCompletionRates: [],
            checkModeCount: 0,
            fixModeCount: 0,
            resetModeCount: 0,
            avgIssuesDetected: 0,
            avgIssuesFixed: 0,
          },
          playbooks: [],
          summary: {
            totalCommands: 5,
            commandSuccessRate: 0.8,
            totalErrors: 0,
            errorRecoveryRate: 0,
            setupCompletionRate: 0,
            totalPlaybookRuns: 0,
            playbookSuccessRate: 0,
            topCommands: [],
            topErrors: [],
            topPlaybooks: [],
          },
        },
      };

      await aggregateEvents(data);

      const snapshotStats = data.aggregated!.commands.find((c) => c.command === 'snapshot');
      expect(snapshotStats).toBeDefined();
      expect(snapshotStats!.count).toBe(6); // 5 existing + 1 new
      expect(snapshotStats!.successCount).toBe(5); // 4 existing + 1 new
    });
  });

  describe('Error Aggregation', () => {
    it('aggregates error events correctly', async () => {
      const events: ErrorEvent[] = [
        { type: 'error', timestamp: '2024-01-01T00:00:00Z', success: false, errorCode: 'SIMULATOR_NOT_BOOTED', errorCategory: 'simulator', recoveryAttempted: true, recoverySucceeded: true, command: 'snapshot' },
        { type: 'error', timestamp: '2024-01-01T00:01:00Z', success: false, errorCode: 'SIMULATOR_NOT_BOOTED', errorCategory: 'simulator', recoveryAttempted: true, recoverySucceeded: false, command: 'inspect' },
        { type: 'error', timestamp: '2024-01-01T00:02:00Z', success: false, errorCode: 'ELEMENT_NOT_FOUND', errorCategory: 'element', recoveryAttempted: false },
      ];

      const data: TelemetryData = {
        version: TELEMETRY_VERSION,
        installationId: 'test-123',
        enabledAt: '2024-01-01T00:00:00Z',
        events,
      };

      await aggregateEvents(data);

      expect(data.aggregated!.errors).toHaveLength(2);

      const simError = data.aggregated!.errors.find((e) => e.errorCode === 'SIMULATOR_NOT_BOOTED');
      expect(simError).toBeDefined();
      expect(simError!.count).toBe(2);
      expect(simError!.recoveryAttempts).toBe(2);
      expect(simError!.recoverySuccesses).toBe(1);
      expect(simError!.triggeringCommands).toContainEqual({ command: 'snapshot', count: 1 });
      expect(simError!.triggeringCommands).toContainEqual({ command: 'inspect', count: 1 });
    });

    it('tracks triggering commands correctly', async () => {
      const events: ErrorEvent[] = [
        { type: 'error', timestamp: '2024-01-01T00:00:00Z', success: false, errorCode: 'TIMEOUT', errorCategory: 'timeout', recoveryAttempted: false, command: 'snapshot' },
        { type: 'error', timestamp: '2024-01-01T00:01:00Z', success: false, errorCode: 'TIMEOUT', errorCategory: 'timeout', recoveryAttempted: false, command: 'snapshot' },
        { type: 'error', timestamp: '2024-01-01T00:02:00Z', success: false, errorCode: 'TIMEOUT', errorCategory: 'timeout', recoveryAttempted: false, command: 'inspect' },
      ];

      const data: TelemetryData = {
        version: TELEMETRY_VERSION,
        installationId: 'test-123',
        enabledAt: '2024-01-01T00:00:00Z',
        events,
      };

      await aggregateEvents(data);

      const timeoutError = data.aggregated!.errors.find((e) => e.errorCode === 'TIMEOUT');
      expect(timeoutError!.triggeringCommands).toContainEqual({ command: 'snapshot', count: 2 });
      expect(timeoutError!.triggeringCommands).toContainEqual({ command: 'inspect', count: 1 });
    });
  });

  describe('Setup Aggregation', () => {
    it('aggregates wizard events correctly', async () => {
      const events: SetupEvent[] = [
        { type: 'setup', timestamp: '2024-01-01T00:00:00Z', mode: 'wizard', success: true, isFinalStep: false, step: 'environment' },
        { type: 'setup', timestamp: '2024-01-01T00:01:00Z', mode: 'wizard', success: true, isFinalStep: false, step: 'project' },
        { type: 'setup', timestamp: '2024-01-01T00:02:00Z', mode: 'wizard', success: true, isFinalStep: true, step: 'summary', completionPercentage: 100 },
      ];

      const data: TelemetryData = {
        version: TELEMETRY_VERSION,
        installationId: 'test-123',
        enabledAt: '2024-01-01T00:00:00Z',
        events,
      };

      await aggregateEvents(data);

      expect(data.aggregated!.setup).toBeDefined();
      expect(data.aggregated!.setup.wizardCompletions).toBe(1);
    });

    it('aggregates check and fix modes correctly', async () => {
      const events: SetupEvent[] = [
        { type: 'setup', timestamp: '2024-01-01T00:00:00Z', mode: 'check', success: true, isFinalStep: false, issuesDetected: 3 },
        { type: 'setup', timestamp: '2024-01-01T00:01:00Z', mode: 'fix', success: true, isFinalStep: false, issuesDetected: 2, issuesFixed: 2 },
        { type: 'setup', timestamp: '2024-01-01T00:02:00Z', mode: 'reset', success: true, isFinalStep: false },
      ];

      const data: TelemetryData = {
        version: TELEMETRY_VERSION,
        installationId: 'test-123',
        enabledAt: '2024-01-01T00:00:00Z',
        events,
      };

      await aggregateEvents(data);

      expect(data.aggregated!.setup.checkModeCount).toBe(1);
      expect(data.aggregated!.setup.fixModeCount).toBe(1);
      expect(data.aggregated!.setup.resetModeCount).toBe(1);
    });
  });

  describe('Playbook Aggregation', () => {
    it('aggregates playbook events correctly', async () => {
      const events: PlaybookEvent[] = [
        { type: 'playbook', timestamp: '2024-01-01T00:00:00Z', success: true, playbookId: 'feature-ship-loop', isBuiltIn: true, stepCount: 10, stepsCompleted: 10, stepsFailed: 0, durationMs: 5000 },
        { type: 'playbook', timestamp: '2024-01-01T00:01:00Z', success: false, playbookId: 'feature-ship-loop', isBuiltIn: true, stepCount: 10, stepsCompleted: 5, stepsFailed: 1, durationMs: 3000 },
        { type: 'playbook', timestamp: '2024-01-01T00:02:00Z', success: true, playbookId: 'custom-playbook', isBuiltIn: false, stepCount: 5, stepsCompleted: 5, stepsFailed: 0, durationMs: 2000 },
      ];

      const data: TelemetryData = {
        version: TELEMETRY_VERSION,
        installationId: 'test-123',
        enabledAt: '2024-01-01T00:00:00Z',
        events,
      };

      await aggregateEvents(data);

      expect(data.aggregated!.playbooks).toHaveLength(2);

      const builtIn = data.aggregated!.playbooks.find((p) => p.playbookId === 'feature-ship-loop');
      expect(builtIn).toBeDefined();
      expect(builtIn!.runCount).toBe(2);
      expect(builtIn!.successCount).toBe(1);
      expect(builtIn!.failureCount).toBe(1);
      expect(builtIn!.avgDurationMs).toBe(4000); // (5000 + 3000) / 2
      expect(builtIn!.isBuiltIn).toBe(true);

      const custom = data.aggregated!.playbooks.find((p) => p.playbookId === 'custom-playbook');
      expect(custom).toBeDefined();
      expect(custom!.isBuiltIn).toBe(false);
    });
  });

  describe('Summary Generation', () => {
    it('creates summary with correct totals', async () => {
      const events: TelemetryEvent[] = [
        { type: 'command', timestamp: '2024-01-01T00:00:00Z', command: 'snapshot', category: 'capture', success: true },
        { type: 'command', timestamp: '2024-01-01T00:00:01Z', command: 'snapshot', category: 'capture', success: true },
        { type: 'command', timestamp: '2024-01-01T00:00:02Z', command: 'inspect', category: 'inspect', success: true },
        { type: 'error', timestamp: '2024-01-01T00:00:03Z', success: false, errorCode: 'TIMEOUT', errorCategory: 'timeout', recoveryAttempted: true, recoverySucceeded: true },
        { type: 'playbook', timestamp: '2024-01-01T00:00:04Z', success: true, playbookId: 'test', isBuiltIn: true, stepCount: 5, stepsCompleted: 5, stepsFailed: 0 },
      ];

      const data: TelemetryData = {
        version: TELEMETRY_VERSION,
        installationId: 'test-123',
        enabledAt: '2024-01-01T00:00:00Z',
        events,
      };

      await aggregateEvents(data);

      const summary = data.aggregated!.summary;
      expect(summary.totalCommands).toBe(3);
      expect(summary.commandSuccessRate).toBe(1); // 3/3 = 100%
      expect(summary.totalErrors).toBe(1);
      expect(summary.errorRecoveryRate).toBe(1); // 1 attempt, 1 success
      expect(summary.totalPlaybookRuns).toBe(1);
      expect(summary.playbookSuccessRate).toBe(1);
    });

    it('creates top lists correctly', async () => {
      const events: TelemetryEvent[] = [
        { type: 'command', timestamp: '2024-01-01T00:00:00Z', command: 'snapshot', category: 'capture', success: true },
        { type: 'command', timestamp: '2024-01-01T00:00:01Z', command: 'snapshot', category: 'capture', success: true },
        { type: 'command', timestamp: '2024-01-01T00:00:02Z', command: 'inspect', category: 'inspect', success: true },
        { type: 'command', timestamp: '2024-01-01T00:00:03Z', command: 'tap', category: 'interaction', success: true },
        { type: 'error', timestamp: '2024-01-01T00:00:04Z', success: false, errorCode: 'TIMEOUT', errorCategory: 'timeout', recoveryAttempted: false },
        { type: 'error', timestamp: '2024-01-01T00:00:05Z', success: false, errorCode: 'TIMEOUT', errorCategory: 'timeout', recoveryAttempted: false },
        { type: 'error', timestamp: '2024-01-01T00:00:06Z', success: false, errorCode: 'NOT_FOUND', errorCategory: 'element', recoveryAttempted: false },
      ];

      const data: TelemetryData = {
        version: TELEMETRY_VERSION,
        installationId: 'test-123',
        enabledAt: '2024-01-01T00:00:00Z',
        events,
      };

      await aggregateEvents(data);

      const summary = data.aggregated!.summary;
      expect(summary.topCommands[0]).toEqual({ command: 'snapshot', count: 2 });
      expect(summary.topErrors[0]).toEqual({ errorCode: 'TIMEOUT', count: 2 });
    });
  });
});

// ===========================================================================
// Formatting
// ===========================================================================

describe('formatSummaryAsMarkdown', () => {
  it('formats summary with all sections', () => {
    const summary: TelemetrySummary = {
      totalCommands: 100,
      commandSuccessRate: 0.95,
      totalErrors: 5,
      errorRecoveryRate: 0.8,
      setupCompletionRate: 1,
      totalPlaybookRuns: 10,
      playbookSuccessRate: 0.9,
      topCommands: [
        { command: 'snapshot', count: 50 },
        { command: 'inspect', count: 30 },
      ],
      topErrors: [
        { errorCode: 'TIMEOUT', count: 3 },
      ],
      topPlaybooks: [
        { playbookId: 'feature-ship-loop', count: 7 },
      ],
    };

    const markdown = formatSummaryAsMarkdown(summary);

    expect(markdown).toContain('## iOS Development Usage Summary');
    expect(markdown).toContain('Total executed: **100**');
    expect(markdown).toContain('Success rate: **95.0%**');
    expect(markdown).toContain('### Most Used Commands');
    expect(markdown).toContain('`snapshot`: 50 times');
    expect(markdown).toContain('### Most Common Errors');
    expect(markdown).toContain('`TIMEOUT`: 3 occurrences');
    expect(markdown).toContain('### Most Used Playbooks');
    expect(markdown).toContain('`feature-ship-loop`: 7 runs');
  });

  it('handles empty top lists gracefully', () => {
    const summary: TelemetrySummary = {
      totalCommands: 0,
      commandSuccessRate: 0,
      totalErrors: 0,
      errorRecoveryRate: 0,
      setupCompletionRate: 0,
      totalPlaybookRuns: 0,
      playbookSuccessRate: 0,
      topCommands: [],
      topErrors: [],
      topPlaybooks: [],
    };

    const markdown = formatSummaryAsMarkdown(summary);

    expect(markdown).toContain('## iOS Development Usage Summary');
    expect(markdown).not.toContain('### Most Used Commands');
    expect(markdown).not.toContain('### Most Common Errors');
    expect(markdown).not.toContain('### Most Used Playbooks');
  });

  it('formats percentages correctly', () => {
    const summary: TelemetrySummary = {
      totalCommands: 100,
      commandSuccessRate: 0.756,
      totalErrors: 10,
      errorRecoveryRate: 0.5,
      setupCompletionRate: 0.333,
      totalPlaybookRuns: 5,
      playbookSuccessRate: 1,
      topCommands: [],
      topErrors: [],
      topPlaybooks: [],
    };

    const markdown = formatSummaryAsMarkdown(summary);

    expect(markdown).toContain('75.6%');
    expect(markdown).toContain('50.0%');
    expect(markdown).toContain('33.3%');
    expect(markdown).toContain('100.0%');
  });
});

describe('formatDataAsJson', () => {
  it('returns valid JSON string', () => {
    const data = createDefaultTelemetryData();

    const json = formatDataAsJson(data);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(TELEMETRY_VERSION);
  });

  it('preserves all data fields', () => {
    const data: TelemetryData = {
      version: TELEMETRY_VERSION,
      installationId: 'test-123',
      enabledAt: '2024-01-01T00:00:00Z',
      events: [
        { type: 'command', timestamp: '2024-01-01T00:00:00Z', command: 'test', category: 'other', success: true },
      ],
    };

    const json = formatDataAsJson(data);
    const parsed = JSON.parse(json);

    expect(parsed.installationId).toBe('test-123');
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].command).toBe('test');
  });

  it('formats with indentation for readability', () => {
    const data = createDefaultTelemetryData();

    const json = formatDataAsJson(data);

    // Pretty-printed JSON should have newlines
    expect(json).toContain('\n');
    expect(json).toContain('  '); // 2-space indentation
  });
});
