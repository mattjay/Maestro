/**
 * iOS Tools - User-Friendly Error Messages
 *
 * Provides comprehensive, user-friendly error messages with:
 * - Clear explanations of what went wrong
 * - Actionable recovery steps (numbered, easy to follow)
 * - Links to documentation for deeper troubleshooting
 * - Auto-recovery suggestions where applicable
 * - Context-aware messaging based on error scenario
 *
 * This module centralizes all iOS error messaging to ensure consistency
 * across the iOS tooling experience.
 */

import { IOSErrorCode } from '../types';
import { InteractionErrorCode } from '../interaction-errors';
import { DOCS_BASE_URL, DOCS_PAGES } from '../contextual-tips';
import { logger } from '../../utils/logger';

const LOG_CONTEXT = '[iOS-ErrorMessages]';

// =============================================================================
// Types
// =============================================================================

/**
 * All supported error codes (union of IOSErrorCode and InteractionErrorCode)
 */
export type ErrorCode = IOSErrorCode | InteractionErrorCode | string;

/**
 * Recovery step with optional command
 */
export interface RecoveryStep {
  /** Step number (1-indexed) */
  step: number;
  /** Description of the recovery action */
  description: string;
  /** Command to run (if applicable) */
  command?: string;
  /** Whether this step is optional */
  optional?: boolean;
}

/**
 * Detailed error message configuration
 */
export interface ErrorMessage {
  /** Error code for programmatic handling */
  code: ErrorCode;
  /** Error icon (emoji) */
  icon: string;
  /** Short error title */
  title: string;
  /** Detailed explanation of the error */
  explanation: string;
  /** Numbered recovery steps */
  recoverySteps: RecoveryStep[];
  /** Documentation URL for further help */
  documentationUrl: string;
  /** Commands that can auto-recover from this error */
  autoRecoveryCommands?: string[];
  /** Related error codes that might occur together */
  relatedErrors?: ErrorCode[];
  /** Common causes of this error */
  commonCauses?: string[];
  /** Severity level for logging/reporting */
  severity: 'warning' | 'error' | 'critical';
}

/**
 * Options for formatting error messages
 */
export interface FormatErrorOptions {
  /** Include auto-recovery suggestions */
  includeAutoRecovery?: boolean;
  /** Include documentation link */
  includeDocLink?: boolean;
  /** Include common causes */
  includeCauses?: boolean;
  /** Use compact format (single line) */
  compact?: boolean;
  /** Additional context from the error */
  context?: Record<string, unknown>;
}

// =============================================================================
// Documentation URL Helpers
// =============================================================================

/**
 * Get documentation URL for a specific troubleshooting topic
 */
function getTroubleshootingUrl(topic: string): string {
  return `${DOCS_BASE_URL}${DOCS_PAGES.troubleshooting}#${topic}`;
}

/**
 * Get documentation URL for setup guide
 * @internal Reserved for future use in error messages
 */
function _getSetupUrl(section?: string): string {
  const base = `${DOCS_BASE_URL}${DOCS_PAGES.setup}`;
  return section ? `${base}#${section}` : base;
}

/**
 * Get documentation URL for commands reference
 */
function getCommandsUrl(command?: string): string {
  const base = `${DOCS_BASE_URL}${DOCS_PAGES.commands}`;
  return command ? `${base}#${command}` : base;
}

// Silence unused warning - kept for API completeness
void _getSetupUrl;

// =============================================================================
// Error Message Definitions
// =============================================================================

/**
 * Comprehensive error messages for all iOS error codes
 */
