import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react';
import type { Session, IOSStatus, IOSSimulatorStatus, IOSAppStatus, IOSLastActionResult } from '../types';

/**
 * iOS status data for a session
 */
export interface IOSStatusData extends IOSStatus {
  sessionId: string;
}

/**
 * iOS status context value exposed to consumers.
 */
export interface IOSStatusContextValue {
  /**
   * Map of session ID to iOS status data.
   * Only sessions with iOS development activity will have entries.
   */
  iosStatusMap: Map<string, IOSStatusData>;

  /**
   * Manually trigger a refresh of iOS status for all sessions.
   * Useful when you know the status has changed and want immediate feedback.
   */
  refreshIOSStatus: () => Promise<void>;

  /**
   * Whether the hook is currently loading data.
   */
  isLoading: boolean;

  /**
   * Get the iOS status for a specific session.
   * Returns undefined if session is not found or iOS is not enabled.
   */
  getStatus: (sessionId: string) => IOSStatusData | undefined;

  /**
   * Record a last action result for a session.
   * Called after iOS slash commands complete.
   */
  recordAction: (sessionId: string, action: string, success: boolean, message?: string, errorCode?: string) => void;

  /**
   * Check if a session has iOS features enabled.
   */
  isIOSEnabled: (sessionId: string) => boolean;

  /**
   * Enable iOS status tracking for a session.
   * Called when a session first uses an iOS command.
   */
  enableIOSForSession: (sessionId: string) => void;

  /**
   * Disable iOS status tracking for a session.
   */
  disableIOSForSession: (sessionId: string) => void;
}

// Create context with null as default (will throw if used outside provider)
const IOSStatusContext = createContext<IOSStatusContextValue | null>(null);

interface IOSStatusProviderProps {
  children: ReactNode;
  /** Array of all sessions */
  sessions: Session[];
  /** ID of the currently active session */
  activeSessionId?: string;
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number;
}

/**
 * Convert simctl state string to IOSSimulatorStatus
 */
function parseSimulatorState(state: string): IOSSimulatorStatus {
  const normalized = state.toLowerCase();
  if (normalized === 'booted') return 'booted';
  if (normalized === 'shutdown') return 'shutdown';
  if (normalized === 'booting') return 'booting';
  if (normalized === 'shuttingdown' || normalized === 'shutting_down') return 'shutting_down';
  return 'unknown';
}

/**
 * IOSStatusProvider - Provides centralized iOS status polling for all sessions.
 *
 * This provider centralizes iOS status polling similar to GitStatusProvider:
 * - Polls simulator status periodically
 * - Checks MaestroBridge connection
 * - Tracks last action results
 *
 * By centralizing iOS polling:
 * - iOS process spawns are reduced
 * - All iOS UI elements see consistent, synchronized data
 * - Status is only fetched for sessions with iOS enabled
 *
 * Usage:
 * Wrap the part of your app that needs iOS status in this provider:
 * <IOSStatusProvider sessions={sessions} activeSessionId={activeSessionId}>
 *   <SessionList />
 *   <MainPanel />
 * </IOSStatusProvider>
 */
