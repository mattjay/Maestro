/**
 * Tests for src/main/slash-commands/ios-bridge.ts
 *
 * Tests cover argument parsing, command execution, and error handling
 * for the /ios.bridge.* slash commands.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  parseBridgeStateArgs,
  executeBridgeStateCommand,
  bridgeStateCommandMetadata,
  parseBridgeRouteArgs,
  executeBridgeRouteCommand,
  bridgeRouteCommandMetadata,
  parseBridgeNetworkArgs,
  executeBridgeNetworkCommand,
  bridgeNetworkCommandMetadata,
  parseBridgeAnalyticsArgs,
  executeBridgeAnalyticsCommand,
  bridgeAnalyticsCommandMetadata,
  parseBridgeFlagsArgs,
  executeBridgeFlagsCommand,
  bridgeFlagsCommandMetadata,
  parseBridgeSetArgs,
  executeBridgeSetCommand,
  bridgeSetCommandMetadata,
} from '../../../main/slash-commands/ios-bridge';

// Mock bridge-client module
vi.mock('../../../main/ios-tools/bridge-client', () => ({
  createBridgeClient: vi.fn(),
  getCachedBridgeClient: vi.fn(),
  DEFAULT_BRIDGE_PORTS: [9876, 9877, 9878, 9879, 9880],
  DEFAULT_BRIDGE_HOST: '127.0.0.1',
}));

// Mock ios-tools module
vi.mock('../../../main/ios-tools', () => ({
  getBootedSimulators: vi.fn(),
  listSimulators: vi.fn(),
}));

// Mock logger
vi.mock('../../../main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Get mocked functions
import * as bridgeClient from '../../../main/ios-tools/bridge-client';
import * as iosTools from '../../../main/ios-tools';

const mockCreateBridgeClient = vi.mocked(bridgeClient.createBridgeClient);
const mockGetCachedBridgeClient = vi.mocked(bridgeClient.getCachedBridgeClient);
const mockGetBootedSimulators = vi.mocked(iosTools.getBootedSimulators);
const mockListSimulators = vi.mocked(iosTools.listSimulators);

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockBridgeClient() {
  return {
    ping: vi.fn().mockResolvedValue(true),
    getState: vi.fn().mockResolvedValue({
      success: true,
      data: createMockAppState(),
    }),
    getStateKey: vi.fn(),
    getRoute: vi.fn().mockResolvedValue({
      success: true,
      data: createMockRouteInfo(),
    }),
    getRouteStack: vi.fn().mockResolvedValue({
      success: true,
      data: createMockRouteInfo(),
    }),
    getRouteHistory: vi.fn(),
    getNetwork: vi.fn().mockResolvedValue({
      success: true,
      data: createMockNetworkLog(),
    }),
    getNetworkDetail: vi.fn(),
    clearNetwork: vi.fn(),
    getAnalytics: vi.fn().mockResolvedValue({
      success: true,
      data: createMockAnalyticsLog(),
    }),
    getAnalyticsSources: vi.fn(),
    clearAnalytics: vi.fn(),
    getFlags: vi.fn().mockResolvedValue({
      success: true,
      data: createMockFeatureFlags(),
    }),
    getFlag: vi.fn(),
    setState: vi.fn().mockResolvedValue({ success: true }),
    setToken: vi.fn(),
    setPort: vi.fn(),
    getConfig: vi.fn(),
  };
}

function createMockAppState() {
  return {
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
      newCheckout: { enabled: true, variant: 'A' },
      darkMode: { enabled: false },
    },
  };
}

function createMockRouteInfo() {
  return {
    currentRoute: '/settings/profile',
    stack: [
      { route: '/home', title: 'Home' },
      { route: '/settings', title: 'Settings' },
      { route: '/settings/profile', title: 'Profile' },
    ],
    canGoBack: true,
    presentedModally: false,
  };
}

function createMockNetworkLog() {
  return {
    requests: [
      {
        id: 'req-001',
        url: 'https://api.example.com/user',
        method: 'GET',
        status: 200,
        duration: 245,
        timestamp: '2024-01-15T10:30:00Z',
        requestHeaders: { Authorization: '[REDACTED]' },
        responseSize: 1234,
      },
      {
        id: 'req-002',
        url: 'https://api.example.com/cart',
        method: 'POST',
        status: 201,
        duration: 180,
        timestamp: '2024-01-15T10:30:05Z',
        requestHeaders: {},
        responseSize: 256,
      },
    ],
    count: 2,
    errors: 0,
  };
}

function createMockAnalyticsLog() {
  return {
    events: [
      {
        name: 'screen_view',
        properties: { screen: 'settings' },
        timestamp: '2024-01-15T10:29:55Z',
      },
      {
        name: 'button_tap',
        properties: { button_id: 'profile_button' },
        timestamp: '2024-01-15T10:30:00Z',
      },
    ],
    count: 2,
  };
}

function createMockFeatureFlags() {
  return {
    flags: {
      newCheckout: { enabled: true, variant: 'A' },
      darkMode: { enabled: false },
      experimental: { enabled: true },
    },
  };
}

// =============================================================================
// /ios.bridge.state - Argument Parsing
// =============================================================================

describe('parseBridgeStateArgs', () => {
  describe('empty input', () => {
    it('returns empty args for bare command', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state');
      expect(args).toEqual({});
    });

    it('returns empty args for command with whitespace only', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state   ');
      expect(args).toEqual({});
    });
  });

  describe('key argument', () => {
    it('parses key as positional argument', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state user');
      expect(args.key).toBe('user');
    });

    it('parses dotted key path', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state user.isLoggedIn');
      expect(args.key).toBe('user.isLoggedIn');
    });

    it('parses quoted key with spaces', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state "cart items"');
      expect(args.key).toBe('cart items');
    });
  });

  describe('--json flag', () => {
    it('parses --json flag', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state --json');
      expect(args.json).toBe(true);
    });

    it('parses --json with key', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state user --json');
      expect(args.key).toBe('user');
      expect(args.json).toBe(true);
    });
  });

  describe('--simulator / -s', () => {
    it('parses --simulator with simulator name', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state --simulator "iPhone 15 Pro"');
      expect(args.simulator).toBe('iPhone 15 Pro');
    });

    it('parses -s short form', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state -s "iPhone 15"');
      expect(args.simulator).toBe('iPhone 15');
    });
  });

  describe('--port / -p', () => {
    it('parses --port with number', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state --port 9877');
      expect(args.port).toBe(9877);
    });

    it('parses -p short form', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state -p 9878');
      expect(args.port).toBe(9878);
    });

    it('ignores invalid port', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state --port abc');
      expect(args.port).toBeUndefined();
    });
  });

  describe('--token / -t', () => {
    it('parses --token', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state --token abc123');
      expect(args.token).toBe('abc123');
    });

    it('parses -t short form', () => {
      const args = parseBridgeStateArgs('/ios.bridge.state -t mytoken');
      expect(args.token).toBe('mytoken');
    });
  });

  describe('combined arguments', () => {
    it('parses all options together', () => {
      const args = parseBridgeStateArgs(
        '/ios.bridge.state user --json -s "iPhone 15" -p 9877 -t mytoken'
      );
      expect(args.key).toBe('user');
      expect(args.json).toBe(true);
      expect(args.simulator).toBe('iPhone 15');
      expect(args.port).toBe(9877);
      expect(args.token).toBe('mytoken');
    });
  });
});

// =============================================================================
// /ios.bridge.state - Command Execution
// =============================================================================

describe('executeBridgeStateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful execution', () => {
    it('executes state command with no arguments', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeStateCommand('/ios.bridge.state', 'test-session-id');

      expect(result.success).toBe(true);
      expect(result.output).toContain('App Internal State');
      expect(result.output).toContain('SettingsViewController');
      expect(result.data).toBeDefined();
    });

    it('executes state command with --json flag', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeStateCommand('/ios.bridge.state --json', 'test-session-id');

      expect(result.success).toBe(true);
      expect(result.output).toContain('```json');
    });

    it('executes state command with specific key', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeStateCommand('/ios.bridge.state user', 'test-session-id');

      expect(result.success).toBe(true);
      expect(result.output).toContain('App State: user');
    });
  });

  describe('error handling', () => {
    it('handles bridge connection failure', async () => {
      mockCreateBridgeClient.mockResolvedValue({
        success: false,
        error: 'Bridge not reachable',
      });

      const result = await executeBridgeStateCommand('/ios.bridge.state', 'test-session-id');

      expect(result.success).toBe(false);
      expect(result.output).toContain('Bridge Connection Failed');
      expect(result.error).toContain('Bridge not reachable');
    });

    it('handles getState failure', async () => {
      const mockClient = createMockBridgeClient();
      mockClient.getState.mockResolvedValue({
        success: false,
        error: 'Unauthorized',
      });
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeStateCommand('/ios.bridge.state', 'test-session-id');

      expect(result.success).toBe(false);
      expect(result.output).toContain('Connection Failed');
    });
  });
});

// =============================================================================
// /ios.bridge.route - Argument Parsing
// =============================================================================

describe('parseBridgeRouteArgs', () => {
  describe('empty input', () => {
    it('returns empty args for bare command', () => {
      const args = parseBridgeRouteArgs('/ios.bridge.route');
      expect(args).toEqual({});
    });
  });

  describe('--stack flag', () => {
    it('parses --stack flag', () => {
      const args = parseBridgeRouteArgs('/ios.bridge.route --stack');
      expect(args.stack).toBe(true);
    });
  });

  describe('common options', () => {
    it('parses all options', () => {
      const args = parseBridgeRouteArgs('/ios.bridge.route --stack -s "iPhone 15" -p 9877');
      expect(args.stack).toBe(true);
      expect(args.simulator).toBe('iPhone 15');
      expect(args.port).toBe(9877);
    });
  });
});

// =============================================================================
// /ios.bridge.route - Command Execution
// =============================================================================

describe('executeBridgeRouteCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful execution', () => {
    it('executes route command with no arguments', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeRouteCommand('/ios.bridge.route', 'test-session-id');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Navigation State');
      expect(result.output).toContain('/settings/profile');
      expect(mockClient.getRoute).toHaveBeenCalled();
    });

    it('executes route command with --stack', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeRouteCommand('/ios.bridge.route --stack', 'test-session-id');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Navigation Stack');
      expect(mockClient.getRouteStack).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// /ios.bridge.network - Argument Parsing
// =============================================================================

describe('parseBridgeNetworkArgs', () => {
  describe('empty input', () => {
    it('returns empty args for bare command', () => {
      const args = parseBridgeNetworkArgs('/ios.bridge.network');
      expect(args).toEqual({});
    });
  });

  describe('--last / -l', () => {
    it('parses --last with number', () => {
      const args = parseBridgeNetworkArgs('/ios.bridge.network --last 5');
      expect(args.last).toBe(5);
    });

    it('parses -l short form', () => {
      const args = parseBridgeNetworkArgs('/ios.bridge.network -l 10');
      expect(args.last).toBe(10);
    });
  });

  describe('--errors flag', () => {
    it('parses --errors flag', () => {
      const args = parseBridgeNetworkArgs('/ios.bridge.network --errors');
      expect(args.errors).toBe(true);
    });
  });

  describe('combined arguments', () => {
    it('parses all options together', () => {
      const args = parseBridgeNetworkArgs('/ios.bridge.network --last 5 --errors -s "iPhone 15"');
      expect(args.last).toBe(5);
      expect(args.errors).toBe(true);
      expect(args.simulator).toBe('iPhone 15');
    });
  });
});

// =============================================================================
// /ios.bridge.network - Command Execution
// =============================================================================

describe('executeBridgeNetworkCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful execution', () => {
    it('executes network command', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeNetworkCommand('/ios.bridge.network', 'test-session-id');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Network Requests');
      expect(result.output).toContain('api.example.com');
    });

    it('passes options to client', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      await executeBridgeNetworkCommand('/ios.bridge.network --last 5 --errors', 'test-session-id');

      expect(mockClient.getNetwork).toHaveBeenCalledWith({
        limit: 5,
        errorsOnly: true,
      });
    });
  });
});

// =============================================================================
// /ios.bridge.analytics - Argument Parsing
// =============================================================================

describe('parseBridgeAnalyticsArgs', () => {
  describe('empty input', () => {
    it('returns empty args for bare command', () => {
      const args = parseBridgeAnalyticsArgs('/ios.bridge.analytics');
      expect(args).toEqual({});
    });
  });

  describe('--filter / -f', () => {
    it('parses --filter', () => {
      const args = parseBridgeAnalyticsArgs('/ios.bridge.analytics --filter checkout');
      expect(args.filter).toBe('checkout');
    });

    it('parses -f short form', () => {
      const args = parseBridgeAnalyticsArgs('/ios.bridge.analytics -f button');
      expect(args.filter).toBe('button');
    });

    it('parses filter with quotes', () => {
      const args = parseBridgeAnalyticsArgs('/ios.bridge.analytics --filter "button tap"');
      expect(args.filter).toBe('button tap');
    });
  });

  describe('--last / -l', () => {
    it('parses --last', () => {
      const args = parseBridgeAnalyticsArgs('/ios.bridge.analytics --last 20');
      expect(args.last).toBe(20);
    });
  });
});

// =============================================================================
// /ios.bridge.analytics - Command Execution
// =============================================================================

describe('executeBridgeAnalyticsCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful execution', () => {
    it('executes analytics command', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeAnalyticsCommand('/ios.bridge.analytics', 'test-session-id');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Analytics Events');
      expect(result.output).toContain('screen_view');
      expect(result.output).toContain('button_tap');
    });

    it('passes filter and limit to client', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      await executeBridgeAnalyticsCommand(
        '/ios.bridge.analytics --filter checkout --last 10',
        'test-session-id'
      );

      expect(mockClient.getAnalytics).toHaveBeenCalledWith({
        filter: 'checkout',
        limit: 10,
      });
    });
  });
});

// =============================================================================
// /ios.bridge.flags - Argument Parsing
// =============================================================================

describe('parseBridgeFlagsArgs', () => {
  describe('empty input', () => {
    it('returns empty args for bare command', () => {
      const args = parseBridgeFlagsArgs('/ios.bridge.flags');
      expect(args).toEqual({});
    });
  });

  describe('flag name', () => {
    it('parses flag name as positional argument', () => {
      const args = parseBridgeFlagsArgs('/ios.bridge.flags newCheckout');
      expect(args.name).toBe('newCheckout');
    });

    it('parses quoted flag name', () => {
      const args = parseBridgeFlagsArgs('/ios.bridge.flags "dark mode"');
      expect(args.name).toBe('dark mode');
    });
  });
});

// =============================================================================
// /ios.bridge.flags - Command Execution
// =============================================================================

describe('executeBridgeFlagsCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful execution', () => {
    it('executes flags command to get all flags', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeFlagsCommand('/ios.bridge.flags', 'test-session-id');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Feature Flags');
      expect(result.output).toContain('newCheckout');
      expect(result.output).toContain('darkMode');
    });

    it('executes flags command with specific flag name', async () => {
      const mockClient = createMockBridgeClient();
      mockClient.getFlag.mockResolvedValue({
        success: true,
        data: { enabled: true, variant: 'A' },
      });
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeFlagsCommand(
        '/ios.bridge.flags newCheckout',
        'test-session-id'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Feature Flag: newCheckout');
      expect(result.output).toContain('Enabled');
    });
  });
});

// =============================================================================
// /ios.bridge.set - Argument Parsing
// =============================================================================

describe('parseBridgeSetArgs', () => {
  describe('empty input', () => {
    it('returns empty args for bare command', () => {
      const args = parseBridgeSetArgs('/ios.bridge.set');
      expect(args).toEqual({});
    });
  });

  describe('key and value', () => {
    it('parses key and value as positional arguments', () => {
      const args = parseBridgeSetArgs('/ios.bridge.set user.isLoggedIn true');
      expect(args.key).toBe('user.isLoggedIn');
      expect(args.value).toBe('true');
    });

    it('parses multi-word value', () => {
      const args = parseBridgeSetArgs('/ios.bridge.set message hello world');
      expect(args.key).toBe('message');
      expect(args.value).toBe('hello world');
    });

    it('parses JSON value with single quotes', () => {
      // When using command line, JSON needs to be quoted to preserve structure
      const args = parseBridgeSetArgs("/ios.bridge.set user '{\"name\":\"test\"}'");
      expect(args.key).toBe('user');
      expect(args.value).toBe('{"name":"test"}');
    });

    it('parses simple JSON values without quotes', () => {
      // Simple JSON like booleans and numbers work without quotes
      const args = parseBridgeSetArgs('/ios.bridge.set enabled true');
      expect(args.key).toBe('enabled');
      expect(args.value).toBe('true');
    });
  });

  describe('--confirm flag', () => {
    it('parses --confirm flag', () => {
      const args = parseBridgeSetArgs('/ios.bridge.set user.isLoggedIn true --confirm');
      expect(args.confirm).toBe(true);
    });
  });
});

// =============================================================================
// /ios.bridge.set - Command Execution
// =============================================================================

describe('executeBridgeSetCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('validation', () => {
    it('requires key argument', async () => {
      const result = await executeBridgeSetCommand('/ios.bridge.set', 'test-session-id');

      expect(result.success).toBe(false);
      expect(result.output).toContain('Missing required key argument');
    });

    it('requires value argument', async () => {
      const result = await executeBridgeSetCommand('/ios.bridge.set myKey', 'test-session-id');

      expect(result.success).toBe(false);
      expect(result.output).toContain('Missing required value argument');
    });

    it('requires --confirm flag', async () => {
      const result = await executeBridgeSetCommand(
        '/ios.bridge.set user.isLoggedIn true',
        'test-session-id'
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain('Confirmation Required');
      expect(result.output).toContain('--confirm');
    });
  });

  describe('successful execution', () => {
    it('sets state with confirmation', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeSetCommand(
        '/ios.bridge.set user.isLoggedIn true --confirm',
        'test-session-id'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('State Updated');
      expect(result.output).toContain('user.isLoggedIn');
      expect(mockClient.setState).toHaveBeenCalledWith('user.isLoggedIn', true);
    });

    it('parses JSON value correctly', async () => {
      const mockClient = createMockBridgeClient();
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      await executeBridgeSetCommand(
        '/ios.bridge.set count 42 --confirm',
        'test-session-id'
      );

      expect(mockClient.setState).toHaveBeenCalledWith('count', 42);
    });
  });

  describe('error handling', () => {
    it('handles setState failure', async () => {
      const mockClient = createMockBridgeClient();
      mockClient.setState.mockResolvedValue({
        success: false,
        error: 'Set state not enabled',
      });
      mockCreateBridgeClient.mockResolvedValue({
        success: true,
        data: mockClient as unknown as bridgeClient.BridgeClient,
      });

      const result = await executeBridgeSetCommand(
        '/ios.bridge.set user.isLoggedIn true --confirm',
        'test-session-id'
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain('Set State Failed');
    });
  });
});

// =============================================================================
// Command Metadata
// =============================================================================

describe('bridgeStateCommandMetadata', () => {
  it('has correct command name', () => {
    expect(bridgeStateCommandMetadata.command).toBe('/ios.bridge.state');
  });

  it('has description', () => {
    expect(bridgeStateCommandMetadata.description).toBeTruthy();
  });

  it('has usage string', () => {
    expect(bridgeStateCommandMetadata.usage).toContain('/ios.bridge.state');
  });

  it('has options defined', () => {
    expect(Array.isArray(bridgeStateCommandMetadata.options)).toBe(true);
    expect(bridgeStateCommandMetadata.options.length).toBeGreaterThan(0);
  });

  it('has examples', () => {
    expect(Array.isArray(bridgeStateCommandMetadata.examples)).toBe(true);
    expect(bridgeStateCommandMetadata.examples.length).toBeGreaterThan(0);
  });
});

describe('bridgeRouteCommandMetadata', () => {
  it('has correct command name', () => {
    expect(bridgeRouteCommandMetadata.command).toBe('/ios.bridge.route');
  });
});

describe('bridgeNetworkCommandMetadata', () => {
  it('has correct command name', () => {
    expect(bridgeNetworkCommandMetadata.command).toBe('/ios.bridge.network');
  });

  it('documents --last and --errors options', () => {
    const optionNames = bridgeNetworkCommandMetadata.options.map((o) => o.name);
    expect(optionNames.some((n) => n.includes('--last'))).toBe(true);
    expect(optionNames.some((n) => n.includes('--errors'))).toBe(true);
  });
});

describe('bridgeAnalyticsCommandMetadata', () => {
  it('has correct command name', () => {
    expect(bridgeAnalyticsCommandMetadata.command).toBe('/ios.bridge.analytics');
  });

  it('documents --filter option', () => {
    const optionNames = bridgeAnalyticsCommandMetadata.options.map((o) => o.name);
    expect(optionNames.some((n) => n.includes('--filter'))).toBe(true);
  });
});

describe('bridgeFlagsCommandMetadata', () => {
  it('has correct command name', () => {
    expect(bridgeFlagsCommandMetadata.command).toBe('/ios.bridge.flags');
  });
});

describe('bridgeSetCommandMetadata', () => {
  it('has correct command name', () => {
    expect(bridgeSetCommandMetadata.command).toBe('/ios.bridge.set');
  });

  it('documents --confirm option', () => {
    const optionNames = bridgeSetCommandMetadata.options.map((o) => o.name);
    expect(optionNames.some((n) => n.includes('--confirm'))).toBe(true);
  });
});
