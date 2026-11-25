---
name: mission-new-sample
description: Bring a new drawing set/house sample into a drawing-reading app: read, overlay, project owner marks up, fix by a general rule, keep old samples intact, lock the result. Runs only when you type /mission-new-sample <short name>.
disable-model-invocation: true
---

# One new sample set

Argument: the **short name** of the sample set (`$ARGUMENTS`) — a job number (`12`, `10001`) or a nickname (`mau-a`), which is the first part of the file name in the samples folder.
**Never print, write or commit the full file name or the address** — only the short name. The privacy hook always blocks commits that contain an address; **file names in the samples folder** specifically are only blocked when `privacy.sampleDirs` or `samples.dir` is set — check this in step 1. Report briefly, in plain English.

## 0. If the app has its own skill, use that skill

The app has its own skill (`appSkills.newSample`) → that skill usually runs only by command (`disable-model-invocation`): **stop and remind the project owner to type `/<skill name> <arguments>`**, or read the app's `.claude/skills/<name>/SKILL.md` and follow each step in it exactly. Do not follow the kit's general version on your own when the app has its own.

## 1. Learn how the app does it

Read `.mission/config.json → samples` (if present) — each key is one of the app's commands:

| Key | Example | Used in step |
| --- | --- | --- |
| `dir` | `samples` | samples folder (the project owner copies samples in; Claude does not copy/move samples). The privacy hook reads this key by itself. |
| `readCmd` | `node tools/run-samples.js "samples/{file}"` | 2 |
| `overlayCmd` | `node tools/plan-overlay.js {name}` | 3 |
| `reviewCmd` | `npm run review -- {name}` | 3, 4 |
| `checkCmds` | `["npm test", "npm run check"]` | 5 |
| `expectedFile` | `tests/expected.json` | 6 |
| `historyFile` | `docs/history.md` | 2, 5 |

No `samples` block yet → look in `package.json`, `CLAUDE.md`, `tools/`; propose that block to the project owner (writing `.mission/config.json` needs their agreement). Also read the app's drawing-reading skill (e.g. `doc-ban-ve`) or the kit's `mission-drawing-check`, and `historyFile` (Grep for the exact case, do not read the whole file): most errors in a new set are cases already seen.

## 2. Read

Run `readCmd` for the new set. Look at **every check line**: floor area (compared with the figure written on the drawing), walls, windows/doors (compared with the symbols on the plan and the schedule), roof, levels, heights, site. A view that cannot be read → find the cause in the drawing itself (small view title, floor plans named by storey, a view frame cut by the view next to it).

## 3. Overlay on the drawing

Run `overlayCmd` and `reviewCmd`; open the result page in the app's browser (preview) and take a snapshot. Check the roof plan too: the roof edges and roof planes the reader builds must line up with the drawing.

## 4. The project owner marks up

Give the review page to the project owner to mark up (Wrong / Missing / Extra / Question / Correct). Read the marks, group them (walls, openings, roof, levels, site, fixtures). For each group, find the cause in the **drawing's vector data** around that point (colour, stroke, line type, fill area).

Fix the reader **with a rule about how drawings are drawn**, never with coordinates or names specific to this set.

## 5. Do not break old samples

After **every** fix: run all `checkCmds` on **every** sample. Another sample's numbers change → you must be able to explain it (a real reading error was just fixed) or undo it. Record the new case in `historyFile` under its own heading, with the figures.

## 6. Done

1. 3 experts (`/mission-review`), fix the findings, run everything again.
2. Rebuild the review page and the build; show the project owner the review page and the 3D.
3. Commit (the hook checks file names and addresses).
4. **Only when the project owner confirms** the reader is right (`expectedFile` should be in `protect.ask` so the hook asks) → add this set to `expectedFile` (area, levels, openings, roof) so that from now on `checkCmds` guards it.
