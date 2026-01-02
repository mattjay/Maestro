/**
 * Integration tests for Custom Playbook Creation
 *
 * These tests verify the complete end-to-end workflow for creating, loading,
 * validating, and running custom iOS playbooks. This demonstrates that users
 * can create their own playbooks following the documented patterns.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the artifacts module before importing the runner
vi.mock('../artifacts', () => ({
  getArtifactDirectory: vi.fn().mockImplementation(async (sessionId: string) => {
    const dir = path.join(os.tmpdir(), `mock-artifacts-${sessionId}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }),
  generateSnapshotId: vi.fn().mockReturnValue('mock-snapshot-id'),
}));

import {
  ensurePlaybooksDirectory,
  loadPlaybook,
  listPlaybooks,
  validatePlaybook,
  getPlaybookInfo,
  playbookExists,
  getPlaybookTemplatesDir,
  type IOSPlaybookConfig,
} from '../playbook-loader';
import { runPlaybook, formatPlaybookResult } from '../playbook-runner';

// =============================================================================
// Test Helpers
// =============================================================================

let testDir: string;

function createTestDir(): string {
  const dir = path.join(
    os.tmpdir(),
    `custom-playbook-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTestDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Write a playbook YAML file using js-yaml
 */
function writePlaybookYaml(
  baseDir: string,
  playbookId: string,
  config: IOSPlaybookConfig
): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yaml = require('js-yaml');

  const playbookDir = path.join(baseDir, playbookId);
  fs.mkdirSync(playbookDir, { recursive: true });
  const yamlPath = path.join(playbookDir, 'playbook.yaml');
  fs.writeFileSync(yamlPath, yaml.dump(config));
  return yamlPath;
}

/**
 * Write a README.md file for a playbook
 */
function writePlaybookReadme(
  baseDir: string,
  playbookId: string,
  content: string
): string {
  const playbookDir = path.join(baseDir, playbookId);
  if (!fs.existsSync(playbookDir)) {
    fs.mkdirSync(playbookDir, { recursive: true });
  }
  const readmePath = path.join(playbookDir, 'README.md');
  fs.writeFileSync(readmePath, content);
  return readmePath;
}

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  testDir = createTestDir();
});

afterEach(() => {
  cleanupTestDir(testDir);
});

// =============================================================================
// Custom Playbook Creation Tests
// =============================================================================

