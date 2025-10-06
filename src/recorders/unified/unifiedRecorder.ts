import { v4 as uuidv4 } from 'uuid';
import { TestAction, TestCase, PlatformType } from '../../types';
import { WebRecorder } from '../web/webRecorder';
import { DesktopRecorder } from '../desktop/desktopRecorder';
import { MobileRecorder } from '../mobile/mobileRecorder';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

/**
 * Unified Recorder - Record cross-platform tests like Ranorex
 * Switch between Web, Desktop, and Mobile during the same recording session
 */
export class UnifiedRecorder {
  private testCaseId: string;
  private testCaseName: string;
  private testCaseDescription: string;
  private allActions: TestAction[] = [];
  private outputPath: string;

  private webRecorder: WebRecorder | null = null;
  private desktopRecorder: DesktopRecorder | null = null;
  private mobileRecorder: MobileRecorder | null = null;

  private currentPlatform: PlatformType | null = null;
  private recording: boolean = false;

  constructor(
    outputPath: string,
    name?: string,
    description?: string
  ) {
    this.testCaseId = uuidv4();
    this.testCaseName = name || 'Cross-Platform Test';
    this.testCaseDescription = description || 'Test case recorded across multiple platforms';
    this.outputPath = outputPath;

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
  }

  async start(): Promise<void> {
    console.log('\n' + '='.repeat(70));
    console.log('🎬 UNIFIED CROSS-PLATFORM RECORDER');
    console.log('   Record actions across Web, Desktop, and Mobile in ONE test!');
    console.log('='.repeat(70));
    console.log('\nAvailable Commands:');
    console.log('  web <url>          - Start recording web browser');
    console.log('  desktop            - Start recording desktop app');
    console.log('  mobile <platform>  - Start recording mobile (android/ios)');
    console.log('  switch             - Switch to different platform');
    console.log('  stop               - Stop current platform recording');
    console.log('  save               - Save and exit');
    console.log('  help               - Show this help');
    console.log('='.repeat(70) + '\n');

    this.recording = true;
    await this.startCommandInterface();
  }

  private async startCommandInterface(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const promptUser = () => {
      rl.question('\n📝 Command > ', async (input) => {
        const [command, ...args] = input.trim().split(' ');

        switch (command.toLowerCase()) {
          case 'web':
            await this.startWebRecording(args[0] || 'https://example.com');
            promptUser();
            break;

          case 'desktop':
            await this.startDesktopRecording();
            promptUser();
            break;

          case 'mobile':
            const platform = (args[0] || 'android') as 'android' | 'ios';
            await this.startMobileRecording(platform, args[1], args[2]);
            promptUser();
            break;

          case 'switch':
            await this.switchPlatform();
            promptUser();
            break;

          case 'stop':
            await this.stopCurrentPlatform();
            promptUser();
            break;

          case 'save':
            await this.stopCurrentPlatform();
            await this.saveTestCase();
            rl.close();
            break;

          case 'help':
            this.showHelp();
            promptUser();
            break;

          case 'status':
            this.showStatus();
            promptUser();
            break;

          default:
            console.log('❌ Unknown command. Type "help" for available commands.');
            promptUser();
        }
      });
    };

    promptUser();
  }

  private async startWebRecording(url: string): Promise<void> {
    if (this.currentPlatform) {
      console.log('⚠️  Already recording on another platform. Use "stop" first.');
      return;
    }

    console.log(`\n🌐 Starting Web Recording on ${url}...`);

    this.webRecorder = new WebRecorder({
      platform: PlatformType.WEB,
      outputPath: this.outputPath,
      startUrl: url,
      screenshotOnAction: true,
      headless: false
    });

    await this.webRecorder.start(url);
    this.currentPlatform = PlatformType.WEB;

    console.log('✅ Web recording started!');
    console.log('💡 Interact with the browser. Type "stop" when done.');
  }

  private async startDesktopRecording(): Promise<void> {
    if (this.currentPlatform) {
      console.log('⚠️  Already recording on another platform. Use "stop" first.');
      return;
    }

    console.log('\n🖥️  Starting Desktop Recording...');

    this.desktopRecorder = new DesktopRecorder({
      platform: PlatformType.DESKTOP,
      outputPath: this.outputPath,
      screenshotOnAction: true
    });

    await this.desktopRecorder.start();
    this.currentPlatform = PlatformType.DESKTOP;

    console.log('✅ Desktop recording started!');
    console.log('💡 Use programmatic recording or type "stop" when done.');
  }

  private async startMobileRecording(
    platform: 'android' | 'ios',
    appPackage?: string,
    appActivity?: string
  ): Promise<void> {
    if (this.currentPlatform) {
      console.log('⚠️  Already recording on another platform. Use "stop" first.');
      return;
    }

    console.log(`\n📱 Starting ${platform.toUpperCase()} Recording...`);

    this.mobileRecorder = new MobileRecorder({
      platform: PlatformType.MOBILE,
      outputPath: this.outputPath,
      deviceType: platform,
      appPackage: appPackage || (platform === 'android' ? 'com.android.settings' : undefined),
      appActivity: appActivity || '.Settings',
      bundleId: platform === 'ios' ? 'com.apple.Preferences' : undefined,
      screenshotOnAction: true
    });

    await this.mobileRecorder.start();
    this.currentPlatform = PlatformType.MOBILE;

    console.log('✅ Mobile recording started!');
    console.log('💡 Type "stop" when done recording mobile actions.');
  }

