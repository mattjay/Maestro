/**
 * Tests for iOS Baseline Slash Command
 *
 * These tests verify the parsing and execution of the /ios.baseline command
 * including save, update, list, show, delete, and ignore subcommands.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  parseBaselineArgs,
  executeBaselineCommand,
  baselineCommandMetadata,
} from '../ios-baseline';

// Mock iosTools module
vi.mock('../../ios-tools', () => ({
  // Simulator functions
  getBootedSimulators: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: [
        { udid: 'test-udid-1234', name: 'iPhone 15 Pro', state: 'Booted' },
      ],
    })
  ),
  getSimulator: vi.fn((udid: string) =>
    Promise.resolve({
      success: true,
      data: {
        udid,
        name: 'iPhone 15 Pro',
        state: 'Booted',
        iosVersion: '17.5',
        deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
        isAvailable: true,
        runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-5',
      },
    })
  ),
  captureScreenshot: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        path: '/tmp/screenshot.png',
        size: 12345,
        timestamp: new Date(),
      },
    })
  ),
  getScreenSize: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: { width: 393, height: 852 },
    })
  ),
  // Baseline storage functions
  createBaseline: vi.fn(() =>
    Promise.resolve({
      name: 'test_baseline',
      createdAt: new Date(),
      updatedAt: new Date(),
      device: {
        name: 'iPhone 15 Pro',
        osVersion: '17.5',
        screenSize: { width: 393, height: 852 },
      },
      bundleId: 'com.example.app',
      ignoreRegions: [],
    })
  ),
  updateBaseline: vi.fn(() =>
    Promise.resolve({
      name: 'test_baseline',
      createdAt: new Date(),
      updatedAt: new Date(),
      device: {
        name: 'iPhone 15 Pro',
        osVersion: '17.5',
        screenSize: { width: 393, height: 852 },
      },
      bundleId: 'com.example.app',
      ignoreRegions: [],
    })
  ),
  getBaseline: vi.fn(() =>
    Promise.resolve({
      metadata: {
        name: 'test_baseline',
        createdAt: new Date(),
        updatedAt: new Date(),
        device: {
          name: 'iPhone 15 Pro',
          osVersion: '17.5',
          screenSize: { width: 393, height: 852 },
        },
        bundleId: 'com.example.app',
        ignoreRegions: [],
        tags: ['test'],
      },
      imagePath: '/path/to/baseline.png',
    })
  ),
  listBaselines: vi.fn(() =>
    Promise.resolve([
      {
        name: 'login_screen',
        type: 'screen',
        path: '/baselines/screens/login_screen',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['auth'],
      },
      {
        name: 'home_screen',
        type: 'screen',
        path: '/baselines/screens/home_screen',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
  ),
  listFlows: vi.fn(() =>
    Promise.resolve([
      {
        name: 'checkout_flow',
        type: 'flow',
        path: '/baselines/flows/checkout_flow',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
  ),
  deleteBaseline: vi.fn(() => Promise.resolve()),
  deleteFlow: vi.fn(() => Promise.resolve()),
  getFlowBaselineStorage: vi.fn(() => Promise.resolve(null)),
  getBaselinePath: vi.fn(
    (project: string, name: string) => `/baselines/${project}/screens/${name}`
  ),
  addIgnoreRegion: vi.fn(() =>
    Promise.resolve({
      name: 'test_baseline',
      createdAt: new Date(),
      updatedAt: new Date(),
      device: {
        name: 'iPhone 15 Pro',
        osVersion: '17.5',
        screenSize: { width: 393, height: 852 },
      },
      bundleId: 'com.example.app',
      ignoreRegions: [
        {
          name: 'status_bar',
          rect: { x: 0, y: 0, width: 390, height: 54 },
          reason: 'status_bar',
        },
      ],
    })
  ),
}));

// =============================================================================
// Test Helpers
// =============================================================================

let testDir: string;

/**
 * Create a temporary test directory
 */
