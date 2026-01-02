/**
 * Tests for ignore-regions module
 */

import {
  // Types
  IgnoreRegionType,
  ExtendedIgnoreRegion,
  PatternType,
  DynamicPattern,
  DetectDynamicOptions,
  DynamicContentResult,
  SuggestIgnoreOptions,
  IgnoreRegionSuggestion,
  IgnoreRegionValidation,
  // Constants
  STATUS_BAR_HEIGHTS,
  HOME_INDICATOR,
  DYNAMIC_PATTERNS,
  IGNORE_PRESETS,
  // Static region creation
  createStaticIgnoreRegion,
  createStatusBarRegion,
  createHomeIndicatorRegion,
  createSystemUIIgnoreRegions,
  // Element-based region creation
  createElementBasedIgnoreRegion,
  resolveElementBasedRegions,
  // Pattern-based region creation
  createPatternBasedIgnoreRegion,
  // Dynamic content detection
  detectDynamicContent,
  // Suggestion
  suggestIgnoreRegions,
  // Validation
  validateIgnoreRegion,
  isPointInRegion,
  regionsOverlap,
  mergeOverlappingRegions,
  // Presets
  getDevicePreset,
  // Conversion
  toBasicIgnoreRegion,
  toBasicIgnoreRegions,
} from '../ignore-regions';
import type { ElementNode } from '../inspect';
import type { IgnoreRegion, Rectangle } from '../baselines/types';

// =============================================================================
// Constants Tests
// =============================================================================

describe('ignore-regions constants', () => {
  describe('STATUS_BAR_HEIGHTS', () => {
    it('should have correct heights for different device types', () => {
      expect(STATUS_BAR_HEIGHTS.dynamicIsland).toBe(59);
      expect(STATUS_BAR_HEIGHTS.notch).toBe(47);
      expect(STATUS_BAR_HEIGHTS.homeButton).toBe(20);
      expect(STATUS_BAR_HEIGHTS.iPad).toBe(24);
    });
  });

  describe('HOME_INDICATOR', () => {
    it('should have correct height', () => {
      expect(HOME_INDICATOR.height).toBe(34);
    });
  });

  describe('DYNAMIC_PATTERNS', () => {
    it('should have all pattern types defined', () => {
      const patternTypes: PatternType[] = [
        'clock',
        'date',
        'timestamp',
        'battery',
        'signal',
        'wifi',
        'user_avatar',
        'loading',
        'random_id',
        'carousel',
        'animation',
      ];

      for (const type of patternTypes) {
        expect(DYNAMIC_PATTERNS[type]).toBeDefined();
        expect(DYNAMIC_PATTERNS[type].type).toBe(type);
        expect(DYNAMIC_PATTERNS[type].description).toBeTruthy();
        expect(DYNAMIC_PATTERNS[type].confidenceThreshold).toBeGreaterThan(0);
        expect(DYNAMIC_PATTERNS[type].confidenceThreshold).toBeLessThanOrEqual(1);
      }
    });

    it('should have defaultRect for system UI patterns', () => {
      expect(DYNAMIC_PATTERNS.clock.defaultRect).toBeDefined();
      expect(DYNAMIC_PATTERNS.battery.defaultRect).toBeDefined();
      expect(DYNAMIC_PATTERNS.signal.defaultRect).toBeDefined();
      expect(DYNAMIC_PATTERNS.wifi.defaultRect).toBeDefined();
    });

    it('should have keywords for content patterns', () => {
      expect(DYNAMIC_PATTERNS.timestamp.keywords).toContain('timestamp');
      expect(DYNAMIC_PATTERNS.timestamp.keywords).toContain('ago');
      expect(DYNAMIC_PATTERNS.user_avatar.keywords).toContain('avatar');
      expect(DYNAMIC_PATTERNS.loading.keywords).toContain('loading');
    });
  });
});

// =============================================================================
// Static Ignore Region Tests
// =============================================================================

