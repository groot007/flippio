---
name: structured-commit
description: Prepare a clean, scoped git commit from the current repo changes. Use when the user wants help analyzing what changed, grouping files into a coherent commit, generating a short commit message, and optionally performing the commit after approval.
---

# Structured Commit

Use this skill when the user wants a disciplined commit step after an iteration or wants help turning a messy diff into a coherent commit.

## Goal

Turn the current diff into one intentional commit unit with:

- a clear scope
- a short subject line
- a brief explanation of what changed
- no unrelated files staged by accident

## Core Rules

- Never commit automatically unless the user explicitly wants the commit performed now.
- Prefer one iteration per commit.
- Do not mix unrelated cleanup with the main slice.
- If the diff contains unrelated changes, separate them before committing.
- Keep the message short and specific.

## Inputs To Gather

- `git status --short`
- `git diff --stat`
- `git diff -- <relevant files>` when the slice needs inspection
- test commands run
- test results
- review verdict from the clean-context reviewer

## Commit Analysis Workflow

1. Identify the intended commit boundary.
2. List files that belong to the iteration.
3. List files that should stay out of the commit.
4. Summarize the behavioral or architectural change in one sentence.
5. Derive a short commit subject.
6. Prepare a brief body only if it adds real signal.

## Commit Message Style

Use concise scoped subjects such as:

- `test: add selection flow safety harness`
- `refactor: extract selection session`
- `refactor: split selection bridge adapters`
- `refactor: normalize selection state boundaries`
- `refactor: split rust database command internals`

Avoid:

- vague subjects like `updates` or `fix stuff`
- oversized multi-topic subjects
- subjects that describe effort instead of change

## Commit Template

Use the guidance in [references/commit-template.md](references/commit-template.md).

## When Performing The Commit

If the user explicitly approves the commit:

- stage only the files that belong to the iteration
- verify staged diff matches the intended slice
- create the commit with the prepared message
- report the final subject and the committed scope

If the user has not approved yet:

- stop after preparing the commit plan and message

## Output Shape

Return:

1. Proposed commit scope
2. Files included
3. Files intentionally excluded
4. Proposed commit message
5. Optional short body
6. Any risks or scope conflicts

If everything is clean, ask for confirmation before performing the commit.