function createTestDir(): string {
  const dir = path.join(
    os.tmpdir(),
    `baseline-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
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

// =============================================================================
// Argument Parsing Tests
// =============================================================================

describe('parseBaselineArgs', () => {
  describe('subcommand parsing', () => {
    it('should parse save subcommand with name', () => {
      const args = parseBaselineArgs('/ios.baseline save login_screen');
      expect(args.subcommand).toBe('save');
      expect(args.name).toBe('login_screen');
    });

    it('should parse update subcommand with name', () => {
      const args = parseBaselineArgs('/ios.baseline update login_screen');
      expect(args.subcommand).toBe('update');
      expect(args.name).toBe('login_screen');
    });

    it('should parse list subcommand', () => {
      const args = parseBaselineArgs('/ios.baseline list');
      expect(args.subcommand).toBe('list');
    });

    it('should parse show subcommand with name', () => {
      const args = parseBaselineArgs('/ios.baseline show login_screen');
      expect(args.subcommand).toBe('show');
      expect(args.name).toBe('login_screen');
    });

    it('should parse delete subcommand with name', () => {
      const args = parseBaselineArgs('/ios.baseline delete old_baseline');
      expect(args.subcommand).toBe('delete');
      expect(args.name).toBe('old_baseline');
    });

    it('should parse ignore subcommand with name', () => {
      const args = parseBaselineArgs('/ios.baseline ignore login_screen');
      expect(args.subcommand).toBe('ignore');
      expect(args.name).toBe('login_screen');
    });

    it('should return empty args for empty command', () => {
      const args = parseBaselineArgs('/ios.baseline');
      expect(args.subcommand).toBeUndefined();
    });
  });

  describe('flag parsing', () => {
    it('should parse --project with short form', () => {
      const args = parseBaselineArgs('/ios.baseline save test -p MyProject');
      expect(args.project).toBe('MyProject');
    });

    it('should parse --project with long form', () => {
      const args = parseBaselineArgs('/ios.baseline save test --project MyProject');
      expect(args.project).toBe('MyProject');
    });

    it('should parse --simulator with short form', () => {
      const args = parseBaselineArgs('/ios.baseline save test -s "iPhone 15"');
      expect(args.simulator).toBe('iPhone 15');
    });

    it('should parse --simulator with long form', () => {
      const args = parseBaselineArgs('/ios.baseline save test --simulator "iPhone SE"');
      expect(args.simulator).toBe('iPhone SE');
    });

    it('should parse --app with short form', () => {
      const args = parseBaselineArgs('/ios.baseline save test -a com.example.app');
      expect(args.app).toBe('com.example.app');
    });

    it('should parse --app with long form', () => {
      const args = parseBaselineArgs('/ios.baseline save test --app com.example.app');
      expect(args.app).toBe('com.example.app');
    });

    it('should parse --device-family', () => {
      const args = parseBaselineArgs('/ios.baseline save test --device-family iPhone-Pro-Max');
      expect(args.deviceFamily).toBe('iPhone-Pro-Max');
    });

    it('should parse --auto-device-family flag', () => {
      const args = parseBaselineArgs('/ios.baseline save test --auto-device-family');
      expect(args.useDeviceFamilyDir).toBe(true);
    });

    it('should parse --description', () => {
      const args = parseBaselineArgs('/ios.baseline save test --description "Login screen"');
      expect(args.description).toBe('Login screen');
    });

    it('should parse --tags', () => {
      const args = parseBaselineArgs('/ios.baseline save test --tags critical,release,auth');
      expect(args.tags).toEqual(['critical', 'release', 'auth']);
    });
  });

  describe('ignore region parsing', () => {
    it('should parse --region with name and coordinates', () => {
      const args = parseBaselineArgs(
        '/ios.baseline ignore test --region status_bar:0,0,390,54'
      );
      expect(args.ignoreRegion).toEqual({
        name: 'status_bar',
        x: 0,
        y: 0,
        width: 390,
        height: 54,
      });
    });

    it('should parse --region without name', () => {
      const args = parseBaselineArgs('/ios.baseline ignore test --region 0,0,390,54');
      expect(args.ignoreRegion).toEqual({
        name: 'custom_region',
        x: 0,
        y: 0,
        width: 390,
        height: 54,
      });
    });

    it('should parse --reason for ignore region', () => {
      const args = parseBaselineArgs(
        '/ios.baseline ignore test --region status_bar:0,0,390,54 --reason status_bar'
      );
      expect(args.ignoreRegion?.reason).toBe('status_bar');
    });

    it('should handle invalid region format', () => {
      const args = parseBaselineArgs('/ios.baseline ignore test --region invalid');
      expect(args.ignoreRegion).toBeUndefined();
    });
  });

  describe('combined arguments', () => {
    it('should parse multiple flags together', () => {
      const args = parseBaselineArgs(
        '/ios.baseline save login_screen -p MyProject -a com.example.app --tags auth,critical --description "Main login"'
      );
      expect(args.subcommand).toBe('save');
      expect(args.name).toBe('login_screen');
      expect(args.project).toBe('MyProject');
      expect(args.app).toBe('com.example.app');
      expect(args.tags).toEqual(['auth', 'critical']);
      expect(args.description).toBe('Main login');
    });

    it('should parse device family with simulator', () => {
      const args = parseBaselineArgs(
        '/ios.baseline save home --device-family iPhone-Pro-Max -s "iPhone 15 Pro Max"'
      );
      expect(args.deviceFamily).toBe('iPhone-Pro-Max');
      expect(args.simulator).toBe('iPhone 15 Pro Max');
    });
  });

  describe('quoted string handling', () => {
    it('should handle double-quoted strings', () => {
      const args = parseBaselineArgs('/ios.baseline save test -s "iPhone 15 Pro Max"');
      expect(args.simulator).toBe('iPhone 15 Pro Max');
    });

    it('should handle single-quoted strings', () => {
      const args = parseBaselineArgs("/ios.baseline save test -s 'iPhone SE (3rd generation)'");
      expect(args.simulator).toBe('iPhone SE (3rd generation)');
    });

    it('should handle quoted description with spaces', () => {
      const args = parseBaselineArgs(
        '/ios.baseline save test --description "A detailed description with spaces"'
      );
      expect(args.description).toBe('A detailed description with spaces');
    });
  });
});

// =============================================================================
// Command Execution Tests
// =============================================================================

describe('executeBaselineCommand', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe('save subcommand', () => {
    it('should save a baseline successfully', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline save login_screen -a com.example.app',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Baseline Saved');
      expect(result.output).toContain('login_screen');
    });

    it('should return error when name is missing', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline save',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Baseline name is required');
    });
  });

  describe('update subcommand', () => {
    it('should update an existing baseline', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline update login_screen',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Baseline Updated');
    });

    it('should return error when name is missing', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline update',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Baseline name is required');
    });
  });

  describe('list subcommand', () => {
    it('should list baselines for a project', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline list',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Baselines');
      expect(result.output).toContain('login_screen');
      expect(result.output).toContain('home_screen');
      expect(result.output).toContain('checkout_flow');
    });
  });

  describe('show subcommand', () => {
    it('should show baseline details', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline show login_screen',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Baseline:');
      expect(result.output).toContain('Device');
      expect(result.output).toContain('iPhone 15 Pro');
    });

    it('should return error when name is missing', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline show',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Baseline name is required');
    });
  });

  describe('delete subcommand', () => {
    it('should delete a baseline', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline delete old_baseline',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Baseline Deleted');
    });

    it('should return error when name is missing', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline delete',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Baseline name is required');
    });
  });

  describe('ignore subcommand', () => {
    it('should add an ignore region', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline ignore login_screen --region status_bar:0,0,390,54',
        'test-session',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Ignore Region Added');
      expect(result.output).toContain('status_bar');
    });

    it('should return error when name is missing', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline ignore',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Baseline name is required');
    });

    it('should return error when region is missing', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline ignore login_screen',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Region specification is required');
    });
  });

  describe('default behavior', () => {
    it('should show usage help when no subcommand provided', async () => {
      const result = await executeBaselineCommand(
        '/ios.baseline',
        'test-session',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain('Subcommands');
      expect(result.output).toContain('save');
      expect(result.output).toContain('update');
      expect(result.output).toContain('list');
    });
  });
});

// =============================================================================
// Metadata Tests
// =============================================================================

describe('baselineCommandMetadata', () => {
  it('should have correct command name', () => {
    expect(baselineCommandMetadata.command).toBe('/ios.baseline');
  });

  it('should have description', () => {
    expect(baselineCommandMetadata.description).toBeTruthy();
    expect(baselineCommandMetadata.description.length).toBeGreaterThan(10);
  });

  it('should have usage instructions', () => {
    expect(baselineCommandMetadata.usage).toContain('/ios.baseline');
  });

  it('should have options documented', () => {
    expect(baselineCommandMetadata.options.length).toBeGreaterThan(0);

    // Check for key options
    const optionNames = baselineCommandMetadata.options.map((o) => o.name);
    expect(optionNames).toContain('--project, -p');
    expect(optionNames).toContain('--simulator, -s');
    expect(optionNames).toContain('--app, -a');
    expect(optionNames).toContain('--device-family');
    expect(optionNames).toContain('--tags');
    expect(optionNames).toContain('--region');
  });

  it('should have examples', () => {
    expect(baselineCommandMetadata.examples.length).toBeGreaterThan(0);

    // Check examples contain the command
    for (const example of baselineCommandMetadata.examples) {
      expect(example).toContain('/ios.baseline');
    }
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('edge cases', () => {
  describe('parseBaselineArgs edge cases', () => {
    it('should handle extra whitespace', () => {
      const args = parseBaselineArgs('/ios.baseline   save   test_screen  ');
      expect(args.subcommand).toBe('save');
      expect(args.name).toBe('test_screen');
    });

    it('should handle baseline names with underscores', () => {
      const args = parseBaselineArgs('/ios.baseline save my_test_baseline');
      expect(args.name).toBe('my_test_baseline');
    });

    it('should handle baseline names with hyphens', () => {
      const args = parseBaselineArgs('/ios.baseline save my-test-baseline');
      expect(args.name).toBe('my-test-baseline');
    });

    it('should handle invalid device family gracefully', () => {
      const args = parseBaselineArgs('/ios.baseline save test --device-family InvalidFamily');
      expect(args.deviceFamily).toBeUndefined();
    });

    it('should handle invalid ignore reason gracefully', () => {
      const args = parseBaselineArgs(
        '/ios.baseline ignore test --region 0,0,100,100 --reason invalid_reason'
      );
      // Reason should not be set for invalid values
      expect(args.ignoreRegion?.reason).toBeUndefined();
    });

    it('should handle tags with extra spaces', () => {
      const args = parseBaselineArgs('/ios.baseline save test --tags "tag1, tag2 , tag3"');
      expect(args.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('device family validation', () => {
    it('should accept valid device families', () => {
      const validFamilies = ['iPhone-SE', 'iPhone', 'iPhone-Plus', 'iPhone-Pro-Max', 'iPad', 'iPad-Pro'];
      for (const family of validFamilies) {
        const args = parseBaselineArgs(`/ios.baseline save test --device-family ${family}`);
        expect(args.deviceFamily).toBe(family);
      }
    });
  });

  describe('ignore reason validation', () => {
    it('should accept valid ignore reasons', () => {
      const validReasons = [
        'status_bar', 'dynamic_content', 'timestamp', 'user_avatar',
        'random_content', 'animation', 'external_data', 'custom'
      ];
      for (const reason of validReasons) {
        const args = parseBaselineArgs(
          `/ios.baseline ignore test --region 0,0,100,100 --reason ${reason}`
        );
        expect(args.ignoreRegion?.reason).toBe(reason);
      }
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('integration tests', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should use directory name as default project', async () => {
    const iosTools = await import('../../ios-tools');

    await executeBaselineCommand(
      '/ios.baseline save login_screen -a com.example.app',
      'test-session',
      '/Users/test/MyAppProject'
    );

    // The project name should be derived from the path basename
    expect(iosTools.createBaseline).toHaveBeenCalledWith(
      'MyAppProject',
      'login_screen',
      expect.any(String),
      expect.any(Object),
      'com.example.app',
      expect.any(Object)
    );
  });

  it('should respect explicit project name over path', async () => {
    const iosTools = await import('../../ios-tools');

    await executeBaselineCommand(
      '/ios.baseline save login_screen -p CustomProject -a com.example.app',
      'test-session',
      '/Users/test/DifferentPath'
    );

    expect(iosTools.createBaseline).toHaveBeenCalledWith(
      'CustomProject',
      'login_screen',
      expect.any(String),
      expect.any(Object),
      'com.example.app',
      expect.any(Object)
    );
  });

  it('should pass device family to storage functions', async () => {
    const iosTools = await import('../../ios-tools');

    await executeBaselineCommand(
      '/ios.baseline save login_screen -a com.example.app --device-family iPhone-Pro-Max',
      'test-session',
      testDir
    );

    expect(iosTools.createBaseline).toHaveBeenCalledWith(
      expect.any(String),
      'login_screen',
      expect.any(String),
      expect.any(Object),
      'com.example.app',
      expect.objectContaining({
        deviceFamily: 'iPhone-Pro-Max',
      })
    );
  });

  it('should pass tags to storage functions', async () => {
    const iosTools = await import('../../ios-tools');

    await executeBaselineCommand(
      '/ios.baseline save login_screen -a com.example.app --tags auth,critical',
      'test-session',
      testDir
    );

    expect(iosTools.createBaseline).toHaveBeenCalledWith(
      expect.any(String),
      'login_screen',
      expect.any(String),
      expect.any(Object),
      'com.example.app',
      expect.objectContaining({
        tags: ['auth', 'critical'],
      })
    );
  });
});