export const ERROR_MESSAGES: Record<ErrorCode, ErrorMessage> = {
  // ==========================================================================
  // Environment Errors
  // ==========================================================================

  XCODE_NOT_FOUND: {
    code: 'XCODE_NOT_FOUND',
    icon: '❌',
    title: 'Xcode Not Found',
    explanation: "Maestro couldn't find Xcode on your system. Xcode is required for iOS development and simulation.",
    recoverySteps: [
      { step: 1, description: 'Install Xcode from the App Store', command: 'open "macappstore://itunes.apple.com/app/id497799835"' },
      { step: 2, description: 'Open Xcode once to accept the license agreement' },
      { step: 3, description: 'Install Command Line Tools', command: 'xcode-select --install' },
      { step: 4, description: 'Verify installation', command: '/ios.setup --check' },
    ],
    documentationUrl: getTroubleshootingUrl('xcode'),
    autoRecoveryCommands: ['/ios.setup --fix'],
    commonCauses: [
      'Xcode is not installed',
      'Xcode was moved or deleted',
      'Command Line Tools are not installed',
      'xcode-select is pointing to an invalid path',
    ],
    severity: 'critical',
  },

  XCODE_VERSION_UNSUPPORTED: {
    code: 'XCODE_VERSION_UNSUPPORTED',
    icon: '⚠️',
    title: 'Xcode Version Not Supported',
    explanation: 'Your version of Xcode is older than the minimum required version. Please update to continue.',
    recoverySteps: [
      { step: 1, description: 'Open the App Store' },
      { step: 2, description: 'Search for Xcode and click Update' },
      { step: 3, description: 'Alternatively, download from Apple Developer', command: 'open "https://developer.apple.com/xcode/downloads/"' },
      { step: 4, description: 'Verify updated version', command: 'xcodebuild -version' },
    ],
    documentationUrl: getTroubleshootingUrl('xcode'),
    commonCauses: [
      'Automatic updates are disabled',
      'Not enough disk space for update',
      'Using an older macOS that cannot run the latest Xcode',
    ],
    severity: 'error',
  },

  // ==========================================================================
  // Simulator Errors
  // ==========================================================================

  SIMULATOR_NOT_FOUND: {
    code: 'SIMULATOR_NOT_FOUND',
    icon: '❌',
    title: 'Simulator Not Found',
    explanation: 'The specified simulator device was not found. It may not be installed or the name/UDID may be incorrect.',
    recoverySteps: [
      { step: 1, description: 'List available simulators', command: 'xcrun simctl list devices available' },
      { step: 2, description: 'Install additional simulators via Xcode → Settings → Platforms' },
      { step: 3, description: 'Run setup check to see available options', command: '/ios.setup --check' },
    ],
    documentationUrl: getTroubleshootingUrl('simulator'),
    autoRecoveryCommands: ['/ios.setup --check'],
    commonCauses: [
      'Simulator runtime is not installed',
      'Typo in simulator name or UDID',
      'Simulator was deleted',
      'iOS version runtime not downloaded',
    ],
    severity: 'error',
  },

  SIMULATOR_NOT_BOOTED: {
    code: 'SIMULATOR_NOT_BOOTED',
    icon: '📱',
    title: 'No Simulator Running',
    explanation: 'No iOS simulator is currently booted. A running simulator is required for this operation.',
    recoverySteps: [
      { step: 1, description: 'Boot a simulator manually', command: 'xcrun simctl boot "iPhone 15 Pro"' },
      { step: 2, description: 'Or open Simulator.app', command: 'open -a Simulator' },
      { step: 3, description: 'Or let Maestro fix it automatically', command: '/ios.setup --fix' },
    ],
    documentationUrl: getTroubleshootingUrl('simulator'),
    autoRecoveryCommands: ['/ios.setup --fix', 'xcrun simctl boot "iPhone 15 Pro"'],
    commonCauses: [
      'Simulator was shut down or crashed',
      'macOS was restarted',
      'No simulator has been started yet',
    ],
    severity: 'error',
  },

  SIMULATOR_BOOT_FAILED: {
    code: 'SIMULATOR_BOOT_FAILED',
    icon: '❌',
    title: 'Simulator Boot Failed',
    explanation: 'The simulator failed to start. This can happen due to resource constraints or corrupted simulator data.',
    recoverySteps: [
      { step: 1, description: 'Close other running simulators to free resources' },
      { step: 2, description: 'Try erasing the simulator', command: 'xcrun simctl erase "iPhone 15 Pro"' },
      { step: 3, description: 'Restart CoreSimulatorService', command: 'killall -9 com.apple.CoreSimulator.CoreSimulatorService' },
      { step: 4, description: 'Try booting again', command: 'xcrun simctl boot "iPhone 15 Pro"' },
    ],
    documentationUrl: getTroubleshootingUrl('simulator'),
    commonCauses: [
      'Insufficient system memory (RAM)',
      'Corrupted simulator data',
      'CoreSimulatorService is in a bad state',
      'Too many simulators running simultaneously',
    ],
    severity: 'error',
  },

  // ==========================================================================
  // App Errors
  // ==========================================================================

  APP_NOT_INSTALLED: {
    code: 'APP_NOT_INSTALLED',
    icon: '📦',
    title: 'App Not Installed',
    explanation: 'The app is not installed on the simulator. You need to build and install it first.',
    recoverySteps: [
      { step: 1, description: 'Build the app for simulator', command: 'xcodebuild -scheme YourApp -sdk iphonesimulator' },
      { step: 2, description: 'Install the built app', command: 'xcrun simctl install booted /path/to/YourApp.app' },
      { step: 3, description: 'Or use Maestro to launch (will auto-install)', command: '/ios.run_flow --inline "launchApp: com.your.bundleid"' },
    ],
    documentationUrl: getTroubleshootingUrl('app-issues'),
    commonCauses: [
      'App was never installed',
      'App was uninstalled',
      'Wrong simulator selected',
      'Bundle ID mismatch',
    ],
    severity: 'error',
  },

  APP_INSTALL_FAILED: {
    code: 'APP_INSTALL_FAILED',
    icon: '❌',
    title: 'App Installation Failed',
    explanation: 'Failed to install the app on the simulator. The app bundle may be invalid or incompatible.',
    recoverySteps: [
      { step: 1, description: 'Verify the .app bundle exists and is valid' },
      { step: 2, description: 'Ensure app is built for simulator (not device)', command: 'lipo -info /path/to/YourApp.app/YourApp' },
      { step: 3, description: 'Clean build folder and rebuild', command: 'xcodebuild clean && xcodebuild -scheme YourApp -sdk iphonesimulator' },
      { step: 4, description: 'Try uninstalling first', command: 'xcrun simctl uninstall booted com.your.bundleid' },
    ],
    documentationUrl: getTroubleshootingUrl('app-issues'),
    commonCauses: [
      'App built for wrong architecture (arm64 device vs x86_64/arm64 simulator)',
      'Corrupted .app bundle',
      'Missing required frameworks',
      'Code signing issues',
    ],
    severity: 'error',
  },

  APP_LAUNCH_FAILED: {
    code: 'APP_LAUNCH_FAILED',
    icon: '❌',
    title: 'App Launch Failed',
    explanation: 'The app failed to launch on the simulator. It may have crashed on startup or have missing dependencies.',
    recoverySteps: [
      { step: 1, description: 'Check for crash logs', command: '/ios.logs --crash' },
      { step: 2, description: 'Verify bundle ID is correct' },
      { step: 3, description: 'Try reinstalling the app', command: 'xcrun simctl uninstall booted com.your.bundleid && xcrun simctl install booted /path/to/App.app' },
      { step: 4, description: 'Check Console.app for launch errors' },
    ],
    documentationUrl: getTroubleshootingUrl('app-issues'),
    commonCauses: [
      'App crashes on startup',
      'Missing entitlements or capabilities',
      'Invalid code signature',
      'Required frameworks not available on simulator',
    ],
    severity: 'error',
  },

  APP_CRASHED: {
    code: 'APP_CRASHED',
    icon: '💥',
    title: 'App Crashed',
    explanation: 'The app crashed during the operation. Check crash logs for the root cause.',
    recoverySteps: [
      { step: 1, description: 'View recent crash logs', command: '/ios.logs --crash' },
      { step: 2, description: 'Check Console.app for crash details' },
      { step: 3, description: 'Restart the app', command: '/ios.run_flow --inline "launchApp: com.your.bundleid"' },
      { step: 4, description: 'Debug in Xcode to get full stack trace', optional: true },
    ],
    documentationUrl: getTroubleshootingUrl('app-issues'),
    commonCauses: [
      'Unhandled exception in code',
      'Memory pressure (low memory)',
      'Assertion failure',
      'Force unwrapping nil optional',
      'Stack overflow',
    ],
    severity: 'error',
  },

  APP_NOT_RUNNING: {
    code: 'APP_NOT_RUNNING',
    icon: '⏸️',
    title: 'App Not Running',
    explanation: 'The app is not currently running. It may have been terminated or was never launched.',
    recoverySteps: [
      { step: 1, description: 'Launch the app', command: '/ios.run_flow --inline "launchApp: com.your.bundleid"' },
      { step: 2, description: 'Check if app was installed', command: 'xcrun simctl listapps booted | grep bundleIdentifier' },
    ],
    documentationUrl: getTroubleshootingUrl('app-issues'),
    autoRecoveryCommands: ['/ios.run_flow --inline "launchApp: <bundleId>"'],
    commonCauses: [
      'App was terminated by user',
      'App crashed silently',
      'System terminated app (memory pressure)',
      'App was never launched',
    ],
    severity: 'warning',
  },

  // ==========================================================================
  // Element Interaction Errors
  // ==========================================================================

  ELEMENT_NOT_FOUND: {
    code: 'ELEMENT_NOT_FOUND',
    icon: '🔍',
    title: 'Element Not Found',
    explanation: 'Could not find the specified element on the current screen. The element may not exist, have a different identifier, or not be rendered yet.',
    recoverySteps: [
      { step: 1, description: 'Inspect the current UI hierarchy', command: '/ios.inspect' },
      { step: 2, description: 'Capture a screenshot to see current state', command: '/ios.snapshot' },
      { step: 3, description: 'Try using a different selector (label, text, or accessibility identifier)' },
      { step: 4, description: 'Add a wait if element loads asynchronously', optional: true },
    ],
    documentationUrl: getTroubleshootingUrl('element-not-found'),
    autoRecoveryCommands: ['/ios.inspect'],
    commonCauses: [
      'Element has a different accessibility identifier',
      'Element has not loaded yet (async)',
      'Wrong screen is displayed',
      'Element is inside a scroll view and not rendered',
    ],
    severity: 'error',
  },

  ELEMENT_NOT_HITTABLE: {
    code: 'ELEMENT_NOT_HITTABLE',
    icon: '🚫',
    title: 'Element Not Hittable',
    explanation: 'The element exists but cannot be tapped. It may be obscured by another view, off-screen, or not interactive.',
    recoverySteps: [
      { step: 1, description: 'Inspect element position and state', command: '/ios.inspect' },
      { step: 2, description: 'Dismiss any overlaying views (alerts, popovers, keyboards)' },
      { step: 3, description: 'Scroll element into view', command: '/ios.scroll --to #<identifier>' },
      { step: 4, description: 'Check if element is marked as userInteractionEnabled=false' },
    ],
    documentationUrl: getTroubleshootingUrl('element-not-hittable'),
    commonCauses: [
      'Another view is covering the element',
      'Element is off-screen (needs scrolling)',
      'Keyboard is covering the element',
      'Element has userInteractionEnabled=false',
      'Element is inside a disabled parent',
    ],
    severity: 'error',
  },

  ELEMENT_NOT_VISIBLE: {
    code: 'ELEMENT_NOT_VISIBLE',
    icon: '👁️',
    title: 'Element Not Visible',
    explanation: 'The element exists in the view hierarchy but is not currently visible on screen.',
    recoverySteps: [
      { step: 1, description: 'Scroll the element into view', command: '/ios.scroll --to #<identifier>' },
      { step: 2, description: 'Try scrolling down', command: '/ios.scroll down' },
      { step: 3, description: 'Inspect to find element position', command: '/ios.inspect' },
    ],
    documentationUrl: getTroubleshootingUrl('element-visibility'),
    autoRecoveryCommands: ['/ios.scroll --to #<identifier>', '/ios.scroll down'],
    commonCauses: [
      'Element is below the fold (needs scroll)',
      'Element is in a different tab or section',
      'Element has opacity=0 or isHidden=true',
      'Parent container is hidden',
    ],
    severity: 'warning',
  },

  ELEMENT_NOT_ENABLED: {
    code: 'ELEMENT_NOT_ENABLED',
    icon: '🔒',
    title: 'Element Disabled',
    explanation: 'The element is in a disabled state and cannot be interacted with.',
    recoverySteps: [
      { step: 1, description: 'Complete prerequisite steps (e.g., fill required fields)' },
      { step: 2, description: 'Check for form validation errors' },
      { step: 3, description: 'Verify element state', command: '/ios.inspect' },
      { step: 4, description: 'Wait for element to become enabled', optional: true },
    ],
    documentationUrl: getTroubleshootingUrl('element-state'),
    commonCauses: [
      'Form validation prevents submission',
      'Required fields are empty',
      'Element requires authentication',
      'Loading state has not completed',
    ],
    severity: 'warning',
  },

  ELEMENT_OBSCURED: {
    code: 'ELEMENT_OBSCURED',
    icon: '🔲',
    title: 'Element Obscured',
    explanation: 'Another element is covering the target element, preventing interaction.',
    recoverySteps: [
      { step: 1, description: 'Dismiss any alerts or modals', command: '/ios.tap "OK"' },
      { step: 2, description: 'Close popovers or bottom sheets' },
      { step: 3, description: 'Dismiss the keyboard if showing', command: '/ios.tap "Done"' },
      { step: 4, description: 'Inspect to identify obscuring element', command: '/ios.inspect' },
    ],
    documentationUrl: getTroubleshootingUrl('element-obscured'),
    commonCauses: [
      'System alert is displayed',
      'Modal or popover is open',
      'Keyboard is covering the element',
      'Loading overlay is visible',
      'Toast message is displayed',
    ],
    severity: 'warning',
  },

  ELEMENT_OFF_SCREEN: {
    code: 'ELEMENT_OFF_SCREEN',
    icon: '📍',
    title: 'Element Off Screen',
    explanation: 'The element is positioned outside the visible screen bounds.',
    recoverySteps: [
      { step: 1, description: 'Scroll to bring element into view', command: '/ios.scroll --to #<identifier>' },
      { step: 2, description: 'Navigate to the correct screen or tab' },
      { step: 3, description: 'Check element frame position', command: '/ios.inspect' },
    ],
    documentationUrl: getTroubleshootingUrl('element-position'),
    autoRecoveryCommands: ['/ios.scroll --to #<identifier>'],
    commonCauses: [
      'Element requires scrolling',
      'Element is in an off-screen container',
      'Keyboard pushed content up',
      'Wrong screen orientation',
    ],
    severity: 'warning',
  },

  ELEMENT_ZERO_SIZE: {
    code: 'ELEMENT_ZERO_SIZE',
    icon: '📐',
    title: 'Element Has Zero Size',
    explanation: 'The element has a width or height of zero, making it impossible to interact with.',
    recoverySteps: [
      { step: 1, description: 'Wait for element to load or expand' },
      { step: 2, description: 'Check Auto Layout constraints in Xcode' },
      { step: 3, description: 'Verify element is properly configured' },
    ],
    documentationUrl: getTroubleshootingUrl('element-state'),
    commonCauses: [
      'Element is collapsed (accordion/disclosure)',
      'Auto Layout constraints are broken',
      'Element content has not loaded',
      'Element is hidden programmatically',
    ],
    severity: 'warning',
  },

  // ==========================================================================
  // Maestro/Flow Errors
  // ==========================================================================

  MAESTRO_NOT_INSTALLED: {
    code: 'MAESTRO_NOT_INSTALLED',
    icon: '🎭',
    title: 'Maestro CLI Not Installed',
    explanation: 'The Maestro Mobile CLI is not installed or not in your PATH. Maestro is required for flow automation.',
    recoverySteps: [
      { step: 1, description: 'Install Maestro using the official installer', command: 'curl -Ls "https://get.maestro.mobile.dev" | bash' },
      { step: 2, description: 'Alternatively, install via Homebrew', command: 'brew tap mobile-dev-inc/tap && brew install maestro' },
      { step: 3, description: 'Restart your terminal to update PATH' },
      { step: 4, description: 'Verify installation', command: 'maestro --version' },
    ],
    documentationUrl: getTroubleshootingUrl('maestro-cli'),
    autoRecoveryCommands: ['/ios.setup --fix'],
    commonCauses: [
      'Maestro was never installed',
      'PATH does not include ~/.maestro/bin',
      'Terminal was not restarted after installation',
    ],
    severity: 'error',
  },

  FLOW_TIMEOUT: {
    code: 'FLOW_TIMEOUT',
    icon: '⏱️',
    title: 'Flow Execution Timed Out',
    explanation: 'The flow took too long to complete. The app may be slow or an element may never have appeared.',
    recoverySteps: [
      { step: 1, description: 'Increase the timeout', command: '/ios.run_flow <flow.yaml> --timeout 120' },
      { step: 2, description: 'Check if app is frozen or very slow' },
      { step: 3, description: 'Break flow into smaller steps for debugging' },
      { step: 4, description: 'Add explicit wait steps for slow screens' },
    ],
    documentationUrl: getTroubleshootingUrl('flow-issues'),
    commonCauses: [
      'App is making slow network requests',
      'Element never appears (wrong selector)',
      'App is frozen or crashed',
      'Infinite loading state',
    ],
    severity: 'error',
  },

  FLOW_VALIDATION_FAILED: {
    code: 'FLOW_VALIDATION_FAILED',
    icon: '📋',
    title: 'Flow Validation Failed',
    explanation: 'The flow YAML file contains syntax errors or invalid actions.',
    recoverySteps: [
      { step: 1, description: 'Validate the flow file', command: 'maestro validate <flow.yaml>' },
      { step: 2, description: 'Check YAML syntax (indentation, colons, quotes)' },
      { step: 3, description: 'Verify all action types are supported' },
      { step: 4, description: 'Review Maestro flow documentation' },
    ],
    documentationUrl: getCommandsUrl('run-flow'),
    commonCauses: [
      'Invalid YAML syntax',
      'Unknown action type',
      'Missing required parameters',
      'Incorrect indentation',
    ],
    severity: 'error',
  },

  // ==========================================================================
  // Screenshot/Capture Errors
  // ==========================================================================

  SCREENSHOT_FAILED: {
    code: 'SCREENSHOT_FAILED',
    icon: '📷',
    title: 'Screenshot Capture Failed',
    explanation: 'Failed to capture a screenshot from the simulator. The simulator may be unresponsive.',
    recoverySteps: [
      { step: 1, description: 'Check if simulator is responsive' },
      { step: 2, description: 'Try restarting the Simulator app', command: 'killall Simulator && open -a Simulator' },
      { step: 3, description: 'Verify simctl is working', command: 'xcrun simctl io booted screenshot /tmp/test.png' },
      { step: 4, description: 'Check disk space for screenshot storage' },
    ],
    documentationUrl: getTroubleshootingUrl('screenshot-issues'),
    commonCauses: [
      'Simulator is frozen or unresponsive',
      'Disk is full',
      'CoreSimulatorService is in bad state',
      'Screenshot timeout',
    ],
    severity: 'error',
  },

  RECORDING_FAILED: {
    code: 'RECORDING_FAILED',
    icon: '🎥',
    title: 'Video Recording Failed',
    explanation: 'Failed to record video from the simulator.',
    recoverySteps: [
      { step: 1, description: 'Stop any existing recordings first' },
      { step: 2, description: 'Check available disk space' },
      { step: 3, description: 'Verify simulator is responding' },
      { step: 4, description: 'Try manual recording', command: 'xcrun simctl io booted recordVideo /tmp/test.mov' },
    ],
    documentationUrl: getTroubleshootingUrl('screenshot-issues'),
    commonCauses: [
      'Another recording is in progress',
      'Insufficient disk space',
      'Simulator is frozen',
      'Invalid output path',
    ],
    severity: 'error',
  },

  // ==========================================================================
  // Timeout Errors
  // ==========================================================================

  TIMEOUT: {
    code: 'TIMEOUT',
    icon: '⏰',
    title: 'Operation Timed Out',
    explanation: 'The operation took too long to complete. The system may be under heavy load.',
    recoverySteps: [
      { step: 1, description: 'Try the operation again' },
      { step: 2, description: 'Check if simulator is responsive' },
      { step: 3, description: 'Close other resource-intensive applications' },
      { step: 4, description: 'Restart the simulator if frozen' },
    ],
    documentationUrl: getTroubleshootingUrl('timeout-issues'),
    commonCauses: [
      'System under heavy load',
      'Simulator is frozen',
      'Network request timeout',
      'Insufficient system resources',
    ],
    severity: 'warning',
  },

  INTERACTION_TIMEOUT: {
    code: 'INTERACTION_TIMEOUT',
    icon: '⏱️',
    title: 'Interaction Timed Out',
    explanation: 'The element interaction did not complete within the timeout period.',
    recoverySteps: [
      { step: 1, description: 'Increase timeout for this action', command: '/ios.tap #element --timeout 10' },
      { step: 2, description: 'Check if element is interactive', command: '/ios.inspect' },
      { step: 3, description: 'Verify app is not frozen' },
    ],
    documentationUrl: getTroubleshootingUrl('timeout-issues'),
    commonCauses: [
      'Element is not responding to touches',
      'App is frozen or very slow',
      'Animation blocking interaction',
      'Element appeared but is not yet interactive',
    ],
    severity: 'warning',
  },

  // ==========================================================================
  // Build/Test Errors
  // ==========================================================================

  BUILD_FAILED: {
    code: 'BUILD_FAILED',
    icon: '🔨',
    title: 'Build Failed',
    explanation: 'The Xcode build failed. Check build logs for compilation or linking errors.',
    recoverySteps: [
      { step: 1, description: 'Check build output for specific errors' },
      { step: 2, description: 'Clean build folder', command: 'xcodebuild clean' },
      { step: 3, description: 'Delete DerivedData', command: 'rm -rf ~/Library/Developer/Xcode/DerivedData' },
      { step: 4, description: 'Install/update dependencies (CocoaPods, SPM)' },
    ],
    documentationUrl: getTroubleshootingUrl('build-issues'),
    commonCauses: [
      'Compilation errors in code',
      'Missing dependencies',
      'Outdated CocoaPods or SPM packages',
      'Corrupted DerivedData',
      'Missing provisioning profile or certificates',
    ],
    severity: 'error',
  },

  TEST_FAILED: {
    code: 'TEST_FAILED',
    icon: '🧪',
    title: 'Test Failed',
    explanation: 'One or more tests failed during execution.',
    recoverySteps: [
      { step: 1, description: 'Review test output for failure details' },
      { step: 2, description: 'Check test assertions and expected values' },
      { step: 3, description: 'Run failed tests individually for debugging' },
      { step: 4, description: 'View test results in Xcode', optional: true },
    ],
    documentationUrl: getTroubleshootingUrl('test-issues'),
    commonCauses: [
      'Assertion failure',
      'Test setup/teardown error',
      'Timing issues in async tests',
      'Test environment not properly configured',
    ],
    severity: 'warning',
  },

  // ==========================================================================
  // Log/Diagnostic Errors
  // ==========================================================================

  LOG_COLLECTION_FAILED: {
    code: 'LOG_COLLECTION_FAILED',
    icon: '📋',
    title: 'Log Collection Failed',
    explanation: 'Failed to collect logs from the simulator.',
    recoverySteps: [
      { step: 1, description: 'Check if simulator is booted' },
      { step: 2, description: 'Try using system log directly', command: 'xcrun simctl spawn booted log stream' },
      { step: 3, description: 'Restart the simulator' },
    ],
    documentationUrl: getTroubleshootingUrl('log-issues'),
    commonCauses: [
      'Simulator is not booted',
      'Log service is not running',
      'Permission issues',
    ],
    severity: 'warning',
  },

  // ==========================================================================
  // Generic Errors
  // ==========================================================================

  COMMAND_FAILED: {
    code: 'COMMAND_FAILED',
    icon: '❌',
    title: 'Command Failed',
    explanation: 'The command execution failed. Check the error details for more information.',
    recoverySteps: [
      { step: 1, description: 'Review the error message for specific details' },
      { step: 2, description: 'Check command syntax and parameters' },
      { step: 3, description: 'Verify environment setup', command: '/ios.setup --check' },
    ],
    documentationUrl: getTroubleshootingUrl('common-issues'),
    severity: 'error',
  },

  PARSE_ERROR: {
    code: 'PARSE_ERROR',
    icon: '📄',
    title: 'Parse Error',
    explanation: 'Failed to parse the output. The format may be unexpected or corrupted.',
    recoverySteps: [
      { step: 1, description: 'Try the operation again' },
      { step: 2, description: 'Check for version compatibility issues' },
      { step: 3, description: 'Report this as a bug if it persists' },
    ],
    documentationUrl: getTroubleshootingUrl('common-issues'),
    commonCauses: [
      'Unexpected output format',
      'Corrupted data',
      'Version mismatch',
    ],
    severity: 'warning',
  },

  UNKNOWN: {
    code: 'UNKNOWN',
    icon: '❓',
    title: 'Unknown Error',
    explanation: 'An unexpected error occurred. Check the error details for more information.',
    recoverySteps: [
      { step: 1, description: 'Check the full error message' },
      { step: 2, description: 'Run environment check', command: '/ios.setup --check' },
      { step: 3, description: 'Check system logs for additional context' },
      { step: 4, description: 'Report the issue if it persists' },
    ],
    documentationUrl: getTroubleshootingUrl('common-issues'),
    severity: 'error',
  },

  // InteractionErrorCode also has UNKNOWN_ERROR
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    icon: '❓',
    title: 'Unknown Error',
    explanation: 'An unexpected error occurred during the interaction.',
    recoverySteps: [
      { step: 1, description: 'Capture current state', command: '/ios.snapshot' },
      { step: 2, description: 'Inspect UI hierarchy', command: '/ios.inspect' },
      { step: 3, description: 'Check error details and try again' },
    ],
    documentationUrl: getTroubleshootingUrl('common-issues'),
    severity: 'error',
  },
};