  private async stopCurrentPlatform(): Promise<void> {
    if (!this.currentPlatform) {
      console.log('⚠️  No active recording to stop.');
      return;
    }

    console.log(`\n⏹️  Stopping ${this.currentPlatform} recording...`);

    let testCase: TestCase | null = null;

    try {
      switch (this.currentPlatform) {
        case PlatformType.WEB:
          if (this.webRecorder) {
            testCase = await this.webRecorder.stop();
            this.webRecorder = null;
          }
          break;

        case PlatformType.DESKTOP:
          if (this.desktopRecorder) {
            testCase = await this.desktopRecorder.stop();
            this.desktopRecorder = null;
          }
          break;

        case PlatformType.MOBILE:
          if (this.mobileRecorder) {
            testCase = await this.mobileRecorder.stop();
            this.mobileRecorder = null;
          }
          break;
      }

      // Merge actions from this platform
      if (testCase && testCase.actions.length > 0) {
        this.allActions.push(...testCase.actions);
        console.log(`✅ Captured ${testCase.actions.length} actions from ${this.currentPlatform}`);
      }

      this.currentPlatform = null;
      console.log('✅ Platform recording stopped.');

    } catch (error: any) {
      console.error(`❌ Error stopping recorder: ${error.message}`);
    }
  }

  private async switchPlatform(): Promise<void> {
    console.log('\n🔄 Switch Platform');
    console.log('   Current platform will be stopped and actions saved.');
    console.log('   Then you can start recording on a different platform.');

    await this.stopCurrentPlatform();

    console.log('\n💡 Now use one of these commands:');
    console.log('   web <url>');
    console.log('   desktop');
    console.log('   mobile android');
    console.log('   mobile ios');
  }

  private async saveTestCase(): Promise<void> {
    console.log('\n💾 Saving cross-platform test case...');

    if (this.allActions.length === 0) {
      console.log('⚠️  No actions recorded. Test case not saved.');
      return;
    }

    // Count actions by platform
    const platformCounts = {
      web: this.allActions.filter(a => a.platform === PlatformType.WEB).length,
      desktop: this.allActions.filter(a => a.platform === PlatformType.DESKTOP).length,
      mobile: this.allActions.filter(a => a.platform === PlatformType.MOBILE).length
    };

    // Determine primary platform (most actions)
    const primaryPlatform = Object.entries(platformCounts)
      .sort(([, a], [, b]) => b - a)[0][0] as 'web' | 'desktop' | 'mobile';

    const testCase: TestCase = {
      id: this.testCaseId,
      name: this.testCaseName,
      description: this.testCaseDescription,
      platform: PlatformType.WEB, // Will be marked as cross-platform
      actions: this.allActions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['cross-platform', 'web', 'desktop', 'mobile'].filter(tag => {
        if (tag === 'cross-platform') return true;
        if (tag === 'web') return platformCounts.web > 0;
        if (tag === 'desktop') return platformCounts.desktop > 0;
        if (tag === 'mobile') return platformCounts.mobile > 0;
        return false;
      })
    };

    // Save to file
    const testCasePath = path.join(this.outputPath, `${this.testCaseId}.json`);
    fs.writeFileSync(testCasePath, JSON.stringify(testCase, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('✅ CROSS-PLATFORM TEST CASE SAVED!');
    console.log('='.repeat(70));
    console.log(`📁 File: ${testCasePath}`);
    console.log(`📊 Total Actions: ${this.allActions.length}`);
    console.log(`   🌐 Web: ${platformCounts.web} actions`);
    console.log(`   🖥️  Desktop: ${platformCounts.desktop} actions`);
    console.log(`   📱 Mobile: ${platformCounts.mobile} actions`);
    console.log('='.repeat(70) + '\n');
  }

  private showHelp(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📖 UNIFIED RECORDER - HELP');
    console.log('='.repeat(70));
    console.log('\nCommands:');
    console.log('  web <url>                    - Record web browser actions');
    console.log('                                 Example: web https://github.com');
    console.log('');
    console.log('  desktop                      - Record desktop application');
    console.log('');
    console.log('  mobile android [package]     - Record Android app');
    console.log('                                 Example: mobile android com.example.app');
    console.log('');
    console.log('  mobile ios [bundleId]        - Record iOS app');
    console.log('                                 Example: mobile ios com.example.app');
    console.log('');
    console.log('  switch                       - Stop current and switch platform');
    console.log('');
    console.log('  stop                         - Stop current platform recording');
    console.log('');
    console.log('  status                       - Show recording status');
    console.log('');
    console.log('  save                         - Save and exit');
    console.log('');
    console.log('  help                         - Show this help');
    console.log('='.repeat(70) + '\n');
  }

  private showStatus(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 RECORDING STATUS');
    console.log('='.repeat(70));
    console.log(`Test Case ID: ${this.testCaseId}`);
    console.log(`Test Name: ${this.testCaseName}`);
    console.log(`Total Actions: ${this.allActions.length}`);
    console.log(`Current Platform: ${this.currentPlatform || 'None'}`);
    console.log(`Recording: ${this.recording ? 'Yes' : 'No'}`);
    console.log('='.repeat(70) + '\n');
  }
}

// CLI usage
if (require.main === module) {
  const recorder = new UnifiedRecorder(
    path.join(process.cwd(), 'recordings'),
    'My Cross-Platform Test',
    'Testing across Web, Desktop, and Mobile'
  );

  recorder.start().catch(console.error);
}
