/**
 * iOS Tools - Setup Environment Detection
 *
 * Functions for detecting iOS development environment components:
 * - Xcode and command line tools
 * - iOS simulators
 * - Maestro CLI (mobile-dev-inc)
 * - iOS project structure
 * - Existing Maestro integration
 *
 * Used by the /ios.setup wizard to guide users through setup.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { IOSResult, XcodeInfo, Simulator } from '../types';
import { getXcodeInfo } from '../xcode';
import { listSimulators } from '../simulator';
import { detectMaestroCli as detectMaestroCliCore } from '../maestro-cli';
import { execFileNoThrow } from '../../utils/execFile';
import { logger } from '../../utils/logger';

const LOG_CONTEXT = '[iOS-Setup-Detector]';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of Xcode installation detection
 */
export interface XcodeInstallationResult {
  /** Whether Xcode is installed */
  installed: boolean;
  /** Xcode path if installed */
  path?: string;
  /** Xcode version if installed */
  version?: string;
  /** Xcode build number if installed */
  build?: string;
  /** Whether command line tools are installed */
  commandLineToolsInstalled: boolean;
  /** Whether Xcode license has been accepted */
  licenseAccepted: boolean;
  /** Issues found during detection */
  issues: string[];
  /** Recommendations to fix issues */
  recommendations: string[];
}

/**
 * Result of simulator detection
 */
export interface SimulatorDetectionResult {
  /** Whether any simulators are available */
  available: boolean;
  /** Total number of simulators */
  totalCount: number;
  /** Number of available (usable) simulators */
  availableCount: number;
  /** Number of booted simulators */
  bootedCount: number;
  /** List of iOS versions available */
  iosVersions: string[];
  /** List of booted simulators */
  bootedSimulators: Simulator[];
  /** Recommended simulator (newest iPhone) */
  recommendedSimulator?: Simulator;
  /** All available simulators */
  simulators: Simulator[];
  /** Issues found during detection */
  issues: string[];
  /** Recommendations to fix issues */
  recommendations: string[];
}

/**
 * Result of Maestro CLI detection
 */
export interface MaestroCliDetectionResult {
  /** Whether Maestro CLI is installed */
  installed: boolean;
  /** Path to maestro binary */
  path?: string;
  /** Maestro version */
  version?: string;
  /** Whether CLI is properly working */
  isWorking: boolean;
  /** Installation instructions */
  installInstructions?: string;
  /** Issues found during detection */
  issues: string[];
  /** Recommendations to fix issues */
  recommendations: string[];
}

/**
 * Type of iOS project detected
 */
export type IOSProjectType =
  | 'xcworkspace' // Xcode workspace (often with CocoaPods)
  | 'xcodeproj' // Standard Xcode project
  | 'swift-package' // Swift Package Manager project
  | 'unknown'; // No iOS project found

/**
 * iOS project scheme information
 */
export interface ProjectScheme {
  /** Scheme name */
  name: string;
  /** Whether it's a test scheme */
  isTest: boolean;
  /** Whether it's a UI test scheme */
  isUITest: boolean;
}

/**
 * Result of iOS project type detection
 */
export interface ProjectTypeResult {
  /** Type of project detected */
  type: IOSProjectType;
  /** Whether an iOS project was found */
  found: boolean;
  /** Path to the project file (.xcworkspace or .xcodeproj) */
  projectPath?: string;
  /** Project name */
  projectName?: string;
  /** Bundle identifier (if detectable) */
  bundleId?: string;
  /** Available schemes */
  schemes: ProjectScheme[];
  /** Available targets */
  targets: string[];
  /** Whether XCUITest target exists */
  hasUITestTarget: boolean;
  /** Name of UI test target if exists */
  uiTestTargetName?: string;
  /** Minimum iOS deployment target */
  minimumDeploymentTarget?: string;
  /** Issues found during detection */
  issues: string[];
  /** Recommendations to fix issues */
  recommendations: string[];
}

/**
 * Result of existing integration detection
 */
