/**
 * iOS Tools - Baseline Metadata Management
 *
 * Functions for managing baseline metadata - reading, writing,
 * and updating metadata associated with visual baselines.
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger';
import {
  BaselineMetadata,
  BaselineDeviceInfo,
  IgnoreRegion,
  ProjectMetadata,
  FlowBaseline,
  FlowBaselineStep,
  Rectangle,
  IgnoreReason,
  DeviceFamily,
} from './types';

const LOG_CONTEXT = '[iOS-Baselines]';

// =============================================================================
// Metadata File Constants
// =============================================================================

export const METADATA_FILENAME = 'metadata.json';
export const PROJECT_METADATA_FILENAME = 'metadata.json';
export const MASK_FILENAME = 'mask.png';

// =============================================================================
// Metadata Creation
// =============================================================================

/**
 * Create baseline metadata for a new baseline.
 *
 * @param name - Baseline name
 * @param device - Device information
 * @param bundleId - App bundle ID
 * @param options - Additional options
 * @returns New baseline metadata
 */
export function createBaselineMetadata(
  name: string,
  device: BaselineDeviceInfo,
  bundleId: string,
  options: {
    appVersion?: string;
    description?: string;
    tags?: string[];
    ignoreRegions?: IgnoreRegion[];
  } = {}
): BaselineMetadata {
  const now = new Date();

  return {
    name,
    createdAt: now,
    updatedAt: now,
    device,
    bundleId,
    appVersion: options.appVersion,
    ignoreRegions: options.ignoreRegions ?? [],
    description: options.description,
    tags: options.tags,
  };
}

/**
 * Create project metadata for a new baseline project.
 *
 * @param name - Project name
 * @param bundleId - Optional default bundle ID
 * @returns New project metadata
 */
export function createProjectMetadata(name: string, bundleId?: string): ProjectMetadata {
  const now = new Date();

  return {
    name,
    createdAt: now,
    updatedAt: now,
    bundleId,
    screenCount: 0,
    flowCount: 0,
  };
}

/**
 * Create a flow baseline structure.
 *
 * @param name - Flow name
 * @param device - Device information
 * @param bundleId - App bundle ID
 * @param description - Optional description
 * @returns New flow baseline
 */
export function createFlowBaseline(
  name: string,
  device: BaselineDeviceInfo,
  bundleId: string,
  description?: string
): FlowBaseline {
  const now = new Date();

  return {
    name,
    description,
    createdAt: now,
    updatedAt: now,
    steps: [],
    bundleId,
    device,
  };
}

// =============================================================================
// Metadata Serialization
// =============================================================================

/**
 * Serialize metadata to JSON with proper date handling.
 *
 * @param metadata - Metadata to serialize
 * @returns JSON string
 */
export function serializeMetadata<T>(metadata: T): string {
  return JSON.stringify(metadata, null, 2);
}

/**
 * Parse metadata from JSON with date restoration.
 *
 * @param json - JSON string to parse
 * @returns Parsed metadata with Date objects restored
 */
export function parseMetadata<T>(json: string): T {
  return JSON.parse(json, (key, value) => {
    // Restore Date objects for known date fields
    if (
      (key === 'createdAt' || key === 'updatedAt' || key === 'capturedAt') &&
      typeof value === 'string'
    ) {
      return new Date(value);
    }
    return value;
  });
}

// =============================================================================
// Metadata File Operations
// =============================================================================

/**
 * Read baseline metadata from file.
 *
 * @param baselinePath - Path to baseline directory
 * @returns Baseline metadata or null if not found
 */
export async function readBaselineMetadata(
  baselinePath: string
): Promise<BaselineMetadata | null> {
  const metadataPath = path.join(baselinePath, METADATA_FILENAME);

  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return parseMetadata<BaselineMetadata>(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.debug(`${LOG_CONTEXT} No metadata found at ${metadataPath}`);
      return null;
    }
    logger.error(`${LOG_CONTEXT} Error reading metadata: ${error}`);
    throw error;
  }
}

/**
 * Write baseline metadata to file.
 *
 * @param baselinePath - Path to baseline directory
 * @param metadata - Metadata to write
 */