describe('Custom Playbook Creation', () => {
  describe('creating a custom playbook from scratch', () => {
    it('should allow creating a basic custom playbook with minimal configuration', () => {
      // Step 1: Define a minimal custom playbook configuration
      const customConfig: IOSPlaybookConfig = {
        name: 'My Custom Playbook',
        description: 'A simple custom playbook for testing',
        version: '1.0.0',
        steps: [
          {
            name: 'Take Screenshot',
            action: 'ios.snapshot',
          },
        ],
      };

      // Step 2: Write the playbook to the directory
      writePlaybookYaml(testDir, 'My-Custom-Playbook', customConfig);

      // Step 3: Verify the playbook exists
      expect(playbookExists('My-Custom-Playbook', testDir)).toBe(true);

      // Step 4: Load and verify the playbook
      const loaded = loadPlaybook('My-Custom-Playbook', testDir);
      expect(loaded.name).toBe('My Custom Playbook');
      expect(loaded.description).toBe('A simple custom playbook for testing');
      expect(loaded.version).toBe('1.0.0');
      expect(loaded.steps).toHaveLength(1);
    });

    it('should allow creating a custom playbook with inputs and variables', () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Parameterized Custom Playbook',
        description: 'A custom playbook with configurable inputs',
        version: '1.0.0',
        inputs: {
          app_bundle_id: {
            description: 'Bundle ID of the app to test',
            type: 'string',
            required: true,
          },
          test_timeout: {
            description: 'Timeout for tests in seconds',
            type: 'number',
            default: 60,
          },
          run_cleanup: {
            description: 'Whether to clean up after tests',
            type: 'boolean',
            default: true,
          },
          test_flows: {
            description: 'List of test flows to run',
            type: 'array',
            required: false,
          },
        },
        variables: {
          tests_run: 0,
          tests_passed: 0,
          tests_failed: 0,
          current_test: '',
        },
        steps: [
          {
            name: 'Initialize Test Run',
            action: 'ios.boot_simulator',
          },
          {
            name: 'Launch App',
            action: 'ios.launch',
            inputs: {
              bundle_id: '{{ inputs.app_bundle_id }}',
            },
          },
        ],
      };

      writePlaybookYaml(testDir, 'Parameterized-Playbook', customConfig);

      const loaded = loadPlaybook('Parameterized-Playbook', testDir);

      expect(loaded.inputs).toBeDefined();
      expect(loaded.inputs?.app_bundle_id?.required).toBe(true);
      expect(loaded.inputs?.test_timeout?.default).toBe(60);
      expect(loaded.inputs?.run_cleanup?.type).toBe('boolean');
      expect(loaded.inputs?.test_flows?.type).toBe('array');

      expect(loaded.variables).toBeDefined();
      expect(loaded.variables?.tests_run).toBe(0);
      expect(loaded.variables?.tests_passed).toBe(0);
    });

    it('should allow creating a custom playbook with loop constructs', () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Loop-Based Custom Playbook',
        version: '1.0.0',
        inputs: {
          screens: {
            type: 'array',
            required: true,
            description: 'List of screens to capture',
          },
        },
        steps: [
          {
            name: 'Boot Simulator',
            action: 'ios.boot_simulator',
          },
          {
            name: 'Capture Each Screen',
            loop: '{{ inputs.screens }}',
            as: 'screen',
            steps: [
              {
                name: 'Navigate to Screen',
                action: 'ios.run_flow',
                inputs: {
                  steps: '{{ screen.navigation }}',
                },
              },
              {
                name: 'Take Screenshot',
                action: 'ios.screenshot',
                inputs: {
                  output: '{{ artifacts_dir }}/{{ screen.name }}.png',
                },
              },
            ],
          },
        ],
      };

      writePlaybookYaml(testDir, 'Loop-Playbook', customConfig);

      const loaded = loadPlaybook('Loop-Playbook', testDir);

      expect(loaded.steps).toHaveLength(2);
      expect(loaded.steps[1].loop).toBe('{{ inputs.screens }}');
      expect(loaded.steps[1].as).toBe('screen');
      expect(loaded.steps[1].steps).toHaveLength(2);
    });

    it('should allow creating a custom playbook with conditional steps', () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Conditional Custom Playbook',
        version: '1.0.0',
        inputs: {
          run_login: {
            type: 'boolean',
            default: true,
          },
          skip_screenshots: {
            type: 'boolean',
            default: false,
          },
        },
        variables: {
          logged_in: false,
        },
        steps: [
          {
            name: 'Optional Login',
            condition: '{{ inputs.run_login }}',
            action: 'ios.run_flow',
            inputs: {
              flow: 'login',
            },
          },
          {
            name: 'Conditional Screenshot',
            condition: '{{ !inputs.skip_screenshots }}',
            action: 'ios.screenshot',
          },
        ],
      };

      writePlaybookYaml(testDir, 'Conditional-Playbook', customConfig);

      const loaded = loadPlaybook('Conditional-Playbook', testDir);

      expect(loaded.steps[0].condition).toBe('{{ inputs.run_login }}');
      expect(loaded.steps[1].condition).toBe('{{ !inputs.skip_screenshots }}');
    });

    it('should allow creating a custom playbook with error handling', () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Error Handling Custom Playbook',
        version: '1.0.0',
        steps: [
          {
            name: 'Risky Build Step',
            action: 'ios.build',
            on_failure: [
              {
                name: 'Report Build Error',
                action: 'report_build_errors',
              },
              {
                name: 'Exit with Error',
                action: 'exit_loop',
                reason: 'Build failed',
              },
            ],
          },
          {
            name: 'Non-Critical Step',
            action: 'ios.snapshot',
            continue_on_error: true,
          },
        ],
      };

      writePlaybookYaml(testDir, 'Error-Handling-Playbook', customConfig);

      const loaded = loadPlaybook('Error-Handling-Playbook', testDir);

      expect(loaded.steps[0].on_failure).toHaveLength(2);
      expect(loaded.steps[0].on_failure?.[0].action).toBe('report_build_errors');
      expect(loaded.steps[1].continue_on_error).toBe(true);
    });
  });

  describe('listing custom playbooks alongside built-in playbooks', () => {
    it('should list custom playbooks mixed with built-in playbooks', () => {
      // Create a built-in playbook
      writePlaybookYaml(testDir, 'Feature-Ship-Loop', {
        name: 'iOS Feature Ship Loop',
        version: '1.0.0',
        steps: [{ action: 'ios.build' }],
      });

      // Create custom playbooks
      writePlaybookYaml(testDir, 'My-Custom-Test', {
        name: 'My Custom Test Playbook',
        version: '1.0.0',
        steps: [{ action: 'ios.snapshot' }],
      });

      writePlaybookYaml(testDir, 'Team-Specific-Check', {
        name: 'Team Specific Check',
        description: 'Playbook for our team',
        version: '2.0.0',
        steps: [{ action: 'ios.inspect' }],
      });

      const playbooks = listPlaybooks(testDir);

      expect(playbooks).toHaveLength(3);

      const builtIn = playbooks.find((p) => p.id === 'Feature-Ship-Loop');
      expect(builtIn).toBeDefined();
      expect(builtIn?.builtIn).toBe(true);

      const custom1 = playbooks.find((p) => p.id === 'My-Custom-Test');
      expect(custom1).toBeDefined();
      expect(custom1?.builtIn).toBe(false);
      expect(custom1?.name).toBe('My Custom Test Playbook');

      const custom2 = playbooks.find((p) => p.id === 'Team-Specific-Check');
      expect(custom2).toBeDefined();
      expect(custom2?.builtIn).toBe(false);
      expect(custom2?.version).toBe('2.0.0');
    });
  });

  describe('validating custom playbooks', () => {
    it('should validate a well-formed custom playbook', () => {
      const validConfig: IOSPlaybookConfig = {
        name: 'Well-Formed Custom Playbook',
        description: 'Follows all best practices',
        version: '1.0.0',
        inputs: {
          project_path: {
            description: 'Path to the project',
            type: 'string',
            required: true,
          },
        },
        variables: {
          build_success: false,
        },
        steps: [
          {
            name: 'Build',
            action: 'ios.build',
            store_as: 'build_result',
          },
          {
            name: 'Test',
            action: 'ios.snapshot',
          },
        ],
      };

      const result = validatePlaybook(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch errors in malformed custom playbooks', () => {
      // Missing steps array
      const missingSteps = {
        name: 'Missing Steps',
      } as unknown as IOSPlaybookConfig;

      const result1 = validatePlaybook(missingSteps);
      expect(result1.valid).toBe(false);
      expect(result1.errors.some((e) => e.includes('steps'))).toBe(true);

      // Empty steps array
      const emptySteps: IOSPlaybookConfig = {
        name: 'Empty Steps',
        steps: [],
      };

      const result2 = validatePlaybook(emptySteps);
      expect(result2.valid).toBe(false);
      expect(result2.errors.some((e) => e.includes('at least one step'))).toBe(true);
    });

    it('should provide warnings for non-optimal patterns', () => {
      const warningConfig: IOSPlaybookConfig = {
        name: 'Warning Playbook',
        inputs: {
          // Required with default (warning)
          param: {
            required: true,
            default: 'value',
          },
        },
        steps: [
          // Missing step name (warning)
          { action: 'ios.snapshot' },
        ],
      };

      const result = validatePlaybook(warningConfig);

      expect(result.valid).toBe(true); // Warnings don't make it invalid
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('running custom playbooks', () => {
    it('should execute a simple custom playbook in dry run mode', async () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Simple Custom Playbook',
        version: '1.0.0',
        steps: [
          {
            name: 'Take Screenshot',
            action: 'wait',
            inputs: { seconds: 1 },
          },
        ],
      };

      writePlaybookYaml(testDir, 'Simple-Custom', customConfig);

      const result = await runPlaybook({
        playbook: 'Simple-Custom',
        inputs: {},
        sessionId: 'test-session',
        playbooksDir: testDir,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.playbook.name).toBe('Simple Custom Playbook');
      expect(result.data?.stepsSkipped).toBe(1); // Dry run skips execution
    });

    it('should execute a custom playbook with inputs', async () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Parameterized Playbook',
        version: '1.0.0',
        inputs: {
          message: {
            type: 'string',
            required: true,
          },
          count: {
            type: 'number',
            default: 1,
          },
        },
        steps: [
          {
            name: 'Log Message',
            action: 'report_status',
            inputs: {
              message: '{{ inputs.message }}',
              count: '{{ inputs.count }}',
            },
          },
        ],
      };

      writePlaybookYaml(testDir, 'Parameterized', customConfig);

      const result = await runPlaybook({
        playbook: 'Parameterized',
        inputs: {
          message: 'Hello from custom playbook!',
          count: 5,
        },
        sessionId: 'test-session',
        playbooksDir: testDir,
        dryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.data?.passed).toBe(true);
      expect(result.data?.stepsExecuted).toBe(1);
    });

    it('should fail gracefully when required input is missing', async () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Required Input Playbook',
        version: '1.0.0',
        inputs: {
          required_param: {
            type: 'string',
            required: true,
          },
        },
        steps: [
          { name: 'Step 1', action: 'wait', inputs: { seconds: 1 } },
        ],
      };

      writePlaybookYaml(testDir, 'Required-Input', customConfig);

      const result = await runPlaybook({
        playbook: 'Required-Input',
        inputs: {}, // Missing required_param
        sessionId: 'test-session',
        playbooksDir: testDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required_param');
    });

    it('should execute a custom playbook with progress reporting', async () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Progress Playbook',
        version: '1.0.0',
        steps: [
          { name: 'Step 1', action: 'wait', inputs: { seconds: 0.1 } },
          { name: 'Step 2', action: 'wait', inputs: { seconds: 0.1 } },
          { name: 'Step 3', action: 'wait', inputs: { seconds: 0.1 } },
        ],
      };

      writePlaybookYaml(testDir, 'Progress-Playbook', customConfig);

      const progressUpdates: string[] = [];

      const result = await runPlaybook({
        playbook: 'Progress-Playbook',
        inputs: {},
        sessionId: 'test-session',
        playbooksDir: testDir,
        onProgress: (update) => {
          progressUpdates.push(update.phase);
        },
      });

      expect(result.success).toBe(true);
      expect(progressUpdates).toContain('initializing');
      expect(progressUpdates).toContain('executing');
      expect(progressUpdates).toContain('complete');
    });

    it('should execute a custom playbook with loops', async () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Loop Playbook',
        version: '1.0.0',
        inputs: {
          items: {
            type: 'array',
            default: ['a', 'b', 'c'],
          },
        },
        variables: {
          processed: 0,
        },
        steps: [
          {
            name: 'Process Items',
            loop: '{{ inputs.items }}',
            as: 'item',
            steps: [
              {
                name: 'Process Item',
                action: 'increment_iteration',
              },
            ],
          },
        ],
      };

      writePlaybookYaml(testDir, 'Loop-Playbook', customConfig);

      const result = await runPlaybook({
        playbook: 'Loop-Playbook',
        inputs: {
          items: [1, 2, 3, 4, 5],
        },
        sessionId: 'test-session',
        playbooksDir: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.passed).toBe(true);
      // increment_iteration is called 5 times, once per loop iteration
      expect(result.data?.finalVariables.iteration).toBe(5);
    });

    it('should execute a custom playbook with conditional steps', async () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Conditional Playbook',
        version: '1.0.0',
        inputs: {
          skip_expensive: {
            type: 'boolean',
            default: true,
          },
        },
        steps: [
          {
            name: 'Always Runs',
            action: 'report_status',
            inputs: { passed: 1, failed: 0 },
          },
          {
            name: 'Conditionally Skipped',
            condition: '{{ !inputs.skip_expensive }}',
            action: 'wait',
            inputs: { seconds: 10 },
          },
        ],
      };

      writePlaybookYaml(testDir, 'Conditional', customConfig);

      const result = await runPlaybook({
        playbook: 'Conditional',
        inputs: {
          skip_expensive: true,
        },
        sessionId: 'test-session',
        playbooksDir: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.stepsExecuted).toBe(1);
      expect(result.data?.stepsSkipped).toBe(1);
    });
  });

  describe('custom playbook with custom action handlers', () => {
    it('should allow registering custom actions for a custom playbook', async () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Custom Action Playbook',
        version: '1.0.0',
        steps: [
          {
            name: 'Run Custom Action',
            action: 'custom.my_action',
            inputs: {
              param1: 'value1',
              param2: 42,
            },
            store_as: 'custom_result',
          },
        ],
      };

      writePlaybookYaml(testDir, 'Custom-Action', customConfig);

      const customActionCalled = { called: false, inputs: {} as Record<string, unknown> };

      const result = await runPlaybook({
        playbook: 'Custom-Action',
        inputs: {},
        sessionId: 'test-session',
        playbooksDir: testDir,
        customActions: {
          'custom.my_action': async (_context, inputs) => {
            customActionCalled.called = true;
            customActionCalled.inputs = inputs;
            return { success: true, data: { result: 'custom_success' } };
          },
        },
      });

      expect(result.success).toBe(true);
      expect(customActionCalled.called).toBe(true);
      expect(customActionCalled.inputs.param1).toBe('value1');
      expect(customActionCalled.inputs.param2).toBe(42);
      expect(result.data?.finalOutputs.custom_result).toEqual({ result: 'custom_success' });
    });
  });

  describe('custom playbook directory structure', () => {
    it('should create templates directory for custom playbook', () => {
      // Create custom playbook
      writePlaybookYaml(testDir, 'My-Playbook', {
        name: 'My Playbook',
        steps: [{ action: 'wait', inputs: { seconds: 1 } }],
      });

      // Create templates directory
      const templatesDir = getPlaybookTemplatesDir('My-Playbook', testDir);
      fs.mkdirSync(templatesDir, { recursive: true });

      // Write a template file
      fs.writeFileSync(
        path.join(templatesDir, 'test-config.yaml'),
        'test: true\nvalue: 42'
      );

      // Verify
      expect(fs.existsSync(templatesDir)).toBe(true);
      expect(fs.existsSync(path.join(templatesDir, 'test-config.yaml'))).toBe(true);
    });

    it('should support README.md alongside playbook.yaml', () => {
      writePlaybookYaml(testDir, 'Documented-Playbook', {
        name: 'Documented Playbook',
        steps: [{ action: 'wait', inputs: { seconds: 1 } }],
      });

      const readme = `# Documented Playbook

## Overview
This is a custom playbook with documentation.

## Usage
\`\`\`bash
/ios.playbook run Documented-Playbook --inputs '{"key": "value"}'
\`\`\`

## Inputs
- \`key\`: Required string parameter
`;

      writePlaybookReadme(testDir, 'Documented-Playbook', readme);

      const playbookDir = path.join(testDir, 'Documented-Playbook');
      expect(fs.existsSync(path.join(playbookDir, 'playbook.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(playbookDir, 'README.md'))).toBe(true);
    });
  });

  describe('playbook result formatting', () => {
    it('should format custom playbook results as markdown', async () => {
      const customConfig: IOSPlaybookConfig = {
        name: 'Format Test Playbook',
        version: '1.0.0',
        steps: [
          { name: 'Step 1', action: 'wait', inputs: { seconds: 0.1 } },
          { name: 'Step 2', action: 'wait', inputs: { seconds: 0.1 } },
        ],
      };

      writePlaybookYaml(testDir, 'Format-Test', customConfig);

      const result = await runPlaybook({
        playbook: 'Format-Test',
        inputs: {},
        sessionId: 'test-session',
        playbooksDir: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const markdown = formatPlaybookResult(result.data!);

      expect(markdown).toContain('Format Test Playbook');
      expect(markdown).toContain('PASSED');
      expect(markdown).toContain('Step 1');
      expect(markdown).toContain('Step 2');
    });
  });

  describe('custom playbook with full workflow simulation', () => {
    it('should handle a realistic custom UI test playbook', async () => {
      // This simulates a realistic custom playbook that a user might create
      // for testing their specific UI flows
      const customConfig: IOSPlaybookConfig = {
        name: 'UI Flow Test Playbook',
        description: 'Tests critical UI flows for MyApp',
        version: '1.0.0',
        inputs: {
          environment: {
            description: 'Test environment',
            type: 'string',
            default: 'staging',
          },
          flows_to_test: {
            description: 'Which flows to test',
            type: 'array',
            default: ['login', 'signup', 'checkout'],
          },
          fail_fast: {
            description: 'Stop on first failure',
            type: 'boolean',
            default: false,
          },
        },
        variables: {
          flows_passed: 0,
          flows_failed: 0,
          current_flow: '',
          start_time: '',
        },
        steps: [
          {
            name: 'Initialize Test Run',
            action: 'report_status',
            inputs: {
              passed: 0,
              failed: 0,
            },
          },
          {
            name: 'Run Each Flow',
            loop: '{{ inputs.flows_to_test }}',
            as: 'flow_name',
            steps: [
              {
                name: 'Execute Flow',
                action: 'report_status',
                inputs: {
                  passed: 1,
                  failed: 0,
                },
              },
              {
                name: 'Record Success',
                action: 'increment_iteration',
              },
            ],
          },
          {
            name: 'Generate Summary',
            action: 'report_status',
            inputs: {
              passed: '{{ variables.iteration }}',
              failed: 0,
            },
          },
        ],
      };

      writePlaybookYaml(testDir, 'UI-Flow-Test', customConfig);

      // Write a README for the playbook
      writePlaybookReadme(
        testDir,
        'UI-Flow-Test',
        `# UI Flow Test Playbook

Runs critical UI flows and reports results.

## Usage
\`\`\`
/ios.playbook run UI-Flow-Test --inputs '{"environment": "production"}'
\`\`\`
`
      );

      const result = await runPlaybook({
        playbook: 'UI-Flow-Test',
        inputs: {
          environment: 'staging',
          flows_to_test: ['login', 'signup', 'checkout', 'profile'],
          fail_fast: false,
        },
        sessionId: 'test-session',
        playbooksDir: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.data?.passed).toBe(true);
      // 4 flows * 2 steps each = 8 nested steps + 2 outer steps = varies based on counting
      // The iteration counter was incremented 4 times (once per flow)
      expect(result.data?.finalVariables.iteration).toBe(4);
    });
  });

  describe('playbook info retrieval', () => {
    it('should return full info for custom playbook', () => {
      writePlaybookYaml(testDir, 'Info-Test', {
        name: 'Info Test Playbook',
        description: 'A playbook for testing info retrieval',
        version: '2.1.0',
        steps: [{ action: 'wait', inputs: { seconds: 1 } }],
      });

      const info = getPlaybookInfo('Info-Test', testDir);

      expect(info).toBeDefined();
      expect(info?.id).toBe('Info-Test');
      expect(info?.name).toBe('Info Test Playbook');
      expect(info?.description).toBe('A playbook for testing info retrieval');
      expect(info?.version).toBe('2.1.0');
      expect(info?.builtIn).toBe(false);
      expect(info?.configPath).toBe(path.join(testDir, 'Info-Test', 'playbook.yaml'));
      expect(info?.directory).toBe(path.join(testDir, 'Info-Test'));
    });
  });
});

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

describe('Custom Playbook Edge Cases', () => {
  it('should handle playbook with deeply nested loops', async () => {
    const config: IOSPlaybookConfig = {
      name: 'Deeply Nested Loops',
      version: '1.0.0',
      inputs: {
        outer: { type: 'array', default: ['a', 'b'] },
        inner: { type: 'array', default: [1, 2] },
      },
      variables: { count: 0 },
      steps: [
        {
          loop: '{{ inputs.outer }}',
          as: 'outer_item',
          steps: [
            {
              loop: '{{ inputs.inner }}',
              as: 'inner_item',
              steps: [
                { action: 'increment_iteration' },
              ],
            },
          ],
        },
      ],
    };

    writePlaybookYaml(testDir, 'Nested-Loops', config);

    const result = await runPlaybook({
      playbook: 'Nested-Loops',
      inputs: {},
      sessionId: 'test-session',
      playbooksDir: testDir,
    });

    expect(result.success).toBe(true);
    // 2 outer * 2 inner = 4 iterations
    expect(result.data?.finalVariables.iteration).toBe(4);
  });

  it('should handle playbook with special characters in name', () => {
    const config: IOSPlaybookConfig = {
      name: "Team's Special & <Unique> Playbook",
      version: '1.0.0',
      steps: [{ action: 'wait', inputs: { seconds: 0.1 } }],
    };

    writePlaybookYaml(testDir, 'Special-Chars', config);

    const loaded = loadPlaybook('Special-Chars', testDir);
    expect(loaded.name).toBe("Team's Special & <Unique> Playbook");
  });

  it('should handle playbook with empty input defaults', async () => {
    const config: IOSPlaybookConfig = {
      name: 'Empty Defaults',
      version: '1.0.0',
      inputs: {
        empty_string: { type: 'string', default: '' },
        empty_array: { type: 'array', default: [] },
        zero_number: { type: 'number', default: 0 },
        false_bool: { type: 'boolean', default: false },
      },
      steps: [
        { action: 'report_status', inputs: { passed: 1, failed: 0 } },
      ],
    };

    writePlaybookYaml(testDir, 'Empty-Defaults', config);

    const result = await runPlaybook({
      playbook: 'Empty-Defaults',
      inputs: {}, // Use all defaults
      sessionId: 'test-session',
      playbooksDir: testDir,
    });

    expect(result.success).toBe(true);
  });
});
