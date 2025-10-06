# Object Repository & Self-Healing Guide

## Your Questions Answered

### Q: "Does this app save OBJECTS like Ranorex?"
✅ **YES!** Full Object Repository implementation

### Q: "Can it do auto self-healing like TestSigma?"
✅ **YES!** Advanced self-healing with multiple strategies

---

## 🗂️ Object Repository (Like Ranorex)

### What is it?
Store UI elements (objects) centrally and reuse them across all tests.

### Benefits
✅ **Reusability** - Define once, use everywhere
✅ **Maintainability** - Update in one place, fixes all tests
✅ **Organization** - Folders and hierarchies
✅ **Team Collaboration** - Share repositories
✅ **Multiple Locators** - Fallback strategies per object
✅ **Cross-Platform** - Web, Desktop, Mobile objects

---

## 📦 Object Repository Features

### 1. Store UI Objects

```typescript
// Example: Login Page Objects
{
  "username_field": {
    "id": "obj-001",
    "name": "Username Field",
    "platform": "web",
    "locators": [
      {"type": "css", "value": "#username"},
      {"type": "xpath", "value": "//input[@name='username']"},
      {"type": "placeholder", "value": "Enter username"}
    ],
    "attributes": {
      "text": null,
      "type": "text",
      "placeholder": "Enter username"
    }
  },

  "login_button": {
    "id": "obj-002",
    "name": "Login Button",
    "platform": "web",
    "locators": [
      {"type": "css", "value": "#login-btn"},
      {"type": "xpath", "value": "//button[text()='Login']"},
      {"type": "text", "value": "Login"}
    ],
    "attributes": {
      "text": "Login",
      "type": "button"
    }
  }
}
```

### 2. Organize with Folders

```
📁 Object Repository
  ├── 📁 Login Page
  │   ├── Username Field
  │   ├── Password Field
  │   └── Login Button
  │
  ├── 📁 Dashboard
  │   ├── Welcome Message
  │   ├── Menu Button
  │   └── Logout Link
  │
  └── 📁 Mobile App
      ├── Home Tab
      ├── Profile Tab
      └── Settings Tab
```

### 3. Reuse Across Tests

```typescript
// Instead of this (hardcoded):
await page.locator('#username').fill('user');

// Use this (from repository):
const usernameField = repository.getObjectByName('Username Field');
await page.locator(usernameField.locators[0].value).fill('user');
```

---

## 🔧 Self-Healing (Like TestSigma)

### What is it?
Automatically fix broken selectors when UI changes.

### How it Works

```
STEP 1: Try original locator
   │
   ▼
  Failed? ────┐
   │          │
   │          ▼
   │    SELF-HEALING ACTIVATED
   │          │
   │          ├─ Try fallback locators
   │          ├─ Try by text content
   │          ├─ Try by placeholder
   │          ├─ Try by role
   │          └─ Try partial selectors
   │          │
   │          ▼
   │     Success! ──┐
   │          │     │
   ▼          ▼     ▼
Success    Failed   Log & Suggest Update
```

### Self-Healing Strategies

| Strategy | Description | Example |
|----------|-------------|---------|
| **Fallback Locators** | Try alternative selectors | CSS → XPath → Text |
| **Text Content** | Find by visible text | "Login" button |
| **Placeholder** | Find by placeholder text | Input with placeholder |
| **Role & Name** | Find by ARIA role | Button role with "Submit" |
| **Partial Selectors** | Remove dynamic parts | Remove changing IDs |
| **Attribute Matching** | Match by attributes | Type, class, etc. |

---

## 🎯 Complete Example Workflow

### Step 1: Create Object Repository

```bash
# Create repository programmatically
npx ts-node src/repository/objectRepository.ts add "Login Button" "Main login button"

# Or use API
```