export async function writeBaselineMetadata(
  baselinePath: string,
  metadata: BaselineMetadata
): Promise<void> {
  const metadataPath = path.join(baselinePath, METADATA_FILENAME);

  try {
    await fs.mkdir(baselinePath, { recursive: true });
    await fs.writeFile(metadataPath, serializeMetadata(metadata));
    logger.debug(`${LOG_CONTEXT} Wrote metadata to ${metadataPath}`);
  } catch (error) {
    logger.error(`${LOG_CONTEXT} Error writing metadata: ${error}`);
    throw error;
  }
}

/**
 * Read project metadata.
 *
 * @param projectPath - Path to project baselines directory
 * @returns Project metadata or null if not found
 */
export async function readProjectMetadata(
  projectPath: string
): Promise<ProjectMetadata | null> {
  const metadataPath = path.join(projectPath, PROJECT_METADATA_FILENAME);

  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return parseMetadata<ProjectMetadata>(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    logger.error(`${LOG_CONTEXT} Error reading project metadata: ${error}`);
    throw error;
  }
}

/**
 * Write project metadata.
 *
 * @param projectPath - Path to project baselines directory
 * @param metadata - Project metadata to write
 */
export async function writeProjectMetadata(
  projectPath: string,
  metadata: ProjectMetadata
): Promise<void> {
  const metadataPath = path.join(projectPath, PROJECT_METADATA_FILENAME);

  try {
    await fs.mkdir(projectPath, { recursive: true });
    await fs.writeFile(metadataPath, serializeMetadata(metadata));
    logger.debug(`${LOG_CONTEXT} Wrote project metadata to ${metadataPath}`);
  } catch (error) {
    logger.error(`${LOG_CONTEXT} Error writing project metadata: ${error}`);
    throw error;
  }
}

/**
 * Read flow baseline metadata.
 *
 * @param flowPath - Path to flow baseline directory
 * @returns Flow baseline or null if not found
 */
export async function readFlowBaseline(flowPath: string): Promise<FlowBaseline | null> {
  const metadataPath = path.join(flowPath, METADATA_FILENAME);

  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return parseMetadata<FlowBaseline>(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    logger.error(`${LOG_CONTEXT} Error reading flow baseline: ${error}`);
    throw error;
  }
}

/**
 * Write flow baseline metadata.
 *
 * @param flowPath - Path to flow baseline directory
 * @param flow - Flow baseline to write
 */
export async function writeFlowBaseline(
  flowPath: string,
  flow: FlowBaseline
): Promise<void> {
  const metadataPath = path.join(flowPath, METADATA_FILENAME);

  try {
    await fs.mkdir(flowPath, { recursive: true });
    await fs.writeFile(metadataPath, serializeMetadata(flow));
    logger.debug(`${LOG_CONTEXT} Wrote flow baseline to ${metadataPath}`);
  } catch (error) {
    logger.error(`${LOG_CONTEXT} Error writing flow baseline: ${error}`);
    throw error;
  }
}

// =============================================================================
// Metadata Updates
// =============================================================================

/**
 * Update baseline metadata with new values.
 *
 * @param baselinePath - Path to baseline directory
 * @param updates - Partial metadata updates
 * @returns Updated metadata
 */
export async function updateBaselineMetadata(
  baselinePath: string,
  updates: Partial<Omit<BaselineMetadata, 'name' | 'createdAt'>>
): Promise<BaselineMetadata> {
  const existing = await readBaselineMetadata(baselinePath);

  if (!existing) {
    throw new Error(`No baseline metadata found at ${baselinePath}`);
  }

  const updated: BaselineMetadata = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  await writeBaselineMetadata(baselinePath, updated);
  return updated;
}

/**
 * Update project metadata counts.
 *
 * @param projectPath - Path to project directory
 * @param screenDelta - Change in screen count
 * @param flowDelta - Change in flow count
 */
export async function updateProjectCounts(
  projectPath: string,
  screenDelta: number,
  flowDelta: number
): Promise<void> {
  const existing = await readProjectMetadata(projectPath);

  if (!existing) {
    throw new Error(`No project metadata found at ${projectPath}`);
  }

  const updated: ProjectMetadata = {
    ...existing,
    screenCount: Math.max(0, existing.screenCount + screenDelta),
    flowCount: Math.max(0, existing.flowCount + flowDelta),
    updatedAt: new Date(),
  };

  await writeProjectMetadata(projectPath, updated);
}

