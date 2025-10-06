import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { TestAction, TestCase, ActionType, PlatformType, WebRecorderConfig, ElementLocator } from '../../types';
import * as fs from 'fs';
import * as path from 'path';

interface ObjectRepositoryItem {
  id: string;
  name: string;
  tagName: string;
  attributes: { [key: string]: string };
  selectors: {
    id?: string;
    name?: string;
    class?: string;
    xpath?: string;
    css?: string;
  };
  capturedAt: number;
}

export class WebRecorder {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private actions: TestAction[] = [];
  private config: WebRecorderConfig;
  private recording: boolean = false;
  private testCaseId: string;
  private objectRepository: Map<string, ObjectRepositoryItem> = new Map();

  constructor(config: WebRecorderConfig) {
    this.config = {
      screenshotOnAction: true,
      highlightElements: true,
      captureNetwork: false,
      browser: 'chromium',
      headless: false,
      ...config
    };

    // Use testName for filename if provided, otherwise use UUID
    if (config.testName) {
      // Sanitize test name for filename
      this.testCaseId = config.testName.replace(/[^a-zA-Z0-9-_]/g, '-');
    } else {
      this.testCaseId = uuidv4();
    }
  }

  async start(url?: string): Promise<void> {
    console.log('🎬 Starting Web Recorder...');

    // Check if browser is already open (from previous recording)
    const browserAlreadyOpen = this.browser !== null && this.page !== null;

    if (browserAlreadyOpen) {
      console.log('✨ Browser already open - reusing existing session');

      // Get current URL
      const currentUrl = this.page!.url();
      const targetUrl = url || this.config.startUrl;

      // Only navigate if we need to go to a different URL
      if (targetUrl && currentUrl !== targetUrl) {
        console.log(`🔄 Navigating from ${currentUrl} to ${targetUrl}`);
        await this.page!.goto(targetUrl);
        await this.page!.waitForLoadState('domcontentloaded');

        this.addAction({
          type: ActionType.NAVIGATE,
          value: targetUrl,
          description: `Navigate to ${targetUrl}`
        });
      } else {
        console.log(`✅ Already at ${currentUrl} - continuing from current page`);
      }
    } else {
      // Browser not open - start fresh
      console.log('🌐 Opening new browser session');

      // Add "Start Browser" action as first step (like Ranorex)
      this.addAction({
        type: ActionType.CUSTOM,
        value: 'start_browser',
        description: '🌐 Start Browser - Open Chromium'
      });

      // Launch browser
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: ['--start-maximized']
      });

      this.context = await this.browser.newContext({
        viewport: null,
        recordVideo: this.config.outputPath ? {
          dir: path.join(this.config.outputPath, 'videos')
        } : undefined
      });

      this.page = await this.context.newPage();

      // Set up event listeners BEFORE any navigation
      await this.setupEventListeners();

      // Navigate to start URL if provided
      if (url || this.config.startUrl) {
        const targetUrl = url || this.config.startUrl!;
        await this.page.goto(targetUrl);

        // Wait for page to load
        await this.page.waitForLoadState('domcontentloaded');

        this.addAction({
          type: ActionType.NAVIGATE,
          value: targetUrl,
          description: `Navigate to ${targetUrl}`
        });
      }

