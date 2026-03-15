import { serve } from "@/index.js";
import { execSync } from "child_process";
import { mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(__dirname, "..", "tmp");
const profileDir = join(__dirname, "..", "profiles");
const isWindows = process.platform === "win32";

// Create tmp and profile directories if they don't exist
console.log("Creating tmp directory...");
mkdirSync(tmpDir, { recursive: true });
console.log("Creating profiles directory...");
mkdirSync(profileDir, { recursive: true });

// Install Playwright browsers if not already installed
console.log("Checking Playwright browser installation...");

function findPackageManager(): { name: string; command: string } | null {
  const managers = [
    { name: "bun", command: "bunx playwright install chromium" },
    { name: "pnpm", command: "pnpm exec playwright install chromium" },
    { name: "npm", command: "npx playwright install chromium" },
  ];

  for (const manager of managers) {
    try {
      // Use 'where' on Windows, 'which' on Unix
      const whichCmd = isWindows ? "where" : "which";
      execSync(`${whichCmd} ${manager.name}`, { stdio: "ignore" });
      return manager;
    } catch {
      // Package manager not found, try next
    }
  }
  return null;
}

function isChromiumInstalled(): boolean {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";

  // Playwright cache location differs by platform
  let playwrightCacheDir: string;
  if (isWindows) {
    // Windows: %LOCALAPPDATA%\ms-playwright or %USERPROFILE%\.cache\ms-playwright
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      playwrightCacheDir = join(localAppData, "ms-playwright");
    } else {
      playwrightCacheDir = join(homeDir, ".cache", "ms-playwright");
    }
  } else {
    playwrightCacheDir = join(homeDir, ".cache", "ms-playwright");
  }

  if (!existsSync(playwrightCacheDir)) {
    return false;
  }

  // Check for chromium directories (e.g., chromium-1148, chromium_headless_shell-1148)
  try {
    const entries = readdirSync(playwrightCacheDir);
    return entries.some((entry) => entry.startsWith("chromium"));
  } catch {
    return false;
  }
}

try {
  if (!isChromiumInstalled()) {
    console.log("Playwright Chromium not found. Installing (this may take a minute)...");

    const pm = findPackageManager();
    if (!pm) {
      throw new Error("No package manager found (tried bun, pnpm, npm)");
    }

    console.log(`Using ${pm.name} to install Playwright...`);
    execSync(pm.command, { stdio: "inherit" });
    console.log("Chromium installed successfully.");
  } else {
    console.log("Playwright Chromium already installed.");
  }
} catch (error) {
  console.error("Failed to install Playwright browsers:", error);
  console.log("You may need to run: npx playwright install chromium");
}

// Kill any existing process on port 9222 (HTTP API) and 9223 (CDP)
console.log("Checking for existing servers...");
const ports = [9222, 9223];

if (isWindows) {
  // Windows: Use netstat + taskkill
  for (const port of ports) {
    try {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
      if (output) {
        // Extract PID from the last column
        const lines = output.split("\n");
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) {
            console.log(`Killing existing process on port ${port} (PID: ${pid})`);
            try {
              execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
            } catch {
              // Process may have already exited
            }
          }
        }
      }
    } catch {
      // No process on this port, which is fine
    }
  }
} else {
  // Unix: Use lsof
  for (const port of ports) {
    try {
      const pid = execSync(`lsof -ti:${port}`, { encoding: "utf-8" }).trim();
      if (pid) {
        console.log(`Killing existing process on port ${port} (PID: ${pid})`);
        execSync(`kill -9 ${pid}`);
      }
    } catch {
      // No process on this port, which is fine
    }
  }
}

console.log("Starting dev browser server...");
const headless = process.env.HEADLESS === "true";
const server = await serve({
  port: 9222,
  headless,
  profileDir,
});

console.log(`Dev browser server started`);
console.log(`  WebSocket: ${server.wsEndpoint}`);
console.log(`  Tmp directory: ${tmpDir}`);
console.log(`  Profile directory: ${profileDir}`);
console.log(`\nReady`);
console.log(`\nPress Ctrl+C to stop`);

// Keep the process running
await new Promise(() => {});
