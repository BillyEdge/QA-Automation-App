/**
 * Example: Web Testing with Recorder
 *
 * This example shows how to use the WebRecorder to record
 * browser interactions and save them as a test case.
 */

import { WebRecorder } from '../src/recorders/web/webRecorder';
import { TestExecutor } from '../src/executor/testExecutor';
import { PlatformType } from '../src/types';
import * as path from 'path';

async function main() {
  console.log('🎬 Web Testing Example\n');

  // Create recorder instance
  const recorder = new WebRecorder({
    platform: PlatformType.WEB,
    outputPath: path.join(__dirname, '../recordings'),
    startUrl: 'https://example.com',
    browser: 'chromium',
    screenshotOnAction: true,
    headless: false
  });

  // Start recording
  console.log('Starting web recorder...');
  await recorder.start();

  console.log('\n✅ Recorder started!');
  console.log('📝 Now interact with the browser to record actions');
  console.log('💡 Actions like clicks, typing, navigation will be recorded');
  console.log('⏹️  Press Ctrl+C to stop recording\n');

  // Wait for user to interact and press Ctrl+C
  await new Promise((resolve) => {
    process.on('SIGINT', resolve);
  });

  // Stop recording and get the test case
  const testCase = await recorder.stop();

  console.log('\n✅ Recording complete!');
  console.log(`📁 Test case saved with ${testCase.actions.length} actions`);

  // Optional: Execute the recorded test immediately
  console.log('\n🚀 Executing the recorded test...\n');

  const executor = new TestExecutor();
  const testCaseFile = path.join(__dirname, '../recordings', `${testCase.id}.json`);
  const result = await executor.executeFromFile(testCaseFile);

  console.log(`\n${result.status === 'passed' ? '✅' : '❌'} Test ${result.status}`);
  console.log(`⏱️  Duration: ${result.duration}ms`);
  console.log(`📊 Steps: ${result.steps.filter(s => s.status === 'passed').length}/${result.steps.length} passed`);

  // Generate report
  executor.generateReport(path.join(__dirname, '../reports/example-report.json'));

  process.exit(result.status === 'passed' ? 0 : 1);
}

// Handle errors
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
