import { chromium, Browser, BrowserContext, Page, BrowserServer } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

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
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // Try to connect to existing browser via CDP
    const savedEndpoint = this.loadCdpEndpoint();
    if (savedEndpoint) {
      try {
        console.log('✨ Connecting to existing browser via CDP...');
        this.browser = await chromium.connectOverCDP(savedEndpoint);
        console.log('✅ Successfully connected to existing browser');
        return this.browser;
      } catch (error) {
        console.log('⚠️ Failed to connect to saved browser, launching new one...');
        this.clearCdpEndpoint();
      }
    }

    // Launch new browser server with CDP enabled
    console.log('🌐 Launching new browser server with CDP...');
    this.browserServer = await chromium.launchServer({
      headless: false,
      args: [
        '--start-maximized',
        '--remote-debugging-port=0'  // Use random port for CDP
      ]
    });

    // Connect to the server to get a Browser instance
    const cdpEndpoint = this.browserServer.wsEndpoint();
    this.browser = await chromium.connect(cdpEndpoint);

    // Save CDP endpoint for future processes
    this.saveCdpEndpoint(cdpEndpoint);
    console.log('📝 Saved CDP endpoint for session reuse');

    // Detach browser server from Node process
    // This allows browser to survive when Node process is killed
    if (this.browserServer['_process']) {
      const browserProcess = this.browserServer['_process'];
      browserProcess.unref(); // Detach from parent process
      console.log('🔓 Browser server detached from Node process');
    }

    // Ensure browser server stays alive when process exits
    process.on('exit', () => {
      console.log('🔌 Process exiting, browser server will stay alive');
      // Disconnect client but don't close server
      if (this.browser) {
        this.browser.close().catch(() => {}); // Close connection, not the server
        this.browser = null;
      }
    });

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
    if (!this.page || this.page.isClosed()) {
      const context = await this.getContext();
      const pages = context.pages();
      if (pages.length > 0) {
        this.page = pages[0];
        console.log('📄 Reusing existing page');
      } else {
        console.log('📄 Creating new page...');
        this.page = await context.newPage();
      }
    }
    return this.page;
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      console.log('🔴 Closing shared browser...');
      console.trace('Browser close called from:');
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
    if (this.browserServer) {
      await this.browserServer.close();
      this.browserServer = null;
    }
    this.clearCdpEndpoint();
  }

  isBrowserOpen(): boolean {
    // Check if CDP endpoint file exists (indicates browser server is running)
    // This works across different Node.js processes
    console.log(`🔍 Checking for CDP endpoint file at: ${this.cdpEndpointFile}`);
    console.log(`🔍 Current working directory: ${process.cwd()}`);

    if (fs.existsSync(this.cdpEndpointFile)) {
      console.log('✅ CDP endpoint file found, browser should be running');
      return true;
    } else {
      console.log('❌ CDP endpoint file NOT found');
    }

    // Fallback: check in-memory reference
    const memoryCheck = this.browser !== null && this.browser.isConnected();
    console.log(`🔍 Memory check: browser=${this.browser !== null}, connected=${this.browser?.isConnected()}`);
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
