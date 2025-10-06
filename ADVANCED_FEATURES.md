# Advanced Features Guide

## ✅ All Your Questions Answered - YES to Everything!

### 1. ✅ Can edit test steps?
**YES!** Full editing capabilities:
- Add new steps
- Delete steps
- Edit existing steps
- Disable/enable steps
- Move steps around
- Duplicate steps

### 2. ✅ Can add loops to run steps multiple times?
**YES!** Loop support:
- Run any step N times
- Data-driven testing with loop data
- Per-step iteration control

### 3. ✅ Do we have logs to see which steps failed?
**YES!** Comprehensive logging:
- Color-coded console logs
- Detailed step-by-step logs
- Timestamp for each action
- Error messages and stack traces
- Exportable log files (JSON)

### 4. ✅ Can validate data?
**YES!** Multiple validation types:
- Equals validation
- Contains validation
- Regex validation
- Element exists/not exists
- Custom assertions

### 5. ✅ Can add wait/delay?
**YES!** Flexible wait options:
- Wait before step execution
- Wait after step execution
- Custom delays between iterations
- Timeout configuration per step

### 6. ✅ Can continue if failed?
**YES!** Failure handling:
- Continue on failure per step
- Retry failed steps automatically
- Configurable retry counts
- Skip steps without deleting them

---

## 🎯 Complete Feature List

| Feature | Status | Description |
|---------|--------|-------------|
| **Edit Steps** | ✅ | Add, delete, modify, move, duplicate steps |
| **Loop Steps** | ✅ | Run steps multiple times with iteration control |
| **Detailed Logs** | ✅ | Color-coded, timestamped, exportable logs |
| **Data Validation** | ✅ | Multiple validation types with assertions |
| **Wait/Delay** | ✅ | Before, after, and between iterations |
| **Continue on Fail** | ✅ | Don't stop test on step failure |
| **Retry Logic** | ✅ | Auto-retry failed steps N times |
| **Disable Steps** | ✅ | Skip steps without deleting |
| **Timeout Control** | ✅ | Per-step timeout configuration |
| **Screenshots** | ✅ | Capture on every step |

---

## 📝 Editing Test Steps

### View All Steps

```bash
npx ts-node src/editor/testEditor.ts list recordings/test-abc123.json
```

**Output:**
```
📝 Test Case: Recorded Web Test
   Platform: web
   Total Steps: 5

  1. ✓ Navigate to https://example.com/login
  2. ✓ Type 'testuser' into #username
  3. ✓ Type 'password123' into #password [Continue on Fail]
  4. ✓ Click on #login-button [Loop: 3x]
      ⏱️  Wait Before: 1000ms
      ✓ Validation: equals - Dashboard
  5. ✗ Wait for 1000ms
```

### Delete a Step

```bash
npx ts-node src/editor/testEditor.ts delete recordings/test-abc123.json 3
```

**Output:**
```
🗑️  Step 3 deleted: Type 'password123' into #password
✅ Test case saved: recordings/test-abc123.json
```

### Disable a Step (Keep it but skip execution)

```bash
npx ts-node src/editor/testEditor.ts disable recordings/test-abc123.json 5
```

**Output:**
```
✅ Step 5 disabled
✅ Test case saved: recordings/test-abc123.json
```

### Enable a Step

```bash
npx ts-node src/editor/testEditor.ts enable recordings/test-abc123.json 5
```

---

## 🔁 Adding Loops

Run a step multiple times:

```bash
# Run step 3 exactly 5 times
npx ts-node src/editor/testEditor.ts loop recordings/test-abc123.json 3 5
```

**Output:**
```
✅ Loop added to step 3: 5 iterations
✅ Test case saved: recordings/test-abc123.json
```

**During Execution:**
```
⚡ Step 3/5: Click on search button

ℹ [Step 3] Executing 5 iterations
⚙ [Step 3] [Iteration 1] Iteration 1/5
✓ [Step 3] [Iteration 1] Completed (234ms)
⚙ [Step 3] [Iteration 2] Iteration 2/5
✓ [Step 3] [Iteration 2] Completed (198ms)
⚙ [Step 3] [Iteration 3] Iteration 3/5
✓ [Step 3] [Iteration 3] Completed (215ms)
⚙ [Step 3] [Iteration 4] Iteration 4/5
✓ [Step 3] [Iteration 4] Completed (202ms)
⚙ [Step 3] [Iteration 5] Iteration 5/5
✓ [Step 3] [Iteration 5] Completed (219ms)
✓ [Step 3] Completed (1068ms)
```

---

