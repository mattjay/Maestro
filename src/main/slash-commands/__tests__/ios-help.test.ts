/**
 * Tests for iOS Help Slash Command Handler
 */

import {
  executeHelpCommand,
  parseHelpArgs,
  helpCommandMetadata,
} from '../ios-help';

// =============================================================================
// Argument Parsing Tests
// =============================================================================

describe('parseHelpArgs', () => {
  describe('basic parsing', () => {
    it('should parse empty command', () => {
      const args = parseHelpArgs('/ios.help');
      expect(args).toEqual({
        mode: 'overview',
      });
    });

    it('should parse command with whitespace', () => {
      const args = parseHelpArgs('/ios.help   ');
      expect(args).toEqual({
        mode: 'overview',
      });
    });

    it('should parse command name', () => {
      const args = parseHelpArgs('/ios.help snapshot');
      expect(args).toEqual({
        mode: 'command',
        commandName: 'snapshot',
      });
    });

    it('should parse full command name with slash', () => {
      const args = parseHelpArgs('/ios.help /ios.snapshot');
      expect(args).toEqual({
        mode: 'command',
        commandName: '/ios.snapshot',
      });
    });
  });

  describe('flags parsing', () => {
    it('should parse --troubleshoot flag', () => {
      const args = parseHelpArgs('/ios.help --troubleshoot');
      expect(args).toEqual({
        mode: 'troubleshoot',
      });
    });

    it('should parse -t short flag', () => {
      const args = parseHelpArgs('/ios.help -t');
      expect(args).toEqual({
        mode: 'troubleshoot',
      });
    });

    it('should parse --examples flag', () => {
      const args = parseHelpArgs('/ios.help --examples');
      expect(args).toEqual({
        mode: 'overview',
        showExamples: true,
      });
    });

    it('should parse -e short flag', () => {
      const args = parseHelpArgs('/ios.help -e');
      expect(args).toEqual({
        mode: 'overview',
        showExamples: true,
      });
    });
  });

  describe('combined parsing', () => {
    it('should parse command with examples flag', () => {
      const args = parseHelpArgs('/ios.help snapshot --examples');
      expect(args).toEqual({
        mode: 'command',
        commandName: 'snapshot',
        showExamples: true,
      });
    });

    it('should parse command with short examples flag', () => {
      const args = parseHelpArgs('/ios.help tap -e');
      expect(args).toEqual({
        mode: 'command',
        commandName: 'tap',
        showExamples: true,
      });
    });

    it('should handle flag before command name', () => {
      const args = parseHelpArgs('/ios.help -e baseline');
      expect(args).toEqual({
        mode: 'command',
        commandName: 'baseline',
        showExamples: true,
      });
    });

    it('should handle extra positional args as raw', () => {
      const args = parseHelpArgs('/ios.help snapshot extra args');
      expect(args).toEqual({
        mode: 'command',
        commandName: 'snapshot',
        raw: 'extra args',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle quoted strings', () => {
      const args = parseHelpArgs('/ios.help "bridge.state"');
      expect(args).toEqual({
        mode: 'command',
        commandName: 'bridge.state',
      });
    });

    it('should handle single quotes', () => {
      const args = parseHelpArgs("/ios.help 'run_flow'");
      expect(args).toEqual({
        mode: 'command',
        commandName: 'run_flow',
      });
    });
  });
});

// =============================================================================
// Command Execution Tests
// =============================================================================

describe('executeHelpCommand', () => {
  describe('overview mode', () => {
    it('should return success for overview', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should include header in overview', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.output).toContain('# iOS Development Commands');
    });

    it('should include all categories in overview', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.output).toContain('## Setup & Configuration');
      expect(result.output).toContain('## Screen Capture & Inspection');
      expect(result.output).toContain('## UI Interactions');
      expect(result.output).toContain('## Flow Automation');
      expect(result.output).toContain('## Visual Regression');
      expect(result.output).toContain('## Debug Introspection');
    });

    it('should include key commands in overview', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.output).toContain('/ios.setup');
      expect(result.output).toContain('/ios.snapshot');
      expect(result.output).toContain('/ios.inspect');
      expect(result.output).toContain('/ios.tap');
      expect(result.output).toContain('/ios.type');
      expect(result.output).toContain('/ios.baseline');
      expect(result.output).toContain('/ios.diff');
    });

    it('should include quick start section', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.output).toContain('## Quick Start');
    });

    it('should include help for help', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.output).toContain('## Getting More Help');
      expect(result.output).toContain('/ios.help <command>');
      expect(result.output).toContain('/ios.help --troubleshoot');
    });

    it('should include documentation link', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.output).toContain('https://docs.runmaestro.ai/ios-development');
    });
  });

  describe('overview with examples', () => {
    it('should include common workflows with --examples flag', async () => {
      const result = await executeHelpCommand('/ios.help --examples');
      expect(result.success).toBe(true);
      expect(result.output).toContain('## Common Workflows');
      expect(result.output).toContain('### Feature Development');
      expect(result.output).toContain('### Visual Regression Testing');
    });

    it('should include common workflows with -e flag', async () => {
      const result = await executeHelpCommand('/ios.help -e');
      expect(result.output).toContain('## Common Workflows');
    });
  });

  describe('command help mode', () => {
    it('should return success for valid command', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should include command header', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toContain('# /ios.snapshot');
    });

    it('should include category', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toContain('Screen Capture & Inspection');
    });

    it('should include overview section', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toContain('## Overview');
    });

    it('should include usage section', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toContain('## Usage');
    });

    it('should include options section', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toContain('## Options');
    });

    it('should include examples section', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toContain('## Examples');
    });

    it('should include troubleshooting section', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toContain('## Troubleshooting');
    });

    it('should include related commands', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toContain('## Related Commands');
    });

    it('should include help footer', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toContain('**More help**: `/ios.help`');
    });

    it('should work with partial command name', async () => {
      const result = await executeHelpCommand('/ios.help snap');
      expect(result.success).toBe(true);
      expect(result.output).toContain('/ios.snapshot');
    });

    it('should work with full command path', async () => {
      const result = await executeHelpCommand('/ios.help /ios.inspect');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.inspect');
    });
  });

  describe('specific command help', () => {
    it('should show help for tap command', async () => {
      const result = await executeHelpCommand('/ios.help tap');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.tap');
      expect(result.output).toContain('accessibility identifier');
    });

    it('should show help for type command', async () => {
      const result = await executeHelpCommand('/ios.help type');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.type');
    });

    it('should show help for scroll command', async () => {
      const result = await executeHelpCommand('/ios.help scroll');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.scroll');
    });

    it('should show help for swipe command', async () => {
      const result = await executeHelpCommand('/ios.help swipe');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.swipe');
    });

    it('should show help for run_flow command', async () => {
      const result = await executeHelpCommand('/ios.help run_flow');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.run_flow');
    });

    it('should show help for playbook command', async () => {
      const result = await executeHelpCommand('/ios.help playbook');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.playbook');
      expect(result.output).toContain('Feature-Ship-Loop');
    });

    it('should show help for baseline command', async () => {
      const result = await executeHelpCommand('/ios.help baseline');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.baseline');
    });

    it('should show help for diff command', async () => {
      const result = await executeHelpCommand('/ios.help diff');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.diff');
    });

    it('should show help for regression command', async () => {
      const result = await executeHelpCommand('/ios.help regression');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.regression');
    });

    it('should show help for setup command', async () => {
      const result = await executeHelpCommand('/ios.help setup');
      expect(result.success).toBe(true);
      expect(result.output).toContain('# /ios.setup');
    });

    it('should show help for bridge.state command', async () => {
      const result = await executeHelpCommand('/ios.help bridge.state');
      expect(result.success).toBe(true);
      expect(result.output).toContain('MaestroBridge');
    });

    it('should show help for bridge.route command', async () => {
      const result = await executeHelpCommand('/ios.help bridge.route');
      expect(result.success).toBe(true);
      expect(result.output).toContain('navigation');
    });

    it('should show help for bridge.network command', async () => {
      const result = await executeHelpCommand('/ios.help bridge.network');
      expect(result.success).toBe(true);
      expect(result.output).toContain('network');
    });

    it('should show help for bridge.analytics command', async () => {
      const result = await executeHelpCommand('/ios.help bridge.analytics');
      expect(result.success).toBe(true);
      expect(result.output).toContain('analytics');
    });

    it('should show help for bridge.flags command', async () => {
      const result = await executeHelpCommand('/ios.help bridge.flags');
      expect(result.success).toBe(true);
      expect(result.output).toContain('feature flag');
    });

    it('should show help for bridge.set command', async () => {
      const result = await executeHelpCommand('/ios.help bridge.set');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Override');
    });
  });

  describe('command help with examples', () => {
    it('should include common patterns with --examples flag', async () => {
      const result = await executeHelpCommand('/ios.help snapshot --examples');
      expect(result.success).toBe(true);
      expect(result.output).toContain('## Common Patterns');
    });

    it('should include common patterns with -e flag', async () => {
      const result = await executeHelpCommand('/ios.help tap -e');
      expect(result.success).toBe(true);
      expect(result.output).toContain('## Common Patterns');
    });
  });

  describe('command not found', () => {
    it('should return error for unknown command', async () => {
      const result = await executeHelpCommand('/ios.help nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.output).toContain('# Command Not Found');
    });

    it('should include all commands list', async () => {
      const result = await executeHelpCommand('/ios.help nonexistent');
      expect(result.output).toContain('## All Commands');
    });

    it('should suggest similar commands', async () => {
      const result = await executeHelpCommand('/ios.help snapsho'); // typo
      expect(result.output).toContain('/ios.snapshot');
    });

    it('should suggest command by partial match', async () => {
      // "snaps" is a partial match for "snapshot"
      const result = await executeHelpCommand('/ios.help snaps');
      expect(result.success).toBe(true);
      expect(result.output).toContain('/ios.snapshot');
    });
  });

  describe('troubleshoot mode', () => {
    it('should return success for troubleshoot mode', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return success for short flag', async () => {
      const result = await executeHelpCommand('/ios.help -t');
      expect(result.success).toBe(true);
    });

    it('should include troubleshooting header', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('# iOS Commands Troubleshooting Guide');
    });

    it('should include environment issues section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('## Environment Issues');
    });

    it('should include Xcode not found section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('### Xcode Not Found');
    });

    it('should include no simulators section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('### No Simulators Available');
    });

    it('should include Maestro CLI not installed section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('### Maestro CLI Not Installed');
    });

    it('should include UI interaction issues section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('## UI Interaction Issues');
    });

    it('should include element not found section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('### Element Not Found');
    });

    it('should include element not hittable section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('### Element Not Hittable');
    });

    it('should include flow issues section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('## Flow & Automation Issues');
    });

    it('should include visual regression issues section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('## Visual Regression Issues');
    });

    it('should include MaestroBridge issues section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('## MaestroBridge Issues');
    });

    it('should include quick diagnostic commands', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('## Quick Diagnostic Commands');
      expect(result.output).toContain('/ios.setup --check');
      expect(result.output).toContain('/ios.setup --fix');
    });

    it('should include more resources section', async () => {
      const result = await executeHelpCommand('/ios.help --troubleshoot');
      expect(result.output).toContain('## More Resources');
      expect(result.output).toContain('https://docs.runmaestro.ai');
      expect(result.output).toContain('https://maestro.mobile.dev');
    });
  });
});

