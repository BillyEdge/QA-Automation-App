import { chromium, Browser as PlaywrightBrowser } from 'playwright';
import { remote } from 'webdriverio';
import type { Browser } from 'webdriverio';
import { mouse, keyboard, screen } from '@nut-tree-fork/nut-js';
import { ExecutionResult, StepResult, ActionType, PlatformType } from '../types';
import { EnhancedTestCase, EnhancedTestAction } from '../editor/testEditor';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface ExecutionLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  message: string;
  stepIndex?: number;
  iteration?: number;
}

export interface EnhancedStepResult extends StepResult {
  retries?: number;
  iterations?: number;
  logs?: ExecutionLog[];
  validationResult?: {
    passed: boolean;
    expected: any;
    actual: any;
  };
  skipped?: boolean;
  continueOnFailure?: boolean;
}

export interface EnhancedExecutionResult extends Omit<ExecutionResult, 'steps' | 'logs'> {
  steps: EnhancedStepResult[];
  logs: ExecutionLog[];
}

export class EnhancedTestExecutor {
  private webBrowser: PlaywrightBrowser | null = null;
  private mobileBrowser: Browser | null = null;
  private results: EnhancedExecutionResult[] = [];
  private currentLogs: ExecutionLog[] = [];

  private log(level: ExecutionLog['level'], message: string, stepIndex?: number, iteration?: number): void {
    const log: ExecutionLog = {
      timestamp: Date.now(),
      level,
      message,
      stepIndex,
      iteration
    };

    this.currentLogs.push(log);

    // Color-coded console output
    const prefix = stepIndex !== undefined ? `[Step ${stepIndex + 1}]` : '[Executor]';
    const iterationStr = iteration !== undefined ? ` [Iteration ${iteration + 1}]` : '';

    switch (level) {
      case 'success':
        console.log(chalk.green(`✓ ${prefix}${iterationStr} ${message}`));
        break;
      case 'error':
        console.log(chalk.red(`✗ ${prefix}${iterationStr} ${message}`));
        break;
      case 'warn':
        console.log(chalk.yellow(`⚠ ${prefix}${iterationStr} ${message}`));
        break;
      case 'info':
        console.log(chalk.blue(`ℹ ${prefix}${iterationStr} ${message}`));
        break;
      case 'debug':
        console.log(chalk.gray(`⚙ ${prefix}${iterationStr} ${message}`));
        break;
    }
  }

