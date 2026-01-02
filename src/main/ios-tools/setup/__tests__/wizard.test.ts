/**
 * Tests for iOS Setup Wizard
 *
 * These tests verify the wizard functionality:
 * - State management (creation, updates, progression)
 * - Step execution
 * - User decision processing
 * - Configuration generation and persistence
 * - Progress tracking
 * - Error recovery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Mock External Dependencies
// =============================================================================

// Use vi.hoisted to create mock functions that can be referenced in vi.mock factories
const { mockReaddir, mockReadFile, mockWriteFile, mockMkdir, mockExistsSync } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockExistsSync: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readdir: mockReaddir,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
    stat: vi.fn(),
  },
  readdir: mockReaddir,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  stat: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
  },
  existsSync: mockExistsSync,
}));

// Mock detector module
vi.mock('../detector', () => ({
  detectXcodeInstallation: vi.fn(),
  detectSimulators: vi.fn(),
  detectMaestroCli: vi.fn(),
  detectProjectType: vi.fn(),
  detectExistingIntegration: vi.fn(),
  detectEnvironment: vi.fn(),
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import mocked modules
import {
  detectEnvironment,
  detectProjectType,
  detectExistingIntegration,
  detectSimulators,
} from '../detector';

// Import the module under test
import {
  // State management
  createWizardState,
  getCurrentStep,
  getStepById,
  updateStepStatus,
  recordDecision,
  advanceStep,
  skipCurrentStep,
  cancelWizard,
  getProgress,
  // Step execution
  executeStep,
  executeEnvironmentStep,
  executeProjectStep,
  executeSimulatorStep,
  executeXCUITestStep,
  executeBridgeStep,
  executeSampleFlowStep,
  executeSummaryStep,
  // Decision processing
  processDecision,
  // Configuration
  generateConfig,
  saveConfig,
  loadConfig,
  generateSampleFlow,
  // Formatting
  formatStepOutput,
  formatProgressBar,
  // Types
  type WizardStep,
  type StepOutput,
  // Constants
  WIZARD_VERSION,
  IOS_CONFIG_FILENAME,
} from '../wizard';

// =============================================================================
// Test Helpers
// =============================================================================

// Import detector types for proper typing
import type { EnvironmentDetectionResult } from '../detector';

/**
 * Create a mock environment detection result
 */
function createMockEnvironment(overrides: Partial<EnvironmentDetectionResult> = {}): EnvironmentDetectionResult {
  return {
    ready: true,
    xcode: {
      installed: true,
      path: '/Applications/Xcode.app/Contents/Developer',
      version: '15.2',
      build: '15C500b',
      commandLineToolsInstalled: true,
      licenseAccepted: true,
      issues: [],
      recommendations: [],
    },
    simulators: {
      available: true,
      totalCount: 5,
      availableCount: 5,
      bootedCount: 1,
      iosVersions: ['17.2', '16.4'],
      bootedSimulators: [
        {
          udid: 'AAAA-BBBB-CCCC',
          name: 'iPhone 15 Pro',
          state: 'Booted' as const,
          isAvailable: true,
          runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
          iosVersion: '17.2',
          deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
        },
      ],
      recommendedSimulator: {
        udid: 'AAAA-BBBB-CCCC',
        name: 'iPhone 15 Pro',
        state: 'Booted' as const,
        isAvailable: true,
        runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
        iosVersion: '17.2',
        deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
      },
      simulators: [
        {
          udid: 'AAAA-BBBB-CCCC',
          name: 'iPhone 15 Pro',
          state: 'Booted' as const,
          isAvailable: true,
          runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
          iosVersion: '17.2',
          deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
        },
        {
          udid: 'DDDD-EEEE-FFFF',
          name: 'iPhone 14',
          state: 'Shutdown' as const,
          isAvailable: true,
          runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
          iosVersion: '17.2',
          deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-14',
        },
      ],
      issues: [],
      recommendations: [],
    },
    maestroCli: {
      installed: true,
      path: '/opt/homebrew/bin/maestro',
      version: '1.36.0',
      isWorking: true,
      issues: [],
      recommendations: [],
    },
    allIssues: [],
    allRecommendations: [],
    ...overrides,
  };
}

