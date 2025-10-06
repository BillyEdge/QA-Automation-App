import { ExecutionResult, TestCase } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface TestReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    totalDuration: number;
    passRate: number;
    timestamp: number;
  };
  results: ExecutionResult[];
  metadata?: {
    environment?: string;
    browser?: string;
    platform?: string;
    [key: string]: any;
  };
}

export class Reporter {
  private results: ExecutionResult[] = [];
  private metadata: Record<string, any> = {};

  addResult(result: ExecutionResult): void {
    this.results.push(result);
  }

  addResults(results: ExecutionResult[]): void {
    this.results.push(...results);
  }

  setMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  generateReport(): TestReport {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return {
      summary: {
        totalTests: this.results.length,
        passed,
        failed,
        skipped,
        totalDuration,
        passRate: this.results.length > 0 ? (passed / this.results.length) * 100 : 0,
        timestamp: Date.now()
      },
      results: this.results,
      metadata: this.metadata
    };
  }

  saveJsonReport(outputPath: string): void {
    const report = this.generateReport();
    const dir = path.dirname(outputPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📊 JSON Report saved: ${outputPath}`);
  }

  saveHtmlReport(outputPath: string): void {
    const report = this.generateReport();
    const html = this.generateHtml(report);
    const dir = path.dirname(outputPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, html);
    console.log(`📊 HTML Report saved: ${outputPath}`);
  }

  private generateHtml(report: TestReport): string {
    const date = new Date(report.summary.timestamp).toLocaleString();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Automation Test Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f7fa;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 30px;
    }
    h1 {
      color: #2c3e50;
      margin-bottom: 10px;
    }
    .timestamp {
      color: #7f8c8d;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .summary-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card.passed {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    }
    .summary-card.failed {
      background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
    }
    .summary-card.duration {
      background: linear-gradient(135deg, #4776e6 0%, #8e54e9 100%);
    }
    .summary-card h3 {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 10px;
    }
    .summary-card .value {
      font-size: 36px;
      font-weight: bold;
    }
    .results-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    .results-table th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #495057;
      border-bottom: 2px solid #dee2e6;
    }
    .results-table td {
      padding: 12px;
      border-bottom: 1px solid #dee2e6;
    }
    .status-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      display: inline-block;
    }
    .status-badge.passed {
      background: #d4edda;
      color: #155724;
    }
    .status-badge.failed {
      background: #f8d7da;
      color: #721c24;
    }
    .status-badge.skipped {
      background: #fff3cd;
      color: #856404;
    }
    .progress-bar {
      width: 100%;
      height: 20px;
      background: #e9ecef;
      border-radius: 10px;
      overflow: hidden;
      margin: 20px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #11998e 0%, #38ef7d 100%);
      transition: width 0.3s;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: 600;
    }
    .error-message {
      background: #fff5f5;
      border-left: 4px solid #e53e3e;
      padding: 12px;
      margin-top: 8px;
      border-radius: 4px;
      color: #c53030;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 QA Automation Test Report</h1>
    <div class="timestamp">Generated: ${date}</div>

    <div class="progress-bar">
      <div class="progress-fill" style="width: ${report.summary.passRate}%">
        ${report.summary.passRate.toFixed(1)}% Pass Rate
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <h3>Total Tests</h3>
        <div class="value">${report.summary.totalTests}</div>
      </div>
      <div class="summary-card passed">
        <h3>Passed</h3>
        <div class="value">${report.summary.passed}</div>
      </div>
      <div class="summary-card failed">
        <h3>Failed</h3>
        <div class="value">${report.summary.failed}</div>
      </div>
      <div class="summary-card duration">
        <h3>Total Duration</h3>
        <div class="value">${(report.summary.totalDuration / 1000).toFixed(2)}s</div>
      </div>
    </div>

    <h2>Test Results</h2>
    <table class="results-table">
      <thead>
        <tr>
          <th>Test ID</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Steps</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${report.results.map(result => `
          <tr>
            <td>${result.testCaseId.substring(0, 8)}...</td>
            <td><span class="status-badge ${result.status}">${result.status.toUpperCase()}</span></td>
            <td>${result.duration}ms</td>
            <td>${result.steps.length}</td>
            <td>
              ${result.steps.filter(s => s.status === 'passed').length} passed,
              ${result.steps.filter(s => s.status === 'failed').length} failed
              ${result.error ? `<div class="error-message">${result.error}</div>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${report.metadata && Object.keys(report.metadata).length > 0 ? `
      <h2 style="margin-top: 40px;">Environment</h2>
      <table class="results-table">
        <tbody>
          ${Object.entries(report.metadata).map(([key, value]) => `
            <tr>
              <td><strong>${key}</strong></td>
              <td>${value}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}
  </div>
</body>
</html>
    `.trim();
  }

  printConsoleSummary(): void {
    const report = this.generateReport();

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests:     ${report.summary.totalTests}`);
    console.log(`✅ Passed:        ${report.summary.passed}`);
    console.log(`❌ Failed:        ${report.summary.failed}`);
    console.log(`⏭️  Skipped:       ${report.summary.skipped}`);
    console.log(`⏱️  Total Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
    console.log(`📈 Pass Rate:     ${report.summary.passRate.toFixed(2)}%`);
    console.log('='.repeat(60) + '\n');
  }
}
