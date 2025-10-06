import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { WebRecorder } from '../recorders/web/webRecorder';
import { DesktopRecorder } from '../recorders/desktop/desktopRecorder';
import { MobileRecorder } from '../recorders/mobile/mobileRecorder';
import { TestExecutor } from '../executor/testExecutor';
import { PlatformType } from '../types';

let mainWindow: BrowserWindow | null = null;
let currentRecorder: WebRecorder | DesktopRecorder | MobileRecorder | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'QA Automation Platform'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('start-web-recording', async (event, config) => {
  try {
    currentRecorder = new WebRecorder({
      platform: PlatformType.WEB,
      outputPath: config.outputPath,
      startUrl: config.startUrl,
      browser: config.browser,
      screenshotOnAction: config.screenshotOnAction
    });

    await (currentRecorder as WebRecorder).start();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-desktop-recording', async (event, config) => {
  try {
    currentRecorder = new DesktopRecorder({
      platform: PlatformType.DESKTOP,
      outputPath: config.outputPath,
      screenshotOnAction: config.screenshotOnAction
    });

    await (currentRecorder as DesktopRecorder).start();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-mobile-recording', async (event, config) => {
  try {
    currentRecorder = new MobileRecorder({
      platform: PlatformType.MOBILE,
      outputPath: config.outputPath,
      deviceType: config.deviceType,
      deviceName: config.deviceName,
      appPackage: config.appPackage,
      appActivity: config.appActivity,
      bundleId: config.bundleId,
      screenshotOnAction: config.screenshotOnAction
    });

    await (currentRecorder as MobileRecorder).start();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-recording', async () => {
  try {
    if (!currentRecorder) {
      return { success: false, error: 'No active recording' };
    }

    const testCase = await currentRecorder.stop();
    currentRecorder = null;

    return { success: true, testCase };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('execute-test', async (event, testCaseFilePath) => {
  try {
    const executor = new TestExecutor();
    const result = await executor.executeFromFile(testCaseFilePath);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('execute-batch', async (event, testCaseFilePaths) => {
  try {
    const executor = new TestExecutor();
    const results = await executor.executeBatch(testCaseFilePaths);
    return { success: true, results };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