// Import project type result for proper typing
import type { ProjectTypeResult } from '../detector';

/**
 * Create a mock project detection result
 */
function createMockProject(overrides: Partial<ProjectTypeResult> = {}): ProjectTypeResult {
  return {
    type: 'xcworkspace' as const,
    found: true,
    projectPath: '/path/to/MyApp.xcworkspace',
    projectName: 'MyApp',
    bundleId: 'com.example.myapp',
    schemes: [
      { name: 'MyApp', isTest: false, isUITest: false },
      { name: 'MyAppTests', isTest: true, isUITest: false },
      { name: 'MyAppUITests', isTest: true, isUITest: true },
    ],
    targets: ['MyApp', 'MyAppTests', 'MyAppUITests'],
    hasUITestTarget: true,
    uiTestTargetName: 'MyAppUITests',
    minimumDeploymentTarget: '15.0',
    issues: [],
    recommendations: [],
    ...overrides,
  };
}

// =============================================================================
// Tests: State Management
// =============================================================================

describe('Wizard State Management', () => {
  describe('createWizardState', () => {
    it('should create initial state with all steps pending', () => {
      const state = createWizardState('/path/to/project');

      expect(state.currentStepIndex).toBe(0);
      expect(state.steps.length).toBe(7);
      expect(state.steps.every((s) => s.status === 'pending')).toBe(true);
      expect(state.isComplete).toBe(false);
      expect(state.isCancelled).toBe(false);
      expect(state.projectPath).toBe('/path/to/project');
      expect(state.startedAt).toBeGreaterThan(0);
      expect(state.decisions).toHaveLength(0);
    });

    it('should include correct step IDs in order', () => {
      const state = createWizardState('/path/to/project');
      const stepIds = state.steps.map((s) => s.id);

      expect(stepIds).toEqual([
        'environment',
        'project',
        'simulator',
        'xcuitest',
        'bridge',
        'sample-flow',
        'summary',
      ]);
    });

    it('should mark optional steps correctly', () => {
      const state = createWizardState('/path/to/project');

      const optionalSteps = state.steps.filter((s) => s.optional);
      const requiredSteps = state.steps.filter((s) => !s.optional);

      expect(optionalSteps.map((s) => s.id)).toContain('xcuitest');
      expect(optionalSteps.map((s) => s.id)).toContain('bridge');
      expect(optionalSteps.map((s) => s.id)).toContain('sample-flow');
      expect(requiredSteps.map((s) => s.id)).toContain('environment');
      expect(requiredSteps.map((s) => s.id)).toContain('project');
    });
  });

  describe('getCurrentStep', () => {
    it('should return the current step', () => {
      const state = createWizardState('/path/to/project');
      const current = getCurrentStep(state);

      expect(current?.id).toBe('environment');
    });

    it('should return correct step after advancement', () => {
      let state = createWizardState('/path/to/project');
      state = advanceStep(state);
      const current = getCurrentStep(state);

      expect(current?.id).toBe('project');
    });
  });

  describe('getStepById', () => {
    it('should return step by ID', () => {
      const state = createWizardState('/path/to/project');
      const step = getStepById(state, 'simulator');

      expect(step?.id).toBe('simulator');
      expect(step?.title).toBe('Simulator Selection');
    });

    it('should return undefined for invalid ID', () => {
      const state = createWizardState('/path/to/project');
      const step = getStepById(state, 'invalid' as any);

      expect(step).toBeUndefined();
    });
  });

  describe('updateStepStatus', () => {
    it('should update step status', () => {
      let state = createWizardState('/path/to/project');
      state = updateStepStatus(state, 'environment', 'completed');

      const step = getStepById(state, 'environment');
      expect(step?.status).toBe('completed');
    });

    it('should store result data', () => {
      let state = createWizardState('/path/to/project');
      const result = { someData: 'value' };
      state = updateStepStatus(state, 'environment', 'completed', result);

      const step = getStepById(state, 'environment');
      expect(step?.result).toEqual(result);
    });

    it('should store error message on failure', () => {
      let state = createWizardState('/path/to/project');
      state = updateStepStatus(state, 'environment', 'failed', undefined, 'Something went wrong');

      const step = getStepById(state, 'environment');
      expect(step?.status).toBe('failed');
      expect(step?.error).toBe('Something went wrong');
    });
  });

  describe('recordDecision', () => {
    it('should record user decisions', () => {
      let state = createWizardState('/path/to/project');
      state = recordDecision(state, 'environment', 'continue');
      state = recordDecision(state, 'simulator', 'sim-0', { udid: 'AAAA' });

      expect(state.decisions).toHaveLength(2);
      expect(state.decisions[0]).toEqual({
        stepId: 'environment',
        choice: 'continue',
        data: undefined,
      });
      expect(state.decisions[1]).toEqual({
        stepId: 'simulator',
        choice: 'sim-0',
        data: { udid: 'AAAA' },
      });
    });
  });

  describe('advanceStep', () => {
    it('should advance to next step', () => {
      let state = createWizardState('/path/to/project');
      expect(state.currentStepIndex).toBe(0);

      state = advanceStep(state);
      expect(state.currentStepIndex).toBe(1);
      expect(getCurrentStep(state)?.id).toBe('project');
    });

    it('should mark wizard complete when advancing past last step', () => {
      let state = createWizardState('/path/to/project');

      // Advance through all steps
      for (let i = 0; i < 7; i++) {
        state = advanceStep(state);
      }

      expect(state.isComplete).toBe(true);
      expect(state.completedAt).toBeGreaterThan(0);
    });
  });

  describe('skipCurrentStep', () => {
    it('should skip optional step', () => {
      let state = createWizardState('/path/to/project');
      state.currentStepIndex = 3; // xcuitest (optional)

      state = skipCurrentStep(state);

      const step = getStepById(state, 'xcuitest');
      expect(step?.status).toBe('skipped');
      expect(state.currentStepIndex).toBe(4);
    });

    it('should not skip required step', () => {
      let state = createWizardState('/path/to/project');
      state.currentStepIndex = 0; // environment (required)

      state = skipCurrentStep(state);

      const step = getStepById(state, 'environment');
      expect(step?.status).toBe('pending');
      expect(state.currentStepIndex).toBe(0);
    });
  });

  describe('cancelWizard', () => {
    it('should mark wizard as cancelled', () => {
      let state = createWizardState('/path/to/project');
      state = cancelWizard(state);

      expect(state.isCancelled).toBe(true);
      expect(state.completedAt).toBeGreaterThan(0);
    });
  });

  describe('getProgress', () => {
    it('should calculate correct progress', () => {
      let state = createWizardState('/path/to/project');
      let progress = getProgress(state);

      expect(progress.current).toBe(1);
      expect(progress.total).toBe(7);
      expect(progress.percentage).toBe(0);
      expect(progress.completedSteps).toBe(0);
      expect(progress.remainingSteps).toBe(7);

      // Complete some steps
      state = updateStepStatus(state, 'environment', 'completed');
      state = updateStepStatus(state, 'project', 'completed');
      state = updateStepStatus(state, 'xcuitest', 'skipped');

      progress = getProgress(state);
      expect(progress.completedSteps).toBe(3);
      expect(progress.percentage).toBe(43); // 3/7 = 0.428...
    });
  });
});

