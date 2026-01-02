/**
 * iOS Setup Slash Command Handler
 *
 * Handles the /ios.setup command for interactive iOS development environment setup.
 * Provides subcommands for environment checking, auto-fixing issues, and resetting configuration.
 *
 * Usage:
 *   /ios.setup                - Run interactive setup wizard
 *   /ios.setup --check        - Only check environment (no modifications)
 *   /ios.setup --fix          - Attempt to fix issues automatically
 *   /ios.setup --reset        - Reset configuration
 *
 * Options:
 *   --project, -p     Project path (default: current directory)
 */

import path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as wizard from '../ios-tools/setup/wizard';
import * as detector from '../ios-tools/setup/detector';
import { logger } from '../utils/logger';
import { execFileNoThrow } from '../utils/execFile';

const LOG_CONTEXT = '[SlashCmd-ios.setup]';

// =============================================================================
// Types
// =============================================================================

/**
 * Setup command mode
 */
export type SetupMode = 'wizard' | 'check' | 'fix' | 'reset';

/**
 * Parsed arguments from /ios.setup command
 */
export interface SetupCommandArgs {
  /** Mode of operation */
  mode: SetupMode;
  /** Project path */
  projectPath?: string;
  /** Raw input (unparsed portion) */
  raw?: string;
}

/**
 * Result of executing the setup command
 */
export interface SetupCommandResult {
  success: boolean;
  /** Formatted output for display in AI terminal */
  output: string;
  /** Wizard state (for wizard mode) */
  wizardState?: wizard.WizardState;
  /** Current step output (for wizard mode) */
  stepOutput?: wizard.StepOutput;
  /** Configuration (if generated) */
  config?: wizard.IOSProjectConfig;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Argument Parsing
// =============================================================================

/**
 * Parse command line arguments from /ios.setup command text.
 *
 * @param commandText - Full command text including /ios.setup
 * @returns Parsed arguments
 */
export function parseSetupArgs(commandText: string): SetupCommandArgs {
  const args: SetupCommandArgs = {
    mode: 'wizard',
  };

  // Remove the command prefix
  const argsText = commandText.replace(/^\/ios\.setup\s*/, '').trim();
  if (!argsText) {
    return args;
  }

  // Tokenize respecting quoted strings
  const tokens = tokenize(argsText);

  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Handle --check
    if (token === '--check') {
      args.mode = 'check';
    }
    // Handle --fix
    else if (token === '--fix') {
      args.mode = 'fix';
    }
    // Handle --reset
    else if (token === '--reset') {
      args.mode = 'reset';
    }
    // Handle --project or -p
    else if (token === '--project' || token === '-p') {
      if (i + 1 < tokens.length) {
        args.projectPath = tokens[++i];
      }
    }
    // Positional arguments (project path without flag)
    else if (!token.startsWith('-')) {
      if (!args.projectPath) {
        args.projectPath = token;
      } else {
        args.raw = args.raw ? `${args.raw} ${token}` : token;
      }
    }

    i++;
  }

  return args;
}

/**
 * Tokenize a string respecting quoted values.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

// =============================================================================
// Command Execution
// =============================================================================

/**
 * Execute the /ios.setup command.
 *
 * @param commandText - Full command text
 * @param sessionId - Session ID for context
 * @param projectPath - Current project path (used as default)
 * @returns Command result with formatted output
 */
export async function executeSetupCommand(
  commandText: string,
  _sessionId: string,
  projectPath?: string
): Promise<SetupCommandResult> {
  logger.info(`${LOG_CONTEXT} Executing setup command: ${commandText}`);

  // Parse arguments
  const args = parseSetupArgs(commandText);
  logger.debug(`${LOG_CONTEXT} Parsed args`, LOG_CONTEXT, args);

  // Determine project path
  const targetPath = args.projectPath || projectPath || process.cwd();

  // Route to appropriate handler
  switch (args.mode) {
    case 'check':
      return executeCheckMode(targetPath);
    case 'fix':
      return executeFixMode(targetPath);
    case 'reset':
      return executeResetMode(targetPath);
    case 'wizard':
    default:
      return executeWizardMode(targetPath);
  }
}

