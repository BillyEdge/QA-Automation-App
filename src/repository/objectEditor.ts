import * as readline from 'readline';
import { ObjectRepositoryManager, UIObject } from './objectRepository';
import { PlatformType, ElementLocator } from '../types';
import chalk from 'chalk';

/**
 * Interactive Object Repository Editor
 * Edit objects manually like in Ranorex
 */

export class ObjectRepositoryEditor {
  private manager: ObjectRepositoryManager;
  private currentObject: UIObject | null = null;

  constructor(repositoryPath?: string) {
    this.manager = new ObjectRepositoryManager(repositoryPath);
  }

  async start(): Promise<void> {
    console.clear();
    this.printHeader();
    await this.mainMenu();
  }

  private printHeader(): void {
    console.log(chalk.bold.cyan('\n' + '═'.repeat(70)));
    console.log(chalk.bold.cyan('  🗂️  OBJECT REPOSITORY EDITOR'));
    console.log(chalk.bold.cyan('  Like Ranorex - Visual Object Management'));
    console.log(chalk.bold.cyan('═'.repeat(70) + '\n'));
  }

  private async mainMenu(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const showMenu = () => {
      console.log(chalk.bold('\n📋 MAIN MENU'));
      console.log('═'.repeat(50));
      console.log('  1. List all objects');
      console.log('  2. Create new object');
      console.log('  3. Edit existing object');
      console.log('  4. Delete object');
      console.log('  5. Search objects');
      console.log('  6. View statistics');
      console.log('  7. Import/Export');
      console.log('  8. Exit');
      console.log('═'.repeat(50));
    };

    const prompt = () => {
      rl.question(chalk.yellow('\n📝 Choose option (1-8): '), async (answer) => {
        console.log('');

        switch (answer.trim()) {
          case '1':
            await this.listAllObjects();
            showMenu();
            prompt();
            break;

          case '2':
            await this.createNewObject(rl);
            showMenu();
            prompt();
            break;

          case '3':
            await this.editObject(rl);
            showMenu();
            prompt();
            break;

          case '4':
            await this.deleteObject(rl);
            showMenu();
            prompt();
            break;

          case '5':
            await this.searchObjects(rl);
            showMenu();
            prompt();
            break;

          case '6':
            this.viewStatistics();
            showMenu();
            prompt();
            break;

          case '7':
            await this.importExport(rl);
            showMenu();
            prompt();
            break;

          case '8':
            console.log(chalk.green('\n✅ Goodbye!\n'));
            rl.close();
            break;

          default:
            console.log(chalk.red('❌ Invalid option'));
            showMenu();
            prompt();
        }
      });
    };

    showMenu();
    prompt();
  }

  private async listAllObjects(): Promise<void> {
    console.log(chalk.bold.cyan('\n📦 OBJECT REPOSITORY'));
    console.log('═'.repeat(70));

    this.manager.listAllObjects();
  }

