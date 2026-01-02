/**
 * iOS Tools - Setup Wizard
 *
 * Interactive setup wizard for iOS development environment.
 * Guides users through:
 * - Environment check (Xcode, simulators, Maestro CLI)
 * - Project detection
 * - Simulator selection
 * - XCUITest setup (optional)
 * - MaestroBridge integration (optional)
 * - Sample flow generation
 * - Configuration saving
 *
 * Used by the /ios.setup command.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { IOSResult, Simulator } from '../types';
import {
  detectSimulators,
  detectProjectType,
  detectExistingIntegration,
  detectEnvironment,
} from './detector';
import type {
  EnvironmentDetectionResult,
  ProjectTypeResult,
  ExistingIntegrationResult,
  ProjectScheme,
} from './detector';
import { logger } from '../../utils/logger';

const LOG_CONTEXT = '[iOS-Setup-Wizard]';

// =============================================================================
// Types
// =============================================================================

/**
 * Wizard step identifiers
 */
export type WizardStepId =
  | 'environment'
  | 'project'
  | 'simulator'
  | 'xcuitest'
  | 'bridge'
  | 'sample-flow'
  | 'summary';

/**
 * Step status in the wizard flow
 */
export type WizardStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

/**
 * Individual wizard step definition
 */
export interface WizardStep {
  /** Step identifier */
  id: WizardStepId;
  /** Human-readable title */
  title: string;
  /** Short description */
  description: string;
  /** Whether this step is optional */
  optional: boolean;
  /** Step status */
  status: WizardStepStatus;
  /** Error message if step failed */
  error?: string;
  /** Result data from the step */
  result?: unknown;
}

/**
 * User decision for a wizard step
 */
export interface WizardDecision {
  /** Step the decision is for */
  stepId: WizardStepId;
  /** User's choice */
  choice: string;
  /** Additional input data */
  data?: Record<string, unknown>;
}

/**
 * Complete wizard state
 */
export interface WizardState {
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** All wizard steps */
  steps: WizardStep[];
  /** User decisions made during the wizard */
  decisions: WizardDecision[];
  /** Whether the wizard is complete */
  isComplete: boolean;
  /** Whether the wizard was cancelled */
  isCancelled: boolean;
  /** Project path being set up */
  projectPath?: string;
  /** Timestamp when wizard started */
  startedAt: number;
  /** Timestamp when wizard completed */
  completedAt?: number;
  /** Collected data from all steps */
  collectedData: WizardCollectedData;
}

/**
 * Data collected throughout the wizard
 */
export interface WizardCollectedData {
  /** Environment detection result */
  environment?: EnvironmentDetectionResult;
  /** Project detection result */
  project?: ProjectTypeResult;
  /** Existing integration detection */
  existingIntegration?: ExistingIntegrationResult;
  /** Selected simulator */
  selectedSimulator?: Simulator;
  /** Selected scheme */
  selectedScheme?: ProjectScheme;
  /** XCUITest configuration */
  xcuitest?: {
    enabled: boolean;
    targetName?: string;
    createNew?: boolean;
  };
  /** MaestroBridge configuration */
  bridge?: {
    enabled: boolean;
    port?: number;
  };
  /** Generated configuration */
  config?: IOSProjectConfig;
}

/**
 * iOS project configuration (saved to .maestro/ios-config.json)
 */
export interface IOSProjectConfig {
  /** Configuration version */
  version: string;
  /** Project settings */
  project: {
    /** Path to .xcworkspace or .xcodeproj */
    path: string;
    /** Selected scheme */
    scheme: string;
    /** Bundle identifier */
    bundleId?: string;
    /** Project type */
    type: 'xcworkspace' | 'xcodeproj' | 'swift-package';
  };
  /** Simulator settings */
  simulator: {
    /** Default simulator name */
    default: string;
    /** Simulator UDID */
    udid: string;
  };
  /** XCUITest settings */
  xcuitest: {
    /** Whether XCUITest is enabled */
    enabled: boolean;
    /** UI test target name */
    targetName?: string;
  };
  /** MaestroBridge settings */
  bridge: {
    /** Whether bridge is enabled */
    enabled: boolean;
    /** Bridge port */
    port: number;
  };
  /** Baselines directory */
  baselines: {
    /** Directory path */
    directory: string;
  };
  /** Maestro flows directory */
  flows: {
    /** Directory path */
    directory: string;
  };
  /** Creation metadata */
  created: {
    /** ISO timestamp */
    at: string;
    /** Wizard version */
    wizardVersion: string;
  };
}

/**
 * Progress callback for wizard operations
 */
export type WizardProgressCallback = (step: WizardStep, message: string) => void;

/**
 * Step output formatting
 */
