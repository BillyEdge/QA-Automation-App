import { TestCase, TestAction, ActionType } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface TestStepOptions {
  waitBefore?: number;      // Wait time before executing (ms)
  waitAfter?: number;       // Wait time after executing (ms)
  retries?: number;         // Number of retries if step fails
  continueOnFailure?: boolean; // Continue execution even if this step fails
  timeout?: number;         // Maximum time for step execution (ms)
  loop?: {                  // Loop configuration
    count?: number;         // Number of times to repeat (default: 1)
    while?: string;         // Condition to check (not implemented yet)
    data?: any[];          // Array of data for data-driven testing
  };
  validation?: {           // Data validation
    type: 'equals' | 'contains' | 'regex' | 'exists' | 'notExists';
    expected: any;
    actual?: string;       // Path to element to validate
  };
}

export interface EnhancedTestAction extends TestAction {
  options?: TestStepOptions;
  enabled?: boolean;        // Can disable steps without deleting
}

export interface EnhancedTestCase extends Omit<TestCase, 'actions'> {
  actions: EnhancedTestAction[];
}

export class TestEditor {
  private testCase: EnhancedTestCase;
  private filePath: string;

  constructor(testCaseFilePath: string) {
    this.filePath = testCaseFilePath;
    const content = fs.readFileSync(testCaseFilePath, 'utf-8');
    this.testCase = JSON.parse(content);
  }

  /**
   * Get the test case
   */
  getTestCase(): EnhancedTestCase {
    return this.testCase;
  }

  /**
   * Save changes to disk
   */
  save(): void {
    this.testCase.updatedAt = Date.now();
    fs.writeFileSync(this.filePath, JSON.stringify(this.testCase, null, 2));
    console.log(`✅ Test case saved: ${this.filePath}`);
  }

  /**
   * Update test case metadata
   */
  updateMetadata(name?: string, description?: string, tags?: string[]): void {
    if (name) this.testCase.name = name;
    if (description) this.testCase.description = description;
    if (tags) this.testCase.tags = tags;
    console.log(`✅ Metadata updated`);
  }

  /**
   * List all test steps
   */
  listSteps(): void {
    console.log(`\n📝 Test Case: ${this.testCase.name}`);
    console.log(`   Platform: ${this.testCase.platform}`);
    console.log(`   Total Steps: ${this.testCase.actions.length}\n`);

    this.testCase.actions.forEach((action, index) => {
      const enabled = action.enabled !== false ? '✓' : '✗';
      const loop = action.options?.loop?.count ? ` [Loop: ${action.options.loop.count}x]` : '';
      const continueOnFail = action.options?.continueOnFailure ? ' [Continue on Fail]' : '';

      console.log(`  ${index + 1}. ${enabled} ${action.description}${loop}${continueOnFail}`);

      if (action.options?.waitBefore) {
        console.log(`      ⏱️  Wait Before: ${action.options.waitBefore}ms`);
      }
      if (action.options?.validation) {
        console.log(`      ✓ Validation: ${action.options.validation.type} - ${action.options.validation.expected}`);
      }
    });
    console.log('');
  }

  /**
   * Add a new step
   */
  addStep(action: TestAction, position?: number): void {
    const enhancedAction: EnhancedTestAction = {
      ...action,
      enabled: true
    };

    if (position !== undefined && position >= 0 && position <= this.testCase.actions.length) {
      this.testCase.actions.splice(position, 0, enhancedAction);
      console.log(`✅ Step added at position ${position + 1}`);
    } else {
      this.testCase.actions.push(enhancedAction);
      console.log(`✅ Step added at end (position ${this.testCase.actions.length})`);
    }
  }