describe('Static Ignore Region Creation', () => {
  describe('createStaticIgnoreRegion', () => {
    it('should create a static ignore region with all properties', () => {
      const rect: Rectangle = { x: 10, y: 20, width: 100, height: 50 };
      const region = createStaticIgnoreRegion('test_region', rect, 'custom', 'Test description');

      expect(region.name).toBe('test_region');
      expect(region.rect).toEqual(rect);
      expect(region.reason).toBe('custom');
      expect(region.description).toBe('Test description');
      expect(region.type).toBe('static');
    });

    it('should use default reason when not provided', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 50, height: 50 };
      const region = createStaticIgnoreRegion('test', rect);

      expect(region.reason).toBe('custom');
    });

    it('should allow undefined description', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 50, height: 50 };
      const region = createStaticIgnoreRegion('test', rect, 'dynamic_content');

      expect(region.description).toBeUndefined();
    });
  });

  describe('createStatusBarRegion', () => {
    it('should create status bar region for Dynamic Island device', () => {
      const region = createStatusBarRegion(390, 'dynamicIsland');

      expect(region.name).toBe('status_bar');
      expect(region.rect.x).toBe(0);
      expect(region.rect.y).toBe(0);
      expect(region.rect.width).toBe(390);
      expect(region.rect.height).toBe(59);
      expect(region.reason).toBe('status_bar');
      expect(region.type).toBe('static');
    });

    it('should create status bar region for notch device', () => {
      const region = createStatusBarRegion(414, 'notch');

      expect(region.rect.height).toBe(47);
      expect(region.description).toContain('notch');
    });

    it('should create status bar region for home button device', () => {
      const region = createStatusBarRegion(375, 'homeButton');

      expect(region.rect.height).toBe(20);
      expect(region.description).toContain('homeButton');
    });

    it('should create status bar region for iPad', () => {
      const region = createStatusBarRegion(1024, 'iPad');

      expect(region.rect.height).toBe(24);
      expect(region.rect.width).toBe(1024);
    });

    it('should default to notch style', () => {
      const region = createStatusBarRegion(390);

      expect(region.rect.height).toBe(47);
    });
  });

  describe('createHomeIndicatorRegion', () => {
    it('should create home indicator region at bottom of screen', () => {
      const region = createHomeIndicatorRegion(390, 844);

      expect(region.name).toBe('home_indicator');
      expect(region.rect.x).toBe(0);
      expect(region.rect.y).toBe(844 - 34);
      expect(region.rect.width).toBe(390);
      expect(region.rect.height).toBe(34);
      expect(region.type).toBe('static');
    });

    it('should work with different screen sizes', () => {
      const region = createHomeIndicatorRegion(430, 932);

      expect(region.rect.y).toBe(932 - 34);
      expect(region.rect.width).toBe(430);
    });
  });

  describe('createSystemUIIgnoreRegions', () => {
    it('should create both status bar and home indicator for notch devices', () => {
      const regions = createSystemUIIgnoreRegions(390, 844, 'notch');

      expect(regions).toHaveLength(2);
      expect(regions[0].name).toBe('status_bar');
      expect(regions[1].name).toBe('home_indicator');
    });

    it('should only create status bar for home button devices', () => {
      const regions = createSystemUIIgnoreRegions(375, 667, 'homeButton');

      expect(regions).toHaveLength(1);
      expect(regions[0].name).toBe('status_bar');
    });

    it('should create both for Dynamic Island devices', () => {
      const regions = createSystemUIIgnoreRegions(430, 932, 'dynamicIsland');

      expect(regions).toHaveLength(2);
      expect(regions[0].rect.height).toBe(59);
    });
  });
});

// =============================================================================
// Element-Based Ignore Region Tests
// =============================================================================

