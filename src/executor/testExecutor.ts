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
        console.log('   🌐 Ensuring browser is ready...');
        await browserManager.getBrowser();
        await browserManager.getContext();
        await browserManager.getPage();
        console.log('   ✅ Browser ready');

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

    // Remove recording overlay if it exists (executor should not show recording UI)
    try {
      await page.evaluate(() => {
        const overlay = document.getElementById('qa-recorder-overlay');
        if (overlay) {
          overlay.remove();
        }
      });
    } catch (e) {
      // Ignore errors (overlay might not exist)
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

          // Wait for page to load - use domcontentloaded for faster execution
          console.log(`   ⏳ Waiting for page to load...`);
          try {
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            console.log(`   ✅ Page loaded`);
          } catch (e) {
            console.log(`   ⚠️ Page load timeout, continuing...`);
          }

          // Brief wait for React to initialize (reduced from 8s total to 2s)
          await page.waitForTimeout(2000);
          console.log(`   ✅ Page ready for interaction`);
        }
        break;

      case ActionType.CLICK:
        if (action.target) {
          // Detect if this element is in a modal/dialog (common patterns: div[3], div[2] in body)
          const isInModal = action.target.value.includes('/body/div[3]') ||
                           action.target.value.includes('/body/div[2]') ||
                           action.target.value.includes('modal') ||
                           action.target.value.includes('dialog');

          if (isInModal) {
            console.log(`   🪟 Element in modal detected`);

            // Wait for page navigation/redirect to complete (if any)
            try {
              await page.waitForLoadState('domcontentloaded', { timeout: 3000 });
              console.log(`   ✅ Page loaded`);
            } catch (e) {
              console.log(`   ℹ️ Still loading, continuing...`);
            }
            // Note: Modal animations should be handled by explicit WAIT steps in test
          }

          let clicked = false;
          let lastError: any = null;

          // No hardcoded waits - all waits should be explicit WAIT steps in the test

          // Check for sidebar backdrop and dismiss it before clicking
          try {
            const sidebarBackdrop = page.locator('div.sidebar-backdrop');
            const backdropCount = await sidebarBackdrop.count();
            if (backdropCount > 0 && await sidebarBackdrop.first().isVisible()) {
              console.log(`   🚫 Sidebar backdrop detected - dismissing...`);
              // Click the backdrop to dismiss the sidebar
              await sidebarBackdrop.first().click({ force: true, timeout: 2000 });
              // Wait for backdrop to disappear
              await page.waitForTimeout(500);
              console.log(`   ✅ Sidebar dismissed`);
            }
          } catch (backdropError: any) {
            // Ignore backdrop errors - it might not exist
            console.log(`   ℹ️ No sidebar backdrop found (this is fine)`);
          }

          // Try XPath first
          try {
            const locator = this.getLocator(page, action.target);
            await locator.waitFor({ state: 'visible', timeout: 5000 });
            await locator.click({ timeout: 3000 });
            clicked = true;
          } catch (xpathError: any) {
            lastError = xpathError;
            console.log(`   ⚠️ XPath locator failed: ${xpathError.message}`);

            // Try CSS fallback if available
            if (action.target.fallbacks && action.target.fallbacks.length > 0) {
              for (const fallback of action.target.fallbacks) {
                if (fallback.type === 'css') {
                  try {
                    console.log(`   🔄 Trying CSS fallback: ${fallback.value}`);
                    let cssLocator = page.locator(fallback.value);

                    // If multiple matches, try to use XPath context to find the right one
                    const count = await cssLocator.count();
                    if (count > 1) {
                      console.log(`   ℹ️ Found ${count} elements, using context from XPath`);

                      // Extract table row index from XPath if it exists (e.g., tr[1], tr[2])
                      const rowMatch = action.target.value.match(/\/tr\[(\d+)\]/);
                      if (rowMatch) {
                        const rowIndex = parseInt(rowMatch[1]) - 1; // Convert to 0-based index
                        console.log(`   🎯 Targeting row ${rowIndex + 1} based on XPath`);

                        // Try to find input in the specific table row
                        cssLocator = page.locator(`tbody tr:nth-child(${rowIndex + 1}) ${fallback.value}`);
                      } else {
                        // No row context, just use first match
                        console.log(`   🎯 Using first match`);
                        cssLocator = cssLocator.first();
                      }
                    }

                    await cssLocator.waitFor({ state: 'visible', timeout: 5000 });
                    await cssLocator.click({ timeout: 3000 });
                    clicked = true;
                    console.log(`   ✅ CSS fallback succeeded`);
                    break;
                  } catch (cssError: any) {
                    lastError = cssError;
                    console.log(`   ⚠️ CSS fallback failed: ${cssError.message}`);
                  }
                }
              }
            }

            // Try text-based selector if description has quoted text (e.g., 'Click on div "Edge Cafe"')
            if (!clicked && action.description) {
              const textMatch = action.description.match(/[""]([^"""]+)[""]/) || action.description.match(/"([^"]+)"/);
              if (textMatch && textMatch[1]) {
                const textContent = textMatch[1];
                // Skip if it's a CSS selector (starts with . or #) or contains "btn" or "css-"
                if (!textContent.startsWith('.') && !textContent.startsWith('#') &&
                    !textContent.includes('btn') && !textContent.includes('css-')) {
                  try {
                    console.log(`   🔄 Trying text-based selector: "${textContent}"`);

                    // Try to find dropdown option specifically (to avoid matching table cells, etc.)
                    // Look for react-select options or role="option"
                    let textLocator = page.locator('[id*="react-select"][id*="option"]').filter({ hasText: textContent });

                    // If no react-select option found, try generic role="option"
                    if (await textLocator.count() === 0) {
                      textLocator = page.locator('[role="option"]').filter({ hasText: textContent });
                    }

                    // If still not found, fall back to generic text search
                    if (await textLocator.count() === 0) {
                      textLocator = page.getByText(textContent, { exact: true }).first();
                    }

                    await textLocator.waitFor({ state: 'visible', timeout: 5000 });
                    await textLocator.click({ timeout: 3000 });
                    clicked = true;
                    console.log(`   ✅ Text-based selector succeeded`);
                  } catch (textError: any) {
                    lastError = textError;
                    console.log(`   ⚠️ Text-based selector failed: ${textError.message}`);
                  }
                }
              }
            }
          }

          // If still not clicked, try force click as last resort
          if (!clicked) {
            const locator = this.getLocator(page, action.target);
            try {
              if (lastError.message.includes('intercepts pointer events')) {
                console.log(`   ⚠️ Element covered by overlay, using force click...`);
                await locator.click({ force: true });
              } else {
                console.log(`   ⚠️ Element not immediately available, waiting and force clicking...`);
                await page.waitForTimeout(3000);
                await locator.click({ force: true, timeout: 5000 });
              }
            } catch (finalError: any) {
              // Try CSS fallback with force click as absolute last resort
              if (action.target.fallbacks && action.target.fallbacks.length > 0) {
                for (const fallback of action.target.fallbacks) {
                  if (fallback.type === 'css') {
                    console.log(`   🔄 Final attempt with CSS fallback + force click`);
                    const cssLocator = page.locator(fallback.value);
                    await page.waitForTimeout(2000);
                    await cssLocator.click({ force: true, timeout: 5000 });
                    return;
                  }
                }
              }
              throw finalError;
            }
          }
        }
        break;

      case ActionType.TYPE:
        if (action.target) {
          try {
            const locator = this.getLocator(page, action.target);
            await locator.waitFor({ state: 'visible', timeout: 5000 });
            await locator.fill(action.value);
          } catch (xpathError: any) {
            console.log(`   ⚠️ XPath locator failed: ${xpathError.message}`);

            // Try CSS fallback if available
            if (action.target.fallbacks && action.target.fallbacks.length > 0) {
              for (const fallback of action.target.fallbacks) {
                if (fallback.type === 'css') {
                  console.log(`   🔄 Trying CSS fallback: ${fallback.value}`);
                  const cssLocator = page.locator(fallback.value);
                  await cssLocator.waitFor({ state: 'visible', timeout: 5000 });
                  await cssLocator.fill(action.value);
                  console.log(`   ✅ CSS fallback succeeded`);
                  return;
                }
              }
            }

            // Re-throw if no fallback worked
            throw xpathError;
          }
        }
        break;

      case ActionType.WAIT:
        await page.waitForTimeout(parseInt(action.value));
        break;

      case ActionType.WAIT_FOR_ELEMENT:
        if (action.value) {
          console.log(`   ⏳ Waiting for element: ${action.value}`);
          // Check if it's an XPath (starts with / or //)
          const isXPath = action.value.startsWith('/') || action.value.startsWith('//');
          const selector = isXPath ? `xpath=${action.value}` : action.value;
          console.log(`   🎯 Using ${isXPath ? 'XPath' : 'CSS'} locator: ${action.value}`);
          const locator = page.locator(selector);
          await locator.waitFor({
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

      case ActionType.PRESS_KEY:
        if (action.target) {
          // Focus on the target element first
          const locator = this.getLocator(page, action.target);
          await locator.focus();
        }
        // Press the key (e.g., 'Enter', 'Tab', 'Escape')
        await page.keyboard.press(action.value);
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

    // For web tests, ensure browser is on the correct URL before executing
    if (testCase.platform === PlatformType.WEB) {
      await this.ensureBrowserReady(testCaseFilePath);
    }

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

  private async ensureBrowserReady(testFilePath: string): Promise<void> {
    console.log('🔍 Checking browser state...');

    // Read suite config to get URL
    const testsDir = path.dirname(testFilePath);
    const suiteDir = path.dirname(testsDir);
    const suiteConfigPath = path.join(suiteDir, 'suite-config.json');

    if (!fs.existsSync(suiteConfigPath)) {
      console.log('⚠️ Suite config not found - cannot determine URL');
      return;
    }

    const suiteConfig = JSON.parse(fs.readFileSync(suiteConfigPath, 'utf-8'));
    const suiteUrl = suiteConfig.url || suiteConfig.path || suiteConfig.urlOrPath;

    if (!suiteUrl) {
      console.log('⚠️ No URL found in suite config');
      console.log(`   Checked fields: url, path, urlOrPath`);
      console.log(`   Config contents: ${JSON.stringify(suiteConfig, null, 2)}`);
      return;
    }

    console.log(`✅ Found suite URL: ${suiteUrl}`);

    // Get browser and check if it has pages
    const browser = await browserManager.getBrowser();
    const context = await browserManager.getContext();
    const pages = context.pages();

    if (pages.length === 0) {
      console.log(`📄 No pages found - creating new page and navigating to ${suiteUrl}`);
      const page = await context.newPage();
      await page.goto(suiteUrl, { waitUntil: 'networkidle' });
      console.log(`✅ Browser ready at ${suiteUrl}`);
    } else {
      const currentUrl = pages[0].url();
      console.log(`✅ Browser already has page open: ${currentUrl}`);

      // Extract domain from suite URL
      const suiteDomain = new URL(suiteUrl).origin; // e.g., "https://t1.equipweb.biz"

      // Navigate if:
      // 1. Page is blank (about:blank)
      // 2. Page is on a different domain than the suite
      const needsNavigation =
        currentUrl === 'about:blank' ||
        !currentUrl.startsWith('http') ||
        !currentUrl.startsWith(suiteDomain);

      if (needsNavigation) {
        console.log(`📍 Navigating to ${suiteUrl} (current: ${currentUrl})`);
        await pages[0].goto(suiteUrl, { waitUntil: 'networkidle' });
        console.log(`✅ Navigated to ${suiteUrl}`);
      } else {
        console.log(`💡 Staying on current page (same domain): ${currentUrl}`);
        console.log(`   Suite domain: ${suiteDomain}`);
      }
    }
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
