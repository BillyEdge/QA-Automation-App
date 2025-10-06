# Getting Started with QA Automation Platform

This guide will help you set up and start using the QA Automation Platform.

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (optional, for version control)

### Platform-Specific Requirements

#### Web Testing
- No additional setup required! Playwright browsers will be installed automatically.

#### Desktop Testing
- **Windows**: No additional setup
- **macOS**: Grant accessibility permissions when prompted
- **Linux**: X11 or Wayland display server

#### Mobile Testing
- **Appium**: `npm install -g appium`
- **Android**:
  - Android SDK installed
  - ADB configured in PATH
  - Android emulator or physical device
  - USB debugging enabled (for physical devices)
- **iOS**:
  - macOS required
  - Xcode installed
  - iOS Simulator or physical device
  - For physical devices: Developer certificate and provisioning profile

## 🚀 Installation

### Step 1: Install Dependencies

```bash
cd "QA Automation"
npm install
```

This will install all required packages including:
- Playwright (for web testing)
- Appium WebdriverIO (for mobile testing)
- nut-js (for desktop automation)
- Electron (for the UI)
- TypeScript and other development tools

### Step 2: Build the Project

```bash
npm run build
```

This compiles the TypeScript code to JavaScript in the `dist` folder.

### Step 3: Verify Installation

```bash
# Check if the CLI is working
npm run dev -- --help
```

You should see a list of available commands.

## 🎯 Your First Test

### Option 1: Using the Graphical UI (Recommended for Beginners)

1. **Launch the UI**
   ```bash
   npm run ui
   ```

2. **Record a Web Test**
   - Select "Web" platform
   - Enter a URL (e.g., `https://www.wikipedia.org`)
   - Click "Start Recording"
   - Interact with the browser (click, type, navigate)
   - Click "Stop Recording" when done

3. **Execute the Test**
   - Go to "Test Executor" tab
   - Enter the path to your test file (shown after recording)
   - Click "Execute Test"

### Option 2: Using the Command Line

#### Record a Web Test

```bash
# Start recording a website
npm run dev -- record:web --url https://www.wikipedia.org
```

A browser window will open with a red "Recording..." indicator. Interact with the page:
- Click on links
- Type in search boxes
- Navigate to different pages
- Fill out forms

Press `Ctrl+C` in the terminal when done. Your test will be saved in the `recordings` folder.

#### Execute the Test

```bash
# Replace with your actual test file name
npm run dev -- execute recordings/your-test-id.json
```

## 📱 Mobile Testing Setup

### Setting Up Appium

1. **Install Appium**
   ```bash
   npm install -g appium
   ```

2. **Install Drivers**
   ```bash
   # For Android
   appium driver install uiautomator2

   # For iOS (macOS only)
   appium driver install xcuitest
   ```

3. **Start Appium Server**
   ```bash
   appium
   ```
   Keep this terminal window open while recording/executing mobile tests.

### Android Testing

1. **Start an Emulator or Connect a Device**
   ```bash
   # List available devices
   adb devices
   ```

2. **Record a Test**
   ```bash
   npm run dev -- record:mobile --device android --package com.android.settings
   ```

### iOS Testing

1. **Start iOS Simulator**
   ```bash
   open -a Simulator
   ```

2. **Record a Test**
   ```bash
   npm run dev -- record:mobile --device ios --package com.apple.Preferences
   ```

## 🖥️ Desktop Testing

Desktop recording requires programmatic interaction due to security restrictions:

```bash
npm run dev -- record:desktop
```

Then use the API to record actions (see examples folder).

## 📊 Working with Test Cases

### List All Tests

```bash
npm run dev -- list
```

### Execute Multiple Tests

```bash
npm run dev -- execute:batch "recordings/*.json" --report reports/batch-report.json
```

### View Reports

After execution, reports are generated in the `reports` folder:
- Open the HTML report in your browser for a visual summary
- Use the JSON report for CI/CD integration

## 💡 Examples

Check the `examples` folder for complete working examples:

- `example-web-test.ts` - Web testing walkthrough
- `example-mobile-test.ts` - Mobile testing for Android and iOS

Run an example:
```bash
npx ts-node examples/example-web-test.ts
```

## 🔧 Common Commands

```bash
# Web recording
npm run recorder:web

# Desktop recording
npm run recorder:desktop

# Mobile recording (Android)
npm run recorder:mobile android com.example.app

# Execute a test
npm run execute recordings/test-id.json

# Launch UI
npm run ui

# Build project
npm run build

# Development mode
npm run dev
```

## 🐛 Troubleshooting

### Web Tests

**Issue**: Browser doesn't launch
- **Solution**: Run `npx playwright install` to install browser binaries

**Issue**: Elements not found
- **Solution**: Increase wait times or use more specific selectors

### Mobile Tests

**Issue**: "Could not connect to Appium server"
- **Solution**: Make sure Appium is running on `localhost:4723`

**Issue**: "No devices found"
- **Solution**:
  - Android: Run `adb devices` to check connected devices
  - iOS: Make sure iOS Simulator is running

**Issue**: App doesn't launch
- **Solution**: Verify app package/bundle ID is correct

### Desktop Tests

**Issue**: Actions not working
- **Solution**: Grant accessibility permissions in system settings

## 📚 Next Steps

1. **Explore the Documentation**: Read [README.md](README.md) for detailed API documentation
2. **Customize Test Cases**: Edit recorded JSON files to add custom actions
3. **CI/CD Integration**: Use JSON reports in your build pipeline
4. **Advanced Features**: Explore assertions, waits, and conditional logic

## 🤝 Need Help?

- Check the examples in the `examples` folder
- Review test case JSON files in `recordings` folder to understand the format
- Refer to the API documentation in source files

## 🎓 Learning Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Appium Documentation](http://appium.io/docs/en/latest/)
- [WebDriverIO Documentation](https://webdriver.io/docs/gettingstarted)

---

Happy Testing! 🚀