// =============================================================================
// Mode Handlers
// =============================================================================

/**
 * Execute the interactive wizard mode.
 */
async function executeWizardMode(projectPath: string): Promise<SetupCommandResult> {
  logger.info(`${LOG_CONTEXT} Starting wizard mode for ${projectPath}`);

  try {
    // Create wizard state
    const state = wizard.createWizardState(projectPath);

    // Get current step
    const currentStep = wizard.getCurrentStep(state);
    if (!currentStep) {
      return {
        success: false,
        output: formatError('Wizard Error', 'Failed to initialize wizard'),
        error: 'Failed to initialize wizard',
      };
    }

    // Execute the first step
    const stepResult = await wizard.executeStep(state, currentStep.id);
    if (!stepResult.success || !stepResult.data) {
      return {
        success: false,
        output: formatError('Wizard Error', stepResult.error || 'Failed to execute step'),
        error: stepResult.error,
      };
    }

    // Format wizard output
    const output = formatWizardStep(state, currentStep, stepResult.data);

    return {
      success: true,
      output,
      wizardState: state,
      stepOutput: stepResult.data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Wizard error: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Wizard Error', errorMessage),
      error: errorMessage,
    };
  }
}

/**
 * Execute the check-only mode.
 */
async function executeCheckMode(projectPath: string): Promise<SetupCommandResult> {
  logger.info(`${LOG_CONTEXT} Running environment check for ${projectPath}`);

  try {
    // Run all detections in parallel
    const [envResult, projectResult, integrationResult] = await Promise.all([
      detector.detectEnvironment(),
      detector.detectProjectType(projectPath),
      detector.detectExistingIntegration(projectPath),
    ]);

    const output = formatCheckOutput(
      envResult.data,
      projectResult.data,
      integrationResult.data,
      projectPath
    );

    return {
      success: true,
      output,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Check error: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Environment Check Failed', errorMessage),
      error: errorMessage,
    };
  }
}

/**
 * Execute the auto-fix mode.
 */
async function executeFixMode(projectPath: string): Promise<SetupCommandResult> {
  logger.info(`${LOG_CONTEXT} Running auto-fix for ${projectPath}`);

  const fixedIssues: string[] = [];
  const failedFixes: string[] = [];
  const skippedFixes: string[] = [];

  try {
    // Check environment
    const envResult = await detector.detectEnvironment();
    const env = envResult.data;

    if (!env) {
      return {
        success: false,
        output: formatError('Auto-Fix Failed', 'Could not detect environment'),
        error: 'Could not detect environment',
      };
    }

    // Fix: Install command line tools if missing
    if (env.xcode.installed && !env.xcode.commandLineToolsInstalled) {
      logger.info(`${LOG_CONTEXT} Attempting to install command line tools`);
      const installResult = await execFileNoThrow('xcode-select', ['--install']);
      if (installResult.exitCode === 0) {
        fixedIssues.push('Started Xcode command line tools installation');
      } else if (installResult.stderr?.includes('already installed')) {
        skippedFixes.push('Command line tools already installed');
      } else {
        failedFixes.push('Could not install command line tools - run: xcode-select --install');
      }
    }

    // Fix: Accept Xcode license if needed
    if (env.xcode.installed && !env.xcode.licenseAccepted) {
      skippedFixes.push('Xcode license needs manual acceptance: sudo xcodebuild -license accept');
    }

    // Fix: Boot recommended simulator if none booted
    if (env.simulators.available && env.simulators.bootedCount === 0) {
      const recommended = env.simulators.recommendedSimulator;
      if (recommended) {
        logger.info(`${LOG_CONTEXT} Booting simulator: ${recommended.name}`);
        const bootResult = await execFileNoThrow('xcrun', ['simctl', 'boot', recommended.udid]);
        if (bootResult.exitCode === 0) {
          fixedIssues.push(`Booted simulator: ${recommended.name}`);
        } else if (bootResult.stderr?.includes('current state: Booted')) {
          skippedFixes.push(`Simulator already booted: ${recommended.name}`);
        } else {
          failedFixes.push(`Could not boot simulator: ${recommended.name}`);
        }
      }
    }

    // Fix: Install Maestro CLI if missing
    if (!env.maestroCli.installed) {
      skippedFixes.push('Maestro CLI installation requires manual step: curl -Ls "https://get.maestro.mobile.dev" | bash');
    }

    // Fix: Create .maestro directory if missing
    const maestroDir = path.join(projectPath, '.maestro');
    if (!existsSync(maestroDir)) {
      logger.info(`${LOG_CONTEXT} Creating .maestro directory`);
      await fs.mkdir(maestroDir, { recursive: true });
      fixedIssues.push('Created .maestro configuration directory');
    }

    // Fix: Create flows directory if missing
    const flowsDir = path.join(projectPath, wizard.DEFAULT_FLOWS_DIRECTORY);
    if (!existsSync(flowsDir)) {
      logger.info(`${LOG_CONTEXT} Creating flows directory`);
      await fs.mkdir(flowsDir, { recursive: true });
      fixedIssues.push(`Created ${wizard.DEFAULT_FLOWS_DIRECTORY} directory for Maestro flows`);
    }

    // Fix: Create baselines directory if missing
    const baselinesDir = path.join(projectPath, wizard.DEFAULT_BASELINES_DIRECTORY);
    if (!existsSync(baselinesDir)) {
      logger.info(`${LOG_CONTEXT} Creating baselines directory`);
      await fs.mkdir(baselinesDir, { recursive: true });
      fixedIssues.push(`Created ${wizard.DEFAULT_BASELINES_DIRECTORY} directory for visual baselines`);
    }

    const output = formatFixOutput(fixedIssues, failedFixes, skippedFixes, projectPath);

    return {
      success: failedFixes.length === 0,
      output,
      error: failedFixes.length > 0 ? `${failedFixes.length} fix(es) failed` : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Fix error: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Auto-Fix Failed', errorMessage),
      error: errorMessage,
    };
  }
}

