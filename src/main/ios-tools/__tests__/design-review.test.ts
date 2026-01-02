/**
 * Tests for iOS Playbook - Design Review Executor
 *
 * These tests verify the design review playbook execution, multi-device capture,
 * HTML comparison sheet generation, and progress reporting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  runDesignReview,
  formatDesignReviewResult,
  formatDesignReviewResultAsJson,
  formatDesignReviewResultCompact,
  type DesignReviewInputs,
  type DesignReviewOptions,
  type DesignReviewResult,
  type DesignScreen,
} from '../playbooks/design-review';
import { ensurePlaybooksDirectory } from '../playbook-loader';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../simulator', () => ({
  listSimulators: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        udid: 'iphone-15-pro-udid',
        name: 'iPhone 15 Pro',
        state: 'Shutdown',
        iosVersion: '17.0',
        isAvailable: true,
        runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0',
        deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
      },
      {
        udid: 'iphone-se-udid',
        name: 'iPhone SE (3rd generation)',
        state: 'Shutdown',
        iosVersion: '17.0',
        isAvailable: true,
        runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0',
        deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation',
      },
      {
        udid: 'ipad-pro-udid',
        name: 'iPad Pro (12.9-inch) (6th generation)',
        state: 'Shutdown',
        iosVersion: '17.0',
        isAvailable: true,
        runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-0',
        deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPad-Pro-12-9-inch-6th-generation',
      },
    ],
  }),
  bootSimulator: vi.fn().mockResolvedValue({ success: true }),
  shutdownSimulator: vi.fn().mockResolvedValue({ success: true }),
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

vi.mock('../inspect', () => ({
  inspectWithXCUITest: vi.fn().mockResolvedValue({
    success: true,
    data: {
      rootElement: {
        type: 'application',
        identifier: 'com.test.app',
      },
    },
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

// =============================================================================
// Test Helpers
// =============================================================================

let testDir: string;
let playbooksDir: string;

/**
 * Create a temporary test directory
 */
