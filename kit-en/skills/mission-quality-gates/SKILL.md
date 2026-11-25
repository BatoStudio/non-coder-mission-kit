---
name: mission-quality-gates
description: Score quality gates through 3 experts, with evidence. ONLY use in a project that already has .mission/config.json or when you type /mission-review; if the app has its own review skill (appSkills.review, e.g. ba-chuyen-gia), use that skill.
---

# Quality gates — 3 experts

Gates are declared in `.mission/config.json → gates` (a group of units may use only some of them via `units[].gates`). A unit **PASSES** only when: every one of its gates is PASS/NA and **not older than the last change**, no CRITICAL/HIGH defects are still open, and there is a product. The CLI works this out — do not declare it yourself.

## 0. By default, use the skill `ba-chuyen-gia`

`appSkills.review` defaults to `ba-chuyen-gia` (3 agents in parallel, each with their own area). That skill hands over to the app's own version by itself if there is one. Run it, save the reports in `.mission/reviews/`, then record the gates (step 5). What follows is a lighter way (1 subagent) for when the project owner wants to save cost or sets `appSkills.review` to empty.

## Default gate set for an app

| Gate | What it checks | Who |
| --- | --- | --- |
| G1 Meets the brief | All DoD items in the plan | builder → checker |
| G2 Follows the rules, with sources | Clauses in force, correct thresholds, correct scope | `mission-rules-checker` |
| G3 Real projects | Real samples match the expected results | checker (runs the tests) |
| G4 Interface | 3 screen sizes | `mission-visual-qa` |
| G5 Permissions & security | Customers cannot see original files; no secrets exposed; no customer information exposed | `mission-security-reviewer` + `mission-privacy-auditor`; app with login: `mission-access-test` tests green |
| G6 One source of truth | No duplicate data that must be edited in two places | checker |
| G7 Technical | No console errors, build/tests green | `web-smoke`, tests |
| G8 Independent challenge | No blocking findings left | subagent, with a report file |

## Process for one unit (saves tokens)

1. **The builder reviews their own work twice** (the second time reading it as if someone else wrote it). Defects → `mission-defect-loop`.
2. **Record the self-review gates** with specific evidence:
   ```bash
   node "$MISSION_KIT/mission.mjs" gate set feature:kiem-tra G3 PASS --by main --evidence "npm test: 12/12 mẫu khớp expected"
   ```
   Does not apply → `NA` + reason. Fails → `FAIL` + ledger id.
3. **Independent review = 3 experts** (skill `ba-chuyen-gia`: 3 subagents in parallel, each with their own area, the person who did the work does not score it). Small, low-risk work: `/mission-review <unit> quick` (or `nhanh`) = 1 subagent `mission-checker` — accept either word. High-risk units (rules, payroll data, access permissions, deploying): one of the three areas is that specialty (`mission-rules-checker`, `mission-security-reviewer`, `mission-visual-qa`). The prompt contains only: the plan path, related files, samples, commands, criteria — **do not** pass on your own conclusions.
4. **Handle findings** — check again against the evidence; correct → ledger (with `--fix`) + fix; wrong → record the reason for rejecting it. Anything fixed → review **the fixed part** again. **At most `review.maxRounds` rounds (default 3)**; past that number with problems still left → record `ledger add --category blocker` for the project owner to decide, do not keep looping.
5. **Save the subagent's report word for word** into `.mission/reviews/<unit>-<gate>-<date>.md` (replace with a short code if the report happens to contain customer names/addresses), then record the independent gate:
   ```bash
   node "$MISSION_KIT/mission.mjs" gate set feature:kiem-tra G8 PASS --by agent:ba-chuyen-gia \
     --report .mission/reviews/feature-kiem-tra-G8-2026-11-08.md --evidence "vòng 2: 0 CRITICAL/HIGH"
   ```
   The CLI refuses if the final verdict line is not «VERDICT: … PASS» (it also accepts «PASS WITH FIXES»; the Vietnamese «KẾT LUẬN: …» form is accepted too), or if the word FAIL or «EVIDENCE MISSING» is still there. This is still a trust-based convention (the main agent writes the file), but it leaves an audit trail.
6. `gate show feature:kiem-tra` → must be PASS. Editing code after that makes the gate **STALE** — score the affected part again. Then `report`.

Scores are secondary; do not mark PASS to make the statistics look good.