  private async createNewObject(rl: readline.Interface): Promise<void> {
    console.log(chalk.bold.cyan('\n➕ CREATE NEW OBJECT'));
    console.log('═'.repeat(70));

    const name = await this.question(rl, 'Object name (e.g., "Login Button"): ');
    const description = await this.question(rl, 'Description: ');

    console.log('\nPlatform:');
    console.log('  1. Web');
    console.log('  2. Desktop');
    console.log('  3. Mobile');
    const platformChoice = await this.question(rl, 'Choose platform (1-3): ');

    let platform: PlatformType;
    switch (platformChoice) {
      case '1': platform = PlatformType.WEB; break;
      case '2': platform = PlatformType.DESKTOP; break;
      case '3': platform = PlatformType.MOBILE; break;
      default: platform = PlatformType.WEB;
    }

    // Add locators
    const locators: ElementLocator[] = [];
    let addMore = true;
    let locatorCount = 1;

    console.log(chalk.bold('\n🎯 Add Locators (minimum 1)'));

    while (addMore && locatorCount <= 5) {
      console.log(chalk.yellow(`\nLocator ${locatorCount}:`));

      console.log('  Type:');
      console.log('    1. CSS Selector');
      console.log('    2. XPath');
      console.log('    3. ID');
      console.log('    4. Text');
      console.log('    5. Placeholder');
      console.log('    6. Accessibility ID');

      const typeChoice = await this.question(rl, '  Choose type (1-6): ');

      let type: ElementLocator['type'] = 'css';
      switch (typeChoice) {
        case '1': type = 'css'; break;
        case '2': type = 'xpath'; break;
        case '3': type = 'id'; break;
        case '4': type = 'text'; break;
        case '5': type = 'placeholder'; break;
        case '6': type = 'accessibility_id'; break;
      }

      const value = await this.question(rl, '  Locator value: ');

      locators.push({ type, value });
      locatorCount++;

      if (locatorCount <= 5) {
        const more = await this.question(rl, '\nAdd another locator? (y/n): ');
        addMore = more.toLowerCase() === 'y';
      }
    }

    // Add attributes
    console.log(chalk.bold('\n📝 Add Attributes (optional, for self-healing)'));
    const text = await this.question(rl, 'Text content (press Enter to skip): ');
    const elementType = await this.question(rl, 'Element type (e.g., button, input): ');
    const placeholder = await this.question(rl, 'Placeholder (press Enter to skip): ');
    const className = await this.question(rl, 'Class name (press Enter to skip): ');

    const attributes: any = {};
    if (text) attributes.text = text;
    if (elementType) attributes.type = elementType;
    if (placeholder) attributes.placeholder = placeholder;
    if (className) attributes.className = className;

    // Add tags
    const tagsInput = await this.question(rl, 'Tags (comma-separated, e.g., login,critical): ');
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

    // Create object
    const newObject = this.manager.addObject({
      name,
      description,
      platform,
      locators,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      tags: tags.length > 0 ? tags : undefined
    });

    console.log(chalk.green(`\n✅ Object created successfully!`));
    console.log(chalk.gray(`   ID: ${newObject.id}`));
    this.displayObjectDetails(newObject);
  }

  private async editObject(rl: readline.Interface): Promise<void> {
    console.log(chalk.bold.cyan('\n✏️  EDIT OBJECT'));
    console.log('═'.repeat(70));

    const name = await this.question(rl, 'Object name to edit: ');
    const object = this.manager.getObjectByName(name);

    if (!object) {
      console.log(chalk.red(`❌ Object "${name}" not found`));
      return;
    }

    this.currentObject = object;
    console.log(chalk.green(`\n✅ Found object: ${object.name}`));
    this.displayObjectDetails(object);

    await this.editObjectMenu(rl);
  }

  private async editObjectMenu(rl: readline.Interface): Promise<void> {
    if (!this.currentObject) return;

    console.log(chalk.bold('\n🔧 EDIT OPTIONS'));
    console.log('═'.repeat(50));
    console.log('  1. Edit name');
    console.log('  2. Edit description');
    console.log('  3. Add locator');
    console.log('  4. Remove locator');
    console.log('  5. Reorder locators');
    console.log('  6. Edit attributes');
    console.log('  7. Edit tags');
    console.log('  8. Save and return');
    console.log('  9. Cancel (discard changes)');
    console.log('═'.repeat(50));

    const choice = await this.question(rl, '\nChoose option (1-9): ');

    switch (choice) {
      case '1':
        const newName = await this.question(rl, 'New name: ');
        this.currentObject.name = newName;
        console.log(chalk.green('✅ Name updated'));
        await this.editObjectMenu(rl);
        break;

      case '2':
        const newDesc = await this.question(rl, 'New description: ');
        this.currentObject.description = newDesc;
        console.log(chalk.green('✅ Description updated'));
        await this.editObjectMenu(rl);
        break;

      case '3':
        await this.addLocatorToObject(rl);
        await this.editObjectMenu(rl);
        break;

      case '4':
        await this.removeLocatorFromObject(rl);
        await this.editObjectMenu(rl);
        break;

      case '5':
        await this.reorderLocators(rl);
        await this.editObjectMenu(rl);
        break;

      case '6':
        await this.editAttributes(rl);
        await this.editObjectMenu(rl);
        break;

      case '7':
        await this.editTags(rl);
        await this.editObjectMenu(rl);
        break;

      case '8':
        this.manager.updateObject(this.currentObject.id, this.currentObject);
        console.log(chalk.green('\n✅ Object saved successfully!'));
        this.currentObject = null;
        break;

      case '9':
        console.log(chalk.yellow('\n⚠️  Changes discarded'));
        this.currentObject = null;
        break;

      default:
        console.log(chalk.red('❌ Invalid option'));
        await this.editObjectMenu(rl);
    }
  }

