# ExamIQ Roadmap

Execution sequence for all feature requests. Waves respect the cross-plan conflict analysis (`.claude/tasks/cross-plan-conflict-report.md`).

## Shipped

| Wave | FR | Feature | Shipped | Notes |
|------|-----|---------|---------|-------|
| 1a | FR-002 | LaTeX/Math Rendering | 2026-03-19 | KaTeX, MathText component, 6 surfaces |
| 1b | FR-003 P1 | Enrollment Phase 1 | 2026-03-19 | Join codes, QR, WhatsApp, copy roster, join page |

## Queued

| Wave | FR | Feature | Effort | Plan File | Dependencies |
|------|-----|---------|--------|-----------|-------------|
| **2a** | FR-004 P0 | Curriculum Intelligence (CurriculumContext, Heatmap, Bloom's confidence, Difficulty calibration) | 2-3 days | `fr004-curriculum-intelligence-p0.md` | None (Wave 1 complete) |
| **2b** | FR-003 P2 | Enrollment Phase 2 (Bulk import, CSV, invite links, paginated list) | 1-2 days | `fr003-enrollment-roster.md` | Parallel with 2a (minimal overlap confirmed) |
| **2c** | FR-007 | Google SSO (Sign in with Google on login/register/join) | 2-3 days | Needs plan creation | Parallel with 2a+2b (zero file overlap -- auth routes only) |
| **3** | FR-006 | Multi-Workspace Student UX ("My Teachers" switcher, teacher badges, aggregated views) | 3-5 days | `fr006-multi-workspace-student-ux.md` | After Wave 2 (touches sidebar/dashboard -- verify no overlap with FR-003 P2) |
| **4a** | FR-001 P1 | Diagram Support Phase 1 (Image upload/display) | 2-3 days | `fr001-diagram-support.md` | After Wave 3 (QuestionReviewCard serialization) |
| **4b** | FR-001 P2 | Diagram Generation (LLM code → Mafs/SVG/Mermaid multi-renderer) | 3-4 days | `fr001-diagram-support.md` | After 4a |
| **4c** | FR-001 P3 | Student Canvas (Excalidraw) + Vision Evaluation | 7-8 days | `fr001-diagram-support.md` | After 4b |
| **5a** | FR-005 P0 | DPDP Consent Infrastructure (parental consent, opt-in gating) | 2-3 days | `fr005-voice-ai.md` | Can run alongside Wave 4 |
| **5b** | FR-005 P1a | Voice Navigation (Web Speech API, free) | 3-4 days | `fr005-voice-ai.md` | After 5a |
| **5c** | FR-005 P1b | STT for Exam Answers (Sarvam AI) | 7-10 days | `fr005-voice-ai.md` | After 5a |
| **5d** | FR-005 P1c | AI Tutor Voice Mode (OpenAI Realtime API) | 10-14 days | `fr005-voice-ai.md` | After 5c |
| **5e** | FR-005 P2 | Teacher Voice Workflows (dictation + voice feedback) | 7-10 days | `fr005-voice-ai.md` | After 5c |

## Research Reports

| Report | File | Sources | Status |
|--------|------|---------|--------|
| AI-Native Curriculum Patterns | `AI_NATIVE_CURRICULUM_RESEARCH.md` | 30+ | Approved (all 10 review fixes applied) |
| Voice AI in EdTech | `VOICE_AI_RESEARCH.md` | 35+ | Complete |
| Diagram Generation Alternatives | `DIAGRAM_GENERATION_RESEARCH.md` | 25+ | Approved (all 6 review fixes applied) |
| SSO & Social Auth | `SSO_AUTH_RESEARCH.md` | 30+ | Complete |

## Feature Request Tracker

All FRs documented in `FEATURE_REQUESTS.md`.

| FR | Name | Priority | Research | Plan | Built |
|----|------|----------|----------|------|-------|
| FR-001 | Diagram Support | P1 | `DIAGRAM_GENERATION_RESEARCH.md` | `fr001-diagram-support.md` | -- |
| FR-002 | LaTeX Rendering | P0 | -- | `fr002-latex-math-rendering.md` | Shipped |
| FR-003 | Enrollment + Roster | P0-P1 | -- | `fr003-enrollment-roster.md` | Phase 1 shipped |
| FR-004 | Curriculum Intelligence | P0-P1 | `AI_NATIVE_CURRICULUM_RESEARCH.md` | `fr004-curriculum-intelligence-p0.md` | -- |
| FR-005 | Voice AI | P1-P2 | `VOICE_AI_RESEARCH.md` | `fr005-voice-ai.md` | -- |
| FR-006 | Multi-Workspace Student UX | P1 | -- | `fr006-multi-workspace-student-ux.md` | -- |
| FR-007 | Google SSO | P1 | `SSO_AUTH_RESEARCH.md` | Needs creation | -- |

## Infrastructure

| Item | File | Status |
|------|------|--------|
| Wave 0 Schema Evolution | `wave0-schema-evolution.md` | Ready (consolidates all model changes) |
| Cross-Plan Conflict Report | `cross-plan-conflict-report.md` | Updated (rollback strategy + cross-FR tests added) |

## Execution Notes

- **Wave 2 parallelization**: FR-004 + FR-003 P2 + FR-007 can run simultaneously. FR-004 touches question_generator.py + BankAnalytics. FR-003 P2 touches classes.py + ClassManagement.tsx. FR-007 touches auth.py + Login/Register pages. Zero file overlap across the three.
- **Wave 3 sequencing**: FR-006 touches sidebar (Layout component) and StudentDashboard. Verify no overlap with FR-003 P2's ClassManagement.tsx before parallelizing. Safe to run after Wave 2 completes.
- **Wave 4-5 ordering**: FR-001 (Diagrams) and FR-005 (Voice) are independent. FR-001 Phase 3 (Excalidraw + Vision eval) is the largest single task (~7-8 days). FR-005 DPDP consent (Phase 0) could slot into Wave 4 since it only touches auth infrastructure.
- **Schema changes**: Each wave's DB drop+re-seed includes ALL prior waves' model changes. `seed_data.py` must be kept current.
- **No Alembic**: Rollback = `git revert` + drop DB + re-seed from reverted code.
