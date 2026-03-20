# AI-Native Curriculum/Taxonomy Management Patterns for ExamIQ

## Executive Summary

ExamIQ's curriculum taxonomy already has **5 of 8 metadata layers** needed for AI-native question generation. The gap is not "build a new system" -- it's "assemble existing data into a structured context bundle and add 2 missing layers (prerequisite graph, structured performance aggregation)."

**4 P0 features to ship immediately:**

1. **CurriculumContext Bundle** -- Package existing DB fields (structure, outcomes, Bloom's, textbook refs, patterns, weightage) into a single payload for AI generation. Data assembly, not new-build.
2. **Coverage Heatmap** -- Extend existing BankAnalytics to 2D (Chapters x Bloom's levels). Clickable cells to generate questions for gaps. Visualization-only enhancement.
3. **Bloom's Confidence Scores** -- Add `blooms_confidence` and `blooms_teacher_confirmed` to Question model. Teacher corrections become training data (72% LLM accuracy -> 94% SVM ceiling over time).
4. **Difficulty Calibration** -- Compute empirical difficulty from StudentAnswer outcomes. Auto-flag mismatches. Feed back into generation prompts.

**Architectural separation needed:** Global taxonomy (platform-governed, shared) vs workspace curriculum preferences (per-teacher: active chapters, custom weightage, term scoping). Teachers subscribe to curricula, they don't author them.

**Competitive differentiator:** ExamIQ's gap-fill workflow (detect gap -> pre-fill AI generation -> HITL review -> analytics refresh) is unique. All 18 features in this report strengthen this core loop.

**Research base:** 30+ sources across peer-reviewed papers, platform documentation, and open-source frameworks. Evidence-graded throughout ([HIGH]/[MEDIUM]/[LOW]).

---

## Research Summary

**Research Question**: How should ExamIQ architect the "handshake" between curriculum taxonomy and AI question generation to become truly AI-native rather than merely AI-assisted?

**Methodology**: Multi-source web research covering academic papers, industry platforms (Embibe, Squirrel AI, Khan Academy, DreamBox, Eklavvya, ExamSoft), open-source frameworks (Sunbird/DIKSHA), interoperability standards (1EdTech CASE, NDEAR), and peer-reviewed NLP research on automated Bloom's classification. Sources are graded by evidence confidence: **[HIGH]** = peer-reviewed/independently verified, **[MEDIUM]** = preprints/platform documentation, **[LOW]** = vendor marketing/blog posts.

**Key Constraints**: ExamIQ targets CBSE/ICSE Class 7-12 with a FastAPI/SQLAlchemy backend; existing taxonomy architecture uses DB-backed curriculum models (Board > Curriculum > Subject > Chapter > Topic > LearningOutcome); current system has CurriculumPicker, question generator with research grounding, and a paper assembler.

**ExamIQ's Competitive Differentiator**: The gap-fill workflow (detect coverage gap → pre-fill AI generation → HITL review → analytics refresh) is unique. No other platform combines taxonomy-aware gap detection with AI generation and teacher HITL review in a single flow. All features in this report should be evaluated in terms of how they strengthen this core differentiator.

---

## 1. Curriculum-AI Handshake Patterns

### Evidence from Industry Leaders

**Embibe's Architecture** **[MEDIUM - self-reported vendor data]** (the strongest Indian precedent): Embibe constructed a knowledge graph with 62,000 concepts and hundreds of thousands of interconnections, with 426 meta-variables at each concept. Every question is manually tagged with concepts, exam syllabus, skills, difficulty, and Bloom's level. Their question generation pipeline uses T5 transformer models with KI-BERT knowledge graph injection, producing 125,000 questions from NCERT textbooks (grades 6-12). The critical insight: the knowledge graph is not just metadata -- it is the generation substrate.

**Squirrel AI's Granularity** **[MEDIUM - Wikipedia + vendor]**: Squirrel AI decomposes China's K-12 math curriculum into 30,000+ "knowledge atoms." Each atom is linked to related items forming a graph structure. This level of granularity enables precise diagnostic testing and targeted content generation.

**Sunbird/DIKSHA's Framework Model**: India's national platform uses a hierarchical taxonomy: Framework > Categories > Terms (multi-level). Terms support cross-category associations via an `associationswith` attribute, enabling lateral connections (e.g., linking a Math concept to a Physics application). This is the architecture pattern ExamIQ should align with for Indian education interoperability.

### Recommended Handshake Architecture for ExamIQ

The AI needs the following metadata from curriculum to generate high-quality content:

| Metadata Layer | What AI Receives | Already in ExamIQ? | Where? |
|---|---|---|---|
| **Structural Context** | Board, class, subject, chapter, topic hierarchy with IDs | **Yes** | `CurriculumFramework` → `CurriculumSubject` → `CurriculumChapter` → `CurriculumTopic` |
| **Learning Outcomes** | Coded outcomes with Bloom's level + competency type | **Yes** | `LearningOutcome.bloom_level`, `competency_type` |
| **Textbook Grounding** | NCERT/Selina chapter references, page ranges | **Partial** | `CurriculumChapter.textbook_reference` + `UploadedDocument` |
| **Question Patterns** | Board-specific formats, typical marks, frequency data | **Yes** | `CurriculumChapter.question_pattern_notes` |
| **Prerequisite Graph** | Topic dependencies (Topic A required before Topic B) | **No** | New feature needed |
| **Historical Performance** | Student success rates per topic, common misconceptions | **Partial** | `TopicMastery` exists but not aggregated per-topic for generation |
| **Marks Weightage** | Chapter-level weightage from board patterns | **Yes** | `CurriculumChapter.marks_weightage` |
| **Bloom's Target Distribution** | Board-mandated cognitive level breakdown | **Partial** | `question_pattern_notes` has it but not structured as a separate field |

**5 of 8 layers already exist in ExamIQ's DB. 2 are partially there. Only 1 (prerequisite graph) is greenfield.**

**Actionable Feature**: Assemble existing data into a `CurriculumContext` dataclass and add the 2 missing layers (prerequisite graph, structured performance aggregation). This is a **data assembly task** (pulling existing fields into a structured payload), not a new-build. The generation prompt then receives the full context object instead of individual parameters. Current code in `question_generator.py` already passes `research_context` -- extend this with the full bundle.

---

## 2. Smart Curriculum Subscription

### How Leading Platforms Handle Curriculum Customization

**Khan Academy**: Offers standards-aligned content library where teachers get AI-crafted learning objectives, rubrics, and exit tickets. Khanmigo provides on-demand summaries aligned to Khan Academy's existing content structure. Teachers select their course/grade level and the system maps to pre-aligned content.

**DreamBox**: Uses a fixed, research-validated curriculum sequence with 48,000+ decision points. Teachers don't customize the curriculum itself -- they assign students to grade-level starting points and the adaptive engine handles sequencing.

**Shiksha Copilot** (India-specific, highly relevant): Implements a two-phase model -- curators (expert teachers) review AI-generated lesson plans for accuracy, then 1,043 classroom teachers access and customize. State-mandated textbooks are chunked into 512-token segments and indexed for RAG-based generation. 96.13% of English-medium content was rated classroom-ready by curators.

### Recommended Subscription Pattern for ExamIQ

**Critical distinction -- two separate data layers**:

| Layer | Scope | Who controls | What it contains | Mutability |
|---|---|---|---|---|
| **Global taxonomy** | Platform-wide | Admin / Curator | Chapter names, topics, learning outcomes, textbook references | Governed (impact analysis required before edits) |
| **Workspace curriculum preferences** | Per workspace/teacher | Teacher | Active chapters, custom weightage, term scoping | Freely editable by teacher |

A teacher adjusting Chapter 5's weightage from 15% to 25% for their school's internal exam is a **workspace-local preference override**, not a global taxonomy edit. This needs its own data model (`WorkspaceCurriculumSubscription` + `SubscriptionChapterScope`) separate from the global taxonomy tables.

**Teacher Curriculum Subscription Flow**:
1. Teacher selects Board + Class + Subject (e.g., "CBSE Class 10 Mathematics")
2. System shows the official curriculum tree (read-only global taxonomy -- 15 NCERT chapters with topics)
3. Teacher can: (a) Subscribe to full curriculum, (b) Select specific chapters for their term (checkboxes), (c) Set custom marks weightage per chapter for their school's exam pattern (stored in subscription, not in global taxonomy)
4. Teacher's subscription becomes their "active curriculum scope" -- all analytics, gap analysis, and generation are scoped to subscribed+included chapters only
5. Multiple teachers in a workspace can share a subscription or have individual overrides
6. Global taxonomy remains untouched -- teacher preferences are a separate layer

**Impact**: HIGH | **Feasibility**: MEDIUM (requires `WorkspaceCurriculumSubscription` model + scoped analytics queries)

---

## 3. AI-Powered Curriculum Enrichment

### Enhancing Bloom's Auto-Tagging with Confidence Scores

**What already exists**: ExamIQ already assigns `blooms_level` as an `Enum(BloomsTaxonomy)` on every Question (`exam.py:90`), and the AI question generator already assigns Bloom's levels during generation via `GeneratedQuestion.blooms_level`. The Bloom's enum mapping fix (APPLICATION → APPLY) was applied during Build 9. **This is not a greenfield feature.**

**What's missing**: (a) the generator assigns Bloom's but doesn't expose a confidence score, and (b) there's no distinction between AI-predicted vs teacher-confirmed Bloom's levels on stored questions.

**Research Evidence**: A 2025 study **[HIGH]** on automated Bloom's classification found that SVM with synonym-based augmentation achieved **94% accuracy** on 600 labeled educational sentences. LLMs in zero-shot settings achieved **72-73% accuracy** **[HIGH]** (GPT-4o-mini, Gemini-1.5-Pro). ExamSoft partnered with Enflux to build CompetencyGenie **[MEDIUM]**, an AI extension that auto-classifies exam items to Bloom's Taxonomy.

**Enhancement for ExamIQ** (not a new build -- an extension of existing behavior):
- Add `blooms_confidence` (float, 0-1) and `blooms_teacher_confirmed` (boolean) fields to Question model
- After generation, run a lightweight second LLM call to evaluate Bloom's assignment confidence
- Display confidence badge on question cards: HIGH (>0.85), MEDIUM (0.6-0.85), LOW (<0.6)
- When teacher changes Bloom's level via HITL review, set `blooms_teacher_confirmed = true`
- Over time, teacher-confirmed labels become training data for a lightweight SVM classifier (94% accuracy ceiling)

### Auto-Suggest Marks Weightage

**Evidence**: AI tools trained on CBSE/ICSE curricula can analyze past board exam papers to identify chapter-wise weightage patterns. With 10-15 years of data, pattern recognition produces strong predictions for CBSE and moderate for ICSE.

**Implementation**: Parse existing `question_pattern_notes` in CurriculumChapter to extract historical weightage. When a teacher creates a new paper, AI suggests marks allocation per chapter based on board patterns.

### Auto-Detect Coverage Gaps

**Atomic Jolt's Approach**: Their AI curriculum gap analysis tool scans content, detects missing topics, benchmarks against standards, and generates actionable recommendations. The 5-step pipeline (scan, detect gaps, benchmark, recommend, monitor) is directly applicable.

**ExamIQ already has the foundation**: The `BankAnalytics` system computes coverage per chapter with RAG (Red/Amber/Green) status and gap alerts. The enhancement is making this proactive -- AI suggests what to generate next based on the gaps.

### Auto-Align to National Standards

**1EdTech CASE Standard**: The Competencies and Academic Standards Exchange specification provides a REST API format for exchanging competency frameworks with unique GUIDs per standard. ExamIQ could tag questions with CASE-compatible identifiers for future interoperability.

**NCF 2023**: India's National Curriculum Framework 2023 emphasizes competency-based learning. While no formal API exists yet, the framework defines learning standards that ExamIQ's taxonomy could align to structurally.

---

## 4. Adaptive Curriculum Features

### Feature 4.1: AI-Driven Curriculum Adjustment Based on Performance

**Evidence**: Adaptive learning platforms like Knewton **[MEDIUM - vendor claims via industry analysis]** process 10 million+ learning data points daily with 85% prediction accuracy for mastery. DreamBox **[MEDIUM - vendor documentation]** captures 48,000 data points per student-hour and adjusts lesson difficulty, scaffolding, and sequencing in real time.

**ExamIQ Implementation**:
- After each exam evaluation, compute per-topic mastery scores from `TopicMastery` records
- AI identifies topics where class average falls below 60% mastery threshold
- System suggests: "Students scored 42% on Trigonometry. Consider generating 10 more practice questions at Medium difficulty focusing on trigonometric identities."
- Surfaces this as a "Curriculum Intelligence Card" on the teacher dashboard

**Impact**: HIGH | **Feasibility**: MEDIUM (requires aggregation queries on existing evaluation data)

### Feature 4.2: Difficulty Calibration from Historical Data

**Evidence**: Embibe's AI stack **[MEDIUM - self-reported]** achieves 94% score prediction accuracy using academic quotient (61%) and behavioral factors (39%). Item Response Theory (IRT) parameters can be estimated from student response data.

**ExamIQ Implementation**:
- Track `StudentAnswer` outcomes per question to compute empirical difficulty (% students who got it right)
- Compare AI-assigned difficulty (easy/medium/hard) against empirical difficulty
- Auto-recalibrate: if a "medium" question has 95% success rate, flag it as actually "easy"
- Use empirical difficulty to improve future generation prompts: "For Chapter 5, students find Topic X easy and Topic Y hard. Adjust accordingly."

**Impact**: MEDIUM | **Feasibility**: HIGH (data already exists in StudentAnswer model)

### Feature 4.3: Prerequisite Mapping

**Research Evidence**: ACE (AI-Assisted Construction of Educational Knowledge Graphs) uses machine learning to identify prerequisite relations between concepts. Studies show students who follow prerequisite-ordered paths have better success rates.

**ExamIQ Implementation**:
- Add a `prerequisites` relationship on CurriculumTopic (many-to-many self-referential)
- AI can auto-suggest prerequisites from curriculum structure (e.g., "Linear Equations" before "Quadratic Equations")
- Teacher confirms/adjusts prerequisite chain
- Learning path generation follows topological sort of prerequisite graph
- Question generation respects prerequisites: don't test Topic B if Topic A hasn't been covered

**Impact**: HIGH | **Feasibility**: MEDIUM-LOW (4 separate implementation tasks across backend and frontend)

**Phased approach recommended**:
- Phase 1 (MEDIUM feasibility): Manual prerequisite tagging -- add many-to-many self-referential relationship on `CurriculumTopic`, teacher tags prerequisites via UI. No AI.
- Phase 2 (LOW feasibility): AI-suggested prerequisites + topological sort for learning paths + prerequisite-aware question generation. This is a full plan-scale effort comparable to the taxonomy-analytics-merged plan.

### Feature 4.4: Learning Path Generation

**Research Evidence**: Personalized learning path recommendation using knowledge graphs and reinforcement learning is a rapidly growing field. Key approaches include Q-learning for path optimization and Bayesian Knowledge Tracing for learner state modeling.

**ExamIQ Implementation**:
- Given a student's mastery profile (from evaluations) and the prerequisite graph, generate a recommended study sequence
- Use topological sort + mastery-weighted priority: unmastered prerequisites first, then weakest topics
- Present as a "Study Plan" that maps to specific question bank sections

**Impact**: MEDIUM | **Feasibility**: MEDIUM

### Feature 4.5: Spaced Repetition Tied to Curriculum Topics (Experimental)

**Research Evidence**: The FSRS (Free Spaced Repetition Scheduler) algorithm **[HIGH]** reduces review load by 20-30% vs traditional scheduling for flashcard-level items. It uses three variables: difficulty, stability, and retrievability. Python package available on PyPI.

**Critical caveat**: FSRS is proven for flashcard-level recall (discrete facts). Its application to **topic-level mastery** is fundamentally different and untested. A student doesn't "recall" or "forget" a topic the way they recall a flashcard fact -- topic mastery is skill-based, not memory-based. Retrievability computation at topic level needs empirical validation with ExamIQ's own data before committing to a full implementation.

**ExamIQ Implementation** (experimental, validate before scaling):
- After exam evaluation, compute per-topic retrievability using FSRS model as a proxy
- Schedule topic reviews: "Trigonometry last practiced 14 days ago, retrievability at 65%. Review recommended."
- Auto-generate review quizzes targeting topics with declining retrievability
- Integrate with learning plan generator to embed spaced repetition into study plans
- **Validation step**: Run A/B test with 50+ students -- compare FSRS-scheduled reviews vs random topic reviews. Measure mastery improvement after 30 days.

**Impact**: HIGH (if validated) | **Feasibility**: MEDIUM (py-fsrs package simplifies implementation, but topic-level applicability is unproven)

---

## 5. Curriculum Intelligence Layer

### Feature 5.1: Cross-Board Curriculum Mapping (CBSE Chapter X ≈ ICSE Chapter Y)

**Evidence**: NatureNurture provides expert CBSE-ICSE curriculum mapping services. The approach: start with official standards, convert to time-bound sequences, bake in competency-led evidence. Sunbird's taxonomy framework supports cross-category associations via `associationswith` attribute.

**ExamIQ Implementation**:
- Add a `CurriculumMapping` table: `source_chapter_id`, `target_chapter_id`, `mapping_type` (equivalent, partial_overlap, prerequisite), `confidence_score`
- AI auto-suggests mappings based on chapter names, topics, and learning outcomes (semantic similarity via embeddings)
- Teacher confirms mappings
- Enables: "You have 20 questions for CBSE Trigonometry. 15 are suitable for ICSE Trigonometry too."
- Enables question reuse across boards where content overlaps

**Impact**: MEDIUM | **Feasibility**: MEDIUM

### Feature 5.2: Year-over-Year Syllabus Diff Detection

**Evidence**: DITA-based version control systems track changes to curriculum documentation with version attributes and revision histories. CBSE publishes revised syllabi annually at cbseacademic.nic.in.

**ExamIQ Implementation**:
- Curriculum model already has `academic_year` and `version` fields via `is_active` flag
- Add `clone_curriculum(source_curriculum_id, new_academic_year)` function
- AI compares old vs new curriculum trees and highlights: added chapters, removed chapters, modified topics, changed weightage
- Present as a diff view: "2026 vs 2025: Chapter 15 added, Chapter 3 renamed, Topic 'Logarithms' moved from Chapter 2 to Chapter 4"
- Teachers review and approve the diff before activating the new version

**Impact**: MEDIUM | **Feasibility**: HIGH (tree diff is a well-understood algorithm)

### Feature 5.3: Question-to-Curriculum Alignment Scoring

**Evidence**: Research shows assessment-curriculum alignment should be evaluated across content, cognitive process, and assessment strategy dimensions. Automated approaches using NLP can perform preliminary alignments, with technology offering promise for conceptual matching.

**ExamIQ Implementation**:
- For each question, compute an alignment score (0-100) based on:
  - **Content match** (40%): Does question text reference topics from the mapped chapter? (Embedding similarity)
  - **Bloom's match** (30%): Does question's Bloom's level match the learning outcome's target level?
  - **Marks match** (15%): Are marks appropriate for the question type per board patterns?
  - **Format match** (15%): Is the question type appropriate for the board's exam format?
- Display alignment score on each question card in the bank
- Flag questions with alignment score < 60 for teacher review
- Use in paper assembly: prioritize high-alignment questions

**Impact**: HIGH | **Feasibility**: MEDIUM (requires embedding computation + scoring logic)

### Feature 5.4: Coverage Heatmaps (2D Extension of Existing BankAnalytics)

**What already exists**: Build 8 shipped `BankAnalytics` with per-chapter coverage bars (actual vs target, RAG coloring), composition charts including Bloom's grouped bars, and gap alerts with "Fill Gaps with AI" CTA. **The 1D analytics foundation is already built.**

**What's new**: A 2D heatmap matrix (Chapters × Bloom's Levels) that shows coverage density at the intersection of two dimensions. This is an **incremental visualization enhancement**, not a new analytics system.

**Evidence**: ExamSoft's category tagging **[MEDIUM]** enables cross-category performance reports. Embibe **[MEDIUM - self-reported]** uses 426 meta-variables per concept for coverage analysis.

**ExamIQ Implementation** (incremental on existing BankAnalytics):
- Add a 2D heatmap matrix: Chapters (rows) x Bloom's Levels (columns)
- Cell value = number of questions in the bank at that intersection
- Color intensity shows density: white (0), light green (1-3), green (4-8), dark green (9+)
- Overlay target values from board patterns (e.g., CBSE: 50% Application+Analysis+Evaluate)
- Highlight under-represented cells in red
- Clickable cells: click to see questions or "Generate" to fill the gap
- Data source: existing `get_bank_analytics()` in `taxonomy_service.py` -- extend the query to group by both chapter_id AND blooms_level

**Impact**: HIGH | **Feasibility**: HIGH (data and API exist, needs a new visualization component only)

---

## 6. Indian EdTech Context: DIKSHA, NDEAR, NEP 2020

### DIKSHA Platform Architecture

DIKSHA (Digital Infrastructure for Knowledge Sharing) is India's national platform for school education, adopted by almost all states, UTs, and CBSE. Key architectural facts:
- Built on **Sunbird open-source building blocks** (MIT license)
- **Microservices architecture** with APIs for taxonomy, content, and learning management
- Taxonomy framework supports: Board > Medium > Grade > Subject > Topic hierarchy
- Cross-category term associations for semantic linking
- Content must be tagged against framework taxonomy before publishing

### NDEAR (National Digital Education Architecture)

NDEAR provides 36 building blocks across 12 categories at national, state, and school levels. It creates "digital building blocks" and develops "open standards, specifications, registries." NDEAR was envisaged as a key enabler of NEP 2020.

### Open APIs and Standards

- **Sunbird Knowlg** provides Framework APIs (Create, Read, Update, Publish, Copy) for taxonomy management
- **Framework Categories and Terms** are accessible via REST APIs
- **1EdTech CASE** standard provides interoperable competency exchange (REST + JSON)
- No formal Indian-specific curriculum API exists yet, but DIKSHA's microservices are the closest

### NCF 2023

The National Curriculum Framework 2023 mandates competency-based learning over rote memorization. It defines learning standards across all school stages (ages 3-18). While no programmatic API exists, the framework PDF is available from NCERT.

### Recommendation for ExamIQ

- Align ExamIQ's taxonomy model to Sunbird's Framework > Categories > Terms pattern for future DIKSHA interoperability
- Implement CASE-compatible unique identifiers (GUIDs) on learning outcomes
- Structure competencies per NCF 2023's competency-based framework
- Consider future DIKSHA content publishing (tagged against Sunbird taxonomy)

**Impact**: MEDIUM (future-proofing) | **Feasibility**: LOW for full integration, HIGH for structural alignment

---

## 7. Teacher-AI Collaboration Patterns

### Current Pattern: AI Drafts, Teacher Refines

ExamIQ already implements this with Auto/Guided/Expert modes and HITL review cards. This is table stakes.

### Next-Generation Patterns

**Pattern 7.1: Curator-Teacher Hierarchy (from Shiksha Copilot)**
- Expert teachers ("curators") review AI-generated curriculum/question sets for a subject
- Once curated, classroom teachers access and customize
- 96.13% of curated English content was classroom-ready
- ExamIQ implementation: Add a "Curator" role that can publish verified question sets to the workspace; other teachers use these as a starting base

**Pattern 7.2: AI Confidence Scores on Generated Items**
- Current GenAI models do not offer built-in confidence scores
- Proxy approaches: (a) Generate multiple candidates and use inter-answer agreement as confidence, (b) Have a second LLM call evaluate alignment, (c) Use token-level probability where available
- Display as a quality indicator: "AI Confidence: High/Medium/Low" on each generated question
- For ExamIQ: Use a lightweight evaluation pass after generation that checks curriculum alignment, Bloom's match, and factual grounding

**Pattern 7.3: Collaborative Curriculum Editing**
- Multiple teachers in a workspace can review and edit the taxonomy tree
- Track who changed what (audit log on curriculum modifications)
- "Suggest" mode: teacher proposes a change, senior teacher approves
- ExamIQ implementation: Add `last_modified_by` and `modification_history` (JSON) to curriculum entities

**Pattern 7.4: Version Control for Curricula**
- Each academic year gets a curriculum version
- Clone-and-modify pattern: clone last year's curriculum, make changes, approve
- Diff view shows what changed between versions
- ExamIQ already has `is_active` flag -- extend with `version` field and `cloned_from_id`

---

## 8. Outcome-Based Education (OBE) Data Model

### Standard OBE Hierarchy

From industry platforms (vmedulife, Creatrix, CAMU):

```
Program Educational Objectives (PEOs)  -- 5-year outcomes
  └── Program Outcomes (POs)           -- graduation-level outcomes
       └── Program Specific Outcomes (PSOs)  -- discipline-specific outcomes
            └── Course Outcomes (COs)        -- per-course outcomes
                 └── Assessment Tools         -- mapped to COs
```

### OBE Mapping Mechanics

- Each CO maps to one or more POs via a **relevance matrix** (3-point scale: 1=low, 2=medium, 3=high)
- Assessment tools (exams, assignments) are mapped to specific COs
- Attainment is computed: % of students achieving >= threshold score on CO-mapped assessments
- Direct assessment (exams, quizzes) + Indirect assessment (surveys, feedback) combine for CO attainment

### ExamIQ's OBE Alignment

ExamIQ's existing model maps closely to the CO-Assessment portion:

```
LearningOutcome (in curriculum)  ≈  Course Outcome
  └── Question (tagged to outcome via chapter/topic)  ≈  Assessment Item
       └── StudentAnswer (scored)  ≈  Performance Evidence
```

**Enhancement** (3 concrete deliverables):
1. **Data model**: Add `QuestionOutcomeMapping` many-to-many table linking `Question.id` to `LearningOutcome.id` with a `relevance` score (1-3)
2. **Attainment computation**: New service function `compute_outcome_attainment(outcome_id)` that queries `StudentAnswer` scores for all questions mapped to that outcome, returns % of students achieving >= threshold
3. **Reporting UI**: Outcome attainment dashboard showing per-outcome mastery rates with drill-down to contributing questions and student responses

This maps to the impact-feasibility matrix as Feature #17 (P2). The many-to-many mapping is the critical first step -- without it, attainment computation is impossible.

**How OBE strengthens ExamIQ's differentiator**: The gap-fill workflow currently operates at chapter level ("Chapter 7 has no questions"). With OBE mapping, it becomes outcome-level: "Learning Outcome 'Apply Trigonometric Ratios' has 0 questions at Apply level. Generate 3?" This is a finer-grained, more educationally meaningful gap analysis than any competitor offers.

---

## Feature Impact-Feasibility Matrix

Ranked by combined score (Impact x Feasibility):

| Rank | Feature | Impact | Feasibility | Priority | How it strengthens ExamIQ's gap-fill differentiator |
|------|---------|--------|-------------|----------|-----------------------------------------------------|
| 1 | **CurriculumContext Bundle** (structured payload to AI) | HIGH | HIGH | **P0** | Generation is grounded in full curriculum metadata, not just chapter name |
| 2 | **Coverage Heatmap** (Chapters x Bloom's 2D matrix) | HIGH | HIGH | **P0** | Gap detection becomes 2D (chapter × cognitive level), not just 1D |
| 3 | **Enhance Bloom's Tagging** with confidence scores | HIGH | MEDIUM | **P0** | Existing Bloom's assignment gets quality signal; teacher corrections improve AI |
| 4 | **Difficulty Calibration** from historical StudentAnswer data | MEDIUM | HIGH | **P0** | Gap-fill generates at empirically validated difficulty, not AI-guessed |
| 5 | **Marks Weightage Auto-Suggestion** from board patterns | MEDIUM | HIGH | **P1** | Paper assembly auto-allocates marks per chapter correctly |
| 6 | **Syllabus Diff Detection** (year-over-year comparison) | MEDIUM | HIGH | **P1** | Gap detection accounts for syllabus changes across academic years |
| 7 | **Curriculum Intelligence Cards** (performance-based suggestions) | HIGH | MEDIUM | **P1** | Proactive gap identification from student performance, not just bank analysis |
| 8 | **Question Alignment Score** (0-100 per question) | HIGH | MEDIUM | **P1** | Quality gate on generated questions before they enter the bank |
| 9 | **Teacher Curriculum Subscription** (select active scope) | HIGH | MEDIUM | **P1** | Gap analysis scoped to teacher's actual teaching plan, not full syllabus |
| 10 | **Prerequisite Mapping Phase 1** (manual tagging only) | HIGH | MEDIUM | **P1** | Gap-fill becomes sequencing-aware (don't fill Chapter 8 gaps before Chapter 5) |
| 11 | **Spaced Repetition** via FSRS (experimental, validate first) | HIGH | MEDIUM | **P2** | Auto-schedule review quizzes for topics with declining mastery |
| 12 | **AI Confidence Scores** on generated questions | MEDIUM | MEDIUM | **P2** | Quality triage: teachers review low-confidence questions first |
| 13 | **Cross-Board Mapping** (CBSE ≈ ICSE chapter equivalence) | MEDIUM | MEDIUM | **P2** | Question reuse across boards where content overlaps |
| 14 | **Curator-Teacher Hierarchy** (expert review workflow) | MEDIUM | MEDIUM | **P2** | Curated question sets as verified starting base for other teachers |
| 15 | **Prerequisite Mapping Phase 2** (AI-suggested + path gen) | HIGH | LOW | **P2** | Full prerequisite-aware generation and learning paths |
| 16 | **Learning Path Generation** from prerequisite graph | MEDIUM | MEDIUM | **P2** | Personalized study sequences from gap analysis |
| 17 | **OBE Outcome Attainment** (Question ↔ LearningOutcome mapping) | MEDIUM | MEDIUM | **P2** | Outcome-level gap analysis ("0 Apply questions for this outcome") |
| 18 | **DIKSHA/CASE Interoperability** alignment | MEDIUM | LOW | **P3** | Future national platform publishing compatibility |

---

## Architectural Recommendations: From AI-Assisted to AI-Native

### What "AI-Assisted" Looks Like (ExamIQ's Current State)

- AI generates questions when asked by teacher
- Teacher provides parameters manually
- Curriculum data is static, maintained by admins
- Analytics are reactive (show what exists)
- No learning from outcomes

### What "AI-Native" Looks Like (Target State)

1. **Curriculum IS the generation substrate**: Every question generated is structurally bound to a curriculum node with full metadata context (outcomes, Bloom's, prerequisites, patterns). The curriculum graph is the single source of truth for what AI can and should generate.

2. **Proactive intelligence**: System identifies gaps, suggests actions, and pre-computes what teachers need before they ask. "You have no Application-level questions for Chapter 7. Generate 5?" appears automatically.

3. **Closed-loop feedback**: Student performance data flows back into curriculum intelligence. Empirical difficulty recalibrates AI parameters. Mastery data identifies weak topics. Spaced repetition schedules reviews.

4. **Multi-agent orchestration**: ExamIQ's existing services (question_generator, paper_assembler, learning_plan_generator) are already separate modules. The evolution is making them **CurriculumContext-aware and interconnected**, not converting them to literal LLM agents. Concrete example of what orchestration buys: when a teacher clicks "Create Paper," instead of the teacher manually picking questions, the orchestrator (a) reads the CurriculumContext (chapters, weightage, Bloom's targets), (b) calls question_generator to fill gaps if the bank is thin, (c) calls paper_assembler to build a balanced paper respecting marks weightage + Bloom's distribution, (d) calls learning_plan_generator to pre-create a study plan for weak students based on the paper's topic coverage. Today these are 4 separate manual actions. With orchestration, it's one click: "Create Paper" → AI handles the rest, teacher reviews.

5. **Teacher as curator, not operator**: AI handles the mechanical work (generation, tagging, calibration, scheduling). Teacher handles the judgment work (review, approve, customize, override). The Shiksha Copilot model (96% classroom-ready content) proves this works.

### Concrete Next Steps for ExamIQ

**Phase 1 (P0 -- Immediate)**: CurriculumContext bundle, Coverage heatmap, Auto-tag Bloom's, Difficulty calibration from historical data.

**Phase 2 (P1 -- Near-term)**: Curriculum Intelligence Cards, Question alignment scores, Teacher subscription model, Prerequisite mapping, Syllabus diff detection, Marks weightage auto-suggestion.

**Phase 3 (P2 -- Medium-term)**: Spaced repetition scheduling, Cross-board mapping, AI confidence scores, Curator-teacher hierarchy, Learning path generation, OBE attainment tracking.

**Phase 4 (P3 -- Future)**: DIKSHA/CASE interoperability, Full knowledge graph (Embibe-scale 60K+ concepts), Multi-agent orchestration layer.

---

## Knowledge Gaps and Future Research

1. **Indian curriculum API**: No formal REST API exists for CBSE/ICSE syllabus data. DIKSHA's Sunbird APIs are the closest, but not designed for third-party EdTech consumption. Monitor NDEAR progress.

2. **Bloom's auto-tagging accuracy in Indian context**: The 94% SVM accuracy was achieved on English-language educational text. Performance on CBSE/ICSE-specific question formats (competency-based, structured/unstructured) needs validation.

3. **FSRS for curriculum topics (vs flashcards)**: FSRS is proven for flashcard-level items. Its application to topic-level mastery tracking in exam preparation contexts is untested and warrants experimentation.

4. **Cross-board mapping quality**: Automated CBSE-ICSE mapping via embedding similarity has unknown accuracy. Manual validation by subject experts would be needed for initial mapping.

5. **Student data volume for difficulty calibration**: ExamIQ would need sufficient exam sessions per question to compute reliable empirical difficulty. Minimum viable: 30+ student responses per question for statistical significance.

---

## Sources

- [Embibe Auto-Generation of Questions](https://www.embibe.com/in-en/artificial-intelligence-ai-in-education/auto-generation-of-questions-of-desired-complexity/)
- [Embibe Learning Outcomes AI Stack](https://www.embibe.com/in-en/artificial-intelligence-ai-in-education/building-the-learning-outcomes-ai-stack/)
- [Squirrel AI Wikipedia](https://en.wikipedia.org/wiki/Squirrel_AI)
- [AI Adaptive Learning Platforms Architecture](https://www.navgood.com/en/article-details/ai-adaptive-learning-platforms-c0bdf)
- [Khan Academy AI Content Development](https://support.khanacademy.org/hc/en-us/articles/20349258135181-How-does-Khan-Academy-use-AI-in-our-content-development-process)
- [Khan Academy Framework for Responsible AI](https://blog.khanacademy.org/khan-academys-framework-for-responsible-ai-in-education/)
- [DreamBox Continuous Assessment & Adaptivity](https://dreamboxlearning.zendesk.com/hc/en-us/articles/27281596241043-DreamBox-Math-Continuous-Assessment-Adaptivity)
- [Automated Bloom's Taxonomy Classification (arXiv)](https://arxiv.org/html/2511.10903v1)
- [Leveraging GenAI for Bloom's Classification (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S2666920X2500044X)
- [ExamSoft Category Tagging](https://examsoft.com/resources/category-tagging-can-help-students/)
- [CompetencyGenie for Exam Item Classification](https://enflux.com/enflux-and-examsoft-unveil-competencygenie-for-exam-item-classification/)
- [Sunbird Knowlg Framework APIs](https://knowlg.sunbird.org/learn/product-and-developer-guide/taxonomy-and-tagging/framework-service/apis)
- [Sunbird Knowlg Framework FAQs](https://knowlg.sunbird.org/learn/product-and-developer-guide/taxonomy-and-tagging/framework-service/faqs)
- [DIKSHA Infrastructure on NDEAR](https://www.ndear.gov.in/diksha-infrastructure.html)
- [Digital Public Goods for Education: India (Carnegie)](https://carnegieendowment.org/research/2023/03/digital-public-goods-for-education-the-indian-experience?lang=en)
- [1EdTech CASE Standard](https://www.1edtech.org/standards/case/about)
- [CASE Implementation Guide](https://www.imsglobal.org/spec/CASE/v1p1/impl)
- [Shiksha Copilot: Teacher-AI Collaboration (arXiv)](https://arxiv.org/html/2507.00456v3)
- [AI-Native EdTech Modernization Guide 2026](https://www.hireplicity.com/blog/ai-native-edtech-modernization-2026-guide)
- [Atomic Jolt AI Curriculum Gap Analysis](https://www.atomicjolt.com/post/curriculum-gap-analysis)
- [ACE: AI-Assisted Educational Knowledge Graphs](https://jedm.educationaldatamining.org/index.php/JEDM/article/view/737)
- [FSRS Algorithm on PyPI](https://pypi.org/project/fsrs/)
- [Open Spaced Repetition](https://github.com/open-spaced-repetition)
- [CBSE-ICSE Curriculum Mapping (NatureNurture)](https://www.naturenurture.org/blog/streamlining-lesson-planning-through-cbse-icse-curriculum-mapping)
- [Eklavvya AI Question Paper Generator](https://www.eklavvya.com/blog/ai-question-paper-generator/)
- [NCF 2023 National Curriculum Framework](https://www.ncf.ncert.gov.in/)
- [NEP 2020 and EdTech (ORF)](https://www.orfonline.org/expert-speak/five-years-of-nep-2020-and-the-promise-of-edtech)
- [Assessment-Curriculum Alignment (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11806761/)
- [GenAI Confidence Score Framework](https://egen.ai/insights/genai-confidence-score-trust-framework/)
- [OBE Framework Guide (Linways)](https://blog.linways.com/the-ultimate-guide-to-outcome-based-education/)
- [EdTech Hub: AI Content Generation in Education](https://edtechhub.org/2025/07/23/how-are-education-implementers-approaching-ai-content-generation-curation-and-integration/)
- [Personalized Learning Path Recommendation Survey (MDPI)](https://www.mdpi.com/2079-9292/15/1/238)
