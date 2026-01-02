/**
 * Tests for multi-device baseline support module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Mock electron app before imports
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'home') {
        return os.tmpdir();
      }
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'Maestro');
      }
      return os.tmpdir();
    },
  },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  // Types
  DeviceFamily,
  BaselineDeviceInfo,
  // Multi-device functions
  DEVICE_FAMILIES,
  DEVICE_FAMILY_RANGES,
  detectDeviceFamilyFromScreen,
  detectDeviceFamilyFromDevice,
  findBestBaselineForDevice,
  createBaselineWithAutoDetect,
  getDeviceBaselineMatrix,
  hasBaselineForDevice,
  getMissingDeviceFamilies,
  getBaselineCoverage,
  formatCoverageReport,
  syncBaselinesAcrossDevices,
  // Storage functions
  ensureProjectExists,
  createBaseline,
  getBaseline,
  deleteProject,
  getProjectPath,
} from '../index';

// =============================================================================
// Test Fixtures
// =============================================================================

const testProjectName = 'multi-device-test-' + Date.now();
const testBundleId = 'com.example.multidevice';

const iPhoneSEDevice: BaselineDeviceInfo = {
  name: 'iPhone SE (3rd generation)',
  osVersion: '17.5',
  screenSize: { width: 375, height: 667 },
  deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation',
};

const iPhone15Device: BaselineDeviceInfo = {
  name: 'iPhone 15',
  osVersion: '17.5',
  screenSize: { width: 393, height: 852 },
  deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15',
};

const iPhone15ProMaxDevice: BaselineDeviceInfo = {
  name: 'iPhone 15 Pro Max',
  osVersion: '17.5',
  screenSize: { width: 430, height: 932 },
  deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro-Max',
};

const iPadProDevice: BaselineDeviceInfo = {
  name: 'iPad Pro (12.9-inch)',
  osVersion: '17.5',
  screenSize: { width: 1024, height: 1366 },
  deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPad-Pro-12-9-inch',
};

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let testImagePath: string;

beforeAll(async () => {
  // Create test directory and dummy image
  testDir = path.join(os.tmpdir(), 'multi-device-tests-' + Date.now());
  await fs.mkdir(testDir, { recursive: true });

  // Create a minimal PNG file
  testImagePath = path.join(testDir, 'test-screenshot.png');
  const minimalPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x62, 0x00, 0x02, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  await fs.writeFile(testImagePath, minimalPng);
});

afterAll(async () => {
  // Cleanup
  try {
    await fs.rm(testDir, { recursive: true, force: true });
    await deleteProject(testProjectName);
  } catch {
    // Ignore cleanup errors
  }
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('Multi-Device Constants', () => {
  describe('DEVICE_FAMILIES', () => {
    it('contains all expected device families', () => {
      expect(DEVICE_FAMILIES).toContain('iPhone-SE');
      expect(DEVICE_FAMILIES).toContain('iPhone');
      expect(DEVICE_FAMILIES).toContain('iPhone-Plus');
      expect(DEVICE_FAMILIES).toContain('iPhone-Pro-Max');
      expect(DEVICE_FAMILIES).toContain('iPad');
      expect(DEVICE_FAMILIES).toContain('iPad-Pro');
      expect(DEVICE_FAMILIES).toHaveLength(6);
    });
  });

  describe('DEVICE_FAMILY_RANGES', () => {
    it('has ranges for all device families', () => {
      for (const family of DEVICE_FAMILIES) {
        expect(DEVICE_FAMILY_RANGES[family]).toBeDefined();
        expect(DEVICE_FAMILY_RANGES[family].minWidth).toBeGreaterThan(0);
        expect(DEVICE_FAMILY_RANGES[family].maxWidth).toBeGreaterThanOrEqual(
          DEVICE_FAMILY_RANGES[family].minWidth
        );
      }
    });
  });
});

// =============================================================================
// Device Family Detection Tests
// =============================================================================

describe('Device Family Detection', () => {
  describe('detectDeviceFamilyFromScreen', () => {
    it('detects iPhone SE from screen size', () => {
      expect(detectDeviceFamilyFromScreen({ width: 375, height: 667 })).toBe('iPhone-SE');
      expect(detectDeviceFamilyFromScreen({ width: 320, height: 568 })).toBe('iPhone-SE');
    });

    it('detects standard iPhone from screen size', () => {
      expect(detectDeviceFamilyFromScreen({ width: 390, height: 844 })).toBe('iPhone');
      expect(detectDeviceFamilyFromScreen({ width: 393, height: 852 })).toBe('iPhone');
    });

    it('detects iPhone Pro Max from screen size', () => {
      expect(detectDeviceFamilyFromScreen({ width: 430, height: 932 })).toBe('iPhone-Pro-Max');
      expect(detectDeviceFamilyFromScreen({ width: 428, height: 926 })).toBe('iPhone-Pro-Max');
    });

    it('detects iPad from screen size', () => {
      expect(detectDeviceFamilyFromScreen({ width: 810, height: 1080 })).toBe('iPad');
      expect(detectDeviceFamilyFromScreen({ width: 768, height: 1024 })).toBe('iPad');
    });

    it('detects iPad Pro from screen size', () => {
      expect(detectDeviceFamilyFromScreen({ width: 1024, height: 1366 })).toBe('iPad-Pro');
    });

    it('handles landscape orientation', () => {
      // iPad in landscape should still be detected as iPad
      expect(detectDeviceFamilyFromScreen({ width: 1024, height: 768 })).toBe('iPad');
    });
  });

  describe('detectDeviceFamilyFromDevice', () => {
    it('detects family from device name', () => {
      expect(detectDeviceFamilyFromDevice(iPhoneSEDevice)).toBe('iPhone-SE');
      expect(detectDeviceFamilyFromDevice(iPhone15Device)).toBe('iPhone');
      expect(detectDeviceFamilyFromDevice(iPhone15ProMaxDevice)).toBe('iPhone-Pro-Max');
      expect(detectDeviceFamilyFromDevice(iPadProDevice)).toBe('iPad-Pro');
    });

    it('uses screen size for refinement', () => {
      // Device with generic name but specific screen size
      const device: BaselineDeviceInfo = {
        name: 'iPhone Simulator',
        osVersion: '17.5',
        screenSize: { width: 430, height: 932 },
      };
      expect(detectDeviceFamilyFromDevice(device)).toBe('iPhone-Pro-Max');
    });
  });
});

// =============================================================================
// Device-Specific Baseline Operations Tests
// =============================================================================

describe('Device-Specific Baseline Operations', () => {
  const baselineName = 'login-screen';

  beforeAll(async () => {
    // Set up project with baselines for different device families
    await ensureProjectExists(testProjectName, testBundleId);

    // Create a generic baseline
    await createBaseline(
      testProjectName,
      'generic-screen',
      testImagePath,
      iPhone15Device,
      testBundleId
    );

    // Create device-specific baselines
    await createBaseline(
      testProjectName,
      baselineName,
      testImagePath,
      iPhone15Device,
      testBundleId,
      { deviceFamily: 'iPhone', useDeviceFamilyDir: true }
    );

    await createBaseline(
      testProjectName,
      baselineName,
      testImagePath,
      iPhone15ProMaxDevice,
      testBundleId,
      { deviceFamily: 'iPhone-Pro-Max', useDeviceFamilyDir: true }
    );
  });

  describe('findBestBaselineForDevice', () => {
    it('finds exact device family match', async () => {
      const result = await findBestBaselineForDevice(
        testProjectName,
        baselineName,
        iPhone15Device
      );

      expect(result).not.toBeNull();
      expect(result!.exactMatch).toBe(true);
      expect(result!.deviceFamily).toBe('iPhone');
    });

    it('finds exact match for iPhone Pro Max', async () => {
      const result = await findBestBaselineForDevice(
        testProjectName,
        baselineName,
        iPhone15ProMaxDevice
      );

      expect(result).not.toBeNull();
      expect(result!.exactMatch).toBe(true);
      expect(result!.deviceFamily).toBe('iPhone-Pro-Max');
    });

    it('falls back to closest device family when no exact match', async () => {
      // iPhone SE baseline doesn't exist, should fall back
      const result = await findBestBaselineForDevice(
        testProjectName,
        baselineName,
        iPhoneSEDevice
      );

      expect(result).not.toBeNull();
      expect(result!.exactMatch).toBe(false);
      // Should find iPhone as closest match
      expect(result!.deviceFamily).toBe('iPhone');
    });

    it('finds generic baseline when available', async () => {
      const result = await findBestBaselineForDevice(
        testProjectName,
        'generic-screen',
        iPhoneSEDevice
      );

      expect(result).not.toBeNull();
      expect(result!.exactMatch).toBe(false);
      expect(result!.deviceFamily).toBeUndefined();
    });

    it('returns null when no baseline exists', async () => {
      const result = await findBestBaselineForDevice(
        testProjectName,
        'non-existent-screen',
        iPhone15Device
      );

      expect(result).toBeNull();
    });
  });

  describe('createBaselineWithAutoDetect', () => {
    it('creates baseline with auto-detected device family', async () => {
      const { metadata, deviceFamily } = await createBaselineWithAutoDetect(
        testProjectName,
        'auto-detect-test',
        testImagePath,
        iPhone15ProMaxDevice,
        testBundleId
      );

      expect(metadata.name).toBe('auto-detect-test');
      expect(deviceFamily).toBe('iPhone-Pro-Max');

      // Verify it was stored in device family directory
      const retrieved = await getBaseline(testProjectName, 'auto-detect-test', 'iPhone-Pro-Max');
      expect(retrieved).not.toBeNull();
    });

    it('allows forcing device family', async () => {
      const { deviceFamily } = await createBaselineWithAutoDetect(
        testProjectName,
        'forced-family-test',
        testImagePath,
        iPhone15Device,
        testBundleId,
        { forceDeviceFamily: 'iPad' }
      );

      expect(deviceFamily).toBe('iPad');
    });
  });

  describe('hasBaselineForDevice', () => {
    it('returns true when baseline exists for device family', async () => {
      const exists = await hasBaselineForDevice(testProjectName, baselineName, 'iPhone');
      expect(exists).toBe(true);
    });

    it('returns false when baseline does not exist for device family', async () => {
      const exists = await hasBaselineForDevice(testProjectName, baselineName, 'iPad-Pro');
      expect(exists).toBe(false);
    });
  });

  describe('getMissingDeviceFamilies', () => {
    it('returns device families without baselines', async () => {
      const missing = await getMissingDeviceFamilies(testProjectName, baselineName);

      expect(missing).toContain('iPhone-SE');
      expect(missing).toContain('iPad');
      expect(missing).toContain('iPad-Pro');
      expect(missing).not.toContain('iPhone');
      expect(missing).not.toContain('iPhone-Pro-Max');
    });

    it('accepts filtered target families', async () => {
      const missing = await getMissingDeviceFamilies(
        testProjectName,
        baselineName,
        ['iPhone', 'iPad']
      );

      expect(missing).not.toContain('iPhone');
      expect(missing).toContain('iPad');
    });
  });
});

// =============================================================================
// Device Baseline Matrix Tests
// =============================================================================

describe('Device Baseline Matrix', () => {
  describe('getDeviceBaselineMatrix', () => {
    it('returns matrix of baselines and their device families', async () => {
      const matrix = await getDeviceBaselineMatrix(testProjectName);

      expect(matrix.length).toBeGreaterThan(0);

      // Find the login-screen entry
      const loginEntry = matrix.find((e) => e.name === 'login-screen');
      expect(loginEntry).toBeDefined();
      expect(loginEntry!.families).toContain('iPhone');
      expect(loginEntry!.families).toContain('iPhone-Pro-Max');
      expect(loginEntry!.hasGeneric).toBe(false);

      // Find the generic-screen entry
      const genericEntry = matrix.find((e) => e.name === 'generic-screen');
      expect(genericEntry).toBeDefined();
      expect(genericEntry!.families).toHaveLength(0);
      expect(genericEntry!.hasGeneric).toBe(true);
    });
  });
});

// =============================================================================
// Coverage Report Tests
// =============================================================================

describe('Coverage Reporting', () => {
  describe('getBaselineCoverage', () => {
    it('returns coverage statistics', async () => {
      const coverage = await getBaselineCoverage(testProjectName);

      expect(coverage.totalBaselines).toBeGreaterThan(0);
      expect(coverage.byFamily).toBeDefined();

      // Check family coverage
      expect(coverage.byFamily['iPhone'].count).toBeGreaterThan(0);
      expect(coverage.byFamily['iPhone-Pro-Max'].count).toBeGreaterThan(0);
    });
  });

  describe('formatCoverageReport', () => {
    it('formats coverage as markdown', async () => {
      const coverage = await getBaselineCoverage(testProjectName);
      const report = formatCoverageReport(coverage);

      expect(report).toContain('## Device Baseline Coverage');
      expect(report).toContain('Total Baselines');
      expect(report).toContain('Device Family');
      expect(report).toContain('iPhone');
      expect(report).toContain('iPad');
    });

    it('includes recommendations for low coverage', async () => {
      const coverage = await getBaselineCoverage(testProjectName);

      // iPad families have low coverage in test
      if (coverage.byFamily['iPad'].percentage < 50) {
        const report = formatCoverageReport(coverage);
        expect(report).toContain('Recommendations');
      }
    });
  });
});

// =============================================================================
// Sync Operations Tests
// =============================================================================

describe('Sync Operations', () => {
  describe('syncBaselinesAcrossDevices', () => {
    it('syncs baselines from source to target families', async () => {
      const result = await syncBaselinesAcrossDevices(testProjectName, {
        sourceFamily: 'iPhone',
        targetFamilies: ['iPhone-SE'],
        overwrite: false,
      });

      expect(result.synced).toBeGreaterThanOrEqual(0);
      expect(typeof result.skipped).toBe('number');
    });

    it('respects overwrite option', async () => {
      // First sync
      await syncBaselinesAcrossDevices(testProjectName, {
        sourceFamily: 'iPhone',
        targetFamilies: ['iPhone-Plus'],
        overwrite: false,
      });

      // Second sync without overwrite should skip
      const result = await syncBaselinesAcrossDevices(testProjectName, {
        sourceFamily: 'iPhone',
        targetFamilies: ['iPhone-Plus'],
        overwrite: false,
      });

      expect(result.skipped).toBeGreaterThanOrEqual(result.synced);
    });

    it('filters by name pattern', async () => {
      const result = await syncBaselinesAcrossDevices(testProjectName, {
        sourceFamily: 'iPhone',
        targetFamilies: ['iPad'],
        namePattern: /login/,
      });

      // Should only sync baselines matching pattern
      expect(result.syncedNames.every((n) => /login/.test(n))).toBe(true);
    });
  });
});
