---
description: Grade the quality gate for one unit with 3 experts (default skill ba-chuyen-gia; "quick" or "nhanh" = 1 subagent)
argument-hint: "<unit id> [quick|full] (quick = nhanh)"
---
(`$MISSION_KIT` is already set in the session and points to the kit; use it directly, do not go looking for the kit elsewhere.)
Use the **mission-quality-gates** skill for: $ARGUMENTS (see ids with `node "$MISSION_KIT/mission.mjs" gate show`).

1. Default (`appSkills.review` = `ba-chuyen-gia`) → run the `ba-chuyen-gia` skill (3 experts in parallel; automatically uses the app's own version if there is one).
2. Contains the word `quick` (or `nhanh`) (the project owner has allowed 1 expert for small jobs) → the builder reviews its own work twice; then 1 `mission-checker` subagent. An empty `appSkills.review` does **not** automatically drop to 1 — still run 3 experts with `mission-checker`, `mission-evaluator` and one specialist subagent, unless the project owner allows it. `full` = like the default, but one of the three areas is a risk specialty (law / security / interface).
3. Re-check each finding; write it to the ledger (with `--fix`); fix it; re-review the fixed part. At most 3 rounds; beyond that, record a `blocker`.
4. Save the subagent reports to `.mission/reviews/`, `gate set` with `--evidence` (independent gates with `--report`), `gate show`, `report`. Report briefly in plain English.
