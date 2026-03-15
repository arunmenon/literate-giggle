#!/usr/bin/env node
/**
 * ClaudeFast Backup Core Module
 *
 * Shared backup logic used by:
 * - statusline-monitor.mjs (threshold-based backups)
 * - conv-backup.mjs (PreCompact backups)
 *
 * Responsibilities:
 * - Parse transcript JSONL to extract session data
 * - Format session summary as markdown
 * - Save backup with numbered filename
 * - Update shared state file with current backup path
 *
 * Backup filename format: {number}-backup-{date}.md
 * Example: 3-backup-26th-Jan-2026-4-30pm.md
 *
 * State file: ~/.claude/claudefast-statusline-state.json
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// LOGGING
// ============================================================================

export function log(message) {
  const logDir = join(__dirname, "logs");
  mkdirSync(logDir, { recursive: true });

  const logFile = join(logDir, "backup-core.log");
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;

  try {
    const existing = existsSync(logFile) ? readFileSync(logFile, "utf-8") : "";
    const lines = existing
      .split("\n")
      .filter((l) => l)
      .slice(-99);
    lines.push(logLine.trim());
    writeFileSync(logFile, lines.join("\n") + "\n");
  } catch (err) {
    // Fail silently
  }
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export function getStatePath() {
  return join(homedir(), ".claude", "claudefast-statusline-state.json");
}

export function readState() {
  try {
    const statePath = getStatePath();
    if (existsSync(statePath)) {
      return JSON.parse(readFileSync(statePath, "utf-8"));
    }
  } catch (err) {
    // Ignore errors, return default state
  }
  return {
    lastFreeUntilCompact: 100,
    lastBackupThreshold: null,
    sessionId: null,
    currentBackupPath: null,
  };
}

export function writeState(state) {
  try {
    const stateDir = join(homedir(), ".claude");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
  } catch (err) {
    // Fail silently
  }
}

export function updateStateWithBackupPath(sessionId, relativePath) {
  const state = readState();
  state.currentBackupPath = relativePath;
  state.sessionId = sessionId;
  writeState(state);
}

// ============================================================================
// TRANSCRIPT PARSING
// ============================================================================

export function parseTranscript(transcriptPath) {
  const summary = {
    userRequests: [],
    claudeResponses: [],
    filesModified: new Set(),
    tasksCreated: [],
    tasksCompleted: [],
    tasksPending: [],
    subAgentCalls: [],
    skillsLoaded: new Set(),
    mcpToolCalls: [],
    buildTestResults: [],
    sessionStart: null,
    sessionEnd: null,
  };

  if (!existsSync(transcriptPath)) {
    log(`Transcript not found: ${transcriptPath}`);
    return null;
  }

  try {
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        // Track session timing
        if (entry.timestamp) {
          if (!summary.sessionStart) {
            summary.sessionStart = entry.timestamp;
          }
          summary.sessionEnd = entry.timestamp;
        }

        // Extract user requests (skip tool results and system messages)
        if (entry.type === "user" && entry.message?.content) {
          const content = entry.message.content;

          if (Array.isArray(content) || typeof content !== "string") {
            continue;
          }

          const trimmed = content.trim();
          if (!trimmed) continue;

          // Skip tool results and system messages
          if (
            trimmed.startsWith("[{") ||
            trimmed.startsWith('{"tool_use_id"') ||
            trimmed.startsWith("Caveat:") ||
            trimmed.startsWith("<command-") ||
            trimmed.startsWith("<local-command-") ||
            trimmed.includes("<local-command-stdout>") ||
            trimmed.includes("<command-name>") ||
            trimmed.startsWith("[?") ||
            trimmed.startsWith("\x1b[") ||
            trimmed.startsWith("This session is being continued from") ||
            (trimmed.length < 10 && !trimmed.includes(" "))
          ) {
            continue;
          }

          summary.userRequests.push(trimmed);
        }

        // Extract from assistant messages
        if (entry.type === "assistant" && entry.message?.content) {
          const contentArray = Array.isArray(entry.message.content)
            ? entry.message.content
            : [entry.message.content];

          for (const block of contentArray) {
            // Claude's text responses
            if (block.type === "text" && block.text) {
              const text = block.text.trim();
              if (text.length > 50) {
                summary.claudeResponses.push(text);
              }
            }

            if (block.type === "tool_use") {
              const toolName = block.name;
              const toolInput = block.input || {};

              // Files modified
              if (toolName === "Write" || toolName === "Edit") {
                if (toolInput.file_path) {
                  summary.filesModified.add(toolInput.file_path);
                }
              }

              // TaskCreate (Anthropic's task system)
              if (toolName === "TaskCreate") {
                summary.tasksCreated.push({
                  subject: toolInput.subject || "No subject",
                  description: toolInput.description || "",
                });
              }

              // TaskUpdate (track status changes)
              if (toolName === "TaskUpdate") {
                if (toolInput.status === "completed") {
                  summary.tasksCompleted.push({
                    taskId: toolInput.taskId,
                  });
                } else if (
                  toolInput.status === "pending" ||
                  toolInput.status === "in_progress"
                ) {
                  summary.tasksPending.push({
                    taskId: toolInput.taskId,
                    status: toolInput.status,
                  });
                }
              }

              // Sub-agent calls
              if (toolName === "Task") {
                summary.subAgentCalls.push({
                  agent: toolInput.subagent_type || "unknown",
                  description: toolInput.description || "No description",
                });
              }

              // Skills loaded
              if (toolName === "Skill" && toolInput.skill) {
                summary.skillsLoaded.add(toolInput.skill);
              }

              // MCP tool calls
              if (toolName && toolName.startsWith("mcp__")) {
                const existingCall = summary.mcpToolCalls.find(
                  (c) => c.tool === toolName
                );
                if (existingCall) {
                  existingCall.count++;
                } else {
                  summary.mcpToolCalls.push({ tool: toolName, count: 1 });
                }
              }

              // Build/test results
              if (toolName === "Bash" && toolInput.command) {
                const cmd = toolInput.command.toLowerCase();
                if (
                  cmd.includes("build") ||
                  cmd.includes("test") ||
                  cmd.includes("pnpm") ||
                  cmd.includes("npm run")
                ) {
                  summary.buildTestResults.push({
                    command: toolInput.command,
                    result: "executed",
                  });
                }
              }
            }
          }
        }
      } catch (parseErr) {
        continue;
      }
    }

    // Convert Sets to Arrays
    summary.filesModified = Array.from(summary.filesModified);
    summary.skillsLoaded = Array.from(summary.skillsLoaded);

    return summary;
  } catch (err) {
    log(`Error parsing transcript: ${err.message}`);
    return null;
  }
}

// ============================================================================
// MARKDOWN FORMATTING
// ============================================================================

export function formatSummaryMarkdown(summary, trigger, sessionId, contextPct) {
  const lines = [];
  const timestamp = new Date().toISOString();

  lines.push(`# Session Backup`);
  lines.push(``);
  lines.push(`**Session ID:** ${sessionId}`);
  lines.push(`**Trigger:** ${trigger}`);
  if (contextPct !== undefined) {
    lines.push(`**Context Remaining:** ${contextPct.toFixed(1)}%`);
  }
  lines.push(`**Generated:** ${timestamp}`);
  if (summary.sessionStart) {
    lines.push(`**Session Start:** ${summary.sessionStart}`);
  }
  if (summary.sessionEnd) {
    lines.push(`**Session End:** ${summary.sessionEnd}`);
  }
  lines.push(``);

  // User Requests
  if (summary.userRequests.length > 0) {
    lines.push(`## User Requests`);
    for (const req of summary.userRequests) {
      lines.push(`- ${req}`);
    }
    lines.push(``);
  }

  // Claude's Key Responses
  if (summary.claudeResponses.length > 0) {
    lines.push(`## Claude's Key Responses`);
    for (const resp of summary.claudeResponses) {
      const indentedResp = resp.replace(/\n/g, "\n  ");
      lines.push(`- ${indentedResp}`);
    }
    lines.push(``);
  }

  // Files Modified
  if (summary.filesModified.length > 0) {
    lines.push(`## Files Modified`);
    for (const file of summary.filesModified) {
      const displayPath = file.replace(/^C:\\Github\\Claude-Fast\\/, "");
      lines.push(`- ${displayPath}`);
    }
    lines.push(``);
  }

  // Tasks (Anthropic's task system)
  if (
    summary.tasksCreated.length > 0 ||
    summary.tasksCompleted.length > 0 ||
    summary.tasksPending.length > 0
  ) {
    lines.push(`## Tasks`);
    if (summary.tasksCreated.length > 0) {
      lines.push(`### Created`);
      for (const task of summary.tasksCreated) {
        lines.push(`- **${task.subject}**`);
        if (task.description) {
          lines.push(`  ${task.description.slice(0, 200)}...`);
        }
      }
    }
    if (summary.tasksCompleted.length > 0) {
      lines.push(`### Completed`);
      lines.push(`- ${summary.tasksCompleted.length} tasks completed`);
    }
    if (summary.tasksPending.length > 0) {
      lines.push(`### Pending/In Progress`);
      lines.push(`- ${summary.tasksPending.length} tasks remaining`);
    }
    lines.push(``);
  }

  // Sub-Agents Invoked
  if (summary.subAgentCalls.length > 0) {
    lines.push(`## Sub-Agents Invoked`);
    for (const call of summary.subAgentCalls) {
      lines.push(`- **${call.agent}**: ${call.description}`);
    }
    lines.push(``);
  }

  // Skills Loaded
  if (summary.skillsLoaded.length > 0) {
    lines.push(`## Skills Loaded`);
    for (const skill of summary.skillsLoaded) {
      lines.push(`- ${skill}`);
    }
    lines.push(``);
  }

  // MCP Tools Used
  if (summary.mcpToolCalls.length > 0) {
    lines.push(`## MCP Tools Used`);
    for (const call of summary.mcpToolCalls) {
      lines.push(`- ${call.tool} (${call.count} calls)`);
    }
    lines.push(``);
  }

  // Build/Test Commands
  if (summary.buildTestResults.length > 0) {
    lines.push(`## Build/Test Commands`);
    for (const result of summary.buildTestResults) {
      lines.push(`- \`${result.command}\`: ${result.result}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function formatFriendlyDate(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const day = date.getDate();
  const ordinal = getOrdinalSuffix(day);
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day}${ordinal}-${month}-${year}-${hours}-${minutes}${ampm}`;
}

function getNextBackupNumber(backupDir) {
  try {
    if (!existsSync(backupDir)) return 1;
    const files = readdirSync(backupDir).filter(
      (f) => f.endsWith(".md") && /^\d+-/.test(f)
    );
    if (files.length === 0) return 1;

    const numbers = files.map((f) => {
      const match = f.match(/^(\d+)-/);
      return match ? parseInt(match[1], 10) : 0;
    });
    return Math.max(...numbers) + 1;
  } catch (err) {
    log(`Error getting backup number: ${err.message}`);
    return 1;
  }
}

export function saveBackup(summaryMarkdown, existingRelativePath = null) {
  try {
    const projectDir = join(__dirname, "..", "..", "..");
    const backupDir = join(projectDir, ".claude", "backups");
    mkdirSync(backupDir, { recursive: true });

    // If a backup already exists for this session, overwrite it
    if (existingRelativePath) {
      const existingFullPath = join(projectDir, existingRelativePath);
      if (existsSync(existingFullPath)) {
        writeFileSync(existingFullPath, summaryMarkdown);
        log(`Backup updated (overwrite): ${existingFullPath}`);
        return { fullPath: existingFullPath, relativePath: existingRelativePath };
      }
    }

    // Otherwise create a new numbered backup
    const now = new Date();
    const backupNumber = getNextBackupNumber(backupDir);
    const friendlyDate = formatFriendlyDate(now);
    const backupName = `${backupNumber}-backup-${friendlyDate}.md`;
    const backupPath = join(backupDir, backupName);
    const relativePath = `.claude/backups/${backupName}`;

    writeFileSync(backupPath, summaryMarkdown);

    log(`Backup saved (new): ${backupPath}`);
    return { fullPath: backupPath, relativePath };
  } catch (err) {
    log(`Failed to save backup: ${err.message}`);
    return null;
  }
}

// ============================================================================
// TRANSCRIPT DISCOVERY
// ============================================================================

export function findTranscriptPath(sessionId) {
  try {
    const claudeDir = join(homedir(), ".claude", "projects");
    if (!existsSync(claudeDir)) return null;

    const projectDirs = readdirSync(claudeDir);
    for (const projectDir of projectDirs) {
      const projectPath = join(claudeDir, projectDir);
      const sessionFile = join(projectPath, `${sessionId}.jsonl`);
      if (existsSync(sessionFile)) {
        return sessionFile;
      }
    }
    return null;
  } catch (err) {
    log(`Error finding transcript: ${err.message}`);
    return null;
  }
}

// ============================================================================
// MAIN BACKUP FUNCTION
// ============================================================================

/**
 * Run a backup operation
 *
 * @param {string} sessionId - The session ID
 * @param {string} trigger - What triggered the backup (e.g., "crossed_30pct", "precompact_auto")
 * @param {string} transcriptPath - Path to transcript (optional, will search if not provided)
 * @param {number} contextPct - Current context percentage (optional)
 * @returns {string|null} - Relative path to backup file, or null on failure
 */
export function runBackup(sessionId, trigger, transcriptPath = null, contextPct = undefined) {
  log(`Running backup: trigger=${trigger}, session=${sessionId.slice(0, 8)}...`);

  // Find transcript if not provided
  const actualTranscriptPath = transcriptPath || findTranscriptPath(sessionId);
  if (!actualTranscriptPath) {
    log(`No transcript found for session ${sessionId}`);
    return null;
  }

  // Parse transcript
  const summary = parseTranscript(actualTranscriptPath);
  if (!summary) {
    log(`Failed to parse transcript`);
    return null;
  }

  // Format as markdown
  const markdown = formatSummaryMarkdown(summary, trigger, sessionId, contextPct);

  // Check if a backup already exists for this session (overwrite instead of creating new)
  const state = readState();
  const existingPath = (state.sessionId === sessionId && state.currentBackupPath) ? state.currentBackupPath : null;

  // Save backup (overwrites existing if same session, otherwise creates new)
  const result = saveBackup(markdown, existingPath);
  if (!result) {
    return null;
  }

  // Update state
  updateStateWithBackupPath(sessionId, result.relativePath);

  log(`Backup complete: ${result.relativePath}`);
  return result.relativePath;
}