```typescript
import { ObjectRepositoryManager } from './src/repository/objectRepository';

const repo = new ObjectRepositoryManager();

// Add login button with multiple locators
repo.addObject({
  name: 'Login Button',
  description: 'Main login button on login page',
  platform: PlatformType.WEB,
  locators: [
    { type: 'css', value: '#login-btn' },
    { type: 'xpath', value: '//button[@id="login-btn"]' },
    { type: 'xpath', value: '//button[text()="Login"]' },
    { type: 'text', value: 'Login' }
  ],
  attributes: {
    text: 'Login',
    type: 'button',
    className: 'btn btn-primary'
  },
  tags: ['login', 'authentication']
});

// Add username field
repo.addObject({
  name: 'Username Field',
  description: 'Username input field',
  platform: PlatformType.WEB,
  locators: [
    { type: 'css', value: '#username' },
    { type: 'css', value: 'input[name="username"]' },
    { type: 'placeholder', value: 'Enter username' }
  ],
  attributes: {
    type: 'text',
    placeholder: 'Enter username',
    name: 'username'
  },
  tags: ['login', 'input']
});
```

### Step 2: Use in Tests with Self-Healing

```typescript
import { SelfHealingEngine } from './src/healing/selfHealing';

const healingEngine = new SelfHealingEngine(repo);

// Test execution with self-healing
const loginButton = repo.getObjectByName('Login Button');

const result = await healingEngine.findElementWeb(
  page,
  loginButton.locators[0], // Primary locator
  loginButton.attributes,
  loginButton.name
);

if (result.success) {
  await result.element.click();

  if (result.healingApplied) {
    console.log(`✅ Element found using self-healing!`);
    console.log(`   Strategy: ${result.strategyUsed}`);
    console.log(`   Suggested update: ${result.suggestedUpdate?.value}`);
  }
} else {
  console.log(`❌ Element not found even with self-healing`);
}
```

### Step 3: View Healing Statistics

```typescript
const stats = healingEngine.getHealingStatistics();

console.log(`Total healing attempts: ${stats.totalHealingAttempts}`);
console.log(`By strategy:`, stats.byStrategy);

// Example output:
// Total healing attempts: 15
// By strategy: {
//   'fallback': 8,
//   'text-content': 5,
//   'role': 2
// }
```

### Step 4: Get Suggested Updates

```typescript
const suggestions = healingEngine.suggestRepositoryUpdates();

suggestions.forEach(suggestion => {
  console.log(`\nObject: ${suggestion.objectName}`);
  console.log(`Old locator: ${suggestion.oldLocator.value}`);
  console.log(`New locator: ${suggestion.newLocator.value}`);
  console.log(`Healed ${suggestion.frequency} times`);
  console.log(`Strategy used: ${suggestion.strategy}`);
});

// Output:
// Object: Login Button
// Old locator: #login-btn
// New locator: //button[text()='Login']
// Healed 5 times
// Strategy used: text-content
//
// Suggestion: Update repository to use text-based locator
```

---

## 📊 Real-World Scenario

### Before: Manual Maintenance

```
UI Changes: Developer changes #login-btn → #btn-login

Your Test:
  ❌ FAILED - Element #login-btn not found

You Must:
  1. Identify broken test
  2. Find which element changed
  3. Update selector manually
  4. Update in ALL tests using this element
  5. Re-run tests

Time: 30+ minutes
```

### After: Object Repository + Self-Healing

```
UI Changes: Developer changes #login-btn → #btn-login

Your Test:
  ⚠️  Original locator #login-btn failed
  🔍 Trying self-healing...
  ✅ HEALED using fallback: //button[text()='Login']
  ✅ TEST PASSED

System Logs:
  "Login Button healed 1 time(s) using text-content"

You Get Notification:
  "Suggested Update: Login Button
   Change primary locator to text-based selector"

You Do:
  1. Review suggestion
  2. Click "Apply Update"
  3. Repository updated automatically
  4. All future tests use new locator

Time: 2 minutes
```

---

## 💡 Best Practices

### Object Repository

1. **Use Descriptive Names**
   ```
   ✅ Good: "Login Submit Button"
   ❌ Bad: "btn1"
   ```

