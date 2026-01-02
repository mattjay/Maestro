/**
 * iOS Tools - Autocomplete Provider
 *
 * Provides intelligent autocomplete suggestions for iOS slash commands.
 * This module caches and serves completions for:
 * - Simulator names from available list
 * - Bundle IDs from installed apps
 * - Scheme names from project
 * - Flow file paths
 * - Baseline names
 * - Element identifiers from last inspect
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { logger } from '../utils/logger';
import { listSimulators, getBootedSimulators } from './simulator';
import { Simulator } from './types';

const LOG_CONTEXT = '[iOS-Autocomplete]';

// =============================================================================
// Types
// =============================================================================

/**
 * Type of completion being requested
 */
export type CompletionType =
  | 'simulator'
  | 'bundleId'
  | 'scheme'
  | 'flow'
  | 'baseline'
  | 'element'
  | 'command';

/**
 * A single completion item
 */
export interface CompletionItem {
  /** The completion value */
  value: string;
  /** Display label (may include additional context) */
  label: string;
  /** Optional description */
  description?: string;
  /** Category for grouping */
  category?: string;
  /** Sort priority (lower = higher priority) */
  priority?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a completion request
 */
export interface CompletionResult {
  /** Whether completion was successful */
  success: boolean;
  /** Type of completions returned */
  type: CompletionType;
  /** List of completion items */
  items: CompletionItem[];
  /** Error message if unsuccessful */
  error?: string;
  /** Whether results are from cache */
  fromCache: boolean;
  /** Time to generate completions (ms) */
  durationMs: number;
}

/**
 * Options for fetching completions
 */
export interface CompletionOptions {
  /** Project path for context-aware completions */
  projectPath?: string;
  /** Simulator UDID for simulator-specific completions */
  simulatorUdid?: string;
  /** Filter prefix (partial input to filter by) */
  prefix?: string;
  /** Maximum number of items to return */
  limit?: number;
  /** Whether to include booted simulators first */
  preferBooted?: boolean;
  /** Whether to force cache refresh */
  forceRefresh?: boolean;
}

/**
 * Cached element info from last inspect
 */
interface CachedElement {
  identifier?: string;
  label?: string;
  type: string;
  text?: string;
  frame?: { x: number; y: number; width: number; height: number };
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Cache TTLs in milliseconds
const CACHE_TTL = {
  simulators: 30000, // 30 seconds (simulators change infrequently)
  bundleIds: 60000, // 1 minute
  schemes: 300000, // 5 minutes (project structure rarely changes)
  flows: 60000, // 1 minute (files can be added/removed)
  baselines: 60000, // 1 minute
  elements: 0, // No expiration, only invalidated explicitly
};

// In-memory caches
const cache = {
  simulators: null as CacheEntry<CompletionItem[]> | null,
  bundleIds: new Map<string, CacheEntry<CompletionItem[]>>(), // keyed by simulator UDID
  schemes: new Map<string, CacheEntry<CompletionItem[]>>(), // keyed by project path
  flows: new Map<string, CacheEntry<CompletionItem[]>>(), // keyed by project path
  baselines: new Map<string, CacheEntry<CompletionItem[]>>(), // keyed by project path
  elements: null as CacheEntry<CachedElement[]> | null,
};

/**
 * Check if cache entry is still valid
 */
function isCacheValid<T>(entry: CacheEntry<T> | null | undefined): boolean {
  if (!entry) return false;
  if (entry.expiresAt === 0) return true; // Never expires
  return Date.now() < entry.expiresAt;
}

/**
 * Create a cache entry
 */
function createCacheEntry<T>(data: T, ttl: number): CacheEntry<T> {
  const now = Date.now();
  return {
    data,
    timestamp: now,
    expiresAt: ttl > 0 ? now + ttl : 0,
  };
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  cache.simulators = null;
  cache.bundleIds.clear();
  cache.schemes.clear();
  cache.flows.clear();
  cache.baselines.clear();
  cache.elements = null;
  logger.info(`${LOG_CONTEXT} All caches cleared`);
}

/**
 * Clear a specific cache type
 */
export function clearCache(type: CompletionType, key?: string): void {
  switch (type) {
    case 'simulator':
      cache.simulators = null;
      break;
    case 'bundleId':
      if (key) {
        cache.bundleIds.delete(key);
      } else {
        cache.bundleIds.clear();
      }
      break;
    case 'scheme':
      if (key) {
        cache.schemes.delete(key);
      } else {
        cache.schemes.clear();
      }
      break;
    case 'flow':
      if (key) {
        cache.flows.delete(key);
      } else {
        cache.flows.clear();
      }
      break;
    case 'baseline':
      if (key) {
        cache.baselines.delete(key);
      } else {
        cache.baselines.clear();
      }
      break;
    case 'element':
      cache.elements = null;
      break;
  }
  logger.debug(`${LOG_CONTEXT} Cache cleared: ${type}${key ? ` (${key})` : ''}`);
}

// =============================================================================
// Simulator Completions
// =============================================================================

/**
 * Get completion items for simulator names.
 *
 * Returns simulators with booted simulators first, then by iOS version.
 *
 * @param options - Completion options
 * @returns Completion result with simulator names
 */
export async function getSimulatorCompletions(
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const startTime = Date.now();

  // Check cache
  if (!options.forceRefresh && isCacheValid(cache.simulators)) {
    const items = filterAndLimit(cache.simulators!.data, options);
    return {
      success: true,
      type: 'simulator',
      items,
      fromCache: true,
      durationMs: Date.now() - startTime,
    };
  }

  // Fetch fresh data
  const result = await listSimulators();
  if (!result.success || !result.data) {
    return {
      success: false,
      type: 'simulator',
      items: [],
      error: result.error || 'Failed to list simulators',
      fromCache: false,
      durationMs: Date.now() - startTime,
    };
  }

  const simulators = result.data;

  // Convert to completion items
  const items: CompletionItem[] = simulators
    .filter((sim) => sim.isAvailable)
    .map((sim) => ({
      value: sim.name,
      label: sim.name,
      description: `iOS ${sim.iosVersion}${sim.state === 'Booted' ? ' (Booted)' : ''}`,
      category: sim.state === 'Booted' ? 'Booted' : 'Available',
      priority: sim.state === 'Booted' ? 0 : 1,
      metadata: {
        udid: sim.udid,
        iosVersion: sim.iosVersion,
        state: sim.state,
        deviceType: sim.deviceType,
      },
    }))
    .sort((a, b) => {
      // Sort by booted first, then by iOS version
      if (a.priority !== b.priority) {
        return (a.priority || 0) - (b.priority || 0);
      }
      const aVersion = (a.metadata?.iosVersion as string) || '0';
      const bVersion = (b.metadata?.iosVersion as string) || '0';
      return compareVersions(bVersion, aVersion);
    });

  // Cache results
  cache.simulators = createCacheEntry(items, CACHE_TTL.simulators);

  return {
    success: true,
    type: 'simulator',
    items: filterAndLimit(items, options),
    fromCache: false,
    durationMs: Date.now() - startTime,
  };
}

// =============================================================================
// Bundle ID Completions
// =============================================================================

/**
 * Get completion items for bundle IDs of installed apps.
 *
 * @param options - Completion options (requires simulatorUdid for installed apps)
 * @returns Completion result with bundle IDs
 */
export async function getBundleIdCompletions(
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const startTime = Date.now();

  // Determine which simulator to use
  let simulatorUdid = options.simulatorUdid;

  if (!simulatorUdid) {
    // Try to use first booted simulator
    const bootedResult = await getBootedSimulators();
    if (bootedResult.success && bootedResult.data && bootedResult.data.length > 0) {
      simulatorUdid = bootedResult.data[0].udid;
    } else {
      return {
        success: false,
        type: 'bundleId',
        items: [],
        error: 'No booted simulator found. Boot a simulator first.',
        fromCache: false,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // Check cache
  const cacheKey = simulatorUdid;
  if (!options.forceRefresh && isCacheValid(cache.bundleIds.get(cacheKey))) {
    const items = filterAndLimit(cache.bundleIds.get(cacheKey)!.data, options);
    return {
      success: true,
      type: 'bundleId',
      items,
      fromCache: true,
      durationMs: Date.now() - startTime,
    };
  }

  // Get installed apps via simctl
  const { execFileNoThrow } = await import('../utils/execFile');
  const result = await execFileNoThrow(
    'xcrun',
    ['simctl', 'listapps', simulatorUdid, '--json'],
    undefined
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      type: 'bundleId',
      items: [],
      error: `Failed to list apps: ${result.stderr}`,
      fromCache: false,
      durationMs: Date.now() - startTime,
    };
  }

  // Parse app list
  let apps: Record<string, { CFBundleDisplayName?: string; CFBundleName?: string }> = {};
  try {
    apps = JSON.parse(result.stdout);
  } catch (e) {
    return {
      success: false,
      type: 'bundleId',
      items: [],
      error: 'Failed to parse app list',
      fromCache: false,
      durationMs: Date.now() - startTime,
    };
  }

  // Convert to completion items
  const items: CompletionItem[] = Object.entries(apps)
    .map(([bundleId, info]) => {
      const displayName = info.CFBundleDisplayName || info.CFBundleName || bundleId;
      // Filter out Apple system apps to reduce noise
      const isSystemApp = bundleId.startsWith('com.apple.');
      return {
        value: bundleId,
        label: bundleId,
        description: displayName,
        category: isSystemApp ? 'System' : 'User',
        priority: isSystemApp ? 1 : 0,
      };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return (a.priority || 0) - (b.priority || 0);
      }
      return a.value.localeCompare(b.value);
    });

  // Cache results
  cache.bundleIds.set(cacheKey, createCacheEntry(items, CACHE_TTL.bundleIds));

  return {
    success: true,
    type: 'bundleId',
    items: filterAndLimit(items, options),
    fromCache: false,
    durationMs: Date.now() - startTime,
  };
}

// =============================================================================
// Scheme Completions
// =============================================================================

/**
 * Get completion items for Xcode scheme names.
 *
 * @param options - Completion options (requires projectPath)
 * @returns Completion result with scheme names
 */
export async function getSchemeCompletions(
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const startTime = Date.now();

  const projectPath = options.projectPath;
  if (!projectPath) {
    return {
      success: false,
      type: 'scheme',
      items: [],
      error: 'Project path is required for scheme completions',
      fromCache: false,
      durationMs: Date.now() - startTime,
    };
  }

  // Check cache
  if (!options.forceRefresh && isCacheValid(cache.schemes.get(projectPath))) {
    const items = filterAndLimit(cache.schemes.get(projectPath)!.data, options);
    return {
      success: true,
      type: 'scheme',
      items,
      fromCache: true,
      durationMs: Date.now() - startTime,
    };
  }

  // Use project detection to get schemes
  const { detectProjectType } = await import('./setup/detector');
  const result = await detectProjectType(projectPath);

  if (!result.success || !result.data?.found) {
    return {
      success: false,
      type: 'scheme',
      items: [],
      error: result.error || 'No iOS project found',
      fromCache: false,
      durationMs: Date.now() - startTime,
    };
  }

  // Convert to completion items
  const items: CompletionItem[] = result.data.schemes.map((scheme) => ({
    value: scheme.name,
    label: scheme.name,
    description: scheme.isUITest
      ? 'UI Test'
      : scheme.isTest
        ? 'Test'
        : 'App',
    category: scheme.isUITest ? 'UI Tests' : scheme.isTest ? 'Tests' : 'Apps',
    priority: scheme.isUITest ? 2 : scheme.isTest ? 1 : 0,
  }));

  // Cache results
  cache.schemes.set(projectPath, createCacheEntry(items, CACHE_TTL.schemes));

  return {
    success: true,
    type: 'scheme',
    items: filterAndLimit(items, options),
    fromCache: false,
    durationMs: Date.now() - startTime,
  };
}

// =============================================================================
// Flow File Completions
// =============================================================================

/**
 * Get completion items for Maestro flow file paths.
 *
 * @param options - Completion options (requires projectPath)
 * @returns Completion result with flow file paths
 */
export async function getFlowCompletions(
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const startTime = Date.now();

  const projectPath = options.projectPath;
  if (!projectPath) {
    return {
      success: false,
      type: 'flow',
      items: [],
      error: 'Project path is required for flow completions',
      fromCache: false,
      durationMs: Date.now() - startTime,
    };
  }

  // Check cache
  if (!options.forceRefresh && isCacheValid(cache.flows.get(projectPath))) {
    const items = filterAndLimit(cache.flows.get(projectPath)!.data, options);
    return {
      success: true,
      type: 'flow',
      items,
      fromCache: true,
      durationMs: Date.now() - startTime,
    };
  }

  // Find flow files in common locations
  const flowLocations = [
    path.join(projectPath, 'maestro'),
    path.join(projectPath, '.maestro', 'flows'),
    path.join(projectPath, 'flows'),
    path.join(projectPath, 'e2e'),
  ];

  const items: CompletionItem[] = [];

  for (const dir of flowLocations) {
    if (!existsSync(dir)) continue;

    try {
      const flowFiles = await findFlowFiles(dir);
      for (const file of flowFiles) {
        const relativePath = path.relative(projectPath, file);
        const fileName = path.basename(file, path.extname(file));

        items.push({
          value: relativePath,
          label: fileName,
          description: relativePath,
          category: path.dirname(relativePath),
          priority: 0,
          metadata: {
            absolutePath: file,
            directory: path.dirname(file),
          },
        });
      }
    } catch (e) {
      // Ignore errors reading directories
    }
  }

  // Sort by path
  items.sort((a, b) => a.value.localeCompare(b.value));

  // Cache results
  cache.flows.set(projectPath, createCacheEntry(items, CACHE_TTL.flows));

  return {
    success: true,
    type: 'flow',
    items: filterAndLimit(items, options),
    fromCache: false,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Recursively find flow files (.yaml, .yml) in a directory
 */
async function findFlowFiles(dir: string, maxDepth = 3, currentDepth = 0): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];

  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden and common non-flow directories
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        const subFiles = await findFlowFiles(fullPath, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.yaml' || ext === '.yml') {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  return files;
}

// =============================================================================
// Baseline Completions
// =============================================================================

/**
 * Get completion items for baseline names.
 *
 * @param options - Completion options (requires projectPath)
 * @returns Completion result with baseline names
 */
export async function getBaselineCompletions(
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const startTime = Date.now();

  const projectPath = options.projectPath;
  if (!projectPath) {
    return {
      success: false,
      type: 'baseline',
      items: [],
      error: 'Project path is required for baseline completions',
      fromCache: false,
      durationMs: Date.now() - startTime,
    };
  }

  // Check cache
  if (!options.forceRefresh && isCacheValid(cache.baselines.get(projectPath))) {
    const items = filterAndLimit(cache.baselines.get(projectPath)!.data, options);
    return {
      success: true,
      type: 'baseline',
      items,
      fromCache: true,
      durationMs: Date.now() - startTime,
    };
  }

  // Find baseline files in common locations
  const baselineLocations = [
    path.join(projectPath, 'ios-baselines'),
    path.join(projectPath, '.maestro', 'baselines'),
    path.join(projectPath, 'baselines'),
    path.join(projectPath, 'screenshots', 'baselines'),
  ];

  const items: CompletionItem[] = [];

  for (const dir of baselineLocations) {
    if (!existsSync(dir)) continue;

    try {
      const baselineFiles = await findBaselineFiles(dir);
      for (const file of baselineFiles) {
        const relativePath = path.relative(projectPath, file);
        const fileName = path.basename(file, path.extname(file));

        items.push({
          value: fileName,
          label: fileName,
          description: relativePath,
          category: path.dirname(relativePath),
          priority: 0,
          metadata: {
            absolutePath: file,
            directory: path.dirname(file),
          },
        });
      }
    } catch {
      // Ignore errors reading directories
    }
  }

  // Also check for metadata.json files that define baselines
  for (const dir of baselineLocations) {
    if (!existsSync(dir)) continue;

    try {
      const metadataFiles = await findMetadataFiles(dir);
      for (const file of metadataFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const metadata = JSON.parse(content);
          if (metadata.name && !items.find((i) => i.value === metadata.name)) {
            items.push({
              value: metadata.name,
              label: metadata.name,
              description: metadata.description || path.relative(projectPath, path.dirname(file)),
              category: 'Defined',
              priority: 0,
            });
          }
        } catch {
          // Ignore parse errors
        }
      }
    } catch {
      // Ignore errors
    }
  }

  // Sort by name
  items.sort((a, b) => a.label.localeCompare(b.label));

  // Cache results
  cache.baselines.set(projectPath, createCacheEntry(items, CACHE_TTL.baselines));

  return {
    success: true,
    type: 'baseline',
    items: filterAndLimit(items, options),
    fromCache: false,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Find baseline image files in a directory
 */
async function findBaselineFiles(dir: string, maxDepth = 3, currentDepth = 0): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];

  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue;
        const subFiles = await findBaselineFiles(fullPath, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // Include PNG/JPG files but exclude diff/mask images
        if ((ext === '.png' || ext === '.jpg' || ext === '.jpeg') &&
            !entry.name.includes('_diff') &&
            !entry.name.includes('_mask') &&
            !entry.name.includes('_actual')) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  return files;
}

/**
 * Find metadata.json files in a directory
 */
async function findMetadataFiles(dir: string, maxDepth = 3, currentDepth = 0): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];

  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue;
        const subFiles = await findMetadataFiles(fullPath, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name === 'metadata.json') {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore read errors
  }

  return files;
}

// =============================================================================
// Element Identifier Completions
// =============================================================================

/**
 * Cache elements from an inspection result.
 *
 * Call this after an /ios.inspect to make element identifiers
 * available for autocomplete.
 *
 * @param elements - Array of elements from inspection
 */
export function cacheInspectElements(elements: CachedElement[]): void {
  cache.elements = createCacheEntry(elements, CACHE_TTL.elements);
  logger.debug(`${LOG_CONTEXT} Cached ${elements.length} elements from inspection`);
}

/**
 * Extract elements from an inspect result for caching.
 *
 * Recursively extracts all elements with identifiers or labels.
 *
 * @param rootElement - Root element from inspection
 * @returns Flat array of elements suitable for caching
 */
export function extractElementsFromInspect(rootElement: {
  identifier?: string;
  label?: string;
  type: string;
  value?: string;
  frame?: { x: number; y: number; width: number; height: number };
  children?: unknown[];
}): CachedElement[] {
  const elements: CachedElement[] = [];

  function traverse(element: typeof rootElement): void {
    // Only include elements with identifier or label
    if (element.identifier || element.label) {
      elements.push({
        identifier: element.identifier,
        label: element.label,
        type: element.type,
        text: element.value,
        frame: element.frame,
      });
    }

    // Traverse children
    if (element.children && Array.isArray(element.children)) {
      for (const child of element.children) {
        traverse(child as typeof rootElement);
      }
    }
  }

  traverse(rootElement);
  return elements;
}

/**
 * Get completion items for element identifiers.
 *
 * Returns identifiers and labels from the last inspection.
 *
 * @param options - Completion options
 * @returns Completion result with element identifiers
 */
export async function getElementCompletions(
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const startTime = Date.now();

  // Check if we have cached elements
  if (!cache.elements || !cache.elements.data) {
    return {
      success: false,
      type: 'element',
      items: [],
      error: 'No elements cached. Run /ios.inspect first.',
      fromCache: false,
      durationMs: Date.now() - startTime,
    };
  }

  const elements = cache.elements.data;

  // Convert to completion items
  const items: CompletionItem[] = [];
  const seenValues = new Set<string>();

  for (const element of elements) {
    // Add identifier
    if (element.identifier && !seenValues.has(element.identifier)) {
      seenValues.add(element.identifier);
      items.push({
        value: element.identifier,
        label: element.identifier,
        description: `${element.type}${element.label ? ` - ${element.label}` : ''}`,
        category: 'Identifier',
        priority: 0,
        metadata: {
          type: element.type,
          frame: element.frame,
        },
      });
    }

    // Add label (as secondary option)
    if (element.label && !seenValues.has(element.label)) {
      seenValues.add(element.label);
      items.push({
        value: element.label,
        label: element.label,
        description: `${element.type} (label)`,
        category: 'Label',
        priority: 1,
        metadata: {
          type: element.type,
          frame: element.frame,
        },
      });
    }
  }

  // Sort by priority then alphabetically
  items.sort((a, b) => {
    if ((a.priority || 0) !== (b.priority || 0)) {
      return (a.priority || 0) - (b.priority || 0);
    }
    return a.value.localeCompare(b.value);
  });

  return {
    success: true,
    type: 'element',
    items: filterAndLimit(items, options),
    fromCache: true,
    durationMs: Date.now() - startTime,
  };
}

// =============================================================================
// Unified Completion Interface
// =============================================================================

/**
 * Get completions for a specific type.
 *
 * @param type - Type of completions to fetch
 * @param options - Completion options
 * @returns Completion result
 */
export async function getCompletions(
  type: CompletionType,
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  switch (type) {
    case 'simulator':
      return getSimulatorCompletions(options);
    case 'bundleId':
      return getBundleIdCompletions(options);
    case 'scheme':
      return getSchemeCompletions(options);
    case 'flow':
      return getFlowCompletions(options);
    case 'baseline':
      return getBaselineCompletions(options);
    case 'element':
      return getElementCompletions(options);
    default:
      return {
        success: false,
        type,
        items: [],
        error: `Unknown completion type: ${type}`,
        fromCache: false,
        durationMs: 0,
      };
  }
}

/**
 * Get all available completions for iOS commands.
 *
 * Returns multiple types of completions in a single call.
 *
 * @param options - Completion options
 * @returns Map of completion type to results
 */
export async function getAllCompletions(
  options: CompletionOptions = {}
): Promise<Map<CompletionType, CompletionResult>> {
  const results = new Map<CompletionType, CompletionResult>();

  // Fetch all completion types in parallel
  const [simulators, bundleIds, schemes, flows, baselines, elements] = await Promise.all([
    getSimulatorCompletions(options),
    getBundleIdCompletions(options),
    options.projectPath ? getSchemeCompletions(options) : Promise.resolve(null),
    options.projectPath ? getFlowCompletions(options) : Promise.resolve(null),
    options.projectPath ? getBaselineCompletions(options) : Promise.resolve(null),
    getElementCompletions(options),
  ]);

  results.set('simulator', simulators);
  results.set('bundleId', bundleIds);
  if (schemes) results.set('scheme', schemes);
  if (flows) results.set('flow', flows);
  if (baselines) results.set('baseline', baselines);
  results.set('element', elements);

  return results;
}

// =============================================================================
// Command Argument Completions
// =============================================================================

/**
 * Command argument definition
 */
export interface CommandArgDefinition {
  /** Argument name or flag */
  name: string;
  /** Type of completion to use */
  completionType: CompletionType;
  /** Whether this is a positional argument */
  positional?: boolean;
  /** Whether this is required */
  required?: boolean;
  /** Description for help */
  description?: string;
}

/**
 * Map of iOS commands to their argument definitions
 */
export const COMMAND_ARGUMENTS: Record<string, CommandArgDefinition[]> = {
  '/ios.snapshot': [
    {
      name: '-s',
      completionType: 'simulator',
      positional: false,
      description: 'Simulator name or UDID',
    },
    {
      name: '--simulator',
      completionType: 'simulator',
      positional: false,
      description: 'Simulator name or UDID',
    },
  ],
  '/ios.inspect': [
    {
      name: '-s',
      completionType: 'simulator',
      positional: false,
      description: 'Simulator name or UDID',
    },
    {
      name: '--simulator',
      completionType: 'simulator',
      positional: false,
      description: 'Simulator name or UDID',
    },
    {
      name: '-b',
      completionType: 'bundleId',
      positional: false,
      description: 'App bundle ID',
    },
    {
      name: '--bundle-id',
      completionType: 'bundleId',
      positional: false,
      description: 'App bundle ID',
    },
  ],
  '/ios.tap': [
    {
      name: 'element',
      completionType: 'element',
      positional: true,
      required: true,
      description: 'Element identifier or label',
    },
    {
      name: '-s',
      completionType: 'simulator',
      positional: false,
      description: 'Simulator name or UDID',
    },
  ],
  '/ios.type': [
    {
      name: 'element',
      completionType: 'element',
      positional: true,
      required: true,
      description: 'Element identifier or label',
    },
  ],
  '/ios.scroll': [
    {
      name: 'element',
      completionType: 'element',
      positional: true,
      description: 'Element to scroll within',
    },
  ],
  '/ios.swipe': [
    {
      name: 'element',
      completionType: 'element',
      positional: true,
      description: 'Element to swipe',
    },
  ],
  '/ios.run_flow': [
    {
      name: 'flow',
      completionType: 'flow',
      positional: true,
      required: true,
      description: 'Flow file path',
    },
    {
      name: '-s',
      completionType: 'simulator',
      positional: false,
      description: 'Simulator name or UDID',
    },
  ],
  '/ios.baseline': [
    {
      name: 'name',
      completionType: 'baseline',
      positional: true,
      required: true,
      description: 'Baseline name',
    },
  ],
  '/ios.diff': [
    {
      name: 'baseline',
      completionType: 'baseline',
      positional: true,
      required: true,
      description: 'Baseline name to compare against',
    },
  ],
  '/ios.regression': [
    {
      name: '-b',
      completionType: 'baseline',
      positional: false,
      description: 'Baseline name',
    },
  ],
  '/ios.bridge.state': [
    {
      name: '-b',
      completionType: 'bundleId',
      positional: false,
      description: 'App bundle ID',
    },
  ],
  '/ios.bridge.route': [
    {
      name: '-b',
      completionType: 'bundleId',
      positional: false,
      description: 'App bundle ID',
    },
  ],
  '/ios.bridge.network': [
    {
      name: '-b',
      completionType: 'bundleId',
      positional: false,
      description: 'App bundle ID',
    },
  ],
  '/ios.bridge.analytics': [
    {
      name: '-b',
      completionType: 'bundleId',
      positional: false,
      description: 'App bundle ID',
    },
  ],
  '/ios.bridge.flags': [
    {
      name: '-b',
      completionType: 'bundleId',
      positional: false,
      description: 'App bundle ID',
    },
  ],
  '/ios.setup': [
    {
      name: '-p',
      completionType: 'scheme',
      positional: false,
      description: 'Project path',
    },
  ],
};

/**
 * Get completion type for a command argument.
 *
 * @param command - The slash command (e.g., "/ios.tap")
 * @param currentArg - The current argument being typed
 * @param previousArg - The previous argument (for flag value detection)
 * @returns Completion type to use, or null if no completion available
 */
export function getArgumentCompletionType(
  command: string,
  currentArg: string,
  previousArg?: string
): CompletionType | null {
  const argDefs = COMMAND_ARGUMENTS[command];
  if (!argDefs) return null;

  // Check if previous arg is a flag that needs a value
  if (previousArg && previousArg.startsWith('-')) {
    const flagDef = argDefs.find(
      (def) =>
        def.name === previousArg ||
        (def.name.startsWith('--') && previousArg === def.name.slice(0, 2))
    );
    if (flagDef) {
      return flagDef.completionType;
    }
  }

  // Check for positional arguments
  if (!currentArg.startsWith('-')) {
    const positionalDef = argDefs.find((def) => def.positional);
    if (positionalDef) {
      return positionalDef.completionType;
    }
  }

  return null;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Filter and limit completion items
 */
function filterAndLimit(
  items: CompletionItem[],
  options: CompletionOptions
): CompletionItem[] {
  let filtered = items;

  // Apply prefix filter
  if (options.prefix) {
    const prefix = options.prefix.toLowerCase();
    filtered = items.filter(
      (item) =>
        item.value.toLowerCase().startsWith(prefix) ||
        item.label.toLowerCase().startsWith(prefix)
    );
  }

  // Apply limit
  if (options.limit && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Compare two version strings
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (numA !== numB) {
      return numA - numB;
    }
  }

  return 0;
}
