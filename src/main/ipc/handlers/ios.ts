/**
 * iOS IPC Handlers
 *
 * IPC handlers for iOS tooling operations.
 * Exposes iOS simulator, screenshot, and log functionality to the renderer.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { withIpcErrorLogging } from '../../utils/ipcHandler';
import { logger } from '../../utils/logger';
import * as iosTools from '../../ios-tools';
import { LogEntry } from '../../ios-tools/types';

const LOG_CONTEXT = '[iOS-IPC]';

// Helper to create handler options with consistent context
const handlerOpts = (operation: string) => ({
  context: LOG_CONTEXT,
  operation,
});

/**
 * Register all iOS-related IPC handlers.
 */
export function registerIOSHandlers(): void {
  // ==========================================================================
  // Xcode Detection
  // ==========================================================================

  // Detect Xcode installation
  ipcMain.handle(
    'ios:xcode:detect',
    withIpcErrorLogging(handlerOpts('detectXcode'), async () => {
      return iosTools.detectXcode();
    })
  );

  // Get Xcode version
  ipcMain.handle(
    'ios:xcode:version',
    withIpcErrorLogging(handlerOpts('getXcodeVersion'), async () => {
      return iosTools.getXcodeVersion();
    })
  );

  // Get full Xcode info
  ipcMain.handle(
    'ios:xcode:info',
    withIpcErrorLogging(handlerOpts('getXcodeInfo'), async () => {
      return iosTools.getXcodeInfo();
    })
  );

  // Validate Xcode installation
  ipcMain.handle(
    'ios:xcode:validate',
    withIpcErrorLogging(handlerOpts('validateXcode'), async () => {
      return iosTools.validateXcodeInstallation();
    })
  );

  // List iOS SDKs
  ipcMain.handle(
    'ios:xcode:sdks',
    withIpcErrorLogging(handlerOpts('listSDKs'), async () => {
      return iosTools.listSDKs();
    })
  );

  // ==========================================================================
  // Simulator Management
  // ==========================================================================

  // List all simulators
  ipcMain.handle(
    'ios:simulator:list',
    withIpcErrorLogging(handlerOpts('listSimulators'), async () => {
      return iosTools.listSimulators();
    })
  );

  // Get booted simulators
  ipcMain.handle(
    'ios:simulator:booted',
    withIpcErrorLogging(handlerOpts('getBootedSimulators'), async () => {
      return iosTools.getBootedSimulators();
    })
  );

  // Get specific simulator
  ipcMain.handle(
    'ios:simulator:get',
    withIpcErrorLogging(handlerOpts('getSimulator'), async (udid: string) => {
      return iosTools.getSimulator(udid);
    })
  );

  // Boot simulator
  ipcMain.handle(
    'ios:simulator:boot',
    withIpcErrorLogging(
      handlerOpts('bootSimulator'),
      async (udid: string, options?: { timeout?: number; waitForBoot?: boolean }) => {
        return iosTools.bootSimulator({
          udid,
          ...options,
        });
      }
    )
  );

  // Shutdown simulator
  ipcMain.handle(
    'ios:simulator:shutdown',
    withIpcErrorLogging(handlerOpts('shutdownSimulator'), async (udid: string) => {
      return iosTools.shutdownSimulator(udid);
    })
  );

  // Erase simulator
  ipcMain.handle(
    'ios:simulator:erase',
    withIpcErrorLogging(handlerOpts('eraseSimulator'), async (udid: string) => {
      return iosTools.eraseSimulator(udid);
    })
  );

  // ==========================================================================
  // App Installation & Lifecycle
  // ==========================================================================

  // Install app
  ipcMain.handle(
    'ios:app:install',
    withIpcErrorLogging(handlerOpts('installApp'), async (udid: string, appPath: string) => {
      return iosTools.installApp({ udid, appPath });
    })
  );

  // Uninstall app
  ipcMain.handle(
    'ios:app:uninstall',
    withIpcErrorLogging(handlerOpts('uninstallApp'), async (udid: string, bundleId: string) => {
      return iosTools.uninstallApp(udid, bundleId);
    })
  );

  // Launch app
  ipcMain.handle(
    'ios:app:launch',
    withIpcErrorLogging(
      handlerOpts('launchApp'),
      async (
        udid: string,
        bundleId: string,
        options?: { args?: string[]; env?: Record<string, string> }
      ) => {
        return iosTools.launchApp({
          udid,
          bundleId,
          ...options,
        });
      }
    )
  );

  // Terminate app
  ipcMain.handle(
    'ios:app:terminate',
    withIpcErrorLogging(handlerOpts('terminateApp'), async (udid: string, bundleId: string) => {
      return iosTools.terminateApp(udid, bundleId);
    })
  );

  // Get app container
  ipcMain.handle(
    'ios:app:container',
    withIpcErrorLogging(
      handlerOpts('getAppContainer'),
      async (
        udid: string,
        bundleId: string,
        containerType?: 'app' | 'data' | 'groups'
      ) => {
        return iosTools.getAppContainer(udid, bundleId, containerType);
      }
    )
  );

  // Open URL
  ipcMain.handle(
    'ios:app:openurl',
    withIpcErrorLogging(handlerOpts('openURL'), async (udid: string, url: string) => {
      return iosTools.openURL(udid, url);
    })
  );

  // ==========================================================================
  // Screenshot & Recording
  // ==========================================================================

  // Capture screenshot
  ipcMain.handle(
    'ios:capture:screenshot',
    withIpcErrorLogging(
      handlerOpts('screenshot'),
      async (
        udid: string,
        outputPath: string,
        options?: { display?: 'internal' | 'external'; mask?: 'ignored' | 'alpha' | 'black' }
      ) => {
        return iosTools.screenshot({
          udid,
          outputPath,
          ...options,
        });
      }
    )
  );

  // Capture screenshot with auto-naming
  ipcMain.handle(
    'ios:capture:screenshotAuto',
    withIpcErrorLogging(
      handlerOpts('captureScreenshot'),
      async (udid: string, directory: string, prefix?: string) => {
        return iosTools.captureScreenshot(udid, directory, prefix);
      }
    )
  );

  // Start video recording
  ipcMain.handle(
    'ios:capture:startRecording',
    withIpcErrorLogging(
      handlerOpts('startRecording'),
      async (
        udid: string,
        outputPath: string,
        options?: { codec?: 'h264' | 'hevc' }
      ) => {
        return iosTools.startRecording({
          udid,
          outputPath,
          ...options,
        });
      }
    )
  );

  // Stop video recording
  ipcMain.handle(
    'ios:capture:stopRecording',
    withIpcErrorLogging(handlerOpts('stopRecording'), async (udid: string) => {
      return iosTools.stopRecording(udid);
    })
  );

  // Check if recording
  ipcMain.handle(
    'ios:capture:isRecording',
    withIpcErrorLogging(handlerOpts('isRecording'), async (udid: string) => {
      return { success: true, data: iosTools.isRecording(udid) };
    })
  );

  // Get screen size
  ipcMain.handle(
    'ios:capture:screenSize',
    withIpcErrorLogging(handlerOpts('getScreenSize'), async (udid: string) => {
      return iosTools.getScreenSize(udid);
    })
  );

  // ==========================================================================
  // Log Collection
  // ==========================================================================

  // Get system logs
  ipcMain.handle(
    'ios:logs:system',
    withIpcErrorLogging(
      handlerOpts('getSystemLog'),
      async (
        udid: string,
        options?: {
          since?: string;
          level?: 'default' | 'info' | 'debug' | 'error' | 'fault';
          process?: string;
          predicate?: string;
          limit?: number;
        }
      ) => {
        return iosTools.getSystemLog({
          udid,
          ...options,
        });
      }
    )
  );

  // Get system logs as text
  ipcMain.handle(
    'ios:logs:systemText',
    withIpcErrorLogging(handlerOpts('getSystemLogText'), async (udid: string, since?: string) => {
      return iosTools.getSystemLogText(udid, since);
    })
  );

  // Get crash logs
  ipcMain.handle(
    'ios:logs:crash',
    withIpcErrorLogging(
      handlerOpts('getCrashLogs'),
      async (
        udid: string,
        options?: {
          bundleId?: string;
          since?: string;
          limit?: number;
          includeContent?: boolean;
        }
      ) => {
        return iosTools.getCrashLogs({
          udid,
          since: options?.since ? new Date(options.since) : undefined,
          bundleId: options?.bundleId,
          limit: options?.limit,
          includeContent: options?.includeContent,
        });
      }
    )
  );

  // Check for recent crashes
  ipcMain.handle(
    'ios:logs:hasRecentCrashes',
    withIpcErrorLogging(
      handlerOpts('hasRecentCrashes'),
      async (udid: string, bundleId: string, since: string) => {
        return iosTools.hasRecentCrashes(udid, bundleId, new Date(since));
      }
    )
  );

  // Get diagnostics
  ipcMain.handle(
    'ios:logs:diagnostics',
    withIpcErrorLogging(handlerOpts('getDiagnostics'), async (udid: string, outputPath: string) => {
      return iosTools.getDiagnostics(udid, outputPath);
    })
  );

  // Start log streaming
  // Returns the stream ID; log entries are sent via 'ios:logs:stream:data' events
  ipcMain.handle(
    'ios:logs:stream:start',
    withIpcErrorLogging(
      handlerOpts('streamLog'),
      async (
        udid: string,
        options?: {
          level?: 'default' | 'info' | 'debug' | 'error' | 'fault';
          process?: string;
          predicate?: string;
          subsystem?: string;
        }
      ) => {
        const mainWindow = BrowserWindow.getAllWindows()[0];

        const result = await iosTools.streamLog(
          {
            udid,
            ...options,
          },
          // onLog callback - send to renderer
          (entry: LogEntry) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('ios:logs:stream:data', result.data?.id, entry);
            }
          },
          // onError callback - send to renderer
          (error: string) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('ios:logs:stream:error', result.data?.id, error);
            }
          }
        );

        if (!result.success) {
          return result;
        }

        // Return just the stream ID (handle methods aren't serializable)
        return {
          success: true,
          data: { id: result.data!.id },
        };
      }
    )
  );

  // Stop log streaming
  ipcMain.handle(
    'ios:logs:stream:stop',
    withIpcErrorLogging(handlerOpts('stopLogStream'), async (streamId: string) => {
      return iosTools.stopLogStream(streamId);
    })
  );

  // Get active log streams
  ipcMain.handle(
    'ios:logs:stream:active',
    withIpcErrorLogging(handlerOpts('getActiveLogStreams'), async () => {
      const streams = iosTools.getActiveLogStreams();
      // Convert Map to object for serialization
      const result: Record<string, string> = {};
      for (const [id, udid] of streams) {
        result[id] = udid;
      }
      return { success: true, data: result };
    })
  );

  // Stop all log streams (optionally for a specific simulator)
  ipcMain.handle(
    'ios:logs:stream:stopAll',
    withIpcErrorLogging(handlerOpts('stopAllLogStreams'), async (udid?: string) => {
      const count = iosTools.stopAllLogStreams(udid);
      return { success: true, data: count };
    })
  );

  // ==========================================================================
  // Snapshot
  // ==========================================================================

  // Capture full snapshot (screenshot + logs + crash detection)
  ipcMain.handle(
    'ios:snapshot:capture',
    withIpcErrorLogging(
      handlerOpts('captureSnapshot'),
      async (options: {
        udid?: string;
        bundleId?: string;
        sessionId: string;
        logDuration?: number;
        includeCrashContent?: boolean;
      }) => {
        return iosTools.captureSnapshot(options);
      }
    )
  );

  // Format snapshot for agent output
  ipcMain.handle(
    'ios:snapshot:format',
    withIpcErrorLogging(
      handlerOpts('formatSnapshot'),
      async (result: iosTools.SnapshotResult) => {
        const formatted = iosTools.formatSnapshotForAgent(result);
        return { success: true, data: formatted };
      }
    )
  );

  // Format snapshot as JSON
  ipcMain.handle(
    'ios:snapshot:formatJson',
    withIpcErrorLogging(
      handlerOpts('formatSnapshotJson'),
      async (result: iosTools.SnapshotResult) => {
        const json = iosTools.formatSnapshotAsJson(result);
        return { success: true, data: json };
      }
    )
  );

  // List snapshots for a session (convenience alias for ios:artifacts:list)
  ipcMain.handle(
    'ios:snapshot:list',
    withIpcErrorLogging(handlerOpts('listSnapshots'), async (sessionId: string) => {
      const snapshots = await iosTools.listSessionArtifacts(sessionId);
      return { success: true, data: snapshots };
    })
  );

  // Cleanup old snapshots (convenience alias for ios:artifacts:prune)
  ipcMain.handle(
    'ios:snapshot:cleanup',
    withIpcErrorLogging(
      handlerOpts('cleanupSnapshots'),
      async (sessionId: string, keepCount?: number) => {
        await iosTools.pruneSessionArtifacts(sessionId, keepCount);
        return { success: true };
      }
    )
  );

  // ==========================================================================
  // Artifact Management
  // ==========================================================================

  // Get artifact directory for session
  ipcMain.handle(
    'ios:artifacts:getDirectory',
    withIpcErrorLogging(handlerOpts('getArtifactDirectory'), async (sessionId: string) => {
      const dir = await iosTools.getArtifactDirectory(sessionId);
      return { success: true, data: dir };
    })
  );

  // List artifacts for session
  ipcMain.handle(
    'ios:artifacts:list',
    withIpcErrorLogging(handlerOpts('listArtifacts'), async (sessionId: string) => {
      const artifacts = await iosTools.listSessionArtifacts(sessionId);
      return { success: true, data: artifacts };
    })
  );

  // Prune old artifacts
  ipcMain.handle(
    'ios:artifacts:prune',
    withIpcErrorLogging(
      handlerOpts('pruneArtifacts'),
      async (sessionId: string, keepCount?: number) => {
        await iosTools.pruneSessionArtifacts(sessionId, keepCount);
        return { success: true };
      }
    )
  );

  // Get artifacts size
  ipcMain.handle(
    'ios:artifacts:size',
    withIpcErrorLogging(handlerOpts('getArtifactsSize'), async (sessionId: string) => {
      const size = await iosTools.getSessionArtifactsSize(sessionId);
      return { success: true, data: size };
    })
  );

  // ==========================================================================
  // UI Inspection
  // ==========================================================================

  // Inspect UI hierarchy
  ipcMain.handle(
    'ios:inspect',
    withIpcErrorLogging(
      handlerOpts('inspect'),
      async (options: {
        udid?: string;
        bundleId?: string;
        sessionId: string;
        captureScreenshot?: boolean;
        timeout?: number;
      }) => {
        return iosTools.inspect(options);
      }
    )
  );

  // Format inspection result for agent
  ipcMain.handle(
    'ios:inspect:format',
    withIpcErrorLogging(
      handlerOpts('formatInspect'),
      async (result: iosTools.InspectResult, options?: iosTools.FormatOptions) => {
        const formatted = iosTools.formatInspectForAgent(result, options);
        return { success: true, data: formatted };
      }
    )
  );

  // Format inspection result as JSON
  ipcMain.handle(
    'ios:inspect:formatJson',
    withIpcErrorLogging(
      handlerOpts('formatInspectJson'),
      async (result: iosTools.InspectResult) => {
        const json = iosTools.formatInspectAsJson(result);
        return { success: true, data: json };
      }
    )
  );

  // Format inspection result as element list
  ipcMain.handle(
    'ios:inspect:formatList',
    withIpcErrorLogging(
      handlerOpts('formatInspectList'),
      async (result: iosTools.InspectResult) => {
        const list = iosTools.formatInspectAsElementList(result);
        return { success: true, data: list };
      }
    )
  );

  // Format inspection result compact
  ipcMain.handle(
    'ios:inspect:formatCompact',
    withIpcErrorLogging(
      handlerOpts('formatInspectCompact'),
      async (result: iosTools.InspectResult) => {
        const compact = iosTools.formatInspectCompact(result);
        return { success: true, data: compact };
      }
    )
  );

  // ==========================================================================
  // UI Analysis
  // ==========================================================================

  // Find elements matching query
  ipcMain.handle(
    'ios:ui:findElements',
    withIpcErrorLogging(
      handlerOpts('findElements'),
      async (tree: iosTools.UIElement, query: iosTools.ElementQuery) => {
        const result = iosTools.findElements(tree, query);
        return { success: true, data: result };
      }
    )
  );

  // Find single element
  ipcMain.handle(
    'ios:ui:findElement',
    withIpcErrorLogging(
      handlerOpts('findElement'),
      async (tree: iosTools.UIElement, query: iosTools.ElementQuery) => {
        const element = iosTools.findElement(tree, query);
        return { success: true, data: element };
      }
    )
  );

  // Find by identifier
  ipcMain.handle(
    'ios:ui:findByIdentifier',
    withIpcErrorLogging(
      handlerOpts('findByIdentifier'),
      async (tree: iosTools.UIElement, identifier: string) => {
        const element = iosTools.findByIdentifier(tree, identifier);
        return { success: true, data: element };
      }
    )
  );

  // Find by label
  ipcMain.handle(
    'ios:ui:findByLabel',
    withIpcErrorLogging(
      handlerOpts('findByLabel'),
      async (tree: iosTools.UIElement, label: string) => {
        const element = iosTools.findByLabel(tree, label);
        return { success: true, data: element };
      }
    )
  );

  // Get interactable elements
  ipcMain.handle(
    'ios:ui:getInteractables',
    withIpcErrorLogging(
      handlerOpts('getInteractables'),
      async (tree: iosTools.UIElement, visibleOnly?: boolean) => {
        const elements = iosTools.getInteractableElements(tree, visibleOnly);
        return { success: true, data: elements };
      }
    )
  );

  // Get buttons
  ipcMain.handle(
    'ios:ui:getButtons',
    withIpcErrorLogging(handlerOpts('getButtons'), async (tree: iosTools.UIElement) => {
      const buttons = iosTools.getButtons(tree);
      return { success: true, data: buttons };
    })
  );

  // Get text fields
  ipcMain.handle(
    'ios:ui:getTextFields',
    withIpcErrorLogging(handlerOpts('getTextFields'), async (tree: iosTools.UIElement) => {
      const fields = iosTools.getTextFields(tree);
      return { success: true, data: fields };
    })
  );

  // Get text elements
  ipcMain.handle(
    'ios:ui:getTextElements',
    withIpcErrorLogging(handlerOpts('getTextElements'), async (tree: iosTools.UIElement) => {
      const texts = iosTools.getTextElements(tree);
      return { success: true, data: texts };
    })
  );

  // Describe element
  ipcMain.handle(
    'ios:ui:describeElement',
    withIpcErrorLogging(handlerOpts('describeElement'), async (element: iosTools.UIElement) => {
      const description = iosTools.describeElement(element);
      return { success: true, data: description };
    })
  );

  // Get best identifier for element
  ipcMain.handle(
    'ios:ui:getBestIdentifier',
    withIpcErrorLogging(
      handlerOpts('getBestIdentifier'),
      async (element: iosTools.UIElement, elements?: iosTools.UIElement[]) => {
        const identifier = iosTools.getBestIdentifier(element, elements);
        return { success: true, data: identifier };
      }
    )
  );

  // ==========================================================================
  // Maestro CLI
  // ==========================================================================

  // Detect Maestro CLI installation
  ipcMain.handle(
    'ios:maestro:detect',
    withIpcErrorLogging(handlerOpts('detectMaestroCli'), async () => {
      return iosTools.detectMaestroCli();
    })
  );

  // Quick check if Maestro is available
  ipcMain.handle(
    'ios:maestro:isAvailable',
    withIpcErrorLogging(handlerOpts('isMaestroAvailable'), async () => {
      const available = await iosTools.isMaestroAvailable();
      return { success: true, data: available };
    })
  );

  // Get full Maestro CLI info
  ipcMain.handle(
    'ios:maestro:info',
    withIpcErrorLogging(handlerOpts('getMaestroInfo'), async () => {
      return iosTools.getMaestroInfo();
    })
  );

  // Validate Maestro version meets minimum requirements
  ipcMain.handle(
    'ios:maestro:validateVersion',
    withIpcErrorLogging(handlerOpts('validateMaestroVersion'), async (minVersion: string) => {
      return iosTools.validateMaestroVersion(minVersion);
    })
  );

  // Get installation instructions
  ipcMain.handle(
    'ios:maestro:installInstructions',
    withIpcErrorLogging(handlerOpts('getInstallInstructions'), async () => {
      const instructions = iosTools.getInstallInstructions();
      return { success: true, data: instructions };
    })
  );

  // ==========================================================================
  // Flow Generation
  // ==========================================================================

  // Generate flow YAML from steps
  ipcMain.handle(
    'ios:flow:generate',
    withIpcErrorLogging(
      handlerOpts('generateFlow'),
      async (steps: iosTools.FlowStep[], config?: iosTools.FlowConfig) => {
        return iosTools.generateFlow(steps, config);
      }
    )
  );

  // Generate and save flow to file
  ipcMain.handle(
    'ios:flow:generateFile',
    withIpcErrorLogging(
      handlerOpts('generateFlowFile'),
      async (steps: iosTools.FlowStep[], outputPath: string, config?: iosTools.FlowConfig) => {
        return iosTools.generateFlowFile(steps, outputPath, config);
      }
    )
  );

  // Generate flow from action strings
  ipcMain.handle(
    'ios:flow:generateFromStrings',
    withIpcErrorLogging(
      handlerOpts('generateFlowFromStrings'),
      async (actions: string[], config?: iosTools.FlowConfig) => {
        return iosTools.generateFlowFromStrings(actions, config);
      }
    )
  );

  // Parse a single action string
  ipcMain.handle(
    'ios:flow:parseAction',
    withIpcErrorLogging(handlerOpts('parseActionString'), async (actionString: string) => {
      const step = iosTools.parseActionString(actionString);
      return { success: true, data: step };
    })
  );

  // ==========================================================================
  // Flow Runner
  // ==========================================================================

  // Run a Maestro flow
  ipcMain.handle(
    'ios:flow:run',
    withIpcErrorLogging(
      handlerOpts('runFlow'),
      async (options: iosTools.FlowRunOptions) => {
        return iosTools.runFlow(options);
      }
    )
  );

  // Run a flow with retry support
  ipcMain.handle(
    'ios:flow:runWithRetry',
    withIpcErrorLogging(
      handlerOpts('runFlowWithRetry'),
      async (options: iosTools.FlowRunWithRetryOptions) => {
        return iosTools.runFlowWithRetry(options);
      }
    )
  );

  // Run multiple flows in sequence
  ipcMain.handle(
    'ios:flow:runBatch',
    withIpcErrorLogging(
      handlerOpts('runFlows'),
      async (flowPaths: string[], options: Omit<iosTools.FlowRunOptions, 'flowPath'>) => {
        return iosTools.runFlows(flowPaths, options);
      }
    )
  );

  // Validate a flow file
  ipcMain.handle(
    'ios:flow:validate',
    withIpcErrorLogging(handlerOpts('validateFlow'), async (flowPath: string) => {
      return iosTools.validateFlow(flowPath);
    })
  );

  // Validate a flow file using Maestro CLI
  ipcMain.handle(
    'ios:flow:validateWithMaestro',
    withIpcErrorLogging(handlerOpts('validateFlowWithMaestro'), async (flowPath: string) => {
      return iosTools.validateFlowWithMaestro(flowPath);
    })
  );

  // ==========================================================================
  // Flow Result Formatting
  // ==========================================================================

  // Format flow result for agent output
  ipcMain.handle(
    'ios:flow:formatResult',
    withIpcErrorLogging(
      handlerOpts('formatFlowResult'),
      async (result: iosTools.FlowRunResult, options?: iosTools.FlowFormatOptions) => {
        const formatted = iosTools.formatFlowResult(result, options);
        return { success: true, data: formatted };
      }
    )
  );

  // Format flow result as JSON
  ipcMain.handle(
    'ios:flow:formatResultJson',
    withIpcErrorLogging(
      handlerOpts('formatFlowResultAsJson'),
      async (result: iosTools.FlowRunResult) => {
        const json = iosTools.formatFlowResultAsJson(result);
        return { success: true, data: json };
      }
    )
  );

  // Format flow result compact
  ipcMain.handle(
    'ios:flow:formatResultCompact',
    withIpcErrorLogging(
      handlerOpts('formatFlowResultCompact'),
      async (result: iosTools.FlowRunResult) => {
        const compact = iosTools.formatFlowResultCompact(result);
        return { success: true, data: compact };
      }
    )
  );

  // Format batch flow result
  ipcMain.handle(
    'ios:flow:formatBatchResult',
    withIpcErrorLogging(
      handlerOpts('formatBatchFlowResult'),
      async (result: iosTools.BatchFlowResult, options?: iosTools.FlowFormatOptions) => {
        const formatted = iosTools.formatBatchFlowResult(result, options);
        return { success: true, data: formatted };
      }
    )
  );

  // ==========================================================================
  // Verification & Assertions
  // ==========================================================================

  // Assert element is visible
  ipcMain.handle(
    'ios:assert:visible',
    withIpcErrorLogging(
      handlerOpts('assertVisible'),
      async (options: iosTools.AssertVisibleOptions) => {
        return iosTools.assertVisible(options);
      }
    )
  );

  // Assert element is visible by identifier
  ipcMain.handle(
    'ios:assert:visibleById',
    withIpcErrorLogging(
      handlerOpts('assertVisibleById'),
      async (identifier: string, options: Omit<iosTools.AssertVisibleOptions, 'target'>) => {
        return iosTools.assertVisibleById(identifier, options);
      }
    )
  );

  // Assert element is visible by label
  ipcMain.handle(
    'ios:assert:visibleByLabel',
    withIpcErrorLogging(
      handlerOpts('assertVisibleByLabel'),
      async (label: string, options: Omit<iosTools.AssertVisibleOptions, 'target'>) => {
        return iosTools.assertVisibleByLabel(label, options);
      }
    )
  );

  // Assert element is visible by text
  ipcMain.handle(
    'ios:assert:visibleByText',
    withIpcErrorLogging(
      handlerOpts('assertVisibleByText'),
      async (text: string, options: Omit<iosTools.AssertVisibleOptions, 'target'>) => {
        return iosTools.assertVisibleByText(text, options);
      }
    )
  );

  // Assert element is NOT visible
  ipcMain.handle(
    'ios:assert:notVisible',
    withIpcErrorLogging(
      handlerOpts('assertNotVisible'),
      async (options: iosTools.AssertVisibleOptions) => {
        return iosTools.assertNotVisible(options);
      }
    )
  );

  // Assert no crash for app
  ipcMain.handle(
    'ios:assert:noCrash',
    withIpcErrorLogging(
      handlerOpts('assertNoCrash'),
      async (options: iosTools.AssertNoCrashOptions) => {
        return iosTools.assertNoCrash(options);
      }
    )
  );

  // Quick check if app has crashed
  ipcMain.handle(
    'ios:assert:hasCrashed',
    withIpcErrorLogging(
      handlerOpts('hasCrashed'),
      async (bundleId: string, udid: string, since: string) => {
        return iosTools.hasCrashed(bundleId, udid, new Date(since));
      }
    )
  );

  // Wait for app to not crash for duration
  ipcMain.handle(
    'ios:assert:waitForNoCrash',
    withIpcErrorLogging(
      handlerOpts('waitForNoCrash'),
      async (options: iosTools.AssertNoCrashOptions & { monitorDuration: number }) => {
        return iosTools.waitForNoCrash(options);
      }
    )
  );

  // Wait for element to appear
  ipcMain.handle(
    'ios:wait:for',
    withIpcErrorLogging(
      handlerOpts('waitForElement'),
      async (options: iosTools.WaitForOptions) => {
        return iosTools.waitForElement(options);
      }
    )
  );

  // Wait for element by identifier
  ipcMain.handle(
    'ios:wait:forById',
    withIpcErrorLogging(
      handlerOpts('waitForElementById'),
      async (identifier: string, options: Omit<iosTools.WaitForOptions, 'target'>) => {
        return iosTools.waitForElementById(identifier, options);
      }
    )
  );

  // Wait for element by label
  ipcMain.handle(
    'ios:wait:forByLabel',
    withIpcErrorLogging(
      handlerOpts('waitForElementByLabel'),
      async (label: string, options: Omit<iosTools.WaitForOptions, 'target'>) => {
        return iosTools.waitForElementByLabel(label, options);
      }
    )
  );

  // Wait for element by text
  ipcMain.handle(
    'ios:wait:forByText',
    withIpcErrorLogging(
      handlerOpts('waitForElementByText'),
      async (text: string, options: Omit<iosTools.WaitForOptions, 'target'>) => {
        return iosTools.waitForElementByText(text, options);
      }
    )
  );

  // Wait for element to disappear
  ipcMain.handle(
    'ios:wait:forNot',
    withIpcErrorLogging(
      handlerOpts('waitForElementNot'),
      async (options: iosTools.WaitForOptions) => {
        return iosTools.waitForElementNot(options);
      }
    )
  );

  // Wait for element by identifier to disappear
  ipcMain.handle(
    'ios:wait:forNotById',
    withIpcErrorLogging(
      handlerOpts('waitForElementNotById'),
      async (identifier: string, options: Omit<iosTools.WaitForOptions, 'target' | 'not'>) => {
        return iosTools.waitForElementNotById(identifier, options);
      }
    )
  );

  // Wait for element by label to disappear
  ipcMain.handle(
    'ios:wait:forNotByLabel',
    withIpcErrorLogging(
      handlerOpts('waitForElementNotByLabel'),
      async (label: string, options: Omit<iosTools.WaitForOptions, 'target' | 'not'>) => {
        return iosTools.waitForElementNotByLabel(label, options);
      }
    )
  );

  // Wait for element by text to disappear
  ipcMain.handle(
    'ios:wait:forNotByText',
    withIpcErrorLogging(
      handlerOpts('waitForElementNotByText'),
      async (text: string, options: Omit<iosTools.WaitForOptions, 'target' | 'not'>) => {
        return iosTools.waitForElementNotByText(text, options);
      }
    )
  );

  // ==========================================================================
  // Text Assertions
  // ==========================================================================

  // Assert element text matches expected value
  ipcMain.handle(
    'ios:assert:text',
    withIpcErrorLogging(
      handlerOpts('assertText'),
      async (options: iosTools.AssertTextOptions) => {
        return iosTools.assertText(options);
      }
    )
  );

  // Assert element text by identifier
  ipcMain.handle(
    'ios:assert:textById',
    withIpcErrorLogging(
      handlerOpts('assertTextById'),
      async (identifier: string, expected: string, options: Omit<iosTools.AssertTextOptions, 'target' | 'expected'>) => {
        return iosTools.assertTextById(identifier, expected, options);
      }
    )
  );

  // Assert element text by label
  ipcMain.handle(
    'ios:assert:textByLabel',
    withIpcErrorLogging(
      handlerOpts('assertTextByLabel'),
      async (label: string, expected: string, options: Omit<iosTools.AssertTextOptions, 'target' | 'expected'>) => {
        return iosTools.assertTextByLabel(label, expected, options);
      }
    )
  );

  // Assert element text contains value
  ipcMain.handle(
    'ios:assert:textContains',
    withIpcErrorLogging(
      handlerOpts('assertTextContains'),
      async (target: iosTools.TextElementTarget, expected: string, options: Omit<iosTools.AssertTextOptions, 'target' | 'expected' | 'matchMode'>) => {
        return iosTools.assertTextContains(target, expected, options);
      }
    )
  );

  // Assert element text matches regex
  ipcMain.handle(
    'ios:assert:textMatches',
    withIpcErrorLogging(
      handlerOpts('assertTextMatches'),
      async (target: iosTools.TextElementTarget, pattern: string, options: Omit<iosTools.AssertTextOptions, 'target' | 'expected' | 'matchMode'>) => {
        return iosTools.assertTextMatches(target, pattern, options);
      }
    )
  );

  // Assert element text starts with value
  ipcMain.handle(
    'ios:assert:textStartsWith',
    withIpcErrorLogging(
      handlerOpts('assertTextStartsWith'),
      async (target: iosTools.TextElementTarget, expected: string, options: Omit<iosTools.AssertTextOptions, 'target' | 'expected' | 'matchMode'>) => {
        return iosTools.assertTextStartsWith(target, expected, options);
      }
    )
  );

  // Assert element text ends with value
  ipcMain.handle(
    'ios:assert:textEndsWith',
    withIpcErrorLogging(
      handlerOpts('assertTextEndsWith'),
      async (target: iosTools.TextElementTarget, expected: string, options: Omit<iosTools.AssertTextOptions, 'target' | 'expected' | 'matchMode'>) => {
        return iosTools.assertTextEndsWith(target, expected, options);
      }
    )
  );

  // ==========================================================================
  // Value Assertions
  // ==========================================================================

  // Assert element value matches expected
  ipcMain.handle(
    'ios:assert:value',
    withIpcErrorLogging(
      handlerOpts('assertValue'),
      async (options: iosTools.AssertValueOptions) => {
        return iosTools.assertValue(options);
      }
    )
  );

  // Assert element value by identifier
  ipcMain.handle(
    'ios:assert:valueById',
    withIpcErrorLogging(
      handlerOpts('assertValueById'),
      async (identifier: string, expected: string, options: Omit<iosTools.AssertValueOptions, 'target' | 'expected'>) => {
        return iosTools.assertValueById(identifier, expected, options);
      }
    )
  );

  // Assert element value by label
  ipcMain.handle(
    'ios:assert:valueByLabel',
    withIpcErrorLogging(
      handlerOpts('assertValueByLabel'),
      async (label: string, expected: string, options: Omit<iosTools.AssertValueOptions, 'target' | 'expected'>) => {
        return iosTools.assertValueByLabel(label, expected, options);
      }
    )
  );

  // Assert element value contains substring
  ipcMain.handle(
    'ios:assert:valueContains',
    withIpcErrorLogging(
      handlerOpts('assertValueContains'),
      async (target: iosTools.ValueElementTarget, expected: string, options: Omit<iosTools.AssertValueOptions, 'target' | 'expected' | 'matchMode'>) => {
        return iosTools.assertValueContains(target, expected, options);
      }
    )
  );

  // Assert element value matches regex
  ipcMain.handle(
    'ios:assert:valueMatches',
    withIpcErrorLogging(
      handlerOpts('assertValueMatches'),
      async (target: iosTools.ValueElementTarget, pattern: string, options: Omit<iosTools.AssertValueOptions, 'target' | 'expected' | 'matchMode'>) => {
        return iosTools.assertValueMatches(target, pattern, options);
      }
    )
  );

  // Assert element value starts with
  ipcMain.handle(
    'ios:assert:valueStartsWith',
    withIpcErrorLogging(
      handlerOpts('assertValueStartsWith'),
      async (target: iosTools.ValueElementTarget, expected: string, options: Omit<iosTools.AssertValueOptions, 'target' | 'expected' | 'matchMode'>) => {
        return iosTools.assertValueStartsWith(target, expected, options);
      }
    )
  );

  // Assert element value ends with
  ipcMain.handle(
    'ios:assert:valueEndsWith',
    withIpcErrorLogging(
      handlerOpts('assertValueEndsWith'),
      async (target: iosTools.ValueElementTarget, expected: string, options: Omit<iosTools.AssertValueOptions, 'target' | 'expected' | 'matchMode'>) => {
        return iosTools.assertValueEndsWith(target, expected, options);
      }
    )
  );

  // Assert element value is empty
  ipcMain.handle(
    'ios:assert:valueEmpty',
    withIpcErrorLogging(
      handlerOpts('assertValueEmpty'),
      async (target: iosTools.ValueElementTarget, options: Omit<iosTools.AssertValueOptions, 'target' | 'expected' | 'matchMode'>) => {
        return iosTools.assertValueEmpty(target, options);
      }
    )
  );

  // Assert element value is not empty
  ipcMain.handle(
    'ios:assert:valueNotEmpty',
    withIpcErrorLogging(
      handlerOpts('assertValueNotEmpty'),
      async (target: iosTools.ValueElementTarget, options: Omit<iosTools.AssertValueOptions, 'target' | 'expected' | 'matchMode'>) => {
        return iosTools.assertValueNotEmpty(target, options);
      }
    )
  );

  // ==========================================================================
  // Enabled/Disabled Assertions
  // ==========================================================================

  // Assert element is enabled
  ipcMain.handle(
    'ios:assert:enabled',
    withIpcErrorLogging(
      handlerOpts('assertEnabled'),
      async (options: iosTools.AssertEnabledOptions) => {
        return iosTools.assertEnabled(options);
      }
    )
  );

  // Assert element is enabled by identifier
  ipcMain.handle(
    'ios:assert:enabledById',
    withIpcErrorLogging(
      handlerOpts('assertEnabledById'),
      async (identifier: string, options: Omit<iosTools.AssertEnabledOptions, 'target'>) => {
        return iosTools.assertEnabledById(identifier, options);
      }
    )
  );

  // Assert element is enabled by label
  ipcMain.handle(
    'ios:assert:enabledByLabel',
    withIpcErrorLogging(
      handlerOpts('assertEnabledByLabel'),
      async (label: string, options: Omit<iosTools.AssertEnabledOptions, 'target'>) => {
        return iosTools.assertEnabledByLabel(label, options);
      }
    )
  );

  // Assert element is enabled by text
  ipcMain.handle(
    'ios:assert:enabledByText',
    withIpcErrorLogging(
      handlerOpts('assertEnabledByText'),
      async (text: string, options: Omit<iosTools.AssertEnabledOptions, 'target'>) => {
        return iosTools.assertEnabledByText(text, options);
      }
    )
  );

  // Assert element is disabled
  ipcMain.handle(
    'ios:assert:disabled',
    withIpcErrorLogging(
      handlerOpts('assertDisabled'),
      async (options: iosTools.AssertEnabledOptions) => {
        return iosTools.assertDisabled(options);
      }
    )
  );

  // Assert element is disabled by identifier
  ipcMain.handle(
    'ios:assert:disabledById',
    withIpcErrorLogging(
      handlerOpts('assertDisabledById'),
      async (identifier: string, options: Omit<iosTools.AssertEnabledOptions, 'target'>) => {
        return iosTools.assertDisabledById(identifier, options);
      }
    )
  );

  // Assert element is disabled by label
  ipcMain.handle(
    'ios:assert:disabledByLabel',
    withIpcErrorLogging(
      handlerOpts('assertDisabledByLabel'),
      async (label: string, options: Omit<iosTools.AssertEnabledOptions, 'target'>) => {
        return iosTools.assertDisabledByLabel(label, options);
      }
    )
  );

  // Assert element is disabled by text
  ipcMain.handle(
    'ios:assert:disabledByText',
    withIpcErrorLogging(
      handlerOpts('assertDisabledByText'),
      async (text: string, options: Omit<iosTools.AssertEnabledOptions, 'target'>) => {
        return iosTools.assertDisabledByText(text, options);
      }
    )
  );

  // ==========================================================================
  // Selected Assertions
  // ==========================================================================

  // Assert element is selected
  ipcMain.handle(
    'ios:assert:selected',
    withIpcErrorLogging(
      handlerOpts('assertSelected'),
      async (options: iosTools.AssertSelectedOptions) => {
        return iosTools.assertSelected(options);
      }
    )
  );

  // Assert element is selected by identifier
  ipcMain.handle(
    'ios:assert:selectedById',
    withIpcErrorLogging(
      handlerOpts('assertSelectedById'),
      async (identifier: string, options: Omit<iosTools.AssertSelectedOptions, 'target'>) => {
        return iosTools.assertSelectedById(identifier, options);
      }
    )
  );

  // Assert element is selected by label
  ipcMain.handle(
    'ios:assert:selectedByLabel',
    withIpcErrorLogging(
      handlerOpts('assertSelectedByLabel'),
      async (label: string, options: Omit<iosTools.AssertSelectedOptions, 'target'>) => {
        return iosTools.assertSelectedByLabel(label, options);
      }
    )
  );

  // Assert element is selected by text
  ipcMain.handle(
    'ios:assert:selectedByText',
    withIpcErrorLogging(
      handlerOpts('assertSelectedByText'),
      async (text: string, options: Omit<iosTools.AssertSelectedOptions, 'target'>) => {
        return iosTools.assertSelectedByText(text, options);
      }
    )
  );

  // Assert element is NOT selected
  ipcMain.handle(
    'ios:assert:notSelected',
    withIpcErrorLogging(
      handlerOpts('assertNotSelected'),
      async (options: iosTools.AssertSelectedOptions) => {
        return iosTools.assertNotSelected(options);
      }
    )
  );

  // Assert element is NOT selected by identifier
  ipcMain.handle(
    'ios:assert:notSelectedById',
    withIpcErrorLogging(
      handlerOpts('assertNotSelectedById'),
      async (identifier: string, options: Omit<iosTools.AssertSelectedOptions, 'target'>) => {
        return iosTools.assertNotSelectedById(identifier, options);
      }
    )
  );

  // Assert element is NOT selected by label
  ipcMain.handle(
    'ios:assert:notSelectedByLabel',
    withIpcErrorLogging(
      handlerOpts('assertNotSelectedByLabel'),
      async (label: string, options: Omit<iosTools.AssertSelectedOptions, 'target'>) => {
        return iosTools.assertNotSelectedByLabel(label, options);
      }
    )
  );

  // Assert element is NOT selected by text
  ipcMain.handle(
    'ios:assert:notSelectedByText',
    withIpcErrorLogging(
      handlerOpts('assertNotSelectedByText'),
      async (text: string, options: Omit<iosTools.AssertSelectedOptions, 'target'>) => {
        return iosTools.assertNotSelectedByText(text, options);
      }
    )
  );

  // =========================================================================
  // Hittable Assertions
  // =========================================================================

  // Assert element is hittable (can receive tap events)
  ipcMain.handle(
    'ios:assert:hittable',
    withIpcErrorLogging(
      handlerOpts('assertHittable'),
      async (options: iosTools.AssertHittableOptions) => {
        return iosTools.assertHittable(options);
      }
    )
  );

  // Assert element is hittable by identifier
  ipcMain.handle(
    'ios:assert:hittableById',
    withIpcErrorLogging(
      handlerOpts('assertHittableById'),
      async (identifier: string, options: Omit<iosTools.AssertHittableOptions, 'target'>) => {
        return iosTools.assertHittableById(identifier, options);
      }
    )
  );

  // Assert element is hittable by label
  ipcMain.handle(
    'ios:assert:hittableByLabel',
    withIpcErrorLogging(
      handlerOpts('assertHittableByLabel'),
      async (label: string, options: Omit<iosTools.AssertHittableOptions, 'target'>) => {
        return iosTools.assertHittableByLabel(label, options);
      }
    )
  );

  // Assert element is hittable by text
  ipcMain.handle(
    'ios:assert:hittableByText',
    withIpcErrorLogging(
      handlerOpts('assertHittableByText'),
      async (text: string, options: Omit<iosTools.AssertHittableOptions, 'target'>) => {
        return iosTools.assertHittableByText(text, options);
      }
    )
  );

  // Assert element is NOT hittable
  ipcMain.handle(
    'ios:assert:notHittable',
    withIpcErrorLogging(
      handlerOpts('assertNotHittable'),
      async (options: iosTools.AssertHittableOptions) => {
        return iosTools.assertNotHittable(options);
      }
    )
  );

  // Assert element is NOT hittable by identifier
  ipcMain.handle(
    'ios:assert:notHittableById',
    withIpcErrorLogging(
      handlerOpts('assertNotHittableById'),
      async (identifier: string, options: Omit<iosTools.AssertHittableOptions, 'target'>) => {
        return iosTools.assertNotHittableById(identifier, options);
      }
    )
  );

  // Assert element is NOT hittable by label
  ipcMain.handle(
    'ios:assert:notHittableByLabel',
    withIpcErrorLogging(
      handlerOpts('assertNotHittableByLabel'),
      async (label: string, options: Omit<iosTools.AssertHittableOptions, 'target'>) => {
        return iosTools.assertNotHittableByLabel(label, options);
      }
    )
  );

  // Assert element is NOT hittable by text
  ipcMain.handle(
    'ios:assert:notHittableByText',
    withIpcErrorLogging(
      handlerOpts('assertNotHittableByText'),
      async (text: string, options: Omit<iosTools.AssertHittableOptions, 'target'>) => {
        return iosTools.assertNotHittableByText(text, options);
      }
    )
  );

  // ==========================================================================
  // Error Log Assertions
  // ==========================================================================

  // Assert no errors in logs
  ipcMain.handle(
    'ios:assert:noErrors',
    withIpcErrorLogging(
      handlerOpts('assertNoErrors'),
      async (options: iosTools.AssertNoErrorsOptions) => {
        return iosTools.assertNoErrors(options);
      }
    )
  );

  // Assert no errors for a specific app
  ipcMain.handle(
    'ios:assert:noErrorsForApp',
    withIpcErrorLogging(
      handlerOpts('assertNoErrorsForApp'),
      async (bundleId: string, options: Omit<iosTools.AssertNoErrorsOptions, 'bundleId'>) => {
        return iosTools.assertNoErrorsForApp(bundleId, options);
      }
    )
  );

  // Assert no HTTP errors in logs
  ipcMain.handle(
    'ios:assert:noHttpErrors',
    withIpcErrorLogging(
      handlerOpts('assertNoHttpErrors'),
      async (options: Omit<iosTools.AssertNoErrorsOptions, 'patterns' | 'customPatternsOnly'>) => {
        return iosTools.assertNoHttpErrors(options);
      }
    )
  );

  // Assert no crash indicators in logs
  ipcMain.handle(
    'ios:assert:noCrashIndicators',
    withIpcErrorLogging(
      handlerOpts('assertNoCrashIndicators'),
      async (options: Omit<iosTools.AssertNoErrorsOptions, 'patterns' | 'customPatternsOnly'>) => {
        return iosTools.assertNoCrashIndicators(options);
      }
    )
  );

  // Count errors in logs
  ipcMain.handle(
    'ios:assert:countErrors',
    withIpcErrorLogging(
      handlerOpts('countErrors'),
      async (
        udid: string,
        since: string,
        bundleId?: string,
        patterns?: string[]
      ) => {
        return iosTools.countErrors(udid, new Date(since), bundleId, patterns);
      }
    )
  );

  // Check if specific error pattern exists in logs
  ipcMain.handle(
    'ios:assert:hasErrorPattern',
    withIpcErrorLogging(
      handlerOpts('hasErrorPattern'),
      async (
        udid: string,
        pattern: string,
        since?: string,
        bundleId?: string
      ) => {
        return iosTools.hasErrorPattern(
          udid,
          pattern,
          since ? new Date(since) : undefined,
          bundleId
        );
      }
    )
  );

  // ==========================================================================
  // Log Contains Assertions
  // ==========================================================================

  // Assert log contains a pattern
  ipcMain.handle(
    'ios:assert:logContains',
    withIpcErrorLogging(
      handlerOpts('assertLogContains'),
      async (pattern: string, options: iosTools.AssertLogContainsOptions) => {
        return iosTools.assertLogContains(pattern, options);
      }
    )
  );

  // Assert log contains pattern (simple wrapper)
  ipcMain.handle(
    'ios:assert:logContainsPattern',
    withIpcErrorLogging(
      handlerOpts('assertLogContainsPattern'),
      async (pattern: string, options: Omit<iosTools.AssertLogContainsOptions, 'matchMode'>) => {
        return iosTools.assertLogContainsPattern(pattern, options);
      }
    )
  );

  // Assert log contains exact text
  ipcMain.handle(
    'ios:assert:logContainsExact',
    withIpcErrorLogging(
      handlerOpts('assertLogContainsExact'),
      async (text: string, options: Omit<iosTools.AssertLogContainsOptions, 'matchMode'>) => {
        return iosTools.assertLogContainsExact(text, options);
      }
    )
  );

  // Assert log matches regex pattern
  ipcMain.handle(
    'ios:assert:logMatches',
    withIpcErrorLogging(
      handlerOpts('assertLogMatches'),
      async (regex: string, options: Omit<iosTools.AssertLogContainsOptions, 'matchMode'>) => {
        return iosTools.assertLogMatches(regex, options);
      }
    )
  );

  // Assert log does NOT contain a pattern
  ipcMain.handle(
    'ios:assert:logNotContains',
    withIpcErrorLogging(
      handlerOpts('assertLogNotContains'),
      async (pattern: string, options: Omit<iosTools.AssertLogContainsOptions, 'notContains'>) => {
        return iosTools.assertLogNotContains(pattern, options);
      }
    )
  );

  // Assert log contains pattern for a specific app
  ipcMain.handle(
    'ios:assert:logContainsForApp',
    withIpcErrorLogging(
      handlerOpts('assertLogContainsForApp'),
      async (bundleId: string, pattern: string, options: Omit<iosTools.AssertLogContainsOptions, 'bundleId'>) => {
        return iosTools.assertLogContainsForApp(bundleId, pattern, options);
      }
    )
  );

  // Count log pattern matches
  ipcMain.handle(
    'ios:assert:countLogMatches',
    withIpcErrorLogging(
      handlerOpts('countLogMatches'),
      async (
        udid: string,
        pattern: string,
        since: string,
        bundleId?: string,
        matchMode?: iosTools.LogMatchMode
      ) => {
        return iosTools.countLogMatches(udid, pattern, new Date(since), bundleId, matchMode);
      }
    )
  );

  // Check if log pattern exists
  ipcMain.handle(
    'ios:assert:hasLogPattern',
    withIpcErrorLogging(
      handlerOpts('hasLogPattern'),
      async (
        udid: string,
        pattern: string,
        since?: string,
        bundleId?: string,
        matchMode?: iosTools.LogMatchMode
      ) => {
        return iosTools.hasLogPattern(
          udid,
          pattern,
          since ? new Date(since) : undefined,
          bundleId,
          matchMode
        );
      }
    )
  );

  // Wait for log pattern to appear
  ipcMain.handle(
    'ios:assert:waitForLogPattern',
    withIpcErrorLogging(
      handlerOpts('waitForLogPattern'),
      async (pattern: string, options: iosTools.AssertLogContainsOptions) => {
        return iosTools.waitForLogPattern(pattern, options);
      }
    )
  );

  // Wait for log pattern to disappear
  ipcMain.handle(
    'ios:assert:waitForLogPatternGone',
    withIpcErrorLogging(
      handlerOpts('waitForLogPatternGone'),
      async (pattern: string, options: Omit<iosTools.AssertLogContainsOptions, 'notContains'>) => {
        return iosTools.waitForLogPatternGone(pattern, options);
      }
    )
  );

  // ==========================================================================
  // Screen Assertions (Compound)
  // ==========================================================================

  // Assert screen matches definition
  ipcMain.handle(
    'ios:assert:screen',
    withIpcErrorLogging(
      handlerOpts('assertScreen'),
      async (options: iosTools.AssertScreenOptions) => {
        return iosTools.assertScreen(options);
      }
    )
  );

  // Assert screen by name from registry
  ipcMain.handle(
    'ios:assert:screenByName',
    withIpcErrorLogging(
      handlerOpts('assertScreenByName'),
      async (
        screenName: string,
        screenRegistry: Record<string, iosTools.ScreenDefinition>,
        options: Omit<iosTools.AssertScreenOptions, 'screen'>
      ) => {
        return iosTools.assertScreenByName(screenName, screenRegistry, options);
      }
    )
  );

  // Format verification result for agent
  ipcMain.handle(
    'ios:verify:formatResult',
    withIpcErrorLogging(
      handlerOpts('formatVerificationResult'),
      async (result: iosTools.VerificationResult, options?: iosTools.VerificationFormatOptions) => {
        const formatted = iosTools.formatVerificationResult(result, options);
        return { success: true, data: formatted };
      }
    )
  );

  // Format verification result as JSON
  ipcMain.handle(
    'ios:verify:formatResultJson',
    withIpcErrorLogging(
      handlerOpts('formatVerificationAsJson'),
      async (result: iosTools.VerificationResult) => {
        const json = iosTools.formatVerificationAsJson(result);
        return { success: true, data: json };
      }
    )
  );

  // Format verification result compact
  ipcMain.handle(
    'ios:verify:formatResultCompact',
    withIpcErrorLogging(
      handlerOpts('formatVerificationCompact'),
      async (result: iosTools.VerificationResult) => {
        const compact = iosTools.formatVerificationCompact(result);
        return { success: true, data: compact };
      }
    )
  );

  // Format batch verification results
  ipcMain.handle(
    'ios:verify:formatBatch',
    withIpcErrorLogging(
      handlerOpts('formatVerificationBatch'),
      async (results: iosTools.VerificationResult[], options?: iosTools.VerificationFormatOptions) => {
        const formatted = iosTools.formatVerificationBatch(results, options);
        return { success: true, data: formatted };
      }
    )
  );

  // ==========================================================================
  // Feature Ship Loop
  // ==========================================================================

  // Run the Feature Ship Loop
  ipcMain.handle(
    'ios:shipLoop:run',
    withIpcErrorLogging(
      handlerOpts('runShipLoop'),
      async (options: iosTools.ShipLoopOptions) => {
        return iosTools.runShipLoop(options);
      }
    )
  );

  // Format ship loop result for agent output
  ipcMain.handle(
    'ios:shipLoop:formatResult',
    withIpcErrorLogging(
      handlerOpts('formatShipLoopResult'),
      async (result: iosTools.ShipLoopResult) => {
        const formatted = iosTools.formatShipLoopResult(result);
        return { success: true, data: formatted };
      }
    )
  );

  // Format ship loop result as JSON
  ipcMain.handle(
    'ios:shipLoop:formatResultJson',
    withIpcErrorLogging(
      handlerOpts('formatShipLoopResultAsJson'),
      async (result: iosTools.ShipLoopResult) => {
        const json = iosTools.formatShipLoopResultAsJson(result);
        return { success: true, data: json };
      }
    )
  );

  // Format ship loop result compact
  ipcMain.handle(
    'ios:shipLoop:formatResultCompact',
    withIpcErrorLogging(
      handlerOpts('formatShipLoopResultCompact'),
      async (result: iosTools.ShipLoopResult) => {
        const compact = iosTools.formatShipLoopResultCompact(result);
        return { success: true, data: compact };
      }
    )
  );

  // ==========================================================================
  // Test Execution
  // ==========================================================================

  // Run XCTest unit tests
  ipcMain.handle(
    'ios:test:run',
    withIpcErrorLogging(
      handlerOpts('runTests'),
      async (options: iosTools.TestRunOptions) => {
        return iosTools.runTests(options);
      }
    )
  );

  // Run XCUITest UI tests
  ipcMain.handle(
    'ios:test:runUI',
    withIpcErrorLogging(
      handlerOpts('runUITests'),
      async (options: iosTools.TestRunOptions) => {
        return iosTools.runUITests(options);
      }
    )
  );

  // Parse test results from xcresult bundle
  ipcMain.handle(
    'ios:test:parseResults',
    withIpcErrorLogging(
      handlerOpts('parseTestResults'),
      async (resultBundlePath: string) => {
        return iosTools.parseTestResults(resultBundlePath);
      }
    )
  );

  // List available tests in a project
  ipcMain.handle(
    'ios:test:list',
    withIpcErrorLogging(
      handlerOpts('listTests'),
      async (projectPath: string, scheme: string) => {
        return iosTools.listTests(projectPath, scheme);
      }
    )
  );

  // ==========================================================================
  // XCUITest-based UI Inspection
  // ==========================================================================

  // Run XCUITest-based inspection (more detailed than simple inspect)
  ipcMain.handle(
    'ios:inspect:run',
    withIpcErrorLogging(
      handlerOpts('inspectWithXCUITest'),
      async (options: iosTools.XCUITestInspectOptions) => {
        return iosTools.inspectWithXCUITest(options);
      }
    )
  );

  // Find element in XCUITest inspection result
  // Takes the rootElement from XCUITestInspectResult and a query
  ipcMain.handle(
    'ios:inspect:findElement',
    withIpcErrorLogging(
      handlerOpts('inspectFindElement'),
      async (
        rootElement: iosTools.ElementNode,
        query: {
          identifier?: string;
          label?: string;
          type?: string;
          value?: string;
          containsText?: string;
        }
      ) => {
        // Convert ElementNode tree to UIElement tree for ui-analyzer functions
        const uiElement = convertElementNodeToUIElement(rootElement);
        const element = iosTools.findElement(uiElement, query);
        return { success: true, data: element };
      }
    )
  );

  // Get interactable elements from XCUITest inspection result
  ipcMain.handle(
    'ios:inspect:getInteractable',
    withIpcErrorLogging(
      handlerOpts('inspectGetInteractable'),
      async (rootElement: iosTools.ElementNode, visibleOnly?: boolean) => {
        // Convert ElementNode tree to UIElement tree for ui-analyzer functions
        const uiElement = convertElementNodeToUIElement(rootElement);
        const elements = iosTools.getInteractableElements(uiElement, visibleOnly);
        return { success: true, data: elements };
      }
    )
  );

  // Format XCUITest inspection result for agent
  ipcMain.handle(
    'ios:inspect:formatXCUITest',
    withIpcErrorLogging(
      handlerOpts('formatXCUITestInspect'),
      async (result: iosTools.XCUITestInspectResult, options?: iosTools.FormatOptions) => {
        // Convert XCUITestInspectResult to InspectResult for formatting
        const inspectResult = convertXCUITestToInspectResult(result);
        const formatted = iosTools.formatInspectForAgent(inspectResult, options);
        return { success: true, data: formatted };
      }
    )
  );

  // Detect accessibility issues in XCUITest inspection result
  ipcMain.handle(
    'ios:inspect:detectIssues',
    withIpcErrorLogging(
      handlerOpts('detectAccessibilityIssues'),
      async (rootElement: iosTools.ElementNode) => {
        // Convert ElementNode tree to UIElement tree for ui-analyzer functions
        const uiElement = convertElementNodeToUIElement(rootElement);
        const issues = iosTools.detectIssues(uiElement);
        return { success: true, data: issues };
      }
    )
  );

  // Summarize screen from XCUITest inspection result
  ipcMain.handle(
    'ios:inspect:summarizeScreen',
    withIpcErrorLogging(
      handlerOpts('summarizeScreen'),
      async (rootElement: iosTools.ElementNode) => {
        // Convert ElementNode tree to UIElement tree for ui-analyzer functions
        const uiElement = convertElementNodeToUIElement(rootElement);
        const summary = iosTools.summarizeScreen(uiElement);
        return { success: true, data: summary };
      }
    )
  );

  // ==========================================================================
  // Slash Command Handlers
  // ==========================================================================

  // Execute /ios.snapshot slash command
  ipcMain.handle(
    'ios:slashCommand:snapshot',
    withIpcErrorLogging(
      handlerOpts('executeSnapshotCommand'),
      async (commandText: string, sessionId: string) => {
        const { executeSnapshotCommand } = await import('../../slash-commands/ios-snapshot');
        return executeSnapshotCommand(commandText, sessionId);
      }
    )
  );

  // Execute /ios.inspect slash command
  ipcMain.handle(
    'ios:slashCommand:inspect',
    withIpcErrorLogging(
      handlerOpts('executeInspectCommand'),
      async (commandText: string, sessionId: string) => {
        const { executeInspectCommand } = await import('../../slash-commands/ios-inspect');
        return executeInspectCommand(commandText, sessionId);
      }
    )
  );

  // Execute /ios.run_flow slash command
  ipcMain.handle(
    'ios:slashCommand:runFlow',
    withIpcErrorLogging(
      handlerOpts('executeRunFlowCommand'),
      async (commandText: string, sessionId: string, cwd?: string) => {
        const { executeRunFlowCommand } = await import('../../slash-commands/ios-run-flow');
        return executeRunFlowCommand(commandText, sessionId, cwd);
      }
    )
  );

  // Execute /ios.tap slash command
  ipcMain.handle(
    'ios:slashCommand:tap',
    withIpcErrorLogging(
      handlerOpts('executeTapCommand'),
      async (commandText: string, sessionId: string, cwd?: string) => {
        const { executeTapCommand } = await import('../../slash-commands/ios-tap');
        return executeTapCommand(commandText, sessionId, cwd);
      }
    )
  );

  // Execute /ios.type slash command
  ipcMain.handle(
    'ios:slashCommand:type',
    withIpcErrorLogging(
      handlerOpts('executeTypeCommand'),
      async (commandText: string, sessionId: string, cwd?: string) => {
        const { executeTypeCommand } = await import('../../slash-commands/ios-type');
        return executeTypeCommand(commandText, sessionId, cwd);
      }
    )
  );

  // Execute /ios.scroll slash command
  ipcMain.handle(
    'ios:slashCommand:scroll',
    withIpcErrorLogging(
      handlerOpts('executeScrollCommand'),
      async (commandText: string, sessionId: string, cwd?: string) => {
        const { executeScrollCommand } = await import('../../slash-commands/ios-scroll');
        return executeScrollCommand(commandText, sessionId, cwd);
      }
    )
  );

  // Execute /ios.swipe slash command
  ipcMain.handle(
    'ios:slashCommand:swipe',
    withIpcErrorLogging(
      handlerOpts('executeSwipeCommand'),
      async (commandText: string, sessionId: string, cwd?: string) => {
        const { executeSwipeCommand } = await import('../../slash-commands/ios-swipe');
        return executeSwipeCommand(commandText, sessionId, cwd);
      }
    )
  );

  // ==========================================================================
  // Native Driver Actions
  // ==========================================================================

  // Execute tap action via native driver
  ipcMain.handle(
    'ios:action:tap',
    withIpcErrorLogging(
      handlerOpts('actionTap'),
      async (options: {
        bundleId: string;
        udid?: string;
        target: iosTools.NativeActionTarget;
        double?: boolean;
        long?: boolean;
        longDuration?: number;
        offsetX?: number;
        offsetY?: number;
        timeout?: number;
        screenshotDir?: string;
        debug?: boolean;
      }) => {
        const driver = iosTools.createNativeDriver({
          bundleId: options.bundleId,
          udid: options.udid,
          timeout: options.timeout,
          screenshotDir: options.screenshotDir,
          debug: options.debug,
        });

        // Choose the appropriate tap variant
        let action: iosTools.NativeActionRequest;
        if (options.double) {
          action = iosTools.nativeDoubleTap(options.target);
        } else if (options.long) {
          action = iosTools.nativeLongPress(options.target, options.longDuration ?? 1.0);
        } else {
          action = iosTools.nativeTap(options.target, {
            offsetX: options.offsetX,
            offsetY: options.offsetY,
          });
        }

        return driver.execute(action);
      }
    )
  );

  // Execute type action via native driver
  ipcMain.handle(
    'ios:action:type',
    withIpcErrorLogging(
      handlerOpts('actionType'),
      async (options: {
        bundleId: string;
        udid?: string;
        text: string;
        target?: iosTools.NativeActionTarget;
        clearFirst?: boolean;
        timeout?: number;
        screenshotDir?: string;
        debug?: boolean;
      }) => {
        const driver = iosTools.createNativeDriver({
          bundleId: options.bundleId,
          udid: options.udid,
          timeout: options.timeout,
          screenshotDir: options.screenshotDir,
          debug: options.debug,
        });

        const action = iosTools.nativeTypeText(options.text, {
          target: options.target,
          clearFirst: options.clearFirst,
        });

        return driver.execute(action);
      }
    )
  );

  // Execute scroll action via native driver
  ipcMain.handle(
    'ios:action:scroll',
    withIpcErrorLogging(
      handlerOpts('actionScroll'),
      async (options: {
        bundleId: string;
        udid?: string;
        direction?: iosTools.NativeSwipeDirection;
        distance?: number;
        target?: iosTools.NativeActionTarget;
        scrollToTarget?: iosTools.NativeActionTarget;
        maxAttempts?: number;
        timeout?: number;
        screenshotDir?: string;
        debug?: boolean;
      }) => {
        const driver = iosTools.createNativeDriver({
          bundleId: options.bundleId,
          udid: options.udid,
          timeout: options.timeout,
          screenshotDir: options.screenshotDir,
          debug: options.debug,
        });

        // Either scroll to a target element or scroll in a direction
        let action: iosTools.NativeActionRequest;
        if (options.scrollToTarget) {
          action = iosTools.nativeScrollTo(options.scrollToTarget, {
            direction: options.direction,
            maxAttempts: options.maxAttempts,
          });
        } else {
          action = iosTools.nativeScroll(options.direction || 'down', {
            target: options.target,
            distance: options.distance,
          });
        }

        return driver.execute(action);
      }
    )
  );

  // Execute swipe action via native driver
  ipcMain.handle(
    'ios:action:swipe',
    withIpcErrorLogging(
      handlerOpts('actionSwipe'),
      async (options: {
        bundleId: string;
        udid?: string;
        direction: iosTools.NativeSwipeDirection;
        target?: iosTools.NativeActionTarget;
        velocity?: iosTools.NativeSwipeVelocity;
        timeout?: number;
        screenshotDir?: string;
        debug?: boolean;
      }) => {
        const driver = iosTools.createNativeDriver({
          bundleId: options.bundleId,
          udid: options.udid,
          timeout: options.timeout,
          screenshotDir: options.screenshotDir,
          debug: options.debug,
        });

        const action = iosTools.nativeSwipe(options.direction, {
          target: options.target,
          velocity: options.velocity,
        });

        return driver.execute(action);
      }
    )
  );

  // Execute wait action via native driver
  ipcMain.handle(
    'ios:action:wait',
    withIpcErrorLogging(
      handlerOpts('actionWait'),
      async (options: {
        bundleId: string;
        udid?: string;
        target: iosTools.NativeActionTarget;
        waitForNotExist?: boolean;
        timeout?: number;
        screenshotDir?: string;
        debug?: boolean;
      }) => {
        const driver = iosTools.createNativeDriver({
          bundleId: options.bundleId,
          udid: options.udid,
          timeout: options.timeout,
          screenshotDir: options.screenshotDir,
          debug: options.debug,
        });

        const action = options.waitForNotExist
          ? iosTools.nativeWaitForNotExist(options.target, options.timeout)
          : iosTools.nativeWaitForElement(options.target, options.timeout);

        return driver.execute(action);
      }
    )
  );

  // ==========================================================================
  // Playbook Management
  // ==========================================================================

  // List available iOS playbooks
  ipcMain.handle(
    'ios:playbook:list',
    withIpcErrorLogging(handlerOpts('listPlaybooks'), async () => {
      const playbooks = iosTools.listPlaybooks();
      return { success: true, data: playbooks };
    })
  );

  // Get playbook info by ID
  ipcMain.handle(
    'ios:playbook:info',
    withIpcErrorLogging(handlerOpts('getPlaybookInfo'), async (playbookId: string) => {
      const info = iosTools.getPlaybookInfo(playbookId);
      if (!info) {
        return {
          success: false,
          error: `Playbook not found: ${playbookId}`,
        };
      }

      // Also load and validate the full config
      try {
        const config = iosTools.loadPlaybook(playbookId);
        const validation = iosTools.validatePlaybook(config);
        return {
          success: true,
          data: {
            ...info,
            config,
            validation,
          },
        };
      } catch (e) {
        return {
          success: false,
          error: `Failed to load playbook: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    })
  );

  // Run a playbook
  ipcMain.handle(
    'ios:playbook:run',
    withIpcErrorLogging(
      handlerOpts('runPlaybook'),
      async (options: {
        playbook: string;
        inputs: Record<string, unknown>;
        sessionId: string;
        cwd?: string;
        dryRun?: boolean;
        continueOnError?: boolean;
        stepTimeout?: number;
      }) => {
        const mainWindow = BrowserWindow.getAllWindows()[0];

        // Store the running playbook in the active map
        const runId = `playbook-${Date.now()}`;

        // Track playbook execution for status/stop functionality
        activePlaybookRuns.set(runId, {
          startTime: new Date(),
          playbook: options.playbook,
          sessionId: options.sessionId,
          status: 'running',
        });

        try {
          const result = await iosTools.runPlaybook({
            playbook: options.playbook,
            inputs: options.inputs,
            sessionId: options.sessionId,
            cwd: options.cwd,
            dryRun: options.dryRun,
            continueOnError: options.continueOnError,
            stepTimeout: options.stepTimeout,
            onProgress: (progress) => {
              // Send progress updates to renderer
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('ios:playbook:progress', runId, progress);
              }
            },
            onStep: (event) => {
              // Send step events for debugging
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('ios:playbook:step', runId, event);
              }
            },
          });

          // Update status
          const runInfo = activePlaybookRuns.get(runId);
          if (runInfo) {
            runInfo.status = result.success && result.data?.passed ? 'completed' : 'failed';
            runInfo.result = result;
            runInfo.endTime = new Date();
          }

          return {
            success: true,
            data: {
              runId,
              ...result,
            },
          };
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);

          // Update status on error
          const runInfo = activePlaybookRuns.get(runId);
          if (runInfo) {
            runInfo.status = 'failed';
            runInfo.error = error;
            runInfo.endTime = new Date();
          }

          return {
            success: false,
            error: `Playbook execution failed: ${error}`,
          };
        }
      }
    )
  );

  // Stop a running playbook
  ipcMain.handle(
    'ios:playbook:stop',
    withIpcErrorLogging(handlerOpts('stopPlaybook'), async (runId: string) => {
      const runInfo = activePlaybookRuns.get(runId);

      if (!runInfo) {
        return {
          success: false,
          error: `Playbook run not found: ${runId}`,
        };
      }

      if (runInfo.status !== 'running') {
        return {
          success: false,
          error: `Playbook is not running (status: ${runInfo.status})`,
        };
      }

      // Mark as stopped
      runInfo.status = 'stopped';
      runInfo.endTime = new Date();

      // Note: Actual cancellation of the running playbook would require
      // implementing a cancellation token pattern in the playbook runner.
      // For now, we just update the status.
      logger.info(`${LOG_CONTEXT} Playbook run ${runId} marked as stopped`);

      return { success: true, data: { runId, status: 'stopped' } };
    })
  );

  // Get status of a playbook run
  ipcMain.handle(
    'ios:playbook:status',
    withIpcErrorLogging(handlerOpts('getPlaybookStatus'), async (runId?: string) => {
      if (runId) {
        // Get specific run status
        const runInfo = activePlaybookRuns.get(runId);
        if (!runInfo) {
          return {
            success: false,
            error: `Playbook run not found: ${runId}`,
          };
        }
        return {
          success: true,
          data: {
            runId,
            ...runInfo,
          },
        };
      } else {
        // Get all active runs
        const runs: Array<{
          runId: string;
          playbook: string;
          sessionId: string;
          status: string;
          startTime: Date;
          endTime?: Date;
        }> = [];

        for (const [id, info] of activePlaybookRuns.entries()) {
          runs.push({
            runId: id,
            playbook: info.playbook,
            sessionId: info.sessionId,
            status: info.status,
            startTime: info.startTime,
            endTime: info.endTime,
          });
        }

        return { success: true, data: runs };
      }
    })
  );

  // Validate a playbook without running
  ipcMain.handle(
    'ios:playbook:validate',
    withIpcErrorLogging(handlerOpts('validatePlaybook'), async (playbookId: string) => {
      try {
        const config = iosTools.loadPlaybook(playbookId);
        const validation = iosTools.validatePlaybook(config);
        return { success: true, data: validation };
      } catch (e) {
        return {
          success: false,
          error: `Failed to validate playbook: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    })
  );

  // Ensure playbooks directory exists
  ipcMain.handle(
    'ios:playbook:ensureDirectory',
    withIpcErrorLogging(handlerOpts('ensurePlaybooksDirectory'), async () => {
      const dir = iosTools.ensurePlaybooksDirectory();
      return { success: true, data: { directory: dir } };
    })
  );

  // Format playbook result for display
  ipcMain.handle(
    'ios:playbook:formatResult',
    withIpcErrorLogging(
      handlerOpts('formatPlaybookResult'),
      async (result: iosTools.PlaybookRunResult) => {
        const formatted = iosTools.formatPlaybookResult(result);
        return { success: true, data: formatted };
      }
    )
  );

  // Format playbook result as JSON
  ipcMain.handle(
    'ios:playbook:formatResultJson',
    withIpcErrorLogging(
      handlerOpts('formatPlaybookResultAsJson'),
      async (result: iosTools.PlaybookRunResult) => {
        const json = iosTools.formatPlaybookResultAsJson(result);
        return { success: true, data: json };
      }
    )
  );

  // Format playbook result compact
  ipcMain.handle(
    'ios:playbook:formatResultCompact',
    withIpcErrorLogging(
      handlerOpts('formatPlaybookResultCompact'),
      async (result: iosTools.PlaybookRunResult) => {
        const compact = iosTools.formatPlaybookResultCompact(result);
        return { success: true, data: compact };
      }
    )
  );

  // ==========================================================================
  // MaestroBridge Introspection
  // ==========================================================================

  // Ping the bridge to check if it's alive
  ipcMain.handle(
    'ios:bridge:ping',
    withIpcErrorLogging(
      handlerOpts('bridgePing'),
      async (options?: { host?: string; port?: number; token?: string }) => {
        const client = new iosTools.BridgeClient(options);
        const isAlive = await client.ping();
        return { success: true, data: isAlive };
      }
    )
  );

  // Get full app state from the bridge
  ipcMain.handle(
    'ios:bridge:getState',
    withIpcErrorLogging(
      handlerOpts('bridgeGetState'),
      async (options?: { host?: string; port?: number; token?: string; key?: string }) => {
        const { key, ...clientConfig } = options || {};
        const client = new iosTools.BridgeClient(clientConfig);

        if (key) {
          return await client.getStateKey(key);
        }
        return await client.getState();
      }
    )
  );

  // Get route/navigation state from the bridge
  ipcMain.handle(
    'ios:bridge:getRoute',
    withIpcErrorLogging(
      handlerOpts('bridgeGetRoute'),
      async (options?: { host?: string; port?: number; token?: string; stack?: boolean; history?: boolean }) => {
        const { stack, history, ...clientConfig } = options || {};
        const client = new iosTools.BridgeClient(clientConfig);

        if (history) {
          return await client.getRouteHistory();
        }
        if (stack) {
          return await client.getRouteStack();
        }
        return await client.getRoute();
      }
    )
  );

  // Get network request log from the bridge
  ipcMain.handle(
    'ios:bridge:getNetwork',
    withIpcErrorLogging(
      handlerOpts('bridgeGetNetwork'),
      async (options?: {
        host?: string;
        port?: number;
        token?: string;
        limit?: number;
        errorsOnly?: boolean;
        id?: string;
      }) => {
        const { limit, errorsOnly, id, ...clientConfig } = options || {};
        const client = new iosTools.BridgeClient(clientConfig);

        if (id) {
          return await client.getNetworkDetail(id);
        }
        return await client.getNetwork({ limit, errorsOnly });
      }
    )
  );

  // Get analytics events from the bridge
  ipcMain.handle(
    'ios:bridge:getAnalytics',
    withIpcErrorLogging(
      handlerOpts('bridgeGetAnalytics'),
      async (options?: { host?: string; port?: number; token?: string; filter?: string; limit?: number }) => {
        const { filter, limit, ...clientConfig } = options || {};
        const client = new iosTools.BridgeClient(clientConfig);

        return await client.getAnalytics({ filter, limit });
      }
    )
  );

  // Get feature flags from the bridge
  ipcMain.handle(
    'ios:bridge:getFlags',
    withIpcErrorLogging(
      handlerOpts('bridgeGetFlags'),
      async (options?: { host?: string; port?: number; token?: string; name?: string }) => {
        const { name, ...clientConfig } = options || {};
        const client = new iosTools.BridgeClient(clientConfig);

        if (name) {
          return await client.getFlag(name);
        }
        return await client.getFlags();
      }
    )
  );

  // Set test state via the bridge (dangerous - requires confirmation)
  ipcMain.handle(
    'ios:bridge:setState',
    withIpcErrorLogging(
      handlerOpts('bridgeSetState'),
      async (options: {
        host?: string;
        port?: number;
        token?: string;
        key: string;
        value: unknown;
        additionalToken?: string;
      }) => {
        const { key, value, additionalToken, ...clientConfig } = options;

        if (!key) {
          return {
            success: false,
            error: 'State key is required',
            errorCode: 'INVALID_ARGUMENT' as const,
          };
        }

        const client = new iosTools.BridgeClient(clientConfig);
        return await client.setState(key, value, additionalToken);
      }
    )
  );

  // Discover bridge (auto-find port and token)
  ipcMain.handle(
    'ios:bridge:discover',
    withIpcErrorLogging(
      handlerOpts('bridgeDiscover'),
      async (options?: { udid?: string; host?: string }) => {
        const { udid, host } = options || {};
        return await iosTools.discoverBridge(udid, host);
      }
    )
  );

  // Wait for bridge to become available
  ipcMain.handle(
    'ios:bridge:waitFor',
    withIpcErrorLogging(
      handlerOpts('bridgeWaitFor'),
      async (options?: { host?: string; port?: number; timeout?: number; interval?: number }) => {
        const { host, port, timeout, interval } = options || {};
        return await iosTools.waitForBridge(host, port, timeout, interval);
      }
    )
  );

  // Clear network logs via the bridge
  ipcMain.handle(
    'ios:bridge:clearNetwork',
    withIpcErrorLogging(
      handlerOpts('bridgeClearNetwork'),
      async (options?: { host?: string; port?: number; token?: string }) => {
        const client = new iosTools.BridgeClient(options);
        return await client.clearNetwork();
      }
    )
  );

  // Clear analytics events via the bridge
  ipcMain.handle(
    'ios:bridge:clearAnalytics',
    withIpcErrorLogging(
      handlerOpts('bridgeClearAnalytics'),
      async (options?: { host?: string; port?: number; token?: string }) => {
        const client = new iosTools.BridgeClient(options);
        return await client.clearAnalytics();
      }
    )
  );

  // Get analytics sources from the bridge
  ipcMain.handle(
    'ios:bridge:getAnalyticsSources',
    withIpcErrorLogging(
      handlerOpts('bridgeGetAnalyticsSources'),
      async (options?: { host?: string; port?: number; token?: string }) => {
        const client = new iosTools.BridgeClient(options);
        return await client.getAnalyticsSources();
      }
    )
  );

  // Register visual regression handlers (baselines, diff, regression)
  registerVisualRegressionHandlers();

  logger.debug(`${LOG_CONTEXT} iOS IPC handlers registered`);
}

// =============================================================================
// Playbook Run Tracking
// =============================================================================

/**
 * Active playbook run information
 */
interface PlaybookRunInfo {
  startTime: Date;
  endTime?: Date;
  playbook: string;
  sessionId: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  result?: iosTools.IOSResult<iosTools.PlaybookRunResult>;
  error?: string;
}

/**
 * Map of active playbook runs (keyed by run ID)
 */
const activePlaybookRuns = new Map<string, PlaybookRunInfo>();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert ElementNode (from XCUITest inspection) to UIElement (for ui-analyzer).
 * This allows using the ui-analyzer functions with XCUITest inspection results.
 */
function convertElementNodeToUIElement(node: iosTools.ElementNode): iosTools.UIElement {
  return {
    type: node.type,
    identifier: node.identifier,
    label: node.label,
    value: node.value,
    placeholder: node.placeholderValue,
    frame: {
      x: node.frame.x,
      y: node.frame.y,
      width: node.frame.width,
      height: node.frame.height,
    },
    visible: node.isVisible,
    enabled: node.isEnabled,
    traits: node.traits,
    children: node.children.map(convertElementNodeToUIElement),
  };
}

/**
 * Convert XCUITestInspectResult to InspectResult for formatting.
 * This allows using the format functions with XCUITest inspection results.
 */
function convertXCUITestToInspectResult(result: iosTools.XCUITestInspectResult): iosTools.InspectResult {
  // Recursively convert ElementNode tree to UIElement tree
  const tree = convertElementNodeToUIElement(result.rootElement);

  // Flatten the tree to get all elements
  const elements: iosTools.UIElement[] = [];
  function collectElements(el: iosTools.UIElement) {
    elements.push(el);
    for (const child of el.children) {
      collectElements(child);
    }
  }
  collectElements(tree);

  return {
    id: result.id,
    timestamp: result.timestamp,
    simulator: result.simulator,
    tree,
    elements,
    stats: {
      totalElements: result.summary.totalElements,
      interactableElements: result.summary.interactableElements,
      buttons: result.summary.buttons,
      textFields: result.summary.textInputs,
      textElements: result.summary.textElements,
      images: result.summary.images,
    },
    screenshot: result.screenshotPath
      ? {
          path: result.screenshotPath,
          size: 0, // Size not available from XCUITest result
        }
      : undefined,
    artifactDir: result.artifactDir,
  };
}

// =============================================================================
// Visual Regression Baseline IPC Handlers
// =============================================================================

/**
 * Options for saving a baseline.
 */
interface SaveBaselineOptions {
  project: string;
  name: string;
  imagePath: string;
  device: {
    name: string;
    osVersion: string;
    screenSize: { width: number; height: number };
    deviceType?: string;
    udid?: string;
  };
  bundleId: string;
  appVersion?: string;
  description?: string;
  tags?: string[];
  deviceFamily?: string;
  autoDetectDeviceFamily?: boolean;
}

/**
 * Options for updating a baseline.
 */
interface UpdateBaselineOptions {
  project: string;
  name: string;
  imagePath: string;
  deviceFamily?: string;
}

/**
 * Options for listing baselines.
 */
interface ListBaselinesOptions {
  project: string;
  deviceFamily?: string;
}

/**
 * Options for deleting a baseline.
 */
interface DeleteBaselineOptions {
  project: string;
  name: string;
  deviceFamily?: string;
}

/**
 * Options for comparing to a baseline.
 */
interface CompareBaselineOptions {
  project: string;
  name: string;
  currentImagePath: string;
  threshold?: number;
  outputDiffPath?: string;
  deviceFamily?: string;
  autoDetectDevice?: boolean;
  simulatorUdid?: string;
}

/**
 * Options for flow comparison.
 */
interface FlowCompareOptions {
  project: string;
  flowName: string;
  currentImages: Array<{
    stepNumber: number;
    imagePath: string;
  }>;
  threshold?: number;
  outputDir?: string;
  deviceFamily?: string;
}

/**
 * Options for running regression tests.
 */
interface RegressionRunOptions {
  project: string;
  simulatorUdid?: string;
  threshold?: number;
  outputDir?: string;
  deviceFamily?: string;
  failFast?: boolean;
  updateOnFail?: boolean;
  verbose?: boolean;
  mode?: 'full' | 'quick' | 'flows-only';
  baselineNames?: string[];
}

/**
 * Register visual regression IPC handlers.
 * Called from registerIOSHandlers().
 */
function registerVisualRegressionHandlers(): void {
  // ==========================================================================
  // Baseline Management
  // ==========================================================================

  // Save a new baseline
  ipcMain.handle(
    'ios:baseline:save',
    withIpcErrorLogging(
      handlerOpts('saveBaseline'),
      async (options: SaveBaselineOptions) => {
        const {
          project,
          name,
          imagePath,
          device,
          bundleId,
          appVersion,
          description,
          tags,
          deviceFamily,
          autoDetectDeviceFamily,
        } = options;

        // Ensure project exists
        await iosTools.ensureProjectExists(project, bundleId);

        // Create baseline with or without auto device detection
        if (autoDetectDeviceFamily) {
          const result = await iosTools.createBaselineWithAutoDetect(
            project,
            name,
            imagePath,
            device,
            bundleId,
            { appVersion, description, tags }
          );
          const baselinePath = iosTools.getBaselinePath(project, name, result.deviceFamily);
          return {
            success: true,
            data: {
              name,
              deviceFamily: result.deviceFamily,
              path: baselinePath,
            },
          };
        }

        // Create baseline with explicit device family
        await iosTools.createBaseline(
          project,
          name,
          imagePath,
          device,
          bundleId,
          { appVersion, description, tags, deviceFamily: deviceFamily as iosTools.DeviceFamily | undefined }
        );
        const baselinePath = iosTools.getBaselinePath(project, name, deviceFamily as iosTools.DeviceFamily | undefined);

        return {
          success: true,
          data: {
            name,
            deviceFamily: deviceFamily || null,
            path: baselinePath,
            description,
            tags,
          },
        };
      }
    )
  );

  // Update an existing baseline
  ipcMain.handle(
    'ios:baseline:update',
    withIpcErrorLogging(
      handlerOpts('updateBaseline'),
      async (options: UpdateBaselineOptions) => {
        const { project, name, imagePath, deviceFamily } = options;

        await iosTools.updateBaseline(
          project,
          name,
          imagePath,
          deviceFamily as iosTools.DeviceFamily | undefined
        );

        return {
          success: true,
          data: {
            name,
            deviceFamily: deviceFamily || null,
            updated: true,
          },
        };
      }
    )
  );

  // List baselines for a project
  ipcMain.handle(
    'ios:baseline:list',
    withIpcErrorLogging(
      handlerOpts('listBaselines'),
      async (options: ListBaselinesOptions) => {
        const { project, deviceFamily } = options;

        const baselines = await iosTools.listBaselines(
          project,
          deviceFamily as iosTools.DeviceFamily | undefined
        );

        // Get project metadata
        const projectPath = iosTools.getProjectPath(project);
        const projectMetadata = await iosTools.readProjectMetadata(projectPath);

        return {
          success: true,
          data: {
            project,
            projectMetadata,
            baselines,
            count: baselines.length,
            deviceFamily: deviceFamily || null,
          },
        };
      }
    )
  );

  // Delete a baseline
  ipcMain.handle(
    'ios:baseline:delete',
    withIpcErrorLogging(
      handlerOpts('deleteBaseline'),
      async (options: DeleteBaselineOptions) => {
        const { project, name, deviceFamily } = options;

        await iosTools.deleteBaseline(
          project,
          name,
          deviceFamily as iosTools.DeviceFamily | undefined
        );

        return {
          success: true,
          data: {
            name,
            deviceFamily: deviceFamily || null,
            deleted: true,
          },
        };
      }
    )
  );

  // Get baseline details
  ipcMain.handle(
    'ios:baseline:get',
    withIpcErrorLogging(
      handlerOpts('getBaseline'),
      async (options: { project: string; name: string; deviceFamily?: string }) => {
        const { project, name, deviceFamily } = options;

        const result = await iosTools.getBaseline(
          project,
          name,
          deviceFamily as iosTools.DeviceFamily | undefined
        );

        if (!result) {
          return {
            success: false,
            error: `Baseline '${name}' not found in project '${project}'`,
          };
        }

        return {
          success: true,
          data: result,
        };
      }
    )
  );

  // List all projects
  ipcMain.handle(
    'ios:baseline:projects',
    withIpcErrorLogging(handlerOpts('listProjects'), async () => {
      const projects = await iosTools.listProjects();
      return {
        success: true,
        data: {
          projects,
          count: projects.length,
        },
      };
    })
  );

  // Add ignore region to a baseline
  ipcMain.handle(
    'ios:baseline:addIgnoreRegion',
    withIpcErrorLogging(
      handlerOpts('addIgnoreRegion'),
      async (options: {
        project: string;
        name: string;
        region: iosTools.IgnoreRegion;
        deviceFamily?: string;
      }) => {
        const { project, name, region, deviceFamily } = options;

        // Get baseline path
        const baselinePath = iosTools.getBaselinePath(
          project,
          name,
          deviceFamily as iosTools.DeviceFamily | undefined
        );

        // Add ignore region - function handles reading/writing internally
        const updatedMetadata = await iosTools.addIgnoreRegion(baselinePath, region);

        return {
          success: true,
          data: {
            name,
            ignoreRegions: updatedMetadata.ignoreRegions,
          },
        };
      }
    )
  );

  // Get device baseline coverage
  ipcMain.handle(
    'ios:baseline:coverage',
    withIpcErrorLogging(
      handlerOpts('getBaselineCoverage'),
      async (options: { project: string }) => {
        const { project } = options;

        const coverage = await iosTools.getBaselineCoverage(project);
        const report = iosTools.formatCoverageReport(coverage);

        return {
          success: true,
          data: {
            coverage,
            report,
          },
        };
      }
    )
  );

  // ==========================================================================
  // Diff / Comparison
  // ==========================================================================

  // Compare current screenshot to baseline
  ipcMain.handle(
    'ios:diff:compare',
    withIpcErrorLogging(
      handlerOpts('diffCompare'),
      async (options: CompareBaselineOptions) => {
        const {
          project,
          name,
          currentImagePath,
          threshold = 0.1,
          outputDiffPath,
          deviceFamily,
          autoDetectDevice,
          simulatorUdid,
        } = options;

        // If auto-detect, get simulator info
        let effectiveDeviceFamily = deviceFamily;
        if (autoDetectDevice && simulatorUdid) {
          const simulatorResult = await iosTools.getSimulator(simulatorUdid);
          if (simulatorResult.success && simulatorResult.data) {
            const screenSize = await iosTools.getScreenSize(simulatorUdid);
            if (screenSize.success && screenSize.data) {
              effectiveDeviceFamily = iosTools.detectDeviceFamilyFromScreen(screenSize.data);
            }
          }
        }

        // Normalize baseline info - stores imagePath and metadata
        let baselineImagePath: string | undefined;
        let baselineMetadata: iosTools.BaselineMetadata | undefined;
        let foundDeviceFamily: string | undefined;

        // Find the best baseline for the device
        if (autoDetectDevice && simulatorUdid) {
          const simulatorResult = await iosTools.getSimulator(simulatorUdid);
          if (simulatorResult.success && simulatorResult.data) {
            const simulator = simulatorResult.data;
            const screenSize = await iosTools.getScreenSize(simulatorUdid);
            if (screenSize.success && screenSize.data) {
              const match = await iosTools.findBestBaselineForDevice(project, name, {
                name: simulator.name,
                osVersion: simulator.iosVersion || simulator.runtime,
                screenSize: screenSize.data,
              });
              if (match) {
                baselineImagePath = match.baseline.imagePath;
                baselineMetadata = match.baseline.metadata;
                foundDeviceFamily = match.deviceFamily;
              }
            }
          }
        }

        if (!baselineImagePath) {
          // Fall back to direct lookup
          const directBaseline = await iosTools.getBaseline(
            project,
            name,
            effectiveDeviceFamily as iosTools.DeviceFamily | undefined
          );
          if (directBaseline) {
            baselineImagePath = directBaseline.imagePath;
            baselineMetadata = directBaseline.metadata;
          }
        }

        if (!baselineImagePath) {
          return {
            success: false,
            error: `Baseline '${name}' not found for project '${project}'`,
          };
        }

        // Perform full comparison
        const result = await iosTools.fullComparison(
          baselineImagePath,
          currentImagePath,
          {
            compare: {
              threshold,
            },
            output: outputDiffPath
              ? {
                  diffImagePath: outputDiffPath,
                }
              : undefined,
            diffMode: 'highlight',
            ignoreRegions: baselineMetadata?.ignoreRegions,
          }
        );

        // Format the result for the agent
        const formatted = iosTools.formatDiffForAgent(
          result.comparison,
          result.analysis,
          {
            baseline: baselineImagePath,
            current: currentImagePath,
            diff: outputDiffPath,
          },
          { baselineName: name }
        );

        return {
          success: true,
          data: {
            match: result.comparison.match,
            similarity: result.comparison.similarity,
            diffPixels: result.comparison.diffPixels,
            diffPercent: result.comparison.diffPercent,
            changes: result.analysis?.changes || [],
            diffPath: outputDiffPath || null,
            baselinePath: baselineImagePath,
            currentPath: currentImagePath,
            formatted: formatted.markdown,
            deviceFamily: effectiveDeviceFamily || foundDeviceFamily || null,
            baselineDeviceFamily: baselineMetadata?.device?.deviceType || null,
          },
        };
      }
    )
  );

  // Compare flow steps
  ipcMain.handle(
    'ios:diff:flow',
    withIpcErrorLogging(
      handlerOpts('diffFlow'),
      async (options: FlowCompareOptions) => {
        const { project, flowName, currentImages, threshold = 0.1, outputDir } = options;
        // Note: deviceFamily is not used for getFlowBaselineStorage which takes (project, flowName)

        // Get flow baseline
        const flowBaseline = await iosTools.getFlowBaselineStorage(
          project,
          flowName
        );

        if (!flowBaseline) {
          return {
            success: false,
            error: `Flow baseline '${flowName}' not found in project '${project}'`,
          };
        }

        // Compare each step
        const stepResults: Array<{
          stepNumber: number;
          stepName: string;
          match: boolean;
          similarity: number;
          diffPixels: number;
          diffPath?: string;
        }> = [];

        for (const step of flowBaseline.steps) {
          const currentImage = currentImages.find((i) => i.stepNumber === step.stepNumber);

          if (!currentImage) {
            stepResults.push({
              stepNumber: step.stepNumber,
              stepName: step.name,
              match: false,
              similarity: 0,
              diffPixels: 0,
            });
            continue;
          }

          const diffPath = outputDir
            ? `${outputDir}/${flowName}_step_${step.stepNumber}_diff.png`
            : undefined;

          const result = await iosTools.fullComparison(step.screenshotPath, currentImage.imagePath, {
            compare: {
              threshold,
            },
            output: diffPath
              ? {
                  diffImagePath: diffPath,
                }
              : undefined,
            diffMode: 'highlight',
            ignoreRegions: step.ignoreRegions,
          });

          stepResults.push({
            stepNumber: step.stepNumber,
            stepName: step.name,
            match: result.comparison.match,
            similarity: result.comparison.similarity,
            diffPixels: result.comparison.diffPixels,
            diffPath,
          });
        }

        const allMatch = stepResults.every((s) => s.match);
        const passedCount = stepResults.filter((s) => s.match).length;
        const failedCount = stepResults.filter((s) => !s.match).length;

        return {
          success: true,
          data: {
            flowName,
            totalSteps: flowBaseline.steps.length,
            comparedSteps: currentImages.length,
            allMatch,
            passedCount,
            failedCount,
            passRate: stepResults.length > 0 ? passedCount / stepResults.length : 0,
            steps: stepResults,
          },
        };
      }
    )
  );

  // ==========================================================================
  // Full Regression Testing
  // ==========================================================================

  // Run full regression test suite
  ipcMain.handle(
    'ios:regression:run',
    withIpcErrorLogging(
      handlerOpts('regressionRun'),
      async (options: RegressionRunOptions) => {
        const {
          project,
          simulatorUdid,
          threshold = 0.1,
          outputDir,
          deviceFamily,
          failFast = false,
          updateOnFail = false,
          // verbose - not used in current implementation
          mode = 'full',
          baselineNames,
        } = options;

        // Get all baselines for the project
        let baselines = await iosTools.listBaselines(
          project,
          deviceFamily as iosTools.DeviceFamily | undefined
        );

        // Filter by names if specified
        if (baselineNames && baselineNames.length > 0) {
          baselines = baselines.filter((b) => baselineNames.includes(b.name));
        }

        // Filter for screen baselines only if not full mode
        if (mode === 'flows-only') {
          baselines = []; // We'll handle flows separately
        }

        const results: Array<{
          name: string;
          type: 'screen' | 'flow';
          match: boolean;
          similarity: number;
          diffPixels: number;
          diffPercent: number;
          diffPath?: string;
          error?: string;
          updated?: boolean;
        }> = [];

        let hasFailure = false;

        // Test each screen baseline
        if (mode !== 'flows-only') {
          for (const baseline of baselines) {
            if (baseline.type !== 'screen') continue;

            // Get baseline details
            const baselineInfo = await iosTools.getBaseline(
              project,
              baseline.name,
              baseline.deviceFamily
            );

            if (!baselineInfo) {
              results.push({
                name: baseline.name,
                type: 'screen',
                match: false,
                similarity: 0,
                diffPixels: 0,
                diffPercent: 0,
                error: 'Baseline not found',
              });
              hasFailure = true;
              if (failFast) break;
              continue;
            }

            // Capture current screenshot if simulator is specified
            let currentImagePath: string | undefined;
            if (simulatorUdid) {
              const screenshotDir = outputDir || '/tmp/maestro-regression';
              await require('fs/promises').mkdir(screenshotDir, { recursive: true });
              currentImagePath = `${screenshotDir}/${baseline.name}_current.png`;

              const screenshotResult = await iosTools.captureScreenshot(simulatorUdid, currentImagePath);
              if (!screenshotResult.success) {
                results.push({
                  name: baseline.name,
                  type: 'screen',
                  match: false,
                  similarity: 0,
                  diffPixels: 0,
                  diffPercent: 0,
                  error: `Failed to capture screenshot: ${screenshotResult.error}`,
                });
                hasFailure = true;
                if (failFast) break;
                continue;
              }
            } else {
              // Without simulator, we can't run regression tests
              results.push({
                name: baseline.name,
                type: 'screen',
                match: false,
                similarity: 0,
                diffPixels: 0,
                diffPercent: 0,
                error: 'No simulator specified for comparison',
              });
              hasFailure = true;
              if (failFast) break;
              continue;
            }

            // Compare
            const diffPath = outputDir ? `${outputDir}/${baseline.name}_diff.png` : undefined;
            const comparisonResult = await iosTools.fullComparison(baselineInfo.imagePath, currentImagePath, {
              compare: {
                threshold,
              },
              output: diffPath
                ? {
                    diffImagePath: diffPath,
                  }
                : undefined,
              diffMode: 'highlight',
              ignoreRegions: baselineInfo.metadata?.ignoreRegions,
            });

            const result: (typeof results)[0] = {
              name: baseline.name,
              type: 'screen',
              match: comparisonResult.comparison.match,
              similarity: comparisonResult.comparison.similarity,
              diffPixels: comparisonResult.comparison.diffPixels,
              diffPercent: comparisonResult.comparison.diffPercent,
              diffPath: diffPath && !comparisonResult.comparison.match ? diffPath : undefined,
            };

            // Update baseline if requested and failed
            if (!comparisonResult.comparison.match && updateOnFail && currentImagePath) {
              await iosTools.updateBaseline(project, baseline.name, currentImagePath, baseline.deviceFamily);
              result.updated = true;
            }

            if (!comparisonResult.comparison.match) {
              hasFailure = true;
            }

            results.push(result);

            if (failFast && hasFailure) break;
          }
        }

        // Get flow baselines if not screen-only
        if (mode !== 'quick' && !failFast) {
          const flows = await iosTools.listFlows(project);

          for (const flow of flows) {
            results.push({
              name: flow.name,
              type: 'flow',
              match: true, // Flows need separate capture logic
              similarity: 1,
              diffPixels: 0,
              diffPercent: 0,
              error: 'Flow comparison requires step-by-step capture (not implemented in regression run)',
            });
          }
        }

        // Calculate summary statistics
        const totalBaselines = results.length;
        const passed = results.filter((r) => r.match && !r.error).length;
        const failed = results.filter((r) => !r.match || r.error).length;
        const updated = results.filter((r) => r.updated).length;
        const skipped = results.filter((r) => r.error && !r.match).length;

        // Format report - build RegressionEntry[] for formatRegressionReport
        // Note: formatRegressionReport expects RegressionEntry[] which requires comparison objects
        // Since we don't have full comparison data here, we'll build a simple report manually
        const reportLines: string[] = [];
        reportLines.push(`# Visual Regression Report: ${project}`);
        reportLines.push('');
        reportLines.push(`## Summary`);
        reportLines.push(`- Total: ${totalBaselines}`);
        reportLines.push(`- Passed: ${passed}`);
        reportLines.push(`- Failed: ${failed}`);
        reportLines.push(`- Skipped: ${skipped}`);
        reportLines.push(`- Updated: ${updated}`);
        reportLines.push(`- Pass Rate: ${(totalBaselines > 0 ? (passed / totalBaselines) * 100 : 0).toFixed(1)}%`);
        reportLines.push('');
        if (failed > 0) {
          reportLines.push(`## Failed Tests`);
          for (const r of results.filter((r) => !r.match)) {
            reportLines.push(`- ${r.name}: ${r.error || `${(r.similarity * 100).toFixed(1)}% similarity`}`);
            if (r.diffPath) {
              reportLines.push(`  - Diff: ${r.diffPath}`);
            }
          }
          reportLines.push('');
        }
        const report = reportLines.join('\n');

        return {
          success: true,
          data: {
            project,
            deviceFamily: deviceFamily || null,
            mode,
            summary: {
              total: totalBaselines,
              passed,
              failed,
              skipped,
              updated,
              passRate: totalBaselines > 0 ? passed / totalBaselines : 0,
              allPassed: !hasFailure,
            },
            results,
            report,
          },
        };
      }
    )
  );

  // ==========================================================================
  // Export/Import
  // ==========================================================================

  // Export baselines
  ipcMain.handle(
    'ios:baseline:export',
    withIpcErrorLogging(
      handlerOpts('exportBaselines'),
      async (options: {
        project: string;
        outputPath: string;
        format?: 'zip' | 'directory';
        names?: string[];
        tags?: string[];
      }) => {
        const result = await iosTools.exportBaselines(options.project, {
          outputPath: options.outputPath,
          format: options.format,
          names: options.names,
          tags: options.tags,
        });

        return {
          success: true,
          data: result,
        };
      }
    )
  );

  // Import baselines
  ipcMain.handle(
    'ios:baseline:import',
    withIpcErrorLogging(
      handlerOpts('importBaselines'),
      async (options: {
        project: string;
        inputPath: string;
        overwrite?: boolean;
        names?: string[];
        prefix?: string;
      }) => {
        const result = await iosTools.importBaselines(options.project, {
          inputPath: options.inputPath,
          overwrite: options.overwrite,
          names: options.names,
          prefix: options.prefix,
        });

        return {
          success: true,
          data: result,
        };
      }
    )
  );

  logger.info(`${LOG_CONTEXT} Visual regression IPC handlers registered`);
}

// Add call to register visual regression handlers in main registration
// This is called at the end of registerIOSHandlers() below
