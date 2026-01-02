/**
 * iOS Tools - Configuration Management
 *
 * Centralized configuration management for iOS development tools.
 * Supports both project-level configuration (.maestro/ios-config.json)
 * and global user settings (~/.maestro/ios-settings.json).
 *
 * Configuration is loaded with precedence:
 * 1. Project config (highest priority)
 * 2. Global user settings
 * 3. Default values (lowest priority)
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import { IOSResult } from './types';
import { logger } from '../utils/logger';

const LOG_CONTEXT = '[iOS-Config]';

// =============================================================================
// Constants
// =============================================================================

/** Current configuration version */
export const CONFIG_VERSION = '1.0.0';

/** Project-level config directory */
export const CONFIG_DIRECTORY = '.maestro';

/** Project-level config filename */
export const PROJECT_CONFIG_FILENAME = 'ios-config.json';

/** Global config directory (in user home) */
export const GLOBAL_CONFIG_DIRECTORY = '.maestro';

/** Global settings filename */
export const GLOBAL_SETTINGS_FILENAME = 'ios-settings.json';

/** Default flows directory */
export const DEFAULT_FLOWS_DIRECTORY = './maestro';

/** Default baselines directory */
export const DEFAULT_BASELINES_DIRECTORY = './ios-baselines';

/** Default MaestroBridge port */
export const DEFAULT_BRIDGE_PORT = 9876;

/** Default screenshot format */
export const DEFAULT_SCREENSHOT_FORMAT = 'png';

/** Default log retention days */
export const DEFAULT_LOG_RETENTION_DAYS = 7;

// =============================================================================
// Types
// =============================================================================

/**
 * Project-level iOS configuration
 * Stored at: <project>/.maestro/ios-config.json
 */