  async executeTestCase(testCase: EnhancedTestCase): Promise<EnhancedExecutionResult> {
    this.currentLogs = [];

    console.log(chalk.bold.cyan(`\n${'='.repeat(70)}`));
    console.log(chalk.bold.cyan(`🚀 Executing Test Case: ${testCase.name}`));
    console.log(chalk.cyan(`📝 Description: ${testCase.description}`));
    console.log(chalk.cyan(`🔧 Platform: ${testCase.platform.toUpperCase()}`));
    console.log(chalk.cyan(`📊 Total Steps: ${testCase.actions.length}`));
    console.log(chalk.bold.cyan(`${'='.repeat(70)}\n`));

    const startTime = Date.now();
    const stepResults: EnhancedStepResult[] = [];
    let hasError = false;
    let errorMessage = '';

    try {
      await this.initializePlatform(testCase.platform);

      for (let i = 0; i < testCase.actions.length; i++) {
        const action = testCase.actions[i];

        // Skip disabled steps
        if (action.enabled === false) {
          this.log('warn', `Skipped (disabled)`, i);
          stepResults.push({
            actionId: action.id,
            status: 'skipped',
            duration: 0,
            skipped: true
          });
          continue;
        }

        console.log(chalk.bold(`\n⚡ Step ${i + 1}/${testCase.actions.length}: ${action.description}`));

        const stepStartTime = Date.now();
        let stepStatus: 'passed' | 'failed' | 'skipped' = 'passed';
        let stepError: string | undefined;
        let stepLogs: ExecutionLog[] = [];
        let retryCount = 0;
        let iterationCount = 1;
        let validationResult;

        try {
          // Wait before
          if (action.options?.waitBefore) {
            this.log('info', `Waiting ${action.options.waitBefore}ms before execution...`, i);
            await new Promise(resolve => setTimeout(resolve, action.options.waitBefore));
          }

          // Handle loops
          if (action.options?.loop?.count) {
            iterationCount = action.options.loop.count;
            this.log('info', `Executing ${iterationCount} iterations`, i);

            for (let iteration = 0; iteration < iterationCount; iteration++) {
              this.log('debug', `Iteration ${iteration + 1}/${iterationCount}`, i, iteration);

              await this.executeActionWithRetry(action, testCase.platform, i, iteration);

              if (iteration < iterationCount - 1 && action.options.waitAfter) {
                await new Promise(resolve => setTimeout(resolve, action.options.waitAfter || 0));
              }
            }
          } else {
            // Execute once
            await this.executeActionWithRetry(action, testCase.platform, i);
          }

          // Wait after
          if (action.options?.waitAfter) {
            this.log('info', `Waiting ${action.options.waitAfter}ms after execution...`, i);
            await new Promise(resolve => setTimeout(resolve, action.options.waitAfter));
          }

          // Validation
          if (action.options?.validation) {
            validationResult = await this.validateStep(action, testCase.platform, i);
            if (!validationResult.passed) {
              throw new Error(`Validation failed: Expected ${validationResult.expected}, got ${validationResult.actual}`);
            }
          }

          this.log('success', `Completed (${Date.now() - stepStartTime}ms)`, i);

        } catch (error: any) {
          stepStatus = 'failed';
          stepError = error.message;
          retryCount = action.options?.retries || 0;

          if (action.options?.continueOnFailure) {
            this.log('warn', `Failed but continuing: ${error.message}`, i);
          } else {
            this.log('error', `Failed: ${error.message}`, i);
            hasError = true;
            errorMessage = `Step ${i + 1} failed: ${error.message}`;
          }
        }

        stepResults.push({
          actionId: action.id,
          status: stepStatus,
          duration: Date.now() - stepStartTime,
          error: stepError,
          retries: retryCount,
          iterations: iterationCount,
          logs: stepLogs,
          validationResult,
          continueOnFailure: action.options?.continueOnFailure
        });

        if (hasError && !action.options?.continueOnFailure) {
          break; // Stop execution unless continueOnFailure is set
        }
      }
    } catch (error: any) {
      hasError = true;
      errorMessage = `Platform initialization failed: ${error.message}`;
      this.log('error', errorMessage);
    } finally {
      await this.cleanup(testCase.platform);
    }

    const endTime = Date.now();
    const result: EnhancedExecutionResult = {
      testCaseId: testCase.id,
      status: hasError ? 'failed' : 'passed',
      startTime,
      endTime,
      duration: endTime - startTime,
      steps: stepResults,
      error: hasError ? errorMessage : undefined,
      logs: this.currentLogs
    };

    this.results.push(result);

    // Print summary
    console.log(chalk.bold.cyan(`\n${'='.repeat(70)}`));
    console.log(chalk.bold(`📋 Execution Summary:`));
    console.log(`   Status: ${result.status === 'passed' ? chalk.green('PASSED ✓') : chalk.red('FAILED ✗')}`);
    console.log(`   Duration: ${chalk.yellow(result.duration + 'ms')}`);
    console.log(`   Passed Steps: ${chalk.green(stepResults.filter(s => s.status === 'passed').length)}/${stepResults.length}`);
    console.log(`   Failed Steps: ${chalk.red(stepResults.filter(s => s.status === 'failed').length)}/${stepResults.length}`);
    console.log(`   Skipped Steps: ${chalk.yellow(stepResults.filter(s => s.status === 'skipped').length)}/${stepResults.length}`);
    if (hasError) {
      console.log(`   Error: ${chalk.red(errorMessage)}`);
    }
    console.log(chalk.bold.cyan(`${'='.repeat(70)}\n`));

    return result;
  }

  private async executeActionWithRetry(
    action: EnhancedTestAction,
    platform: PlatformType,
    stepIndex: number,
    iteration?: number
  ): Promise<void> {
    const maxRetries = action.options?.retries || 0;
    const timeout = action.options?.timeout || 30000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.log('info', `Retry attempt ${attempt}/${maxRetries}`, stepIndex, iteration);
        }

