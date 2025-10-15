#!/usr/bin/env node

import { Command } from 'commander';
import { WebRecorder } from './recorders/web/webRecorder';
import { DesktopRecorder } from './recorders/desktop/desktopRecorder';
import { MobileRecorder } from './recorders/mobile/mobileRecorder';
import { UnifiedRecorder } from './recorders/unified/unifiedRecorder';
import { TestExecutor } from './executor/testExecutor';
import { TestSuiteManager } from './suite/testSuite';
import { PlatformType } from './types';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('qa-automation')
  .description('Cross-platform test automation with recorder for Web, Desktop, and Mobile')
  .version('1.0.0');

// Web Recording Command
program
  .command('record:web')
  .description('Start web browser recorder')
  .option('-u, --url <url>', 'Starting URL', 'https://example.com')
  .option('-b, --browser <browser>', 'Browser type (chromium, firefox, webkit)', 'chromium')
  .option('-o, --output <path>', 'Output directory', './recordings')
  .option('-n, --name <name>', 'Test case name', 'Recorded Web Test')
  .option('--no-screenshots', 'Disable screenshots on each action')
  .option('--continue', 'Continue existing test (append new actions)')
  .action(async (options) => {
    const recorder = new WebRecorder({
      platform: PlatformType.WEB,
      outputPath: options.output,
      startUrl: options.url,
      browser: options.browser as any,
      screenshotOnAction: options.screenshots,
      testName: options.name,
      continueExisting: options.continue
    });

    await recorder.start();

    // Set up stdin listener for stop/restart commands
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('💡 Commands: Type "stop" to stop recording, "restart <name>" to start new test');

    rl.on('line', async (input: string) => {
      const trimmed = input.trim();

      if (trimmed === 'stop') {
        await recorder.stop();
        console.log('📝 Recording stopped. Type "restart <test-name>" to start a new recording or Ctrl+C to exit');
      } else if (trimmed.startsWith('restart ')) {
        const newTestName = trimmed.substring(8).trim();
        if (newTestName) {
          await recorder.restartRecording(newTestName);
        } else {
          console.log('❌ Please provide a test name: restart <test-name>');
        }
      }
    });

    process.on('SIGINT', async () => {
      await recorder.stop();
      rl.close();
      process.exit(0);
    });
  });

// Desktop Recording Command
program
  .command('record:desktop')
  .description('Start desktop application recorder')
  .option('-o, --output <path>', 'Output directory', './recordings')
  .option('--no-screenshots', 'Disable screenshots on each action')
  .action(async (options) => {
    const recorder = new DesktopRecorder({
      platform: PlatformType.DESKTOP,
      outputPath: options.output,
      screenshotOnAction: options.screenshots
    });

    await recorder.start();

    process.on('SIGINT', async () => {
      await recorder.stop();
      process.exit(0);
    });
  });

// Mobile Recording Command
program
  .command('record:mobile')
  .description('Start mobile application recorder')
  .requiredOption('-d, --device <type>', 'Device type (android, ios)')
  .option('-n, --device-name <name>', 'Device name')
  .option('-p, --package <package>', 'App package (Android) or bundle ID (iOS)')
  .option('-a, --activity <activity>', 'App activity (Android only)')
  .option('-o, --output <path>', 'Output directory', './recordings')
  .option('--no-screenshots', 'Disable screenshots on each action')
  .action(async (options) => {
    const recorder = new MobileRecorder({
      platform: PlatformType.MOBILE,
      outputPath: options.output,
      deviceType: options.device as 'android' | 'ios',
      deviceName: options.deviceName,
      appPackage: options.package,
      appActivity: options.activity,
      screenshotOnAction: options.screenshots
    });

    await recorder.start();

    process.on('SIGINT', async () => {
      await recorder.stop();
      process.exit(0);
    });
  });

// Element Picker Command
program
  .command('pick-element')
  .description('Pick an element from the active browser session')
  .action(async () => {
    // This assumes browser is already open from a recording session
    const { browserManager } = await import('./browser/browserManager');

    if (!browserManager.isBrowserOpen()) {
      console.error('❌ No browser session found. Please start a recording first.');
      process.exit(1);
    }

    // Create a temporary recorder instance to use the pickElement method
    const tempRecorder = new WebRecorder({
      platform: PlatformType.WEB,
      outputPath: './temp',
      startUrl: '',
      testName: 'temp'
    });

    // Set the page from browser manager
    const page = await browserManager.getPage();
    (tempRecorder as any).page = page;

    const selector = await tempRecorder.pickElement();

    if (selector) {
      console.log(`\n✅ Selected element: ${selector}`);
      // Output just the selector so parent process can capture it
      console.log(`SELECTED_ELEMENT:${selector}`);
    } else {
      console.log('\n❌ Element selection cancelled');
    }
  });

