---
name: dev-browser
description: Browser automation and debugging with persistent page state. Use when users ask to navigate websites, fill forms, take screenshots, extract web data, test web apps, debug browser issues, monitor console errors, or track network requests. Trigger phrases include "go to [url]", "click on", "fill out the form", "take a screenshot", "scrape", "automate", "test the website", "log into", "debug", "console errors", "network requests", or any browser interaction request.
---

# Dev Browser Skill

Browser automation and debugging that maintains page state across script executions. Write small, focused scripts to accomplish tasks incrementally. Once you've proven out part of a workflow and there is repeated work to be done, you can write a script to do the repeated work in a single execution.

## Capabilities

| Feature | Description |
|---------|-------------|
| **Browser Automation** | Navigate, click, fill forms, interact with any page |
| **Persistent State** | Cookies, localStorage, DOM state survive between scripts |
| **ARIA Snapshots** | LLM-friendly accessibility tree with element refs |
| **Console Monitoring** | Capture console.log, errors, warnings |
| **Network Monitoring** | Track requests, responses, failures |
| **Screenshots** | Capture page state visually |
| **Cross-Platform** | Works on Windows, macOS, Linux |

## Setup

Start the dev-browser server using the appropriate script for your platform:

**macOS/Linux:**
```bash
./skills/dev-browser/server.sh &
```

**Windows (PowerShell):**
```powershell
Start-Process -NoNewWindow -FilePath "cmd" -ArgumentList "/c", "skills\dev-browser\server.bat"
```

**Or directly with bun (cross-platform):**
```bash
cd skills/dev-browser && bun i && bun x tsx scripts/start-server.ts
```

### Flags

- `--headless` - Start the browser in headless mode (no visible browser window)

**Wait for the `Ready` message before running scripts.** On first run, the server will:
- Install dependencies if needed
- Download and install Playwright Chromium browser
- Create the `tmp/` directory for scripts
- Create the `profiles/` directory for browser data persistence

## Choosing Your Approach

**Local/source-available sites**: If you have access to the source code (e.g., localhost or project files), read the code first to write selectors directly.

**Unknown page layouts**: Use `getAISnapshot()` to discover elements and `selectSnapshotRef()` to interact with them.

**Debugging issues**: Use `getConsole()` and `getNetwork()` to monitor errors and requests.

**Visual feedback**: Take screenshots to see what the user sees.

## Writing Scripts

Execute scripts inline using heredocs (macOS/Linux) or PowerShell here-strings (Windows):

**macOS/Linux:**
```bash
cd skills/dev-browser && bun x tsx <<'EOF'
import { connect } from "@/client.js";
const client = await connect("http://localhost:9222");
const page = await client.page("main");
// Your automation code here
await client.disconnect();
EOF
```

**Windows PowerShell:**
```powershell
cd skills/dev-browser
$script = @'
import { connect } from "@/client.js";
const client = await connect("http://localhost:9222");
const page = await client.page("main");
// Your automation code here
await client.disconnect();
'@
$script | bun x tsx
```

**Important:** Scripts must be run with `bun x tsx` (not `bun run`) due to Playwright WebSocket compatibility.

### Basic Template

```typescript
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect("http://localhost:9222");
const page = await client.page("main"); // get or create a named page

// Your automation code here
await page.goto("https://example.com");
await waitForPageLoad(page);

// Evaluate state at the end
const title = await page.title();
const url = page.url();
console.log({ title, url });

// Disconnect so the script exits (page stays alive on the server)
await client.disconnect();
```

### Key Principles

1. **Small scripts**: Each script should do ONE thing (navigate, click, fill, check)
2. **Evaluate state**: Always log/return state at the end to decide next steps
3. **Use page names**: Use descriptive names like `"checkout"`, `"login"`, `"search-results"`
4. **Disconnect to exit**: Call `await client.disconnect()` at the end of your script
5. **Plain JS in evaluate**: Always use plain JavaScript inside `page.evaluate()` callbacks

## Client API

```typescript
const client = await connect("http://localhost:9222");

// Page management
const page = await client.page("name");     // Get or create named page
const pages = await client.list();          // List all page names
await client.close("name");                 // Close a page
await client.disconnect();                  // Disconnect (pages persist)

// ARIA Snapshot for element discovery
const snapshot = await client.getAISnapshot("name");
const element = await client.selectSnapshotRef("name", "e5");

// Console monitoring
const logs = await client.getConsole("name");
const errors = await client.getConsole("name", { type: "error" });
const recent = await client.getConsole("name", { limit: 10, since: timestamp });

// Network monitoring
const requests = await client.getNetwork("name");
const failures = await client.getNetwork("name", { status: "error" });
const fetches = await client.getNetwork("name", { type: "fetch" });

// Clear logs
await client.clearLogs("name");             // Clear all
await client.clearLogs("name", "console");  // Clear console only
await client.clearLogs("name", "network");  // Clear network only
```

## Console Monitoring

Capture all console output from the page:

```typescript
import { connect } from "@/client.js";

const client = await connect("http://localhost:9222");

// Get all console logs
const logs = await client.getConsole("main");
console.log(logs);

// Get only errors
const errors = await client.getConsole("main", { type: "error" });

// Get only warnings
const warnings = await client.getConsole("main", { type: "warning" });

// Get logs since a specific timestamp (for polling)
const since = Date.now();
// ... do something ...
const newLogs = await client.getConsole("main", { since });

// Get and clear (useful for test scenarios)
const logsAndClear = await client.getConsole("main", { clear: true });

await client.disconnect();
```

**Console message types:** `log`, `debug`, `info`, `error`, `warning`, `dir`, `table`, `trace`, `assert`

