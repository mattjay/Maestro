/**
 * iOS Tools - MaestroBridge Client
 *
 * TypeScript client for communicating with the MaestroBridge Swift package
 * running in iOS apps for introspection and state management.
 */

import * as http from 'http';
import { IOSResult } from './types';
import { getSystemLogText } from './logs';
import { logger } from '../utils/logger';
import { sleep } from './utils';

const LOG_CONTEXT = '[iOS-Bridge]';

// =============================================================================
// Types
// =============================================================================

/**
 * Bridge connection configuration
 */
export interface BridgeConfig {
  /** Host address (default: 127.0.0.1) */
  host?: string;
  /** Port number (default: 9876) */
  port?: number;
  /** Authentication token */
  token?: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * App state snapshot from the bridge
 */
export interface AppState {
  /** Timestamp of the snapshot */
  timestamp: string;
  /** View controller navigation stack */
  viewControllerStack: string[];
  /** Current active view controller */
  currentViewController: string;
  /** Custom state registered by the app */
  customState: Record<string, unknown>;
  /** Feature flags */
  featureFlags: Record<string, boolean | { enabled: boolean; variant?: string }>;
}

/**
 * Route/navigation info from the bridge
 */
export interface RouteInfo {
  /** Current route path */
  currentRoute: string;
  /** Navigation stack */
  stack: Array<{ route: string; title: string }>;
  /** Whether back navigation is possible */
  canGoBack: boolean;
  /** Whether current view is presented modally */
  presentedModally: boolean;
}

/**
 * Network request log entry
 */
export interface NetworkRequestEntry {
  /** Request identifier */
  id: string;
  /** Request URL */
  url: string;
  /** HTTP method */
  method: string;
  /** Response status code */
  status: number;
  /** Request duration in milliseconds */
  duration: number;
  /** Request timestamp */
  timestamp: string;
  /** Request headers (sensitive values redacted) */
  requestHeaders: Record<string, string>;
  /** Response body size in bytes */
  responseSize: number;
}

/**
 * Network request log
 */
export interface NetworkLog {
  /** List of network requests */
  requests: NetworkRequestEntry[];
  /** Total request count */
  count: number;
  /** Number of failed requests */
  errors: number;
}

/**
 * Analytics event
 */
export interface AnalyticsEvent {
  /** Event name */
  name: string;
  /** Event properties */
  properties: Record<string, unknown>;
  /** Event timestamp */
  timestamp: string;
}

/**
 * Analytics log
 */
export interface AnalyticsLog {
  /** List of analytics events */
  events: AnalyticsEvent[];
  /** Total event count */
  count: number;
}

/**
 * Feature flag entry
 */
export interface FeatureFlagEntry {
  /** Whether the flag is enabled */
  enabled: boolean;
  /** Optional variant for A/B testing */
  variant?: string;
}

/**
 * Feature flags response
 */
export interface FeatureFlags {
  /** Map of flag name to flag entry */
  flags: Record<string, FeatureFlagEntry>;
}

/**
 * Bridge discovery result
 */
export interface BridgeDiscoveryResult {
  /** Host address */
  host: string;
  /** Port number */
  port: number;
  /** Authentication token */
  token: string;
}

// =============================================================================
// Default Ports
// =============================================================================

/**
 * Default ports to try when discovering the bridge
 */
export const DEFAULT_BRIDGE_PORTS = [9876, 9877, 9878, 9879, 9880];

/**
 * Default host for bridge connections
 */
export const DEFAULT_BRIDGE_HOST = '127.0.0.1';

/**
 * Default timeout for requests
 */
export const DEFAULT_TIMEOUT = 5000;

// =============================================================================
// Bridge Client Class
// =============================================================================

/**
 * Client for communicating with MaestroBridge in iOS apps.
 */
export class BridgeClient {
  private host: string;
  private port: number;
  private token: string;
  private timeout: number;