// =============================================================================
// Tests: Step Execution
// =============================================================================

describe('Step Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeEnvironmentStep', () => {
    it('should return success output when environment is ready', async () => {
      vi.mocked(detectEnvironment).mockResolvedValue({
        success: true,
        data: createMockEnvironment(),
      });

      const state = createWizardState('/path/to/project');
      const result = await executeEnvironmentStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.icon).toBe('✅');
      expect(result.data?.message).toContain('Ready');
      expect(result.data?.actions?.some((a) => a.key === 'continue')).toBe(true);
    });

    it('should include issues when environment is not ready', async () => {
      const mockEnv = createMockEnvironment();
      mockEnv.ready = false;
      mockEnv.xcode = {
        installed: false,
        commandLineToolsInstalled: false,
        licenseAccepted: false,
        issues: ['Xcode is not installed'],
        recommendations: ['Install Xcode from the App Store'],
      };
      vi.mocked(detectEnvironment).mockResolvedValue({
        success: true,
        data: mockEnv,
      });

      const state = createWizardState('/path/to/project');
      const result = await executeEnvironmentStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.icon).toBe('⚠️');
      expect(result.data?.issues).toBeDefined();
      expect(result.data?.recommendations).toBeDefined();
    });

    it('should handle detection failure', async () => {
      vi.mocked(detectEnvironment).mockResolvedValue({
        success: false,
        error: 'Detection failed',
      });

      const state = createWizardState('/path/to/project');
      const result = await executeEnvironmentStep(state);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to detect environment');
    });
  });

  describe('executeProjectStep', () => {
    it('should return success output when project is found', async () => {
      vi.mocked(detectProjectType).mockResolvedValue({
        success: true,
        data: createMockProject(),
      });

      vi.mocked(detectExistingIntegration).mockResolvedValue({
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
      });

      const state = createWizardState('/path/to/project');
      const result = await executeProjectStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.icon).toBe('📁');
      expect(result.data?.details.some((d) => d.includes('MyApp.xcworkspace'))).toBe(true);
      expect(result.data?.actions?.some((a) => a.key === 'confirm')).toBe(true);
    });

    it('should fail when no project path is set', async () => {
      const state = createWizardState('/path/to/project');
      state.projectPath = undefined;

      const result = await executeProjectStep(state);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No project path');
    });
  });

  describe('executeSimulatorStep', () => {
    it('should list available simulators', async () => {
      vi.mocked(detectSimulators).mockResolvedValue({
        success: true,
        data: {
          available: true,
          totalCount: 2,
          availableCount: 2,
          bootedCount: 1,
          iosVersions: ['17.2'],
          bootedSimulators: [],
          recommendedSimulator: {
            udid: 'AAAA-BBBB-CCCC',
            name: 'iPhone 15 Pro',
            state: 'Booted',
            isAvailable: true,
            runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
            iosVersion: '17.2',
            deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
          },
          simulators: [
            {
              udid: 'AAAA-BBBB-CCCC',
              name: 'iPhone 15 Pro',
              state: 'Booted',
              isAvailable: true,
              runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
              iosVersion: '17.2',
              deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
            },
          ],
          issues: [],
          recommendations: [],
        },
      });

      const state = createWizardState('/path/to/project');
      const result = await executeSimulatorStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.icon).toBe('📱');
      expect(result.data?.actions?.some((a) => a.key === 'sim-0')).toBe(true);
    });
  });

  describe('executeXCUITestStep', () => {
    it('should show existing target when available', async () => {
      const state = createWizardState('/path/to/project');
      state.collectedData.project = createMockProject();

      const result = await executeXCUITestStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.icon).toBe('🧪');
      expect(result.data?.details.some((d) => d.includes('XCUITest target found'))).toBe(true);
      expect(result.data?.actions?.some((a) => a.key === 'enable')).toBe(true);
    });

    it('should offer to create target when not available', async () => {
      const state = createWizardState('/path/to/project');
      const project = createMockProject();
      project.hasUITestTarget = false;
      project.uiTestTargetName = undefined;
      state.collectedData.project = project;

      const result = await executeXCUITestStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.details.some((d) => d.includes('No XCUITest target found'))).toBe(true);
      expect(result.data?.actions?.some((a) => a.key === 'create')).toBe(true);
    });
  });

  describe('executeBridgeStep', () => {
    it('should show existing integration when available', async () => {
      const state = createWizardState('/path/to/project');
      state.collectedData.existingIntegration = {
        hasIntegration: true,
        hasMaestroConfig: true,
        hasIosConfig: true,
        hasFlowsDirectory: false,
        flowFileCount: 0,
        hasBaselinesDirectory: false,
        baselineFileCount: 0,
        hasBridgeIntegration: true,
      };

      const result = await executeBridgeStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.icon).toBe('🔌');
      expect(result.data?.details.some((d) => d.includes('already integrated'))).toBe(true);
      expect(result.data?.actions?.some((a) => a.key === 'keep')).toBe(true);
    });

    it('should offer to add integration when not available', async () => {
      const state = createWizardState('/path/to/project');
      state.collectedData.existingIntegration = {
        hasIntegration: false,
        hasMaestroConfig: false,
        hasIosConfig: false,
        hasFlowsDirectory: false,
        flowFileCount: 0,
        hasBaselinesDirectory: false,
        baselineFileCount: 0,
        hasBridgeIntegration: false,
      };

      const result = await executeBridgeStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.actions?.some((a) => a.key === 'add')).toBe(true);
    });
  });

  describe('executeSampleFlowStep', () => {
    it('should show existing flows when available', async () => {
      const state = createWizardState('/path/to/project');
      state.collectedData.existingIntegration = {
        hasIntegration: true,
        hasMaestroConfig: false,
        hasIosConfig: false,
        hasFlowsDirectory: true,
        flowsDirectoryPath: '/path/to/maestro',
        flowFileCount: 3,
        hasBaselinesDirectory: false,
        baselineFileCount: 0,
        hasBridgeIntegration: false,
      };

      const result = await executeSampleFlowStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.icon).toBe('📝');
      expect(result.data?.details.some((d) => d.includes('3 existing flow(s)'))).toBe(true);
      expect(result.data?.actions?.some((a) => a.key === 'keep')).toBe(true);
    });

    it('should offer to generate sample flow when none exist', async () => {
      const state = createWizardState('/path/to/project');
      state.collectedData.project = createMockProject();

      const result = await executeSampleFlowStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.actions?.some((a) => a.key === 'generate')).toBe(true);
    });
  });

  describe('executeSummaryStep', () => {
    it('should show summary of collected data', async () => {
      const state = createWizardState('/path/to/project');
      state.collectedData.project = createMockProject();
      state.collectedData.selectedSimulator = {
        udid: 'AAAA-BBBB-CCCC',
        name: 'iPhone 15 Pro',
        state: 'Booted',
        isAvailable: true,
        runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
        iosVersion: '17.2',
        deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
      };
      state.collectedData.xcuitest = {
        enabled: true,
        targetName: 'MyAppUITests',
      };

      const result = await executeSummaryStep(state);

      expect(result.success).toBe(true);
      expect(result.data?.icon).toBe('🎉');
      expect(result.data?.message).toContain('Ready');
      expect(result.data?.details.some((d) => d.includes('MyApp'))).toBe(true);
      expect(result.data?.details.some((d) => d.includes('iPhone 15 Pro'))).toBe(true);
    });
  });

  describe('executeStep', () => {
    it('should dispatch to correct step handler', async () => {
      vi.mocked(detectEnvironment).mockResolvedValue({
        success: true,
        data: createMockEnvironment(),
      });

      const state = createWizardState('/path/to/project');
      const result = await executeStep(state, 'environment');

      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('Environment');
    });

    it('should return error for unknown step', async () => {
      const state = createWizardState('/path/to/project');
      const result = await executeStep(state, 'unknown' as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown step');
    });
  });
});

