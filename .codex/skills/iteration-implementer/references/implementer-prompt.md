# Implementer Prompt Template

```text
Implement one refactor iteration.

Context:
- Project: <project>
- Iteration: <iteration name>
- Goal: <goal>
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
- Run the required checks for the slice.
- If review feedback is included, treat only the blocking findings as required fixes.

Return exactly:
1. What changed
2. Files changed
3. Tests/checks run
4. Results
5. Remaining risks or open questions
```
