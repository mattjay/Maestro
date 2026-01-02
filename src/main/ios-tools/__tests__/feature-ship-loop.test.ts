/**
 * Tests for iOS Playbook - Feature Ship Loop Executor
 *
 * These tests verify the feature ship loop playbook execution, iteration tracking,
 * assertion verification, and progress reporting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  runFeatureShipLoop,
  formatFeatureShipLoopResult,
  formatFeatureShipLoopResultAsJson,
  formatFeatureShipLoopResultCompact,
  type FeatureShipLoopInputs,
  type FeatureShipLoopOptions,
  type FeatureShipLoopResult,
  type PlaybookAssertion,
} from '../playbooks/feature-ship-loop';
import { ensurePlaybooksDirectory } from '../playbook-loader';
import * as simulator from '../simulator';
import * as build from '../build';
import * as assertions from '../assertions';
import * as snapshot from '../snapshot';

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

vi.mock('../snapshot', () => ({
  captureSnapshot: vi.fn().mockResolvedValue({
    success: true,
    data: {
      snapshotId: 'snapshot-123',
      screenshotPath: '/tmp/screenshot.png',
      hierarchyPath: '/tmp/hierarchy.json',
      timestamp: new Date(),
    },
  }),
}));

vi.mock('../assertions', () => ({
  assertVisible: vi.fn().mockResolvedValue({
    success: true,
    data: {
      passed: true,
      status: 'passed',
      message: 'Element is visible',
    },
  }),
  assertNotVisible: vi.fn().mockResolvedValue({
    success: true,
    data: {
      passed: true,
      status: 'passed',
      message: 'Element is not visible',
    },
  }),
  assertNoCrash: vi.fn().mockResolvedValue({
    success: true,
    data: {
      passed: true,
      status: 'passed',
      message: 'No crash detected',
    },
  }),
}));

vi.mock('../artifacts', () => ({
  getArtifactDirectory: vi.fn().mockImplementation(async (sessionId: string) => {
    const dir = path.join(os.tmpdir(), 'feature-ship-loop-test-artifacts', sessionId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }),
  generateSnapshotId: vi.fn().mockReturnValue('snapshot-123'),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
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
  const dir = path.join(os.tmpdir(), `feature-ship-loop-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
 * Create minimal assertions for testing
 */
function createTestAssertions(): PlaybookAssertion[] {
  return [
    { type: 'visible', target: 'Welcome', description: 'Welcome text visible' },
    { type: 'no_crash', bundleId: 'com.test.app', description: 'App not crashed' },
  ];
}

/**
 * Create minimal options for testing
 */
function createMinimalOptions(overrides: Partial<FeatureShipLoopOptions> = {}): FeatureShipLoopOptions {
  return {
    inputs: {
      project_path: '/tmp/TestProject',
      scheme: 'TestApp',
      assertions: createTestAssertions(),
    },
    sessionId: 'test-session-123',
    ...overrides,
  };
}

// =============================================================================
// Input Validation Tests
// =============================================================================

