/**
 * iOS Tools - Main Module Exports
 *
 * Central export point for all iOS tooling functionality.
 * This module provides a clean API for:
 * - Xcode detection and validation
 * - Simulator management
 * - Screenshot and video capture
 * - Log collection
 */

// =============================================================================
// Type Exports
// =============================================================================

export * from './types';

// =============================================================================
// Xcode Functions
// =============================================================================

export {
  detectXcode,
  getXcodeVersion,
  validateXcodeInstallation,
  getXcodeInfo,
  listSDKs,
} from './xcode';

// =============================================================================
// Build Functions
// =============================================================================

export {
  // Project detection
  detectProject,
  // Scheme/Target listing
  listSchemes,
  listTargets,
  // Build operations
  build,
  buildForTesting,
  // Derived data
  getDefaultDerivedDataPath,
  getDerivedDataPath,
  getBuiltAppPath,
  // Build settings
  getBuildSettings,
} from './build';
export type {
  ProjectType,
  XcodeProject,
  XcodeScheme,
  XcodeTarget,
  BuildOptions,
  BuildResult,
  BuildProgressCallback,
  BuildProgress,
} from './build';

// =============================================================================
// Test Functions
// =============================================================================

export {
  runTests,
  runUITests,
  parseTestResults,
  listTests,
} from './testing';
export type {
  TestRunOptions,
  TestCaseResult,
  PerformanceMetric,
  TestSuiteResult,
  TestRunResult,
  TestInfo,
  XCResultInfo,
} from './testing';

// =============================================================================
// Simulator Functions
// =============================================================================

export {
  // Listing
  listSimulators,
  listSimulatorsByRuntime,
  getBootedSimulators,
  getSimulator,
  // Lifecycle
  bootSimulator,
  waitForSimulatorBoot,
  shutdownSimulator,
  eraseSimulator,
  // App Installation
  installApp,
  uninstallApp,
  // App Lifecycle
  launchApp,
  terminateApp,
  // App Data
  getAppContainer,
  // Deep Links
  openURL,
} from './simulator';

// =============================================================================
// Capture Functions
// =============================================================================

export {
  screenshot,
  captureScreenshot,
  startRecording,
  stopRecording,
  isRecording,
  getScreenSize,
} from './capture';

// =============================================================================
// Log Functions
// =============================================================================

export {
  getSystemLog,
  getSystemLogText,
  getCrashLogs,
  getDiagnostics,
  hasRecentCrashes,
  // Real-time log streaming
  streamLog,
  stopLogStream,
  getActiveLogStreams,
  stopAllLogStreams,
} from './logs';

// =============================================================================
// Snapshot Functions
// =============================================================================

export { captureSnapshot } from './snapshot';
export type { SnapshotOptions, SnapshotResult } from './snapshot';

// =============================================================================
// Snapshot Formatters
// =============================================================================

export {
  formatSnapshotForAgent,
  formatSnapshotAsJson,
  summarizeLog,
} from './snapshot-formatter';
export type { FormattedSnapshot } from './snapshot-formatter';

// =============================================================================
// Artifact Management
// =============================================================================

export {
  getArtifactDirectory,
  getSnapshotDirectory,
  generateSnapshotId,
  listSessionArtifacts,
  pruneSessionArtifacts,
  getSessionArtifactsSize,
} from './artifacts';

// =============================================================================
// UI Inspection
// =============================================================================

// Simple inspection using simctl ui describe
export { inspect } from './inspect-simple';
export type {
  UIElement,
  InspectOptions,
  InspectResult,
} from './inspect-simple';

// XCUITest-based inspection (more detailed)
export { inspectWithXCUITest } from './inspect';
export type {
  XCUITestInspectOptions,
  XCUITestInspectResult,
  ElementNode,
  ElementFrame,
  AccessibilityWarning,
} from './inspect';

// =============================================================================
// UI Analysis
// =============================================================================

export {
  findElements,
  findElement,
  findByIdentifier,
  findByLabel,
  findByType,
  findByText,
  getInteractableElements,
  getButtons,
  getTextFields,
  getTextInputs,
  getTextElements,
  getNavigationElements,
  isInteractable,
  isTextElement,
  getSuggestedAction,
  describeElement,
  getBestIdentifier,
  filterVisible,
  filterEnabled,
  filterActive,
  sortByPosition,
  detectIssues,
  summarizeScreen,
} from './ui-analyzer';
export type {
  ElementQuery,
  QueryResult,
  InteractableElement,
  AccessibilityIssueType,
  AccessibilityIssue,
  AccessibilityIssueResult,
  ScreenSummary,
} from './ui-analyzer';

