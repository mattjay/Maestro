/**
 * Tests for bridge-formatter.ts
 */

import {
  formatBridgeStateForAgent,
  formatNavigation,
  formatViewControllerHierarchy,
  formatUserState,
  formatFeatureFlagsSection,
  formatRecentNetwork,
  formatRecentAnalytics,
  formatNetworkRequest,
  formatAnalyticsEvent,
  formatFeatureFlagsSummary,
  formatFeatureFlag,
  formatRouteStack,
  formatBridgeStateAsJson,
  formatBridgeStateCompact,
  CombinedBridgeData,
} from '../bridge-formatter';

import {
  AppState,
  RouteInfo,
  NetworkLog,
  AnalyticsLog,
  FeatureFlags,
  NetworkRequestEntry,
  AnalyticsEvent,
} from '../bridge-client';

// =============================================================================
// Test Data Fixtures
// =============================================================================

const mockAppState: AppState = {
  timestamp: '2024-01-15T10:30:00Z',
  viewControllerStack: [
    'RootNavigationController',
    'HomeViewController',
    'SettingsViewController',
  ],
  currentViewController: 'SettingsViewController',
  customState: {
    user: {
      isLoggedIn: true,
      username: 'testuser',
    },
    cart: {
      itemCount: 3,
    },
  },
  featureFlags: {
    newCheckout: true,
    darkMode: false,
  },
};

const mockRouteInfo: RouteInfo = {
  currentRoute: '/settings/profile',
  stack: [
    { route: '/home', title: 'Home' },
    { route: '/settings', title: 'Settings' },
    { route: '/settings/profile', title: 'Profile' },
  ],
  canGoBack: true,
  presentedModally: false,
};

const mockNetworkLog: NetworkLog = {
  requests: [
    {
      id: 'abc123',
      url: 'https://api.example.com/user',
      method: 'GET',
      status: 200,
      duration: 245,
      timestamp: '2024-01-15T10:30:00Z',
      requestHeaders: { Authorization: '[REDACTED]' },
      responseSize: 1234,
    },
    {
      id: 'def456',
      url: 'https://api.example.com/cart',
      method: 'POST',
      status: 201,
      duration: 180,
      timestamp: '2024-01-15T10:30:05Z',
      requestHeaders: {},
      responseSize: 567,
    },
    {
      id: 'ghi789',
      url: 'https://api.example.com/products',
      method: 'GET',
      status: 500,
      duration: 320,
      timestamp: '2024-01-15T10:30:10Z',
      requestHeaders: {},
      responseSize: 123,
    },
  ],
  count: 15,
  errors: 1,
};

const mockAnalyticsLog: AnalyticsLog = {
  events: [
    {
      name: 'screen_view',
      properties: { screen: 'cart' },
      timestamp: '2024-01-15T10:29:55Z',
    },
    {
      name: 'button_tap',
      properties: { button_id: 'add_to_cart', screen: 'product' },
      timestamp: '2024-01-15T10:30:00Z',
    },
    {
      name: 'purchase_started',
      properties: {},
      timestamp: '2024-01-15T10:30:05Z',
    },
  ],
  count: 50,
};

const mockFeatureFlags: FeatureFlags = {
  flags: {
    newCheckout: { enabled: true, variant: 'A' },
    darkMode: { enabled: false },
    experimentalFeature: { enabled: true },
  },
};

// =============================================================================
// formatBridgeStateForAgent Tests
// =============================================================================

