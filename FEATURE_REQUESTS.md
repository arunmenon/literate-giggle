# Feature Requests

Tracked feature requests for future builds. Each entry includes context and priority assessment.

---

## FR-001: Diagram Support in Questions & Answers

**Requested**: 2026-03-17
**Context**: Many CBSE/ICSE questions include diagrams (geometry figures, circuit diagrams, biology cross-sections). Students also need to draw/annotate answers.

**Current state**:

- `Question.question_image_url` field EXISTS in the model but not wired to UI
- `StudentAnswer.answer_image_url` field EXISTS in the model but not wired to UI
- Diagram question type generates text descriptions only ("Draw and label...")

**What's needed**:

- Image upload on question creation (teacher uploads diagram with question)
- Image display on exam-taking page (student sees the diagram)
- AI diagram generation (GPT-5.4/DALL-E generates geometry figures from question text)
- Student drawing/annotation widget (canvas for hand-drawn answers)
- Image-based evaluation (AI evaluates diagram answers for correct labels/structure)

**Priority**: P1 -- diagrams are common in CBSE/ICSE board exams, especially in Science and Mathematics

**Research update (2026-03-19)**: DALL-E is NOT the recommended approach. See `DIAGRAM_GENERATION_RESEARCH.md`. Key finding: DALL-E achieves only 12-14% accuracy on geometry diagrams vs 80%+ for LLM-generated SVG code. DALL-E 3 is also deprecated May 12, 2026. Recommended: multi-renderer architecture with LLM code generation (SVG for general, Mafs/JSXGraph for geometry, SchemDraw for circuits, RDKit.js for molecules, Mermaid for flowcharts). FR-001 plan needs Phase 2 revision to replace DALL-E with code-based diagram generation.

---

## FR-002: LaTeX / Math Notation Rendering

**Requested**: 2026-03-17
**Context**: GPT-5.4 generates math questions with LaTeX notation (e.g., `\(\angle B = 50^\circ\)`) which displays as raw text in the UI instead of rendered math symbols.

**Current state**:
- AI-generated questions contain LaTeX delimiters (`\(`, `\)`, `^`, `\circ`, `\sqrt{}`, etc.)
- Frontend renders these as plain text strings -- no math rendering library installed
- Affects all math-heavy questions (geometry angles, algebraic expressions, trigonometric ratios)

**What's needed**:
- Install KaTeX or MathJax in the frontend for math rendering
- Render LaTeX in: question text display, model answer display, MCQ options, exam-taking interface, results page
- AI prompt could also be updated to prefer Unicode symbols (angle = ∠, degree = °) over LaTeX for simpler cases
- Consider a toggle: "Render math" for display vs "Raw text" for editing

**Priority**: P0 -- math is the primary subject for CBSE/ICSE. Every math question looks broken without this.

---

## FR-003: Scalable Class Roster Management & Intuitive Enrollment

**Requested**: 2026-03-17
**Context**: The current Class Management UI (`ClassManagement.tsx`) was designed for a solo-teacher workspace with small class sizes. In the "school workspace" use case, a single class could have 100+ students, and a school could have 40+ classes. Additionally, the only enrollment method is "teacher types student email" -- this is unacceptable at any scale. We need zero-cognitive-load enrollment for both teachers and students.

**Architectural note -- Workspace + Class reconciliation**:

Currently workspace join and class enrollment are disconnected. A student joins a workspace via invite code (`POST /api/workspace/join`) but is in limbo until the teacher manually enrolls them into a class. The student concept of "workspace" is confusing -- they just want to "join their teacher's class".

**Design principle**: The class join code should be the ONLY entry point for students. Joining a class auto-joins the parent workspace behind the scenes. Students never see or think about "workspaces" -- that's an organizational concept for teachers/admins only.

| Scenario | Student-facing flow | System behavior |
|----------|-------------------|-----------------|
| Solo teacher | Student enters class join code | System auto-creates WorkspaceMember + Enrollment in one transaction |
| School/Academy | Student enters class join code | System auto-joins school workspace + enrolls in class |
| WhatsApp link | Student clicks class invite link | Register/login -> auto-join workspace + class in one redirect |
| School-wide onboarding | Admin shares workspace code | Student joins workspace -> lands on "pick your class" page showing available classes to self-enroll |