// =============================================================================
// Ignore Region Management
// =============================================================================

/**
 * Add an ignore region to a baseline.
 *
 * @param baselinePath - Path to baseline directory
 * @param region - Ignore region to add
 * @returns Updated metadata
 */
export async function addIgnoreRegion(
  baselinePath: string,
  region: IgnoreRegion
): Promise<BaselineMetadata> {
  const metadata = await readBaselineMetadata(baselinePath);

  if (!metadata) {
    throw new Error(`No baseline metadata found at ${baselinePath}`);
  }

  // Check for duplicate names
  if (metadata.ignoreRegions.some((r) => r.name === region.name)) {
    throw new Error(`Ignore region "${region.name}" already exists`);
  }

  metadata.ignoreRegions.push(region);
  metadata.updatedAt = new Date();

  await writeBaselineMetadata(baselinePath, metadata);
  return metadata;
}

/**
 * Remove an ignore region from a baseline.
 *
 * @param baselinePath - Path to baseline directory
 * @param regionName - Name of region to remove
 * @returns Updated metadata
 */
export async function removeIgnoreRegion(
  baselinePath: string,
  regionName: string
): Promise<BaselineMetadata> {
  const metadata = await readBaselineMetadata(baselinePath);

  if (!metadata) {
    throw new Error(`No baseline metadata found at ${baselinePath}`);
  }

  const index = metadata.ignoreRegions.findIndex((r) => r.name === regionName);
  if (index === -1) {
    throw new Error(`Ignore region "${regionName}" not found`);
  }

  metadata.ignoreRegions.splice(index, 1);
  metadata.updatedAt = new Date();

  await writeBaselineMetadata(baselinePath, metadata);
  return metadata;
}

/**
 * Update an existing ignore region.
 *
 * @param baselinePath - Path to baseline directory
 * @param regionName - Name of region to update
 * @param updates - Partial region updates
 * @returns Updated metadata
 */
export async function updateIgnoreRegion(
  baselinePath: string,
  regionName: string,
  updates: Partial<Omit<IgnoreRegion, 'name'>>
): Promise<BaselineMetadata> {
  const metadata = await readBaselineMetadata(baselinePath);

  if (!metadata) {
    throw new Error(`No baseline metadata found at ${baselinePath}`);
  }

  const region = metadata.ignoreRegions.find((r) => r.name === regionName);
  if (!region) {
    throw new Error(`Ignore region "${regionName}" not found`);
  }

  Object.assign(region, updates);
  metadata.updatedAt = new Date();

  await writeBaselineMetadata(baselinePath, metadata);
  return metadata;
}

// =============================================================================
// Common Ignore Regions
// =============================================================================

/**
 * Create standard status bar ignore region.
 *
 * @param screenWidth - Screen width in points
 * @returns Status bar ignore region
 */
export function createStatusBarIgnoreRegion(screenWidth: number): IgnoreRegion {
  return {
    name: 'status_bar',
    rect: {
      x: 0,
      y: 0,
      width: screenWidth,
      height: 54, // Standard iOS status bar height with Dynamic Island
    },
    reason: 'status_bar',
    description: 'iOS status bar with time, battery, and signal indicators',
  };
}

/**
 * Create standard home indicator ignore region.
 *
 * @param screenWidth - Screen width in points
 * @param screenHeight - Screen height in points
 * @returns Home indicator ignore region
 */
export function createHomeIndicatorIgnoreRegion(
  screenWidth: number,
  screenHeight: number
): IgnoreRegion {
  return {
    name: 'home_indicator',
    rect: {
      x: 0,
      y: screenHeight - 34,
      width: screenWidth,
      height: 34, // Standard home indicator safe area
    },
    reason: 'dynamic_content',
    description: 'iOS home indicator area',
  };
}

/**
 * Create an ignore region for a timestamp element.
 *
 * @param rect - Rectangle bounds of the timestamp
 * @param name - Optional name for the region
 * @returns Timestamp ignore region
 */
export function createTimestampIgnoreRegion(
  rect: Rectangle,
  name: string = 'timestamp'
): IgnoreRegion {
  return {
    name,
    rect,
    reason: 'timestamp',
    description: 'Dynamic timestamp that changes between runs',
  };
}

