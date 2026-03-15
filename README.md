# ExamIQ - Exam Evaluator Platform

A comprehensive exam question paper answer evaluator platform for ICSE/CBSE (Class 7-12, extensible to any class/board).

## Platform Overview

### Exam Lifecycle Management
```
Draft → Review → Published → Active → Completed → Archived
```

### Four Pillars

| Module | Description |
|--------|-------------|
| **Curation** | Question bank management, paper creation with sections, difficulty tagging, Bloom's taxonomy classification |
| **Simulation** | Timed exam sessions with auto-save, question palette, flagging, practice mode |
| **Assessment** | Multi-strategy answer evaluation (MCQ auto-grade, keyword matching, step-wise marking, rubric-based scoring) |
| **Learning Plan** | AI-generated personalized study plans, topic mastery tracking, progress monitoring, resource recommendations |

### Key Features
- **Multi-board support**: CBSE, ICSE, State Boards
- **10 question types**: MCQ, Short Answer, Long Answer, Very Short, Fill-in-blank, True/False, Match, Diagram, Numerical, Case Study
- **Smart evaluation**: Keyword matching, step-wise marking, Bloom's taxonomy analysis, difficulty-based scoring
- **Analytics**: Topic-wise scores, strengths/weaknesses, grade distribution, trend tracking
- **Role-based access**: Student, Teacher, Admin
- **Scalable architecture**: Async FastAPI + React SPA

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Seed database with sample CBSE Class 10 Math questions
python seed_data.py

# Start server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Docker Setup
```bash
docker compose up --build
```

### Default Credentials
| Role | Email | Password |
|------|-------|----------|
| Teacher | teacher@examiq.com | teacher123 |
| Student | student@examiq.com | student123 |

## API Documentation

After starting the backend, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### API Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| Auth | `POST /api/auth/register` | Register new user |
| Auth | `POST /api/auth/login` | Login |
| Questions | `POST /api/questions/banks` | Create question bank |
| Questions | `GET /api/questions` | Search/filter questions |
| Papers | `POST /api/papers` | Create question paper |
| Papers | `PATCH /api/papers/{id}/status` | Update paper lifecycle |
| Exams | `POST /api/exams/start` | Start exam session |
| Exams | `POST /api/exams/{id}/save` | Auto-save answers |
| Exams | `POST /api/exams/{id}/submit` | Submit exam |
| Evaluation | `POST /api/evaluations/evaluate` | Evaluate answers |
| Learning | `POST /api/learning/plans/generate` | Generate study plan |
| Learning | `GET /api/learning/mastery` | Topic mastery levels |
| Dashboard | `GET /api/dashboard/student` | Student dashboard |

## Architecture

```
backend/
├── app/
│   ├── api/routes/       # REST API endpoints
│   ├── core/             # Config, DB, security
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic validation
│   └── services/         # Business logic
│       ├── evaluation_engine.py    # Answer scoring
│       └── learning_plan_generator.py  # Plan generation
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route pages
│   ├── services/         # API client
│   ├── store/            # Auth context
│   └── types/            # TypeScript types
```

## Evaluation Engine

The platform supports multiple evaluation strategies:

- **MCQ/True-False**: Exact match auto-grading
- **Fill-in-blank**: Flexible matching with multiple valid answers
- **Keyword-based**: Matches expected keywords in student answers
- **Step-wise**: Awards marks for each step in numerical problems
- **Length heuristic**: Adjusts scores for answer completeness in long answers
- **Bloom's taxonomy**: Tracks cognitive level performance
- **Grade calculation**: CBSE grading system (A1-E)
