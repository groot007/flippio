# Review Prompt Template

```text
Review this refactor iteration with clean context.

Context:
- Project: <project>
- Iteration: <iteration name>
- Goal: <goal>
- Acceptance criteria:
  - <criterion 1>
  - <criterion 2>
  - <criterion 3>

Inputs:
- Changed files
- Diff for this iteration
- Test commands run
- Test results

Review instructions:
- Review as a skeptical engineer with no prior implementation context.
- Prioritize findings about:
  - behavioral regressions
  - missing or weak tests
  - architectural backsliding
  - coupling that remains or was introduced
  - API or contract drift
  - changes that are larger than the iteration goal
- Do not praise the code.
- Do not summarize first.
- List findings first, ordered by severity, with file references.
- Then list open questions or assumptions.
- Then give a final verdict:
  - acceptable
  - acceptable with follow-ups
  - not acceptable

Key question:
Did this iteration reduce risk and improve locality without changing intended behavior?
```

## Bias Add-Ons By Iteration

### Iteration 1

Add:

```text
Pay special attention to whether the new tests validate user behavior and contracts rather than implementation details such as hook ordering, internal state shape, or effect timing.
```

### Iteration 2

Add:

```text
Pay special attention to whether selection transition policy is now concentrated in one seam, and whether AppHeader is materially simpler in responsibility rather than only smaller.
```

### Bridge Refactors

Add:

```text
Pay special attention to contract drift between callers, adapter methods, and backend command expectations.
```

### Rust Refactors

Add:

```text
Pay special attention to connection ownership clarity, stale-state risks, and whether the new module shape actually reduces blast radius.
```
