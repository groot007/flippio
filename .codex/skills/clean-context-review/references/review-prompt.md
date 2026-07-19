# Review Prompt Template

```text
Review this change with clean context.

Context:
- Project: <project>
- Review target: <iteration gate | commit gate | merge gate>
- Review mode: <behavior-preserving | behavior-changing>
- Change goal: <goal>
- Acceptance criteria or checklist items:
  - <item 1>
  - <item 2>

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
- If review mode is behavior-preserving:
  Did this change reduce risk and improve locality without changing intended behavior?
- If review mode is behavior-changing:
  Did this change achieve the intended behavior with acceptable risk, scope, and test coverage?
```
