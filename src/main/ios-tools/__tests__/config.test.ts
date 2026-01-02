/**
 * Tests for iOS configuration management module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import {
  // Constants
  CONFIG_VERSION,
  CONFIG_DIRECTORY,
  PROJECT_CONFIG_FILENAME,
  GLOBAL_CONFIG_DIRECTORY,
  GLOBAL_SETTINGS_FILENAME,
  DEFAULT_FLOWS_DIRECTORY,
  DEFAULT_BASELINES_DIRECTORY,
  DEFAULT_BRIDGE_PORT,
  DEFAULT_SCREENSHOT_FORMAT,
  DEFAULT_LOG_RETENTION_DAYS,
  // Types
  IOSProjectConfig,
  IOSGlobalSettings,
  ConfigValidationResult,
  RecentProject,
  // Default value functions
  getDefaultGlobalSettings,
  getDefaultProjectConfig,
  // Path utilities
  getGlobalConfigDirectory,
  getGlobalSettingsPath,
  getProjectConfigDirectory,
  getProjectConfigPath,
  // Global settings operations
  loadGlobalSettings,
  // Project config operations
  hasProjectConfig,
  loadProjectConfig,
  saveProjectConfig,
  updateProjectConfig,
  deleteProjectConfig,
  // Merged config
  loadMergedConfig,
  // Validation
  validateProjectConfig,
  validateGlobalSettings,
  // Initialization
  initializeProjectConfig,
  // Utility functions
  resolveProjectPath,
  getEffectiveFlowsDirectory,
  getEffectiveBaselinesDirectory,
  formatConfig,
  formatMergedConfigSummary,
} from '../config';

// Test utilities
const TEST_PROJECT_PATH = '/tmp/maestro-config-test-project';
const TEST_GLOBAL_PATH = '/tmp/maestro-config-test-global';

// Mock setup
beforeAll(async () => {
  // Create test directories
  await fs.mkdir(TEST_PROJECT_PATH, { recursive: true });
  await fs.mkdir(TEST_GLOBAL_PATH, { recursive: true });
});

afterAll(async () => {
  // Cleanup test directories
  try {
    await fs.rm(TEST_PROJECT_PATH, { recursive: true, force: true });
    await fs.rm(TEST_GLOBAL_PATH, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

beforeEach(async () => {
  // Clean up project config directory before each test
  const configDir = path.join(TEST_PROJECT_PATH, CONFIG_DIRECTORY);
  try {
    await fs.rm(configDir, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('Constants', () => {
  it('should have correct config version', () => {
    expect(CONFIG_VERSION).toBe('1.0.0');
  });

  it('should have correct directory names', () => {
    expect(CONFIG_DIRECTORY).toBe('.maestro');
    expect(GLOBAL_CONFIG_DIRECTORY).toBe('.maestro');
  });

  it('should have correct filenames', () => {
    expect(PROJECT_CONFIG_FILENAME).toBe('ios-config.json');
    expect(GLOBAL_SETTINGS_FILENAME).toBe('ios-settings.json');
  });

  it('should have correct default values', () => {
    expect(DEFAULT_FLOWS_DIRECTORY).toBe('./maestro');
    expect(DEFAULT_BASELINES_DIRECTORY).toBe('./ios-baselines');
    expect(DEFAULT_BRIDGE_PORT).toBe(9876);
    expect(DEFAULT_SCREENSHOT_FORMAT).toBe('png');
    expect(DEFAULT_LOG_RETENTION_DAYS).toBe(7);
  });
});

// =============================================================================
// Default Values Tests
// =============================================================================

describe('getDefaultGlobalSettings', () => {
  it('should return default global settings', () => {
    const settings = getDefaultGlobalSettings();

    expect(settings.version).toBe(CONFIG_VERSION);
    expect(settings.screenshotFormat).toBe('png');
    expect(settings.logRetentionDays).toBe(7);
    expect(settings.defaultBridgePort).toBe(9876);
    expect(settings.autoBootSimulator).toBe(true);
    expect(settings.diffThreshold).toBe(0.1);
    expect(settings.telemetry.enabled).toBe(false);
  });

  it('should return a new object each time', () => {
    const settings1 = getDefaultGlobalSettings();
    const settings2 = getDefaultGlobalSettings();

    expect(settings1).not.toBe(settings2);
    expect(settings1).toEqual(settings2);
  });
});

describe('getDefaultProjectConfig', () => {
  it('should return default project config with path', () => {
    const config = getDefaultProjectConfig('/path/to/project');

    expect(config.version).toBe(CONFIG_VERSION);
    expect(config.project.path).toBe('/path/to/project');
    expect(config.project.scheme).toBe('');
    expect(config.project.type).toBe('xcodeproj');
    expect(config.simulator.default).toBe('iPhone 15 Pro');
    expect(config.xcuitest.enabled).toBe(false);
    expect(config.bridge.enabled).toBe(false);
    expect(config.bridge.port).toBe(DEFAULT_BRIDGE_PORT);
    expect(config.baselines.directory).toBe(DEFAULT_BASELINES_DIRECTORY);
    expect(config.flows.directory).toBe(DEFAULT_FLOWS_DIRECTORY);
  });

  it('should include creation timestamp', () => {
    const before = new Date().toISOString();
    const config = getDefaultProjectConfig('/path');
    const after = new Date().toISOString();

    expect(config.created.at).toBeDefined();
    expect(config.created.at >= before).toBe(true);
    expect(config.created.at <= after).toBe(true);
    expect(config.created.wizardVersion).toBe(CONFIG_VERSION);
  });
});

// =============================================================================
// Path Utilities Tests
// =============================================================================

describe('Path Utilities', () => {
  describe('getGlobalConfigDirectory', () => {
    it('should return home directory with .maestro', () => {
      const dir = getGlobalConfigDirectory();
      expect(dir).toBe(path.join(os.homedir(), '.maestro'));
    });
  });

  describe('getGlobalSettingsPath', () => {
    it('should return full path to global settings', () => {
      const settingsPath = getGlobalSettingsPath();
      expect(settingsPath).toBe(
        path.join(os.homedir(), '.maestro', 'ios-settings.json')
      );
    });
  });

  describe('getProjectConfigDirectory', () => {
    it('should return project path with .maestro', () => {
      const dir = getProjectConfigDirectory('/my/project');
      expect(dir).toBe('/my/project/.maestro');
    });
  });

  describe('getProjectConfigPath', () => {
    it('should return full path to project config', () => {
      const configPath = getProjectConfigPath('/my/project');
      expect(configPath).toBe('/my/project/.maestro/ios-config.json');
    });
  });

  describe('resolveProjectPath', () => {
    it('should resolve relative paths', () => {
      const resolved = resolveProjectPath('/project', './maestro');
      expect(resolved).toBe('/project/maestro');
    });

    it('should handle paths without ./ prefix', () => {
      const resolved = resolveProjectPath('/project', 'baselines');
      expect(resolved).toBe('/project/baselines');
    });

    it('should return absolute paths unchanged', () => {
      const resolved = resolveProjectPath('/project', '/absolute/path');
      expect(resolved).toBe('/absolute/path');
    });
  });
});

// =============================================================================
// Project Config Operations Tests
// =============================================================================

describe('Project Config Operations', () => {
  describe('hasProjectConfig', () => {
    it('should return false when config does not exist', () => {
      expect(hasProjectConfig(TEST_PROJECT_PATH)).toBe(false);
    });

    it('should return true when config exists', async () => {
      // Create config directory and file
      const configDir = getProjectConfigDirectory(TEST_PROJECT_PATH);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        getProjectConfigPath(TEST_PROJECT_PATH),
        JSON.stringify(getDefaultProjectConfig(TEST_PROJECT_PATH))
      );

      expect(hasProjectConfig(TEST_PROJECT_PATH)).toBe(true);
    });
  });

  describe('saveProjectConfig', () => {
    it('should create config directory and save file', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.project.scheme = 'TestScheme';

      const result = await saveProjectConfig(TEST_PROJECT_PATH, config);

      expect(result.success).toBe(true);
      expect(result.data).toBe(getProjectConfigPath(TEST_PROJECT_PATH));
      expect(existsSync(getProjectConfigPath(TEST_PROJECT_PATH))).toBe(true);
    });

    it('should add modification timestamp', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);

      await saveProjectConfig(TEST_PROJECT_PATH, config);

      const loadedResult = await loadProjectConfig(TEST_PROJECT_PATH);
      expect(loadedResult.data?.modified).toBeDefined();
      expect(loadedResult.data?.modified?.by).toBe('config-manager');
    });

    it('should write valid JSON', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.project.bundleId = 'com.test.app';

      await saveProjectConfig(TEST_PROJECT_PATH, config);

      const content = await fs.readFile(
        getProjectConfigPath(TEST_PROJECT_PATH),
        'utf-8'
      );
      const parsed = JSON.parse(content);
      expect(parsed.project.bundleId).toBe('com.test.app');
    });
  });

  describe('loadProjectConfig', () => {
    it('should return error when config does not exist', async () => {
      const result = await loadProjectConfig('/nonexistent/path');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should load existing config', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.project.scheme = 'MyScheme';
      config.project.bundleId = 'com.my.app';

      await saveProjectConfig(TEST_PROJECT_PATH, config);
      const result = await loadProjectConfig(TEST_PROJECT_PATH);

      expect(result.success).toBe(true);
      expect(result.data?.project.scheme).toBe('MyScheme');
      expect(result.data?.project.bundleId).toBe('com.my.app');
    });

    it('should handle invalid JSON', async () => {
      const configDir = getProjectConfigDirectory(TEST_PROJECT_PATH);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        getProjectConfigPath(TEST_PROJECT_PATH),
        'not valid json {'
      );

      const result = await loadProjectConfig(TEST_PROJECT_PATH);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PARSE_ERROR');
    });
  });

  describe('updateProjectConfig', () => {
    it('should update specific fields', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      await saveProjectConfig(TEST_PROJECT_PATH, config);

      const result = await updateProjectConfig(TEST_PROJECT_PATH, {
        project: { path: TEST_PROJECT_PATH, scheme: 'UpdatedScheme', type: 'xcworkspace' },
      });

      expect(result.success).toBe(true);
      expect(result.data?.project.scheme).toBe('UpdatedScheme');
      expect(result.data?.project.type).toBe('xcworkspace');
    });

    it('should preserve original creation time', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      const originalCreatedAt = config.created.at;
      await saveProjectConfig(TEST_PROJECT_PATH, config);

      // Wait a bit to ensure timestamps differ
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await updateProjectConfig(TEST_PROJECT_PATH, {
        xcuitest: { enabled: true },
      });

      expect(result.data?.created.at).toBe(originalCreatedAt);
    });

    it('should return error if config does not exist', async () => {
      const result = await updateProjectConfig('/nonexistent', {
        xcuitest: { enabled: true },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('deleteProjectConfig', () => {
    it('should delete existing config', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      await saveProjectConfig(TEST_PROJECT_PATH, config);
      expect(hasProjectConfig(TEST_PROJECT_PATH)).toBe(true);

      const result = await deleteProjectConfig(TEST_PROJECT_PATH);

      expect(result.success).toBe(true);
      expect(hasProjectConfig(TEST_PROJECT_PATH)).toBe(false);
    });

    it('should succeed if config does not exist', async () => {
      const result = await deleteProjectConfig(TEST_PROJECT_PATH);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Global Settings Operations Tests
// =============================================================================

describe('Global Settings Operations', () => {
  describe('loadGlobalSettings', () => {
    it('should return defaults when file does not exist', async () => {
      // This test uses the real home directory path
      // Just verify defaults are returned when no file exists
      const result = await loadGlobalSettings();

      expect(result.success).toBe(true);
      expect(result.data?.screenshotFormat).toBe('png');
      expect(result.data?.diffThreshold).toBe(0.1);
    });
  });
});

// =============================================================================
// Validation Tests
// =============================================================================

describe('Validation', () => {
  describe('validateProjectConfig', () => {
    it('should pass valid configuration', () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.project.scheme = 'TestScheme';

      const result = validateProjectConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on missing version', () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      (config as { version?: string }).version = undefined as unknown as string;

      const result = validateProjectConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing configuration version');
    });

    it('should error on missing project path', () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.project.path = '';

      const result = validateProjectConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing project path');
    });

    it('should warn on missing scheme', () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);

      const result = validateProjectConfig(config);

      expect(result.warnings.some((w) => w.includes('scheme'))).toBe(true);
    });

    it('should warn on missing simulator', () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.simulator.default = '';

      const result = validateProjectConfig(config);

      expect(result.warnings.some((w) => w.includes('simulator'))).toBe(true);
    });

    it('should warn on invalid bridge port', () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.bridge.enabled = true;
      config.bridge.port = 80; // Below 1024

      const result = validateProjectConfig(config);

      expect(result.warnings.some((w) => w.includes('bridge port'))).toBe(true);
    });

    it('should warn on relative paths without ./ prefix', () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.baselines.directory = 'baselines';

      const result = validateProjectConfig(config);

      expect(result.warnings.some((w) => w.includes('relative'))).toBe(true);
    });
  });

  describe('validateGlobalSettings', () => {
    it('should pass valid settings', () => {
      const settings = getDefaultGlobalSettings();

      const result = validateGlobalSettings(settings);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on missing version', () => {
      const settings = getDefaultGlobalSettings();
      (settings as { version?: string }).version = undefined as unknown as string;

      const result = validateGlobalSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing settings version');
    });

    it('should error on invalid screenshot format', () => {
      const settings = getDefaultGlobalSettings();
      (settings.screenshotFormat as string) = 'gif';

      const result = validateGlobalSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('screenshot format'))).toBe(true);
    });

    it('should warn on very low log retention', () => {
      const settings = getDefaultGlobalSettings();
      settings.logRetentionDays = 0;

      const result = validateGlobalSettings(settings);

      expect(result.warnings.some((w) => w.includes('retention'))).toBe(true);
    });

    it('should warn on very high log retention', () => {
      const settings = getDefaultGlobalSettings();
      settings.logRetentionDays = 500;

      const result = validateGlobalSettings(settings);

      expect(result.warnings.some((w) => w.includes('retention'))).toBe(true);
    });

    it('should error on invalid diff threshold', () => {
      const settings = getDefaultGlobalSettings();
      settings.diffThreshold = 1.5;

      const result = validateGlobalSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Diff threshold'))).toBe(true);
    });

    it('should warn on high diff threshold', () => {
      const settings = getDefaultGlobalSettings();
      settings.diffThreshold = 0.6;

      const result = validateGlobalSettings(settings);

      expect(result.warnings.some((w) => w.includes('Diff threshold'))).toBe(true);
    });

    it('should warn on invalid bridge port', () => {
      const settings = getDefaultGlobalSettings();
      settings.defaultBridgePort = 100;

      const result = validateGlobalSettings(settings);

      expect(result.warnings.some((w) => w.includes('bridge port'))).toBe(true);
    });

    it('should warn on nonexistent maestro CLI path', () => {
      const settings = getDefaultGlobalSettings();
      settings.maestroCliPath = '/nonexistent/path/to/maestro';

      const result = validateGlobalSettings(settings);

      expect(result.warnings.some((w) => w.includes('Maestro CLI path'))).toBe(true);
    });
  });
});

// =============================================================================
// Merged Configuration Tests
// =============================================================================

describe('Merged Configuration', () => {
  describe('loadMergedConfig', () => {
    it('should return defaults when no configs exist', async () => {
      const result = await loadMergedConfig('/nonexistent/project');

      expect(result.success).toBe(true);
      expect(result.data?.sources.hasProjectConfig).toBe(false);
      expect(result.data?.effective.simulator.name).toBe('iPhone 15 Pro');
    });

    it('should use project config values when available', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.simulator.default = 'iPhone SE';
      config.simulator.udid = 'test-udid';
      await saveProjectConfig(TEST_PROJECT_PATH, config);

      const result = await loadMergedConfig(TEST_PROJECT_PATH);

      expect(result.success).toBe(true);
      expect(result.data?.sources.hasProjectConfig).toBe(true);
      expect(result.data?.effective.simulator.name).toBe('iPhone SE');
      expect(result.data?.effective.simulator.udid).toBe('test-udid');
    });

    it('should include effective values', async () => {
      const result = await loadMergedConfig(TEST_PROJECT_PATH);

      expect(result.data?.effective.flowsDirectory).toBeDefined();
      expect(result.data?.effective.baselinesDirectory).toBeDefined();
      expect(result.data?.effective.bridgePort).toBeDefined();
      expect(result.data?.effective.screenshotFormat).toBeDefined();
      expect(result.data?.effective.diffThreshold).toBeDefined();
    });
  });
});

// =============================================================================
// Initialization Tests
// =============================================================================

describe('Initialization', () => {
  describe('initializeProjectConfig', () => {
    it('should create project config with defaults', async () => {
      const result = await initializeProjectConfig(TEST_PROJECT_PATH);

      expect(result.success).toBe(true);
      expect(result.data?.project.path).toBe(TEST_PROJECT_PATH);
      expect(hasProjectConfig(TEST_PROJECT_PATH)).toBe(true);
    });

    it('should apply provided options', async () => {
      const result = await initializeProjectConfig(TEST_PROJECT_PATH, {
        projectFile: '/path/to/MyApp.xcworkspace',
        scheme: 'MyApp',
        bundleId: 'com.my.app',
        simulator: { name: 'iPhone 14', udid: 'test-udid-123' },
      });

      expect(result.success).toBe(true);
      expect(result.data?.project.path).toBe('/path/to/MyApp.xcworkspace');
      expect(result.data?.project.type).toBe('xcworkspace');
      expect(result.data?.project.scheme).toBe('MyApp');
      expect(result.data?.project.bundleId).toBe('com.my.app');
      expect(result.data?.simulator.default).toBe('iPhone 14');
      expect(result.data?.simulator.udid).toBe('test-udid-123');
    });

    it('should detect xcodeproj type', async () => {
      const result = await initializeProjectConfig(TEST_PROJECT_PATH, {
        projectFile: '/path/to/MyApp.xcodeproj',
      });

      expect(result.data?.project.type).toBe('xcodeproj');
    });

    it('should detect swift package type', async () => {
      const result = await initializeProjectConfig(TEST_PROJECT_PATH, {
        projectFile: '/path/to/Package.swift',
      });

      expect(result.data?.project.type).toBe('swift-package');
    });
  });
});

// =============================================================================
// Utility Functions Tests
// =============================================================================

describe('Utility Functions', () => {
  describe('getEffectiveFlowsDirectory', () => {
    it('should return default when no config exists', async () => {
      const dir = await getEffectiveFlowsDirectory('/nonexistent');
      expect(dir).toBe(path.join('/nonexistent', 'maestro'));
    });

    it('should return project config value', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.flows.directory = './custom-flows';
      await saveProjectConfig(TEST_PROJECT_PATH, config);

      const dir = await getEffectiveFlowsDirectory(TEST_PROJECT_PATH);
      expect(dir).toBe(path.join(TEST_PROJECT_PATH, 'custom-flows'));
    });
  });

  describe('getEffectiveBaselinesDirectory', () => {
    it('should return default when no config exists', async () => {
      const dir = await getEffectiveBaselinesDirectory('/nonexistent');
      expect(dir).toBe(path.join('/nonexistent', 'ios-baselines'));
    });

    it('should return project config value', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.baselines.directory = './screenshots';
      await saveProjectConfig(TEST_PROJECT_PATH, config);

      const dir = await getEffectiveBaselinesDirectory(TEST_PROJECT_PATH);
      expect(dir).toBe(path.join(TEST_PROJECT_PATH, 'screenshots'));
    });
  });

  describe('formatConfig', () => {
    it('should format project config as JSON', () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      const formatted = formatConfig(config);

      expect(formatted).toContain('"version"');
      expect(formatted).toContain('"project"');
      expect(() => JSON.parse(formatted)).not.toThrow();
    });

    it('should format global settings as JSON', () => {
      const settings = getDefaultGlobalSettings();
      const formatted = formatConfig(settings);

      expect(formatted).toContain('"screenshotFormat"');
      expect(() => JSON.parse(formatted)).not.toThrow();
    });
  });

  describe('formatMergedConfigSummary', () => {
    it('should format merged config summary', async () => {
      const result = await loadMergedConfig(TEST_PROJECT_PATH);
      const summary = formatMergedConfigSummary(result.data!);

      expect(summary).toContain('iOS Configuration Summary');
      expect(summary).toContain('Sources:');
      expect(summary).toContain('Effective Configuration:');
      expect(summary).toContain('Simulator:');
    });

    it('should show project config when available', async () => {
      const config = getDefaultProjectConfig(TEST_PROJECT_PATH);
      config.project.scheme = 'TestApp';
      await saveProjectConfig(TEST_PROJECT_PATH, config);

      const result = await loadMergedConfig(TEST_PROJECT_PATH);
      const summary = formatMergedConfigSummary(result.data!);

      expect(summary).toContain('Project Configuration:');
      expect(summary).toContain('TestApp');
    });
  });
});

// =============================================================================
// Type Tests (compile-time verification)
// =============================================================================

describe('Types', () => {
  it('should accept valid IOSProjectConfig', () => {
    const config: IOSProjectConfig = {
      version: '1.0.0',
      project: {
        path: '/path',
        scheme: 'App',
        bundleId: 'com.app',
        type: 'xcworkspace',
      },
      simulator: {
        default: 'iPhone 15',
        udid: 'abc123',
      },
      xcuitest: {
        enabled: true,
        targetName: 'AppUITests',
      },
      bridge: {
        enabled: false,
        port: 9876,
      },
      baselines: {
        directory: './baselines',
      },
      flows: {
        directory: './flows',
      },
      created: {
        at: '2024-01-01T00:00:00Z',
        wizardVersion: '1.0.0',
      },
    };

    expect(config.version).toBe('1.0.0');
  });

  it('should accept valid IOSGlobalSettings', () => {
    const settings: IOSGlobalSettings = {
      version: '1.0.0',
      defaultSimulator: 'iPhone 15 Pro',
      defaultSimulatorUdid: 'abc123',
      maestroCliPath: '/usr/local/bin/maestro',
      screenshotFormat: 'png',
      logRetentionDays: 7,
      defaultBridgePort: 9876,
      autoBootSimulator: true,
      diffThreshold: 0.1,
      recentProjects: [
        { path: '/project', name: 'Project', lastAccessed: '2024-01-01' },
      ],
      telemetry: {
        enabled: false,
        lastSent: '2024-01-01',
      },
    };

    expect(settings.version).toBe('1.0.0');
  });

  it('should accept valid RecentProject', () => {
    const project: RecentProject = {
      path: '/path/to/project',
      name: 'My Project',
      lastAccessed: '2024-01-01T00:00:00Z',
    };

    expect(project.name).toBe('My Project');
  });

  it('should accept valid ConfigValidationResult', () => {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: ['Some warning'],
      suggestions: ['Some suggestion'],
    };

    expect(result.valid).toBe(true);
  });
});