// =============================================================================
// Inspect Formatters
// =============================================================================

export {
  formatInspectForAgent,
  formatInspectAsJson,
  formatInspectAsElementList,
  formatInspectCompact,
  formatElementQuery,
  formatElementQueryTable,
  formatActionSuggestions,
} from './inspect-formatter';
export type {
  FormattedInspect,
  FormatOptions,
} from './inspect-formatter';

// =============================================================================
// Inspect Error Handling
// =============================================================================

export {
  detectInspectError,
  createAppNotRunningError,
  createAppCrashedError,
  createBuildFailedError,
  createSigningError,
  createDependencyMissingError,
  createTimeoutError,
  createEmptyUITreeError,
  createLoadingStateError,
  createGenericInspectError,
  formatInspectError,
  formatInspectErrorCompact,
  wrapInspectError,
  isInspectErrorType,
  isRecoverableError,
  getRetryDelay,
  analyzeInspectionOutput,
} from './inspect-errors';
export type {
  InspectErrorCode,
  InspectError,
} from './inspect-errors';

// =============================================================================
// Utility Functions
// =============================================================================

export {
  runSimctl,
  runXcrun,
  runXcodeSelect,
  runXcodebuild,
  parseSimctlJson,
  parseJson,
  parseXcodebuildOutput,
  waitFor,
  sleep,
  createError,
  createFailure,
  parseIOSVersionFromRuntime,
  parseDeviceTypeName,
} from './utils';
export type {
  BuildDiagnostic,
  BuildPhase,
  CompilationStep,
  LinkerStep,
  ParsedXcodebuildOutput,
} from './utils';

// =============================================================================
// Maestro CLI Integration
// =============================================================================

export {
  runMaestro,
  detectMaestroCli,
  isMaestroAvailable,
  getMaestroInfo,
  validateMaestroVersion,
  getInstallInstructions,
  installMaestro,
  validateMaestroSetup,
} from './maestro-cli';
export type {
  MaestroInfo,
  MaestroDetectResult,
  MaestroInstallMethod,
  InstallMaestroOptions,
  InstallMaestroResult,
  MaestroSetupValidation,
} from './maestro-cli';

// =============================================================================
// Flow Generation
// =============================================================================

export {
  // Main generators
  generateFlow,
  generateFlowFile,
  generateFlowFromStrings,
  parseActionString,
  // Step helper functions (some suffixed with "Step" to avoid conflicts)
  tap,
  inputText,
  scroll,
  screenshotStep,
  assertVisible as assertVisibleStep,  // Renamed to avoid conflict with assertions
  assertNotVisible as assertNotVisibleStep,  // Renamed to avoid conflict with assertions
  waitForStep,
  swipe,
  launchAppStep,
  stopApp as stopAppStep,  // Also rename for consistency
  openLink,
  pressKey,
  hideKeyboard,
  eraseText,
  wait,
  copyTextFrom,
} from './flow-generator';
export type {
  // Step types
  FlowStep,
  FlowStepBase,
  TapStep,
  InputTextStep,
  ScrollStep,
  ScreenshotStep,
  AssertVisibleStep,
  AssertNotVisibleStep,
  WaitForStep,
  SwipeStep,
  LaunchAppStep,
  StopAppStep,
  OpenLinkStep,
  PressKeyStep,
  HideKeyboardStep,
  EraseTextStep,
  WaitStep,
  CopyTextStep,
  // Configuration types
  FlowConfig,
  FlowDefinition,
  GeneratedFlow,
} from './flow-generator';

// =============================================================================
// Flow Execution
// =============================================================================

export {
  runFlow,
  runFlowWithRetry,
  runFlows,
  validateFlow,
  validateFlowWithMaestro,
} from './flow-runner';
export type {
  FlowRunOptions,
  FlowRunWithRetryOptions,
  FlowStepResult,
  FlowRunResult,
  BatchFlowResult,
} from './flow-runner';

// =============================================================================
// Action Formatting
// =============================================================================

export {
  formatFlowResult,
  formatFlowResultAsJson,
  formatFlowResultCompact,
  formatBatchFlowResult,
  formatStepsTable,
  formatStatusBadge,
  formatDuration,
  formatProgressBar,
} from './action-formatter';
export type {
  FlowFormatOptions,
  FormattedFlowResult,
} from './action-formatter';

// =============================================================================
// Verification Infrastructure
// =============================================================================