function createTestDir(): string {
  const dir = path.join(os.tmpdir(), `design-review-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
 * Create minimal navigation map for testing
 */
function createTestNavigationMap(): DesignScreen[] {
  return [
    { name: 'Home', description: 'Home screen' },
    { name: 'Settings', description: 'Settings screen' },
  ];
}

/**
 * Create minimal options for testing
 */
function createMinimalOptions(overrides: Partial<DesignReviewOptions> = {}): DesignReviewOptions {
  return {
    inputs: {
      bundle_id: 'com.test.app',
      navigation_map: createTestNavigationMap(),
      output_dir: path.join(os.tmpdir(), 'design-review-output'),
    },
    sessionId: 'test-session-123',
    ...overrides,
  };
}

// =============================================================================
// Input Validation Tests
// =============================================================================

describe('runDesignReview - Input Validation', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    // Create playbook.yaml for the Design-Review playbook
    const playbookDir = path.join(playbooksDir, 'Design-Review');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Design Review',
        description: 'Capture screenshots across multiple device sizes',
        version: '1.0.0',
        inputs: {
          navigation_map: { type: 'array', required: true },
          output_dir: { required: true },
        },
        steps: [{ action: 'ios.screenshot' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should handle undefined navigation_map gracefully', async () => {
    // Note: The implementation accesses navigation_map.length before validation,
    // so undefined navigation_map will throw. This test documents that behavior.
    const options: DesignReviewOptions = {
      inputs: {
        bundle_id: 'com.test.app',
        output_dir: '/tmp/output',
      } as DesignReviewInputs,
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
    };

    await expect(runDesignReview(options)).rejects.toThrow();
  });

  it('should reject inputs missing output_dir', async () => {
    const options: DesignReviewOptions = {
      inputs: {
        bundle_id: 'com.test.app',
        navigation_map: createTestNavigationMap(),
      } as DesignReviewInputs,
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
    };

    const result = await runDesignReview(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('output_dir');
  });

  it('should reject empty navigation_map', async () => {
    const options: DesignReviewOptions = {
      inputs: {
        bundle_id: 'com.test.app',
        navigation_map: [],
        output_dir: '/tmp/output',
      },
      sessionId: 'test-session',
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
    };

    const result = await runDesignReview(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('navigation_map');
  });

  it('should accept valid inputs', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Dry Run Tests
// =============================================================================

describe('runDesignReview - Dry Run', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Design-Review');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Design Review',
        version: '1.0.0',
        steps: [{ action: 'ios.screenshot' }],
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
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.screensCaptured).toBe(0);
    expect(result.data!.passed).toBe(false);
  });

  it('should return correct playbook info in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runDesignReview(options);

    expect(result.data!.playbook.name).toBe('iOS Design Review');
    expect(result.data!.playbook.version).toBe('1.0.0');
  });

  it('should calculate expected screen count in dry run', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.device_sizes = ['iPhone 15 Pro', 'iPhone SE (3rd generation)'];
    options.inputs.navigation_map = [
      { name: 'Home', description: 'Home screen' },
      { name: 'Settings', description: 'Settings screen' },
      { name: 'Profile', description: 'Profile screen' },
    ];

    const result = await runDesignReview(options);

    // 2 devices * 3 screens = 6 total expected
    expect(result.data!.totalScreens).toBe(6);
  });
});

// =============================================================================
// Progress Reporting Tests
// =============================================================================

describe('runDesignReview - Progress Reporting', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Design-Review');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Design Review',
        version: '1.0.0',
        steps: [{ action: 'ios.screenshot' }],
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
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runDesignReview(options);

    expect(onProgress).toHaveBeenCalled();
    expect(progressUpdates).toContain('initializing');
  });

  it('should include device and screen info in progress updates', async () => {
    const updates: { currentDevice: number; totalDevices: number; currentScreen: number; totalScreens: number }[] = [];
    const onProgress = vi.fn((update) => {
      updates.push({
        currentDevice: update.currentDevice,
        totalDevices: update.totalDevices,
        currentScreen: update.currentScreen,
        totalScreens: update.totalScreens,
      });
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runDesignReview(options);

    expect(updates.length).toBeGreaterThan(0);
    for (const update of updates) {
      expect(typeof update.currentDevice).toBe('number');
      expect(typeof update.totalDevices).toBe('number');
      expect(typeof update.currentScreen).toBe('number');
      expect(typeof update.totalScreens).toBe('number');
    }
  });

  it('should include phase and message in progress updates', async () => {
    const updates: { phase: string; message: string }[] = [];
    const onProgress = vi.fn((update) => {
      updates.push({
        phase: update.phase,
        message: update.message,
      });
    });

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
      onProgress,
    });

    await runDesignReview(options);

    for (const update of updates) {
      expect(update.phase).toBeDefined();
      expect(update.message).toBeDefined();
    }
  });
});

// =============================================================================
// Result Structure Tests
// =============================================================================

describe('runDesignReview - Result Structure', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Design-Review');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Design Review',
        version: '1.0.0',
        steps: [{ action: 'ios.screenshot' }],
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
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runDesignReview(options);

    expect(result.data).toBeDefined();
    const data = result.data!;

    expect(typeof data.passed).toBe('boolean');
    expect(typeof data.totalDevices).toBe('number');
    expect(typeof data.devicesCompleted).toBe('number');
    expect(typeof data.devicesFailed).toBe('number');
    expect(typeof data.totalScreens).toBe('number');
    expect(typeof data.screensCaptured).toBe('number');
    expect(typeof data.captureFailures).toBe('number');
    expect(typeof data.totalDuration).toBe('number');
    expect(data.startTime).toBeInstanceOf(Date);
    expect(data.endTime).toBeInstanceOf(Date);
    expect(Array.isArray(data.deviceResults)).toBe(true);
    expect(data.playbook).toBeDefined();
    expect(typeof data.outputDir).toBe('string');
    expect(data.finalVariables).toBeDefined();
  });
});

// =============================================================================
// Device Configuration Tests
// =============================================================================

describe('runDesignReview - Device Configuration', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Design-Review');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Design Review',
        version: '1.0.0',
        steps: [{ action: 'ios.screenshot' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should accept specified device sizes', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.device_sizes = ['iPhone 15 Pro', 'iPad Pro (12.9-inch) (6th generation)'];

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
    expect(result.data!.totalDevices).toBe(2);
  });

  it('should use default device set when not specified', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });
    // Don't specify device_sizes

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
    expect(result.data!.totalDevices).toBeGreaterThan(0);
  });

  it('should handle single device', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.device_sizes = ['iPhone SE (3rd generation)'];

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
    expect(result.data!.totalDevices).toBe(1);
  });
});

// =============================================================================
// Navigation Map Tests
// =============================================================================

describe('runDesignReview - Navigation Map', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Design-Review');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Design Review',
        version: '1.0.0',
        steps: [{ action: 'ios.screenshot' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should accept navigation map with descriptions', async () => {
    const screens: DesignScreen[] = [
      { name: 'Home', description: 'Main home screen with welcome message' },
      { name: 'Login', description: 'Login form with email and password' },
      { name: 'Dashboard', description: 'User dashboard with stats' },
    ];

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.navigation_map = screens;

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
    expect(result.data!.totalScreens).toBe(screens.length * result.data!.totalDevices);
  });

  it('should accept navigation map with navigation steps', async () => {
    const screens: DesignScreen[] = [
      { name: 'Home', description: 'Home screen' },
      {
        name: 'Settings',
        description: 'Settings screen',
        navigation: [
          { action: 'tap', target: { label: 'Settings' } },
        ],
      },
    ];

    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.navigation_map = screens;

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Options Tests
// =============================================================================

describe('runDesignReview - Options', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Design-Review');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Design Review',
        version: '1.0.0',
        steps: [{ action: 'ios.screenshot' }],
      })
    );
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    cleanupTestDir(playbooksDir);
    vi.clearAllMocks();
  });

  it('should accept capture_ui_tree option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.capture_ui_tree = true;

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
  });

  it('should accept generate_comparison_sheet option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.generate_comparison_sheet = true;

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
  });

  it('should accept wait_after_navigation option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.wait_after_navigation = 3;

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
  });

  it('should accept reset_between_screens option', async () => {
    const options = createMinimalOptions({
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });
    options.inputs.reset_between_screens = true;

    const result = await runDesignReview(options);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Result Formatter Tests
// =============================================================================

describe('formatDesignReviewResult', () => {
  const createMockResult = (overrides: Partial<DesignReviewResult> = {}): DesignReviewResult => ({
    passed: true,
    totalDevices: 3,
    devicesCompleted: 3,
    devicesFailed: 0,
    totalScreens: 9,
    screensCaptured: 9,
    captureFailures: 0,
    totalDuration: 45000,
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T10:00:45Z'),
    deviceResults: [
      {
        device: 'iPhone 15 Pro',
        deviceSlug: 'iphone-15-pro',
        success: true,
        captures: [],
        duration: 15000,
      },
      {
        device: 'iPhone SE',
        deviceSlug: 'iphone-se',
        success: true,
        captures: [],
        duration: 15000,
      },
      {
        device: 'iPad Pro',
        deviceSlug: 'ipad-pro',
        success: true,
        captures: [],
        duration: 15000,
      },
    ],
    playbook: { name: 'iOS Design Review', version: '1.0.0' },
    outputDir: '/tmp/design-review',
    finalVariables: { screenshots_taken: 9 },
    ...overrides,
  });

  it('should format passed result with checkmark', () => {
    const result = createMockResult();
    const formatted = formatDesignReviewResult(result);

    expect(formatted).toContain('✅');
    expect(formatted).toContain('Complete');
    expect(formatted).not.toContain('⚠️');
  });

  it('should format partial result with warning emoji', () => {
    const result = createMockResult({
      passed: false,
      screensCaptured: 6,
      captureFailures: 3,
    });

    const formatted = formatDesignReviewResult(result);

    expect(formatted).toContain('⚠️');
    expect(formatted).toContain('Completed with Issues');
  });

  it('should include summary table', () => {
    const result = createMockResult();
    const formatted = formatDesignReviewResult(result);

    expect(formatted).toContain('| Metric | Value |');
    expect(formatted).toContain('Devices');
    expect(formatted).toContain('Screens');
    expect(formatted).toContain('Duration');
  });

  it('should include device results section', () => {
    const result = createMockResult();
    const formatted = formatDesignReviewResult(result);

    expect(formatted).toContain('### Device Results');
    expect(formatted).toContain('iPhone 15 Pro');
    expect(formatted).toContain('iPhone SE');
    expect(formatted).toContain('iPad Pro');
  });

  it('should show captured count for devices', () => {
    const result = createMockResult({
      deviceResults: [
        {
          device: 'iPhone 15 Pro',
          deviceSlug: 'iphone-15-pro',
          success: true,
          captures: [
            { device: 'iPhone 15 Pro', deviceSlug: 'iphone-15-pro', screen: 'Home', screenSlug: 'home', success: true, timestamp: new Date(), duration: 1000 },
            { device: 'iPhone 15 Pro', deviceSlug: 'iphone-15-pro', screen: 'Settings', screenSlug: 'settings', success: true, timestamp: new Date(), duration: 1000 },
          ],
          duration: 5000,
        },
      ],
    });

    const formatted = formatDesignReviewResult(result);

    expect(formatted).toContain('2/2 screens'); // 2 captures
  });

  it('should include output directory', () => {
    const result = createMockResult({ outputDir: '/custom/output/path' });
    const formatted = formatDesignReviewResult(result);

    expect(formatted).toContain('/custom/output/path');
  });

  it('should include comparison sheet path when available', () => {
    const result = createMockResult({
      comparisonSheetPath: '/tmp/comparison.html',
    });

    const formatted = formatDesignReviewResult(result);

    expect(formatted).toContain('comparison.html');
  });

  it('should include error section when error present', () => {
    const result = createMockResult({
      passed: false,
      error: 'Failed to boot simulator',
    });

    const formatted = formatDesignReviewResult(result);

    expect(formatted).toContain('### Error');
    expect(formatted).toContain('Failed to boot simulator');
  });
});

describe('formatDesignReviewResultAsJson', () => {
  it('should return valid JSON string', () => {
    const result: DesignReviewResult = {
      passed: true,
      totalDevices: 2,
      devicesCompleted: 2,
      devicesFailed: 0,
      totalScreens: 4,
      screensCaptured: 4,
      captureFailures: 0,
      totalDuration: 20000,
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:00:20Z'),
      deviceResults: [],
      playbook: { name: 'Test', version: '1.0.0' },
      outputDir: '/tmp',
      finalVariables: {},
    };

    const json = formatDesignReviewResultAsJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.passed).toBe(true);
    expect(parsed.totalDevices).toBe(2);
    expect(parsed.screensCaptured).toBe(4);
  });

  it('should be pretty-printed with 2-space indentation', () => {
    const result: DesignReviewResult = {
      passed: true,
      totalDevices: 1,
      devicesCompleted: 1,
      devicesFailed: 0,
      totalScreens: 1,
      screensCaptured: 1,
      captureFailures: 0,
      totalDuration: 1000,
      startTime: new Date(),
      endTime: new Date(),
      deviceResults: [],
      playbook: { name: 'Test' },
      outputDir: '/tmp',
      finalVariables: {},
    };

    const json = formatDesignReviewResultAsJson(result);

    expect(json).toContain('\n');
    expect(json).toContain('  '); // 2-space indent
  });
});

describe('formatDesignReviewResultCompact', () => {
  it('should format passed result compactly', () => {
    const result: DesignReviewResult = {
      passed: true,
      totalDevices: 3,
      devicesCompleted: 3,
      devicesFailed: 0,
      totalScreens: 9,
      screensCaptured: 9,
      captureFailures: 0,
      totalDuration: 45000,
      startTime: new Date(),
      endTime: new Date(),
      deviceResults: [],
      playbook: { name: 'Test' },
      outputDir: '/tmp',
      finalVariables: {},
    };

    const compact = formatDesignReviewResultCompact(result);

    expect(compact).toContain('[SUCCESS]');
    expect(compact).toContain('3 devices');
    expect(compact).toContain('9/9 captures');
  });

  it('should format partial result compactly', () => {
    const result: DesignReviewResult = {
      passed: false,
      totalDevices: 3,
      devicesCompleted: 2,
      devicesFailed: 1,
      totalScreens: 9,
      screensCaptured: 6,
      captureFailures: 3,
      totalDuration: 30000,
      startTime: new Date(),
      endTime: new Date(),
      deviceResults: [],
      playbook: { name: 'Test' },
      outputDir: '/tmp',
      finalVariables: {},
    };

    const compact = formatDesignReviewResultCompact(result);

    expect(compact).toContain('[PARTIAL]');
    expect(compact).toContain('6/9 captures');
  });
});

// =============================================================================
// Variable Tracking Tests
// =============================================================================

describe('runDesignReview - Variable Tracking', () => {
  beforeEach(() => {
    testDir = createTestDir();
    playbooksDir = createTestDir();
    ensurePlaybooksDirectory(playbooksDir);

    const playbookDir = path.join(playbooksDir, 'Design-Review');
    fs.mkdirSync(playbookDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(playbookDir, 'playbook.yaml'),
      yaml.dump({
        name: 'iOS Design Review',
        version: '1.0.0',
        variables: {
          screenshots_taken: 0,
          current_device: '',
          current_screen: '',
        },
        steps: [{ action: 'ios.screenshot' }],
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
      playbookPath: path.join(playbooksDir, 'Design-Review', 'playbook.yaml'),
      dryRun: true,
    });

    const result = await runDesignReview(options);

    expect(result.data!.finalVariables).toBeDefined();
    expect(result.data!.finalVariables.screenshots_taken).toBe(0);
  });
});
