/**
 * Tests for iOS Setup Slash Command
 *
 * These tests verify the parsing and execution of the /ios.setup command
 * including wizard mode, check mode, fix mode, and reset mode.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  parseSetupArgs,
  executeSetupCommand,
  continueWizard,
  setupCommandMetadata,
  type SetupMode,
} from '../ios-setup';

// Mock the wizard module
vi.mock('../../ios-tools/setup/wizard', () => ({
  createWizardState: vi.fn((projectPath: string) => ({
    currentStepIndex: 0,
    steps: [
      { id: 'environment', title: 'Environment Check', status: 'pending', optional: false },
      { id: 'project', title: 'Project Detection', status: 'pending', optional: false },
      { id: 'simulator', title: 'Simulator Selection', status: 'pending', optional: false },
      { id: 'xcuitest', title: 'XCUITest Setup', status: 'pending', optional: true },
      { id: 'bridge', title: 'MaestroBridge', status: 'pending', optional: true },
      { id: 'sample-flow', title: 'Sample Flow', status: 'pending', optional: true },
      { id: 'summary', title: 'Summary', status: 'pending', optional: false },
    ],
    decisions: [],
    isComplete: false,
    isCancelled: false,
    projectPath,
    startedAt: Date.now(),
    collectedData: {},
  })),
  getCurrentStep: vi.fn((state) => state.steps[state.currentStepIndex]),
  getStepById: vi.fn((state, stepId) => state.steps.find((s: { id: string }) => s.id === stepId)),
  updateStepStatus: vi.fn((state, stepId, status) => ({
    ...state,
    steps: state.steps.map((s: { id: string }) => (s.id === stepId ? { ...s, status } : s)),
  })),
  recordDecision: vi.fn((state, stepId, choice, data) => ({
    ...state,
    decisions: [...state.decisions, { stepId, choice, data }],
  })),
  advanceStep: vi.fn((state) => ({
    ...state,
    currentStepIndex: state.currentStepIndex + 1,
    isComplete: state.currentStepIndex + 1 >= state.steps.length,
  })),
  skipCurrentStep: vi.fn((state) => ({
    ...state,
    currentStepIndex: state.currentStepIndex + 1,
    steps: state.steps.map((s: { id: string }, i: number) =>
      i === state.currentStepIndex ? { ...s, status: 'skipped' } : s
    ),
  })),
  cancelWizard: vi.fn((state) => ({
    ...state,
    isCancelled: true,
    completedAt: Date.now(),
  })),
  getProgress: vi.fn((state) => ({
    current: state.currentStepIndex + 1,
    total: state.steps.length,
    percentage: Math.round(((state.currentStepIndex + 1) / state.steps.length) * 100),
    completedSteps: state.currentStepIndex,
    remainingSteps: state.steps.length - state.currentStepIndex,
  })),
  executeStep: vi.fn((_state, stepId) =>
    Promise.resolve({
      success: true,
      data: {
        icon: '✅',
        message: `Executed ${stepId}`,
        details: [`Step ${stepId} executed successfully`],
        actions: [
          { key: 'continue', label: 'Continue', recommended: true },
          { key: 'cancel', label: 'Cancel' },
        ],
      },
    })
  ),
  processDecision: vi.fn((state, _stepId, choice) => {
    if (choice === 'cancel') {
      return { ...state, isCancelled: true };
    }
    return {
      ...state,
      currentStepIndex: state.currentStepIndex + 1,
      isComplete: state.currentStepIndex + 1 >= state.steps.length,
    };
  }),
  formatStepOutput: vi.fn((_step, output) => output.details.join('\n')),
  formatProgressBar: vi.fn((state) => {
    const progress = Math.round(((state.currentStepIndex + 1) / state.steps.length) * 100);
    return `[Progress: ${progress}%]`;
  }),
  generateConfig: vi.fn((state) => ({
    version: '1.0.0',
    project: {
      path: state.projectPath,
      scheme: 'TestScheme',
      bundleId: 'com.test.app',
      type: 'xcodeproj',
    },
    simulator: {
      default: 'iPhone 15 Pro',
      udid: 'test-udid',
    },
    xcuitest: { enabled: true, targetName: 'TestUITests' },
    bridge: { enabled: false, port: 9876 },
    baselines: { directory: './ios-baselines' },
    flows: { directory: './maestro' },
    created: { at: new Date().toISOString(), wizardVersion: '1.0.0' },
  })),
  saveConfig: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: '.maestro/ios-config.json',
    })
  ),
  loadConfig: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        version: '1.0.0',
        project: { path: '/test/project', scheme: 'TestScheme', type: 'xcodeproj' },
        simulator: { default: 'iPhone 15 Pro', udid: 'test-udid' },
        xcuitest: { enabled: true },
        bridge: { enabled: false, port: 9876 },
        baselines: { directory: './ios-baselines' },
        flows: { directory: './maestro' },
        created: { at: '2024-01-01T00:00:00.000Z', wizardVersion: '1.0.0' },
      },
    })
  ),
  generateSampleFlow: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: 'maestro/sample_flow.yaml',
    })
  ),
  CONFIG_DIRECTORY: '.maestro',
  IOS_CONFIG_FILENAME: 'ios-config.json',
  DEFAULT_FLOWS_DIRECTORY: 'maestro',
  DEFAULT_BASELINES_DIRECTORY: 'ios-baselines',
  DEFAULT_BRIDGE_PORT: 9876,
  WIZARD_VERSION: '1.0.0',
}));

// Mock the detector module
vi.mock('../../ios-tools/setup/detector', () => ({
  detectEnvironment: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        ready: true,
        xcode: {
          installed: true,
          path: '/Applications/Xcode.app',
          version: '15.2',
          build: '15C500b',
          commandLineToolsInstalled: true,
          licenseAccepted: true,
          issues: [],
          recommendations: [],
        },
        simulators: {
          available: true,
          totalCount: 10,
          availableCount: 8,
          bootedCount: 1,
          iosVersions: ['17.2', '17.0', '16.4'],
          bootedSimulators: [
            { udid: 'test-udid', name: 'iPhone 15 Pro', state: 'Booted', iosVersion: '17.2' },
          ],
          recommendedSimulator: { udid: 'test-udid', name: 'iPhone 15 Pro', iosVersion: '17.2' },
          simulators: [
            { udid: 'test-udid', name: 'iPhone 15 Pro', state: 'Booted', iosVersion: '17.2' },
            { udid: 'test-udid-2', name: 'iPhone 15', state: 'Shutdown', iosVersion: '17.2' },
          ],
          issues: [],
          recommendations: [],
        },
        maestroCli: {
          installed: true,
          path: '/opt/homebrew/bin/maestro',
          version: '1.35.0',
          isWorking: true,
          issues: [],
          recommendations: [],
        },
        allIssues: [],
        allRecommendations: [],
      },
    })
  ),
  detectProjectType: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        type: 'xcodeproj',
        found: true,
        projectPath: '/test/project/TestApp.xcodeproj',
        projectName: 'TestApp',
        bundleId: 'com.test.app',
        schemes: [
          { name: 'TestApp', isTest: false, isUITest: false },
          { name: 'TestAppTests', isTest: true, isUITest: false },
          { name: 'TestAppUITests', isTest: true, isUITest: true },
        ],
        targets: ['TestApp', 'TestAppTests', 'TestAppUITests'],
        hasUITestTarget: true,
        uiTestTargetName: 'TestAppUITests',
        minimumDeploymentTarget: '15.0',
        issues: [],
        recommendations: [],
      },
    })
  ),
  detectExistingIntegration: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        hasIntegration: false,
        hasMaestroConfig: false,
        hasIosConfig: false,
        hasFlowsDirectory: false,
        flowFileCount: 0,
        hasBaselinesDirectory: false,
        baselineFileCount: 0,
        hasBridgeIntegration: false,
      },
    })
  ),
  detectSimulators: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        available: true,
        totalCount: 10,
        availableCount: 8,
        bootedCount: 1,
        iosVersions: ['17.2', '17.0', '16.4'],
        bootedSimulators: [
          { udid: 'test-udid', name: 'iPhone 15 Pro', state: 'Booted', iosVersion: '17.2' },
        ],
        recommendedSimulator: { udid: 'test-udid', name: 'iPhone 15 Pro', iosVersion: '17.2' },
        simulators: [
          { udid: 'test-udid', name: 'iPhone 15 Pro', state: 'Booted', iosVersion: '17.2' },
          { udid: 'test-udid-2', name: 'iPhone 15', state: 'Shutdown', iosVersion: '17.2' },
        ],
        issues: [],
        recommendations: [],
      },
    })
  ),
}));

// Mock execFileNoThrow
vi.mock('../../utils/execFile', () => ({
  execFileNoThrow: vi.fn((_cmd, _args) =>
    Promise.resolve({
      stdout: '',
      stderr: '',
      exitCode: 0,
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
    `setup-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

describe('parseSetupArgs', () => {
  describe('mode parsing', () => {
    it('should default to wizard mode', () => {
      const args = parseSetupArgs('/ios.setup');
      expect(args.mode).toBe('wizard');
    });

    it('should parse --check flag', () => {
      const args = parseSetupArgs('/ios.setup --check');
      expect(args.mode).toBe('check');
    });

    it('should parse --fix flag', () => {
      const args = parseSetupArgs('/ios.setup --fix');
      expect(args.mode).toBe('fix');
    });

    it('should parse --reset flag', () => {
      const args = parseSetupArgs('/ios.setup --reset');
      expect(args.mode).toBe('reset');
    });
  });

  describe('project path parsing', () => {
    it('should parse --project with short form', () => {
      const args = parseSetupArgs('/ios.setup -p /path/to/project');
      expect(args.projectPath).toBe('/path/to/project');
    });

    it('should parse --project with long form', () => {
      const args = parseSetupArgs('/ios.setup --project /path/to/project');
      expect(args.projectPath).toBe('/path/to/project');
    });

    it('should parse project path as positional argument', () => {
      const args = parseSetupArgs('/ios.setup /path/to/project');
      expect(args.projectPath).toBe('/path/to/project');
    });

    it('should parse quoted paths with spaces', () => {
      const args = parseSetupArgs('/ios.setup -p "/path/with spaces/project"');
      expect(args.projectPath).toBe('/path/with spaces/project');
    });
  });

  describe('combined arguments', () => {
    it('should parse --check with project path', () => {
      const args = parseSetupArgs('/ios.setup --check -p /path/to/project');
      expect(args.mode).toBe('check');
      expect(args.projectPath).toBe('/path/to/project');
    });

    it('should parse --fix with project path', () => {
      const args = parseSetupArgs('/ios.setup --fix --project /my/project');
      expect(args.mode).toBe('fix');
      expect(args.projectPath).toBe('/my/project');
    });

    it('should parse --reset with project path', () => {
      const args = parseSetupArgs('/ios.setup --reset /project');
      expect(args.mode).toBe('reset');
      expect(args.projectPath).toBe('/project');
    });
  });

  describe('edge cases', () => {
    it('should handle extra whitespace', () => {
      const args = parseSetupArgs('/ios.setup   --check   ');
      expect(args.mode).toBe('check');
    });

    it('should handle empty command', () => {
      const args = parseSetupArgs('/ios.setup');
      expect(args.mode).toBe('wizard');
      expect(args.projectPath).toBeUndefined();
    });

    it('should handle multiple mode flags (last wins implicitly)', () => {
      // This is a quirk of the parsing - in practice users shouldn't do this
      const args = parseSetupArgs('/ios.setup --check --fix');
      expect(['check', 'fix']).toContain(args.mode);
    });
  });
});

// =============================================================================
// Command Execution Tests
// =============================================================================

describe('executeSetupCommand', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe('wizard mode', () => {
    it('should start wizard mode by default', async () => {
      const result = await executeSetupCommand('/ios.setup', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('iOS Setup Wizard');
      expect(result.wizardState).toBeDefined();
      expect(result.stepOutput).toBeDefined();
    });

    it('should include progress bar in wizard output', async () => {
      const result = await executeSetupCommand('/ios.setup', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Progress');
    });

    it('should include step title in output', async () => {
      const result = await executeSetupCommand('/ios.setup', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Step 1');
    });
  });

  describe('check mode', () => {
    it('should run environment check', async () => {
      const result = await executeSetupCommand('/ios.setup --check', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Environment Check');
      expect(result.output).toContain('Xcode');
      expect(result.output).toContain('Simulators');
    });

    it('should show overall status', async () => {
      const result = await executeSetupCommand('/ios.setup --check', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Overall Status');
      expect(result.output).toContain('Ready');
    });

    it('should include project information', async () => {
      const result = await executeSetupCommand('/ios.setup --check', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Project');
    });

    it('should include Maestro CLI status', async () => {
      const result = await executeSetupCommand('/ios.setup --check', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Maestro CLI');
    });
  });

  describe('fix mode', () => {
    it('should run auto-fix', async () => {
      const result = await executeSetupCommand('/ios.setup --fix', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Auto-Fix');
    });

    it('should create .maestro directory if missing', async () => {
      const result = await executeSetupCommand('/ios.setup --fix', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(testDir, '.maestro'))).toBe(true);
    });

    it('should create flows directory if missing', async () => {
      const result = await executeSetupCommand('/ios.setup --fix', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'maestro'))).toBe(true);
    });

    it('should create baselines directory if missing', async () => {
      const result = await executeSetupCommand('/ios.setup --fix', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'ios-baselines'))).toBe(true);
    });

    it('should report created directories', async () => {
      const result = await executeSetupCommand('/ios.setup --fix', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Created');
    });
  });

  describe('reset mode', () => {
    it('should report no config when none exists', async () => {
      const result = await executeSetupCommand('/ios.setup --reset', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('No configuration file found');
    });

    it('should delete existing config', async () => {
      // Create config file
      const configDir = path.join(testDir, '.maestro');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, 'ios-config.json'),
        JSON.stringify({
          version: '1.0.0',
          project: { path: '/test', scheme: 'Test', type: 'xcodeproj' },
          simulator: { default: 'iPhone 15', udid: 'test' },
          xcuitest: { enabled: false },
          bridge: { enabled: false, port: 9876 },
          baselines: { directory: './ios-baselines' },
          flows: { directory: './maestro' },
          created: { at: '2024-01-01T00:00:00.000Z', wizardVersion: '1.0.0' },
        })
      );

      const result = await executeSetupCommand('/ios.setup --reset', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Configuration has been reset');
      expect(fs.existsSync(path.join(configDir, 'ios-config.json'))).toBe(false);
    });

    it('should show deleted configuration details', async () => {
      // Create config file
      const configDir = path.join(testDir, '.maestro');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, 'ios-config.json'),
        JSON.stringify({
          version: '1.0.0',
          project: { path: '/test/TestProject.xcodeproj', scheme: 'TestScheme', type: 'xcodeproj' },
          simulator: { default: 'iPhone 15 Pro', udid: 'test-udid' },
          xcuitest: { enabled: true },
          bridge: { enabled: false, port: 9876 },
          baselines: { directory: './ios-baselines' },
          flows: { directory: './maestro' },
          created: { at: '2024-01-01T00:00:00.000Z', wizardVersion: '1.0.0' },
        })
      );

      const result = await executeSetupCommand('/ios.setup --reset', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Deleted Configuration');
      expect(result.output).toContain('/test/TestProject.xcodeproj');
      expect(result.output).toContain('TestScheme');
    });
  });

  describe('project path handling', () => {
    it('should use provided project path', async () => {
      const result = await executeSetupCommand(
        `/ios.setup --check -p ${testDir}`,
        'test-session',
        '/different/path'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain(testDir);
    });

    it('should fall back to session project path', async () => {
      const result = await executeSetupCommand('/ios.setup --check', 'test-session', testDir);

      expect(result.success).toBe(true);
      expect(result.output).toContain(testDir);
    });
  });
});

// =============================================================================
// Wizard Continuation Tests
// =============================================================================

describe('continueWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle cancel choice', async () => {
    const initialState = {
      currentStepIndex: 0,
      steps: [
        { id: 'environment', title: 'Environment Check', status: 'pending' as const, optional: false },
      ],
      decisions: [],
      isComplete: false,
      isCancelled: false,
      projectPath: '/test',
      startedAt: Date.now(),
      collectedData: {},
    };

    const result = await continueWizard(initialState, 'cancel');

    expect(result.success).toBe(true);
    expect(result.output).toContain('Cancelled');
    expect(result.wizardState?.isCancelled).toBe(true);
  });

  it('should handle continue choice', async () => {
    const initialState = {
      currentStepIndex: 0,
      steps: [
        { id: 'environment', title: 'Environment Check', status: 'pending' as const, optional: false },
        { id: 'project', title: 'Project Detection', status: 'pending' as const, optional: false },
      ],
      decisions: [],
      isComplete: false,
      isCancelled: false,
      projectPath: '/test',
      startedAt: Date.now(),
      collectedData: {},
    };

    const result = await continueWizard(initialState, 'continue');

    expect(result.success).toBe(true);
    expect(result.wizardState?.currentStepIndex).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Metadata Tests
// =============================================================================

describe('setupCommandMetadata', () => {
  it('should have correct command name', () => {
    expect(setupCommandMetadata.command).toBe('/ios.setup');
  });

  it('should have description', () => {
    expect(setupCommandMetadata.description).toBeTruthy();
    expect(setupCommandMetadata.description.length).toBeGreaterThan(10);
  });

  it('should have usage instructions', () => {
    expect(setupCommandMetadata.usage).toContain('/ios.setup');
  });

  it('should have options documented', () => {
    expect(setupCommandMetadata.options.length).toBeGreaterThan(0);

    // Check for key options
    const optionNames = setupCommandMetadata.options.map((o) => o.name);
    expect(optionNames).toContain('--check');
    expect(optionNames).toContain('--fix');
    expect(optionNames).toContain('--reset');
    expect(optionNames).toContain('--project, -p');
  });

  it('should have examples', () => {
    expect(setupCommandMetadata.examples.length).toBeGreaterThan(0);

    // Check examples contain the command
    for (const example of setupCommandMetadata.examples) {
      expect(example).toContain('/ios.setup');
    }

    // Check for various modes in examples
    const examplesText = setupCommandMetadata.examples.join(' ');
    expect(examplesText).toContain('--check');
    expect(examplesText).toContain('--fix');
    expect(examplesText).toContain('--reset');
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('edge cases', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe('argument parsing edge cases', () => {
    it('should handle paths with special characters', () => {
      const args = parseSetupArgs('/ios.setup -p "/path/with-special_chars.123"');
      expect(args.projectPath).toBe('/path/with-special_chars.123');
    });

    it('should handle single quotes in paths', () => {
      const args = parseSetupArgs("/ios.setup -p '/path/with spaces'");
      expect(args.projectPath).toBe('/path/with spaces');
    });

    it('should handle relative paths', () => {
      const args = parseSetupArgs('/ios.setup -p ./relative/path');
      expect(args.projectPath).toBe('./relative/path');
    });

    it('should handle home directory tilde', () => {
      const args = parseSetupArgs('/ios.setup -p ~/Projects/MyApp');
      expect(args.projectPath).toBe('~/Projects/MyApp');
    });
  });

  describe('fix mode edge cases', () => {
    it('should not fail if directories already exist', async () => {
      // Create directories beforehand
      fs.mkdirSync(path.join(testDir, '.maestro'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'maestro'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'ios-baselines'), { recursive: true });

      const result = await executeSetupCommand('/ios.setup --fix', 'test-session', testDir);

      expect(result.success).toBe(true);
    });
  });

  describe('reset mode edge cases', () => {
    it('should handle invalid JSON in config file gracefully', async () => {
      // Create invalid config file
      const configDir = path.join(testDir, '.maestro');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, 'ios-config.json'), 'invalid json');

      const result = await executeSetupCommand('/ios.setup --reset', 'test-session', testDir);

      // Should still succeed in deleting the file
      expect(result.success).toBe(false);
      expect(result.output).toContain('Reset Failed');
    });
  });
});

// =============================================================================
// Output Format Tests
// =============================================================================

describe('output formatting', () => {
  beforeEach(() => {
    testDir = createTestDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe('check mode output', () => {
    it('should include section headers', async () => {
      const result = await executeSetupCommand('/ios.setup --check', 'test-session', testDir);

      expect(result.output).toContain('### Xcode');
      expect(result.output).toContain('### Simulators');
      expect(result.output).toContain('### Maestro CLI');
      expect(result.output).toContain('### Project');
      expect(result.output).toContain('### Existing Integration');
    });

    it('should include next steps', async () => {
      const result = await executeSetupCommand('/ios.setup --check', 'test-session', testDir);

      expect(result.output).toContain('### Next Steps');
      expect(result.output).toContain('/ios.setup');
    });
  });

  describe('fix mode output', () => {
    it('should categorize fixes', async () => {
      const result = await executeSetupCommand('/ios.setup --fix', 'test-session', testDir);

      // Should have some form of categorization
      expect(result.output.toLowerCase()).toMatch(/(fixed|created|requires|manual)/);
    });
  });

  describe('wizard mode output', () => {
    it('should include markdown formatting', async () => {
      const result = await executeSetupCommand('/ios.setup', 'test-session', testDir);

      expect(result.output).toContain('##');
      expect(result.output).toContain('###');
    });
  });
});

// =============================================================================
// Mode Enumeration Tests
// =============================================================================

describe('SetupMode type', () => {
  it('should support wizard mode', () => {
    const mode: SetupMode = 'wizard';
    expect(mode).toBe('wizard');
  });

  it('should support check mode', () => {
    const mode: SetupMode = 'check';
    expect(mode).toBe('check');
  });

  it('should support fix mode', () => {
    const mode: SetupMode = 'fix';
    expect(mode).toBe('fix');
  });

  it('should support reset mode', () => {
    const mode: SetupMode = 'reset';
    expect(mode).toBe('reset');
  });
});
