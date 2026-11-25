---
name: mission-access-test
description: Write and run permission tests (who can NOT view/edit what) for an app with login, using only fake data. Use after changing access tables/functions/routes and before gate G5. If the app has its own skill, use that skill.
---

# Permission tests — proving what is NOT allowed

Hiding a button in the interface is not permission control. Real permission control lives on the **server side** (Supabase RLS, the data access layer, server functions, Cloudflare Access, private buckets). Tests must call exactly that layer.

## 0. If the app has its own skill, use that skill

Look for `.claude/skills/*access*` or `appSkills.accessTest` in `.mission/config.json` (e.g. `app-access-test`). Found → run that skill, stop here.

## 1. The permission table is the contract

- Take the **role × object × action** table from `.mission/plan.md` (the permissions section) or the app's docs. None yet → write a draft table and **ask the project owner to confirm** before writing tests (do not decide on your own who may see what).
- Minimum roles: not logged in · user A · user B (same role as A) · a higher role (manager/director) · customer (if the app has a customer portal). With two-step verification → split «manager who has not passed step 2» and «manager who has passed step 2».

| Object | Action | Not logged in | A (own) | A views B's | Manager | Customer |
| --- | --- | --- | --- | --- | --- | --- |
| example: evaluation record | read | refused | allowed | **cannot see** | allowed | refused |

## 2. Fake people and fake data

- Use only fake people (`SYN-A`, `SYN-B`, `Director-TEST`) and fake numbers, round and absurd (e.g. pay grade 50–100). Never use real names, real salaries, customer addresses.
- Use one shared setup function (`setup()`/fixture) for every test; extend it, do not build separate data in each file.

## 3. Each cell of the table = one test

- **Allowed** → succeeds (`ok`).
- **Not allowed** → fails with **exactly the error code** the app defines (`forbidden`, `unauthenticated`, `mfa_required`…).
- **Reading someone else's data** → `not_found` (does not reveal that the record exists), never returns the data, never returns a different error that reveals it exists.
- Users cannot change the status, owner or amount columns themselves — except through a named status-change function.
- **Files**: private bucket/R2; signed URLs that expire; customers cannot download original files (Revit/DWG/full PDF) by guessing the path.
- **Leaks**: responses, error messages, logs, exported PDF/CSV, and chart data for ordinary users do not contain confidential data or other people's data.
- **Integrity** (calling the database directly): a write pointing at someone else's parent record → the foreign key refuses it; immutable records cannot be edited/deleted.

## 4. Run and report

- Run the app's tests (`npm test` or the command in `checks.full`). Report the number passed/failed and the failed assertions, in plain English.
- **Never loosen** an access rule, trigger or foreign key to make a test pass. A refusal test that fails = **a security defect**: record a ledger entry at HIGH or above (`--category blocker` if data is exposed), fix it on the server side.
- Done → record the evidence for gate G5, then hand it to `mission-security-reviewer` for an independent review.