export interface IOSProjectConfig {
  /** Configuration version */
  version: string;
  /** Project settings */
  project: {
    /** Path to .xcworkspace or .xcodeproj */
    path: string;
    /** Selected scheme for building/testing */
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
  /** Baselines configuration */
  baselines: {
    /** Directory path for visual regression baselines */
    directory: string;
  };
  /** Flows configuration */
  flows: {
    /** Directory path for Maestro flows */
    directory: string;
  };
  /** Creation metadata */
  created: {
    /** ISO timestamp when config was created */
    at: string;
    /** Wizard version that created this config */
    wizardVersion: string;
  };
  /** Last modification metadata */
  modified?: {
    /** ISO timestamp of last modification */
    at: string;
    /** What triggered the modification */
    by: string;
  };
}

/**
 * Global iOS settings
 * Stored at: ~/.maestro/ios-settings.json
 */
export interface IOSGlobalSettings {
  /** Settings version */
  version: string;
  /** Default simulator to use across all projects */
  defaultSimulator?: string;
  /** Default simulator UDID */
  defaultSimulatorUdid?: string;
  /** Path to Maestro CLI executable (if custom) */
  maestroCliPath?: string;
  /** Default screenshot format */
  screenshotFormat: 'png' | 'jpg';
  /** Days to retain log files */
  logRetentionDays: number;
  /** Default MaestroBridge port */
  defaultBridgePort: number;
  /** Whether to automatically boot simulator */
  autoBootSimulator: boolean;
  /** Default diff threshold for visual regression (0-1) */
  diffThreshold: number;
  /** Recent projects list */
  recentProjects?: RecentProject[];
  /** Custom flows directory (overrides project-level) */
  customFlowsDirectory?: string;
  /** Custom baselines directory (overrides project-level) */
  customBaselinesDirectory?: string;
  /** Telemetry preferences */
  telemetry: {
    /** Whether to collect anonymous usage stats */
    enabled: boolean;
    /** Last time telemetry was sent */
    lastSent?: string;
  };
}

/**
 * Recent project entry
 */
export interface RecentProject {
  /** Project path */
  path: string;
  /** Project name */
  name: string;
  /** Last accessed timestamp */
  lastAccessed: string;
}

/**
 * Merged configuration (project + global + defaults)
 */
export interface IOSMergedConfig {
  /** Project config (if available) */
  project?: IOSProjectConfig;
  /** Global settings */
  global: IOSGlobalSettings;
  /** Effective values (resolved with precedence) */
  effective: {
    /** Simulator to use */
    simulator: {
      name: string;
      udid?: string;
    };
    /** Flows directory */
    flowsDirectory: string;
    /** Baselines directory */
    baselinesDirectory: string;
    /** Bridge port */
    bridgePort: number;
    /** Screenshot format */
    screenshotFormat: 'png' | 'jpg';
    /** Diff threshold */
    diffThreshold: number;
  };
  /** Configuration source info */
  sources: {
    /** Path to project config (if loaded) */
    projectConfigPath?: string;
    /** Path to global settings */
    globalSettingsPath: string;
    /** Whether project config was found */
    hasProjectConfig: boolean;
    /** Whether global settings exist */
    hasGlobalSettings: boolean;
  };
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Suggested fixes */
  suggestions: string[];
}

// =============================================================================
// Default Values
// =============================================================================

/**
 * Default global settings
 */
export function getDefaultGlobalSettings(): IOSGlobalSettings {
  return {
    version: CONFIG_VERSION,
    screenshotFormat: DEFAULT_SCREENSHOT_FORMAT,
    logRetentionDays: DEFAULT_LOG_RETENTION_DAYS,
    defaultBridgePort: DEFAULT_BRIDGE_PORT,
    autoBootSimulator: true,
    diffThreshold: 0.1,
    telemetry: {
      enabled: false,
    },
  };
}

/**
 * Default project configuration
 */
export function getDefaultProjectConfig(projectPath: string): IOSProjectConfig {
  return {
    version: CONFIG_VERSION,
    project: {
      path: projectPath,
      scheme: '',
      type: 'xcodeproj',
    },
    simulator: {
      default: 'iPhone 15 Pro',
      udid: '',
    },
    xcuitest: {
      enabled: false,
    },
    bridge: {
      enabled: false,
      port: DEFAULT_BRIDGE_PORT,
    },
    baselines: {
      directory: DEFAULT_BASELINES_DIRECTORY,
    },
    flows: {
      directory: DEFAULT_FLOWS_DIRECTORY,
    },
    created: {
      at: new Date().toISOString(),
      wizardVersion: CONFIG_VERSION,
    },
  };
}

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Get the path to the global settings directory
 */
export function getGlobalConfigDirectory(): string {
  return path.join(os.homedir(), GLOBAL_CONFIG_DIRECTORY);
}

/**
 * Get the path to the global settings file
 */
export function getGlobalSettingsPath(): string {
  return path.join(getGlobalConfigDirectory(), GLOBAL_SETTINGS_FILENAME);
}

/**
 * Get the path to the project config directory
 */
export function getProjectConfigDirectory(projectPath: string): string {
  return path.join(projectPath, CONFIG_DIRECTORY);
}

/**
 * Get the path to the project config file
 */
export function getProjectConfigPath(projectPath: string): string {
  return path.join(getProjectConfigDirectory(projectPath), PROJECT_CONFIG_FILENAME);
}

// =============================================================================
// Global Settings Operations
// =============================================================================

/**
 * Check if global settings exist
 */
export function hasGlobalSettings(): boolean {
  return existsSync(getGlobalSettingsPath());
}

/**
 * Load global settings
 */
export async function loadGlobalSettings(): Promise<IOSResult<IOSGlobalSettings>> {
  const settingsPath = getGlobalSettingsPath();

  if (!existsSync(settingsPath)) {
    logger.info(`${LOG_CONTEXT} Global settings not found, using defaults`, LOG_CONTEXT);
    return {
      success: true,
      data: getDefaultGlobalSettings(),
    };
  }

  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content) as IOSGlobalSettings;

    // Merge with defaults to ensure all fields exist
    const mergedSettings = {
      ...getDefaultGlobalSettings(),
      ...settings,
      telemetry: {
        ...getDefaultGlobalSettings().telemetry,
        ...settings.telemetry,
      },
    };

    logger.info(`${LOG_CONTEXT} Loaded global settings from ${settingsPath}`, LOG_CONTEXT);
    return {
      success: true,
      data: mergedSettings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`${LOG_CONTEXT} Failed to load global settings: ${message}`, LOG_CONTEXT);
    return {
      success: false,
      error: `Failed to load global settings: ${message}`,
      errorCode: 'PARSE_ERROR',
    };
  }
}

/**
 * Save global settings
 */
