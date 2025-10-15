import { chromium, Browser, BrowserContext, Page, BrowserServer } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Singleton browser manager to share browser instance between
 * test executor and recorder for session reuse.
 * Uses CDP (Chrome DevTools Protocol) to persist browser across Node.js processes.
 */
class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private browserServer: BrowserServer | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private cdpEndpointFile = path.join(process.cwd(), '.browser-cdp-endpoint');
  private userDataDir = path.join(process.cwd(), '.browser-data');
  private isConnectedViaCDP = false; // Track if browser is from CDP connection

  private constructor() {}

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  private saveCdpEndpoint(endpoint: string): void {
    fs.writeFileSync(this.cdpEndpointFile, endpoint, 'utf-8');
  }

  private loadCdpEndpoint(): string | null {
    try {
      if (fs.existsSync(this.cdpEndpointFile)) {
        return fs.readFileSync(this.cdpEndpointFile, 'utf-8').trim();
      }
    } catch (error) {
      console.log('⚠️ Failed to read CDP endpoint file');
    }
    return null;
  }

  private clearCdpEndpoint(): void {
    try {
      if (fs.existsSync(this.cdpEndpointFile)) {
        fs.unlinkSync(this.cdpEndpointFile);
      }
    } catch (error) {
      // Ignore errors
    }
  }

  async getBrowser(): Promise<Browser> {
    // Check if we already have a connected browser in THIS process
    if (this.browser && this.browser.isConnected()) {
      console.log('✅ Using existing browser connection from this process');
      return this.browser;
    }

    // Try to connect to persistent browser server with retries
    const savedEndpoint = this.loadCdpEndpoint();
    if (savedEndpoint) {
      const maxRetries = 3;
      const retryDelayMs = 1000;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔗 Connecting to persistent browser server... (Attempt ${attempt}/${maxRetries})`);
          console.log(`📍 Endpoint: ${savedEndpoint}`);

          // Connect via CDP to the persistent server
          this.browser = await chromium.connectOverCDP(savedEndpoint, {
            timeout: 10000
          });

          this.isConnectedViaCDP = true; // Mark as CDP connection
          console.log('✅ Connected to persistent browser server!');
          console.log('💡 Browser is shared across executor and recorder');
          return this.browser;

        } catch (error) {
          console.log(`⚠️ Connection attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`);

          if (attempt < maxRetries) {
            console.log(`⏳ Waiting ${retryDelayMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          } else {
            console.log('❌ All connection attempts failed');
            console.log('');
            console.log('💡 TIP: Browser server may still be starting. Wait a moment and try again.');
            this.clearCdpEndpoint();
          }
        }
      }
    }

    // Fallback: Launch a local browser (not persistent)
    console.log('🌐 No persistent server found, launching local browser...');
    console.log('⚠️ This browser won\'t be shared between executor and recorder');

    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--start-maximized'
      ],
      timeout: 30000
    });

    this.isConnectedViaCDP = false; // Local browser, not from CDP
    console.log('✅ Local browser launched');
    return this.browser;
  }

  async getContext(): Promise<BrowserContext> {
    if (!this.context) {
      const browser = await this.getBrowser();

      // When connected via CDP, contexts already exist
      const existingContexts = browser.contexts();
      if (existingContexts.length > 0) {
        console.log('📄 Reusing existing browser context from CDP connection');
        this.context = existingContexts[0];
      } else {
        console.log('📄 Creating new browser context...');
        this.context = await browser.newContext({
          viewport: null  // null viewport means use full window size
        });
      }
    }
    return this.context;
  }

  async getPage(): Promise<Page> {
    const context = await this.getContext();
    const pages = context.pages();

    // ALWAYS check for existing pages first (important for cross-process scenarios)
    // When Open Browser runs in one process and recording starts in another,
    // this.page will be null but pages will exist in the browser
    if (pages.length > 0) {
      console.log(`📄 Reusing existing page (${pages.length} page(s) found in browser)`);
      console.log(`📍 Current URL: ${pages[0].url()}`);
      this.page = pages[0];
    } else {
      console.log('📄 Creating new page...');
      this.page = await context.newPage();
    }

    return this.page;
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      if (this.isConnectedViaCDP) {
        // For CDP connections, just disconnect - don't close the persistent browser
        console.log('🔌 Disconnecting from persistent browser (keeping it open)...');
        // Note: We don't call browser.close() for CDP connections
        // The browser server will keep running
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isConnectedViaCDP = false;
      } else {
        // For local browsers, actually close them
        console.log('🔴 Closing local browser...');
        await this.browser.close();
        this.browser = null;
        this.context = null;
        this.page = null;
      }
    }
  }

  isBrowserOpen(): boolean {
    // Check if CDP endpoint file exists (indicates browser server is running)
    // This works across different Node.js processes
    console.log('='.repeat(80));
    console.log('🔍 BROWSER OPEN CHECK - START');
    console.log(`🔍 Current working directory: ${process.cwd()}`);
    console.log(`🔍 CDP endpoint file path: ${this.cdpEndpointFile}`);
    console.log(`🔍 File exists check: ${fs.existsSync(this.cdpEndpointFile)}`);

    // List files in current directory for debugging
    try {
      const files = fs.readdirSync(process.cwd());
      console.log(`🔍 Files in working directory: ${files.filter(f => f.startsWith('.browser')).join(', ')}`);
    } catch (e) {
      console.log(`⚠️ Could not list directory: ${e}`);
    }

    if (fs.existsSync(this.cdpEndpointFile)) {
      const endpoint = fs.readFileSync(this.cdpEndpointFile, 'utf-8').trim();
      console.log(`✅ CDP endpoint file found!`);
      console.log(`✅ Endpoint: ${endpoint}`);
      console.log('='.repeat(80));
      return true;
    } else {
      console.log('❌ CDP endpoint file NOT found at expected location');
    }

    // Fallback: check in-memory reference
    const memoryCheck = this.browser !== null && this.browser.isConnected();
    console.log(`🔍 Memory check: browser=${this.browser !== null}, connected=${this.browser?.isConnected()}`);
    console.log(`🔍 BROWSER OPEN CHECK - RESULT: ${memoryCheck}`);
    console.log('='.repeat(80));
    return memoryCheck;
  }

  getBrowserInstance(): Browser | null {
    return this.browser;
  }

  getContextInstance(): BrowserContext | null {
    return this.context;
  }

  getPageInstance(): Page | null {
    return this.page;
  }
}

export const browserManager = BrowserManager.getInstance();
