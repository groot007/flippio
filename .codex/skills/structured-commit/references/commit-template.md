# Commit Template

## Commit Analysis Template

```text
Commit scope:
- <one-sentence description of the iteration>

Files included:
- <file 1>
- <file 2>

Files excluded:
- <file 3>
- <file 4>

Reason for exclusion:
- <why excluded files should stay out of this commit>

Tests run:
- <command>: <result>
- <command>: <result>

Review verdict:
- <acceptable | acceptable with follow-ups | not acceptable>

Proposed commit subject:
- <type: short subject>

Optional body:
- <bullet 1>
- <bullet 2>
```

## Subject Rules

- keep it under about 72 characters when practical
- start with a type prefix when it helps: `test:`, `refactor:`, `fix:`, `docs:`
- describe the actual change, not the effort
- prefer one architectural seam per commit

## Body Rules

Add a body only when it clarifies:

- what seam changed
- what tests were run
- whether the slice was reviewed and approved

Example:

```text
refactor: extract selection session

- move selection transition policy out of AppHeader
- keep stores focused on state and hooks on data access
- verified with renderer tests and clean-context review
```
