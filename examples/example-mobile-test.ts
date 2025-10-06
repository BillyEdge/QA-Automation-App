/**
 * Example: Mobile Testing with Recorder
 *
 * This example demonstrates recording mobile app interactions
 * for both Android and iOS platforms.
 *
 * Prerequisites:
 * - Appium server running on localhost:4723
 * - Android emulator/device or iOS simulator/device
 * - App installed on the device
 */

import { MobileRecorder } from '../src/recorders/mobile/mobileRecorder';
import { TestExecutor } from '../src/executor/testExecutor';
import { PlatformType } from '../src/types';
import * as path from 'path';

async function androidExample() {
  console.log('📱 Android Mobile Testing Example\n');

  const recorder = new MobileRecorder({
    platform: PlatformType.MOBILE,
    outputPath: path.join(__dirname, '../recordings'),
    deviceType: 'android',
    deviceName: 'emulator-5554', // Change to your device name
    appPackage: 'com.android.settings', // Example: Settings app
    appActivity: '.Settings',
    screenshotOnAction: true
  });

  try {
    console.log('Starting mobile recorder...');
    await recorder.start();

    console.log('✅ Recorder started! Recording actions...\n');

    // Example: Record some actions
    // Wait for app to load
    await recorder.addWait(2000);

    // Tap on an element by accessibility ID
    await recorder.recordTapElement('Network & internet', 'accessibility_id');
    await recorder.addWait(1000);

    // Scroll down
    await recorder.recordScroll('down', 500);
    await recorder.addWait(500);

    // Take a screenshot
    await recorder.addScreenshot('After scrolling');

    // Swipe gesture
    await recorder.recordSwipe(500, 1000, 500, 300, 1000);
    await recorder.addWait(1000);

    // Stop and save
    const testCase = await recorder.stop();

    console.log(`\n✅ Recording complete! Saved ${testCase.actions.length} actions`);
    console.log(`📁 File: ${testCase.id}.json\n`);

    return testCase;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

async function iosExample() {
  console.log('📱 iOS Mobile Testing Example\n');

  const recorder = new MobileRecorder({
    platform: PlatformType.MOBILE,
    outputPath: path.join(__dirname, '../recordings'),
    deviceType: 'ios',
    deviceName: 'iPhone 14', // Change to your device/simulator name
    bundleId: 'com.apple.Preferences', // Example: Settings app
    screenshotOnAction: true
  });

  try {
    console.log('Starting iOS recorder...');
    await recorder.start();

    console.log('✅ Recorder started! Recording actions...\n');

    // Wait for app to load
    await recorder.addWait(2000);

    // Tap on an element
    await recorder.recordTapElement('General', 'accessibility_id');
    await recorder.addWait(1000);

    // Scroll
    await recorder.recordScroll('down', 500);
    await recorder.addWait(500);

    // Stop and save
    const testCase = await recorder.stop();

    console.log(`\n✅ Recording complete! Saved ${testCase.actions.length} actions`);
    console.log(`📁 File: ${testCase.id}.json\n`);

    return testCase;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

async function main() {
  // Get platform from command line or default to android
  const platform = process.argv[2] || 'android';

  console.log(`\n${'='.repeat(60)}`);
  console.log('Mobile Test Recording Example');
  console.log(`Platform: ${platform.toUpperCase()}`);
  console.log(`${'='.repeat(60)}\n`);

  // Check if Appium is running
  console.log('📋 Prerequisites:');
  console.log('   1. Appium server running on localhost:4723');
  console.log('   2. Device/emulator/simulator ready');
  console.log('   3. App installed on device\n');

  let testCase;

  if (platform === 'android') {
    testCase = await androidExample();
  } else if (platform === 'ios') {
    testCase = await iosExample();
  } else {
    console.error('❌ Invalid platform. Use "android" or "ios"');
    process.exit(1);
  }

  // Optional: Execute the recorded test
  console.log('🚀 Executing the recorded test...\n');

  const executor = new TestExecutor();
  const testCaseFile = path.join(__dirname, '../recordings', `${testCase.id}.json`);
  const result = await executor.executeFromFile(testCaseFile);

  console.log(`\n${result.status === 'passed' ? '✅' : '❌'} Test ${result.status}`);
  console.log(`⏱️  Duration: ${result.duration}ms`);

  process.exit(result.status === 'passed' ? 0 : 1);
}

// Run the example
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
