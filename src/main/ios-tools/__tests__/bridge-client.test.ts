/**
 * Tests for MaestroBridge Client
 *
 * These tests verify the bridge client functionality for communicating with
 * the MaestroBridge Swift package running in iOS apps.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Mock External Dependencies
// =============================================================================

// Create mock request/response for http module
const mockRequest = {
  write: vi.fn(),
  end: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
};

const mockResponse = {
  statusCode: 200,
  on: vi.fn(),
  emit: vi.fn(),
};

// Mock http module
vi.mock('http', () => {
  return {
    default: {
      request: vi.fn((_options, callback) => {
        // Store callback for later use
        if (callback) {
          process.nextTick(() => callback(mockResponse));
        }
        return mockRequest;
      }),
    },
    request: vi.fn((_options, callback) => {
      if (callback) {
        process.nextTick(() => callback(mockResponse));
      }
      return mockRequest;
    }),
  };
});

// Mock logs module
vi.mock('../logs', () => ({
  getSystemLogText: vi.fn(),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock utils
vi.mock('../utils', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

// Import mocked modules
import { getSystemLogText } from '../logs';

// Import http for direct mocking
import * as http from 'http';

// Import the module under test
import {
  BridgeClient,
  extractTokenFromLogs,
  discoverBridgePort,
  discoverBridge,
  createBridgeClient,
  getCachedBridgeClient,
  waitForBridge,
  clearCachedBridgeClient,
  clearAllCachedBridgeClients,
  DEFAULT_BRIDGE_PORTS,
  DEFAULT_BRIDGE_HOST,
} from '../bridge-client';

// =============================================================================
// Tests: BridgeClient Class
// =============================================================================

describe('BridgeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllCachedBridgeClients();

    // Reset mock implementations
    mockRequest.write.mockReset();
    mockRequest.end.mockReset();
    mockRequest.destroy.mockReset();
    mockRequest.on.mockReset();
    mockResponse.on.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default values when no config provided', () => {
      const client = new BridgeClient();
      const config = client.getConfig();

      expect(config.host).toBe(DEFAULT_BRIDGE_HOST);
      expect(config.port).toBe(DEFAULT_BRIDGE_PORTS[0]);
      expect(config.token).toBe('');
    });

    it('should use provided config values', () => {
      const client = new BridgeClient({
        host: '192.168.1.100',
        port: 8080,
        token: 'test-token-123',
        timeout: 10000,
      });

      const config = client.getConfig();
      expect(config.host).toBe('192.168.1.100');
      expect(config.port).toBe(8080);
      expect(config.token).toBe('test-token-123');
      expect(config.timeout).toBe(10000);
    });
  });

  describe('setToken', () => {
    it('should update the authentication token', () => {
      const client = new BridgeClient();
      expect(client.getConfig().token).toBe('');

      client.setToken('new-token');
      expect(client.getConfig().token).toBe('new-token');
    });
  });

  describe('setPort', () => {
    it('should update the port', () => {
      const client = new BridgeClient();
      expect(client.getConfig().port).toBe(9876);

      client.setPort(9999);
      expect(client.getConfig().port).toBe(9999);
    });
  });
});

// =============================================================================
// Tests: Token Extraction
// =============================================================================

describe('extractTokenFromLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract token from logs with MaestroBridge prefix', async () => {
    // Use valid hex token (32+ hex chars with optional dashes)
    const validToken = 'abc123def456abc789def012abc345de';
    vi.mocked(getSystemLogText).mockResolvedValue({
      success: true,
      data: `
        Some log output here
        MaestroBridge: Token: ${validToken}
        More log output
      `,
    });

    const result = await extractTokenFromLogs('test-udid');

    expect(result.success).toBe(true);
    expect(result.data).toBe(validToken);
  });

  it('should extract token with bridge keyword', async () => {
    // Use valid hex token (32+ hex chars)
    const validToken = 'abcdef01234567890abcdef012345678';
    vi.mocked(getSystemLogText).mockResolvedValue({
      success: true,
      data: `
        bridge token: ${validToken}
      `,
    });

    const result = await extractTokenFromLogs('test-udid');

    expect(result.success).toBe(true);
    expect(result.data).toBe(validToken);
  });

  it('should return error when token not found', async () => {
    vi.mocked(getSystemLogText).mockResolvedValue({
      success: true,
      data: 'Some log output without a token',
    });

    const result = await extractTokenFromLogs('test-udid');

    expect(result.success).toBe(false);
    expect(result.error).toContain('token not found');
  });

  it('should return error when logs fail', async () => {
    vi.mocked(getSystemLogText).mockResolvedValue({
      success: false,
      error: 'Simulator not booted',
      errorCode: 'SIMULATOR_NOT_BOOTED',
    });

    const result = await extractTokenFromLogs('test-udid');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to get simulator logs');
  });
});

// =============================================================================
// Tests: Configuration
// =============================================================================

describe('Bridge Configuration', () => {
  it('should have correct default ports', () => {
    expect(DEFAULT_BRIDGE_PORTS).toEqual([9876, 9877, 9878, 9879, 9880]);
  });

  it('should have correct default host', () => {
    expect(DEFAULT_BRIDGE_HOST).toBe('127.0.0.1');
  });
});

// =============================================================================
// Tests: Type Definitions
// =============================================================================

describe('Type Definitions', () => {
  it('should export BridgeClient class', () => {
    expect(BridgeClient).toBeDefined();
    expect(typeof BridgeClient).toBe('function');
  });

  it('should create BridgeClient instance with config', () => {
    const client = new BridgeClient({
      host: '127.0.0.1',
      port: 9876,
      token: 'test',
      timeout: 5000,
    });

    expect(client).toBeInstanceOf(BridgeClient);
    expect(client.getConfig()).toMatchObject({
      host: '127.0.0.1',
      port: 9876,
      token: 'test',
      timeout: 5000,
    });
  });
});

// =============================================================================
// Tests: Client Caching
// =============================================================================

describe('Client Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllCachedBridgeClients();
  });

  it('should clear all cached clients', () => {
    // Just verify the function exists and runs without error
    expect(() => clearAllCachedBridgeClients()).not.toThrow();
  });

  it('should clear cached client for specific UDID', () => {
    expect(() => clearCachedBridgeClient('test-udid')).not.toThrow();
  });
});

// =============================================================================
// Tests: Bridge Auto-Discovery
// =============================================================================

describe('Bridge Auto-Discovery', () => {
  // Helper to set up mock for port discovery
  function setupPortDiscoveryMock(activePorts: number[]) {
    vi.mocked(http.request).mockImplementation((options: any, callback?: any) => {
      const port = options.port;
      const isActive = activePorts.includes(port);

      // Simulate response for active ports
      if (callback && isActive) {
        process.nextTick(() => {
          const res = {
            statusCode: 200, // Ping returns 200 for active bridge
            on: vi.fn((event: string, handler: (data?: string) => void) => {
              if (event === 'data') {
                process.nextTick(() => handler('{"status":"ok"}'));
              } else if (event === 'end') {
                process.nextTick(() => handler());
              }
            }),
          };
          callback(res);
        });
      }

      return {
        ...mockRequest,
        on: vi.fn((event: string, handler: () => void) => {
          // Simulate error for inactive ports
          if (event === 'error' && !isActive) {
            process.nextTick(() => handler());
          }
          return mockRequest;
        }),
      };
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllCachedBridgeClients();
  });

  describe('discoverBridgePort', () => {
    it('should find bridge on first default port', async () => {
      // Set up mock to respond on port 9876
      setupPortDiscoveryMock([9876]);

      const result = await discoverBridgePort();

      expect(result.success).toBe(true);
      expect(result.data).toBe(9876);
    });

    it('should find bridge on alternate port', async () => {
      // Set up mock to respond only on port 9878 (third in list)
      setupPortDiscoveryMock([9878]);

      const result = await discoverBridgePort();

      expect(result.success).toBe(true);
      expect(result.data).toBe(9878);
    });

    it('should return error when no bridge found on any port', async () => {
      // Set up mock to respond on no ports
      setupPortDiscoveryMock([]);

      const result = await discoverBridgePort();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No bridge found');
    });

    it('should try custom port list', async () => {
      setupPortDiscoveryMock([8080]);

      const result = await discoverBridgePort(DEFAULT_BRIDGE_HOST, [8080, 8081]);

      expect(result.success).toBe(true);
      expect(result.data).toBe(8080);
    });

    it('should use custom host', async () => {
      setupPortDiscoveryMock([9876]);

      const result = await discoverBridgePort('192.168.1.100');

      // Should still find it (mock doesn't care about host)
      expect(result.success).toBe(true);
    });
  });

  describe('discoverBridge', () => {
    it('should discover port without UDID', async () => {
      setupPortDiscoveryMock([9876]);

      const result = await discoverBridge();

      expect(result.success).toBe(true);
      expect(result.data?.port).toBe(9876);
      expect(result.data?.host).toBe(DEFAULT_BRIDGE_HOST);
      expect(result.data?.token).toBe(''); // No UDID means no token extraction
    });

    it('should discover port and extract token with UDID', async () => {
      setupPortDiscoveryMock([9876]);
      const validToken = 'abc123def456abc789def012abc345de';
      vi.mocked(getSystemLogText).mockResolvedValue({
        success: true,
        data: `MaestroBridge: Token: ${validToken}`,
      });

      const result = await discoverBridge('test-udid');

      expect(result.success).toBe(true);
      expect(result.data?.port).toBe(9876);
      expect(result.data?.token).toBe(validToken);
    });

    it('should succeed even if token extraction fails', async () => {
      setupPortDiscoveryMock([9876]);
      vi.mocked(getSystemLogText).mockResolvedValue({
        success: false,
        error: 'Simulator logs not available',
        errorCode: 'COMMAND_FAILED',
      });

      const result = await discoverBridge('test-udid');

      // Should still succeed, just without token
      expect(result.success).toBe(true);
      expect(result.data?.port).toBe(9876);
      expect(result.data?.token).toBe('');
    });

    it('should fail if port discovery fails', async () => {
      setupPortDiscoveryMock([]);

      const result = await discoverBridge();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No bridge found');
    });
  });

  describe('waitForBridge', () => {
    it('should return immediately if bridge is available', async () => {
      setupPortDiscoveryMock([9876]);

      const result = await waitForBridge(DEFAULT_BRIDGE_HOST, 9876, 5000, 100);

      expect(result.success).toBe(true);
    });

    it('should timeout if bridge never becomes available', async () => {
      setupPortDiscoveryMock([]); // No active ports

      const result = await waitForBridge(DEFAULT_BRIDGE_HOST, 9876, 100, 50);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
      expect(result.errorCode).toBe('TIMEOUT');
    });
  });

  describe('createBridgeClient', () => {
    it('should create client with explicit config', async () => {
      // Set up ping to succeed
      setupPortDiscoveryMock([9876]);

      const result = await createBridgeClient(undefined, {
        host: DEFAULT_BRIDGE_HOST,
        port: 9876,
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(BridgeClient);
    });

    it('should create client via auto-discovery', async () => {
      setupPortDiscoveryMock([9876]);

      const result = await createBridgeClient();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(BridgeClient);
    });

    it('should fail if bridge not reachable', async () => {
      setupPortDiscoveryMock([]);

      const result = await createBridgeClient();

      expect(result.success).toBe(false);
    });
  });

  describe('getCachedBridgeClient', () => {
    it('should cache client after first creation', async () => {
      setupPortDiscoveryMock([9876]);

      // First call creates the client
      const result1 = await getCachedBridgeClient('test-udid');
      expect(result1.success).toBe(true);

      // Second call should use cached client
      const result2 = await getCachedBridgeClient('test-udid');
      expect(result2.success).toBe(true);
      expect(result2.data).toBe(result1.data);
    });

    it('should clear cache for specific UDID', async () => {
      setupPortDiscoveryMock([9876]);

      // Create cached client
      const result1 = await getCachedBridgeClient('test-udid');
      expect(result1.success).toBe(true);

      // Clear cache
      clearCachedBridgeClient('test-udid');

      // Next call should create new client
      const result2 = await getCachedBridgeClient('test-udid');
      expect(result2.success).toBe(true);
      // Note: We can't easily verify it's a different instance without internal access
    });

    it('should maintain separate cache entries per UDID', async () => {
      setupPortDiscoveryMock([9876, 9877]);

      const result1 = await getCachedBridgeClient('udid-1');
      const result2 = await getCachedBridgeClient('udid-2');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Different UDIDs could potentially have different clients
    });
  });
});

// =============================================================================
// Tests: Bridge Discovery Integration
// =============================================================================

describe('Bridge Discovery Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllCachedBridgeClients();
  });

  it('should handle 401 unauthorized as valid bridge response (port is active)', async () => {
    // A 401 means the bridge is running but needs a token
    vi.mocked(http.request).mockImplementation((options: any, callback?: any) => {
      if (callback) {
        process.nextTick(() => {
          const res = {
            statusCode: 401,
            on: vi.fn(),
          };
          callback(res);
        });
      }
      return {
        ...mockRequest,
        on: vi.fn().mockReturnValue(mockRequest),
      };
    });

    const result = await discoverBridgePort();

    // 401 should be treated as "port is active" for discovery
    expect(result.success).toBe(true);
    expect(result.data).toBe(9876);
  });

  it('should export all discovery functions', () => {
    expect(typeof discoverBridgePort).toBe('function');
    expect(typeof discoverBridge).toBe('function');
    expect(typeof createBridgeClient).toBe('function');
    expect(typeof getCachedBridgeClient).toBe('function');
    expect(typeof waitForBridge).toBe('function');
    expect(typeof clearCachedBridgeClient).toBe('function');
    expect(typeof clearAllCachedBridgeClients).toBe('function');
  });
});
