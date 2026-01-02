/**
 * iOS Tools - Ignore Region Management
 *
 * Comprehensive ignore region functionality for visual regression testing.
 * Supports static regions (fixed coordinates), element-based regions
 * (by accessibility ID), and pattern-based regions (timestamp detection, etc.).
 *
 * Key features:
 * - Static regions: Fixed coordinate regions
 * - Element-based regions: Regions tied to UI elements by identifier
 * - Pattern-based regions: Regions detected by visual patterns
 * - Auto-detection of dynamic content
 * - Suggestion engine for common ignore patterns
 */

import type {
  IgnoreRegion,
  Rectangle,
  IgnoreReason,
} from './baselines/types';
import type { ImageData, DetectedChange } from './image-diff/types';
import type { ElementNode } from './inspect';
import { loadImage } from './image-diff/comparator';
import { findChangedRegions, classifyChange } from './image-diff/analyzer';
import { logger } from '../utils/logger';

const LOG_CONTEXT = '[iOS-IgnoreRegions]';

// =============================================================================
// Ignore Region Type Definitions
// =============================================================================

/**
 * Type of ignore region - determines how the region is defined and tracked.
 */
export type IgnoreRegionType =
  | 'static'        // Fixed coordinates
  | 'element'       // Based on UI element identifier
  | 'pattern';      // Based on visual pattern detection

/**
 * Extended ignore region with type information.
 */
export interface ExtendedIgnoreRegion extends IgnoreRegion {
  /** Type of ignore region */
  type: IgnoreRegionType;
  /** Element identifier for element-based regions */
  elementId?: string;
  /** Pattern type for pattern-based regions */
  patternType?: PatternType;
  /** Confidence score for auto-detected regions (0-1) */
  confidence?: number;
  /** Whether this region was auto-suggested */
  autoSuggested?: boolean;
}

/**
 * Pattern types for pattern-based ignore regions.
 */
export type PatternType =
  | 'clock'           // Time display (24h or 12h format)
  | 'date'            // Date display
  | 'timestamp'       // Combined date/time
  | 'battery'         // Battery indicator
  | 'signal'          // Cell signal indicator
  | 'wifi'            // WiFi indicator
  | 'user_avatar'     // User profile picture
  | 'loading'         // Loading spinners/skeletons
  | 'random_id'       // Random IDs or session tokens
  | 'carousel'        // Image carousels
  | 'animation';      // Animated content

/**
 * Common dynamic content patterns to detect.
 */
export interface DynamicPattern {
  /** Pattern type */
  type: PatternType;
  /** Human-readable description */
  description: string;
  /** Default rectangle (screen-relative, in points) */
  defaultRect?: (screenWidth: number, screenHeight: number) => Rectangle;
  /** Keywords commonly found near this pattern */
  keywords?: string[];
  /** Element types commonly associated with this pattern */
  elementTypes?: string[];
  /** Confidence threshold for detection */
  confidenceThreshold: number;
}

// =============================================================================
// Common Pattern Definitions
// =============================================================================

/**
 * iOS status bar dimensions for different devices.
 */
export const STATUS_BAR_HEIGHTS = {
  /** iPhones with Dynamic Island (14 Pro, 15 Pro, etc.) */
  dynamicIsland: 59,
  /** iPhones with notch (X, 11, 12, 13, 14) */
  notch: 47,
  /** iPhones with home button (SE, 8) */
  homeButton: 20,
  /** iPads */
  iPad: 24,
} as const;

/**
 * Home indicator dimensions.
 */
export const HOME_INDICATOR = {
  /** Height of home indicator safe area */
  height: 34,
} as const;

/**
 * Common dynamic patterns with detection heuristics.
 */
