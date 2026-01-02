/**
 * Integration Tests for Playbooks in Auto Run Documents
 *
 * Tests the complete flow from parsing ios.playbook steps in Auto Run documents
 * through to execution via the playbook-step-executor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseDocument,
  extractUncheckedSteps,
  parseLine,
} from '../step-parser';
import {
  executePlaybookStep,
  formatPlaybookStepResult,
} from '../playbook-step-executor';
import type { PlaybookStep, IOSStep } from '../step-types';

// Mock the playbook-runner module
vi.mock('../../../main/ios-tools/playbook-runner', () => ({
  runPlaybook: vi.fn(),
}));

// Mock uuid
vi.mock('../../../shared/uuid', () => ({
  generateUUID: vi.fn(() => 'integration-test-uuid'),
}));

import { runPlaybook } from '../../../main/ios-tools/playbook-runner';

describe('Auto Run Playbook Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // End-to-End Flow Tests
  // ==========================================================================

  describe('end-to-end: parse to execute', () => {
    it('should parse playbook step from Auto Run document and execute it', async () => {
      // Mock successful playbook execution
      vi.mocked(runPlaybook).mockResolvedValueOnce({
        success: true,
        data: {
          passed: true,
          playbook: { name: 'Regression-Check', version: '1.0.0' },
          stepsExecuted: 10,
          stepsPassed: 10,
          stepsFailed: 0,
          stepsSkipped: 0,
          totalDuration: 30000,
          startTime: new Date(),
          endTime: new Date(),
          stepResults: [],
          finalVariables: {},
          finalOutputs: {},
          artifactsDir: '/tmp/artifacts',
          collected: {},
        },
      });

      // Simulate an Auto Run document with a playbook step
      const autoRunDocument = `
# Phase 1: Initial Validation

## Tasks

- [ ] Run regression tests against baseline
  \`\`\`
  This task runs the Regression-Check playbook to compare
  screenshots against stored baselines.
  \`\`\`

- ios.playbook: { "name": "Regression-Check", "inputs": { "flows": ["login.yaml", "checkout.yaml"], "baseline_dir": "./baselines" } }

- [ ] Review the regression report
`;

      // Step 1: Parse the document
      const parseResult = parseDocument(autoRunDocument);

      // Verify parsing extracted the playbook step
      expect(parseResult.errors).toHaveLength(0);
      expect(parseResult.steps).toHaveLength(1);
      expect(parseResult.steps[0].type).toBe('ios.playbook');

      const playbookStep = parseResult.steps[0] as PlaybookStep;
      expect(playbookStep.playbookName).toBe('Regression-Check');
      expect(playbookStep.inputs).toEqual({
        flows: ['login.yaml', 'checkout.yaml'],
        baseline_dir: './baselines',
      });

      // Step 2: Execute the playbook step
      const executionResult = await executePlaybookStep(playbookStep, {
        sessionId: 'autorun-session-001',
        cwd: '/project/ios-app',
      });

      // Verify execution succeeded
      expect(executionResult.success).toBe(true);
      expect(executionResult.playbookResult).toBeDefined();
      expect(executionResult.playbookResult?.passed).toBe(true);
      expect(executionResult.playbookResult?.stepsExecuted).toBe(10);

      // Verify correct parameters were passed to runner
      expect(runPlaybook).toHaveBeenCalledWith(
        expect.objectContaining({
          playbook: 'Regression-Check',
          inputs: {
            flows: ['login.yaml', 'checkout.yaml'],
            baseline_dir: './baselines',
          },
          sessionId: 'autorun-session-001',
          cwd: '/project/ios-app',
        })
      );
    });

    it('should handle unchecked playbook steps in task list format', async () => {
      vi.mocked(runPlaybook).mockResolvedValueOnce({
        success: true,
        data: {
          passed: true,
          playbook: { name: 'Crash-Hunt' },
          stepsExecuted: 50,
          stepsPassed: 50,
          stepsFailed: 0,
          stepsSkipped: 0,
          totalDuration: 60000,
          startTime: new Date(),
          endTime: new Date(),
          stepResults: [],
          finalVariables: { crashes_found: 0 },
          finalOutputs: {},
          artifactsDir: '/tmp/crash-hunt',
          collected: {},
        },
      });

      // Document with checkbox-style playbook step
      const document = `
# Stability Testing

- [x] ios.playbook: Regression-Check
- [ ] ios.playbook: Crash-Hunt
- [ ] Review crash reports
`;

      // Extract only unchecked iOS steps
      const uncheckedSteps = extractUncheckedSteps(document);

      // Should only get the unchecked Crash-Hunt playbook
      expect(uncheckedSteps).toHaveLength(1);
      expect(uncheckedSteps[0].type).toBe('ios.playbook');
      expect((uncheckedSteps[0] as PlaybookStep).playbookName).toBe('Crash-Hunt');

      // Execute
      const result = await executePlaybookStep(uncheckedSteps[0] as PlaybookStep);

      expect(result.success).toBe(true);
      expect(result.playbookResult?.finalVariables.crashes_found).toBe(0);
    });

    it('should handle multiple playbooks in sequence', async () => {
      // Setup mocks for multiple playbook executions
      vi.mocked(runPlaybook)
        .mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Design-Review' },
            stepsExecuted: 8,
            stepsPassed: 8,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 15000,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/design',
            collected: {},
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Performance-Check' },
            stepsExecuted: 5,
            stepsPassed: 5,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 45000,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: { launch_time: 1200 },
            finalOutputs: {},
            artifactsDir: '/tmp/perf',
            collected: {},
          },
        });

      const document = `
# Release Validation Pipeline

## Visual Verification
- ios.playbook: Design-Review

## Performance Baseline
- ios.playbook: Performance-Check
`;

      const parseResult = parseDocument(document);

      expect(parseResult.steps).toHaveLength(2);
      expect((parseResult.steps[0] as PlaybookStep).playbookName).toBe('Design-Review');
      expect((parseResult.steps[1] as PlaybookStep).playbookName).toBe('Performance-Check');

      // Execute in sequence
      const results: Awaited<ReturnType<typeof executePlaybookStep>>[] = [];
      for (const step of parseResult.steps) {
        if (step.type === 'ios.playbook') {
          results.push(await executePlaybookStep(step as PlaybookStep));
        }
      }

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[1].playbookResult?.finalVariables.launch_time).toBe(1200);
    });
  });

  // ==========================================================================
  // Mixed Step Types
  // ==========================================================================

  describe('mixed iOS steps with playbooks', () => {
    it('should parse document with both assertion steps and playbook steps', () => {
      const document = `
# iOS Testing Workflow

## Pre-flight Checks
- ios.assert_visible: "#app_ready_indicator"
- ios.wait_for: "#home_screen"

## Automated Test Suite
- ios.playbook: Regression-Check

## Post-test Verification
- ios.tap: "#settings_button"
- ios.assert_text: { "target": "#version", "expected": "1.0.0" }
`;

      const parseResult = parseDocument(document);

      expect(parseResult.errors).toHaveLength(0);
      expect(parseResult.steps).toHaveLength(5);

      // Verify step types in order
      expect(parseResult.steps[0].type).toBe('ios.assert_visible');
      expect(parseResult.steps[1].type).toBe('ios.wait_for');
      expect(parseResult.steps[2].type).toBe('ios.playbook');
      expect(parseResult.steps[3].type).toBe('ios.tap');
      expect(parseResult.steps[4].type).toBe('ios.assert_text');

      // Verify playbook step details
      const playbookStep = parseResult.steps[2] as PlaybookStep;
      expect(playbookStep.playbookName).toBe('Regression-Check');
    });

    it('should identify playbook steps for separate handling in executor', () => {
      const document = `
- ios.assert_visible: "#button"
- ios.playbook: Feature-Ship-Loop
- ios.tap: "#submit"
`;

      const parseResult = parseDocument(document);

      // Separate playbook steps from other iOS steps
      const playbookSteps = parseResult.steps.filter(
        (step): step is PlaybookStep => step.type === 'ios.playbook'
      );
      const otherSteps = parseResult.steps.filter(
        (step): step is IOSStep => step.type !== 'ios.playbook'
      );

      expect(playbookSteps).toHaveLength(1);
      expect(otherSteps).toHaveLength(2);
      expect(playbookSteps[0].playbookName).toBe('Feature-Ship-Loop');
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling in Auto Run context', () => {
    it('should capture playbook failure and format for reporting', async () => {
      vi.mocked(runPlaybook).mockResolvedValueOnce({
        success: true,
        data: {
          passed: false,
          playbook: { name: 'Regression-Check' },
          stepsExecuted: 5,
          stepsPassed: 3,
          stepsFailed: 2,
          stepsSkipped: 0,
          totalDuration: 20000,
          startTime: new Date(),
          endTime: new Date(),
          stepResults: [
            { name: 'Assert Login', success: true, duration: 100, skipped: false },
            { name: 'Compare Home', success: false, error: 'Visual diff > 5%', duration: 500, skipped: false },
          ],
          finalVariables: {},
          finalOutputs: {},
          artifactsDir: '/tmp/artifacts',
          error: '2 visual regression tests failed',
          collected: {},
        },
      });

      const step = parseLine('- ios.playbook: Regression-Check', 1) as PlaybookStep;
      const result = await executePlaybookStep(step);

      expect(result.success).toBe(false);
      expect(result.playbookResult?.stepsFailed).toBe(2);
      expect(result.error).toBe('2 visual regression tests failed');

      // Format for Auto Run report
      const formatted = formatPlaybookStepResult(result);
      expect(formatted).toContain('❌ FAILED');
      expect(formatted).toContain('Regression-Check');
      expect(formatted).toContain('3/5 passed');
      expect(formatted).toContain('Failed: 2');
    });

    it('should handle playbook not found error', async () => {
      vi.mocked(runPlaybook).mockResolvedValueOnce({
        success: false,
        error: "Failed to load playbook: Playbook 'NonExistent' not found",
      });

      const step = parseLine('- ios.playbook: NonExistent', 1) as PlaybookStep;
      const result = await executePlaybookStep(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toContain("Check if playbook 'NonExistent' exists");
    });
  });

  // ==========================================================================
  // Context Propagation
  // ==========================================================================

  describe('context propagation', () => {
    it('should pass session context from parsing to execution', async () => {
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
          artifactsDir: '/tmp/test',
          collected: {},
        },
      });

      // Parse with context (like Auto Run does)
      const step = parseLine('- ios.playbook: Test', 1, {
        sessionId: 'context-session-id',
      }) as PlaybookStep;

      expect(step.sessionId).toBe('context-session-id');

      // Execute - should use the sessionId from step
      await executePlaybookStep(step);

      expect(runPlaybook).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'context-session-id',
        })
      );
    });

    it('should support playbooks directory override', async () => {
      vi.mocked(runPlaybook).mockResolvedValueOnce({
        success: true,
        data: {
          passed: true,
          playbook: { name: 'Custom-Playbook' },
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
          artifactsDir: '/tmp/custom',
          collected: {},
        },
      });

      const step = parseLine('- ios.playbook: Custom-Playbook', 1) as PlaybookStep;

      await executePlaybookStep(step, {
        playbooksDir: '/project/custom-playbooks',
      });

      expect(runPlaybook).toHaveBeenCalledWith(
        expect.objectContaining({
          playbooksDir: '/project/custom-playbooks',
        })
      );
    });
  });

  // ==========================================================================
  // Progress and Callbacks
  // ==========================================================================

  describe('progress callbacks', () => {
    it('should forward progress updates during playbook execution', async () => {
      const progressUpdates: unknown[] = [];

      vi.mocked(runPlaybook).mockImplementationOnce(async (options) => {
        // Simulate progress callbacks
        if (options.onProgress) {
          options.onProgress({
            phase: 'initializing',
            stepIndex: 0,
            totalSteps: 3,
            message: 'Starting playbook',
            percentComplete: 0,
          });
          options.onProgress({
            phase: 'executing',
            stepIndex: 1,
            totalSteps: 3,
            stepName: 'Launch App',
            message: 'Executing: Launch App',
            percentComplete: 33,
          });
          options.onProgress({
            phase: 'complete',
            stepIndex: 3,
            totalSteps: 3,
            message: 'Playbook completed',
            percentComplete: 100,
          });
        }

        return {
          success: true,
          data: {
            passed: true,
            playbook: { name: 'Test' },
            stepsExecuted: 3,
            stepsPassed: 3,
            stepsFailed: 0,
            stepsSkipped: 0,
            totalDuration: 1000,
            startTime: new Date(),
            endTime: new Date(),
            stepResults: [],
            finalVariables: {},
            finalOutputs: {},
            artifactsDir: '/tmp/test',
            collected: {},
          },
        };
      });

      const step = parseLine('- ios.playbook: Test', 1) as PlaybookStep;

      await executePlaybookStep(step, {
        onProgress: (update) => {
          progressUpdates.push(update);
        },
      });

      expect(progressUpdates).toHaveLength(3);
      expect(progressUpdates[0]).toMatchObject({ phase: 'initializing' });
      expect(progressUpdates[1]).toMatchObject({ phase: 'executing', stepName: 'Launch App' });
      expect(progressUpdates[2]).toMatchObject({ phase: 'complete', percentComplete: 100 });
    });
  });
});
