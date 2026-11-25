---
name: mission-db-migration
description: Change the database structure (Supabase, D1, SQLite) add-only, one file per change, tried on an empty copy, with a way back. Use whenever the schema changes. If the app has its own skill, use that skill.
---

# Add-only migrations, no data loss

Real data that is lost cannot be recovered. Every schema change goes through a migration file, is tried on an empty copy first, and only the project owner decides to apply it to the real database.

## 0. If the app has its own skill, use that skill

`.claude/skills/*migration*` or `appSkills.migration` in `.mission/config.json` (e.g. `app-migration`) → run that skill, stop here.

## 1. Before writing

- Read the app's data design (`.mission/plan.md`, `docs/`) and the existing migrations so you follow exactly the naming conventions, id type, date-time type.
- Where does confidential data (salaries, contracts, customer information) live? If there are two stores (normal/confidential), put it in the right one; **in doubt → the confidential store**.
- If it is unclear, ask the project owner; do not invent tables holding sensitive data on your own.

## 2. Rules

- **Add only.** No `DROP TABLE/COLUMN/VIEW/INDEX`, no `DELETE FROM`, no `TRUNCATE`, no renaming or narrowing columns on tables that already have data. Change data by **replacement with history** (a new row + `supersedes_id`, `is_current`).
- The only exceptions: replacing trigger code (`DROP TRIGGER` + `CREATE TRIGGER`), and rebuilding a table that copies every row **with a test that proves it**. Any other destructive work: **stop and ask the project owner**.
- **One file per change**, the next number in the migrations folder (`NNNN_ten_ngan.sql` or exactly the app's convention). Never edit a migration already applied to a shared environment; write a new file.
- Constraints live in the database, not only in the code: `NOT NULL`, `CHECK` for enumerated values and dates, foreign keys (a double foreign key with the same owner when a child record must belong to the same person as the parent record), triggers that block editing/deleting immutable records.
- **Money**: integer in the smallest unit + a currency column. Do not use floating-point numbers.
- **Permissions** (Supabase): enable and force RLS for every new table; a policy for each role; do not grant `anon`/`authenticated` access to the confidential area. (D1/SQLite have no RLS: permissions live in the data access layer — add the matching access function.)
- Logging triggers (audit / op-context) record only key columns and status — **never** money amounts, pay grades, notes, answers, contact details.
- Do not hard-code people, grades, weights, results into migrations; shared seed data must be clearly marked as seed data.

## 3. Try it

1. Apply **all** migrations from the start onto an empty copy (in-memory SQLite, **local** `supabase db reset`, D1 `--local`). **Never run it on the real server** — only when the project owner says «yes». The hook asks before `supabase db push/reset`, `wrangler d1 migrations apply` without `--local`, `d1 execute --remote`; but it can **not** see inside `npm run …`: read the `db:*` scripts in `package.json` before running them, do not run any script that applies to the real server, and suggest adding it to `bash.ask` (e.g. `"npm run db:migrate\\b"`).
2. Run the app's tests. Add tests for the new constraints (a wrong write must be refused with exactly the right error code).
3. Run the skill **mission-access-test** for every new table/access function.
4. Write the **way back** into `.mission/plan.md`: how this migration is reversed (usually a new migration), where the data is backed up before applying to the real one.

## 4. Done

- Hand `mission-security-reviewer` the migration to review (RLS, permissions, confidential data), then go through the 3 experts as usual.
- Tell the project owner in plain English: what changes, who is affected, what the command to apply it for real is — **wait for the word «yes»** before applying.
