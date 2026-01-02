/**
 * Tests for iOS autocomplete provider module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  // Types
  CompletionType,
  CompletionItem,
  CompletionResult,
  CompletionOptions,
  CommandArgDefinition,
  // Cache management
  clearAllCaches,
  clearCache,
  // Individual completion types
  getSimulatorCompletions,
  getBundleIdCompletions,
  getSchemeCompletions,
  getFlowCompletions,
  getBaselineCompletions,
  getElementCompletions,
  // Unified interface
  getCompletions,
  getAllCompletions,
  // Element caching
  cacheInspectElements,
  extractElementsFromInspect,
  // Command argument helpers
  getArgumentCompletionType,
  COMMAND_ARGUMENTS,
} from '../autocomplete';

// Test utilities
const TEST_PROJECT_PATH = '/tmp/maestro-autocomplete-test-project';

// Mock the simulator module
vi.mock('../simulator', () => ({
  listSimulators: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        name: 'iPhone 15 Pro',
        udid: '11111111-1111-1111-1111-111111111111',
        state: 'Booted',
        isAvailable: true,
        iosVersion: '17.2',
        deviceType: 'iPhone',
      },
      {
        name: 'iPhone 15',
        udid: '22222222-2222-2222-2222-222222222222',
        state: 'Shutdown',
        isAvailable: true,
        iosVersion: '17.2',
        deviceType: 'iPhone',
      },
      {
        name: 'iPhone 14',
        udid: '33333333-3333-3333-3333-333333333333',
        state: 'Shutdown',
        isAvailable: true,
        iosVersion: '16.4',
        deviceType: 'iPhone',
      },
      {
        name: 'iPad Pro',
        udid: '44444444-4444-4444-4444-444444444444',
        state: 'Shutdown',
        isAvailable: true,
        iosVersion: '17.2',
        deviceType: 'iPad',
      },
      {
        name: 'Unavailable Sim',
        udid: '55555555-5555-5555-5555-555555555555',
        state: 'Shutdown',
        isAvailable: false,
        iosVersion: '15.0',
        deviceType: 'iPhone',
      },
    ],
  }),
  getBootedSimulators: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        name: 'iPhone 15 Pro',
        udid: '11111111-1111-1111-1111-111111111111',
        state: 'Booted',
        isAvailable: true,
        iosVersion: '17.2',
        deviceType: 'iPhone',
      },
    ],
  }),
}));

// Mock execFileNoThrow for bundle ID tests
vi.mock('../../utils/execFile', () => ({
  execFileNoThrow: vi.fn().mockImplementation(async (cmd, args) => {
    if (cmd === 'xcrun' && args[0] === 'simctl' && args[1] === 'listapps') {
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          'com.example.myapp': {
            CFBundleDisplayName: 'My App',
            CFBundleName: 'MyApp',
          },
          'com.example.testapp': {
            CFBundleDisplayName: 'Test App',
            CFBundleName: 'TestApp',
          },
          'com.apple.mobilesafari': {
            CFBundleDisplayName: 'Safari',
            CFBundleName: 'Safari',
          },
        }),
        stderr: '',
      };
    }
    return { exitCode: 1, stdout: '', stderr: 'Command not mocked' };
  }),
}));

// Mock project detection for scheme tests
vi.mock('../setup/detector', () => ({
  detectProjectType: vi.fn().mockResolvedValue({
    success: true,
    data: {
      found: true,
      type: 'xcworkspace',
      projectPath: '/test/MyApp.xcworkspace',
      projectName: 'MyApp',
      schemes: [
        { name: 'MyApp', isTest: false, isUITest: false },
        { name: 'MyAppTests', isTest: true, isUITest: false },
        { name: 'MyAppUITests', isTest: true, isUITest: true },
      ],
      targets: ['MyApp', 'MyAppTests', 'MyAppUITests'],
      hasUITestTarget: true,
      uiTestTargetName: 'MyAppUITests',
      issues: [],
      recommendations: [],
    },
  }),
}));

// Setup and teardown
beforeAll(async () => {
  // Create test directory structure
  await fs.mkdir(TEST_PROJECT_PATH, { recursive: true });
  await fs.mkdir(path.join(TEST_PROJECT_PATH, 'maestro'), { recursive: true });
  await fs.mkdir(path.join(TEST_PROJECT_PATH, 'ios-baselines'), { recursive: true });

  // Create some test flow files
  await fs.writeFile(
    path.join(TEST_PROJECT_PATH, 'maestro', 'login_flow.yaml'),
    'appId: com.example.app\n---\n- launchApp'
  );
  await fs.writeFile(
    path.join(TEST_PROJECT_PATH, 'maestro', 'home_flow.yaml'),
    'appId: com.example.app\n---\n- launchApp'
  );
  await fs.writeFile(
    path.join(TEST_PROJECT_PATH, 'maestro', 'checkout_flow.yml'),
    'appId: com.example.app\n---\n- launchApp'
  );

  // Create some baseline files
  await fs.writeFile(
    path.join(TEST_PROJECT_PATH, 'ios-baselines', 'login_screen.png'),
    'fake-png-data'
  );
  await fs.writeFile(
    path.join(TEST_PROJECT_PATH, 'ios-baselines', 'home_screen.png'),
    'fake-png-data'
  );
  await fs.writeFile(
    path.join(TEST_PROJECT_PATH, 'ios-baselines', 'metadata.json'),
    JSON.stringify({ name: 'settings_screen', description: 'Settings screen baseline' })
  );
});

afterAll(async () => {
  try {
    await fs.rm(TEST_PROJECT_PATH, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

beforeEach(() => {
  clearAllCaches();
});

// =============================================================================
// Cache Management Tests
// =============================================================================

describe('Cache Management', () => {
  it('should clear all caches', () => {
    // Pre-populate caches
    clearAllCaches();
    // This should not throw
    expect(() => clearAllCaches()).not.toThrow();
  });

  it('should clear specific cache types', () => {
    const types: CompletionType[] = [
      'simulator',
      'bundleId',
      'scheme',
      'flow',
      'baseline',
      'element',
    ];

    for (const type of types) {
      expect(() => clearCache(type)).not.toThrow();
    }
  });

  it('should clear cache with key', () => {
    expect(() => clearCache('bundleId', 'some-udid')).not.toThrow();
    expect(() => clearCache('scheme', '/some/path')).not.toThrow();
    expect(() => clearCache('flow', '/some/path')).not.toThrow();
    expect(() => clearCache('baseline', '/some/path')).not.toThrow();
  });
});

// =============================================================================
// Simulator Completions Tests
// =============================================================================

describe('Simulator Completions', () => {
  it('should return list of simulators', async () => {
    const result = await getSimulatorCompletions();

    expect(result.success).toBe(true);
    expect(result.type).toBe('simulator');
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('should exclude unavailable simulators', async () => {
    const result = await getSimulatorCompletions();

    const unavailable = result.items.find((i) => i.value === 'Unavailable Sim');
    expect(unavailable).toBeUndefined();
  });

  it('should prioritize booted simulators', async () => {
    const result = await getSimulatorCompletions();

    // First item should be the booted simulator
    expect(result.items[0].value).toBe('iPhone 15 Pro');
    expect(result.items[0].category).toBe('Booted');
  });

  it('should include iOS version in description', async () => {
    const result = await getSimulatorCompletions();

    const iPhone15Pro = result.items.find((i) => i.value === 'iPhone 15 Pro');
    expect(iPhone15Pro?.description).toContain('iOS 17.2');
    expect(iPhone15Pro?.description).toContain('Booted');
  });

  it('should include UDID in metadata', async () => {
    const result = await getSimulatorCompletions();

    const iPhone15Pro = result.items.find((i) => i.value === 'iPhone 15 Pro');
    expect(iPhone15Pro?.metadata?.udid).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('should filter by prefix', async () => {
    const result = await getSimulatorCompletions({ prefix: 'iPhone 15' });

    expect(result.items.length).toBe(2);
    expect(result.items.every((i) => i.value.startsWith('iPhone 15'))).toBe(true);
  });

  it('should limit results', async () => {
    const result = await getSimulatorCompletions({ limit: 2 });

    expect(result.items.length).toBe(2);
  });

  it('should use cache on subsequent calls', async () => {
    const result1 = await getSimulatorCompletions();
    const result2 = await getSimulatorCompletions();

    expect(result1.fromCache).toBe(false);
    expect(result2.fromCache).toBe(true);
  });

  it('should bypass cache with forceRefresh', async () => {
    await getSimulatorCompletions();
    const result = await getSimulatorCompletions({ forceRefresh: true });

    expect(result.fromCache).toBe(false);
  });
});

// =============================================================================
// Bundle ID Completions Tests
// =============================================================================

describe('Bundle ID Completions', () => {
  it('should return list of bundle IDs', async () => {
    const result = await getBundleIdCompletions();

    expect(result.success).toBe(true);
    expect(result.type).toBe('bundleId');
    expect(result.items.length).toBe(3);
  });

  it('should prioritize user apps over system apps', async () => {
    const result = await getBundleIdCompletions();

    // User apps should come before system apps
    const userApps = result.items.filter((i) => i.category === 'User');
    const systemApps = result.items.filter((i) => i.category === 'System');

    expect(userApps.length).toBe(2);
    expect(systemApps.length).toBe(1);

    // First items should be user apps
    expect(result.items[0].category).toBe('User');
    expect(result.items[1].category).toBe('User');
  });

  it('should include display name in description', async () => {
    const result = await getBundleIdCompletions();

    const myApp = result.items.find((i) => i.value === 'com.example.myapp');
    expect(myApp?.description).toBe('My App');
  });

  it('should filter by prefix', async () => {
    const result = await getBundleIdCompletions({ prefix: 'com.example' });

    expect(result.items.length).toBe(2);
    expect(result.items.every((i) => i.value.startsWith('com.example'))).toBe(true);
  });

  it('should use specific simulator UDID', async () => {
    const result = await getBundleIdCompletions({
      simulatorUdid: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.success).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Scheme Completions Tests
// =============================================================================

describe('Scheme Completions', () => {
  it('should require projectPath', async () => {
    const result = await getSchemeCompletions();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Project path is required');
  });

  it('should return list of schemes', async () => {
    const result = await getSchemeCompletions({ projectPath: TEST_PROJECT_PATH });

    expect(result.success).toBe(true);
    expect(result.type).toBe('scheme');
    expect(result.items.length).toBe(3);
  });

  it('should categorize schemes correctly', async () => {
    const result = await getSchemeCompletions({ projectPath: TEST_PROJECT_PATH });

    const appScheme = result.items.find((i) => i.value === 'MyApp');
    const testScheme = result.items.find((i) => i.value === 'MyAppTests');
    const uiTestScheme = result.items.find((i) => i.value === 'MyAppUITests');

    expect(appScheme?.category).toBe('Apps');
    expect(testScheme?.category).toBe('Tests');
    expect(uiTestScheme?.category).toBe('UI Tests');
  });

  it('should prioritize app schemes over test schemes', async () => {
    const result = await getSchemeCompletions({ projectPath: TEST_PROJECT_PATH });

    // First item should be the app scheme
    expect(result.items[0].value).toBe('MyApp');
    expect(result.items[0].priority).toBe(0);
  });
});

// =============================================================================
// Flow Completions Tests
// =============================================================================

describe('Flow Completions', () => {
  it('should require projectPath', async () => {
    const result = await getFlowCompletions();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Project path is required');
  });

  it('should return list of flow files', async () => {
    const result = await getFlowCompletions({ projectPath: TEST_PROJECT_PATH });

    expect(result.success).toBe(true);
    expect(result.type).toBe('flow');
    expect(result.items.length).toBe(3);
  });

  it('should include both .yaml and .yml files', async () => {
    const result = await getFlowCompletions({ projectPath: TEST_PROJECT_PATH });

    const yamlFiles = result.items.filter((i) => i.value.endsWith('.yaml'));
    const ymlFiles = result.items.filter((i) => i.value.endsWith('.yml'));

    expect(yamlFiles.length).toBe(2);
    expect(ymlFiles.length).toBe(1);
  });

  it('should use relative paths as values', async () => {
    const result = await getFlowCompletions({ projectPath: TEST_PROJECT_PATH });

    expect(result.items[0].value).toContain('maestro/');
    expect(result.items[0].value).not.toContain(TEST_PROJECT_PATH);
  });

  it('should include absolute path in metadata', async () => {
    const result = await getFlowCompletions({ projectPath: TEST_PROJECT_PATH });

    expect(result.items[0].metadata?.absolutePath).toContain(TEST_PROJECT_PATH);
  });

  it('should filter by prefix', async () => {
    const result = await getFlowCompletions({
      projectPath: TEST_PROJECT_PATH,
      prefix: 'maestro/login',
    });

    expect(result.items.length).toBe(1);
    expect(result.items[0].value).toContain('login_flow');
  });
});

// =============================================================================
// Baseline Completions Tests
// =============================================================================

describe('Baseline Completions', () => {
  it('should require projectPath', async () => {
    const result = await getBaselineCompletions();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Project path is required');
  });

  it('should return list of baseline files', async () => {
    const result = await getBaselineCompletions({ projectPath: TEST_PROJECT_PATH });

    expect(result.success).toBe(true);
    expect(result.type).toBe('baseline');
    expect(result.items.length).toBeGreaterThanOrEqual(2);
  });

  it('should include baselines from metadata.json', async () => {
    const result = await getBaselineCompletions({ projectPath: TEST_PROJECT_PATH });

    const settingsBaseline = result.items.find((i) => i.value === 'settings_screen');
    expect(settingsBaseline).toBeDefined();
    expect(settingsBaseline?.description).toBe('Settings screen baseline');
  });

  it('should exclude diff and mask images', async () => {
    // Create some diff/mask files
    await fs.writeFile(
      path.join(TEST_PROJECT_PATH, 'ios-baselines', 'test_diff.png'),
      'fake-png-data'
    );
    await fs.writeFile(
      path.join(TEST_PROJECT_PATH, 'ios-baselines', 'test_mask.png'),
      'fake-png-data'
    );

    const result = await getBaselineCompletions({
      projectPath: TEST_PROJECT_PATH,
      forceRefresh: true,
    });

    const diffFile = result.items.find((i) => i.value.includes('_diff'));
    const maskFile = result.items.find((i) => i.value.includes('_mask'));

    expect(diffFile).toBeUndefined();
    expect(maskFile).toBeUndefined();
  });

  it('should filter by prefix', async () => {
    const result = await getBaselineCompletions({
      projectPath: TEST_PROJECT_PATH,
      prefix: 'login',
    });

    expect(result.items.length).toBe(1);
    expect(result.items[0].value).toContain('login');
  });
});

// =============================================================================
// Element Completions Tests
// =============================================================================

describe('Element Completions', () => {
  it('should return error when no elements cached', async () => {
    clearCache('element');
    const result = await getElementCompletions();

    expect(result.success).toBe(false);
    expect(result.error).toContain('No elements cached');
  });

  it('should return cached elements', async () => {
    cacheInspectElements([
      { identifier: 'loginButton', type: 'button', label: 'Log In' },
      { identifier: 'usernameField', type: 'textField', label: 'Username' },
      { label: 'Submit', type: 'button' },
    ]);

    const result = await getElementCompletions();

    expect(result.success).toBe(true);
    expect(result.type).toBe('element');
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('should prioritize identifiers over labels', async () => {
    cacheInspectElements([
      { identifier: 'loginButton', type: 'button', label: 'Log In' },
      { label: 'Submit', type: 'button' },
    ]);

    const result = await getElementCompletions();

    // Identifiers should come before labels
    const identifiers = result.items.filter((i) => i.category === 'Identifier');
    const labels = result.items.filter((i) => i.category === 'Label');

    expect(identifiers[0].priority).toBe(0);
    expect(labels[0].priority).toBe(1);
  });

  it('should include element type in description', async () => {
    cacheInspectElements([
      { identifier: 'loginButton', type: 'button', label: 'Log In' },
    ]);

    const result = await getElementCompletions();

    const loginButton = result.items.find((i) => i.value === 'loginButton');
    expect(loginButton?.description).toContain('button');
    expect(loginButton?.description).toContain('Log In');
  });

  it('should deduplicate values', async () => {
    cacheInspectElements([
      { identifier: 'loginButton', type: 'button', label: 'loginButton' },
    ]);

    const result = await getElementCompletions();

    const loginButtons = result.items.filter((i) => i.value === 'loginButton');
    expect(loginButtons.length).toBe(1);
  });

  it('should filter by prefix', async () => {
    cacheInspectElements([
      { identifier: 'loginButton', type: 'button' },
      { identifier: 'logoutButton', type: 'button' },
      { identifier: 'submitButton', type: 'button' },
    ]);

    const result = await getElementCompletions({ prefix: 'log' });

    expect(result.items.length).toBe(2);
    expect(result.items.every((i) => i.value.startsWith('log'))).toBe(true);
  });
});

// =============================================================================
// Element Extraction Tests
// =============================================================================

describe('Element Extraction', () => {
  it('should extract elements from inspect result', () => {
    const rootElement = {
      type: 'application',
      identifier: 'app',
      label: 'My App',
      children: [
        {
          type: 'window',
          children: [
            { type: 'button', identifier: 'loginBtn', label: 'Login' },
            { type: 'textField', identifier: 'usernameField' },
            { type: 'staticText', value: 'Welcome' },
          ],
        },
      ],
    };

    const elements = extractElementsFromInspect(rootElement);

    expect(elements.length).toBe(3); // app, loginBtn, usernameField (staticText has no id/label)
    expect(elements.find((e) => e.identifier === 'loginBtn')).toBeDefined();
    expect(elements.find((e) => e.identifier === 'usernameField')).toBeDefined();
  });

  it('should include frame data when available', () => {
    const rootElement = {
      type: 'button',
      identifier: 'btn',
      frame: { x: 10, y: 20, width: 100, height: 44 },
    };

    const elements = extractElementsFromInspect(rootElement);

    expect(elements[0].frame).toEqual({ x: 10, y: 20, width: 100, height: 44 });
  });

  it('should handle empty children array', () => {
    const rootElement = {
      type: 'view',
      identifier: 'root',
      children: [],
    };

    const elements = extractElementsFromInspect(rootElement);

    expect(elements.length).toBe(1);
  });
});

// =============================================================================
// Unified Completion Interface Tests
// =============================================================================

describe('Unified Completion Interface', () => {
  it('should route to correct handler by type', async () => {
    const simulatorResult = await getCompletions('simulator');
    expect(simulatorResult.type).toBe('simulator');

    const bundleIdResult = await getCompletions('bundleId');
    expect(bundleIdResult.type).toBe('bundleId');
  });

  it('should return error for unknown type', async () => {
    const result = await getCompletions('unknown' as CompletionType);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown completion type');
  });

  it('should pass options through', async () => {
    const result = await getCompletions('simulator', { limit: 2 });

    expect(result.items.length).toBe(2);
  });
});

// =============================================================================
// Get All Completions Tests
// =============================================================================

describe('Get All Completions', () => {
  it('should fetch multiple completion types', async () => {
    cacheInspectElements([{ identifier: 'test', type: 'button' }]);

    const results = await getAllCompletions({ projectPath: TEST_PROJECT_PATH });

    expect(results.has('simulator')).toBe(true);
    expect(results.has('bundleId')).toBe(true);
    expect(results.has('scheme')).toBe(true);
    expect(results.has('flow')).toBe(true);
    expect(results.has('baseline')).toBe(true);
    expect(results.has('element')).toBe(true);
  });

  it('should skip project-dependent completions without projectPath', async () => {
    const results = await getAllCompletions({});

    expect(results.has('simulator')).toBe(true);
    expect(results.has('bundleId')).toBe(true);
    expect(results.has('scheme')).toBe(false);
    expect(results.has('flow')).toBe(false);
    expect(results.has('baseline')).toBe(false);
  });
});

// =============================================================================
// Command Argument Helpers Tests
// =============================================================================

describe('Command Arguments', () => {
  it('should define arguments for iOS commands', () => {
    expect(COMMAND_ARGUMENTS['/ios.snapshot']).toBeDefined();
    expect(COMMAND_ARGUMENTS['/ios.inspect']).toBeDefined();
    expect(COMMAND_ARGUMENTS['/ios.tap']).toBeDefined();
    expect(COMMAND_ARGUMENTS['/ios.run_flow']).toBeDefined();
  });

  it('should include simulator flag for relevant commands', () => {
    const snapshotArgs = COMMAND_ARGUMENTS['/ios.snapshot'];
    const simulatorArg = snapshotArgs.find((a) => a.name === '-s' || a.name === '--simulator');

    expect(simulatorArg).toBeDefined();
    expect(simulatorArg?.completionType).toBe('simulator');
  });

  it('should include element positional arg for interaction commands', () => {
    const tapArgs = COMMAND_ARGUMENTS['/ios.tap'];
    const elementArg = tapArgs.find((a) => a.positional && a.completionType === 'element');

    expect(elementArg).toBeDefined();
    expect(elementArg?.required).toBe(true);
  });

  it('should include flow positional arg for run_flow command', () => {
    const runFlowArgs = COMMAND_ARGUMENTS['/ios.run_flow'];
    const flowArg = runFlowArgs.find((a) => a.positional && a.completionType === 'flow');

    expect(flowArg).toBeDefined();
    expect(flowArg?.required).toBe(true);
  });

  it('should include baseline arg for diff command', () => {
    const diffArgs = COMMAND_ARGUMENTS['/ios.diff'];
    const baselineArg = diffArgs.find((a) => a.completionType === 'baseline');

    expect(baselineArg).toBeDefined();
    expect(baselineArg?.positional).toBe(true);
  });
});

// =============================================================================
// Argument Completion Type Detection Tests
// =============================================================================

describe('Argument Completion Type Detection', () => {
  it('should return null for unknown command', () => {
    const result = getArgumentCompletionType('/unknown.command', '', undefined);
    expect(result).toBeNull();
  });

  it('should detect flag value completion type', () => {
    const result = getArgumentCompletionType('/ios.snapshot', '', '-s');
    expect(result).toBe('simulator');
  });

  it('should detect positional argument completion type', () => {
    const result = getArgumentCompletionType('/ios.tap', 'loginBtn', undefined);
    expect(result).toBe('element');
  });

  it('should detect flow file completion for run_flow', () => {
    const result = getArgumentCompletionType('/ios.run_flow', 'maestro/', undefined);
    expect(result).toBe('flow');
  });

  it('should detect baseline completion for diff', () => {
    const result = getArgumentCompletionType('/ios.diff', 'login', undefined);
    expect(result).toBe('baseline');
  });

  it('should return null for flags without values', () => {
    const result = getArgumentCompletionType('/ios.snapshot', '--help', undefined);
    expect(result).toBeNull();
  });
});

// =============================================================================
// Performance Tests
// =============================================================================

describe('Performance', () => {
  it('should complete quickly for cached results', async () => {
    // Prime the cache
    await getSimulatorCompletions();

    // Measure cached retrieval
    const start = Date.now();
    const result = await getSimulatorCompletions();
    const duration = Date.now() - start;

    expect(result.fromCache).toBe(true);
    expect(result.durationMs).toBeLessThan(10);
    expect(duration).toBeLessThan(50);
  });

  it('should track duration in result', async () => {
    clearCache('simulator');
    const result = await getSimulatorCompletions();

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// Edge Cases Tests
// =============================================================================

describe('Edge Cases', () => {
  it('should handle empty prefix', async () => {
    const result = await getSimulatorCompletions({ prefix: '' });

    expect(result.success).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('should handle prefix with no matches', async () => {
    const result = await getSimulatorCompletions({ prefix: 'NonExistent' });

    expect(result.success).toBe(true);
    expect(result.items.length).toBe(0);
  });

  it('should handle limit of 0', async () => {
    const result = await getSimulatorCompletions({ limit: 0 });

    // Limit of 0 should be treated as no limit
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('should handle negative limit', async () => {
    const result = await getSimulatorCompletions({ limit: -1 });

    // Negative limit should be treated as no limit
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('should handle case-insensitive prefix filtering', async () => {
    const result1 = await getSimulatorCompletions({ prefix: 'iphone' });
    const result2 = await getSimulatorCompletions({ prefix: 'iPhone' });

    expect(result1.items.length).toBe(result2.items.length);
  });
});