// Unified Cross-Platform Recording Command (Like Ranorex)
program
  .command('record:unified')
  .description('Start unified cross-platform recorder (Web + Desktop + Mobile in ONE test)')
  .option('-n, --name <name>', 'Test case name', 'Cross-Platform Test')
  .option('-d, --description <description>', 'Test case description', 'Cross-platform test case')
  .option('-o, --output <path>', 'Output directory', './recordings')
  .action(async (options) => {
    const recorder = new UnifiedRecorder(
      options.output,
      options.name,
      options.description
    );

    await recorder.start();
  });

// Execute Test Command
program
  .command('execute')
  .description('Execute a recorded test case')
  .argument('<testfile>', 'Path to test case JSON file')
  .option('-r, --report <path>', 'Generate report at path')
  .option('-l, --loop <count>', 'Number of times to loop the test', '1')
  .action(async (testfile, options) => {
    const executor = new TestExecutor();

    try {
      const loopCount = parseInt(options.loop);
      const result = await executor.executeFromFile(testfile, loopCount);

      if (options.report) {
        executor.generateReport(options.report);
      }

      // Signal completion without exiting (to keep browser alive)
      console.log('###EXECUTION_COMPLETE###');
      console.log(`EXIT_CODE:${result.status === 'passed' ? 0 : 1}`);

      // Keep process alive to preserve browser session
      console.log('🌐 Keeping process alive to preserve browser session...');
      // Prevent Node.js from exiting by keeping event loop active
      setInterval(() => {}, 60000); // Keep-alive timer every 60 seconds

    } catch (error: any) {
      console.error('❌ Execution failed:', error.message);
      console.log('###EXECUTION_COMPLETE###');
      console.log('EXIT_CODE:1');

      // Keep process alive even on error
      console.log('🌐 Keeping process alive to preserve browser session...');
      setInterval(() => {}, 60000);
    }
  });

// Execute Batch Command
program
  .command('execute:batch')
  .description('Execute multiple test cases')
  .argument('<pattern>', 'Glob pattern for test files (e.g., "./recordings/*.json")')
  .option('-r, --report <path>', 'Generate report at path')
  .action(async (pattern, options) => {
    const glob = require('glob');
    const files = glob.sync(pattern);

    if (files.length === 0) {
      console.error('❌ No test files found matching pattern:', pattern);
      process.exit(1);
    }

    console.log(`📊 Found ${files.length} test case(s)`);

    const executor = new TestExecutor();
    const results = await executor.executeBatch(files);

    if (options.report) {
      executor.generateReport(options.report);
    }

    const failed = results.filter(r => r.status === 'failed').length;
    console.log(`\n✅ Passed: ${results.length - failed}`);
    console.log(`❌ Failed: ${failed}`);

    process.exit(failed > 0 ? 1 : 0);
  });

// List Test Cases Command
program
  .command('list')
  .description('List all recorded test cases')
  .option('-d, --directory <path>', 'Recordings directory', './recordings')
  .action((options) => {
    const files = fs.readdirSync(options.directory)
      .filter(f => f.endsWith('.json'));

    console.log(`\n📝 Found ${files.length} test case(s):\n`);

    files.forEach(file => {
      const filePath = path.join(options.directory, file);
      const testCase = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      console.log(`  ${testCase.name}`);
      console.log(`    Platform: ${testCase.platform}`);
      console.log(`    Actions: ${testCase.actions.length}`);
      console.log(`    File: ${file}`);
      console.log('');
    });
  });

// Test Suite Commands
program
  .command('suite:create')
  .description('Create a new test suite')
  .requiredOption('-n, --name <name>', 'Suite name')
  .requiredOption('-d, --description <description>', 'Suite description')
  .requiredOption('-t, --tests <tests...>', 'Test case files')
  .action((options) => {
    const manager = new TestSuiteManager();
    const suite = manager.createSuite(options.name, options.description, options.tests);
    console.log(`✅ Created test suite: ${suite.id}`);
    console.log(`   Name: ${suite.name}`);
    console.log(`   Test Cases: ${suite.testCases.length}`);
  });

