---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present them as a report, then grill through whichever one the user picks.
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

Use this skill when the user wants architecture review or refactor candidates.
Prefer it for explicit architecture audits or refactor-candidate surveys.

Do not use it for:

- tiny bug fixes
- style cleanups
- broad design debate with no code target
- ordinary architecture questions that can be answered directly

## Process

### 1. Explore

Scope before scanning:

- If the user named a direction — a module, a subsystem, a pain point — take it, and skip the inference below.
- Otherwise, walk back a good stretch of the commit history (`git log --oneline`) to find the codebase's hot spots — the files and areas that keep coming up — and let those paths pull your attention first. If the changes are scattered with no clear hot spot, widen the net.

Read `CONTEXT.md` and `docs/adr/` only if they exist and are relevant.

Then inspect the chosen area and note:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow.

### 2. Present candidates as an HTML report

Present candidates as a report. Use HTML in the temp directory only when visuals will help. Otherwise return concise markdown.

For each candidate, render a card with:

- **Files** — which files/modules are involved
- **Problem** — why the current architecture is causing friction
- **Solution** — plain English description of what would change
- **Benefits** — explained in terms of locality and leverage, and how tests would improve
- **Before / After diagram** — side-by-side, custom-drawn, illustrating the shallowness and the deepening
- **Recommendation strength** — one of `Strong`, `Worth exploring`, `Speculative`, rendered as a badge

End the report with a **Top recommendation** section: which candidate you'd tackle first and why.

If `CONTEXT.md` exists, use its domain terms. If ADRs exist, mention only real conflicts worth reopening.

Do NOT propose interfaces yet. After the report is ready, ask the user: "Which of these would you like to explore?"

### 3. Grilling loop

Once the user picks a candidate, use `grilling` to walk the constraints and decisions.
