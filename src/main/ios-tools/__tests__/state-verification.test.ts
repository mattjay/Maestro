/**
 * Tests for State Verification Module
 *
 * Tests the ability for agents to confirm that both UI AND internal state
 * have changed after performing actions on iOS apps.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppStateSnapshot,
  StateChanges,
  StateVerificationResult,
  compareStateSnapshots,
  verifyStateChanges,
  formatStateChanges,
  formatVerificationResult,
} from '../state-verification';

// =============================================================================
// Test Fixtures
// =============================================================================

function createBaseSnapshot(): AppStateSnapshot {
  return {
    timestamp: new Date('2024-01-15T10:00:00Z'),
    currentScreen: 'HomeViewController',
    navigationStack: ['RootNavigationController', 'HomeViewController'],
    currentRoute: '/home',
    routeStack: [{ route: '/home', title: 'Home' }],
    customState: {
      user: { isLoggedIn: true, username: 'testuser' },
      cart: { itemCount: 3 },
    },
    featureFlags: {
      darkMode: false,
      newCheckout: { enabled: true, variant: 'A' },
    },
    recentEventNames: ['app_launch', 'home_view'],
    analyticsEventCount: 10,
  };
}

function createChangedSnapshot(): AppStateSnapshot {
  return {
    timestamp: new Date('2024-01-15T10:01:00Z'),
    currentScreen: 'SettingsViewController',
    navigationStack: ['RootNavigationController', 'HomeViewController', 'SettingsViewController'],
    currentRoute: '/settings',
    routeStack: [
      { route: '/home', title: 'Home' },
      { route: '/settings', title: 'Settings' },
    ],
    customState: {
      user: { isLoggedIn: true, username: 'testuser' },
      cart: { itemCount: 5 }, // Changed
      settings: { theme: 'light' }, // Added
    },
    featureFlags: {
      darkMode: true, // Changed
      newCheckout: { enabled: true, variant: 'A' },
    },
    recentEventNames: ['app_launch', 'home_view', 'settings_tap', 'settings_view'],
    analyticsEventCount: 12,
  };
}

// =============================================================================
// Tests: compareStateSnapshots
// =============================================================================

describe('compareStateSnapshots', () => {
  describe('UI changes detection', () => {
    it('should detect screen change', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const changes = compareStateSnapshots(before, after);

      expect(changes.ui.screenChanged).toBe(true);
      expect(changes.ui.previousScreen).toBe('HomeViewController');
      expect(changes.ui.currentScreen).toBe('SettingsViewController');
    });

    it('should detect route change', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const changes = compareStateSnapshots(before, after);

      expect(changes.ui.routeChanged).toBe(true);
      expect(changes.ui.previousRoute).toBe('/home');
      expect(changes.ui.currentRoute).toBe('/settings');
    });

    it('should detect navigation stack change', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const changes = compareStateSnapshots(before, after);

      expect(changes.ui.navigationChanged).toBe(true);
    });

    it('should report no UI changes when state is same', () => {
      const before = createBaseSnapshot();
      const after = { ...createBaseSnapshot(), timestamp: new Date() };

      const changes = compareStateSnapshots(before, after);

      expect(changes.ui.screenChanged).toBe(false);
      expect(changes.ui.routeChanged).toBe(false);
      expect(changes.ui.navigationChanged).toBe(false);
    });
  });

  describe('internal state changes detection', () => {
    it('should detect modified custom state keys', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const changes = compareStateSnapshots(before, after);

      expect(changes.internal.changedKeys).toContain('cart');
    });

    it('should detect added custom state keys', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const changes = compareStateSnapshots(before, after);

      expect(changes.internal.addedKeys).toContain('settings');
    });

    it('should detect removed custom state keys', () => {
      const before = createBaseSnapshot();
      const after: AppStateSnapshot = {
        ...createBaseSnapshot(),
        customState: { user: before.customState.user }, // cart removed
      };

      const changes = compareStateSnapshots(before, after);

      expect(changes.internal.removedKeys).toContain('cart');
    });

    it('should detect changed feature flags', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const changes = compareStateSnapshots(before, after);

      expect(changes.internal.changedFlags).toContain('darkMode');
    });

    it('should build detailed key changes', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const changes = compareStateSnapshots(before, after);

      const cartChange = changes.internal.keyChanges.find(c => c.key === 'cart');
      expect(cartChange).toBeDefined();
      expect(cartChange?.type).toBe('modified');
      expect((cartChange?.oldValue as { itemCount: number })?.itemCount).toBe(3);
      expect((cartChange?.newValue as { itemCount: number })?.itemCount).toBe(5);

      const settingsChange = changes.internal.keyChanges.find(c => c.key === 'settings');
      expect(settingsChange).toBeDefined();
      expect(settingsChange?.type).toBe('added');
    });
  });

  describe('analytics changes detection', () => {
    it('should detect new analytics events', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const changes = compareStateSnapshots(before, after);

      expect(changes.analytics.newEvents).toContain('settings_tap');
      expect(changes.analytics.newEvents).toContain('settings_view');
    });

    it('should calculate event count delta', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const changes = compareStateSnapshots(before, after);

      expect(changes.analytics.eventCountDelta).toBe(2);
    });
  });

  describe('hasChanges flag', () => {
    it('should be true when UI changes', () => {
      const before = createBaseSnapshot();
      const after: AppStateSnapshot = {
        ...before,
        currentScreen: 'OtherViewController',
      };

      const changes = compareStateSnapshots(before, after);

      expect(changes.hasChanges).toBe(true);
    });

    it('should be true when internal state changes', () => {
      const before = createBaseSnapshot();
      const after: AppStateSnapshot = {
        ...before,
        customState: { ...before.customState, newKey: 'value' },
      };

      const changes = compareStateSnapshots(before, after);

      expect(changes.hasChanges).toBe(true);
    });

    it('should be true when analytics changes', () => {
      const before = createBaseSnapshot();
      const after: AppStateSnapshot = {
        ...before,
        recentEventNames: [...before.recentEventNames, 'new_event'],
        analyticsEventCount: before.analyticsEventCount + 1,
      };

      const changes = compareStateSnapshots(before, after);

      expect(changes.hasChanges).toBe(true);
    });

    it('should be false when nothing changes', () => {
      const before = createBaseSnapshot();
      const after = { ...before };

      const changes = compareStateSnapshots(before, after);

      expect(changes.hasChanges).toBe(false);
    });
  });
});

// =============================================================================
// Tests: verifyStateChanges
// =============================================================================

describe('verifyStateChanges', () => {
  describe('screen change expectations', () => {
    it('should pass when expecting screen change and it occurred', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectScreenChange: true,
      });

      expect(result.passed).toBe(true);
      expect(result.expectations?.matched).toContainEqual(
        expect.stringContaining('Screen changed')
      );
    });

    it('should fail when expecting screen change but none occurred', () => {
      const before = createBaseSnapshot();
      const after = { ...before };

      const result = verifyStateChanges(before, after, {
        expectScreenChange: true,
      });

      expect(result.passed).toBe(false);
      expect(result.expectations?.missing).toContainEqual(
        expect.stringContaining('Expected screen change')
      );
    });

    it('should report unexpected screen change', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectScreenChange: false,
      });

      expect(result.expectations?.unexpected).toContainEqual(
        expect.stringContaining('Screen unexpectedly changed')
      );
    });
  });

  describe('route change expectations', () => {
    it('should pass when expecting route change and it occurred', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectRouteChange: true,
      });

      expect(result.passed).toBe(true);
      expect(result.expectations?.matched).toContainEqual(
        expect.stringContaining('Route changed')
      );
    });

    it('should fail when expecting route change but none occurred', () => {
      const before = createBaseSnapshot();
      const after = { ...before };

      const result = verifyStateChanges(before, after, {
        expectRouteChange: true,
      });

      expect(result.passed).toBe(false);
      expect(result.expectations?.missing).toContainEqual(
        expect.stringContaining('Expected route change')
      );
    });
  });

  describe('key change expectations', () => {
    it('should pass when expected keys changed', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectKeysChanged: ['cart'],
      });

      expect(result.passed).toBe(true);
      expect(result.expectations?.matched).toContainEqual(
        expect.stringContaining('cart')
      );
    });

    it('should fail when expected key did not change', () => {
      const before = createBaseSnapshot();
      const after = { ...before };

      const result = verifyStateChanges(before, after, {
        expectKeysChanged: ['cart'],
      });

      expect(result.passed).toBe(false);
      expect(result.expectations?.missing).toContainEqual(
        expect.stringContaining('Expected key "cart" to change')
      );
    });

    it('should detect added keys as changes', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectKeysChanged: ['settings'],
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('key value expectations', () => {
    it('should pass when key has expected value', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectKeyValues: {
          cart: { itemCount: 5 },
        },
      });

      expect(result.passed).toBe(true);
      expect(result.expectations?.matched).toContainEqual(
        expect.stringContaining('has expected value')
      );
    });

    it('should fail when key does not have expected value', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectKeyValues: {
          cart: { itemCount: 10 },
        },
      });

      expect(result.passed).toBe(false);
      expect(result.expectations?.missing).toContainEqual(
        expect.stringContaining('Expected key "cart" to be')
      );
    });
  });

  describe('analytics event expectations', () => {
    it('should pass when expected events were fired', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectEvents: ['settings_tap'],
      });

      expect(result.passed).toBe(true);
      expect(result.expectations?.matched).toContainEqual(
        expect.stringContaining('Analytics event "settings_tap" was fired')
      );
    });

    it('should fail when expected event was not fired', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectEvents: ['checkout_complete'],
      });

      expect(result.passed).toBe(false);
      expect(result.expectations?.missing).toContainEqual(
        expect.stringContaining('Expected analytics event "checkout_complete" was not fired')
      );
    });
  });

  describe('feature flag expectations', () => {
    it('should pass when expected flags changed', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectFlagsChanged: ['darkMode'],
      });

      expect(result.passed).toBe(true);
      expect(result.expectations?.matched).toContainEqual(
        expect.stringContaining('Feature flag "darkMode" changed')
      );
    });

    it('should fail when expected flag did not change', () => {
      const before = createBaseSnapshot();
      const after = { ...before };

      const result = verifyStateChanges(before, after, {
        expectFlagsChanged: ['darkMode'],
      });

      expect(result.passed).toBe(false);
      expect(result.expectations?.missing).toContainEqual(
        expect.stringContaining('Expected feature flag "darkMode" to change')
      );
    });
  });

  describe('combined expectations', () => {
    it('should pass when all expectations are met', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectScreenChange: true,
        expectRouteChange: true,
        expectKeysChanged: ['cart'],
        expectEvents: ['settings_tap'],
      });

      expect(result.passed).toBe(true);
      expect(result.expectations?.matched).toHaveLength(4);
      expect(result.expectations?.missing).toHaveLength(0);
    });

    it('should fail if any expectation is not met', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {
        expectScreenChange: true,
        expectEvents: ['checkout_complete'], // This won't be found
      });

      expect(result.passed).toBe(false);
      expect(result.expectations?.matched).toContainEqual(
        expect.stringContaining('Screen changed')
      );
      expect(result.expectations?.missing).toContainEqual(
        expect.stringContaining('checkout_complete')
      );
    });
  });

  describe('no expectations (pure observation)', () => {
    it('should pass with changes when no expectations provided', () => {
      const before = createBaseSnapshot();
      const after = createChangedSnapshot();

      const result = verifyStateChanges(before, after, {});

      expect(result.passed).toBe(true);
      expect(result.changes.hasChanges).toBe(true);
    });

    it('should pass with no changes when no expectations provided', () => {
      const before = createBaseSnapshot();
      const after = { ...before };

      const result = verifyStateChanges(before, after, {});

      expect(result.passed).toBe(true);
      expect(result.changes.hasChanges).toBe(false);
    });
  });
});

// =============================================================================
// Tests: Formatting
// =============================================================================

describe('formatStateChanges', () => {
  it('should format UI changes', () => {
    const before = createBaseSnapshot();
    const after = createChangedSnapshot();
    const changes = compareStateSnapshots(before, after);

    const output = formatStateChanges(changes);

    expect(output).toContain('## State Changes Detected');
    expect(output).toContain('### UI Changes');
    expect(output).toContain('HomeViewController');
    expect(output).toContain('SettingsViewController');
  });

  it('should format internal state changes', () => {
    const before = createBaseSnapshot();
    const after = createChangedSnapshot();
    const changes = compareStateSnapshots(before, after);

    const output = formatStateChanges(changes);

    expect(output).toContain('### Internal State Changes');
    expect(output).toContain('cart');
    expect(output).toContain('settings');
  });

  it('should format analytics events', () => {
    const before = createBaseSnapshot();
    const after = createChangedSnapshot();
    const changes = compareStateSnapshots(before, after);

    const output = formatStateChanges(changes);

    expect(output).toContain('### Analytics Events');
    expect(output).toContain('settings_tap');
  });

  it('should indicate when no changes detected', () => {
    const before = createBaseSnapshot();
    const after = { ...before };
    const changes = compareStateSnapshots(before, after);

    const output = formatStateChanges(changes);

    expect(output).toContain('*No UI changes detected*');
    expect(output).toContain('*No internal state changes detected*');
    expect(output).toContain('*No new analytics events*');
  });
});

describe('formatVerificationResult', () => {
  it('should show passed status with checkmark', () => {
    const before = createBaseSnapshot();
    const after = createChangedSnapshot();
    const result = verifyStateChanges(before, after, {
      expectScreenChange: true,
    });

    const output = formatVerificationResult(result);

    expect(output).toContain('✅');
    expect(output).toContain('PASSED');
  });

  it('should show failed status with X', () => {
    const before = createBaseSnapshot();
    const after = { ...before };
    const result = verifyStateChanges(before, after, {
      expectScreenChange: true,
    });

    const output = formatVerificationResult(result);

    expect(output).toContain('❌');
    expect(output).toContain('FAILED');
  });

  it('should list matched expectations', () => {
    const before = createBaseSnapshot();
    const after = createChangedSnapshot();
    const result = verifyStateChanges(before, after, {
      expectScreenChange: true,
    });

    const output = formatVerificationResult(result);

    expect(output).toContain('### ✓ Matched Expectations');
    expect(output).toContain('Screen changed');
  });

  it('should list missing expectations', () => {
    const before = createBaseSnapshot();
    const after = { ...before };
    const result = verifyStateChanges(before, after, {
      expectScreenChange: true,
    });

    const output = formatVerificationResult(result);

    expect(output).toContain('### ✗ Missing Expectations');
    expect(output).toContain('Expected screen change');
  });

  it('should list unexpected changes', () => {
    const before = createBaseSnapshot();
    const after = createChangedSnapshot();
    const result = verifyStateChanges(before, after, {
      expectScreenChange: false,
    });

    const output = formatVerificationResult(result);

    expect(output).toContain('### ⚠ Unexpected Changes');
    expect(output).toContain('Screen unexpectedly changed');
  });
});

// =============================================================================
// Tests: Edge Cases
// =============================================================================

describe('edge cases', () => {
  it('should handle empty custom state', () => {
    const before: AppStateSnapshot = {
      ...createBaseSnapshot(),
      customState: {},
    };
    const after: AppStateSnapshot = {
      ...before,
      customState: { newKey: 'value' },
    };

    const changes = compareStateSnapshots(before, after);

    expect(changes.internal.addedKeys).toContain('newKey');
  });

  it('should handle empty feature flags', () => {
    const before: AppStateSnapshot = {
      ...createBaseSnapshot(),
      featureFlags: {},
    };
    const after: AppStateSnapshot = {
      ...before,
      featureFlags: { newFlag: true },
    };

    const changes = compareStateSnapshots(before, after);

    expect(changes.internal.changedFlags).toContain('newFlag');
  });

  it('should handle nested object changes', () => {
    const before = createBaseSnapshot();
    const after: AppStateSnapshot = {
      ...before,
      customState: {
        ...before.customState,
        user: { isLoggedIn: false, username: 'testuser' }, // isLoggedIn changed
      },
    };

    const changes = compareStateSnapshots(before, after);

    expect(changes.internal.changedKeys).toContain('user');
  });

  it('should handle array changes in custom state', () => {
    const before: AppStateSnapshot = {
      ...createBaseSnapshot(),
      customState: { items: [1, 2, 3] },
    };
    const after: AppStateSnapshot = {
      ...before,
      customState: { items: [1, 2, 3, 4] },
    };

    const changes = compareStateSnapshots(before, after);

    expect(changes.internal.changedKeys).toContain('items');
  });

  it('should handle undefined route', () => {
    const before: AppStateSnapshot = {
      ...createBaseSnapshot(),
      currentRoute: undefined,
      routeStack: undefined,
    };
    const after: AppStateSnapshot = {
      ...before,
      currentRoute: '/home',
      routeStack: [{ route: '/home', title: 'Home' }],
    };

    const changes = compareStateSnapshots(before, after);

    expect(changes.ui.routeChanged).toBe(true);
  });
});
