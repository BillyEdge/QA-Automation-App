# Quick Start Guide

The QA Automation Platform is ready to use! The UI requires additional Electron configuration, but you can use the powerful **command-line interface** right away.

## ✅ Installation Complete

Your installation is successful! All core features are working:
- ✅ Web Recording & Playback
- ✅ Desktop Recording & Playback
- ✅ Mobile Recording & Playback (requires Appium)
- ✅ Test Execution Engine
- ✅ Report Generation

## 🚀 Quick Examples

### 1. Record a Web Test

```bash
npm run dev -- record:web --url https://www.example.com
```

This will:
- Open a Chrome browser
- Show a red "Recording..." indicator
- Record all your interactions (clicks, typing, navigation)
- Press `Ctrl+C` to stop and save the test

### 2. List Your Recorded Tests

```bash
npm run dev -- list
```

### 3. Execute a Test

```bash
npm run dev -- execute recordings/YOUR-TEST-ID.json
```

Replace `YOUR-TEST-ID` with the actual test file name from the `list` command.

### 4. Execute All Tests

```bash
npm run dev -- execute:batch "recordings/*.json" --report reports/batch-report.json
```

## 📱 Mobile Testing

### Prerequisites
- Install Appium: `npm install -g appium`
- Install drivers:
  ```bash
  appium driver install uiautomator2  # For Android
  appium driver install xcuitest       # For iOS (macOS only)
  ```
- Start Appium: `appium` (keep running in a separate terminal)

### Record Android Test

```bash
# Start Android emulator or connect device first
adb devices

# Record test (using Settings app as example)
npm run dev -- record:mobile --device android --package com.android.settings
```

### Record iOS Test (macOS only)

```bash
# Start iOS Simulator first
open -a Simulator

# Record test
npm run dev -- record:mobile --device ios --package com.apple.Preferences
```

## 🖥️ Desktop Testing

Desktop recording works programmatically. See the examples folder:

```bash
npx ts-node examples/example-web-test.ts
```

## 📊 Viewing Reports

After executing tests with the `--report` flag, you'll get:
- **JSON Report**: Machine-readable for CI/CD
- **HTML Report**: Open in browser for beautiful visualizations

Example to generate HTML report:

```bash
# Execute and generate reports
npm run dev -- execute recordings/test.json

# The executor will generate a JSON report
# You can open it or integrate with your CI/CD
```

## 💡 Pro Tips

1. **Use descriptive URLs**: When recording web tests, use clear starting URLs
2. **Wait times**: Add wait times between actions for stability
3. **Element selectors**: Tests use CSS selectors by default
4. **Screenshots**: Every action captures a screenshot (stored in `recordings/screenshots/`)
5. **Batch execution**: Run all tests with glob patterns

## 🔧 Troubleshooting

### Web Tests
**Browser doesn't launch?**
```bash
npx playwright install
```

### Mobile Tests
**Can't connect to Appium?**
- Make sure Appium server is running: `appium`
- Check it's on port 4723: `http://localhost:4723`

**No devices found?**
- Android: `adb devices` should show your device
- iOS: Make sure Simulator is running

### Desktop Tests
**Actions not working?**
- Grant accessibility permissions in system settings
- Windows: Run as administrator if needed

## 📚 Next Steps

1. ✅ **Try the examples**: Check the `examples/` folder
2. ✅ **Read full docs**: See [README.md](README.md) for complete documentation
3. ✅ **Customize tests**: Edit the JSON files in `recordings/`
4. ✅ **CI/CD Integration**: Use JSON reports in your pipeline

## 📖 Command Reference

```bash
# Recording
npm run dev -- record:web [options]
npm run dev -- record:desktop [options]
npm run dev -- record:mobile [options]

# Execution
npm run dev -- execute <testfile>
npm run dev -- execute:batch <pattern>

# Management
npm run dev -- list
npm run dev -- --help
```

## ⚡ Example Workflow

```bash
# 1. Record a test
npm run dev -- record:web --url https://github.com

# 2. List tests to get the test ID
npm run dev -- list

# 3. Execute the test
npm run dev -- execute recordings/abc-123-def.json

# 4. Run all tests
npm run dev -- execute:batch "recordings/*.json"
```

---

**You're all set! Start recording your first test now! 🎉**

For questions or issues, check [GETTING_STARTED.md](GETTING_STARTED.md) or the [README.md](README.md).
