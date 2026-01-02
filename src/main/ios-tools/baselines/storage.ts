/**
 * iOS Tools - Baseline Storage Management
 *
 * Functions for storing, retrieving, and managing visual baseline
 * images and their associated metadata.
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { logger } from '../../utils/logger';
import {
  BaselineMetadata,
  BaselineDeviceInfo,
  ProjectMetadata,
  BaselineEntry,
  FlowBaseline,
  ExportOptions,
  ExportResult,
  ImportOptions,
  ImportResult,
  DeviceFamily,
} from './types';
import {
  createBaselineMetadata,
  createProjectMetadata,
  createFlowBaseline,
  readBaselineMetadata,
  writeBaselineMetadata,
  readProjectMetadata,
  writeProjectMetadata,
  readFlowBaseline,
  writeFlowBaseline,
  updateProjectCounts,
  detectDeviceFamily,
  METADATA_FILENAME,
} from './metadata';

const LOG_CONTEXT = '[iOS-Baselines]';

// =============================================================================
// Storage Constants
// =============================================================================

export const BASELINE_IMAGE_FILENAME = 'baseline.png';
export const MASK_IMAGE_FILENAME = 'mask.png';
export const SCREENS_DIR = 'screens';
export const FLOWS_DIR = 'flows';

/**
 * Get the base directory for all iOS baselines.
 * Default: ~/.maestro/ios-baselines/
 */
export function getBaselinesBaseDirectory(): string {
  const userHomeDir = app.getPath('home');
  return path.join(userHomeDir, '.maestro', 'ios-baselines');
}

// =============================================================================
// Project Directory Management
// =============================================================================

/**
 * Get path to a project's baselines directory.
 *
 * @param projectName - Project name/identifier
 * @returns Path to project baselines directory
 */
export function getProjectPath(projectName: string): string {
  return path.join(getBaselinesBaseDirectory(), projectName);
}

/**
 * Get path to a project's screens directory.
 *
 * @param projectName - Project name/identifier
 * @returns Path to screens directory
 */
export function getProjectScreensPath(projectName: string): string {
  return path.join(getProjectPath(projectName), SCREENS_DIR);
}

/**
 * Get path to a project's flows directory.
 *
 * @param projectName - Project name/identifier
 * @returns Path to flows directory
 */
export function getProjectFlowsPath(projectName: string): string {
  return path.join(getProjectPath(projectName), FLOWS_DIR);
}

/**
 * Ensure a project directory structure exists.
 *
 * @param projectName - Project name/identifier
 * @param bundleId - Optional default bundle ID
 * @returns Project metadata
 */
export async function ensureProjectExists(
  projectName: string,
  bundleId?: string
): Promise<ProjectMetadata> {
  const projectPath = getProjectPath(projectName);
  const screensPath = getProjectScreensPath(projectName);
  const flowsPath = getProjectFlowsPath(projectName);

  // Create directories
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(screensPath, { recursive: true });
  await fs.mkdir(flowsPath, { recursive: true });

  // Check for existing metadata
  let metadata = await readProjectMetadata(projectPath);

  if (!metadata) {
    metadata = createProjectMetadata(projectName, bundleId);
    await writeProjectMetadata(projectPath, metadata);
    logger.info(`${LOG_CONTEXT} Created new project: ${projectName}`);
  }

  return metadata;
}

/**
 * List all projects.
 *
 * @returns Array of project names
 */