**Key backend change**: `POST /api/classes/join` must check if user is already a WorkspaceMember of the class's workspace. If not, auto-create the membership. One endpoint, one action, two records (WorkspaceMember + Enrollment). The existing `POST /api/workspace/join` remains for the school-wide onboarding case but is never the primary student flow.

**Indian school context constraints**:
- Many students (Class 7-9, age 12-14) don't have personal email addresses
- WhatsApp is the dominant communication channel between teachers, students, and parents
- Shared family devices are common -- a student may use their parent's phone
- Internet connectivity can be intermittent in many schools
- Parents are often the ones handling registration for younger students
- Teachers may not be tech-savvy -- every extra step is a barrier

**Current state**:

- **Single enrollment method**: Teacher types a student's registered email, clicks "Add". That's it.
- **Student must pre-register**: Chicken-and-egg -- student needs an ExamIQ account before teacher can enroll them
- **No self-service**: Students cannot join a class on their own; teacher does all the work
- **Flat list rendering**: All students rendered via `students.map()` with no pagination or virtualization
- **No search/filter/sort**: No way to find a specific student in a long roster
- **No bulk operations**: No CSV import, no batch enrollment, no bulk remove
- **Workspace has invite_code**: `Workspace.invite_code` (6-char alphanumeric) exists in the model via `generate_invite_code()`, but `ClassGroup` has NO join code

---

### Part A: Intuitive Enrollment Methods (Zero Cognitive Load)

Methods ranked by cognitive load (lowest first) and grouped by implementation priority.

#### P0 -- Ship First (low effort, highest impact)

**1. Class Join Code** (a la Google Classroom)
- Cognitive Load: 1/5 (effortless)
- Competitive ref: Google Classroom, Edmodo, ClassDojo
- Teacher flow: Creates class -> system auto-generates a 6-char join code (e.g., `XK7M2P`) -> teacher reads it aloud or writes on board
- Student flow: Opens ExamIQ -> clicks "Join Class" -> types 6-char code -> enrolled instantly
- Why it works: No email needed. No link sharing. Works even if teacher just says it out loud. Already proven by Google Classroom at massive scale.
- Technical: Add `join_code` column to `ClassGroup` model (reuse `generate_invite_code()`). New `POST /api/classes/join` endpoint accepting `{code: string}`. Frontend: "Join Class" button on student dashboard.
- Edge cases: Code expiry (optional, default never-expire), teacher can regenerate code, rate-limit join attempts to prevent brute-force.

**2. QR Code (scan to join)**
- Cognitive Load: 1/5 (point phone camera, done)
- Competitive ref: ClassDojo (classroom poster), DIKSHA (textbook QR), Clever Badges
- Teacher flow: Opens class detail -> clicks "Share" -> sees QR code -> projects on screen or prints poster for classroom wall
- Student flow: Opens phone camera or ExamIQ app -> scans QR -> auto-fills join code -> enrolled
- Why it works: Even faster than typing a code. Perfect for in-classroom enrollment. Teacher can print QR poster once and leave it on the wall all year.
- Technical: QR encodes URL like `https://examiq.app/join/XK7M2P`. Use `qrcode` Python lib (server-side) or `qrcode.react` (client-side). No external dependencies.
- Indian context: Works offline if QR just encodes the join code (student types it manually if camera fails).

**3. WhatsApp Share (one-tap invite)**
- Cognitive Load: 1/5 (tap share, select WhatsApp group)
- Competitive ref: ClassDojo parent invites, Indian EdTech standard practice
- Teacher flow: Opens class detail -> clicks "Share via WhatsApp" -> pre-composed message opens in WhatsApp: "Join my Class 10-A Mathematics on ExamIQ! Code: XK7M2P or click: https://examiq.app/join/XK7M2P"
- Student/Parent flow: Receives WhatsApp message -> taps link -> lands on join page -> registers (if new) or joins (if existing)
- Why it works: WhatsApp is already where Indian teachers communicate with parents. Teachers already have class WhatsApp groups. One tap reaches 100+ parents instantly.
- Technical: Deep link `whatsapp://send?text=...` with URL-encoded message. Zero backend work beyond the join code feature. Add share button to UI.
- Indian context: This is THE enrollment method for India. Teachers already share everything via WhatsApp class groups. Parents receive, help child register.