describe('formatBridgeStateForAgent', () => {
  it('should format combined bridge data with all sections', () => {
    const data: CombinedBridgeData = {
      state: mockAppState,
      route: mockRouteInfo,
      network: mockNetworkLog,
      analytics: mockAnalyticsLog,
      flags: mockFeatureFlags,
    };

    const result = formatBridgeStateForAgent(data);

    expect(result.summary).toContain('Route:');
    expect(result.fullOutput).toContain('## App Internal State');
    expect(result.fullOutput).toContain('### Navigation');
    expect(result.fullOutput).toContain('### View Controller Hierarchy');
    expect(result.fullOutput).toContain('### User State');
    expect(result.fullOutput).toContain('### Feature Flags');
    expect(result.fullOutput).toContain('### Recent Network');
    expect(result.fullOutput).toContain('### Recent Analytics');
  });

  it('should handle partial data gracefully', () => {
    const data: CombinedBridgeData = {
      state: mockAppState,
    };

    const result = formatBridgeStateForAgent(data);

    expect(result.fullOutput).toContain('### Navigation');
    expect(result.sections.network).toContain('No recent network requests');
    expect(result.sections.analytics).toContain('No recent analytics events');
  });

  it('should handle empty data', () => {
    const data: CombinedBridgeData = {};

    const result = formatBridgeStateForAgent(data);

    expect(result.summary).toBe('No bridge data available');
    expect(result.sections.navigation).toContain('No navigation data');
  });

  it('should respect maxNetworkRequests option', () => {
    const data: CombinedBridgeData = {
      network: mockNetworkLog,
    };

    const result = formatBridgeStateForAgent(data, { maxNetworkRequests: 2 });

    // Should show only 2 requests
    const requestCount = (result.sections.network.match(/→/g) || []).length;
    expect(requestCount).toBe(2);
    expect(result.sections.network).toContain('and 1 more request');
  });

  it('should respect maxAnalyticsEvents option', () => {
    const data: CombinedBridgeData = {
      analytics: mockAnalyticsLog,
    };

    const result = formatBridgeStateForAgent(data, { maxAnalyticsEvents: 2 });

    expect(result.sections.analytics).toContain('and 1 more event');
  });
});

// =============================================================================
// formatNavigation Tests
// =============================================================================

describe('formatNavigation', () => {
  it('should format route info correctly', () => {
    const result = formatNavigation(mockRouteInfo);

    expect(result).toContain('Current Route: /settings/profile');
    expect(result).toContain('Stack Depth: 3');
    expect(result).toContain('Can Go Back: Yes');
  });

  it('should indicate modal presentation', () => {
    const modalRoute: RouteInfo = {
      ...mockRouteInfo,
      presentedModally: true,
    };

    const result = formatNavigation(modalRoute);

    expect(result).toContain('Presented Modally: Yes');
  });

  it('should fall back to state when route is unavailable', () => {
    const result = formatNavigation(undefined, mockAppState);

    expect(result).toContain('Current Screen: SettingsViewController');
    expect(result).toContain('Stack Depth: 3');
    expect(result).toContain('Can Go Back: Yes');
  });

  it('should handle empty input', () => {
    const result = formatNavigation();

    expect(result).toContain('No navigation data available');
  });
});

// =============================================================================
// formatViewControllerHierarchy Tests
// =============================================================================

describe('formatViewControllerHierarchy', () => {
  it('should format view controller stack with numbers', () => {
    const result = formatViewControllerHierarchy(mockAppState);

    expect(result).toContain('1. RootNavigationController');
    expect(result).toContain('2. HomeViewController');
    expect(result).toContain('3. SettingsViewController (current)');
  });

  it('should mark current controller', () => {
    const result = formatViewControllerHierarchy(mockAppState);

    expect(result).toContain('(current)');
    expect(result.match(/\(current\)/g)?.length).toBe(1);
  });

  it('should handle empty stack', () => {
    const emptyState: AppState = {
      ...mockAppState,
      viewControllerStack: [],
    };

    const result = formatViewControllerHierarchy(emptyState);

    expect(result).toContain('No view controller data');
  });

  it('should handle undefined state', () => {
    const result = formatViewControllerHierarchy(undefined);

    expect(result).toContain('No view controller data');
  });
});

// =============================================================================
// formatUserState Tests
// =============================================================================

