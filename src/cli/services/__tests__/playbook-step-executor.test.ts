/**
 * Tests for Playbook Step Executor
 *
 * Tests the execution of ios.playbook steps in Auto Run documents,
 * verifying the bridge between step parser and playbook runner.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executePlaybookStep,
  formatPlaybookStepResult,
  formatPlaybookStepResultAsJson,
  formatPlaybookStepResultCompact,
  PlaybookStepExecutionResult,
} from '../playbook-step-executor';
import type { PlaybookStep } from '../step-types';

// Mock the playbook-runner module
vi.mock('../../../main/ios-tools/playbook-runner', () => ({
  runPlaybook: vi.fn(),
}));

// Note: playbookExists and listAvailablePlaybooks use dynamic require()
// which doesn't get hoisted by vitest's module mocking. Since those are
// simple wrapper functions, we test them separately as integration tests
// in the playbook-loader tests rather than trying to mock them here.

// Mock uuid
vi.mock('../../../shared/uuid', () => ({
  generateUUID: vi.fn(() => 'mock-uuid-12345'),
}));

import { runPlaybook } from '../../../main/ios-tools/playbook-runner';

describe('playbook-step-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // executePlaybookStep Tests
  // ==========================================================================

  describe('executePlaybookStep', () => {
    describe('successful execution', () => {
      it('should execute a playbook step successfully', async () => {
        const mockResult = {
          passed: true,
          playbook: { name: 'Regression-Check', version: '1.0.0' },
          stepsExecuted: 5,
          stepsPassed: 5,
          stepsFailed: 0,
          stepsSkipped: 0,
          totalDuration: 1500,
          startTime: new Date(),
          endTime: new Date(),
          stepResults: [],
          finalVariables: {},
          finalOutputs: {},
          artifactsDir: '/tmp/artifacts',
          collected: {},
        };

        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: mockResult,
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Regression-Check',
          lineNumber: 10,
          rawText: '- ios.playbook: Regression-Check',
        };

        const result = await executePlaybookStep(step);

        expect(result.success).toBe(true);
        expect(result.playbookResult).toBeDefined();
        expect(result.playbookResult?.passed).toBe(true);
        expect(result.step).toBe(step);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should pass inputs to the playbook runner', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Feature-Ship-Loop' },
            stepsExecuted: 3,
            stepsPassed: 3,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 2000,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/artifacts',
            collected: {},
          },
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Feature-Ship-Loop',
          inputs: {
            project_path: '/path/to/project',
            scheme: 'MyApp',
            assertions: ['#login_button', '#home_screen'],
          },
          lineNumber: 5,
          rawText: '- ios.playbook: { name: "Feature-Ship-Loop", inputs: {...} }',
        };

        await executePlaybookStep(step);

        expect(runPlaybook).toHaveBeenCalledWith(
          expect.objectContaining({
            playbook: 'Feature-Ship-Loop',
            inputs: {
              project_path: '/path/to/project',
              scheme: 'MyApp',
              assertions: ['#login_button', '#home_screen'],
            },
          })
        );
      });

      it('should use session ID from step', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Test' },
            stepsExecuted: 1,
            stepsPassed: 1,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 100,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/artifacts',
            collected: {},
          },
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          sessionId: 'custom-session-id',
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        await executePlaybookStep(step);

        expect(runPlaybook).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: 'custom-session-id',
          })
        );
      });

      it('should fall back to options session ID when step has none', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Test' },
            stepsExecuted: 1,
            stepsPassed: 1,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 100,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/artifacts',
            collected: {},
          },
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        await executePlaybookStep(step, { sessionId: 'options-session-id' });

        expect(runPlaybook).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: 'options-session-id',
          })
        );
      });

      it('should generate UUID when no session ID provided', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Test' },
            stepsExecuted: 1,
            stepsPassed: 1,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 100,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/artifacts',
            collected: {},
          },
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        await executePlaybookStep(step);

        expect(runPlaybook).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: 'mock-uuid-12345',
          })
        );
      });

      it('should pass dryRun option from step', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Test' },
            stepsExecuted: 0,
            stepsPassed: 0,
            stepsFailed: 0,
            stepsSkipped: 3,
            totalDuration: 50,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/artifacts',
            collected: {},
          },
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          dryRun: true,
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        await executePlaybookStep(step);

        expect(runPlaybook).toHaveBeenCalledWith(
          expect.objectContaining({
            dryRun: true,
          })
        );
      });

      it('should pass timeout from step', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Test' },
            stepsExecuted: 1,
            stepsPassed: 1,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 100,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/artifacts',
            collected: {},
          },
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          timeout: 60000,
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        await executePlaybookStep(step, { defaultTimeout: 30000 });

        expect(runPlaybook).toHaveBeenCalledWith(
          expect.objectContaining({
            stepTimeout: 60000,
          })
        );
      });

      it('should use defaultTimeout from options when step timeout not set', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Test' },
            stepsExecuted: 1,
            stepsPassed: 1,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 100,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/artifacts',
            collected: {},
          },
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        await executePlaybookStep(step, { defaultTimeout: 120000 });

        expect(runPlaybook).toHaveBeenCalledWith(
          expect.objectContaining({
            stepTimeout: 120000,
          })
        );
      });

      it('should pass continueOnError from step', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Test' },
            stepsExecuted: 1,
            stepsPassed: 1,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 100,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/artifacts',
            collected: {},
          },
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          continueOnError: true,
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        await executePlaybookStep(step);

        expect(runPlaybook).toHaveBeenCalledWith(
          expect.objectContaining({
            continueOnError: true,
          })
        );
      });

      it('should pass progress callback to runner', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Test' },
            stepsExecuted: 1,
            stepsPassed: 1,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 100,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/artifacts',
            collected: {},
          },
        });

        const onProgress = vi.fn();

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        await executePlaybookStep(step, { onProgress });

        expect(runPlaybook).toHaveBeenCalledWith(
          expect.objectContaining({
            onProgress,
          })
        );
      });
    });

    describe('failed execution', () => {
      it('should return failure when playbook fails', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: false,
          error: 'Failed to load playbook: Not found',
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Non-Existent',
          lineNumber: 1,
          rawText: '- ios.playbook: Non-Existent',
        };

        const result = await executePlaybookStep(step);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to load playbook: Not found');
        expect(result.failureReason).toBe('playbook_execution_failed');
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions).toContain("Check if playbook 'Non-Existent' exists");
      });

      it('should return failure when playbook execution fails', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: false,
            playbook: { name: 'Regression-Check' },
            stepsExecuted: 3,
            stepsPassed: 2,
            stepsFailed: 1,
            stepsSkipped: 0,
            totalDuration: 5000,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/artifacts',
            error: 'Assertion failed: Element #login_button not visible',
            collected: {},
          },
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Regression-Check',
          lineNumber: 1,
          rawText: '- ios.playbook: Regression-Check',
        };

        const result = await executePlaybookStep(step);

        expect(result.success).toBe(false);
        expect(result.playbookResult).toBeDefined();
        expect(result.playbookResult?.passed).toBe(false);
        expect(result.error).toBe('Assertion failed: Element #login_button not visible');
        expect(result.failureReason).toBe('playbook_failed');
      });

      it('should handle no result from playbook', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: undefined as unknown as never,
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        const result = await executePlaybookStep(step);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Playbook returned no result');
        expect(result.failureReason).toBe('no_result');
      });

      it('should handle thrown errors', async () => {
        vi.mocked(runPlaybook).mockRejectedValueOnce(
          new Error('Network error')
        );

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        const result = await executePlaybookStep(step);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
        expect(result.failureReason).toBe('execution_error');
        expect(result.suggestions).toBeDefined();
      });

      it('should handle non-Error thrown values', async () => {
        vi.mocked(runPlaybook).mockRejectedValueOnce('String error');

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        const result = await executePlaybookStep(step);

        expect(result.success).toBe(false);
        expect(result.error).toBe('String error');
      });
    });

    describe('artifacts collection', () => {
      it('should include artifacts directory in result', async () => {
        vi.mocked(runPlaybook).mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Test' },
            stepsExecuted: 1,
            stepsPassed: 1,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 100,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/path/to/artifacts',
            collected: {},
          },
        });

        const step: PlaybookStep = {
          type: 'ios.playbook',
          playbookName: 'Test',
          lineNumber: 1,
          rawText: '- ios.playbook: Test',
        };

        const result = await executePlaybookStep(step);

        expect(result.artifacts).toBeDefined();
        expect(result.artifacts?.logs).toBe('/path/to/artifacts');
      });
    });
  });

  // ==========================================================================
  // Helper Function Tests
  // ==========================================================================

  // Note: playbookExists and listAvailablePlaybooks use dynamic require()
  // internally which prevents proper mocking in vitest. These functions are
  // simple wrappers over playbook-loader functions, which are thoroughly
  // tested in playbook-loader.test.ts. The error handling behavior (returning
  // false/[] on errors) is implicitly tested when the playbook-loader module
  // isn't available.

  // ==========================================================================
  // Result Formatting Tests
  // ==========================================================================

  describe('formatPlaybookStepResult', () => {
    const createSuccessResult = (): PlaybookStepExecutionResult => ({
      success: true,
      step: {
        type: 'ios.playbook',
        playbookName: 'Test-Playbook',
        lineNumber: 1,
        rawText: '- ios.playbook: Test-Playbook',
      },
      durationMs: 1500,
      playbookResult: {
        passed: true,
        playbook: { name: 'Test-Playbook' },
        stepsExecuted: 5,
        stepsPassed: 5,
        stepsFailed: 0,
        stepsSkipped: 0,
        totalDuration: 1500,
        startTime: new Date(),
        endTime: new Date(),
        stepResults: [],
        finalVariables: {},
        finalOutputs: {},
        artifactsDir: '/tmp/artifacts',
        collected: {},
      },
    });

    const createFailureResult = (): PlaybookStepExecutionResult => ({
      success: false,
      step: {
        type: 'ios.playbook',
        playbookName: 'Failed-Playbook',
        lineNumber: 1,
        rawText: '- ios.playbook: Failed-Playbook',
      },
      durationMs: 3000,
      error: 'Assertion failed',
      failureReason: 'playbook_failed',
      suggestions: ['Check element visibility', 'Verify app state'],
      playbookResult: {
        passed: false,
        playbook: { name: 'Failed-Playbook' },
        stepsExecuted: 3,
        stepsPassed: 2,
        stepsFailed: 1,
        stepsSkipped: 0,
        totalDuration: 3000,
        startTime: new Date(),
        endTime: new Date(),
        stepResults: [],
        finalVariables: {},
        finalOutputs: {},
        artifactsDir: '/tmp/artifacts',
        error: 'Assertion failed',
        collected: {},
      },
    });

    describe('formatPlaybookStepResult (markdown)', () => {
      it('should format successful result', () => {
        const result = formatPlaybookStepResult(createSuccessResult());

        expect(result).toContain('✅ PASSED');
        expect(result).toContain('Test-Playbook');
        expect(result).toContain('1.5s');
        expect(result).toContain('5/5 passed');
      });

      it('should format failed result with error and suggestions', () => {
        const result = formatPlaybookStepResult(createFailureResult());

        expect(result).toContain('❌ FAILED');
        expect(result).toContain('Failed-Playbook');
        expect(result).toContain('3.0s');
        expect(result).toContain('2/3 passed');
        expect(result).toContain('Failed: 1');
        expect(result).toContain('Error: Assertion failed');
        expect(result).toContain('Suggestions:');
        expect(result).toContain('Check element visibility');
      });

      it('should format duration in milliseconds when under 1 second', () => {
        const result: PlaybookStepExecutionResult = {
          ...createSuccessResult(),
          durationMs: 500,
        };

        const formatted = formatPlaybookStepResult(result);

        expect(formatted).toContain('500ms');
      });

      it('should show skipped count when present', () => {
        const result: PlaybookStepExecutionResult = {
          ...createSuccessResult(),
          playbookResult: {
            ...createSuccessResult().playbookResult!,
            stepsSkipped: 2,
          },
        };

        const formatted = formatPlaybookStepResult(result);

        expect(formatted).toContain('Skipped: 2');
      });
    });

    describe('formatPlaybookStepResultAsJson', () => {
      it('should format result as valid JSON', () => {
        const result = createSuccessResult();
        const json = formatPlaybookStepResultAsJson(result);

        const parsed = JSON.parse(json);

        expect(parsed.success).toBe(true);
        expect(parsed.playbookName).toBe('Test-Playbook');
        expect(parsed.durationMs).toBe(1500);
        expect(parsed.playbookResult.passed).toBe(true);
        expect(parsed.playbookResult.stepsExecuted).toBe(5);
      });

      it('should include error information for failures', () => {
        const result = createFailureResult();
        const json = formatPlaybookStepResultAsJson(result);

        const parsed = JSON.parse(json);

        expect(parsed.success).toBe(false);
        expect(parsed.error).toBe('Assertion failed');
        expect(parsed.failureReason).toBe('playbook_failed');
      });
    });

    describe('formatPlaybookStepResultCompact', () => {
      it('should format success compactly', () => {
        const result = createSuccessResult();
        const formatted = formatPlaybookStepResultCompact(result);

        expect(formatted).toBe('[PASS] Test-Playbook: 5/5 steps, 1.5s');
      });

      it('should format failure compactly', () => {
        const result = createFailureResult();
        const formatted = formatPlaybookStepResultCompact(result);

        expect(formatted).toBe('[FAIL] Failed-Playbook: 2/3 steps, 3.0s');
      });

      it('should handle result without playbookResult', () => {
        const result: PlaybookStepExecutionResult = {
          success: false,
          step: {
            type: 'ios.playbook',
            playbookName: 'Test',
            lineNumber: 1,
            rawText: '- ios.playbook: Test',
          },
          durationMs: 100,
          error: 'Load failed',
        };

        const formatted = formatPlaybookStepResultCompact(result);

        expect(formatted).toBe('[FAIL] Test: 100ms');
      });
    });
  });

  // ==========================================================================
  // Integration with Auto Run Documents
  // ==========================================================================

  describe('Auto Run document integration', () => {
    it('should execute playbook from parsed step with inputs', async () => {
      vi.mocked(runPlaybook).mockResolvedValueOnce({
        success: true,
        data: {
          passed: true,
          playbook: { name: 'Regression-Check' },
          stepsExecuted: 4,
          stepsPassed: 4,
          stepsFailed: 0,
          stepsSkipped: 0,
          totalDuration: 10000,
          startTime: new Date(),
          endTime: new Date(),
          stepResults: [],
          finalVariables: { screenshots_compared: 8 },
          finalOutputs: {},
          artifactsDir: '/tmp/regression-artifacts',
          collected: {},
        },
      });

      // Simulate step parsed from:
      // - [ ] Run regression check
      //   - ios.playbook: Regression-Check
      //     inputs:
      //       flows:
      //         - login_flow.yaml
      //         - purchase_flow.yaml
      //       baseline_dir: ./baselines
      const step: PlaybookStep = {
        type: 'ios.playbook',
        playbookName: 'Regression-Check',
        inputs: {
          flows: ['login_flow.yaml', 'purchase_flow.yaml'],
          baseline_dir: './baselines',
        },
        lineNumber: 15,
        rawText: '- ios.playbook: Regression-Check',
      };

      const result = await executePlaybookStep(step, {
        sessionId: 'autorun-session-123',
        cwd: '/project/path',
      });

      expect(result.success).toBe(true);
      expect(result.playbookResult?.passed).toBe(true);
      expect(runPlaybook).toHaveBeenCalledWith(
        expect.objectContaining({
          playbook: 'Regression-Check',
          inputs: {
            flows: ['login_flow.yaml', 'purchase_flow.yaml'],
            baseline_dir: './baselines',
          },
          sessionId: 'autorun-session-123',
          cwd: '/project/path',
        })
      );
    });

    it('should work with simple playbook name (no inputs)', async () => {
      vi.mocked(runPlaybook).mockResolvedValueOnce({
        success: true,
        data: {
          passed: true,
          playbook: { name: 'Crash-Hunt' },
          stepsExecuted: 1,
          stepsPassed: 1,
          stepsFailed: 0,
          stepsSkipped: 0,
          totalDuration: 60000,
          startTime: new Date(),
          endTime: new Date(),
          stepResults: [],
          finalVariables: { crashes_found: 0 },
          finalOutputs: {},
          artifactsDir: '/tmp/crash-hunt-artifacts',
          collected: {},
        },
      });

      // Simulate step parsed from:
      // - [ ] Hunt for crashes
      //   - ios.playbook: Crash-Hunt
      const step: PlaybookStep = {
        type: 'ios.playbook',
        playbookName: 'Crash-Hunt',
        lineNumber: 5,
        rawText: '- ios.playbook: Crash-Hunt',
      };

      const result = await executePlaybookStep(step);

      expect(result.success).toBe(true);
      expect(runPlaybook).toHaveBeenCalledWith(
        expect.objectContaining({
          playbook: 'Crash-Hunt',
          inputs: {},
        })
      );
    });
  });
});
