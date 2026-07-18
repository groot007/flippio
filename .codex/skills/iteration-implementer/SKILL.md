---
name: iteration-implementer
description: Delegate one refactor iteration to a worker sub-agent, then pass the result to the clean-context reviewer. Use when the main agent should stay in orchestrator mode during stepwise refactors, implementing one scoped slice at a time with a reviewer loop and a three-attempt stop rule.
---

# Iteration Implementer

Use this skill when the user wants the main agent to stay in orchestration mode and delegate the current refactor slice to a worker sub-agent.

## Goal

Run one implementation iteration through a controlled loop:

1. scope the slice
2. delegate implementation
3. send the result to clean-context review
4. repeat only if the review is not acceptable
5. stop after three failed loops and return control to the user

## Workflow

### 1. Prepare The Iteration Brief

Before spawning the implementer, gather only:

- iteration name
- iteration goal
- explicit acceptance criteria
- allowed files or modules
- files that are out of scope
- required test commands
- current review constraints from the plan

Do not pass broad historical context unless it is required for the slice.

## 2. Spawn The Worker

Use a worker sub-agent when available.

The worker owns the current iteration by default.

The worker brief should say:

- this is one scoped iteration only
- do not widen scope
- do not revert unrelated user changes
- run the required checks for the slice
- report changed files, tests run, results, and known risks

Use the template in [references/implementer-prompt.md](references/implementer-prompt.md).

## 3. Review Handoff

After the worker returns:

- collect the changed files
- collect the diff
- collect test commands and results
- invoke the `clean-context-review` skill

The main agent must keep the review isolated from implementation backstory.

## 4. Loop Rule

If the reviewer verdict is:

- `acceptable`
  - summarize the result
  - present the separate subagent review
  - stop and ask the user whether to proceed
- `acceptable with follow-ups`
  - summarize the result
  - present the separate subagent review
  - stop and ask the user whether to proceed
- `not acceptable`
  - send only the blocking findings back to the worker
  - keep the same iteration boundary
  - run the loop again

## 5. Stop Rule

If the worker-review loop reaches more than three implementation attempts for the same iteration:

- stop the loop
- report the current state to the user
- include:
  - iteration name
  - attempt count
  - latest worker summary
  - latest reviewer verdict
  - blocking findings still unresolved
- ask the user how to proceed

Do not continue automatically after the third failed review loop.

## Scope Rules

- One iteration per worker run.
- Prefer narrow slices over broad completion.
- The worker may edit code directly, but only within the declared iteration boundary.
- The main agent remains responsible for:
  - plan tracking
  - approval gates
  - commit handoff
  - deciding whether review findings are blocking or informational

## Fallback

If sub-agents are unavailable:

- implement the same workflow manually
- keep the same iteration brief
- emulate the worker/reviewer separation as closely as possible
- still enforce the three-attempt stop rule

## Output Shape

Return:

1. Main agent summary
2. `Subagent Implementation` section
3. `Subagent Review: Clean Context Review` section
4. Final state:
   - ready for approval
   - needs another implementation loop
   - stopped after three failed attempts

If the slice is ready, ask the user whether to proceed.
