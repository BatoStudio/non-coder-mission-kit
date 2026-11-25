---
name: mission-run
description: Coordinates the Mission Kit process (spec → work in batches → bug review → 3 experts → verification → handover). Use ONLY when the project folder already has .mission/config.json, or when the user types a /mission-* command. Never creates .mission/ on its own.
---

# Mission Run — coordination

CLI: `node "$MISSION_KIT/mission.mjs"` — always write it in full, with double quotes (each call is a new shell; the path has spaces). Call it with the **Bash** tool (Git Bash). If only PowerShell is available: `node "$env:MISSION_KIT/mission.mjs" …`. State lives in `.mission/`:

| File | Role | Who writes it |
| --- | --- | --- |
| `brief.md` | Original brief | project owner |
| `config.json` | Scope, no-edit zones, check commands, gates, `appSkills` | `/mission-init` (changes need agreement) |
| `plan.md` | Spec, NOW/NEXT/LATER, decisions, assumptions | Claude |
| `manifest.json` | List of units | `scan`, `unit set` |
| `ledger.jsonl` | ISSUE ledger (bugs/notes) | only `ledger` |
| `gates.json`, `reviews/` | Gates + review reports | only `gate` |
| `progress.md`, `ledger.md`, `gates.md`, `checks.md` | Reports | `report`, `check` |
| `HANDOVER.md`, `HTC.md`, `LT.md` | Session handover, current conventions, location lookup table | Claude (skill `mission-handover`) |

## Principles

1. **Truth first.** Numbers come from the CLI and check commands. Do not say «done», «passed», «tested» without evidence.
2. **The app's own skills/hooks win.** Read `appSkills` in the config: `review` (e.g. `ba-chuyen-gia`), `verify`, `deploy` (e.g. `ship`), `drawings`… If they exist, use the app's skill; the kit's skill is only a fallback. Do not re-declare what the app's own hooks already do.
3. **3 experts.** Builder (Claude, reviews its own work twice) → checker → evaluator. The builder does not grade independent gates itself. By default 1 subagent per review, at most 3 rounds (`review`).
4. **One source of truth.** Do not duplicate data that would have to be edited in two places.
5. **Privacy.** Do not write addresses, customer names, sample file names into the ledger, gates, reports, commits — use short codes. The CLI blocks house addresses and the app's blocklist.
6. **Do not break things.** Do not edit `protect.deny`; do not force-push; do not merge PRs; do not deploy/change databases without agreement. Git follows `git.mode`: `local-main` = commit straight to the main branch on the machine, pushing needs asking; `branch-pr` = separate branch + PR. Hooks block things — do not look for ways around them; if needed, stop and ask.
7. **Every bug comes with a suggested fix** (`--fix`). Distinguish **bugs** from **notes** (`--category attention`).
8. **Fix the root cause.** A bug repeated ≥2 times → `--pattern`, sweep the whole project, add a lint rule/test case.
9. **Save tokens.** Work in batches; `check --full` and snapshots at **milestones** (end of batch, before commit), not after every small fix; do not re-read large files — edit exactly the part needed; subagents only when worth it. The start-of-session context is already loaded (HANDOVER, HTC, active ledger) — start from there, look things up in `LT.md`/manifest with grep; at the end of a batch use the `mission-handover` skill.
10. **Important data (`protect.important`: samples/, out/golden/, tests/pdf-library*/, .mission/ledger.jsonl, build/backup/ — the app can change this list).** Deleting/overwriting/moving them, `git clean`, `robocopy /MIR` all make the hook ASK — stop and ask the project owner, do not look for ways around it.
    - **Do not use junctions/symlinks to share data** (samples, out/golden, node_modules…) between temporary folders, worktrees and the real app. Use **copying** (`cp -r`, `robocopy` without `/MIR`). Cleaning up a temporary folder can go through a junction and wipe out the real data.
    - **Remove junctions/symlinks only with the unlink command**: `cmd //c rmdir "<link>"` (PowerShell: `cmd /c rmdir "<link>"`) — NOT `/s`, NOT `rm -r`, NOT `Remove-Item -Recurse`. If you see a link in a folder about to be deleted: remove the link first, then delete the rest.
11. **Advisor (Fable).** The app runs on Sonnet; Fable is the advisor, not the worker.
    - Fixing **one bug that has failed twice** → **STOP**, ask the advisor to find the root cause before fixing further. Do not try a third time out of habit.
    - **Before a big feature or a change across many files** → ask the advisor to assess the plan (state the job, the files touched, the risks) before doing it.
    - **Write a ledger entry each time you ask:** `node "$MISSION_KIT/mission.mjs" ledger add --severity LOW --category attention --source advisor --why "Asked advisor: <topic, unit id>" --fix "<conclusion/root cause the advisor gave>"`. After applying the advice, close it: `ledger close <id> --verify "<what it was checked with>"` (this entry is only LOW/note, it does not block `done`).
    - The start-of-session hook reminds you if there is no `advisorModel` yet (type `/advisor fable`).

## Phases

Run continuously, without asking for confirmation between phases. Stop only when a project owner decision is needed where a wrong guess would be costly/irreversible — record `ledger add --category blocker`, put it under «Open questions» (WAITING), and carry on with other work.

1. **Start** — `status`. No `.mission/` yet → remind the user to type `/mission-init` (do not create it yourself).
2. **Spec** — `mission-app-spec`.
3. **Inventory** — `mission-repo-recon`; `scan`.
4. **Rules & samples** — if the app follows laws/drawings: `mission-rules-engine`, the app's drawing-reading skill (or `mission-drawing-check`). A new set of drawings/house samples → remind the project owner to type `/mission-new-sample <short name>` (the skill only runs by command).
   **Data** — schema changes: `mission-db-migration`; new tables/access functions/routes in an app with login: `mission-access-test`.
5. **Work in batches** (the rhythm below).
6. **Bug review** — `mission-defect-loop`; CRITICAL → HIGH first.
7. **Gates** — `mission-quality-gates`.
8. **Milestone testing** — `appSkills.verify` or `mission-web-qa`.
9. **Regression** — `mission-regression` before a big commit.
10. **Deploy** — only when the user types `/mission-deploy`. Before publishing/sharing/sending out: `/mission-privacy` (agent `mission-privacy-auditor`). If the project owner wants ChatGPT to review → remind the project owner to type `/mission-handoff <unit> <round>` (the skill only runs by command).
11. **Handover** — `done` must print ĐẠT (met); `/mission-pr` only in `branch-pr` mode.

## Rhythm of one batch

```
pick NOW work → do it → post-edit hook reports an error, fix it right away → self-review 2 times
→ ledger (with --fix) → check --full (milestone) → 1 subagent reviews → fix (≤3 rounds)
→ gate set … → report → commit (state unit + ledger id) → update NOW/NEXT/LATER
```

## Reporting to the project owner

Short, in plain English, tables where they fit: done · needs a decision · stuck. Do not retell the process.

## Finishing

At the end of each batch and before stopping the session: the `mission-handover` skill (overwrite HANDOVER, close ledger entries, update HTC/LT).

The stop hook (`stopGate.mode`: by default only reminds) reports when checks are stale. Declare completion only when `done` prints **ĐẠT Definition of Done** (Definition of Done met); if not, list exactly the conditions still missing.