// =============================================================================
// Tests: Decision Processing
// =============================================================================

describe('Decision Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processDecision', () => {
    it('should cancel wizard on cancel choice', () => {
      const state = createWizardState('/path/to/project');
      const result = processDecision(state, 'environment', 'cancel');

      expect(result.isCancelled).toBe(true);
    });

    it('should advance step on continue choice', () => {
      const state = createWizardState('/path/to/project');
      const result = processDecision(state, 'environment', 'continue');

      expect(getStepById(result, 'environment')?.status).toBe('completed');
      expect(result.currentStepIndex).toBe(1);
    });

    it('should select simulator on sim-N choice', () => {
      const state = createWizardState('/path/to/project');
      state.collectedData.environment = createMockEnvironment();

      const result = processDecision(state, 'simulator', 'sim-0');

      expect(result.collectedData.selectedSimulator).toBeDefined();
      expect(result.collectedData.selectedSimulator?.name).toBe('iPhone 15 Pro');
      expect(getStepById(result, 'simulator')?.status).toBe('completed');
    });

    it('should skip optional step on skip choice', () => {
      let state = createWizardState('/path/to/project');
      state = { ...state, currentStepIndex: 3 }; // xcuitest

      const result = processDecision(state, 'xcuitest', 'skip');

      expect(result.collectedData.xcuitest?.enabled).toBe(false);
      expect(getStepById(result, 'xcuitest')?.status).toBe('skipped');
    });

    it('should enable XCUITest on enable choice', () => {
      let state = createWizardState('/path/to/project');
      state.collectedData.project = createMockProject();

      const result = processDecision(state, 'xcuitest', 'enable');

      expect(result.collectedData.xcuitest?.enabled).toBe(true);
      expect(result.collectedData.xcuitest?.targetName).toBe('MyAppUITests');
    });

    it('should enable bridge on add choice', () => {
      const state = createWizardState('/path/to/project');
      const result = processDecision(state, 'bridge', 'add');

      expect(result.collectedData.bridge?.enabled).toBe(true);
      expect(result.collectedData.bridge?.port).toBe(9876);
    });
  });
});

