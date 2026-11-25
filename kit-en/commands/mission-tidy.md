---
description: Tidy the code — measure duplicated code, clashing names (conflicts), long files/functions; 3 experts make a plan; work in small batches that do not change how the app runs; compare before/after
argument-hint: "[measure | plan | do <batch> | finish] (or đo | kế hoạch | làm <lô> | kết thúc)"
---
(`$MISSION_KIT` is already set in the session and points to the kit; use it directly, do not go looking for the kit elsewhere.)
Use the **mission-tidy** skill for: $ARGUMENTS

Accept either the English or the Vietnamese word:

- No argument, or `measure` (or `đo`) → steps 0 and 1 (conditions + measure before), report the result, stop.
- `plan` (or `kế hoạch`) → step 2: three experts make proposals, merged into a table of batches, **wait for the project owner to approve**.
- `do <batch>` (or `làm <lô>`) (e.g. `do 1`, `do 1-3`, `do all` — or `làm 1`, `làm 1-3`, `làm hết`) → step 3 for the batches approved in `.mission/plan.md`. If a batch is not approved yet, ask.
- `finish` (or `kết thúc`) → step 4: measure after, compare, three experts review the whole diff, report.

No push, no deploy. Do not update the regression baseline while tidying code.
