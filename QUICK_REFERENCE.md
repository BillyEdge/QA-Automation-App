# Quick Reference Card

## ✅ YES to All Your Questions!

| Your Question | Answer | How To Use |
|--------------|--------|------------|
| **Record user actions?** | ✅ YES | `npm run dev -- record:web --url URL` |
| **Create test steps?** | ✅ YES | Automatic - each action = 1 step |
| **Test suites?** | ✅ YES | `npm run dev -- suite:create -n Name -d Desc -t test1.json` |
| **Edit test steps?** | ✅ YES | `npx ts-node src/editor/testEditor.ts COMMAND test.json` |
| **Add loops?** | ✅ YES | `npx ts-node src/editor/testEditor.ts loop test.json STEP COUNT` |
| **Detailed logs?** | ✅ YES | Automatic color-coded console + JSON export |
| **Validate data?** | ✅ YES | `npx ts-node src/editor/testEditor.ts validate test.json STEP TYPE VALUE` |
| **Wait/delay?** | ✅ YES | `npx ts-node src/editor/testEditor.ts wait test.json STEP MS` |
| **Continue if failed?** | ✅ YES | `npx ts-node src/editor/testEditor.ts continue-on-fail test.json STEP true` |
| **Retry on failure?** | ✅ YES | `npx ts-node src/editor/testEditor.ts retry test.json STEP COUNT` |

---

## 🚀 Most Common Commands

```bash
# 1. RECORD A TEST
npm run dev -- record:web --url https://example.com

# 2. LIST YOUR TESTS
npm run dev -- list

# 3. EXECUTE A TEST
npm run dev -- execute recordings/YOUR-TEST-ID.json

# 4. VIEW TEST STEPS
npx ts-node src/editor/testEditor.ts list recordings/YOUR-TEST-ID.json

# 5. ADD LOOP (run step 3, 5 times)
npx ts-node src/editor/testEditor.ts loop recordings/YOUR-TEST-ID.json 3 5

# 6. ADD WAIT (wait 2 seconds before step 2)
npx ts-node src/editor/testEditor.ts wait recordings/YOUR-TEST-ID.json 2 2000

# 7. CONTINUE ON FAIL (don't stop if step 4 fails)
npx ts-node src/editor/testEditor.ts continue-on-fail recordings/YOUR-TEST-ID.json 4 true

# 8. ADD VALIDATION (check if text contains "Success")
npx ts-node src/editor/testEditor.ts validate recordings/YOUR-TEST-ID.json 5 contains "Success"

# 9. CREATE TEST SUITE
npm run dev -- suite:create -n "My Suite" -d "Description" -t recordings/*.json

# 10. EXECUTE TEST SUITE
npm run dev -- suite:execute SUITE-ID
```

---

## 📋 Test Editor Commands

```bash
# List all steps
npx ts-node src/editor/testEditor.ts list TEST.json

# Delete a step
npx ts-node src/editor/testEditor.ts delete TEST.json STEP_NUMBER

# Disable a step (skip without deleting)
npx ts-node src/editor/testEditor.ts disable TEST.json STEP_NUMBER

# Enable a step
npx ts-node src/editor/testEditor.ts enable TEST.json STEP_NUMBER

# Add loop (repeat N times)
npx ts-node src/editor/testEditor.ts loop TEST.json STEP_NUMBER COUNT

# Add wait before (and optionally after)
npx ts-node src/editor/testEditor.ts wait TEST.json STEP_NUMBER BEFORE_MS [AFTER_MS]

# Continue on failure
npx ts-node src/editor/testEditor.ts continue-on-fail TEST.json STEP_NUMBER true

# Retry on failure
npx ts-node src/editor/testEditor.ts retry TEST.json STEP_NUMBER RETRY_COUNT

# Set timeout
npx ts-node src/editor/testEditor.ts timeout TEST.json STEP_NUMBER TIMEOUT_MS

# Add validation
npx ts-node src/editor/testEditor.ts validate TEST.json STEP_NUMBER TYPE EXPECTED_VALUE
```

