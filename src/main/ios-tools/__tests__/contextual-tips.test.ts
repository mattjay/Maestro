/**
 * Tests for iOS Tools - Contextual Tips System
 */

import {
  // Constants
  DOCS_BASE_URL,
  DOCS_PAGES,
  // Types
  IOSCommand,
  ContextualTip,
  ActionContext,
  NextStep,
  ErrorTip,
  WorkflowSuggestion,
  // Documentation link functions
  getDocLink,
  getCommandDocLink,
  getErrorDocLink,
  // Next steps
  getNextSteps,
  // Error tips
  getErrorTip,
  // Contextual tips generation
  generateContextualTips,
  // Formatting functions
  formatContextualTips,
  formatNextSteps,
  formatErrorTip,
  formatCompactTip,
  // Workflow suggestions
  WORKFLOW_SUGGESTIONS,
  getWorkflowSuggestions,
  formatWorkflowSuggestion,
} from '../contextual-tips';

// =============================================================================
// Documentation Link Tests
// =============================================================================

describe('Documentation Links', () => {
  describe('getDocLink', () => {
    it('should return base URL for overview', () => {
      const link = getDocLink('overview');
      expect(link).toBe(`${DOCS_BASE_URL}`);
    });

    it('should return correct path for setup', () => {
      const link = getDocLink('setup');
      expect(link).toBe(`${DOCS_BASE_URL}/setup`);
    });

    it('should return correct path for troubleshooting', () => {
      const link = getDocLink('troubleshooting');
      expect(link).toBe(`${DOCS_BASE_URL}/troubleshooting`);
    });

    it('should append anchor when provided', () => {
      const link = getDocLink('troubleshooting', 'xcode');
      expect(link).toBe(`${DOCS_BASE_URL}/troubleshooting#xcode`);
    });

    it('should handle all DOCS_PAGES', () => {
      for (const page of Object.keys(DOCS_PAGES) as Array<keyof typeof DOCS_PAGES>) {
        const link = getDocLink(page);
        expect(link).toContain(DOCS_BASE_URL);
      }
    });
  });

  describe('getCommandDocLink', () => {
    it('should return link for snapshot command', () => {
      const link = getCommandDocLink('snapshot');
      expect(link).toBe(`${DOCS_BASE_URL}/commands#snapshot`);
    });

    it('should return link for tap command', () => {
      const link = getCommandDocLink('tap');
      expect(link).toBe(`${DOCS_BASE_URL}/commands#tap`);
    });

    it('should return link for run_flow command with hyphen', () => {
      const link = getCommandDocLink('run_flow');
      expect(link).toBe(`${DOCS_BASE_URL}/commands#run-flow`);
    });

    it('should return link for bridge commands', () => {
      const link = getCommandDocLink('bridge.state');
      expect(link).toBe(`${DOCS_BASE_URL}/commands#bridge-state`);
    });

    it('should return valid link for all commands', () => {
      const commands: IOSCommand[] = [
        'snapshot',
        'inspect',
        'tap',
        'type',
        'scroll',
        'swipe',
        'run_flow',
        'playbook',
        'baseline',
        'diff',
        'regression',
        'setup',
        'bridge.state',
        'bridge.route',
        'bridge.network',
        'bridge.analytics',
        'bridge.flags',
        'bridge.set',
        'help',
      ];

      for (const cmd of commands) {
        const link = getCommandDocLink(cmd);
        expect(link).toContain(DOCS_BASE_URL);
        expect(link).toContain('#');
      }
    });
  });

  describe('getErrorDocLink', () => {
    it('should return link for XCODE_NOT_FOUND', () => {
      const link = getErrorDocLink('XCODE_NOT_FOUND');
      expect(link).toBe(`${DOCS_BASE_URL}/troubleshooting#xcode`);
    });

    it('should return link for SIMULATOR_NOT_BOOTED', () => {
      const link = getErrorDocLink('SIMULATOR_NOT_BOOTED');
      expect(link).toBe(`${DOCS_BASE_URL}/troubleshooting#simulator`);
    });

    it('should return link for ELEMENT_NOT_FOUND', () => {
      const link = getErrorDocLink('ELEMENT_NOT_FOUND');
      expect(link).toBe(`${DOCS_BASE_URL}/troubleshooting#element-not-found`);
    });

    it('should return link for MAESTRO_NOT_INSTALLED', () => {
      const link = getErrorDocLink('MAESTRO_NOT_INSTALLED');
      expect(link).toBe(`${DOCS_BASE_URL}/troubleshooting#maestro-cli`);
    });

    it('should return default link for unknown error', () => {
      const link = getErrorDocLink('UNKNOWN_ERROR_CODE');
      expect(link).toBe(`${DOCS_BASE_URL}/troubleshooting#common-issues`);
    });
  });
});

