import { chromium, Browser as PlaywrightBrowser } from 'playwright';
import { remote } from 'webdriverio';
import type { Browser } from 'webdriverio';
import { mouse, keyboard, screen } from '@nut-tree-fork/nut-js';
import { TestCase, TestAction, ExecutionResult, StepResult, ActionType, PlatformType } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class TestExecutor {
  private webBrowser: PlaywrightBrowser | null = null;
  private mobileBrowser: Browser | null = null;
  private results: ExecutionResult[] = [];

  async executeTestCase(testCase: TestCase): Promise<ExecutionResult> {
    console.log(`\n🚀 Executing Test Case: ${testCase.name}`);
    console.log(`📝 Description: ${testCase.description}`);
    console.log(`🔧 Platform: ${testCase.platform.toUpperCase()}`);
    console.log(`📊 Total Steps: ${testCase.actions.length}\n`);

    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    let hasError = false;
    let errorMessage = '';

    // Initialize platform-specific driver
    try {
      await this.initializePlatform(testCase.platform);

      // Execute each action
      for (let i = 0; i < testCase.actions.length; i++) {
        const action = testCase.actions[i];
        console.log(`⚡ Step ${i + 1}/${testCase.actions.length}: ${action.description}`);

        const stepStartTime = Date.now();
        let stepStatus: 'passed' | 'failed' | 'skipped' = 'passed';
        let stepError: string | undefined;

        try {
          await this.executeAction(action, testCase.platform);
          console.log(`   ✅ Passed (${Date.now() - stepStartTime}ms)`);
        } catch (error: any) {
          stepStatus = 'failed';
          stepError = error.message;
          hasError = true;
          errorMessage = `Step ${i + 1} failed: ${error.message}`;
          console.log(`   ❌ Failed: ${error.message}`);
        }

        stepResults.push({
          actionId: action.id,
          status: stepStatus,
          duration: Date.now() - stepStartTime,
          error: stepError
        });

        if (hasError) break; // Stop execution on first error
      }
    } catch (error: any) {
      hasError = true;
      errorMessage = `Platform initialization failed: ${error.message}`;
      console.error(`❌ ${errorMessage}`);
    } finally {
      await this.cleanup(testCase.platform);
    }

    const endTime = Date.now();
    const result: ExecutionResult = {
      testCaseId: testCase.id,
      status: hasError ? 'failed' : 'passed',
      startTime,
      endTime,
      duration: endTime - startTime,
      steps: stepResults,
      error: hasError ? errorMessage : undefined
    };

    this.results.push(result);

    console.log(`\n📋 Execution Summary:`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Passed Steps: ${stepResults.filter(s => s.status === 'passed').length}/${stepResults.length}`);
    if (hasError) {
      console.log(`   Error: ${errorMessage}`);
    }

    return result;
  }

  private async initializePlatform(platform: PlatformType): Promise<void> {
    switch (platform) {
      case PlatformType.WEB:
        // Don't launch browser here - wait for "start_browser" action
        // This allows tests to run in an already-open browser
        console.log('   📌 Web platform initialized (browser will open via start_browser action)');
        break;
      case PlatformType.MOBILE:
        // Mobile driver initialization would happen here
        break;
      case PlatformType.DESKTOP:
        // Desktop automation doesn't need initialization
        break;
    }
  }

  private async executeAction(action: TestAction, platform: PlatformType): Promise<void> {
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

  private async executeWebAction(action: TestAction): Promise<void> {
    // Handle CUSTOM actions (start_browser, close_browser)
    if (action.type === ActionType.CUSTOM) {
      if (action.value === 'start_browser') {
        if (!this.webBrowser) {
          console.log('   🌐 Starting browser...');
          this.webBrowser = await chromium.launch({
            headless: false,
            args: ['--start-maximized']
          });
        } else {
          console.log('   ✨ Browser already open - reusing existing session');
        }
        return;
      } else if (action.value === 'close_browser') {
        console.log('   🔴 Closing browser...');
        if (this.webBrowser) {
          await this.webBrowser.close();
          this.webBrowser = null;
        }
        return;
      }
    }

    if (!this.webBrowser) throw new Error('Web browser not initialized');

    const context = this.webBrowser.contexts()[0] || await this.webBrowser.newContext();
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    switch (action.type) {
      case ActionType.NAVIGATE:
        const currentUrl = page.url();
        if (currentUrl === action.value) {
          console.log(`   ✅ Already at ${currentUrl} - skipping navigation`);
        } else {
          console.log(`   🔄 Navigating to ${action.value}`);
          await page.goto(action.value);
        }
        break;

      case ActionType.CLICK:
        if (action.target) {
          const element = await page.locator(action.target.value);
          await element.click();
        }
        break;

      case ActionType.TYPE:
        if (action.target) {
          const element = await page.locator(action.target.value);
          await element.fill(action.value);
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

      case ActionType.SCREENSHOT:
        await page.screenshot({ path: `screenshot-${Date.now()}.png` });
        break;

      case ActionType.HOVER:
        if (action.target) {
          const element = await page.locator(action.target.value);
          await element.hover();
        }
        break;

      case ActionType.SELECT:
        if (action.target) {
          const element = await page.locator(action.target.value);
          await element.selectOption(action.value);
        }
        break;

      default:
        console.warn(`Unsupported web action type: ${action.type}`);
    }
  }

  private async executeDesktopAction(action: TestAction): Promise<void> {
    switch (action.type) {
      case ActionType.CLICK:
        if (action.target?.type === 'coordinates') {
          const coords = JSON.parse(action.target.value);
          await mouse.setPosition({ x: coords.x, y: coords.y });
          await mouse.click(0); // 0 for left button
        }
        break;

      case ActionType.TYPE:
        await keyboard.type(action.value);
        break;

      case ActionType.PRESS_KEY:
        // Key mapping would be needed here
        await keyboard.type(action.value);
        break;

      case ActionType.WAIT:
        await new Promise(resolve => setTimeout(resolve, action.value));
        break;

      case ActionType.DRAG_DROP:
        if (action.target?.type === 'coordinates') {
          const from = JSON.parse(action.target.value);
          const to = action.value;
          await mouse.setPosition({ x: from.x, y: from.y });
          await mouse.pressButton(0);
          await mouse.setPosition({ x: to.toX, y: to.toY });
          await mouse.releaseButton(0);
        }
        break;

      case ActionType.SCREENSHOT:
        const screenshot = await screen.grab();
        // Save screenshot logic here
        break;

      default:
        console.warn(`Unsupported desktop action type: ${action.type}`);
    }
  }

  private async executeMobileAction(action: TestAction): Promise<void> {
    if (!this.mobileBrowser) throw new Error('Mobile driver not initialized');

    switch (action.type) {
      case ActionType.TAP:
        if (action.target?.type === 'coordinates') {
          const coords = JSON.parse(action.target.value);
          await this.mobileBrowser.touchAction({
            action: 'tap',
            x: coords.x,
            y: coords.y
          });
        } else if (action.target) {
          const element = await this.mobileBrowser.$(action.target.value);
          await element.click();
        }
        break;

      case ActionType.TYPE:
        if (action.target) {
          const element = await this.mobileBrowser.$(action.target.value);
          await element.setValue(action.value);
        }
        break;

      case ActionType.SWIPE:
        if (action.target?.type === 'coordinates') {
          const from = JSON.parse(action.target.value);
          const to = action.value;
          await this.mobileBrowser.touchAction([
            { action: 'press', x: from.x, y: from.y },
            { action: 'wait', ms: to.duration || 1000 },
            { action: 'moveTo', x: to.endX, y: to.endY },
            { action: 'release' }
          ]);
        }
        break;

      case ActionType.WAIT:
        await new Promise(resolve => setTimeout(resolve, action.value));
        break;

      default:
        console.warn(`Unsupported mobile action type: ${action.type}`);
    }
  }

  private async cleanup(platform: PlatformType): Promise<void> {
    switch (platform) {
      case PlatformType.WEB:
        // Don't close browser here - only "close_browser" action should do that
        // This allows browser to stay open between test runs
        console.log('   🌐 Keeping browser open for reuse');
        break;
      case PlatformType.MOBILE:
        if (this.mobileBrowser) {
          await this.mobileBrowser.deleteSession();
          this.mobileBrowser = null;
        }
        break;
    }
  }

  async executeFromFile(testCaseFilePath: string, loopCount: number = 1): Promise<ExecutionResult> {
    const testCaseJson = fs.readFileSync(testCaseFilePath, 'utf-8');
    const testCase: TestCase = JSON.parse(testCaseJson);

    if (loopCount > 1) {
      console.log(`\n🔁 Looping test case ${loopCount} times`);
    }

    let lastResult: ExecutionResult | null = null;

    for (let loop = 0; loop < loopCount; loop++) {
      if (loopCount > 1) {
        console.log(`\n${'─'.repeat(40)}`);
        console.log(`🔄 Test Loop ${loop + 1}/${loopCount}`);
        console.log(`${'─'.repeat(40)}\n`);
      }

      lastResult = await this.executeTestCase(testCase);

      // Stop looping if test fails
      if (lastResult.status === 'failed') {
        console.log(`\n⚠️ Test failed on loop ${loop + 1}. Stopping execution.`);
        break;
      }
    }

    return lastResult!;
  }

  async executeBatch(testCaseFilePaths: string[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const filePath of testCaseFilePaths) {
      const result = await this.executeFromFile(filePath);
      results.push(result);
    }

    return results;
  }

  getResults(): ExecutionResult[] {
    return this.results;
  }

  generateReport(outputPath: string): void {
    const report = {
      summary: {
        totalTests: this.results.length,
        passed: this.results.filter(r => r.status === 'passed').length,
        failed: this.results.filter(r => r.status === 'failed').length,
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0)
      },
      results: this.results
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 Report generated: ${outputPath}`);
  }
}

// CLI usage
if (require.main === module) {
  const testCaseFile = process.argv[2];

  if (!testCaseFile) {
    console.error('Usage: ts-node testExecutor.ts <test-case-file.json>');
    process.exit(1);
  }

  const executor = new TestExecutor();
  executor.executeFromFile(testCaseFile)
    .then(result => {
      executor.generateReport(path.join(process.cwd(), 'test-report.json'));
      process.exit(result.status === 'passed' ? 0 : 1);
    })
    .catch(error => {
      console.error('Execution failed:', error);
      process.exit(1);
    });
}