/**
 * Execute the reset mode.
 */
async function executeResetMode(projectPath: string): Promise<SetupCommandResult> {
  logger.info(`${LOG_CONTEXT} Resetting configuration for ${projectPath}`);

  try {
    const configPath = path.join(projectPath, wizard.CONFIG_DIRECTORY, wizard.IOS_CONFIG_FILENAME);

    if (!existsSync(configPath)) {
      return {
        success: true,
        output: formatResetOutput(false, projectPath),
      };
    }

    // Read existing config for backup info
    const existingConfig = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(existingConfig) as wizard.IOSProjectConfig;

    // Delete the config file
    await fs.unlink(configPath);
    logger.info(`${LOG_CONTEXT} Deleted configuration file: ${configPath}`);

    return {
      success: true,
      output: formatResetOutput(true, projectPath, config),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${LOG_CONTEXT} Reset error: ${errorMessage}`);

    return {
      success: false,
      output: formatError('Reset Failed', errorMessage),
      error: errorMessage,
    };
  }
}

// =============================================================================
// Wizard Step Processing
// =============================================================================

/**
 * Continue the wizard with a user decision.
 *
 * @param state - Current wizard state
 * @param choice - User's choice for the current step
 * @param data - Additional data for the decision
 * @returns Updated wizard state and next step output
 */
export async function continueWizard(
  state: wizard.WizardState,
  choice: string,
  data?: Record<string, unknown>
): Promise<SetupCommandResult> {
  const currentStep = wizard.getCurrentStep(state);
  if (!currentStep) {
    return {
      success: false,
      output: formatError('Wizard Error', 'No current step found'),
      error: 'No current step found',
    };
  }

  // Process the decision
  let updatedState = wizard.processDecision(state, currentStep.id, choice, data);

  // Check if wizard was cancelled
  if (updatedState.isCancelled) {
    return {
      success: true,
      output: formatWizardCancelled(),
      wizardState: updatedState,
    };
  }

  // Check if wizard is complete
  if (updatedState.isComplete) {
    // Generate and save configuration
    const config = wizard.generateConfig(updatedState);
    const saveResult = await wizard.saveConfig(updatedState.projectPath!, config);

    // Generate sample flow if requested
    const sampleFlowDecision = updatedState.decisions.find(
      (d) => d.stepId === 'sample-flow' && (d.choice === 'generate' || d.choice === 'add-samples')
    );
    if (sampleFlowDecision && updatedState.projectPath) {
      await wizard.generateSampleFlow(
        updatedState.projectPath,
        updatedState.collectedData.project?.bundleId
      );
    }

    return {
      success: saveResult.success,
      output: formatWizardComplete(updatedState, config, saveResult.data),
      wizardState: updatedState,
      config,
    };
  }

  // Execute the next step
  const nextStep = wizard.getCurrentStep(updatedState);
  if (!nextStep) {
    return {
      success: false,
      output: formatError('Wizard Error', 'No next step found'),
      error: 'No next step found',
    };
  }

  const stepResult = await wizard.executeStep(updatedState, nextStep.id);
  if (!stepResult.success || !stepResult.data) {
    // Mark step as failed but allow continuing
    updatedState = wizard.updateStepStatus(updatedState, nextStep.id, 'failed', undefined, stepResult.error);

    return {
      success: false,
      output: formatError(`Step Failed: ${nextStep.title}`, stepResult.error || 'Unknown error'),
      wizardState: updatedState,
      error: stepResult.error,
    };
  }

  return {
    success: true,
    output: formatWizardStep(updatedState, nextStep, stepResult.data),
    wizardState: updatedState,
    stepOutput: stepResult.data,
  };
}

// =============================================================================
// Output Formatters
// =============================================================================

/**
 * Format wizard step output.
 */
function formatWizardStep(
  state: wizard.WizardState,
  step: wizard.WizardStep,
  output: wizard.StepOutput
): string {
  const progress = wizard.formatProgressBar(state);
  const stepOutput = wizard.formatStepOutput(step, output);

  return `## iOS Setup Wizard

${progress}

### Step ${state.currentStepIndex + 1}: ${step.title}

${stepOutput}
`;
}

/**
 * Format wizard completion output.
 */
function formatWizardComplete(
  state: wizard.WizardState,
  config: wizard.IOSProjectConfig,
  configPath?: string
): string {
  const duration = state.completedAt && state.startedAt
    ? Math.round((state.completedAt - state.startedAt) / 1000)
    : 0;

  return `## iOS Setup Complete

Configuration saved to: \`${configPath || '.maestro/ios-config.json'}\`

### Configuration Summary

| Setting | Value |
|---------|-------|
| Project | ${config.project.path} |
| Scheme | ${config.project.scheme} |
| Bundle ID | ${config.project.bundleId || 'Not set'} |
| Simulator | ${config.simulator.default} |
| XCUITest | ${config.xcuitest.enabled ? config.xcuitest.targetName || 'Enabled' : 'Disabled'} |
| MaestroBridge | ${config.bridge.enabled ? `Port ${config.bridge.port}` : 'Disabled'} |

### Quick Start Commands

\`\`\`
/ios.snapshot              # Capture current screen
/ios.inspect               # View UI element tree
/ios.run_flow ${config.flows.directory}/sample_flow.yaml  # Run sample flow
/ios.playbook list         # View available playbooks
/ios.baseline save login   # Save visual baseline
/ios.diff login            # Compare to baseline
\`\`\`

### Documentation
https://docs.runmaestro.ai/ios-development

*Setup completed in ${duration} seconds*
`;
}

/**
 * Format wizard cancellation output.
 */
function formatWizardCancelled(): string {
  return `## iOS Setup Cancelled

The setup wizard was cancelled. No changes were made.

### To resume setup, run:
\`/ios.setup\`

### To check environment without modifications:
\`/ios.setup --check\`
`;
}

/**
 * Format check mode output.
 */
function formatCheckOutput(
  env?: detector.EnvironmentDetectionResult,
  project?: detector.ProjectTypeResult,
  integration?: detector.ExistingIntegrationResult,
  projectPath?: string
): string {
  const lines: string[] = [
    '## iOS Development Environment Check',
    '',
    `**Project Path**: ${projectPath || 'Current directory'}`,
    '',
  ];

  // Overall status
  const ready = env?.ready ?? false;
  lines.push(`### Overall Status: ${ready ? '✅ Ready' : '⚠️ Needs Attention'}`);
  lines.push('');

  // Xcode section
  lines.push('### Xcode');
  if (env?.xcode) {
    if (env.xcode.installed) {
      lines.push(`✅ Xcode ${env.xcode.version || 'unknown'} installed at ${env.xcode.path}`);
      lines.push(`${env.xcode.commandLineToolsInstalled ? '✅' : '❌'} Command Line Tools`);
      lines.push(`${env.xcode.licenseAccepted ? '✅' : '❌'} License Accepted`);
    } else {
      lines.push('❌ Xcode not installed');
    }
  } else {
    lines.push('❌ Could not detect Xcode');
  }
  lines.push('');

  // Simulators section
  lines.push('### Simulators');
  if (env?.simulators) {
    if (env.simulators.available) {
      lines.push(`✅ ${env.simulators.availableCount} simulator(s) available`);
      lines.push(`   ${env.simulators.bootedCount} currently booted`);
      if (env.simulators.iosVersions.length > 0) {
        lines.push(`   iOS versions: ${env.simulators.iosVersions.slice(0, 3).join(', ')}${env.simulators.iosVersions.length > 3 ? '...' : ''}`);
      }
      if (env.simulators.recommendedSimulator) {
        lines.push(`   Recommended: ${env.simulators.recommendedSimulator.name}`);
      }
    } else {
      lines.push('❌ No simulators available');
    }
  } else {
    lines.push('❌ Could not detect simulators');
  }
  lines.push('');

  // Maestro CLI section
  lines.push('### Maestro CLI');
  if (env?.maestroCli) {
    if (env.maestroCli.installed) {
      lines.push(`✅ Maestro CLI ${env.maestroCli.version || 'unknown'} installed`);
      lines.push(`   ${env.maestroCli.isWorking ? '✅' : '⚠️'} ${env.maestroCli.isWorking ? 'Working' : 'Not responding'}`);
    } else {
      lines.push('⚠️ Maestro CLI not installed (optional)');
      lines.push('   Install: curl -Ls "https://get.maestro.mobile.dev" | bash');
    }
  } else {
    lines.push('⚠️ Could not detect Maestro CLI');
  }
  lines.push('');

  // Project section
  lines.push('### Project');
  if (project?.found) {
    lines.push(`✅ ${project.type === 'xcworkspace' ? 'Workspace' : project.type === 'xcodeproj' ? 'Project' : 'Package'}: ${project.projectName}`);
    if (project.bundleId) {
      lines.push(`   Bundle ID: ${project.bundleId}`);
    }
    if (project.schemes.length > 0) {
      lines.push(`   Schemes: ${project.schemes.map(s => s.name).join(', ')}`);
    }
    lines.push(`   ${project.hasUITestTarget ? '✅' : '⚠️'} XCUITest target${project.hasUITestTarget ? `: ${project.uiTestTargetName}` : ' not found'}`);
  } else {
    lines.push('❌ No iOS project found in this directory');
  }
  lines.push('');

  // Existing integration section
  lines.push('### Existing Integration');
  if (integration?.hasIntegration) {
    if (integration.hasIosConfig) {
      lines.push('✅ iOS configuration found');
    }
    if (integration.hasFlowsDirectory) {
      lines.push(`✅ ${integration.flowFileCount} Maestro flow(s) at ${integration.flowsDirectoryPath}`);
    }
    if (integration.hasBaselinesDirectory) {
      lines.push(`✅ ${integration.baselineFileCount} baseline(s) at ${integration.baselinesDirectoryPath}`);
    }
    if (integration.hasBridgeIntegration) {
      lines.push('✅ MaestroBridge integration detected');
    }
  } else {
    lines.push('ℹ️ No existing Maestro integration found');
  }
  lines.push('');

  // Issues and recommendations
  if (env?.allIssues && env.allIssues.length > 0) {
    lines.push('### Issues');
    for (const issue of env.allIssues) {
      lines.push(`⚠️ ${issue}`);
    }
    lines.push('');
  }

  if (env?.allRecommendations && env.allRecommendations.length > 0) {
    lines.push('### Recommendations');
    for (const rec of env.allRecommendations) {
      lines.push(`💡 ${rec}`);
    }
    lines.push('');
  }

  // Next steps
  lines.push('### Next Steps');
  if (!ready) {
    lines.push('Run `/ios.setup --fix` to attempt automatic fixes');
  }
  lines.push('Run `/ios.setup` to start the interactive setup wizard');

  return lines.join('\n');
}

/**
 * Format fix mode output.
 */
function formatFixOutput(
  fixed: string[],
  failed: string[],
  skipped: string[],
  projectPath: string
): string {
  const lines: string[] = [
    '## iOS Setup Auto-Fix',
    '',
    `**Project Path**: ${projectPath}`,
    '',
  ];

  if (fixed.length > 0) {
    lines.push('### Fixed');
    for (const fix of fixed) {
      lines.push(`✅ ${fix}`);
    }
    lines.push('');
  }

  if (skipped.length > 0) {
    lines.push('### Requires Manual Action');
    for (const skip of skipped) {
      lines.push(`⚠️ ${skip}`);
    }
    lines.push('');
  }

  if (failed.length > 0) {
    lines.push('### Failed');
    for (const fail of failed) {
      lines.push(`❌ ${fail}`);
    }
    lines.push('');
  }

  if (fixed.length === 0 && skipped.length === 0 && failed.length === 0) {
    lines.push('ℹ️ No issues to fix. Environment is ready!');
    lines.push('');
  }

  lines.push('### Next Steps');
  if (failed.length > 0 || skipped.length > 0) {
    lines.push('Address the issues above, then run `/ios.setup --check` to verify');
  } else {
    lines.push('Run `/ios.setup` to start the interactive setup wizard');
  }

  return lines.join('\n');
}

/**
 * Format reset mode output.
 */
function formatResetOutput(
  configExisted: boolean,
  projectPath: string,
  oldConfig?: wizard.IOSProjectConfig
): string {
  if (!configExisted) {
    return `## iOS Setup Reset

**Project Path**: ${projectPath}

ℹ️ No configuration file found. Nothing to reset.

### To create a new configuration:
\`/ios.setup\`
`;
  }

  return `## iOS Setup Reset

**Project Path**: ${projectPath}

✅ Configuration has been reset.

### Deleted Configuration
| Setting | Previous Value |
|---------|----------------|
| Project | ${oldConfig?.project.path || 'Unknown'} |
| Scheme | ${oldConfig?.project.scheme || 'Unknown'} |
| Simulator | ${oldConfig?.simulator.default || 'Unknown'} |
| Created | ${oldConfig?.created.at || 'Unknown'} |

### To create a new configuration:
\`/ios.setup\`
`;
}

/**
 * Format error message for display.
 */
function formatError(title: string, detail: string): string {
  return `## iOS Setup Failed

**Error**: ${title}

${detail}

### Troubleshooting
- Ensure you have the necessary permissions
- Check that the project path is valid
- Run \`/ios.setup --check\` to diagnose issues

### Need help?
https://docs.runmaestro.ai/ios-development/troubleshooting
`;
}

// =============================================================================
// Command Metadata
// =============================================================================

/**
 * Metadata for the /ios.setup command.
 */
export const setupCommandMetadata = {
  command: '/ios.setup',
  description: 'Interactive iOS development environment setup',
  usage: '/ios.setup [--check | --fix | --reset] [-p <path>]',
  options: [
    {
      name: '--check',
      description: 'Only check environment (no modifications)',
      valueHint: null,
    },
    {
      name: '--fix',
      description: 'Attempt to fix issues automatically',
      valueHint: null,
    },
    {
      name: '--reset',
      description: 'Reset configuration',
      valueHint: null,
    },
    {
      name: '--project, -p',
      description: 'Project path (default: current directory)',
      valueHint: '<path>',
    },
  ],
  examples: [
    '/ios.setup',
    '/ios.setup --check',
    '/ios.setup --fix',
    '/ios.setup --reset',
    '/ios.setup -p /path/to/project',
  ],
};