export const DYNAMIC_PATTERNS: Record<PatternType, DynamicPattern> = {
  clock: {
    type: 'clock',
    description: 'System clock display',
    defaultRect: (w) => ({ x: w / 2 - 30, y: 0, width: 60, height: 20 }),
    keywords: ['time', 'clock', 'hour', 'minute'],
    elementTypes: ['StaticText'],
    confidenceThreshold: 0.7,
  },
  date: {
    type: 'date',
    description: 'Date display',
    keywords: ['date', 'day', 'month', 'year', 'today', 'yesterday'],
    elementTypes: ['StaticText'],
    confidenceThreshold: 0.7,
  },
  timestamp: {
    type: 'timestamp',
    description: 'Timestamp display (date and time)',
    keywords: ['timestamp', 'posted', 'updated', 'modified', 'created', 'ago', 'just now'],
    elementTypes: ['StaticText'],
    confidenceThreshold: 0.6,
  },
  battery: {
    type: 'battery',
    description: 'Battery level indicator',
    defaultRect: (w) => ({ x: w - 50, y: 0, width: 50, height: 20 }),
    keywords: ['battery', 'power', 'charging'],
    elementTypes: ['Image', 'Other'],
    confidenceThreshold: 0.8,
  },
  signal: {
    type: 'signal',
    description: 'Cellular signal indicator',
    defaultRect: () => ({ x: 0, y: 0, width: 50, height: 20 }),
    keywords: ['signal', 'cellular', 'network', 'carrier'],
    elementTypes: ['Image', 'Other'],
    confidenceThreshold: 0.8,
  },
  wifi: {
    type: 'wifi',
    description: 'WiFi signal indicator',
    defaultRect: (w) => ({ x: w - 80, y: 0, width: 30, height: 20 }),
    keywords: ['wifi', 'wireless', 'network'],
    elementTypes: ['Image', 'Other'],
    confidenceThreshold: 0.8,
  },
  user_avatar: {
    type: 'user_avatar',
    description: 'User profile picture or avatar',
    keywords: ['avatar', 'profile', 'user', 'photo', 'picture'],
    elementTypes: ['Image', 'Button'],
    confidenceThreshold: 0.6,
  },
  loading: {
    type: 'loading',
    description: 'Loading spinner or skeleton',
    keywords: ['loading', 'spinner', 'activity', 'progress'],
    elementTypes: ['ActivityIndicator', 'ProgressIndicator', 'Image'],
    confidenceThreshold: 0.7,
  },
  random_id: {
    type: 'random_id',
    description: 'Random ID or session token',
    keywords: ['id', 'session', 'token', 'uuid', 'reference'],
    elementTypes: ['StaticText'],
    confidenceThreshold: 0.5,
  },
  carousel: {
    type: 'carousel',
    description: 'Image carousel or slider',
    keywords: ['carousel', 'slider', 'swipe', 'scroll', 'gallery'],
    elementTypes: ['CollectionView', 'ScrollView'],
    confidenceThreshold: 0.6,
  },
  animation: {
    type: 'animation',
    description: 'Animated content or transition',
    keywords: ['animation', 'animated', 'lottie', 'gif'],
    elementTypes: ['Other'],
    confidenceThreshold: 0.5,
  },
};

// =============================================================================
// Static Ignore Region Creation
// =============================================================================

/**
 * Create a static ignore region with fixed coordinates.
 *
 * @param name - Region identifier
 * @param rect - Fixed rectangle coordinates
 * @param reason - Reason for ignoring
 * @param description - Optional description
 * @returns Extended ignore region
 */
export function createStaticIgnoreRegion(
  name: string,
  rect: Rectangle,
  reason: IgnoreReason = 'custom',
  description?: string
): ExtendedIgnoreRegion {
  return {
    name,
    rect,
    reason,
    description,
    type: 'static',
  };
}

/**
 * Create an ignore region for the iOS status bar.
 *
 * @param screenWidth - Screen width in points
 * @param deviceType - Type of device ('dynamicIsland' | 'notch' | 'homeButton' | 'iPad')
 * @returns Status bar ignore region
 */