describe('formatUserState', () => {
  it('should format nested custom state', () => {
    const result = formatUserState(mockAppState);

    expect(result).toContain('**user**:');
    expect(result).toContain('isLoggedIn: true');
    expect(result).toContain('username: "testuser"');
    expect(result).toContain('**cart**:');
    expect(result).toContain('itemCount: 3');
  });

  it('should handle simple values', () => {
    const simpleState: AppState = {
      ...mockAppState,
      customState: {
        count: 42,
        name: 'test',
        active: false,
      },
    };

    const result = formatUserState(simpleState);

    expect(result).toContain('count: 42');
    expect(result).toContain('name: "test"');
    expect(result).toContain('active: false');
  });

  it('should handle empty custom state', () => {
    const emptyState: AppState = {
      ...mockAppState,
      customState: {},
    };

    const result = formatUserState(emptyState);

    expect(result).toContain('No custom state registered');
  });
});

// =============================================================================
// formatFeatureFlagsSection Tests
// =============================================================================

describe('formatFeatureFlagsSection', () => {
  it('should format flags with enabled/disabled status', () => {
    const result = formatFeatureFlagsSection(mockFeatureFlags);

    expect(result).toContain('newCheckout: enabled (variant A)');
    expect(result).toContain('darkMode: disabled');
    expect(result).toContain('experimentalFeature: enabled');
  });

  it('should handle boolean flags', () => {
    const boolFlags: FeatureFlags = {
      flags: {
        featureA: { enabled: true },
        featureB: { enabled: false },
      },
    };

    const result = formatFeatureFlagsSection(boolFlags);

    expect(result).toContain('featureA: enabled');
    expect(result).toContain('featureB: disabled');
  });

  it('should handle empty flags', () => {
    const result = formatFeatureFlagsSection({ flags: {} });

    expect(result).toContain('No feature flags registered');
  });

  it('should handle null input', () => {
    const result = formatFeatureFlagsSection(null);

    expect(result).toContain('No feature flags registered');
  });
});

// =============================================================================
// formatRecentNetwork Tests
// =============================================================================

describe('formatRecentNetwork', () => {
  it('should format network requests with status indicators', () => {
    const result = formatRecentNetwork(mockNetworkLog);

    expect(result).toContain('✓ GET /user → 200');
    expect(result).toContain('✓ POST /cart → 201');
    expect(result).toContain('✗ GET /products → 500');
  });

  it('should show error summary when errors exist', () => {
    const result = formatRecentNetwork(mockNetworkLog);

    expect(result).toContain('1 failed request(s) out of 15 total');
  });

  it('should include duration', () => {
    const result = formatRecentNetwork(mockNetworkLog);

    expect(result).toContain('(245ms)');
    expect(result).toContain('(180ms)');
  });

  it('should handle empty network log', () => {
    const result = formatRecentNetwork({ requests: [], count: 0, errors: 0 });

    expect(result).toContain('No recent network requests');
  });

  it('should respect maxItems limit', () => {
    const result = formatRecentNetwork(mockNetworkLog, 2);

    expect(result).toContain('and 1 more request');
  });
});

// =============================================================================
// formatRecentAnalytics Tests
// =============================================================================

describe('formatRecentAnalytics', () => {
  it('should format analytics events with properties', () => {
    const result = formatRecentAnalytics(mockAnalyticsLog);

    expect(result).toContain('screen_view: screen=cart');
    expect(result).toContain('button_tap: button_id=add_to_cart');
    expect(result).toContain('purchase_started');
  });

  it('should include timestamps', () => {
    const result = formatRecentAnalytics(mockAnalyticsLog);

    // Check for time format (HH:MM:SS)
    expect(result).toMatch(/\(\d{2}:\d{2}:\d{2}\)/);
  });

  it('should handle empty analytics', () => {
    const result = formatRecentAnalytics({ events: [], count: 0 });

    expect(result).toContain('No recent analytics events');
  });

  it('should respect maxItems limit', () => {
    const result = formatRecentAnalytics(mockAnalyticsLog, 2);

    expect(result).toContain('and 1 more event');
  });
});

// =============================================================================
// formatNetworkRequest Tests
// =============================================================================

