/**
 * Tests for iOS Playbook - Performance Check Executor
 *
 * These tests verify the performance check playbook execution, metric collection,
 * baseline comparison, and report generation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  runPerformanceCheck,
  formatPerformanceCheckResult,
  formatPerformanceCheckResultAsJson,
  formatPerformanceCheckResultCompact,
  type PerformanceCheckInputs,
  type PerformanceCheckOptions,
  type PerformanceCheckResult,
  type PerformanceFlow,
  type PerformanceBaseline,
} from '../playbooks/performance-check';
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
      configuration: 'Release',
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

vi.mock('../artifacts', () => ({
  getArtifactDirectory: vi.fn().mockImplementation(async (sessionId: string) => {
    const dir = path.join(os.tmpdir(), 'perf-check-test-artifacts', sessionId);
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
  const dir = path.join(os.tmpdir(), `perf-check-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
 * Create minimal flows for testing
 */
function createTestFlows(): PerformanceFlow[] {
  return [
    { name: 'Login Flow', description: 'Login and navigate to home' },
    { name: 'Search Flow', description: 'Search for items' },
  ];
}

/**
 * Create minimal options for testing
 */
function createMinimalOptions(overrides: Partial<PerformanceCheckOptions> = {}): PerformanceCheckOptions {
  return {
    inputs: {
      bundle_id: 'com.test.app',
      runs: 3,
    },
    sessionId: 'test-session-123',
    ...overrides,
  };
}

// =============================================================================
// Input Validation Tests
// =============================================================================

describe('runPerformanceCheck - Input Validation', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    // Create playbook.yaml for the Performance-Check playbook
    const playbookDir = path.join(playbooksDir, 'Performance-Check');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Performance Check',
        description: 'Measure app performance metrics',
        version: '1.0.0',
        inputs: {
          runs: { default: 5 },
          measure_launch_time: { default: true },
          measure_memory: { default: true },
        },
        variables: {
          current_run: 0,
          total_runs: 5,
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
    const options: PerformanceCheckOptions = {
      inputs: {} as PerformanceCheckInputs,
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
    };

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject inputs with project_path but missing scheme', async () => {
    const options: PerformanceCheckOptions = {
      inputs: {
        project_path: '/tmp/MyApp.xcworkspace',
      },
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
    };

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('scheme');
  });

  it('should accept bundle_id only as valid input', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept app_path as valid input', async () => {
    const options: PerformanceCheckOptions = {
      inputs: {
        app_path: '/tmp/MyApp.app',
      },
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    };

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Dry Run Tests
// =============================================================================

describe('runPerformanceCheck - Dry Run', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Performance-Check');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Performance Check',
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
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.runs_completed).toBe(0);
    // In dry run, completed is false since no actual run happened
    expect(result.data!.completed).toBe(false);
  });

  it('should return correct playbook info in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runPerformanceCheck(options);

    expect(result.data!.playbook.name).toBe('iOS Performance Check');
    expect(result.data!.playbook.version).toBe('1.0.0');
  });

  it('should return simulator info in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runPerformanceCheck(options);

    expect(result.data!.simulator).toBeDefined();
    expect(result.data!.simulator.name).toBe('iPhone 15 Pro');
    expect(result.data!.simulator.iosVersion).toBe('17.0');
  });

  it('should return configured runs count in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.runs = 10;

    const result = await runPerformanceCheck(options);

    // In dry run, runs_completed is 0 but we verify the playbook loaded correctly
    expect(result.success).toBe(true);
    expect(result.data!.runs_completed).toBe(0);
  });
});

// =============================================================================
// Progress Reporting Tests
// =============================================================================