export function createStatusBarRegion(
  screenWidth: number,
  deviceType: keyof typeof STATUS_BAR_HEIGHTS = 'notch'
): ExtendedIgnoreRegion {
  const height = STATUS_BAR_HEIGHTS[deviceType];

  return {
    name: 'status_bar',
    rect: {
      x: 0,
      y: 0,
      width: screenWidth,
      height,
    },
    reason: 'status_bar',
    description: `iOS status bar (${deviceType} style)`,
    type: 'static',
    patternType: 'clock',
  };
}

/**
 * Create an ignore region for the home indicator.
 *
 * @param screenWidth - Screen width in points
 * @param screenHeight - Screen height in points
 * @returns Home indicator ignore region
 */
export function createHomeIndicatorRegion(
  screenWidth: number,
  screenHeight: number
): ExtendedIgnoreRegion {
  return {
    name: 'home_indicator',
    rect: {
      x: 0,
      y: screenHeight - HOME_INDICATOR.height,
      width: screenWidth,
      height: HOME_INDICATOR.height,
    },
    reason: 'dynamic_content',
    description: 'iOS home indicator safe area',
    type: 'static',
  };
}

/**
 * Create standard iOS system UI ignore regions.
 *
 * @param screenWidth - Screen width in points
 * @param screenHeight - Screen height in points
 * @param deviceType - Type of device
 * @returns Array of system UI ignore regions
 */
export function createSystemUIIgnoreRegions(
  screenWidth: number,
  screenHeight: number,
  deviceType: keyof typeof STATUS_BAR_HEIGHTS = 'notch'
): ExtendedIgnoreRegion[] {
  const regions: ExtendedIgnoreRegion[] = [
    createStatusBarRegion(screenWidth, deviceType),
  ];

  // Add home indicator for devices without home button
  if (deviceType !== 'homeButton') {
    regions.push(createHomeIndicatorRegion(screenWidth, screenHeight));
  }

  return regions;
}

// =============================================================================
// Element-Based Ignore Region Creation
// =============================================================================

/**
 * Create an element-based ignore region tied to a UI element.
 *
 * @param name - Region identifier
 * @param elementId - Accessibility identifier of the element
 * @param reason - Reason for ignoring
 * @param description - Optional description
 * @returns Extended ignore region (rect will be populated when element is found)
 */
export function createElementBasedIgnoreRegion(
  name: string,
  elementId: string,
  reason: IgnoreReason = 'dynamic_content',
  description?: string
): ExtendedIgnoreRegion {
  return {
    name,
    rect: { x: 0, y: 0, width: 0, height: 0 }, // Placeholder - resolved at comparison time
    reason,
    description: description ?? `Element-based ignore for ${elementId}`,
    type: 'element',
    elementId,
  };
}

/**
 * Resolve element-based ignore regions using the UI hierarchy.
 *
 * @param regions - Ignore regions to resolve
 * @param elements - UI element hierarchy from inspection
 * @returns Resolved ignore regions with actual rectangles
 */
export function resolveElementBasedRegions(
  regions: ExtendedIgnoreRegion[],
  elements: ElementNode[]
): ExtendedIgnoreRegion[] {
  return regions.map((region) => {
    if (region.type !== 'element' || !region.elementId) {
      return region;
    }

    // Find element by identifier
    const element = findElementById(elements, region.elementId);

    if (element?.frame) {
      return {
        ...region,
        rect: {
          x: element.frame.x,
          y: element.frame.y,
          width: element.frame.width,
          height: element.frame.height,
        },
      };
    }

    logger.warn(
      `${LOG_CONTEXT} Element not found for ignore region: ${region.elementId}`
    );
    return region;
  });
}

/**
 * Find an element by accessibility identifier in the UI hierarchy.
 */
function findElementById(
  elements: ElementNode[],
  identifier: string
): ElementNode | null {
  for (const element of elements) {
    if (element.identifier === identifier) {
      return element;
    }

    if (element.children) {
      const found = findElementById(element.children, identifier);
      if (found) return found;
    }
  }

  return null;
}

