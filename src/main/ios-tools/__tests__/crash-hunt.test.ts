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