**Console message format:**
```typescript
{
  type: "error",
  text: "Uncaught TypeError: Cannot read property 'x' of undefined",
  timestamp: 1699900000000,
  url: "https://example.com/app.js",
  lineNumber: 42,
  columnNumber: 15
}
```

## Network Monitoring

Track all network requests and responses:

```typescript
import { connect } from "@/client.js";

const client = await connect("http://localhost:9222");

// Get all network entries
const entries = await client.getNetwork("main");

// Filter by resource type
const xhrRequests = await client.getNetwork("main", { type: "xhr" });
const fetchRequests = await client.getNetwork("main", { type: "fetch" });
const documents = await client.getNetwork("main", { type: "document" });

// Filter by status
const clientErrors = await client.getNetwork("main", { status: "4xx" });
const serverErrors = await client.getNetwork("main", { status: "5xx" });
const allErrors = await client.getNetwork("main", { status: "error" });
const notFound = await client.getNetwork("main", { status: "404" });

// Poll for new requests
const since = Date.now();
// ... trigger some action ...
const newRequests = await client.getNetwork("main", { since });

await client.disconnect();
```

**Resource types:** `document`, `stylesheet`, `image`, `media`, `font`, `script`, `xhr`, `fetch`, `websocket`, `other`

**Network entry format:**
```typescript
{
  request: {
    id: "unique-id",
    url: "https://api.example.com/data",
    method: "POST",
    resourceType: "fetch",
    timestamp: 1699900000000,
    headers: { "Content-Type": "application/json" },
    postData: '{"key": "value"}'
  },
  response: {
    id: "unique-id",
    url: "https://api.example.com/data",
    status: 200,
    statusText: "OK",
    timestamp: 1699900000150,
    headers: { "Content-Type": "application/json" },
    responseTime: 150
  },
  pending: false,
  error: null
}
```

## ARIA Snapshot (Element Discovery)

Use `getAISnapshot()` when you don't know the page layout:

```typescript
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect("http://localhost:9222");
const page = await client.page("main");

await page.goto("https://news.ycombinator.com");
await waitForPageLoad(page);

// Get the ARIA accessibility snapshot
const snapshot = await client.getAISnapshot("main");
console.log(snapshot);

await client.disconnect();
```

**Example output:**
```yaml
- banner:
  - link "Hacker News" [ref=e1]
  - navigation:
    - link "new" [ref=e2]
    - link "past" [ref=e3]
  - link "login" [ref=e7]
- main:
  - list:
    - listitem:
      - link "Article Title Here" [ref=e8]
      - link "328 comments" [ref=e9]
```

**Interacting with refs:**
```typescript
const element = await client.selectSnapshotRef("main", "e2");
await element.click();
```

## Debugging Workflow

For debugging a web application issue:

```typescript
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect("http://localhost:9222");
const page = await client.page("debug");

// Navigate to the problematic page
await page.goto("http://localhost:3000/checkout");
await waitForPageLoad(page);

// Clear existing logs to start fresh
await client.clearLogs("debug");

// Perform the action that causes issues
await page.click('button[type="submit"]');

// Wait a moment for requests to complete
await new Promise(r => setTimeout(r, 2000));

// Check for console errors
const errors = await client.getConsole("debug", { type: "error" });
if (errors.length > 0) {
  console.log("Console Errors:");
  errors.forEach(e => console.log(`  ${e.text} (${e.url}:${e.lineNumber})`));
}

// Check for failed network requests
const failures = await client.getNetwork("debug", { status: "error" });
if (failures.length > 0) {
  console.log("Failed Requests:");
  failures.forEach(f => {
    const status = f.response?.status || "FAILED";
    console.log(`  ${status} ${f.request.method} ${f.request.url}`);
    if (f.error) console.log(`    Error: ${f.error}`);
  });
}

// Take a screenshot of current state
await page.screenshot({ path: "tmp/debug.png" });

await client.disconnect();
```

## Screenshots

```typescript
await page.screenshot({ path: "tmp/screenshot.png" });
await page.screenshot({ path: "tmp/full.png", fullPage: true });
```

## Waiting

```typescript
import { waitForPageLoad } from "@/client.js";

// Wait for page to fully load (document ready + network idle)
await waitForPageLoad(page);

// Wait for specific elements
await page.waitForSelector(".results");

// Wait for specific URL
await page.waitForURL("**/success");
```

## Error Recovery

If a script fails, the page state is preserved:

```typescript
import { connect } from "@/client.js";

const client = await connect("http://localhost:9222");
const page = await client.page("main");

// Take a debug screenshot
await page.screenshot({ path: "tmp/debug.png" });

// Check current state
console.log({
  url: page.url(),
  title: await page.title(),
});

// Check for errors
const errors = await client.getConsole("main", { type: "error" });
console.log("Errors:", errors);

await client.disconnect();
```

## Migration from browser-debugging

If you were using the `browser-debugging` skill, here's how to migrate:

| browser-debugging (cdp-cli) | dev-browser |
|-----------------------------|-------------|
| `cdp-cli tabs` | `client.list()` |
| `cdp-cli console "Page" --type error` | `client.getConsole("page", { type: "error" })` |
| `cdp-cli network "Page"` | `client.getNetwork("page")` |
| `cdp-cli screenshot "Page"` | `page.screenshot({ path: "..." })` |
| `cdp-cli eval "Page" "code"` | `page.evaluate(() => code)` |
| `cdp-cli snapshot "Page"` | `client.getAISnapshot("page")` |

**Advantages of dev-browser:**
- Full automation (click, fill, navigate) vs read-only
- Persistent sessions across script runs
- ARIA snapshots with clickable refs
- No need to manually launch Chrome with debug port
- Integrated in one tool instead of separate CLI
