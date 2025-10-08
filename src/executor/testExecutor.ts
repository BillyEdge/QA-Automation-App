import { chromium, Browser as PlaywrightBrowser } from 'playwright';
import { remote } from 'webdriverio';
import type { Browser } from 'webdriverio';
import { mouse, keyboard, screen } from '@nut-tree-fork/nut-js';
import { TestCase, TestAction, ExecutionResult, StepResult, ActionType, PlatformType } from '../types';
import { browserManager } from '../browser/browserManager';
import * as fs from 'fs';
import * as path from 'path';

export class TestExecutor {
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
          error: stepError,
          action: action.type,
          object: action.target?.value || action.value || ''
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
      // Check value OR description for start_browser (backward compatibility)
      const isStartBrowser = action.value === 'start_browser' ||
                            action.description?.includes('Start Browser');

      if (isStartBrowser) {
        if (browserManager.isBrowserOpen()) {
          console.log('   ✨ Browser already open - reusing existing session');
        } else {
          console.log('   🌐 Starting browser...');
          await browserManager.getBrowser();
          await browserManager.getContext();
          await browserManager.getPage();
        }

        // If value is a URL (not "start_browser"), navigate to it
        if (action.value && action.value !== 'start_browser' && action.value.startsWith('http')) {
          console.log(`   🔄 Navigating to ${action.value}`);
          const page = await browserManager.getPage();
          if (page) {
            await page.goto(action.value);
            await page.waitForLoadState('domcontentloaded');
          }
        }

        return;
      } else if (action.value === 'close_browser') {
        await browserManager.closeBrowser();
        return;
      }
    }

    // Get page from browser manager
    const page = await browserManager.getPage();
    if (!page) {
      throw new Error('Web browser not initialized');
    }

    switch (action.type) {
      case ActionType.NAVIGATE:
        // Skip navigation if value is empty (tab switch marker)
        if (!action.value || action.value.trim() === '') {
          console.log(`   📑 Tab switch detected - skipping navigation`);
          break;
        }

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
          const locator = this.getLocator(page, action.target);
          await locator.click();
        }
        break;

      case ActionType.TYPE:
        if (action.target) {
          const locator = this.getLocator(page, action.target);
          await locator.fill(action.value);
        }
        break;

      case ActionType.WAIT:
        await page.waitForTimeout(parseInt(action.value));
        break;

      case ActionType.WAIT_FOR_ELEMENT:
        if (action.value) {
          console.log(`   ⏳ Waiting for element: ${action.value}`);
          await page.waitForSelector(action.value, {
            state: 'visible',
            timeout: 30000  // 30 second timeout
          });
        }
        break;

      case ActionType.ASSERT:
        if (action.target && action.value) {
          const locator = this.getLocator(page, action.target);
          const actualValue = await locator.textContent();
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
          const locator = this.getLocator(page, action.target);
          await locator.hover();
        }
        break;

      case ActionType.SELECT:
        if (action.target) {
          const locator = this.getLocator(page, action.target);
          await locator.selectOption(action.value);
        }
        break;

      default:
        console.warn(`Unsupported web action type: ${action.type}`);
    }
  }

  private getLocator(page: any, target: any) {
    // Prefer XPath for better text-based matching (dropdowns, menus, etc.)
    // Fallback to CSS selector if XPath fails
    if (target.type === 'xpath') {
      console.log(`   🎯 Using XPath locator: ${target.value}`);
      return page.locator(`xpath=${target.value}`);
    } else {
      console.log(`   🎯 Using CSS locator: ${target.value}`);
      return page.locator(target.value);
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