program
  .command('suite:list')
  .description('List all test suites')
  .action(() => {
    const manager = new TestSuiteManager();
    const suites = manager.listSuites();

    if (suites.length === 0) {
      console.log('\n📋 No test suites found. Create one with: suite:create\n');
      return;
    }

    console.log(`\n📋 Test Suites (${suites.length}):\n`);
    suites.forEach(suite => {
      console.log(`  📦 ${suite.name} (${suite.id})`);
      console.log(`     ${suite.description}`);
      console.log(`     Test Cases: ${suite.testCases.length}`);
      console.log(`     Created: ${new Date(suite.createdAt).toLocaleString()}`);
      console.log('');
    });
  });

program
  .command('suite:execute')
  .description('Execute a test suite')
  .argument('<suite-id>', 'Test suite ID')
  .option('-r, --report <path>', 'Report output path')
  .option('-l, --loop <count>', 'Number of times to loop the entire suite', '1')
  .action(async (suiteId, options) => {
    const manager = new TestSuiteManager();
    const reportPath = options.report || `./reports/suite-${suiteId}-report.json`;
    const loopCount = parseInt(options.loop);

    try {
      const results = await manager.executeSuite(suiteId, reportPath, loopCount);
      const failed = results.filter(r => r.status === 'failed').length;
      process.exit(failed > 0 ? 1 : 0);
    } catch (error: any) {
      console.error('❌ Failed to execute suite:', error.message);
      process.exit(1);
    }
  });

program
  .command('suite:add')
  .description('Add test cases to a suite')
  .argument('<suite-id>', 'Test suite ID')
  .argument('<tests...>', 'Test case files to add')
  .action((suiteId, tests) => {
    const manager = new TestSuiteManager();
    manager.addTestCases(suiteId, tests);
    console.log(`✅ Added ${tests.length} test case(s) to suite`);
  });

program
  .command('suite:delete')
  .description('Delete a test suite')
  .argument('<suite-id>', 'Test suite ID')
  .action((suiteId) => {
    const manager = new TestSuiteManager();
    manager.deleteSuite(suiteId);
  });

// Start UI Command
program
  .command('ui')
  .description('Start the Electron-based UI')
  .action(() => {
    const { spawn } = require('child_process');
    const electron = require('electron');

    const child = spawn(electron as any, [path.join(__dirname, 'ui', 'main.js')], {
      stdio: 'inherit'
    });

    child.on('close', (code: number) => {
      process.exit(code);
    });
  });

// Check if browser has pages
program
  .command('check-browser-pages')
  .description('Check if browser has any pages open')
  .action(async () => {
    const { browserManager } = await import('./browser/browserManager');

    try {
      if (!browserManager.isBrowserOpen()) {
        console.log('HAS_PAGES:false');
        process.exit(0);
        return;
      }

      const browser = await browserManager.getBrowser();
      const context = await browserManager.getContext();
      const pages = context.pages();

      console.log(`HAS_PAGES:${pages.length > 0}`);
      console.log(`PAGE_COUNT:${pages.length}`);
      if (pages.length > 0) {
        console.log(`CURRENT_URL:${pages[0].url()}`);
      }
      process.exit(0);

    } catch (error: any) {
      console.log('HAS_PAGES:false');
      process.exit(1);
    }
  });

// Open Browser Command
program
  .command('open-browser')
  .description('Open browser and connect to persistent browser server')
  .option('-u, --url <url>', 'URL to navigate to after opening browser')
  .option('--wait', 'Wait and keep process alive (for manual browser opening)')
  .action(async (options) => {
    const { browserManager } = await import('./browser/browserManager');

    try {
      console.log('🌐 Opening browser and connecting to persistent server...');

      const browser = await browserManager.getBrowser();
      const context = await browserManager.getContext();
      const page = await browserManager.getPage();

      console.log('✅ Browser opened successfully!');

      // Navigate to URL if provided
      if (options.url) {
        console.log(`📍 Navigating to: ${options.url}`);
        await page.goto(options.url);
        await page.waitForLoadState('domcontentloaded');
        console.log('✅ Navigation complete!');
      }

      console.log('💡 You can now start recording actions.');
      console.log('🔗 Browser will stay open - ready for test execution or recording');

      // Keep process alive if requested (for manual browser opening)
      if (options.wait) {
        setInterval(() => {}, 60000);
      } else {
        // Exit after opening (for automated calls from UI)
        process.exit(0);
      }

    } catch (error: any) {
      console.error('❌ Failed to open browser:', error.message);
      process.exit(1);
    }
  });

program.parse();
