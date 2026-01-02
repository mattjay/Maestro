import React from 'react';
import { FilePlus, Trash2, FileCode, FileText } from 'lucide-react';
import type { Theme, SessionState, FileChangeType, IOSSimulatorStatus, IOSAppStatus } from '../types';

// Re-export formatActiveTime from formatters for backwards compatibility
export { formatActiveTime } from './formatters';

// Get color based on context usage percentage
export const getContextColor = (usage: number, theme: Theme): string => {
  if (usage >= 80) return theme.colors.error;
  if (usage >= 60) return theme.colors.warning;
  return theme.colors.success;
};

// Get color based on session state
// Status indicator colors:
// - Green: ready and waiting (idle)
// - Yellow: agent is thinking (busy, waiting_input)
// - Red: no connection with agent (error)
// - Pulsing orange: attempting to establish connection (connecting)
export const getStatusColor = (state: SessionState, theme: Theme): string => {
  switch (state) {
    case 'idle': return theme.colors.success;      // Green - ready and waiting
    case 'busy': return theme.colors.warning;      // Yellow - agent is thinking
    case 'waiting_input': return theme.colors.warning; // Yellow - waiting for input
    case 'error': return theme.colors.error;       // Red - no connection
    case 'connecting': return '#ff8800';           // Orange - attempting to connect
    default: return theme.colors.success;
  }
};

// Get file icon based on change type
export const getFileIcon = (type: FileChangeType | undefined, theme: Theme): JSX.Element => {
  switch (type) {
    case 'added': return <FilePlus className="w-3.5 h-3.5" style={{ color: theme.colors.success }} />;
    case 'deleted': return <Trash2 className="w-3.5 h-3.5" style={{ color: theme.colors.error }} />;
    case 'modified': return <FileCode className="w-3.5 h-3.5" style={{ color: theme.colors.warning }} />;
    default: return <FileText className="w-3.5 h-3.5" style={{ color: theme.colors.textDim }} />;
  }
};

// =============================================================================
// iOS Status Colors (Phase 8 DX Polish)
// =============================================================================

/**
 * Get color based on iOS simulator status
 * - Green: Booted (ready to use)
 * - Gray: Shutdown (not running)
 * - Yellow: Booting/ShuttingDown (transitioning)
 * - Red: Unknown (error state)
 */
export const getIOSSimulatorColor = (status: IOSSimulatorStatus, theme: Theme): string => {
  switch (status) {
    case 'booted': return theme.colors.success;      // Green - simulator is ready
    case 'shutdown': return theme.colors.textDim;    // Gray - simulator is off
    case 'booting':
    case 'shutting_down': return theme.colors.warning; // Yellow - transitioning
    case 'unknown':
    default: return theme.colors.error;               // Red - unknown/error state
  }
};

/**
 * Get color based on iOS app status
 * - Green: Running (app is active)
 * - Gray: Stopped (app is not running)
 * - Yellow: Launching/Terminating (transitioning)
 * - Red: Unknown (error state)
 */
export const getIOSAppColor = (status: IOSAppStatus, theme: Theme): string => {
  switch (status) {
    case 'running': return theme.colors.success;      // Green - app is active
    case 'stopped': return theme.colors.textDim;      // Gray - app is not running
    case 'launching':
    case 'terminating': return theme.colors.warning;   // Yellow - transitioning
    case 'unknown':
    default: return theme.colors.error;                // Red - unknown/error state
  }
};

/**
 * Get color based on MaestroBridge connection status
 * - Green: Connected
 * - Red: Disconnected
 */
export const getIOSBridgeColor = (connected: boolean, theme: Theme): string => {
  return connected ? theme.colors.success : theme.colors.error;
};
