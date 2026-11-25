---
name: mission-regression
description: Regression check before committing in a Mission Kit project (diff, protected areas, check --full, ledger). ONLY use in a project that already has .mission/config.json or when you type /mission-verify.
---

# Regression check

Run in order; if a step is red, stop, fix, and run again from the start.

1. **Read the diff** — `git diff --stat`, then `git diff` file by file. Every change must be explainable by a ledger entry or a task in the plan. Unexpected change → undo it deliberately (ask if it is not yours).
2. **Protected areas untouched** — `git diff --name-only <base>... | grep -E '<glob protect.deny>'` must be empty. (The hook already blocks edits; this step catches changes that come from scripts.)
3. **Nothing touched by mistake** — do generated files, lockfiles, images, statistics have unexpected changes? Check `git status` for strange files.
4. **Full check** — `node "$MISSION_KIT/mission.mjs" check --full` must be GREEN (the CLI prints «XANH») (steps with `severity: warning` may be yellow but must be read).
5. **Links/cross-references** — if the project has a link/anchor check, it must be in `checks.full`; if not, run it by hand and suggest adding it.
6. **Consistency** — `node "$MISSION_KIT/mission.mjs" lint --all --summary`; compare the figures with last time (more errors = regression).
7. **Build the product** — rebuild the deliverable if its source changed; run the validator.
8. **Update the ledger** — close the ledger entries that were fixed (`--verify`), `node "$MISSION_KIT/mission.mjs" scan` if units changed, `node "$MISSION_KIT/mission.mjs" report`.
9. **Commit** — only the verified part, with a message naming the unit + ledger ids. No blind `git add -A`: look at `git status` again first.

Write a summary of the results (commands, GREEN/RED, key figures) into the commit body or `plan.md` so the PR has evidence.
