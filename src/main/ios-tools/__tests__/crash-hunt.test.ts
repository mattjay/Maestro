/**
 * Tests for iOS Playbook - Crash Hunt Executor
 *
 * These tests verify the crash hunt playbook execution, action recording,
 * crash detection, and report generation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  runCrashHunt,
  formatCrashHuntResult,
  formatCrashHuntResultAsJson,
  formatCrashHuntResultCompact,
  type CrashHuntInputs,
  type CrashHuntOptions,
  type CrashHuntResult,
  type ActionWeights,
  type RecordedAction,
} from '../playbooks/crash-hunt';
import { ensurePlaybooksDirectory } from '../playbook-loader';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../simulator', () => ({
  getBootedSimulators: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        udid: 'test-udid-1234',
        name: 'iPhone 15 Pro',
        state: 'Booted',
        iosVersion: '17.0',
        isAvailable: true,
        runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0',
        deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
      },
    ],
  }),
  getSimulator: vi.fn().mockResolvedValue({
    success: true,
    data: {
      udid: 'test-udid-1234',
      name: 'iPhone 15 Pro',
      state: 'Booted',
      iosVersion: '17.0',
      isAvailable: true,
      runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0',
      deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
    },
  }),
  bootSimulator: vi.fn().mockResolvedValue({ success: true }),
  listSimulators: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        udid: 'test-udid-1234',
        name: 'iPhone 15 Pro',
        state: 'Booted',
        iosVersion: '17.0',
        isAvailable: true,
        runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0',
        deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
      },
    ],
  }),
  launchApp: vi.fn().mockResolvedValue({ success: true }),
  terminateApp: vi.fn().mockResolvedValue({ success: true }),
  installApp: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../build', () => ({
  build: vi.fn().mockResolvedValue({
    success: true,
    data: {
      appPath: '/tmp/test.app',
      scheme: 'TestApp',
      configuration: 'Debug',
      buildTime: 5000,
    },
  }),
  detectProject: vi.fn().mockResolvedValue({
    success: true,
    data: {
      path: '/tmp/TestApp.xcodeproj',
      type: 'xcodeproj',
    },
  }),
}));

vi.mock('../capture', () => ({
  screenshot: vi.fn().mockResolvedValue({
    success: true,
    data: {
      path: '/tmp/screenshot.png',
      size: 1024,
      timestamp: new Date(),
    },
  }),
}));

vi.mock('../logs', () => ({
  getCrashLogs: vi.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
  hasRecentCrashes: vi.fn().mockResolvedValue({
    success: true,
    data: false,
  }),
  streamLog: vi.fn().mockResolvedValue({
    success: true,
    data: {
      stop: vi.fn(),
    },
  }),
  stopLogStream: vi.fn(),
}));

vi.mock('../inspect', () => ({
  inspectUI: vi.fn().mockResolvedValue({
    success: true,
    data: {
      rootElement: {
        type: 'application',
        identifier: 'com.test.app',
        isEnabled: true,
        isHittable: true,
        isVisible: true,
        frame: { x: 0, y: 0, width: 390, height: 844 },
        children: [
          {
            type: 'button',
            identifier: 'loginButton',
            label: 'Login',
            isEnabled: true,
            isHittable: true,
            isVisible: true,
            frame: { x: 100, y: 400, width: 100, height: 44 },
          },
        ],
      },
    },
  }),
  inspectWithXCUITest: vi.fn().mockResolvedValue({
    success: true,
    data: {
      rootElement: {},
    },
  }),
}));

vi.mock('../artifacts', () => ({
  getArtifactDirectory: vi.fn().mockImplementation(async (sessionId: string) => {
    const dir = path.join(os.tmpdir(), 'crash-hunt-test-artifacts', sessionId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../utils/execFile', () => ({
  execFileNoThrow: vi.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
}));

// =============================================================================
// Test Helpers
// =============================================================================

let testDir: string;
let playbooksDir: string;

/**
 * Create a temporary test directory
 */