describe('formatNetworkRequest', () => {
  it('should format detailed network request', () => {
    const request: NetworkRequestEntry = mockNetworkLog.requests[0];
    const result = formatNetworkRequest(request);

    expect(result).toContain('## Network Request: abc123');
    expect(result).toContain('**GET** https://api.example.com/user');
    expect(result).toContain('Status: 200 OK');
    expect(result).toContain('Duration: 245ms');
    expect(result).toContain('Response Size: 1 KB');
    expect(result).toContain('**Headers:**');
    expect(result).toContain('Authorization: [REDACTED]');
  });
});

// =============================================================================
// formatAnalyticsEvent Tests
// =============================================================================

describe('formatAnalyticsEvent', () => {
  it('should format detailed analytics event', () => {
    const event: AnalyticsEvent = mockAnalyticsLog.events[1];
    const result = formatAnalyticsEvent(event);

    expect(result).toContain('## Event: button_tap');
    expect(result).toContain('**Properties:**');
    expect(result).toContain('button_id: "add_to_cart"');
    expect(result).toContain('screen: "product"');
  });

  it('should handle event with no properties', () => {
    const event: AnalyticsEvent = mockAnalyticsLog.events[2];
    const result = formatAnalyticsEvent(event);

    expect(result).toContain('## Event: purchase_started');
    expect(result).not.toContain('**Properties:**');
  });
});

// =============================================================================
// formatFeatureFlagsSummary Tests
// =============================================================================

describe('formatFeatureFlagsSummary', () => {
  it('should group enabled and disabled flags', () => {
    const result = formatFeatureFlagsSummary(mockFeatureFlags);

    expect(result).toContain('Enabled:');
    expect(result).toContain('Disabled:');
    expect(result).toContain('newCheckout');
    expect(result).toContain('darkMode');
  });
});

// =============================================================================
// formatFeatureFlag Tests
// =============================================================================

describe('formatFeatureFlag', () => {
  it('should format flag with variant', () => {
    const result = formatFeatureFlag('newCheckout', { enabled: true, variant: 'A' });

    expect(result).toContain('## Feature Flag: newCheckout');
    expect(result).toContain('Enabled: Yes');
    expect(result).toContain('Variant: A');
  });

  it('should format flag without variant', () => {
    const result = formatFeatureFlag('darkMode', { enabled: false });

    expect(result).toContain('Enabled: No');
    expect(result).not.toContain('Variant:');
  });

  it('should handle boolean flag', () => {
    const result = formatFeatureFlag('legacyFeature', true);

    expect(result).toContain('Enabled: Yes');
  });
});

// =============================================================================
// formatRouteStack Tests
// =============================================================================

describe('formatRouteStack', () => {
  it('should format route stack with current marker', () => {
    const result = formatRouteStack(mockRouteInfo);

    expect(result).toContain('## Navigation Stack');
    expect(result).toContain('1. /home (Home)');
    expect(result).toContain('2. /settings (Settings)');
    expect(result).toContain('3. /settings/profile (Profile) ← current');
    expect(result).toContain('Can Go Back: Yes');
  });

  it('should indicate modal presentation', () => {
    const modalRoute: RouteInfo = {
      ...mockRouteInfo,
      presentedModally: true,
    };

    const result = formatRouteStack(modalRoute);

    expect(result).toContain('Presented: Modal');
  });
});

// =============================================================================
// formatBridgeStateAsJson Tests
// =============================================================================

