---
name: clean-context-review
description: Run an independent clean-context review for a refactor iteration, risky change, or pre-commit gate. Use when the user wants a skeptical second pass that sees only the iteration goal, diff, changed files, and test results, without implementation backstory.
---

# Clean Context Review

Run this skill when the user wants an independent review gate before proceeding to the next iteration, before committing, or before merging a risky refactor slice.

## Goal

Produce a skeptical review from clean context:

- no implementation narrative
- no prior reasoning dump
- only the minimum artifacts needed to judge the change

The reviewer should answer one core question:

`Did this slice reduce risk and improve locality without changing intended behavior?`

## Inputs To Prepare

Before invoking the reviewer, gather only:

- iteration name
- iteration goal
- acceptance criteria
- changed files
- diff
- test commands run
- test results

Do not pass:

- intended answer
- your explanation of why the code is good
- suspected fix unless the reviewer explicitly needs it
- long historical context unless it is required to judge regressions

## Review Mode

Use a sub-agent or separate reviewer context when available. The reviewer must act as if it is seeing the iteration for the first time.

If a reviewer sub-agent is used:

- wait for its final review output
- copy the review result into the main agent response
- close the reviewer sub-agent immediately after the result is captured
- do not leave reviewer agents open between iterations or approval gates

If sub-agents are unavailable, emulate the same discipline manually:

- restate only the minimal inputs
- do not use prior implementation reasoning
- review from the diff and tests only

## Prompt Template

Use the template in [references/review-prompt.md](references/review-prompt.md).

Adapt only:

- iteration name
- goal
- acceptance criteria
- changed files
- test results

Keep the rest stable so reviews are comparable across iterations.

## What The Reviewer Must Focus On

- behavioral regressions
- missing or weak tests
- architectural backsliding
- coupling that remains or was introduced
- contract drift
- slices that are larger than the stated iteration goal

The reviewer should not optimize for tone. It should optimize for signal.

## Expected Output Shape

The review should return:

1. Findings first, ordered by severity, with file references where possible
2. Open questions or assumptions
3. Final verdict:
   - `acceptable`
   - `acceptable with follow-ups`
   - `not acceptable`

If the verdict is `not acceptable`, do not proceed to the next iteration.

## Agent Lifecycle Rule

Reviewer sub-agents are disposable.

- spawn one reviewer per review task
- reuse is not required
- once the review has been handed back to the main agent, close that reviewer thread
- if the review must be rerun, spawn a fresh reviewer so the context stays clean

## Approval Gate

After the review:

- address findings if needed
- summarize what changed
- ask the user the next-step question that matches the review mode:
  - iteration review -> `Do you want to proceed to the next iteration?`
  - commit review -> `Do you want to proceed with the commit?`
  - merge review -> `Do you want to proceed with the merge?`

Do not proceed automatically.
