# Implementer Prompt Template

```text
Implement one bounded plan slice.

Context:
- Project: <project>
- Slice: <slice name or plan item label>
- Goal: <goal if needed>
- Active plan file: <plan path>
- Checklist items for this slice:
  - <item 1>
  - <item 2>
- Allowed files/modules:
  - <path 1>
  - <path 2>
- Out of scope:
  - <path or concern 1>
  - <path or concern 2>

Execution rules:
- This is one slice only. Do not widen the scope.
- You are not alone in the codebase. Do not revert unrelated changes.
- Prefer the smallest change that satisfies the checklist items.
- Treat the active plan checklist as the scope contract.
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
