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
- plan file path for the active iteration checklist
- allowed files or modules
- files that are out of scope
- required test commands
- current review constraints from the plan

Treat the active plan document as a required control artifact, not background reading.

Before implementation starts:

- identify the exact checklist items for the current iteration
- use those items to define completion scope
- avoid inferring completion from intent alone

Do not pass broad historical context unless it is required for the slice.

## 2. Spawn The Worker

Use a worker sub-agent when available.

The worker owns the current iteration by default.

The worker brief should say:

- this is one scoped iteration only
- do not widen scope
- do not revert unrelated user changes
- use the active plan checklist as the implementation contract
- run the required checks for the slice
- report changed files, tests run, results, and known risks
- report which checklist items are now fully complete, which remain incomplete, and why

Use the template in [references/implementer-prompt.md](references/implementer-prompt.md).

After the worker returns its final result for the current attempt:

- capture the changed files, test commands, test results, and risks in the main agent
- close the worker sub-agent before starting review
- if another implementation attempt is needed later, spawn a fresh worker rather than reusing the old one

## 3. Review Handoff

After the worker returns:

- collect the changed files
- collect the diff
- collect test commands and results
- collect the worker's mapping from completed work to plan checklist items
- invoke the `clean-context-review` skill

The main agent must keep the review isolated from implementation backstory.

## 4. Plan Update Gate

After implementation and before the final approval question:

- re-read the active plan file
- compare the worker result, changed code, and test evidence against the checklist
- patch only the checklist items that are clearly complete
- leave review, approval, commit, and test-result recording items unchecked unless that evidence is explicitly present
- do not mark an item done just because related code changed; require direct evidence in the repo or command results

If the iteration produced only a partial slice:

- update the plan conservatively
- keep incomplete or unproven items unchecked
- mention the remaining unchecked items in the summary

## 5. Loop Rule

If the reviewer verdict is:

- `acceptable`
  - summarize the result
  - present the separate subagent review
  - ensure both worker and reviewer sub-agents are closed
  - stop and ask the user whether to proceed
- `acceptable with follow-ups`
  - summarize the result
  - present the separate subagent review
  - ensure both worker and reviewer sub-agents are closed
  - stop and ask the user whether to proceed
- `not acceptable`
  - send only the blocking findings back into a new worker attempt
  - keep the same iteration boundary
  - run the loop again

## 6. Stop Rule

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
- Worker and reviewer agents are short-lived and must be closed as soon as their output is integrated into the orchestrator flow.
- The main agent remains responsible for:
  - plan tracking
  - patching the active plan checklist after each completed slice
  - approval gates
  - commit handoff
  - deciding whether review findings are blocking or informational

## Fallback

If sub-agents are unavailable:

- implement the same workflow manually
- keep the same iteration brief
- emulate the worker/reviewer separation as closely as possible
- still re-read and patch the active plan checklist after each completed slice
- still enforce the three-attempt stop rule

## Agent Lifecycle Rule

Sub-agents in this workflow are disposable per attempt.

- one worker per implementation attempt
- one reviewer per review task
- close each agent immediately after its result is captured
- do not keep agents open while waiting for user approval
- do not keep agents alive across iterations
- if the loop continues, spawn fresh agents so each attempt starts from cleaner context

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