describe('formatBridgeStateAsJson', () => {
  it('should produce valid JSON', () => {
    const data: CombinedBridgeData = {
      state: mockAppState,
      route: mockRouteInfo,
      network: mockNetworkLog,
      analytics: mockAnalyticsLog,
      flags: mockFeatureFlags,
    };

    const result = formatBridgeStateAsJson(data);

    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should include all sections in JSON', () => {
    const data: CombinedBridgeData = {
      state: mockAppState,
      route: mockRouteInfo,
      network: mockNetworkLog,
      analytics: mockAnalyticsLog,
      flags: mockFeatureFlags,
    };

    const result = formatBridgeStateAsJson(data);
    const parsed = JSON.parse(result);

    expect(parsed.state).toBeDefined();
    expect(parsed.route).toBeDefined();
    expect(parsed.network).toBeDefined();
    expect(parsed.analytics).toBeDefined();
    expect(parsed.flags).toBeDefined();
  });

  it('should limit network requests to 10', () => {
    const manyRequests: NetworkLog = {
      requests: Array.from({ length: 20 }, (_, i) => ({
        id: `req${i}`,
        url: `https://api.example.com/test${i}`,
        method: 'GET',
        status: 200,
        duration: 100,
        timestamp: '2024-01-15T10:30:00Z',
        requestHeaders: {},
        responseSize: 100,
      })),
      count: 20,
      errors: 0,
    };

    const data: CombinedBridgeData = { network: manyRequests };
    const result = formatBridgeStateAsJson(data);
    const parsed = JSON.parse(result);

    expect(parsed.network.requests.length).toBe(10);
  });
});

// =============================================================================
// formatBridgeStateCompact Tests
// =============================================================================

describe('formatBridgeStateCompact', () => {
  it('should produce compact output', () => {
    const data: CombinedBridgeData = {
      state: mockAppState,
      route: mockRouteInfo,
      network: mockNetworkLog,
      analytics: mockAnalyticsLog,
      flags: mockFeatureFlags,
    };

    const result = formatBridgeStateCompact(data);

    // Should be compact - check it's not too long
    expect(result.split('\n').length).toBeLessThan(10);

    // Should include key info
    expect(result).toContain('Screen:');
    expect(result).toContain('/settings/profile');
  });

  it('should show state summary', () => {
    const data: CombinedBridgeData = {
      state: mockAppState,
    };

    const result = formatBridgeStateCompact(data);

    expect(result).toContain('State:');
    expect(result).toContain('user=');
  });

  it('should show recent network compactly', () => {
    const data: CombinedBridgeData = {
      network: mockNetworkLog,
    };

    const result = formatBridgeStateCompact(data);

    expect(result).toContain('Network:');
    expect(result).toContain('GET');
    expect(result).toContain('200');
  });

  it('should show recent events compactly', () => {
    const data: CombinedBridgeData = {
      analytics: mockAnalyticsLog,
    };

    const result = formatBridgeStateCompact(data);

    expect(result).toContain('Events:');
    expect(result).toContain('screen_view');
  });

  it('should show enabled flags', () => {
    const data: CombinedBridgeData = {
      flags: mockFeatureFlags,
    };

    const result = formatBridgeStateCompact(data);

    expect(result).toContain('Flags:');
    expect(result).toContain('newCheckout');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge cases', () => {
  it('should handle very long URLs', () => {
    const longUrlRequest: NetworkRequestEntry = {
      id: 'long',
      url: 'https://api.example.com/very/long/path/that/goes/on/and/on/and/on/and/on/with/many/segments',
      method: 'GET',
      status: 200,
      duration: 100,
      timestamp: '2024-01-15T10:30:00Z',
      requestHeaders: {},
      responseSize: 100,
    };

    const result = formatNetworkRequest(longUrlRequest);

    expect(result).toContain('https://api.example.com');
  });

  it('should handle special characters in values', () => {
    const specialState: AppState = {
      ...mockAppState,
      customState: {
        message: 'Hello "World" & <Friends>',
      },
    };

    const result = formatUserState(specialState);

    expect(result).toContain('Hello');
  });

  it('should handle null values in custom state', () => {
    const nullState: AppState = {
      ...mockAppState,
      customState: {
        nullValue: null,
        undefinedValue: undefined,
      },
    };

    const result = formatUserState(nullState);

    expect(result).toContain('null');
    expect(result).toContain('undefined');
  });

  it('should handle arrays in custom state', () => {
    const arrayState: AppState = {
      ...mockAppState,
      customState: {
        items: [1, 2, 3, 4, 5],
      },
    };

    const result = formatUserState(arrayState);

    // Arrays are treated as objects and iterated
    expect(result).toContain('**items**:');
    expect(result).toContain('0: 1');
    expect(result).toContain('4: 5');
  });
});