  constructor(config: BridgeConfig = {}) {
    this.host = config.host || DEFAULT_BRIDGE_HOST;
    this.port = config.port || DEFAULT_BRIDGE_PORTS[0];
    this.token = config.token || '';
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Update the authentication token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Update the port
   */
  setPort(port: number): void {
    this.port = port;
  }

  /**
   * Get the current configuration
   */
  getConfig(): BridgeConfig {
    return {
      host: this.host,
      port: this.port,
      token: this.token,
      timeout: this.timeout,
    };
  }

  // ===========================================================================
  // Core HTTP Methods
  // ===========================================================================

  /**
   * Make an HTTP request to the bridge
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<IOSResult<T>> {
    return new Promise((resolve) => {
      const options: http.RequestOptions = {
        hostname: this.host,
        port: this.port,
        path,
        method,
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // Add authorization header if token is set
      if (this.token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${this.token}`,
        };
      }

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          // Handle non-success status codes
          if (res.statusCode && res.statusCode >= 400) {
            let errorMessage = `HTTP ${res.statusCode}`;
            try {
              const errorJson = JSON.parse(data);
              errorMessage = errorJson.error || errorJson.message || errorMessage;
            } catch {
              if (data) {
                errorMessage = data;
              }
            }
            resolve({
              success: false,
              error: errorMessage,
              errorCode: res.statusCode === 401 ? 'COMMAND_FAILED' : 'COMMAND_FAILED',
            });
            return;
          }

          // Parse successful response
          try {
            const parsed = JSON.parse(data) as T;
            resolve({
              success: true,
              data: parsed,
            });
          } catch (e) {
            resolve({
              success: false,
              error: `Failed to parse response: ${e instanceof Error ? e.message : 'Unknown error'}`,
              errorCode: 'PARSE_ERROR',
            });
          }
        });
      });

      req.on('error', (e) => {
        let errorCode: 'TIMEOUT' | 'COMMAND_FAILED' = 'COMMAND_FAILED';
        let errorMessage = e.message;

        if (e.message.includes('ECONNREFUSED')) {
          errorMessage = `Bridge not reachable at ${this.host}:${this.port}`;
        } else if (e.message.includes('ETIMEDOUT') || e.message.includes('ESOCKETTIMEDOUT')) {
          errorCode = 'TIMEOUT';
          errorMessage = `Request timed out after ${this.timeout}ms`;
        }

        resolve({
          success: false,
          error: errorMessage,
          errorCode,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: `Request timed out after ${this.timeout}ms`,
          errorCode: 'TIMEOUT',
        });
      });

      // Write body if present
      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  // ===========================================================================
  // Bridge API Methods
  // ===========================================================================

  /**
   * Ping the bridge to check if it's alive
   */
  async ping(): Promise<boolean> {
    const result = await this.request<{ status: string }>('GET', '/ping');
    return result.success && result.data?.status === 'ok';
  }

  /**
   * Get the full app state snapshot
   */
  async getState(): Promise<IOSResult<AppState>> {
    return this.request<AppState>('GET', '/state');
  }

  /**
   * Get a specific state key
   */
  async getStateKey(key: string): Promise<IOSResult<unknown>> {
    return this.request<unknown>('GET', `/state/${encodeURIComponent(key)}`);
  }

  /**
   * Get current route/navigation state
   */
  async getRoute(): Promise<IOSResult<RouteInfo>> {
    return this.request<RouteInfo>('GET', '/route');
  }

  /**
   * Get full navigation stack
   */
  async getRouteStack(): Promise<IOSResult<RouteInfo>> {
    return this.request<RouteInfo>('GET', '/route/stack');
  }

  /**
   * Get navigation history
   */
  async getRouteHistory(): Promise<IOSResult<RouteInfo>> {
    return this.request<RouteInfo>('GET', '/route/history');
  }

  /**
   * Get network request log
   */
  async getNetwork(options?: { limit?: number; errorsOnly?: boolean }): Promise<IOSResult<NetworkLog>> {
    let path = '/network';
    const params: string[] = [];

    if (options?.limit) {
      params.push(`limit=${options.limit}`);
    }
    if (options?.errorsOnly) {
      params.push('errors=true');
    }
    if (params.length > 0) {
      path += '?' + params.join('&');
    }

    return this.request<NetworkLog>('GET', path);
  }

  /**
   * Get details of a specific network request
   */
  async getNetworkDetail(id: string): Promise<IOSResult<NetworkRequestEntry>> {
    return this.request<NetworkRequestEntry>('GET', `/network/${encodeURIComponent(id)}`);
  }

  /**
   * Clear network request log
   */
  async clearNetwork(): Promise<IOSResult<void>> {
    return this.request<void>('DELETE', '/network');
  }

  /**
   * Get analytics events log
   */
  async getAnalytics(options?: { filter?: string; limit?: number }): Promise<IOSResult<AnalyticsLog>> {
    let path = '/analytics';
    const params: string[] = [];

    if (options?.filter) {
      params.push(`filter=${encodeURIComponent(options.filter)}`);
    }
    if (options?.limit) {
      params.push(`limit=${options.limit}`);
    }
    if (params.length > 0) {
      path += '?' + params.join('&');
    }

    return this.request<AnalyticsLog>('GET', path);
  }

  /**
   * Get analytics sources
   */
  async getAnalyticsSources(): Promise<IOSResult<{ sources: string[] }>> {
    return this.request<{ sources: string[] }>('GET', '/analytics/sources');
  }

  /**
   * Clear analytics events
   */
  async clearAnalytics(): Promise<IOSResult<void>> {
    return this.request<void>('DELETE', '/analytics');
  }

  /**
   * Get all feature flags
   */
  async getFlags(): Promise<IOSResult<FeatureFlags>> {
    return this.request<FeatureFlags>('GET', '/flags');
  }

  /**
   * Get a specific feature flag
   */
  async getFlag(name: string): Promise<IOSResult<FeatureFlagEntry>> {
    return this.request<FeatureFlagEntry>('GET', `/flags/${encodeURIComponent(name)}`);
  }

  /**
   * Set test state (requires explicit opt-in from app and additional token)
   */
  async setState(key: string, value: unknown, additionalToken?: string): Promise<IOSResult<void>> {
    const body: { key: string; value: unknown; token?: string } = { key, value };
    if (additionalToken) {
      body.token = additionalToken;
    }
    return this.request<void>('POST', '/state/set', body);
  }
}

// =============================================================================
// Bridge Discovery Functions
// =============================================================================

/**
 * Try to connect to bridge on a specific port
 */
async function tryPort(host: string, port: number, timeout: number = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: host,
      port,
      path: '/ping',
      method: 'GET',
      timeout,
    }, (res) => {
      // Any response means the port is active
      resolve(res.statusCode === 200 || res.statusCode === 401);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Discover the bridge by trying known ports
 */
export async function discoverBridgePort(
  host: string = DEFAULT_BRIDGE_HOST,
  ports: number[] = DEFAULT_BRIDGE_PORTS
): Promise<IOSResult<number>> {
  logger.info(`${LOG_CONTEXT} Discovering bridge on ${host}...`);

  for (const port of ports) {
    logger.debug(`${LOG_CONTEXT} Trying port ${port}...`);
    const isAlive = await tryPort(host, port);

    if (isAlive) {
      logger.info(`${LOG_CONTEXT} Found bridge on port ${port}`);
      return {
        success: true,
        data: port,
      };
    }
  }

  return {
    success: false,
    error: `No bridge found on ports: ${ports.join(', ')}`,
    errorCode: 'COMMAND_FAILED',
  };
}

/**
 * Extract bridge token from simulator logs
 * The bridge outputs a token when it starts that looks like:
 * "MaestroBridge: Token: <token>"
 */
export async function extractTokenFromLogs(
  udid: string,
  since?: Date
): Promise<IOSResult<string>> {
  logger.info(`${LOG_CONTEXT} Extracting bridge token from simulator logs...`);

  // Get recent logs
  const logsResult = await getSystemLogText(udid, since || new Date(Date.now() - 60000));

  if (!logsResult.success) {
    return {
      success: false,
      error: `Failed to get simulator logs: ${logsResult.error}`,
      errorCode: logsResult.errorCode,
    };
  }

  // Look for the token pattern in logs
  // Pattern: "Token: <hex-token>..." or similar
  const tokenPatterns = [
    /MaestroBridge.*Token:\s*([a-fA-F0-9-]{32,})/,
    /bridge.*token[:\s]+([a-fA-F0-9-]{32,})/i,
    /Token:\s*([a-fA-F0-9-]{32,})/,
  ];

  const logs = logsResult.data || '';

  for (const pattern of tokenPatterns) {
    const match = logs.match(pattern);
    if (match && match[1]) {
      logger.info(`${LOG_CONTEXT} Found token in logs`);
      return {
        success: true,
        data: match[1],
      };
    }
  }

  return {
    success: false,
    error: 'Bridge token not found in simulator logs. Make sure MaestroBridge is running.',
    errorCode: 'COMMAND_FAILED',
  };
}

/**
 * Auto-discover bridge and extract token
 */
export async function discoverBridge(
  udid?: string,
  host: string = DEFAULT_BRIDGE_HOST
): Promise<IOSResult<BridgeDiscoveryResult>> {
  logger.info(`${LOG_CONTEXT} Auto-discovering bridge...`);

  // First, find the port
  const portResult = await discoverBridgePort(host);
  if (!portResult.success) {
    return {
      success: false,
      error: portResult.error,
      errorCode: portResult.errorCode,
    };
  }

  const port = portResult.data!;
  let token = '';

  // Try to extract token from logs if we have a UDID
  if (udid) {
    const tokenResult = await extractTokenFromLogs(udid);
    if (tokenResult.success) {
      token = tokenResult.data!;
    } else {
      logger.warn(`${LOG_CONTEXT} Could not extract token from logs: ${tokenResult.error}`);
    }
  }

  return {
    success: true,
    data: {
      host,
      port,
      token,
    },
  };
}

/**
 * Create a connected bridge client through auto-discovery
 */
export async function createBridgeClient(
  udid?: string,
  config?: BridgeConfig
): Promise<IOSResult<BridgeClient>> {
  // If full config is provided, just create the client
  if (config?.port && config?.token) {
    const client = new BridgeClient(config);

    // Verify connection
    const isAlive = await client.ping();
    if (!isAlive) {
      return {
        success: false,
        error: `Bridge not reachable at ${config.host || DEFAULT_BRIDGE_HOST}:${config.port}`,
        errorCode: 'COMMAND_FAILED',
      };
    }

    return {
      success: true,
      data: client,
    };
  }

  // Auto-discover
  const discoveryResult = await discoverBridge(udid, config?.host);
  if (!discoveryResult.success) {
    return {
      success: false,
      error: discoveryResult.error,
      errorCode: discoveryResult.errorCode,
    };
  }

  const discovery = discoveryResult.data!;
  const client = new BridgeClient({
    host: discovery.host,
    port: discovery.port,
    token: discovery.token,
    timeout: config?.timeout,
  });

  // Verify connection with ping
  const isAlive = await client.ping();
  if (!isAlive) {
    // Try without token (maybe auth is disabled)
    client.setToken('');
    const isAliveWithoutToken = await client.ping();
    if (!isAliveWithoutToken) {
      return {
        success: false,
        error: `Bridge found but not responding at ${discovery.host}:${discovery.port}`,
        errorCode: 'COMMAND_FAILED',
      };
    }
    logger.info(`${LOG_CONTEXT} Bridge connected (no auth)`);
  }

  return {
    success: true,
    data: client,
  };
}

// =============================================================================
// Connection Cache
// =============================================================================

/**
 * Cached bridge clients by UDID
 */
const clientCache = new Map<string, { client: BridgeClient; expiry: number }>();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get or create a cached bridge client for a simulator
 */
export async function getCachedBridgeClient(
  udid: string,
  config?: BridgeConfig
): Promise<IOSResult<BridgeClient>> {
  const cacheKey = udid;
  const cached = clientCache.get(cacheKey);

  // Check if cached client is still valid
  if (cached && cached.expiry > Date.now()) {
    // Verify it's still connected
    const isAlive = await cached.client.ping();
    if (isAlive) {
      logger.debug(`${LOG_CONTEXT} Using cached bridge client for ${udid}`);
      return {
        success: true,
        data: cached.client,
      };
    }
    // Remove stale cache entry
    clientCache.delete(cacheKey);
  }

  // Create new client
  const result = await createBridgeClient(udid, config);
  if (result.success) {
    clientCache.set(cacheKey, {
      client: result.data!,
      expiry: Date.now() + CACHE_TTL,
    });
  }

  return result;
}

/**
 * Clear cached client for a simulator
 */
export function clearCachedBridgeClient(udid: string): void {
  clientCache.delete(udid);
}

/**
 * Clear all cached clients
 */
export function clearAllCachedBridgeClients(): void {
  clientCache.clear();
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Wait for bridge to become available
 */
export async function waitForBridge(
  host: string = DEFAULT_BRIDGE_HOST,
  port: number = DEFAULT_BRIDGE_PORTS[0],
  timeout: number = 30000,
  interval: number = 1000
): Promise<IOSResult<void>> {
  logger.info(`${LOG_CONTEXT} Waiting for bridge at ${host}:${port}...`);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const isAlive = await tryPort(host, port);
    if (isAlive) {
      logger.info(`${LOG_CONTEXT} Bridge is ready`);
      return { success: true };
    }

    await sleep(interval);
  }

  return {
    success: false,
    error: `Timeout waiting for bridge at ${host}:${port}`,
    errorCode: 'TIMEOUT',
  };
}
