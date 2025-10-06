import { Page } from 'playwright';
import { Browser } from 'webdriverio';
import { ElementLocator, PlatformType } from '../types';
import { ObjectRepositoryManager, UIObject } from '../repository/objectRepository';

/**
 * Self-Healing Engine - Like TestSigma
 * Automatically fix broken selectors when elements change
 */

export interface HealingStrategy {
  name: string;
  priority: number;
  findElement: (context: any, originalLocator: ElementLocator, attributes?: any) => Promise<any>;
}

export interface HealingResult {
  success: boolean;
  element?: any;
  usedLocator?: ElementLocator;
  strategyUsed?: string;
  originalLocatorFailed: boolean;
  healingApplied: boolean;
  suggestedUpdate?: ElementLocator;
}

export class SelfHealingEngine {
  private objectRepository?: ObjectRepositoryManager;
  private healingEnabled: boolean = true;
  private healingLog: Array<{
    timestamp: number;
    objectName?: string;
    originalLocator: ElementLocator;
    healedLocator?: ElementLocator;
    strategy: string;
  }> = [];

  constructor(objectRepository?: ObjectRepositoryManager) {
    this.objectRepository = objectRepository;
  }

  /**
   * Enable/disable self-healing
   */
  setHealingEnabled(enabled: boolean): void {
    this.healingEnabled = enabled;
    console.log(`🔧 Self-healing ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Find element with self-healing for Web (Playwright)
   */
  async findElementWeb(
    page: Page,
    locator: ElementLocator,
    attributes?: any,
    objectName?: string
  ): Promise<HealingResult> {
    // Try original locator first
    try {
      const element = await page.locator(locator.value);
      const count = await element.count();

      if (count > 0) {
        // Original locator works!
        return {
          success: true,
          element,
          usedLocator: locator,
          originalLocatorFailed: false,
          healingApplied: false
        };
      }
    } catch (error) {
      console.log(`⚠️  Original locator failed: ${locator.value}`);
    }

    // Original failed - try self-healing
    if (!this.healingEnabled) {
      return {
        success: false,
        originalLocatorFailed: true,
        healingApplied: false
      };
    }

    console.log(`🔍 Attempting self-healing for: ${objectName || locator.value}`);

    // Strategy 1: Try fallback locators
    if (locator.fallbacks && locator.fallbacks.length > 0) {
      for (const fallback of locator.fallbacks) {
        try {
          const element = await page.locator(fallback.value);
          const count = await element.count();

          if (count > 0) {
            console.log(`✅ Healed using fallback: ${fallback.value}`);
            this.logHealing(locator, fallback, 'fallback', objectName);

            return {
              success: true,
              element,
              usedLocator: fallback,
              originalLocatorFailed: true,
              healingApplied: true,
              strategyUsed: 'fallback',
              suggestedUpdate: fallback
            };
          }
        } catch {}
      }
    }

    // Strategy 2: Try by text content
    if (attributes?.text) {
      try {
        const element = page.getByText(attributes.text);
        const count = await element.count();

        if (count > 0) {
          const newLocator: ElementLocator = {
            type: 'text',
            value: attributes.text
          };

          console.log(`✅ Healed using text: "${attributes.text}"`);
          this.logHealing(locator, newLocator, 'text-content', objectName);

          return {
            success: true,
            element,
            usedLocator: newLocator,
            originalLocatorFailed: true,
            healingApplied: true,
            strategyUsed: 'text-content',
            suggestedUpdate: newLocator
          };
        }
      } catch {}
    }

    // Strategy 3: Try by placeholder
    if (attributes?.placeholder) {
      try {
        const element = page.getByPlaceholder(attributes.placeholder);
        const count = await element.count();

        if (count > 0) {
          const newLocator: ElementLocator = {
            type: 'placeholder',
            value: attributes.placeholder
          };

          console.log(`✅ Healed using placeholder: "${attributes.placeholder}"`);
          this.logHealing(locator, newLocator, 'placeholder', objectName);

          return {
            success: true,
            element,
            usedLocator: newLocator,
            originalLocatorFailed: true,
            healingApplied: true,
            strategyUsed: 'placeholder',
            suggestedUpdate: newLocator
          };
        }
      } catch {}
    }

    // Strategy 4: Try by role and name
    if (attributes?.type && attributes?.text) {
      try {
        const element = page.getByRole(attributes.type as any, { name: attributes.text });
        const count = await element.count();

        if (count > 0) {
          const newLocator: ElementLocator = {
            type: 'role',
            value: `${attributes.type}:${attributes.text}`
          };

          console.log(`✅ Healed using role: ${attributes.type} with name "${attributes.text}"`);
          this.logHealing(locator, newLocator, 'role', objectName);

          return {
            success: true,
            element,
            usedLocator: newLocator,
            originalLocatorFailed: true,
            healingApplied: true,
            strategyUsed: 'role',
            suggestedUpdate: newLocator
          };
        }
      } catch {}
    }

    // Strategy 5: Try partial selectors (remove IDs that might have changed)
    if (locator.type === 'css' && locator.value.includes('#')) {
      try {
        // Remove dynamic IDs (anything after #)
        const withoutId = locator.value.split('#')[0];
        if (withoutId) {
          const element = await page.locator(withoutId);
          const count = await element.count();

          if (count === 1) { // Only if unique
            const newLocator: ElementLocator = {
              type: 'css',
              value: withoutId
            };

            console.log(`✅ Healed using partial selector: ${withoutId}`);
            this.logHealing(locator, newLocator, 'partial-selector', objectName);

            return {
              success: true,
              element,
              usedLocator: newLocator,
              originalLocatorFailed: true,
              healingApplied: true,
              strategyUsed: 'partial-selector',
              suggestedUpdate: newLocator
            };
          }
        }
      } catch {}
    }

    // All healing strategies failed
    console.log(`❌ Self-healing failed for: ${objectName || locator.value}`);

    return {
      success: false,
      originalLocatorFailed: true,
      healingApplied: true
    };
  }

  /**
   * Find element with self-healing for Mobile (Appium)
   */
  async findElementMobile(
    driver: Browser,
    locator: ElementLocator,
    attributes?: any,
    objectName?: string
  ): Promise<HealingResult> {
    // Try original locator first
    try {
      let element;

      switch (locator.type) {
        case 'id':
          element = await driver.$(`~${locator.value}`);
          break;
        case 'xpath':
          element = await driver.$(locator.value);
          break;
        case 'accessibility_id':
          element = await driver.$(`~${locator.value}`);
          break;
        default:
          element = await driver.$(locator.value);
      }

      const exists = await element.isDisplayed();

      if (exists) {
        return {
          success: true,
          element,
          usedLocator: locator,
          originalLocatorFailed: false,
          healingApplied: false
        };
      }
    } catch (error) {
      console.log(`⚠️  Original locator failed: ${locator.value}`);
    }

    // Try self-healing
    if (!this.healingEnabled) {
      return {
        success: false,
        originalLocatorFailed: true,
        healingApplied: false
      };
    }

    console.log(`🔍 Attempting mobile self-healing for: ${objectName || locator.value}`);

    // Try fallback locators
    if (locator.fallbacks && locator.fallbacks.length > 0) {
      for (const fallback of locator.fallbacks) {
        try {
          const element = await driver.$(fallback.value);
          const exists = await element.isDisplayed();

          if (exists) {
            console.log(`✅ Healed using fallback: ${fallback.value}`);
            this.logHealing(locator, fallback, 'fallback', objectName);

            return {
              success: true,
              element,
              usedLocator: fallback,
              originalLocatorFailed: true,
              healingApplied: true,
              strategyUsed: 'fallback',
              suggestedUpdate: fallback
            };
          }
        } catch {}
      }
    }

    // Try by text content
    if (attributes?.text) {
      try {
        const element = await driver.$(`//*[@text='${attributes.text}']`);
        const exists = await element.isDisplayed();

        if (exists) {
          const newLocator: ElementLocator = {
            type: 'xpath',
            value: `//*[@text='${attributes.text}']`
          };

          console.log(`✅ Healed using text: "${attributes.text}"`);
          this.logHealing(locator, newLocator, 'text-content', objectName);

          return {
            success: true,
            element,
            usedLocator: newLocator,
            originalLocatorFailed: true,
            healingApplied: true,
            strategyUsed: 'text-content',
            suggestedUpdate: newLocator
          };
        }
      } catch {}
    }

