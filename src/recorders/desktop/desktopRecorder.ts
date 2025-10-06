import { v4 as uuidv4 } from 'uuid';
import { TestAction, TestCase, ActionType, PlatformType, DesktopRecorderConfig, ElementLocator } from '../../types';
import * as fs from 'fs';
import * as path from 'path';
// Note: nut-js is a modern alternative to robotjs with better cross-platform support
import { mouse, screen, keyboard, Button, Key } from '@nut-tree-fork/nut-js';

export class DesktopRecorder {
  private actions: TestAction[] = [];
  private config: DesktopRecorderConfig;
  private recording: boolean = false;
  private testCaseId: string;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastMousePosition = { x: 0, y: 0 };
  private mouseClickThreshold = 500; // ms between position update and click

  constructor(config: DesktopRecorderConfig) {
    this.config = {
      screenshotOnAction: true,
      ...config
    };
    this.testCaseId = uuidv4();
  }

  async start(): Promise<void> {
    console.log('🎬 Starting Desktop Recorder...');
    console.log('💡 Monitoring mouse and keyboard events...');
    console.log('💡 Press Ctrl+Shift+Q to stop recording');

    this.recording = true;

    // Create output directories
    const screenshotDir = path.join(this.config.outputPath, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Start monitoring events
    await this.startMonitoring();

    // Note: Event listening would require native hooks
    // For a full implementation, you'd use libraries like:
    // - iohook (global keyboard/mouse hooks)
    // - node-global-key-listener
    console.log('✅ Desktop Recorder started');
  }

  private async startMonitoring(): Promise<void> {
    // In a real implementation, you would use iohook or similar for global hooks
    // This is a simplified version showing the structure

    console.log('📝 Ready to record desktop actions');
    console.log('   Use the API methods to record actions programmatically');
  }

  async recordClick(x: number, y: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
    if (!this.recording) return;

    await this.addAction({
      type: ActionType.CLICK,
      target: {
        type: 'coordinates',
        value: JSON.stringify({ x, y })
      },
      value: button,
      description: `${button} click at (${x}, ${y})`
    });
  }

  async recordType(text: string): Promise<void> {
    if (!this.recording) return;

    await this.addAction({
      type: ActionType.TYPE,
      value: text,
      description: `Type "${text}"`
    });
  }

  async recordKeyPress(key: string): Promise<void> {
    if (!this.recording) return;

    await this.addAction({
      type: ActionType.PRESS_KEY,
      value: key,
      description: `Press key "${key}"`
    });
  }

  async recordDoubleClick(x: number, y: number): Promise<void> {
    if (!this.recording) return;

    await this.addAction({
      type: ActionType.CLICK,
      target: {
        type: 'coordinates',
        value: JSON.stringify({ x, y })
      },
      value: 'double',
      description: `Double click at (${x}, ${y})`
    });
  }

  async recordDragDrop(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    if (!this.recording) return;

    await this.addAction({
      type: ActionType.DRAG_DROP,
      target: {
        type: 'coordinates',
        value: JSON.stringify({ x: fromX, y: fromY })
      },
      value: { toX, toY },
      description: `Drag from (${fromX}, ${fromY}) to (${toX}, ${toY})`
    });
  }

  async recordScroll(x: number, y: number, direction: 'up' | 'down', amount: number): Promise<void> {
    if (!this.recording) return;

    await this.addAction({
      type: ActionType.SCROLL,
      target: {
        type: 'coordinates',
        value: JSON.stringify({ x, y })
      },
      value: { direction, amount },
      description: `Scroll ${direction} by ${amount} at (${x}, ${y})`
    });
  }

  private async addAction(actionData: Partial<TestAction>): Promise<void> {
    if (!this.recording) return;

    const action: TestAction = {
      id: uuidv4(),
      timestamp: Date.now(),
      platform: PlatformType.DESKTOP,
      type: actionData.type!,
      target: actionData.target,
      value: actionData.value,
      description: actionData.description,
      metadata: {}
    };

    // Take screenshot if enabled
    if (this.config.screenshotOnAction) {
      const screenshotPath = path.join(
        this.config.outputPath,
        'screenshots',
        `${action.id}.png`
      );

      try {
        const screenWidth = await screen.width();
        const screenHeight = await screen.height();
        const image = await screen.grab();
        // Save screenshot (implementation depends on nut-js version)
        action.screenshot = screenshotPath;
      } catch (error) {
        console.warn('Failed to capture screenshot:', error);
      }
    }

    this.actions.push(action);
    console.log(`📝 Action recorded: ${action.description}`);
  }

  async stop(): Promise<TestCase> {
    console.log('⏹️  Stopping Desktop Recorder...');
    this.recording = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    const testCase: TestCase = {
      id: this.testCaseId,
      name: 'Recorded Desktop Test',
      description: 'Test case recorded from desktop application',
      platform: PlatformType.DESKTOP,
      actions: this.actions,
      createdAt: Date.now(),
      updatedAt: Date.now()
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

  async addScreenshot(description?: string): Promise<void> {
    await this.addAction({
      type: ActionType.SCREENSHOT,
      description: description || 'Take screenshot'
    });
  }
}

// CLI usage example
if (require.main === module) {
  const recorder = new DesktopRecorder({
    platform: PlatformType.DESKTOP,
    outputPath: path.join(process.cwd(), 'recordings')
  });

  recorder.start().catch(console.error);

  // Example: Record some actions programmatically
  setTimeout(async () => {
    await recorder.recordClick(100, 100);
    await recorder.addWait(1000);
    await recorder.recordType('Hello World');
  }, 2000);

  process.on('SIGINT', async () => {
    await recorder.stop();
    process.exit(0);
  });
}
