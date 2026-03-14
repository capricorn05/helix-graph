# AGENTS.md

## Project source-of-truth documents

Before starting non-trivial work, review these files if they exist:

- `README.md`
  - For project overview, setup, commands, conventions, and usage.
- `ARCHITECTURE_ROADMAP.md`
  - For system design, architectural direction, constraints, major decisions, and roadmap status.
- `Tech Specs.md`
  - For implementation details, technical requirements, data flow, APIs, component behavior, and edge cases.
- `NEXT_STEPS.md`
  - For current priorities, active tasks, follow-up items, and short-term execution plan.

## Required workflow

When making changes:

1. Read the relevant source-of-truth documents before coding.
2. Align implementation with the architecture and tech specs.
3. If the implementation changes the intended design, behavior, scope, setup, or priorities, update the relevant docs before finishing.
4. In the final response, include:
   - which of these files were reviewed
   - which of these files were updated
   - any mismatches found between code and docs
   - any follow-up items that should be added to `NEXT_STEPS.md`

## Documentation update rules

### Update `README.md` when:

- setup steps change
- commands change
- environment variables change
- usage or developer workflow changes

### Update `ARCHITECTURE_ROADMAP.md` when:

- architecture changes
- a new subsystem or integration is introduced
- technical direction changes
- roadmap status changes

### Update `Tech Specs.md` when:

- implementation details change
- APIs, schemas, contracts, or component behavior change
- edge cases, validations, or constraints change

### Update `NEXT_STEPS.md` when:

- a task is completed
- a new follow-up is discovered
- priorities change
- technical debt or deferred work is identified

## Behavior rules

- Do not invent documentation updates that are not supported by the code changes.
- Prefer updating existing sections over creating duplicate sections.
- If no documentation update is needed, explicitly state why.
- If code conflicts with one of the source-of-truth documents, flag it clearly.

## Final response requirements

In the final response:

- summarise the code changes
- list which docs were reviewed
- list which docs were updated
- note any doc/code mismatches
- note any follow-up items added to `NEXT_STEPS.md`
- if no docs were changed, state why