export async function saveGlobalSettings(settings: IOSGlobalSettings): Promise<IOSResult<string>> {
  logger.info(`${LOG_CONTEXT} Saving global settings`, LOG_CONTEXT);

  try {
    const configDir = getGlobalConfigDirectory();
    const settingsPath = getGlobalSettingsPath();

    // Ensure directory exists
    if (!existsSync(configDir)) {
      await fs.mkdir(configDir, { recursive: true });
    }

    // Update version
    settings.version = CONFIG_VERSION;

    // Write settings file
    const content = JSON.stringify(settings, null, 2);
    await fs.writeFile(settingsPath, content, 'utf-8');

    logger.info(`${LOG_CONTEXT} Global settings saved to ${settingsPath}`, LOG_CONTEXT);
    return {
      success: true,
      data: settingsPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`${LOG_CONTEXT} Failed to save global settings: ${message}`, LOG_CONTEXT);
    return {
      success: false,
      error: `Failed to save global settings: ${message}`,
      errorCode: 'COMMAND_FAILED',
    };
  }
}

/**
 * Update specific global settings fields
 */
export async function updateGlobalSettings(
  updates: Partial<IOSGlobalSettings>
): Promise<IOSResult<IOSGlobalSettings>> {
  const loadResult = await loadGlobalSettings();
  if (!loadResult.success || !loadResult.data) {
    return {
      success: false,
      error: loadResult.error || 'Failed to load existing settings',
      errorCode: 'COMMAND_FAILED',
    };
  }

  const updatedSettings: IOSGlobalSettings = {
    ...loadResult.data,
    ...updates,
    telemetry: {
      ...loadResult.data.telemetry,
      ...updates.telemetry,
    },
  };

  const saveResult = await saveGlobalSettings(updatedSettings);
  if (!saveResult.success) {
    return {
      success: false,
      error: saveResult.error,
      errorCode: 'COMMAND_FAILED',
    };
  }

  return {
    success: true,
    data: updatedSettings,
  };
}

// =============================================================================
// Project Config Operations
// =============================================================================

/**
 * Check if project config exists
 */
export function hasProjectConfig(projectPath: string): boolean {
  return existsSync(getProjectConfigPath(projectPath));
}

/**
 * Load project configuration
 */
export async function loadProjectConfig(projectPath: string): Promise<IOSResult<IOSProjectConfig>> {
  const configPath = getProjectConfigPath(projectPath);

  if (!existsSync(configPath)) {
    return {
      success: false,
      error: 'Project configuration not found',
      errorCode: 'COMMAND_FAILED',
    };
  }

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as IOSProjectConfig;

    logger.info(`${LOG_CONTEXT} Loaded project config from ${configPath}`, LOG_CONTEXT);
    return {
      success: true,
      data: config,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`${LOG_CONTEXT} Failed to load project config: ${message}`, LOG_CONTEXT);
    return {
      success: false,
      error: `Failed to load project configuration: ${message}`,
      errorCode: 'PARSE_ERROR',
    };
  }
}

/**
 * Save project configuration
 */
export async function saveProjectConfig(
  projectPath: string,
  config: IOSProjectConfig
): Promise<IOSResult<string>> {
  logger.info(`${LOG_CONTEXT} Saving project config`, LOG_CONTEXT);

  try {
    const configDir = getProjectConfigDirectory(projectPath);
    const configPath = getProjectConfigPath(projectPath);

    // Ensure directory exists
    if (!existsSync(configDir)) {
      await fs.mkdir(configDir, { recursive: true });
    }

    // Update modification timestamp
    config.modified = {
      at: new Date().toISOString(),
      by: 'config-manager',
    };

    // Write config file
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(configPath, content, 'utf-8');

    logger.info(`${LOG_CONTEXT} Project config saved to ${configPath}`, LOG_CONTEXT);
    return {
      success: true,
      data: configPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`${LOG_CONTEXT} Failed to save project config: ${message}`, LOG_CONTEXT);
    return {
      success: false,
      error: `Failed to save project configuration: ${message}`,
      errorCode: 'COMMAND_FAILED',
    };
  }
}

/**
 * Update specific project configuration fields
 */
export async function updateProjectConfig(
  projectPath: string,
  updates: Partial<IOSProjectConfig>
): Promise<IOSResult<IOSProjectConfig>> {
  const loadResult = await loadProjectConfig(projectPath);
  if (!loadResult.success || !loadResult.data) {
    return {
      success: false,
      error: loadResult.error || 'Failed to load existing configuration',
      errorCode: 'COMMAND_FAILED',
    };
  }

  const existingConfig = loadResult.data;
  const updatedConfig: IOSProjectConfig = {
    ...existingConfig,
    ...updates,
    project: {
      ...existingConfig.project,
      ...updates.project,
    },
    simulator: {
      ...existingConfig.simulator,
      ...updates.simulator,
    },
    xcuitest: {
      ...existingConfig.xcuitest,
      ...updates.xcuitest,
    },
    bridge: {
      ...existingConfig.bridge,
      ...updates.bridge,
    },
    baselines: {
      ...existingConfig.baselines,
      ...updates.baselines,
    },
    flows: {
      ...existingConfig.flows,
      ...updates.flows,
    },
    created: existingConfig.created, // Preserve original creation time
  };

  const saveResult = await saveProjectConfig(projectPath, updatedConfig);
  if (!saveResult.success) {
    return {
      success: false,
      error: saveResult.error,
      errorCode: 'COMMAND_FAILED',
    };
  }

  return {
    success: true,
    data: updatedConfig,
  };
}

