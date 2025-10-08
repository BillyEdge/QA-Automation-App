// Core types for the automation platform

export enum PlatformType {
  WEB = 'web',
  DESKTOP = 'desktop',
  MOBILE = 'mobile'
}

export enum ActionType {
  CLICK = 'click',
  TYPE = 'type',
  SELECT = 'select',
  HOVER = 'hover',
  NAVIGATE = 'navigate',
  WAIT = 'wait',
  WAIT_FOR_ELEMENT = 'wait_for_element',
  ASSERT = 'assert',
  SCREENSHOT = 'screenshot',
  DRAG_DROP = 'drag_drop',
  SWIPE = 'swipe',
  TAP = 'tap',
  SCROLL = 'scroll',
  PRESS_KEY = 'press_key',
  CUSTOM = 'custom'
}

export interface ElementLocator {
  type: 'css' | 'xpath' | 'id' | 'name' | 'text' | 'accessibility_id' | 'coordinates' | 'placeholder' | 'role';
  value: string;
  fallbacks?: ElementLocator[];
}

export interface TestAction {
  id: string;
  timestamp: number;
  platform: PlatformType;
  type: ActionType;
  target?: ElementLocator;
  value?: any;
  objectId?: string;
  screenshot?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  platform: PlatformType;
  actions: TestAction[];
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

export interface ExecutionResult {
  testCaseId: string;
  status: 'passed' | 'failed' | 'skipped';
  startTime: number;
  endTime: number;
  duration: number;
  steps: StepResult[];
  screenshots?: string[];
  error?: string;
  logs?: string[];
}

export interface StepResult {
  actionId: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
  action?: string;  // Action type (click, type, etc.)
  object?: string;  // Object/element description
}

export interface RecorderConfig {
  platform: PlatformType;
  outputPath: string;
  screenshotOnAction?: boolean;
  highlightElements?: boolean;
  captureNetwork?: boolean;
}

export interface WebRecorderConfig extends RecorderConfig {
  browser?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  startUrl?: string;
  testName?: string;
  continueExisting?: boolean;
}

export interface DesktopRecorderConfig extends RecorderConfig {
  applicationPath?: string;
  windowTitle?: string;
}

export interface MobileRecorderConfig extends RecorderConfig {
  deviceType: 'android' | 'ios';
  deviceName?: string;
  appPackage?: string;
  appActivity?: string;
  bundleId?: string;
}