**4. Copy Roster from Previous Class/Year**
- Cognitive Load: 1/5 (one click)
- Competitive ref: Google Classroom (reuse class), Canvas (cross-list)
- Teacher flow: Creates new class (e.g., "Class 10-A 2026-27") -> clicks "Import from existing class" -> selects last year's "Class 10-A 2025-26" -> all students copied over
- Student flow: None -- they're already enrolled
- Why it works: At the start of each academic year, the same students are often in the same class. One click vs. re-enrolling 30-100 students.
- Technical: `POST /api/classes/{id}/copy-roster` accepting `{source_class_id: int}`. SQL: `INSERT INTO enrollments (class_id, student_id) SELECT :new_id, student_id FROM enrollments WHERE class_id = :old_id AND is_active = true`.

#### P1 -- Next Sprint (medium effort, high impact)

**5. Shareable Invite Link (with optional expiry)**
- Cognitive Load: 2/5 (copy-paste a link)
- Competitive ref: Google Classroom, Microsoft Teams, Zoom
- Teacher flow: Opens class -> clicks "Copy Invite Link" -> gets URL like `https://examiq.app/join/XK7M2P` -> pastes anywhere (email, SMS, notice board, school website)
- Student flow: Clicks link -> lands on join/register page -> enrolled
- Technical: Same as join code but with a URL wrapper. Add optional `link_expires_at` column to ClassGroup. Frontend: "Copy Link" button with toast confirmation.

**6. CSV / Excel Bulk Import**
- Cognitive Load: 2/5 (upload a file)
- Competitive ref: Canvas LMS (SIS import), Google Admin Console
- Teacher flow: Opens class -> clicks "Bulk Import" -> uploads CSV/Excel file (columns: Name, Email, Roll Number) -> preview table shown -> clicks "Enroll All" -> done
- Student flow: Students receive auto-generated credentials or invite to set password
- Why it works: Schools already maintain student rosters in Excel. Teacher exports from school management system, uploads to ExamIQ. Enrolls 100+ students in seconds.
- Technical: `POST /api/classes/{id}/students/import` accepting multipart file upload. Parse with `csv` stdlib or `openpyxl`. Validate emails, skip duplicates, report errors. Frontend: file dropzone with preview table.
- Edge case: Students without email -- generate placeholder accounts with roll number as username, teacher distributes passwords.

**7. Batch Email/Name Paste**
- Cognitive Load: 2/5 (paste a list)
- Competitive ref: Google Groups, Mailchimp
- Teacher flow: Opens class -> clicks "Bulk Add" -> pastes comma or newline-separated list of emails -> preview -> clicks "Enroll All"
- Technical: `POST /api/classes/{id}/students/bulk` accepting `{emails: string[]}`. Frontend: textarea with smart parsing (handles commas, newlines, semicolons, mixed formats).

**8. Student Self-Registration + Auto-Join**
- Cognitive Load: 2/5 for student (register with code), 0/5 for teacher (does nothing)
- Competitive ref: Google Classroom (students join with code after signing up)
- Student flow: Goes to ExamIQ -> clicks "Register" -> fills name, email, password -> enters class join code during registration -> account created AND enrolled in one step
- Why it works: Combines registration + enrollment into a single flow. Teacher shares the join code once, students handle the rest.
- Technical: Add optional `class_code` field to registration endpoint. If provided, auto-enroll after account creation.

#### P2 -- Future (higher effort, specialized use cases)