  private async addLocatorToObject(rl: readline.Interface): Promise<void> {
    console.log(chalk.bold('\n➕ ADD LOCATOR'));

    console.log('Type:');
    console.log('  1. CSS');
    console.log('  2. XPath');
    console.log('  3. ID');
    console.log('  4. Text');
    console.log('  5. Placeholder');

    const typeChoice = await this.question(rl, 'Choose type (1-5): ');

    let type: ElementLocator['type'] = 'css';
    switch (typeChoice) {
      case '1': type = 'css'; break;
      case '2': type = 'xpath'; break;
      case '3': type = 'id'; break;
      case '4': type = 'text'; break;
      case '5': type = 'placeholder'; break;
    }

    const value = await this.question(rl, 'Locator value: ');

    this.currentObject!.locators.push({ type, value });
    console.log(chalk.green('✅ Locator added'));
  }

  private async removeLocatorFromObject(rl: readline.Interface): Promise<void> {
    if (!this.currentObject || this.currentObject.locators.length === 0) {
      console.log(chalk.red('❌ No locators to remove'));
      return;
    }

    console.log(chalk.bold('\n🗑️  REMOVE LOCATOR'));
    this.currentObject.locators.forEach((loc, i) => {
      console.log(`  ${i + 1}. ${loc.type}: ${loc.value}`);
    });

    const index = await this.question(rl, 'Locator number to remove: ');
    const idx = parseInt(index) - 1;

    if (idx >= 0 && idx < this.currentObject.locators.length) {
      this.currentObject.locators.splice(idx, 1);
      console.log(chalk.green('✅ Locator removed'));
    } else {
      console.log(chalk.red('❌ Invalid index'));
    }
  }

  private async reorderLocators(rl: readline.Interface): Promise<void> {
    if (!this.currentObject || this.currentObject.locators.length < 2) {
      console.log(chalk.yellow('⚠️  Need at least 2 locators to reorder'));
      return;
    }

    console.log(chalk.bold('\n🔄 REORDER LOCATORS'));
    console.log('Current order:');
    this.currentObject.locators.forEach((loc, i) => {
      console.log(`  ${i + 1}. ${loc.type}: ${loc.value}`);
    });

    const from = await this.question(rl, '\nMove locator number: ');
    const to = await this.question(rl, 'To position: ');

    const fromIdx = parseInt(from) - 1;
    const toIdx = parseInt(to) - 1;

    if (fromIdx >= 0 && fromIdx < this.currentObject.locators.length &&
        toIdx >= 0 && toIdx < this.currentObject.locators.length) {
      const [locator] = this.currentObject.locators.splice(fromIdx, 1);
      this.currentObject.locators.splice(toIdx, 0, locator);
      console.log(chalk.green('✅ Locators reordered'));
    } else {
      console.log(chalk.red('❌ Invalid positions'));
    }
  }

  private async editAttributes(rl: readline.Interface): Promise<void> {
    console.log(chalk.bold('\n📝 EDIT ATTRIBUTES'));

    const text = await this.question(rl, `Text (current: "${this.currentObject?.attributes?.text || 'none'}"): `);
    const type = await this.question(rl, `Type (current: "${this.currentObject?.attributes?.type || 'none'}"): `);
    const placeholder = await this.question(rl, `Placeholder (current: "${this.currentObject?.attributes?.placeholder || 'none'}"): `);

    if (!this.currentObject!.attributes) {
      this.currentObject!.attributes = {};
    }

    if (text) this.currentObject!.attributes.text = text;
    if (type) this.currentObject!.attributes.type = type;
    if (placeholder) this.currentObject!.attributes.placeholder = placeholder;

    console.log(chalk.green('✅ Attributes updated'));
  }

  private async editTags(rl: readline.Interface): Promise<void> {
    console.log(chalk.bold('\n🏷️  EDIT TAGS'));
    console.log(`Current tags: ${this.currentObject?.tags?.join(', ') || 'none'}`);

    const tagsInput = await this.question(rl, 'New tags (comma-separated): ');
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

    this.currentObject!.tags = tags.length > 0 ? tags : undefined;
    console.log(chalk.green('✅ Tags updated'));
  }