export {
  pollUntil,
  withRetry,
  verifyWithPollingAndRetry,
  generateVerificationId,
  buildVerificationResult,
  createPassedResult,
  createFailedResult,
  createTimeoutResult,
  createErrorResult,
  calculateRetryDelay,
  mergePollingOptions,
  mergeRetryPolicy,
} from './verification';
export type {
  RetryPolicy,
  PollingOptions,
  AssertionBaseOptions,
  VerificationStatus,
  VerificationAttempt,
  VerificationResult,
  VerificationCheck,
} from './verification';

// =============================================================================
// Assertions
// =============================================================================

export {
  // Visibility assertions
  assertVisible,
  assertVisibleById,
  assertVisibleByLabel,
  assertVisibleByText,
  assertNotVisible,
  // Wait for assertions (renamed to avoid conflict with utils.waitFor)
  waitFor as waitForElement,
  waitForById as waitForElementById,
  waitForByLabel as waitForElementByLabel,
  waitForByText as waitForElementByText,
  waitForNot as waitForElementNot,
  waitForNotById as waitForElementNotById,
  waitForNotByLabel as waitForElementNotByLabel,
  waitForNotByText as waitForElementNotByText,
  // Text assertions
  assertText,
  assertTextById,
  assertTextByLabel,
  assertTextContains,
  assertTextMatches,
  assertTextStartsWith,
  assertTextEndsWith,
  // Value assertions
  assertValue,
  assertValueById,
  assertValueByLabel,
  assertValueContains,
  assertValueMatches,
  assertValueStartsWith,
  assertValueEndsWith,
  assertValueEmpty,
  assertValueNotEmpty,
  // Enabled/Disabled assertions
  assertEnabled,
  assertEnabledById,
  assertEnabledByLabel,
  assertEnabledByText,
  assertDisabled,
  assertDisabledById,
  assertDisabledByLabel,
  assertDisabledByText,
  // Selected assertions
  assertSelected,
  assertSelectedById,
  assertSelectedByLabel,
  assertSelectedByText,
  assertNotSelected,
  assertNotSelectedById,
  assertNotSelectedByLabel,
  assertNotSelectedByText,
  // Hittable assertions
  assertHittable,
  assertHittableById,
  assertHittableByLabel,
  assertHittableByText,
  assertNotHittable,
  assertNotHittableById,
  assertNotHittableByLabel,
  assertNotHittableByText,
  // Crash assertions
  assertNoCrash,
  hasCrashed,
  waitForNoCrash,
  assertNoCrashInWindow,
  // Error log assertions
  assertNoErrors,
  countErrors,
  hasErrorPattern,
  assertNoErrorsForApp,
  assertNoHttpErrors,
  assertNoCrashIndicators,
  DEFAULT_ERROR_PATTERNS,
  DEFAULT_IGNORE_PATTERNS,
  // Log contains assertions
  assertLogContains,
  assertLogContainsPattern,
  assertLogContainsExact,
  assertLogMatches,
  assertLogNotContains,
  assertLogContainsForApp,
  countLogMatches,
  hasLogPattern,
  waitForLogPattern,
  waitForLogPatternGone,
  // Screen assertions (compound)
  assertScreen,
  assertScreenByName,
  createScreenDefinition,
  parseScreenDefinition,
} from './assertions';
export type {
  // Visibility types
  ElementTarget,
  AssertVisibleOptions,
  VisibleAssertionData,
  // Wait for types
  WaitForTarget,
  WaitForOptions,
  WaitForData,
  // Text assertion types
  TextMatchMode,
  TextElementTarget,
  AssertTextOptions,
  TextAssertionData,
  // Value assertion types
  ValueMatchMode,
  ValueElementTarget,
  AssertValueOptions,
  ValueAssertionData,
  // Enabled/Disabled assertion types
  EnabledElementTarget,
  AssertEnabledOptions,
  EnabledAssertionData,
  // Selected assertion types
  SelectedElementTarget,
  AssertSelectedOptions,
  SelectedAssertionData,
  // Hittable assertion types
  HittableElementTarget,
  AssertHittableOptions,
  ElementPosition,
  ObscuringElementInfo,
  HittableAssertionData,
  // Crash types
  AssertNoCrashOptions,
  NoCrashAssertionData,
  // Error log types
  AssertNoErrorsOptions,
  NoErrorsAssertionData,
  MatchedError,
  // Log contains types
  LogMatchMode,
  MatchedLogEntry,
  AssertLogContainsOptions,
  LogContainsAssertionData,
  // Screen assertion types
  ElementSpec,
  ScreenDefinition,
  AssertScreenOptions,
  ElementCheckResult,
  ScreenAssertionData,
} from './assertions';