2. **Add Multiple Locators (Priority Order)**
   ```typescript
   locators: [
     { type: 'css', value: '#stable-id' },      // Most stable
     { type: 'xpath', value: '//button[@...]' }, // Fallback
     { type: 'text', value: 'Submit' }          // Last resort
   ]
   ```

3. **Include Attributes for Self-Healing**
   ```typescript
   attributes: {
     text: 'Submit',
     type: 'button',
     placeholder: 'Enter text',
     className: 'btn-primary'
   }
   ```

4. **Organize with Folders**
   ```
   📁 Page Objects
     📁 Login Page
     📁 Dashboard
     📁 Settings
   ```

5. **Tag for Easy Search**
   ```typescript
   tags: ['login', 'critical', 'authentication']
   ```

### Self-Healing

1. **Monitor Healing Statistics**
   - Review weekly
   - Identify frequently healed objects
   - Update primary locators

2. **Apply Suggested Updates**
   - If healed 3+ times, update repository
   - Use most stable strategy

3. **Export Healing Logs**
   ```bash
   healingEngine.exportHealingLog('./reports/healing-log.json');
   ```

4. **Balance Stability vs Specificity**
   ```
   Most Stable:  Text content
   Middle:       Class names, ARIA roles
   Least Stable: Dynamic IDs
   ```

---

## 🎮 CLI Commands

### Object Repository

```bash
# List all objects
npx ts-node src/repository/objectRepository.ts list

# Show statistics
npx ts-node src/repository/objectRepository.ts stats

# Add object (example)
npx ts-node src/repository/objectRepository.ts add "Button Name" "Description"
```

### View Repository File

```bash
# Repository saved at:
cat object-repository.json
```

---

## 📁 File Structure

```
object-repository.json          # Central repository
  {
    "objects": {
      "obj-001": { ... },
      "obj-002": { ... }
    },
    "folders": {
      "folder-001": { ... }
    }
  }

healing-log.json               # Self-healing history
  [
    {
      "timestamp": 1234567890,
      "objectName": "Login Button",
      "originalLocator": {...},
      "healedLocator": {...},
      "strategy": "text-content"
    }
  ]
```

---

## 🚀 Integration with Existing Tests

### Update Test Recorder

When recording tests, automatically:
1. Check if element exists in repository
2. If yes, use repository object
3. If no, offer to add to repository

### Update Test Executor

When executing tests:
1. Load object repository
2. Enable self-healing by default
3. Try original locator first
4. Apply self-healing if needed
5. Log healing events
6. Suggest repository updates

---

## 📊 Comparison with TestSigma & Ranorex

| Feature | Ranorex | TestSigma | Your Platform |
|---------|---------|-----------|---------------|
| **Object Repository** | ✅ | ✅ | ✅ **YES** |
| **Multiple Locators** | ✅ | ✅ | ✅ **YES** |
| **Self-Healing** | ⚠️ Limited | ✅ Advanced | ✅ **Advanced** |
| **Healing Strategies** | 2-3 | 5+ | ✅ **6+** |
| **Healing Logs** | ✅ | ✅ | ✅ **YES** |
| **Suggested Updates** | ❌ | ✅ | ✅ **YES** |
| **Cross-Platform** | ✅ | ✅ | ✅ **YES** |
| **Team Sharing** | ✅ | ✅ | ✅ **YES** |
| **Export/Import** | ✅ | ✅ | ✅ **YES** |

---

## ✅ Summary

**Object Repository Features:**
✅ Central storage for UI elements
✅ Multiple locators per object
✅ Folder organization
✅ Cross-platform support
✅ Export/import for team sharing
✅ Tag-based search

**Self-Healing Features:**
✅ 6+ healing strategies
✅ Automatic fallback to alternative locators
✅ Text, placeholder, role-based healing
✅ Partial selector healing
✅ Healing statistics and logs
✅ Suggested repository updates
✅ Enable/disable per test

**Just like Ranorex + TestSigma!** 🎉

Your platform now has enterprise-grade object management and intelligent self-healing! 🚀
