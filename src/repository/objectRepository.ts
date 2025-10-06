import { v4 as uuidv4 } from 'uuid';
import { ElementLocator, PlatformType } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Object Repository - Like Ranorex
 * Store and reuse UI elements across tests
 */

export interface UIObject {
  id: string;
  name: string;
  description: string;
  platform: PlatformType;
  locators: ElementLocator[];  // Multiple locators for fallback (self-healing)
  attributes?: {               // Additional attributes for verification
    text?: string;
    type?: string;
    placeholder?: string;
    className?: string;
    [key: string]: any;
  };
  screenshot?: string;
  tags?: string[];
  parentObject?: string;       // For hierarchical organization
  createdAt: number;
  updatedAt: number;
}

export interface ObjectFolder {
  id: string;
  name: string;
  description: string;
  objects: string[];           // Object IDs in this folder
  subFolders?: string[];       // Sub-folder IDs
  createdAt: number;
}

export interface Repository {
  id: string;
  name: string;
  description: string;
  platform?: PlatformType;     // Optional: repository for specific platform
  objects: Record<string, UIObject>;
  folders: Record<string, ObjectFolder>;
  version: string;
  createdAt: number;
  updatedAt: number;
}

export class ObjectRepositoryManager {
  private repository: Repository;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), 'object-repository.json');

    if (fs.existsSync(this.filePath)) {
      this.loadRepository();
    } else {
      this.createNewRepository();
    }
  }

  private createNewRepository(): void {
    this.repository = {
      id: uuidv4(),
      name: 'QA Automation Object Repository',
      description: 'Centralized repository for UI objects',
      objects: {},
      folders: {},
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.save();
  }

  private loadRepository(): void {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    this.repository = JSON.parse(content);
    console.log(`✅ Loaded object repository: ${this.repository.name}`);
    console.log(`   Objects: ${Object.keys(this.repository.objects).length}`);
    console.log(`   Folders: ${Object.keys(this.repository.folders).length}`);
  }

  /**
   * Save repository to disk
   */
  save(): void {
    this.repository.updatedAt = Date.now();
    fs.writeFileSync(this.filePath, JSON.stringify(this.repository, null, 2));
    console.log(`💾 Repository saved: ${this.filePath}`);
  }

  /**
   * Add a new UI object to repository
   */
  addObject(object: Omit<UIObject, 'id' | 'createdAt' | 'updatedAt'>): UIObject {
    const newObject: UIObject = {
      ...object,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.repository.objects[newObject.id] = newObject;
    this.save();

    console.log(`✅ Object added: ${newObject.name} (${newObject.id})`);
    return newObject;
  }

  /**
   * Update an existing object
   */
  updateObject(objectId: string, updates: Partial<UIObject>): UIObject {
    if (!this.repository.objects[objectId]) {
      throw new Error(`Object not found: ${objectId}`);
    }

    this.repository.objects[objectId] = {
      ...this.repository.objects[objectId],
      ...updates,
      updatedAt: Date.now()
    };

    this.save();
    console.log(`✅ Object updated: ${this.repository.objects[objectId].name}`);
    return this.repository.objects[objectId];
  }

  /**
   * Get object by ID
   */
  getObject(objectId: string): UIObject | undefined {
    return this.repository.objects[objectId];
  }

  /**
   * Get object by name
   */
  getObjectByName(name: string): UIObject | undefined {
    return Object.values(this.repository.objects).find(obj => obj.name === name);
  }

  /**
   * Search objects by criteria
   */
  searchObjects(criteria: {
    platform?: PlatformType;
    tags?: string[];
    nameContains?: string;
  }): UIObject[] {
    return Object.values(this.repository.objects).filter(obj => {
      if (criteria.platform && obj.platform !== criteria.platform) {
        return false;
      }
      if (criteria.tags && !criteria.tags.some(tag => obj.tags?.includes(tag))) {
        return false;
      }
      if (criteria.nameContains && !obj.name.toLowerCase().includes(criteria.nameContains.toLowerCase())) {
        return false;
      }
      return true;
    });
  }

  /**
   * Delete an object
   */
  deleteObject(objectId: string): void {
    if (!this.repository.objects[objectId]) {
      throw new Error(`Object not found: ${objectId}`);
    }

    const objectName = this.repository.objects[objectId].name;
    delete this.repository.objects[objectId];
    this.save();

    console.log(`🗑️  Object deleted: ${objectName}`);
  }

  /**
   * Create a folder for organizing objects
   */
  createFolder(name: string, description: string): ObjectFolder {
    const folder: ObjectFolder = {
      id: uuidv4(),
      name,
      description,
      objects: [],
      createdAt: Date.now()
    };

    this.repository.folders[folder.id] = folder;
    this.save();

    console.log(`📁 Folder created: ${name}`);
    return folder;
  }

  /**
   * Add object to folder
   */
  addObjectToFolder(objectId: string, folderId: string): void {
    if (!this.repository.objects[objectId]) {
      throw new Error(`Object not found: ${objectId}`);
    }
    if (!this.repository.folders[folderId]) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    if (!this.repository.folders[folderId].objects.includes(objectId)) {
      this.repository.folders[folderId].objects.push(objectId);
      this.save();
      console.log(`✅ Object added to folder`);
    }
  }

  /**
   * List all objects in a folder
   */
  getObjectsInFolder(folderId: string): UIObject[] {
    const folder = this.repository.folders[folderId];
    if (!folder) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    return folder.objects
      .map(objId => this.repository.objects[objId])
      .filter(obj => obj !== undefined);
  }

  /**
   * Export repository to share with team
   */
  exportRepository(outputPath: string): void {
    fs.writeFileSync(outputPath, JSON.stringify(this.repository, null, 2));
    console.log(`📤 Repository exported to: ${outputPath}`);
  }

  /**
   * Import repository from file
   */
  importRepository(importPath: string, merge: boolean = false): void {
    const content = fs.readFileSync(importPath, 'utf-8');
    const imported: Repository = JSON.parse(content);

    if (merge) {
      // Merge imported objects with existing
      this.repository.objects = {
        ...this.repository.objects,
        ...imported.objects
      };
      this.repository.folders = {
        ...this.repository.folders,
        ...imported.folders
      };
    } else {
      // Replace entire repository
      this.repository = imported;
    }

    this.save();
    console.log(`📥 Repository imported from: ${importPath}`);
  }

  /**
   * List all objects
   */
  listAllObjects(): void {
    const objects = Object.values(this.repository.objects);

    console.log(`\n📦 OBJECT REPOSITORY`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Total Objects: ${objects.length}`);
    console.log(`Total Folders: ${Object.keys(this.repository.folders).length}`);
    console.log(`${'='.repeat(70)}\n`);

    if (objects.length === 0) {
      console.log('No objects in repository.\n');
      return;
    }

    // Group by platform
    const byPlatform = {
      web: objects.filter(o => o.platform === PlatformType.WEB),
      desktop: objects.filter(o => o.platform === PlatformType.DESKTOP),
      mobile: objects.filter(o => o.platform === PlatformType.MOBILE)
    };

    if (byPlatform.web.length > 0) {
      console.log('🌐 WEB OBJECTS:');
      byPlatform.web.forEach(obj => {
        console.log(`  • ${obj.name} (${obj.id})`);
        console.log(`    Locators: ${obj.locators.length}`);
        if (obj.description) console.log(`    Description: ${obj.description}`);
      });
      console.log('');
    }

    if (byPlatform.desktop.length > 0) {
      console.log('🖥️  DESKTOP OBJECTS:');
      byPlatform.desktop.forEach(obj => {
        console.log(`  • ${obj.name} (${obj.id})`);
        console.log(`    Locators: ${obj.locators.length}`);
      });
      console.log('');
    }

    if (byPlatform.mobile.length > 0) {
      console.log('📱 MOBILE OBJECTS:');
      byPlatform.mobile.forEach(obj => {
        console.log(`  • ${obj.name} (${obj.id})`);
        console.log(`    Locators: ${obj.locators.length}`);
      });
      console.log('');
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const objects = Object.values(this.repository.objects);
    return {
      totalObjects: objects.length,
      byPlatform: {
        web: objects.filter(o => o.platform === PlatformType.WEB).length,
        desktop: objects.filter(o => o.platform === PlatformType.DESKTOP).length,
        mobile: objects.filter(o => o.platform === PlatformType.MOBILE).length
      },
      totalFolders: Object.keys(this.repository.folders).length,
      averageLocatorsPerObject: objects.length > 0
        ? objects.reduce((sum, o) => sum + o.locators.length, 0) / objects.length
        : 0
    };
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new ObjectRepositoryManager();

  switch (command) {
    case 'list':
      manager.listAllObjects();
      break;

    case 'add':
      // Example: add a web element
      manager.addObject({
        name: args[1] || 'Sample Object',
        description: args[2] || 'Sample description',
        platform: PlatformType.WEB,
        locators: [
          { type: 'css', value: '#example' },
          { type: 'xpath', value: '//div[@id="example"]' }
        ]
      });
      break;

    case 'stats':
      const stats = manager.getStatistics();
      console.log('\n📊 REPOSITORY STATISTICS');
      console.log(`${'='.repeat(70)}`);
      console.log(`Total Objects: ${stats.totalObjects}`);
      console.log(`  Web: ${stats.byPlatform.web}`);
      console.log(`  Desktop: ${stats.byPlatform.desktop}`);
      console.log(`  Mobile: ${stats.byPlatform.mobile}`);
      console.log(`Total Folders: ${stats.totalFolders}`);
      console.log(`Avg Locators per Object: ${stats.averageLocatorsPerObject.toFixed(2)}`);
      console.log(`${'='.repeat(70)}\n`);
      break;

    default:
      console.log(`
Object Repository Manager

Commands:
  list              List all objects in repository
  add <name> <desc> Add a sample object
  stats             Show repository statistics

Example:
  npx ts-node src/repository/objectRepository.ts list
      `);
  }
}