/**
 * Delete project configuration
 */
export async function deleteProjectConfig(projectPath: string): Promise<IOSResult<void>> {
  const configPath = getProjectConfigPath(projectPath);

  if (!existsSync(configPath)) {
    return {
      success: true, // Already doesn't exist
    };
  }

  try {
    await fs.unlink(configPath);
    logger.info(`${LOG_CONTEXT} Deleted project config at ${configPath}`, LOG_CONTEXT);
    return {
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`${LOG_CONTEXT} Failed to delete project config: ${message}`, LOG_CONTEXT);
    return {
      success: false,
      error: `Failed to delete project configuration: ${message}`,
      errorCode: 'COMMAND_FAILED',
    };
  }
}

// =============================================================================
// Merged Configuration
// =============================================================================

/**
 * Load and merge both project and global configurations
 */
export async function loadMergedConfig(projectPath: string): Promise<IOSResult<IOSMergedConfig>> {
  logger.info(`${LOG_CONTEXT} Loading merged config for ${projectPath}`, LOG_CONTEXT);

  // Load global settings (always succeeds with defaults)
  const globalResult = await loadGlobalSettings();
  const globalSettings = globalResult.data!;

  // Try to load project config
  const projectResult = await loadProjectConfig(projectPath);
  const projectConfig = projectResult.success ? projectResult.data : undefined;

  // Compute effective values with precedence
  const effective = {
    simulator: {
      name: projectConfig?.simulator.default || globalSettings.defaultSimulator || 'iPhone 15 Pro',
      udid: projectConfig?.simulator.udid || globalSettings.defaultSimulatorUdid,
    },
    flowsDirectory: globalSettings.customFlowsDirectory ||
      projectConfig?.flows.directory ||
      DEFAULT_FLOWS_DIRECTORY,
    baselinesDirectory: globalSettings.customBaselinesDirectory ||
      projectConfig?.baselines.directory ||
      DEFAULT_BASELINES_DIRECTORY,
    bridgePort: projectConfig?.bridge.port || globalSettings.defaultBridgePort,
    screenshotFormat: globalSettings.screenshotFormat,
    diffThreshold: globalSettings.diffThreshold,
  };

  const mergedConfig: IOSMergedConfig = {
    project: projectConfig,
    global: globalSettings,
    effective,
    sources: {
      projectConfigPath: projectConfig ? getProjectConfigPath(projectPath) : undefined,
      globalSettingsPath: getGlobalSettingsPath(),
      hasProjectConfig: !!projectConfig,
      hasGlobalSettings: hasGlobalSettings(),
    },
  };

  return {
    success: true,
    data: mergedConfig,
  };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate project configuration
 */
export function validateProjectConfig(config: IOSProjectConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Required fields
  if (!config.version) {
    errors.push('Missing configuration version');
  }

  if (!config.project?.path) {
    errors.push('Missing project path');
  }

  if (!config.project?.scheme) {
    warnings.push('No scheme specified - will need to be selected when building');
    suggestions.push('Run /ios.setup to configure the project scheme');
  }

  // Simulator validation
  if (!config.simulator?.default) {
    warnings.push('No default simulator configured');
    suggestions.push('Set a default simulator for consistent testing');
  }

  if (config.simulator?.default && !config.simulator?.udid) {
    warnings.push('Simulator UDID not set - may need to be resolved at runtime');
  }

  // Bridge port validation
  if (config.bridge?.enabled) {
    if (!config.bridge.port || config.bridge.port < 1024 || config.bridge.port > 65535) {
      warnings.push('Invalid bridge port - should be between 1024 and 65535');
      suggestions.push(`Using default port ${DEFAULT_BRIDGE_PORT}`);
    }
  }

  // Directory validation
  if (config.baselines?.directory && !config.baselines.directory.startsWith('./') && !config.baselines.directory.startsWith('/')) {
    warnings.push('Baselines directory should be a relative (./path) or absolute (/path) path');
  }

  if (config.flows?.directory && !config.flows.directory.startsWith('./') && !config.flows.directory.startsWith('/')) {
    warnings.push('Flows directory should be a relative (./path) or absolute (/path) path');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate global settings
 */
export function validateGlobalSettings(settings: IOSGlobalSettings): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Version check
  if (!settings.version) {
    errors.push('Missing settings version');
  }

  // Screenshot format
  if (settings.screenshotFormat && !['png', 'jpg'].includes(settings.screenshotFormat)) {
    errors.push('Invalid screenshot format - must be "png" or "jpg"');
  }

  // Log retention
  if (settings.logRetentionDays !== undefined) {
    if (settings.logRetentionDays < 1) {
      warnings.push('Log retention days should be at least 1');
    }
    if (settings.logRetentionDays > 365) {
      warnings.push('Log retention days exceeds 1 year - consider a smaller value');
    }
  }

  // Diff threshold
  if (settings.diffThreshold !== undefined) {
    if (settings.diffThreshold < 0 || settings.diffThreshold > 1) {
      errors.push('Diff threshold must be between 0 and 1');
    }
    if (settings.diffThreshold > 0.5) {
      warnings.push('Diff threshold is very high - may miss visual regressions');
    }
  }

  // Bridge port
  if (settings.defaultBridgePort !== undefined) {
    if (settings.defaultBridgePort < 1024 || settings.defaultBridgePort > 65535) {
      warnings.push('Default bridge port should be between 1024 and 65535');
    }
  }

  // Maestro CLI path
  if (settings.maestroCliPath && !existsSync(settings.maestroCliPath)) {
    warnings.push(`Maestro CLI path does not exist: ${settings.maestroCliPath}`);
    suggestions.push('Update maestroCliPath or remove to use auto-detection');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

// =============================================================================
// Recent Projects
// =============================================================================

/**
 * Add a project to the recent projects list
 */
export async function addRecentProject(
  projectPath: string,
  projectName: string
): Promise<IOSResult<void>> {
  const loadResult = await loadGlobalSettings();
  if (!loadResult.success || !loadResult.data) {
    return {
      success: false,
      error: 'Failed to load global settings',
      errorCode: 'COMMAND_FAILED',
    };
  }

  const settings = loadResult.data;
  const recentProjects = settings.recentProjects || [];

  // Remove existing entry if present
  const filtered = recentProjects.filter((p) => p.path !== projectPath);

  // Add to front of list
  const newEntry: RecentProject = {
    path: projectPath,
    name: projectName,
    lastAccessed: new Date().toISOString(),
  };

  // Keep only last 10 projects
  const updated = [newEntry, ...filtered].slice(0, 10);

  const saveResult = await updateGlobalSettings({ recentProjects: updated });
  if (!saveResult.success) {
    return {
      success: false,
      error: saveResult.error,
      errorCode: 'COMMAND_FAILED',
    };
  }

  return { success: true };
}

/**
 * Get recent projects list
 */
export async function getRecentProjects(): Promise<IOSResult<RecentProject[]>> {
  const loadResult = await loadGlobalSettings();
  if (!loadResult.success || !loadResult.data) {
    return {
      success: false,
      error: 'Failed to load global settings',
      errorCode: 'COMMAND_FAILED',
    };
  }

  return {
    success: true,
    data: loadResult.data.recentProjects || [],
  };
}

/**
 * Clear recent projects list
 */
export async function clearRecentProjects(): Promise<IOSResult<void>> {
  const saveResult = await updateGlobalSettings({ recentProjects: [] });
  if (!saveResult.success) {
    return {
      success: false,
      error: saveResult.error,
      errorCode: 'COMMAND_FAILED',
    };
  }

  return { success: true };
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize global settings if they don't exist
 */
export async function initializeGlobalSettings(): Promise<IOSResult<IOSGlobalSettings>> {
  if (hasGlobalSettings()) {
    return loadGlobalSettings();
  }

  const defaultSettings = getDefaultGlobalSettings();
  const saveResult = await saveGlobalSettings(defaultSettings);

  if (!saveResult.success) {
    return {
      success: false,
      error: saveResult.error,
      errorCode: 'COMMAND_FAILED',
    };
  }

  return {
    success: true,
    data: defaultSettings,
  };
}

/**
 * Initialize project configuration with detected values
 */
export async function initializeProjectConfig(
  projectPath: string,
  options?: {
    projectFile?: string;
    scheme?: string;
    bundleId?: string;
    simulator?: { name: string; udid: string };
  }
): Promise<IOSResult<IOSProjectConfig>> {
  // Start with defaults
  const config = getDefaultProjectConfig(projectPath);

  // Apply provided options
  if (options?.projectFile) {
    config.project.path = options.projectFile;
    // Detect type from extension
    if (options.projectFile.endsWith('.xcworkspace')) {
      config.project.type = 'xcworkspace';
    } else if (options.projectFile.endsWith('.xcodeproj')) {
      config.project.type = 'xcodeproj';
    } else if (options.projectFile.includes('Package.swift')) {
      config.project.type = 'swift-package';
    }
  }

  if (options?.scheme) {
    config.project.scheme = options.scheme;
  }

  if (options?.bundleId) {
    config.project.bundleId = options.bundleId;
  }

  if (options?.simulator) {
    config.simulator.default = options.simulator.name;
    config.simulator.udid = options.simulator.udid;
  }

  const saveResult = await saveProjectConfig(projectPath, config);
  if (!saveResult.success) {
    return {
      success: false,
      error: saveResult.error,
      errorCode: 'COMMAND_FAILED',
    };
  }

  return {
    success: true,
    data: config,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Resolve a relative path against the project root
 */
export function resolveProjectPath(projectPath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  // Handle ./ prefix
  const cleanPath = relativePath.startsWith('./') ? relativePath.slice(2) : relativePath;
  return path.join(projectPath, cleanPath);
}

/**
 * Get the effective flows directory for a project
 */
export async function getEffectiveFlowsDirectory(projectPath: string): Promise<string> {
  const mergedResult = await loadMergedConfig(projectPath);
  if (mergedResult.success && mergedResult.data) {
    return resolveProjectPath(projectPath, mergedResult.data.effective.flowsDirectory);
  }
  return resolveProjectPath(projectPath, DEFAULT_FLOWS_DIRECTORY);
}

/**
 * Get the effective baselines directory for a project
 */
export async function getEffectiveBaselinesDirectory(projectPath: string): Promise<string> {
  const mergedResult = await loadMergedConfig(projectPath);
  if (mergedResult.success && mergedResult.data) {
    return resolveProjectPath(projectPath, mergedResult.data.effective.baselinesDirectory);
  }
  return resolveProjectPath(projectPath, DEFAULT_BASELINES_DIRECTORY);
}

/**
 * Format configuration for display
 */
export function formatConfig(config: IOSProjectConfig | IOSGlobalSettings): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Format merged configuration summary
 */
export function formatMergedConfigSummary(merged: IOSMergedConfig): string {
  const lines: string[] = [];

  lines.push('iOS Configuration Summary');
  lines.push('='.repeat(50));

  lines.push('');
  lines.push('Sources:');
  lines.push(`  Project config: ${merged.sources.hasProjectConfig ? merged.sources.projectConfigPath : 'Not found'}`);
  lines.push(`  Global settings: ${merged.sources.hasGlobalSettings ? merged.sources.globalSettingsPath : 'Using defaults'}`);

  lines.push('');
  lines.push('Effective Configuration:');
  lines.push(`  Simulator: ${merged.effective.simulator.name}`);
  if (merged.effective.simulator.udid) {
    lines.push(`  Simulator UDID: ${merged.effective.simulator.udid}`);
  }
  lines.push(`  Flows directory: ${merged.effective.flowsDirectory}`);
  lines.push(`  Baselines directory: ${merged.effective.baselinesDirectory}`);
  lines.push(`  Bridge port: ${merged.effective.bridgePort}`);
  lines.push(`  Screenshot format: ${merged.effective.screenshotFormat}`);
  lines.push(`  Diff threshold: ${merged.effective.diffThreshold}`);

  if (merged.project) {
    lines.push('');
    lines.push('Project Configuration:');
    lines.push(`  Project: ${merged.project.project.path}`);
    lines.push(`  Scheme: ${merged.project.project.scheme || '(not set)'}`);
    lines.push(`  Bundle ID: ${merged.project.project.bundleId || '(not set)'}`);
    lines.push(`  XCUITest: ${merged.project.xcuitest.enabled ? 'Enabled' : 'Disabled'}`);
    lines.push(`  MaestroBridge: ${merged.project.bridge.enabled ? `Enabled (port ${merged.project.bridge.port})` : 'Disabled'}`);
  }

  return lines.join('\n');
}
