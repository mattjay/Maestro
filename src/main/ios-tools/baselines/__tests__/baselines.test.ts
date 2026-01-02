/**
 * Tests for baselines module - types, metadata, and storage
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
  BaselineMetadata,
  BaselineDeviceInfo,
  IgnoreRegion,
  // Metadata functions
  createBaselineMetadata,
  createProjectMetadata,
  createFlowBaseline,
  serializeMetadata,
  parseMetadata,
  readBaselineMetadata,
  writeBaselineMetadata,
  readProjectMetadata,
  writeProjectMetadata,
  addIgnoreRegion,
  removeIgnoreRegion,
  createStatusBarIgnoreRegion,
  createHomeIndicatorIgnoreRegion,
  createTimestampIgnoreRegion,
  detectDeviceFamily,
  getDeviceFamilyScreenSize,
  // Storage functions
  getBaselinesBaseDirectory,
  getProjectPath,
  ensureProjectExists,
  listProjects,
  deleteProject,
  createBaseline,
  updateBaseline,
  getBaseline,
  listBaselines,
  deleteBaseline,
  exportBaselines,
  importBaselines,
} from '../index';

// =============================================================================
// Test Fixtures
// =============================================================================

const mockDeviceInfo: BaselineDeviceInfo = {
  name: 'iPhone 15 Pro',
  osVersion: '17.5',
  screenSize: { width: 393, height: 852 },
  deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro',
  udid: 'test-udid-12345',
};

const testProjectName = 'test-project-' + Date.now();
const testBaselineName = 'login-screen';
const testBundleId = 'com.example.testapp';

// =============================================================================
// Test Helpers
// =============================================================================

let testDir: string;
let testImagePath: string;

beforeAll(async () => {
  // Create a test directory and dummy image
  testDir = path.join(os.tmpdir(), 'baseline-tests-' + Date.now());
  await fs.mkdir(testDir, { recursive: true });

  // Create a minimal PNG file (1x1 pixel)
  testImagePath = path.join(testDir, 'test-screenshot.png');
  // PNG header + minimal IDAT for a 1x1 transparent pixel
  const minimalPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x78, 0x9c, 0x62, 0x00, 0x02, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x49, // IEND chunk
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  await fs.writeFile(testImagePath, minimalPng);
});

afterAll(async () => {
  // Clean up test directories
  try {
    await fs.rm(testDir, { recursive: true, force: true });

    // Clean up test project
    const projectPath = getProjectPath(testProjectName);
    await fs.rm(projectPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// =============================================================================
// Metadata Creation Tests
// =============================================================================

describe('Metadata Creation', () => {
  describe('createBaselineMetadata', () => {
    it('creates baseline metadata with required fields', () => {
      const metadata = createBaselineMetadata(
        testBaselineName,
        mockDeviceInfo,
        testBundleId
      );

      expect(metadata.name).toBe(testBaselineName);
      expect(metadata.device).toEqual(mockDeviceInfo);
      expect(metadata.bundleId).toBe(testBundleId);
      expect(metadata.ignoreRegions).toEqual([]);
      expect(metadata.createdAt).toBeInstanceOf(Date);
      expect(metadata.updatedAt).toBeInstanceOf(Date);
    });

    it('includes optional fields when provided', () => {
      const metadata = createBaselineMetadata(
        testBaselineName,
        mockDeviceInfo,
        testBundleId,
        {
          appVersion: '1.2.3',
          description: 'Test baseline',
          tags: ['login', 'auth'],
        }
      );

      expect(metadata.appVersion).toBe('1.2.3');
      expect(metadata.description).toBe('Test baseline');
      expect(metadata.tags).toEqual(['login', 'auth']);
    });
  });

  describe('createProjectMetadata', () => {
    it('creates project metadata with name', () => {
      const metadata = createProjectMetadata('my-project');

      expect(metadata.name).toBe('my-project');
      expect(metadata.screenCount).toBe(0);
      expect(metadata.flowCount).toBe(0);
      expect(metadata.createdAt).toBeInstanceOf(Date);
    });

    it('includes optional bundle ID', () => {
      const metadata = createProjectMetadata('my-project', testBundleId);

      expect(metadata.bundleId).toBe(testBundleId);
    });
  });

  describe('createFlowBaseline', () => {
    it('creates flow baseline structure', () => {
      const flow = createFlowBaseline(
        'login-flow',
        mockDeviceInfo,
        testBundleId,
        'User login flow'
      );

      expect(flow.name).toBe('login-flow');
      expect(flow.description).toBe('User login flow');
      expect(flow.device).toEqual(mockDeviceInfo);
      expect(flow.bundleId).toBe(testBundleId);
      expect(flow.steps).toEqual([]);
    });
  });
});

// =============================================================================
// Serialization Tests
// =============================================================================

describe('Metadata Serialization', () => {
  describe('serializeMetadata and parseMetadata', () => {
    it('round-trips metadata with dates', () => {
      const original: BaselineMetadata = createBaselineMetadata(
        testBaselineName,
        mockDeviceInfo,
        testBundleId
      );

      const json = serializeMetadata(original);
      const parsed = parseMetadata<BaselineMetadata>(json);

      expect(parsed.name).toBe(original.name);
      expect(parsed.createdAt).toEqual(original.createdAt);
      expect(parsed.updatedAt).toEqual(original.updatedAt);
      expect(parsed.device).toEqual(original.device);
    });

    it('preserves complex nested objects', () => {
      const original: BaselineMetadata = {
        ...createBaselineMetadata(testBaselineName, mockDeviceInfo, testBundleId),
        ignoreRegions: [
          {
            name: 'status-bar',
            rect: { x: 0, y: 0, width: 393, height: 54 },
            reason: 'status_bar' as const,
          },
        ],
      };

      const json = serializeMetadata(original);
      const parsed = parseMetadata<BaselineMetadata>(json);

      expect(parsed.ignoreRegions).toHaveLength(1);
      expect(parsed.ignoreRegions[0].name).toBe('status-bar');
      expect(parsed.ignoreRegions[0].rect).toEqual({ x: 0, y: 0, width: 393, height: 54 });
    });
  });
});

// =============================================================================
// Common Ignore Regions Tests
// =============================================================================

describe('Common Ignore Regions', () => {
  describe('createStatusBarIgnoreRegion', () => {
    it('creates status bar region for screen width', () => {
      const region = createStatusBarIgnoreRegion(393);

      expect(region.name).toBe('status_bar');
      expect(region.rect.x).toBe(0);
      expect(region.rect.y).toBe(0);
      expect(region.rect.width).toBe(393);
      expect(region.rect.height).toBe(54);
      expect(region.reason).toBe('status_bar');
    });
  });

  describe('createHomeIndicatorIgnoreRegion', () => {
    it('creates home indicator region at bottom of screen', () => {
      const region = createHomeIndicatorIgnoreRegion(393, 852);

      expect(region.name).toBe('home_indicator');
      expect(region.rect.x).toBe(0);
      expect(region.rect.y).toBe(818); // 852 - 34
      expect(region.rect.width).toBe(393);
      expect(region.rect.height).toBe(34);
    });
  });

  describe('createTimestampIgnoreRegion', () => {
    it('creates timestamp region with custom rect', () => {
      const rect = { x: 100, y: 200, width: 80, height: 20 };
      const region = createTimestampIgnoreRegion(rect, 'date-display');

      expect(region.name).toBe('date-display');
      expect(region.rect).toEqual(rect);
      expect(region.reason).toBe('timestamp');
    });
  });
});

// =============================================================================
// Device Family Detection Tests
// =============================================================================

describe('Device Family Detection', () => {
  describe('detectDeviceFamily', () => {
    it('detects iPhone SE', () => {
      expect(detectDeviceFamily('iPhone SE')).toBe('iPhone-SE');
      expect(detectDeviceFamily('iPhone SE (3rd generation)')).toBe('iPhone-SE');
    });

    it('detects standard iPhone', () => {
      expect(detectDeviceFamily('iPhone 15')).toBe('iPhone');
      expect(detectDeviceFamily('iPhone 14 Pro')).toBe('iPhone');
    });

    it('detects iPhone Pro Max', () => {
      expect(detectDeviceFamily('iPhone 15 Pro Max')).toBe('iPhone-Pro-Max');
      expect(detectDeviceFamily('iPhone 14 Plus')).toBe('iPhone-Pro-Max');
    });

    it('detects iPad', () => {
      expect(detectDeviceFamily('iPad Air')).toBe('iPad');
      expect(detectDeviceFamily('iPad mini')).toBe('iPad');
    });

    it('detects iPad Pro', () => {
      expect(detectDeviceFamily('iPad Pro (12.9-inch)')).toBe('iPad-Pro');
    });
  });

  describe('getDeviceFamilyScreenSize', () => {
    it('returns correct sizes for device families', () => {
      expect(getDeviceFamilyScreenSize('iPhone-SE')).toEqual({ width: 375, height: 667 });
      expect(getDeviceFamilyScreenSize('iPhone')).toEqual({ width: 390, height: 844 });
      expect(getDeviceFamilyScreenSize('iPad-Pro')).toEqual({ width: 1024, height: 1366 });
    });
  });
});

// =============================================================================
// File Operations Tests
// =============================================================================

describe('Metadata File Operations', () => {
  let tempMetadataDir: string;

  beforeEach(async () => {
    tempMetadataDir = path.join(testDir, 'metadata-' + Date.now());
    await fs.mkdir(tempMetadataDir, { recursive: true });
  });

  describe('writeBaselineMetadata and readBaselineMetadata', () => {
    it('writes and reads baseline metadata', async () => {
      const original = createBaselineMetadata(
        testBaselineName,
        mockDeviceInfo,
        testBundleId
      );

      await writeBaselineMetadata(tempMetadataDir, original);
      const read = await readBaselineMetadata(tempMetadataDir);

      expect(read).not.toBeNull();
      expect(read!.name).toBe(original.name);
      expect(read!.bundleId).toBe(original.bundleId);
    });

    it('returns null for non-existent metadata', async () => {
      const result = await readBaselineMetadata('/non/existent/path');
      expect(result).toBeNull();
    });
  });

  describe('writeProjectMetadata and readProjectMetadata', () => {
    it('writes and reads project metadata', async () => {
      const original = createProjectMetadata('test-project', testBundleId);

      await writeProjectMetadata(tempMetadataDir, original);
      const read = await readProjectMetadata(tempMetadataDir);

      expect(read).not.toBeNull();
      expect(read!.name).toBe('test-project');
      expect(read!.bundleId).toBe(testBundleId);
    });
  });
});

// =============================================================================
// Ignore Region Management Tests
// =============================================================================

describe('Ignore Region Management', () => {
  let tempBaselineDir: string;

  beforeEach(async () => {
    tempBaselineDir = path.join(testDir, 'baseline-' + Date.now());
    await fs.mkdir(tempBaselineDir, { recursive: true });

    const metadata = createBaselineMetadata(
      testBaselineName,
      mockDeviceInfo,
      testBundleId
    );
    await writeBaselineMetadata(tempBaselineDir, metadata);
  });

  describe('addIgnoreRegion', () => {
    it('adds ignore region to baseline', async () => {
      const region: IgnoreRegion = {
        name: 'clock',
        rect: { x: 20, y: 10, width: 50, height: 20 },
        reason: 'timestamp',
      };

      const updated = await addIgnoreRegion(tempBaselineDir, region);

      expect(updated.ignoreRegions).toHaveLength(1);
      expect(updated.ignoreRegions[0].name).toBe('clock');
    });

    it('throws on duplicate region name', async () => {
      const region: IgnoreRegion = {
        name: 'clock',
        rect: { x: 20, y: 10, width: 50, height: 20 },
        reason: 'timestamp',
      };

      await addIgnoreRegion(tempBaselineDir, region);

      await expect(addIgnoreRegion(tempBaselineDir, region)).rejects.toThrow(
        'Ignore region "clock" already exists'
      );
    });
  });

  describe('removeIgnoreRegion', () => {
    it('removes ignore region by name', async () => {
      const region: IgnoreRegion = {
        name: 'clock',
        rect: { x: 20, y: 10, width: 50, height: 20 },
        reason: 'timestamp',
      };

      await addIgnoreRegion(tempBaselineDir, region);
      const updated = await removeIgnoreRegion(tempBaselineDir, 'clock');

      expect(updated.ignoreRegions).toHaveLength(0);
    });

    it('throws on non-existent region', async () => {
      await expect(removeIgnoreRegion(tempBaselineDir, 'nonexistent')).rejects.toThrow(
        'Ignore region "nonexistent" not found'
      );
    });
  });
});

// =============================================================================
// Storage Tests
// =============================================================================

describe('Baseline Storage', () => {
  describe('getBaselinesBaseDirectory', () => {
    it('returns path under home directory', () => {
      const baseDir = getBaselinesBaseDirectory();

      expect(baseDir).toContain('.maestro');
      expect(baseDir).toContain('ios-baselines');
    });
  });

  describe('ensureProjectExists', () => {
    it('creates project directory structure', async () => {
      const metadata = await ensureProjectExists(testProjectName, testBundleId);

      expect(metadata.name).toBe(testProjectName);
      expect(metadata.bundleId).toBe(testBundleId);

      // Verify directories exist
      const projectPath = getProjectPath(testProjectName);
      const screensPath = path.join(projectPath, 'screens');
      const flowsPath = path.join(projectPath, 'flows');

      await expect(fs.access(projectPath)).resolves.toBeUndefined();
      await expect(fs.access(screensPath)).resolves.toBeUndefined();
      await expect(fs.access(flowsPath)).resolves.toBeUndefined();
    });

    it('returns existing metadata on subsequent calls', async () => {
      const first = await ensureProjectExists(testProjectName);
      const second = await ensureProjectExists(testProjectName);

      expect(second.name).toBe(first.name);
      expect(second.createdAt).toEqual(first.createdAt);
    });
  });

  describe('createBaseline and getBaseline', () => {
    it('creates and retrieves baseline', async () => {
      await ensureProjectExists(testProjectName, testBundleId);

      const metadata = await createBaseline(
        testProjectName,
        testBaselineName,
        testImagePath,
        mockDeviceInfo,
        testBundleId,
        { description: 'Test baseline' }
      );

      expect(metadata.name).toBe(testBaselineName);
      expect(metadata.description).toBe('Test baseline');

      const retrieved = await getBaseline(testProjectName, testBaselineName);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.metadata.name).toBe(testBaselineName);
      expect(retrieved!.imagePath).toContain('baseline.png');
    });

    it('throws when baseline already exists', async () => {
      await ensureProjectExists(testProjectName, testBundleId);

      // Baseline already exists from previous test
      await expect(
        createBaseline(
          testProjectName,
          testBaselineName,
          testImagePath,
          mockDeviceInfo,
          testBundleId
        )
      ).rejects.toThrow('already exists');
    });
  });

  describe('updateBaseline', () => {
    it('updates existing baseline image', async () => {
      const updated = await updateBaseline(
        testProjectName,
        testBaselineName,
        testImagePath
      );

      expect(updated.name).toBe(testBaselineName);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(updated.createdAt.getTime());
    });
  });

  describe('listBaselines', () => {
    it('lists baselines in project', async () => {
      const baselines = await listBaselines(testProjectName);

      expect(baselines.length).toBeGreaterThan(0);
      expect(baselines.some((b) => b.name === testBaselineName)).toBe(true);
    });
  });

  describe('deleteBaseline', () => {
    it('deletes baseline', async () => {
      const deleteName = 'to-delete-' + Date.now();

      await createBaseline(
        testProjectName,
        deleteName,
        testImagePath,
        mockDeviceInfo,
        testBundleId
      );

      await deleteBaseline(testProjectName, deleteName);

      const retrieved = await getBaseline(testProjectName, deleteName);
      expect(retrieved).toBeNull();
    });
  });
});

// =============================================================================
// Export/Import Tests
// =============================================================================

describe('Export and Import', () => {
  let exportDir: string;

  beforeEach(async () => {
    exportDir = path.join(testDir, 'export-' + Date.now());
  });

  describe('exportBaselines', () => {
    it('exports baselines to directory', async () => {
      const result = await exportBaselines(testProjectName, {
        outputPath: exportDir,
      });

      expect(result.baselineCount).toBeGreaterThan(0);
      expect(result.path).toBe(exportDir);

      // Verify export structure
      const metadataPath = path.join(exportDir, 'metadata.json');
      await expect(fs.access(metadataPath)).resolves.toBeUndefined();
    });
  });

  describe('importBaselines', () => {
    it('imports baselines from export', async () => {
      // First export
      await exportBaselines(testProjectName, { outputPath: exportDir });

      // Create a new project for import
      const importProjectName = 'import-test-' + Date.now();

      const result = await importBaselines(importProjectName, {
        inputPath: exportDir,
        prefix: 'imported-',
      });

      expect(result.imported).toBeGreaterThan(0);
      expect(result.importedNames.some((n) => n.startsWith('imported-'))).toBe(true);

      // Clean up import project
      await deleteProject(importProjectName);
    });

    it('skips existing baselines without overwrite', async () => {
      await exportBaselines(testProjectName, { outputPath: exportDir });

      // Import twice
      await importBaselines(testProjectName, { inputPath: exportDir });
      const result = await importBaselines(testProjectName, { inputPath: exportDir });

      expect(result.skipped).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Project Management Tests
// =============================================================================

describe('Project Management', () => {
  describe('listProjects', () => {
    it('lists existing projects', async () => {
      const projects = await listProjects();

      expect(projects).toContain(testProjectName);
    });
  });

  describe('deleteProject', () => {
    it('deletes project and all baselines', async () => {
      const deleteProjectName = 'delete-test-' + Date.now();
      await ensureProjectExists(deleteProjectName, testBundleId);

      await deleteProject(deleteProjectName);

      const projects = await listProjects();
      expect(projects).not.toContain(deleteProjectName);
    });
  });
});
