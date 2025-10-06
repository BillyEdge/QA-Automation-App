# Application Flow & User Experience

## 🎯 Two Recording Modes (You Choose!)

### Mode 1: Platform-Specific Recording (Simple)
**Best for:** Testing one platform at a time

```
┌─────────────────────────────────────────┐
│  START APPLICATION                       │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  CHOOSE PLATFORM:                        │
│  [ ] Web Browser                         │
│  [ ] Desktop Application                 │
│  [ ] Mobile App (Android/iOS)            │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  RECORD ACTIONS ON THAT PLATFORM         │
│  • All steps are for chosen platform     │
│  • Cannot switch during recording        │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  STOP & SAVE                             │
│  ✅ One test case for one platform       │
└─────────────────────────────────────────┘
```

### Mode 2: Cross-Platform Recording (Like Ranorex)
**Best for:** Testing workflows across multiple platforms

```
┌─────────────────────────────────────────┐
│  START UNIFIED RECORDER                  │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  INTERACTIVE COMMAND MODE                │
│  > web https://example.com               │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  RECORDING WEB...                        │
│  • Click login button                    │
│  • Type username                         │
│  • Type password                         │
└─────────────────────────────────────────┘
                   │
                   ▼ (user types: switch)
┌─────────────────────────────────────────┐
│  > desktop                               │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  RECORDING DESKTOP...                    │
│  • Open desktop app                      │
│  • Click settings                        │
└─────────────────────────────────────────┘
                   │
                   ▼ (user types: switch)
┌─────────────────────────────────────────┐
│  > mobile android                        │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  RECORDING MOBILE...                     │
│  • Tap notification                      │
│  • Verify message                        │
└─────────────────────────────────────────┘
                   │
                   ▼ (user types: save)
┌─────────────────────────────────────────┐
│  SAVE CROSS-PLATFORM TEST                │
│  ✅ One test with all platforms!         │
│     - 5 web actions                      │
│     - 3 desktop actions                  │
│     - 2 mobile actions                   │
└─────────────────────────────────────────┘
```

---

## 📱 Detailed Flow Examples

### Example 1: E-Commerce Testing (Cross-Platform)

```
USER SCENARIO: Test complete shopping flow

Step 1: Web - Browse and Add to Cart
> web https://shop.example.com
  ✓ Search for product
  ✓ Click product
  ✓ Add to cart
  ✓ Proceed to checkout

Step 2: Desktop - Process Payment
> stop
> desktop
  ✓ Open desktop payment app
  ✓ Enter payment details
  ✓ Confirm payment

Step 3: Mobile - Verify Order
> stop
> mobile android
  ✓ Open mobile app
  ✓ Check notifications
  ✓ Verify order status

> save

RESULT: One test case with 10 steps across 3 platforms!
```

### Example 2: Login Testing (Single Platform)

```
USER SCENARIO: Test web login only

Command:
npm run dev -- record:web --url https://example.com/login

Actions:
  ✓ Navigate to login page
  ✓ Type username
  ✓ Type password
  ✓ Click login button
  ✓ Verify dashboard

Press Ctrl+C

RESULT: One web-only test case with 5 steps
```

---

## 🎮 Available Commands

### Platform-Specific Recording

```bash
# Web only
npm run dev -- record:web --url https://example.com

# Desktop only
npm run dev -- record:desktop

# Mobile only (Android)
npm run dev -- record:mobile --device android --package com.app

# Mobile only (iOS)
npm run dev -- record:mobile --device ios --package com.app.bundle
```

### Cross-Platform Recording (Unified)

```bash
# Start unified recorder
npm run dev -- record:unified

# Or with custom name
npm run dev -- record:unified --name "My Cross-Platform Test" --description "E2E flow"
```

**Interactive Commands:**
```
> web <url>              Start web recording
> desktop                Start desktop recording
> mobile android [app]   Start Android recording
> mobile ios [bundle]    Start iOS recording
> switch                 Stop current, ready for new platform
> stop                   Stop current platform
> status                 Show recording status
> save                   Save and exit
> help                   Show help
```

---

## 🔄 Complete Workflow Comparison

### Traditional Approach (Separate Tests)

```
Test 1: Web Login          (5 steps, web only)
Test 2: Desktop Settings   (3 steps, desktop only)
Test 3: Mobile Verify      (2 steps, mobile only)

To test complete flow: Execute 3 separate tests
```

### Ranorex-Style Approach (One Test)