export async function listProjects(): Promise<string[]> {
  const baseDir = getBaselinesBaseDirectory();

  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Delete a project and all its baselines.
 *
 * @param projectName - Project name to delete
 */
export async function deleteProject(projectName: string): Promise<void> {
  const projectPath = getProjectPath(projectName);

  try {
    await fs.rm(projectPath, { recursive: true, force: true });
    logger.info(`${LOG_CONTEXT} Deleted project: ${projectName}`);
  } catch (error) {
    logger.error(`${LOG_CONTEXT} Error deleting project ${projectName}: ${error}`);
    throw error;
  }
}

// =============================================================================
// Screen Baseline Operations
// =============================================================================

/**
 * Get path to a screen baseline directory.
 *
 * @param projectName - Project name
 * @param baselineName - Baseline name
 * @param deviceFamily - Optional device family for device-specific baselines
 * @returns Path to baseline directory
 */
export function getBaselinePath(
  projectName: string,
  baselineName: string,
  deviceFamily?: DeviceFamily
): string {
  const screensPath = getProjectScreensPath(projectName);

  if (deviceFamily) {
    return path.join(screensPath, deviceFamily, baselineName);
  }

  return path.join(screensPath, baselineName);
}

/**
 * Create a new screen baseline.
 *
 * @param projectName - Project name
 * @param baselineName - Baseline name
 * @param imagePath - Path to the baseline screenshot
 * @param device - Device information
 * @param bundleId - App bundle ID
 * @param options - Additional options
 * @returns Created baseline metadata
 */
export async function createBaseline(
  projectName: string,
  baselineName: string,
  imagePath: string,
  device: BaselineDeviceInfo,
  bundleId: string,
  options: {
    appVersion?: string;
    description?: string;
    tags?: string[];
    deviceFamily?: DeviceFamily;
    useDeviceFamilyDir?: boolean;
  } = {}
): Promise<BaselineMetadata> {
  // Ensure project exists
  await ensureProjectExists(projectName, bundleId);

  // Detect device family if using device-specific directories
  const deviceFamily = options.deviceFamily ||
    (options.useDeviceFamilyDir ? detectDeviceFamily(device.name) : undefined);

  // Get baseline path
  const baselinePath = getBaselinePath(projectName, baselineName, deviceFamily);

  // Check if baseline already exists
  const existing = await readBaselineMetadata(baselinePath);
  if (existing) {
    throw new Error(`Baseline "${baselineName}" already exists. Use updateBaseline to update it.`);
  }

  // Create baseline directory
  await fs.mkdir(baselinePath, { recursive: true });

  // Copy image to baseline directory
  const targetImagePath = path.join(baselinePath, BASELINE_IMAGE_FILENAME);
  await fs.copyFile(imagePath, targetImagePath);

  // Create metadata
  const metadata = createBaselineMetadata(baselineName, device, bundleId, {
    appVersion: options.appVersion,
    description: options.description,
    tags: options.tags,
  });

  // Write metadata
  await writeBaselineMetadata(baselinePath, metadata);

  // Update project counts
  const projectPath = getProjectPath(projectName);
  await updateProjectCounts(projectPath, 1, 0);

  logger.info(`${LOG_CONTEXT} Created baseline: ${projectName}/${baselineName}`);

  return metadata;
}

/**
 * Update an existing baseline with a new image.
 *
 * @param projectName - Project name
 * @param baselineName - Baseline name
 * @param imagePath - Path to the new screenshot
 * @param deviceFamily - Optional device family
 * @returns Updated baseline metadata
 */
export async function updateBaseline(
  projectName: string,
  baselineName: string,
  imagePath: string,
  deviceFamily?: DeviceFamily
): Promise<BaselineMetadata> {
  const baselinePath = getBaselinePath(projectName, baselineName, deviceFamily);

  // Read existing metadata
  const metadata = await readBaselineMetadata(baselinePath);
  if (!metadata) {
    throw new Error(`Baseline "${baselineName}" not found in project "${projectName}"`);
  }

  // Copy new image
  const targetImagePath = path.join(baselinePath, BASELINE_IMAGE_FILENAME);
  await fs.copyFile(imagePath, targetImagePath);

  // Update metadata
  metadata.updatedAt = new Date();
  await writeBaselineMetadata(baselinePath, metadata);

  logger.info(`${LOG_CONTEXT} Updated baseline: ${projectName}/${baselineName}`);

  return metadata;
}

/**
 * Get a baseline by name.
 *
 * @param projectName - Project name
 * @param baselineName - Baseline name
 * @param deviceFamily - Optional device family
 * @returns Baseline metadata and paths, or null if not found
 */
export async function getBaseline(
  projectName: string,
  baselineName: string,
  deviceFamily?: DeviceFamily
): Promise<{
  metadata: BaselineMetadata;
  imagePath: string;
  maskPath?: string;
} | null> {
  const baselinePath = getBaselinePath(projectName, baselineName, deviceFamily);
  const imagePath = path.join(baselinePath, BASELINE_IMAGE_FILENAME);
  const maskPath = path.join(baselinePath, MASK_IMAGE_FILENAME);

  const metadata = await readBaselineMetadata(baselinePath);
  if (!metadata) {
    return null;
  }

  // Check if mask exists
  let hasMask = false;
  try {
    await fs.access(maskPath);
    hasMask = true;
  } catch {
    // No mask file
  }

  return {
    metadata,
    imagePath,
    maskPath: hasMask ? maskPath : undefined,
  };
}

/**
 * List all baselines in a project.
 *
 * @param projectName - Project name
 * @param deviceFamily - Optional device family filter
 * @returns Array of baseline entries
 */
export async function listBaselines(
  projectName: string,
  deviceFamily?: DeviceFamily
): Promise<BaselineEntry[]> {
  const screensPath = getProjectScreensPath(projectName);
  const entries: BaselineEntry[] = [];

  try {
    if (deviceFamily) {
      // List only for specific device family
      const familyPath = path.join(screensPath, deviceFamily);
      const baselines = await listBaselinesInDirectory(familyPath, 'screen', deviceFamily);
      entries.push(...baselines);
    } else {
      // List all baselines, including device-family specific ones
      const dirEntries = await fs.readdir(screensPath, { withFileTypes: true });

      for (const entry of dirEntries) {
        if (!entry.isDirectory()) continue;

        const entryPath = path.join(screensPath, entry.name);

        // Check if this is a device family directory
        if (isDeviceFamily(entry.name)) {
          const baselines = await listBaselinesInDirectory(
            entryPath,
            'screen',
            entry.name as DeviceFamily
          );
          entries.push(...baselines);
        } else {
          // Regular baseline directory
          const metadata = await readBaselineMetadata(entryPath);
          if (metadata) {
            entries.push({
              name: entry.name,
              type: 'screen',
              path: entryPath,
              createdAt: metadata.createdAt,
              updatedAt: metadata.updatedAt,
              tags: metadata.tags,
            });
          }
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Delete a baseline.
 *
 * @param projectName - Project name
 * @param baselineName - Baseline name
 * @param deviceFamily - Optional device family
 */
export async function deleteBaseline(
  projectName: string,
  baselineName: string,
  deviceFamily?: DeviceFamily
): Promise<void> {
  const baselinePath = getBaselinePath(projectName, baselineName, deviceFamily);

  // Verify baseline exists
  const metadata = await readBaselineMetadata(baselinePath);
  if (!metadata) {
    throw new Error(`Baseline "${baselineName}" not found`);
  }

  // Delete directory
  await fs.rm(baselinePath, { recursive: true, force: true });

  // Update project counts
  const projectPath = getProjectPath(projectName);
  await updateProjectCounts(projectPath, -1, 0);

  logger.info(`${LOG_CONTEXT} Deleted baseline: ${projectName}/${baselineName}`);
}

// =============================================================================
// Flow Baseline Operations
// =============================================================================

/**
 * Get path to a flow baseline directory.
 *
 * @param projectName - Project name
 * @param flowName - Flow name
 * @returns Path to flow directory
 */
export function getFlowPath(projectName: string, flowName: string): string {
  return path.join(getProjectFlowsPath(projectName), flowName);
}

/**
 * Create a new flow baseline.
 *
 * @param projectName - Project name
 * @param flowName - Flow name
 * @param device - Device information
 * @param bundleId - App bundle ID
 * @param description - Optional description
 * @returns Created flow baseline
 */
export async function createFlowBaselineStorage(
  projectName: string,
  flowName: string,
  device: BaselineDeviceInfo,
  bundleId: string,
  description?: string
): Promise<FlowBaseline> {
  // Ensure project exists
  await ensureProjectExists(projectName, bundleId);

  const flowPath = getFlowPath(projectName, flowName);

  // Check if flow already exists
  const existing = await readFlowBaseline(flowPath);
  if (existing) {
    throw new Error(`Flow "${flowName}" already exists`);
  }

  // Create flow directory
  await fs.mkdir(flowPath, { recursive: true });

  // Create flow baseline
  const flow = createFlowBaseline(flowName, device, bundleId, description);
  await writeFlowBaseline(flowPath, flow);

  // Update project counts
  const projectPath = getProjectPath(projectName);
  await updateProjectCounts(projectPath, 0, 1);

  logger.info(`${LOG_CONTEXT} Created flow: ${projectName}/${flowName}`);

  return flow;
}

/**
 * Get a flow baseline.
 *
 * @param projectName - Project name
 * @param flowName - Flow name
 * @returns Flow baseline or null if not found
 */
export async function getFlowBaselineStorage(
  projectName: string,
  flowName: string
): Promise<FlowBaseline | null> {
  const flowPath = getFlowPath(projectName, flowName);
  return readFlowBaseline(flowPath);
}

/**
 * Add a step screenshot to a flow.
 *
 * @param projectName - Project name
 * @param flowName - Flow name
 * @param stepNumber - Step number
 * @param stepName - Step name
 * @param imagePath - Path to step screenshot
 * @returns Updated flow baseline
 */
export async function addFlowStepImage(
  projectName: string,
  flowName: string,
  stepNumber: number,
  stepName: string,
  imagePath: string
): Promise<FlowBaseline> {
  const flowPath = getFlowPath(projectName, flowName);
  const flow = await readFlowBaseline(flowPath);

  if (!flow) {
    throw new Error(`Flow "${flowName}" not found in project "${projectName}"`);
  }

  // Copy image to flow directory
  const stepImageName = `step_${stepNumber}.png`;
  const targetPath = path.join(flowPath, stepImageName);
  await fs.copyFile(imagePath, targetPath);

  // Add or update step
  const existingStep = flow.steps.find((s) => s.stepNumber === stepNumber);
  if (existingStep) {
    existingStep.name = stepName;
    existingStep.screenshotPath = targetPath;
    existingStep.capturedAt = new Date();
  } else {
    flow.steps.push({
      stepNumber,
      name: stepName,
      screenshotPath: targetPath,
      capturedAt: new Date(),
    });
    // Sort steps by number
    flow.steps.sort((a, b) => a.stepNumber - b.stepNumber);
  }

  flow.updatedAt = new Date();
  await writeFlowBaseline(flowPath, flow);

  logger.info(`${LOG_CONTEXT} Added step ${stepNumber} to flow: ${projectName}/${flowName}`);

  return flow;
}

/**
 * List all flows in a project.
 *
 * @param projectName - Project name
 * @returns Array of flow baseline entries
 */
export async function listFlows(projectName: string): Promise<BaselineEntry[]> {
  const flowsPath = getProjectFlowsPath(projectName);
  return listBaselinesInDirectory(flowsPath, 'flow');
}

/**
 * Delete a flow baseline.
 *
 * @param projectName - Project name
 * @param flowName - Flow name
 */
export async function deleteFlow(projectName: string, flowName: string): Promise<void> {
  const flowPath = getFlowPath(projectName, flowName);

  // Verify flow exists
  const flow = await readFlowBaseline(flowPath);
  if (!flow) {
    throw new Error(`Flow "${flowName}" not found`);
  }

  // Delete directory
  await fs.rm(flowPath, { recursive: true, force: true });

  // Update project counts
  const projectPath = getProjectPath(projectName);
  await updateProjectCounts(projectPath, 0, -1);

  logger.info(`${LOG_CONTEXT} Deleted flow: ${projectName}/${flowName}`);
}

// =============================================================================
// Export/Import Operations
// =============================================================================

/**
 * Export baselines from a project.
 *
 * @param projectName - Project name
 * @param options - Export options
 * @returns Export result
 */
export async function exportBaselines(
  projectName: string,
  options: ExportOptions
): Promise<ExportResult> {
  const projectPath = getProjectPath(projectName);
  const exportedNames: string[] = [];
  let totalSize = 0;

  // Check project exists
  const projectMetadata = await readProjectMetadata(projectPath);
  if (!projectMetadata) {
    throw new Error(`Project "${projectName}" not found`);
  }

  // Create output directory
  await fs.mkdir(options.outputPath, { recursive: true });

  // Copy project metadata
  const metadataPath = path.join(options.outputPath, METADATA_FILENAME);
  await fs.writeFile(metadataPath, JSON.stringify(projectMetadata, null, 2));

  // Get baselines to export
  const screens = await listBaselines(projectName);
  const flows = await listFlows(projectName);

  // Filter by names if specified
  let filteredScreens = screens;
  let filteredFlows = flows;

  if (options.names && options.names.length > 0) {
    const nameSet = new Set(options.names);
    filteredScreens = screens.filter((s) => nameSet.has(s.name));
    filteredFlows = flows.filter((f) => nameSet.has(f.name));
  }

  // Filter by tags if specified
  if (options.tags && options.tags.length > 0) {
    const tagSet = new Set(options.tags);
    filteredScreens = filteredScreens.filter(
      (s) => s.tags && s.tags.some((t) => tagSet.has(t))
    );
    filteredFlows = filteredFlows.filter(
      (f) => f.tags && f.tags.some((t) => tagSet.has(t))
    );
  }

  // Export screens
  const screensExportPath = path.join(options.outputPath, SCREENS_DIR);
  if (filteredScreens.length > 0) {
    await fs.mkdir(screensExportPath, { recursive: true });

    for (const screen of filteredScreens) {
      const targetPath = path.join(screensExportPath, screen.name);
      await copyDirectory(screen.path, targetPath);
      exportedNames.push(screen.name);
      totalSize += await getDirectorySize(targetPath);
    }
  }

  // Export flows
  const flowsExportPath = path.join(options.outputPath, FLOWS_DIR);
  if (filteredFlows.length > 0) {
    await fs.mkdir(flowsExportPath, { recursive: true });

    for (const flow of filteredFlows) {
      const targetPath = path.join(flowsExportPath, flow.name);
      await copyDirectory(flow.path, targetPath);
      exportedNames.push(flow.name);
      totalSize += await getDirectorySize(targetPath);
    }
  }

  logger.info(
    `${LOG_CONTEXT} Exported ${exportedNames.length} baselines from ${projectName}`
  );

  return {
    path: options.outputPath,
    baselineCount: exportedNames.length,
    totalSize,
    exportedNames,
  };
}

/**
 * Import baselines into a project.
 *
 * @param projectName - Project name
 * @param options - Import options
 * @returns Import result
 */
export async function importBaselines(
  projectName: string,
  options: ImportOptions
): Promise<ImportResult> {
  const importedNames: string[] = [];
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  // Ensure project exists
  await ensureProjectExists(projectName);

  // Check import path
  const stat = await fs.stat(options.inputPath);
  if (!stat.isDirectory()) {
    throw new Error('Import path must be a directory');
  }

  // Import screens
  const screensImportPath = path.join(options.inputPath, SCREENS_DIR);
  try {
    const screenDirs = await fs.readdir(screensImportPath, { withFileTypes: true });

    for (const dir of screenDirs) {
      if (!dir.isDirectory()) continue;

      const name = options.prefix ? `${options.prefix}${dir.name}` : dir.name;
      const sourcePath = path.join(screensImportPath, dir.name);
      const targetPath = getBaselinePath(projectName, name);

      // Filter by name if specified
      if (options.names && options.names.length > 0 && !options.names.includes(dir.name)) {
        continue;
      }

      try {
        // Check if already exists
        const existing = await readBaselineMetadata(targetPath);
        if (existing && !options.overwrite) {
          skipped++;
          continue;
        }

        await copyDirectory(sourcePath, targetPath);
        importedNames.push(name);
      } catch (error) {
        failed++;
        errors.push(`Failed to import ${dir.name}: ${error}`);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  // Import flows
  const flowsImportPath = path.join(options.inputPath, FLOWS_DIR);
  try {
    const flowDirs = await fs.readdir(flowsImportPath, { withFileTypes: true });

    for (const dir of flowDirs) {
      if (!dir.isDirectory()) continue;

      const name = options.prefix ? `${options.prefix}${dir.name}` : dir.name;
      const sourcePath = path.join(flowsImportPath, dir.name);
      const targetPath = getFlowPath(projectName, name);

      // Filter by name if specified
      if (options.names && options.names.length > 0 && !options.names.includes(dir.name)) {
        continue;
      }

      try {
        // Check if already exists
        const existing = await readFlowBaseline(targetPath);
        if (existing && !options.overwrite) {
          skipped++;
          continue;
        }

        await copyDirectory(sourcePath, targetPath);
        importedNames.push(name);
      } catch (error) {
        failed++;
        errors.push(`Failed to import flow ${dir.name}: ${error}`);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  // Update project metadata
  const projectPath = getProjectPath(projectName);
  const screens = await listBaselines(projectName);
  const flows = await listFlows(projectName);

  const projectMetadata = await readProjectMetadata(projectPath);
  if (projectMetadata) {
    projectMetadata.screenCount = screens.length;
    projectMetadata.flowCount = flows.length;
    projectMetadata.updatedAt = new Date();
    await writeProjectMetadata(projectPath, projectMetadata);
  }

  logger.info(
    `${LOG_CONTEXT} Imported ${importedNames.length} baselines into ${projectName} ` +
    `(skipped: ${skipped}, failed: ${failed})`
  );

  return {
    imported: importedNames.length,
    skipped,
    failed,
    importedNames,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * List baselines in a directory.
 */
async function listBaselinesInDirectory(
  dirPath: string,
  type: 'screen' | 'flow',
  deviceFamily?: DeviceFamily
): Promise<BaselineEntry[]> {
  const entries: BaselineEntry[] = [];

  try {
    const dirEntries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of dirEntries) {
      if (!entry.isDirectory()) continue;

      const entryPath = path.join(dirPath, entry.name);

      // Check for metadata
      if (type === 'screen') {
        const metadata = await readBaselineMetadata(entryPath);
        if (metadata) {
          entries.push({
            name: entry.name,
            type,
            path: entryPath,
            createdAt: metadata.createdAt,
            updatedAt: metadata.updatedAt,
            deviceFamily,
            tags: metadata.tags,
          });
        }
      } else {
        const flow = await readFlowBaseline(entryPath);
        if (flow) {
          entries.push({
            name: entry.name,
            type,
            path: entryPath,
            createdAt: flow.createdAt,
            updatedAt: flow.updatedAt,
          });
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return entries;
}

/**
 * Check if a directory name is a device family.
 */
function isDeviceFamily(name: string): boolean {
  const families: DeviceFamily[] = [
    'iPhone-SE',
    'iPhone',
    'iPhone-Plus',
    'iPhone-Pro-Max',
    'iPad',
    'iPad-Pro',
  ];
  return families.includes(name as DeviceFamily);
}

/**
 * Copy a directory recursively.
 */
async function copyDirectory(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });

  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

/**
 * Get directory size recursively.
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        totalSize += stat.size;
      }
    }
  } catch {
    // Ignore errors
  }

  return totalSize;
}
