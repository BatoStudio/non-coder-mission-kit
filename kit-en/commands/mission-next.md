---
description: Do the next highest-priority batch of work, continuing until finished or until the project owner needs to decide something
argument-hint: "[maximum number of batches — empty = keep going]"
---
(`$MISSION_KIT` is already set in the session and points to the kit; use it directly, do not go looking for the kit elsewhere.)
Use the **mission-run** skill. Read `node "$MISSION_KIT/mission.mjs" status`, `ledger list --open`, `gate show` and the NOW/NEXT sections in `.mission/plan.md`.

Priority order: (1) open CRITICAL bugs → (2) open HIGH → (3) NOW work that is ACTIVE → (4) repeated bug patterns not yet swept → (5) units without a product yet → (6) units with a FAIL/unreviewed gate → (7) NEXT → (8) MEDIUM/LOW → (9) handover. If the app has its own skill for the current job (`appSkills`), use that skill.

Work in batches, with visual testing at the end of each batch (not after every small fix). Batch limit: $ARGUMENTS. Before stopping: update NOW/NEXT/LATER and the ACTIVE/WAITING/BLOCKED/DONE statuses in the plan, run `report`, report briefly: done · needs a decision · stuck.

**Long chain of batches, nothing for the project owner to decide yet:** at the end of the report, give **one ready line** of `/goal` for the project owner to paste if they want Claude to keep going on its own over many turns. The condition must be checkable and bounded, for example: `/goal mission.mjs done prints «ĐẠT Definition of Done» (Definition of Done met) and no CRITICAL/HIGH bugs are open, or stop after 20 turns, or when the project owner needs to decide`. Only the project owner can type `/goal` (Claude does not set it itself); `/goal clear` turns it off. The `/goal` judge only sees what is printed in the conversation, so while a goal is active, the end of each batch must print the real `done`/`status` result — do not summarise «passed» without running it. `/goal` does not change permissions: the hooks and the ALWAYS ASK list still apply as before.