// =============================================================================
// Verification Formatting
// =============================================================================

export {
  formatVerificationResult,
  formatVerificationAsJson,
  formatVerificationCompact,
  formatVerificationBatch,
  formatDuration as formatVerificationDuration,
  formatProgressBar as formatVerificationProgressBar,
  formatStatusBadge as formatVerificationStatusBadge,
} from './verification-formatter';
export type {
  VerificationFormatOptions,
  FormattedVerification,
} from './verification-formatter';

// =============================================================================
// Feature Ship Loop
// =============================================================================

export {
  runShipLoop,
  formatShipLoopResult,
  formatShipLoopResultAsJson,
  formatShipLoopResultCompact,
} from './ship-loop';
export type {
  AssertionType,
  AssertionSpec,
  ShipLoopOptions,
  IterationResult,
  ShipLoopProgress,
  ShipLoopResult,
} from './ship-loop';

// =============================================================================
// Error Handling
// =============================================================================

export {
  ERROR_MESSAGES,
  ERROR_PATTERNS,
  formatErrorForUser,
  getTroubleshootingHint,
  detectErrorType,
  createUserFriendlyError,
  wrapCommandError,
  validateSimulatorBooted,
  validateBundleId,
  noBootedSimulatorError,
  simulatorNotFoundError,
  appNotInstalledError,
  permissionDeniedError,
  screenshotTimeoutError,
  logParsingWarning,
} from './errors';

// =============================================================================
// XCUITest Project Management
// =============================================================================

export {
  createInspectorProject,
  buildInspector,
  runInspector,
  parseInspectorOutput,
  cleanupInspectorProject,
  getCachedInspector,
  clearInspectorCache,
} from './xcuitest-project';
export type {
  CreateProjectOptions,
  CreateProjectResult,
  BuildInspectorOptions,
  BuildInspectorResult,
  RunInspectorOptions,
  RunInspectorResult,
} from './xcuitest-project';

// =============================================================================
// Native XCUITest Driver
// =============================================================================

export {
  // Driver class and factory
  NativeDriver,
  createNativeDriver,
  // Target helpers
  byId,
  byLabel,
  byText,
  byPredicate,
  byCoordinates,
  byType,
  // Action helpers
  tap as nativeTap,
  doubleTap as nativeDoubleTap,
  longPress as nativeLongPress,
  typeText as nativeTypeText,
  clearText as nativeClearText,
  scroll as nativeScroll,
  scrollTo as nativeScrollTo,
  swipe as nativeSwipe,
  pinch as nativePinch,
  rotate as nativeRotate,
  waitForElement as nativeWaitForElement,
  waitForNotExist as nativeWaitForNotExist,
  assertExists as nativeAssertExists,
  assertNotExists as nativeAssertNotExists,
  assertEnabled as nativeAssertEnabled,
  assertDisabled as nativeAssertDisabled,
} from './native-driver';
export type {
  ActionTarget as NativeActionTarget,
  SwipeDirection as NativeSwipeDirection,
  SwipeVelocity as NativeSwipeVelocity,
  ActionType as NativeActionType,
  ActionStatus as NativeActionStatus,
  ActionRequest as NativeActionRequest,
  ActionResult as NativeActionResult,
  BatchActionResult as NativeBatchActionResult,
  ElementInfo as NativeElementInfo,
  ActionDetails as NativeActionDetails,
  NativeDriverOptions,
} from './native-driver';

// =============================================================================
// Action Recording
// =============================================================================

export {
  // Session management (renamed to avoid conflicts with video recording)
  startRecording as startActionRecording,
  stopRecording as stopActionRecording,
  pauseRecording as pauseActionRecording,
  resumeRecording as resumeActionRecording,
  cancelRecording as cancelActionRecording,
  isRecordingActive as isActionRecordingActive,
  getCurrentSession as getActionRecordingSession,
  getRecordingStats as getActionRecordingStats,
  // Individual action recording
  recordTap,
  recordDoubleTap,
  recordLongPress,
  recordType,
  recordScroll,
  recordSwipe,
  recordLaunchApp,
  recordTerminateApp,
  recordScreenshot,
  annotateLastAction,
  // Conversion functions
  convertToFlowSteps,
  convertToNativeActions,
  exportToMaestroYaml,
  exportToNativeActions,
} from './action-recorder';
export type {
  RecordedActionType,
  RecordedAction,
  RecordedElement,
  RecordingOptions as ActionRecordingOptions,
  RecordingState as ActionRecordingState,
  RecordingSession as ActionRecordingSession,
  StopRecordingResult as StopActionRecordingResult,
  StopRecordingOptions as StopActionRecordingOptions,
} from './action-recorder';