**9. Phone OTP Authentication (no email needed)**
- Cognitive Load: 1/5 (enter phone, get OTP, done)
- Competitive ref: Byju's, Vedantu, Unacademy, every Indian app
- Student/Parent flow: Enter phone number -> receive SMS OTP -> verify -> account created -> enter join code -> enrolled
- Why it works: Phone numbers are universal in India. Every student's parent has a phone. No email needed. This is how Byju's onboarded 150M+ users.
- Technical: Needs SMS gateway (MSG91 for India ~₹0.15/SMS, or Twilio). Add `phone` field to User model, `POST /api/auth/otp/send` and `POST /api/auth/otp/verify` endpoints. Medium-high effort.
- Indian context: MSG91 is the preferred provider for Indian SMS. Supports regional language templates. DLT registration required for transactional SMS in India.

**10. Magic Link (passwordless email)**
- Cognitive Load: 2/5 (enter email, click link in inbox)
- Competitive ref: Slack, Notion, modern SaaS
- Student flow: Enter email -> receive email with one-click login link -> click -> logged in and enrolled
- Technical: Generate JWT-based magic link with 15-min expiry. Needs email service (SendGrid/AWS SES). `POST /api/auth/magic-link` endpoint.

**11. Google / Microsoft SSO**
- Cognitive Load: 1/5 (click "Sign in with Google")
- Competitive ref: Google Classroom (native), Canvas, every EdTech platform
- Student flow: Click "Sign in with Google" -> OAuth consent -> account auto-created -> enter join code -> enrolled
- Why it works: Many schools use Google Workspace for Education. Students already have school Google accounts.
- Technical: OAuth2 flow with Google/Microsoft. Needs client IDs, redirect URI handling. `python-social-auth` or manual OAuth. High effort but high value for schools with Google Workspace.

#### P3 -- If Needed (very high effort, enterprise)

**12. SIS / School Management System Integration**
- Competitive ref: Clever (US), OneRoster standard, UDISE+ (India)
- Automatic roster sync from school management software. Zero teacher effort after initial setup.
- Technical: API integration with specific SIS providers. Very high effort, enterprise-only.

---

### Part B: List UX at Scale (100+ students)

- **Search bar**: Type-to-filter by student name or email, debounced client-side filtering for <200, server-side search for 200+
- **Virtualized list**: Use `react-window` or `@tanstack/virtual` to only render visible rows. Critical for 200+ students.
- **Pagination**: API-side `skip`/`limit` on the students endpoint, with page controls in the UI
- **Sort controls**: Sort by name (A-Z/Z-A), enrollment date, active/inactive status, roll number
- **Bulk selection**: Checkbox per row + "Select All" for batch remove, deactivate, or export
- **Summary header**: "87 active / 3 inactive / 90 total" instead of forcing the teacher to scroll to understand class composition
- **Roll number column**: Display roll number alongside name for easy identification (schools organize by roll number)

---

### Part C: Backend API Changes

**New endpoints**:
- `POST /api/classes/join` -- Student self-join with `{code: string}` (combines with registration if needed)
- `POST /api/classes/{id}/students/bulk` -- Batch enrollment with `{emails: string[]}`
- `POST /api/classes/{id}/students/import` -- CSV file upload enrollment
- `POST /api/classes/{id}/copy-roster` -- Copy students from another class `{source_class_id: int}`
- `DELETE /api/classes/{id}/students/bulk` -- Batch removal with `{student_ids: int[]}`
- `GET /api/classes/{id}/qr-code` -- Generate QR code image for class join link

**Modified endpoints**:
- `GET /api/classes/{id}/students` -- Add `skip`, `limit`, `search`, `sort_by`, `sort_order` query params
- `POST /api/auth/register` -- Add optional `class_code` field for register-and-join flow

**New model fields**:
- `ClassGroup.join_code` -- 6-char alphanumeric, unique, auto-generated (reuse `generate_invite_code()`)
- `ClassGroup.join_code_active` -- Boolean, teacher can disable/regenerate
- `ClassGroup.link_expires_at` -- Optional datetime for invite link expiry

### Part D: Files Impacted