  /**
   * Edit an existing step
   */
  editStep(stepIndex: number, updates: Partial<EnhancedTestAction>): void {
    if (stepIndex < 0 || stepIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    this.testCase.actions[stepIndex] = {
      ...this.testCase.actions[stepIndex],
      ...updates
    };

    console.log(`✅ Step ${stepIndex + 1} updated`);
  }

  /**
   * Delete a step
   */
  deleteStep(stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    const deleted = this.testCase.actions.splice(stepIndex, 1);
    console.log(`🗑️  Step ${stepIndex + 1} deleted: ${deleted[0].description}`);
  }

  /**
   * Enable/disable a step
   */
  toggleStep(stepIndex: number, enabled?: boolean): void {
    if (stepIndex < 0 || stepIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    const currentEnabled = this.testCase.actions[stepIndex].enabled !== false;
    this.testCase.actions[stepIndex].enabled = enabled !== undefined ? enabled : !currentEnabled;

    const status = this.testCase.actions[stepIndex].enabled ? 'enabled' : 'disabled';
    console.log(`✅ Step ${stepIndex + 1} ${status}`);
  }

  /**
   * Add loop to a step
   */
  addLoop(stepIndex: number, count: number, data?: any[]): void {
    if (stepIndex < 0 || stepIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    if (!this.testCase.actions[stepIndex].options) {
      this.testCase.actions[stepIndex].options = {};
    }

    this.testCase.actions[stepIndex].options!.loop = { count, data };
    console.log(`✅ Loop added to step ${stepIndex + 1}: ${count} iterations`);
  }

  /**
   * Add wait time to a step
   */
  addWait(stepIndex: number, waitBefore?: number, waitAfter?: number): void {
    if (stepIndex < 0 || stepIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    if (!this.testCase.actions[stepIndex].options) {
      this.testCase.actions[stepIndex].options = {};
    }

    if (waitBefore !== undefined) {
      this.testCase.actions[stepIndex].options!.waitBefore = waitBefore;
    }
    if (waitAfter !== undefined) {
      this.testCase.actions[stepIndex].options!.waitAfter = waitAfter;
    }

    console.log(`✅ Wait time added to step ${stepIndex + 1}`);
  }

  /**
   * Set continue on failure for a step
   */
  setContinueOnFailure(stepIndex: number, continueOnFailure: boolean): void {
    if (stepIndex < 0 || stepIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    if (!this.testCase.actions[stepIndex].options) {
      this.testCase.actions[stepIndex].options = {};
    }

    this.testCase.actions[stepIndex].options!.continueOnFailure = continueOnFailure;
    console.log(`✅ Step ${stepIndex + 1} will ${continueOnFailure ? 'CONTINUE' : 'STOP'} on failure`);
  }

  /**
   * Add validation to a step
   */
  addValidation(stepIndex: number, validation: TestStepOptions['validation']): void {
    if (stepIndex < 0 || stepIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    if (!this.testCase.actions[stepIndex].options) {
      this.testCase.actions[stepIndex].options = {};
    }

    this.testCase.actions[stepIndex].options!.validation = validation;
    console.log(`✅ Validation added to step ${stepIndex + 1}`);
  }

  /**
   * Set timeout for a step
   */
  setTimeout(stepIndex: number, timeout: number): void {
    if (stepIndex < 0 || stepIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    if (!this.testCase.actions[stepIndex].options) {
      this.testCase.actions[stepIndex].options = {};
    }

    this.testCase.actions[stepIndex].options!.timeout = timeout;
    console.log(`✅ Timeout set for step ${stepIndex + 1}: ${timeout}ms`);
  }

  /**
   * Set retry count for a step
   */
  setRetries(stepIndex: number, retries: number): void {
    if (stepIndex < 0 || stepIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    if (!this.testCase.actions[stepIndex].options) {
      this.testCase.actions[stepIndex].options = {};
    }

    this.testCase.actions[stepIndex].options!.retries = retries;
    console.log(`✅ Retry count set for step ${stepIndex + 1}: ${retries} retries`);
  }

  /**
   * Move a step to a new position
   */
  moveStep(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid from index: ${fromIndex}`);
    }
    if (toIndex < 0 || toIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid to index: ${toIndex}`);
    }

    const [step] = this.testCase.actions.splice(fromIndex, 1);
    this.testCase.actions.splice(toIndex, 0, step);

    console.log(`✅ Step moved from position ${fromIndex + 1} to ${toIndex + 1}`);
  }

  /**
   * Duplicate a step
   */
  duplicateStep(stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= this.testCase.actions.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    const original = this.testCase.actions[stepIndex];
    const duplicate = JSON.parse(JSON.stringify(original));
    duplicate.id = `${duplicate.id}-copy`;

    this.testCase.actions.splice(stepIndex + 1, 0, duplicate);
    console.log(`✅ Step ${stepIndex + 1} duplicated`);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const testFile = args[1];

  if (!testFile) {
    console.log(`
Test Editor - Edit recorded test cases

Usage:
  ts-node src/editor/testEditor.ts <command> <test-file> [options]

Commands:
  list <test-file>
    List all steps in the test case

  add <test-file> <description> <type> [value]
    Add a new step

  edit <test-file> <step-index> <field> <value>
    Edit a step field

  delete <test-file> <step-index>
    Delete a step

  disable <test-file> <step-index>
    Disable a step

  enable <test-file> <step-index>
    Enable a step

  loop <test-file> <step-index> <count>
    Add loop to a step

  wait <test-file> <step-index> <before-ms> [after-ms]
    Add wait time to a step

  continue-on-fail <test-file> <step-index> <true|false>
    Set continue on failure

  validate <test-file> <step-index> <type> <expected>
    Add validation to a step

  timeout <test-file> <step-index> <timeout-ms>
    Set timeout for a step

  retry <test-file> <step-index> <count>
    Set retry count for a step

Examples:
  ts-node src/editor/testEditor.ts list recordings/test.json
  ts-node src/editor/testEditor.ts loop recordings/test.json 2 5
  ts-node src/editor/testEditor.ts wait recordings/test.json 1 1000 500
  ts-node src/editor/testEditor.ts continue-on-fail recordings/test.json 3 true
    `);
    process.exit(0);
  }

  const editor = new TestEditor(testFile);

  switch (command) {
    case 'list':
      editor.listSteps();
      break;

    case 'delete':
      const deleteIndex = parseInt(args[2]) - 1;
      editor.deleteStep(deleteIndex);
      editor.save();
      break;

    case 'disable':
      const disableIndex = parseInt(args[2]) - 1;
      editor.toggleStep(disableIndex, false);
      editor.save();
      break;

    case 'enable':
      const enableIndex = parseInt(args[2]) - 1;
      editor.toggleStep(enableIndex, true);
      editor.save();
      break;

    case 'loop':
      const loopIndex = parseInt(args[2]) - 1;
      const loopCount = parseInt(args[3]);
      editor.addLoop(loopIndex, loopCount);
      editor.save();
      break;

    case 'wait':
      const waitIndex = parseInt(args[2]) - 1;
      const waitBefore = parseInt(args[3]);
      const waitAfter = args[4] ? parseInt(args[4]) : undefined;
      editor.addWait(waitIndex, waitBefore, waitAfter);
      editor.save();
      break;

    case 'continue-on-fail':
      const continueIndex = parseInt(args[2]) - 1;
      const continueValue = args[3] === 'true';
      editor.setContinueOnFailure(continueIndex, continueValue);
      editor.save();
      break;

    case 'timeout':
      const timeoutIndex = parseInt(args[2]) - 1;
      const timeoutValue = parseInt(args[3]);
      editor.setTimeout(timeoutIndex, timeoutValue);
      editor.save();
      break;

    case 'retry':
      const retryIndex = parseInt(args[2]) - 1;
      const retryCount = parseInt(args[3]);
      editor.setRetries(retryIndex, retryCount);
      editor.save();
      break;

    default:
      console.log(`Unknown command: ${command}`);
  }
}
