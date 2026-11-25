---
description: Report the real progress of the mission (from the manifest, ledger, gates, check results)
---
(`$MISSION_KIT` is already set in the session and points to the kit; use it directly, do not go looking for the kit elsewhere.)
Run `node "$MISSION_KIT/mission.mjs" status`, `node "$MISSION_KIT/mission.mjs" gate show` and `node "$MISSION_KIT/mission.mjs" report`.
Report briefly in plain English, as a table where it fits: scope and coverage, bugs by level (open/closed), repeated bug patterns, quality gates, delivered products, latest check, blockers, next work (taken from `.mission/plan.md`).
Use only numbers printed by the CLI; do not estimate. State clearly what could not be checked.