    return {
      success: false,
      originalLocatorFailed: true,
      healingApplied: true
    };
  }

  /**
   * Log healing event
   */
  private logHealing(
    originalLocator: ElementLocator,
    healedLocator: ElementLocator,
    strategy: string,
    objectName?: string
  ): void {
    this.healingLog.push({
      timestamp: Date.now(),
      objectName,
      originalLocator,
      healedLocator,
      strategy
    });
  }

  /**
   * Get healing statistics
   */
  getHealingStatistics() {
    return {
      totalHealingAttempts: this.healingLog.length,
      byStrategy: this.healingLog.reduce((acc, log) => {
        acc[log.strategy] = (acc[log.strategy] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentHealings: this.healingLog.slice(-10)
    };
  }

  /**
   * Export healing log
   */
  exportHealingLog(outputPath: string): void {
    const fs = require('fs');
    fs.writeFileSync(outputPath, JSON.stringify(this.healingLog, null, 2));
    console.log(`📊 Healing log exported to: ${outputPath}`);
  }

  /**
   * Update object repository with healed locators
   */
  suggestRepositoryUpdates(): Array<{
    objectName?: string;
    oldLocator: ElementLocator;
    newLocator: ElementLocator;
    strategy: string;
    frequency: number;
  }> {
    // Analyze healing log to suggest permanent updates
    const updates = new Map<string, {
      objectName?: string;
      oldLocator: ElementLocator;
      newLocator: ElementLocator;
      strategy: string;
      frequency: number;
    }>();

    this.healingLog.forEach(log => {
      const key = `${log.objectName || ''}-${log.originalLocator.value}`;
      const existing = updates.get(key);

      if (existing) {
        existing.frequency++;
      } else {
        updates.set(key, {
          objectName: log.objectName,
          oldLocator: log.originalLocator,
          newLocator: log.healedLocator!,
          strategy: log.strategy,
          frequency: 1
        });
      }
    });

    return Array.from(updates.values())
      .filter(u => u.frequency >= 2) // Suggest only if healed multiple times
      .sort((a, b) => b.frequency - a.frequency);
  }
}
