/**
 * Tests for iOS Setup Environment Detection
 *
 * These tests verify the detection of:
 * - Xcode installation and configuration
 * - iOS simulators
 * - Maestro CLI (mobile-dev-inc)
 * - iOS project structure
 * - Existing Maestro integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Mock External Dependencies
// =============================================================================

// Use vi.hoisted to create mock functions that can be referenced in vi.mock factories
const { mockReaddir, mockReadFile, mockExistsSync } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockReadFile: vi.fn(),
  mockExistsSync: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readdir: mockReaddir,
    readFile: mockReadFile,
    mkdir: vi.fn(),
    stat: vi.fn(),
  },
  readdir: mockReaddir,
  readFile: mockReadFile,
  mkdir: vi.fn(),
  stat: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
  },
  existsSync: mockExistsSync,
}));

// Mock xcode module
vi.mock('../../xcode', () => ({
  getXcodeInfo: vi.fn(),
  getXcodeVersion: vi.fn(),
  validateXcodeInstallation: vi.fn(),
}));

// Mock simulator module
vi.mock('../../simulator', () => ({
  listSimulators: vi.fn(),
}));

// Mock maestro-cli module
vi.mock('../../maestro-cli', () => ({
  detectMaestroCli: vi.fn(),
}));

// Mock execFile
vi.mock('../../../utils/execFile', () => ({
  execFileNoThrow: vi.fn(),
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
import { getXcodeInfo } from '../../xcode';
import { listSimulators } from '../../simulator';
import { detectMaestroCli as detectMaestroCliCore } from '../../maestro-cli';
import { execFileNoThrow } from '../../../utils/execFile';

// Import the module under test
import {
  detectXcodeInstallation,
  detectSimulators,
  detectMaestroCli,
  detectProjectType,
  detectExistingIntegration,
  detectEnvironment,
} from '../detector';

// =============================================================================
// Tests: detectXcodeInstallation
// =============================================================================

describe('detectXcodeInstallation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect Xcode when properly installed', async () => {
    vi.mocked(getXcodeInfo).mockResolvedValue({
      success: true,
      data: {
        path: '/Applications/Xcode.app/Contents/Developer',
        version: '15.2',
        build: '15C500b',
        commandLineToolsInstalled: true,
      },
    });

    vi.mocked(execFileNoThrow).mockResolvedValue({
      stdout: 'Xcode 15.2\nBuild version 15C500b',
      stderr: '',
      exitCode: 0,
    });

    const result = await detectXcodeInstallation();

    expect(result.success).toBe(true);
    expect(result.data?.installed).toBe(true);
    expect(result.data?.version).toBe('15.2');
    expect(result.data?.commandLineToolsInstalled).toBe(true);
    expect(result.data?.licenseAccepted).toBe(true);
    expect(result.data?.issues).toHaveLength(0);
  });

  it('should detect when Xcode is not installed', async () => {
    vi.mocked(getXcodeInfo).mockResolvedValue({
      success: false,
      error: 'Xcode is not installed',
      errorCode: 'XCODE_NOT_FOUND',
    });

    const result = await detectXcodeInstallation();

    expect(result.success).toBe(true);
    expect(result.data?.installed).toBe(false);
    expect(result.data?.issues).toContain('Xcode is not installed');
    expect(result.data?.recommendations.some((r) => r.includes('App Store'))).toBe(true);
  });

  it('should detect outdated Xcode version', async () => {
    vi.mocked(getXcodeInfo).mockResolvedValue({
      success: true,
      data: {
        path: '/Applications/Xcode.app/Contents/Developer',
        version: '13.4',
        build: '13F100',
        commandLineToolsInstalled: true,
      },
    });

    vi.mocked(execFileNoThrow).mockResolvedValue({
      stdout: 'Xcode 13.4',
      stderr: '',
      exitCode: 0,
    });

    const result = await detectXcodeInstallation();

    expect(result.success).toBe(true);
    expect(result.data?.installed).toBe(true);
    expect(result.data?.issues.some((i) => i.includes('outdated'))).toBe(true);
    expect(result.data?.recommendations.some((r) => r.includes('14.0'))).toBe(true);
  });

  it('should detect when license is not accepted', async () => {
    vi.mocked(getXcodeInfo).mockResolvedValue({
      success: true,
      data: {
        path: '/Applications/Xcode.app/Contents/Developer',
        version: '15.2',
        build: '15C500b',
        commandLineToolsInstalled: true,
      },
    });

    vi.mocked(execFileNoThrow).mockResolvedValue({
      stdout: '',
      stderr: 'Xcode license has not been accepted',
      exitCode: 69,
    });

    const result = await detectXcodeInstallation();

    expect(result.success).toBe(true);
    expect(result.data?.licenseAccepted).toBe(false);
    expect(result.data?.issues.some((i) => i.includes('license'))).toBe(true);
    expect(result.data?.recommendations.some((r) => r.includes('xcodebuild -license'))).toBe(true);
  });
});

// =============================================================================
// Tests: detectSimulators
// =============================================================================

describe('detectSimulators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect available simulators', async () => {
    vi.mocked(listSimulators).mockResolvedValue({
      success: true,
      data: [
        {
          udid: 'AAAA-BBBB-CCCC',
          name: 'iPhone 15 Pro',
          state: 'Booted',
          isAvailable: true,
          runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
          iosVersion: '17.2',
          deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
        },
        {
          udid: 'DDDD-EEEE-FFFF',
          name: 'iPhone 14',
          state: 'Shutdown',
          isAvailable: true,
          runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
          iosVersion: '17.2',
          deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-14',
        },
        {
          udid: 'GGGG-HHHH-IIII',
          name: 'iPhone SE',
          state: 'Shutdown',
          isAvailable: false,
          runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-16-4',
          iosVersion: '16.4',
          deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation',
          availabilityError: 'Runtime not available',
        },
      ],
    });

    const result = await detectSimulators();

    expect(result.success).toBe(true);
    expect(result.data?.available).toBe(true);
    expect(result.data?.totalCount).toBe(3);
    expect(result.data?.availableCount).toBe(2);
    expect(result.data?.bootedCount).toBe(1);
    expect(result.data?.iosVersions).toContain('17.2');
    expect(result.data?.bootedSimulators).toHaveLength(1);
    expect(result.data?.bootedSimulators[0].name).toBe('iPhone 15 Pro');
    expect(result.data?.recommendedSimulator?.name).toBe('iPhone 15 Pro');
  });

  it('should detect no available simulators', async () => {
    vi.mocked(listSimulators).mockResolvedValue({
      success: true,
      data: [],
    });

    const result = await detectSimulators();

    expect(result.success).toBe(true);
    expect(result.data?.available).toBe(false);
    expect(result.data?.totalCount).toBe(0);
    expect(result.data?.issues.some((i) => i.includes('No iOS simulators'))).toBe(true);
  });

  it('should handle simulator listing failure', async () => {
    vi.mocked(listSimulators).mockResolvedValue({
      success: false,
      error: 'simctl not found',
      errorCode: 'COMMAND_FAILED',
    });

    const result = await detectSimulators();

    expect(result.success).toBe(true);
    expect(result.data?.available).toBe(false);
    expect(result.data?.issues.some((i) => i.includes('Unable to list simulators'))).toBe(true);
  });

  it('should recommend booting simulator when none are booted', async () => {
    vi.mocked(listSimulators).mockResolvedValue({
      success: true,
      data: [
        {
          udid: 'AAAA-BBBB-CCCC',
          name: 'iPhone 15 Pro',
          state: 'Shutdown',
          isAvailable: true,
          runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-17-2',
          iosVersion: '17.2',
          deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
        },
      ],
    });

    const result = await detectSimulators();

    expect(result.success).toBe(true);
    expect(result.data?.bootedCount).toBe(0);
    expect(result.data?.recommendations.some((r) => r.includes('Boot a simulator'))).toBe(true);
  });
});

// =============================================================================
// Tests: detectMaestroCli
// =============================================================================

describe('detectMaestroCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect installed Maestro CLI', async () => {
    vi.mocked(detectMaestroCliCore).mockResolvedValue({
      success: true,
      data: {
        available: true,
        path: '/opt/homebrew/bin/maestro',
        version: '1.36.0',
      },
    });

    vi.mocked(execFileNoThrow).mockResolvedValue({
      stdout: 'Usage: maestro ...',
      stderr: '',
      exitCode: 0,
    });

    const result = await detectMaestroCli();

    expect(result.success).toBe(true);
    expect(result.data?.installed).toBe(true);
    expect(result.data?.path).toBe('/opt/homebrew/bin/maestro');
    expect(result.data?.version).toBe('1.36.0');
    expect(result.data?.isWorking).toBe(true);
  });

  it('should detect when Maestro CLI is not installed', async () => {
    vi.mocked(detectMaestroCliCore).mockResolvedValue({
      success: true,
      data: {
        available: false,
        installInstructions: 'curl -Ls "https://get.maestro.mobile.dev" | bash',
      },
    });

    const result = await detectMaestroCli();

    expect(result.success).toBe(true);
    expect(result.data?.installed).toBe(false);
    expect(result.data?.issues.some((i) => i.includes('not installed'))).toBe(true);
    expect(result.data?.recommendations.some((r) => r.includes('Install Maestro CLI'))).toBe(true);
  });

  it('should detect outdated Maestro CLI version', async () => {
    vi.mocked(detectMaestroCliCore).mockResolvedValue({
      success: true,
      data: {
        available: true,
        path: '/opt/homebrew/bin/maestro',
        version: '1.20.0',
      },
    });

    vi.mocked(execFileNoThrow).mockResolvedValue({
      stdout: 'Usage: maestro ...',
      stderr: '',
      exitCode: 0,
    });

    const result = await detectMaestroCli();

    expect(result.success).toBe(true);
    expect(result.data?.installed).toBe(true);
    expect(result.data?.issues.some((i) => i.includes('outdated'))).toBe(true);
    expect(result.data?.recommendations.some((r) => r.includes('maestro update'))).toBe(true);
  });
});

// =============================================================================
// Tests: detectProjectType
// =============================================================================

describe('detectProjectType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect xcworkspace project', async () => {
    mockExistsSync.mockReturnValue(true);

    mockReaddir.mockResolvedValue([
      { name: 'MyApp.xcworkspace', isDirectory: () => true, isFile: () => false },
      { name: 'MyApp.xcodeproj', isDirectory: () => true, isFile: () => false },
      { name: 'Podfile', isDirectory: () => false, isFile: () => true },
    ] as any);

    vi.mocked(execFileNoThrow).mockResolvedValue({
      stdout: JSON.stringify({
        workspace: {
          name: 'MyApp',
          schemes: ['MyApp', 'MyAppTests', 'MyAppUITests'],
        },
      }),
      stderr: '',
      exitCode: 0,
    });

    const result = await detectProjectType('/path/to/project');

    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('xcworkspace');
    expect(result.data?.found).toBe(true);
    expect(result.data?.projectName).toBe('MyApp');
    expect(result.data?.schemes.length).toBeGreaterThan(0);
    expect(result.data?.hasUITestTarget).toBe(true);
  });

  it('should detect xcodeproj project', async () => {
    mockExistsSync.mockReturnValue(true);

    mockReaddir.mockResolvedValue([
      { name: 'SimpleApp.xcodeproj', isDirectory: () => true, isFile: () => false },
      { name: 'Sources', isDirectory: () => true, isFile: () => false },
    ] as any);

    vi.mocked(execFileNoThrow).mockResolvedValue({
      stdout: JSON.stringify({
        project: {
          name: 'SimpleApp',
          schemes: ['SimpleApp'],
          targets: ['SimpleApp'],
        },
      }),
      stderr: '',
      exitCode: 0,
    });

    const result = await detectProjectType('/path/to/project');

    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('xcodeproj');
    expect(result.data?.found).toBe(true);
    expect(result.data?.projectName).toBe('SimpleApp');
    expect(result.data?.hasUITestTarget).toBe(false);
    expect(result.data?.recommendations.some((r) => r.includes('XCUITest target'))).toBe(true);
  });

  it('should detect Swift Package Manager project', async () => {
    mockExistsSync.mockReturnValue(true);

    mockReaddir.mockResolvedValue([
      { name: 'Package.swift', isDirectory: () => false, isFile: () => true },
      { name: 'Sources', isDirectory: () => true, isFile: () => false },
      { name: 'Tests', isDirectory: () => true, isFile: () => false },
    ] as any);

    mockReadFile.mockResolvedValue(`
// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "MyLibrary",
    products: [
        .library(name: "MyLibrary", targets: ["MyLibrary"]),
    ],
    targets: [
        .target(name: "MyLibrary"),
        .testTarget(name: "MyLibraryTests", dependencies: ["MyLibrary"]),
    ]
)
`);

    const result = await detectProjectType('/path/to/project');

    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('swift-package');
    expect(result.data?.found).toBe(true);
    expect(result.data?.projectName).toBe('MyLibrary');
  });

  it('should return unknown for non-iOS project', async () => {
    mockExistsSync.mockReturnValue(true);

    mockReaddir.mockResolvedValue([
      { name: 'package.json', isDirectory: () => false, isFile: () => true },
      { name: 'src', isDirectory: () => true, isFile: () => false },
      { name: 'node_modules', isDirectory: () => true, isFile: () => false },
    ] as any);

    const result = await detectProjectType('/path/to/project');

    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('unknown');
    expect(result.data?.found).toBe(false);
    expect(result.data?.issues.some((i) => i.includes('No iOS project found'))).toBe(true);
  });

  it('should handle non-existent path', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await detectProjectType('/non/existent/path');

    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('should skip Pods.xcworkspace in favor of main workspace', async () => {
    mockExistsSync.mockReturnValue(true);

    mockReaddir.mockResolvedValue([
      { name: 'Pods.xcworkspace', isDirectory: () => true, isFile: () => false },
      { name: 'MyApp.xcworkspace', isDirectory: () => true, isFile: () => false },
      { name: 'MyApp.xcodeproj', isDirectory: () => true, isFile: () => false },
    ] as any);

    vi.mocked(execFileNoThrow).mockResolvedValue({
      stdout: JSON.stringify({
        workspace: {
          name: 'MyApp',
          schemes: ['MyApp'],
        },
      }),
      stderr: '',
      exitCode: 0,
    });

    const result = await detectProjectType('/path/to/project');

    expect(result.success).toBe(true);
    expect(result.data?.projectPath).toContain('MyApp.xcworkspace');
    expect(result.data?.projectPath).not.toContain('Pods.xcworkspace');
  });
});

// =============================================================================
// Tests: detectExistingIntegration
// =============================================================================

describe('detectExistingIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect existing Maestro configuration', async () => {
    mockExistsSync.mockImplementation((p) => {
      const pathStr = String(p);
      return (
        pathStr.endsWith('.maestro') ||
        pathStr.endsWith('ios-config.json') ||
        pathStr.includes('maestro')
      );
    });

    mockReadFile.mockResolvedValue(
      JSON.stringify({
        project: { scheme: 'MyApp' },
        simulator: { default: 'iPhone 15 Pro' },
      })
    );

    mockReaddir.mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith('maestro')) {
        return ['login_flow.yaml', 'home_flow.yaml'] as any;
      }
      return [];
    });

    const result = await detectExistingIntegration('/path/to/project');

    expect(result.success).toBe(true);
    expect(result.data?.hasIntegration).toBe(true);
    expect(result.data?.hasMaestroConfig).toBe(true);
    expect(result.data?.hasIosConfig).toBe(true);
    expect(result.data?.currentConfig).toBeDefined();
  });

  it('should detect flow files', async () => {
    mockExistsSync.mockImplementation((p) => {
      const pathStr = String(p);
      return pathStr.includes('maestro');
    });

    mockReaddir.mockResolvedValue([
      'login_flow.yaml',
      'checkout_flow.yml',
      'README.md',
    ] as any);

    const result = await detectExistingIntegration('/path/to/project');

    expect(result.success).toBe(true);
    expect(result.data?.hasFlowsDirectory).toBe(true);
    expect(result.data?.flowFileCount).toBe(2); // Only yaml/yml files
  });

  it('should detect baseline images', async () => {
    mockExistsSync.mockImplementation((p) => {
      const pathStr = String(p);
      return pathStr.includes('ios-baselines');
    });

    mockReaddir.mockResolvedValue([
      'login_screen.png',
      'home_screen.png',
      'checkout.jpg',
      'metadata.json',
    ] as any);

    const result = await detectExistingIntegration('/path/to/project');

    expect(result.success).toBe(true);
    expect(result.data?.hasBaselinesDirectory).toBe(true);
    expect(result.data?.baselineFileCount).toBe(3); // Only image files
  });

  it('should detect no integration', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await detectExistingIntegration('/path/to/project');

    expect(result.success).toBe(true);
    expect(result.data?.hasIntegration).toBe(false);
    expect(result.data?.hasMaestroConfig).toBe(false);
    expect(result.data?.hasFlowsDirectory).toBe(false);
    expect(result.data?.hasBaselinesDirectory).toBe(false);
  });
});

// =============================================================================
// Tests: detectEnvironment
// =============================================================================

describe('detectEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should report ready when all requirements are met', async () => {
    // Mock Xcode detection
    vi.mocked(getXcodeInfo).mockResolvedValue({
      success: true,
      data: {
        path: '/Applications/Xcode.app/Contents/Developer',
        version: '15.2',
        build: '15C500b',
        commandLineToolsInstalled: true,
      },
    });

    vi.mocked(execFileNoThrow).mockResolvedValue({
      stdout: 'Xcode 15.2',
      stderr: '',
      exitCode: 0,
    });

    // Mock simulator detection
    vi.mocked(listSimulators).mockResolvedValue({
      success: true,
      data: [
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
    });

    // Mock Maestro detection
    vi.mocked(detectMaestroCliCore).mockResolvedValue({
      success: true,
      data: {
        available: true,
        path: '/opt/homebrew/bin/maestro',
        version: '1.36.0',
      },
    });

    const result = await detectEnvironment();

    expect(result.success).toBe(true);
    expect(result.data?.ready).toBe(true);
    expect(result.data?.xcode.installed).toBe(true);
    expect(result.data?.simulators.available).toBe(true);
    expect(result.data?.maestroCli.installed).toBe(true);
    expect(result.data?.allIssues).toHaveLength(0);
  });

  it('should report not ready when Xcode is missing', async () => {
    vi.mocked(getXcodeInfo).mockResolvedValue({
      success: false,
      error: 'Xcode is not installed',
      errorCode: 'XCODE_NOT_FOUND',
    });

    vi.mocked(listSimulators).mockResolvedValue({
      success: true,
      data: [
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
    });

    vi.mocked(detectMaestroCliCore).mockResolvedValue({
      success: true,
      data: { available: false },
    });

    const result = await detectEnvironment();

    expect(result.success).toBe(true);
    expect(result.data?.ready).toBe(false);
    expect(result.data?.allIssues.length).toBeGreaterThan(0);
  });

  it('should still be ready without Maestro CLI', async () => {
    // Maestro CLI is optional for core functionality
    vi.mocked(getXcodeInfo).mockResolvedValue({
      success: true,
      data: {
        path: '/Applications/Xcode.app/Contents/Developer',
        version: '15.2',
        build: '15C500b',
        commandLineToolsInstalled: true,
      },
    });

    vi.mocked(execFileNoThrow).mockResolvedValue({
      stdout: 'Xcode 15.2',
      stderr: '',
      exitCode: 0,
    });

    vi.mocked(listSimulators).mockResolvedValue({
      success: true,
      data: [
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
    });

    vi.mocked(detectMaestroCliCore).mockResolvedValue({
      success: true,
      data: {
        available: false,
        installInstructions: 'curl ...',
      },
    });

    const result = await detectEnvironment();

    expect(result.success).toBe(true);
    expect(result.data?.ready).toBe(true);
    expect(result.data?.maestroCli.installed).toBe(false);
    expect(result.data?.allRecommendations.some((r) => r.includes('Install Maestro CLI'))).toBe(true);
  });
});
