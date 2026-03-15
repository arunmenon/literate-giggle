---
name: session-management
description: "Complete session-based development workflow for implementation tasks"
---

# Session-Based Workflow System

Use this skill for multi-phase implementations requiring coordination across specialists.

---

## Quick Reference: Session Types

| Type            | When to Use                           | Key Protocol                               |
| --------------- | ------------------------------------- | ------------------------------------------ |
| **Development** | Building features, implementing plans | Design-first, batch execution              |
| **Debugging**   | Fixing bugs, investigating failures   | Iron law: root cause before fix            |
| **Migration**   | Refactoring, replacing code           | Feature inventory required                 |
| **Review**      | Code review (self or peer)            | Technical rigor, no performative agreement |
| **TDD**         | Test-driven development               | RED-GREEN-REFACTOR cycle                   |
| **Research**    | Investigation, exploration            | No implementation until complete           |

**Session type files**: `session-types/*.md`

---

## Cross-Cutting Practices

These apply to ALL session types:

| Practice              | Purpose                           | File                             |
| --------------------- | --------------------------------- | -------------------------------- |
| **Verification**      | Evidence before completion claims | `practices/verification.md`      |
| **Branch Completion** | Finishing work on branches        | `practices/branch-completion.md` |

**Note**: For parallel vs sequential agent dispatch rules, see the `sub-agent-invocation` skill.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                    /team-plan + /build PIPELINE                        │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────────┐  │
│  │ CENTRAL AI   │───►│ /team-plan      │───►│ PLAN FILES           │  │
│  │ Coordinator  │    │ Plan Creation   │    │ .claude/tasks/*.md   │  │
│  │ Auto-invokes │    │ Stop Hooks      │    │ Source of Truth      │  │
│  └──────────────┘    └─────────────────┘    └──────────────────────┘  │
│         │                                            │                │
│         │            ┌─────────────────┐             │                │
│         │            │ USER APPROVAL   │◄────────────┘                │
│         │            │ Review & Go     │                              │
│         │            └────────┬────────┘                              │
│         │                     │                                       │
│         │            ┌────────▼────────┐                              │
│         └───────────►│ /build          │                              │
│                      │ Plan Execution  │                              │
│                      │ TaskList Sync   │                              │
│                      └────────┬────────┘                              │
│                               │                                       │
│  ┌────────────────────────────┼─────────────────────────────────────┐ │
│  │         SPECIALIST AGENTS  │                                     │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │ │
│  │  │ Frontend    │ │ Backend     │ │ Content     │                │ │
│  │  │ Specialist  │ │ Engineer    │ │ Writer      │                │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │ │
│  │  │ Quality     │ │ Security    │ │ Performance │                │ │
│  │  │ Engineer    │ │ Auditor     │ │ Optimizer   │                │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Session Status Lifecycle

```
PENDING → IN_PROGRESS → COMPLETE → VERIFIED
```

- **PENDING**: Session created, work not started
- **IN_PROGRESS**: Active work underway
- **COMPLETE**: All tasks done, awaiting verification
- **VERIFIED**: Verification passed, ready to archive

**Rule**: Update status as work progresses. Mark tasks `[x]` immediately upon completion.

---

## 5-Phase Session Flow (SOP: `/team-plan` + `/build`)

The standard operating procedure for all non-trivial implementation work is:

1. Assess complexity
2. Gather context if needed
3. Auto-invoke `/team-plan` to create a structured plan
4. Pause for user approval
5. Execute via `/build`

---

### Phase 1: Request Assessment

Central AI receives the user request and assesses complexity:

| Complexity   | Criteria                                           | Action                                  |
| ------------ | -------------------------------------------------- | --------------------------------------- |
| **Trivial**  | Single file, obvious fix, typo                     | Execute directly                        |
| **Moderate** | 2-5 files, clear scope, single domain              | Direct sub-agent delegation             |
| **Complex**  | Multi-phase, 5+ files, architectural, multi-domain | `/team-plan` → approval → `/build`      |
| **Unclear**  | Vague but potentially complex                      | Gather context first, then `/team-plan` |

**Decision**: Route to Phase 2 (context gathering), Phase 3 (plan creation), or skip to direct execution.

---

### Phase 2: Context Gathering (if needed)

Skip this phase if the initial request is already detailed enough for `/team-plan`.

**For vague or incomplete requests:**

- Ask clarifying questions via `AskUserQuestion`
- Determine scope, constraints, and preferences

**For unfamiliar codebase areas:**

- Run quick Explore agents to understand architecture
- Identify relevant patterns and existing implementations

**Output**: A comprehensive prompt incorporating all gathered context, ready to feed into `/team-plan`.

---

### Phase 3: Plan Creation (auto-invoke `/team-plan`)

Central AI auto-invokes the `/team-plan` command:

```
Skill({ skill: "team-plan", args: "<comprehensive prompt with all context>" })
```

**What happens:**

- `/team-plan` runs in the main thread with full codebase access
- Analyzes the codebase directly (no sub-agents during planning)
- Creates a structured plan with team members, tasks, dependencies, acceptance criteria
- Stop hooks validate the plan has all required sections
- Plan saved to `.claude/tasks/<descriptive-name>.md`

**After plan creation, Central AI PAUSES:**

- Presents the plan summary to the user
- Waits for approval ("go", `/build`, or feedback)
- If user requests changes, adjust the plan and re-present

**Prompt composition for auto-invocation should include:**

1. The user's verbatim request
2. Any clarifications gathered in Phase 2
3. Relevant codebase context discovered
4. Constraints or preferences expressed by the user
5. (Optional) Orchestration guidance for team composition

---

### Phase 4: Plan Execution (user-approved `/build`)

After user approval, Central AI invokes the `/build` command:

```
Skill({ skill: "build", args: ".claude/tasks/<plan-file>.md" })
```

**What happens:**

- `/build` reads the plan and creates `TaskCreate` entries for each step
- Sets dependencies with `addBlockedBy` / `addBlocks`
- Assigns owners to tasks matching team member names
- Deploys specialist agents via `Task` tool (parallel where dependencies allow)
- Quality engineer validates at the end

**Task List Synchronization:**

- Plan tasks automatically become the TaskList (created by `/build`)
- `TaskUpdate` marks tasks `in_progress` when starting, `completed` when done
- Press `Ctrl+T` to toggle task visibility during work
- For cross-session work, set `CLAUDE_CODE_TASK_LIST_ID` environment variable

**Quality Gates** (applied during execution):

| Level               | Validation                                                   |
| ------------------- | ------------------------------------------------------------ |
| **Implementation**  | Code compiles, basic functionality works, local testing done |
| **Integration**     | API contracts validated, cross-component compatibility       |
| **Quality**         | Tests passing, performance benchmarks met                    |
| **User Acceptance** | User approves, business requirements met                     |

**Apply verification practice** (`practices/verification.md`) before claiming completion.

---

### Phase 5: Commit & Archive

Load the `git-commits` skill for commit creation.
Apply `practices/branch-completion.md` for branch handling.

**Session Continuity**:

- Plan file moves to `.claude/tasks/archive/` after completion
- Extract incomplete work to new session if needed
- Reference prior plan files for context in future sessions

---

## Session File Template

**Note:** For complex work, the `/team-plan` command generates the session/plan file automatically. Use this template only for moderate work where you create the session file manually.

For `/team-plan` output format, see `.claude/commands/team-plan.md` (Plan Format section).

```markdown
# Session - [Title]

## Session Overview

**User Request**: [Verbatim user request]
**Session Type**: Development / Debugging / Migration / Review / TDD / Research
**Status**: `PENDING`
**Success Criteria**: [What defines completion]
**Quality Gates**: [Validation checkpoints]

## Strategic Analysis

**Complexity Assessment**: Simple / Complex
**Domain Coverage**: [List of domains involved]
**Dependencies**: [Internal and external dependencies]
**Risk Factors**: [Potential challenges]

## Task Breakdown

### Phase 1: [Phase Name]

**Assigned To**: [Specialist agent]

- [ ] Task 1 - [Specific implementation detail]
- [ ] Task 2 - [Specific implementation detail]

### Phase 2: [Phase Name]

**Assigned To**: [Specialist agent]

- [ ] Task 1 - [Specific implementation detail]

## Agent Work Sections

### [Specialist Agent Name]

**Status**: In Progress / Completed
**Tasks Completed**:

- Task 1 - [brief outcome]

**Implementation Notes**: [What was built, how, why]
**Integration Points**: [How it connects to other work]
**Next Agent Context**: [What next agent needs to know]

## Session Metrics

**Tasks Total**: X
**Tasks Completed**: Y
**Blockers**: [Any impediments]
**Follow-up Items**: [Work for next session]

## Quality Validation

- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security standards validated
- [ ] User acceptance achieved
- [ ] Verification evidence provided
```

---

## Directory Structure

```
session-management/
├── SKILL.md                    # This file - core orchestration
├── session-types/
│   ├── development.md          # Feature development sessions
│   ├── debugging.md            # Bug fixing sessions
│   ├── migration.md            # Refactoring/migration sessions
│   ├── review.md               # Code review sessions
│   ├── tdd.md                  # Test-driven development sessions
│   └── research.md             # Investigation sessions
└── practices/
    ├── verification.md         # Evidence-before-completion protocol
    └── branch-completion.md    # Branch finishing workflow
```

---

## Loading Session Type Protocols

When starting a session, load the appropriate type:

```markdown
# For debugging work:

Read: session-types/debugging.md

# For migrations:

Read: session-types/migration.md

# For TDD:

Read: session-types/tdd.md
```

The session type file contains specific protocols, checklists, and workflow requirements for that type of work.
