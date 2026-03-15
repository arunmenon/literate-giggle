#!/usr/bin/env node
/**
 * ClaudeFast StatusLine Monitor v4 (Full-featured port from PS1)
 *
 * Line 1: [!] Model | tokens used/total | % used <count> | % free <count> | thinking: On/Off
 * Line 2: current: <progressbar> % | weekly: <progressbar> % | extra: <progressbar> $used/$limit
 * Line 3: resets <time> | resets <datetime> | resets <date>
 * Line 4: (conditional) -> backup_path when context < 30% free
 *
 * Configuration in settings.json:
 * {
 *   "statusLine": {
 *     "type": "command",
 *     "command": "node .claude/hooks/ContextRecoveryHook/statusline-monitor.mjs"
 *   }
 * }
 */

import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import {
  log,
  readState,
  writeState,
  runBackup,
} from "./backup-core.mjs";

// ============================================================================
// CONSTANTS
// ============================================================================

const BACKUP_THRESHOLDS = [30, 15, 5];
const CONTINUOUS_BACKUP_THRESHOLD = 5;
const AUTOCOMPACT_BUFFER_TOKENS = 33000; // Fixed 33k tokens, not a percentage
const SHOW_BACKUP_PATH_THRESHOLD = 30;

// ANSI color constants
const ESC = "\x1b";
const blue = `${ESC}[38;2;0;153;255m`;
const orange = `${ESC}[38;2;255;176;85m`;
const green = `${ESC}[38;2;0;160;0m`;
const cyan = `${ESC}[38;2;46;149;153m`;
const red = `${ESC}[38;2;255;85;85m`;
const yellow = `${ESC}[38;2;230;200;0m`;
const white = `${ESC}[38;2;220;220;220m`;
const dim = `${ESC}[2m`;
const reset = `${ESC}[0m`;
const sep = ` ${dim}|${reset} `;

// Bar and column widths
const BAR_WIDTH = 10;
const COL1_WIDTH = 26;
const COL2_WIDTH = 22;

// Cache settings
const CACHE_FILE = join(tmpdir(), "claude-statusline-usage-cache.json");
const CACHE_MAX_AGE_SECONDS = 60;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format token counts to human-readable (50k, 1.2m)
 */
function formatTokens(num) {
  if (num >= 1000000) return (Math.round((num / 1000000) * 10) / 10) + "m";
  if (num >= 1000) return Math.round(num / 1000) + "k";
  return String(num);
}

/**
 * Format a number with commas (e.g. 50000 -> "50,000")
 */
function formatComma(num) {
  return num.toLocaleString("en-US");
}

/**
 * Build a colored Unicode progress bar
 * Uses filled circles (U+25CF) and empty circles (U+25CB)
 */
function buildBar(pct, width) {
  let p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p * width) / 100);
  const empty = width - filled;

  let barColor;
  if (p >= 90) barColor = red;
  else if (p >= 70) barColor = yellow;
  else if (p >= 50) barColor = orange;
  else barColor = green;

  const filledStr = filled > 0 ? "\u25CF".repeat(filled) : "";
  const emptyStr = empty > 0 ? "\u25CB".repeat(empty) : "";

  return `${barColor}${filledStr}${dim}${emptyStr}${reset}`;
}

/**
 * Pad visible text to a fixed column width (ignoring ANSI escape codes)
 */
function padColumn(text, visibleLen, colWidth) {
  const padding = colWidth - visibleLen;
  if (padding > 0) return text + " ".repeat(padding);
  return text;
}

/**
 * Get ordinal suffix for a day of month (1st, 2nd, 3rd, 4th...)
 */
function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/**
 * Format ISO reset time to compact local time
 * style "time": "5:00pm (3h16m)"
 * style "datetime": "Thu, 7:00pm"
 * default: "feb 1"
 */
