---
description: Execute an implementation plan from a spec file
argument-hint: [path-to-plan]
---

# Build

Follow the `Workflow` to implement the `PATH_TO_PLAN` then `Report` the completed work.

## Variables

PATH_TO_PLAN: $ARGUMENTS

## Workflow

- If no `PATH_TO_PLAN` is provided, STOP immediately and ask the user to provide it (AskUserQuestion).
- Read and execute the plan at `PATH_TO_PLAN`. Think hard about the plan and implement it into the codebase.
- Follow the Team Orchestration section if present - use Task tools to coordinate team members.
- Follow the Step by Step Tasks in order, respecting dependencies.
- Use the Validation Commands to verify your work.

## Report

- Present the `## Report` section of the plan with actual results filled in.
