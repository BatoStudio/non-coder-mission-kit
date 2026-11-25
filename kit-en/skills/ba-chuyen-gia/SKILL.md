---
name: ba-chuyen-gia
description: The project owner's "3 experts" step before calling a job done — three agents review independently in parallel, one area each, compare the working version with the committed version, and report bugs with how to reproduce and how to fix. Costs tokens — use only when the project owner explicitly says "3 experts"/"three experts"/"ba chuyên gia"/"critique"/"phản biện", types /mission-review, or before grading gate G8; for an ordinary phrase like "check it again", ask the project owner first.
---

# Three experts

## 0. If the app has its own version, use it

If the app folder has a `.claude/skills/ba-chuyen-gia/SKILL.md` that differs from this file, or `.mission/config.json` has `appSkills.review` pointing to another skill: **read and follow that skill**, skip everything below. The app's own version understands the app's engine, samples and privacy rules better.

## 1. Choose three areas

- If there is `.mission/config.json → threeExperts.areas` (not empty) → use exactly the three areas declared there (name, files/functions to review, common mistakes, commands allowed).
- If not → split them yourself from `git diff` and `CLAUDE.md` into three **non-overlapping** areas, following this pattern:
  1. **Core / logic** — the calculation, data reading and rules parts (engine, PDF reader, CDC rules…): rules triggered by mistake on data not meant for them, units, thresholds, regressions on real samples.
  2. **Data and edge cases** — unusual, missing or badly formatted input; wording that can be read differently; samples from other customers/building types; old data without the new fields.
  3. **User / consuming side** — interface, reports, file export, 3D, review pages, console errors, several screen sizes; and the real user's point of view (is it usable, is it worth using, is there a better way).
  Record the three chosen areas in the report, and propose adding them to `threeExperts.areas` so they can be reused next time.
- **Architecture question** — whether the three areas come from config or were split by you, the **first** expert must always also answer: «Is there a **simpler** way to get the same result?» (fewer files, fewer layers, fewer libraries, no database/login/external service before it is needed; which parts are being built before there is a real need). Answer in a separate section `SIMPLER:` — if there is a proposal, state how to do it and what is gained/lost; if not, write «no simpler way found» with a short reason.

## 2. Hand out the work

**Scope = the work just done, do not re-read the whole project**. Before starting the agents, run `git diff --stat` + `git status --short`, and sort the changed files into the three areas.

Start **three agents in the same turn** (Agent tool, `general-purpose`, running in the background, model `sonnet`; for **hard** jobs — the diff is in shared core code, business/compliance rules, security, or many files changed — use `opus` and tell the project owner in one line), one area per agent, then wait for all three reports. Each agent's brief contains: the **list of changed files** in that area, the command to view the diff (`git diff HEAD -- <files>`; for new files, read them directly), and one line saying what the change is meant to do; **do not** say what you guess they will find. The agent reads the diff first, then reads only the changed functions and their direct callers (Grep by name), not whole files, not the whole project. For an area with no changed files: the agent reviews only indirect effects (who calls the changed parts) and writes «no changed files in this area» if there is nothing — it does not read anything more on its own.

Every brief includes the following rules word for word:
- Do NOT edit any project file. Scratch scripts go only in a temporary folder of your own (`mktemp -d`, named rev1 / rev2 / rev3).
- Never print or write house addresses, customer/homeowner names, emails, phone numbers or sample file names — use only the samples' short codes.
- Do not read the whole `CLAUDE.md` or history documents: only Grep the sections related to the changed functions/samples. Compare the committed version (`git archive HEAD <folder> | tar -x -C <temporary folder>`) with the working version on the samples/test cases **that the change can affect** (diff is in shared code → run all of them); do not write into the project's results folder.
- If a command prints many lines, print only the differing/failing lines (`| tail -30`, grep DIFF/FAIL), not the whole list.
- Commands allowed: <list the app's test/check commands — taken from `threeExperts.areas[].commands`, `checks.full` or `CLAUDE.md`>. No commit, no push, no deploy.
- Short report (at most ~10 lines), ranked: file:line — what is wrong — a concrete failure scenario (ideally reproduced by changing data in memory) — how to fix. Write only findings that are verified or that you are confident about; for things checked and found fine, write «no problem».
- For any part of your area you **could not check** (a command would not run, missing samples, missing permissions, a page would not open…), write clearly `EVIDENCE MISSING: <which part> — <why>`. Do not silently skip it, do not conclude «probably fine» from what the builder said.
- The last line is **one of three**:
  - `VERDICT: PASS` — no bugs left and no EVIDENCE MISSING items.
  - `VERDICT: PASS WITH FIXES (<n> minor issues)` — 0 CRITICAL/HIGH, only MEDIUM/LOW bugs left; list each bug with how to fix it.
  - `VERDICT: FAIL (…)` — there is a CRITICAL/HIGH, **or** there is an EVIDENCE MISSING item in an important part (law, customer data, permissions, main calculations).

Three agents by default (narrow the reading scope, not the number of agents). Very small change (one line, text only) → the project owner may allow one agent; do not reduce it on your own without being told.

## 3. After all three reports are in

1. Report to the project owner in plain English, a few lines, **most important first**: what each expert found, each one's verdict, EVIDENCE MISSING items (if any) and the first expert's `SIMPLER` proposal. The simpler proposal is for the project owner to decide, do not act on it yourself.
2. Re-check each finding with evidence; if it is right, fix it; if it is wrong, record why it was rejected.
3. Re-run the **full** test suite, then commit.
4. List what has **not been fixed** and why.
5. If there were significant fixes → have the relevant expert review **the fixed part** again (at most 3 rounds; beyond that, let the project owner decide).

## 4. If the app uses the Mission Kit (`.mission/` exists)

- Record each valid finding in the ledger: `node "$MISSION_KIT/mission.mjs" ledger add --severity … --why … --fix … --unit …`.
- Save the three reports word for word to `.mission/reviews/<unit>-3cg-<date>-<1|2|3>.md`.
- Minor bugs in `PASS WITH FIXES` must also go into the ledger (level medium/low) — fix them now or leave them with a reason; they must not exist only in the report.
- When all three are `VERDICT: PASS` or `PASS WITH FIXES` (and the minor bugs are in the ledger), record the independent gate. The tool rejects a report whose final verdict line contains `FAIL` or `EVIDENCE MISSING`:
  `node "$MISSION_KIT/mission.mjs" gate set <unit> G8 PASS --by agent:ba-chuyen-gia --report .mission/reviews/<last expert's file>.md --evidence "3/3 PASS, round <n>"`