export function IOSStatusProvider({
  children,
  sessions,
  activeSessionId,
  pollingInterval = 5000,
}: IOSStatusProviderProps) {
  const [iosStatusMap, setIOSStatusMap] = useState<Map<string, IOSStatusData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Track which sessions have iOS enabled
  const enabledSessionsRef = useRef<Set<string>>(new Set());

  // Store last action results persistently
  const lastActionsRef = useRef<Map<string, IOSLastActionResult>>(new Map());

  // Polling state
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Enable iOS status tracking for a session
   */
  const enableIOSForSession = useCallback((sessionId: string) => {
    enabledSessionsRef.current.add(sessionId);
  }, []);

  /**
   * Disable iOS status tracking for a session
   */
  const disableIOSForSession = useCallback((sessionId: string) => {
    enabledSessionsRef.current.delete(sessionId);
    setIOSStatusMap(prev => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  /**
   * Record a last action result for a session
   */
  const recordAction = useCallback((
    sessionId: string,
    action: string,
    success: boolean,
    message?: string,
    errorCode?: string
  ) => {
    const result: IOSLastActionResult = {
      success,
      timestamp: Date.now(),
      action,
      message,
      errorCode,
    };

    lastActionsRef.current.set(sessionId, result);

    // Update the status map immediately with the new action
    setIOSStatusMap(prev => {
      const current = prev.get(sessionId);
      if (current) {
        const next = new Map(prev);
        next.set(sessionId, {
          ...current,
          lastActionResult: result,
          lastUpdate: Date.now(),
        });
        return next;
      }
      return prev;
    });
  }, []);

  /**
   * Check if a session has iOS features enabled
   */
  const isIOSEnabled = useCallback((sessionId: string) => {
    return enabledSessionsRef.current.has(sessionId);
  }, []);

  /**
   * Get the iOS status for a specific session
   */
  const getStatus = useCallback((sessionId: string) => {
    return iosStatusMap.get(sessionId);
  }, [iosStatusMap]);

  /**
   * Refresh iOS status for all enabled sessions
   */
  const refreshIOSStatus = useCallback(async () => {
    const enabledSessions = Array.from(enabledSessionsRef.current);
    if (enabledSessions.length === 0) return;

    setIsLoading(true);

    try {
      // Get the list of booted simulators
      // Note: window.maestro.ios has more APIs than typed in global.d.ts
      // Cast to any to access the full API from preload.ts
      const iosApi = window.maestro.ios as any;
      const bootedSimulatorsResult = await iosApi.simulator?.booted();
      const bootedSimulators = bootedSimulatorsResult?.data || [];

      // Get the first booted simulator (primary)
      const primarySimulator = bootedSimulators[0];

      // Build status for each enabled session
      const newStatusMap = new Map<string, IOSStatusData>();

      for (const sessionId of enabledSessions) {
        let simulatorStatus: IOSSimulatorStatus = 'unknown';
        let simulatorName: string | undefined;
        let simulatorUdid: string | undefined;
        let bridgeConnected = false;
        let bridgePort: number | undefined;

        if (primarySimulator) {
          simulatorStatus = parseSimulatorState(primarySimulator.state);
          simulatorName = primarySimulator.name;
          simulatorUdid = primarySimulator.udid;

          // Check bridge connection (only for active session to reduce overhead)
          if (sessionId === activeSessionId) {
            try {
              const pingResult = await iosApi.bridge?.ping();
              bridgeConnected = pingResult?.success || false;
              if (bridgeConnected && pingResult?.data) {
                bridgePort = 9876; // Default MaestroBridge port
              }
            } catch {
              bridgeConnected = false;
            }
          }
        } else {
          simulatorStatus = 'shutdown';
        }

        // Get last action result from ref
        const lastActionResult = lastActionsRef.current.get(sessionId);

        newStatusMap.set(sessionId, {
          sessionId,
          simulatorStatus,
          simulatorName,
          simulatorUdid,
          appStatus: 'unknown', // App status requires more complex tracking
          bridgeConnected,
          bridgePort,
          lastActionResult,
          lastUpdate: Date.now(),
          enabled: true,
        });
      }

      setIOSStatusMap(newStatusMap);
    } catch (error) {
      console.error('Error refreshing iOS status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId]);

  // Set up polling
  useEffect(() => {
    // Initial fetch
    refreshIOSStatus();

    // Start polling
    pollingRef.current = setInterval(refreshIOSStatus, pollingInterval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [refreshIOSStatus, pollingInterval]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<IOSStatusContextValue>(() => ({
    iosStatusMap,
    refreshIOSStatus,
    isLoading,
    getStatus,
    recordAction,
    isIOSEnabled,
    enableIOSForSession,
    disableIOSForSession,
  }), [
    iosStatusMap,
    refreshIOSStatus,
    isLoading,
    getStatus,
    recordAction,
    isIOSEnabled,
    enableIOSForSession,
    disableIOSForSession,
  ]);

  return (
    <IOSStatusContext.Provider value={contextValue}>
      {children}
    </IOSStatusContext.Provider>
  );
}

/**
 * useIOSStatus - Hook to access the iOS status context.
 *
 * Must be used within an IOSStatusProvider. Throws an error if used outside.
 *
 * @returns IOSStatusContextValue - iOS status data and control functions
 *
 * @example
 * const { getStatus, recordAction, enableIOSForSession } = useIOSStatus();
 *
 * // Enable iOS tracking for a session when they use an iOS command
 * enableIOSForSession(sessionId);
 *
 * // Get status for a session
 * const status = getStatus(sessionId);
 * if (status?.simulatorStatus === 'booted') {
 *   // Render iOS status indicator
 * }
 *
 * // Record an action result
 * recordAction(sessionId, 'snapshot', true, 'Screenshot captured');
 */
export function useIOSStatus(): IOSStatusContextValue {
  const context = useContext(IOSStatusContext);

  if (!context) {
    throw new Error('useIOSStatus must be used within an IOSStatusProvider');
  }

  return context;
}

/**
 * useIOSStatusOptional - Hook to access the iOS status context without throwing.
 * Returns null if used outside an IOSStatusProvider.
 *
 * Useful for components that may render before the provider is mounted.
 */
export function useIOSStatusOptional(): IOSStatusContextValue | null {
  return useContext(IOSStatusContext);
}

// Re-export types for convenience
export type { IOSStatus, IOSSimulatorStatus, IOSAppStatus, IOSLastActionResult };