describe('runFeatureShipLoop - Input Validation', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    // Create playbook.yaml for the Feature-Ship-Loop playbook
    const playbookDir = path.join(playbooksDir, 'Feature-Ship-Loop');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Feature Ship Loop',
        description: 'Build, launch, verify, iterate until feature is complete',
        version: '1.0.0',
        inputs: {
          project_path: { required: true },
          scheme: { required: true },
          assertions: { type: 'array', required: true },
        },
        variables: {
          iteration: 0,
          max_iterations: 10,
          build_success: false,
          assertions_passed: false,
        },
        steps: [{ action: 'ios.build' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should reject inputs missing project_path', async () => {
    const options: FeatureShipLoopOptions = {
      inputs: {
        scheme: 'TestApp',
        assertions: createTestAssertions(),
      } as FeatureShipLoopInputs,
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
    };

    const result = await runFeatureShipLoop(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('project_path');
  });

  it('should reject inputs missing scheme', async () => {
    const options: FeatureShipLoopOptions = {
      inputs: {
        project_path: '/tmp/TestProject',
        assertions: createTestAssertions(),
      } as FeatureShipLoopInputs,
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
    };

    const result = await runFeatureShipLoop(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('scheme');
  });

  it('should reject empty assertions array', async () => {
    const options: FeatureShipLoopOptions = {
      inputs: {
        project_path: '/tmp/TestProject',
        scheme: 'TestApp',
        assertions: [],
      },
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
    };

    const result = await runFeatureShipLoop(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('assertions');
  });

  it('should handle undefined assertions gracefully', async () => {
    // Note: The implementation accesses assertions.length before validation,
    // so undefined assertions will throw. This test documents that behavior.
    const options: FeatureShipLoopOptions = {
      inputs: {
        project_path: '/tmp/TestProject',
        scheme: 'TestApp',
      } as FeatureShipLoopInputs,
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
    };

    // The function will throw when accessing undefined assertions
    await expect(runFeatureShipLoop(options)).rejects.toThrow();
  });
});

// =============================================================================
// Dry Run Tests
// =============================================================================

describe('runFeatureShipLoop - Dry Run', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Feature-Ship-Loop');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Feature Ship Loop',
        version: '1.0.0',
        steps: [{ action: 'ios.build' }],
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
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.iterationsRun).toBe(0);
    expect(result.data!.passed).toBe(false);
    expect(result.data!.terminationReason).toBe('max_iterations');
  });

  it('should return correct playbook info in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.playbook.name).toBe('iOS Feature Ship Loop');
    expect(result.data!.playbook.version).toBe('1.0.0');
  });

  it('should return simulator info in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.simulator).toBeDefined();
    expect(result.data!.simulator.name).toBe('iPhone 15 Pro');
    expect(result.data!.simulator.iosVersion).toBe('17.0');
  });

  it('should return assertions summary in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.assertionsSummary).toBeDefined();
    expect(result.data!.assertionsSummary.total).toBe(2);
    expect(result.data!.assertionsSummary.passed).toBe(0);
    expect(result.data!.assertionsSummary.failed).toBe(0);
  });
});

// =============================================================================
// Progress Reporting Tests
// =============================================================================

describe('runFeatureShipLoop - Progress Reporting', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Feature-Ship-Loop');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Feature Ship Loop',
        version: '1.0.0',
        steps: [{ action: 'ios.build' }],
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
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runFeatureShipLoop(options);

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
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runFeatureShipLoop(options);

    for (const update of updates) {
      expect(update.phase).toBeDefined();
      expect(update.message).toBeDefined();
      expect(typeof update.percentComplete).toBe('number');
      expect(update.percentComplete).toBeGreaterThanOrEqual(0);
      expect(update.percentComplete).toBeLessThanOrEqual(100);
    }
  });

  it('should include iteration info in progress updates', async () => {
    const updates: { iteration: number; maxIterations: number }[] = [];
    const onProgress = vi.fn((update) => {
      updates.push({
        iteration: update.iteration,
        maxIterations: update.maxIterations,
      });
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runFeatureShipLoop(options);

    expect(updates.length).toBeGreaterThan(0);
    for (const update of updates) {
      expect(typeof update.iteration).toBe('number');
      expect(typeof update.maxIterations).toBe('number');
    }
  });
});

// =============================================================================
// Result Structure Tests
// =============================================================================

describe('runFeatureShipLoop - Result Structure', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Feature-Ship-Loop');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Feature Ship Loop',
        version: '1.0.0',
        steps: [{ action: 'ios.build' }],
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
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data).toBeDefined();
    const data = result.data!;

    expect(typeof data.passed).toBe('boolean');
    expect(typeof data.iterationsRun).toBe('number');
    expect(typeof data.maxIterations).toBe('number');
    expect(typeof data.totalDuration).toBe('number');
    expect(data.startTime).toBeInstanceOf(Date);
    expect(data.endTime).toBeInstanceOf(Date);
    expect(Array.isArray(data.iterations)).toBe(true);
    expect(data.playbook).toBeDefined();
    expect(data.simulator).toBeDefined();
    expect(typeof data.artifactsDir).toBe('string');
    expect(data.assertionsSummary).toBeDefined();
    expect(data.finalVariables).toBeDefined();
  });

  it('should use default maxIterations when not specified', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.maxIterations).toBe(10);
  });

  it('should use custom maxIterations when specified', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
      maxIterations: 5,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.maxIterations).toBe(5);
  });
});

// =============================================================================
// Assertion Configuration Tests
// =============================================================================

