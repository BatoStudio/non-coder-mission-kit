---
name: mission-web-qa
description: Test a web app at milestones (web-smoke at 3 screen sizes, console errors, interaction scripts, permissions, file export). ONLY use in a project that already has .mission/config.json; if the app has its own testing skill (appSkills.verify), use that skill.
---

# Testing a web app

If `appSkills.verify` has a value (e.g. `verify`, `ship` in check mode), use that app skill first; what follows is an addition/fallback.

Test **at milestones** (after a batch of changes), not after every small fix — this saves time and cost. The `post-edit-check` hook already takes care of a quick check per file.

## 1. Automatic test run

```bash
node "$MISSION_KIT/tools/web-smoke.mjs" index.html                    # 390 / 820 / 1440 px
node "$MISSION_KIT/tools/web-smoke.mjs" index.html --dark             # chế độ tối (nếu app hỗ trợ)
node "$MISSION_KIT/tools/web-smoke.mjs" http://localhost:5173 --script tests/smoke/mo-du-an.mjs
```

Reports RED when there is a JavaScript error, `console.error`, a resource that failed to load, or horizontal overflow. Snapshots are saved in `.mission/shots/`.

An interaction script (`--script`) is a file `export default async (page) => { … }` — it simulates a main flow: open a sample project, import a PDF, click check, export a report. Each main flow in the Definition of Done should have a script, and it should be in `checks.full`.

## 2. What to check at each milestone

| Item | How to check |
| --- | --- |
| Main flow runs to the end | `--script` script |
| No console errors | web-smoke |
| 3 screen sizes, text not cut off, buttons tappable on a phone | snapshots → subagent `mission-visual-qa` |
| Sample data gives correct results | compare with `tests/expected/` |
| Exported files (PDF/PNG/CSV/DXF) open and have the right content | open the exported file, read it back |
| Saving and reopening data (localStorage, Supabase) loses nothing | script: save → reload page → check |
| Permissions: a customer account cannot see/download original files | a test account for each role → subagent `mission-security-reviewer` |
| Offline / slow network (if the app needs it) | Playwright `context.setOffline(true)` in the script |
| Vietnamese (non-English) text / measurement symbols (m², °) display correctly | snapshots |

## 3. Single-HTML-file app

- Keep everything in one file if that is the project's decision; do not split files without agreement.
- Outside libraries (CDN) must have pinned versions; check that the app still runs when opened via `file://` if users open it directly.
- Backup: before a big change, commit to Git; if the project has a zip backup rule (e.g. `build/backup/`), follow it exactly in the place the project specifies.

## 4. Report

Short, in plain English: which flows ran, which errors remain, which snapshots the project owner needs to look at. Only say «tried on X» for browsers/devices that actually ran.
