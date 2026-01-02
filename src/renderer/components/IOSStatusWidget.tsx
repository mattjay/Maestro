import { useState, useRef, useEffect } from 'react';
import { Smartphone, Wifi, WifiOff, CheckCircle, XCircle, Loader2, Power, Activity } from 'lucide-react';
import type { Theme, IOSSimulatorStatus, IOSAppStatus, IOSLastActionResult } from '../types';
import { getIOSSimulatorColor, getIOSAppColor, getIOSBridgeColor } from '../utils/theme';

interface IOSStatusWidgetProps {
  /** Session ID for context */
  sessionId: string;
  /** iOS simulator status */
  simulatorStatus: IOSSimulatorStatus;
  /** Simulator name (e.g., "iPhone 15 Pro") */
  simulatorName?: string;
  /** App status */
  appStatus: IOSAppStatus;
  /** App bundle ID */
  appBundleId?: string;
  /** Bridge connected status */
  bridgeConnected: boolean;
  /** Bridge port if connected */
  bridgePort?: number;
  /** Last action result */
  lastActionResult?: IOSLastActionResult;
  /** Theme for styling */
  theme: Theme;
  /** Use compact mode - just show status icon */
  compact?: boolean;
  /** Callback when widget is clicked */
  onClick?: () => void;
}

/**
 * Get simulator status label
 */
function getSimulatorStatusLabel(status: IOSSimulatorStatus): string {
  switch (status) {
    case 'booted': return 'Running';
    case 'shutdown': return 'Off';
    case 'booting': return 'Starting...';
    case 'shutting_down': return 'Stopping...';
    case 'unknown': return 'Unknown';
  }
}

/**
 * Get app status label
 */
function getAppStatusLabel(status: IOSAppStatus): string {
  switch (status) {
    case 'running': return 'Active';
    case 'stopped': return 'Stopped';
    case 'launching': return 'Launching...';
    case 'terminating': return 'Stopping...';
    case 'unknown': return 'Unknown';
  }
}

/**
 * Format time ago for last action
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * IOSStatusWidget - Displays iOS development status with hover tooltip
 *
 * Similar to GitStatusWidget, shows:
 * - Compact view: Single icon with overall status color
 * - Hover tooltip: Detailed breakdown of simulator, app, bridge, and last action
 *
 * Color coding:
 * - Green: Everything healthy (simulator booted, app running, bridge connected)
 * - Yellow: Transitioning (booting, launching, etc.)
 * - Gray: Inactive (shutdown, stopped, disconnected)
 * - Red: Error or unknown state
 */
