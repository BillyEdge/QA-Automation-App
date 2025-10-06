# QA Automation Platform - Architecture

## 📊 Complete Test Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    QA AUTOMATION PLATFORM                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 1: RECORDING - Capture User Actions                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
            ┌──────────────────────────┐
            │   USER PERFORMS ACTIONS  │
            │   • Click buttons        │
            │   • Type text           │
            │   • Navigate pages      │
            │   • Swipe/Scroll        │
            └──────────────────────────┘
                          │
                          ▼
            ┌──────────────────────────┐
            │   RECORDER CAPTURES:     │
            │   ✓ Action type          │
            │   ✓ Target element       │
            │   ✓ Values entered       │
            │   ✓ Screenshots          │
            │   ✓ Timestamps           │
            └──────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: TEST CASE - Individual Test with Steps             │
└─────────────────────────────────────────────────────────────┘

              📄 Test Case JSON File
    ┌──────────────────────────────────────┐
    │ {                                     │
    │   "id": "test-123",                  │
    │   "name": "Login Test",              │
    │   "platform": "web",                 │
    │   "actions": [                       │
    │                                       │
    │     ┌─────────────────────────────┐ │
    │     │  Step 1: Navigate           │ │
    │     │  • Navigate to login page   │ │
    │     │  • Screenshot captured      │ │
    │     └─────────────────────────────┘ │
    │                                       │
    │     ┌─────────────────────────────┐ │
    │     │  Step 2: Type Username      │ │
    │     │  • Find #username field     │ │
    │     │  • Type "testuser"          │ │
    │     │  • Screenshot captured      │ │
    │     └─────────────────────────────┘ │
    │                                       │
    │     ┌─────────────────────────────┐ │
    │     │  Step 3: Type Password      │ │
    │     │  • Find #password field     │ │
    │     │  • Type "pass123"           │ │
    │     │  • Screenshot captured      │ │
    │     └─────────────────────────────┘ │
    │                                       │
    │     ┌─────────────────────────────┐ │
    │     │  Step 4: Click Login        │ │
    │     │  • Find #login-btn          │ │
    │     │  • Click button             │ │
    │     │  • Screenshot captured      │ │
    │     └─────────────────────────────┘ │
    │                                       │
    │     ┌─────────────────────────────┐ │
    │     │  Step 5: Verify Success     │ │
    │     │  • Assert dashboard visible │ │
    │     │  • Screenshot captured      │ │
    │     └─────────────────────────────┘ │
    │   ]                                  │
    │ }                                     │
    └──────────────────────────────────────┘
             │
             │  ONE TEST CASE = ONE RECORDING
             │  Contains multiple test steps/actions
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: TEST SUITE - Group of Related Test Cases           │
└─────────────────────────────────────────────────────────────┘

            📦 Test Suite JSON File
    ┌──────────────────────────────────────┐
    │ {                                     │
    │   "id": "suite-456",                 │
    │   "name": "Smoke Tests",             │
    │   "description": "Critical flows",   │
    │   "testCases": [                     │
    │     "test-login.json",     ───┐     │
    │     "test-search.json",       │     │
    │     "test-checkout.json",     │     │
    │     "test-logout.json"        │     │
    │   ]                           │     │
    │ }                             │     │
    └───────────────────────────────┼─────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────┐    ┌──────────┐   ┌──────────┐
            │ Test Case│    │ Test Case│   │ Test Case│
            │    #1    │    │    #2    │   │    #3    │
            │ 5 steps  │    │ 8 steps  │   │ 3 steps  │
            └──────────┘    └──────────┘   └──────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 4: EXECUTION - Run Tests and Generate Reports         │
└─────────────────────────────────────────────────────────────┘

    Execute Individual Test Case:
    $ npm run dev -- execute recordings/test-login.json

    Execute Entire Suite:
    $ npm run dev -- suite:execute suite-456

                          │
                          ▼
            ┌──────────────────────────┐
            │  TEST EXECUTOR           │
            │  • Reads test steps      │
            │  • Executes each action  │
            │  • Captures results      │
            │  • Takes screenshots     │
            └──────────────────────────┘
                          │
                          ▼
            ┌──────────────────────────┐
            │  RESULTS & REPORTS       │
            │  ✓ Pass/Fail status      │
            │  ✓ Duration              │
            │  ✓ Step-by-step logs     │
            │  ✓ Screenshots           │
            │  ✓ HTML/JSON reports     │
            └──────────────────────────┘