// =============================================================================
// Next Step Tests
// =============================================================================

describe('Next Steps', () => {
  describe('getNextSteps', () => {
    it('should return empty array for failed actions', () => {
      const context: ActionContext = {
        command: 'snapshot',
        success: false,
        errorCode: 'SCREENSHOT_FAILED',
      };
      const steps = getNextSteps(context);
      expect(steps).toHaveLength(0);
    });

    it('should return steps for successful snapshot', () => {
      const context: ActionContext = {
        command: 'snapshot',
        success: true,
      };
      const steps = getNextSteps(context);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.command.includes('/ios.inspect'))).toBe(true);
      expect(steps.some((s) => s.command.includes('/ios.diff'))).toBe(true);
    });

    it('should not suggest baseline save if already done', () => {
      const context: ActionContext = {
        command: 'snapshot',
        success: true,
        previousCommands: ['baseline'],
      };
      const steps = getNextSteps(context);
      expect(steps.some((s) => s.command.includes('baseline save'))).toBe(false);
    });

    it('should return steps for successful inspect', () => {
      const context: ActionContext = {
        command: 'inspect',
        success: true,
      };
      const steps = getNextSteps(context);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.command.includes('/ios.tap'))).toBe(true);
      expect(steps.some((s) => s.command.includes('/ios.type'))).toBe(true);
    });

    it('should return steps for successful tap', () => {
      const context: ActionContext = {
        command: 'tap',
        success: true,
        target: 'loginButton',
      };
      const steps = getNextSteps(context);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.command.includes('/ios.snapshot'))).toBe(true);
    });

    it('should suggest typing for text field tap', () => {
      const context: ActionContext = {
        command: 'tap',
        success: true,
        target: 'textField',
        data: { isTextField: true },
      };
      const steps = getNextSteps(context);
      expect(steps.some((s) => s.command.includes('/ios.type'))).toBe(true);
    });

    it('should return steps for successful type', () => {
      const context: ActionContext = {
        command: 'type',
        success: true,
      };
      const steps = getNextSteps(context);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.command.includes('/ios.snapshot'))).toBe(true);
      expect(steps.some((s) => s.command.includes('/ios.tap'))).toBe(true);
    });

    it('should return steps for successful scroll/swipe', () => {
      for (const cmd of ['scroll', 'swipe'] as IOSCommand[]) {
        const context: ActionContext = {
          command: cmd,
          success: true,
        };
        const steps = getNextSteps(context);
        expect(steps.length).toBeGreaterThan(0);
        expect(steps.some((s) => s.command.includes('/ios.inspect'))).toBe(true);
      }
    });

    it('should return steps for successful run_flow', () => {
      const context: ActionContext = {
        command: 'run_flow',
        success: true,
      };
      const steps = getNextSteps(context);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.command.includes('/ios.baseline'))).toBe(true);
      expect(steps.some((s) => s.command.includes('/ios.regression'))).toBe(true);
    });

    it('should return steps for baseline save', () => {
      const context: ActionContext = {
        command: 'baseline',
        success: true,
        data: { subcommand: 'save', baselineName: 'home' },
      };
      const steps = getNextSteps(context);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.command.includes('/ios.diff'))).toBe(true);
    });

    it('should return steps for baseline list', () => {
      const context: ActionContext = {
        command: 'baseline',
        success: true,
        data: { subcommand: 'list' },
      };
      const steps = getNextSteps(context);
      expect(steps.some((s) => s.command.includes('update'))).toBe(true);
    });

    it('should return steps for diff with differences', () => {
      const context: ActionContext = {
        command: 'diff',
        success: true,
        data: { hasDifferences: true, baselineName: 'home' },
      };
      const steps = getNextSteps(context);
      expect(steps.some((s) => s.command.includes('baseline update'))).toBe(true);
    });

    it('should return steps for setup wizard completion', () => {
      const context: ActionContext = {
        command: 'setup',
        success: true,
        data: { mode: 'wizard' },
      };
      const steps = getNextSteps(context);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.command.includes('/ios.snapshot'))).toBe(true);
    });

    it('should return steps for bridge commands', () => {
      for (const cmd of [
        'bridge.state',
        'bridge.route',
        'bridge.network',
        'bridge.analytics',
        'bridge.flags',
      ] as IOSCommand[]) {
        const context: ActionContext = {
          command: cmd,
          success: true,
        };
        const steps = getNextSteps(context);
        expect(steps.length).toBeGreaterThan(0);
      }
    });

    it('should include reason in next step', () => {
      const context: ActionContext = {
        command: 'snapshot',
        success: true,
      };
      const steps = getNextSteps(context);
      expect(steps[0].reason).toBeDefined();
      expect(steps[0].reason!.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Error Tips Tests
// =============================================================================

describe('Error Tips', () => {
  describe('getErrorTip', () => {
    it('should return error tip for XCODE_NOT_FOUND', () => {
      const tip = getErrorTip('XCODE_NOT_FOUND');
      expect(tip.title).toBe('Xcode Not Found');
      expect(tip.recoveryTip).toContain('App Store');
      expect(tip.quickFixes).toBeDefined();
      expect(tip.docLink).toContain('troubleshooting');
    });

    it('should return error tip for SIMULATOR_NOT_BOOTED', () => {
      const tip = getErrorTip('SIMULATOR_NOT_BOOTED');
      expect(tip.title).toBe('No Simulator Running');
      expect(tip.quickFixes).toBeDefined();
      expect(tip.quickFixes!.some((f) => f.includes('/ios.setup'))).toBe(true);
    });

    it('should return error tip for ELEMENT_NOT_FOUND', () => {
      const tip = getErrorTip('ELEMENT_NOT_FOUND');
      expect(tip.title).toBe('Element Not Found');
      expect(tip.recoveryTip).toContain('/ios.inspect');
      expect(tip.relatedCommands).toContain('/ios.inspect');
    });

    it('should return error tip for ELEMENT_NOT_HITTABLE', () => {
      const tip = getErrorTip('ELEMENT_NOT_HITTABLE');
      expect(tip.title).toBe('Element Not Hittable');
      expect(tip.recoveryTip).toContain('covered');
    });

    it('should return error tip for MAESTRO_NOT_INSTALLED', () => {
      const tip = getErrorTip('MAESTRO_NOT_INSTALLED');
      expect(tip.title).toBe('Maestro CLI Not Installed');
      expect(tip.quickFixes!.some((f) => f.includes('curl'))).toBe(true);
    });

    it('should return error tip for FLOW_TIMEOUT', () => {
      const tip = getErrorTip('FLOW_TIMEOUT');
      expect(tip.title).toBe('Flow Timed Out');
      expect(tip.quickFixes!.some((f) => f.includes('--timeout'))).toBe(true);
    });

    it('should return error tip for APP_CRASHED', () => {
      const tip = getErrorTip('APP_CRASHED');
      expect(tip.title).toBe('App Crashed');
      expect(tip.recoveryTip).toContain('crash logs');
    });

    it('should return default tip for unknown error', () => {
      const tip = getErrorTip('SOME_UNKNOWN_ERROR');
      expect(tip.title).toBe('Error');
      expect(tip.docLink).toContain('common-issues');
    });

    it('should add repeated occurrence note when isFirstOccurrence is false', () => {
      const context: ActionContext = {
        command: 'tap',
        success: false,
        errorCode: 'ELEMENT_NOT_FOUND',
        isFirstOccurrence: false,
      };
      const tip = getErrorTip('ELEMENT_NOT_FOUND', context);
      expect(tip.recoveryTip).toContain('multiple times');
    });

    it('should not add repeated note when isFirstOccurrence is true', () => {
      const context: ActionContext = {
        command: 'tap',
        success: false,
        errorCode: 'ELEMENT_NOT_FOUND',
        isFirstOccurrence: true,
      };
      const tip = getErrorTip('ELEMENT_NOT_FOUND', context);
      expect(tip.recoveryTip).not.toContain('multiple times');
    });

    it('should include docLink for all error tips', () => {
      const errorCodes = [
        'XCODE_NOT_FOUND',
        'SIMULATOR_NOT_BOOTED',
        'APP_NOT_INSTALLED',
        'ELEMENT_NOT_FOUND',
        'MAESTRO_NOT_INSTALLED',
        'SCREENSHOT_FAILED',
      ];
      for (const code of errorCodes) {
        const tip = getErrorTip(code);
        expect(tip.docLink).toBeDefined();
        expect(tip.docLink).toContain(DOCS_BASE_URL);
      }
    });
  });
});

// =============================================================================
// Contextual Tips Generation Tests
// =============================================================================

describe('Contextual Tips Generation', () => {
  describe('generateContextualTips', () => {
    it('should generate tips for successful action', () => {
      const context: ActionContext = {
        command: 'snapshot',
        success: true,
      };
      const tips = generateContextualTips(context);
      expect(tips.length).toBeGreaterThan(0);
    });

    it('should include next steps as quick actions', () => {
      const context: ActionContext = {
        command: 'snapshot',
        success: true,
      };
      const tips = generateContextualTips(context);
      expect(tips.some((t) => t.isQuickAction)).toBe(true);
    });

    it('should include documentation link for successful action', () => {
      const context: ActionContext = {
        command: 'tap',
        success: true,
      };
      const tips = generateContextualTips(context);
      expect(tips.some((t) => t.docLink !== undefined)).toBe(true);
    });

    it('should generate tips for failed action', () => {
      const context: ActionContext = {
        command: 'tap',
        success: false,
        errorCode: 'ELEMENT_NOT_FOUND',
      };
      const tips = generateContextualTips(context);
      expect(tips.length).toBeGreaterThan(0);
    });

    it('should include quick fix tips for errors', () => {
      const context: ActionContext = {
        command: 'tap',
        success: false,
        errorCode: 'ELEMENT_NOT_FOUND',
      };
      const tips = generateContextualTips(context);
      expect(tips.some((t) => t.isQuickAction && t.message.startsWith('Try:'))).toBe(
        true
      );
    });

    it('should include troubleshooting doc link for errors', () => {
      const context: ActionContext = {
        command: 'snapshot',
        success: false,
        errorCode: 'SCREENSHOT_FAILED',
      };
      const tips = generateContextualTips(context);
      expect(
        tips.some(
          (t) => t.docLink && t.docLink.includes('troubleshooting')
        )
      ).toBe(true);
    });

    it('should sort tips by priority (highest first)', () => {
      const context: ActionContext = {
        command: 'tap',
        success: false,
        errorCode: 'ELEMENT_NOT_FOUND',
      };
      const tips = generateContextualTips(context);
      for (let i = 1; i < tips.length; i++) {
        expect(tips[i - 1].priority).toBeGreaterThanOrEqual(tips[i].priority);
      }
    });

    it('should include related commands for errors', () => {
      const context: ActionContext = {
        command: 'tap',
        success: false,
        errorCode: 'ELEMENT_NOT_FOUND',
      };
      const tips = generateContextualTips(context);
      expect(
        tips.some((t) => t.message.startsWith('Related:'))
      ).toBe(true);
    });
  });
});

// =============================================================================
// Formatting Tests
// =============================================================================

describe('Formatting Functions', () => {
  describe('formatContextualTips', () => {
    it('should return empty string for empty tips', () => {
      const result = formatContextualTips([]);
      expect(result).toBe('');
    });

    it('should format tips as markdown list', () => {
      const tips: ContextualTip[] = [
        { message: 'First tip', priority: 100 },
        { message: 'Second tip', priority: 50 },
      ];
      const result = formatContextualTips(tips);
      expect(result).toContain('### Tips');
      expect(result).toContain('- First tip');
      expect(result).toContain('- Second tip');
    });

    it('should include related command in tip', () => {
      const tips: ContextualTip[] = [
        { message: 'Try this', priority: 100, relatedCommand: '/ios.inspect' },
      ];
      const result = formatContextualTips(tips);
      expect(result).toContain('`/ios.inspect`');
    });

    it('should include doc link for tip without command', () => {
      const tips: ContextualTip[] = [
        { message: 'Learn more', priority: 100, docLink: 'https://example.com' },
      ];
      const result = formatContextualTips(tips);
      expect(result).toContain('[docs](https://example.com)');
    });

    it('should limit to 5 tips', () => {
      const tips: ContextualTip[] = Array.from({ length: 10 }, (_, i) => ({
        message: `Tip ${i}`,
        priority: 100 - i,
      }));
      const result = formatContextualTips(tips);
      const matches = result.match(/- Tip \d/g);
      expect(matches?.length).toBe(5);
    });
  });

  describe('formatNextSteps', () => {
    it('should return empty string for empty steps', () => {
      const result = formatNextSteps([]);
      expect(result).toBe('');
    });

    it('should format steps with description and command', () => {
      const steps: NextStep[] = [
        { description: 'Do something', command: '/ios.tap #button' },
      ];
      const result = formatNextSteps(steps);
      expect(result).toContain('### Next Steps');
      expect(result).toContain('**Do something**');
      expect(result).toContain('/ios.tap #button');
    });

    it('should include reason when provided', () => {
      const steps: NextStep[] = [
        {
          description: 'Do something',
          command: '/ios.tap',
          reason: 'Because it helps',
        },
      ];
      const result = formatNextSteps(steps);
      expect(result).toContain('*Because it helps*');
    });

    it('should limit to 4 steps', () => {
      const steps: NextStep[] = Array.from({ length: 10 }, (_, i) => ({
        description: `Step ${i}`,
        command: `/ios.cmd${i}`,
      }));
      const result = formatNextSteps(steps);
      const matches = result.match(/\*\*Step \d\*\*/g);
      expect(matches?.length).toBe(4);
    });
  });

  describe('formatErrorTip', () => {
    it('should format error tip with title', () => {
      const tip: ErrorTip = {
        title: 'Test Error',
        message: 'Something went wrong',
        recoveryTip: 'Try this fix',
      };
      const result = formatErrorTip(tip);
      expect(result).toContain('## ✗ Test Error');
      expect(result).toContain('Something went wrong');
    });

    it('should include How to Fix section', () => {
      const tip: ErrorTip = {
        title: 'Error',
        message: 'Message',
        recoveryTip: 'Do this to fix',
      };
      const result = formatErrorTip(tip);
      expect(result).toContain('### How to Fix');
      expect(result).toContain('Do this to fix');
    });

    it('should include quick fixes when provided', () => {
      const tip: ErrorTip = {
        title: 'Error',
        message: 'Message',
        recoveryTip: 'Fix it',
        quickFixes: ['/ios.setup --fix', 'xcrun simctl boot'],
      };
      const result = formatErrorTip(tip);
      expect(result).toContain('### Quick Fixes');
      expect(result).toContain('/ios.setup --fix');
      expect(result).toContain('xcrun simctl boot');
    });

    it('should include related commands when provided', () => {
      const tip: ErrorTip = {
        title: 'Error',
        message: 'Message',
        recoveryTip: 'Fix it',
        relatedCommands: ['/ios.inspect', '/ios.help'],
      };
      const result = formatErrorTip(tip);
      expect(result).toContain('### Related Commands');
      expect(result).toContain('`/ios.inspect`');
      expect(result).toContain('`/ios.help`');
    });

    it('should include documentation link when provided', () => {
      const tip: ErrorTip = {
        title: 'Error',
        message: 'Message',
        recoveryTip: 'Fix it',
        docLink: 'https://docs.example.com',
      };
      const result = formatErrorTip(tip);
      expect(result).toContain('**Documentation**: https://docs.example.com');
    });
  });

  describe('formatCompactTip', () => {
    it('should format basic tip message', () => {
      const tip: ContextualTip = { message: 'Do this', priority: 100 };
      const result = formatCompactTip(tip);
      expect(result).toBe('Do this');
    });

    it('should include related command', () => {
      const tip: ContextualTip = {
        message: 'Try this',
        priority: 100,
        relatedCommand: '/ios.tap',
      };
      const result = formatCompactTip(tip);
      expect(result).toBe('Try this → `/ios.tap`');
    });

    it('should include doc link when no command', () => {
      const tip: ContextualTip = {
        message: 'Learn more',
        priority: 100,
        docLink: 'https://example.com',
      };
      const result = formatCompactTip(tip);
      expect(result).toBe('Learn more → https://example.com');
    });

    it('should prefer command over doc link', () => {
      const tip: ContextualTip = {
        message: 'Try',
        priority: 100,
        relatedCommand: '/ios.tap',
        docLink: 'https://example.com',
      };
      const result = formatCompactTip(tip);
      expect(result).toContain('/ios.tap');
      expect(result).not.toContain('example.com');
    });
  });
});

// =============================================================================
// Workflow Suggestions Tests
// =============================================================================

describe('Workflow Suggestions', () => {
  describe('WORKFLOW_SUGGESTIONS', () => {
    it('should have at least 4 workflow suggestions', () => {
      expect(WORKFLOW_SUGGESTIONS.length).toBeGreaterThanOrEqual(4);
    });

    it('should have name and description for all workflows', () => {
      for (const wf of WORKFLOW_SUGGESTIONS) {
        expect(wf.name).toBeDefined();
        expect(wf.name.length).toBeGreaterThan(0);
        expect(wf.description).toBeDefined();
        expect(wf.description.length).toBeGreaterThan(0);
      }
    });

    it('should have steps for all workflows', () => {
      for (const wf of WORKFLOW_SUGGESTIONS) {
        expect(wf.steps).toBeDefined();
        expect(wf.steps.length).toBeGreaterThan(0);
      }
    });

    it('should have trigger function for all workflows', () => {
      for (const wf of WORKFLOW_SUGGESTIONS) {
        expect(typeof wf.trigger).toBe('function');
      }
    });
  });

  describe('getWorkflowSuggestions', () => {
    it('should return Feature Development for new snapshot', () => {
      const context: ActionContext = {
        command: 'snapshot',
        success: true,
        previousCommands: [],
      };
      const suggestions = getWorkflowSuggestions(context);
      expect(suggestions.some((s) => s.name === 'Feature Development')).toBe(true);
    });

    it('should return Visual Regression Setup after multiple commands', () => {
      const context: ActionContext = {
        command: 'snapshot',
        success: true,
        previousCommands: ['tap', 'inspect'],
      };
      const suggestions = getWorkflowSuggestions(context);
      expect(suggestions.some((s) => s.name === 'Visual Regression Setup')).toBe(
        true
      );
    });

    it('should return Debug Element Issue for element not found', () => {
      const context: ActionContext = {
        command: 'tap',
        success: false,
        errorCode: 'ELEMENT_NOT_FOUND',
      };
      const suggestions = getWorkflowSuggestions(context);
      expect(suggestions.some((s) => s.name === 'Debug Element Issue')).toBe(true);
    });

    it('should return Environment Check for simulator not booted', () => {
      const context: ActionContext = {
        command: 'snapshot',
        success: false,
        errorCode: 'SIMULATOR_NOT_BOOTED',
      };
      const suggestions = getWorkflowSuggestions(context);
      expect(suggestions.some((s) => s.name === 'Environment Check')).toBe(true);
    });

    it('should return empty array when no triggers match', () => {
      const context: ActionContext = {
        command: 'help',
        success: true,
      };
      const suggestions = getWorkflowSuggestions(context);
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('formatWorkflowSuggestion', () => {
    it('should format workflow with name and description', () => {
      const workflow: WorkflowSuggestion = {
        name: 'Test Workflow',
        description: 'A test workflow',
        steps: ['/ios.tap', '/ios.snapshot'],
        trigger: () => true,
      };
      const result = formatWorkflowSuggestion(workflow);
      expect(result).toContain('### Suggested Workflow: Test Workflow');
      expect(result).toContain('*A test workflow*');
    });

    it('should include all steps in code block', () => {
      const workflow: WorkflowSuggestion = {
        name: 'Test',
        description: 'Test',
        steps: ['/ios.step1', '/ios.step2', '/ios.step3'],
        trigger: () => true,
      };
      const result = formatWorkflowSuggestion(workflow);
      expect(result).toContain('```');
      expect(result).toContain('/ios.step1');
      expect(result).toContain('/ios.step2');
      expect(result).toContain('/ios.step3');
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration', () => {
  it('should provide complete error recovery path', () => {
    const context: ActionContext = {
      command: 'tap',
      success: false,
      errorCode: 'ELEMENT_NOT_FOUND',
      target: '#login-button',
    };

    // Get error tip
    const errorTip = getErrorTip(context.errorCode!, context);
    expect(errorTip.title).toBeDefined();
    expect(errorTip.quickFixes).toBeDefined();

    // Get contextual tips
    const tips = generateContextualTips(context);
    expect(tips.length).toBeGreaterThan(0);

    // Get workflow suggestions
    const workflows = getWorkflowSuggestions(context);
    expect(workflows.length).toBeGreaterThan(0);
  });

  it('should provide complete success continuation path', () => {
    const context: ActionContext = {
      command: 'snapshot',
      success: true,
      previousCommands: [],
    };

    // Get next steps
    const nextSteps = getNextSteps(context);
    expect(nextSteps.length).toBeGreaterThan(0);

    // Get contextual tips
    const tips = generateContextualTips(context);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.some((t) => t.isQuickAction)).toBe(true);

    // Get workflow suggestions
    const workflows = getWorkflowSuggestions(context);
    expect(workflows.length).toBeGreaterThan(0);
  });

  it('should format all outputs as valid markdown', () => {
    const context: ActionContext = {
      command: 'tap',
      success: false,
      errorCode: 'ELEMENT_NOT_FOUND',
    };

    const tips = generateContextualTips(context);
    const formattedTips = formatContextualTips(tips);
    expect(formattedTips).toContain('###');

    const errorTip = getErrorTip(context.errorCode!, context);
    const formattedError = formatErrorTip(errorTip);
    expect(formattedError).toContain('##');
    expect(formattedError).toContain('###');

    const workflows = getWorkflowSuggestions(context);
    if (workflows.length > 0) {
      const formattedWorkflow = formatWorkflowSuggestion(workflows[0]);
      expect(formattedWorkflow).toContain('###');
      expect(formattedWorkflow).toContain('```');
    }
  });
});
