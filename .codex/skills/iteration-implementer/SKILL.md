---
name: iteration-implementer
description: Execute one bounded plan item or checklist slice with a worker, checks, review, and commit handoff. Use only when there is an explicit plan to work through in iterations.
---

# Iteration Implementer

Use this skill only when all of these are true:

- there is an explicit plan file, checklist, or named iteration items
- the current task is one bounded slice from that plan
- the user wants iterative execution, or the plan itself implies it

Do not use this skill for:

- ordinary bug fixes
- small one-off edits
- broad open-ended requests
- requests with no plan artifact to update

## Goal

Run one plan slice through a bounded workflow:

- implement only the selected checklist items
- verify the required checks
- get clean review
- patch the plan conservatively
- hand off to structured commit when accepted

## Required Inputs

- slice name or plan item label
- slice goal, if the checklist item does not already make the goal obvious
- exact checklist items for this slice
- plan file path
- allowed files or modules
- out-of-scope files or concerns
- required test commands

If any of the above are missing, do not force this skill. Fall back to normal direct implementation.

## Workflow

### 1. Scope The Slice

- re-read the plan file
- identify the exact unchecked items for this slice
- implement only those items
- avoid inferring new scope from general intent

### 2. Implement

- prefer a worker sub-agent when the slice is large enough to benefit
- direct implementation by the main agent is allowed when delegation adds more overhead than value
- use the prompt in [references/implementer-prompt.md](references/implementer-prompt.md) when delegating
- require the implementer to report changed files, checks run, results, and which checklist items are complete

### 3. Checks Gate

- verify the required checks actually ran
- if a required check was skipped, run it before review
- run unit, lint, and other non-E2E checks first
- if those checks pass, run the required E2E coverage before review
- if unit or lint checks fail, do not continue to E2E or commit
- if E2E fails, stop the slice and report the failure instead of moving to commit
- record pass or fail for each command

### 4. Review Gate

- invoke `clean-context-review`
- choose the review mode:
  - `behavior-preserving` for refactors and locality work
  - `behavior-changing` for features and intended bug-fix behavior changes
- pass only the goal, checklist items, changed files, diff, test evidence, and review mode
- keep implementation backstory out of the review prompt

### 5. Plan Patch

- patch only items proven complete by code and checks
- do not mark review, approval, or commit items done without explicit evidence
- mention anything still unchecked

### 6. Commit Handoff

- if review is `acceptable` or `acceptable with follow-ups`, and required E2E checks passed, invoke `structured-commit`
- when the user has already explicitly asked for a commit after successful checks, use `structured-commit` to prepare the scope and then perform the commit in the same run
- if required E2E coverage did not pass, do not prepare or perform the commit
- prepare the commit handoff before any next-iteration question
- do not proceed to the next slice automatically

`iteration-implementer` owns the routing after review:

- accepted + E2E passed -> structured commit handoff, then wait for user decision unless the user already explicitly requested immediate commit on success
- not acceptable on first try -> one retry
- not acceptable on second try -> stop and ask the user

## Loop Rule

- allow at most 2 implementation attempts for the same slice:
  - initial attempt
  - one retry if review is `not acceptable`
- on the second failed review, stop and return control to the user
- do not continue automatically
- if the review is accepted, stop after commit handoff and wait for user decision

## Agent Rules

- one slice per run
- one worker per delegated attempt
- one reviewer per review
- close sub-agents after their result is captured
- do not leave sub-agents alive across approval gates or later slices
- do not widen scope to adjacent checklist items without user approval

## Output

Return:

1. slice summary
2. checklist items completed
3. checks run
4. clean-context review verdict
5. E2E status
6. structured commit handoff, commit result, or blocking findings
7. final state:
   - ready for commit decision
   - committed after successful checks
   - needs one retry
   - stopped and waiting for user input