## ⏱️ Adding Wait Times

### Wait Before Execution

```bash
# Wait 2000ms before executing step 2
npx ts-node src/editor/testEditor.ts wait recordings/test-abc123.json 2 2000
```

**Output:**
```
✅ Wait time added to step 2
✅ Test case saved: recordings/test-abc123.json
```

**During Execution:**
```
⚡ Step 2/5: Type 'testuser' into #username
ℹ [Step 2] Waiting 2000ms before execution...
✓ [Step 2] Completed (2156ms)
```

### Wait Before AND After

```bash
# Wait 1000ms before, 500ms after step 4
npx ts-node src/editor/testEditor.ts wait recordings/test-abc123.json 4 1000 500
```

---

## ✅ Data Validation

Add validation to ensure data is correct:

```bash
npx ts-node src/editor/testEditor.ts validate recordings/test-abc123.json 5 equals "Welcome, User!"
```

**Available Validation Types:**
- `equals` - Exact match
- `contains` - Contains substring
- `regex` - Regular expression match
- `exists` - Element exists
- `notExists` - Element doesn't exist

**During Execution:**
```
⚡ Step 5/5: Verify dashboard visible
ℹ [Step 5] Validating: equals
✓ [Step 5] Validation passed
✓ [Step 5] Completed (234ms)
```

**If Validation Fails:**
```
⚡ Step 5/5: Verify dashboard visible
ℹ [Step 5] Validating: equals
✗ [Step 5] Validation failed
✗ [Step 5] Failed: Validation failed: Expected Welcome, User!, got Welcome, Guest!
```

---

## 🔄 Retry Failed Steps

Automatically retry a step if it fails:

```bash
# Retry step 4 up to 3 times if it fails
npx ts-node src/editor/testEditor.ts retry recordings/test-abc123.json 4 3
```

**Output:**
```
✅ Retry count set for step 4: 3 retries
✅ Test case saved: recordings/test-abc123.json
```

**During Execution (if step fails):**
```
⚡ Step 4/5: Click on login-button
✗ [Step 4] Attempt 1 failed, retrying...
ℹ [Step 4] Retry attempt 1/3
✓ [Step 4] Completed (567ms)
```

---

## 🚦 Continue on Failure

Don't stop the entire test if one step fails:

```bash
# Continue even if step 3 fails
npx ts-node src/editor/testEditor.ts continue-on-fail recordings/test-abc123.json 3 true
```

**Output:**
```
✅ Step 3 will CONTINUE on failure
✅ Test case saved: recordings/test-abc123.json
```

**During Execution:**
```
⚡ Step 3/5: Click optional banner close button
✗ [Step 3] Failed but continuing: Element not found
⚠ [Step 3] Failed but continuing: Element not found

⚡ Step 4/5: Type 'testuser' into #username
✓ [Step 4] Completed (156ms)
```

---

## ⏲️ Set Step Timeout

Maximum time allowed for a step:

```bash
# Step 5 must complete within 5000ms
npx ts-node src/editor/testEditor.ts timeout recordings/test-abc123.json 5 5000
```

**Output:**
```
✅ Timeout set for step 5: 5000ms
✅ Test case saved: recordings/test-abc123.json
```

---

## 📊 Viewing Detailed Logs

### Console Logs (Color-Coded)

When executing tests, you'll see:

```
======================================================================
🚀 Executing Test Case: Login Flow Test
📝 Description: Test case for user login
🔧 Platform: WEB
📊 Total Steps: 5
======================================================================

⚡ Step 1/5: Navigate to https://example.com/login
✓ [Step 1] Completed (234ms)

⚡ Step 2/5: Type 'testuser' into #username
ℹ [Step 2] Waiting 1000ms before execution...
✓ [Step 2] Completed (1156ms)

⚡ Step 3/5: Click on login-button
ℹ [Step 3] Executing 3 iterations
⚙ [Step 3] [Iteration 1] Iteration 1/3
✓ [Step 3] [Iteration 1] Completed (198ms)
⚙ [Step 3] [Iteration 2] Iteration 2/3
✓ [Step 3] [Iteration 2] Completed (205ms)
⚙ [Step 3] [Iteration 3] Iteration 3/3
✓ [Step 3] [Iteration 3] Completed (201ms)
✓ [Step 3] Completed (604ms)

⚡ Step 4/5: Verify dashboard visible
ℹ [Step 4] Validating: contains
✓ [Step 4] Validation passed
✓ [Step 4] Completed (145ms)

⚡ Step 5/5: Wait for 1000ms
⚠ [Step 5] Skipped (disabled)

======================================================================
📋 Execution Summary:
   Status: PASSED ✓
   Duration: 2139ms
   Passed Steps: 4/5
   Failed Steps: 0/5
   Skipped Steps: 1/5
======================================================================
```