export interface ExistingIntegrationResult {
  /** Whether any Maestro integration exists */
  hasIntegration: boolean;
  /** Whether .maestro config directory exists */
  hasMaestroConfig: boolean;
  /** Path to .maestro config if exists */
  configPath?: string;
  /** Whether ios-config.json exists */
  hasIosConfig: boolean;
  /** Whether Maestro flows directory exists */
  hasFlowsDirectory: boolean;
  /** Path to flows directory */
  flowsDirectoryPath?: string;
  /** Number of flow files found */
  flowFileCount: number;
  /** Whether baselines directory exists */
  hasBaselinesDirectory: boolean;
  /** Path to baselines directory */
  baselinesDirectoryPath?: string;
  /** Number of baseline files found */
  baselineFileCount: number;
  /** Whether MaestroBridge is integrated */
  hasBridgeIntegration: boolean;
  /** Details of current configuration */
  currentConfig?: Record<string, unknown>;
}

/**
 * Complete environment detection result
 */
export interface EnvironmentDetectionResult {
  /** Overall readiness status */
  ready: boolean;
  /** Xcode detection result */
  xcode: XcodeInstallationResult;
  /** Simulator detection result */
  simulators: SimulatorDetectionResult;
  /** Maestro CLI detection result */
  maestroCli: MaestroCliDetectionResult;
  /** All issues found */
  allIssues: string[];
  /** All recommendations */
  allRecommendations: string[];
}

// =============================================================================
// Xcode Detection
// =============================================================================

/**
 * Detect Xcode installation and configuration.
 *
 * Checks:
 * - Xcode installation via xcode-select
 * - Xcode version via xcodebuild
 * - Command line tools installation
 * - License acceptance
 *
 * @returns Detailed Xcode installation result
 */
export async function detectXcodeInstallation(): Promise<IOSResult<XcodeInstallationResult>> {
  logger.info(`${LOG_CONTEXT} Detecting Xcode installation`, LOG_CONTEXT);

  const issues: string[] = [];
  const recommendations: string[] = [];
  let installed = false;
  let xcodeInfo: XcodeInfo | undefined;
  let licenseAccepted = false;
  let commandLineToolsInstalled = false;

  // Get Xcode info
  const infoResult = await getXcodeInfo();

  if (infoResult.success && infoResult.data) {
    installed = true;
    xcodeInfo = infoResult.data;
    commandLineToolsInstalled = xcodeInfo.commandLineToolsInstalled;

    // Check Xcode version (recommend 14.0+)
    const versionParts = xcodeInfo.version.split('.').map(Number);
    if (versionParts[0] < 14) {
      issues.push(`Xcode version ${xcodeInfo.version} is outdated`);
      recommendations.push('Update Xcode to version 14.0 or later for best compatibility');
    }

    logger.info(
      `${LOG_CONTEXT} Xcode ${xcodeInfo.version} found at ${xcodeInfo.path}`,
      LOG_CONTEXT
    );
  } else {
    // Determine the specific issue
    if (infoResult.error?.includes('not installed')) {
      issues.push('Xcode is not installed');
      recommendations.push('Install Xcode from the App Store: https://apps.apple.com/app/xcode/id497799835');
    } else if (infoResult.error?.includes('command line tools')) {
      installed = true; // Xcode might be installed but tools aren't
      issues.push('Xcode command line tools are not installed');
      recommendations.push('Run: xcode-select --install');
    } else {
      issues.push(infoResult.error || 'Unknown Xcode detection error');
      recommendations.push('Ensure Xcode is properly installed and configured');
    }
  }

  // Check if command line tools are functional
  if (installed && !commandLineToolsInstalled) {
    issues.push('Xcode command line tools are not properly configured');
    recommendations.push('Run: xcode-select --install');
  }

  // Check license acceptance via xcodebuild
  if (installed) {
    const licenseResult = await execFileNoThrow('xcodebuild', ['-version']);
    if (licenseResult.exitCode === 0) {
      licenseAccepted = true;
    } else if (licenseResult.stderr?.toLowerCase().includes('license')) {
      issues.push('Xcode license has not been accepted');
      recommendations.push('Run: sudo xcodebuild -license accept');
    } else {
      // Some other xcodebuild issue
      licenseAccepted = true; // Assume accepted if not a license issue
    }
  }

  const result: XcodeInstallationResult = {
    installed,
    path: xcodeInfo?.path,
    version: xcodeInfo?.version,
    build: xcodeInfo?.build,
    commandLineToolsInstalled,
    licenseAccepted,
    issues,
    recommendations,
  };

  return {
    success: true,
    data: result,
  };
}

