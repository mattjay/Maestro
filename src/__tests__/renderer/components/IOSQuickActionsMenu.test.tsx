/**
 * @fileoverview Tests for IOSQuickActionsMenu component
 *
 * IOSQuickActionsMenu provides quick access to common iOS development actions:
 * - Quick Screenshot: Capture current simulator screen
 * - Quick Inspect: View UI element tree
 * - Run Last Flow: Re-run most recent Maestro flow
 * - Restart App: Terminate and relaunch the app
 *
 * The menu shows in the MainPanel header when iOS features are enabled for a session.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IOSQuickActionsMenu } from '../../../renderer/components/IOSQuickActionsMenu';
import type { Theme, Session } from '../../../renderer/types';

// Create a mock theme with all required fields
const mockTheme: Theme = {
  id: 'dracula',
  name: 'Dracula',
  mode: 'dark',
  colors: {
    bgMain: '#1e1e1e',
    bgSidebar: '#252525',
    bgActivity: '#333333',
    textMain: '#ffffff',
    textDim: '#888888',
    border: '#333333',
    accent: '#0066cc',
    accentDim: '#0066cc40',
    accentText: '#0066cc',
    accentForeground: '#ffffff',
    success: '#00aa00',
    warning: '#ffaa00',
    error: '#ff0000',
  },
};

// Create a minimal mock session with all required fields
const mockSession: Session = {
  id: 'test-session-1',
  name: 'Test Session',
  cwd: '/Users/test/project',
  projectRoot: '/Users/test/project',
  fullPath: '/Users/test/project',
  state: 'idle',
  aiPid: 0,
  terminalPid: 0,
  port: 0,
  shellLogs: [],
  aiLogs: [],
  aiTabs: [],
  activeTabId: '',
  closedTabHistory: [],
  toolType: 'claude-code',
  inputMode: 'ai',
  executionQueue: [],
  contextUsage: 0,
  workLog: [],
  isGitRepo: false,
  changedFiles: [],
  fileTree: [],
  fileExplorerExpanded: [],
  fileExplorerScrollPos: 0,
  isLive: false,
  activeTimeMs: 0,
};

describe('IOSQuickActionsMenu', () => {
  const mockOnSendCommand = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering Conditions', () => {
    it('should not render when iOS is disabled', () => {
      const { container } = render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={false}
          onSendCommand={mockOnSendCommand}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when iOS is enabled', () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      expect(screen.getByTitle('iOS Quick Actions')).toBeDefined();
    });

    it('should show "Actions" label in full mode', () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
          compact={false}
        />
      );

      expect(screen.getByText('Actions')).toBeDefined();
    });

    it('should hide "Actions" label in compact mode', () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
          compact={true}
        />
      );

      expect(screen.queryByText('Actions')).toBeNull();
    });
  });

  describe('Menu Interaction', () => {
    it('should open menu when button is clicked', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      const button = screen.getByTitle('iOS Quick Actions');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('iOS Quick Actions')).toBeDefined();
      });
    });

    it('should show all 4 quick actions in menu', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      const button = screen.getByTitle('iOS Quick Actions');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Quick Screenshot')).toBeDefined();
        expect(screen.getByText('Quick Inspect')).toBeDefined();
        expect(screen.getByText('Run Last Flow')).toBeDefined();
        expect(screen.getByText('Restart App')).toBeDefined();
      });
    });

    it('should close menu when clicking outside', async () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <IOSQuickActionsMenu
            session={mockSession}
            theme={mockTheme}
            simulatorStatus="booted"
            appStatus="running"
            iosEnabled={true}
            onSendCommand={mockOnSendCommand}
          />
        </div>
      );

      const button = screen.getByTitle('iOS Quick Actions');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Quick Screenshot')).toBeDefined();
      });

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByText('Quick Screenshot')).toBeNull();
      });
    });
  });

  describe('Action Execution', () => {
    it('should execute screenshot command when clicked', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      // Open menu
      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Quick Screenshot')).toBeDefined();
      });

      // Click screenshot action
      fireEvent.click(screen.getByText('Quick Screenshot'));

      expect(mockOnSendCommand).toHaveBeenCalledWith('/ios.snapshot');
    });

    it('should execute inspect command when clicked', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Quick Inspect')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Quick Inspect'));

      expect(mockOnSendCommand).toHaveBeenCalledWith('/ios.inspect');
    });

    it('should execute run flow command when clicked', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Run Last Flow')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Run Last Flow'));

      expect(mockOnSendCommand).toHaveBeenCalledWith('/ios.run_flow --last');
    });

    it('should execute restart app command when clicked', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Restart App')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Restart App'));

      expect(mockOnSendCommand).toHaveBeenCalledWith('/ios.app.restart');
    });
  });

  describe('Action Availability', () => {
    it('should disable all actions when simulator is shutdown', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="shutdown"
          appStatus="stopped"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Quick Screenshot')).toBeDefined();
      });

      // Find all action buttons and check they're disabled
      const screenshotButton = screen.getByText('Quick Screenshot').closest('button');
      const inspectButton = screen.getByText('Quick Inspect').closest('button');
      const runFlowButton = screen.getByText('Run Last Flow').closest('button');
      const restartButton = screen.getByText('Restart App').closest('button');

      expect(screenshotButton?.disabled).toBe(true);
      expect(inspectButton?.disabled).toBe(true);
      expect(runFlowButton?.disabled).toBe(true);
      expect(restartButton?.disabled).toBe(true);
    });

    it('should disable restart app when app is not running', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="stopped"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Restart App')).toBeDefined();
      });

      // Restart should be disabled, others enabled
      const screenshotButton = screen.getByText('Quick Screenshot').closest('button');
      const inspectButton = screen.getByText('Quick Inspect').closest('button');
      const runFlowButton = screen.getByText('Run Last Flow').closest('button');
      const restartButton = screen.getByText('Restart App').closest('button');

      expect(screenshotButton?.disabled).toBe(false);
      expect(inspectButton?.disabled).toBe(false);
      expect(runFlowButton?.disabled).toBe(false);
      expect(restartButton?.disabled).toBe(true);
    });

    it('should enable all actions when simulator is booted and app is running', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Quick Screenshot')).toBeDefined();
      });

      const screenshotButton = screen.getByText('Quick Screenshot').closest('button');
      const inspectButton = screen.getByText('Quick Inspect').closest('button');
      const runFlowButton = screen.getByText('Run Last Flow').closest('button');
      const restartButton = screen.getByText('Restart App').closest('button');

      expect(screenshotButton?.disabled).toBe(false);
      expect(inspectButton?.disabled).toBe(false);
      expect(runFlowButton?.disabled).toBe(false);
      expect(restartButton?.disabled).toBe(false);
    });

    it('should not call onSendCommand for disabled actions', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="shutdown"
          appStatus="stopped"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Quick Screenshot')).toBeDefined();
      });

      // Try to click a disabled action
      const screenshotButton = screen.getByText('Quick Screenshot').closest('button');
      fireEvent.click(screenshotButton!);

      expect(mockOnSendCommand).not.toHaveBeenCalled();
    });
  });

  describe('Visual Feedback', () => {
    it('should show hint to boot simulator when simulator is shutdown', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="shutdown"
          appStatus="stopped"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Boot a simulator to use quick actions')).toBeDefined();
      });
    });

    it('should not show boot hint when simulator is booted', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Quick Screenshot')).toBeDefined();
      });

      expect(screen.queryByText('Boot a simulator to use quick actions')).toBeNull();
    });

    it('should show unavailable reason in description for disabled actions', async () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="stopped"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      fireEvent.click(screen.getByTitle('iOS Quick Actions'));

      await waitFor(() => {
        expect(screen.getByText('Requires a running app')).toBeDefined();
      });
    });
  });

  describe('Simulator Status States', () => {
    it('should handle booting state', () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booting"
          appStatus="unknown"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      // Button should still render
      expect(screen.getByTitle('iOS Quick Actions')).toBeDefined();
    });

    it('should handle shutting_down state', () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="shutting_down"
          appStatus="unknown"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      // Button should still render
      expect(screen.getByTitle('iOS Quick Actions')).toBeDefined();
    });

    it('should handle unknown state', () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="unknown"
          appStatus="unknown"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      // Button should still render
      expect(screen.getByTitle('iOS Quick Actions')).toBeDefined();
    });
  });

  describe('Data Tour Attribute', () => {
    it('should have data-tour attribute for onboarding', () => {
      render(
        <IOSQuickActionsMenu
          session={mockSession}
          theme={mockTheme}
          simulatorStatus="booted"
          appStatus="running"
          iosEnabled={true}
          onSendCommand={mockOnSendCommand}
        />
      );

      const button = screen.getByTitle('iOS Quick Actions');
      expect(button.getAttribute('data-tour')).toBe('ios-quick-actions');
    });
  });
});