describe('runPerformanceCheck - Progress Reporting', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Performance-Check');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Performance Check',
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
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runPerformanceCheck(options);

    expect(onProgress).toHaveBeenCalled();
    expect(progressUpdates).toContain('initializing');
  });

  it('should include run info in progress updates', async () => {
    const updates: { currentRun: number; totalRuns: number }[] = [];
    const onProgress = vi.fn((update) => {
      updates.push({
        currentRun: update.currentRun,
        totalRuns: update.totalRuns,
      });
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runPerformanceCheck(options);

    expect(updates.length).toBeGreaterThan(0);
    for (const update of updates) {
      expect(typeof update.currentRun).toBe('number');
      expect(typeof update.totalRuns).toBe('number');
    }
  });

  it('should include phase and message in progress updates', async () => {
    const updates: { phase: string; message: string; percentComplete: number }[] = [];
    const onProgress = vi.fn((update) => {
      updates.push({
        phase: update.phase,
        message: update.message,
        percentComplete: update.percentComplete,
      });
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runPerformanceCheck(options);

    for (const update of updates) {
      expect(update.phase).toBeDefined();
      expect(update.message).toBeDefined();
      expect(typeof update.percentComplete).toBe('number');
    }
  });
});

// =============================================================================
// Result Structure Tests
// =============================================================================

describe('runPerformanceCheck - Result Structure', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Performance-Check');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Performance Check',
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
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runPerformanceCheck(options);

    expect(result.data).toBeDefined();
    const data = result.data!;

    expect(typeof data.completed).toBe('boolean');
    expect(typeof data.regressions_found).toBe('number');
    expect(typeof data.runs_completed).toBe('number');
    expect(typeof data.totalDuration).toBe('number');
    expect(data.startTime).toBeInstanceOf(Date);
    expect(data.endTime).toBeInstanceOf(Date);
    expect(data.metrics).toBeDefined();
    expect(data.playbook).toBeDefined();
    expect(data.simulator).toBeDefined();
    expect(typeof data.artifactsDir).toBe('string');
    expect(data.finalVariables).toBeDefined();
  });

  it('should use default runs when not specified', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    delete options.inputs.runs;

    const result = await runPerformanceCheck(options);

    // In dry run, runs_completed is 0
    expect(result.data!.runs_completed).toBe(0);
    expect(result.success).toBe(true);
  });

  it('should use specified runs count', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.runs = 7;

    const result = await runPerformanceCheck(options);

    // In dry run, runs_completed is 0, but playbook is valid
    expect(result.data!.runs_completed).toBe(0);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Metric Configuration Tests
// =============================================================================

describe('runPerformanceCheck - Metric Configuration', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Performance-Check');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Performance Check',
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

  it('should accept measure_launch_time option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.measure_launch_time = true;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept measure_memory option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.measure_memory = true;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept measure_frame_rate option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.measure_frame_rate = true;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept measure_cpu option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.measure_cpu = true;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept all metrics enabled', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.measure_launch_time = true;
    options.inputs.measure_memory = true;
    options.inputs.measure_frame_rate = true;
    options.inputs.measure_cpu = true;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept all metrics disabled', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.measure_launch_time = false;
    options.inputs.measure_memory = false;
    options.inputs.measure_frame_rate = false;
    options.inputs.measure_cpu = false;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Flow Configuration Tests
// =============================================================================

describe('runPerformanceCheck - Flow Configuration', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Performance-Check');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Performance Check',
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

  it('should accept flows configuration', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.flows = createTestFlows();

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept flows with file paths', async () => {
    const flows: PerformanceFlow[] = [
      { name: 'Login', file: '/tmp/flows/login.yaml' },
      { name: 'Search', file: '/tmp/flows/search.yaml' },
    ];

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.flows = flows;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept flows with inline steps', async () => {
    const flows: PerformanceFlow[] = [
      {
        name: 'Simple Flow',
        steps: [
          { action: 'tap', target: { label: 'Login' } },
          { action: 'wait', duration: 2 },
        ],
      },
    ];

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.flows = flows;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Baseline Tests
// =============================================================================

describe('runPerformanceCheck - Baseline', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Performance-Check');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Performance Check',
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

  it('should accept baseline_path option', async () => {
    const baselinePath = path.join(testDir, 'baseline.json');
    const baseline: PerformanceBaseline = {
      timestamp: new Date().toISOString(),
      appVersion: '1.0.0',
      simulator: { name: 'iPhone 15 Pro', iosVersion: '17.0' },
      metrics: {
        launchTime: { cold_avg_ms: 500, warm_avg_ms: 200 },
      },
    };
    fs.writeFileSync(baselinePath, JSON.stringify(baseline));

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.baseline_path = baselinePath;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept regression_threshold option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.regression_threshold = 15;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept save_as_baseline option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.save_as_baseline = true;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Warm-up Configuration Tests
// =============================================================================

describe('runPerformanceCheck - Warm-up Configuration', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Performance-Check');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Performance Check',
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

  it('should accept warm_up_runs option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.warm_up_runs = 2;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });

  it('should accept wait_between_runs option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.wait_between_runs = 5;

    const result = await runPerformanceCheck(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Result Formatter Tests
// =============================================================================

describe('formatPerformanceCheckResult', () => {
  const createMockResult = (overrides: Partial<PerformanceCheckResult> = {}): PerformanceCheckResult => ({
    completed: true,
    regressions_found: 0,
    runs_completed: 5,
    totalDuration: 60000,
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T10:01:00Z'),
    metrics: {
      cold_launch: {
        avg_ms: 500,
        min_ms: 480,
        max_ms: 520,
        p95_ms: 515,
        samples: [500, 480, 520, 490, 510],
      },
      warm_launch: {
        avg_ms: 200,
        min_ms: 180,
        max_ms: 220,
        p95_ms: 215,
        samples: [200, 180, 210, 190, 195],
      },
      memory: {
        peak_mb: 150,
        avg_mb: 100,
        flows: [],
      },
    },
    flow_metrics: [],
    regressions: [],
    playbook: { name: 'iOS Performance Check', version: '1.0.0' },
    simulator: { udid: 'test', name: 'iPhone 15 Pro', iosVersion: '17.0' },
    artifactsDir: '/tmp/artifacts',
    finalVariables: { runs_completed: 5 },
    ...overrides,
  });

  it('should format passed result with checkmark', () => {
    const result = createMockResult();
    const formatted = formatPerformanceCheckResult(result);

    expect(formatted).toContain('✅');
    expect(formatted).toContain('Passed');
    expect(formatted).not.toContain('⚠️');
  });

  it('should format result with regressions using warning emoji', () => {
    const result = createMockResult({
      regressions_found: 2,
      regressions: [
        { metric: 'cold_launch', baseline: 400, current: 600, change_percent: 50, severity: 'warning' },
        { metric: 'memory', baseline: 100, current: 200, change_percent: 100, severity: 'critical' },
      ],
    });

    const formatted = formatPerformanceCheckResult(result);

    expect(formatted).toContain('⚠️');
    expect(formatted).toContain('Completed with Regressions');
  });

  it('should include summary table', () => {
    const result = createMockResult();
    const formatted = formatPerformanceCheckResult(result);

    expect(formatted).toContain('| Metric | Value |');
    expect(formatted).toContain('Runs');
    expect(formatted).toContain('Duration');
    expect(formatted).toContain('Cold Launch');
    expect(formatted).toContain('Warm Launch');
  });

  it('should include launch time metrics', () => {
    const result = createMockResult();
    const formatted = formatPerformanceCheckResult(result);

    expect(formatted).toContain('Cold Launch');
    expect(formatted).toContain('Warm Launch');
    expect(formatted).toContain('500ms');
    expect(formatted).toContain('200ms');
  });

  it('should include memory metrics when available', () => {
    const result = createMockResult();
    const formatted = formatPerformanceCheckResult(result);

    expect(formatted).toContain('Memory Peak');
    expect(formatted).toContain('150.0MB');
  });

  it('should include regressions section when regressions found', () => {
    const result = createMockResult({
      regressions_found: 2,
      regressions: [
        { metric: 'cold_launch', baseline: 400, current: 600, change_percent: 50, severity: 'warning' },
        { metric: 'memory', baseline: 100, current: 200, change_percent: 100, severity: 'critical' },
      ],
    });

    const formatted = formatPerformanceCheckResult(result);

    expect(formatted).toContain('### Regressions Detected');
    expect(formatted).toContain('cold_launch');
    expect(formatted).toContain('memory');
    expect(formatted).toContain('+50');
  });

  it('should include report paths when available', () => {
    const result = createMockResult({
      htmlReportPath: '/tmp/report.html',
      jsonReportPath: '/tmp/report.json',
    });

    const formatted = formatPerformanceCheckResult(result);

    expect(formatted).toContain('### Reports');
    expect(formatted).toContain('report.html');
    expect(formatted).toContain('report.json');
  });

  it('should include saved baseline path when available', () => {
    const result = createMockResult({
      htmlReportPath: '/tmp/report.html',
      savedBaselinePath: '/tmp/baseline.json',
    });

    const formatted = formatPerformanceCheckResult(result);

    expect(formatted).toContain('baseline.json');
  });

  it('should include error section when error present', () => {
    const result = createMockResult({
      completed: false,
      error: 'Failed to measure launch time',
    });

    const formatted = formatPerformanceCheckResult(result);

    expect(formatted).toContain('### Error');
    expect(formatted).toContain('Failed to measure launch time');
  });
});

describe('formatPerformanceCheckResultAsJson', () => {
  it('should return valid JSON string', () => {
    const result: PerformanceCheckResult = {
      completed: true,
      regressions_found: 0,
      runs_completed: 5,
      totalDuration: 30000,
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:00:30Z'),
      metrics: {
        cold_launch: { avg_ms: 500, min_ms: 480, max_ms: 520, p95_ms: 515, samples: [] },
        warm_launch: { avg_ms: 200, min_ms: 180, max_ms: 220, p95_ms: 215, samples: [] },
      },
      flow_metrics: [],
      regressions: [],
      playbook: { name: 'Test', version: '1.0.0' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      artifactsDir: '/tmp',
      finalVariables: {},
    };

    const json = formatPerformanceCheckResultAsJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.completed).toBe(true);
    expect(parsed.runs_completed).toBe(5);
    expect(parsed.metrics.cold_launch.avg_ms).toBe(500);
  });

  it('should be pretty-printed with 2-space indentation', () => {
    const result: PerformanceCheckResult = {
      completed: true,
      regressions_found: 0,
      runs_completed: 5,
      totalDuration: 1000,
      startTime: new Date(),
      endTime: new Date(),
      metrics: {
        cold_launch: { avg_ms: 500, min_ms: 480, max_ms: 520, p95_ms: 515, samples: [] },
        warm_launch: { avg_ms: 200, min_ms: 180, max_ms: 220, p95_ms: 215, samples: [] },
      },
      flow_metrics: [],
      regressions: [],
      playbook: { name: 'Test' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      artifactsDir: '/tmp',
      finalVariables: {},
    };

    const json = formatPerformanceCheckResultAsJson(result);

    expect(json).toContain('\n');
    expect(json).toContain('  '); // 2-space indent
  });
});

describe('formatPerformanceCheckResultCompact', () => {
  it('should format passed result compactly', () => {
    const result: PerformanceCheckResult = {
      completed: true,
      regressions_found: 0,
      runs_completed: 5,
      totalDuration: 60000,
      startTime: new Date(),
      endTime: new Date(),
      metrics: {
        cold_launch: { avg_ms: 500, min_ms: 480, max_ms: 520, p95_ms: 515, samples: [] },
        warm_launch: { avg_ms: 200, min_ms: 180, max_ms: 220, p95_ms: 215, samples: [] },
      },
      flow_metrics: [],
      regressions: [],
      playbook: { name: 'Test' },
      simulator: { udid: 'test', name: 'iPhone 15 Pro', iosVersion: '17.0' },
      artifactsDir: '/tmp',
      finalVariables: {},
    };

    const compact = formatPerformanceCheckResultCompact(result);

    expect(compact).toContain('[PASS]');
    expect(compact).toContain('cold=500ms');
    expect(compact).toContain('warm=200ms');
    expect(compact).toContain('0 regression(s)');
  });

  it('should format regression result compactly', () => {
    const result: PerformanceCheckResult = {
      completed: true,
      regressions_found: 1,
      runs_completed: 5,
      totalDuration: 60000,
      startTime: new Date(),
      endTime: new Date(),
      metrics: {
        cold_launch: { avg_ms: 800, min_ms: 750, max_ms: 850, p95_ms: 840, samples: [] },
        warm_launch: { avg_ms: 400, min_ms: 380, max_ms: 420, p95_ms: 415, samples: [] },
      },
      flow_metrics: [],
      regressions: [
        { metric: 'cold_launch', baseline: 500, current: 800, change_percent: 60, severity: 'critical' },
      ],
      playbook: { name: 'Test' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      artifactsDir: '/tmp',
      finalVariables: {},
    };

    const compact = formatPerformanceCheckResultCompact(result);

    expect(compact).toContain('[REGRESS]');
    expect(compact).toContain('1 regression(s)');
  });

  it('should include duration in compact format', () => {
    const result: PerformanceCheckResult = {
      completed: true,
      regressions_found: 0,
      runs_completed: 5,
      totalDuration: 65000,
      startTime: new Date(),
      endTime: new Date(),
      metrics: {
        cold_launch: { avg_ms: 500, min_ms: 480, max_ms: 520, p95_ms: 515, samples: [] },
        warm_launch: { avg_ms: 200, min_ms: 180, max_ms: 220, p95_ms: 215, samples: [] },
      },
      flow_metrics: [],
      regressions: [],
      playbook: { name: 'Test' },
      simulator: { udid: 'test', name: 'iPhone', iosVersion: '17.0' },
      artifactsDir: '/tmp',
      finalVariables: {},
    };

    const compact = formatPerformanceCheckResultCompact(result);

    // Should include duration in the output
    expect(compact).toMatch(/\d+m|\d+s/);
  });
});

// =============================================================================
// Variable Tracking Tests
// =============================================================================

describe('runPerformanceCheck - Variable Tracking', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Performance-Check');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Performance Check',
        version: '1.0.0',
        variables: {
          current_run: 0,
          total_runs: 5,
          warm_up_complete: false,
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
      playbookPath: path.join(playbooksDir, 'Performance-Check', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runPerformanceCheck(options);

    expect(result.data!.finalVariables).toBeDefined();
    expect(result.data!.finalVariables.current_run).toBe(0);
    expect(result.data!.finalVariables.warm_up_complete).toBe(false);
  });
});