### Export Logs to File

Logs are automatically saved with execution results, but you can also export them separately.

**Log Format (JSON):**
```json
[
  {
    "timestamp": 1696089600000,
    "level": "info",
    "message": "Waiting 1000ms before execution...",
    "stepIndex": 1
  },
  {
    "timestamp": 1696089601000,
    "level": "success",
    "message": "Completed (1156ms)",
    "stepIndex": 1
  },
  {
    "timestamp": 1696089602000,
    "level": "info",
    "message": "Executing 3 iterations",
    "stepIndex": 2
  },
  {
    "timestamp": 1696089602100,
    "level": "debug",
    "message": "Iteration 1/3",
    "stepIndex": 2,
    "iteration": 0
  },
  {
    "timestamp": 1696089603000,
    "level": "error",
    "message": "Failed: Element not found",
    "stepIndex": 3
  }
]
```

---

## 🎯 Complete Example Workflow

### Step 1: Record a Test

```bash
npm run dev -- record:web --url https://example.com/login
# ... perform actions ...
# Ctrl+C to stop
# ✅ Saved as: recordings/test-abc123.json
```

### Step 2: View and Edit Steps

```bash
# List steps
npx ts-node src/editor/testEditor.ts list recordings/test-abc123.json

# Add loop to step 3 (click 5 times)
npx ts-node src/editor/testEditor.ts loop recordings/test-abc123.json 3 5

# Add wait before step 2
npx ts-node src/editor/testEditor.ts wait recordings/test-abc123.json 2 2000

# Add validation to step 5
npx ts-node src/editor/testEditor.ts validate recordings/test-abc123.json 5 contains "Dashboard"

# Set continue on failure for step 4
npx ts-node src/editor/testEditor.ts continue-on-fail recordings/test-abc123.json 4 true

# Add retry to step 4
npx ts-node src/editor/testEditor.ts retry recordings/test-abc123.json 4 3
```

### Step 3: Execute Enhanced Test

```bash
# Execute with enhanced executor
npx ts-node src/executor/enhancedExecutor.ts recordings/test-abc123.json
```

**You'll see:**
- ✅ Detailed logs for each step
- ✅ Loop iterations logged
- ✅ Wait times displayed
- ✅ Validation results
- ✅ Retry attempts
- ✅ Continue on failure handling
- ✅ Color-coded output
- ✅ Complete execution summary

---

## 📋 Test Case JSON Structure (Enhanced)

```json
{
  "id": "test-abc123",
  "name": "Enhanced Login Test",
  "description": "Login test with loops, waits, validations",
  "platform": "web",
  "actions": [
    {
      "id": "action-1",
      "type": "navigate",
      "value": "https://example.com/login",
      "description": "Navigate to login page",
      "enabled": true
    },
    {
      "id": "action-2",
      "type": "type",
      "target": { "type": "css", "value": "#username" },
      "value": "testuser",
      "description": "Type username",
      "enabled": true,
      "options": {
        "waitBefore": 2000,
        "waitAfter": 500,
        "timeout": 5000
      }
    },
    {
      "id": "action-3",
      "type": "click",
      "target": { "type": "css", "value": "#login-btn" },
      "description": "Click login button",
      "enabled": true,
      "options": {
        "loop": {
          "count": 3
        },
        "retries": 2,
        "continueOnFailure": false
      }
    },
    {
      "id": "action-4",
      "type": "assert",
      "target": { "type": "css", "value": "#dashboard-title" },
      "description": "Verify dashboard",
      "enabled": true,
      "options": {
        "validation": {
          "type": "contains",
          "expected": "Welcome",
          "actual": "#dashboard-title"
        }
      }
    },
    {
      "id": "action-5",
      "type": "wait",
      "value": 1000,
      "description": "Wait for animations",
      "enabled": false
    }
  ]
}
```

---

## 🎉 Summary

You now have a **professional-grade test automation platform** with:

✅ **Full test editing** - Add, delete, modify, move steps
✅ **Loop support** - Run steps multiple times
✅ **Detailed logging** - Color-coded, timestamped, exportable
✅ **Data validation** - Multiple validation types
✅ **Wait controls** - Before, after, custom delays
✅ **Failure handling** - Continue on fail, retry logic
✅ **Step control** - Enable/disable, timeout, retry

**All features are working and ready to use!** 🚀
