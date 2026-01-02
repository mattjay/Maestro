/**
 * @fileoverview Tests for IOSStatusWidget component
 *
 * IOSStatusWidget displays iOS development status indicators including:
 * - Simulator status (booted/shutdown/booting/shutting_down)
 * - App status (running/stopped/launching/terminating)
 * - MaestroBridge connection status
 * - Last action result (success/failure with timestamp)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IOSStatusWidget } from '../../../renderer/components/IOSStatusWidget';
import type { Theme, IOSSimulatorStatus, IOSAppStatus, IOSLastActionResult } from '../../../renderer/types';

// Create a mock theme
const mockTheme: Theme = {
  id: 'test-theme',
  name: 'Test Theme',
  colors: {
    bgMain: '#1a1a2e',
    bgSidebar: '#16213e',
    bgInput: '#0f3460',
    bgActivity: '#1e1e3f',
    textMain: '#eaeaea',
    textDim: '#a0a0a0',
    border: '#2a2a4a',
    accent: '#e94560',
    success: '#4ecdc4',
    warning: '#ffc107',
    error: '#ff6b6b',
    scrollbarThumb: '#444',
    scrollbarTrack: '#222',
    syntax1: '#ff6b6b',
    syntax2: '#4ecdc4',
    syntax3: '#45b7d1',
    syntax4: '#96ceb4',
  },
};

describe('IOSStatusWidget', () => {
  const mockOnClick = vi.fn();

  const defaultProps = {
    sessionId: 'test-session-id',
    simulatorStatus: 'booted' as IOSSimulatorStatus,
    simulatorName: 'iPhone 15 Pro',
    appStatus: 'running' as IOSAppStatus,
    appBundleId: 'com.example.app',
    bridgeConnected: true,
    bridgePort: 9876,
    lastActionResult: undefined as IOSLastActionResult | undefined,
    theme: mockTheme,
    onClick: mockOnClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Rendering', () => {
    it('should render the widget', () => {
      render(<IOSStatusWidget {...defaultProps} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render with compact mode', () => {
      render(<IOSStatusWidget {...defaultProps} compact />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // In compact mode, should not show "iOS" text label
      expect(button.textContent).not.toContain('iOS');
    });

    it('should render with full mode (non-compact)', () => {
      render(<IOSStatusWidget {...defaultProps} compact={false} />);
      expect(screen.getByText('iOS')).toBeInTheDocument();
    });

    it('should show "iOS OFF" when simulator is shutdown', () => {
      render(
        <IOSStatusWidget {...defaultProps} simulatorStatus="shutdown" compact={false} />
      );
      expect(screen.getByText('iOS OFF')).toBeInTheDocument();
    });
  });

  describe('Simulator Status Colors', () => {
    it('should use success color when simulator is booted', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="booted" />);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ color: mockTheme.colors.success });
    });

    it('should use textDim color when simulator is shutdown', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="shutdown" />);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ color: mockTheme.colors.textDim });
    });

    it('should use warning color when simulator is booting', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="booting" />);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ color: mockTheme.colors.warning });
    });

    it('should use warning color when simulator is shutting down', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="shutting_down" />);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ color: mockTheme.colors.warning });
    });

    it('should use error color when simulator status is unknown', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="unknown" />);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ color: mockTheme.colors.error });
    });
  });

  describe('Last Action Result Affects Color', () => {
    it('should show error color briefly after failed action', () => {
      const recentFailure: IOSLastActionResult = {
        success: false,
        timestamp: Date.now() - 5000, // 5 seconds ago
        action: 'tap',
        message: 'Element not found',
        errorCode: 'ELEMENT_NOT_FOUND',
      };
      render(
        <IOSStatusWidget
          {...defaultProps}
          simulatorStatus="booted"
          lastActionResult={recentFailure}
        />
      );
      const button = screen.getByRole('button');
      // Should show error color because failure was within 30 seconds
      expect(button).toHaveStyle({ color: mockTheme.colors.error });
    });

    it('should return to success color after 30 seconds since failure', () => {
      const oldFailure: IOSLastActionResult = {
        success: false,
        timestamp: Date.now() - 60000, // 60 seconds ago
        action: 'tap',
        message: 'Element not found',
      };
      render(
        <IOSStatusWidget
          {...defaultProps}
          simulatorStatus="booted"
          lastActionResult={oldFailure}
        />
      );
      const button = screen.getByRole('button');
      // Should show success color because failure was over 30 seconds ago
      expect(button).toHaveStyle({ color: mockTheme.colors.success });
    });
  });

  describe('Tooltip Behavior', () => {
    it('should show tooltip on mouse enter', () => {
      render(<IOSStatusWidget {...defaultProps} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('iOS Development Status')).toBeInTheDocument();
    });

    it('should hide tooltip on mouse leave after delay', () => {
      vi.useFakeTimers();
      render(<IOSStatusWidget {...defaultProps} />);
      const container = screen.getByRole('button').parentElement!;

      fireEvent.mouseEnter(container);
      expect(screen.getByText('iOS Development Status')).toBeInTheDocument();

      fireEvent.mouseLeave(container);
      act(() => {
        vi.advanceTimersByTime(200); // 150ms delay + buffer
      });
      expect(screen.queryByText('iOS Development Status')).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it('should keep tooltip open when moving to tooltip content', () => {
      vi.useFakeTimers();
      render(<IOSStatusWidget {...defaultProps} />);
      const container = screen.getByRole('button').parentElement!;

      fireEvent.mouseEnter(container);
      expect(screen.getByText('iOS Development Status')).toBeInTheDocument();

      fireEvent.mouseLeave(container);
      vi.advanceTimersByTime(50);

      const tooltip = screen.getByText('iOS Development Status').closest('div');
      fireEvent.mouseEnter(tooltip!);
      vi.advanceTimersByTime(150);
      expect(screen.getByText('iOS Development Status')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('Tooltip Content - Simulator Status', () => {
    it('should show simulator status label', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="booted" />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('should show "Off" for shutdown simulator', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="shutdown" />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Off')).toBeInTheDocument();
    });

    it('should show "Starting..." for booting simulator', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="booting" />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });

    it('should show "Stopping..." for shutting_down simulator', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="shutting_down" />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Stopping...')).toBeInTheDocument();
    });

    it('should show simulator name when booted', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorName="iPhone 15 Pro" />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument();
    });

    it('should not show simulator name when shutdown', () => {
      render(
        <IOSStatusWidget
          {...defaultProps}
          simulatorStatus="shutdown"
          simulatorName="iPhone 15 Pro"
        />
      );
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.queryByText('iPhone 15 Pro')).not.toBeInTheDocument();
    });
  });

  describe('Tooltip Content - App Status', () => {
    it('should show app status only when simulator is booted', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="booted" appStatus="running" />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('App')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should not show app status when simulator is shutdown', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="shutdown" appStatus="running" />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });

    it('should show "Stopped" for stopped app', () => {
      render(<IOSStatusWidget {...defaultProps} appStatus="stopped" />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Stopped')).toBeInTheDocument();
    });

    it('should show "Launching..." for launching app', () => {
      render(<IOSStatusWidget {...defaultProps} appStatus="launching" />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Launching...')).toBeInTheDocument();
    });

    it('should show bundle ID when app is running', () => {
      render(
        <IOSStatusWidget
          {...defaultProps}
          appStatus="running"
          appBundleId="com.example.myapp"
        />
      );
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('com.example.myapp')).toBeInTheDocument();
    });
  });

  describe('Tooltip Content - Bridge Status', () => {
    it('should show bridge status when simulator is booted', () => {
      render(<IOSStatusWidget {...defaultProps} bridgeConnected={true} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Bridge')).toBeInTheDocument();
    });

    it('should not show bridge status when simulator is shutdown', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="shutdown" />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.queryByText('Bridge')).not.toBeInTheDocument();
    });

    it('should show port when bridge is connected', () => {
      render(<IOSStatusWidget {...defaultProps} bridgeConnected={true} bridgePort={9876} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Port 9876')).toBeInTheDocument();
    });

    it('should show "Connected" when bridge is connected without port', () => {
      render(<IOSStatusWidget {...defaultProps} bridgeConnected={true} bridgePort={undefined} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should show "Disconnected" when bridge is not connected', () => {
      render(<IOSStatusWidget {...defaultProps} bridgeConnected={false} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  describe('Tooltip Content - Last Action Result', () => {
    it('should show last action result', () => {
      const lastAction: IOSLastActionResult = {
        success: true,
        timestamp: Date.now() - 5000,
        action: 'snapshot',
        message: 'Screenshot captured',
      };
      render(<IOSStatusWidget {...defaultProps} lastActionResult={lastAction} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('snapshot')).toBeInTheDocument();
      expect(screen.getByText('Screenshot captured')).toBeInTheDocument();
    });

    it('should show "just now" for very recent actions', () => {
      const recentAction: IOSLastActionResult = {
        success: true,
        timestamp: Date.now() - 30000, // 30 seconds ago
        action: 'tap',
      };
      render(<IOSStatusWidget {...defaultProps} lastActionResult={recentAction} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('just now')).toBeInTheDocument();
    });

    it('should show minutes ago for older actions', () => {
      const olderAction: IOSLastActionResult = {
        success: true,
        timestamp: Date.now() - 180000, // 3 minutes ago
        action: 'type',
      };
      render(<IOSStatusWidget {...defaultProps} lastActionResult={olderAction} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('3m ago')).toBeInTheDocument();
    });

    it('should show error styling for failed actions', () => {
      const failedAction: IOSLastActionResult = {
        success: false,
        timestamp: Date.now() - 5000,
        action: 'tap',
        message: 'Element not found',
        errorCode: 'ELEMENT_NOT_FOUND',
      };
      render(<IOSStatusWidget {...defaultProps} lastActionResult={failedAction} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      // Message should be styled with error color for failed actions
      const message = screen.getByText('Element not found');
      expect(message).toHaveStyle({ color: mockTheme.colors.error });
    });
  });

  describe('Click Handler', () => {
    it('should call onClick when button is clicked', () => {
      render(<IOSStatusWidget {...defaultProps} onClick={mockOnClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not throw when onClick is not provided', () => {
      render(<IOSStatusWidget {...defaultProps} onClick={undefined} />);
      expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
    });
  });

  describe('Pulsing Animation', () => {
    it('should add animate-pulse class when simulator is booting', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="booting" />);
      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      // SVG className is SVGAnimatedString, need to check baseVal
      const className = icon?.getAttribute('class') || icon?.className?.baseVal || '';
      expect(className).toContain('animate-pulse');
    });

    it('should add animate-pulse class when simulator is shutting down', () => {
      render(<IOSStatusWidget {...defaultProps} simulatorStatus="shutting_down" />);
      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      const className = icon?.getAttribute('class') || icon?.className?.baseVal || '';
      expect(className).toContain('animate-pulse');
    });

    it('should add animate-pulse class when app is launching', () => {
      render(<IOSStatusWidget {...defaultProps} appStatus="launching" />);
      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      const className = icon?.getAttribute('class') || icon?.className?.baseVal || '';
      expect(className).toContain('animate-pulse');
    });

    it('should not add animate-pulse class when everything is stable', () => {
      render(
        <IOSStatusWidget
          {...defaultProps}
          simulatorStatus="booted"
          appStatus="running"
        />
      );
      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      const className = icon?.getAttribute('class') || icon?.className?.baseVal || '';
      expect(className).not.toContain('animate-pulse');
    });
  });

  describe('Footer Hint', () => {
    it('should show setup hint in tooltip footer', () => {
      render(<IOSStatusWidget {...defaultProps} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);
      expect(screen.getByText('Run /ios.setup to configure')).toBeInTheDocument();
    });
  });

  describe('Theme Styling', () => {
    it('should apply theme colors to tooltip background', () => {
      render(<IOSStatusWidget {...defaultProps} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);

      const tooltip = screen.getByText('iOS Development Status').closest('div')!.parentElement;
      expect(tooltip).toHaveStyle({ backgroundColor: mockTheme.colors.bgSidebar });
    });

    it('should apply theme border colors', () => {
      render(<IOSStatusWidget {...defaultProps} />);
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);

      const tooltip = screen.getByText('iOS Development Status').closest('div')!.parentElement;
      expect(tooltip).toHaveStyle({ borderColor: mockTheme.colors.border });
    });
  });

  describe('Accessibility', () => {
    it('should have title attribute for screen readers', () => {
      render(<IOSStatusWidget {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'iOS Development Status');
    });

    it('should have title on bundle ID for truncated text', () => {
      const longBundleId = 'com.example.very.long.bundle.identifier.app';
      render(
        <IOSStatusWidget
          {...defaultProps}
          appStatus="running"
          appBundleId={longBundleId}
        />
      );
      const container = screen.getByRole('button').parentElement!;
      fireEvent.mouseEnter(container);

      const bundleIdElement = screen.getByText(longBundleId);
      expect(bundleIdElement).toHaveAttribute('title', longBundleId);
    });
  });

  describe('Compact Mode Bridge Indicator', () => {
    it('should show bridge indicator dot in compact mode when booted', () => {
      const { container } = render(
        <IOSStatusWidget
          {...defaultProps}
          compact
          simulatorStatus="booted"
          bridgeConnected={true}
        />
      );
      // The bridge indicator dot should be visible
      const dot = container.querySelector('.rounded-full.w-1\\.5.h-1\\.5');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveStyle({ backgroundColor: mockTheme.colors.success });
    });

    it('should show disconnected bridge indicator in compact mode', () => {
      const { container } = render(
        <IOSStatusWidget
          {...defaultProps}
          compact
          simulatorStatus="booted"
          bridgeConnected={false}
        />
      );
      const dot = container.querySelector('.rounded-full.w-1\\.5.h-1\\.5');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveStyle({ backgroundColor: mockTheme.colors.error });
    });

    it('should not show bridge indicator when simulator is shutdown', () => {
      const { container } = render(
        <IOSStatusWidget
          {...defaultProps}
          compact
          simulatorStatus="shutdown"
          bridgeConnected={true}
        />
      );
      const dot = container.querySelector('.rounded-full.w-1\\.5.h-1\\.5');
      expect(dot).not.toBeInTheDocument();
    });
  });
});