// =============================================================================
// Pattern-Based Ignore Region Creation
// =============================================================================

/**
 * Create a pattern-based ignore region.
 *
 * @param name - Region identifier
 * @param patternType - Type of pattern to detect
 * @param rect - Initial rectangle (can be refined by detection)
 * @param confidence - Detection confidence (0-1)
 * @returns Extended ignore region
 */
export function createPatternBasedIgnoreRegion(
  name: string,
  patternType: PatternType,
  rect: Rectangle,
  confidence: number = 0.8
): ExtendedIgnoreRegion {
  const pattern = DYNAMIC_PATTERNS[patternType];

  return {
    name,
    rect,
    reason: patternType === 'user_avatar' ? 'user_avatar' : 'dynamic_content',
    description: pattern.description,
    type: 'pattern',
    patternType,
    confidence,
  };
}

// =============================================================================
// Dynamic Content Detection
// =============================================================================

/**
 * Options for detecting dynamic content.
 */
export interface DetectDynamicOptions {
  /** UI elements from inspection (for element-based detection) */
  elements?: ElementNode[];
  /** Screen dimensions */
  screenSize?: { width: number; height: number };
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Pattern types to look for */
  patterns?: PatternType[];
  /** Include system UI regions (status bar, home indicator) */
  includeSystemUI?: boolean;
}

/**
 * Detected dynamic content result.
 */
export interface DynamicContentResult {
  /** Detected regions */
  regions: ExtendedIgnoreRegion[];
  /** Total confidence score */
  overallConfidence: number;
  /** Patterns that were detected */
  detectedPatterns: PatternType[];
}

/**
 * Detect likely dynamic content areas in a screenshot.
 *
 * @param screenshot - Path to screenshot or ImageData
 * @param options - Detection options
 * @returns Detection results with suggested ignore regions
 */
export async function detectDynamicContent(
  screenshot: string | ImageData,
  options: DetectDynamicOptions = {}
): Promise<DynamicContentResult> {
  const {
    elements,
    screenSize,
    minConfidence = 0.5,
    patterns = Object.keys(DYNAMIC_PATTERNS) as PatternType[],
    includeSystemUI = true,
  } = options;

  const regions: ExtendedIgnoreRegion[] = [];
  const detectedPatterns: PatternType[] = [];

  // Get image data if path provided
  const imageData = typeof screenshot === 'string'
    ? await loadImage(screenshot)
    : screenshot;

  const { width, height } = screenSize ?? imageData;

  // Add system UI regions if requested
  if (includeSystemUI) {
    const systemRegions = createSystemUIIgnoreRegions(width, height, 'notch');
    regions.push(...systemRegions);
    detectedPatterns.push('clock', 'battery', 'signal');
  }

  // Detect patterns from UI elements if available
  if (elements && elements.length > 0) {
    const elementBasedRegions = detectPatternsFromElements(
      elements,
      patterns,
      minConfidence
    );
    regions.push(...elementBasedRegions);

    for (const region of elementBasedRegions) {
      if (region.patternType && !detectedPatterns.includes(region.patternType)) {
        detectedPatterns.push(region.patternType);
      }
    }
  }

  // Calculate overall confidence
  const confidences = regions
    .map((r) => r.confidence ?? 1)
    .filter((c) => c > 0);
  const overallConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  logger.debug(
    `${LOG_CONTEXT} Detected ${regions.length} dynamic content regions ` +
    `with ${(overallConfidence * 100).toFixed(1)}% confidence`
  );

  return {
    regions,
    overallConfidence,
    detectedPatterns,
  };
}

/**
 * Detect patterns from UI elements using keyword and type matching.
 */