// =============================================================================
// Tests: Configuration Management
// =============================================================================

describe('Configuration Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateConfig', () => {
    it('should generate valid configuration from wizard state', () => {
      const state = createWizardState('/path/to/project');
      state.collectedData.project = createMockProject();
      state.collectedData.selectedSimulator = {
        udid: 'AAAA-BBBB-CCCC',
        name: 'iPhone 15 Pro',
        state: 'Booted',
        isAvailable: true,
        runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
        iosVersion: '17.2',
        deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
      };
      state.collectedData.xcuitest = { enabled: true, targetName: 'MyAppUITests' };
      state.collectedData.bridge = { enabled: true, port: 9876 };

      const config = generateConfig(state);

      expect(config.version).toBe(WIZARD_VERSION);
      expect(config.project.path).toBe('/path/to/MyApp.xcworkspace');
      expect(config.project.scheme).toBe('MyApp');
      expect(config.project.bundleId).toBe('com.example.myapp');
      expect(config.simulator.default).toBe('iPhone 15 Pro');
      expect(config.simulator.udid).toBe('AAAA-BBBB-CCCC');
      expect(config.xcuitest.enabled).toBe(true);
      expect(config.xcuitest.targetName).toBe('MyAppUITests');
      expect(config.bridge.enabled).toBe(true);
      expect(config.bridge.port).toBe(9876);
      expect(config.created.wizardVersion).toBe(WIZARD_VERSION);
    });

    it('should use defaults when data is missing', () => {
      const state = createWizardState('/path/to/project');

      const config = generateConfig(state);

      expect(config.simulator.default).toBe('iPhone 15 Pro');
      expect(config.xcuitest.enabled).toBe(false);
      expect(config.bridge.enabled).toBe(false);
      expect(config.bridge.port).toBe(9876);
    });
  });

  describe('saveConfig', () => {
    it('should save configuration to disk', async () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const config = generateConfig(createWizardState('/path/to/project'));
      const result = await saveConfig('/path/to/project', config);

      expect(result.success).toBe(true);
      expect(result.data).toContain(IOS_CONFIG_FILENAME);
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should handle write errors', async () => {
      mockExistsSync.mockReturnValue(true);
      mockWriteFile.mockRejectedValue(new Error('Permission denied'));

      const config = generateConfig(createWizardState('/path/to/project'));
      const result = await saveConfig('/path/to/project', config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save');
    });
  });

  describe('loadConfig', () => {
    it('should load existing configuration', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          version: '1.0.0',
          project: { path: '/path', scheme: 'MyApp' },
          simulator: { default: 'iPhone 15 Pro', udid: 'AAAA' },
          xcuitest: { enabled: true },
          bridge: { enabled: false, port: 9876 },
          baselines: { directory: './ios-baselines' },
          flows: { directory: './maestro' },
          created: { at: '2024-01-01T00:00:00Z', wizardVersion: '1.0.0' },
        })
      );

      const result = await loadConfig('/path/to/project');

      expect(result.success).toBe(true);
      expect(result.data?.project.scheme).toBe('MyApp');
    });

    it('should handle missing file', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await loadConfig('/path/to/project');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle invalid JSON', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('not valid json');

      const result = await loadConfig('/path/to/project');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load');
    });
  });
});

