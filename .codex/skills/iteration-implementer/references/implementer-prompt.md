# Implementer Prompt Template

```text
Implement one refactor iteration.

Context:
- Project: <project>
- Iteration: <iteration name>
- Goal: <goal>
- Active plan file: <plan path>
- Acceptance criteria:
  - <criterion 1>
  - <criterion 2>
  - <criterion 3>
- Allowed files/modules:
  - <path 1>
  - <path 2>
- Out of scope:
  - <path or concern 1>
  - <path or concern 2>

Execution rules:
- This is one iteration only. Do not widen the scope.
- You are not alone in the codebase. Do not revert unrelated changes.
- Prefer the smallest change that satisfies the acceptance criteria.
- Treat the active plan checklist as the scope contract for this iteration.
- Run the required checks for the slice.
- Do not leave required checks for the orchestrator unless a command is blocked or unavailable.
- If review feedback is included, treat only the blocking findings as required fixes.

Return exactly:
1. What changed
2. Files changed
3. Tests/checks run
4. Results
5. Checklist items now complete
6. Checklist items still incomplete or unproven
7. Remaining risks or open questions
8. Whether the slice is ready for clean-context review
```