// =============================================================================
// Action Validation
// =============================================================================

export {
  validateTarget,
  suggestAlternatives,
  checkHittable,
  validateForAction,
  targetExists,
  getElementCenter,
} from './action-validator';
export type {
  NotHittableReason,
  ValidationResult,
  SuggestedTarget,
  HittabilityResult,
  ValidationOptions,
} from './action-validator';

// =============================================================================
// Interaction Error Handling
// =============================================================================

export {
  // Error code mapping
  mapNotHittableReasonToCode,
  mapActionStatusToCode,
  // Error message constants
  INTERACTION_ERROR_MESSAGES,
  // Error creation functions
  createElementNotFoundError,
  createElementNotHittableError,
  createMaestroNotInstalledError,
  createFlowTimeoutError,
  createAppCrashedError as createInteractionAppCrashedError,  // Renamed to avoid conflict with inspect-errors
  createErrorFromActionResult,
  createErrorFromValidationResult,
  // Error formatting
  formatInteractionError,
  formatInteractionErrorAsJson,
  formatInteractionErrorCompact,
  // Utility functions
  formatTarget as formatActionTarget,  // Renamed to avoid ambiguity
  createIOSResultFromError,
  hasElementSuggestions,
  getBestSuggestion,
} from './interaction-errors';
export type {
  InteractionErrorCode,
  InteractionError,
} from './interaction-errors';

// =============================================================================
// Playbooks
// =============================================================================

export {
  runFeatureShipLoop,
  formatFeatureShipLoopResult,
  formatFeatureShipLoopResultAsJson,
  formatFeatureShipLoopResultCompact,
} from './playbooks';
export type {
  PlaybookAssertion,
  FeatureShipLoopInputs,
  FeatureShipLoopOptions,
  FeatureShipLoopProgress,
  FeatureShipLoopIterationResult,
  FeatureShipLoopResult,
} from './playbooks';

// =============================================================================
// Playbook Loader
// =============================================================================

export {
  ensurePlaybooksDirectory,
  loadPlaybook,
  listPlaybooks,
  validatePlaybook,
  getPlaybookInfo,
  playbookExists,
  getPlaybookTemplatesDir,
  getPlaybookBaselinesDir,
  getCommonFlowsDir,
  getCommonScreensDir,
  getCommonAssertionsDir,
  BUILTIN_PLAYBOOKS,
} from './playbook-loader';
export type {
  PlaybookInputDef,
  PlaybookStepDef,
  PlaybookVariables,
  IOSPlaybookConfig,
  PlaybookInfo,
  PlaybookValidationResult,
  BuiltInPlaybookId,
} from './playbook-loader';

// =============================================================================
// Playbook Runner
// =============================================================================

export {
  runPlaybook,
  formatPlaybookResult,
  formatPlaybookResultAsJson,
  formatPlaybookResultAsText,
  formatPlaybookResultCompact,
  resolveValue,
  resolveObject,
  evaluateExpression,
  evaluateCondition,
} from './playbook-runner';
export type {
  ActionHandler,
  ActionRegistry,
  RunPlaybookOptions,
  PlaybookProgress,
  StepExecutionEvent,
  ExecutionContext,
  LoopContext,
  PlaybookRunResult,
  StepResult,
} from './playbook-runner';

// =============================================================================
// MaestroBridge Client
// =============================================================================

export {
  // Main client class
  BridgeClient,
  // Discovery functions
  discoverBridge,
  discoverBridgePort,
  extractTokenFromLogs,
  createBridgeClient,
  // Cached client management
  getCachedBridgeClient,
  clearCachedBridgeClient,
  clearAllCachedBridgeClients,
  // Convenience functions
  waitForBridge,
  // Constants
  DEFAULT_BRIDGE_PORTS,
  DEFAULT_BRIDGE_HOST,
  DEFAULT_TIMEOUT,
} from './bridge-client';
export type {
  BridgeConfig,
  AppState,
  RouteInfo,
  NetworkRequestEntry,
  NetworkLog,
  AnalyticsEvent,
  AnalyticsLog,
  FeatureFlagEntry,
  FeatureFlags,
  BridgeDiscoveryResult,
} from './bridge-client';

// =============================================================================
// MaestroBridge Formatter
// =============================================================================

