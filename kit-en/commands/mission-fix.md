---
description: Fix a bug (or a bug pattern) with the 10-step process, with a ledger entry and a project-wide sweep
argument-hint: "<ledger id L-xxxx | bug description | bug pattern name>"
---
(`$MISSION_KIT` is already set in the session and points to the kit; use it directly, do not go looking for the kit elsewhere.)
Use the **mission-defect-loop** skill for: $ARGUMENTS

If it is a ledger id: read the entry with `node "$MISSION_KIT/mission.mjs" ledger list`, then fix it. If it is a new description: locate it, write `ledger add … --why … --fix …` before fixing.
After fixing: `ledger close … --verify "<evidence>"`. If there is a `--pattern` or the bug is systemic: sweep the whole project, fix every place that matches, write an entry with `--category sweep`, add a rule to `lint.rules` (needs the user's agreement because it edits config) and to the style guide.
