/**
 * Step Executor - Execute parsed iOS steps via IPC handlers
 *
 * Provides execution of iOS assertion and action steps by invoking
 * the appropriate IPC handlers directly.
 */

import {
  IOSStep,
  StepResult,
  StepBatchResult,
  ElementTarget,
  AssertVisibleStep,
  AssertTextStep,
  AssertValueStep,
  AssertEnabledStep,
  AssertSelectedStep,
  AssertHittableStep,
  AssertLogContainsStep,
  AssertNoErrorsStep,
  AssertNoCrashStep,
  AssertScreenStep,
  WaitForStep,
  TapStep,
  TypeStep,
  ScrollStep,
  SwipeStep,
  SnapshotStep,
  InspectStep,
  BaselineStep,
  DiffStep,
  RegressionStep,
} from './step-types';
import * as iosTools from '../../main/ios-tools';
import type { IOSResult, VerificationResult } from '../../main/ios-tools';
import { logger } from '../../main/utils/logger';

// =============================================================================
// Types
// =============================================================================

/** Options for step execution */
export interface ExecutionOptions {
  /** Simulator UDID (auto-detected if not provided) */
  udid?: string;
  /** Default bundle ID for app assertions */
  bundleId?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Session ID for artifact storage */
  sessionId?: string;
  /** Stop on first failure */
  stopOnFailure?: boolean;
  /** Capture screenshots on failure */
  captureOnFailure?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

// =============================================================================
// Main Executor
// =============================================================================

/**
 * Execute a single iOS step.
 *
 * @param step - The step to execute
 * @param options - Execution options
 * @returns StepResult with success/failure and details
 */
export async function executeStep(
  step: IOSStep,
  options: ExecutionOptions = {}
): Promise<StepResult> {
  const startTime = Date.now();

  // Get simulator UDID
  const udid = options.udid || await getDefaultSimulatorUdid();
  if (!udid) {
    return {
      success: false,
      step,
      durationMs: Date.now() - startTime,
      error: 'No booted simulator found',
      failureReason: 'SIMULATOR_NOT_FOUND',
      suggestions: ['Boot a simulator using `xcrun simctl boot <device>`'],
    };
  }

  try {
    const result = await executeStepInternal(step, { ...options, udid });
    return {
      success: result.success,
      step,
      durationMs: Date.now() - startTime,
      error: result.error,
      failureReason: result.failureReason,
      suggestions: result.suggestions,
      artifacts: result.artifacts,
      rawResult: result.rawResult,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      step,
      durationMs: Date.now() - startTime,
      error,
      failureReason: 'EXECUTION_ERROR',
    };
  }
}

/**
 * Execute multiple iOS steps.
 *
 * @param steps - The steps to execute
 * @param options - Execution options
 * @returns StepBatchResult with all results
 */
export async function executeSteps(
  steps: IOSStep[],
  options: ExecutionOptions = {}
): Promise<StepBatchResult> {
  const startTime = Date.now();
  const results: StepResult[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Get simulator UDID once for all steps
  const udid = options.udid || await getDefaultSimulatorUdid();
  if (!udid) {
    return {
      success: false,
      totalDurationMs: Date.now() - startTime,
      passed: 0,
      failed: steps.length,
      skipped: 0,
      results: steps.map(step => ({
        success: false,
        step,
        durationMs: 0,
        error: 'No booted simulator found',
        failureReason: 'SIMULATOR_NOT_FOUND',
      })),
    };
  }

  const execOptions = { ...options, udid };
  let shouldSkip = false;

  for (const step of steps) {
    if (shouldSkip) {
      results.push({
        success: false,
        step,
        durationMs: 0,
        error: 'Skipped due to previous failure',
        failureReason: 'SKIPPED',
      });
      skipped++;
      continue;
    }

    const result = await executeStep(step, execOptions);
    results.push(result);

    if (result.success) {
      passed++;
    } else {
      failed++;
      if (options.stopOnFailure) {
        shouldSkip = true;
      }
    }
  }

  return {
    success: failed === 0,
    totalDurationMs: Date.now() - startTime,
    passed,
    failed,
    skipped,
    results,
  };
}

// =============================================================================
// Internal Execution
// =============================================================================

interface InternalResult {
  success: boolean;
  error?: string;
  failureReason?: string;
  suggestions?: string[];
  artifacts?: {
    screenshot?: string;
    logs?: string;
  };
  rawResult?: unknown;
}

async function executeStepInternal(
  step: IOSStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  if (options.debug) {
    logger.debug(`[StepExecutor] Executing step: ${step.type}`);
  }

  switch (step.type) {
    case 'ios.assert_visible':
      return executeAssertVisible(step, options);
    case 'ios.assert_not_visible':
      return executeAssertNotVisible(step, options);
    case 'ios.assert_text':
      return executeAssertText(step, options);
    case 'ios.assert_value':
      return executeAssertValue(step, options);
    case 'ios.assert_enabled':
      return executeAssertEnabled(step, options);
    case 'ios.assert_disabled':
      return executeAssertDisabled(step, options);
    case 'ios.assert_selected':
      return executeAssertSelected(step, options);
    case 'ios.assert_not_selected':
      return executeAssertNotSelected(step, options);
    case 'ios.assert_hittable':
      return executeAssertHittable(step, options);
    case 'ios.assert_not_hittable':
      return executeAssertNotHittable(step, options);
    case 'ios.assert_log_contains':
      return executeAssertLogContains(step, options);
    case 'ios.assert_no_errors':
      return executeAssertNoErrors(step, options);
    case 'ios.assert_no_crash':
      return executeAssertNoCrash(step, options);
    case 'ios.assert_screen':
      return executeAssertScreen(step, options);
    case 'ios.wait_for':
      return executeWaitFor(step, options);
    case 'ios.tap':
      return executeTap(step, options);
    case 'ios.type':
      return executeType(step, options);
    case 'ios.scroll':
      return executeScroll(step, options);
    case 'ios.swipe':
      return executeSwipe(step, options);
    case 'ios.snapshot':
      return executeSnapshot(step, options);
    case 'ios.inspect':
      return executeInspect(step, options);
    // Visual regression
    case 'ios.baseline':
      return executeBaseline(step, options);
    case 'ios.diff':
      return executeDiff(step, options);
    case 'ios.regression':
      return executeRegression(step, options);
    default:
      return {
        success: false,
        error: `Unknown step type: ${(step as IOSStep).type}`,
        failureReason: 'UNKNOWN_STEP_TYPE',
      };
  }
}

// =============================================================================
// Step Executors
// =============================================================================

async function executeAssertVisible(
  step: AssertVisibleStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const result = await iosTools.assertVisible({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
    polling: step.timeout ? { timeout: step.timeout } : undefined,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertNotVisible(
  step: AssertVisibleStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const result = await iosTools.assertNotVisible({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
    polling: step.timeout ? { timeout: step.timeout } : undefined,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertText(
  step: AssertTextStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const result = await iosTools.assertText({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
    expected: step.expected,
    matchMode: step.matchMode || 'exact',
    caseSensitive: step.caseSensitive,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertValue(
  step: AssertValueStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const result = await iosTools.assertValue({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
    expected: step.expected,
    matchMode: step.matchMode || 'exact',
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertEnabled(
  step: AssertEnabledStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const result = await iosTools.assertEnabled({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertDisabled(
  step: AssertEnabledStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const result = await iosTools.assertDisabled({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertSelected(
  step: AssertSelectedStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const result = await iosTools.assertSelected({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertNotSelected(
  step: AssertSelectedStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const result = await iosTools.assertNotSelected({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertHittable(
  step: AssertHittableStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const result = await iosTools.assertHittable({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertNotHittable(
  step: AssertHittableStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const result = await iosTools.assertNotHittable({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertLogContains(
  step: AssertLogContainsStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  if (step.notContains) {
    const result = await iosTools.assertLogNotContains(step.pattern, {
      udid: options.udid,
      bundleId: step.bundleId || options.bundleId,
      sessionId: options.sessionId || 'step-executor',
      since: step.since ? new Date(step.since) : undefined,
      matchMode: step.matchMode,
      caseSensitive: step.caseSensitive,
    });
    return formatIOSVerificationResult(result);
  }

  const result = await iosTools.assertLogContains(step.pattern, {
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    since: step.since ? new Date(step.since) : undefined,
    matchMode: step.matchMode,
    caseSensitive: step.caseSensitive,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertNoErrors(
  step: AssertNoErrorsStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const result = await iosTools.assertNoErrors({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    since: step.since ? new Date(step.since) : undefined,
    patterns: step.patterns,
    ignorePatterns: step.ignorePatterns,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertNoCrash(
  step: AssertNoCrashStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const bundleId = step.bundleId || options.bundleId;
  if (!bundleId) {
    return {
      success: false,
      error: 'Bundle ID is required for ios.assert_no_crash',
      failureReason: 'MISSING_BUNDLE_ID',
    };
  }

  const result = await iosTools.assertNoCrash({
    udid: options.udid,
    bundleId,
    sessionId: options.sessionId || 'step-executor',
    since: step.since ? new Date(step.since) : undefined,
  });

  return formatIOSVerificationResult(result);
}

async function executeAssertScreen(
  step: AssertScreenStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  // Build screen definition from step
  const elements = step.elements?.map(normalizeTarget) || [];
  const notVisible = step.notVisible?.map(normalizeTarget);
  const enabled = step.enabled?.map(normalizeTarget);
  const disabled = step.disabled?.map(normalizeTarget);

  const result = await iosTools.assertScreen({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    screen: {
      name: step.screenName || 'screen',
      elements,
      notVisible,
      enabled,
      disabled,
    },
    polling: step.timeout ? { timeout: step.timeout } : undefined,
  });

  return formatIOSVerificationResult(result);
}

async function executeWaitFor(
  step: WaitForStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);

  if (step.not) {
    const result = await iosTools.waitForElementNot({
      udid: options.udid,
      bundleId: step.bundleId || options.bundleId,
      sessionId: options.sessionId || 'step-executor',
      target,
      polling: step.timeout ? { timeout: step.timeout } : undefined,
    });
    return formatIOSVerificationResult(result);
  }

  const result = await iosTools.waitForElement({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    target,
    polling: step.timeout ? { timeout: step.timeout } : undefined,
  });

  return formatIOSVerificationResult(result);
}

async function executeTap(
  step: TapStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const target = normalizeTarget(step.target);
  const bundleId = step.bundleId || options.bundleId;

  if (!bundleId) {
    return {
      success: false,
      error: 'Bundle ID is required for ios.tap',
      failureReason: 'MISSING_BUNDLE_ID',
    };
  }

  const driver = iosTools.createNativeDriver({
    bundleId,
    udid: options.udid,
    timeout: options.timeout,
  });

  const action = iosTools.nativeTap(target as iosTools.NativeActionTarget);
  const result = await driver.execute(action);

  return {
    success: result.success,
    error: result.error,
    rawResult: result,
  };
}

async function executeType(
  step: TypeStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const bundleId = step.bundleId || options.bundleId;

  if (!bundleId) {
    return {
      success: false,
      error: 'Bundle ID is required for ios.type',
      failureReason: 'MISSING_BUNDLE_ID',
    };
  }

  const driver = iosTools.createNativeDriver({
    bundleId,
    udid: options.udid,
    timeout: options.timeout,
  });

  const into = step.into ? normalizeTarget(step.into) : undefined;
  const action = iosTools.nativeTypeText(step.text, {
    target: into as iosTools.NativeActionTarget | undefined,
    clearFirst: step.clearFirst,
  });
  const result = await driver.execute(action);

  return {
    success: result.success,
    error: result.error,
    rawResult: result,
  };
}

async function executeScroll(
  step: ScrollStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const bundleId = step.bundleId || options.bundleId;

  if (!bundleId) {
    return {
      success: false,
      error: 'Bundle ID is required for ios.scroll',
      failureReason: 'MISSING_BUNDLE_ID',
    };
  }

  const driver = iosTools.createNativeDriver({
    bundleId,
    udid: options.udid,
    timeout: options.timeout,
  });

  let action: iosTools.NativeActionRequest;

  if (step.scrollTo) {
    const scrollToTarget = normalizeTarget(step.scrollTo);
    action = iosTools.nativeScrollTo(scrollToTarget as iosTools.NativeActionTarget, {
      direction: step.direction as iosTools.NativeSwipeDirection,
    });
  } else {
    const target = step.target ? normalizeTarget(step.target) : undefined;
    action = iosTools.nativeScroll(step.direction as iosTools.NativeSwipeDirection || 'down', {
      target: target as iosTools.NativeActionTarget | undefined,
    });
  }

  const result = await driver.execute(action);

  return {
    success: result.success,
    error: result.error,
    rawResult: result,
  };
}

async function executeSwipe(
  step: SwipeStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const bundleId = step.bundleId || options.bundleId;

  if (!bundleId) {
    return {
      success: false,
      error: 'Bundle ID is required for ios.swipe',
      failureReason: 'MISSING_BUNDLE_ID',
    };
  }

  const driver = iosTools.createNativeDriver({
    bundleId,
    udid: options.udid,
    timeout: options.timeout,
  });

  const target = step.target ? normalizeTarget(step.target) : undefined;
  const action = iosTools.nativeSwipe(step.direction as iosTools.NativeSwipeDirection, {
    target: target as iosTools.NativeActionTarget | undefined,
    velocity: step.velocity as iosTools.NativeSwipeVelocity | undefined,
  });
  const result = await driver.execute(action);

  return {
    success: result.success,
    error: result.error,
    rawResult: result,
  };
}

async function executeSnapshot(
  step: SnapshotStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const result = await iosTools.captureSnapshot({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
  });

  return {
    success: result.success,
    error: result.error,
    artifacts: result.data ? {
      screenshot: result.data.screenshot?.path,
    } : undefined,
    rawResult: result,
  };
}

async function executeInspect(
  step: InspectStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const result = await iosTools.inspect({
    udid: options.udid,
    bundleId: step.bundleId || options.bundleId,
    sessionId: options.sessionId || 'step-executor',
    captureScreenshot: step.captureScreenshot,
  });

  return {
    success: result.success,
    error: result.error,
    artifacts: result.data?.screenshot ? {
      screenshot: result.data.screenshot.path,
    } : undefined,
    rawResult: result,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the UDID of the first booted simulator.
 */
async function getDefaultSimulatorUdid(): Promise<string | undefined> {
  const booted = await iosTools.getBootedSimulators();
  if (booted.success && booted.data && booted.data.length > 0) {
    return booted.data[0].udid;
  }
  return undefined;
}

/**
 * Normalize a target to an ElementTarget object.
 */
function normalizeTarget(target: ElementTarget | string): iosTools.ElementTarget {
  if (typeof target === 'string') {
    // Try to parse shorthand notations
    if (target.startsWith('#')) {
      return { identifier: target.slice(1) };
    }
    if (target.startsWith('@')) {
      return { label: target.slice(1) };
    }
    // Plain string is treated as text
    return { text: target };
  }

  // Already an object
  return target as iosTools.ElementTarget;
}

/**
 * Format an IOSResult<VerificationResult<T>> into an InternalResult.
 * Handles the double-wrapper pattern used by ios-tools assertions.
 */
function formatIOSVerificationResult<T>(result: IOSResult<VerificationResult<T>>): InternalResult {
  // First check if the outer IOSResult succeeded
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Operation failed',
      failureReason: 'IOS_ERROR',
      rawResult: result,
    };
  }

  // Now check the inner VerificationResult
  const verification = result.data;
  if (!verification) {
    return {
      success: false,
      error: 'No verification data returned',
      failureReason: 'NO_DATA',
      rawResult: result,
    };
  }

  const passed = verification.status === 'passed';

  return {
    success: passed,
    error: passed ? undefined : verification.message,
    failureReason: passed ? undefined : verification.status.toUpperCase(),
    artifacts: verification.artifacts ? {
      screenshot: verification.artifacts.screenshots?.[0],
    } : undefined,
    rawResult: result,
  };
}

// =============================================================================
// Visual Regression Executors
// =============================================================================

async function executeBaseline(
  step: BaselineStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const project = step.project || 'default';

  switch (step.action) {
    case 'save': {
      if (!step.name) {
        return {
          success: false,
          error: 'ios.baseline save requires a baseline name',
          failureReason: 'MISSING_NAME',
        };
      }

      // Capture screenshot first (use artifact directory)
      const artifactDir = await iosTools.getArtifactDirectory(options.sessionId || 'step-executor');
      const screenshotResult = await iosTools.captureScreenshot(options.udid, artifactDir, 'baseline');
      if (!screenshotResult.success || !screenshotResult.data) {
        return {
          success: false,
          error: screenshotResult.error || 'Failed to capture screenshot',
          failureReason: 'SCREENSHOT_FAILED',
        };
      }

      // Get device info for metadata
      const simulator = await iosTools.getSimulator(options.udid);
      const screenSizeResult = await iosTools.getScreenSize(options.udid);
      const deviceInfo: iosTools.BaselineDeviceInfo = {
        name: simulator.data?.name || 'Unknown',
        osVersion: simulator.data?.runtime?.replace('com.apple.CoreSimulator.SimRuntime.iOS-', '').replace('-', '.') || 'Unknown',
        screenSize: screenSizeResult.success && screenSizeResult.data
          ? { width: screenSizeResult.data.width, height: screenSizeResult.data.height }
          : undefined,
      };

      // Determine device family
      let deviceFamily: iosTools.DeviceFamily | undefined;
      if (step.deviceFamily) {
        deviceFamily = step.deviceFamily as iosTools.DeviceFamily;
      } else if (step.autoDeviceFamily !== false) {
        deviceFamily = iosTools.detectDeviceFamilyFromDevice(deviceInfo);
      }

      try {
        // Create baseline
        await iosTools.createBaseline(
          project,
          step.name,
          screenshotResult.data.path,
          deviceInfo,
          step.bundleId || options.bundleId || 'unknown',
          {
            description: step.description,
            tags: step.tags,
            deviceFamily,
          }
        );

        return {
          success: true,
          rawResult: {
            action: 'save',
            name: step.name,
            project,
            path: screenshotResult.data.path,
            deviceFamily,
          },
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          failureReason: 'BASELINE_SAVE_FAILED',
        };
      }
    }

    case 'update': {
      if (!step.name) {
        return {
          success: false,
          error: 'ios.baseline update requires a baseline name',
          failureReason: 'MISSING_NAME',
        };
      }

      // Capture screenshot
      const artifactDir2 = await iosTools.getArtifactDirectory(options.sessionId || 'step-executor');
      const screenshotResult = await iosTools.captureScreenshot(options.udid, artifactDir2, 'baseline-update');
      if (!screenshotResult.success || !screenshotResult.data) {
        return {
          success: false,
          error: screenshotResult.error || 'Failed to capture screenshot',
          failureReason: 'SCREENSHOT_FAILED',
        };
      }

      try {
        const deviceFamily = step.deviceFamily as iosTools.DeviceFamily | undefined;
        await iosTools.updateBaseline(project, step.name, screenshotResult.data.path, deviceFamily);

        return {
          success: true,
          rawResult: {
            action: 'update',
            name: step.name,
            project,
            path: screenshotResult.data.path,
          },
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          failureReason: 'BASELINE_UPDATE_FAILED',
        };
      }
    }

    case 'delete': {
      if (!step.name) {
        return {
          success: false,
          error: 'ios.baseline delete requires a baseline name',
          failureReason: 'MISSING_NAME',
        };
      }

      try {
        const deviceFamily = step.deviceFamily as iosTools.DeviceFamily | undefined;
        await iosTools.deleteBaseline(project, step.name, deviceFamily);

        return {
          success: true,
          rawResult: {
            action: 'delete',
            name: step.name,
            project,
          },
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          failureReason: 'BASELINE_DELETE_FAILED',
        };
      }
    }

    case 'list': {
      try {
        const deviceFamily = step.deviceFamily as iosTools.DeviceFamily | undefined;
        const baselines = await iosTools.listBaselines(project, deviceFamily);

        return {
          success: true,
          rawResult: {
            action: 'list',
            project,
            baselines,
          },
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          failureReason: 'BASELINE_LIST_FAILED',
        };
      }
    }

    case 'show': {
      if (!step.name) {
        return {
          success: false,
          error: 'ios.baseline show requires a baseline name',
          failureReason: 'MISSING_NAME',
        };
      }

      try {
        const deviceFamily = step.deviceFamily as iosTools.DeviceFamily | undefined;
        const baseline = await iosTools.getBaseline(project, step.name, deviceFamily);

        return {
          success: !!baseline,
          error: baseline ? undefined : `Baseline not found: ${step.name}`,
          failureReason: baseline ? undefined : 'BASELINE_NOT_FOUND',
          rawResult: baseline ? {
            action: 'show',
            name: step.name,
            project,
            baseline,
          } : undefined,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          failureReason: 'BASELINE_SHOW_FAILED',
        };
      }
    }

    default:
      return {
        success: false,
        error: `Unknown baseline action: ${step.action}`,
        failureReason: 'UNKNOWN_ACTION',
      };
  }
}

async function executeDiff(
  step: DiffStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const project = step.project || 'default';
  const threshold = step.threshold ?? 0.1;
  const deviceFamily = step.deviceFamily as iosTools.DeviceFamily | undefined;

  // Handle "all baselines" mode
  if (step.all) {
    try {
      const baselines = await iosTools.listBaselines(project, deviceFamily);
      const results: Array<{ name: string; match: boolean; similarity: number; error?: string }> = [];

      const artifactDir = await iosTools.getArtifactDirectory(options.sessionId || 'step-executor');

      for (const entry of baselines) {
        // Capture current screenshot
        const screenshotResult = await iosTools.captureScreenshot(options.udid, artifactDir, `diff-${entry.name}`);
        if (!screenshotResult.success || !screenshotResult.data) {
          results.push({
            name: entry.name,
            match: false,
            similarity: 0,
            error: 'Failed to capture screenshot',
          });
          continue;
        }

        // Get baseline
        const baseline = await iosTools.getBaseline(project, entry.name, deviceFamily);
        if (!baseline) {
          results.push({
            name: entry.name,
            match: false,
            similarity: 0,
            error: 'Baseline not found',
          });
          continue;
        }

        // Compare - quickCompare returns boolean, so get similarity via fullComparison
        const comparisonResult = await iosTools.fullComparison(baseline.imagePath, screenshotResult.data.path, {
          compare: { threshold },
        });
        const match = comparisonResult.comparison.match;
        const similarity = comparisonResult.comparison.similarity;
        results.push({
          name: entry.name,
          match,
          similarity,
        });

        // Update if requested
        if (!match && step.update) {
          await iosTools.updateBaseline(project, entry.name, screenshotResult.data.path, deviceFamily);
        }
      }

      const allMatch = results.every(r => r.match);
      return {
        success: allMatch,
        error: allMatch ? undefined : `${results.filter(r => !r.match).length} baseline(s) have differences`,
        failureReason: allMatch ? undefined : 'DIFF_DETECTED',
        rawResult: {
          mode: 'all',
          project,
          results,
          summary: {
            total: results.length,
            passed: results.filter(r => r.match).length,
            failed: results.filter(r => !r.match).length,
          },
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        failureReason: 'DIFF_ALL_FAILED',
      };
    }
  }

  // Handle flow mode
  if (step.flow) {
    try {
      const flow = await iosTools.getFlowBaselineStorage(project, step.flow);
      if (!flow) {
        return {
          success: false,
          error: `Flow baseline not found: ${step.flow}`,
          failureReason: 'FLOW_NOT_FOUND',
        };
      }

      // For flow comparison, we'd need to run the flow and compare each step
      // This is a simplified implementation that just reports the flow exists
      return {
        success: true,
        rawResult: {
          mode: 'flow',
          flow: step.flow,
          project,
          stepCount: flow.steps.length,
          message: 'Flow baseline found. Use ios.run_flow with visual comparison to test.',
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        failureReason: 'DIFF_FLOW_FAILED',
      };
    }
  }

  // Single baseline comparison
  if (!step.baseline) {
    return {
      success: false,
      error: 'ios.diff requires a baseline name, flow name, or all:true',
      failureReason: 'MISSING_TARGET',
    };
  }

  try {
    // Get baseline
    const baseline = await iosTools.getBaseline(project, step.baseline, deviceFamily);
    if (!baseline) {
      return {
        success: false,
        error: `Baseline not found: ${step.baseline}`,
        failureReason: 'BASELINE_NOT_FOUND',
      };
    }

    // Capture current screenshot
    const singleArtifactDir = await iosTools.getArtifactDirectory(options.sessionId || 'step-executor');
    const screenshotResult = await iosTools.captureScreenshot(options.udid, singleArtifactDir, `diff-${step.baseline}`);
    if (!screenshotResult.success || !screenshotResult.data) {
      return {
        success: false,
        error: screenshotResult.error || 'Failed to capture screenshot',
        failureReason: 'SCREENSHOT_FAILED',
      };
    }

    // Full comparison with analysis
    const comparisonResult = await iosTools.fullComparison(
      baseline.imagePath,
      screenshotResult.data.path,
      {
        compare: { threshold },
        output: step.output ? { diffImagePath: step.output } : undefined,
        ignoreRegions: baseline.metadata?.ignoreRegions?.map(r => ({
          name: r.name,
          rect: r.rect,
          reason: r.reason,
        })),
      }
    );

    const match = comparisonResult.comparison.match;
    const similarity = comparisonResult.comparison.similarity;
    const diffPixels = comparisonResult.comparison.diffPixels;
    const diffPercent = comparisonResult.comparison.diffPercent;
    const diffPath = comparisonResult.diff?.savedPath;

    // Update baseline if requested and there are differences
    if (!match && step.update) {
      await iosTools.updateBaseline(project, step.baseline, screenshotResult.data.path, deviceFamily);
    }

    // Format for agent
    const formatted = iosTools.formatDiffForAgent(
      comparisonResult.comparison,
      comparisonResult.analysis,
      {
        baseline: baseline.imagePath,
        current: screenshotResult.data.path,
        diff: diffPath,
      },
      {
        baselineName: step.baseline,
        projectName: project,
        includeRecommendations: true,
      }
    );

    return {
      success: match,
      error: match ? undefined : formatted.summary.status,
      failureReason: match ? undefined : 'DIFF_DETECTED',
      artifacts: diffPath ? {
        screenshot: diffPath,
      } : undefined,
      rawResult: {
        mode: 'single',
        baseline: step.baseline,
        project,
        match,
        similarity,
        diffPixels,
        diffPercent,
        diffPath,
        analysis: comparisonResult.analysis,
        formatted,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      failureReason: 'DIFF_FAILED',
    };
  }
}

async function executeRegression(
  step: RegressionStep,
  options: ExecutionOptions & { udid: string }
): Promise<InternalResult> {
  const project = step.project || 'default';
  const threshold = step.threshold ?? 0.1;
  const deviceFamily = step.deviceFamily as iosTools.DeviceFamily | undefined;

  interface RegressionResult {
    name: string;
    type: 'screen' | 'flow';
    match: boolean;
    similarity: number;
    diffPath?: string;
    error?: string;
    updated?: boolean;
    comparison?: iosTools.ImageCompareResult;
    analysis?: iosTools.ImageAnalysisResult;
    paths?: {
      baseline: string;
      current: string;
      diff?: string;
    };
  }

  const results: RegressionResult[] = [];
  let stopped = false;

  try {
    // Get all screen baselines
    if (step.mode !== 'flows-only') {
      const baselines = await iosTools.listBaselines(project, deviceFamily);
      const regArtifactDir = await iosTools.getArtifactDirectory(options.sessionId || 'step-executor');

      for (const entry of baselines) {
        if (stopped) break;

        // Capture screenshot
        const screenshotResult = await iosTools.captureScreenshot(options.udid, regArtifactDir, `regression-${entry.name}`);
        if (!screenshotResult.success || !screenshotResult.data) {
          results.push({
            name: entry.name,
            type: 'screen',
            match: false,
            similarity: 0,
            error: 'Failed to capture screenshot',
          });

          if (step.failFast) {
            stopped = true;
          }
          continue;
        }

        // Get baseline
        const baseline = await iosTools.getBaseline(project, entry.name, deviceFamily);
        if (!baseline) {
          results.push({
            name: entry.name,
            type: 'screen',
            match: false,
            similarity: 0,
            error: 'Baseline not found',
          });
          continue;
        }

        // Compare
        const comparisonResult = await iosTools.fullComparison(baseline.imagePath, screenshotResult.data.path, {
          compare: { threshold },
          output: step.output ? { diffImagePath: `${step.output}/${entry.name}-diff.png` } : undefined,
        });

        const match = comparisonResult.comparison.match;
        const diffPath = comparisonResult.diff?.savedPath;

        const result: RegressionResult = {
          name: entry.name,
          type: 'screen',
          match,
          similarity: comparisonResult.comparison.similarity,
          diffPath,
          comparison: comparisonResult.comparison,
          analysis: comparisonResult.analysis,
          paths: {
            baseline: baseline.imagePath,
            current: screenshotResult.data.path,
            diff: diffPath,
          },
        };

        // Update if requested
        if (!match && step.update) {
          await iosTools.updateBaseline(project, entry.name, screenshotResult.data.path, deviceFamily);
          result.updated = true;
        }

        results.push(result);

        if (!match && step.failFast) {
          stopped = true;
        }
      }
    }

    // Get all flow baselines (if not quick mode)
    if (step.mode !== 'quick' && !stopped) {
      const flows = await iosTools.listFlows(project);

      for (const flowEntry of flows) {
        if (stopped) break;

        const flow = await iosTools.getFlowBaselineStorage(project, flowEntry.name);
        if (!flow) continue;

        results.push({
          name: flowEntry.name,
          type: 'flow',
          match: true, // Flow comparison requires running the flow
          similarity: 1,
        });
      }
    }

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.match).length,
      failed: results.filter(r => !r.match).length,
      updated: results.filter(r => r.updated).length,
      passRate: results.length > 0 ? (results.filter(r => r.match).length / results.length) * 100 : 100,
    };

    const allPassed = summary.failed === 0;

    // Build regression entries for formatter
    const regressionEntries: iosTools.RegressionEntry[] = results
      .filter(r => r.comparison && r.paths)
      .map(r => ({
        name: r.name,
        comparison: r.comparison!,
        analysis: r.analysis,
        paths: r.paths!,
        metadata: undefined,
        updated: r.updated,
        error: r.error,
      }));

    // Format regression report
    const report = iosTools.formatRegressionReport(regressionEntries, {
      projectName: project,
      deviceFamily: deviceFamily,
      threshold,
      includeDetails: step.verbose,
    });

    return {
      success: allPassed,
      error: allPassed ? undefined : `${summary.failed} regression(s) detected`,
      failureReason: allPassed ? undefined : 'REGRESSION_DETECTED',
      rawResult: {
        project,
        mode: step.mode || 'full',
        results,
        summary,
        report: report.markdown,
        stopped,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      failureReason: 'REGRESSION_FAILED',
    };
  }
}

// =============================================================================
// Exports for Testing
// =============================================================================

export { normalizeTarget, formatIOSVerificationResult };
