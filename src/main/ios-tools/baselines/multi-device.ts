/**
 * iOS Tools - Multi-Device Baseline Support
 *
 * Enhanced support for managing baselines across multiple device families,
 * including auto-detection of device family and intelligent baseline selection.
 */

import { logger } from '../../utils/logger';
import {
  DeviceFamily,
  BaselineDeviceInfo,
  BaselineMetadata,
  ScreenSize,
  BaselineEntry,
} from './types';
import {
  detectDeviceFamily,
  getDeviceFamilyScreenSize,
} from './metadata';
import {
  getProjectScreensPath,
  getBaseline,
  createBaseline,
  listBaselines,
} from './storage';
import fs from 'fs/promises';
import path from 'path';

const LOG_CONTEXT = '[iOS-MultiDevice]';

// =============================================================================
// Device Family Detection
// =============================================================================

/**
 * All supported device families in order of specificity.
 */
export const DEVICE_FAMILIES: DeviceFamily[] = [
  'iPhone-SE',
  'iPhone',
  'iPhone-Plus',
  'iPhone-Pro-Max',
  'iPad',
  'iPad-Pro',
];

/**
 * Device family screen size ranges for auto-detection.
 */
export const DEVICE_FAMILY_RANGES: Record<DeviceFamily, {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}> = {
  'iPhone-SE': { minWidth: 320, maxWidth: 375, minHeight: 568, maxHeight: 667 },
  'iPhone': { minWidth: 375, maxWidth: 393, minHeight: 667, maxHeight: 852 },
  'iPhone-Plus': { minWidth: 414, maxWidth: 414, minHeight: 736, maxHeight: 896 },
  'iPhone-Pro-Max': { minWidth: 428, maxWidth: 440, minHeight: 926, maxHeight: 960 },
  'iPad': { minWidth: 768, maxWidth: 834, minHeight: 1024, maxHeight: 1194 },
  'iPad-Pro': { minWidth: 1024, maxWidth: 1366, minHeight: 1366, maxHeight: 1366 },
};

/**
 * Detect device family from screen dimensions.
 *
 * @param screenSize - Screen dimensions
 * @returns Detected device family
 */
export function detectDeviceFamilyFromScreen(screenSize: ScreenSize): DeviceFamily {
  const { width, height } = screenSize;

  // iPad detection (landscape or portrait)
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);

  if (maxDim >= 1024 && minDim >= 768) {
    if (maxDim >= 1366) {
      return 'iPad-Pro';
    }
    return 'iPad';
  }

  // iPhone detection based on width
  if (minDim <= 375) {
    if (maxDim <= 667) {
      return 'iPhone-SE';
    }
    return 'iPhone';
  }

  if (minDim >= 428) {
    return 'iPhone-Pro-Max';
  }

  if (minDim >= 414) {
    return 'iPhone-Plus';
  }

  // Default to standard iPhone
  return 'iPhone';
}

/**
 * Detect device family from device info.
 *
 * @param device - Device information
 * @returns Detected device family
 */
export function detectDeviceFamilyFromDevice(device: BaselineDeviceInfo): DeviceFamily {
  // Try name-based detection first
  const fromName = detectDeviceFamily(device.name);

  // If we have screen size, use it for validation/refinement
  if (device.screenSize) {
    const fromScreen = detectDeviceFamilyFromScreen(device.screenSize);

    // Use screen size result if name detection gives generic 'iPhone'
    if (fromName === 'iPhone' && fromScreen !== 'iPhone') {
      return fromScreen;
    }
  }

  return fromName;
}

// =============================================================================
// Device-Specific Baseline Operations
// =============================================================================

/**
 * Result of finding a device-specific baseline.
 */
export interface DeviceBaselineMatch {
  /** Found baseline entry */
  baseline: {
    metadata: BaselineMetadata;
    imagePath: string;
    maskPath?: string;
  };
  /** Device family of the baseline */
  deviceFamily?: DeviceFamily;
  /** Whether this was an exact match or fallback */
  exactMatch: boolean;
  /** The device family we searched for (if any) */
  searchedFamily?: DeviceFamily;
}

/**
 * Find the best matching baseline for a device.
 *
 * Order of precedence:
 * 1. Exact device family match
 * 2. Generic baseline (no device family)
 * 3. Closest device family baseline
 *
 * @param projectName - Project name
 * @param baselineName - Baseline name
 * @param device - Device information for matching
 * @returns Best matching baseline or null
 */