// =============================================================================
// Simulator Detection
// =============================================================================

/**
 * Detect available iOS simulators.
 *
 * Checks:
 * - Available simulators via simctl
 * - Currently booted simulators
 * - Available iOS versions
 * - Recommends a suitable simulator
 *
 * @returns Detailed simulator detection result
 */
export async function detectSimulators(): Promise<IOSResult<SimulatorDetectionResult>> {
  logger.info(`${LOG_CONTEXT} Detecting iOS simulators`, LOG_CONTEXT);

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Get all simulators
  const listResult = await listSimulators();

  if (!listResult.success || !listResult.data) {
    issues.push('Unable to list simulators');
    recommendations.push('Ensure Xcode command line tools are installed: xcode-select --install');

    return {
      success: true,
      data: {
        available: false,
        totalCount: 0,
        availableCount: 0,
        bootedCount: 0,
        iosVersions: [],
        bootedSimulators: [],
        simulators: [],
        issues,
        recommendations,
      },
    };
  }

  const allSimulators = listResult.data;
  const availableSimulators = allSimulators.filter((s) => s.isAvailable);
  const bootedSimulators = allSimulators.filter((s) => s.state === 'Booted');

  // Get unique iOS versions
  const iosVersionsSet = new Set<string>();
  for (const sim of availableSimulators) {
    if (sim.iosVersion && sim.iosVersion !== 'unknown') {
      iosVersionsSet.add(sim.iosVersion);
    }
  }
  const iosVersions = Array.from(iosVersionsSet).sort((a, b) => {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const diff = (partsB[i] || 0) - (partsA[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  // Find recommended simulator (prefer newest iPhone Pro)
  let recommendedSimulator: Simulator | undefined;

  // Priority order: iPhone Pro Max > iPhone Pro > iPhone > iPad
  const priorities = [
    /iPhone \d+ Pro Max/i,
    /iPhone \d+ Pro/i,
    /iPhone \d+/i,
    /iPhone SE/i,
    /iPad Pro/i,
    /iPad Air/i,
    /iPad/i,
  ];

  for (const pattern of priorities) {
    // Find simulators matching this pattern with newest iOS version
    const matches = availableSimulators.filter((s) => pattern.test(s.name));
    if (matches.length > 0) {
      // Sort by iOS version (newest first) then by name
      matches.sort((a, b) => {
        const versionCompare = compareVersions(b.iosVersion, a.iosVersion);
        if (versionCompare !== 0) return versionCompare;
        return a.name.localeCompare(b.name);
      });
      recommendedSimulator = matches[0];
      break;
    }
  }

  // Check for issues
  if (availableSimulators.length === 0) {
    issues.push('No iOS simulators are available');
    recommendations.push('Open Xcode and download iOS simulator runtimes via Window > Devices and Simulators');
  } else if (bootedSimulators.length === 0) {
    recommendations.push(`Boot a simulator: xcrun simctl boot "${recommendedSimulator?.name || 'iPhone 15 Pro'}"`);
  }

  // Check iOS version availability
  if (iosVersions.length > 0) {
    const newestVersion = iosVersions[0];
    const versionParts = newestVersion.split('.').map(Number);
    if (versionParts[0] < 16) {
      issues.push(`Newest available iOS version (${newestVersion}) is outdated`);
      recommendations.push('Update Xcode and download newer iOS simulator runtimes');
    }
  }

  const result: SimulatorDetectionResult = {
    available: availableSimulators.length > 0,
    totalCount: allSimulators.length,
    availableCount: availableSimulators.length,
    bootedCount: bootedSimulators.length,
    iosVersions,
    bootedSimulators,
    recommendedSimulator,
    simulators: availableSimulators,
    issues,
    recommendations,
  };

  logger.info(
    `${LOG_CONTEXT} Found ${availableSimulators.length} available simulators, ${bootedSimulators.length} booted`,
    LOG_CONTEXT
  );

  return {
    success: true,
    data: result,
  };
}

// =============================================================================
// Maestro CLI Detection
// =============================================================================

/**
 * Detect Maestro CLI (mobile-dev-inc) installation.
 *
 * Checks:
 * - Maestro CLI binary availability
 * - Version information
 * - Whether it's properly working
 *
 * @returns Detailed Maestro CLI detection result
 */
export async function detectMaestroCli(): Promise<IOSResult<MaestroCliDetectionResult>> {
  logger.info(`${LOG_CONTEXT} Detecting Maestro CLI`, LOG_CONTEXT);

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Use the core detection function
  const detectResult = await detectMaestroCliCore();

  if (!detectResult.success) {
    issues.push('Failed to detect Maestro CLI');
    return {
      success: true,
      data: {
        installed: false,
        isWorking: false,
        installInstructions: 'curl -Ls "https://get.maestro.mobile.dev" | bash',
        issues,
        recommendations: ['Install Maestro CLI: curl -Ls "https://get.maestro.mobile.dev" | bash'],
      },
    };
  }

  const detection = detectResult.data!;

  if (!detection.available) {
    issues.push('Maestro CLI is not installed');
    recommendations.push('Install Maestro CLI: curl -Ls "https://get.maestro.mobile.dev" | bash');

    return {
      success: true,
      data: {
        installed: false,
        isWorking: false,
        installInstructions: detection.installInstructions,
        issues,
        recommendations,
      },
    };
  }

  // Verify it's working
  let isWorking = false;
  if (detection.path) {
    const testResult = await execFileNoThrow(detection.path, ['--help']);
    isWorking = testResult.exitCode === 0;
  }

  // Check version requirements (recommend 1.30.0+)
  if (detection.version) {
    const versionParts = detection.version.split('.').map(Number);
    if (versionParts[0] < 1 || (versionParts[0] === 1 && versionParts[1] < 30)) {
      issues.push(`Maestro CLI version ${detection.version} is outdated`);
      recommendations.push('Update Maestro CLI: maestro update');
    }
  }

  if (!isWorking) {
    issues.push('Maestro CLI is installed but not responding');
    recommendations.push('Try reinstalling Maestro CLI: curl -Ls "https://get.maestro.mobile.dev" | bash');
  }

  const result: MaestroCliDetectionResult = {
    installed: true,
    path: detection.path,
    version: detection.version,
    isWorking,
    issues,
    recommendations,
  };

  logger.info(
    `${LOG_CONTEXT} Maestro CLI ${detection.version} found at ${detection.path}`,
    LOG_CONTEXT
  );

  return {
    success: true,
    data: result,
  };
}

// =============================================================================
// Project Detection
// =============================================================================

/**
 * Detect iOS project type and structure at the given path.
 *
 * Checks:
 * - .xcworkspace files (Xcode workspaces)
 * - .xcodeproj files (Xcode projects)
 * - Package.swift (Swift Package Manager)
 * - Project schemes and targets
 * - XCUITest target presence
 *
 * @param projectPath - Path to check for iOS project
 * @returns Project type detection result
 */
export async function detectProjectType(projectPath: string): Promise<IOSResult<ProjectTypeResult>> {
  logger.info(`${LOG_CONTEXT} Detecting project type at ${projectPath}`, LOG_CONTEXT);

  const issues: string[] = [];
  const recommendations: string[] = [];
  const schemes: ProjectScheme[] = [];
  const targets: string[] = [];

  // Check if path exists
  if (!existsSync(projectPath)) {
    return {
      success: false,
      error: `Path does not exist: ${projectPath}`,
      errorCode: 'COMMAND_FAILED',
    };
  }

  // Look for project files
  let projectType: IOSProjectType = 'unknown';
  let foundProjectPath: string | undefined;
  let projectName: string | undefined;

  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });

    // First priority: .xcworkspace
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.endsWith('.xcworkspace')) {
        // Skip Pods workspace if there's another workspace
        if (entry.name === 'Pods.xcworkspace') continue;

        projectType = 'xcworkspace';
        foundProjectPath = path.join(projectPath, entry.name);
        projectName = entry.name.replace('.xcworkspace', '');
        break;
      }
    }

    // Second priority: .xcodeproj
    if (projectType === 'unknown') {
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.endsWith('.xcodeproj')) {
          projectType = 'xcodeproj';
          foundProjectPath = path.join(projectPath, entry.name);
          projectName = entry.name.replace('.xcodeproj', '');
          break;
        }
      }
    }

    // Third priority: Package.swift (Swift Package Manager)
    if (projectType === 'unknown') {
      for (const entry of entries) {
        if (entry.isFile() && entry.name === 'Package.swift') {
          projectType = 'swift-package';
          foundProjectPath = path.join(projectPath, entry.name);
          // Try to extract package name from Package.swift
          try {
            const packageContent = await fs.readFile(foundProjectPath, 'utf-8');
            const nameMatch = packageContent.match(/name:\s*["']([^"']+)["']/);
            if (nameMatch) {
              projectName = nameMatch[1];
            }
          } catch {
            // Ignore errors reading Package.swift
          }
          break;
        }
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to read directory: ${message}`,
      errorCode: 'COMMAND_FAILED',
    };
  }

  if (projectType === 'unknown') {
    issues.push('No iOS project found in this directory');
    recommendations.push('Navigate to a directory containing an .xcworkspace or .xcodeproj file');

    return {
      success: true,
      data: {
        type: 'unknown',
        found: false,
        schemes,
        targets,
        hasUITestTarget: false,
        issues,
        recommendations,
      },
    };
  }

  // Get schemes and targets using xcodebuild
  let hasUITestTarget = false;
  let uiTestTargetName: string | undefined;
  let bundleId: string | undefined;
  let minimumDeploymentTarget: string | undefined;

  if (projectType !== 'swift-package') {
    // List schemes
    const schemeArgs =
      projectType === 'xcworkspace'
        ? ['-workspace', foundProjectPath!, '-list', '-json']
        : ['-project', foundProjectPath!, '-list', '-json'];

    const schemeResult = await execFileNoThrow('xcodebuild', schemeArgs, projectPath);

    if (schemeResult.exitCode === 0) {
      try {
        const listOutput = JSON.parse(schemeResult.stdout);
        const projectInfo = listOutput.project || listOutput.workspace;

        if (projectInfo?.schemes) {
          for (const schemeName of projectInfo.schemes) {
            const isTest = /tests?$/i.test(schemeName);
            const isUITest = /uitests?$/i.test(schemeName);

            schemes.push({
              name: schemeName,
              isTest: isTest || isUITest,
              isUITest,
            });

            if (isUITest) {
              hasUITestTarget = true;
              uiTestTargetName = schemeName;
            }
          }
        }

        if (projectInfo?.targets) {
          targets.push(...projectInfo.targets);

          // Check for UI test target in targets list
          for (const target of projectInfo.targets) {
            if (/uitests?$/i.test(target)) {
              hasUITestTarget = true;
              uiTestTargetName = uiTestTargetName || target;
            }
          }
        }
      } catch {
        // JSON parse failed, try text parsing
        const schemeMatches = schemeResult.stdout.matchAll(/^\s+(.+)$/gm);
        for (const match of schemeMatches) {
          const schemeName = match[1].trim();
          if (schemeName && !schemeName.includes(':')) {
            const isTest = /tests?$/i.test(schemeName);
            const isUITest = /uitests?$/i.test(schemeName);
            schemes.push({ name: schemeName, isTest: isTest || isUITest, isUITest });
          }
        }
      }
    }

    // Try to get build settings for bundle ID and deployment target
    if (schemes.length > 0) {
      const mainScheme = schemes.find((s) => !s.isTest) || schemes[0];
      const settingsArgs =
        projectType === 'xcworkspace'
          ? ['-workspace', foundProjectPath!, '-scheme', mainScheme.name, '-showBuildSettings']
          : ['-project', foundProjectPath!, '-scheme', mainScheme.name, '-showBuildSettings'];

      const settingsResult = await execFileNoThrow('xcodebuild', settingsArgs, projectPath);

      if (settingsResult.exitCode === 0) {
        // Extract bundle ID
        const bundleIdMatch = settingsResult.stdout.match(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*(.+)/);
        if (bundleIdMatch) {
          bundleId = bundleIdMatch[1].trim();
        }

        // Extract deployment target
        const deploymentMatch = settingsResult.stdout.match(/IPHONEOS_DEPLOYMENT_TARGET\s*=\s*(.+)/);
        if (deploymentMatch) {
          minimumDeploymentTarget = deploymentMatch[1].trim();
        }
      }
    }
  }

  // Add recommendations based on findings
  if (!hasUITestTarget) {
    recommendations.push('Consider adding an XCUITest target for UI automation capabilities');
  }

  if (schemes.length === 0) {
    issues.push('No schemes found in project');
    recommendations.push('Open the project in Xcode to verify it builds correctly');
  }

  const result: ProjectTypeResult = {
    type: projectType,
    found: true,
    projectPath: foundProjectPath,
    projectName,
    bundleId,
    schemes,
    targets,
    hasUITestTarget,
    uiTestTargetName,
    minimumDeploymentTarget,
    issues,
    recommendations,
  };

  logger.info(
    `${LOG_CONTEXT} Found ${projectType} project: ${projectName} with ${schemes.length} schemes`,
    LOG_CONTEXT
  );

  return {
    success: true,
    data: result,
  };
}

// =============================================================================
// Existing Integration Detection
// =============================================================================

/**
 * Detect existing Maestro integration at the given path.
 *
 * Checks:
 * - .maestro configuration directory
 * - ios-config.json file
 * - Maestro flows directory
 * - Baseline images directory
 * - MaestroBridge integration in source files
 *
 * @param projectPath - Path to check for existing integration
 * @returns Existing integration detection result
 */
export async function detectExistingIntegration(
  projectPath: string
): Promise<IOSResult<ExistingIntegrationResult>> {
  logger.info(`${LOG_CONTEXT} Detecting existing integration at ${projectPath}`, LOG_CONTEXT);

  let hasMaestroConfig = false;
  let configPath: string | undefined;
  let hasIosConfig = false;
  let hasFlowsDirectory = false;
  let flowsDirectoryPath: string | undefined;
  let flowFileCount = 0;
  let hasBaselinesDirectory = false;
  let baselinesDirectoryPath: string | undefined;
  let baselineFileCount = 0;
  let hasBridgeIntegration = false;
  let currentConfig: Record<string, unknown> | undefined;

  // Check for .maestro directory
  const maestroConfigPath = path.join(projectPath, '.maestro');
  if (existsSync(maestroConfigPath)) {
    hasMaestroConfig = true;
    configPath = maestroConfigPath;

    // Check for ios-config.json
    const iosConfigPath = path.join(maestroConfigPath, 'ios-config.json');
    if (existsSync(iosConfigPath)) {
      hasIosConfig = true;
      try {
        const configContent = await fs.readFile(iosConfigPath, 'utf-8');
        currentConfig = JSON.parse(configContent);
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Check common locations for Maestro flows
  const flowsLocations = [
    path.join(projectPath, 'maestro'),
    path.join(projectPath, '.maestro', 'flows'),
    path.join(projectPath, 'flows'),
    path.join(projectPath, 'e2e'),
  ];

  for (const flowsPath of flowsLocations) {
    if (existsSync(flowsPath)) {
      try {
        const entries = await fs.readdir(flowsPath);
        const yamlFiles = entries.filter(
          (e) => e.endsWith('.yaml') || e.endsWith('.yml')
        );
        if (yamlFiles.length > 0) {
          hasFlowsDirectory = true;
          flowsDirectoryPath = flowsPath;
          flowFileCount = yamlFiles.length;
          break;
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // Check common locations for baselines
  const baselinesLocations = [
    path.join(projectPath, 'ios-baselines'),
    path.join(projectPath, '.maestro', 'baselines'),
    path.join(projectPath, 'baselines'),
    path.join(projectPath, 'screenshots', 'baselines'),
  ];

  for (const baselinesPath of baselinesLocations) {
    if (existsSync(baselinesPath)) {
      try {
        const entries = await fs.readdir(baselinesPath);
        const imageFiles = entries.filter((e) =>
          /\.(png|jpg|jpeg)$/i.test(e)
        );
        if (imageFiles.length > 0) {
          hasBaselinesDirectory = true;
          baselinesDirectoryPath = baselinesPath;
          baselineFileCount = imageFiles.length;
          break;
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // Check for MaestroBridge integration
  // Look for imports in Swift files
  const swiftExtensions = ['.swift'];
  const bridgeImportPatterns = [
    /import\s+MaestroBridge/,
    /MaestroBridge\./,
    /@testable\s+import\s+MaestroBridge/,
  ];

  try {
    const checkBridgeInDir = async (dirPath: string, depth = 0): Promise<boolean> => {
      if (depth > 3) return false; // Limit recursion depth

      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (
            ['Pods', 'Carthage', 'node_modules', '.build', 'DerivedData'].includes(
              entry.name
            )
          ) {
            continue;
          }
          if (await checkBridgeInDir(fullPath, depth + 1)) {
            return true;
          }
        } else if (entry.isFile() && swiftExtensions.some((ext) => entry.name.endsWith(ext))) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            for (const pattern of bridgeImportPatterns) {
              if (pattern.test(content)) {
                return true;
              }
            }
          } catch {
            // Ignore read errors
          }
        }
      }
      return false;
    };

    hasBridgeIntegration = await checkBridgeInDir(projectPath);
  } catch {
    // Ignore errors
  }

  const hasIntegration =
    hasMaestroConfig || hasIosConfig || hasFlowsDirectory || hasBaselinesDirectory || hasBridgeIntegration;

  const result: ExistingIntegrationResult = {
    hasIntegration,
    hasMaestroConfig,
    configPath,
    hasIosConfig,
    hasFlowsDirectory,
    flowsDirectoryPath,
    flowFileCount,
    hasBaselinesDirectory,
    baselinesDirectoryPath,
    baselineFileCount,
    hasBridgeIntegration,
    currentConfig,
  };

  logger.info(
    `${LOG_CONTEXT} Existing integration: ${hasIntegration ? 'found' : 'none'}`,
    LOG_CONTEXT
  );

  return {
    success: true,
    data: result,
  };
}

// =============================================================================
// Complete Environment Detection
// =============================================================================

/**
 * Perform complete environment detection.
 *
 * Combines all detection functions to provide a comprehensive
 * view of the iOS development environment readiness.
 *
 * @returns Complete environment detection result
 */
export async function detectEnvironment(): Promise<IOSResult<EnvironmentDetectionResult>> {
  logger.info(`${LOG_CONTEXT} Performing complete environment detection`, LOG_CONTEXT);

  // Run all detections in parallel
  const [xcodeResult, simulatorsResult, maestroResult] = await Promise.all([
    detectXcodeInstallation(),
    detectSimulators(),
    detectMaestroCli(),
  ]);

  // Extract data with defaults
  const xcode = xcodeResult.data || {
    installed: false,
    commandLineToolsInstalled: false,
    licenseAccepted: false,
    issues: ['Detection failed'],
    recommendations: [],
  };

  const simulators = simulatorsResult.data || {
    available: false,
    totalCount: 0,
    availableCount: 0,
    bootedCount: 0,
    iosVersions: [],
    bootedSimulators: [],
    simulators: [],
    issues: ['Detection failed'],
    recommendations: [],
  };

  const maestroCli = maestroResult.data || {
    installed: false,
    isWorking: false,
    issues: ['Detection failed'],
    recommendations: [],
  };

  // Combine all issues and recommendations
  const allIssues = [...xcode.issues, ...simulators.issues, ...maestroCli.issues];
  const allRecommendations = [
    ...xcode.recommendations,
    ...simulators.recommendations,
    ...maestroCli.recommendations,
  ];

  // Determine overall readiness
  // Ready if: Xcode installed with CLT, at least one simulator available
  // Maestro CLI is optional
  const ready =
    xcode.installed && xcode.commandLineToolsInstalled && xcode.licenseAccepted && simulators.available;

  const result: EnvironmentDetectionResult = {
    ready,
    xcode,
    simulators,
    maestroCli,
    allIssues,
    allRecommendations,
  };

  logger.info(`${LOG_CONTEXT} Environment ready: ${ready}`, LOG_CONTEXT);

  return {
    success: true,
    data: result,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compare two version strings.
 *
 * @param a - First version string (e.g., "17.5")
 * @param b - Second version string (e.g., "16.4")
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (numA !== numB) {
      return numA - numB;
    }
  }

  return 0;
}
