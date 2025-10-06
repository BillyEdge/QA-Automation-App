import { v4 as uuidv4 } from 'uuid';
import { TestAction, TestCase, ActionType, PlatformType, MobileRecorderConfig, ElementLocator } from '../../types';
import * as fs from 'fs';
import * as path from 'path';
import { remote } from 'webdriverio';
import type { Browser } from 'webdriverio';

export class MobileRecorder {
  private driver: Browser | null = null;
  private actions: TestAction[] = [];
  private config: MobileRecorderConfig;
  private recording: boolean = false;
  private testCaseId: string;

  constructor(config: MobileRecorderConfig) {
    this.config = {
      screenshotOnAction: true,
      ...config
    };
    this.testCaseId = uuidv4();
  }

  async start(): Promise<void> {
    console.log('🎬 Starting Mobile Recorder...');
    console.log(`📱 Platform: ${this.config.deviceType.toUpperCase()}`);

    const capabilities: any = {
      platformName: this.config.deviceType === 'android' ? 'Android' : 'iOS',
      'appium:automationName': this.config.deviceType === 'android' ? 'UiAutomator2' : 'XCUITest',
      'appium:deviceName': this.config.deviceName || 'emulator-5554',
      'appium:newCommandTimeout': 300
    };

    if (this.config.deviceType === 'android') {
      if (this.config.appPackage) {
        capabilities['appium:appPackage'] = this.config.appPackage;
        capabilities['appium:appActivity'] = this.config.appActivity || '.MainActivity';
      }
    } else {
      if (this.config.bundleId) {
        capabilities['appium:bundleId'] = this.config.bundleId;
      }
    }

    try {
      this.driver = await remote({
        protocol: 'http',
        hostname: 'localhost',
        port: 4723,
        path: '/',
        capabilities
      });

      this.recording = true;

      // Create output directories
      const screenshotDir = path.join(this.config.outputPath, 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      console.log('✅ Mobile Recorder started');
      console.log('💡 Use API methods to record mobile actions');
      console.log('💡 Press Ctrl+C in terminal to stop recording');
    } catch (error) {
      console.error('❌ Failed to start mobile recorder:', error);
      throw error;
    }
  }

  async recordTap(x: number, y: number): Promise<void> {
    if (!this.recording || !this.driver) return;

    await this.driver.touchAction({
      action: 'tap',
      x,
      y
    });

    await this.addAction({
      type: ActionType.TAP,
      target: {
        type: 'coordinates',
        value: JSON.stringify({ x, y })
      },
      description: `Tap at (${x}, ${y})`
    });
  }

  async recordTapElement(selector: string, locatorType: 'id' | 'xpath' | 'accessibility_id' = 'id'): Promise<void> {
    if (!this.recording || !this.driver) return;

    const element = await this.findElement(selector, locatorType);
    if (element) {
      await element.click();

      await this.addAction({
        type: ActionType.TAP,
        target: {
          type: locatorType,
          value: selector
        },
        description: `Tap on element: ${selector}`
      });
    }
  }

  async recordType(selector: string, text: string, locatorType: 'id' | 'xpath' | 'accessibility_id' = 'id'): Promise<void> {
    if (!this.recording || !this.driver) return;

    const element = await this.findElement(selector, locatorType);
    if (element) {
      await element.setValue(text);

      await this.addAction({
        type: ActionType.TYPE,
        target: {
          type: locatorType,
          value: selector
        },
        value: text,
        description: `Type "${text}" into ${selector}`
      });
    }
  }

  async recordSwipe(startX: number, startY: number, endX: number, endY: number, duration: number = 1000): Promise<void> {
    if (!this.recording || !this.driver) return;

    await this.driver.touchAction([
      { action: 'press', x: startX, y: startY },
      { action: 'wait', ms: duration },
      { action: 'moveTo', x: endX, y: endY },
      { action: 'release' }
    ]);

    await this.addAction({
      type: ActionType.SWIPE,
      target: {
        type: 'coordinates',
        value: JSON.stringify({ x: startX, y: startY })
      },
      value: { endX, endY, duration },
      description: `Swipe from (${startX}, ${startY}) to (${endX}, ${endY})`
    });
  }

  async recordScroll(direction: 'up' | 'down' | 'left' | 'right', distance: number = 500): Promise<void> {
    if (!this.recording || !this.driver) return;

    const size = await this.driver.getWindowSize();
    const centerX = size.width / 2;
    const centerY = size.height / 2;

    let startX = centerX, startY = centerY, endX = centerX, endY = centerY;

    switch (direction) {
      case 'up':
        startY = centerY + distance / 2;
        endY = centerY - distance / 2;
        break;
      case 'down':
        startY = centerY - distance / 2;
        endY = centerY + distance / 2;
        break;
      case 'left':
        startX = centerX + distance / 2;
        endX = centerX - distance / 2;
        break;
      case 'right':
        startX = centerX - distance / 2;
        endX = centerX + distance / 2;
        break;
    }

    await this.recordSwipe(startX, startY, endX, endY);
  }

  async recordLongPress(x: number, y: number, duration: number = 2000): Promise<void> {
    if (!this.recording || !this.driver) return;

    await this.driver.touchAction([
      { action: 'press', x, y },
      { action: 'wait', ms: duration },
      { action: 'release' }
    ]);

    await this.addAction({
      type: ActionType.TAP,
      target: {
        type: 'coordinates',
        value: JSON.stringify({ x, y })
      },
      value: { longPress: true, duration },
      description: `Long press at (${x}, ${y}) for ${duration}ms`
    });
  }

  private async findElement(selector: string, locatorType: 'id' | 'xpath' | 'accessibility_id') {
    if (!this.driver) return null;

    try {
      switch (locatorType) {
        case 'id':
          return await this.driver.$(this.config.deviceType === 'android'
            ? `android=new UiSelector().resourceId("${selector}")`
            : `~${selector}`);
        case 'xpath':
          return await this.driver.$(selector);
        case 'accessibility_id':
          return await this.driver.$(`~${selector}`);
        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to find element: ${selector}`, error);
      return null;
    }
  }

  private async addAction(actionData: Partial<TestAction>): Promise<void> {
    if (!this.recording) return;

    const action: TestAction = {
      id: uuidv4(),
      timestamp: Date.now(),
      platform: PlatformType.MOBILE,
      type: actionData.type!,
      target: actionData.target,
      value: actionData.value,
      description: actionData.description,
      metadata: {
        deviceType: this.config.deviceType
      }
    };

    // Take screenshot if enabled
    if (this.config.screenshotOnAction && this.driver) {
      const screenshotPath = path.join(
        this.config.outputPath,
        'screenshots',
        `${action.id}.png`
      );

      try {
        await this.driver.saveScreenshot(screenshotPath);
        action.screenshot = screenshotPath;
      } catch (error) {
        console.warn('Failed to capture screenshot:', error);
      }
    }

    this.actions.push(action);
    console.log(`📝 Action recorded: ${action.description}`);
  }

  async stop(): Promise<TestCase> {
    console.log('⏹️  Stopping Mobile Recorder...');
    this.recording = false;

    if (this.driver) {
      await this.driver.deleteSession();
    }

    const testCase: TestCase = {
      id: this.testCaseId,
      name: 'Recorded Mobile Test',
      description: `Test case recorded from ${this.config.deviceType} device`,
      platform: PlatformType.MOBILE,
      actions: this.actions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [this.config.deviceType]
    };

    // Save test case to file
    const testCasePath = path.join(this.config.outputPath, `${this.testCaseId}.json`);
    fs.writeFileSync(testCasePath, JSON.stringify(testCase, null, 2));

    console.log(`✅ Test case saved: ${testCasePath}`);
    console.log(`📊 Total actions recorded: ${this.actions.length}`);

    return testCase;
  }

  async addWait(milliseconds: number): Promise<void> {
    await this.addAction({
      type: ActionType.WAIT,
      value: milliseconds,
      description: `Wait for ${milliseconds}ms`
    });
  }

  async addAssertion(selector: string, property: string, expectedValue: any, locatorType: 'id' | 'xpath' | 'accessibility_id' = 'id'): Promise<void> {
    await this.addAction({
      type: ActionType.ASSERT,
      target: {
        type: locatorType,
        value: selector
      },
      value: { property, expectedValue },
      description: `Assert ${selector}.${property} equals ${expectedValue}`
    });
  }
}

// CLI usage
if (require.main === module) {
  const deviceType = (process.argv[2] as 'android' | 'ios') || 'android';

  const recorder = new MobileRecorder({
    platform: PlatformType.MOBILE,
    outputPath: path.join(process.cwd(), 'recordings'),
    deviceType,
    appPackage: process.argv[3],
    appActivity: process.argv[4]
  });

  recorder.start().catch(console.error);

  process.on('SIGINT', async () => {
    await recorder.stop();
    process.exit(0);
  });
}