// =============================================================================
// Command Metadata Tests
// =============================================================================

describe('helpCommandMetadata', () => {
  it('should have correct command name', () => {
    expect(helpCommandMetadata.command).toBe('/ios.help');
  });

  it('should have description', () => {
    expect(helpCommandMetadata.description).toBeDefined();
    expect(helpCommandMetadata.description.length).toBeGreaterThan(0);
  });

  it('should have usage', () => {
    expect(helpCommandMetadata.usage).toBeDefined();
    expect(helpCommandMetadata.usage).toContain('/ios.help');
  });

  it('should have options defined', () => {
    expect(helpCommandMetadata.options).toBeDefined();
    expect(helpCommandMetadata.options.length).toBeGreaterThan(0);
  });

  it('should include command option', () => {
    const commandOption = helpCommandMetadata.options.find(
      (opt) => opt.name.includes('<command>')
    );
    expect(commandOption).toBeDefined();
  });

  it('should include troubleshoot option', () => {
    const troubleshootOption = helpCommandMetadata.options.find(
      (opt) => opt.name.includes('--troubleshoot')
    );
    expect(troubleshootOption).toBeDefined();
  });

  it('should include examples option', () => {
    const examplesOption = helpCommandMetadata.options.find(
      (opt) => opt.name.includes('--examples')
    );
    expect(examplesOption).toBeDefined();
  });

  it('should have examples', () => {
    expect(helpCommandMetadata.examples).toBeDefined();
    expect(helpCommandMetadata.examples.length).toBeGreaterThan(0);
  });

  it('should include various example commands', () => {
    expect(helpCommandMetadata.examples).toContain('/ios.help');
    expect(helpCommandMetadata.examples).toContain('/ios.help snapshot');
    expect(helpCommandMetadata.examples).toContain('/ios.help --troubleshoot');
    expect(helpCommandMetadata.examples).toContain('/ios.help --examples');
  });
});