function detectPatternsFromElements(
  elements: ElementNode[],
  patterns: PatternType[],
  minConfidence: number
): ExtendedIgnoreRegion[] {
  const regions: ExtendedIgnoreRegion[] = [];
  const flatElements = flattenElementTree(elements);

  for (const element of flatElements) {
    for (const patternType of patterns) {
      const pattern = DYNAMIC_PATTERNS[patternType];
      const confidence = calculatePatternConfidence(element, pattern);

      if (confidence >= minConfidence && confidence >= pattern.confidenceThreshold) {
        if (element.frame) {
          regions.push({
            name: `${patternType}_${element.identifier || element.label || 'auto'}`,
            rect: {
              x: element.frame.x,
              y: element.frame.y,
              width: element.frame.width,
              height: element.frame.height,
            },
            reason: 'dynamic_content',
            description: `Detected ${pattern.description}`,
            type: 'pattern',
            patternType,
            confidence,
            autoSuggested: true,
          });
        }
      }
    }
  }

  return regions;
}

/**
 * Calculate confidence score for a pattern match.
 */
function calculatePatternConfidence(
  element: ElementNode,
  pattern: DynamicPattern
): number {
  let score = 0;
  let checks = 0;

  // Check element type
  if (pattern.elementTypes && pattern.elementTypes.length > 0) {
    checks++;
    if (pattern.elementTypes.includes(element.type)) {
      score += 0.4;
    }
  }

  // Check keywords in identifier, label, or value
  if (pattern.keywords && pattern.keywords.length > 0) {
    checks++;
    const text = [
      element.identifier,
      element.label,
      element.value,
    ].filter(Boolean).join(' ').toLowerCase();

    const matchedKeywords = pattern.keywords.filter((k) =>
      text.includes(k.toLowerCase())
    );

    if (matchedKeywords.length > 0) {
      score += 0.6 * (matchedKeywords.length / pattern.keywords.length);
    }
  }

  return checks > 0 ? score : 0;
}

/**
 * Flatten element tree for easier processing.
 */