export async function findBestBaselineForDevice(
  projectName: string,
  baselineName: string,
  device: BaselineDeviceInfo
): Promise<DeviceBaselineMatch | null> {
  const targetFamily = detectDeviceFamilyFromDevice(device);

  logger.debug(`${LOG_CONTEXT} Finding baseline for ${baselineName} on ${device.name} (${targetFamily})`);

  // 1. Try exact device family match
  const exactMatch = await getBaseline(projectName, baselineName, targetFamily);
  if (exactMatch) {
    logger.debug(`${LOG_CONTEXT} Found exact device family match for ${targetFamily}`);
    return {
      baseline: exactMatch,
      deviceFamily: targetFamily,
      exactMatch: true,
      searchedFamily: targetFamily,
    };
  }

  // 2. Try generic baseline (no device family)
  const genericMatch = await getBaseline(projectName, baselineName);
  if (genericMatch) {
    logger.debug(`${LOG_CONTEXT} Found generic baseline (no device family)`);
    return {
      baseline: genericMatch,
      exactMatch: false,
      searchedFamily: targetFamily,
    };
  }

  // 3. Try closest device family
  const closestFamily = findClosestDeviceFamily(targetFamily);
  if (closestFamily) {
    const closestMatch = await getBaseline(projectName, baselineName, closestFamily);
    if (closestMatch) {
      logger.debug(`${LOG_CONTEXT} Found closest device family match: ${closestFamily}`);
      return {
        baseline: closestMatch,
        deviceFamily: closestFamily,
        exactMatch: false,
        searchedFamily: targetFamily,
      };
    }
  }

  // 4. Try any available device family
  for (const family of DEVICE_FAMILIES) {
    if (family === targetFamily) continue;

    const fallbackMatch = await getBaseline(projectName, baselineName, family);
    if (fallbackMatch) {
      logger.debug(`${LOG_CONTEXT} Found fallback baseline from ${family}`);
      return {
        baseline: fallbackMatch,
        deviceFamily: family,
        exactMatch: false,
        searchedFamily: targetFamily,
      };
    }
  }

  logger.debug(`${LOG_CONTEXT} No baseline found for ${baselineName}`);
  return null;
}

/**
 * Find the closest device family to a target family.
 */
function findClosestDeviceFamily(target: DeviceFamily): DeviceFamily | null {
  const targetSize = getDeviceFamilyScreenSize(target);

  let closest: DeviceFamily | null = null;
  let minDiff = Infinity;

  for (const family of DEVICE_FAMILIES) {
    if (family === target) continue;

    const size = getDeviceFamilyScreenSize(family);
    const diff = Math.abs(size.width - targetSize.width) + Math.abs(size.height - targetSize.height);

    if (diff < minDiff) {
      minDiff = diff;
      closest = family;
    }
  }

  return closest;
}

/**
 * Create a baseline with auto-detected device family.
 *
 * @param projectName - Project name
 * @param baselineName - Baseline name
 * @param imagePath - Path to baseline image
 * @param device - Device information
 * @param bundleId - App bundle ID
 * @param options - Additional options
 * @returns Created baseline metadata
 */
export async function createBaselineWithAutoDetect(
  projectName: string,
  baselineName: string,
  imagePath: string,
  device: BaselineDeviceInfo,
  bundleId: string,
  options: {
    appVersion?: string;
    description?: string;
    tags?: string[];
    forceDeviceFamily?: DeviceFamily;
  } = {}
): Promise<{ metadata: BaselineMetadata; deviceFamily: DeviceFamily }> {
  const deviceFamily = options.forceDeviceFamily || detectDeviceFamilyFromDevice(device);

  logger.info(`${LOG_CONTEXT} Creating baseline "${baselineName}" for device family ${deviceFamily}`);

  const metadata = await createBaseline(
    projectName,
    baselineName,
    imagePath,
    device,
    bundleId,
    {
      ...options,
      deviceFamily,
      useDeviceFamilyDir: true,
    }
  );

  return { metadata, deviceFamily };
}

// =============================================================================
// Device Baseline Matrix
// =============================================================================

/**
 * Entry in the device baseline matrix.
 */
export interface DeviceMatrixEntry {
  /** Baseline name */
  name: string;
  /** Device families with baselines for this screen */
  families: DeviceFamily[];
  /** Whether there's a generic (non-device-specific) baseline */
  hasGeneric: boolean;
}