      // Inject event listeners AFTER navigation (so page is loaded)
      await this.injectEventListeners();
    }

    this.recording = true;

    // Inject recorder script
    await this.injectRecorderScript();

    console.log('✅ Web Recorder started. Perform actions in the browser...');
    console.log('💡 Press Ctrl+C in terminal to stop recording');
  }

  private async injectRecorderScript(): Promise<void> {
    if (!this.page) return;

    await this.page.addInitScript(() => {
      // Check if already injected
      if (document.getElementById('qa-recorder-overlay')) {
        return;
      }

      // Inject recording UI overlay
      const overlay = document.createElement('div');
      overlay.id = 'qa-recorder-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #f44336, #e91e63);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 2147483647;
        box-shadow: 0 4px 15px rgba(244, 67, 54, 0.4);
        cursor: move;
        user-select: none;
        pointer-events: auto;
        backdrop-filter: blur(10px);
      `;
      overlay.innerHTML = '🔴 Recording...';

      // Make overlay draggable
      let isDragging = false;
      let currentX = 0;
      let currentY = 0;
      let initialX = 0;
      let initialY = 0;

      overlay.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDragging = true;
        initialX = e.clientX - currentX;
        initialY = e.clientY - currentY;
        overlay.style.cursor = 'grabbing';
      });

      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          e.preventDefault();
          e.stopPropagation();
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;

          overlay.style.right = 'auto';
          overlay.style.top = 'auto';
          overlay.style.left = currentX + 'px';
          overlay.style.top = currentY + 'px';
        }
      });

      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          overlay.style.cursor = 'move';
        }
      });

      // Append overlay
      const appendOverlay = () => {
        if (!document.getElementById('qa-recorder-overlay')) {
          document.body.appendChild(overlay);
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', appendOverlay);
      } else {
        appendOverlay();
      }

      // Highlight elements on hover (but not the overlay)
      let lastHighlighted: HTMLElement | null = null;
      document.addEventListener('mouseover', (e) => {
        const target = e.target as HTMLElement;
        if (target.id === 'qa-recorder-overlay' || target.closest('#qa-recorder-overlay')) return;

        if (lastHighlighted) {
          lastHighlighted.style.outline = '';
        }
        target.style.outline = '2px solid #4CAF50';
        lastHighlighted = target;
      }, true);
    });
  }

  private async setupEventListeners(): Promise<void> {
    if (!this.page) return;

    // Expose functions for recording - must be done before navigation
    await this.page.exposeFunction('recordClick', async (objectData: any) => {
      console.log(`🖱️ Click recorded: ${objectData.tagName} - ${objectData.text || objectData.selector}`);

      // Store object in repository
      const objectId = this.storeObject(objectData);

      await this.addAction({
        type: ActionType.CLICK,
        target: await this.createLocator(objectData.selector),
        description: `Click on ${objectData.tagName} "${objectData.text || objectData.selector}"`,
        objectId: objectId
      });
    });

    await this.page.exposeFunction('recordInput', async (objectData: any, value: string) => {
      console.log(`⌨️ Input recorded: ${value} into ${objectData.selector}`);

      // Store object in repository
      const objectId = this.storeObject(objectData);

      await this.addAction({
        type: ActionType.TYPE,
        target: await this.createLocator(objectData.selector),
        value: value,
        description: `Type "${value}" into ${objectData.name || objectData.selector}"`,
        objectId: objectId
      });
    });

    // Listen for navigation
    this.page.on('framenavigated', async (frame) => {
      if (frame === this.page?.mainFrame()) {
        const url = frame.url();
        await this.addAction({
          type: ActionType.NAVIGATE,
          value: url,
          description: `Navigated to ${url}`
        });
      }
    });

    // Listen for new pages/tabs
    if (this.context) {
      this.context.on('page', async (newPage) => {
        const pages = this.context?.pages() || [];
        const pageIndex = pages.indexOf(newPage) + 1;

        console.log(`📑 New tab opened (#${pageIndex})`);
        await this.addAction({
          type: ActionType.NAVIGATE,
          value: '',
          description: `Switched to tab #${pageIndex} (New tab opened)`
        });

        // Switch tracking to the new page
        this.page = newPage;

        // Re-inject recorder overlay and event listeners
        await this.injectRecorderScript();
        await this.injectEventListeners();

        // Listen to this new page's navigation
        newPage.on('framenavigated', async (frame) => {
          if (frame === newPage.mainFrame()) {
            const url = frame.url();
            await this.addAction({
              type: ActionType.NAVIGATE,
              value: url,
              description: `Navigated to ${url} (Tab #${pageIndex})`
            });
          }
        });
      });
    }
  }

  private async injectEventListeners(): Promise<void> {
    if (!this.page) return;

    const listenerScript = `
      (function() {
        // Prevent double injection
        if (window._qaRecorderInjected) {
          console.log('⚠️ Recorder already injected, skipping...');
          return;
        }
        window._qaRecorderInjected = true;

        console.log('🎯 Injecting event listeners for recording...');
        console.log('🔍 Checking exposed functions:', typeof window.recordClick, typeof window.recordInput);

          // Helper function to capture full object data
          window.captureObjectData = function(element) {
            var attributes = {};
            for (var i = 0; i < element.attributes.length; i++) {
              var attr = element.attributes[i];
              attributes[attr.name] = attr.value;
            }

            var selector = '';
            // Try ID first
            if (element.id) selector = '#' + element.id;
            // Try name attribute
            else if (element.getAttribute('name')) selector = '[name="' + element.getAttribute('name') + '"]';
            // Try placeholder
            else if (element.getAttribute('placeholder')) selector = '[placeholder="' + element.getAttribute('placeholder') + '"]';
            // Try aria-label
            else if (element.getAttribute('aria-label')) selector = '[aria-label="' + element.getAttribute('aria-label') + '"]';
            // Try class
            else if (element.className && typeof element.className === 'string') {
              var classes = element.className.split(' ').filter(function(c) { return c && !c.startsWith('_'); }).slice(0, 2).join('.');
              if (classes) selector = element.tagName.toLowerCase() + '.' + classes;
              else selector = element.tagName.toLowerCase();
            }
            else selector = element.tagName.toLowerCase();

            return {
              id: element.id || null,
              name: element.getAttribute('name') || null,
              className: element.className || null,
              tagName: element.tagName.toLowerCase(),
              text: element.textContent ? element.textContent.trim().substring(0, 50) : '',
              value: element.value || null,
              placeholder: element.getAttribute('placeholder') || null,
              type: element.getAttribute('type') || null,
              selector: selector,
              attributes: attributes,
              xpath: null // Will be generated if needed
            };
          };

          // Click event listener
          document.addEventListener('click', function(e) {
            var target = e.target;
            if (target.id === 'qa-recorder-overlay' || target.closest('#qa-recorder-overlay')) return;

            var objectData = window.captureObjectData(target);

            console.log('📌 Click detected on: ' + objectData.tagName + ' - ' + objectData.text);
            console.log('   📦 Object - ID: ' + objectData.id + ', Name: ' + objectData.name + ', Class: ' + objectData.className);

            if (window.recordClick) {
              window.recordClick(objectData);
            } else {
              console.error('❌ recordClick function not available!');
            }
          }, true);

          // Input event listener with debouncing
          var inputTimeouts = {};
          document.addEventListener('input', function(e) {
            var target = e.target;
            var objectData = window.captureObjectData(target);

            // Clear existing timeout for this element
            if (inputTimeouts[objectData.selector]) {
              clearTimeout(inputTimeouts[objectData.selector]);
            }

            // Set new timeout to record after user stops typing
            inputTimeouts[objectData.selector] = setTimeout(function() {
              console.log('📌 Input detected: ' + target.value + ' into ' + (objectData.placeholder || objectData.name || objectData.selector));
              console.log('   📦 Object - ID: ' + objectData.id + ', Name: ' + objectData.name + ', Type: ' + objectData.type);
              if (window.recordInput && target.value) {
                window.recordInput(objectData, target.value);
              } else {
                console.error('❌ recordInput function not available!');
              }
            }, 1000); // Wait 1 second after user stops typing
          }, true);

        console.log('✅ Event listeners injected successfully!');
      })();
    `;

    try {
      // Inject on current page immediately
      await this.page.evaluate(listenerScript);

      // Also add to init script for future navigations
      await this.page.addInitScript(listenerScript);
    } catch (error) {
      console.error('❌ Error injecting event listeners:', error);
    }
  }

  private storeObject(objectData: any): string {
    // Generate unique identifier based on element attributes
    const uniqueKey = this.generateUniqueKey(objectData);

    // Check if object already exists
    for (const [existingId, existingObj] of this.objectRepository.entries()) {
      const existingKey = this.generateUniqueKeyFromObj(existingObj);
      if (existingKey === uniqueKey) {
        console.log(`📦 Object already exists: ${existingObj.name} (${existingId})`);
        return existingId;
      }
    }

    // Create new object
    const objectId = `obj_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const obj: ObjectRepositoryItem = {
      id: objectId,
      name: objectData.name || objectData.text || objectData.selector,
      tagName: objectData.tagName,
      attributes: objectData.attributes || {},
      selectors: {
        id: objectData.id,
        name: objectData.name,
        class: objectData.className,
        xpath: objectData.xpath || this.generateXPath(objectData),
        css: objectData.selector
      },
      capturedAt: Date.now()
    };

    this.objectRepository.set(objectId, obj);
    console.log(`📦 New object stored: ${obj.name} (${objectId})`);

    return objectId;
  }

  private generateUniqueKey(objectData: any): string {
    // Create unique identifier based on stable attributes
    const parts: string[] = [objectData.tagName];

    if (objectData.id) parts.push(`id:${objectData.id}`);
    if (objectData.name) parts.push(`name:${objectData.name}`);
    if (objectData.attributes?.placeholder) parts.push(`placeholder:${objectData.attributes.placeholder}`);
    if (objectData.attributes?.type) parts.push(`type:${objectData.attributes.type}`);

    return parts.join('|');
  }

  private generateUniqueKeyFromObj(obj: ObjectRepositoryItem): string {
    const parts: string[] = [obj.tagName];

    if (obj.selectors.id) parts.push(`id:${obj.selectors.id}`);
    if (obj.selectors.name) parts.push(`name:${obj.selectors.name}`);
    if (obj.attributes.placeholder) parts.push(`placeholder:${obj.attributes.placeholder}`);
    if (obj.attributes.type) parts.push(`type:${obj.attributes.type}`);

    return parts.join('|');
  }

  private generateXPath(objectData: any): string {
    // Simple XPath generation
    let xpath = `//${objectData.tagName}`;

    if (objectData.id) {
      xpath = `//${objectData.tagName}[@id='${objectData.id}']`;
    } else if (objectData.name) {
      xpath = `//${objectData.tagName}[@name='${objectData.name}']`;
    } else if (objectData.attributes?.placeholder) {
      xpath = `//${objectData.tagName}[@placeholder='${objectData.attributes.placeholder}']`;
    } else if (objectData.className) {
      const firstClass = objectData.className.split(' ')[0];
      xpath = `//${objectData.tagName}[contains(@class,'${firstClass}')]`;
    }

    return xpath;
  }

  private async createLocator(selector: string): Promise<ElementLocator> {
    // Try to create multiple locator strategies for resilience
    return {
      type: 'css',
      value: selector,
      fallbacks: []
    };
  }

  private async addAction(actionData: Partial<TestAction>): Promise<void> {
    if (!this.recording) return;

    const action: TestAction = {
      id: uuidv4(),
      timestamp: Date.now(),
      platform: PlatformType.WEB,
      type: actionData.type!,
      target: actionData.target,
      value: actionData.value,
      description: actionData.description,
      metadata: {}
    };

    // Take screenshot if enabled
    if (this.config.screenshotOnAction && this.page) {
      const screenshotPath = path.join(
        this.config.outputPath,
        'screenshots',
        `${action.id}.png`
      );

      if (!fs.existsSync(path.dirname(screenshotPath))) {
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      }

      await this.page.screenshot({ path: screenshotPath });
      action.screenshot = screenshotPath;
    }

    this.actions.push(action);
    console.log(`📝 Action recorded: ${action.description}`);

    // Auto-save after each action
    await this.saveProgress();
  }

  private async saveProgress(): Promise<void> {
    const testCase: TestCase = {
      id: this.testCaseId,
      name: this.config.testName || 'Recorded Web Test',
      description: 'Test case recorded from web browser',
      platform: PlatformType.WEB,
      actions: this.actions,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const testCasePath = path.join(this.config.outputPath, `${this.testCaseId}.json`);
    fs.writeFileSync(testCasePath, JSON.stringify(testCase, null, 2));
  }

  async stop(): Promise<TestCase> {
    console.log('⏹️  Stopping Web Recorder...');
    this.recording = false;

    // Remove recording overlay from page
    if (this.page) {
      try {
        await this.page.evaluate(() => {
          const overlay = document.getElementById('qa-recorder-overlay');
          if (overlay) {
            overlay.remove();
          }
        });
        console.log('🗑️  Recording overlay removed');
      } catch (error) {
        console.error('Error removing overlay:', error);
      }
    }

    // Add "Close Browser" action as last step (like Ranorex)
    this.addAction({
      type: ActionType.CUSTOM,
      value: 'close_browser',
      description: '🔴 End Test Suite - Close Browser'
    });

    const testCase: TestCase = {
      id: this.testCaseId,
      name: this.config.testName || 'Recorded Web Test',
      description: 'Test case recorded from web browser',
      platform: PlatformType.WEB,
      actions: this.actions,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Save test case to file
    const testCasePath = path.join(this.config.outputPath, `${this.testCaseId}.json`);
    fs.writeFileSync(testCasePath, JSON.stringify(testCase, null, 2));

    // Save object repository
    const objectsDir = path.join(path.dirname(this.config.outputPath), 'objects');
    if (!fs.existsSync(objectsDir)) {
      fs.mkdirSync(objectsDir, { recursive: true });
    }

    const objectRepoPath = path.join(objectsDir, 'object-repository.json');
    const objectsArray = Array.from(this.objectRepository.values());
    fs.writeFileSync(objectRepoPath, JSON.stringify(objectsArray, null, 2));

    console.log(`✅ Test case saved: ${testCasePath}`);
    console.log(`📊 Total actions recorded: ${this.actions.length}`);
    console.log(`📦 Objects captured: ${objectsArray.length}`);
    console.log(`💾 Object repository saved: ${objectRepoPath}`);
    console.log('🌐 Browser kept open for next recording');

    // Reset for next recording (but keep browser, context, and page open)
    this.actions = [];
    this.testCaseId = `test-${Date.now()}`;
    this.objectRepository.clear();

    return testCase;
  }

  async restartRecording(newTestName: string): Promise<void> {
    console.log(`🔄 Restarting recording with test name: ${newTestName}`);

    // Update config with new test name
    this.config.testName = newTestName;
    this.testCaseId = `test-${Date.now()}`;
    this.recording = true;

    // Re-inject recording overlay
    if (this.page) {
      await this.injectRecorderScript();
      console.log('✅ Recording restarted. Perform actions in the browser...');
    }
  }

  async addAssertion(selector: string, property: string, expectedValue: any): Promise<void> {
    await this.addAction({
      type: ActionType.ASSERT,
      target: await this.createLocator(selector),
      value: { property, expectedValue },
      description: `Assert ${selector}.${property} equals ${expectedValue}`
    });
  }

  async addWait(milliseconds: number): Promise<void> {
    await this.addAction({
      type: ActionType.WAIT,
      value: milliseconds,
      description: `Wait for ${milliseconds}ms`
    });
  }
}

// CLI usage
if (require.main === module) {
  const recorder = new WebRecorder({
    platform: PlatformType.WEB,
    outputPath: path.join(process.cwd(), 'recordings'),
    startUrl: process.argv[2] || 'https://example.com'
  });

  recorder.start().catch(console.error);

  process.on('SIGINT', async () => {
    await recorder.stop();
    process.exit(0);
  });
}
