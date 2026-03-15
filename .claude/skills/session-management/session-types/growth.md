# Session Type: Growth

Use this session type for non-code growth initiatives: product validation, market research, marketing campaigns, conversion optimization, and go-to-market execution.

---

## When to Use

- Validating a new product idea
- Running market/competitor research
- Building marketing systems from scratch
- Creating multi-phase content campaigns
- Optimizing conversions (CRO)
- Planning and executing product launches
- Building growth loops (referrals, free tools)

---

## Session File Header

```markdown
**Session Type**: Growth
**Status**: `PENDING`
```

---

## Growth-Specific Agent

This session type is coordinated by the **growth-engineer** agent, which orchestrates the Growth Kit ecosystem (10 sub-skills) to transform business goals into actionable growth campaigns.

---

## 6-Phase Workflow

### Phase 1: Discovery (New Products Only)

Validate before building:

1. **Run idea-extraction** - Deep-dive interview, viability scoring
2. **Run competitive-intel** - Competitor briefs, How to Win playbook
3. **Select starter-kit** - Match requirements to technical foundation
4. **Plan transformation** - 7-domain implementation plan

**Output**: Strategy document, viability score (>60 to proceed)

**Skip when**: Existing product, pivoting only messaging

---

### Phase 2: Research

Understand before executing:

1. **Competitor analysis** - Map competitive landscape, identify gaps
2. **Target segments** - Define audience profiles with pain points
3. **Positioning strategy** - Find where you fit in market

**Output**: Battle cards, segment profiles, positioning framework

**Skip when**: Research exists from previous session

---

### Phase 3: Foundation

Define before creating:

1. **Voice profiler** - Define how you sound (3-sentence summary)
2. **Hook finder** - Find differentiated positioning angle

**Output**: Voice profile, winning hook/angle

**Critical**: Foundation must be complete before any execution phase

---

### Phase 4: Strategy

Plan the campaign:

1. **Keyword research** (SEO Boost API + Workflow S)
2. **Content calendar** - Prioritized topics and timeline
3. **Campaign structure** - Phases with specialist assignments

**Output**: Keyword clusters, content plan, campaign phases

---

### Phase 5: Execution

Create the assets:

1. **Content creation** - Landing pages, blog posts, lead magnets
2. **Email sequences** - Welcome, nurture, conversion flows
3. **Visual assets** - Hero images, social graphics

**Output**: Publication-ready content and visuals

**Agent coordination**:

- content-writer: Copy and content pieces
- seo-specialist: Keyword research
- media-creation: Visual assets
- frontend-specialist: React implementation

---

### Phase 6: Optimization

Iterate and improve:

1. **CRO analysis** - Audit conversion points
2. **A/B testing** - Design and run experiments
3. **Distribution** - Repurpose and deploy across channels

**Output**: Test results, optimized assets, distribution plan

---

## Quality Gates

### Foundation Gate (Before Phase 5)

- [ ] Voice profile exists (3-sentence summary)
- [ ] Positioning defined (winning angle)
- [ ] Target audience clear (primary segment)

### Strategy Gate (Before Phase 5)

- [ ] Keyword clusters prioritized
- [ ] Content calendar planned
- [ ] Campaign phases defined

### Execution Gate (Before Phase 6)

- [ ] Content pieces created
- [ ] Assets delivered
- [ ] Quality reviewed (not generic, not hedged)

### Optimization Gate (Session Complete)

- [ ] Conversions tracked
- [ ] A/B tests designed or running
- [ ] Iterations documented

---

## Growth Kit State Tracking

Track progress in session file:

```markdown
## Growth Kit Progress

### Discovery

- [ ] Product idea validated: [yes/no/skipped]
- [ ] Implementation plan: [exists/missing/skipped]

### Research

- [ ] Competitor analysis: [exists/missing]
- [ ] Target segments: [exists/missing]
- [ ] Positioning strategy: [exists/missing]
- [ ] Keyword clusters: [exists/missing]

### Foundation

- [ ] Brand voice profile: [exists/missing]
- [ ] Positioning/hooks: [exists/missing]

### Execution

- [ ] Lead magnet concept: [exists/missing]
- [ ] Landing page(s): [exists/missing]
- [ ] Content pieces: [count]
- [ ] Email sequences: [exists/missing]

### Distribution

- [ ] Social content: [exists/missing]
- [ ] Reddit presence: [exists/missing]
- [ ] Twitter presence: [exists/missing]

### Optimization

- [ ] CRO analysis: [exists/missing]
- [ ] A/B tests: [count]

### Next Priority

Based on gaps: [recommendation]
```

---

## Session File Format

```markdown
# Growth Session - [Campaign/Product Name]

## Business Context

**Goal:** [One-sentence business goal]
**Target Audience:** [Primary segment]
**Timeline:** [Today / This week / Long-term]

## Intake Diagnosis

**Phase:** [Discovery/Research/Foundation/Strategy/Execution/Optimization]
**Existing Assets:** [Checklist from Question 2]
**Gaps Identified:** [What needs to be created]
**First Priority:** [Single highest-impact skill]

## Campaign Plan

### Phase 1: [Name]

**Skill:** [Growth Kit skill]
**Specialist:** [Agent assignment]
**Deliverable:** [Expected output]

### Phase 2: [Name]

...

## Growth Kit Progress

[State tracking checklist]

## Agent Work Sections

### Growth Engineer

**Status**: [In Progress/Completed]
**Diagnosis**: [Phase identified, gaps found]
**Campaign Plan**: [Phases created]

### [Specialist Agent Name]

**Status**: [In Progress/Completed]
**Tasks Completed**:

- [x] Task 1 - [brief outcome]
      **Deliverables**: [What was created]
      **Next Agent Context**: [Compressed handoff]

## Session Metrics

**Phases Total**: [X]
**Phases Completed**: [Y]
**Assets Created**: [List]
**Blockers**: [Any impediments]
**Follow-up Items**: [Work for next session]
```

---

## Context Compression Rules

Growth sessions require careful context management:

### Between Phases

| From       | Pass This                   | Not This               |
| ---------- | --------------------------- | ---------------------- |
| Research   | Key gaps (3-5 bullets)      | All competitor details |
| Foundation | Voice summary (3 sentences) | Full profile           |
| Strategy   | Top 5 keywords              | Full spreadsheet       |

### To Execution Specialists

```markdown
## Handoff Context

**Business Goal:** [One sentence]
**Target Audience:** [Primary segment only]
**This Task:** [Specific deliverable]

**Available Context:**

- Voice: [3-sentence summary]
- Positioning: [Winning angle]
- Keywords: [Top 5]

**Deliverable Format:** [Expected output]
```

### Fresh Start Rule

Run execution WITHOUT full context when:

- Output feels generic or hedged
- Previous phase output was mediocre
- Need bold, opinionated copy

---

## Common Pitfalls

| Pitfall               | Prevention                                  |
| --------------------- | ------------------------------------------- |
| Skipping foundation   | Always complete voice + positioning first   |
| Context overload      | Compress between phases, essentials only    |
| Vague tasks           | Specify exact deliverable for each phase    |
| No state tracking     | Update Growth Kit progress after each phase |
| Chaining failures     | Stop and run fresh when output degrades     |
| Ignoring dependencies | Follow layered dependency order             |

---

## Layered Dependencies Reference

Complete earlier layers before moving to later ones:

```
DISCOVERY -> RESEARCH -> FOUNDATION -> STRATEGY -> EXECUTION -> OPTIMIZATION
                            |
                            v
                    (Required for all
                     execution work)
```

**Rule**: Foundation (voice + positioning) must exist before any content creation.