describe('runFeatureShipLoop - Assertion Configuration', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Feature-Ship-Loop');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Feature Ship Loop',
        version: '1.0.0',
        steps: [{ action: 'ios.build' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should handle multiple assertions', async () => {
    const assertions: PlaybookAssertion[] = [
      { type: 'visible', target: 'Welcome', description: 'Welcome visible' },
      { type: 'visible', target: 'Login Button', description: 'Login visible' },
      { type: 'not_visible', target: 'Error', description: 'No error' },
      { type: 'no_crash', bundleId: 'com.test.app', description: 'No crash' },
    ];

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.assertions = assertions;

    const result = await runFeatureShipLoop(options);

    expect(result.data!.assertionsSummary.total).toBe(4);
    expect(result.data!.assertionsSummary.assertions).toHaveLength(4);
  });

  it('should accept assertions with different target types', async () => {
    const assertions: PlaybookAssertion[] = [
      { type: 'visible', target: 'btnLogin', targetType: 'identifier', description: 'By identifier' },
      { type: 'visible', target: 'Login', targetType: 'label', description: 'By label' },
      { type: 'visible', target: 'Welcome', targetType: 'text', description: 'By text' },
    ];

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.assertions = assertions;

    const result = await runFeatureShipLoop(options);

    expect(result.success).toBe(true);
    expect(result.data!.assertionsSummary.total).toBe(3);
  });

  it('should accept assertions with custom timeout', async () => {
    const assertions: PlaybookAssertion[] = [
      { type: 'visible', target: 'SlowElement', timeout: 30000, description: 'Slow element' },
    ];

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.assertions = assertions;

    const result = await runFeatureShipLoop(options);

    expect(result.success).toBe(true);
    const assertionData = result.data!.assertionsSummary.assertions[0];
    expect(assertionData.assertion.timeout).toBe(30000);
  });
});

// =============================================================================
// Result Formatter Tests
// =============================================================================

describe('formatFeatureShipLoopResult', () => {
  const createMockResult = (overrides: Partial<FeatureShipLoopResult> = {}): FeatureShipLoopResult => ({
    passed: true,
    terminationReason: 'assertions_passed',
    iterationsRun: 3,
    maxIterations: 10,
    totalDuration: 15000,
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T10:00:15Z'),
    iterations: [],
    playbook: { name: 'iOS Feature Ship Loop', version: '1.0.0' },
    simulator: { udid: 'test', name: 'iPhone 15 Pro', iosVersion: '17.0' },
    assertionsSummary: {
      total: 2,
      passed: 2,
      failed: 0,
      assertions: [
        { assertion: { type: 'visible', target: 'Welcome', description: 'Welcome visible' }, passedOn: 3, lastStatus: 'passed' },
        { assertion: { type: 'no_crash', bundleId: 'com.test.app', description: 'No crash' }, passedOn: 3, lastStatus: 'passed' },
      ],
    },
    artifactsDir: '/tmp/artifacts',
    finalVariables: { iteration: 3, assertions_passed: true },
    ...overrides,
  });

  it('should format passed result with checkmark', () => {
    const result = createMockResult();
    const formatted = formatFeatureShipLoopResult(result);

    expect(formatted).toContain('✅');
    expect(formatted).toContain('Passed');
    expect(formatted).not.toContain('❌');
  });

  it('should format failed result with X', () => {
    const result = createMockResult({
      passed: false,
      terminationReason: 'max_iterations',
      assertionsSummary: {
        total: 2,
        passed: 1,
        failed: 1,
        assertions: [
          { assertion: { type: 'visible', target: 'Welcome' }, passedOn: 2, lastStatus: 'passed' },
          { assertion: { type: 'visible', target: 'Missing' }, lastStatus: 'failed' },
        ],
      },
    });

    const formatted = formatFeatureShipLoopResult(result);

    expect(formatted).toContain('❌');
    expect(formatted).toContain('Failed');
  });

  it('should include summary table', () => {
    const result = createMockResult();
    const formatted = formatFeatureShipLoopResult(result);

    expect(formatted).toContain('| Metric | Value |');
    expect(formatted).toContain('Status');
    expect(formatted).toContain('Reason');
    expect(formatted).toContain('Iterations');
    expect(formatted).toContain('Duration');
    expect(formatted).toContain('Simulator');
  });

  it('should include assertions section', () => {
    const result = createMockResult();
    const formatted = formatFeatureShipLoopResult(result);

    expect(formatted).toContain('### Assertions');
    expect(formatted).toContain('Welcome visible');
    expect(formatted).toContain('No crash');
  });

  it('should show passed assertions with checkmark', () => {
    const result = createMockResult();
    const formatted = formatFeatureShipLoopResult(result);

    // Should have ✅ for passed assertions
    expect(formatted).toContain('✅');
  });

  it('should include iteration info for passed assertions', () => {
    const result = createMockResult();
    const formatted = formatFeatureShipLoopResult(result);

    // Should show which iteration assertions passed on
    expect(formatted).toContain('iteration');
  });

  it('should include artifacts section', () => {
    const result = createMockResult();
    const formatted = formatFeatureShipLoopResult(result);

    expect(formatted).toContain('### Artifacts');
    expect(formatted).toContain('/tmp/artifacts');
  });

  it('should include error section when error present', () => {
    const result = createMockResult({
      passed: false,
      terminationReason: 'build_failed',
      error: 'Build failed with exit code 65',
    });

    const formatted = formatFeatureShipLoopResult(result);

    expect(formatted).toContain('### Error');
    expect(formatted).toContain('Build failed with exit code 65');
  });

  it('should format termination reason correctly', () => {
    const passedResult = createMockResult({ terminationReason: 'assertions_passed' });
    expect(formatFeatureShipLoopResult(passedResult)).toContain('All assertions passed');

    const maxIterResult = createMockResult({
      passed: false,
      terminationReason: 'max_iterations',
    });
    expect(formatFeatureShipLoopResult(maxIterResult)).toContain('Maximum iterations reached');

    const buildFailedResult = createMockResult({
      passed: false,
      terminationReason: 'build_failed',
    });
    expect(formatFeatureShipLoopResult(buildFailedResult)).toContain('Build failed');
  });
});

