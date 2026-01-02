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

// Import the module under test
import {
  BridgeClient,
  extractTokenFromLogs,
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
});
