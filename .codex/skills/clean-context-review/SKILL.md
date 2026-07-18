---
name: clean-context-review
description: Run an independent clean-context review for a refactor iteration, risky change, or pre-commit gate. Use when the user wants a skeptical second pass that sees only the iteration goal, diff, changed files, and test results, without implementation backstory.
---

# Clean Context Review

Use this skill for an explicit review gate on a risky slice, iteration slice, or pending commit.

Do not use it for:

- trivial edits
- broad codebase exploration
- normal implementation unless a review gate is wanted

## Goal

Produce a skeptical review from clean context with minimal inputs only.

The reviewer should answer one core question:

- `behavior-preserving` mode: `Did this change reduce risk and improve locality without changing intended behavior?`
- `behavior-changing` mode: `Did this change achieve the intended behavior with acceptable risk, scope, and test coverage?`

## Inputs To Prepare

- iteration name or review target
- goal
- acceptance criteria
- review mode
- changed files
- diff
- test commands
- test results

Do not pass implementation narrative, intended answer, or long history unless required for regression judgment.

## Review Mode

- prefer a fresh reviewer sub-agent when the review matters
- manual review is acceptable fallback
- do not reuse reviewer context across review rounds

## Prompt Template

Use the template in [references/review-prompt.md](references/review-prompt.md).

Adapt only the slice-specific fields. Keep the rest stable.

## What The Reviewer Must Focus On

- behavioral regressions
- missing or weak tests
- architectural backsliding
- coupling that remains or was introduced
- contract drift
- slices that are larger than the stated iteration goal

The reviewer should optimize for signal, not tone.

## Output

Return:

1. findings first, ordered by severity, with file references when possible
2. open questions or assumptions
3. verdict:
   - `acceptable`
   - `acceptable with follow-ups`
   - `not acceptable`

Do not choose the next workflow step. Return the verdict only.