function createTestDir(): string {
  const dir = path.join(os.tmpdir(), `crash-hunt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Clean up test directory
 */
function cleanupTestDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Create minimal options for testing
 */
function createMinimalOptions(overrides: Partial<CrashHuntOptions> = {}): CrashHuntOptions {
  return {
    inputs: {
      bundle_id: 'com.test.app',
      duration: 5,  // Short duration for tests
      interaction_interval: 0.1,
    },
    sessionId: 'test-session-123',
    ...overrides,
  };
}

// =============================================================================
// Input Validation Tests
// =============================================================================

describe('runCrashHunt - Input Validation', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    // Create playbook.yaml for the Crash-Hunt playbook
    const playbookDir = path.join(playbooksDir, 'Crash-Hunt');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Crash Hunt',
        description: 'Navigate randomly through app to find crashes',
        version: '1.0.0',
        inputs: {
          duration: { default: 300 },
          interaction_interval: { default: 2 },
          max_depth: { default: 5 },
        },
        variables: {
          crashes_found: 0,
          actions_performed: 0,
          current_depth: 0,
        },
        steps: [{ action: 'ios.launch' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should reject inputs missing app_path, project_path, and bundle_id', async () => {
    const options: CrashHuntOptions = {
      inputs: {} as CrashHuntInputs,
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    };

    const result = await runCrashHunt(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('app_path');
  });

  it('should reject inputs with project_path but missing scheme', async () => {
    const options: CrashHuntOptions = {
      inputs: {
        project_path: '/tmp/MyApp.xcworkspace',
      },
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    };

    const result = await runCrashHunt(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('scheme');
  });

  it('should reject duration outside valid range', async () => {
    const options: CrashHuntOptions = {
      inputs: {
        bundle_id: 'com.test.app',
        duration: 100000, // Too long
      },
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    };

    const result = await runCrashHunt(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('duration');
  });

  it('should accept bundle_id only as valid input', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Dry Run Tests
// =============================================================================

describe('runCrashHunt - Dry Run', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Crash-Hunt');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Crash Hunt',
        version: '1.0.0',
        steps: [{ action: 'ios.launch' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should validate without executing when dryRun is true', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.actionsPerformed).toBe(0);
    expect(result.data!.crashesFound).toBe(0);
    expect(result.data!.completed).toBe(false);
  });

  it('should return correct playbook info in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runCrashHunt(options);

    expect(result.data!.playbook.name).toBe('iOS Crash Hunt');
    expect(result.data!.playbook.version).toBe('1.0.0');
  });

  it('should return simulator info in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runCrashHunt(options);

    expect(result.data!.simulator).toBeDefined();
    expect(result.data!.simulator.name).toBe('iPhone 15 Pro');
    expect(result.data!.simulator.iosVersion).toBe('17.0');
  });

  it('should return seed in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.seed = 12345;

    const result = await runCrashHunt(options);

    expect(result.data!.seed).toBe(12345);
  });
});

// =============================================================================
// Progress Reporting Tests
// =============================================================================

describe('runCrashHunt - Progress Reporting', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Crash-Hunt');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Crash Hunt',
        version: '1.0.0',
        steps: [{ action: 'ios.launch' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should call progress callback during dry run', async () => {
    const progressUpdates: string[] = [];
    const onProgress = vi.fn((update) => {
      progressUpdates.push(update.phase);
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runCrashHunt(options);

    expect(onProgress).toHaveBeenCalled();
    expect(progressUpdates).toContain('initializing');
  });

  it('should include phase, message, and percentComplete in progress updates', async () => {
    const updates: { phase: string; message: string; percentComplete: number }[] = [];
    const onProgress = vi.fn((update) => {
      updates.push({
        phase: update.phase,
        message: update.message,
        percentComplete: update.percentComplete,
      });
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runCrashHunt(options);

    for (const update of updates) {
      expect(update.phase).toBeDefined();
      expect(update.message).toBeDefined();
      expect(typeof update.percentComplete).toBe('number');
    }
  });

  it('should include depth and action counts in progress updates', async () => {
    const updates: { currentDepth: number; actionsPerformed: number; crashesFound: number }[] = [];
    const onProgress = vi.fn((update) => {
      updates.push({
        currentDepth: update.currentDepth,
        actionsPerformed: update.actionsPerformed,
        crashesFound: update.crashesFound,
      });
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runCrashHunt(options);

    expect(updates.length).toBeGreaterThan(0);
    for (const update of updates) {
      expect(typeof update.currentDepth).toBe('number');
      expect(typeof update.actionsPerformed).toBe('number');
      expect(typeof update.crashesFound).toBe('number');
    }
  });
});

// =============================================================================
// Result Structure Tests
// =============================================================================

describe('runCrashHunt - Result Structure', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Crash-Hunt');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Crash Hunt',
        version: '1.0.0',
        steps: [{ action: 'ios.launch' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should include all required fields in result', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runCrashHunt(options);

    expect(result.data).toBeDefined();
    const data = result.data!;

    expect(typeof data.completed).toBe('boolean');
    expect(typeof data.crashesFound).toBe('number');
    expect(typeof data.totalDuration).toBe('number');
    expect(typeof data.actionsPerformed).toBe('number');
    expect(data.startTime).toBeInstanceOf(Date);
    expect(data.endTime).toBeInstanceOf(Date);
    expect(Array.isArray(data.crashes)).toBe(true);
    expect(Array.isArray(data.actions)).toBe(true);
    expect(data.playbook).toBeDefined();
    expect(data.simulator).toBeDefined();
    expect(typeof data.artifactsDir).toBe('string');
    expect(typeof data.seed).toBe('number');
    expect(data.finalVariables).toBeDefined();
  });

  it('should use default duration when not specified', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });
    delete options.inputs.duration;

    const result = await runCrashHunt(options);

    // Default is 300 seconds
    expect(result.data!.finalVariables).toBeDefined();
  });

  it('should use specified seed for reproducibility', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.seed = 42;

    const result = await runCrashHunt(options);

    expect(result.data!.seed).toBe(42);
  });
});

// =============================================================================
// Action Weights Tests
// =============================================================================

describe('runCrashHunt - Action Weights', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Crash-Hunt');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Crash Hunt',
        version: '1.0.0',
        steps: [{ action: 'ios.launch' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should accept custom action weights', async () => {
    const customWeights: ActionWeights = {
      tap: 80,
      scroll: 10,
      swipe: 5,
      back: 5,
    };

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.action_weights = customWeights;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
  });

  it('should use default weights when not specified', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });
    // Don't specify action_weights

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Result Formatter Tests
// =============================================================================

describe('formatCrashHuntResult', () => {
  const createMockResult = (overrides: Partial<CrashHuntResult> = {}): CrashHuntResult => ({
    completed: true,
    crashesFound: 0,
    totalDuration: 300,
    actionsPerformed: 150,
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T10:05:00Z'),
    crashes: [],
    actions: [],
    playbook: { name: 'iOS Crash Hunt', version: '1.0.0' },
    simulator: { udid: 'test', name: 'iPhone 15 Pro', iosVersion: '17.0' },
    artifactsDir: '/tmp/artifacts',
    terminationReason: 'duration_reached',
    seed: 12345,
    finalVariables: { crashes_found: 0, actions_performed: 150 },
    ...overrides,
  });

  it('should format clean result with checkmark', () => {
    const result = createMockResult();
    const formatted = formatCrashHuntResult(result);

    expect(formatted).toContain('✅');
    expect(formatted).toContain('Clean');
    expect(formatted).not.toContain('🔴');
  });

  it('should format result with crashes using red indicator', () => {
    const result = createMockResult({
      crashesFound: 2,
      crashes: [
        {
          crashNumber: 1,
          timestamp: new Date(),
          bundleId: 'com.test.app',
          crashType: 'SIGABRT',
          actionsBefore: [],
          evidenceDir: '/tmp/crash1',
        },
        {
          crashNumber: 2,
          timestamp: new Date(),
          bundleId: 'com.test.app',
          crashType: 'EXC_BAD_ACCESS',
          actionsBefore: [],
          evidenceDir: '/tmp/crash2',
        },
      ],
    });

    const formatted = formatCrashHuntResult(result);

    expect(formatted).toContain('🔴');
    expect(formatted).toContain('2 Crash');
  });

  it('should include summary table', () => {
    const result = createMockResult();
    const formatted = formatCrashHuntResult(result);

    expect(formatted).toContain('| Metric | Value |');
    expect(formatted).toContain('Duration');
    expect(formatted).toContain('Actions');
    expect(formatted).toContain('Crashes');
    expect(formatted).toContain('Simulator');
    expect(formatted).toContain('Seed');
  });

  it('should include crashes section when crashes found', () => {
    const result = createMockResult({
      crashesFound: 1,
      crashes: [
        {
          crashNumber: 1,
          timestamp: new Date(),
          bundleId: 'com.test.app',
          crashType: 'SIGABRT',
          actionsBefore: [
            { actionNumber: 1, timestamp: new Date(), type: 'tap', success: true, depthAfterAction: 1 },
            { actionNumber: 2, timestamp: new Date(), type: 'scroll', success: true, depthAfterAction: 1 },
          ],
          evidenceDir: '/tmp/crash1',
        },
      ],
    });

    const formatted = formatCrashHuntResult(result);

    expect(formatted).toContain('### Crashes Detected');
    expect(formatted).toContain('#### Crash #1');
    expect(formatted).toContain('SIGABRT');
    expect(formatted).toContain('Steps to Reproduce');
  });

  it('should include seed for reproducibility', () => {
    const result = createMockResult({ seed: 98765 });
    const formatted = formatCrashHuntResult(result);

    expect(formatted).toContain('98765');
  });

  it('should include reports section when paths available', () => {
    const result = createMockResult({
      htmlReportPath: '/tmp/crash_report.html',
      jsonReportPath: '/tmp/crash_report.json',
    });

    const formatted = formatCrashHuntResult(result);

    expect(formatted).toContain('### Reports');
    expect(formatted).toContain('HTML');
    expect(formatted).toContain('JSON');
  });

  it('should include error section when error present', () => {
    const result = createMockResult({
      completed: false,
      terminationReason: 'error',
      error: 'Simulator crashed unexpectedly',
    });

    const formatted = formatCrashHuntResult(result);

    expect(formatted).toContain('### Error');
    expect(formatted).toContain('Simulator crashed unexpectedly');
  });
});

describe('formatCrashHuntResultAsJson', () => {
  it('should return valid JSON string', () => {
    const result: CrashHuntResult = {
      completed: true,
      crashesFound: 0,
      totalDuration: 300,
      actionsPerformed: 100,
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:05:00Z'),
      crashes: [],
      actions: [],
      playbook: { name: 'Test', version: '1.0.0' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      artifactsDir: '/tmp',
      terminationReason: 'duration_reached',
      seed: 12345,
      finalVariables: {},
    };

    const json = formatCrashHuntResultAsJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.completed).toBe(true);
    expect(parsed.crashesFound).toBe(0);
    expect(parsed.seed).toBe(12345);
  });

  it('should be pretty-printed with 2-space indentation', () => {
    const result: CrashHuntResult = {
      completed: true,
      crashesFound: 0,
      totalDuration: 100,
      actionsPerformed: 50,
      startTime: new Date(),
      endTime: new Date(),
      crashes: [],
      actions: [],
      playbook: { name: 'Test' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      artifactsDir: '/tmp',
      terminationReason: 'duration_reached',
      seed: 1,
      finalVariables: {},
    };

    const json = formatCrashHuntResultAsJson(result);

    expect(json).toContain('\n');
    expect(json).toContain('  '); // 2-space indent
  });
});

describe('formatCrashHuntResultCompact', () => {
  it('should format clean result compactly', () => {
    const result: CrashHuntResult = {
      completed: true,
      crashesFound: 0,
      totalDuration: 300,
      actionsPerformed: 150,
      startTime: new Date(),
      endTime: new Date(),
      crashes: [],
      actions: [],
      playbook: { name: 'Test' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      artifactsDir: '/tmp',
      terminationReason: 'duration_reached',
      seed: 12345,
      finalVariables: {},
    };

    const compact = formatCrashHuntResultCompact(result);

    expect(compact).toContain('[CLEAN]');
    expect(compact).toContain('300s');
    expect(compact).toContain('150 actions');
    expect(compact).toContain('0 crashes');
    expect(compact).toContain('seed: 12345');
  });

  it('should format result with crashes compactly', () => {
    const result: CrashHuntResult = {
      completed: true,
      crashesFound: 3,
      totalDuration: 600,
      actionsPerformed: 300,
      startTime: new Date(),
      endTime: new Date(),
      crashes: [],
      actions: [],
      playbook: { name: 'Test' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      artifactsDir: '/tmp',
      terminationReason: 'duration_reached',
      seed: 54321,
      finalVariables: {},
    };

    const compact = formatCrashHuntResultCompact(result);

    expect(compact).toContain('[CRASH]');
    expect(compact).toContain('3 crashes');
    expect(compact).toContain('seed: 54321');
  });
});

// =============================================================================
// Variable Tracking Tests
// =============================================================================

describe('runCrashHunt - Variable Tracking', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Crash-Hunt');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Crash Hunt',
        version: '1.0.0',
        variables: {
          crashes_found: 0,
          actions_performed: 0,
          current_depth: 0,
          start_time: '',
          elapsed_seconds: 0,
          crash_detected: false,
        },
        steps: [{ action: 'ios.launch' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should initialize variables from playbook', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runCrashHunt(options);

    expect(result.data!.finalVariables).toBeDefined();
    expect(result.data!.finalVariables.crashes_found).toBe(0);
    expect(result.data!.finalVariables.actions_performed).toBe(0);
    expect(result.data!.finalVariables.crash_detected).toBe(false);
  });
});

// =============================================================================
// Excluded Elements Tests
// =============================================================================

describe('runCrashHunt - Excluded Elements', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Crash-Hunt');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Crash Hunt',
        version: '1.0.0',
        steps: [{ action: 'ios.launch' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should accept excluded elements list', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.excluded_elements = ['deleteAccount', 'logoutButton', 'settingsGear'];

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Max Depth Tests
// =============================================================================

describe('runCrashHunt - Max Depth', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Crash-Hunt');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Crash Hunt',
        version: '1.0.0',
        steps: [{ action: 'ios.launch' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should use default max_depth of 5', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });
    // Don't specify max_depth

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
  });

  it('should accept custom max_depth', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.max_depth = 10;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Integration Tests - Crash Detection and Reporting
// =============================================================================

describe('runCrashHunt - Crash Detection and Reporting Integration', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Crash-Hunt');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Crash Hunt',
        version: '1.0.0',
        variables: {
          crashes_found: 0,
          actions_performed: 0,
          current_depth: 0,
          start_time: '',
          elapsed_seconds: 0,
          crash_detected: false,
        },
        steps: [{ action: 'ios.launch' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should detect crashes when hasRecentCrashes returns true', async () => {
    // Configure hasRecentCrashes to return true immediately to simulate a crash
    const { hasRecentCrashes } = await import('../logs');
    vi.mocked(hasRecentCrashes).mockResolvedValue({
      success: true,
      data: true,
    });

    const crashDetected = vi.fn();

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      onCrash: crashDetected,
    });
    options.inputs.duration = 2; // Very short duration
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false; // Stop after first crash

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    // Should detect at least one crash
    expect(result.data!.crashesFound).toBeGreaterThanOrEqual(1);
    expect(result.data!.crashes.length).toBeGreaterThanOrEqual(1);
    expect(result.data!.terminationReason).toBe('crash_no_reset');
  });

  it('should record actions leading up to a crash for reproduction', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let crashCheckCount = 0;

    // Return false for first 3 checks, then true to simulate crash
    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      crashCheckCount++;
      return {
        success: true,
        data: crashCheckCount > 3,
      };
    });

    const recordedActions: RecordedAction[] = [];
    const onAction = vi.fn((action) => {
      recordedActions.push(action);
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      onAction,
    });
    options.inputs.duration = 5;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    // Should have recorded actions before crash
    expect(result.data!.actionsPerformed).toBeGreaterThan(0);
    expect(onAction).toHaveBeenCalled();

    // Crashes should include actionsBefore
    if (result.data!.crashes.length > 0) {
      expect(Array.isArray(result.data!.crashes[0].actionsBefore)).toBe(true);
    }
  });

  it('should invoke onCrash callback when crash is detected', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 2,
      };
    });

    const crashCallback = vi.fn();

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      onCrash: crashCallback,
    });
    options.inputs.duration = 3;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    if (result.data!.crashesFound > 0) {
      expect(crashCallback).toHaveBeenCalled();
      const crashArg = crashCallback.mock.calls[0][0];
      expect(crashArg.crashNumber).toBe(1);
      expect(crashArg.bundleId).toBeDefined();
      expect(crashArg.timestamp).toBeInstanceOf(Date);
      expect(crashArg.evidenceDir).toBeDefined();
    }
  });

  it('should capture crash evidence including screenshot', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 2,
      };
    });

    // Configure screenshot mock to create actual file
    const { screenshot } = await import('../capture');
    vi.mocked(screenshot).mockImplementation(async (opts) => {
      const dir = path.dirname(opts.outputPath!);
      fs.mkdirSync(dir, { recursive: true });
      const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      fs.writeFileSync(opts.outputPath!, pngHeader);
      return {
        success: true,
        data: {
          path: opts.outputPath!,
          size: pngHeader.length,
          timestamp: new Date(),
        },
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 3;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;
    options.inputs.capture_on_crash = true;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    if (result.data!.crashes.length > 0) {
      const crash = result.data!.crashes[0];
      // Evidence directory should exist
      expect(fs.existsSync(crash.evidenceDir)).toBe(true);
      // Screenshot should be captured (path should be set)
      expect(crash.screenshotPath).toBeDefined();
    }
  });

  it('should recover from crash and continue hunting when reset_on_crash is true', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    // Return crash at check 3, then no more crashes
    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      const shouldCrash = checkCount === 3;
      return {
        success: true,
        data: shouldCrash,
      };
    });

    const { launchApp, terminateApp } = await import('../simulator');

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 3;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = true; // Should recover and continue

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    // Hunt should complete (not terminated by crash)
    expect(result.data!.terminationReason).toBe('duration_reached');
    // Should have called recovery (terminate + relaunch)
    if (result.data!.crashesFound > 0) {
      expect(terminateApp).toHaveBeenCalled();
      expect(launchApp).toHaveBeenCalled();
    }
  });

  it('should stop hunting when reset_on_crash is false after crash', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 2,
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 10; // Long duration
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false; // Should stop on crash

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    // Should terminate early due to crash
    expect(result.data!.terminationReason).toBe('crash_no_reset');
    // Duration should be less than configured
    expect(result.data!.totalDuration).toBeLessThan(10);
  });

  it('should update crashes_found variable when crash detected', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 2,
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 3;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    if (result.data!.crashesFound > 0) {
      expect(result.data!.finalVariables.crashes_found).toBe(result.data!.crashesFound);
    }
  });

  it('should generate HTML report with crash details', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 2,
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 3;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    expect(result.data!.htmlReportPath).toBeDefined();
    expect(fs.existsSync(result.data!.htmlReportPath!)).toBe(true);

    const htmlContent = fs.readFileSync(result.data!.htmlReportPath!, 'utf-8');
    expect(htmlContent).toContain('Crash Hunt Report');
    expect(htmlContent).toContain('Simulator');

    if (result.data!.crashesFound > 0) {
      expect(htmlContent).toContain('Crash');
    }
  });

  it('should generate JSON report with crash details', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 2,
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 3;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    expect(result.data!.jsonReportPath).toBeDefined();
    expect(fs.existsSync(result.data!.jsonReportPath!)).toBe(true);

    const jsonContent = fs.readFileSync(result.data!.jsonReportPath!, 'utf-8');
    const report = JSON.parse(jsonContent);

    expect(report.simulator).toBeDefined();
    expect(report.duration).toBeDefined();
    expect(report.actionsPerformed).toBeDefined();
    expect(report.crashesFound).toBeDefined();
    expect(Array.isArray(report.crashes)).toBe(true);
  });

  it('should include steps to reproduce in crash report', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 3,
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 5;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    if (result.data!.crashes.length > 0) {
      const crash = result.data!.crashes[0];
      // Should have steps to reproduce
      expect(Array.isArray(crash.actionsBefore)).toBe(true);
      // Steps should have action details
      if (crash.actionsBefore.length > 0) {
        expect(crash.actionsBefore[0].type).toBeDefined();
        expect(crash.actionsBefore[0].actionNumber).toBeDefined();
      }

      // Check JSON report includes steps
      const jsonContent = fs.readFileSync(result.data!.jsonReportPath!, 'utf-8');
      const report = JSON.parse(jsonContent);
      if (report.crashes.length > 0) {
        expect(report.crashes[0].stepsToReproduce).toBeDefined();
      }
    }
  });

  it('should include seed in result for reproducibility', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 2;
    options.inputs.interaction_interval = 0.1;
    options.inputs.seed = 54321;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    expect(result.data!.seed).toBe(54321);

    // HTML report should include seed
    const htmlContent = fs.readFileSync(result.data!.htmlReportPath!, 'utf-8');
    expect(htmlContent).toContain('54321');

    // JSON report should include seed
    const jsonContent = fs.readFileSync(result.data!.jsonReportPath!, 'utf-8');
    const report = JSON.parse(jsonContent);
    expect(report.seed).toBe(54321);
  });

  it('should record all action types during hunt', async () => {
    const recordedTypes = new Set<string>();
    const onAction = vi.fn((action) => {
      recordedTypes.add(action.type);
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      onAction,
    });
    options.inputs.duration = 3;
    options.inputs.interaction_interval = 0.05;
    // Use a seed that produces variety
    options.inputs.seed = 12345;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    expect(result.data!.actionsPerformed).toBeGreaterThan(0);
    // Should have recorded actions with various types
    expect(onAction).toHaveBeenCalled();
    // At least one action type should be present
    expect(recordedTypes.size).toBeGreaterThan(0);
  });

  it('should save steps.json file in crash evidence directory', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 3,
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 5;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;
    options.inputs.capture_on_crash = true;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    if (result.data!.crashes.length > 0) {
      const crash = result.data!.crashes[0];
      const stepsPath = path.join(crash.evidenceDir, 'steps.json');
      expect(fs.existsSync(stepsPath)).toBe(true);

      const stepsContent = JSON.parse(fs.readFileSync(stepsPath, 'utf-8'));
      expect(Array.isArray(stepsContent)).toBe(true);
    }
  });

  it('should report progress phases during crash detection', async () => {
    const phases: string[] = [];
    const onProgress = vi.fn((update) => {
      if (!phases.includes(update.phase)) {
        phases.push(update.phase);
      }
    });

    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 3,
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      onProgress,
    });
    options.inputs.duration = 5;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;

    await runCrashHunt(options);

    // Should include key phases
    expect(phases).toContain('initializing');
    expect(phases).toContain('hunting');
    expect(phases).toContain('generating_report');
    // Should end with complete or a terminal state
    expect(phases.some(p => ['complete', 'failed'].includes(p))).toBe(true);
  });

  it('should report crash count in progress updates', async () => {
    let maxCrashesReported = 0;
    const onProgress = vi.fn((update) => {
      if (update.crashesFound !== undefined) {
        maxCrashesReported = Math.max(maxCrashesReported, update.crashesFound);
      }
    });

    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 2,
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
      onProgress,
    });
    options.inputs.duration = 3;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    // Progress should have reported crash count
    expect(onProgress).toHaveBeenCalled();
    if (result.data!.crashesFound > 0) {
      expect(maxCrashesReported).toBeGreaterThanOrEqual(1);
    }
  });

  it('should skip capture when capture_on_crash is false', async () => {
    const { hasRecentCrashes } = await import('../logs');
    let checkCount = 0;

    vi.mocked(hasRecentCrashes).mockImplementation(async () => {
      checkCount++;
      return {
        success: true,
        data: checkCount > 2,
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 3;
    options.inputs.interaction_interval = 0.1;
    options.inputs.reset_on_crash = false;
    options.inputs.capture_on_crash = false;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    // With capture_on_crash false, screenshot should not be in evidence
    if (result.data!.crashes.length > 0) {
      expect(result.data!.crashes[0].screenshotPath).toBeUndefined();
    }
  });

  it('should complete clean hunt with no crashes', async () => {
    // hasRecentCrashes always returns false
    const { hasRecentCrashes } = await import('../logs');
    vi.mocked(hasRecentCrashes).mockResolvedValue({
      success: true,
      data: false,
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Crash-Hunt', 'playbook.yaml'),
    });
    options.inputs.duration = 2;
    options.inputs.interaction_interval = 0.1;

    const result = await runCrashHunt(options);

    expect(result.success).toBe(true);
    expect(result.data!.completed).toBe(true);
    expect(result.data!.crashesFound).toBe(0);
    expect(result.data!.crashes.length).toBe(0);
    expect(result.data!.terminationReason).toBe('duration_reached');
    expect(result.data!.actionsPerformed).toBeGreaterThan(0);
  });
});