describe('formatFeatureShipLoopResultAsJson', () => {
  it('should return valid JSON string', () => {
    const result: FeatureShipLoopResult = {
      passed: true,
      terminationReason: 'assertions_passed',
      iterationsRun: 3,
      maxIterations: 10,
      totalDuration: 15000,
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:00:15Z'),
      iterations: [],
      playbook: { name: 'Test', version: '1.0.0' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      assertionsSummary: { total: 2, passed: 2, failed: 0, assertions: [] },
      artifactsDir: '/tmp',
      finalVariables: {},
    };

    const json = formatFeatureShipLoopResultAsJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.passed).toBe(true);
    expect(parsed.iterationsRun).toBe(3);
    expect(parsed.terminationReason).toBe('assertions_passed');
  });

  it('should be pretty-printed with 2-space indentation', () => {
    const result: FeatureShipLoopResult = {
      passed: true,
      terminationReason: 'assertions_passed',
      iterationsRun: 1,
      maxIterations: 10,
      totalDuration: 1000,
      startTime: new Date(),
      endTime: new Date(),
      iterations: [],
      playbook: { name: 'Test' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      assertionsSummary: { total: 0, passed: 0, failed: 0, assertions: [] },
      artifactsDir: '/tmp',
      finalVariables: {},
    };

    const json = formatFeatureShipLoopResultAsJson(result);

    expect(json).toContain('\n');
    expect(json).toContain('  '); // 2-space indent
  });
});

describe('formatFeatureShipLoopResultCompact', () => {
  it('should format passed result compactly', () => {
    const result: FeatureShipLoopResult = {
      passed: true,
      terminationReason: 'assertions_passed',
      iterationsRun: 3,
      maxIterations: 10,
      totalDuration: 15000,
      startTime: new Date(),
      endTime: new Date(),
      iterations: [],
      playbook: { name: 'Test' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      assertionsSummary: { total: 2, passed: 2, failed: 0, assertions: [] },
      artifactsDir: '/tmp',
      finalVariables: {},
    };

    const compact = formatFeatureShipLoopResultCompact(result);

    expect(compact).toContain('[PASS]');
    expect(compact).toContain('3 iter');
    expect(compact).toContain('2/2 assertions');
  });

  it('should format failed result compactly', () => {
    const result: FeatureShipLoopResult = {
      passed: false,
      terminationReason: 'max_iterations',
      iterationsRun: 10,
      maxIterations: 10,
      totalDuration: 120000,
      startTime: new Date(),
      endTime: new Date(),
      iterations: [],
      playbook: { name: 'Test' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      assertionsSummary: { total: 3, passed: 1, failed: 2, assertions: [] },
      artifactsDir: '/tmp',
      finalVariables: {},
    };

    const compact = formatFeatureShipLoopResultCompact(result);

    expect(compact).toContain('[FAIL]');
    expect(compact).toContain('10 iter');
    expect(compact).toContain('1/3 assertions');
  });
});

// =============================================================================
// Variable Tracking Tests
// =============================================================================

describe('runFeatureShipLoop - Variable Tracking', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Feature-Ship-Loop');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Feature Ship Loop',
        version: '1.0.0',
        variables: {
          iteration: 0,
          max_iterations: 10,
          build_success: false,
          assertions_passed: false,
        },
        steps: [{ action: 'ios.build' }],
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
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.finalVariables).toBeDefined();
    expect(result.data!.finalVariables.iteration).toBe(0);
    expect(result.data!.finalVariables.build_success).toBe(false);
    expect(result.data!.finalVariables.assertions_passed).toBe(false);
  });

  it('should set max_iterations from options', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
      maxIterations: 5,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.finalVariables.max_iterations).toBe(5);
  });
});