function formatResetTime(isoString, style) {
  if (!isoString) return "";
  try {
    const utc = new Date(isoString);
    if (isNaN(utc.getTime())) return "";

    if (style === "time") {
      // Current reset: "5:00pm (3h16m)"
      let hours = utc.getHours();
      const minutes = utc.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12;
      let timeStr = `${hours}:${minutes}${ampm}`;

      const remaining = utc.getTime() - Date.now();
      if (remaining > 0) {
        const totalMins = Math.floor(remaining / 60000);
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        timeStr += ` (${h}h${m}m)`;
      }
      return timeStr;
    } else if (style === "datetime") {
      // Weekly reset: "Thu, 7:00pm"
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayName = days[utc.getDay()];
      let hours = utc.getHours();
      const minutes = utc.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12;
      return `${dayName}, ${hours}:${minutes}${ampm}`;
    }

    // Default: "feb 1"
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    return `${months[utc.getMonth()]} ${utc.getDate()}`;
  } catch {
    return "";
  }
}

// ============================================================================
// BACKUP LOGIC (preserved from original .mjs)
// ============================================================================

/**
 * Check if we should trigger a backup
 */
function shouldBackup(currentFreeUntilCompact, state) {
  const lastFree = state.lastFreeUntilCompact ?? 100;

  // Check threshold crossings (crossing DOWN through a threshold)
  for (const threshold of BACKUP_THRESHOLDS) {
    if (lastFree > threshold && currentFreeUntilCompact <= threshold) {
      return { trigger: true, reason: `crossed_${threshold}pct_free` };
    }
  }

  // Below continuous threshold: backup on every decrease
  if (
    currentFreeUntilCompact < CONTINUOUS_BACKUP_THRESHOLD &&
    currentFreeUntilCompact < lastFree
  ) {
    return { trigger: true, reason: `below_${CONTINUOUS_BACKUP_THRESHOLD}pct_free` };
  }

  return { trigger: false, reason: null };
}

/**
 * Compute remaining percentage from the best available data.
 *
 * Prefers manual calculation from current_usage token counts (matches /context accuracy).
 * Falls back to remaining_percentage when current_usage is null (before first API call).
 */
function computeRemainingPct(contextWindow) {
  const windowSize = contextWindow.context_window_size || 200000;
  const currentUsage = contextWindow.current_usage;

  if (currentUsage != null) {
    const totalInput =
      (currentUsage.input_tokens || 0) +
      (currentUsage.cache_creation_input_tokens || 0) +
      (currentUsage.cache_read_input_tokens || 0);
    const totalOutput = currentUsage.output_tokens || 0;
    const usedPct = ((totalInput + totalOutput) / windowSize) * 100;
    return { remainingPct: Math.max(0, 100 - usedPct), isEstimate: false };
  }

  const remainingPct = contextWindow.remaining_percentage ?? 100;
  return { remainingPct, isEstimate: remainingPct >= 99 };
}

// ============================================================================
// THINKING STATUS
// ============================================================================

/**
 * Check if extended thinking is enabled in user settings
 */
function isThinkingEnabled() {
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      return settings.alwaysThinkingEnabled === true;
    }
  } catch {
    // Silently fail
  }
  return false;
}

// ============================================================================
// API USAGE FETCHING WITH CACHING
// ============================================================================

/**
 * Fetch API usage data from Anthropic's OAuth usage endpoint.
 * Uses a file-based cache with 60-second TTL.
 * Silently falls back to stale cache on errors.
 */
