---
name: structured-commit
description: Prepare a clean, scoped git commit from the current repo changes. Use when the user wants help analyzing what changed, grouping files into a coherent commit, generating a short commit message, and optionally performing the commit after approval.
---

# Structured Commit

Use this skill when the user wants a disciplined commit step after an iteration or wants help turning a messy diff into a coherent commit.

When `iteration-implementer` reaches an accepted slice, this is the default next handoff.

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
- For accepted iteration slices, always prepare the commit handoff even if the user has not yet approved the actual `git commit`.

## Inputs To Gather

- `git status --short`
- `git diff --stat`
- `git diff -- <relevant files>` when the slice needs inspection
- test commands run
- test results
- review verdict from the clean-context reviewer

## Workflow

1. Identify the intended commit boundary.
2. List included files.
3. List intentionally excluded files.
4. Summarize the change in one sentence.
5. Propose a short subject.
6. Add a body only if it adds signal.
7. Stop for user approval before committing.

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
- close any commit sub-agent after the commit result or commit plan has been handed back to the main agent

If the user has not approved yet:

- stop after preparing the commit plan and message
- if this handoff came from an accepted refactor iteration, ask for commit approval before asking to start the next iteration

## Output Shape

Return:

1. Proposed commit scope
2. Files included
3. Files intentionally excluded
4. Proposed commit message
5. Optional short body
6. Any risks or scope conflicts

If everything is clean, ask for confirmation before performing the commit.