// =============================================================================
// Output Format Tests
// =============================================================================

describe('output formatting', () => {
  describe('markdown formatting', () => {
    it('should use proper markdown headers', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.output).toMatch(/^# /m); // H1
      expect(result.output).toMatch(/^## /m); // H2
    });

    it('should use markdown tables', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.output).toContain('| Command | Description |');
      expect(result.output).toContain('|---------|-------------|');
    });

    it('should use code blocks', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.output).toContain('```');
    });

    it('should use inline code for commands', async () => {
      const result = await executeHelpCommand('/ios.help');
      expect(result.output).toContain('`/ios.snapshot`');
    });
  });

  describe('command help formatting', () => {
    it('should format options as table', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toContain('| Option | Description | Value |');
    });

    it('should format related commands with pipes', async () => {
      const result = await executeHelpCommand('/ios.help snapshot');
      expect(result.output).toMatch(/`\/ios\.\w+` \|/);
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('integration', () => {
  it('should have valid metadata structure', () => {
    // Verify helpCommandMetadata has correct structure
    expect(helpCommandMetadata.command).toBe('/ios.help');
    expect(helpCommandMetadata.description).toBeDefined();
    expect(helpCommandMetadata.usage).toBeDefined();
    expect(helpCommandMetadata.options).toBeDefined();
    expect(helpCommandMetadata.examples).toBeDefined();
  });

  it('should include help command in overview output', async () => {
    const result = await executeHelpCommand('/ios.help');
    // The help command should list itself in the "Getting More Help" section
    expect(result.output).toContain('/ios.help');
  });
});