async function fetchUsageData() {
  let needsRefresh = true;
  let usageData = null;

  // Check cache
  try {
    if (existsSync(CACHE_FILE)) {
      const stat = statSync(CACHE_FILE);
      const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
      if (ageSeconds < CACHE_MAX_AGE_SECONDS) {
        needsRefresh = false;
        usageData = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
      }
    }
  } catch {
    needsRefresh = true;
  }

  if (needsRefresh) {
    try {
      const credsPath = join(homedir(), ".claude", ".credentials.json");
      if (existsSync(credsPath)) {
        const creds = JSON.parse(readFileSync(credsPath, "utf-8"));
        const token = creds.claudeAiOauth?.accessToken;
        if (token) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          try {
            const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
              method: "GET",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "anthropic-beta": "oauth-2025-04-20",
                "User-Agent": "claude-code/2.1.34",
              },
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (response.ok) {
              usageData = await response.json();
              // Write cache
              try {
                writeFileSync(CACHE_FILE, JSON.stringify(usageData, null, 2));
              } catch {
                // Silently fail on cache write
              }
            }
          } catch {
            clearTimeout(timeout);
          }
        }
      }
    } catch {
      // Silently fail - use stale cache if available
    }

    // Fall back to stale cache
    if (!usageData) {
      try {
        if (existsSync(CACHE_FILE)) {
          usageData = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
        }
      } catch {
        // No cache available
      }
    }
  }

  return usageData;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    const input = readFileSync(0, "utf-8");
    const data = JSON.parse(input);

    const contextWindow = data.context_window || {};
    const sessionId = data.session_id || "unknown";
    const modelName = data.model?.display_name || "Claude";

    // ===== TOKEN CALCULATIONS =====
    const windowSize = contextWindow.context_window_size || 200000;
    const usage = contextWindow.current_usage;

    let currentInput = 0;
    let currentTotal = 0;
    if (usage) {
      const inputTokens = usage.input_tokens || 0;
      const cacheCreate = usage.cache_creation_input_tokens || 0;
      const cacheRead = usage.cache_read_input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      currentInput = inputTokens + cacheCreate + cacheRead;
      currentTotal = currentInput + outputTokens;
    }

    const usedTokensStr = formatTokens(currentInput);
    const totalTokensStr = formatTokens(windowSize);

    const pctUsed = windowSize > 0 ? Math.round((currentInput / windowSize) * 100) : 0;

    // "Free" uses total (input + output) minus autocompact buffer (fixed 33k tokens)
    const autocompactBufferPct = (AUTOCOMPACT_BUFFER_TOKENS / windowSize) * 100;
    const pctRemainTotal = Math.max(0, 100 - (currentTotal / windowSize) * 100);
    const freeUntilCompact = Math.max(0, pctRemainTotal - autocompactBufferPct);

    // Comma-formatted counts
    const usedComma = formatComma(currentInput);
    const freeTokens = Math.max(0, (windowSize - currentTotal) - AUTOCOMPACT_BUFFER_TOKENS);
    const freeComma = formatComma(freeTokens);

    // Thinking status
    const thinkingOn = isThinkingEnabled();

    // Compute remaining for backup logic (preserved from original)
    const { remainingPct, isEstimate } = computeRemainingPct(contextWindow);

    log(`remaining=${remainingPct.toFixed(1)}%, freeUntilCompact=${freeUntilCompact.toFixed(1)}%, estimate=${isEstimate}`);

    // ===== BACKUP STATE MANAGEMENT =====
    const state = readState();

    // Reset state if session changed
    if (state.sessionId !== sessionId) {
      state.lastFreeUntilCompact = 100;
      state.lastBackupThreshold = null;
      state.currentBackupPath = null;
      state.sessionId = sessionId;
    }

    // Check if we should backup
    const backupCheck = shouldBackup(freeUntilCompact, state);
    if (backupCheck.trigger && sessionId !== "unknown") {
      log(`Threshold triggered: ${backupCheck.reason}`);
      const backupPath = runBackup(sessionId, backupCheck.reason, null, freeUntilCompact);
      if (backupPath) {
        state.currentBackupPath = backupPath;
      }
    }

    // Update state
    state.lastFreeUntilCompact = freeUntilCompact;
    state.sessionId = sessionId;
    writeState(state);

    // ===== LINE 1: Model | tokens | % used | % free | thinking =====
    let line1 = `${blue}${modelName}${reset}`;
    line1 += sep;
    line1 += `${orange}${usedTokensStr} / ${totalTokensStr}${reset}`;
    line1 += sep;
    line1 += `${green}${pctUsed}% used ${orange}${usedComma}${reset}`;
    line1 += sep;
    line1 += `${blue}${Math.round(freeUntilCompact)}% free ${orange}${freeComma}${reset}`;
    line1 += sep;
    line1 += "thinking: ";
    if (thinkingOn) {
      line1 += `${orange}On${reset}`;
    } else {
      line1 += `${dim}Off${reset}`;
    }

    // ===== LINES 2 & 3: Usage limits with progress bars (cached) =====
    const usageData = await fetchUsageData();

    let line2 = "";
    let line3 = "";

    if (usageData) {
      // ---- 5-hour (current) ----
      let fiveHourPct = 0;
      let fiveHourReset = "";
      if (usageData.five_hour && usageData.five_hour.utilization != null) {
        fiveHourPct = Math.round(Number(usageData.five_hour.utilization));
        fiveHourReset = formatResetTime(usageData.five_hour.resets_at, "time");
      }
      const fiveHourBar = buildBar(fiveHourPct, BAR_WIDTH);
      const col1BarVis = `current: ${"x".repeat(BAR_WIDTH)} ${fiveHourPct}%`;
      let col1Bar = `${white}current:${reset} ${fiveHourBar} ${green}${fiveHourPct}%${reset}`;
      col1Bar = padColumn(col1Bar, col1BarVis.length, COL1_WIDTH);

      const col1Reset = `resets ${fiveHourReset}`;
      let col1ResetColored = `${white}resets ${fiveHourReset}${reset}`;
      col1ResetColored = padColumn(col1ResetColored, col1Reset.length, COL1_WIDTH);

      // ---- 7-day (weekly) ----
      let sevenDayPct = 0;
      let sevenDayReset = "";
      if (usageData.seven_day && usageData.seven_day.utilization != null) {
        sevenDayPct = Math.round(Number(usageData.seven_day.utilization));
        sevenDayReset = formatResetTime(usageData.seven_day.resets_at, "datetime");
      }
      const sevenDayBar = buildBar(sevenDayPct, BAR_WIDTH);
      const col2BarVis = `weekly: ${"x".repeat(BAR_WIDTH)} ${sevenDayPct}%`;
      let col2Bar = `${white}weekly:${reset} ${sevenDayBar} ${green}${sevenDayPct}%${reset}`;
      col2Bar = padColumn(col2Bar, col2BarVis.length, COL2_WIDTH);

      const col2Reset = `resets ${sevenDayReset}`;
      let col2ResetColored = `${white}resets ${sevenDayReset}${reset}`;
      col2ResetColored = padColumn(col2ResetColored, col2Reset.length, COL2_WIDTH);

      // ---- Extra usage ----
      let col3Bar = "";
      let col3ResetColored = "";
      if (usageData.extra_usage && usageData.extra_usage.is_enabled) {
        const extraPct = Math.round(Number(usageData.extra_usage.utilization));
        const extraUsed = (Number(usageData.extra_usage.used_credits) / 100).toFixed(2);
        const extraLimit = (Number(usageData.extra_usage.monthly_limit) / 100).toFixed(2);
        const extraBar = buildBar(extraPct, BAR_WIDTH);

        // Next month's 1st for reset date
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const extraReset = `${months[nextMonth.getMonth()]} ${nextMonth.getDate()}`;

        col3Bar = `${white}extra:${reset} ${extraBar} ${cyan}$${extraUsed}/$${extraLimit}${reset}`;
        col3ResetColored = `${white}resets ${extraReset}${reset}`;
      }

      // Assemble line 2: bars row
      line2 = col1Bar + sep + col2Bar;
      if (col3Bar) line2 += sep + col3Bar;

      // Assemble line 3: resets row
      line3 = col1ResetColored + sep + col2ResetColored;
      if (col3ResetColored) line3 += sep + col3ResetColored;
    }

    // ===== LINE 4: Backup path (conditional) =====
    let line4 = "";
    if (freeUntilCompact <= SHOW_BACKUP_PATH_THRESHOLD && state.currentBackupPath) {
      line4 = `${yellow}->${red} ${state.currentBackupPath}${reset}`;
    }

    // ===== OUTPUT =====
    process.stdout.write(line1);
    if (line2) process.stdout.write("\n" + line2);
    if (line3) process.stdout.write("\n" + line3);
    if (line4) process.stdout.write("\n" + line4);

    process.exit(0);
  } catch (err) {
    log(`Error: ${err.message}`);
    process.stdout.write("Claude | Error: " + (err.message || err));
    process.exit(0);
  }
}

main().catch(() => {
  process.stdout.write("Claude");
  process.exit(0);
});
