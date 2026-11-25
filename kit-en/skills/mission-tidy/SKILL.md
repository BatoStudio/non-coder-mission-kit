---
name: mission-tidy
description: Tidy the code with the Mission Kit — measure repeated code, duplicate definition names (conflicts), files and functions that are too long; 3 experts plan how to shorten and split; work in small batches that do not change how the app behaves; measure again and compare before/after. Use ONLY when the project owner types /mission-tidy or clearly says "tidy the code", "shorten the code", "split the code", "the code is repeated/conflicting".
---

# Tidy the code: shorten, remove duplicates, split — without changing how the app behaves

The only goal: code that is easy to keep developing. **The app's behaviour must stay the same**: same input → same result, same drawings, same PDF. Tidying is NOT the time to add features, fix bugs or «make improvements while you are at it».

CLI call: `node "$MISSION_KIT/mission.mjs" tidy …`. This command only reads and writes the measurements into `.mission/tidy/`.

## 0. Conditions before starting

1. `git status` clean (or only `.mission/`). Unfinished changes → ask the project owner to commit first; do not mix.
2. `mission check --full` **GREEN** on the current commit. Red → tell the project owner; tidying on top of red means you cannot tell whose fault a failure is.
3. A safety net exists: the app's test/regression suite (`checks.full`, `tests/regression`, sample projects). Any part **not covered by tests** must be stated clearly in the plan and left untouched until there are tests (or the project owner agrees to check it by hand).
4. No `tidy` in the config yet → propose one (editing the config requires asking the project owner): `include` (globs of the real source code, not the build output), `exclude`, and **`sharedScope`** if the app joins several files into one (the build concatenates `src/js/*.js`) or loads several plain `<script>` tags. Without `sharedScope` the kit only sees duplicate names within the same file.

## 1. Measure first

```
node "$MISSION_KIT/mission.mjs" tidy --save truoc-<yyyymmdd>
```

(`truoc` = "before"; keep this file name as is.)

Read the full version `.mission/tidy/truoc-….md`. Four groups:

| Group | Why it matters | Usual way to handle it |
| --- | --- | --- |
| Duplicate definition names | **A real conflict**: in a joined file, the version loaded LATER overrides the earlier one, silently. Editing the earlier one means editing code that never runs | Work out which version really runs (by load/join order). Keep exactly that version's behaviour, delete the dead one, or rename if both are used |
| Repeated code blocks | Fix one place, forget the other → the bug comes back | Merge into one shared function, placed in a sensible file; every place calls that function |
| Long functions | Hard to read, hard to test | Split into small functions whose names say clearly what they do |
| Long files | Hard to find things, several people/agents editing collide | Split by responsibility (read data / calculate / draw / interface), keep the load order |

The numbers are **hints**, not orders. A small block repeated on purpose (easier to read) can stay; write down why.

## 2. Three experts make the plan (nothing edited yet)

Use the `ba-chuyen-gia` skill (or `appSkills.review`), with three fixed areas for tidying:
1. **Structure** — sensible file/function boundaries, where shared functions go, load order, circular dependencies.
2. **Behaviour and regression** — for each proposed change: which version really runs, what could change silently (load order, global variables, `this`, different default values between two «identical» versions), which tests cover it, which tests are still missing.
3. **The next developer** — names, is it easy to add new features, does it create unnecessary abstractions (merging 2 places that only look alike is wrong).

The brief includes the file `.mission/tidy/truoc-….md` and the rule: **do not edit any file**, only propose. Each proposal states: location, what to do, risk, the test that proves it.

Merge into a **batch plan**, write it into `.mission/plan.md` (the NOW/NEXT sections) and report to the project owner with a short table:

| Batch | Task | Files | Risk | Checked by |
| --- | --- | --- | --- | --- |

Priority order: (1) duplicate names/conflicts, (2) repeated blocks that have already caused bugs (see ledger `--pattern`), (3) other repeated blocks, (4) splitting long functions, (5) splitting long files. **Wait for the project owner to approve the plan** before doing anything. The project owner may drop batches or change their order.

## 3. Work batch by batch

Each batch:
1. **One task**, small enough to read the whole diff (usually under ~300 changed lines). Do not edit `protect` areas; do not edit the build output (edit the source, then rebuild).
2. Record in the ledger before editing: `ledger add --category attention --severity LOW --pattern tidy --why "<where the repetition/duplicate/length is>" --fix "<how it will be merged/split>" --loc <file:line>`. Duplicate names where the two versions **differ** in behaviour → `--category defect`, severity by consequence (may be HIGH): that is a hidden bug, tell the project owner.
3. Edit. Only move/merge/rename; do not change formulas, thresholds, displayed text, or the order of results.
4. Check: `mission check --full` must be GREEN. Regression on the sample projects must **match exactly** — never update the baseline while tidying (updating the baseline = behaviour has changed → stop, tell the project owner).
5. `mission tidy --compare truoc-<yyyymmdd>`: no number may **increase** (if there is a ⚠ → review this batch).
6. `ledger close <id> --verify "<check GREEN + regression matches + before/after numbers>"`, commit that batch on its own: `Tidy: <task>` (according to `git.mode`; do not push).
7. Red and still not fixed after 2 attempts → `git restore`/`git revert` that batch, record a `blocker`, move to another batch or tell the project owner.

## 4. Finish

1. `mission tidy --save sau-<yyyymmdd> --compare truoc-<yyyymmdd>` → before/after table (`sau` = "after").
2. The three experts review **the whole diff** from the commit before tidying until now (same three areas as step 2), looking for silent behaviour changes. Results → `.mission/reviews/`, gate G8 if there is one.
3. Update the «Features» section of `.mission/LT.md` to match the new structure (which folder belongs to which feature, where the shared functions are), so next time Claude can look things up instead of rewriting them. The after-edit hook and the `tidy --conflicts` step keep the code from duplicating again.
4. `mission report`. Report to the project owner in English, a few lines: the before/after table, the conflicts removed (which version was kept, and why), which batches were skipped, which parts have no test coverage yet.

## Do not

- Do not merge two pieces that only look alike but serve two different rules (e.g. two companies, two room types) — later they will need to differ.
- Do not change the saved data format, JSON field names, export file names, URLs, localStorage keys — users' old data must still open.
- Do not add new libraries to make it «shorter».
- Do not tidy and fix bugs/add features in the same batch or the same commit.