**Validation Types:** `equals`, `contains`, `regex`, `exists`, `notExists`

---

## 📂 Where Things Are Saved

```
recordings/           → Your recorded test cases
  test-*.json        → Individual test case files
  screenshots/       → Screenshots from each step

test-suites/         → Your test suites
  suite-*.json       → Suite definition files

reports/             → Execution reports
  *.json             → Machine-readable reports
  *.html             → Open in browser for visuals
```

---

## 🎯 Complete Workflow Example

```bash
# 1. Record test
npm run dev -- record:web --url https://github.com/login
# ... click, type, navigate ...
# Press Ctrl+C
# ✅ Saved as: recordings/test-abc123.json

# 2. View steps
npx ts-node src/editor/testEditor.ts list recordings/test-abc123.json

# 3. Enhance test
npx ts-node src/editor/testEditor.ts loop recordings/test-abc123.json 3 2
npx ts-node src/editor/testEditor.ts wait recordings/test-abc123.json 2 1000
npx ts-node src/editor/testEditor.ts continue-on-fail recordings/test-abc123.json 4 true
npx ts-node src/editor/testEditor.ts validate recordings/test-abc123.json 5 contains "Dashboard"

# 4. Execute enhanced test
npm run dev -- execute recordings/test-abc123.json

# 5. Create suite
npm run dev -- suite:create \
  -n "Login Tests" \
  -d "All login scenarios" \
  -t recordings/test-abc123.json

# 6. Execute suite
npm run dev -- suite:execute suite-1234567890
```

---

## 🎨 What You'll See (Log Output)

```
======================================================================
🚀 Executing Test Case: Your Test Name
======================================================================

⚡ Step 1/5: Navigate to https://example.com
✓ [Step 1] Completed (234ms)

⚡ Step 2/5: Type 'username' into #user
ℹ [Step 2] Waiting 1000ms before execution...
✓ [Step 2] Completed (1156ms)

⚡ Step 3/5: Click login button
ℹ [Step 3] Executing 2 iterations
⚙ [Step 3] [Iteration 1] Iteration 1/2
✓ [Step 3] [Iteration 1] Completed (198ms)
⚙ [Step 3] [Iteration 2] Iteration 2/2
✓ [Step 3] [Iteration 2] Completed (205ms)
✓ [Step 3] Completed (403ms)

⚡ Step 4/5: Close optional popup
✗ [Step 4] Failed: Element not found
⚠ [Step 4] Failed but continuing: Element not found

⚡ Step 5/5: Verify dashboard
ℹ [Step 5] Validating: contains
✓ [Step 5] Validation passed
✓ [Step 5] Completed (145ms)

======================================================================
📋 Execution Summary:
   Status: PASSED ✓
   Duration: 1938ms
   Passed Steps: 4/5
   Failed Steps: 1/5
   Skipped Steps: 0/5
======================================================================
```

---

## 📚 Documentation Files

- **README.md** - Complete documentation
- **QUICK_START.md** - Get started in 5 minutes
- **GETTING_STARTED.md** - Detailed setup guide
- **ARCHITECTURE.md** - Visual system diagram
- **EXAMPLES.md** - Step-by-step examples
- **ADVANCED_FEATURES.md** - All advanced features explained
- **FEATURE_CHECKLIST.md** - Complete feature list
- **QUICK_REFERENCE.md** - This file

---

## 💡 Pro Tips

1. **Always list steps first** before editing
2. **Use continue-on-fail** for optional steps (like closing banners)
3. **Add waits** if pages load slowly
4. **Use loops** for stress testing
5. **Add validations** to verify data
6. **Disable** instead of delete when testing
7. **Create suites** for related tests
8. **Check logs** when tests fail

---

## 🆘 Need Help?

- Check examples in documentation
- View test JSON files to understand structure
- Use `--help` flag on any command
- Logs show exactly what's happening

---

**You have a complete, professional test automation platform!** 🎉

Everything works. All features are ready. Start testing now! 🚀