// =============================================================================
// Tests: Sample Flow Generation
// =============================================================================

describe('Sample Flow Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSampleFlow', () => {
    it('should generate sample flow file', async () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await generateSampleFlow('/path/to/project', 'com.example.app');

      expect(result.success).toBe(true);
      expect(result.data).toContain('sample_flow.yaml');
      expect(mockWriteFile).toHaveBeenCalled();

      // Verify content includes bundle ID
      const writeCall = mockWriteFile.mock.calls[0];
      expect(writeCall[1]).toContain('appId: com.example.app');
    });

    it('should handle write errors', async () => {
      mockExistsSync.mockReturnValue(true);
      mockWriteFile.mockRejectedValue(new Error('Disk full'));

      const result = await generateSampleFlow('/path/to/project');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to generate');
    });
  });
});

// =============================================================================
// Tests: Output Formatting
// =============================================================================

describe('Output Formatting', () => {
  describe('formatStepOutput', () => {
    it('should format step output with all sections', () => {
      const step: WizardStep = {
        id: 'environment',
        title: 'Environment Check',
        description: 'Checking iOS development environment',
        optional: false,
        status: 'in_progress',
      };

      const output: StepOutput = {
        icon: '✅',
        message: 'Environment Ready',
        details: ['✅ Xcode installed', '✅ Simulators available'],
        actions: [
          { key: 'continue', label: 'Continue', recommended: true },
          { key: 'cancel', label: 'Cancel' },
        ],
        issues: ['Minor issue found'],
        recommendations: ['Consider updating Xcode'],
      };

      const formatted = formatStepOutput(step, output);

      expect(formatted).toContain('✅ Environment Ready');
      expect(formatted).toContain('Xcode installed');
      expect(formatted).toContain('Minor issue found');
      expect(formatted).toContain('Consider updating Xcode');
      expect(formatted).toContain('[continue]');
    });
  });

  describe('formatProgressBar', () => {
    it('should format progress bar correctly', () => {
      let state = createWizardState('/path/to/project');

      // No progress
      let bar = formatProgressBar(state);
      expect(bar).toContain('0%');
      expect(bar).toContain('Step 1/7');

      // Some progress
      state = updateStepStatus(state, 'environment', 'completed');
      state = updateStepStatus(state, 'project', 'completed');
      state = updateStepStatus(state, 'simulator', 'skipped');
      state.currentStepIndex = 3;

      bar = formatProgressBar(state);
      expect(bar).toContain('43%');
      expect(bar).toContain('Step 4/7');
    });
  });
});

