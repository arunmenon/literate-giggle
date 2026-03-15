# Session Type: Development

Use this session type for building new features, implementing plans, and standard development work.

---

## When to Use

- Building new features or functionality
- Implementing a planned design
- Adding new components, APIs, or integrations
- Standard coding work with clear requirements

---

## Session File Header

```markdown
**Session Type**: Development
**Status**: `PENDING`
```

---

## Workflow

### Phase 1: Design First

Before writing code, validate the approach:

1. **Understand the request** - Restate in your own words
2. **Explore alternatives (if prudent)** - Only when path is unclear or user requests options
3. **Get user confirmation** - Don't assume, ask when ambiguous
4. **Apply YAGNI** - Build only what's explicitly required

**Design Validation Questions**:

- What's the simplest solution that works?
- What existing patterns can we follow?
- What are the integration points?

**Skip alternative exploration when**: User specified approach, clear pattern exists, or requirements are unambiguous.

### Phase 2: Plan Creation

**For complex development work (5+ files, multi-phase, architectural):**
Central AI auto-invokes `/team-plan` which generates a structured plan with team members, tasks, dependencies, and acceptance criteria. See the `session-management` SKILL.md Phase 3 for details.

**For moderate development work (2-5 files, clear scope):**
Create detailed, actionable tasks manually:

| Requirement  | Description                                |
| ------------ | ------------------------------------------ |
| Task size    | 1-4 hours max (atomic)                     |
| Specificity  | Exact file paths, not abstractions         |
| Context      | Assume reader knows nothing about codebase |
| Verification | Each task has clear "done" criteria        |

**Task Template**:

```markdown
- [ ] Task N: [Component Name]
  - Files: `exact/path/to/file.ts`
  - Action: [Create/Modify/Delete]
  - Details: [Specific implementation notes]
  - Done when: [Verification criteria]
```

### Phase 3: Batch Execution

Execute in batches with checkpoints:

1. **Batch size**: 3 tasks maximum
2. **After each batch**: Verify, update session file, sync TaskList
3. **On blockers**: Stop immediately, document, ask user

**Checkpoint Questions**:

- Do all changes compile/run?
- Are tests passing?
- Is the session file updated?

### Phase 4: Completion

Before claiming completion:

1. Run verification command (build, test, lint)
2. Show evidence of success
3. Update session status to `COMPLETE`
4. Apply verification gate protocol

---

## Quality Checklist

Before marking development session complete:

- [ ] All tasks have `[x]` checkboxes
- [ ] Code compiles without errors
- [ ] Tests pass (if applicable)
- [ ] Session file reflects actual state
- [ ] TaskList synced with session (use TaskUpdate for status)
- [ ] Verification evidence provided

---

## Common Pitfalls

| Pitfall                  | Prevention                     |
| ------------------------ | ------------------------------ |
| Starting without design  | Always validate approach first |
| Tasks too large          | Break into 1-4 hour chunks     |
| Skipping checkpoints     | Verify after every 3 tasks     |
| Assuming requirements    | Ask clarifying questions       |
| No verification evidence | Run and show command output    |
