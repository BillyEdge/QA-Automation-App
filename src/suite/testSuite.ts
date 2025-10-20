import { TestCase, ExecutionResult } from '../types';
import { TestExecutor } from '../executor/testExecutor';
import { Reporter } from '../reporting/reporter';
import * as fs from 'fs';
import * as path from 'path';

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCases: string[]; // Array of test case file paths
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export class TestSuiteManager {
  private suitesDir: string;

  constructor(suitesDir: string = './test-suites') {
    this.suitesDir = suitesDir;
    if (!fs.existsSync(suitesDir)) {
      fs.mkdirSync(suitesDir, { recursive: true });
    }
  }

  /**
   * Create a new test suite
   */
  createSuite(name: string, description: string, testCaseFiles: string[], tags?: string[]): TestSuite {
    const suite: TestSuite = {
      id: `suite-${Date.now()}`,
      name,
      description,
      testCases: testCaseFiles,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.saveSuite(suite);
    return suite;
  }

  /**
   * Save a test suite to disk
   */
  saveSuite(suite: TestSuite): void {
    const filePath = path.join(this.suitesDir, `${suite.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(suite, null, 2));
    console.log(`✅ Test suite saved: ${filePath}`);
  }

  /**
   * Load a test suite from disk
   * Supports both flat file structure and folder-based structure
   */
  loadSuite(suiteId: string): TestSuite {
    // Try folder-based structure first (test-suites/suite-name/suite-config.json)
    const folderConfigPath = path.join(this.suitesDir, suiteId, 'suite-config.json');
    if (fs.existsSync(folderConfigPath)) {
      const content = fs.readFileSync(folderConfigPath, 'utf-8');
      const config = JSON.parse(content);

      // If config doesn't have testCases array, scan the tests folder
      if (!config.testCases || config.testCases.length === 0) {
        const testsDir = path.join(this.suitesDir, suiteId, 'tests');
        if (fs.existsSync(testsDir)) {
          const testFiles = fs.readdirSync(testsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => path.join(testsDir, f));
          config.testCases = testFiles;
        } else {
          config.testCases = [];
        }
      }

      // Ensure required fields exist
      config.id = config.id || suiteId;
      config.name = config.name || suiteId;
      config.description = config.description || '';
      config.createdAt = config.createdAt ? new Date(config.createdAt).getTime() : Date.now();
      config.updatedAt = config.updatedAt ? new Date(config.updatedAt).getTime() : Date.now();

      return config;
    }

    // Fall back to flat file structure (test-suites/suite-id.json)
    const filePath = path.join(this.suitesDir, `${suiteId}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }

    throw new Error(`Suite not found: ${suiteId}`);
  }

  /**
   * List all test suites
   */
  listSuites(): TestSuite[] {
    const files = fs.readdirSync(this.suitesDir)
      .filter(f => f.endsWith('.json'));

    return files.map(file => {
      const content = fs.readFileSync(path.join(this.suitesDir, file), 'utf-8');
      return JSON.parse(content);
    });
  }

  /**
   * Add test cases to an existing suite
   */
  addTestCases(suiteId: string, testCaseFiles: string[]): TestSuite {
    const suite = this.loadSuite(suiteId);
    suite.testCases.push(...testCaseFiles);
    suite.updatedAt = Date.now();
    this.saveSuite(suite);
    return suite;
  }

  /**
   * Remove test cases from a suite
   */
  removeTestCases(suiteId: string, testCaseFiles: string[]): TestSuite {
    const suite = this.loadSuite(suiteId);
    suite.testCases = suite.testCases.filter(tc => !testCaseFiles.includes(tc));
    suite.updatedAt = Date.now();
    this.saveSuite(suite);
    return suite;
  }

  /**
   * Execute an entire test suite
   */
  async executeSuite(suiteId: string, reportPath?: string, loopCount: number = 1): Promise<ExecutionResult[]> {
    const suite = this.loadSuite(suiteId);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Executing Test Suite: ${suite.name}`);
    console.log(`📝 Description: ${suite.description}`);
    console.log(`📊 Test Cases: ${suite.testCases.length}`);
    console.log(`🔁 Loop Count: ${loopCount}`);
    console.log(`${'='.repeat(60)}\n`);

    const executor = new TestExecutor();
    const reporter = new Reporter();

    const results: ExecutionResult[] = [];

    // Loop through entire suite
    for (let loop = 0; loop < loopCount; loop++) {
      if (loopCount > 1) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`🔄 Suite Loop ${loop + 1}/${loopCount}`);
        console.log(`${'─'.repeat(60)}\n`);
      }

      for (let i = 0; i < suite.testCases.length; i++) {
        const testCaseFile = suite.testCases[i];
        console.log(`\n[${i + 1}/${suite.testCases.length}] Executing: ${path.basename(testCaseFile)}`);

        try {
          const result = await executor.executeFromFile(testCaseFile);
          results.push(result);
          reporter.addResult(result);

          const status = result.status === 'passed' ? '✅' : '❌';
          console.log(`${status} ${result.status.toUpperCase()} (${result.duration}ms)`);
        } catch (error: any) {
          console.error(`❌ ERROR: ${error.message}`);
        }
      }
    }

    // Generate report
    reporter.setMetadata('suite_id', suite.id);
    reporter.setMetadata('suite_name', suite.name);
    reporter.setMetadata('suite_description', suite.description);
    reporter.setMetadata('loop_count', loopCount);

    reporter.printConsoleSummary();

    if (reportPath) {
      reporter.saveJsonReport(reportPath);
      reporter.saveHtmlReport(reportPath.replace('.json', '.html'));
    }

    return results;
  }

  /**
   * Delete a test suite
   */
  deleteSuite(suiteId: string): void {
    const filePath = path.join(this.suitesDir, `${suiteId}.json`);
    fs.unlinkSync(filePath);
    console.log(`🗑️  Test suite deleted: ${suiteId}`);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new TestSuiteManager();

  (async () => {
    switch (command) {
      case 'create':
        const name = args[1];
        const description = args[2];
        const testFiles = args.slice(3);
        const suite = manager.createSuite(name, description, testFiles);
        console.log(`✅ Created suite: ${suite.id}`);
        break;

      case 'list':
        const suites = manager.listSuites();
        console.log(`\n📋 Test Suites (${suites.length}):\n`);
        suites.forEach(s => {
          console.log(`  ${s.name} (${s.id})`);
          console.log(`    Description: ${s.description}`);
          console.log(`    Test Cases: ${s.testCases.length}`);
          console.log(`    Created: ${new Date(s.createdAt).toLocaleString()}`);
          console.log('');
        });
        break;

      case 'execute':
        const suiteId = args[1];
        const reportPath = args[2] || `./reports/suite-${suiteId}-report.json`;
        await manager.executeSuite(suiteId, reportPath);
        break;

      case 'add':
        const addSuiteId = args[1];
        const addFiles = args.slice(2);
        manager.addTestCases(addSuiteId, addFiles);
        console.log(`✅ Added ${addFiles.length} test case(s) to suite`);
        break;

      case 'delete':
        const deleteSuiteId = args[1];
        manager.deleteSuite(deleteSuiteId);
        break;

      default:
        console.log(`
Test Suite Manager

Usage:
  create <name> <description> <test-file1> [test-file2] ...
  list
  execute <suite-id> [report-path]
  add <suite-id> <test-file1> [test-file2] ...
  delete <suite-id>

Examples:
  ts-node src/suite/testSuite.ts create "Smoke Tests" "Critical functionality tests" recordings/test1.json recordings/test2.json
  ts-node src/suite/testSuite.ts list
  ts-node src/suite/testSuite.ts execute suite-123456789
        `);
    }
  })();
}