- `backend/app/models/workspace.py` -- Add `join_code`, `join_code_active`, `link_expires_at` to ClassGroup
- `backend/app/api/routes/classes.py` -- New bulk/join/import/copy endpoints, pagination params
- `backend/app/api/routes/auth.py` -- Add `class_code` to registration flow
- `backend/app/schemas/workspace.py` -- New request/response schemas for all new endpoints
- `frontend/src/pages/ClassManagement.tsx` -- Complete overhaul: enrollment methods panel, search, virtualized list, bulk actions, QR display, share buttons
- `frontend/src/pages/StudentDashboard.tsx` -- Add "Join Class" button/modal
- `frontend/src/pages/Register.tsx` -- Add optional class code field

**Priority**: P0-P1 -- Class join codes, QR, and WhatsApp share are blocking for any real school adoption. These three alone eliminate 90% of enrollment friction with minimal implementation effort. The existing `generate_invite_code()` function means we're one migration away from class-level codes.

---

## FR-004: Curriculum Subscription + AI-Native Intelligence Layer

**Requested**: 2026-03-19
**Context**: Curriculum management should be separated into authoring (platform/admin level) and consumption (workspace/teacher level). Teachers should subscribe to existing curricula and customize scope, not build curricula from scratch. Additionally, the curriculum-to-question-generation handshake should be upgraded from "AI-assisted" to "AI-native" with closed-loop intelligence.

**Full research report**: See `AI_NATIVE_CURRICULUM_RESEARCH.md` (30+ sources, 18 ranked features)

**Current state**:
- Any teacher can create/edit global curricula -- no role separation
- No concept of "subscribing" to a curriculum or scoping it per workspace
- Curriculum data is passed to AI as individual parameters, not a structured context bundle
- No feedback loop from student performance back to curriculum intelligence
- Bloom's levels are manually set -- no auto-tagging or confidence scores
- No prerequisite mapping between topics
- No cross-board curriculum equivalence mapping
- Coverage analysis exists (BankAnalytics) but is reactive, not proactive

---

### Part A: Curriculum Subscription Model

**Design principle**: Teachers are consumers of curricula, not authors. Platform admins/curators maintain the global taxonomy. Teachers browse, subscribe, and customize.

**Subscription flow**:
1. Teacher goes to Curriculum page -> sees available curricula (read-only browse)
2. Clicks "Subscribe" on "CBSE Class 12 Chemistry"
3. Sees chapter list with checkboxes -> selects chapters for their teaching plan (e.g., Term 1 only)
4. Adjusts marks weightage per chapter to match their school's internal exam pattern
5. Saves as their "active curriculum scope"
6. All analytics, gap analysis, and question generation are now scoped to subscribed chapters only

**New models**:
- `WorkspaceCurriculumSubscription`: workspace_id, curriculum_subject_id, subscribed_at, is_active
- `SubscriptionChapterScope`: subscription_id, chapter_id, included (boolean), custom_weightage (nullable)

**Role separation**:
- Platform admin / Curator: Full CRUD on curricula (current TaxonomyCreator + edit flows)
- School admin: Selects which curricula are available for their school workspace
- Teacher: Subscribes to available curricula, customizes chapter scope

---

### Part B: AI-Native Intelligence Features (Prioritized)

#### P0 -- Immediate

**1. CurriculumContext Bundle**
- Package all curriculum metadata into a single structured payload for AI: structure, learning outcomes, Bloom's targets, textbook references, question patterns, prerequisites, historical performance, marks weightage
- Replaces current pattern of passing individual params to `generate_questions()`
- Competitive ref: Embibe's 426 meta-variables per concept