```
Test 1: Complete E2E Flow  (10 steps, all platforms)
  Steps 1-5: Web actions
  Steps 6-8: Desktop actions
  Steps 9-10: Mobile actions

To test complete flow: Execute 1 test
```

---

## 🎯 Which Mode Should You Use?

### Use Platform-Specific Mode When:
- ✅ Testing only one platform
- ✅ Quick recording needed
- ✅ Platform-specific bugs
- ✅ Simpler test cases

### Use Cross-Platform Mode When:
- ✅ End-to-end workflows across platforms
- ✅ Complex integration scenarios
- ✅ Real-world user journeys
- ✅ Testing handoffs between platforms

---

## 💡 Real-World Example Scenarios

### Scenario 1: Banking App

**Cross-Platform Flow:**
```
1. Web: Login to online banking
2. Web: Transfer money
3. Mobile: Receive notification
4. Mobile: Verify transaction
5. Desktop: Check desktop app updated
```

**One Test = Complete User Journey!**

### Scenario 2: Shopping App

**Cross-Platform Flow:**
```
1. Mobile: Browse products in app
2. Web: Add to cart on website
3. Desktop: Complete payment in desktop app
4. Mobile: Check order status in app
```

### Scenario 3: Support Ticket

**Cross-Platform Flow:**
```
1. Web: Customer creates ticket
2. Desktop: Support agent processes in desktop tool
3. Mobile: Customer gets notification
4. Web: Customer verifies resolution
```

---

## 📊 Test Case Structure (Cross-Platform)

```json
{
  "id": "test-xyz789",
  "name": "Complete E-Commerce Flow",
  "description": "End-to-end shopping across all platforms",
  "platform": "web",
  "tags": ["cross-platform", "web", "desktop", "mobile", "e2e"],
  "actions": [
    {
      "id": "action-1",
      "platform": "web",
      "type": "navigate",
      "value": "https://shop.example.com",
      "description": "Navigate to shop"
    },
    {
      "id": "action-2",
      "platform": "web",
      "type": "click",
      "target": {"type": "css", "value": "#product-1"},
      "description": "Click product"
    },
    {
      "id": "action-3",
      "platform": "desktop",
      "type": "click",
      "target": {"type": "coordinates", "value": "{\"x\":100,\"y\":200}"},
      "description": "Open payment app"
    },
    {
      "id": "action-4",
      "platform": "mobile",
      "type": "tap",
      "target": {"type": "accessibility_id", "value": "notifications"},
      "description": "Check notification"
    }
  ]
}
```

---

## 🚀 Getting Started

### Quick Start - Platform-Specific

```bash
# 1. Choose your platform and record
npm run dev -- record:web --url https://example.com

# 2. Interact with the app
# Click, type, navigate...

# 3. Press Ctrl+C to stop

# 4. Execute
npm run dev -- execute recordings/YOUR-TEST-ID.json
```

### Quick Start - Cross-Platform

```bash
# 1. Start unified recorder
npm run dev -- record:unified

# 2. Record web actions
> web https://example.com
# ... interact ...
> stop

# 3. Record desktop actions
> desktop
# ... interact ...
> stop

# 4. Record mobile actions
> mobile android com.example.app
# ... interact ...
> stop

# 5. Save
> save

# 6. Execute
npm run dev -- execute recordings/YOUR-TEST-ID.json
```

---

## 📈 Execution Flow

```
┌─────────────────────────────────────────┐
│  LOAD TEST CASE                          │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  READ ALL STEPS                          │
│  Detect platforms used                   │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  FOR EACH STEP:                          │
│                                          │
│  IF step.platform == "web":              │
│    → Execute in web browser              │
│                                          │
│  IF step.platform == "desktop":          │
│    → Execute on desktop                  │
│                                          │
│  IF step.platform == "mobile":           │
│    → Execute on mobile device            │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  GENERATE REPORT                         │
│  • Steps by platform                     │
│  • Pass/fail status                      │
│  • Screenshots                           │
└─────────────────────────────────────────┘
```

---

## ✅ Summary

**Your QA Automation Platform supports BOTH modes:**

1. **Platform-Specific** (Simple, Fast)
   - One command
   - One platform
   - Quick tests

2. **Cross-Platform** (Ranorex-style, Powerful)
   - Interactive mode
   - Switch platforms during recording
   - Real-world scenarios

**Choose the mode that fits your testing needs!** 🎯
