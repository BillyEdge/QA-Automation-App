import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { TestAction, TestCase, ActionType, PlatformType, WebRecorderConfig, ElementLocator } from '../../types';
import { browserManager } from '../../browser/browserManager';
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
  private page: Page | null = null;
  private actions: TestAction[] = [];
  private config: WebRecorderConfig;
  private recording: boolean = false;
  private testCaseId: string;
  private objectRepository: Map<string, ObjectRepositoryItem> = new Map();
  private lastNavigationTime: number = 0;
  private navigationDebounceMs: number = 500;

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
    console.log('═'.repeat(80));
    console.log('🎬 WEB RECORDER START');
    console.log(`📋 Test Case ID: ${this.testCaseId}`);
    console.log(`📋 Test Name: ${this.config.testName}`);
    console.log(`📋 Output Path: ${this.config.outputPath}`);
    console.log(`📋 Start URL: ${url || this.config.startUrl}`);
    console.log(`📋 Continue Existing: ${this.config.continueExisting}`);
    console.log(`📋 Current Working Directory: ${process.cwd()}`);
    console.log('═'.repeat(80));

    // If continuing existing test, load existing actions
    if (this.config.continueExisting) {
      console.log(`🔄 CONTINUE MODE ENABLED`);

      // First, try to find the test file by name (case-insensitive, handles spaces/hyphens)
      let testFilePath = path.join(this.config.outputPath, `${this.testCaseId}.json`);

      // If the constructed path doesn't exist, search for a matching file in the directory
      if (!fs.existsSync(testFilePath)) {
        const testFiles = fs.readdirSync(this.config.outputPath).filter(f => f.endsWith('.json'));
        const matchingFile = testFiles.find(f => {
          // Normalize filenames for comparison (remove .json, replace hyphens/spaces)
          const normalizedFile = f.replace('.json', '').toLowerCase().replace(/[-\s]/g, '');
          const normalizedTestName = this.testCaseId.toLowerCase().replace(/[-\s]/g, '');
          return normalizedFile === normalizedTestName;
        });

        if (matchingFile) {
          testFilePath = path.join(this.config.outputPath, matchingFile);
          console.log(`📂 Found matching test file: ${matchingFile}`);
        }
      }

      console.log(`📂 Looking for existing test at: ${testFilePath}`);
      if (fs.existsSync(testFilePath)) {
        console.log(`✅ Found existing test file!`);
        const existingTest = JSON.parse(fs.readFileSync(testFilePath, 'utf-8'));
        this.actions = existingTest.actions || [];
        // Update testCaseId to match the found file
        this.testCaseId = testFilePath.split('/').pop()?.replace('.json', '') || this.testCaseId;
        console.log(`✅ Loaded ${this.actions.length} existing actions - new actions will be appended`);
      } else {
        console.log(`⚠️ Continue flag set but no existing test found at ${testFilePath} - starting fresh`);
      }
    } else {
      console.log(`🆕 NEW TEST MODE - Will create new test from scratch`);
    }

    // Enable recording EARLY
    this.recording = true;

    // Check if browser is already open (from test execution, Open Browser button, or previous recording)
    console.log('🔍 Checking if browser is already open...');
    const browserAlreadyOpen = browserManager.isBrowserOpen();
    console.log(`🔍 Browser already open: ${browserAlreadyOpen}`);

    // Only add start_browser action if browser is NOT already open
    if (!browserAlreadyOpen && !this.config.continueExisting) {
      await this.addAction({
        type: ActionType.CUSTOM,
        value: 'start_browser',
        description: '🌐 Start Browser - Open Chromium'
      });
    }

    if (browserAlreadyOpen) {
      console.log('✨ Browser already open - reusing existing session');
      this.page = await browserManager.getPage();

      // Set up event listeners BEFORE any navigation (must be done even if browser is already open)
      console.log('🎧 Setting up event listeners...');
      await this.setupEventListeners();
      console.log('✅ Event listeners set up');

      // Get current URL - no navigation needed, user already navigated manually
      const currentUrl = this.page!.url();
      console.log(`✅ Recording from current page: ${currentUrl}`);
      console.log(`💡 Browser is already open - no duplicate navigate action will be added`);

      // Inject event listeners AFTER navigation check
      console.log('💉 Injecting event listeners...');
      await this.injectEventListeners();
      console.log('✅ Event listeners injected');
    } else {
      // Browser not open - start fresh
      console.log('🌐 Opening new browser session');

      // Start Browser action already added above (line 74-78)

      // Get browser from shared manager
      console.log('🔧 Getting browser from browserManager...');
      await browserManager.getBrowser();
      const context = await browserManager.getContext();
      this.page = await browserManager.getPage();
      console.log('✅ Got page from browserManager');

      // Set up event listeners BEFORE any navigation
      console.log('🎧 Setting up event listeners...');
      await this.setupEventListeners();
      console.log('✅ Event listeners set up');

      // Navigate to start URL if provided (but NOT in continue mode)
      if (!this.config.continueExisting) {
        const targetUrl = url || this.config.startUrl;
        if (targetUrl && targetUrl !== 'about:blank') {
          console.log(`🔄 Navigating to: ${targetUrl}`);
          await this.page.goto(targetUrl);

          // Wait for page to load
          await this.page.waitForLoadState('domcontentloaded');

          // Record INITIAL navigation only (so test knows where to start)
          this.addAction({
            type: ActionType.NAVIGATE,
            value: targetUrl,
            description: `Navigate to ${targetUrl}`
          });
        } else {
          console.log('⚠️ No URL provided - browser will open to blank page');
          console.log('💡 Navigate manually to start recording');
        }
      } else {
        console.log('🔄 CONTINUE MODE: Browser opened but NOT navigating - user will manually navigate');
      }

      // Inject event listeners AFTER navigation (so page is loaded)
      console.log('💉 Injecting event listeners...');
      await this.injectEventListeners();
      console.log('✅ Event listeners injected');
    }

    // Recording already enabled above (line 69)

    // Inject recorder script
    console.log('📝 Injecting recorder script and overlay...');
    await this.injectRecorderScript();
    console.log('✅ Recorder script and overlay injected');

    console.log('✅ Web Recorder started. Perform actions in the browser...');
    console.log('💡 Press Ctrl+C in terminal to stop recording');
  }

  private async injectRecorderScript(): Promise<void> {
    if (!this.page) return;

    const overlayScript = `
      (function() {
        // Check if already injected
        if (document.getElementById('qa-recorder-overlay')) {
          return;
        }

        // Inject recording UI overlay
        const overlay = document.createElement('div');
        overlay.id = 'qa-recorder-overlay';
        overlay.style.cssText = \`
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
        \`;
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
        let lastHighlighted = null;
        document.addEventListener('mouseover', (e) => {
          const target = e.target;
          if (target.id === 'qa-recorder-overlay' || target.closest('#qa-recorder-overlay')) return;

          if (lastHighlighted) {
            lastHighlighted.style.outline = '';
          }
          target.style.outline = '2px solid #4CAF50';
          lastHighlighted = target;
        }, true);
      })();
    `;

    try {
      // Inject on current page immediately
      await this.page.evaluate(overlayScript);

      // Also add to init script for future navigations
      await this.page.addInitScript(overlayScript);
    } catch (error) {
      console.error('❌ Error injecting recorder overlay:', error);
    }
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
        target: await this.createLocator(objectData.selector, objectData.xpath),
        description: `Click on ${objectData.tagName} "${objectData.text || objectData.selector}"`,
        objectId: objectId
      });

      // Auto-insert wait steps for known elements that cause page navigation
      if (objectData.id === 'btn_new_doc' || objectData.text?.includes('Add New')) {
        console.log(`🕐 Auto-inserting wait after navigation-triggering button`);
        await this.addAction({
          type: ActionType.WAIT,
          value: '2000',
          description: 'Wait for page to load after navigation'
        });
      }
    });

    await this.page.exposeFunction('recordInput', async (objectData: any, value: string) => {
      console.log(`⌨️ Input recorded: ${value} into ${objectData.selector}`);

      // Store object in repository
      const objectId = this.storeObject(objectData);

      await this.addAction({
        type: ActionType.TYPE,
        target: await this.createLocator(objectData.selector, objectData.xpath),
        value: value,
        description: `Type "${value}" into ${objectData.name || objectData.selector}"`,
        objectId: objectId
      });
    });

    await this.page.exposeFunction('recordKeyPress', async (objectData: any, key: string) => {
      console.log(`⌨️ Key press recorded: ${key} on ${objectData.selector}`);

      // Note: For press_key, we don't need to store the object or create a target
      // The key will be pressed globally (on whatever element currently has focus)
      // Only store object if specifically needed for reference, but don't create a target

      await this.addAction({
        type: ActionType.PRESS_KEY,
        value: key,
        description: `Press ${key} key`,
        // Optional: you could add target if you want to focus on an element first
        // target: await this.createLocator(objectData.selector, objectData.xpath),
      });
    });

    // Listen for dialogs (alerts, confirms, prompts)
    this.page.on('dialog', async (dialog) => {
      console.log(`🔔 Dialog detected: ${dialog.type()} - ${dialog.message()}`);
      await this.addAction({
        type: ActionType.CUSTOM,
        value: `dialog_${dialog.type()}`,
        description: `Dialog ${dialog.type()}: "${dialog.message()}"`
      });
      // Auto-accept dialogs during recording
      await dialog.accept();
    });

    // Listen for navigation - DISABLED to avoid recording automatic redirects
    // this.page.on('framenavigated', async (frame) => {
    //   if (frame === this.page?.mainFrame()) {
    //     const url = frame.url();
    //     const now = Date.now();

    //     // Skip if this navigation happened too soon after the last one (likely an automatic redirect)
    //     if (now - this.lastNavigationTime < this.navigationDebounceMs) {
    //       console.log(`⏭️ Skipping navigation to ${url} (automatic redirect within ${now - this.lastNavigationTime}ms)`);
    //       this.lastNavigationTime = now;
    //       return;
    //     }

    //     this.lastNavigationTime = now;
    //     await this.addAction({
    //       type: ActionType.NAVIGATE,
    //       value: url,
    //       description: `Navigated to ${url}`
    //     });
    //   }
    // });

    // Listen for new pages/tabs
    const context = browserManager.getContextInstance();
    if (context) {
      context.on('page', async (newPage) => {
        const pages = context?.pages() || [];
        const pageIndex = pages.indexOf(newPage) + 1;

        console.log(`📑 New tab opened (#${pageIndex})`);
        await this.addAction({
          type: ActionType.NAVIGATE,
          value: '',
          description: `Switched to tab #${pageIndex} (New tab opened)`
        });

        // Switch tracking to the new page
        this.page = newPage;

        // Wait for new page to load before injecting
        try {
          console.log(`⏳ Waiting for tab #${pageIndex} to load...`);
          await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 });
          console.log(`✅ Tab #${pageIndex} loaded`);
        } catch (e) {
          console.log(`⚠️ Tab #${pageIndex} load timeout - injecting anyway`);
        }

        // Re-setup event listeners (exposeFunction must be called for new page)
        console.log(`🎧 Setting up event listeners for tab #${pageIndex}...`);
        await newPage.exposeFunction('recordClick', async (objectData: any) => {
          console.log(`🖱️ Click recorded in tab #${pageIndex}: ${objectData.tagName} - ${objectData.text || objectData.selector}`);

          const objectId = this.storeObject(objectData);

          await this.addAction({
            type: ActionType.CLICK,
            target: await this.createLocator(objectData.selector, objectData.xpath),
            description: `Click on ${objectData.tagName} "${objectData.text || objectData.selector}"`,
            objectId: objectId
          });

          // Auto-insert wait steps for known elements that cause page navigation
          if (objectData.id === 'btn_new_doc' || objectData.text?.includes('Add New')) {
            console.log(`🕐 Auto-inserting wait after navigation-triggering button`);
            await this.addAction({
              type: ActionType.WAIT,
              value: '2000',
              description: 'Wait for page to load after navigation'
            });
          }
        });

        await newPage.exposeFunction('recordInput', async (objectData: any, value: string) => {
          console.log(`⌨️ Input recorded in tab #${pageIndex}: ${value} into ${objectData.selector}`);

          const objectId = this.storeObject(objectData);

          await this.addAction({
            type: ActionType.TYPE,
            target: await this.createLocator(objectData.selector, objectData.xpath),
            value: value,
            description: `Type "${value}" into ${objectData.name || objectData.selector}"`,
            objectId: objectId
          });
        });

        await newPage.exposeFunction('recordKeyPress', async (objectData: any, key: string) => {
          console.log(`⌨️ Key press recorded in tab #${pageIndex}: ${key}`);

          // Note: For press_key, we don't need to store the object or create a target
          // The key will be pressed globally (on whatever element currently has focus)

          await this.addAction({
            type: ActionType.PRESS_KEY,
            value: key,
            description: `Press ${key} key`,
            // Optional: you could add target if you want to focus on an element first
            // target: await this.createLocator(objectData.selector, objectData.xpath),
          });
        });

        // Re-inject recorder overlay and event listeners
        console.log(`💉 Injecting event listeners for tab #${pageIndex}...`);
        await this.injectRecorderScript();
        await this.injectEventListeners();
        console.log(`✅ Tab #${pageIndex} ready for recording`);

        // Navigation tracking disabled to avoid recording automatic redirects
        // newPage.on('framenavigated', async (frame) => {
        //   if (frame === newPage.mainFrame()) {
        //     const url = frame.url();
        //     const now = Date.now();

        //     // Skip if this navigation happened too soon after the last one (likely an automatic redirect)
        //     if (now - this.lastNavigationTime < this.navigationDebounceMs) {
        //       console.log(`⏭️ Skipping navigation to ${url} in Tab #${pageIndex} (automatic redirect within ${now - this.lastNavigationTime}ms)`);
        //       this.lastNavigationTime = now;
        //       return;
        //     }

        //     this.lastNavigationTime = now;
        //     await this.addAction({
        //       type: ActionType.NAVIGATE,
        //       value: url,
        //       description: `Navigated to ${url} (Tab #${pageIndex})`
        //     });
        //   }
        // });
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

          // Helper function to generate full/absolute XPath with modal detection
          window.getFullXPath = function(element) {
            if (element.id) {
              // If element has ID, use short XPath
              return '//' + element.tagName.toLowerCase() + '[@id="' + element.id + '"]';
            }

            var path = '';
            var currentElement = element;

            // Check if element is inside a modal (detect by traversing up to find modal container)
            var isInModal = false;
            var modalContainer = null;
            var tempEl = element;
            while (tempEl && tempEl !== document.body) {
              // Detect modal patterns: role="dialog", class contains "modal", or direct child of body with no class
              if (tempEl.getAttribute('role') === 'dialog' ||
                  (tempEl.className && typeof tempEl.className === 'string' && tempEl.className.includes('modal')) ||
                  (tempEl.parentNode === document.body && tempEl.tagName === 'DIV')) {
                isInModal = true;
                modalContainer = tempEl;
                break;
              }
              tempEl = tempEl.parentNode;
            }

            // Generate XPath
            for (; currentElement && currentElement.nodeType == 1; currentElement = currentElement.parentNode) {
              var index = 0;
              var hasFollowingSiblings = false;

              for (var sibling = currentElement.previousSibling; sibling; sibling = sibling.previousSibling) {
                if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE) continue;
                if (sibling.nodeName == currentElement.nodeName) ++index;
              }
              for (var sibling = currentElement.nextSibling; sibling && !hasFollowingSiblings; sibling = sibling.nextSibling) {
                if (sibling.nodeName == currentElement.nodeName) hasFollowingSiblings = true;
              }

              var tagName = currentElement.nodeName.toLowerCase();
              var pathIndex = '';

              // For modal containers: use LAST div (highest index) instead of counting from start
              // This makes it more stable when other divs are added/removed before the modal
              if (isInModal && currentElement.parentNode === document.body && tagName === 'div') {
                // Count total divs under body
                var totalDivs = 0;
                var modalPosition = 0;
                var bodyDivs = document.body.querySelectorAll('body > div');
                for (var i = 0; i < bodyDivs.length; i++) {
                  totalDivs++;
                  if (bodyDivs[i] === currentElement) {
                    modalPosition = i + 1;
                  }
                }

                // Use position from end: last() for last, last()-1 for second to last, etc.
                if (modalPosition === totalDivs) {
                  pathIndex = '[last()]';
                } else {
                  var fromEnd = totalDivs - modalPosition;
                  pathIndex = '[last()-' + fromEnd + ']';
                }
              } else {
                // Normal XPath index
                pathIndex = (index || hasFollowingSiblings ? '[' + (index + 1) + ']' : '');
              }

              path = '/' + tagName + pathIndex + path;
            }
            return path;
          };

          // Helper function to capture full object data
          window.captureObjectData = function(element) {
            var attributes = {};
            for (var i = 0; i < element.attributes.length; i++) {
              var attr = element.attributes[i];
              attributes[attr.name] = attr.value;
            }

            var text = element.textContent ? element.textContent.trim() : '';
            var selector = '';
            var xpath = '';

            // Always generate full XPath for maximum reliability
            var fullXPath = window.getFullXPath(element);

            // ALWAYS use full XPath for maximum reliability
            xpath = fullXPath;

            // Generate CSS selector for fallback (React-aware)
            // Priority order: id > data-testid > aria-label > name > placeholder > text > stable classes > tag

            var tagName = element.tagName.toLowerCase();

            // Helper function to detect generated IDs and classes
            var isGeneratedId = function(id) {
              return /^(__react|__id|_)/i.test(id);
            };

            var isGeneratedAttribute = function(value) {
              return /^(styles__|css-|_|__)/i.test(value);
            };

            var isGeneratedClass = function(cls) {
              return /^(css-|styles__|_|__)/i.test(cls) || /^(mc-|ant-|ui-|component-)/i.test(cls);
            };

            var extractStableClasses = function(className) {
              if (!className) return [];
              return className.split(' ')
                .filter(function(c) { return c && !isGeneratedClass(c); })
                .slice(0, 2);
            };

            // Priority 1: ID (if not generated)
            if (element.id && !isGeneratedId(element.id)) {
              selector = '#' + element.id;
            }
            // Priority 2: data-testid
            else if (element.getAttribute('data-testid')) {
              selector = '[data-testid="' + element.getAttribute('data-testid') + '"]';
            }
            // Priority 3: aria-label
            else if (element.getAttribute('aria-label')) {
              selector = '[aria-label="' + element.getAttribute('aria-label') + '"]';
            }
            // Priority 4: name attribute
            else if (element.getAttribute('name') && !isGeneratedAttribute(element.getAttribute('name'))) {
              selector = tagName + '[name="' + element.getAttribute('name') + '"]';
            }
            // Priority 5: placeholder
            else if (element.getAttribute('placeholder')) {
              selector = tagName + '[placeholder="' + element.getAttribute('placeholder') + '"]';
            }
            // Priority 6: type attribute for inputs
            else if (element.getAttribute('type') && tagName === 'input') {
              selector = tagName + '[type="' + element.getAttribute('type') + '"]';
            }
            // Priority 7: stable classes
            else if (element.className && typeof element.className === 'string') {
              var stableClasses = extractStableClasses(element.className);
              if (stableClasses.length > 0) {
                selector = tagName + '.' + stableClasses.join('.');
              } else {
                selector = tagName;
              }
            }
            // Priority 8: fallback to tag name
            else {
              selector = tagName;
            }

            return {
              id: element.id || null,
              name: element.getAttribute('name') || null,
              className: element.className || null,
              tagName: element.tagName.toLowerCase(),
              text: text.substring(0, 50),
              value: element.value || null,
              placeholder: element.getAttribute('placeholder') || null,
              type: element.getAttribute('type') || null,
              selector: selector,
              attributes: attributes,
              xpath: xpath // Generated XPath for better element matching
            };
          };

          // Helper function to find the actual interactive element
          var findInteractiveElement = function(el) {
            // If current element is interactive tag, use it immediately
            var tag = el.tagName.toLowerCase();
            if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') {
              return el;
            }

            // Check for interactive attributes on current element
            if (el.getAttribute('role') === 'button' || el.hasAttribute('onclick') || el.hasAttribute('data-testid')) {
              return el;
            }

            // Walk up the DOM tree to find the closest interactive parent
            var parent = el.parentElement;
            var depth = 0;

            while (parent && parent.tagName.toLowerCase() !== 'body' && depth < 10) {
              var parentTag = parent.tagName.toLowerCase();

              // Prefer actual interactive tags
              if (parentTag === 'button' || parentTag === 'a' || parentTag === 'input' || parentTag === 'select' || parentTag === 'textarea') {
                return parent;
              }

              // Check for interactive attributes
              if (parent.getAttribute('role') === 'button' || parent.hasAttribute('onclick') || parent.hasAttribute('data-testid')) {
                return parent;
              }

              // For divs, check if it looks like a button (has btn-related classes)
              if (parentTag === 'div') {
                var className = parent.getAttribute('class') || '';
                // If div has button-like classes, return it
                if (className.indexOf('btn') !== -1 || className.indexOf('button') !== -1) {
                  return parent;
                }
              }

              parent = parent.parentElement;
              depth++;
            }

            // If no interactive parent found after depth limit, return original element
            return el;
          };

          // Click event listener
          document.addEventListener('click', function(e) {
            var target = e.target;
            if (target.id === 'qa-recorder-overlay' || target.closest('#qa-recorder-overlay')) return;

            // Find the actual interactive element (not nested children)
            var interactiveElement = findInteractiveElement(target);
            var objectData = window.captureObjectData(interactiveElement);

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
            }, 300); // Wait 300ms after user stops typing (reduced from 1000ms)
          }, true);

          // Keydown event listener for special keys (Enter, Tab, Escape, etc.)
          document.addEventListener('keydown', function(e) {
            // Only record special keys, not regular typing
            var specialKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

            if (specialKeys.indexOf(e.key) !== -1) {
              var target = e.target;
              var objectData = window.captureObjectData(target);

              console.log('⌨️  Key press detected: ' + e.key + ' on ' + (objectData.placeholder || objectData.name || objectData.selector));
              console.log('   📦 Object - ID: ' + objectData.id + ', Name: ' + objectData.name + ', Type: ' + objectData.type);

              if (window.recordKeyPress) {
                window.recordKeyPress(objectData, e.key);
              } else {
                console.error('❌ recordKeyPress function not available!');
              }
            }
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
    // React-aware XPath generation with priority order
    // Goal: Generate ONE optimal selector (fastest, most stable)

    // Priority 1: ID attribute (fastest, most stable)
    if (objectData.id && !this.isGeneratedId(objectData.id)) {
      return `//${objectData.tagName}[@id='${objectData.id}']`;
    }

    // Priority 2: data-testid (intentional for testing, very stable)
    if (objectData.attributes?.['data-testid']) {
      return `//${objectData.tagName}[@data-testid='${objectData.attributes['data-testid']}']`;
    }

    // Priority 3: aria-label (accessible elements, stable)
    if (objectData.attributes?.['aria-label']) {
      return `//${objectData.tagName}[@aria-label='${objectData.attributes['aria-label']}']`;
    }

    // Priority 4: name attribute (form inputs, very stable)
    if (objectData.name && !this.isGeneratedAttribute(objectData.name)) {
      return `//${objectData.tagName}[@name='${objectData.name}']`;
    }

    // Priority 5: placeholder (form inputs, stable)
    if (objectData.attributes?.placeholder) {
      return `//${objectData.tagName}[@placeholder='${objectData.attributes.placeholder}']`;
    }

    // Priority 6: Text content for buttons, links, labels (stable)
    if (objectData.text && (objectData.tagName === 'button' || objectData.tagName === 'a' || objectData.tagName === 'label')) {
      const textContent = objectData.text.substring(0, 100); // Use up to 100 chars
      return `//${objectData.tagName}[contains(text(), '${this.escapeXPathString(textContent)}')]`;
    }

    // Priority 7: Stable classes (filter out React-generated ones)
    if (objectData.className) {
      const stableClasses = this.extractStableClasses(objectData.className);
      if (stableClasses.length > 0) {
        // Use combination of stable classes for better specificity
        let classCondition = stableClasses.map(c => `contains(@class, '${c}')`).join(' and ');
        return `//${objectData.tagName}[${classCondition}]`;
      }
    }

    // Priority 8: type attribute for inputs (stable)
    if (objectData.attributes?.type && objectData.tagName === 'input') {
      return `//${objectData.tagName}[@type='${objectData.attributes.type}']`;
    }

    // Priority 9: Fallback to tag name only
    return `//${objectData.tagName}`;
  }

  private isGeneratedId(id: string): boolean {
    // Detect React-generated IDs (e.g., __react_auto_xxx, etc.)
    return /^(__react|__id|_)/i.test(id);
  }

  private isGeneratedAttribute(value: string): boolean {
    // Detect generated attribute values
    return /^(styles__|css-|_|__)/i.test(value);
  }

  private extractStableClasses(className: string): string[] {
    if (!className) return [];

    // Filter out React-generated classes
    return className
      .split(' ')
      .filter(cls => {
        if (!cls) return false;
        // Skip generated classes: css-xxxx, styles__xxx, _xxx, etc.
        if (/^(css-|styles__|_|__)/i.test(cls)) return false;
        // Skip vendor prefixes and utility classes that might be generated
        if (/^(mc-|ant-|ui-|component-)/i.test(cls)) return false;
        return true;
      })
      .slice(0, 2); // Use max 2 stable classes
  }

  private escapeXPathString(str: string): string {
    // Escape single quotes in XPath strings
    return str.replace(/'/g, "&apos;");
  }

  private async createLocator(selector: string, xpath?: string): Promise<ElementLocator> {
    // Prefer XPath for text-based elements (more reliable for dropdowns/menus)
    // Fallback to CSS if XPath is not available
    if (xpath) {
      return {
        type: 'xpath',
        value: xpath,
        fallbacks: [{ type: 'css', value: selector }]
      };
    } else {
      return {
        type: 'css',
        value: selector,
        fallbacks: []
      };
    }
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

    // Don't auto-add close_browser - let user add it manually if needed
    // Browser will stay open for reuse between tests

    // Note: saveProgress() already saves actions after each step,
    // so this.actions already contains all recorded actions.
    // We don't need to load and re-append from file (that causes duplicates!)

    const testCasePath = path.join(this.config.outputPath, `${this.testCaseId}.json`);
    let createdAt = Date.now();

    // Check if file exists to preserve createdAt timestamp
    if (fs.existsSync(testCasePath)) {
      const existingTest = JSON.parse(fs.readFileSync(testCasePath, 'utf-8'));
      createdAt = existingTest.createdAt || Date.now();
    }

    const testCase: TestCase = {
      id: this.testCaseId,
      name: this.config.testName || 'Recorded Web Test',
      description: 'Test case recorded from web browser',
      platform: PlatformType.WEB,
      actions: this.actions,  // Use this.actions directly (already saved by saveProgress)
      createdAt: createdAt,
      updatedAt: Date.now()
    };

    // Save test case to file
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

  async pickElement(): Promise<string | null> {
    if (!this.page) {
      throw new Error('Page not initialized. Call start() first.');
    }

    console.log('🎯 Element picker activated - hover and click to select an element');
    console.log(`📍 Current page URL: ${this.page.url()}`);

    // Inject element picker overlay
    try {
      console.log('💉 Injecting element picker overlay...');
      await this.page.evaluate(() => {
        // Create overlay to show we're in picking mode
        const overlay = document.createElement('div');
        overlay.id = 'qa-element-picker-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          right: 0;
          background: #ff5722;
          color: white;
          padding: 10px 20px;
          z-index: 999999;
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: bold;
          border-radius: 0 0 0 8px;
        `;
        overlay.textContent = '🎯 Click an element to select it (ESC to cancel)';
        document.body.appendChild(overlay);

        // Store original outline styles
        (window as any).qaOriginalOutlines = new Map();

        // Add hover effect
        const hoverHandler = (e: MouseEvent) => {
          e.stopPropagation();
          // Remove previous highlights
          document.querySelectorAll('.qa-hover-highlight').forEach(el => {
            const originalOutline = (window as any).qaOriginalOutlines.get(el);
            if (originalOutline !== undefined) {
              (el as HTMLElement).style.outline = originalOutline;
            }
            el.classList.remove('qa-hover-highlight');
          });

          // Highlight current element
          const target = e.target as HTMLElement;
          if (target && target.id !== 'qa-element-picker-overlay') {
            (window as any).qaOriginalOutlines.set(target, target.style.outline);
            target.style.outline = '3px solid #ff5722';
            target.classList.add('qa-hover-highlight');
          }
        };

        document.addEventListener('mouseover', hoverHandler);
        (window as any).qaHoverHandler = hoverHandler;
      });
      console.log('✅ Overlay injected successfully');
    } catch (error) {
      console.error('❌ Failed to inject overlay:', error);
      return null;
    }

    // Wait for user to click an element or press ESC
    return new Promise(async (resolve) => {
      let cancelled = false;

      // Create a race between click and ESC key
      const result = await Promise.race([
        // Wait for click
        this.page!.evaluate(() => {
          return new Promise<string | null>((resolveClick) => {
            // Helper to generate full XPath (same as in recording)
            const getFullXPath = (element: HTMLElement): string => {
              if (element.id) {
                return '//' + element.tagName.toLowerCase() + '[@id="' + element.id + '"]';
              }

              let path = '';
              for (let el: HTMLElement | null = element; el && el.nodeType == 1; el = el.parentElement) {
                let index = 0;
                let hasFollowingSiblings = false;
                for (let sibling = el.previousSibling; sibling; sibling = sibling.previousSibling) {
                  if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE) continue;
                  if (sibling.nodeName == el.nodeName) ++index;
                }
                for (let sibling = el.nextSibling; sibling && !hasFollowingSiblings; sibling = sibling.nextSibling) {
                  if (sibling.nodeName == el.nodeName) hasFollowingSiblings = true;
                }
                const tagName = el.nodeName.toLowerCase();
                const pathIndex = (index || hasFollowingSiblings ? '[' + (index + 1) + ']' : '');
                path = '/' + tagName + pathIndex + path;
              }
              return path;
            };

            const clickListener = (e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();

              const target = e.target as HTMLElement;
              if (target && target.id !== 'qa-element-picker-overlay') {
                // Generate full XPath for the element
                const xpath = getFullXPath(target);

                document.removeEventListener('click', clickListener, true);
                resolveClick(xpath);
              }
            };

            document.addEventListener('click', clickListener, true);
          });
        }),
        // Wait for ESC key
        this.page!.keyboard.press('Escape').then(() => null).catch(() => null)
      ]);

      // Clean up
      await this.page!.evaluate(() => {
        const overlay = document.getElementById('qa-element-picker-overlay');
        if (overlay) overlay.remove();

        document.querySelectorAll('.qa-hover-highlight').forEach(el => {
          const originalOutline = (window as any).qaOriginalOutlines.get(el);
          if (originalOutline !== undefined) {
            (el as HTMLElement).style.outline = originalOutline;
          }
          el.classList.remove('qa-hover-highlight');
        });

        if ((window as any).qaHoverHandler) {
          document.removeEventListener('mouseover', (window as any).qaHoverHandler);
        }
      });

      if (result) {
        console.log(`✅ Element selected: ${result}`);
      } else {
        console.log('❌ Element picker cancelled');
      }

      resolve(result);
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