        // Execute with timeout
        await Promise.race([
          this.executeAction(action, platform),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
          )
        ]);

        return; // Success
      } catch (error: any) {
        if (attempt < maxRetries) {
          this.log('warn', `Attempt ${attempt + 1} failed, retrying...`, stepIndex, iteration);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
        } else {
          throw error; // All retries exhausted
        }
      }
    }
  }

  private async validateStep(
    action: EnhancedTestAction,
    platform: PlatformType,
    stepIndex: number
  ): Promise<{ passed: boolean; expected: any; actual: any }> {
    const validation = action.options?.validation;
    if (!validation) {
      return { passed: true, expected: null, actual: null };
    }

    this.log('info', `Validating: ${validation.type}`, stepIndex);

    let actualValue: any;

    // Get actual value based on platform
    if (platform === PlatformType.WEB && this.webBrowser) {
      const context = this.webBrowser.contexts()[0];
      const page = context?.pages()[0];
      if (page && validation.actual) {
        const element = await page.locator(validation.actual);
        actualValue = await element.textContent();
      }
    }

    // Perform validation
    let passed = false;

    switch (validation.type) {
      case 'equals':
        passed = actualValue === validation.expected;
        break;
      case 'contains':
        passed = actualValue?.includes(validation.expected);
        break;
      case 'regex':
        passed = new RegExp(validation.expected).test(actualValue);
        break;
      case 'exists':
        passed = actualValue !== null && actualValue !== undefined;
        break;
      case 'notExists':
        passed = actualValue === null || actualValue === undefined;
        break;
    }

    this.log(
      passed ? 'success' : 'error',
      `Validation ${passed ? 'passed' : 'failed'}`,
      stepIndex
    );

    return {
      passed,
      expected: validation.expected,
      actual: actualValue
    };
  }

  private async initializePlatform(platform: PlatformType): Promise<void> {
    switch (platform) {
      case PlatformType.WEB:
        this.webBrowser = await chromium.launch({ headless: false });
        break;
      case PlatformType.MOBILE:
        // Mobile driver initialization
        break;
      case PlatformType.DESKTOP:
        // Desktop automation doesn't need initialization
        break;
    }
  }

  private async executeAction(action: EnhancedTestAction, platform: PlatformType): Promise<void> {
    switch (platform) {
      case PlatformType.WEB:
        await this.executeWebAction(action);
        break;
      case PlatformType.DESKTOP:
        await this.executeDesktopAction(action);
        break;
      case PlatformType.MOBILE:
        await this.executeMobileAction(action);
        break;
    }
  }

  private async executeWebAction(action: EnhancedTestAction): Promise<void> {
    if (!this.webBrowser) throw new Error('Web browser not initialized');

    const context = this.webBrowser.contexts()[0] || await this.webBrowser.newContext();
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    switch (action.type) {
      case ActionType.NAVIGATE:
        await page.goto(action.value);
        break;
      case ActionType.CLICK:
        if (action.target) {
          await page.locator(action.target.value).click();
        }
        break;
      case ActionType.TYPE:
        if (action.target) {
          await page.locator(action.target.value).fill(action.value);
        }
        break;
      case ActionType.WAIT:
        await page.waitForTimeout(action.value);
        break;
      case ActionType.ASSERT:
        if (action.target && action.value) {
          const element = await page.locator(action.target.value);
          const actualValue = await element.textContent();
          if (actualValue !== action.value.expectedValue) {
            throw new Error(`Assertion failed: expected "${action.value.expectedValue}", got "${actualValue}"`);
          }
        }
        break;
      default:
        console.warn(`Unsupported web action type: ${action.type}`);
    }
  }

  private async executeDesktopAction(action: EnhancedTestAction): Promise<void> {
    switch (action.type) {
      case ActionType.CLICK:
        if (action.target?.type === 'coordinates') {
          const coords = JSON.parse(action.target.value);
          await mouse.setPosition({ x: coords.x, y: coords.y });
          await mouse.click(0);
        }
        break;
      case ActionType.TYPE:
        await keyboard.type(action.value);
        break;
      case ActionType.WAIT:
        await new Promise(resolve => setTimeout(resolve, action.value));
        break;
      default:
        console.warn(`Unsupported desktop action type: ${action.type}`);
    }
  }

  private async executeMobileAction(action: EnhancedTestAction): Promise<void> {
    // Similar to original executor
  }

  private async cleanup(platform: PlatformType): Promise<void> {
    switch (platform) {
      case PlatformType.WEB:
        if (this.webBrowser) {
          await this.webBrowser.close();
          this.webBrowser = null;
        }
        break;
    }
  }

  async executeFromFile(testCaseFilePath: string): Promise<EnhancedExecutionResult> {
    const testCaseJson = fs.readFileSync(testCaseFilePath, 'utf-8');
    const testCase: EnhancedTestCase = JSON.parse(testCaseJson);
    return await this.executeTestCase(testCase);
  }

  saveExecutionLogs(outputPath: string): void {
    fs.writeFileSync(outputPath, JSON.stringify(this.currentLogs, null, 2));
    console.log(`📝 Execution logs saved: ${outputPath}`);
  }
}