export interface StepOutput {
  /** Status icon (emoji) */
  icon: string;
  /** Main message */
  message: string;
  /** Detailed lines */
  details: string[];
  /** Available actions/choices */
  actions?: {
    key: string;
    label: string;
    description?: string;
    recommended?: boolean;
  }[];
  /** Issues found */
  issues?: string[];
  /** Recommendations */
  recommendations?: string[];
}

/**
 * Wizard options for initialization
 */
export interface WizardOptions {
  /** Project path to set up */
  projectPath: string;
  /** Progress callback */
  onProgress?: WizardProgressCallback;
  /** Whether to run in check-only mode (no modifications) */
  checkOnly?: boolean;
  /** Whether to attempt auto-fix of issues */
  autoFix?: boolean;
  /** Skip optional steps */
  skipOptional?: boolean;
}

/**
 * Result of running the complete wizard
 */
export interface WizardResult {
  /** Whether the wizard completed successfully */
  success: boolean;
  /** Final wizard state */
  state: WizardState;
  /** Generated configuration (if wizard completed) */
  config?: IOSProjectConfig;
  /** Path to saved config file */
  configPath?: string;
  /** Summary message */
  summary: string;
  /** Error message if wizard failed */
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Current wizard version */
export const WIZARD_VERSION = '1.0.0';

/** Default iOS config filename */
export const IOS_CONFIG_FILENAME = 'ios-config.json';

/** Default config directory */
export const CONFIG_DIRECTORY = '.maestro';

/** Default flows directory */
export const DEFAULT_FLOWS_DIRECTORY = 'maestro';

/** Default baselines directory */
export const DEFAULT_BASELINES_DIRECTORY = 'ios-baselines';

/** Default MaestroBridge port */
export const DEFAULT_BRIDGE_PORT = 9876;

/** Step definitions */
const STEP_DEFINITIONS: Omit<WizardStep, 'status' | 'result' | 'error'>[] = [
  {
    id: 'environment',
    title: 'Environment Check',
    description: 'Checking iOS development environment',
    optional: false,
  },
  {
    id: 'project',
    title: 'Project Detection',
    description: 'Analyzing project structure',
    optional: false,
  },
  {
    id: 'simulator',
    title: 'Simulator Selection',
    description: 'Selecting default simulator for testing',
    optional: false,
  },
  {
    id: 'xcuitest',
    title: 'XCUITest Setup',
    description: 'Configure XCUITest for UI inspection',
    optional: true,
  },
  {
    id: 'bridge',
    title: 'MaestroBridge Integration',
    description: 'Optional debug-time introspection',
    optional: true,
  },
  {
    id: 'sample-flow',
    title: 'Sample Flow Generation',
    description: 'Creating sample Maestro flow',
    optional: true,
  },
  {
    id: 'summary',
    title: 'Summary',
    description: 'Configuration complete',
    optional: false,
  },
];

// =============================================================================
// Wizard State Management
// =============================================================================

/**
 * Create initial wizard state
 */
export function createWizardState(projectPath: string): WizardState {
  return {
    currentStepIndex: 0,
    steps: STEP_DEFINITIONS.map((def) => ({
      ...def,
      status: 'pending',
    })),
    decisions: [],
    isComplete: false,
    isCancelled: false,
    projectPath,
    startedAt: Date.now(),
    collectedData: {},
  };
}

/**
 * Get the current step
 */
export function getCurrentStep(state: WizardState): WizardStep | undefined {
  return state.steps[state.currentStepIndex];
}

/**
 * Get step by ID
 */
export function getStepById(state: WizardState, stepId: WizardStepId): WizardStep | undefined {
  return state.steps.find((s) => s.id === stepId);
}

/**
 * Update a step's status
 */
export function updateStepStatus(
  state: WizardState,
  stepId: WizardStepId,
  status: WizardStepStatus,
  result?: unknown,
  error?: string
): WizardState {
  const stepIndex = state.steps.findIndex((s) => s.id === stepId);
  if (stepIndex === -1) return state;

  const updatedSteps = [...state.steps];
  updatedSteps[stepIndex] = {
    ...updatedSteps[stepIndex],
    status,
    result,
    error,
  };

  return {
    ...state,
    steps: updatedSteps,
  };
}

/**
 * Record a user decision
 */
export function recordDecision(
  state: WizardState,
  stepId: WizardStepId,
  choice: string,
  data?: Record<string, unknown>
): WizardState {
  return {
    ...state,
    decisions: [
      ...state.decisions,
      { stepId, choice, data },
    ],
  };
}

/**
 * Advance to the next step
 */
export function advanceStep(state: WizardState): WizardState {
  const nextIndex = state.currentStepIndex + 1;
  const isComplete = nextIndex >= state.steps.length;

  return {
    ...state,
    currentStepIndex: isComplete ? state.currentStepIndex : nextIndex,
    isComplete,
    completedAt: isComplete ? Date.now() : undefined,
  };
}

/**
 * Skip current step (for optional steps)
 */
export function skipCurrentStep(state: WizardState): WizardState {
  const currentStep = getCurrentStep(state);
  if (!currentStep || !currentStep.optional) {
    return state;
  }

  const updatedState = updateStepStatus(state, currentStep.id, 'skipped');
  return advanceStep(updatedState);
}

/**
 * Cancel the wizard
 */
export function cancelWizard(state: WizardState): WizardState {
  return {
    ...state,
    isCancelled: true,
    completedAt: Date.now(),
  };
}

/**
 * Get progress information
 */
export function getProgress(state: WizardState): {
  current: number;
  total: number;
  percentage: number;
  completedSteps: number;
  remainingSteps: number;
} {
  const total = state.steps.length;
  const current = state.currentStepIndex + 1;
  const completedSteps = state.steps.filter(
    (s) => s.status === 'completed' || s.status === 'skipped'
  ).length;

  return {
    current,
    total,
    percentage: Math.round((completedSteps / total) * 100),
    completedSteps,
    remainingSteps: total - completedSteps,
  };
}

// =============================================================================
// Step Execution
// =============================================================================

/**
 * Execute the environment check step
 */
export async function executeEnvironmentStep(
  state: WizardState,
  _onProgress?: WizardProgressCallback
): Promise<IOSResult<StepOutput>> {
  logger.info(`${LOG_CONTEXT} Executing environment check step`, LOG_CONTEXT);

  const envResult = await detectEnvironment();

  if (!envResult.success || !envResult.data) {
    return {
      success: false,
      error: 'Failed to detect environment',
      errorCode: 'COMMAND_FAILED',
    };
  }

  const env = envResult.data;
  state.collectedData.environment = env;

  // Build output
  const details: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Xcode status
  if (env.xcode.installed) {
    details.push(`✅ Xcode ${env.xcode.version || 'unknown'} installed`);
    if (env.xcode.commandLineToolsInstalled) {
      details.push('✅ Command Line Tools installed');
    }
    if (env.xcode.licenseAccepted) {
      details.push('✅ Xcode license accepted');
    }
  } else {
    details.push('❌ Xcode not installed');
    issues.push('Xcode is not installed');
    recommendations.push('Install Xcode from the App Store');
  }

  // Simulator status
  if (env.simulators.available) {
    const bootedCount = env.simulators.bootedCount;
    const availableCount = env.simulators.availableCount;
    details.push(`✅ ${availableCount} simulator(s) available`);
    if (bootedCount > 0) {
      details.push(`✅ ${bootedCount} simulator(s) booted`);
    } else {
      details.push('⚠️ No simulators currently booted');
      recommendations.push('Boot a simulator for testing');
    }
    if (env.simulators.recommendedSimulator) {
      details.push(`   Recommended: ${env.simulators.recommendedSimulator.name}`);
    }
  } else {
    details.push('❌ No simulators available');
    issues.push('No iOS simulators are available');
    recommendations.push('Install iOS simulator runtimes via Xcode');
  }

  // Maestro CLI status
  if (env.maestroCli.installed) {
    details.push(`✅ Maestro CLI ${env.maestroCli.version || 'unknown'} installed`);
    if (!env.maestroCli.isWorking) {
      details.push('⚠️ Maestro CLI not responding');
      issues.push('Maestro CLI is installed but not responding');
    }
  } else {
    details.push('⚠️ Maestro CLI not installed');
    recommendations.push('Install Maestro CLI for UI automation: curl -Ls "https://get.maestro.mobile.dev" | bash');
  }

  // Determine actions based on state
  const actions: StepOutput['actions'] = [];

  if (env.ready) {
    actions.push({
      key: 'continue',
      label: 'Continue',
      description: 'Environment is ready, proceed with setup',
      recommended: true,
    });
  } else {
    if (!env.xcode.installed) {
      actions.push({
        key: 'install-xcode',
        label: 'Open App Store',
        description: 'Download and install Xcode',
      });
    }
    if (!env.maestroCli.installed) {
      actions.push({
        key: 'install-maestro',
        label: 'Install Maestro CLI',
        description: 'Run the Maestro CLI installer',
      });
    }
    actions.push({
      key: 'continue-anyway',
      label: 'Continue Anyway',
      description: 'Proceed with partial setup',
    });
  }

  actions.push({
    key: 'cancel',
    label: 'Cancel',
    description: 'Exit setup wizard',
  });

  const output: StepOutput = {
    icon: env.ready ? '✅' : '⚠️',
    message: env.ready
      ? 'iOS Development Environment Ready'
      : 'iOS Development Environment Needs Attention',
    details,
    actions,
    issues: issues.length > 0 ? issues : undefined,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  };

  return {
    success: true,
    data: output,
  };
}

/**
 * Execute the project detection step
 */
export async function executeProjectStep(
  state: WizardState,
  _onProgress?: WizardProgressCallback
): Promise<IOSResult<StepOutput>> {
  logger.info(`${LOG_CONTEXT} Executing project detection step`, LOG_CONTEXT);

  if (!state.projectPath) {
    return {
      success: false,
      error: 'No project path specified',
      errorCode: 'COMMAND_FAILED',
    };
  }

  // Detect project type
  const projectResult = await detectProjectType(state.projectPath);

  if (!projectResult.success) {
    return {
      success: false,
      error: projectResult.error || 'Failed to detect project',
      errorCode: 'COMMAND_FAILED',
    };
  }

  const project = projectResult.data!;
  state.collectedData.project = project;

  // Detect existing integration
  const integrationResult = await detectExistingIntegration(state.projectPath);
  if (integrationResult.success && integrationResult.data) {
    state.collectedData.existingIntegration = integrationResult.data;
  }

  const details: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  const actions: StepOutput['actions'] = [];

  if (project.found) {
    details.push(`✅ Found: ${project.projectPath || 'Unknown project'}`);
    if (project.projectName) {
      details.push(`   Project: ${project.projectName}`);
    }
    if (project.bundleId) {
      details.push(`   Bundle ID: ${project.bundleId}`);
    }
    if (project.schemes.length > 0) {
      const schemeNames = project.schemes.map((s) => s.name).join(', ');
      details.push(`   Schemes: ${schemeNames}`);
    }
    if (project.hasUITestTarget) {
      details.push(`✅ XCUITest target: ${project.uiTestTargetName}`);
    } else {
      details.push('⚠️ No XCUITest target found');
      recommendations.push('Consider adding an XCUITest target for UI automation');
    }

    // Check for existing integration
    const integration = state.collectedData.existingIntegration;
    if (integration?.hasIntegration) {
      details.push('');
      details.push('📦 Existing Integration Detected:');
      if (integration.hasIosConfig) {
        details.push('   ✅ iOS configuration found');
      }
      if (integration.hasFlowsDirectory) {
        details.push(`   ✅ ${integration.flowFileCount} Maestro flow(s) found`);
      }
      if (integration.hasBaselinesDirectory) {
        details.push(`   ✅ ${integration.baselineFileCount} baseline(s) found`);
      }
      if (integration.hasBridgeIntegration) {
        details.push('   ✅ MaestroBridge integration found');
      }
    }

    actions.push({
      key: 'confirm',
      label: 'Continue with this project',
      recommended: true,
    });
    actions.push({
      key: 'select-different',
      label: 'Select different project',
    });
  } else {
    details.push('❌ No iOS project found in this directory');
    issues.push('No .xcworkspace or .xcodeproj found');
    recommendations.push('Navigate to a directory containing an iOS project');

    actions.push({
      key: 'select-path',
      label: 'Select project path',
    });
  }

  actions.push({
    key: 'cancel',
    label: 'Cancel',
  });

  const output: StepOutput = {
    icon: project.found ? '📁' : '❌',
    message: project.found
      ? `Analyzing project at ${state.projectPath}`
      : 'No iOS project found',
    details,
    actions,
    issues: issues.length > 0 ? issues : undefined,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  };

  return {
    success: true,
    data: output,
  };
}

/**
 * Execute the simulator selection step
 */
export async function executeSimulatorStep(
  _state: WizardState,
  _onProgress?: WizardProgressCallback
): Promise<IOSResult<StepOutput>> {
  logger.info(`${LOG_CONTEXT} Executing simulator selection step`, LOG_CONTEXT);

  const simResult = await detectSimulators();

  if (!simResult.success || !simResult.data) {
    return {
      success: false,
      error: 'Failed to detect simulators',
      errorCode: 'COMMAND_FAILED',
    };
  }

  const simulators = simResult.data;
  const details: string[] = [];
  const actions: StepOutput['actions'] = [];

  if (simulators.available) {
    details.push('Select default simulator for testing:');
    details.push('');

    // Get top simulators to display
    const topSimulators = simulators.simulators.slice(0, 5);

    topSimulators.forEach((sim, index) => {
      const isRecommended = sim.udid === simulators.recommendedSimulator?.udid;
      const isBooted = sim.state === 'Booted';
      const prefix = isRecommended ? '>' : ' ';
      const suffix = isRecommended ? ' [Recommended]' : isBooted ? ' [Booted]' : '';
      details.push(`${prefix} ${sim.name} (iOS ${sim.iosVersion})${suffix}`);

      actions.push({
        key: `sim-${index}`,
        label: sim.name,
        description: `iOS ${sim.iosVersion}`,
        recommended: isRecommended,
      });
    });

    if (simulators.simulators.length > 5) {
      details.push(`  ... and ${simulators.simulators.length - 5} more`);
      actions.push({
        key: 'show-all',
        label: 'Show all simulators',
      });
    }

    actions.push({
      key: 'use-all',
      label: 'Use all simulators',
      description: 'Test on all available simulators',
    });
  } else {
    details.push('❌ No simulators available');
    details.push('');
    details.push('To add simulators:');
    details.push('1. Open Xcode');
    details.push('2. Go to Window > Devices and Simulators');
    details.push('3. Add iOS simulator runtimes');
  }

  actions.push({
    key: 'skip',
    label: 'Skip for now',
  });
  actions.push({
    key: 'cancel',
    label: 'Cancel',
  });

  const output: StepOutput = {
    icon: '📱',
    message: simulators.available
      ? 'Select default simulator for testing'
      : 'No simulators available',
    details,
    actions,
  };

  return {
    success: true,
    data: output,
  };
}

/**
 * Execute the XCUITest setup step
 */
export async function executeXCUITestStep(
  state: WizardState,
  _onProgress?: WizardProgressCallback
): Promise<IOSResult<StepOutput>> {
  logger.info(`${LOG_CONTEXT} Executing XCUITest setup step`, LOG_CONTEXT);

  const project = state.collectedData.project;
  const details: string[] = [];
  const actions: StepOutput['actions'] = [];

  if (project?.hasUITestTarget) {
    details.push(`✅ XCUITest target found: ${project.uiTestTargetName}`);
    details.push('');
    details.push('XCUITest enables:');
    details.push('• UI element inspection (/ios.inspect)');
    details.push('• Native interactions (/ios.tap, /ios.type)');
    details.push('• Accessibility tree access');

    actions.push({
      key: 'enable',
      label: 'Use existing target',
      description: `Use ${project.uiTestTargetName}`,
      recommended: true,
    });
  } else {
    details.push('❌ No XCUITest target found');
    details.push('');
    details.push('XCUITest enables:');
    details.push('• UI element inspection (/ios.inspect)');
    details.push('• Native interactions (/ios.tap, /ios.type)');
    details.push('• Accessibility tree access');
    details.push('');
    details.push('Without XCUITest, you can still use:');
    details.push('• Maestro CLI for UI automation');
    details.push('• Screenshot capture (/ios.snapshot)');

    actions.push({
      key: 'create',
      label: 'Create XCUITest target',
      description: 'Add a new UI test target to the project',
      recommended: true,
    });
    actions.push({
      key: 'skip',
      label: 'Skip - use Maestro CLI only',
      description: 'Continue without XCUITest',
    });
  }

  actions.push({
    key: 'cancel',
    label: 'Cancel',
  });

  const output: StepOutput = {
    icon: '🧪',
    message: 'XCUITest Configuration',
    details,
    actions,
  };

  return {
    success: true,
    data: output,
  };
}

/**
 * Execute the MaestroBridge setup step
 */
export async function executeBridgeStep(
  state: WizardState,
  _onProgress?: WizardProgressCallback
): Promise<IOSResult<StepOutput>> {
  logger.info(`${LOG_CONTEXT} Executing MaestroBridge setup step`, LOG_CONTEXT);

  const integration = state.collectedData.existingIntegration;
  const details: string[] = [];
  const actions: StepOutput['actions'] = [];

  if (integration?.hasBridgeIntegration) {
    details.push('✅ MaestroBridge already integrated');
    details.push('');
    details.push('MaestroBridge provides:');
    details.push('• View controller stack visibility');
    details.push('• Feature flag inspection');
    details.push('• Network request logging');
    details.push('• Analytics event tracking');

    actions.push({
      key: 'keep',
      label: 'Keep existing integration',
      recommended: true,
    });
  } else {
    details.push('MaestroBridge Integration (Optional)');
    details.push('');
    details.push('MaestroBridge provides debug-time introspection:');
    details.push('• View controller stack visibility');
    details.push('• Feature flag inspection');
    details.push('• Network request logging');
    details.push('• Analytics event tracking');
    details.push('');
    details.push('Note: Requires adding a Swift package to your project.');

    actions.push({
      key: 'add',
      label: 'Add to project',
      description: 'Install MaestroBridge package',
    });
  }

  actions.push({
    key: 'skip',
    label: 'Skip',
    recommended: !integration?.hasBridgeIntegration,
  });
  actions.push({
    key: 'cancel',
    label: 'Cancel',
  });

  const output: StepOutput = {
    icon: '🔌',
    message: 'MaestroBridge Integration (Optional)',
    details,
    actions,
  };

  return {
    success: true,
    data: output,
  };
}

/**
 * Execute the sample flow generation step
 */
export async function executeSampleFlowStep(
  state: WizardState,
  _onProgress?: WizardProgressCallback
): Promise<IOSResult<StepOutput>> {
  logger.info(`${LOG_CONTEXT} Executing sample flow generation step`, LOG_CONTEXT);

  const project = state.collectedData.project;
  const integration = state.collectedData.existingIntegration;
  const details: string[] = [];
  const actions: StepOutput['actions'] = [];

  if (integration?.hasFlowsDirectory && (integration.flowFileCount || 0) > 0) {
    details.push(`✅ ${integration.flowFileCount} existing flow(s) found`);
    details.push(`   Location: ${integration.flowsDirectoryPath}`);
    details.push('');
    details.push('You can add new sample flows or use existing ones.');

    actions.push({
      key: 'keep',
      label: 'Keep existing flows',
      recommended: true,
    });
    actions.push({
      key: 'add-samples',
      label: 'Add sample flows',
      description: 'Create additional sample flows',
    });
  } else {
    details.push('Generate Sample Flow');
    details.push('');
    details.push('This will create a sample Maestro flow for your app:');
    details.push('');
    if (project?.projectName) {
      details.push(`  📁 ${DEFAULT_FLOWS_DIRECTORY}/sample_flow.yaml`);
    } else {
      details.push('  📁 maestro/sample_flow.yaml');
    }
    details.push('');
    details.push('The sample flow will:');
    details.push('• Launch your app');
    details.push('• Take a screenshot');
    details.push('• Demonstrate basic interactions');

    actions.push({
      key: 'generate',
      label: 'Generate sample flow',
      recommended: true,
    });
  }

  actions.push({
    key: 'skip',
    label: 'Skip',
  });
  actions.push({
    key: 'cancel',
    label: 'Cancel',
  });

  const output: StepOutput = {
    icon: '📝',
    message: 'Generate Sample Flow',
    details,
    actions,
  };

  return {
    success: true,
    data: output,
  };
}

/**
 * Execute the summary step
 */
export async function executeSummaryStep(
  state: WizardState,
  _onProgress?: WizardProgressCallback
): Promise<IOSResult<StepOutput>> {
  logger.info(`${LOG_CONTEXT} Executing summary step`, LOG_CONTEXT);

  const project = state.collectedData.project;
  const selectedSim = state.collectedData.selectedSimulator;
  const xcuitest = state.collectedData.xcuitest;
  const bridge = state.collectedData.bridge;

  const details: string[] = [];
  const actions: StepOutput['actions'] = [];

  details.push('🎉 iOS Development Environment Ready!');
  details.push('');
  details.push('Configuration:');

  if (project?.projectName) {
    details.push(`  Project: ${project.projectName}`);
  }
  if (project?.bundleId) {
    details.push(`  Bundle ID: ${project.bundleId}`);
  }
  if (selectedSim) {
    details.push(`  Simulator: ${selectedSim.name}`);
  }
  if (xcuitest?.enabled) {
    details.push(`  XCUITest: ${xcuitest.targetName || 'Enabled'}`);
  }
  if (bridge?.enabled) {
    details.push(`  MaestroBridge: Port ${bridge.port || DEFAULT_BRIDGE_PORT}`);
  }

  details.push('');
  details.push(`Configuration saved to: ${CONFIG_DIRECTORY}/${IOS_CONFIG_FILENAME}`);
  details.push('');
  details.push('Quick Start Commands:');
  details.push('  • /ios.snapshot - Capture current screen');
  details.push('  • /ios.inspect - View UI element tree');
  details.push(`  • /ios.run_flow ${DEFAULT_FLOWS_DIRECTORY}/sample_flow.yaml - Run sample flow`);
  details.push('  • /ios.playbook list - View available playbooks');
  details.push('');
  details.push('Documentation: https://docs.runmaestro.ai/ios-development');

  actions.push({
    key: 'open-docs',
    label: 'Open documentation',
  });
  actions.push({
    key: 'start-coding',
    label: 'Start coding',
    recommended: true,
  });

  const output: StepOutput = {
    icon: '🎉',
    message: 'iOS Development Environment Ready!',
    details,
    actions,
  };

  return {
    success: true,
    data: output,
  };
}

// =============================================================================
// Configuration Management
// =============================================================================

/**
 * Generate the iOS project configuration
 */
export function generateConfig(state: WizardState): IOSProjectConfig {
  const project = state.collectedData.project;
  const selectedSim = state.collectedData.selectedSimulator;
  const xcuitest = state.collectedData.xcuitest;
  const bridge = state.collectedData.bridge;
  const selectedScheme = state.collectedData.selectedScheme;

  // Find main scheme if not explicitly selected
  let scheme = selectedScheme?.name || '';
  if (!scheme && project?.schemes?.length) {
    const mainScheme = project.schemes.find((s: ProjectScheme) => !s.isTest) || project.schemes[0];
    scheme = mainScheme.name;
  }

  const config: IOSProjectConfig = {
    version: WIZARD_VERSION,
    project: {
      path: project?.projectPath || state.projectPath || '',
      scheme,
      bundleId: project?.bundleId,
      type: project?.type === 'unknown' ? 'xcodeproj' : (project?.type as IOSProjectConfig['project']['type']),
    },
    simulator: {
      default: selectedSim?.name || 'iPhone 15 Pro',
      udid: selectedSim?.udid || '',
    },
    xcuitest: {
      enabled: xcuitest?.enabled || false,
      targetName: xcuitest?.targetName || project?.uiTestTargetName,
    },
    bridge: {
      enabled: bridge?.enabled || false,
      port: bridge?.port || DEFAULT_BRIDGE_PORT,
    },
    baselines: {
      directory: `./${DEFAULT_BASELINES_DIRECTORY}`,
    },
    flows: {
      directory: `./${DEFAULT_FLOWS_DIRECTORY}`,
    },
    created: {
      at: new Date().toISOString(),
      wizardVersion: WIZARD_VERSION,
    },
  };

  state.collectedData.config = config;
  return config;
}

/**
 * Save the configuration to disk
 */
export async function saveConfig(
  projectPath: string,
  config: IOSProjectConfig
): Promise<IOSResult<string>> {
  logger.info(`${LOG_CONTEXT} Saving configuration`, LOG_CONTEXT);

  try {
    const configDir = path.join(projectPath, CONFIG_DIRECTORY);
    const configPath = path.join(configDir, IOS_CONFIG_FILENAME);

    // Ensure directory exists
    if (!existsSync(configDir)) {
      await fs.mkdir(configDir, { recursive: true });
    }

    // Write config file
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(configPath, content, 'utf-8');

    logger.info(`${LOG_CONTEXT} Configuration saved to ${configPath}`, LOG_CONTEXT);

    return {
      success: true,
      data: configPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`${LOG_CONTEXT} Failed to save configuration: ${message}`, LOG_CONTEXT);

    return {
      success: false,
      error: `Failed to save configuration: ${message}`,
      errorCode: 'COMMAND_FAILED',
    };
  }
}

/**
 * Load existing configuration
 */
export async function loadConfig(projectPath: string): Promise<IOSResult<IOSProjectConfig>> {
  const configPath = path.join(projectPath, CONFIG_DIRECTORY, IOS_CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return {
      success: false,
      error: 'Configuration file not found',
      errorCode: 'COMMAND_FAILED',
    };
  }

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as IOSProjectConfig;

    return {
      success: true,
      data: config,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to load configuration: ${message}`,
      errorCode: 'COMMAND_FAILED',
    };
  }
}

// =============================================================================
// Sample Flow Generation
// =============================================================================

/**
 * Generate a sample Maestro flow file
 */
export async function generateSampleFlow(
  projectPath: string,
  bundleId?: string
): Promise<IOSResult<string>> {
  logger.info(`${LOG_CONTEXT} Generating sample flow`, LOG_CONTEXT);

  try {
    const flowsDir = path.join(projectPath, DEFAULT_FLOWS_DIRECTORY);
    const flowPath = path.join(flowsDir, 'sample_flow.yaml');

    // Ensure directory exists
    if (!existsSync(flowsDir)) {
      await fs.mkdir(flowsDir, { recursive: true });
    }

    // Generate flow content
    const appId = bundleId || 'com.example.app';
    const content = `# Sample Maestro Flow
# Generated by Maestro iOS Setup Wizard
# Documentation: https://maestro.mobile.dev/reference/yaml-syntax

appId: ${appId}

---
# Launch the app
- launchApp

# Wait for the app to load
- waitForAnimationToEnd

# Take a screenshot to verify the initial state
- takeScreenshot: initial_screen

# Example: Tap on an element (uncomment and customize)
# - tapOn: "Login"

# Example: Enter text (uncomment and customize)
# - inputText: "test@example.com"

# Example: Scroll down (uncomment and customize)
# - scroll

# Take a final screenshot
- takeScreenshot: final_screen
`;

    await fs.writeFile(flowPath, content, 'utf-8');

    logger.info(`${LOG_CONTEXT} Sample flow generated at ${flowPath}`, LOG_CONTEXT);

    return {
      success: true,
      data: flowPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`${LOG_CONTEXT} Failed to generate sample flow: ${message}`, LOG_CONTEXT);

    return {
      success: false,
      error: `Failed to generate sample flow: ${message}`,
      errorCode: 'COMMAND_FAILED',
    };
  }
}

// =============================================================================
// Full Wizard Execution
// =============================================================================

/**
 * Execute a single step and get its output
 */
export async function executeStep(
  state: WizardState,
  stepId: WizardStepId,
  onProgress?: WizardProgressCallback
): Promise<IOSResult<StepOutput>> {
  switch (stepId) {
    case 'environment':
      return executeEnvironmentStep(state, onProgress);
    case 'project':
      return executeProjectStep(state, onProgress);
    case 'simulator':
      return executeSimulatorStep(state, onProgress);
    case 'xcuitest':
      return executeXCUITestStep(state, onProgress);
    case 'bridge':
      return executeBridgeStep(state, onProgress);
    case 'sample-flow':
      return executeSampleFlowStep(state, onProgress);
    case 'summary':
      return executeSummaryStep(state, onProgress);
    default:
      return {
        success: false,
        error: `Unknown step: ${stepId}`,
        errorCode: 'COMMAND_FAILED',
      };
  }
}

/**
 * Process a user decision for a step
 */
export function processDecision(
  state: WizardState,
  stepId: WizardStepId,
  choice: string,
  data?: Record<string, unknown>
): WizardState {
  let updatedState = recordDecision(state, stepId, choice, data);

  // Handle step-specific choices
  switch (stepId) {
    case 'environment':
      if (choice === 'cancel') {
        return cancelWizard(updatedState);
      }
      updatedState = updateStepStatus(updatedState, stepId, 'completed');
      break;

    case 'project':
      if (choice === 'cancel') {
        return cancelWizard(updatedState);
      }
      if (choice === 'confirm') {
        updatedState = updateStepStatus(updatedState, stepId, 'completed');
      }
      break;

    case 'simulator':
      if (choice === 'cancel') {
        return cancelWizard(updatedState);
      }
      if (choice.startsWith('sim-')) {
        const index = parseInt(choice.replace('sim-', ''), 10);
        const simulators = updatedState.collectedData.environment?.simulators.simulators || [];
        if (simulators[index]) {
          updatedState.collectedData.selectedSimulator = simulators[index];
        }
        updatedState = updateStepStatus(updatedState, stepId, 'completed');
      } else if (choice === 'skip') {
        updatedState = updateStepStatus(updatedState, stepId, 'skipped');
      }
      break;

    case 'xcuitest':
      if (choice === 'cancel') {
        return cancelWizard(updatedState);
      }
      if (choice === 'enable' || choice === 'create') {
        updatedState.collectedData.xcuitest = {
          enabled: true,
          targetName: updatedState.collectedData.project?.uiTestTargetName,
          createNew: choice === 'create',
        };
        updatedState = updateStepStatus(updatedState, stepId, 'completed');
      } else if (choice === 'skip') {
        updatedState.collectedData.xcuitest = { enabled: false };
        updatedState = updateStepStatus(updatedState, stepId, 'skipped');
      }
      break;

    case 'bridge':
      if (choice === 'cancel') {
        return cancelWizard(updatedState);
      }
      if (choice === 'add' || choice === 'keep') {
        updatedState.collectedData.bridge = {
          enabled: true,
          port: DEFAULT_BRIDGE_PORT,
        };
        updatedState = updateStepStatus(updatedState, stepId, 'completed');
      } else if (choice === 'skip') {
        updatedState.collectedData.bridge = { enabled: false };
        updatedState = updateStepStatus(updatedState, stepId, 'skipped');
      }
      break;

    case 'sample-flow':
      if (choice === 'cancel') {
        return cancelWizard(updatedState);
      }
      if (choice === 'generate' || choice === 'add-samples') {
        updatedState = updateStepStatus(updatedState, stepId, 'completed');
      } else if (choice === 'skip' || choice === 'keep') {
        updatedState = updateStepStatus(updatedState, stepId, 'skipped');
      }
      break;

    case 'summary':
      updatedState = updateStepStatus(updatedState, stepId, 'completed');
      break;
  }

  // Advance to next step if current is completed or skipped
  const currentStep = getStepById(updatedState, stepId);
  if (currentStep?.status === 'completed' || currentStep?.status === 'skipped') {
    updatedState = advanceStep(updatedState);
  }

  return updatedState;
}

/**
 * Format step output for display
 */
export function formatStepOutput(_step: WizardStep, output: StepOutput): string {
  const lines: string[] = [];

  lines.push(`${output.icon} ${output.message}`);
  lines.push('');

  for (const detail of output.details) {
    lines.push(detail);
  }

  if (output.issues && output.issues.length > 0) {
    lines.push('');
    lines.push('Issues:');
    for (const issue of output.issues) {
      lines.push(`  ⚠️ ${issue}`);
    }
  }

  if (output.recommendations && output.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const rec of output.recommendations) {
      lines.push(`  💡 ${rec}`);
    }
  }

  if (output.actions && output.actions.length > 0) {
    lines.push('');
    for (const action of output.actions) {
      const marker = action.recommended ? '▶' : '○';
      const desc = action.description ? ` - ${action.description}` : '';
      lines.push(`  ${marker} [${action.key}] ${action.label}${desc}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format progress bar
 */
export function formatProgressBar(state: WizardState): string {
  const progress = getProgress(state);
  const filled = Math.round((progress.percentage / 100) * 20);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return `[${bar}] ${progress.percentage}% (Step ${progress.current}/${progress.total})`;
}