// =============================================================================
// Tests: Error Recovery
// =============================================================================

describe('Error Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow retry after step failure', async () => {
    let state = createWizardState('/path/to/project');

    // First attempt fails
    vi.mocked(detectEnvironment).mockResolvedValueOnce({
      success: false,
      error: 'Network error',
    });

    let result = await executeEnvironmentStep(state);
    expect(result.success).toBe(false);

    // Update state to reflect failure
    state = updateStepStatus(state, 'environment', 'failed', undefined, 'Network error');
    expect(getStepById(state, 'environment')?.status).toBe('failed');

    // Second attempt succeeds
    vi.mocked(detectEnvironment).mockResolvedValueOnce({
      success: true,
      data: createMockEnvironment(),
    });

    // Reset status and retry
    state = updateStepStatus(state, 'environment', 'pending');
    result = await executeEnvironmentStep(state);

    expect(result.success).toBe(true);
  });

  it('should preserve collected data across retries', async () => {
    let state = createWizardState('/path/to/project');

    // Successfully complete environment step
    vi.mocked(detectEnvironment).mockResolvedValue({
      success: true,
      data: createMockEnvironment(),
    });

    await executeEnvironmentStep(state);
    state = processDecision(state, 'environment', 'continue');

    // Project step fails
    vi.mocked(detectProjectType).mockResolvedValueOnce({
      success: false,
      error: 'Parse error',
    });

    // Environment data should still be present
    expect(state.collectedData.environment).toBeDefined();
    expect(state.collectedData.environment?.ready).toBe(true);
  });
});