**2. Coverage Heatmap (Chapters x Bloom's)**
- 2D matrix visualization: chapters as rows, Bloom's levels as columns
- Cell color = question density (white → green). Red = under-represented
- Clickable cells: click to view questions or "Generate" to fill gap
- Data already exists in BankAnalytics -- needs visualization only
- Competitive ref: ExamSoft category performance reports

**3. Auto-Tag Bloom's with Confidence**
- AI auto-classifies Bloom's level at question generation time (LLM zero-shot = 72-73% accuracy)
- Display confidence badge: High/Medium/Low per question
- Store both AI-predicted and teacher-confirmed levels
- Teacher corrections become training data (SVM achieves 94% with enough labeled data)
- Competitive ref: ExamSoft/CompetencyGenie

**4. Difficulty Calibration from Historical Data**
- Compute empirical difficulty per question from StudentAnswer outcomes (% who got it right)
- Auto-flag mismatches: "medium" question with 95% success rate → actually "easy"
- Feed empirical difficulty back into generation prompts
- Competitive ref: Embibe's 94% score prediction accuracy

#### P1 -- Near-term

**5. Curriculum Intelligence Cards**
- Proactive teacher dashboard cards based on aggregated student performance
- "Students scored 42% on Trigonometry. Generate 10 practice questions?"
- "Chapter 7 has no Application-level questions. Fill gap?"
- Competitive ref: Knewton's adaptive recommendations

**6. Question-Curriculum Alignment Score (0-100)**
- Per-question score: content match (40%), Bloom's match (30%), marks match (15%), format match (15%)
- Flag questions scoring < 60 for teacher review
- Prioritize high-alignment questions in paper assembly

**7. Prerequisite Mapping**
- Topic dependency graph (e.g., "Linear Equations" before "Quadratic Equations")
- AI auto-suggests prerequisites from curriculum structure
- Teacher confirms/adjusts
- Learning paths follow topological sort of prerequisite graph
- Competitive ref: Squirrel AI's 30K+ knowledge atom graph

**8. Syllabus Diff Detection (Year-over-Year)**
- Clone last year's curriculum → AI highlights changes
- Diff view: added/removed chapters, modified topics, changed weightage
- Teacher reviews diff before activating new version

**9. Marks Weightage Auto-Suggestion**
- AI analyzes past board exam papers to suggest chapter-wise weightage
- "Based on last 5 years of CBSE papers, Electrochemistry averages 9 marks"

#### P2 -- Medium-term

**10. Spaced Repetition (FSRS)**
- Per-topic retrievability tracking using FSRS algorithm (py-fsrs package)
- "Trigonometry last practiced 14 days ago, retrievability at 65%. Review recommended."
- Auto-generate review quizzes for declining topics

**11. Cross-Board Mapping (CBSE ≈ ICSE)**
- AI auto-suggests chapter equivalences via embedding similarity
- Enables question reuse: "20 CBSE Trigonometry questions → 15 work for ICSE too"

**12. AI Confidence Scores on Generated Questions**
- Generate multiple candidates, use inter-answer agreement as confidence proxy
- Display on question cards: "AI Confidence: High/Medium/Low"

**13. Curator-Teacher Hierarchy**
- Expert teachers ("curators") verify AI content before classroom teachers access it
- Based on Shiksha Copilot model (96% classroom-ready rate)

**14. Learning Path Generation**
- From prerequisite graph + mastery profile → personalized study sequence
- Weakest unmastered prerequisites first

#### P3 -- Future

**15. OBE Attainment Tracking**
- Explicit LearningOutcome → Question mapping (many-to-many)
- Compute outcome attainment from StudentAnswer data

**16. DIKSHA/CASE Interoperability**
- Align taxonomy model to Sunbird's Framework > Categories > Terms pattern
- Implement CASE-compatible GUIDs on learning outcomes
- Competitive ref: India's national DIKSHA platform (MIT-licensed Sunbird)

**17. Knowledge Graph (Embibe-scale)**
- Expand from tree to graph: cross-topic connections, 60K+ concepts
- Competitive ref: Embibe's 62K concepts with 426 meta-variables each

---

### Key Research References

| Platform | Scale | Key Pattern |
|----------|-------|-------------|
| Embibe (India) | 62K concepts, 125K questions from NCERT | Knowledge graph as generation substrate |
| Squirrel AI (China) | 30K+ knowledge atoms | Fine-grained topic decomposition |
| Knewton | 10M+ data points/day | 85% mastery prediction accuracy |
| DreamBox | 48K decision points/student-hour | Real-time adaptive sequencing |
| Shiksha Copilot (India) | 1,043 teachers | Curator-teacher model, 96% classroom-ready |
| DIKSHA/Sunbird (India) | National scale | Open-source taxonomy microservice (MIT) |

**Priority**: P0 features (CurriculumContext bundle, Coverage heatmap, Bloom's auto-tag, Difficulty calibration) are high-impact, high-feasibility and should ship first. Curriculum subscription model is P1 but architecturally foundational -- design it early even if built later.

---

## FR-005: Voice AI Integration

**Requested**: 2026-03-19
**Context**: Voice can transform ExamIQ from text-only to multimodal. Indian context is uniquely suited: mobile-first access, WhatsApp voice note culture, CBSE/ICSE oral exam requirements, Hindi-English code-switching. No Indian EdTech offers voice AI across the full exam lifecycle (generation + taking + evaluation + tutoring) for all CBSE/ICSE subjects.

**Full research report**: See `VOICE_AI_RESEARCH.md` (30+ sources, 9 ranked features, cost analysis, DPDP compliance)

**Current state**:
- ExamIQ is text-only -- no voice input or output anywhere
- AI Tutor exists as text chat (SSE streaming) -- no voice mode
- Exam taking is keyboard-only -- no speech-to-text for answers
- Teacher creates questions by typing -- no voice dictation
- No oral exam simulation capability
- No pronunciation/fluency assessment

**Key Indian context**:
- DPDP Act 2023: ALL school students are minors -- verifiable parental consent required for voice data
- Sarvam AI (Indian STT, 22 languages, code-switching) is the recommended primary provider over Whisper
- Cost estimate: $2-5/student/month for core voice features, $5-9 for full suite
- CBSE ALS (Assessment of Listening and Speaking) and ICSE Viva Voce have no digital equivalent today

**Phased rollout**:

### Phase 1 (P1 -- 3-4 months)
- Voice navigation with Web Speech API (free, browser-native)
- STT for exam answer capture (Sarvam AI integration)
- Teacher voice dictation for question creation (STT + LLM intent parser)
- AI Tutor voice mode (OpenAI Realtime API)

### Phase 2 (P2 -- 3-4 months)
- Voice feedback on evaluations (teacher audio notes attached to scores)
- AI-conducted oral exam simulation (viva voce)
- Voice-based question generation (full voice-to-intent pipeline)

### Phase 3 (P3 -- 6+ months)
- Pronunciation and fluency scoring for English/Hindi
- Emotion-aware adaptive tutoring (Hume AI EVI)
- Offline voice support (Vosk) for rural connectivity

**Technical stack recommendation**:
- STT: Sarvam AI Saaras V3 (primary, Indian languages) + OpenAI Whisper (fallback, English)
- TTS: Sarvam Bulbul V3 (Indian voices) + ElevenLabs (high quality)
- Conversational: OpenAI Realtime API (AI Tutor) + ElevenLabs (oral exams)
- Navigation: Web Speech API (free, browser-native)
- Backend: WebSocket endpoints in FastAPI for audio streaming
- Frontend: MediaRecorder API + WebRTC for real-time voice

**Privacy architecture (DPDP compliance)**:
- Verifiable parental consent at registration (mandatory for all voice features)
- Process voice in real-time, retain only text transcripts
- Delete audio files immediately after transcription
- Clear opt-out mechanism for voice features
- Data Protection Impact Assessment before launch

**Competitive positioning**: Eklavvya has viva voce. SpeakX/Stimuler have English voice tutoring. Khanmigo has voice tutoring. NONE offer voice across the full exam lifecycle for all CBSE/ICSE subjects. ExamIQ can own this space.

**Priority**: P1-P2 -- Voice navigation and STT for answers are quick wins. AI Tutor voice mode is the highest-impact differentiator. Oral exam simulation aligns directly with CBSE/ICSE board requirements. Note: STT for exam answers could be elevated to P1 if mobile adoption data supports it -- typing long answers on phone is a significant pain point for Indian students.

---

## FR-006: Multi-Workspace Student UX ("My Teachers")

**Requested**: 2026-03-19
**Context**: Students can belong to multiple workspaces (different teachers, schools, academies). Current UI shows one workspace at a time with no switching, no teacher attribution on exams, and no visual distinction. A Class 10 student with 5-8 teachers needs to see all their content organized by teacher, not siloed in opaque "workspaces."

**Full plan**: See `.claude/tasks/fr006-multi-workspace-student-ux.md`

**Design principle**: Replace "workspace" language with "teacher" language in student UI. Students think "My Teachers" and "My Classes", never "workspaces."

**Current state**:
- Sidebar shows one workspace name statically -- no switcher
- `switchWorkspace()` exists in AuthContext but has no UI trigger
- `GET /workspace/mine` returns all workspaces but is never called from student UI
- Exams show class name but not which teacher/workspace they belong to
- Dashboard only shows data from active workspace -- other teachers' exams invisible

**What's needed**:
- **Phase 1**: "My Teachers" dropdown in sidebar, TeacherBadge on exam/class cards, enriched workspace API with teacher name + color
- **Phase 2**: Cross-workspace aggregated views (all teachers' exams on dashboard), filter tabs per teacher
- **Phase 3**: Teacher attribution on join flow ("Joining Dr. Sharma's Class 10-A")

**Competitive ref**: Google Classroom (flat class list with teacher name), Canvas (color-coded courses), Microsoft Teams (team list), ClassDojo (teacher avatars)

**Priority**: P1 -- critical as soon as students join multiple teachers. Without this, second teacher's content is invisible.

---

## FR-007: Social Authentication & SSO (Google Sign-In)

**Requested**: 2026-03-19
**Context**: Current registration requires email + password. Google SSO would reduce registration from 8 steps to 2 clicks, especially valuable for schools with Google Workspace for Education. 22,000 CBSE schools partnered with Google, 30-50% of target private schools likely have Google Workspace.

**Full research report**: See `SSO_AUTH_RESEARCH.md` (30+ sources, cost analysis, implementation guide)

**Current state**:
- Email + password only (no social login)
- No OAuth integration
- User model has no oauth_provider/oauth_id fields
- Frontend has no Google Sign-In button

**Recommended approach**: Frontend credential flow (NOT backend redirect)
- Frontend: `@react-oauth/google` package, `<GoogleLogin>` component + One Tap
- Backend: `POST /api/auth/google/verify` verifies Google JWT, find-or-create user, issues ExamIQ JWT
- Library: `google-auth>=2.0` for token verification (NOT Authlib redirect flow)
- No SessionMiddleware needed, no redirect handling
- Existing JWT/workspace/role system unchanged

**Phase 1 (P1 -- 2-3 days)**:
- Google SSO on login, register, and join pages
- `User` model: add `oauth_provider` (String, nullable), `oauth_id` (String, nullable)
- `POST /api/auth/google/verify` endpoint
- "Sign in with Google" button + One Tap on login page
- "Sign up with Google" on registration + `/join/:code` pages
- Combined flow: Google SSO + class join code in one step

**Phase 2 (P2 -- 3-5 days)**:
- Phone OTP via MSG91 (~$0.003/SMS)
- Parent consent verification via OTP
- DPDP Act compliance flow

**Phase 3 (P3)**:
- Microsoft SSO (Azure AD)
- Magic link (passwordless email)
- Google Classroom roster sync API

**Build vs Buy verdict**: Custom (Authlib/google-auth) wins decisively. Clerk/Auth0 would require full auth rewrite ($500-800/mo + 5-7 days migration) because ExamIQ's JWT embeds workspace_id/workspace_role which no managed provider supports.

**Privacy (DPDP Act)**: Request only `openid email profile` scopes. For Google Workspace for Education accounts, the school acts as consenting party. For personal Google accounts (minors), parental consent still required before account creation.

**Priority**: P1 -- 2-3 days effort, $0 cost, 30-50% of target school coverage. Dramatically simplifies the registration + class join flow. Should ship alongside or immediately after FR-003.