  private async deleteObject(rl: readline.Interface): Promise<void> {
    console.log(chalk.bold.red('\n🗑️  DELETE OBJECT'));
    console.log('═'.repeat(70));

    const name = await this.question(rl, 'Object name to delete: ');
    const object = this.manager.getObjectByName(name);

    if (!object) {
      console.log(chalk.red(`❌ Object "${name}" not found`));
      return;
    }

    this.displayObjectDetails(object);

    const confirm = await this.question(rl, chalk.yellow('\n⚠️  Confirm deletion? (yes/no): '));

    if (confirm.toLowerCase() === 'yes') {
      this.manager.deleteObject(object.id);
      console.log(chalk.green('✅ Object deleted'));
    } else {
      console.log(chalk.yellow('❌ Deletion cancelled'));
    }
  }

  private async searchObjects(rl: readline.Interface): Promise<void> {
    console.log(chalk.bold.cyan('\n🔍 SEARCH OBJECTS'));
    console.log('═'.repeat(70));

    const keyword = await this.question(rl, 'Search by name (partial match): ');

    const results = this.manager.searchObjects({
      nameContains: keyword
    });

    if (results.length === 0) {
      console.log(chalk.yellow(`\n⚠️  No objects found matching "${keyword}"`));
    } else {
      console.log(chalk.green(`\n✅ Found ${results.length} object(s):`));
      results.forEach(obj => {
        console.log(`\n  📦 ${obj.name}`);
        console.log(`     ID: ${obj.id}`);
        console.log(`     Platform: ${obj.platform}`);
        console.log(`     Locators: ${obj.locators.length}`);
      });
    }
  }

  private viewStatistics(): void {
    console.log(chalk.bold.cyan('\n📊 REPOSITORY STATISTICS'));
    console.log('═'.repeat(70));

    const stats = this.manager.getStatistics();

    console.log(`Total Objects: ${chalk.bold(stats.totalObjects.toString())}`);
    console.log(`  Web: ${chalk.cyan(stats.byPlatform.web.toString())}`);
    console.log(`  Desktop: ${chalk.green(stats.byPlatform.desktop.toString())}`);
    console.log(`  Mobile: ${chalk.yellow(stats.byPlatform.mobile.toString())}`);
    console.log(`Total Folders: ${chalk.bold(stats.totalFolders.toString())}`);
    console.log(`Avg Locators/Object: ${chalk.bold(stats.averageLocatorsPerObject.toFixed(2))}`);
  }

  private async importExport(rl: readline.Interface): Promise<void> {
    console.log(chalk.bold.cyan('\n📥📤 IMPORT/EXPORT'));
    console.log('═'.repeat(70));
    console.log('  1. Export repository');
    console.log('  2. Import repository');

    const choice = await this.question(rl, '\nChoose option (1-2): ');

    if (choice === '1') {
      const path = await this.question(rl, 'Export to file path: ');
      this.manager.exportRepository(path);
    } else if (choice === '2') {
      const path = await this.question(rl, 'Import from file path: ');
      const merge = await this.question(rl, 'Merge with existing? (y/n): ');
      this.manager.importRepository(path, merge.toLowerCase() === 'y');
    }
  }

  private displayObjectDetails(object: UIObject): void {
    console.log(chalk.bold('\n📦 OBJECT DETAILS'));
    console.log('─'.repeat(70));
    console.log(`${chalk.bold('Name:')} ${object.name}`);
    console.log(`${chalk.bold('Description:')} ${object.description}`);
    console.log(`${chalk.bold('Platform:')} ${object.platform}`);
    console.log(`${chalk.bold('ID:')} ${chalk.gray(object.id)}`);

    console.log(chalk.bold('\n🎯 Locators:'));
    object.locators.forEach((loc, i) => {
      console.log(`  ${i + 1}. ${chalk.cyan(loc.type)}: ${loc.value}`);
    });

    if (object.attributes && Object.keys(object.attributes).length > 0) {
      console.log(chalk.bold('\n📝 Attributes:'));
      Object.entries(object.attributes).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

    if (object.tags && object.tags.length > 0) {
      console.log(chalk.bold('\n🏷️  Tags:'));
      console.log(`  ${object.tags.join(', ')}`);
    }

    console.log('─'.repeat(70));
  }

  private question(rl: readline.Interface, prompt: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(chalk.yellow(prompt), (answer) => {
        resolve(answer.trim());
      });
    });
  }
}

// CLI usage
if (require.main === module) {
  const editor = new ObjectRepositoryEditor();
  editor.start().catch(console.error);
}