export {
  formatBridgeStateForAgent,
  formatNavigation,
  formatViewControllerHierarchy,
  formatUserState,
  formatFeatureFlagsSection,
  formatRecentNetwork,
  formatRecentAnalytics,
  formatNetworkRequest,
  formatAnalyticsEvent,
  formatFeatureFlagsSummary,
  formatFeatureFlag,
  formatRouteStack,
  formatBridgeStateAsJson,
  formatBridgeStateCompact,
} from './bridge-formatter';
export type {
  BridgeFormatOptions,
  FormattedBridgeState,
  CombinedBridgeData,
} from './bridge-formatter';

// =============================================================================
// State Verification
// =============================================================================

export {
  // Snapshot capture
  captureStateSnapshot,
  // State comparison
  compareStateSnapshots,
  // State verification
  verifyStateChanges,
  verifyActionChangesState,
  // Formatting
  formatStateChanges,
  formatVerificationResult as formatStateVerificationResult,  // Renamed to avoid conflict
} from './state-verification';
export type {
  AppStateSnapshot,
  StateChanges,
  StateVerificationResult,
  StateVerificationOptions,
} from './state-verification';

// =============================================================================
// Visual Regression Baselines
// =============================================================================

export {
  // Metadata constants
  METADATA_FILENAME,
  PROJECT_METADATA_FILENAME,
  MASK_FILENAME,
  // Storage constants
  BASELINE_IMAGE_FILENAME,
  MASK_IMAGE_FILENAME,
  SCREENS_DIR,
  FLOWS_DIR,
  // Metadata creation
  createBaselineMetadata,
  createProjectMetadata,
  createFlowBaseline,
  // Metadata serialization
  serializeMetadata,
  parseMetadata,
  // Metadata file operations
  readBaselineMetadata,
  writeBaselineMetadata,
  readProjectMetadata,
  writeProjectMetadata,
  readFlowBaseline,
  writeFlowBaseline,
  // Metadata updates
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
  // Multi-device support
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
} from './baselines';
export type {
  // Baseline metadata types
  BaselineMetadata,
  BaselineDeviceInfo,
  ScreenSize as BaselineScreenSize,  // Renamed to avoid potential conflicts
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
  ExportOptions as BaselineExportOptions,  // Renamed to avoid conflicts
  ExportResult as BaselineExportResult,
  ImportOptions as BaselineImportOptions,
  ImportResult as BaselineImportResult,
  // Report types
  RegressionReport,
  RegressionSummary,
  // Multi-device types
  DeviceBaselineMatch,
  DeviceMatrixEntry,
  BaselineCoverage,
  SyncOptions as BaselineSyncOptions,
  SyncResult as BaselineSyncResult,
} from './baselines';

// =============================================================================
// Image Diff (Visual Comparison)
// =============================================================================

export {
  // Constants
  DEFAULT_THRESHOLD,
  DEFAULT_ANTIALIASING,
  DEFAULT_INCLUDE_TRANSPARENT,
  DEFAULT_ALPHA_TOLERANCE,
  DEFAULT_UNCHANGED_ALPHA,
  DEFAULT_DIFF_COLOR,
  DEFAULT_ANTIALIAS_COLOR,
  DEFAULT_BOUNDING_BOX_COLOR,
  DEFAULT_BOUNDING_BOX_THICKNESS,
  DEFAULT_SIDE_BY_SIDE_GAP,
  MIN_REGION_PIXELS,
  REGION_MERGE_GAP,
  SEVERITY_THRESHOLDS,
  // Image loading
  loadImage,
  getImageInfo,
  saveImage,
  // Ignore mask handling
  createIgnoreMask,
  applyIgnoreMask,
  // Core comparison
  compareImages,
  compareAndSave,
  // Quick helpers
  areImagesIdentical,
  getSimilarity,
  imagesMatch,
  // Diff generation
  generateOverlayDiff,
  generateHighlightDiff,
  generateSideBySide as generateSideBySideDiff,  // Renamed to avoid ambiguity
  generateOnionSkin,
  drawBoundingBoxes,
  generateDiff,
  generateMultipleDiffs,
  // Analysis
  findChangedRegions,
  classifyChange,
  calculateSeverity,
  analyzeChanges,
  generateChangeSummary,
  formatAnalysisReport,
  // Convenience functions
  fullComparison,
  quickCompare,
  generateDiffReport,
} from './image-diff';
export type {
  // Image data types
  ImageData,
  ImageInfo,
  // Comparison options
  ImageCompareOptions,
  DiffOutputOptions,
  // Comparison results
  ImageCompareResult,
  // Changed region types
  ChangeType as ImageChangeType,  // Renamed to avoid conflict with baselines
  DetectedChange,
  ChangeSummary,
  // Analysis results
  ImageAnalysisResult,
  // Diff generation
  DiffMode,
  DiffGenerationOptions,
  DiffGenerationResult,
  // Batch operations
  BatchCompareItem,
  BatchCompareItemResult,
  BatchCompareResult,
  // Error types
  ImageDiffErrorCode,
  ImageDiffError,
} from './image-diff';