// =============================================================================
// Flow Step Operations
// =============================================================================

/**
 * Add a step to a flow baseline.
 *
 * @param flowPath - Path to flow baseline directory
 * @param step - Step to add
 * @returns Updated flow baseline
 */
export async function addFlowStep(
  flowPath: string,
  step: Omit<FlowBaselineStep, 'capturedAt'>
): Promise<FlowBaseline> {
  const flow = await readFlowBaseline(flowPath);

  if (!flow) {
    throw new Error(`No flow baseline found at ${flowPath}`);
  }

  const newStep: FlowBaselineStep = {
    ...step,
    capturedAt: new Date(),
  };

  flow.steps.push(newStep);
  flow.updatedAt = new Date();

  await writeFlowBaseline(flowPath, flow);
  return flow;
}

/**
 * Update a step in a flow baseline.
 *
 * @param flowPath - Path to flow baseline directory
 * @param stepNumber - Step number to update
 * @param updates - Partial step updates
 * @returns Updated flow baseline
 */
export async function updateFlowStep(
  flowPath: string,
  stepNumber: number,
  updates: Partial<Omit<FlowBaselineStep, 'stepNumber'>>
): Promise<FlowBaseline> {
  const flow = await readFlowBaseline(flowPath);

  if (!flow) {
    throw new Error(`No flow baseline found at ${flowPath}`);
  }

  const step = flow.steps.find((s) => s.stepNumber === stepNumber);
  if (!step) {
    throw new Error(`Step ${stepNumber} not found in flow`);
  }

  Object.assign(step, updates);
  if (updates.screenshotPath) {
    step.capturedAt = new Date();
  }
  flow.updatedAt = new Date();

  await writeFlowBaseline(flowPath, flow);
  return flow;
}

/**
 * Remove a step from a flow baseline.
 *
 * @param flowPath - Path to flow baseline directory
 * @param stepNumber - Step number to remove
 * @returns Updated flow baseline
 */
export async function removeFlowStep(
  flowPath: string,
  stepNumber: number
): Promise<FlowBaseline> {
  const flow = await readFlowBaseline(flowPath);

  if (!flow) {
    throw new Error(`No flow baseline found at ${flowPath}`);
  }

  const index = flow.steps.findIndex((s) => s.stepNumber === stepNumber);
  if (index === -1) {
    throw new Error(`Step ${stepNumber} not found in flow`);
  }

  flow.steps.splice(index, 1);

  // Renumber remaining steps
  flow.steps.forEach((step, i) => {
    step.stepNumber = i + 1;
  });

  flow.updatedAt = new Date();

  await writeFlowBaseline(flowPath, flow);
  return flow;
}

// =============================================================================
// Device Family Detection
// =============================================================================

/**
 * Detect device family from device name.
 *
 * @param deviceName - Device name (e.g., "iPhone 15 Pro Max")
 * @returns Device family
 */
export function detectDeviceFamily(deviceName: string): DeviceFamily {
  const nameLower = deviceName.toLowerCase();

  if (nameLower.includes('ipad pro')) {
    return 'iPad-Pro';
  }
  if (nameLower.includes('ipad')) {
    return 'iPad';
  }
  if (nameLower.includes('se')) {
    return 'iPhone-SE';
  }
  if (nameLower.includes('pro max') || nameLower.includes('plus')) {
    return 'iPhone-Pro-Max';
  }
  if (nameLower.includes('max')) {
    return 'iPhone-Plus';
  }

  return 'iPhone';
}

/**
 * Get common screen size for a device family.
 *
 * @param family - Device family
 * @returns Common screen size
 */
export function getDeviceFamilyScreenSize(family: DeviceFamily): { width: number; height: number } {
  switch (family) {
    case 'iPhone-SE':
      return { width: 375, height: 667 };
    case 'iPhone':
      return { width: 390, height: 844 };
    case 'iPhone-Plus':
      return { width: 414, height: 896 };
    case 'iPhone-Pro-Max':
      return { width: 430, height: 932 };
    case 'iPad':
      return { width: 810, height: 1080 };
    case 'iPad-Pro':
      return { width: 1024, height: 1366 };
    default:
      return { width: 390, height: 844 };
  }
}
