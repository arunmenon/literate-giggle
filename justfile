# ExamIQ + ClaudeFast Command Runner
# Install just: brew install just
# Then run: just <command>

# Show available commands
default:
    @just --list

# ── Launch Claude Code ───────────────────────

# Start Claude (optionally with a slash command)
# Examples:
#   just cc              → launches claude
#   just cc team-plan    → launches claude with /team-plan
cc *CMD:
    #!/bin/bash
    if [ -z "{{CMD}}" ]; then claude; elif [ -f ".claude/commands/{{CMD}}.md" ]; then claude --init "/{{CMD}}"; else echo "Error: .claude/commands/{{CMD}}.md not found"; echo ""; echo "Available commands:"; ls .claude/commands/*.md 2>/dev/null | xargs -I{} basename {} .md; exit 1; fi

# Start Claude with Agent Teams enabled (required for /team-build)
# Examples:
#   just team            → launches claude with Agent Teams
#   just team team-plan  → launches with Agent Teams + /team-plan
team *CMD:
    #!/bin/bash
    export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
    if [ -z "{{CMD}}" ]; then claude; elif [ -f ".claude/commands/{{CMD}}.md" ]; then claude --init "/{{CMD}}"; else echo "Error: .claude/commands/{{CMD}}.md not found"; exit 1; fi

# ── Development ──────────────────────────────

# Start backend dev server
backend:
    cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Start frontend dev server
frontend:
    cd frontend && npm run dev

# Seed the database
seed:
    cd backend && source venv/bin/activate && python seed_data.py

# Start both services with Docker
docker:
    docker compose up --build

# ── Utilities ────────────────────────────────

# List available slash commands
commands:
    @echo "Available commands:"; ls .claude/commands/*.md 2>/dev/null | xargs -I{} basename {} .md