// =============================================================================
// Diff Formatting (Agent-Consumable Output)
// =============================================================================

export {
  // Main formatting functions
  formatDiffForAgent,
  formatRegressionReport,
  // Change formatting
  formatChange,
  formatChangeSummaryCompact,
  // JSON output
  formatDiffAsJson,
  // Helpers
  formatSeverity,
  calculateSeverityBreakdown,
  // Constants
  DEFAULT_MAX_REGIONS,
  SEVERITY_THRESHOLDS as DIFF_SEVERITY_THRESHOLDS,  // Renamed to avoid conflict
} from './diff-formatter';
export type {
  DiffFormatOptions,
  FormattedDiff,
  RegressionEntry,
  FormattedRegressionReport,
} from './diff-formatter';

// =============================================================================
// Ignore Region Management
// =============================================================================

export {
  // Constants
  STATUS_BAR_HEIGHTS,
  HOME_INDICATOR,
  DYNAMIC_PATTERNS,
  IGNORE_PRESETS,
  // Static region creation
  createStaticIgnoreRegion,
  createStatusBarRegion,
  createHomeIndicatorRegion,
  createSystemUIIgnoreRegions,
  // Element-based region creation
  createElementBasedIgnoreRegion,
  resolveElementBasedRegions,
  // Pattern-based region creation
  createPatternBasedIgnoreRegion,
  // Dynamic content detection
  detectDynamicContent,
  // Suggestion
  suggestIgnoreRegions,
  // Validation
  validateIgnoreRegion,
  isPointInRegion,
  regionsOverlap,
  mergeOverlappingRegions,
  // Presets
  getDevicePreset,
  // Conversion
  toBasicIgnoreRegion,
  toBasicIgnoreRegions,
} from './ignore-regions';
export type {
  IgnoreRegionType,
  ExtendedIgnoreRegion,
  PatternType,
  DynamicPattern,
  DetectDynamicOptions,
  DynamicContentResult,
  SuggestIgnoreOptions,
  IgnoreRegionSuggestion,
  IgnoreRegionValidation,
} from './ignore-regions';

// =============================================================================
// HTML Regression Report Generation
// =============================================================================

export {
  // Main functions
  generateHTMLReport,
  generateHTMLFromReport,
  // Constants
  DEFAULT_REPORT_TITLE,
  DEFAULT_THUMBNAIL_WIDTH,
  DEFAULT_THUMBNAIL_HEIGHT,
} from './regression-report';
export type {
  HTMLReportOptions,
  HTMLReportEntry,
  HTMLReportResult,
  ReportSummary,
} from './regression-report';

// =============================================================================
// CI Export (JUnit XML, JSON, Artifact Bundles)
// =============================================================================

export {
  // Main export functions
  exportToJUnitXML,
  exportToJSON,
  generateArtifactBundle,
  exportAll,
  // CI environment detection
  detectCIEnvironment,
  isCI,
  // CI config helpers
  getCIConfigSnippet,
  // Constants
  EXPORT_FORMAT_VERSION,
  GENERATOR_NAME,
  DEFAULT_SUITE_NAME,
  DEFAULT_PACKAGE_NAME,
} from './ci-export';
export type {
  CIExportOptions,
  JUnitExportOptions,
  JSONExportOptions,
  ArtifactBundleOptions,
  ExportResult,
  ExportSummary,
  CIEnvironment,
  JSONExportData,
  JSONTestResult,
} from './ci-export';

// =============================================================================
// Configuration Management
// =============================================================================