export function IOSStatusWidget({
  sessionId,
  simulatorStatus,
  simulatorName,
  appStatus,
  appBundleId,
  bridgeConnected,
  bridgePort,
  lastActionResult,
  theme,
  compact = false,
  onClick,
}: IOSStatusWidgetProps) {
  // Tooltip hover state with timeout for smooth UX
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeout.current) {
        clearTimeout(tooltipTimeout.current);
      }
    };
  }, []);

  // Determine overall status color (most critical status wins)
  const getOverallColor = (): string => {
    // If simulator is not booted, that's the most critical
    if (simulatorStatus === 'shutdown') return theme.colors.textDim;
    if (simulatorStatus === 'booting' || simulatorStatus === 'shutting_down') return theme.colors.warning;
    if (simulatorStatus === 'unknown') return theme.colors.error;

    // If simulator is booted but there's an error in last action
    if (lastActionResult && !lastActionResult.success) {
      const timeSinceAction = Date.now() - lastActionResult.timestamp;
      // Show error color for 30 seconds after failure
      if (timeSinceAction < 30000) return theme.colors.error;
    }

    // Simulator is booted
    return theme.colors.success;
  };

  // Is there any activity happening?
  const isTransitioning = simulatorStatus === 'booting' ||
    simulatorStatus === 'shutting_down' ||
    appStatus === 'launching' ||
    appStatus === 'terminating';

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        if (tooltipTimeout.current) {
          clearTimeout(tooltipTimeout.current);
          tooltipTimeout.current = null;
        }
        setTooltipOpen(true);
      }}
      onMouseLeave={() => {
        tooltipTimeout.current = setTimeout(() => {
          setTooltipOpen(false);
        }, 150);
      }}
    >
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs transition-colors hover:bg-white/5"
        style={{ color: getOverallColor() }}
        title="iOS Development Status"
      >
        {compact ? (
          // Compact mode: just show icon with status
          <div className="relative">
            <Smartphone className={`w-3.5 h-3.5 ${isTransitioning ? 'animate-pulse' : ''}`} />
            {/* Small dot indicator for bridge connection */}
            {simulatorStatus === 'booted' && (
              <div
                className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: getIOSBridgeColor(bridgeConnected, theme) }}
              />
            )}
          </div>
        ) : (
          // Full mode: show icon and short status
          <>
            <Smartphone className={`w-3.5 h-3.5 ${isTransitioning ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-medium uppercase">
              {simulatorStatus === 'booted' ? 'iOS' : 'iOS OFF'}
            </span>
          </>
        )}
      </button>

      {/* Hover tooltip showing detailed status */}
      {tooltipOpen && (
        <>
          {/* Invisible bridge to prevent hover gap */}
          <div
            className="absolute left-0 right-0 h-3 pointer-events-auto"
            style={{ top: '100%' }}
            onMouseEnter={() => {
              if (tooltipTimeout.current) {
                clearTimeout(tooltipTimeout.current);
                tooltipTimeout.current = null;
              }
              setTooltipOpen(true);
            }}
          />
          <div
            className="absolute top-full left-0 mt-2 w-max min-w-[200px] max-w-[280px] rounded shadow-xl z-[100] pointer-events-auto"
            style={{
              backgroundColor: theme.colors.bgSidebar,
              border: `1px solid ${theme.colors.border}`
            }}
            onMouseEnter={() => {
              if (tooltipTimeout.current) {
                clearTimeout(tooltipTimeout.current);
                tooltipTimeout.current = null;
              }
              setTooltipOpen(true);
            }}
            onMouseLeave={() => {
              tooltipTimeout.current = setTimeout(() => {
                setTooltipOpen(false);
              }, 150);
            }}
          >
            {/* Header */}
            <div
              className="text-[10px] uppercase font-bold p-3 border-b flex items-center gap-2"
              style={{
                color: theme.colors.textDim,
                borderColor: theme.colors.border
              }}
            >
              <Smartphone className="w-3.5 h-3.5" />
              iOS Development Status
            </div>

            {/* Status items */}
            <div className="p-3 space-y-2.5">
              {/* Simulator Status */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Power
                    className="w-3.5 h-3.5"
                    style={{ color: getIOSSimulatorColor(simulatorStatus, theme) }}
                  />
                  <span className="text-xs" style={{ color: theme.colors.textMain }}>
                    Simulator
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px]"
                    style={{ color: getIOSSimulatorColor(simulatorStatus, theme) }}
                  >
                    {getSimulatorStatusLabel(simulatorStatus)}
                  </span>
                  {(simulatorStatus === 'booting' || simulatorStatus === 'shutting_down') && (
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: theme.colors.warning }} />
                  )}
                </div>
              </div>

              {/* Simulator Name (if booted) */}
              {simulatorName && simulatorStatus === 'booted' && (
                <div
                  className="pl-5.5 text-[10px]"
                  style={{ color: theme.colors.textDim, paddingLeft: '22px' }}
                >
                  {simulatorName}
                </div>
              )}

              {/* App Status (only show if simulator is booted) */}
              {simulatorStatus === 'booted' && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity
                      className="w-3.5 h-3.5"
                      style={{ color: getIOSAppColor(appStatus, theme) }}
                    />
                    <span className="text-xs" style={{ color: theme.colors.textMain }}>
                      App
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px]"
                      style={{ color: getIOSAppColor(appStatus, theme) }}
                    >
                      {getAppStatusLabel(appStatus)}
                    </span>
                    {(appStatus === 'launching' || appStatus === 'terminating') && (
                      <Loader2 className="w-3 h-3 animate-spin" style={{ color: theme.colors.warning }} />
                    )}
                  </div>
                </div>
              )}

              {/* Bundle ID (if app is running) */}
              {appBundleId && appStatus === 'running' && (
                <div
                  className="pl-5.5 text-[10px] truncate"
                  style={{ color: theme.colors.textDim, paddingLeft: '22px' }}
                  title={appBundleId}
                >
                  {appBundleId}
                </div>
              )}

              {/* Bridge Status (only show if simulator is booted) */}
              {simulatorStatus === 'booted' && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {bridgeConnected ? (
                      <Wifi className="w-3.5 h-3.5" style={{ color: theme.colors.success }} />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5" style={{ color: theme.colors.error }} />
                    )}
                    <span className="text-xs" style={{ color: theme.colors.textMain }}>
                      Bridge
                    </span>
                  </div>
                  <span
                    className="text-[10px]"
                    style={{ color: getIOSBridgeColor(bridgeConnected, theme) }}
                  >
                    {bridgeConnected ? (bridgePort ? `Port ${bridgePort}` : 'Connected') : 'Disconnected'}
                  </span>
                </div>
              )}

              {/* Last Action Result */}
              {lastActionResult && (
                <>
                  <div
                    className="border-t pt-2.5 mt-2.5"
                    style={{ borderColor: theme.colors.border }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {lastActionResult.success ? (
                          <CheckCircle className="w-3.5 h-3.5" style={{ color: theme.colors.success }} />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" style={{ color: theme.colors.error }} />
                        )}
                        <span className="text-xs" style={{ color: theme.colors.textMain }}>
                          {lastActionResult.action}
                        </span>
                      </div>
                      <span
                        className="text-[10px]"
                        style={{ color: theme.colors.textDim }}
                      >
                        {formatTimeAgo(lastActionResult.timestamp)}
                      </span>
                    </div>
                    {lastActionResult.message && (
                      <div
                        className="pl-5.5 text-[10px] mt-1 truncate"
                        style={{
                          color: lastActionResult.success ? theme.colors.textDim : theme.colors.error,
                          paddingLeft: '22px'
                        }}
                        title={lastActionResult.message}
                      >
                        {lastActionResult.message}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer hint */}
            <div
              className="px-3 py-2 border-t text-[10px] text-center"
              style={{
                borderColor: theme.colors.border,
                color: theme.colors.textDim
              }}
            >
              Run /ios.setup to configure
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default IOSStatusWidget;
