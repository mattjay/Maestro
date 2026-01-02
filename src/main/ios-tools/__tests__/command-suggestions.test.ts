/**
 * Tests for iOS Command Suggestions module
 */

import {
  getCommandSuggestions,
  getSuggestionsByCategory,
  getTopSuggestions,
  formatSuggestionsAsMarkdown,
  formatSuggestionsCompact,
  formatSuggestionsAsJson,
  hasDefinedSuggestions,
  getAllCategories,
  registerCommandSuggestions,
  registerErrorSuggestions,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  CommandSuggestion,
  SuggestionContext,
  CommandSuggestionResult,
} from '../command-suggestions';

describe('iOS Command Suggestions', () => {
  // =============================================================================
  // getCommandSuggestions
  // =============================================================================

  describe('getCommandSuggestions', () => {
    describe('after /ios.snapshot', () => {
      it('should suggest inspect as first action', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.snapshot',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions[0].command).toBe('/ios.inspect');
        expect(result.header).toContain('/ios.snapshot');
      });

      it('should suggest diff when baselines are available', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.snapshot',
          success: true,
          baselines: ['login_screen', 'home_screen'],
        };

        const result = getCommandSuggestions(context);

        const diffSuggestion = result.suggestions.find(s => s.command === '/ios.diff');
        expect(diffSuggestion).toBeDefined();
        expect(diffSuggestion?.example).toContain('login_screen');
      });

      it('should suggest baseline save when no baselines exist', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.snapshot',
          success: true,
          baselines: [],
        };

        const result = getCommandSuggestions(context);

        const baselineSuggestion = result.suggestions.find(s => s.command === '/ios.baseline save');
        expect(baselineSuggestion).toBeDefined();
      });

      it('should include tap and scroll suggestions', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.snapshot',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.tap')).toBe(true);
        expect(result.suggestions.some(s => s.command === '/ios.scroll')).toBe(true);
      });
    });

    describe('after /ios.inspect', () => {
      it('should suggest tap with element when elements are found', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.inspect',
          success: true,
          elements: ['login-button', 'email-field', 'password-field'],
        };

        const result = getCommandSuggestions(context);

        const tapSuggestion = result.suggestions.find(s => s.command === '/ios.tap');
        expect(tapSuggestion).toBeDefined();
        expect(tapSuggestion?.example).toContain('login-button');
      });

      it('should suggest type with element when elements are found', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.inspect',
          success: true,
          elements: ['email-field'],
        };

        const result = getCommandSuggestions(context);

        const typeSuggestion = result.suggestions.find(s => s.command === '/ios.type');
        expect(typeSuggestion).toBeDefined();
        expect(typeSuggestion?.example).toContain('email-field');
      });

      it('should provide generic examples when no elements found', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.inspect',
          success: true,
        };

        const result = getCommandSuggestions(context);

        const tapSuggestion = result.suggestions.find(s => s.command === '/ios.tap');
        expect(tapSuggestion?.example).toContain('#element-id');
      });

      it('should suggest run_flow for automation', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.inspect',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.run_flow')).toBe(true);
      });
    });

    describe('after /ios.tap', () => {
      it('should prioritize snapshot to verify result', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.tap',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions[0].command).toBe('/ios.snapshot');
        expect(result.suggestions[0].category).toBe('verify');
      });

      it('should suggest type for text input follow-up', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.tap',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.type')).toBe(true);
      });
    });

    describe('after /ios.type', () => {
      it('should suggest submitting the form', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.type',
          success: true,
        };

        const result = getCommandSuggestions(context);

        const tapSuggestion = result.suggestions.find(s =>
          s.command === '/ios.tap' && s.description.toLowerCase().includes('submit')
        );
        expect(tapSuggestion).toBeDefined();
      });

      it('should suggest filling another field', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.type',
          success: true,
        };

        const result = getCommandSuggestions(context);

        const typeSuggestion = result.suggestions.find(s =>
          s.command === '/ios.type' && s.description.toLowerCase().includes('another')
        );
        expect(typeSuggestion).toBeDefined();
      });
    });

    describe('after /ios.scroll', () => {
      it('should suggest inspect to see new elements', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.scroll',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions[0].command).toBe('/ios.inspect');
      });

      it('should suggest continue scrolling', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.scroll',
          success: true,
        };

        const result = getCommandSuggestions(context);

        const scrollSuggestion = result.suggestions.find(s =>
          s.command === '/ios.scroll' && s.reason?.includes('further')
        );
        expect(scrollSuggestion).toBeDefined();
      });
    });

    describe('after /ios.run_flow', () => {
      it('should suggest saving baselines', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.run_flow',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.baseline save')).toBe(true);
      });

      it('should suggest running regression', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.run_flow',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.regression')).toBe(true);
      });

      it('should suggest playbook when multiple flows exist', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.run_flow',
          success: true,
          flows: ['login.yaml', 'checkout.yaml', 'profile.yaml'],
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.playbook')).toBe(true);
      });
    });

    describe('after /ios.baseline', () => {
      it('should suggest diff to compare', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.baseline',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions[0].command).toBe('/ios.diff');
      });

      it('should suggest regression suite', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.baseline',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.regression')).toBe(true);
      });
    });

    describe('after /ios.diff', () => {
      it('should suggest update baseline when differences found', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.diff',
          success: true,
          data: { hasDifferences: true, baselineName: 'login_screen' },
        };

        const result = getCommandSuggestions(context);

        const updateSuggestion = result.suggestions.find(s => s.command === '/ios.baseline update');
        expect(updateSuggestion).toBeDefined();
        expect(updateSuggestion?.example).toContain('login_screen');
      });

      it('should suggest regression for checking all baselines', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.diff',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.regression')).toBe(true);
      });
    });

    describe('after /ios.setup', () => {
      it('should suggest snapshot to verify environment', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.setup',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions[0].command).toBe('/ios.snapshot');
      });

      it('should suggest running sample flow', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.setup',
          success: true,
        };

        const result = getCommandSuggestions(context);

        const flowSuggestion = result.suggestions.find(s => s.command === '/ios.run_flow');
        expect(flowSuggestion).toBeDefined();
        expect(flowSuggestion?.example).toContain('sample_flow');
      });

      it('should suggest help command', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.setup',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.help')).toBe(true);
      });
    });

    describe('after /ios.bridge.state', () => {
      it('should suggest related bridge commands', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.bridge.state',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.bridge.flags')).toBe(true);
        expect(result.suggestions.some(s => s.command === '/ios.bridge.set')).toBe(true);
        expect(result.suggestions.some(s => s.command === '/ios.bridge.network')).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should suggest fix commands for ELEMENT_NOT_FOUND error', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.tap',
          success: false,
          errorCode: 'ELEMENT_NOT_FOUND',
        };

        const result = getCommandSuggestions(context);

        expect(result.header).toContain('resolve');
        expect(result.suggestions.some(s => s.command === '/ios.inspect')).toBe(true);
        expect(result.suggestions.some(s => s.command === '/ios.scroll')).toBe(true);
      });

      it('should suggest setup fix for SIMULATOR_NOT_BOOTED', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.snapshot',
          success: false,
          errorCode: 'SIMULATOR_NOT_BOOTED',
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.setup --fix')).toBe(true);
        expect(result.suggestions.some(s => s.command === '/ios.setup --check')).toBe(true);
      });

      it('should suggest installation for MAESTRO_NOT_INSTALLED', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.run_flow',
          success: false,
          errorCode: 'MAESTRO_NOT_INSTALLED',
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.some(s => s.command === '/ios.setup --fix')).toBe(true);
      });

      it('should suggest retry with timeout for FLOW_TIMEOUT', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.run_flow',
          success: false,
          errorCode: 'FLOW_TIMEOUT',
        };

        const result = getCommandSuggestions(context);

        const retrySuggestion = result.suggestions.find(s =>
          s.command === '/ios.run_flow' && s.example?.includes('--timeout')
        );
        expect(retrySuggestion).toBeDefined();
      });

      it('should provide default suggestions for unknown error', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.tap',
          success: false,
          errorCode: 'UNKNOWN_ERROR',
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions.some(s => s.command === '/ios.snapshot')).toBe(true);
      });
    });

    describe('unknown commands', () => {
      it('should provide default suggestions for unknown commands', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.unknown_command',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions.some(s => s.command === '/ios.snapshot')).toBe(true);
        expect(result.suggestions.some(s => s.command === '/ios.inspect')).toBe(true);
        expect(result.suggestions.some(s => s.command === '/ios.help')).toBe(true);
      });
    });

    describe('command normalization', () => {
      it('should handle commands with extra arguments', () => {
        const context: SuggestionContext = {
          executedCommand: '/ios.snapshot --output test.png',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions[0].command).toBe('/ios.inspect');
      });

      it('should handle commands without leading slash', () => {
        const context: SuggestionContext = {
          executedCommand: 'ios.tap #button',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions.length).toBeGreaterThan(0);
      });

      it('should handle uppercase commands', () => {
        const context: SuggestionContext = {
          executedCommand: '/IOS.SNAPSHOT',
          success: true,
        };

        const result = getCommandSuggestions(context);

        expect(result.suggestions[0].command).toBe('/ios.inspect');
      });
    });
  });

  // =============================================================================
  // getSuggestionsByCategory
  // =============================================================================

  describe('getSuggestionsByCategory', () => {
    it('should filter suggestions by verify category', () => {
      const context: SuggestionContext = {
        executedCommand: '/ios.snapshot',
        success: true,
      };

      const result = getSuggestionsByCategory(context, 'verify');

      expect(result.suggestions.every(s => s.category === 'verify')).toBe(true);
      expect(result.header).toContain(CATEGORY_LABELS.verify);
    });

    it('should filter suggestions by interact category', () => {
      const context: SuggestionContext = {
        executedCommand: '/ios.inspect',
        success: true,
      };

      const result = getSuggestionsByCategory(context, 'interact');

      expect(result.suggestions.every(s => s.category === 'interact')).toBe(true);
    });

    it('should filter suggestions by capture category', () => {
      const context: SuggestionContext = {
        executedCommand: '/ios.run_flow',
        success: true,
      };

      const result = getSuggestionsByCategory(context, 'capture');

      expect(result.suggestions.every(s => s.category === 'capture')).toBe(true);
    });

    it('should return empty array when no suggestions match category', () => {
      const context: SuggestionContext = {
        executedCommand: '/ios.snapshot',
        success: true,
      };

      // Automate category shouldn't have suggestions for snapshot
      const result = getSuggestionsByCategory(context, 'automate');

      expect(result.suggestions.length).toBe(0);
    });
  });

  // =============================================================================
  // getTopSuggestions
  // =============================================================================

  describe('getTopSuggestions', () => {
    it('should limit suggestions to specified count', () => {
      const context: SuggestionContext = {
        executedCommand: '/ios.snapshot',
        success: true,
      };

      const result = getTopSuggestions(context, 2);

      expect(result.suggestions.length).toBe(2);
    });

    it('should preserve total count', () => {
      const context: SuggestionContext = {
        executedCommand: '/ios.snapshot',
        success: true,
      };

      const fullResult = getCommandSuggestions(context);
      const limitedResult = getTopSuggestions(context, 2);

      expect(limitedResult.totalSuggestions).toBe(fullResult.totalSuggestions);
    });

    it('should default to 3 suggestions', () => {
      const context: SuggestionContext = {
        executedCommand: '/ios.snapshot',
        success: true,
      };

      const result = getTopSuggestions(context);

      expect(result.suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should return all when fewer than limit', () => {
      const context: SuggestionContext = {
        executedCommand: '/ios.tap',
        success: false,
        errorCode: 'SIMULATOR_NOT_BOOTED',
      };

      const result = getTopSuggestions(context, 10);

      expect(result.suggestions.length).toBeLessThanOrEqual(result.totalSuggestions);
    });
  });

  // =============================================================================
  // formatSuggestionsAsMarkdown
  // =============================================================================

  describe('formatSuggestionsAsMarkdown', () => {
    it('should format suggestions with header', () => {
      const result: CommandSuggestionResult = {
        header: 'After /ios.snapshot, you might want:',
        suggestions: [
          {
            command: '/ios.inspect',
            description: 'Analyze UI elements',
            reason: 'View the element tree',
            example: '/ios.inspect',
            priority: 1,
            category: 'verify',
          },
        ],
        totalSuggestions: 1,
      };

      const markdown = formatSuggestionsAsMarkdown(result);

      expect(markdown).toContain('### After /ios.snapshot');
      expect(markdown).toContain('/ios.inspect');
      expect(markdown).toContain('Analyze UI elements');
    });

    it('should include examples when requested', () => {
      const result: CommandSuggestionResult = {
        header: 'Suggestions',
        suggestions: [
          {
            command: '/ios.tap',
            description: 'Tap element',
            example: '/ios.tap #button-id',
            priority: 1,
            category: 'interact',
          },
        ],
        totalSuggestions: 1,
      };

      const markdown = formatSuggestionsAsMarkdown(result, { showExamples: true });

      expect(markdown).toContain('/ios.tap #button-id');
    });

    it('should include reasons when requested', () => {
      const result: CommandSuggestionResult = {
        header: 'Suggestions',
        suggestions: [
          {
            command: '/ios.inspect',
            description: 'Inspect',
            reason: 'Find element identifiers',
            priority: 1,
            category: 'verify',
          },
        ],
        totalSuggestions: 1,
      };

      const markdown = formatSuggestionsAsMarkdown(result, { showReasons: true });

      expect(markdown).toContain('Find element identifiers');
    });

    it('should exclude examples when not requested', () => {
      const result: CommandSuggestionResult = {
        header: 'Suggestions',
        suggestions: [
          {
            command: '/ios.tap',
            description: 'Tap',
            example: '/ios.tap #specific-example',
            priority: 1,
            category: 'interact',
          },
        ],
        totalSuggestions: 1,
      };

      const markdown = formatSuggestionsAsMarkdown(result, { showExamples: false });

      expect(markdown).not.toContain('/ios.tap #specific-example');
    });

    it('should group by category when requested', () => {
      const result: CommandSuggestionResult = {
        header: 'Suggestions',
        suggestions: [
          { command: '/ios.inspect', description: 'Inspect', priority: 1, category: 'verify' },
          { command: '/ios.tap', description: 'Tap', priority: 2, category: 'interact' },
          { command: '/ios.snapshot', description: 'Capture', priority: 3, category: 'capture' },
        ],
        totalSuggestions: 3,
      };

      const markdown = formatSuggestionsAsMarkdown(result, { groupByCategory: true });

      expect(markdown).toContain(CATEGORY_LABELS.verify);
      expect(markdown).toContain(CATEGORY_LABELS.interact);
      expect(markdown).toContain(CATEGORY_LABELS.capture);
    });

    it('should limit suggestions when maxSuggestions is set', () => {
      const result: CommandSuggestionResult = {
        header: 'Suggestions',
        suggestions: [
          { command: '/ios.a', description: 'A', priority: 1, category: 'verify' },
          { command: '/ios.b', description: 'B', priority: 2, category: 'verify' },
          { command: '/ios.c', description: 'C', priority: 3, category: 'verify' },
          { command: '/ios.d', description: 'D', priority: 4, category: 'verify' },
        ],
        totalSuggestions: 4,
      };

      const markdown = formatSuggestionsAsMarkdown(result, { maxSuggestions: 2 });

      expect(markdown).toContain('/ios.a');
      expect(markdown).toContain('/ios.b');
      expect(markdown).not.toContain('/ios.c');
      expect(markdown).not.toContain('/ios.d');
      expect(markdown).toContain('2 more suggestions');
    });

    it('should return empty string for no suggestions', () => {
      const result: CommandSuggestionResult = {
        header: 'Suggestions',
        suggestions: [],
        totalSuggestions: 0,
      };

      const markdown = formatSuggestionsAsMarkdown(result);

      expect(markdown).toBe('');
    });
  });

  // =============================================================================
  // formatSuggestionsCompact
  // =============================================================================

  describe('formatSuggestionsCompact', () => {
    it('should format as compact list', () => {
      const result: CommandSuggestionResult = {
        header: 'You might want:',
        suggestions: [
          { command: '/ios.inspect', description: 'Analyze elements', priority: 1, category: 'verify' },
          { command: '/ios.tap', description: 'Tap element', priority: 2, category: 'interact' },
        ],
        totalSuggestions: 2,
      };

      const compact = formatSuggestionsCompact(result);

      expect(compact).toContain('You might want:');
      expect(compact).toContain('`/ios.inspect`');
      expect(compact).toContain('Analyze elements');
    });

    it('should limit to maxSuggestions', () => {
      const result: CommandSuggestionResult = {
        header: 'Header',
        suggestions: [
          { command: '/ios.a', description: 'A', priority: 1, category: 'verify' },
          { command: '/ios.b', description: 'B', priority: 2, category: 'verify' },
          { command: '/ios.c', description: 'C', priority: 3, category: 'verify' },
        ],
        totalSuggestions: 3,
      };

      const compact = formatSuggestionsCompact(result, 2);

      expect(compact).toContain('/ios.a');
      expect(compact).toContain('/ios.b');
      expect(compact).not.toContain('/ios.c');
    });

    it('should return empty string for no suggestions', () => {
      const result: CommandSuggestionResult = {
        header: 'Header',
        suggestions: [],
        totalSuggestions: 0,
      };

      const compact = formatSuggestionsCompact(result);

      expect(compact).toBe('');
    });
  });

  // =============================================================================
  // formatSuggestionsAsJson
  // =============================================================================

  describe('formatSuggestionsAsJson', () => {
    it('should format as valid JSON', () => {
      const result: CommandSuggestionResult = {
        header: 'Test',
        suggestions: [
          { command: '/ios.test', description: 'Test', priority: 1, category: 'verify' },
        ],
        totalSuggestions: 1,
      };

      const json = formatSuggestionsAsJson(result);
      const parsed = JSON.parse(json);

      expect(parsed.header).toBe('Test');
      expect(parsed.suggestions.length).toBe(1);
      expect(parsed.suggestions[0].command).toBe('/ios.test');
    });

    it('should be pretty-printed', () => {
      const result: CommandSuggestionResult = {
        header: 'Test',
        suggestions: [],
        totalSuggestions: 0,
      };

      const json = formatSuggestionsAsJson(result);

      expect(json).toContain('\n');
    });
  });

  // =============================================================================
  // hasDefinedSuggestions
  // =============================================================================

  describe('hasDefinedSuggestions', () => {
    it('should return true for defined commands', () => {
      expect(hasDefinedSuggestions('/ios.snapshot')).toBe(true);
      expect(hasDefinedSuggestions('/ios.inspect')).toBe(true);
      expect(hasDefinedSuggestions('/ios.tap')).toBe(true);
      expect(hasDefinedSuggestions('/ios.type')).toBe(true);
      expect(hasDefinedSuggestions('/ios.run_flow')).toBe(true);
    });

    it('should return false for undefined commands', () => {
      expect(hasDefinedSuggestions('/ios.unknown')).toBe(false);
      expect(hasDefinedSuggestions('/ios.fake_command')).toBe(false);
    });

    it('should handle command normalization', () => {
      expect(hasDefinedSuggestions('/IOS.SNAPSHOT')).toBe(true);
      expect(hasDefinedSuggestions('ios.snapshot')).toBe(true);
    });
  });

  // =============================================================================
  // getAllCategories
  // =============================================================================

  describe('getAllCategories', () => {
    it('should return all categories with labels and icons', () => {
      const categories = getAllCategories();

      expect(categories.length).toBe(5);
      expect(categories.map(c => c.category)).toContain('verify');
      expect(categories.map(c => c.category)).toContain('interact');
      expect(categories.map(c => c.category)).toContain('capture');
      expect(categories.map(c => c.category)).toContain('automate');
      expect(categories.map(c => c.category)).toContain('debug');
    });

    it('should have consistent labels', () => {
      const categories = getAllCategories();

      for (const cat of categories) {
        expect(cat.label).toBe(CATEGORY_LABELS[cat.category]);
        expect(cat.icon).toBe(CATEGORY_ICONS[cat.category]);
      }
    });
  });

  // =============================================================================
  // registerCommandSuggestions
  // =============================================================================

  describe('registerCommandSuggestions', () => {
    it('should allow registering custom suggestions', () => {
      // Register custom command
      registerCommandSuggestions('/ios.custom', (ctx) => [
        {
          command: '/ios.special',
          description: 'Special command',
          priority: 1,
          category: 'debug',
        },
      ]);

      const context: SuggestionContext = {
        executedCommand: '/ios.custom',
        success: true,
      };

      const result = getCommandSuggestions(context);

      expect(result.suggestions[0].command).toBe('/ios.special');
      expect(hasDefinedSuggestions('/ios.custom')).toBe(true);
    });

    it('should normalize command name on registration', () => {
      registerCommandSuggestions('ios.test', () => [
        {
          command: '/ios.result',
          description: 'Result',
          priority: 1,
          category: 'verify',
        },
      ]);

      expect(hasDefinedSuggestions('/ios.test')).toBe(true);
    });
  });

  // =============================================================================
  // registerErrorSuggestions
  // =============================================================================

  describe('registerErrorSuggestions', () => {
    it('should allow registering error-specific suggestions', () => {
      registerErrorSuggestions('CUSTOM_ERROR', [
        {
          command: '/ios.fix_custom',
          description: 'Fix custom error',
          priority: 1,
          category: 'debug',
        },
      ]);

      const context: SuggestionContext = {
        executedCommand: '/ios.tap',
        success: false,
        errorCode: 'CUSTOM_ERROR',
      };

      const result = getCommandSuggestions(context);

      expect(result.suggestions[0].command).toBe('/ios.fix_custom');
    });
  });

  // =============================================================================
  // Constants
  // =============================================================================

  describe('constants', () => {
    it('should have category labels for all categories', () => {
      expect(CATEGORY_LABELS.verify).toBeDefined();
      expect(CATEGORY_LABELS.interact).toBeDefined();
      expect(CATEGORY_LABELS.capture).toBeDefined();
      expect(CATEGORY_LABELS.automate).toBeDefined();
      expect(CATEGORY_LABELS.debug).toBeDefined();
    });

    it('should have category icons for all categories', () => {
      expect(CATEGORY_ICONS.verify).toBeDefined();
      expect(CATEGORY_ICONS.interact).toBeDefined();
      expect(CATEGORY_ICONS.capture).toBeDefined();
      expect(CATEGORY_ICONS.automate).toBeDefined();
      expect(CATEGORY_ICONS.debug).toBeDefined();
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    it('should handle empty context', () => {
      const context: SuggestionContext = {
        executedCommand: '',
        success: true,
      };

      const result = getCommandSuggestions(context);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle context with all optional fields', () => {
      const context: SuggestionContext = {
        executedCommand: '/ios.snapshot',
        success: true,
        elements: ['el1', 'el2'],
        baselines: ['b1'],
        flows: ['f1.yaml'],
        simulator: 'iPhone 15 Pro',
        bundleId: 'com.test.app',
        screenshotPath: '/path/to/shot.png',
        data: { extra: 'data' },
      };

      const result = getCommandSuggestions(context);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should sort suggestions by priority', () => {
      const context: SuggestionContext = {
        executedCommand: '/ios.snapshot',
        success: true,
      };

      const result = getCommandSuggestions(context);

      for (let i = 1; i < result.suggestions.length; i++) {
        expect(result.suggestions[i].priority).toBeGreaterThanOrEqual(
          result.suggestions[i - 1].priority
        );
      }
    });
  });
});
