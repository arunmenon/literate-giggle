# Repository Primer

## What This Repo Is

ExamIQ is a comprehensive exam question paper answer evaluator platform for ICSE/CBSE (Class 7-12, extensible to any class/board). It manages the full exam lifecycle: question curation, exam simulation, answer assessment, and AI-generated learning plans.

## Product / Feature Structure

| Feature / Module   | Route / Entry Point          | Description                                                    |
| ------------------ | ---------------------------- | -------------------------------------------------------------- |
| **Auth**           | `/api/auth/*`                | JWT-based registration and login with role-based access         |
| **Question Banks** | `/api/questions/*`           | CRUD for question banks and questions with metadata tagging    |
| **Papers**         | `/api/papers/*`              | Question paper creation with sections, lifecycle management    |
| **Exam Sessions**  | `/api/exams/*`               | Timed exam simulation with auto-save and flagging              |
| **Evaluation**     | `/api/evaluations/*`         | Multi-strategy answer scoring (MCQ, keyword, step-wise, AI)   |
| **Learning Plans** | `/api/learning/*`            | AI-generated study plans, topic mastery tracking               |
| **Dashboard**      | `/api/dashboard/*`           | Student and teacher analytics dashboards                       |
| **Frontend SPA**   | `/` (React Router)           | Student/Teacher dashboards, exam taking, results, question mgmt|

## Tech Stack

### Core Framework

- **Python 3.11+** with **FastAPI** (async)
- **React 18** with **TypeScript** (Vite bundler)
- **npm** for frontend package management
- **pip** with requirements.txt for backend

### Project Structure

```
backend/
  app/
    api/routes/       # REST API endpoints (auth, questions, papers, exams, evaluations, learning, dashboard)
    core/             # Config (pydantic-settings), database engine, JWT security
    models/           # SQLAlchemy ORM models (user, exam, evaluation, learning)
    schemas/          # Pydantic request/response schemas
    services/         # Business logic (evaluation_engine, ai_evaluator, learning_plan_generator)
  seed_data.py        # Database seeder with sample CBSE/ICSE questions
  requirements.txt
frontend/
  src/
    components/       # Reusable UI components
    pages/            # Route pages (Login, Register, ExamTake, ExamResults, etc.)
    services/api.ts   # Axios client with JWT interceptor
    store/            # Auth context (React Context API)
    types/            # TypeScript type definitions
```

### Database

- **SQLite** via **aiosqlite** (async driver)
- **SQLAlchemy 2.0** async ORM with `DeclarativeBase`
- No migration tool configured -- tables auto-created on startup via `init_db()`
- Schema changes require dropping DB or manual migration

### Authentication

- **Custom JWT** -- tokens issued by `/api/auth/login`, verified via FastAPI dependencies in `api/deps.py`
- Three roles: Student, Teacher, Admin
- Bearer token scheme with 24-hour expiry

### Styling

- Inline styles (no Tailwind/CSS framework currently)
- React components use standard CSS patterns

### Key Architectural Decisions

- All API routes are prefixed with `/api` and registered in `app/main.py`
- Vite dev server proxies `/api` requests to `localhost:8000` (configured in `vite.config.ts`)
- Evaluation strategies are routed by `QuestionType` enum in `evaluation_engine.py:evaluate_question()`
- AI evaluation (Anthropic API) is optional -- works without it using rubric-based scoring
- Database session uses async context manager with auto-commit/rollback in `get_db()`
- Exam lifecycle follows: Draft > Review > Published > Active > Completed > Archived

## Important Paths

| Path                                            | Purpose                                              |
| ----------------------------------------------- | ---------------------------------------------------- |
| `backend/app/main.py`                           | FastAPI app entry point, CORS, route registration    |
| `backend/app/core/config.py`                    | Settings via pydantic-settings (reads .env)          |
| `backend/app/core/database.py`                  | Async SQLAlchemy engine, session, Base, init_db      |
| `backend/app/core/security.py`                  | JWT token creation and verification, password hashing|
| `backend/app/api/deps.py`                       | Auth dependencies: get_current_user, require_teacher |
| `backend/app/services/evaluation_engine.py`     | Core scoring logic per question type                 |
| `backend/app/services/ai_evaluator.py`          | Optional AI-powered evaluation via Anthropic API     |
| `backend/seed_data.py`                          | Seeds DB with users, question banks, papers          |
| `backend/.env.example`                          | Template for required environment variables          |
| `frontend/src/App.tsx`                          | React Router setup with role-based routing           |
| `frontend/src/services/api.ts`                  | Axios client, JWT interceptor, all API modules       |
| `frontend/src/store/AuthContext.tsx`            | Auth state management (token in localStorage)        |
| `frontend/vite.config.ts`                      | Vite config with API proxy to backend                |
| `docker-compose.yml`                            | Docker setup for both services                       |

## Build Commands

```bash
# Backend Development
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python seed_data.py                          # Seed DB with sample questions + default users
uvicorn app.main:app --reload --port 8000    # Start dev server

# Frontend Development
cd frontend
npm install
npm run dev       # Dev server on :3000 (proxies /api to :8000)
npm run build     # TypeScript check + Vite production build

# Docker (both services)
docker compose up --build
```

## Environment Variables

**Required for build:**

- `DATABASE_URL` -- SQLite connection string (default: `sqlite+aiosqlite:///./examiq.db`)
- `SECRET_KEY` -- JWT signing key

**Optional:**

- `ANTHROPIC_API_KEY` -- Enables AI-powered evaluation (rubric-based scoring works without it)
- `DEBUG` -- Enables SQL echo and debug mode (default: true)

## Common Gotchas

1. **Backend must run first** -- Frontend Vite proxy expects backend at localhost:8000. Start backend before frontend.
2. **Seed before testing** -- Run `python seed_data.py` to create default users and sample questions. Without seeding, there are no users to log in with.
3. **No Alembic** -- Schema changes require deleting `examiq.db` and re-running seed. No migration tool is set up.
4. **AI evaluation is opt-in** -- Uncomment `anthropic>=0.40.0` in requirements.txt and set `ANTHROPIC_API_KEY` in `.env` to enable.
5. **CORS origins** -- Only `localhost:3000` and `localhost:5173` are allowed. Update `main.py` for other origins.
