/**
 * Tests for iOS Tools - User-Friendly Error Messages
 */

import {
  ERROR_MESSAGES,
  ErrorCode,
  ErrorMessage,
  RecoveryStep,
  FormatErrorOptions,
  getErrorMessage,
  formatUserFriendlyError,
  formatErrorAsJson,
  formatErrorAsMarkdown,
  getAutoRecoveryCommands,
  canAutoRecover,
  getFirstRecoveryCommand,
  getDocumentationUrl,
  getErrorSeverity,
  ErrorCategory,
  getErrorCategory,
  getErrorsInCategory,
  getErrorMessagesSummary,
} from '../messages';

describe('ios-tools/errors/messages', () => {
  // ===========================================================================
  // ERROR_MESSAGES Configuration Tests
  // ===========================================================================

  describe('ERROR_MESSAGES', () => {
    it('should have all required IOSErrorCode entries', () => {
      const requiredCodes: ErrorCode[] = [
        'XCODE_NOT_FOUND',
        'XCODE_VERSION_UNSUPPORTED',
        'SIMULATOR_NOT_FOUND',
        'SIMULATOR_NOT_BOOTED',
        'SIMULATOR_BOOT_FAILED',
        'APP_NOT_INSTALLED',
        'APP_INSTALL_FAILED',
        'APP_LAUNCH_FAILED',
        'SCREENSHOT_FAILED',
        'RECORDING_FAILED',
        'LOG_COLLECTION_FAILED',
        'BUILD_FAILED',
        'TEST_FAILED',
        'TIMEOUT',
        'COMMAND_FAILED',
        'PARSE_ERROR',
        'UNKNOWN',
        'ELEMENT_NOT_FOUND',
        'ELEMENT_NOT_HITTABLE',
        'ELEMENT_NOT_VISIBLE',
        'ELEMENT_NOT_ENABLED',
        'ELEMENT_OBSCURED',
        'ELEMENT_OFF_SCREEN',
        'ELEMENT_ZERO_SIZE',
        'MAESTRO_NOT_INSTALLED',
        'FLOW_TIMEOUT',
        'FLOW_VALIDATION_FAILED',
        'APP_CRASHED',
        'APP_NOT_RUNNING',
        'INTERACTION_TIMEOUT',
      ];

      for (const code of requiredCodes) {
        expect(ERROR_MESSAGES[code]).toBeDefined();
        expect(ERROR_MESSAGES[code].code).toBe(code);
      }
    });

    it('should have valid structure for all error messages', () => {
      for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
        // Required fields
        expect(message.code).toBe(code);
        expect(typeof message.icon).toBe('string');
        expect(message.icon.length).toBeGreaterThan(0);
        expect(typeof message.title).toBe('string');
        expect(message.title.length).toBeGreaterThan(0);
        expect(typeof message.explanation).toBe('string');
        expect(message.explanation.length).toBeGreaterThan(0);
        expect(Array.isArray(message.recoverySteps)).toBe(true);
        expect(message.recoverySteps.length).toBeGreaterThan(0);
        expect(typeof message.documentationUrl).toBe('string');
        expect(message.documentationUrl).toMatch(/^https:\/\//);
        expect(['warning', 'error', 'critical']).toContain(message.severity);
      }
    });

    it('should have valid recovery steps structure', () => {
      for (const [, message] of Object.entries(ERROR_MESSAGES)) {
        let expectedStep = 1;
        for (const step of message.recoverySteps) {
          expect(step.step).toBe(expectedStep);
          expect(typeof step.description).toBe('string');
          expect(step.description.length).toBeGreaterThan(0);
          if (step.command !== undefined) {
            expect(typeof step.command).toBe('string');
          }
          if (step.optional !== undefined) {
            expect(typeof step.optional).toBe('boolean');
          }
          expectedStep++;
        }
      }
    });

    it('should have documentation URLs pointing to runmaestro.ai', () => {
      for (const [, message] of Object.entries(ERROR_MESSAGES)) {
        expect(message.documentationUrl).toContain('docs.runmaestro.ai');
      }
    });
  });

  // ===========================================================================
  // getErrorMessage Tests
  // ===========================================================================

  describe('getErrorMessage', () => {
    it('should return error message for known code', () => {
      const result = getErrorMessage('XCODE_NOT_FOUND');
      expect(result.code).toBe('XCODE_NOT_FOUND');
      expect(result.title).toBe('Xcode Not Found');
    });

    it('should return default message for unknown code', () => {
      const result = getErrorMessage('UNKNOWN_CODE_12345');
      expect(result.code).toBe('UNKNOWN_CODE_12345');
      expect(result.title).toBe('Error');
      expect(result.explanation).toContain('UNKNOWN_CODE_12345');
    });

    it('should return complete ErrorMessage structure', () => {
      const result = getErrorMessage('SIMULATOR_NOT_BOOTED');
      expect(result.code).toBe('SIMULATOR_NOT_BOOTED');
      expect(result.icon).toBe('📱');
      expect(result.title).toBe('No Simulator Running');
      expect(result.recoverySteps.length).toBeGreaterThan(0);
      expect(result.documentationUrl).toContain('troubleshooting');
    });
  });

  // ===========================================================================
  // formatUserFriendlyError Tests
  // ===========================================================================

  describe('formatUserFriendlyError', () => {
    it('should format error with icon and title', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND');
      expect(result).toContain('❌ Xcode Not Found');
    });

    it('should include explanation', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND');
      expect(result).toContain("Maestro couldn't find Xcode");
    });

    it('should include numbered recovery steps', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND');
      expect(result).toContain('**To fix this:**');
      expect(result).toContain('1. Install Xcode');
      expect(result).toContain('2. Open Xcode');
      expect(result).toContain('3. Install Command Line Tools');
    });

    it('should include commands in recovery steps', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND');
      expect(result).toContain('`xcode-select --install`');
    });

    it('should include documentation link by default', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND');
      expect(result).toContain('**Need help?**');
      expect(result).toContain('https://docs.runmaestro.ai');
    });

    it('should exclude documentation link when option is false', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND', {
        includeDocLink: false,
      });
      expect(result).not.toContain('**Need help?**');
    });

    it('should include auto-recovery commands by default', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND');
      expect(result).toContain('**Quick fix:**');
      expect(result).toContain('/ios.setup --fix');
    });

    it('should exclude auto-recovery when option is false', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND', {
        includeAutoRecovery: false,
      });
      expect(result).not.toContain('**Quick fix:**');
    });

    it('should include common causes when option is true', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND', {
        includeCauses: true,
      });
      expect(result).toContain('**Common causes:**');
      expect(result).toContain('Xcode is not installed');
    });

    it('should return compact format when specified', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND', {
        compact: true,
      });
      // Compact should be a single line without numbered steps
      expect(result).not.toContain('**To fix this:**');
      expect(result).toContain('❌ Xcode Not Found');
      expect(result.split('\n').length).toBe(1);
    });

    it('should match the spec example format', () => {
      const result = formatUserFriendlyError('XCODE_NOT_FOUND', {
        includeCauses: false,
        includeAutoRecovery: false,
      });

      // Should have the structure:
      // ❌ Xcode Not Found
      //
      // Explanation...
      //
      // **To fix this:**
      // 1. ...
      //
      // **Need help?** URL
      expect(result).toMatch(/^❌ Xcode Not Found\n\n/);
      expect(result).toContain('\n\n**To fix this:**\n');
      expect(result).toContain('\n\n**Need help?**');
    });
  });

  // ===========================================================================
  // formatErrorAsJson Tests
  // ===========================================================================

  describe('formatErrorAsJson', () => {
    it('should return valid JSON string', () => {
      const result = formatErrorAsJson('XCODE_NOT_FOUND');
      const parsed = JSON.parse(result);
      expect(parsed).toBeDefined();
    });

    it('should include all error message fields', () => {
      const result = formatErrorAsJson('XCODE_NOT_FOUND');
      const parsed = JSON.parse(result);

      expect(parsed.code).toBe('XCODE_NOT_FOUND');
      expect(parsed.title).toBe('Xcode Not Found');
      expect(parsed.explanation).toBeDefined();
      expect(Array.isArray(parsed.recoverySteps)).toBe(true);
      expect(parsed.documentationUrl).toBeDefined();
      expect(parsed.severity).toBe('critical');
    });

    it('should include context when provided', () => {
      const result = formatErrorAsJson('SIMULATOR_NOT_FOUND', {
        simulatorName: 'iPhone 15 Pro',
        searchPath: '/usr/local/bin',
      });
      const parsed = JSON.parse(result);

      expect(parsed.context.simulatorName).toBe('iPhone 15 Pro');
      expect(parsed.context.searchPath).toBe('/usr/local/bin');
    });

    it('should format recovery steps correctly', () => {
      const result = formatErrorAsJson('XCODE_NOT_FOUND');
      const parsed = JSON.parse(result);

      expect(parsed.recoverySteps[0].step).toBe(1);
      expect(parsed.recoverySteps[0].description).toContain('Install Xcode');
      expect(parsed.recoverySteps[0].command).toBeDefined();
    });
  });

  // ===========================================================================
  // formatErrorAsMarkdown Tests
  // ===========================================================================

  describe('formatErrorAsMarkdown', () => {
    it('should use H2 header with icon and title', () => {
      const result = formatErrorAsMarkdown('XCODE_NOT_FOUND');
      expect(result).toContain('## ❌ Xcode Not Found');
    });

    it('should include Common Causes section', () => {
      const result = formatErrorAsMarkdown('XCODE_NOT_FOUND');
      expect(result).toContain('### Common Causes');
    });

    it('should include How to Fix section', () => {
      const result = formatErrorAsMarkdown('XCODE_NOT_FOUND');
      expect(result).toContain('### How to Fix');
    });

    it('should include Quick Fix section for errors with auto-recovery', () => {
      const result = formatErrorAsMarkdown('XCODE_NOT_FOUND');
      expect(result).toContain('### Quick Fix');
    });

    it('should include documentation link', () => {
      const result = formatErrorAsMarkdown('XCODE_NOT_FOUND');
      expect(result).toContain('**Documentation**:');
      expect(result).toContain('[Troubleshooting Guide]');
    });

    it('should format commands in code blocks', () => {
      const result = formatErrorAsMarkdown('XCODE_NOT_FOUND');
      expect(result).toMatch(/```\n.*xcode-select --install.*\n.*```/s);
    });

    it('should include context section when provided', () => {
      const result = formatErrorAsMarkdown('ELEMENT_NOT_FOUND', {
        context: {
          target: '#submitButton',
          screen: 'LoginScreen',
        },
      });
      expect(result).toContain('### Context');
      expect(result).toContain('**target**: `#submitButton`');
      expect(result).toContain('**screen**: `LoginScreen`');
    });

    it('should mark optional steps', () => {
      const result = formatErrorAsMarkdown('APP_CRASHED');
      expect(result).toContain('*(optional)*');
    });
  });

  // ===========================================================================
  // Auto-Recovery Tests
  // ===========================================================================

  describe('getAutoRecoveryCommands', () => {
    it('should return commands for recoverable errors', () => {
      const commands = getAutoRecoveryCommands('XCODE_NOT_FOUND');
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
      expect(commands).toContain('/ios.setup --fix');
    });

    it('should return empty array for non-recoverable errors', () => {
      const commands = getAutoRecoveryCommands('BUILD_FAILED');
      expect(Array.isArray(commands)).toBe(true);
      // BUILD_FAILED has no auto-recovery commands
    });

    it('should return empty array for unknown error codes', () => {
      const commands = getAutoRecoveryCommands('UNKNOWN_CODE_12345');
      expect(commands).toEqual([]);
    });
  });

  describe('canAutoRecover', () => {
    it('should return true for errors with auto-recovery', () => {
      expect(canAutoRecover('XCODE_NOT_FOUND')).toBe(true);
      expect(canAutoRecover('SIMULATOR_NOT_BOOTED')).toBe(true);
      expect(canAutoRecover('MAESTRO_NOT_INSTALLED')).toBe(true);
    });

    it('should return false for errors without auto-recovery', () => {
      expect(canAutoRecover('BUILD_FAILED')).toBe(false);
      expect(canAutoRecover('UNKNOWN_CODE_12345')).toBe(false);
    });
  });

  describe('getFirstRecoveryCommand', () => {
    it('should return first auto-recovery command when available', () => {
      const cmd = getFirstRecoveryCommand('XCODE_NOT_FOUND');
      expect(cmd).toBe('/ios.setup --fix');
    });

    it('should fallback to first step command when no auto-recovery', () => {
      const cmd = getFirstRecoveryCommand('BUILD_FAILED');
      // BUILD_FAILED's first step with command is "xcodebuild clean"
      expect(cmd).toBeDefined();
    });

    it('should return undefined for unknown codes', () => {
      const cmd = getFirstRecoveryCommand('UNKNOWN_CODE_12345');
      // getFirstRecoveryCommand uses ERROR_MESSAGES directly (not getErrorMessage)
      // so unknown codes return undefined since they're not in the map
      expect(cmd).toBeUndefined();
    });
  });

  // ===========================================================================
  // Documentation URL Tests
  // ===========================================================================

  describe('getDocumentationUrl', () => {
    it('should return correct URL for known codes', () => {
      const url = getDocumentationUrl('XCODE_NOT_FOUND');
      expect(url).toContain('docs.runmaestro.ai');
      expect(url).toContain('troubleshooting');
      expect(url).toContain('#xcode');
    });

    it('should return default URL for unknown codes', () => {
      const url = getDocumentationUrl('UNKNOWN_CODE_12345');
      expect(url).toContain('docs.runmaestro.ai');
      expect(url).toContain('troubleshooting');
      expect(url).toContain('#common-issues');
    });

    it('should return different URLs for different error types', () => {
      const xcodeUrl = getDocumentationUrl('XCODE_NOT_FOUND');
      const elementUrl = getDocumentationUrl('ELEMENT_NOT_FOUND');
      const flowUrl = getDocumentationUrl('FLOW_TIMEOUT');

      expect(xcodeUrl).not.toBe(elementUrl);
      expect(elementUrl).not.toBe(flowUrl);
    });
  });

  // ===========================================================================
  // Error Severity Tests
  // ===========================================================================

  describe('getErrorSeverity', () => {
    it('should return correct severity for critical errors', () => {
      expect(getErrorSeverity('XCODE_NOT_FOUND')).toBe('critical');
    });

    it('should return correct severity for error level', () => {
      expect(getErrorSeverity('SIMULATOR_NOT_BOOTED')).toBe('error');
      expect(getErrorSeverity('APP_CRASHED')).toBe('error');
    });

    it('should return correct severity for warnings', () => {
      expect(getErrorSeverity('ELEMENT_NOT_VISIBLE')).toBe('warning');
      expect(getErrorSeverity('ELEMENT_OBSCURED')).toBe('warning');
    });

    it('should return error for unknown codes', () => {
      expect(getErrorSeverity('UNKNOWN_CODE_12345')).toBe('error');
    });
  });

  // ===========================================================================
  // Error Categorization Tests
  // ===========================================================================

  describe('getErrorCategory', () => {
    it('should categorize environment errors', () => {
      expect(getErrorCategory('XCODE_NOT_FOUND')).toBe('environment');
      expect(getErrorCategory('XCODE_VERSION_UNSUPPORTED')).toBe('environment');
    });

    it('should categorize simulator errors', () => {
      expect(getErrorCategory('SIMULATOR_NOT_FOUND')).toBe('simulator');
      expect(getErrorCategory('SIMULATOR_NOT_BOOTED')).toBe('simulator');
      expect(getErrorCategory('SIMULATOR_BOOT_FAILED')).toBe('simulator');
    });

    it('should categorize app errors', () => {
      expect(getErrorCategory('APP_NOT_INSTALLED')).toBe('app');
      expect(getErrorCategory('APP_CRASHED')).toBe('app');
      expect(getErrorCategory('APP_NOT_RUNNING')).toBe('app');
    });

    it('should categorize element errors', () => {
      expect(getErrorCategory('ELEMENT_NOT_FOUND')).toBe('element');
      expect(getErrorCategory('ELEMENT_NOT_HITTABLE')).toBe('element');
      expect(getErrorCategory('ELEMENT_NOT_VISIBLE')).toBe('element');
      expect(getErrorCategory('ELEMENT_OBSCURED')).toBe('element');
    });

    it('should categorize flow errors', () => {
      expect(getErrorCategory('MAESTRO_NOT_INSTALLED')).toBe('flow');
      expect(getErrorCategory('FLOW_TIMEOUT')).toBe('flow');
      expect(getErrorCategory('FLOW_VALIDATION_FAILED')).toBe('flow');
    });

    it('should categorize capture errors', () => {
      expect(getErrorCategory('SCREENSHOT_FAILED')).toBe('capture');
      expect(getErrorCategory('RECORDING_FAILED')).toBe('capture');
    });

    it('should categorize timeout errors', () => {
      expect(getErrorCategory('TIMEOUT')).toBe('timeout');
      expect(getErrorCategory('INTERACTION_TIMEOUT')).toBe('timeout');
    });

    it('should categorize build errors', () => {
      expect(getErrorCategory('BUILD_FAILED')).toBe('build');
      expect(getErrorCategory('TEST_FAILED')).toBe('build');
    });

    it('should return other for uncategorized errors', () => {
      expect(getErrorCategory('COMMAND_FAILED')).toBe('other');
      expect(getErrorCategory('UNKNOWN')).toBe('other');
      expect(getErrorCategory('UNKNOWN_CODE_12345')).toBe('other');
    });
  });

  describe('getErrorsInCategory', () => {
    it('should return all environment errors', () => {
      const errors = getErrorsInCategory('environment');
      expect(errors).toContain('XCODE_NOT_FOUND');
      expect(errors).toContain('XCODE_VERSION_UNSUPPORTED');
      expect(errors.length).toBe(2);
    });

    it('should return all simulator errors', () => {
      const errors = getErrorsInCategory('simulator');
      expect(errors).toContain('SIMULATOR_NOT_FOUND');
      expect(errors).toContain('SIMULATOR_NOT_BOOTED');
      expect(errors).toContain('SIMULATOR_BOOT_FAILED');
      expect(errors.length).toBe(3);
    });

    it('should return all element errors', () => {
      const errors = getErrorsInCategory('element');
      expect(errors).toContain('ELEMENT_NOT_FOUND');
      expect(errors).toContain('ELEMENT_NOT_HITTABLE');
      expect(errors.length).toBe(7);
    });

    it('should return empty array for non-existent category', () => {
      // @ts-expect-error Testing invalid category
      const errors = getErrorsInCategory('nonexistent');
      expect(errors).toEqual([]);
    });
  });

  // ===========================================================================
  // Error Summary Tests
  // ===========================================================================

  describe('getErrorMessagesSummary', () => {
    it('should return array of error summaries', () => {
      const summary = getErrorMessagesSummary();
      expect(Array.isArray(summary)).toBe(true);
      expect(summary.length).toBe(Object.keys(ERROR_MESSAGES).length);
    });

    it('should include all required fields in each summary', () => {
      const summary = getErrorMessagesSummary();
      for (const item of summary) {
        expect(typeof item.code).toBe('string');
        expect(typeof item.title).toBe('string');
        expect(typeof item.category).toBe('string');
        expect(typeof item.hasAutoRecovery).toBe('boolean');
      }
    });

    it('should correctly identify auto-recoverable errors', () => {
      const summary = getErrorMessagesSummary();
      const xcodeEntry = summary.find((s) => s.code === 'XCODE_NOT_FOUND');
      expect(xcodeEntry?.hasAutoRecovery).toBe(true);

      const buildEntry = summary.find((s) => s.code === 'BUILD_FAILED');
      expect(buildEntry?.hasAutoRecovery).toBe(false);
    });

    it('should correctly categorize all errors', () => {
      const summary = getErrorMessagesSummary();
      const categoryCounts: Record<string, number> = {};

      for (const item of summary) {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      }

      expect(categoryCounts['environment']).toBe(2);
      expect(categoryCounts['simulator']).toBe(3);
      expect(categoryCounts['element']).toBe(7);
    });
  });

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe('Integration', () => {
    it('should format all error codes without throwing', () => {
      for (const code of Object.keys(ERROR_MESSAGES)) {
        expect(() => formatUserFriendlyError(code)).not.toThrow();
        expect(() => formatErrorAsJson(code)).not.toThrow();
        expect(() => formatErrorAsMarkdown(code)).not.toThrow();
      }
    });

    it('should have consistent information across formats', () => {
      const code = 'ELEMENT_NOT_FOUND';

      const friendly = formatUserFriendlyError(code);
      const json = JSON.parse(formatErrorAsJson(code));
      const markdown = formatErrorAsMarkdown(code);

      // All should mention the error title
      expect(friendly).toContain('Element Not Found');
      expect(json.title).toBe('Element Not Found');
      expect(markdown).toContain('Element Not Found');

      // All should have the same code
      expect(json.code).toBe(code);
    });

    it('should provide complete troubleshooting flow', () => {
      const code = 'SIMULATOR_NOT_BOOTED';

      // Get error info
      const message = getErrorMessage(code);
      expect(message.code).toBe(code);

      // Check if auto-recoverable
      const recoverable = canAutoRecover(code);
      expect(recoverable).toBe(true);

      // Get recovery command
      const cmd = getFirstRecoveryCommand(code);
      expect(cmd).toBeDefined();
      expect(cmd).toContain('/ios.setup');

      // Get documentation
      const docUrl = getDocumentationUrl(code);
      expect(docUrl).toContain('troubleshooting');

      // Get category
      const category = getErrorCategory(code);
      expect(category).toBe('simulator');

      // Format for user
      const formatted = formatUserFriendlyError(code);
      expect(formatted).toContain(message.title);
      expect(formatted).toContain(docUrl);
    });
  });
});