// =============================================================================
// Error Message Retrieval
// =============================================================================

/**
 * Get the error message configuration for an error code
 *
 * @param code - The error code to look up
 * @returns ErrorMessage configuration
 */
export function getErrorMessage(code: ErrorCode): ErrorMessage {
  const message = ERROR_MESSAGES[code];
  if (message) {
    return message;
  }

  logger.warn(`${LOG_CONTEXT} Unknown error code: ${code}`);

  // Return a default error message for unknown codes
  return {
    code,
    icon: '❌',
    title: 'Error',
    explanation: `An error occurred: ${code}`,
    recoverySteps: [
      { step: 1, description: 'Check the error details' },
      { step: 2, description: 'Run environment check', command: '/ios.setup --check' },
    ],
    documentationUrl: getTroubleshootingUrl('common-issues'),
    severity: 'error',
  };
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format an error message for display to the user
 *
 * This produces output matching the spec:
 * ```
 * ❌ Xcode Not Found
 *
 * Maestro couldn't find Xcode on your system.
 *
 * To fix this:
 * 1. Install Xcode from the App Store
 * 2. Open Xcode once to accept the license
 * 3. Run: xcode-select --install
 *
 * Need help? https://docs.runmaestro.ai/ios-development/troubleshooting#xcode
 * ```
 *
 * @param code - The error code
 * @param options - Formatting options
 * @returns Formatted error message string
 */
export function formatUserFriendlyError(
  code: ErrorCode,
  options: FormatErrorOptions = {}
): string {
  const {
    includeAutoRecovery = true,
    includeDocLink = true,
    includeCauses = false,
    compact = false,
    context: _context,  // Reserved for future context-aware messages
  } = options;
  void _context;  // Silence unused warning

  const message = getErrorMessage(code);

  if (compact) {
    return formatCompactError(message);
  }

  const lines: string[] = [];

  // Header with icon and title
  lines.push(`${message.icon} ${message.title}`);
  lines.push('');

  // Explanation
  lines.push(message.explanation);
  lines.push('');

  // Common causes (optional)
  if (includeCauses && message.commonCauses && message.commonCauses.length > 0) {
    lines.push('**Common causes:**');
    for (const cause of message.commonCauses) {
      lines.push(`- ${cause}`);
    }
    lines.push('');
  }

  // Recovery steps
  lines.push('**To fix this:**');
  for (const step of message.recoverySteps) {
    let stepText = `${step.step}. ${step.description}`;
    if (step.command) {
      stepText += `\n   \`${step.command}\``;
    }
    if (step.optional) {
      stepText += ' *(optional)*';
    }
    lines.push(stepText);
  }
  lines.push('');

  // Auto-recovery commands (optional)
  if (includeAutoRecovery && message.autoRecoveryCommands && message.autoRecoveryCommands.length > 0) {
    lines.push('**Quick fix:**');
    lines.push('```');
    for (const cmd of message.autoRecoveryCommands) {
      lines.push(cmd);
    }
    lines.push('```');
    lines.push('');
  }

  // Documentation link
  if (includeDocLink) {
    lines.push(`**Need help?** ${message.documentationUrl}`);
  }

  logger.debug(`${LOG_CONTEXT} Formatted error message for ${code}`);
  return lines.join('\n');
}

/**
 * Format error message in compact single-line format
 */
function formatCompactError(message: ErrorMessage): string {
  const firstStep = message.recoverySteps[0];
  let compact = `${message.icon} ${message.title}: ${message.explanation}`;

  if (firstStep?.command) {
    compact += ` Try: ${firstStep.command}`;
  } else if (firstStep) {
    compact += ` ${firstStep.description}`;
  }

  return compact;
}

/**
 * Format error message as JSON for programmatic use
 *
 * @param code - The error code
 * @param context - Additional context to include
 * @returns JSON string
 */
export function formatErrorAsJson(
  code: ErrorCode,
  context?: Record<string, unknown>
): string {
  const message = getErrorMessage(code);

  return JSON.stringify(
    {
      code: message.code,
      title: message.title,
      explanation: message.explanation,
      recoverySteps: message.recoverySteps.map((s) => ({
        step: s.step,
        description: s.description,
        command: s.command,
        optional: s.optional,
      })),
      documentationUrl: message.documentationUrl,
      autoRecoveryCommands: message.autoRecoveryCommands,
      commonCauses: message.commonCauses,
      severity: message.severity,
      context,
    },
    null,
    2
  );
}

/**
 * Format error for markdown display (e.g., in AI terminal)
 *
 * @param code - The error code
 * @param options - Formatting options
 * @returns Markdown-formatted string
 */
export function formatErrorAsMarkdown(
  code: ErrorCode,
  options: FormatErrorOptions = {}
): string {
  const { context } = options;
  const message = getErrorMessage(code);

  const lines: string[] = [];

  // Header
  lines.push(`## ${message.icon} ${message.title}`);
  lines.push('');

  // Explanation
  lines.push(message.explanation);
  lines.push('');

  // Context-specific information
  if (context) {
    const contextEntries = Object.entries(context).filter(([, v]) => v !== undefined);
    if (contextEntries.length > 0) {
      lines.push('### Context');
      lines.push('');
      for (const [key, value] of contextEntries) {
        lines.push(`- **${key}**: \`${value}\``);
      }
      lines.push('');
    }
  }

  // Common causes
  if (message.commonCauses && message.commonCauses.length > 0) {
    lines.push('### Common Causes');
    lines.push('');
    for (const cause of message.commonCauses) {
      lines.push(`- ${cause}`);
    }
    lines.push('');
  }

  // Recovery steps
  lines.push('### How to Fix');
  lines.push('');
  for (const step of message.recoverySteps) {
    let stepLine = `${step.step}. ${step.description}`;
    if (step.optional) {
      stepLine += ' *(optional)*';
    }
    lines.push(stepLine);
    if (step.command) {
      lines.push('   ```');
      lines.push(`   ${step.command}`);
      lines.push('   ```');
    }
  }
  lines.push('');

  // Quick fix commands
  if (message.autoRecoveryCommands && message.autoRecoveryCommands.length > 0) {
    lines.push('### Quick Fix');
    lines.push('');
    lines.push('```');
    for (const cmd of message.autoRecoveryCommands) {
      lines.push(cmd);
    }
    lines.push('```');
    lines.push('');
  }

  // Documentation link
  lines.push(`**Documentation**: [Troubleshooting Guide](${message.documentationUrl})`);
  lines.push('');

  return lines.join('\n');
}

// =============================================================================
// Recovery Helpers
// =============================================================================

/**
 * Get auto-recovery commands for an error code
 *
 * @param code - The error code
 * @returns Array of recovery commands, or empty array if none
 */
export function getAutoRecoveryCommands(code: ErrorCode): string[] {
  const message = ERROR_MESSAGES[code];
  return message?.autoRecoveryCommands || [];
}

/**
 * Check if an error can be auto-recovered
 *
 * @param code - The error code
 * @returns True if auto-recovery is possible
 */
export function canAutoRecover(code: ErrorCode): boolean {
  const commands = getAutoRecoveryCommands(code);
  return commands.length > 0;
}

/**
 * Get the first recovery command to try
 *
 * @param code - The error code
 * @returns First recovery command or undefined
 */
export function getFirstRecoveryCommand(code: ErrorCode): string | undefined {
  const message = ERROR_MESSAGES[code];

  // First try auto-recovery commands
  if (message?.autoRecoveryCommands && message.autoRecoveryCommands.length > 0) {
    return message.autoRecoveryCommands[0];
  }

  // Then try commands from recovery steps
  const stepWithCommand = message?.recoverySteps.find((s) => s.command);
  return stepWithCommand?.command;
}

/**
 * Get the documentation URL for an error code
 *
 * @param code - The error code
 * @returns Documentation URL
 */
export function getDocumentationUrl(code: ErrorCode): string {
  const message = ERROR_MESSAGES[code];
  return message?.documentationUrl || getTroubleshootingUrl('common-issues');
}

/**
 * Get error severity for logging/reporting
 *
 * @param code - The error code
 * @returns Severity level
 */
export function getErrorSeverity(code: ErrorCode): 'warning' | 'error' | 'critical' {
  const message = ERROR_MESSAGES[code];
  return message?.severity || 'error';
}

// =============================================================================
// Error Categorization
// =============================================================================

/**
 * Error categories for grouping related errors
 */
export type ErrorCategory =
  | 'environment'
  | 'simulator'
  | 'app'
  | 'element'
  | 'flow'
  | 'capture'
  | 'timeout'
  | 'build'
  | 'other';

/**
 * Get the category for an error code
 *
 * @param code - The error code
 * @returns Error category
 */
export function getErrorCategory(code: ErrorCode): ErrorCategory {
  // Environment errors
  if (code === 'XCODE_NOT_FOUND' || code === 'XCODE_VERSION_UNSUPPORTED') {
    return 'environment';
  }

  // Simulator errors
  if (
    code === 'SIMULATOR_NOT_FOUND' ||
    code === 'SIMULATOR_NOT_BOOTED' ||
    code === 'SIMULATOR_BOOT_FAILED'
  ) {
    return 'simulator';
  }

  // App errors
  if (
    code === 'APP_NOT_INSTALLED' ||
    code === 'APP_INSTALL_FAILED' ||
    code === 'APP_LAUNCH_FAILED' ||
    code === 'APP_CRASHED' ||
    code === 'APP_NOT_RUNNING'
  ) {
    return 'app';
  }

  // Element interaction errors
  if (
    code === 'ELEMENT_NOT_FOUND' ||
    code === 'ELEMENT_NOT_HITTABLE' ||
    code === 'ELEMENT_NOT_VISIBLE' ||
    code === 'ELEMENT_NOT_ENABLED' ||
    code === 'ELEMENT_OBSCURED' ||
    code === 'ELEMENT_OFF_SCREEN' ||
    code === 'ELEMENT_ZERO_SIZE'
  ) {
    return 'element';
  }

  // Flow/Maestro errors
  if (
    code === 'MAESTRO_NOT_INSTALLED' ||
    code === 'FLOW_TIMEOUT' ||
    code === 'FLOW_VALIDATION_FAILED'
  ) {
    return 'flow';
  }

  // Capture errors
  if (code === 'SCREENSHOT_FAILED' || code === 'RECORDING_FAILED') {
    return 'capture';
  }

  // Timeout errors
  if (code === 'TIMEOUT' || code === 'INTERACTION_TIMEOUT') {
    return 'timeout';
  }

  // Build/test errors
  if (code === 'BUILD_FAILED' || code === 'TEST_FAILED') {
    return 'build';
  }

  return 'other';
}

/**
 * Get all error codes in a category
 *
 * @param category - The error category
 * @returns Array of error codes
 */
export function getErrorsInCategory(category: ErrorCategory): ErrorCode[] {
  return Object.keys(ERROR_MESSAGES).filter(
    (code) => getErrorCategory(code) === category
  ) as ErrorCode[];
}

// =============================================================================
// Error Message Summary
// =============================================================================

/**
 * Get a quick summary of all available error messages
 * Useful for documentation and debugging
 */
export function getErrorMessagesSummary(): Array<{
  code: ErrorCode;
  title: string;
  category: ErrorCategory;
  hasAutoRecovery: boolean;
}> {
  return Object.entries(ERROR_MESSAGES).map(([code, message]) => ({
    code: code as ErrorCode,
    title: message.title,
    category: getErrorCategory(code),
    hasAutoRecovery: (message.autoRecoveryCommands?.length || 0) > 0,
  }));
}