function flattenElementTree(elements: ElementNode[]): ElementNode[] {
  const result: ElementNode[] = [];

  function traverse(nodes: ElementNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(elements);
  return result;
}

// =============================================================================
// Ignore Region Suggestion
// =============================================================================

/**
 * Options for suggesting ignore regions.
 */
export interface SuggestIgnoreOptions {
  /** UI elements for element-based detection */
  elements?: ElementNode[];
  /** Comparison result from image diff */
  comparisonResult?: {
    diffImage?: Buffer;
    dimensions: { width: number; height: number };
  };
  /** Threshold for considering changes significant */
  changeThreshold?: number;
  /** Maximum number of suggestions */
  maxSuggestions?: number;
  /** Include system UI regions */
  includeSystemUI?: boolean;
}

/**
 * Suggestion for an ignore region.
 */
export interface IgnoreRegionSuggestion {
  /** Suggested ignore region */
  region: ExtendedIgnoreRegion;
  /** Reason for suggestion */
  suggestedReason: string;
  /** Confidence in suggestion (0-1) */
  confidence: number;
  /** Whether this is a common pattern */
  isCommonPattern: boolean;
  /** Priority of suggestion (higher = more important) */
  priority: number;
}

/**
 * Suggest ignore regions based on comparison differences.
 *
 * @param baseline - Path to baseline image or ImageData
 * @param current - Path to current image or ImageData
 * @param options - Suggestion options
 * @returns Array of suggested ignore regions
 */
export async function suggestIgnoreRegions(
  baseline: string | ImageData,
  current: string | ImageData,
  options: SuggestIgnoreOptions = {}
): Promise<IgnoreRegionSuggestion[]> {
  const {
    elements,
    comparisonResult,
    changeThreshold = 0.3,
    maxSuggestions = 10,
    includeSystemUI = true,
  } = options;

  const suggestions: IgnoreRegionSuggestion[] = [];

  // Get image data
  const baselineData = typeof baseline === 'string'
    ? await loadImage(baseline)
    : baseline;
  const currentData = typeof current === 'string'
    ? await loadImage(current)
    : current;

  const { width, height } = baselineData;

  // Add system UI suggestions first
  if (includeSystemUI) {
    suggestions.push(...createSystemUISuggestions(width, height));
  }

  // Analyze changed regions if comparison result provided
  if (comparisonResult?.diffImage) {
    const changedRegions = findChangedRegions(
      comparisonResult.diffImage,
      comparisonResult.dimensions.width,
      comparisonResult.dimensions.height
    );

    for (let i = 0; i < changedRegions.length && suggestions.length < maxSuggestions; i++) {
      const bounds = changedRegions[i];

      // Classify the change to determine if it should be ignored
      const { type: changeType, confidence } = classifyChange(
        baselineData,
        currentData,
        bounds
      );

      // Skip small changes or low-confidence detections
      const regionArea = bounds.width * bounds.height;
      const totalArea = width * height;
      const changeRatio = regionArea / totalArea;

      if (changeRatio < changeThreshold && confidence > 0.5) {
        const patternType = mapChangeTypeToPattern(changeType);
        const suggestion = createChangeSuggestion(
          bounds,
          changeType,
          patternType,
          confidence,
          i
        );
        suggestions.push(suggestion);
      }
    }
  }

  // Add element-based suggestions
  if (elements && elements.length > 0) {
    const elementSuggestions = createElementSuggestions(elements, maxSuggestions - suggestions.length);
    suggestions.push(...elementSuggestions);
  }

  // Sort by priority
  suggestions.sort((a, b) => b.priority - a.priority);

  return suggestions.slice(0, maxSuggestions);
}

/**
 * Create system UI suggestions.
 */
function createSystemUISuggestions(
  width: number,
  height: number
): IgnoreRegionSuggestion[] {
  const statusBar = createStatusBarRegion(width, 'notch');
  const homeIndicator = createHomeIndicatorRegion(width, height);

  return [
    {
      region: statusBar,
      suggestedReason: 'Status bar contains dynamic system information (time, battery, signal)',
      confidence: 0.95,
      isCommonPattern: true,
      priority: 100,
    },
    {
      region: homeIndicator,
      suggestedReason: 'Home indicator area may have visual variations',
      confidence: 0.85,
      isCommonPattern: true,
      priority: 90,
    },
  ];
}

/**
 * Map change type to pattern type.
 */
function mapChangeTypeToPattern(
  changeType: ReturnType<typeof classifyChange>['type']
): PatternType | undefined {
  switch (changeType) {
    case 'added':
    case 'removed':
      return 'loading';
    case 'text':
      return 'timestamp';
    default:
      return undefined;
  }
}

/**
 * Create a suggestion from a change detection.
 */
function createChangeSuggestion(
  bounds: Rectangle,
  changeType: string,
  patternType: PatternType | undefined,
  confidence: number,
  index: number
): IgnoreRegionSuggestion {
  const name = patternType ?? `change_${index + 1}`;

  return {
    region: createPatternBasedIgnoreRegion(
      name,
      patternType ?? 'animation',
      bounds,
      confidence
    ),
    suggestedReason: `Detected ${changeType} change that may be dynamic content`,
    confidence,
    isCommonPattern: !!patternType,
    priority: confidence * 50,
  };
}

/**
 * Create element-based suggestions.
 */
function createElementSuggestions(
  elements: ElementNode[],
  maxCount: number
): IgnoreRegionSuggestion[] {
  const suggestions: IgnoreRegionSuggestion[] = [];
  const flatElements = flattenElementTree(elements);

  for (const element of flatElements) {
    if (suggestions.length >= maxCount) break;

    // Check for activity indicators (loading spinners)
    if (element.type === 'ActivityIndicator' && element.frame) {
      suggestions.push({
        region: createElementBasedIgnoreRegion(
          `loading_${element.identifier || 'spinner'}`,
          element.identifier || `loading_${suggestions.length}`,
          'dynamic_content',
          'Loading spinner detected'
        ),
        suggestedReason: 'Activity indicator changes between runs',
        confidence: 0.9,
        isCommonPattern: true,
        priority: 80,
      });
    }

    // Check for images that might be user avatars
    if (element.type === 'Image') {
      const isAvatar = (element.identifier || element.label || '')
        .toLowerCase()
        .match(/avatar|profile|user|photo/);

      if (isAvatar && element.frame) {
        suggestions.push({
          region: createElementBasedIgnoreRegion(
            `avatar_${element.identifier || suggestions.length}`,
            element.identifier || `avatar_${suggestions.length}`,
            'user_avatar',
            'User avatar detected'
          ),
          suggestedReason: 'User avatar may change between sessions',
          confidence: 0.75,
          isCommonPattern: true,
          priority: 70,
        });
      }
    }
  }

  return suggestions;
}

// =============================================================================
// Ignore Region Validation
// =============================================================================

/**
 * Validation result for ignore regions.
 */
export interface IgnoreRegionValidation {
  /** Whether the region is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Validate an ignore region.
 *
 * @param region - Region to validate
 * @param screenSize - Screen dimensions for bounds checking
 * @returns Validation result
 */
export function validateIgnoreRegion(
  region: IgnoreRegion | ExtendedIgnoreRegion,
  screenSize?: { width: number; height: number }
): IgnoreRegionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check name
  if (!region.name || region.name.trim() === '') {
    errors.push('Region name is required');
  }

  // Check rectangle dimensions
  if (region.rect.width <= 0) {
    errors.push('Region width must be positive');
  }
  if (region.rect.height <= 0) {
    errors.push('Region height must be positive');
  }

  // Check bounds if screen size provided
  if (screenSize) {
    if (region.rect.x < 0) {
      warnings.push('Region x coordinate is negative');
    }
    if (region.rect.y < 0) {
      warnings.push('Region y coordinate is negative');
    }
    if (region.rect.x + region.rect.width > screenSize.width) {
      warnings.push('Region extends beyond screen width');
    }
    if (region.rect.y + region.rect.height > screenSize.height) {
      warnings.push('Region extends beyond screen height');
    }
  }

  // Check for very large regions
  if (screenSize) {
    const area = region.rect.width * region.rect.height;
    const screenArea = screenSize.width * screenSize.height;
    if (area > screenArea * 0.5) {
      warnings.push('Region covers more than 50% of screen');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a point is within an ignore region.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param region - Ignore region
 * @returns True if point is within region
 */
export function isPointInRegion(
  x: number,
  y: number,
  region: IgnoreRegion
): boolean {
  return (
    x >= region.rect.x &&
    x < region.rect.x + region.rect.width &&
    y >= region.rect.y &&
    y < region.rect.y + region.rect.height
  );
}

/**
 * Check if two regions overlap.
 *
 * @param a - First region
 * @param b - Second region
 * @returns True if regions overlap
 */
export function regionsOverlap(
  a: IgnoreRegion,
  b: IgnoreRegion
): boolean {
  return !(
    a.rect.x + a.rect.width <= b.rect.x ||
    b.rect.x + b.rect.width <= a.rect.x ||
    a.rect.y + a.rect.height <= b.rect.y ||
    b.rect.y + b.rect.height <= a.rect.y
  );
}

/**
 * Merge overlapping regions into larger combined regions.
 *
 * @param regions - Regions to merge
 * @returns Merged regions
 */
export function mergeOverlappingRegions(
  regions: IgnoreRegion[]
): IgnoreRegion[] {
  if (regions.length <= 1) return regions;

  const merged: IgnoreRegion[] = [];
  const used = new Set<number>();

  for (let i = 0; i < regions.length; i++) {
    if (used.has(i)) continue;

    let current = { ...regions[i] };
    used.add(i);

    let changed = true;
    while (changed) {
      changed = false;

      for (let j = 0; j < regions.length; j++) {
        if (used.has(j)) continue;

        if (regionsOverlap(current, regions[j])) {
          current = mergeRegions(current, regions[j]);
          used.add(j);
          changed = true;
        }
      }
    }

    merged.push(current);
  }

  return merged;
}

/**
 * Merge two regions into one.
 */
function mergeRegions(a: IgnoreRegion, b: IgnoreRegion): IgnoreRegion {
  const minX = Math.min(a.rect.x, b.rect.x);
  const minY = Math.min(a.rect.y, b.rect.y);
  const maxX = Math.max(a.rect.x + a.rect.width, b.rect.x + b.rect.width);
  const maxY = Math.max(a.rect.y + a.rect.height, b.rect.y + b.rect.height);

  return {
    name: `${a.name}_${b.name}`,
    rect: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    reason: a.reason,
    description: `Merged: ${a.description || a.name} + ${b.description || b.name}`,
  };
}

// =============================================================================
// Presets and Templates
// =============================================================================

/**
 * Common ignore region presets.
 */
export const IGNORE_PRESETS = {
  /**
   * iPhone with Dynamic Island preset.
   */
  iPhoneDynamicIsland: (width: number, height: number): ExtendedIgnoreRegion[] => [
    createStatusBarRegion(width, 'dynamicIsland'),
    createHomeIndicatorRegion(width, height),
  ],

  /**
   * iPhone with notch preset.
   */
  iPhoneNotch: (width: number, height: number): ExtendedIgnoreRegion[] => [
    createStatusBarRegion(width, 'notch'),
    createHomeIndicatorRegion(width, height),
  ],

  /**
   * iPhone with home button preset.
   */
  iPhoneHomeButton: (width: number): ExtendedIgnoreRegion[] => [
    createStatusBarRegion(width, 'homeButton'),
  ],

  /**
   * iPad preset.
   */
  iPad: (width: number, height: number): ExtendedIgnoreRegion[] => [
    createStatusBarRegion(width, 'iPad'),
    createHomeIndicatorRegion(width, height),
  ],

  /**
   * Full status bar preset (all indicators).
   */
  fullSystemUI: (width: number, height: number): ExtendedIgnoreRegion[] =>
    createSystemUIIgnoreRegions(width, height, 'notch'),
} as const;

/**
 * Get device-appropriate ignore preset.
 *
 * @param deviceName - Device name (e.g., "iPhone 15 Pro")
 * @param width - Screen width
 * @param height - Screen height
 * @returns Array of appropriate ignore regions
 */
export function getDevicePreset(
  deviceName: string,
  width: number,
  height: number
): ExtendedIgnoreRegion[] {
  const nameLower = deviceName.toLowerCase();

  if (nameLower.includes('ipad')) {
    return IGNORE_PRESETS.iPad(width, height);
  }

  if (nameLower.includes('se') || nameLower.includes('8') || nameLower.includes('7')) {
    return IGNORE_PRESETS.iPhoneHomeButton(width);
  }

  if (nameLower.includes('14 pro') || nameLower.includes('15') || nameLower.includes('16')) {
    return IGNORE_PRESETS.iPhoneDynamicIsland(width, height);
  }

  // Default to notch style for other iPhones
  return IGNORE_PRESETS.iPhoneNotch(width, height);
}

// =============================================================================
// Export Helpers
// =============================================================================

/**
 * Convert extended ignore region to basic ignore region.
 */
export function toBasicIgnoreRegion(region: ExtendedIgnoreRegion): IgnoreRegion {
  return {
    name: region.name,
    rect: region.rect,
    reason: region.reason,
    description: region.description,
  };
}

/**
 * Convert array of extended regions to basic regions.
 */
export function toBasicIgnoreRegions(regions: ExtendedIgnoreRegion[]): IgnoreRegion[] {
  return regions.map(toBasicIgnoreRegion);
}