describe('Element-Based Ignore Region Creation', () => {
  describe('createElementBasedIgnoreRegion', () => {
    it('should create element-based region with element ID', () => {
      const region = createElementBasedIgnoreRegion(
        'user_avatar',
        'profile_image',
        'user_avatar',
        'User profile picture'
      );

      expect(region.name).toBe('user_avatar');
      expect(region.elementId).toBe('profile_image');
      expect(region.type).toBe('element');
      expect(region.reason).toBe('user_avatar');
      expect(region.description).toBe('User profile picture');
    });

    it('should have placeholder rect', () => {
      const region = createElementBasedIgnoreRegion('test', 'test_id');

      expect(region.rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('should generate description from element ID', () => {
      const region = createElementBasedIgnoreRegion('test', 'my_element');

      expect(region.description).toContain('my_element');
    });
  });

  describe('resolveElementBasedRegions', () => {
    const mockElements: ElementNode[] = [
      {
        type: 'Image',
        identifier: 'profile_image',
        label: 'Profile',
        frame: { x: 10, y: 100, width: 50, height: 50 },
        children: [],
      },
      {
        type: 'Button',
        identifier: 'submit_button',
        label: 'Submit',
        frame: { x: 100, y: 200, width: 80, height: 44 },
        children: [],
      },
    ];

    it('should resolve element-based regions to actual rectangles', () => {
      const regions: ExtendedIgnoreRegion[] = [
        createElementBasedIgnoreRegion('avatar', 'profile_image'),
      ];

      const resolved = resolveElementBasedRegions(regions, mockElements);

      expect(resolved[0].rect).toEqual({ x: 10, y: 100, width: 50, height: 50 });
    });

    it('should not modify static regions', () => {
      const staticRegion = createStaticIgnoreRegion(
        'static_test',
        { x: 5, y: 5, width: 10, height: 10 }
      );

      const resolved = resolveElementBasedRegions([staticRegion], mockElements);

      expect(resolved[0].rect).toEqual({ x: 5, y: 5, width: 10, height: 10 });
    });

    it('should handle missing elements gracefully', () => {
      const regions: ExtendedIgnoreRegion[] = [
        createElementBasedIgnoreRegion('missing', 'nonexistent_element'),
      ];

      const resolved = resolveElementBasedRegions(regions, mockElements);

      expect(resolved[0].rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('should find nested elements', () => {
      const nestedElements: ElementNode[] = [
        {
          type: 'View',
          identifier: 'container',
          frame: { x: 0, y: 0, width: 200, height: 200 },
          children: [
            {
              type: 'Image',
              identifier: 'nested_image',
              frame: { x: 20, y: 30, width: 40, height: 40 },
              children: [],
            },
          ],
        },
      ];

      const regions: ExtendedIgnoreRegion[] = [
        createElementBasedIgnoreRegion('nested', 'nested_image'),
      ];

      const resolved = resolveElementBasedRegions(regions, nestedElements);

      expect(resolved[0].rect).toEqual({ x: 20, y: 30, width: 40, height: 40 });
    });
  });
});

// =============================================================================
// Pattern-Based Ignore Region Tests
// =============================================================================

describe('Pattern-Based Ignore Region Creation', () => {
  describe('createPatternBasedIgnoreRegion', () => {
    it('should create pattern-based region', () => {
      const rect: Rectangle = { x: 100, y: 200, width: 50, height: 30 };
      const region = createPatternBasedIgnoreRegion('time_display', 'clock', rect, 0.9);

      expect(region.name).toBe('time_display');
      expect(region.rect).toEqual(rect);
      expect(region.type).toBe('pattern');
      expect(region.patternType).toBe('clock');
      expect(region.confidence).toBe(0.9);
    });

    it('should set user_avatar reason for avatar patterns', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 50, height: 50 };
      const region = createPatternBasedIgnoreRegion('avatar', 'user_avatar', rect);

      expect(region.reason).toBe('user_avatar');
    });

    it('should set dynamic_content reason for other patterns', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 50, height: 50 };
      const region = createPatternBasedIgnoreRegion('loader', 'loading', rect);

      expect(region.reason).toBe('dynamic_content');
    });

    it('should use pattern description', () => {
      const rect: Rectangle = { x: 0, y: 0, width: 50, height: 50 };
      const region = createPatternBasedIgnoreRegion('timestamp', 'timestamp', rect);

      expect(region.description).toBe(DYNAMIC_PATTERNS.timestamp.description);
    });
  });
});

// =============================================================================
// Dynamic Content Detection Tests
// =============================================================================

describe('Dynamic Content Detection', () => {
  describe('detectDynamicContent', () => {
    // Create a simple test image data
    const createTestImageData = (width: number, height: number): Buffer => {
      return Buffer.alloc(width * height * 4, 128);
    };

    const testImageData = {
      data: createTestImageData(390, 844),
      width: 390,
      height: 844,
      channels: 4 as const,
    };

    it('should include system UI regions by default', async () => {
      const result = await detectDynamicContent(testImageData, {
        screenSize: { width: 390, height: 844 },
      });

      expect(result.regions.length).toBeGreaterThanOrEqual(2);
      expect(result.regions.find((r) => r.name === 'status_bar')).toBeDefined();
      expect(result.regions.find((r) => r.name === 'home_indicator')).toBeDefined();
    });

    it('should not include system UI when disabled', async () => {
      const result = await detectDynamicContent(testImageData, {
        screenSize: { width: 390, height: 844 },
        includeSystemUI: false,
      });

      expect(result.regions.find((r) => r.name === 'status_bar')).toBeUndefined();
      expect(result.regions.find((r) => r.name === 'home_indicator')).toBeUndefined();
    });

    it('should detect patterns from elements', async () => {
      const elements: ElementNode[] = [
        {
          type: 'ActivityIndicator',
          identifier: 'loading_spinner',
          label: 'Loading',
          frame: { x: 100, y: 100, width: 30, height: 30 },
          children: [],
        },
      ];

      const result = await detectDynamicContent(testImageData, {
        elements,
        screenSize: { width: 390, height: 844 },
        includeSystemUI: false,
      });

      expect(result.regions.length).toBeGreaterThan(0);
    });

    it('should return detected patterns', async () => {
      const result = await detectDynamicContent(testImageData, {
        includeSystemUI: true,
      });

      expect(result.detectedPatterns).toContain('clock');
      expect(result.detectedPatterns).toContain('battery');
      expect(result.detectedPatterns).toContain('signal');
    });

    it('should calculate overall confidence', async () => {
      const result = await detectDynamicContent(testImageData, {
        includeSystemUI: true,
      });

      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });
  });
});

// =============================================================================
// Validation Tests
// =============================================================================

describe('Ignore Region Validation', () => {
  describe('validateIgnoreRegion', () => {
    it('should validate a valid region', () => {
      const region: IgnoreRegion = {
        name: 'test',
        rect: { x: 10, y: 20, width: 100, height: 50 },
        reason: 'custom',
      };

      const result = validateIgnoreRegion(region, { width: 390, height: 844 });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject region without name', () => {
      const region: IgnoreRegion = {
        name: '',
        rect: { x: 0, y: 0, width: 100, height: 50 },
        reason: 'custom',
      };

      const result = validateIgnoreRegion(region);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Region name is required');
    });

    it('should reject region with zero width', () => {
      const region: IgnoreRegion = {
        name: 'test',
        rect: { x: 0, y: 0, width: 0, height: 50 },
        reason: 'custom',
      };

      const result = validateIgnoreRegion(region);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Region width must be positive');
    });

    it('should reject region with zero height', () => {
      const region: IgnoreRegion = {
        name: 'test',
        rect: { x: 0, y: 0, width: 100, height: 0 },
        reason: 'custom',
      };

      const result = validateIgnoreRegion(region);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Region height must be positive');
    });

    it('should warn about negative coordinates', () => {
      const region: IgnoreRegion = {
        name: 'test',
        rect: { x: -10, y: -20, width: 100, height: 50 },
        reason: 'custom',
      };

      const result = validateIgnoreRegion(region, { width: 390, height: 844 });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Region x coordinate is negative');
      expect(result.warnings).toContain('Region y coordinate is negative');
    });

    it('should warn about region extending beyond screen', () => {
      const region: IgnoreRegion = {
        name: 'test',
        rect: { x: 350, y: 800, width: 100, height: 100 },
        reason: 'custom',
      };

      const result = validateIgnoreRegion(region, { width: 390, height: 844 });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Region extends beyond screen width');
      expect(result.warnings).toContain('Region extends beyond screen height');
    });

    it('should warn about very large regions', () => {
      const region: IgnoreRegion = {
        name: 'test',
        rect: { x: 0, y: 0, width: 390, height: 500 },
        reason: 'custom',
      };

      const result = validateIgnoreRegion(region, { width: 390, height: 844 });

      expect(result.warnings).toContain('Region covers more than 50% of screen');
    });
  });

  describe('isPointInRegion', () => {
    const region: IgnoreRegion = {
      name: 'test',
      rect: { x: 10, y: 20, width: 100, height: 50 },
      reason: 'custom',
    };

    it('should return true for point inside region', () => {
      expect(isPointInRegion(50, 40, region)).toBe(true);
    });

    it('should return true for point at top-left corner', () => {
      expect(isPointInRegion(10, 20, region)).toBe(true);
    });

    it('should return false for point at bottom-right corner (exclusive)', () => {
      expect(isPointInRegion(110, 70, region)).toBe(false);
    });

    it('should return false for point outside region', () => {
      expect(isPointInRegion(5, 10, region)).toBe(false);
      expect(isPointInRegion(150, 40, region)).toBe(false);
      expect(isPointInRegion(50, 100, region)).toBe(false);
    });
  });

  describe('regionsOverlap', () => {
    it('should detect overlapping regions', () => {
      const a: IgnoreRegion = {
        name: 'a',
        rect: { x: 0, y: 0, width: 100, height: 100 },
        reason: 'custom',
      };
      const b: IgnoreRegion = {
        name: 'b',
        rect: { x: 50, y: 50, width: 100, height: 100 },
        reason: 'custom',
      };

      expect(regionsOverlap(a, b)).toBe(true);
    });

    it('should return false for non-overlapping regions', () => {
      const a: IgnoreRegion = {
        name: 'a',
        rect: { x: 0, y: 0, width: 50, height: 50 },
        reason: 'custom',
      };
      const b: IgnoreRegion = {
        name: 'b',
        rect: { x: 100, y: 100, width: 50, height: 50 },
        reason: 'custom',
      };

      expect(regionsOverlap(a, b)).toBe(false);
    });

    it('should return false for adjacent regions', () => {
      const a: IgnoreRegion = {
        name: 'a',
        rect: { x: 0, y: 0, width: 50, height: 50 },
        reason: 'custom',
      };
      const b: IgnoreRegion = {
        name: 'b',
        rect: { x: 50, y: 0, width: 50, height: 50 },
        reason: 'custom',
      };

      expect(regionsOverlap(a, b)).toBe(false);
    });

    it('should detect fully contained regions', () => {
      const a: IgnoreRegion = {
        name: 'a',
        rect: { x: 0, y: 0, width: 200, height: 200 },
        reason: 'custom',
      };
      const b: IgnoreRegion = {
        name: 'b',
        rect: { x: 50, y: 50, width: 50, height: 50 },
        reason: 'custom',
      };

      expect(regionsOverlap(a, b)).toBe(true);
    });
  });

  describe('mergeOverlappingRegions', () => {
    it('should merge overlapping regions', () => {
      const regions: IgnoreRegion[] = [
        { name: 'a', rect: { x: 0, y: 0, width: 100, height: 100 }, reason: 'custom' },
        { name: 'b', rect: { x: 50, y: 50, width: 100, height: 100 }, reason: 'custom' },
      ];

      const merged = mergeOverlappingRegions(regions);

      expect(merged).toHaveLength(1);
      expect(merged[0].rect).toEqual({ x: 0, y: 0, width: 150, height: 150 });
    });

    it('should not merge non-overlapping regions', () => {
      const regions: IgnoreRegion[] = [
        { name: 'a', rect: { x: 0, y: 0, width: 50, height: 50 }, reason: 'custom' },
        { name: 'b', rect: { x: 100, y: 100, width: 50, height: 50 }, reason: 'custom' },
      ];

      const merged = mergeOverlappingRegions(regions);

      expect(merged).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const merged = mergeOverlappingRegions([]);
      expect(merged).toHaveLength(0);
    });

    it('should handle single region', () => {
      const regions: IgnoreRegion[] = [
        { name: 'a', rect: { x: 0, y: 0, width: 50, height: 50 }, reason: 'custom' },
      ];

      const merged = mergeOverlappingRegions(regions);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual(regions[0]);
    });

    it('should merge chain of overlapping regions', () => {
      const regions: IgnoreRegion[] = [
        { name: 'a', rect: { x: 0, y: 0, width: 50, height: 50 }, reason: 'custom' },
        { name: 'b', rect: { x: 40, y: 0, width: 50, height: 50 }, reason: 'custom' },
        { name: 'c', rect: { x: 80, y: 0, width: 50, height: 50 }, reason: 'custom' },
      ];

      const merged = mergeOverlappingRegions(regions);

      expect(merged).toHaveLength(1);
      expect(merged[0].rect.width).toBe(130);
    });
  });
});

// =============================================================================
// Device Preset Tests
// =============================================================================

describe('Device Presets', () => {
  describe('IGNORE_PRESETS', () => {
    it('should have iPhoneDynamicIsland preset', () => {
      const regions = IGNORE_PRESETS.iPhoneDynamicIsland(430, 932);

      expect(regions).toHaveLength(2);
      expect(regions[0].rect.height).toBe(59);
      expect(regions[1].rect.y).toBe(932 - 34);
    });

    it('should have iPhoneNotch preset', () => {
      const regions = IGNORE_PRESETS.iPhoneNotch(390, 844);

      expect(regions).toHaveLength(2);
      expect(regions[0].rect.height).toBe(47);
    });

    it('should have iPhoneHomeButton preset', () => {
      const regions = IGNORE_PRESETS.iPhoneHomeButton(375);

      expect(regions).toHaveLength(1);
      expect(regions[0].rect.height).toBe(20);
    });

    it('should have iPad preset', () => {
      const regions = IGNORE_PRESETS.iPad(1024, 1366);

      expect(regions).toHaveLength(2);
      expect(regions[0].rect.height).toBe(24);
    });

    it('should have fullSystemUI preset', () => {
      const regions = IGNORE_PRESETS.fullSystemUI(390, 844);

      expect(regions).toHaveLength(2);
    });
  });

  describe('getDevicePreset', () => {
    it('should return iPad preset for iPad devices', () => {
      const regions = getDevicePreset('iPad Pro 12.9', 1024, 1366);

      expect(regions).toHaveLength(2);
      expect(regions[0].rect.height).toBe(24);
    });

    it('should return home button preset for iPhone SE', () => {
      const regions = getDevicePreset('iPhone SE', 375, 667);

      expect(regions).toHaveLength(1);
      expect(regions[0].rect.height).toBe(20);
    });

    it('should return home button preset for iPhone 8', () => {
      const regions = getDevicePreset('iPhone 8', 375, 667);

      expect(regions).toHaveLength(1);
    });

    it('should return Dynamic Island preset for iPhone 15', () => {
      const regions = getDevicePreset('iPhone 15 Pro', 430, 932);

      expect(regions).toHaveLength(2);
      expect(regions[0].rect.height).toBe(59);
    });

    it('should return Dynamic Island preset for iPhone 14 Pro', () => {
      const regions = getDevicePreset('iPhone 14 Pro Max', 430, 932);

      expect(regions).toHaveLength(2);
      expect(regions[0].rect.height).toBe(59);
    });

    it('should default to notch preset for other iPhones', () => {
      const regions = getDevicePreset('iPhone 13', 390, 844);

      expect(regions).toHaveLength(2);
      expect(regions[0].rect.height).toBe(47);
    });
  });
});

// =============================================================================
// Conversion Tests
// =============================================================================

describe('Ignore Region Conversion', () => {
  describe('toBasicIgnoreRegion', () => {
    it('should convert extended region to basic region', () => {
      const extended: ExtendedIgnoreRegion = {
        name: 'test',
        rect: { x: 10, y: 20, width: 100, height: 50 },
        reason: 'custom',
        description: 'Test region',
        type: 'static',
        confidence: 0.9,
        autoSuggested: true,
      };

      const basic = toBasicIgnoreRegion(extended);

      expect(basic.name).toBe('test');
      expect(basic.rect).toEqual({ x: 10, y: 20, width: 100, height: 50 });
      expect(basic.reason).toBe('custom');
      expect(basic.description).toBe('Test region');
      expect((basic as ExtendedIgnoreRegion).type).toBeUndefined();
      expect((basic as ExtendedIgnoreRegion).confidence).toBeUndefined();
    });
  });

  describe('toBasicIgnoreRegions', () => {
    it('should convert array of extended regions', () => {
      const extended: ExtendedIgnoreRegion[] = [
        {
          name: 'a',
          rect: { x: 0, y: 0, width: 50, height: 50 },
          reason: 'custom',
          type: 'static',
        },
        {
          name: 'b',
          rect: { x: 100, y: 100, width: 50, height: 50 },
          reason: 'dynamic_content',
          type: 'pattern',
          patternType: 'clock',
        },
      ];

      const basic = toBasicIgnoreRegions(extended);

      expect(basic).toHaveLength(2);
      expect((basic[0] as ExtendedIgnoreRegion).type).toBeUndefined();
      expect((basic[1] as ExtendedIgnoreRegion).patternType).toBeUndefined();
    });

    it('should handle empty array', () => {
      const basic = toBasicIgnoreRegions([]);
      expect(basic).toHaveLength(0);
    });
  });
});

// =============================================================================
// Suggest Ignore Regions Tests
// =============================================================================

describe('Suggest Ignore Regions', () => {
  describe('suggestIgnoreRegions', () => {
    const createTestImageData = (width: number, height: number) => ({
      data: Buffer.alloc(width * height * 4, 128),
      width,
      height,
      channels: 4 as const,
    });

    it('should return system UI suggestions', async () => {
      const baseline = createTestImageData(390, 844);
      const current = createTestImageData(390, 844);

      const suggestions = await suggestIgnoreRegions(baseline, current, {
        includeSystemUI: true,
      });

      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions[0].region.name).toBe('status_bar');
      expect(suggestions[0].isCommonPattern).toBe(true);
    });

    it('should prioritize suggestions correctly', async () => {
      const baseline = createTestImageData(390, 844);
      const current = createTestImageData(390, 844);

      const suggestions = await suggestIgnoreRegions(baseline, current, {
        includeSystemUI: true,
      });

      // Should be sorted by priority (descending)
      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].priority).toBeGreaterThanOrEqual(suggestions[i + 1].priority);
      }
    });

    it('should limit number of suggestions', async () => {
      const baseline = createTestImageData(390, 844);
      const current = createTestImageData(390, 844);

      const suggestions = await suggestIgnoreRegions(baseline, current, {
        includeSystemUI: true,
        maxSuggestions: 3,
      });

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should add element-based suggestions for activity indicators', async () => {
      const baseline = createTestImageData(390, 844);
      const current = createTestImageData(390, 844);

      const elements: ElementNode[] = [
        {
          type: 'ActivityIndicator',
          identifier: 'loading_spinner',
          label: 'Loading',
          frame: { x: 100, y: 100, width: 30, height: 30 },
          children: [],
        },
      ];

      const suggestions = await suggestIgnoreRegions(baseline, current, {
        elements,
        includeSystemUI: false,
      });

      expect(suggestions.some((s) => s.region.reason === 'dynamic_content')).toBe(true);
    });

    it('should suggest avatar regions', async () => {
      const baseline = createTestImageData(390, 844);
      const current = createTestImageData(390, 844);

      const elements: ElementNode[] = [
        {
          type: 'Image',
          identifier: 'user_avatar_image',
          label: 'User Avatar',
          frame: { x: 20, y: 50, width: 60, height: 60 },
          children: [],
        },
      ];

      const suggestions = await suggestIgnoreRegions(baseline, current, {
        elements,
        includeSystemUI: false,
      });

      expect(suggestions.some((s) => s.region.reason === 'user_avatar')).toBe(true);
    });
  });
});
