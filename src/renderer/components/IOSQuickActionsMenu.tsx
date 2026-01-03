import { useState, useRef, useEffect } from 'react';
import { Camera, Search, Play, RotateCcw, Smartphone, ChevronDown, Loader2 } from 'lucide-react';
import type { Theme, Session } from '../types';

/**
 * Quick action definition for iOS toolbar
 */
interface IOSQuickAction {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
  command: string;
  /** Whether this action requires a booted simulator */
  requiresSimulator?: boolean;
  /** Whether this action requires a running app */
  requiresApp?: boolean;
}

/**
 * iOS Quick Actions - 4 essential actions for iOS development
 */
const IOS_QUICK_ACTIONS: IOSQuickAction[] = [
  {
    id: 'screenshot',
    label: 'Quick Screenshot',
    shortLabel: 'Screenshot',
    icon: Camera,
    description: 'Capture the current simulator screen',
    command: '/ios.snapshot',
    requiresSimulator: true,
  },
  {
    id: 'inspect',
    label: 'Quick Inspect',
    shortLabel: 'Inspect',
    icon: Search,
    description: 'View the UI element tree',
    command: '/ios.inspect',
    requiresSimulator: true,
  },
  {
    id: 'run-flow',
    label: 'Run Last Flow',
    shortLabel: 'Run Flow',
    icon: Play,
    description: 'Run the most recently executed flow',
    command: '/ios.run_flow --last',
    requiresSimulator: true,
  },
  {
    id: 'restart-app',
    label: 'Restart App',
    shortLabel: 'Restart',
    icon: RotateCcw,
    description: 'Terminate and relaunch the app',
    command: '/ios.app.restart',
    requiresSimulator: true,
    requiresApp: true,
  },
];

interface IOSQuickActionsMenuProps {
  /** The current session */
  session: Session;
  /** Theme for styling */
  theme: Theme;
  /** Simulator status */
  simulatorStatus: 'booted' | 'shutdown' | 'booting' | 'shutting_down' | 'unknown';
  /** App status */
  appStatus: 'running' | 'stopped' | 'launching' | 'terminating' | 'unknown';
  /** Whether iOS features are enabled for this session */
  iosEnabled: boolean;
  /** Callback to send a command to the AI terminal */
  onSendCommand: (command: string) => void;
  /** Use compact mode - just show icon */
  compact?: boolean;
}

/**
 * IOSQuickActionsMenu - A toolbar button with dropdown for iOS quick actions
 *
 * Provides rapid access to 4 essential iOS development actions:
 * - Quick Screenshot: Capture current simulator screen
 * - Quick Inspect: View UI element tree
 * - Run Last Flow: Re-run most recent Maestro flow
 * - Restart App: Terminate and relaunch the app
 *
 * The menu shows visual feedback for action availability based on
 * simulator and app status.
 */
export function IOSQuickActionsMenu({
  session,
  theme,
  simulatorStatus,
  appStatus,
  iosEnabled,
  onSendCommand,
  compact = false,
}: IOSQuickActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Don't render if iOS is not enabled
  if (!iosEnabled) {
    return null;
  }

  const isSimulatorBooted = simulatorStatus === 'booted';
  const isAppRunning = appStatus === 'running';
  const isTransitioning = simulatorStatus === 'booting' || simulatorStatus === 'shutting_down' ||
                         appStatus === 'launching' || appStatus === 'terminating';

  /**
   * Check if an action is available based on current state
   */
  function isActionAvailable(action: IOSQuickAction): boolean {
    if (action.requiresSimulator && !isSimulatorBooted) return false;
    if (action.requiresApp && !isAppRunning) return false;
    return true;
  }

  /**
   * Get tooltip for unavailable action
   */
  function getUnavailableReason(action: IOSQuickAction): string {
    if (action.requiresSimulator && !isSimulatorBooted) {
      return 'Requires a booted simulator';
    }
    if (action.requiresApp && !isAppRunning) {
      return 'Requires a running app';
    }
    return '';
  }

  /**
   * Execute a quick action
   */
  async function handleAction(action: IOSQuickAction) {
    if (!isActionAvailable(action)) return;

    setExecutingAction(action.id);
    setMenuOpen(false);

    try {
      // Send the command to the AI terminal
      onSendCommand(action.command);
    } finally {
      // Clear executing state after a short delay for visual feedback
      setTimeout(() => {
        setExecutingAction(null);
      }, 300);
    }
  }

  // Determine button color based on state
  const getButtonColor = (): string => {
    if (!isSimulatorBooted) return theme.colors.textDim;
    if (isTransitioning) return theme.colors.warning;
    return theme.colors.accent;
  };

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={() => {
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }
      }}
      onMouseLeave={() => {
        closeTimeoutRef.current = setTimeout(() => {
          setMenuOpen(false);
        }, 150);
      }}
    >
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors hover:bg-white/5"
        style={{ color: getButtonColor() }}
        title="iOS Quick Actions"
        data-tour="ios-quick-actions"
      >
        <Smartphone className={`w-3.5 h-3.5 ${isTransitioning ? 'animate-pulse' : ''}`} />
        {!compact && (
          <>
            <span className="text-[10px] font-medium uppercase">Actions</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <>
          {/* Invisible bridge to prevent hover gap */}
          <div
            className="absolute left-0 right-0 h-3 pointer-events-auto"
            style={{ top: '100%' }}
          />
          <div
            className="absolute top-full left-0 mt-2 w-56 rounded-lg shadow-xl z-[100] pointer-events-auto overflow-hidden"
            style={{
              backgroundColor: theme.colors.bgSidebar,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            {/* Header */}
            <div
              className="text-[10px] uppercase font-bold px-3 py-2 border-b flex items-center gap-2"
              style={{
                color: theme.colors.textDim,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.bgMain + '80',
              }}
            >
              <Smartphone className="w-3 h-3" />
              iOS Quick Actions
            </div>

            {/* Actions */}
            <div className="py-1">
              {IOS_QUICK_ACTIONS.map((action) => {
                const available = isActionAvailable(action);
                const isExecuting = executingAction === action.id;
                const Icon = action.icon;
                const unavailableReason = getUnavailableReason(action);

                return (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action)}
                    disabled={!available || isExecuting}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      available && !isExecuting ? 'hover:bg-white/5 cursor-pointer' : 'cursor-not-allowed'
                    }`}
                    style={{
                      opacity: available ? 1 : 0.4,
                    }}
                    title={available ? action.description : unavailableReason}
                  >
                    {/* Icon */}
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: available ? theme.colors.accent + '20' : theme.colors.textDim + '10',
                      }}
                    >
                      {isExecuting ? (
                        <Loader2
                          className="w-3.5 h-3.5 animate-spin"
                          style={{ color: theme.colors.accent }}
                        />
                      ) : (
                        <Icon
                          className="w-3.5 h-3.5"
                          style={{ color: available ? theme.colors.accent : theme.colors.textDim }}
                        />
                      )}
                    </div>

                    {/* Label and description */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs font-medium truncate"
                        style={{ color: available ? theme.colors.textMain : theme.colors.textDim }}
                      >
                        {action.label}
                      </div>
                      <div
                        className="text-[10px] truncate"
                        style={{ color: theme.colors.textDim }}
                      >
                        {available ? action.description : unavailableReason}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer - show setup hint if simulator not booted */}
            {!isSimulatorBooted && (
              <div
                className="px-3 py-2 border-t text-[10px] text-center"
                style={{
                  borderColor: theme.colors.border,
                  color: theme.colors.textDim,
                }}
              >
                Boot a simulator to use quick actions
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default IOSQuickActionsMenu;
