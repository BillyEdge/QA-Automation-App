#!/usr/bin/env node

/**
 * Standalone Browser Server
 * Keeps a Chromium browser running persistently so that both
 * test executor and recorder can connect to it via CDP.
 *
 * This mimics Ranorex's behavior where the same browser instance
 * is reused across different operations.
 */

import { chromium, BrowserServer } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const CDP_ENDPOINT_FILE = path.join(process.cwd(), '.browser-cdp-endpoint');

let browserServer: BrowserServer | null = null;

async function startBrowserServer() {
  try {
    console.log('🌐 Starting persistent browser...');
    console.log(`📍 Using fixed CDP port 9223 to avoid Playwright's issues`);

    // Use regular launch with CDP port - simpler and more reliable
    const browser = await chromium.launch({
      headless: false,
      args: [
        '--start-maximized',
        '--remote-debugging-port=9223',  // Fixed port for stability
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    // Wait a moment for Chrome to fully start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the actual WebSocket endpoint from Chrome's debugging API
    // IMPORTANT: Use 127.0.0.1 instead of localhost to force IPv4 (avoids ::1 IPv6 issues)
    const cdpEndpoint = `http://127.0.0.1:9223`;
    console.log(`📍 Querying CDP endpoint: ${cdpEndpoint}/json/version`);

    const response = await fetch(`${cdpEndpoint}/json/version`);
    const versionInfo = await response.json();
    let wsEndpoint = versionInfo.webSocketDebuggerUrl;

    // Replace localhost with 127.0.0.1 in WebSocket URL to force IPv4
    wsEndpoint = wsEndpoint.replace('localhost', '127.0.0.1');

    // Save the WebSocket endpoint for other processes to connect
    fs.writeFileSync(CDP_ENDPOINT_FILE, wsEndpoint, 'utf-8');

    console.log('✅ Browser started successfully!');
    console.log(`🔗 CDP Endpoint: ${cdpEndpoint}`);
    console.log(`🔗 WebSocket Endpoint: ${wsEndpoint}`);
    console.log(`📝 Endpoint saved to: ${CDP_ENDPOINT_FILE}`);
    console.log('');
    console.log('💡 The browser will stay open until you press Ctrl+C');
    console.log('💡 Test executor and recorder will connect to this browser');
    console.log('');

    // Keep process alive
    process.stdin.resume();

    // Store browser reference for cleanup
    (global as any).browserInstance = browser;

  } catch (error) {
    console.error('❌ Failed to start browser:', error);
    process.exit(1);
  }
}

async function stopBrowserServer() {
  console.log('\n🛑 Stopping browser...');

  const browser = (global as any).browserInstance;
  if (browser) {
    await browser.close();
    console.log('✅ Browser closed');
  }

  // Clean up endpoint file
  if (fs.existsSync(CDP_ENDPOINT_FILE)) {
    fs.unlinkSync(CDP_ENDPOINT_FILE);
    console.log('🧹 Cleaned up endpoint file');
  }

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', stopBrowserServer);
process.on('SIGTERM', stopBrowserServer);

// Start the server
startBrowserServer().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
