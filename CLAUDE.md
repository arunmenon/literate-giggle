# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## You are Claude, operating the ClaudeFast v5.1 AI Development Management System.

### Core Workflow

**EVERY request follows this sequence:**

Request > Load Skills > Gather Context > Execute

The SkillActivationHook system recommends which skills to use at key points in the conversation. Always follow skill recommendations before using execution tools (Task, Read, Edit, Write, Bash).

### Complexity Routing

- **Trivial** (single file, obvious fix) > Execute directly
- **Moderate** (2-5 files, clear scope) > Direct sub-agent delegation
- **Complex** (multi-phase, 5+ files, architectural) > Auto-invoke `/team-plan` > pause for approval > `/build`
- **Collaborative** (cross-domain, agents need coordination) > `/team-plan` > pause > `/team-build`

### `/team-plan` + `/build` as Standard Operating Procedure

The `/team-plan` > execution pipeline is the default for all non-trivial implementation work.

- Central AI auto-invokes `/team-plan` for complex requests
- After plan creation, pause and present the plan summary for user approval
- On approval, invoke `/build` (isolated sub-agents) or `/team-build` (collaborative Agent Teams)
- Plan files are saved to `.claude/tasks/` and archived after completion

**Key Commands**: `/team-plan`, `/build`, `/team-build`

### Agent Coordination

**MANDATORY**: All agents should use the Opus model.

- **Parallel**: Multiple Task tool invocations in single message when tasks are independent
- **Sequential**: Database > API > Frontend; Research > Planning > Implementation

### Context Management

- Central AI conserves context to extend pre-compaction capacity
- Delegate file explorations and low-lift tasks to sub-agents
- Sub-agents should maximize context collection (read all relevant files, load skills, gather examples)

### Build-Then-Validate Pattern

For high reliability, pair a specialist agent with quality-engineer in validation mode.

### Task List Synchronization

Use `TaskCreate` and `TaskUpdate` to mirror session checklists. Tasks support dependencies via `addBlockedBy` and `addBlocks`.

---

## Project Overview

ExamIQ is an exam evaluator platform for ICSE/CBSE (Class 7-12). It has a FastAPI async backend with SQLAlchemy models and a React/TypeScript Vite frontend. The database is SQLite via aiosqlite.

## Commands

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python seed_data.py                          # Seed DB with sample questions + default users
uvicorn app.main:app --reload --port 8000    # Start dev server
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # Dev server on :3000 (proxies /api to :8000)
npm run build     # TypeScript check + Vite production build
```

### Docker
```bash
docker compose up --build   # Runs both services (backend :8000, frontend :3000)
```

### Default Credentials
- Teacher: teacher@examiq.com / teacher123
- Student: student@examiq.com / student123

## Architecture

**Backend** (`backend/app/`): FastAPI application with async SQLAlchemy (aiosqlite). All routes are under `/api` prefix.
- `core/` -- Config (pydantic-settings from `.env`), database engine/session, JWT security
- `models/` -- SQLAlchemy ORM models: `user.py` (User, StudentProfile, TeacherProfile), `exam.py` (QuestionBank, Question, QuestionPaper, PaperQuestion, ExamSession, StudentAnswer), `evaluation.py`, `learning.py`
- `schemas/` -- Pydantic request/response schemas mirroring models
- `api/routes/` -- REST endpoints: auth, questions, papers, exams, evaluations, learning, dashboard
- `api/deps.py` -- FastAPI dependencies for auth: `get_current_user`, `get_current_student`, `require_teacher_or_admin`
- `services/` -- Business logic: `evaluation_engine.py` (scoring strategies per question type), `ai_evaluator.py` (optional Anthropic API), `learning_plan_generator.py`

**Frontend** (`frontend/src/`): React 18 SPA with React Router v6, Axios for API calls.
- `services/api.ts` -- Axios client with JWT interceptor; all API modules (authAPI, questionAPI, paperAPI, examAPI, evaluationAPI, learningAPI, dashboardAPI)
- `store/AuthContext.tsx` -- Auth state (token in localStorage)
- `pages/` -- Route components; `App.tsx` handles routing with role-based dashboard (student vs teacher/admin)
- Vite proxies `/api` requests to `localhost:8000` in dev

## Key Domain Concepts

- **Exam lifecycle**: Draft > Review > Published > Active > Completed > Archived (PaperStatus enum)
- **Question types** (10): MCQ, Short Answer, Long Answer, Very Short, Fill-in-blank, True/False, Match, Diagram, Numerical, Case Study
- **Evaluation strategies** routed by question type in `evaluation_engine.py:evaluate_question()`: MCQ exact-match, keyword-based scoring, step-wise marking for numerical, length heuristic for long answers
- **Roles**: Student, Teacher, Admin -- enforced via FastAPI dependencies in `api/deps.py`
- **AI evaluation** is optional -- requires uncommenting `anthropic` in requirements.txt and setting `ANTHROPIC_API_KEY` in `.env`

## Database

SQLite with async driver (aiosqlite). Tables auto-created on startup via `init_db()` in the FastAPI lifespan handler. No migration tool (Alembic) is configured -- schema changes require either dropping/recreating the DB or manual migration.

---

## Coding Best Practices

**Priority Order** (when trade-offs arise): Correctness > Maintainability > Performance > Brevity

1. **Task Complexity Assessment**: Classify before starting: Trivial > execute directly, Moderate > brief planning then execute, Complex > full research and planning phase first.
2. **Integration & Dependency Management**: Before modifying any feature, identify all downstream consumers using codebase search, validate changes against all consumers.
3. **Incremental Development**: Implement in atomic tasks with 5 or fewer files, testing each increment before proceeding.
4. **Context & Pattern Consistency**: Review relevant files and existing implementations before coding, match established naming conventions.
5. **Self-Correction**: Fix syntax errors, typos, and obvious mistakes immediately without asking permission.

## Available Specialist Agents

| Agent                  | Domain                                                  |
| ---------------------- | ------------------------------------------------------- |
| backend-engineer       | FastAPI routes, SQLAlchemy models, Pydantic schemas     |
| frontend-specialist    | React components, UI, forms, responsive design          |
| debugger-detective     | Systematic debugging, root cause analysis               |
| deep-researcher        | External research, technology evaluation                |
| quality-engineer       | Testing, TDD, pattern validation                        |
| security-auditor       | Security reviews, OWASP, vulnerability assessment       |
| performance-optimizer  | Performance analysis, Core Web Vitals, query optimization|
| code-simplifier        | Code simplification, refactoring for clarity            |
| master-orchestrator    | Strategic planning, codebase analysis, task enrichment  |
| session-librarian      | Session file organization, consolidation                |
| visual-explainer       | HTML visualizations, architecture diagrams              |

## Key Skills

`session-management`, `sub-agent-invocation`, `git-commits`, `codebase-navigation`, `frontend-design`, `react`, `documentation-research`, `dev-browser`, `new-skills`