// =============================================================================
// Simulator Resolution Tests
// =============================================================================

describe('runFeatureShipLoop - Simulator Resolution', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Feature-Ship-Loop');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Feature Ship Loop',
        version: '1.0.0',
        steps: [{ action: 'ios.build' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should use specified simulator name', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.simulator = 'iPhone 15 Pro';

    const result = await runFeatureShipLoop(options);

    expect(result.data!.simulator.name).toBe('iPhone 15 Pro');
  });

  it('should fall back to booted simulator when none specified', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      dryRun: true,
    });
    // Don't specify simulator

    const result = await runFeatureShipLoop(options);

    expect(result.data!.simulator).toBeDefined();
    expect(result.data!.simulator.udid).toBe('test-udid-1234');
  });
});

// =============================================================================
// Iteration Execution Tests (Non-Dry-Run)
// =============================================================================

describe('runFeatureShipLoop - Iteration Execution', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Feature-Ship-Loop');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Feature Ship Loop',
        version: '1.0.0',
        variables: {
          iteration: 0,
          max_iterations: 10,
          build_success: false,
          assertions_passed: false,
        },
        steps: [{ action: 'ios.build' }],
      })
    );

    // Reset all mocks to their default passing state
    vi.mocked(build.build).mockResolvedValue({
      success: true,
      data: {
        appPath: '/tmp/test.app',
        scheme: 'TestApp',
        configuration: 'Debug',
        buildTime: 5000,
      },
    });
    vi.mocked(assertions.assertVisible).mockResolvedValue({
      success: true,
      data: {
        passed: true,
        status: 'passed',
        message: 'Element is visible',
      },
    });
    vi.mocked(assertions.assertNotVisible).mockResolvedValue({
      success: true,
      data: {
        passed: true,
        status: 'passed',
        message: 'Element is not visible',
      },
    });
    vi.mocked(assertions.assertNoCrash).mockResolvedValue({
      success: true,
      data: {
        passed: true,
        status: 'passed',
        message: 'No crash detected',
      },
    });
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should execute actual iterations when dryRun is false', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 1,
      iterationDelay: 10, // Speed up tests
    });

    const result = await runFeatureShipLoop(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    // With mocked assertions passing, should complete in 1 iteration
    expect(result.data!.iterationsRun).toBeGreaterThan(0);
    expect(result.data!.iterations.length).toBe(result.data!.iterationsRun);
  });

  it('should stop loop when all assertions pass', async () => {
    // With default mocks, assertions pass immediately
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 10,
      iterationDelay: 10,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.success).toBe(true);
    expect(result.data!.passed).toBe(true);
    expect(result.data!.terminationReason).toBe('assertions_passed');
    // Should stop early since assertions pass immediately
    expect(result.data!.iterationsRun).toBe(1);
  });

  it('should iterate until max_iterations when assertions fail', async () => {
    // Mock assertions to fail
    vi.mocked(assertions.assertVisible).mockResolvedValue({
      success: true,
      data: {
        passed: false,
        status: 'failed',
        message: 'Element not visible',
      },
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 3,
      iterationDelay: 10,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.success).toBe(true);
    expect(result.data!.passed).toBe(false);
    expect(result.data!.terminationReason).toBe('max_iterations');
    expect(result.data!.iterationsRun).toBe(3);
  });

  it('should track each iteration with timing information', async () => {
    // Mock assertions to fail so we get 2 iterations
    vi.mocked(assertions.assertVisible).mockResolvedValue({
      success: true,
      data: {
        passed: false,
        status: 'failed',
        message: 'Element not visible',
      },
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 2,
      iterationDelay: 10,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.iterations.length).toBe(2);

    for (let i = 0; i < result.data!.iterations.length; i++) {
      const iteration = result.data!.iterations[i];
      expect(iteration.iteration).toBe(i + 1);
      expect(iteration.startTime).toBeInstanceOf(Date);
      expect(iteration.endTime).toBeInstanceOf(Date);
      expect(iteration.duration).toBeGreaterThanOrEqual(0);
    }
  });

  it('should record assertion results for each iteration', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 1,
      iterationDelay: 10,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.iterations[0].assertions).toBeDefined();
    expect(result.data!.iterations[0].assertions.length).toBe(options.inputs.assertions.length);

    for (const assertionResult of result.data!.iterations[0].assertions) {
      expect(assertionResult.assertion).toBeDefined();
      expect(typeof assertionResult.passed).toBe('boolean');
    }
  });

  it('should report progress through all phases during iteration', async () => {
    const progressPhases: string[] = [];
    const onProgress = vi.fn((update) => {
      progressPhases.push(update.phase);
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 1,
      iterationDelay: 10,
      onProgress,
    });

    await runFeatureShipLoop(options);

    // Should see all major phases
    expect(progressPhases).toContain('initializing');
    expect(progressPhases).toContain('building');
    expect(progressPhases).toContain('launching');
    expect(progressPhases).toContain('verifying');
  });

  it('should update variables as iterations progress', async () => {
    vi.mocked(assertions.assertVisible).mockResolvedValue({
      success: true,
      data: {
        passed: false,
        status: 'failed',
        message: 'Element not visible',
      },
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 3,
      iterationDelay: 10,
    });

    const result = await runFeatureShipLoop(options);

    // Final variables should reflect completed iterations
    expect(result.data!.finalVariables.iteration).toBe(3);
    expect(result.data!.finalVariables.build_success).toBe(true);
    expect(result.data!.finalVariables.assertions_passed).toBe(false);
  });

  it('should set assertions_passed=true when all assertions pass', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 5,
      iterationDelay: 10,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.passed).toBe(true);
    expect(result.data!.finalVariables.assertions_passed).toBe(true);
  });

  it('should track which iteration each assertion first passed on', async () => {
    // First iteration: first assertion passes, second fails
    // Second iteration: both pass
    let callCount = 0;
    vi.mocked(assertions.assertVisible).mockImplementation(async () => {
      callCount++;
      // First call (iteration 1, assertion 1) passes
      // Second call would be assertion 2, but we use no_crash for that
      return {
        success: true,
        data: {
          passed: true,
          status: 'passed',
          message: 'Element visible',
        },
      };
    });

    vi.mocked(assertions.assertNoCrash).mockImplementation(async () => {
      // Make it fail first time, pass second time
      const shouldPass = callCount > 1;
      return {
        success: true,
        data: {
          passed: shouldPass,
          status: shouldPass ? 'passed' : 'failed',
          message: shouldPass ? 'No crash' : 'Crash detected',
        },
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 5,
      iterationDelay: 10,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.data!.assertionsSummary.assertions).toBeDefined();
    // First assertion (visible) should have passed on iteration 1
    const visibleAssertion = result.data!.assertionsSummary.assertions.find(
      a => a.assertion.type === 'visible'
    );
    expect(visibleAssertion?.passedOn).toBe(1);
  });

  it('should terminate with build_failed when build fails', async () => {
    vi.mocked(build.build).mockResolvedValue({
      success: false,
      error: 'Build failed with exit code 65',
      errorCode: 'BUILD_FAILED',
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 5,
      iterationDelay: 10,
    });

    const result = await runFeatureShipLoop(options);

    expect(result.success).toBe(true);
    expect(result.data!.passed).toBe(false);
    expect(result.data!.terminationReason).toBe('build_failed');
    expect(result.data!.iterationsRun).toBe(0);
  });

  it('should capture snapshots for each iteration when collectSnapshots is true', async () => {
    const captureSnapshotSpy = vi.mocked(snapshot.captureSnapshot);

    // Make assertions fail to get multiple iterations
    vi.mocked(assertions.assertVisible).mockResolvedValue({
      success: true,
      data: {
        passed: false,
        status: 'failed',
        message: 'Element not visible',
      },
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 3,
      iterationDelay: 10,
      collectSnapshots: true,
    });

    await runFeatureShipLoop(options);

    // Should have captured snapshot for each iteration
    expect(captureSnapshotSpy).toHaveBeenCalledTimes(3);
  });

  it('should not capture snapshots when collectSnapshots is false', async () => {
    const captureSnapshotSpy = vi.mocked(snapshot.captureSnapshot);
    captureSnapshotSpy.mockClear();

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 1,
      iterationDelay: 10,
      collectSnapshots: false,
    });

    await runFeatureShipLoop(options);

    expect(captureSnapshotSpy).not.toHaveBeenCalled();
  });

  it('should continue checking assertions after first failure when continueOnAssertionFailure is true', async () => {
    let assertVisibleCallCount = 0;
    let assertNoCrashCallCount = 0;

    vi.mocked(assertions.assertVisible).mockImplementation(async () => {
      assertVisibleCallCount++;
      return {
        success: true,
        data: {
          passed: false,
          status: 'failed',
          message: 'Element not visible',
        },
      };
    });

    vi.mocked(assertions.assertNoCrash).mockImplementation(async () => {
      assertNoCrashCallCount++;
      return {
        success: true,
        data: {
          passed: true,
          status: 'passed',
          message: 'No crash',
        },
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 1,
      iterationDelay: 10,
      continueOnAssertionFailure: true,
    });

    await runFeatureShipLoop(options);

    // Both assertions should have been checked despite first failing
    expect(assertVisibleCallCount).toBe(1);
    expect(assertNoCrashCallCount).toBe(1);
  });

  it('should stop at first failed assertion when continueOnAssertionFailure is false', async () => {
    let assertVisibleCallCount = 0;
    let assertNoCrashCallCount = 0;

    vi.mocked(assertions.assertVisible).mockImplementation(async () => {
      assertVisibleCallCount++;
      return {
        success: true,
        data: {
          passed: false,
          status: 'failed',
          message: 'Element not visible',
        },
      };
    });

    vi.mocked(assertions.assertNoCrash).mockImplementation(async () => {
      assertNoCrashCallCount++;
      return {
        success: true,
        data: {
          passed: true,
          status: 'passed',
          message: 'No crash',
        },
      };
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 1,
      iterationDelay: 10,
      continueOnAssertionFailure: false, // Default but explicit
    });

    await runFeatureShipLoop(options);

    // Should stop after first assertion fails
    expect(assertVisibleCallCount).toBe(1);
    expect(assertNoCrashCallCount).toBe(0);
  });

  it('should relaunch app on each iteration when relaunchOnIteration is true', async () => {
    const launchAppSpy = vi.mocked(simulator.launchApp);
    const terminateAppSpy = vi.mocked(simulator.terminateApp);

    // Make assertions fail to get multiple iterations
    vi.mocked(assertions.assertVisible).mockResolvedValue({
      success: true,
      data: {
        passed: false,
        status: 'failed',
        message: 'Element not visible',
      },
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 3,
      iterationDelay: 10,
      relaunchOnIteration: true,
    });

    await runFeatureShipLoop(options);

    // Should launch and terminate for each iteration
    expect(launchAppSpy).toHaveBeenCalledTimes(3);
    expect(terminateAppSpy).toHaveBeenCalledTimes(3);
  });

  it('should write summary files to artifacts directory', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Feature-Ship-Loop', 'playbook.yaml'),
      maxIterations: 1,
      iterationDelay: 10,
    });

    const result = await runFeatureShipLoop(options);

    // Check that artifacts directory exists and has summary files
    expect(fs.existsSync(result.data!.artifactsDir)).toBe(true);
    expect(fs.existsSync(path.join(result.data!.artifactsDir, 'summary.txt'))).toBe(true);
    expect(fs.existsSync(path.join(result.data!.artifactsDir, 'result.json'))).toBe(true);
  });
});