/**
 * Get the device baseline matrix for a project.
 *
 * Returns a matrix showing which baselines exist for which device families.
 *
 * @param projectName - Project name
 * @returns Device baseline matrix
 */
export async function getDeviceBaselineMatrix(
  projectName: string
): Promise<DeviceMatrixEntry[]> {
  const screensPath = getProjectScreensPath(projectName);
  const matrix: Map<string, DeviceMatrixEntry> = new Map();

  // Get all baselines
  const allBaselines = await listBaselines(projectName);

  // Group by name
  for (const baseline of allBaselines) {
    const existing = matrix.get(baseline.name);

    if (existing) {
      if (baseline.deviceFamily) {
        existing.families.push(baseline.deviceFamily);
      } else {
        existing.hasGeneric = true;
      }
    } else {
      matrix.set(baseline.name, {
        name: baseline.name,
        families: baseline.deviceFamily ? [baseline.deviceFamily] : [],
        hasGeneric: !baseline.deviceFamily,
      });
    }
  }

  return Array.from(matrix.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if a baseline exists for a specific device family.
 *
 * @param projectName - Project name
 * @param baselineName - Baseline name
 * @param deviceFamily - Device family to check
 * @returns Whether baseline exists for the device family
 */
export async function hasBaselineForDevice(
  projectName: string,
  baselineName: string,
  deviceFamily: DeviceFamily
): Promise<boolean> {
  const baseline = await getBaseline(projectName, baselineName, deviceFamily);
  return baseline !== null;
}

/**
 * Get missing device families for a baseline.
 *
 * @param projectName - Project name
 * @param baselineName - Baseline name
 * @param targetFamilies - Device families to check (defaults to all)
 * @returns Array of missing device families
 */
export async function getMissingDeviceFamilies(
  projectName: string,
  baselineName: string,
  targetFamilies: DeviceFamily[] = DEVICE_FAMILIES
): Promise<DeviceFamily[]> {
  const missing: DeviceFamily[] = [];

  for (const family of targetFamilies) {
    const exists = await hasBaselineForDevice(projectName, baselineName, family);
    if (!exists) {
      missing.push(family);
    }
  }

  return missing;
}

// =============================================================================
// Baseline Coverage Report
// =============================================================================

/**
 * Coverage statistics for baselines.
 */
export interface BaselineCoverage {
  /** Total unique baseline names */
  totalBaselines: number;
  /** Number with full device family coverage */
  fullCoverage: number;
  /** Number with partial coverage */
  partialCoverage: number;
  /** Number with only generic baseline */
  genericOnly: number;
  /** Coverage by device family */
  byFamily: Record<DeviceFamily, {
    count: number;
    percentage: number;
    baselines: string[];
  }>;
}

/**
 * Generate a coverage report for baselines.
 *
 * @param projectName - Project name
 * @returns Coverage statistics
 */
export async function getBaselineCoverage(projectName: string): Promise<BaselineCoverage> {
  const matrix = await getDeviceBaselineMatrix(projectName);

  const coverage: BaselineCoverage = {
    totalBaselines: matrix.length,
    fullCoverage: 0,
    partialCoverage: 0,
    genericOnly: 0,
    byFamily: {} as Record<DeviceFamily, { count: number; percentage: number; baselines: string[] }>,
  };

  // Initialize family counters
  for (const family of DEVICE_FAMILIES) {
    coverage.byFamily[family] = {
      count: 0,
      percentage: 0,
      baselines: [],
    };
  }

  // Calculate coverage
  for (const entry of matrix) {
    if (entry.families.length === DEVICE_FAMILIES.length) {
      coverage.fullCoverage++;
    } else if (entry.families.length > 0) {
      coverage.partialCoverage++;
    } else if (entry.hasGeneric) {
      coverage.genericOnly++;
    }

    for (const family of entry.families) {
      coverage.byFamily[family].count++;
      coverage.byFamily[family].baselines.push(entry.name);
    }
  }

  // Calculate percentages
  if (matrix.length > 0) {
    for (const family of DEVICE_FAMILIES) {
      coverage.byFamily[family].percentage =
        (coverage.byFamily[family].count / matrix.length) * 100;
    }
  }

  return coverage;
}

/**
 * Format coverage report for display.
 *
 * @param coverage - Coverage statistics
 * @returns Formatted report string
 */
export function formatCoverageReport(coverage: BaselineCoverage): string {
  let report = `## Device Baseline Coverage

**Total Baselines**: ${coverage.totalBaselines}
**Full Device Coverage**: ${coverage.fullCoverage} (all ${DEVICE_FAMILIES.length} families)
**Partial Coverage**: ${coverage.partialCoverage}
**Generic Only**: ${coverage.genericOnly}

### Coverage by Device Family

| Device Family | Baselines | Coverage |
|---------------|-----------|----------|
`;

  for (const family of DEVICE_FAMILIES) {
    const data = coverage.byFamily[family];
    const bar = createProgressBar(data.percentage);
    report += `| ${family} | ${data.count} | ${bar} ${data.percentage.toFixed(0)}% |\n`;
  }

  // Add recommendations
  const lowCoverage = DEVICE_FAMILIES.filter(
    (f) => coverage.byFamily[f].percentage < 50
  );

  if (lowCoverage.length > 0) {
    report += `
### Recommendations

The following device families have low coverage:
`;
    for (const family of lowCoverage) {
      report += `- **${family}**: ${coverage.byFamily[family].count}/${coverage.totalBaselines} baselines\n`;
    }

    report += `
To improve coverage, capture baselines on these device types using:
\`/ios.baseline save <name> --device-family ${lowCoverage[0]}\`
`;
  }

  return report;
}

/**
 * Create a text-based progress bar.
 */
function createProgressBar(percentage: number, width: number = 10): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// =============================================================================
// Auto-Sync Operations
// =============================================================================

/**
 * Options for syncing baselines across device families.
 */
export interface SyncOptions {
  /** Source device family to copy from */
  sourceFamily?: DeviceFamily;
  /** Target device families to copy to */
  targetFamilies?: DeviceFamily[];
  /** Whether to overwrite existing baselines */
  overwrite?: boolean;
  /** Filter baselines by name pattern */
  namePattern?: RegExp;
}

/**
 * Result of syncing baselines.
 */
export interface SyncResult {
  /** Number of baselines synced */
  synced: number;
  /** Number of baselines skipped (already exist) */
  skipped: number;
  /** Synced baseline names */
  syncedNames: string[];
  /** Skipped baseline names */
  skippedNames: string[];
}

/**
 * Copy baselines from one device family to others.
 *
 * This is useful when you want to establish baselines for new device families
 * based on existing ones (with the understanding they may need updates).
 *
 * @param projectName - Project name
 * @param options - Sync options
 * @returns Sync result
 */
export async function syncBaselinesAcrossDevices(
  projectName: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const {
    sourceFamily,
    targetFamilies = DEVICE_FAMILIES,
    overwrite = false,
    namePattern,
  } = options;

  const result: SyncResult = {
    synced: 0,
    skipped: 0,
    syncedNames: [],
    skippedNames: [],
  };

  // Get source baselines
  const sourceBaselines = await listBaselines(projectName, sourceFamily);

  // Filter by pattern if provided
  const filtered = namePattern
    ? sourceBaselines.filter((b) => namePattern.test(b.name))
    : sourceBaselines;

  for (const baseline of filtered) {
    const sourceData = await getBaseline(projectName, baseline.name, sourceFamily);
    if (!sourceData) continue;

    for (const targetFamily of targetFamilies) {
      if (targetFamily === sourceFamily) continue;

      // Check if target exists
      const targetExists = await hasBaselineForDevice(projectName, baseline.name, targetFamily);

      if (targetExists && !overwrite) {
        result.skipped++;
        if (!result.skippedNames.includes(baseline.name)) {
          result.skippedNames.push(baseline.name);
        }
        continue;
      }

      try {
        // Copy the baseline
        await createBaseline(
          projectName,
          baseline.name,
          sourceData.imagePath,
          {
            ...sourceData.metadata.device,
            name: `Synced from ${sourceFamily}`,
          },
          sourceData.metadata.bundleId,
          {
            deviceFamily: targetFamily,
            description: `Synced from ${sourceFamily} baseline`,
            tags: sourceData.metadata.tags,
          }
        );

        result.synced++;
        if (!result.syncedNames.includes(baseline.name)) {
          result.syncedNames.push(baseline.name);
        }
      } catch (error) {
        logger.error(`${LOG_CONTEXT} Failed to sync ${baseline.name} to ${targetFamily}: ${error}`);
      }
    }
  }

  logger.info(
    `${LOG_CONTEXT} Synced ${result.synced} baselines, skipped ${result.skipped}`
  );

  return result;
}
