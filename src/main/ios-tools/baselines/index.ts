/**
 * iOS Tools - Visual Regression Baselines
 *
 * Central export point for baseline management functionality.
 * Provides storage, retrieval, and metadata management for visual
 * regression testing baselines.
 */

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Baseline metadata types
  BaselineMetadata,
  BaselineDeviceInfo,
  ScreenSize,
  // Ignore region types
  IgnoreRegion,
  Rectangle,
  IgnoreReason,
  // Comparison types
  BaselineComparison,
  ChangedRegion,
  ChangeType,
  // Storage types
  ProjectMetadata,
  BaselineEntry,
  DeviceFamily,
  // Flow types
  FlowBaseline,
  FlowBaselineStep,
  // Comparison options
  CompareOptions,
  CompareResult,
  // Export/Import types
  ExportOptions,
  ExportResult,
  ImportOptions,
  ImportResult,
  // Report types
  RegressionReport,
  RegressionSummary,
} from './types';

// =============================================================================
// Metadata Functions
// =============================================================================

export {
  // Constants
  METADATA_FILENAME,
  PROJECT_METADATA_FILENAME,
  MASK_FILENAME,
  // Creation functions
  createBaselineMetadata,
  createProjectMetadata,
  createFlowBaseline,
  // Serialization
  serializeMetadata,
  parseMetadata,
  // File operations
  readBaselineMetadata,
  writeBaselineMetadata,
  readProjectMetadata,
  writeProjectMetadata,
  readFlowBaseline,
  writeFlowBaseline,
  // Update functions
  updateBaselineMetadata,
  updateProjectCounts,
  // Ignore region management
  addIgnoreRegion,
  removeIgnoreRegion,
  updateIgnoreRegion,
  // Common ignore regions
  createStatusBarIgnoreRegion,
  createHomeIndicatorIgnoreRegion,
  createTimestampIgnoreRegion,
  // Flow step operations
  addFlowStep,
  updateFlowStep,
  removeFlowStep,
  // Device family detection
  detectDeviceFamily,
  getDeviceFamilyScreenSize,
} from './metadata';

// =============================================================================
// Storage Functions
// =============================================================================

export {
  // Constants
  BASELINE_IMAGE_FILENAME,
  MASK_IMAGE_FILENAME,
  SCREENS_DIR,
  FLOWS_DIR,
  // Path functions
  getBaselinesBaseDirectory,
  getProjectPath,
  getProjectScreensPath,
  getProjectFlowsPath,
  getBaselinePath,
  getFlowPath,
  // Project management
  ensureProjectExists,
  listProjects,
  deleteProject,
  // Screen baseline operations
  createBaseline,
  updateBaseline,
  getBaseline,
  listBaselines,
  deleteBaseline,
  // Flow baseline operations
  createFlowBaselineStorage,
  getFlowBaselineStorage,
  addFlowStepImage,
  listFlows,
  deleteFlow,
  // Export/Import
  exportBaselines,
  importBaselines,
} from './storage';

// =============================================================================
// Multi-Device Support
// =============================================================================

export {
  // Constants
  DEVICE_FAMILIES,
  DEVICE_FAMILY_RANGES,
  // Device family detection
  detectDeviceFamilyFromScreen,
  detectDeviceFamilyFromDevice,
  // Device-specific baseline operations
  findBestBaselineForDevice,
  createBaselineWithAutoDetect,
  // Device baseline matrix
  getDeviceBaselineMatrix,
  hasBaselineForDevice,
  getMissingDeviceFamilies,
  // Coverage reporting
  getBaselineCoverage,
  formatCoverageReport,
  // Sync operations
  syncBaselinesAcrossDevices,
} from './multi-device';

export type {
  DeviceBaselineMatch,
  DeviceMatrixEntry,
  BaselineCoverage,
  SyncOptions,
  SyncResult,
} from './multi-device';
