---
name: mission-repo-recon
description: Take stock of the repo before changing it (branch, uncommitted changes, instructions, build, the app's own skills/hooks, reusable parts) and build the manifest. ONLY use in a project that already has .mission/config.json.
---

# Repository inventory

Goal: know where the project **really** is before touching it. Do not assume file counts, completion percentages or quality.

## Checklist

1. **Location and Git** — `git rev-parse --show-toplevel`, `git branch --show-current`, `git log --oneline -10`, `git status --short`, `git stash list`, the remotes. Uncommitted changes → **leave them as they are**, write them down; do not stash/reset on anyone's behalf.
2. **Do not clone again** if the repo is already in the workspace. Do not create duplicate copies.
3. **Read all** the instructions: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING*`, `README*`, style guide, `docs/`. For long files, still read all the rules sections. Write the mandatory rules into `plan.md`.
4. **Build/CI system** — `package.json` scripts, Makefile, `tools/`, `scripts/`, `.github/workflows/*`. For each workflow: when it runs, whether it **releases/pushes** anything (mark it so it is not triggered by mistake). Add dangerous scripts to `protect.ask`/`bash.ask`.
5. **Existing assets** — code, rules data, sample projects, parts shared with other apps (PDF reading, 3D…), old QA reports, open defect lists, issues. Judge whether they can be reused (read real samples, do not just look at file names).
6. **Scope map** — declare `units` in config, then `node "$MISSION_KIT/mission.mjs" scan`. Compare the number of units with a manual count (`ls | wc -l`, number of items in a file…). Mismatch → fix the configuration, not the numbers.
7. **Status of each unit** — for each unit that has a product: estimate completion by something measurable (number of matching items, length ratio, tests passing), record it with `node "$MISSION_KIT/mission.mjs" unit set <id> --completion N --note "<how it was measured>"`.
8. **Baseline** — `node "$MISSION_KIT/mission.mjs" check --full`, `node "$MISSION_KIT/mission.mjs" lint --all --summary`. Write the results into `plan.md` under «Current state».

## Output

- `plan.md` section «Current state» fully filled in: branch/HEAD, what can be reused, what is missing/broken, risks.
- `manifest.json` updated.
- Ledger: one entry for each system problem found (`--category attention`, with `--fix`).
- `node "$MISSION_KIT/mission.mjs" report`.

Write down the app's own hooks/skills/agents (`.claude/`) and propose `appSkills` — the kit uses them instead of redoing the work.

Large repo: split the reading among `mission-explorer` subagents (Haiku, search/read only) by folder and take only their conclusions; still read the rules files yourself.