export {
  // Constants
  CONFIG_VERSION,
  CONFIG_DIRECTORY,
  PROJECT_CONFIG_FILENAME,
  GLOBAL_CONFIG_DIRECTORY,
  GLOBAL_SETTINGS_FILENAME,
  DEFAULT_FLOWS_DIRECTORY as CONFIG_DEFAULT_FLOWS_DIRECTORY,  // Renamed to avoid conflict
  DEFAULT_BASELINES_DIRECTORY as CONFIG_DEFAULT_BASELINES_DIRECTORY,  // Renamed to avoid conflict
  DEFAULT_BRIDGE_PORT as CONFIG_DEFAULT_BRIDGE_PORT,  // Renamed to avoid conflict
  DEFAULT_SCREENSHOT_FORMAT,
  DEFAULT_LOG_RETENTION_DAYS,
  // Default value functions
  getDefaultGlobalSettings,
  getDefaultProjectConfig,
  // Path utilities
  getGlobalConfigDirectory,
  getGlobalSettingsPath,
  getProjectConfigDirectory,
  getProjectConfigPath,
  // Global settings operations
  hasGlobalSettings,
  loadGlobalSettings,
  saveGlobalSettings,
  updateGlobalSettings,
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
  // Recent projects
  addRecentProject,
  getRecentProjects,
  clearRecentProjects,
  // Initialization
  initializeGlobalSettings,
  initializeProjectConfig,
  // Utility functions
  resolveProjectPath,
  getEffectiveFlowsDirectory,
  getEffectiveBaselinesDirectory,
  formatConfig,
  formatMergedConfigSummary,
} from './config';
export type {
  IOSProjectConfig,
  IOSGlobalSettings,
  IOSMergedConfig,
  ConfigValidationResult,
  RecentProject,
} from './config';

// =============================================================================
// Contextual Tips
// =============================================================================

export {
  // Constants
  DOCS_BASE_URL,
  DOCS_PAGES,
  // Documentation link functions
  getDocLink,
  getCommandDocLink,
  getErrorDocLink,
  // Next steps
  getNextSteps,
  // Error tips
  getErrorTip,
  // Contextual tips generation
  generateContextualTips,
  // Formatting functions
  formatContextualTips,
  formatNextSteps,
  formatErrorTip,
  formatCompactTip,
  // Workflow suggestions
  WORKFLOW_SUGGESTIONS,
  getWorkflowSuggestions,
  formatWorkflowSuggestion,
} from './contextual-tips';
export type {
  IOSCommand,
  ContextualTip,
  ActionContext,
  NextStep,
  ErrorTip,
  WorkflowSuggestion,
} from './contextual-tips';

// =============================================================================
// User-Friendly Error Messages
// =============================================================================

export {
  // Error messages
  ERROR_MESSAGES as FRIENDLY_ERROR_MESSAGES,  // Renamed to avoid conflict with existing ERROR_MESSAGES
  getErrorMessage as getFriendlyErrorMessage,  // Renamed to avoid conflict with existing functions
  // Formatting
  formatUserFriendlyError,
  formatErrorAsJson as formatFriendlyErrorAsJson,  // Renamed to avoid conflict
  formatErrorAsMarkdown,
  // Recovery helpers
  getAutoRecoveryCommands,
  canAutoRecover,
  getFirstRecoveryCommand,
  getDocumentationUrl as getErrorDocumentationUrl,  // Renamed to avoid conflict with contextual-tips
  getErrorSeverity,
  // Categorization
  getErrorCategory,
  getErrorsInCategory,
  getErrorMessagesSummary,
} from './errors';
export type {
  ErrorCode,
  RecoveryStep,
  ErrorMessage as FriendlyErrorMessage,  // Renamed to avoid potential conflicts
  FormatErrorOptions,
  ErrorCategory,
} from './errors';

// =============================================================================
// Autocomplete
// =============================================================================

export {
  // Cache management
  clearAllCaches,
  clearCache,
  // Individual completion types
  getSimulatorCompletions,
  getBundleIdCompletions,
  getSchemeCompletions,
  getFlowCompletions,
  getBaselineCompletions,
  getElementCompletions,
  // Unified interface
  getCompletions,
  getAllCompletions,
  // Element caching
  cacheInspectElements,
  extractElementsFromInspect,
  // Command argument helpers
  getArgumentCompletionType,
  COMMAND_ARGUMENTS,
} from './autocomplete';
export type {
  CompletionType,
  CompletionItem,
  CompletionResult,
  CompletionOptions,
  CommandArgDefinition,
} from './autocomplete';

// =============================================================================
// Command Suggestions
// =============================================================================

export {
  // Main functions
  getCommandSuggestions,
  getSuggestionsByCategory,
  getTopSuggestions,
  // Formatting functions
  formatSuggestionsAsMarkdown,
  formatSuggestionsCompact,
  formatSuggestionsAsJson,
  // Utility functions
  hasDefinedSuggestions,
  getAllCategories,
  // Extensibility
  registerCommandSuggestions,
  registerErrorSuggestions,
  // Constants
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from './command-suggestions';
export type {
  CommandSuggestion,
  SuggestionContext,
  CommandSuggestionResult,
} from './command-suggestions';
